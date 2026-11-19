import { KnowledgeUpdateLog, PersonalityKnowledgeEntry } from "../types";

export interface KnowledgeDomainMeta {
  personalityId: string;
  label: string;
  searchQueries: string[];
}

export interface KnowledgeBundle {
  entries: PersonalityKnowledgeEntry[];
  knowledgeUpdates: PersonalityKnowledgeEntry[];
  perspectiveProfile: PersonalityKnowledgeEntry[];
  isDeceased: boolean;
}

class KnowledgeClientService {
  private cache: Map<string, { fetchedAt: number; bundle: KnowledgeBundle }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  public async getKnowledgeBundle(personalityId: string, force: boolean = false): Promise<KnowledgeBundle> {
    const key = (personalityId || "default").toLowerCase();
    const cached = this.cache.get(key);
    if (!force && cached && Date.now() - cached.fetchedAt < this.CACHE_TTL_MS) {
      return cached.bundle;
    }

    try {
      const res = await fetch(`/api/knowledge/${encodeURIComponent(key)}?limit=12`, {
        signal: AbortSignal.timeout(1800),
      });
      if (res.ok) {
        const data = await res.json();
        const entries: PersonalityKnowledgeEntry[] = Array.isArray(data?.entries) ? data.entries : [];
        const layers = data?.layers || {};
        const knowledgeUpdates: PersonalityKnowledgeEntry[] = Array.isArray(layers.knowledgeUpdates)
          ? layers.knowledgeUpdates
          : entries.filter((e) => (e.layer || "knowledge_update") === "knowledge_update");
        const perspectiveProfile: PersonalityKnowledgeEntry[] = Array.isArray(layers.perspectiveProfile)
          ? layers.perspectiveProfile
          : entries.filter((e) => e.layer === "perspective");

        const bundle: KnowledgeBundle = {
          entries,
          knowledgeUpdates,
          perspectiveProfile,
          isDeceased: Boolean(data?.isDeceased),
        };
        this.cache.set(key, { fetchedAt: Date.now(), bundle });
        return bundle;
      }
    } catch (_) {}

    return cached?.bundle || {
      entries: [],
      knowledgeUpdates: [],
      perspectiveProfile: [],
      isDeceased: false,
    };
  }

  public async getKnowledge(personalityId: string, force: boolean = false): Promise<PersonalityKnowledgeEntry[]> {
    const bundle = await this.getKnowledgeBundle(personalityId, force);
    return bundle.entries;
  }

  public async buildIsolatedKnowledgePrompt(personalityId: string): Promise<string> {
    const key = (personalityId || "default").toLowerCase();
    const [personaBundle, memeBundle] = await Promise.all([
      this.getKnowledgeBundle(key),
      this.getKnowledgeBundle("meme_culture"),
    ]);

    const verifiedUpdates = personaBundle.knowledgeUpdates.filter((e) => e.verificationStatus !== "FALSE").slice(0, 4);
    const verifiedPerspectives = personaBundle.perspectiveProfile.filter((e) => e.verificationStatus !== "FALSE").slice(0, 2);
    const verifiedMemes = memeBundle.entries.filter((e) => e.verificationStatus !== "FALSE").slice(0, 3);

    if (verifiedUpdates.length === 0 && verifiedPerspectives.length === 0 && verifiedMemes.length === 0 && !personaBundle.isDeceased) {
      return "";
    }

    const parts: string[] = [];
    if (personaBundle.isDeceased) {
      parts.push(
        `HISTORICAL PERSONA GUARDRAIL (${key.toUpperCase()}): Strictly cite documented historical records, speeches, writings, or verified posthumous scholarship ONLY. NEVER fabricate modern quotes, recent interviews, or contemporary opinions as if delivered posthumously.`
      );
    }

    if (verifiedUpdates.length > 0) {
      const lines = verifiedUpdates.map(
        (e) =>
          `• [${e.verificationStatus}] ${e.topic} (${e.sourceDate || e.publishedAt || e.retrievedAt.slice(0, 10)}): ${e.summary}${
            e.sourceUrl ? ` [Source: ${e.sourceTitle || e.sourceUrl}]` : ""
          }`
      );
      parts.push(`LAYER 2 — ISOLATED KNOWLEDGE UPDATES FOR ${key.toUpperCase()} (CORE PROMPT REMAINS UNCHANGED):\n${lines.join("\n")}`);
    }

    if (verifiedPerspectives.length > 0) {
      const pLines = verifiedPerspectives.map(
        (e) => `• ${e.topic}: ${e.summary}`
      );
      parts.push(`LAYER 3 — PUBLIC PERSPECTIVE & ANALYTICAL CONTEXT FOR ${key.toUpperCase()}:\n${pLines.join("\n")}`);
    }

    if (verifiedMemes.length > 0) {
      const memeLines = verifiedMemes.map(
        (e) => `• ${e.topic}: ${e.summary}`
      );
      parts.push(`CURRENT MEME & INTERNET CULTURE CONTEXT (USE NATURALLY, NEVER OVER-EXPLAIN):\n${memeLines.join("\n")}`);
    }

    return `\n==================================================\n${parts.join("\n\n")}\n==================================================`;
  }

  public async listDomains(): Promise<KnowledgeDomainMeta[]> {
    try {
      const res = await fetch("/api/knowledge/domains", { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data?.domains) ? data.domains : [];
      }
    } catch (_) {}
    return [];
  }

  public async listLogs(limit: number = 25): Promise<KnowledgeUpdateLog[]> {
    try {
      const res = await fetch(`/api/knowledge-logs?limit=${limit}`, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data?.logs) ? data.logs : [];
      }
    } catch (_) {}
    return [];
  }

  public async refreshNow(personalityId: string): Promise<{ status: string; message: string; itemsAdded?: number; itemsUpdated?: number }> {
    const res = await fetch("/api/knowledge/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personalityId }),
    });
    const data = await res.json().catch(() => ({ status: "error", message: "Refresh failed" }));
    this.cache.delete(personalityId.toLowerCase());
    return data;
  }
}

export const knowledgeClientService = new KnowledgeClientService();
