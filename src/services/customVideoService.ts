// src/services/customVideoService.ts
// Persistent storage for 12-Video Multi-Character Avatar Matrix
// 3 Characters (Olivia Purple, Pink Hair, Realistic AI) × 4 Actions (looking, thinking, talking, kiss)
// Uses browser IndexedDB to cache large video Blobs locally with zero GPU/server latency.

export type VideoSlot = "looking" | "thinking" | "talking" | "kiss";
export type AvatarCharacterId = "purple" | "pink" | "realistic";

export interface AvatarCharacterConfig {
  id: AvatarCharacterId;
  name: string;
  shortLabel: string;
  screenBadge: string;
  hairLabel: string;
  description: string;
  stockAssets: Partial<Record<VideoSlot, string>>;
}

export const ALL_VIDEO_SLOTS: VideoSlot[] = ["looking", "talking", "thinking", "kiss"];

export const AVATAR_CHARACTER_CONFIGS: AvatarCharacterConfig[] = [
  {
    id: "purple",
    name: "Olivia (Purple Hair)",
    shortLabel: "Purple",
    screenBadge: "PURPLE CHARACTER",
    hairLabel: "Purple / Violet",
    description:
      "The original Olivia with purple hair. Features custom continuous looking, talking, thinking, and flying kiss.",
    stockAssets: {
      looking: "/videos/looking.mp4",
      talking: "/videos/talking.mp4",
      thinking: "/videos/thinking.mp4",
      kiss: "/videos/kiss.mp4",
    },
  },
  {
    id: "pink",
    name: "Pink Hair Character",
    shortLabel: "Pink Hair",
    screenBadge: "PINK HAIR CHARACTER",
    hairLabel: "Pink / Rose",
    description:
      "Custom pink-haired avatar pack. Upload continuous looking, talking, thinking, and flying kiss clips anytime.",
    stockAssets: {},
  },
  {
    id: "realistic",
    name: "Realistic AI Character",
    shortLabel: "Realistic",
    screenBadge: "REALISTIC AI CHARACTER",
    hairLabel: "Natural / Realistic",
    description:
      "Photorealistic AI companion pack. Upload continuous looking, talking, thinking, and flying kiss clips anytime.",
    stockAssets: {},
  },
];

export function getCharacterConfig(id: AvatarCharacterId): AvatarCharacterConfig {
  return (
    AVATAR_CHARACTER_CONFIGS.find((c) => c.id === id) || AVATAR_CHARACTER_CONFIGS[0]
  );
}

const DB_NAME = "nexa_avatar_media_db";
const DB_VERSION = 1;
const STORE_NAME = "avatar_videos";
const ACTIVE_CHARACTER_STORAGE_KEY = "nexa_active_avatar_character";

export function makeMatrixKey(characterId: AvatarCharacterId, slot: VideoSlot): string {
  return `${characterId}:${slot}`;
}

export function getActiveAvatarCharacter(): AvatarCharacterId {
  if (typeof window === "undefined") return "purple";
  const saved = window.localStorage.getItem(ACTIVE_CHARACTER_STORAGE_KEY);
  if (saved === "purple" || saved === "pink" || saved === "realistic") {
    return saved;
  }
  return "purple";
}

export function setActiveAvatarCharacter(characterId: AvatarCharacterId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_CHARACTER_STORAGE_KEY, characterId);
  window.dispatchEvent(
    new CustomEvent("nexa-avatar-character-changed", { detail: { characterId } })
  );
  window.dispatchEvent(new CustomEvent("nexa-custom-videos-updated"));
}

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

function dispatchVideoUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("nexa-custom-videos-updated"));
  }
}

export async function saveCharacterVideo(
  characterId: AvatarCharacterId,
  slot: VideoSlot,
  fileOrBlob: Blob
): Promise<void> {
  const db = await openDB();
  const key = makeMatrixKey(characterId, slot);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(fileOrBlob, key);
    req.onsuccess = () => {
      dispatchVideoUpdate();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getCharacterVideo(
  characterId: AvatarCharacterId,
  slot: VideoSlot
): Promise<Blob | null> {
  try {
    const db = await openDB();
    const key = makeMatrixKey(characterId, slot);
    const blob = await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => resolve(null);
    });
    if (blob) return blob;

    // Legacy single-character key fallback mapped to "purple"
    if (characterId === "purple") {
      return await new Promise<Blob | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(slot);
        req.onsuccess = () => resolve((req.result as Blob) || null);
        req.onerror = () => resolve(null);
      });
    }
    return null;
  } catch {
    return null;
  }
}

export async function getCharacterCustomVideos(
  characterId: AvatarCharacterId
): Promise<Record<VideoSlot, Blob | null>> {
  const results: Record<VideoSlot, Blob | null> = {
    looking: null,
    thinking: null,
    talking: null,
    kiss: null,
  };
  await Promise.all(
    ALL_VIDEO_SLOTS.map(async (slot) => {
      results[slot] = await getCharacterVideo(characterId, slot);
    })
  );
  return results;
}

export async function getAllMatrixCustomVideos(): Promise<
  Record<AvatarCharacterId, Record<VideoSlot, Blob | null>>
> {
  const [purple, pink, realistic] = await Promise.all([
    getCharacterCustomVideos("purple"),
    getCharacterCustomVideos("pink"),
    getCharacterCustomVideos("realistic"),
  ]);
  return { purple, pink, realistic };
}

export async function removeCharacterVideo(
  characterId: AvatarCharacterId,
  slot: VideoSlot
): Promise<void> {
  try {
    const db = await openDB();
    const key = makeMatrixKey(characterId, slot);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      if (characterId === "purple") {
        store.delete(slot); // Also clean up any legacy key
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    dispatchVideoUpdate();
  } catch (e) {
    console.warn("Could not delete character video slot:", characterId, slot, e);
  }
}

export async function resetCharacterVideos(characterId: AvatarCharacterId): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      ALL_VIDEO_SLOTS.forEach((slot) => {
        store.delete(makeMatrixKey(characterId, slot));
        if (characterId === "purple") {
          store.delete(slot);
        }
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    dispatchVideoUpdate();
  } catch (e) {
    console.warn("Could not reset character videos:", characterId, e);
  }
}

export async function removeAllMatrixVideos(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    dispatchVideoUpdate();
  } catch (e) {
    console.warn("Could not clear all matrix videos:", e);
  }
}

// Legacy single-character wrappers delegating to currently active character
export async function saveCustomVideo(slot: VideoSlot, fileOrBlob: Blob): Promise<void> {
  return saveCharacterVideo(getActiveAvatarCharacter(), slot, fileOrBlob);
}

export async function getCustomVideo(slot: VideoSlot): Promise<Blob | null> {
  return getCharacterVideo(getActiveAvatarCharacter(), slot);
}

export async function getAllCustomVideos(): Promise<Record<VideoSlot, Blob | null>> {
  return getCharacterCustomVideos(getActiveAvatarCharacter());
}

export async function removeCustomVideo(slot: VideoSlot): Promise<void> {
  return removeCharacterVideo(getActiveAvatarCharacter(), slot);
}

export async function removeAllCustomVideos(): Promise<void> {
  return resetCharacterVideos(getActiveAvatarCharacter());
}
