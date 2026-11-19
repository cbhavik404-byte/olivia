// src/services/nexaMemoryStorage.ts
// Production-grade transactional database persistence for NEXA's Advanced Long-Term Memory System
// Uses IndexedDB as primary structured storage with localStorage synchronization fallback.

import { NexaMemory, MemoryCategory, MemorySettings } from "../types";

const DB_NAME = "nexa_memory_system_v2";
const DB_VERSION = 1;
const STORE_MEMORIES = "memories";
const STORE_SETTINGS = "settings";

const LOCAL_STORAGE_MIRROR_KEY = "nexa_advanced_memories_mirror";
const LOCAL_STORAGE_SETTINGS_KEY = "nexa_memory_settings_mirror";

export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  autoMemoryEnabled: true,
  notifyOnAutoSave: true,
  reviewBeforeSave: false,
  maxRecallItems: 5,
};

// Seed foundational memories for Bhavik and Nexa
const INITIAL_SEED_MEMORIES: NexaMemory[] = [
  {
    id: "mem-identity-bhavik",
    userId: "bhavik-core",
    title: "Owner & Creator Identity",
    content: "Owner, creator, and absolute boss of the entire NEXA system is Bhavik (pronounced 'Bhaa-vik'). DoB: July 16, 2008. Operates in deep AI architecture, full-stack software, and high-velocity automation.",
    category: "Identity",
    tags: ["creator", "owner", "boss", "bhavik"],
    source: "Manual",
    status: "Active",
    verificationStatus: "UserVerified",
    confidence: 1.0,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-24T00:00:00Z",
    lastRecalledAt: null,
    recallCount: 0,
    relatedMemoryIds: ["mem-active-nexa", "mem-milestone-nexa"],
    sourceConversationId: null,
  },
  {
    id: "mem-active-nexa",
    userId: "bhavik-core",
    title: "Building NEXA Autonomous Web OS",
    content: "Actively engineering NEXA: High-velocity autonomous AI platform, intelligent swarms, voice synthesis, live camera streaming, and real-time visual learning board.",
    category: "Active",
    tags: ["project", "nexa", "software", "ai-agent"],
    source: "Manual",
    status: "Active",
    verificationStatus: "UserVerified",
    confidence: 1.0,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-24T00:00:00Z",
    lastRecalledAt: null,
    recallCount: 0,
    relatedMemoryIds: ["mem-identity-bhavik"],
    sourceConversationId: null,
  },
  {
    id: "mem-pref-comm",
    userId: "bhavik-core",
    title: "Direct & Warm Communication Preference",
    content: "Prefers direct, honest, conversational, warm, and snappy interactions with zero robotic filler, corporate apologies, or canned disclaimers.",
    category: "Preferences",
    tags: ["communication", "style", "direct"],
    source: "Manual",
    status: "Active",
    verificationStatus: "UserVerified",
    confidence: 1.0,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-24T00:00:00Z",
    lastRecalledAt: null,
    recallCount: 0,
    relatedMemoryIds: [],
    sourceConversationId: null,
  },
  {
    id: "mem-pref-youtube",
    userId: "bhavik-core",
    title: "YouTube Channel: BHAVIK BUILDS HERE",
    content: "Bhavik's primary YouTube Channel is 'BHAVIK BUILDS HERE' focusing on AI Agents, Autonomous Software, Voice AI, and high-CTR educational retention packaging.",
    category: "Preferences",
    tags: ["youtube", "channel", "content", "bhavik-builds-here"],
    source: "Manual",
    status: "Active",
    verificationStatus: "UserVerified",
    confidence: 1.0,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-24T00:00:00Z",
    lastRecalledAt: null,
    recallCount: 0,
    relatedMemoryIds: [],
    sourceConversationId: null,
  },
  {
    id: "mem-milestone-nexa",
    userId: "bhavik-core",
    title: "NEXA Brought to Life Milestone",
    content: "NEXA system core completion milestone: October 3, 2026, fully built and brought to life by Bhavik. In-character persona age: 19–20 years old.",
    category: "Milestones",
    tags: ["milestone", "birthday", "launch", "nexa"],
    source: "Manual",
    status: "Completed",
    verificationStatus: "UserVerified",
    confidence: 1.0,
    createdAt: "2026-10-03T00:00:00Z",
    updatedAt: "2026-10-24T00:00:00Z",
    lastRecalledAt: null,
    recallCount: 0,
    relatedMemoryIds: ["mem-identity-bhavik"],
    sourceConversationId: null,
  },
  {
    id: "mem-behaviors-prompt",
    userId: "bhavik-core",
    title: "Prompt Architect Standard",
    content: "When asked to write prompts, always follow the elite 9-part Prompt Architect standard (Role, Mission, Context, Objective, Constraints, Reasoning, Quality, Format, Success criteria).",
    category: "Behaviors",
    tags: ["prompting", "workflow", "habits"],
    source: "Manual",
    status: "Active",
    verificationStatus: "UserVerified",
    confidence: 1.0,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-24T00:00:00Z",
    lastRecalledAt: null,
    recallCount: 0,
    relatedMemoryIds: [],
    sourceConversationId: null,
  },
];

class NexaMemoryStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryCache: Map<string, NexaMemory> = new Map();
  private isInitialized = false;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        reject(new Error("IndexedDB is unavailable in this environment"));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_MEMORIES)) {
          const memStore = db.createObjectStore(STORE_MEMORIES, { keyPath: "id" });
          memStore.createIndex("category", "category", { unique: false });
          memStore.createIndex("status", "status", { unique: false });
          memStore.createIndex("updatedAt", "updatedAt", { unique: false });
          memStore.createIndex("source", "source", { unique: false });
          memStore.createIndex("verificationStatus", "verificationStatus", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error("[NexaMemoryStorage] IndexedDB open error:", request.error);
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Initializes the memory database, hydrates cache from IndexedDB and local storage mirror.
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;

    // 1. Fast synchronous hydration from local storage mirror
    if (typeof window !== "undefined") {
      try {
        const mirrored = localStorage.getItem(LOCAL_STORAGE_MIRROR_KEY);
        if (mirrored) {
          const parsed: NexaMemory[] = JSON.parse(mirrored);
          if (Array.isArray(parsed)) {
            parsed.forEach((m) => this.memoryCache.set(m.id, m));
          }
        }
      } catch (err) {
        console.warn("[NexaMemoryStorage] Local mirror load warning:", err);
      }
    }

    // 2. Transactional IndexedDB Hydration
    try {
      const db = await this.openDB();
      const allIndexed: NexaMemory[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MEMORIES, "readonly");
        const store = tx.objectStore(STORE_MEMORIES);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (allIndexed.length === 0 && this.memoryCache.size === 0) {
        // Seed default memories
        await this.seedDefaults(db);
      } else if (allIndexed.length > 0) {
        allIndexed.forEach((m) => this.memoryCache.set(m.id, m));
        this.saveMirror();
      }
    } catch (err) {
      console.warn("[NexaMemoryStorage] IndexedDB fallback to memory mirror:", err);
      // Fallback: If cache still empty, seed into memory cache
      if (this.memoryCache.size === 0) {
        INITIAL_SEED_MEMORIES.forEach((m) => this.memoryCache.set(m.id, m));
        this.saveMirror();
      }
    }

    this.isInitialized = true;
  }

  private async seedDefaults(db: IDBDatabase): Promise<void> {
    const tx = db.transaction(STORE_MEMORIES, "readwrite");
    const store = tx.objectStore(STORE_MEMORIES);
    for (const mem of INITIAL_SEED_MEMORIES) {
      store.put(mem);
      this.memoryCache.set(mem.id, mem);
    }
    await new Promise<void>((res) => {
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
    this.saveMirror();
  }

  private saveMirror(): void {
    if (typeof window === "undefined") return;
    try {
      const list = Array.from(this.memoryCache.values());
      localStorage.setItem(LOCAL_STORAGE_MIRROR_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn("[NexaMemoryStorage] Failed to save local mirror:", err);
    }
  }

  public async getAll(): Promise<NexaMemory[]> {
    await this.init();
    return Array.from(this.memoryCache.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public async getById(id: string): Promise<NexaMemory | null> {
    await this.init();
    return this.memoryCache.get(id) || null;
  }

  public async save(memory: NexaMemory): Promise<NexaMemory> {
    await this.init();

    if (!memory.title || !memory.title.trim()) {
      throw new Error("Memory title is required.");
    }
    if (!memory.content || !memory.content.trim()) {
      throw new Error("Memory content is required.");
    }

    const now = new Date().toISOString();
    const finalMemory: NexaMemory = {
      ...memory,
      id: memory.id || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: memory.userId || "bhavik-core",
      title: memory.title.trim(),
      content: memory.content.trim(),
      category: memory.category || "Identity",
      tags: Array.isArray(memory.tags) ? memory.tags.map((t) => t.trim().toLowerCase()).filter(Boolean) : [],
      source: memory.source || "Manual",
      status: memory.status || "Active",
      verificationStatus: memory.verificationStatus || (memory.source === "Manual" ? "UserVerified" : "AIExtracted"),
      confidence: typeof memory.confidence === "number" ? memory.confidence : (memory.source === "Manual" ? 1.0 : 0.85),
      createdAt: memory.createdAt || now,
      updatedAt: now,
      lastRecalledAt: memory.lastRecalledAt || null,
      recallCount: memory.recallCount || 0,
      relatedMemoryIds: memory.relatedMemoryIds || [],
      sourceConversationId: memory.sourceConversationId || null,
    };

    // 1. Transactional IndexedDB persistence
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_MEMORIES, "readwrite");
        const store = tx.objectStore(STORE_MEMORIES);
        const req = store.put(finalMemory);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("[NexaMemoryStorage] IndexedDB write fallback:", err);
    }

    // 2. Synchronous in-memory and local storage mirror update
    this.memoryCache.set(finalMemory.id, finalMemory);
    this.saveMirror();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nexa-memory-changed", { detail: { type: "save", memory: finalMemory } }));
    }

    return finalMemory;
  }

  public async update(id: string, updates: Partial<NexaMemory>): Promise<NexaMemory> {
    await this.init();
    const existing = this.memoryCache.get(id);
    if (!existing) {
      throw new Error(`Memory with ID '${id}' not found.`);
    }

    // Protect UserVerified memories from uncertain AI overwrites
    if (existing.verificationStatus === "UserVerified" && updates.source === "Automatic" && updates.verificationStatus !== "UserVerified") {
      console.warn("[NexaMemoryStorage] Preventing overwrite of UserVerified memory by automatic inference");
      return existing;
    }

    const updated: NexaMemory = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    return this.save(updated);
  }

  public async delete(id: string): Promise<boolean> {
    await this.init();
    const existed = this.memoryCache.has(id);
    if (!existed) return false;

    // 1. Delete from IndexedDB
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_MEMORIES, "readwrite");
        const store = tx.objectStore(STORE_MEMORIES);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("[NexaMemoryStorage] IndexedDB delete fallback:", err);
    }

    // 2. Delete from cache & mirror
    this.memoryCache.delete(id);
    this.saveMirror();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nexa-memory-changed", { detail: { type: "delete", id } }));
    }

    return true;
  }

  public async deleteMultiple(ids: string[]): Promise<number> {
    await this.init();
    let count = 0;
    for (const id of ids) {
      const ok = await this.delete(id);
      if (ok) count++;
    }
    return count;
  }

  public async reassignCategory(ids: string[], newCategory: MemoryCategory): Promise<number> {
    await this.init();
    let count = 0;
    for (const id of ids) {
      const existing = this.memoryCache.get(id);
      if (existing) {
        await this.update(id, { category: newCategory });
        count++;
      }
    }
    return count;
  }

  public async clearAll(): Promise<void> {
    await this.init();
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_MEMORIES, "readwrite");
        const store = tx.objectStore(STORE_MEMORIES);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("[NexaMemoryStorage] IndexedDB clear fallback:", err);
    }

    this.memoryCache.clear();
    this.saveMirror();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nexa-memory-changed", { detail: { type: "clear" } }));
    }
  }

  public async incrementRecall(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    await this.init();
    const now = new Date().toISOString();

    for (const id of ids) {
      const existing = this.memoryCache.get(id);
      if (existing) {
        existing.recallCount = (existing.recallCount || 0) + 1;
        existing.lastRecalledAt = now;
        // Persist recall stats
        try {
          const db = await this.openDB();
          const tx = db.transaction(STORE_MEMORIES, "readwrite");
          tx.objectStore(STORE_MEMORIES).put(existing);
        } catch (_) {}
      }
    }
    this.saveMirror();
  }

  public async getSettings(): Promise<MemorySettings> {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
        if (stored) {
          return { ...DEFAULT_MEMORY_SETTINGS, ...JSON.parse(stored) };
        }
      } catch (_) {}
    }
    return { ...DEFAULT_MEMORY_SETTINGS };
  }

  public async saveSettings(updates: Partial<MemorySettings>): Promise<MemorySettings> {
    const current = await this.getSettings();
    const merged: MemorySettings = { ...current, ...updates };
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent("nexa-memory-settings-changed", { detail: merged }));
      } catch (_) {}
    }
    return merged;
  }

  public async exportJSON(): Promise<string> {
    const memories = await this.getAll();
    const settings = await this.getSettings();
    const exportData = {
      app: "NEXA AI",
      exportedAt: new Date().toISOString(),
      version: "2.0",
      totalMemories: memories.length,
      settings,
      memories,
    };
    return JSON.stringify(exportData, null, 2);
  }

  public async importJSON(jsonStr: string): Promise<{ importedCount: number; updatedCount: number }> {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error("Invalid JSON file format.");
    }

    const list: NexaMemory[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.memories) ? parsed.memories : []);
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error("No valid memory records found in JSON.");
    }

    let importedCount = 0;
    let updatedCount = 0;

    for (const item of list) {
      if (!item.title || !item.content) continue;
      const existing = this.memoryCache.get(item.id);
      if (existing) {
        await this.update(item.id, item);
        updatedCount++;
      } else {
        await this.save(item);
        importedCount++;
      }
    }

    return { importedCount, updatedCount };
  }
}

export const nexaMemoryStorage = new NexaMemoryStorage();
