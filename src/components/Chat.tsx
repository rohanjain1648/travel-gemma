"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/hooks/useGemma";

interface Props {
  messages: ChatMessage[];
  isGenerating: boolean;
  backend: "gpu" | "cpu" | null;
  onSend: (prompt: string) => void;
}

export function Chat({ messages, isGenerating, backend, onSend }: Props) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div className="glass-panel rounded-2xl max-w-2xl w-full mx-auto flex flex-col h-[60vh]">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-hairline">
        <span
          className={`h-2.5 w-2.5 rounded-full aurora-orb`}
          style={{ background: "linear-gradient(120deg, var(--aurora-a), var(--aurora-b))" }}
        />
        <div>
          <p className="text-sm font-medium">Gemma</p>
          <p className="text-xs text-muted">
            {isGenerating
              ? "thinking…"
              : `on-device · ${backend === "cpu" ? "CPU" : "WebGPU"} · offline-ready`}
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-muted text-sm italic">
            Ask about a destination — “3 days in Kyoto for a first-timer who loves food.”
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
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim() && !isGenerating) {
            onSend(input.trim());
            setInput("");
          }
        }}
        className="flex gap-2 px-4 py-4 border-t border-hairline"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Gemma…"
          disabled={isGenerating}
          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-aurora-a/60 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isGenerating || !input.trim()}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
