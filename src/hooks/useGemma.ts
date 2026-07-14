"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GemmaEngine,
  detectBackend,
  type InferenceBackend,
  type LoadProgress,
  type ModelSource,
} from "@/lib/gemma";

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
  // Starts null to match server-rendered HTML (no `navigator` there); the
  // real adapter probe runs after mount so the client's first render still
  // matches the server's, avoiding a hydration mismatch. null = probing.
  const [availableBackend, setAvailableBackend] = useState<InferenceBackend | null>(null);
  const [activeBackend, setActiveBackend] = useState<InferenceBackend | null>(null);
  const engineRef = useRef<GemmaEngine | null>(null);

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

  const send = useCallback(async (prompt: string) => {
    const engine = engineRef.current;
    if (!engine || isGenerating) return;

    setMessages((prev) => [...prev, { role: "user", content: prompt }, { role: "assistant", content: "" }]);
    setIsGenerating(true);
    try {
      await engine.generateStream(prompt, (partial) => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: partial };
          return next;
        });
      });
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: `⚠️ ${err instanceof Error ? err.message : String(err)}`,
        };
        return next;
      });
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating]);

  return {
    status,
    progress,
    error,
    messages,
    isGenerating,
    availableBackend,
    activeBackend,
    load,
    send,
  };
}
