"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GemmaEngine,
  detectBackend,
  type InferenceBackend,
  type LoadProgress,
  type ModelSource,
} from "@/lib/gemma";
import { extractTextFromImage } from "@/lib/ocr";

export type EngineStatus = "idle" | "loading" | "ready" | "error";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useGemma() {
  const [status, setStatus] = useState<EngineStatus>("idle");
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  // Starts null to match server-rendered HTML (no `navigator` there); the
  // real adapter probe runs after mount so the client's first render still
  // matches the server's, avoiding a hydration mismatch. null = probing.
  const [availableBackend, setAvailableBackend] = useState<InferenceBackend | null>(null);
  const [activeBackend, setActiveBackend] = useState<InferenceBackend | null>(null);
  const engineRef = useRef<GemmaEngine | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    detectBackend().then((backend) => {
      if (!cancelled) setAvailableBackend(backend);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async (source: ModelSource) => {
    setStatus("loading");
    setError(null);
    try {
      const engine = await GemmaEngine.load(source, setProgress);
      engineRef.current = engine;
      setActiveBackend(engine.backend);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, []);

  /**
   * Runs a prompt through the model. `displayContent` (defaults to
   * `modelPrompt`) is what renders in the user's chat bubble — for OCR'd
   * photos this is the raw extracted text, while `modelPrompt` wraps it
   * with translation/explanation instructions the model actually sees.
   */
  const runPrompt = useCallback(
    async (modelPrompt: string, displayContent?: string) => {
      const engine = engineRef.current;
      if (!engine || isGenerating) return;

      setMessages((prev) => [
        ...prev,
        { role: "user", content: displayContent ?? modelPrompt },
        { role: "assistant", content: "" },
      ]);
      setIsGenerating(true);
      stoppedRef.current = false;
      try {
        await engine.generateStream(modelPrompt, (partial) => {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: partial };
            return next;
          });
        });
        if (stoppedRef.current) {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = { ...last, content: `${last.content} (stopped)` };
            }
            return next;
          });
        }
      } catch (err) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          };
          return next;
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating]
  );

  const send = useCallback((prompt: string) => runPrompt(prompt), [runPrompt]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    engineRef.current?.cancel();
  }, []);

  const sendImage = useCallback(
    async (file: File) => {
      if (isGenerating || isScanning) return;
      setIsScanning(true);
      try {
        const extracted = await extractTextFromImage(file);
        if (!extracted) {
          setMessages((prev) => [
            ...prev,
            { role: "user", content: "(photo with no readable text)" },
            {
              role: "assistant",
              content: "I couldn't find any readable text in that photo — try getting closer or reducing glare.",
            },
          ]);
          return;
        }
        const modelPrompt =
          `Here is text I photographed and ran through OCR, so it may contain minor errors:\n` +
          `"""\n${extracted}\n"""\n` +
          `If it's not in English, translate it. Briefly explain what it means for a traveler ` +
          `(e.g. a menu item, sign, or instruction).`;
        await runPrompt(modelPrompt, extracted);
      } finally {
        setIsScanning(false);
      }
    },
    [isGenerating, isScanning, runPrompt]
  );

  return {
    status,
    progress,
    error,
    messages,
    isGenerating,
    isScanning,
    availableBackend,
    activeBackend,
    load,
    send,
    sendImage,
    stop,
  };
}
