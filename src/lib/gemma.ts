/// <reference types="@webgpu/types" />
import { Backend, Engine, getOrLoadGlobalLiteRtLm, type Conversation } from "@litert-lm/core";
import { blobWithProgress, getStoredBlob, putStoredBlob } from "./modelStore";

const LITERT_LM_WASM_PATH = "/wasm-litert-lm/";

export type LoadStage =
  | "checking-cache"
  | "downloading"
  | "reading-file"
  | "caching"
  | "initializing"
  | "ready";

export interface LoadProgress {
  stage: LoadStage;
  loadedBytes: number;
  totalBytes: number;
}

export type ModelSource = { kind: "url"; url: string } | { kind: "file"; file: File };

export type InferenceBackend = "gpu" | "cpu";

export function isWebGpuSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

/**
 * True WebGPU availability requires an actual adapter, not just the
 * `navigator.gpu` object — after repeated GPU-process crashes Chrome/Edge
 * blocklists the GPU for the session, and requestAdapter() returns null
 * (or navigator.gpu disappears entirely) until the browser is fully
 * restarted.
 */
export async function detectBackend(): Promise<InferenceBackend> {
  if (!isWebGpuSupported()) return "cpu";
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    return adapter ? "gpu" : "cpu";
  } catch {
    return "cpu";
  }
}

function cacheKeyFor(source: ModelSource): string {
  return source.kind === "url"
    ? `url:${source.url}`
    : `file:${source.file.name}:${source.file.size}:${source.file.lastModified}`;
}

export class GemmaEngine {
  private conversation: Conversation | null = null;

  private constructor(
    private readonly engine: Engine,
    readonly backend: InferenceBackend
  ) {}

  static async load(
    source: ModelSource,
    onProgress: (p: LoadProgress) => void
  ): Promise<GemmaEngine> {
    const backend = await detectBackend();

    const cacheKey = cacheKeyFor(source);
    onProgress({ stage: "checking-cache", loadedBytes: 0, totalBytes: 0 });

    // The model is handled as a Blob end-to-end and never read into an
    // ArrayBuffer: dropped Files are already disk-backed, IndexedDB stores
    // Blobs by disk reference, and the engine streams the Blob in chunks.
    // Materializing a multi-GB model in JS memory (and structured-cloning
    // it into IndexedDB) crashes the renderer outright.
    let blob: Blob | null = null;
    try {
      blob = await getStoredBlob(cacheKey);
    } catch {
      // Cache read failure is non-fatal; fall through to a fresh load.
    }

    if (!blob) {
      if (source.kind === "url") {
        onProgress({ stage: "downloading", loadedBytes: 0, totalBytes: 0 });
        const response = await fetch(source.url);
        if (!response.ok) {
          throw new Error(`Failed to download model: HTTP ${response.status}`);
        }
        blob = await blobWithProgress(response, (loadedBytes, totalBytes) =>
          onProgress({ stage: "downloading", loadedBytes, totalBytes })
        );
      } else {
        blob = source.file;
        onProgress({
          stage: "reading-file",
          loadedBytes: source.file.size,
          totalBytes: source.file.size,
        });
      }

      onProgress({ stage: "caching", loadedBytes: blob.size, totalBytes: blob.size });
      try {
        await putStoredBlob(cacheKey, blob);
      } catch {
        // Caching is best-effort: if IndexedDB rejects the blob (quota,
        // private mode), the model still loads — it just won't be cached.
      }
    } else {
      onProgress({ stage: "downloading", loadedBytes: blob.size, totalBytes: blob.size });
    }

    onProgress({ stage: "initializing", loadedBytes: blob.size, totalBytes: blob.size });

    // Points the runtime at our locally-hosted WASM instead of its jsDelivr
    // CDN default, so the model + runtime are both servable fully offline
    // after the first load.
    await getOrLoadGlobalLiteRtLm(LITERT_LM_WASM_PATH);

    const engine = await Engine.create({
      model: blob,
      // On GPU, keep the library's default GPU_ARTISAN backend: it streams
      // the model straight to the GPU without staging the whole file in the
      // WASM heap (which has a 4GB ceiling a 2GB model would flirt with).
      // CPU is the explicit fallback when no WebGPU adapter is available.
      ...(backend === "cpu" ? { backend: Backend.CPU } : {}),
      mainExecutorSettings: { maxNumTokens: 4096 },
    });

    onProgress({ stage: "ready", loadedBytes: blob.size, totalBytes: blob.size });
    return new GemmaEngine(engine, backend);
  }

  private async getConversation(): Promise<Conversation> {
    if (!this.conversation) {
      // Engine-default sampler only: the early-preview GPU sampler rejects
      // top-k > 1 ("Top-K value must be <= 1"), so any custom samplerParams
      // kill generation before it starts.
      this.conversation = await this.engine.createConversation();
    }
    return this.conversation;
  }

  /** Streams a response token-by-token via onToken; resolves with the full text. */
  async generateStream(prompt: string, onToken: (partial: string, done: boolean) => void): Promise<string> {
    const conversation = await this.getConversation();
    let full = "";
    for await (const chunk of conversation.sendMessageStreaming(prompt)) {
      if (typeof chunk.content === "string") {
        full += chunk.content;
        onToken(full, false);
        continue;
      }
      for (const part of chunk.content ?? []) {
        if (part.type === "text") {
          full += part.text;
          onToken(full, false);
        }
      }
    }
    onToken(full, true);
    return full;
  }

  cancel(): void {
    this.conversation?.cancel();
  }

  async close(): Promise<void> {
    await this.conversation?.delete();
    await this.engine.delete();
  }
}
