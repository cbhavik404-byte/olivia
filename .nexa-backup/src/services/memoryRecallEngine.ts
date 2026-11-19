// src/services/memoryRecallEngine.ts
// Automatic Memory Recall Engine for NEXA
// Retrieves relevant memories, ranks by relevance, reliability, recency, and status, and formats context for Gemini.

import { nexaMemoryStorage } from "./nexaMemoryStorage";
import { NexaMemory } from "../types";

export interface RankedMemory {
  memory: NexaMemory;
  score: number;
  matchedTerms: string[];
}

export class MemoryRecallEngine {
  /**
   * Retrieves memories relevant to the current user query and context.
   */
  public async retrieveRelevant(query: string, limit: number = 5): Promise<NexaMemory[]> {
    if (!query || !query.trim()) return [];

    const allMemories = await nexaMemoryStorage.getAll();
    if (allMemories.length === 0) return [];

    const cleanQuery = query.toLowerCase().trim();
    const queryTokens = cleanQuery
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9_-]/g, ""))
      .filter((w) => w.length > 2);

    // Explicit intent checks
    const isAskingAboutProjects =
      cleanQuery.includes("planning to build") ||
      cleanQuery.includes("what project") ||
      cleanQuery.includes("what was i building") ||
      cleanQuery.includes("my projects") ||
      cleanQuery.includes("what i am building") ||
      cleanQuery.includes("what i was building") ||
      cleanQuery.includes("my goals");

    const isAskingAboutIdentity =
      cleanQuery.includes("who am i") ||
      cleanQuery.includes("what do you know about me") ||
      cleanQuery.includes("what is my name") ||
      cleanQuery.includes("remember about me") ||
      cleanQuery.includes("my age") ||
      cleanQuery.includes("my birthday");

    const isAskingAboutPreferences =
      cleanQuery.includes("my preference") ||
      cleanQuery.includes("what do i like") ||
      cleanQuery.includes("how do i like") ||
      cleanQuery.includes("my communication style");

    const isAskingAboutMilestones =
      cleanQuery.includes("what have i completed") ||
      cleanQuery.includes("what did we achieve") ||
      cleanQuery.includes("my milestones") ||
      cleanQuery.includes("accomplishment");

    const ranked: RankedMemory[] = [];

    for (const mem of allMemories) {
      let score = 0;
      const matchedTerms: string[] = [];
      const titleLower = mem.title.toLowerCase();
      const contentLower = mem.content.toLowerCase();
      const tagsLower = (mem.tags || []).map((t) => t.toLowerCase());

      // 1. Direct category intent boost
      if (isAskingAboutProjects && (mem.category === "Active" || mem.category === "Milestones")) {
        score += 15;
      }
      if (isAskingAboutIdentity && mem.category === "Identity") {
        score += 15;
      }
      if (isAskingAboutPreferences && mem.category === "Preferences") {
        score += 15;
      }
      if (isAskingAboutMilestones && mem.category === "Milestones") {
        score += 15;
      }

      // 2. Token Matching
      for (const token of queryTokens) {
        if (titleLower.includes(token)) {
          score += 4;
          matchedTerms.push(token);
        } else if (contentLower.includes(token)) {
          score += 2;
          matchedTerms.push(token);
        }

        if (tagsLower.some((t) => t.includes(token))) {
          score += 3;
          matchedTerms.push(token);
        }
      }

      // 3. Exact multi-word phrase matching
      if (titleLower.includes(cleanQuery) || cleanQuery.includes(titleLower)) {
        score += 10;
      }

      // 4. Quality & Verification status multiplier
      if (mem.verificationStatus === "UserVerified") {
        score += 2;
      }
      if (mem.status === "Active" || mem.status === "Planned") {
        score += 1.5;
      }

      // 5. Recency boost (within last 7 days)
      const daysSinceUpdate = (Date.now() - new Date(mem.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 7) {
        score += 1.0;
      }

      if (score > 2) {
        ranked.push({ memory: mem, score, matchedTerms });
      }
    }

    // Sort descending by score
    ranked.sort((a, b) => b.score - a.score);

    const topResults = ranked.slice(0, limit).map((r) => r.memory);

    // Track recall usage statistics asynchronously
    if (topResults.length > 0) {
      nexaMemoryStorage.incrementRecall(topResults.map((m) => m.id)).catch(() => {});
    }

    return topResults;
  }

  /**
   * Formats retrieved memories into a high-density, prompt-ready context block.
   */
  public formatForPrompt(memories: NexaMemory[]): string {
    if (!memories || memories.length === 0) return "";

    const lines = memories.map((m) => {
      const statusStr = m.status ? ` [${m.status}]` : "";
      const sourceStr = m.verificationStatus === "UserVerified" ? "Verified" : "AI-Extracted";
      return `• [${m.category.toUpperCase()}${statusStr}] "${m.title}" (${sourceStr}):\n  ${m.content}`;
    });

    return `==================================================\nRECALLED LONG-TERM MEMORIES (PERSISTENT & ACTIVE):\n${lines.join("\n\n")}\n==================================================\nUse these recalled memories naturally when answering Bhavik. Do not robotically announce that you are looking up memory unless specifically asked.`;
  }
}

export const memoryRecallEngine = new MemoryRecallEngine();
