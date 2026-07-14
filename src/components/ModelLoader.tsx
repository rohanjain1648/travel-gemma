"use client";

import { useCallback, useRef, useState } from "react";
import type { LoadProgress } from "@/lib/gemma";

const STAGE_LABEL: Record<LoadProgress["stage"], string> = {
  "checking-cache": "Checking on-device cache…",
  downloading: "Downloading model weights…",
  "reading-file": "Reading local file…",
  caching: "Caching for offline use…",
  initializing: "Initializing Gemma on WebGPU…",
  ready: "Ready",
};

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb > 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(0)} MB`;
}

interface Props {
  /** null = still probing the GPU adapter */
  availableBackend: "gpu" | "cpu" | null;
  progress: LoadProgress | null;
  error: string | null;
  onLoadFile: (file: File) => void;
  onLoadUrl: (url: string) => void;
}

export function ModelLoader({ availableBackend, progress, error, onLoadFile, onLoadUrl }: Props) {
  const [url, setUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onLoadFile(file);
    },
    [onLoadFile]
  );

  const pct =
    progress && progress.totalBytes > 0
      ? Math.min(100, Math.round((progress.loadedBytes / progress.totalBytes) * 100))
      : null;

  return (
    <div className="glass-panel rounded-2xl p-8 max-w-xl w-full mx-auto">
      <h2 className="font-serif text-2xl mb-1">Load Gemma 4, locally</h2>
      <p className="text-muted text-sm mb-6">
        Bring a <code className="text-foreground/80">.litertlm</code> build of Gemma 4 (E2B or E4B,
        the edge-optimized variants) for LiteRT-LM. It runs entirely in this tab via WebGPU — nothing
        is uploaded anywhere.
      </p>

      {availableBackend === "cpu" && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          No WebGPU adapter right now — Gemma will run on the CPU fallback (slower but fully
          functional). If your machine has a GPU, fully restarting the browser usually restores
          WebGPU: after a graphics crash, Chrome/Edge disables it until every window is closed.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {progress && (
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted mb-2">
            <span>{STAGE_LABEL[progress.stage]}</span>
            {pct !== null && <span>{pct}% · {formatBytes(progress.loadedBytes)}</span>}
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${pct ?? 8}%`,
                background: "linear-gradient(90deg, var(--aurora-a), var(--aurora-b))",
              }}
            />
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border border-dashed px-6 py-10 text-center text-sm transition-colors ${
          dragOver ? "border-aurora-a bg-aurora-a/5" : "border-white/15 hover:border-white/30"
        }`}
      >
        <p className="text-foreground/90 mb-1">Drop a .litertlm file here, or click to browse</p>
        <p className="text-muted text-xs">Cached in IndexedDB after first load — works offline from then on</p>
        <input
          ref={inputRef}
          type="file"
          accept=".litertlm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onLoadFile(file);
          }}
        />
      </div>

      <div className="flex items-center gap-3 my-5">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-muted">or fetch from a URL</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) onLoadUrl(url.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm"
          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-aurora-a/60"
        />
        <button
          type="submit"
          className="rounded-lg px-4 py-2 text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          Load
        </button>
      </form>
    </div>
  );
}
