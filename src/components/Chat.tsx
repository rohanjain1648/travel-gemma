"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/hooks/useGemma";
import { useSpeechRecognition, useSpeechSynthesis } from "@/hooks/useSpeech";

interface Props {
  messages: ChatMessage[];
  isGenerating: boolean;
  isScanning: boolean;
  backend: "gpu" | "cpu" | null;
  onSend: (prompt: string) => void;
  onSendImage: (file: File) => void;
  onStop: () => void;
}

export function Chat({ messages, isGenerating, isScanning, backend, onSend, onSendImage, onStop }: Props) {
  const [input, setInput] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasGenerating = useRef(false);

  const speech = useSpeechRecognition();
  const synth = useSpeechSynthesis();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (wasGenerating.current && !isGenerating && autoSpeak) {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && last.content) {
        synth.speak(last.content);
      }
    }
    wasGenerating.current = isGenerating;
  }, [isGenerating, autoSpeak, messages, synth]);

  const busy = isGenerating || isScanning;

  return (
    <div className="glass-panel rounded-2xl max-w-2xl w-full mx-auto flex flex-col h-[60vh]">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-hairline">
        <div className="flex items-center gap-3">
          <span
            className="h-2.5 w-2.5 rounded-full aurora-orb"
            style={{ background: "linear-gradient(120deg, var(--aurora-a), var(--aurora-b))" }}
          />
          <div>
            <p className="text-sm font-medium">Gemma</p>
            <p className="text-xs text-muted">
              {isGenerating
                ? "thinking…"
                : isScanning
                  ? "reading photo…"
                  : `on-device · ${backend === "cpu" ? "CPU" : "WebGPU"} · offline-ready`}
            </p>
          </div>
        </div>
        {synth.isSupported && (
          <button
            type="button"
            onClick={() => {
              if (autoSpeak) synth.cancel();
              setAutoSpeak((v) => !v);
            }}
            title={autoSpeak ? "Voice replies on" : "Voice replies off"}
            className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
              autoSpeak
                ? "border-aurora-a/60 text-aurora-a bg-aurora-a/10"
                : "border-white/10 text-muted hover:border-white/25"
            }`}
          >
            {autoSpeak ? "Voice on" : "Voice off"}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-muted text-sm italic">
            Ask about a destination, tap the mic to speak, or scan a menu or sign with the camera.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-foreground text-background"
                  : "bg-white/5 border border-hairline text-foreground/95"
              }`}
            >
              {m.content || <span className="opacity-40">…</span>}
            </div>
          </div>
        ))}
        {isScanning && (
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm bg-foreground/60 text-background italic">
              Reading photo…
            </div>
          </div>
        )}
      </div>

      {speech.error && <p className="px-4 pt-2 text-xs text-red-300">{speech.error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim() && !busy) {
            onSend(input.trim());
            setInput("");
          }
        }}
        className="flex items-center gap-2 px-4 py-4 border-t border-hairline"
      >
        {speech.isSupported && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (speech.isListening) {
                speech.stop();
                return;
              }
              speech.start((transcript) => {
                if (transcript.trim()) onSend(transcript.trim());
              });
            }}
            title={speech.isListening ? "Stop listening" : "Speak your message"}
            className={`shrink-0 h-9 w-9 rounded-full border flex items-center justify-center transition-colors disabled:opacity-40 ${
              speech.isListening
                ? "border-aurora-a bg-aurora-a/15 text-aurora-a aurora-orb"
                : "border-white/10 text-muted hover:border-white/25"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </button>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          title="Scan a photo (menu, sign, label)"
          className="shrink-0 h-9 w-9 rounded-full border border-white/10 text-muted hover:border-white/25 flex items-center justify-center transition-colors disabled:opacity-40"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSendImage(file);
            e.target.value = "";
          }}
        />

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={speech.isListening ? "Listening…" : "Message Gemma…"}
          disabled={busy}
          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-aurora-a/60 disabled:opacity-50"
        />
        {isGenerating ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded-lg px-4 py-2 text-sm font-medium border border-red-400/40 text-red-300 hover:bg-red-400/10 transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
