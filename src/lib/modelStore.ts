const DB_NAME = "meridian-models";
const STORE_NAME = "weights";
// v2: values are Blobs (disk-backed, stored by reference), not ArrayBuffers.
// Structured-cloning a multi-GB ArrayBuffer into IndexedDB can hard-crash
// the renderer; Blobs avoid ever materializing the model in memory.
const DB_VERSION = 2;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getStoredBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : null);
    req.onerror = () => reject(req.error);
  });
}

export async function putStoredBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteStoredModel(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Downloads a fetch Response into a disk-backed Blob while reporting byte
 * progress. The response body is tee'd: one branch feeds Blob creation
 * (Chrome spools large blobs to disk), the other just counts bytes.
 */
export async function blobWithProgress(
  response: Response,
  onProgress: (loadedBytes: number, totalBytes: number) => void
): Promise<Blob> {
  const totalBytes = Number(response.headers.get("content-length") ?? 0);
  if (!response.body) {
    return response.blob();
  }

  const [blobStream, progressStream] = response.body.tee();
  const blobPromise = new Response(blobStream).blob();

  const reader = progressStream.getReader();
  let loadedBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    loadedBytes += value.byteLength;
    onProgress(loadedBytes, totalBytes);
  }

  return blobPromise;
}
