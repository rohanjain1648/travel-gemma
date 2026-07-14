"use client";

import { useGemma } from "@/hooks/useGemma";
import { ModelLoader } from "@/components/ModelLoader";
import { Chat } from "@/components/Chat";

export default function Home() {
  const { status, progress, error, messages, isGenerating, availableBackend, activeBackend, load, send } =
    useGemma();

  return (
    <div className="flex flex-col flex-1 items-center px-6 py-16 sm:py-24">
      <header className="text-center mb-14 max-w-2xl">
        <p className="text-xs tracking-[0.2em] uppercase text-muted mb-4">Build with Gemma</p>
        <h1 className="font-serif text-5xl sm:text-6xl italic mb-4">
          <span className="aurora-text">Meridian</span>
        </h1>
        <p className="text-muted text-lg">Your world, understood. Even offline.</p>
      </header>

      <main className="flex flex-1 w-full items-start justify-center">
        {status !== "ready" ? (
          <ModelLoader
            availableBackend={availableBackend}
            progress={status === "loading" ? progress : null}
            error={error}
            onLoadFile={(file) => load({ kind: "file", file })}
            onLoadUrl={(url) => load({ kind: "url", url })}
          />
        ) : (
          <Chat
            messages={messages}
            isGenerating={isGenerating}
            backend={activeBackend}
            onSend={send}
          />
        )}
      </main>

      <footer className="mt-10 text-xs text-muted">
        Gemma runs locally in this browser tab via WebGPU. Nothing you type leaves this device.
      </footer>
    </div>
  );
}
