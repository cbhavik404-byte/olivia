// src/services/customVideoService.ts
// Persistent storage for custom Nexa avatar videos (Continuously Looking, Talking, Thinking, Kiss)
// Uses browser IndexedDB to safely store large MP4 Blobs with zero server latency.

export type VideoSlot = "looking" | "thinking" | "talking" | "kiss";

const DB_NAME = "nexa_avatar_media_db";
const DB_VERSION = 1;
const STORE_NAME = "avatar_videos";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCustomVideo(slot: VideoSlot, fileOrBlob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(fileOrBlob, slot);
    req.onsuccess = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("nexa-custom-videos-updated"));
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getCustomVideo(slot: VideoSlot): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(slot);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function getAllCustomVideos(): Promise<Record<VideoSlot, Blob | null>> {
  const slots: VideoSlot[] = ["looking", "thinking", "talking", "kiss"];
  const results: Record<VideoSlot, Blob | null> = {
    looking: null,
    thinking: null,
    talking: null,
    kiss: null
  };
  try {
    const db = await openDB();
    await Promise.all(
      slots.map((slot) => {
        return new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(slot);
          req.onsuccess = () => {
            results[slot] = req.result || null;
            resolve();
          };
          req.onerror = () => resolve();
        });
      })
    );
  } catch (e) {
    console.warn("Could not read custom videos:", e);
  }
  return results;
}

export async function removeCustomVideo(slot: VideoSlot): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(slot);
      req.onsuccess = () => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("nexa-custom-videos-updated"));
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("Could not delete custom video slot:", slot, e);
  }
}

export async function removeAllCustomVideos(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("nexa-custom-videos-updated"));
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("Could not clear custom videos:", e);
  }
}
