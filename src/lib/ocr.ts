import Tesseract from "tesseract.js";

let workerPromise: Promise<Tesseract.Worker> | null = null;

function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    // Runtime (worker script + WASM core) is self-hosted for the offline
    // story; the English language model itself still downloads from
    // Tesseract's CDN on first use (~1-2MB, gzip) and is cached by the
    // browser's HTTP cache afterward — everything else in this app avoids
    // any network dependency, but bundling trained language data wasn't
    // worth the size for a single auxiliary feature.
    workerPromise = Tesseract.createWorker("eng", 1, {
      workerPath: "/tesseract/worker.min.js",
      corePath: "/tesseract/tesseract-core-simd-lstm.wasm.js",
    });
  }
  return workerPromise;
}

export async function extractTextFromImage(source: File | Blob): Promise<string> {
  const worker = await getWorker();
  const {
    data: { text },
  } = await worker.recognize(source);
  return text.trim();
}
