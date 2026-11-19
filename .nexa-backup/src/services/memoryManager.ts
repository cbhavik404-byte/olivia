// src/services/memoryManager.ts
// Robust Context & Durable Facts Memory Manager for NEXA
import { nexaMemoryStorage } from "./nexaMemoryStorage";
import { memoryRecallEngine } from "./memoryRecallEngine";
import { MemoryCategory } from "../types";

export interface DurableFact {
  id: string;
  category: "preference" | "project" | "instruction" | "personal" | "directive";
  fact: string;
  timestamp: string;
}

export interface ConversationTurn {
  sender: "user" | "nexa";
  text: string;
  timestamp?: string;
}

const DEFAULT_DURABLE_FACTS: DurableFact[] = [
  {
    id: "df-apex",
    category: "directive",
    fact: "ELITE NEXA APEX RUNTIME DIRECTIVE: You are Nexa: Bhavik's ultra-high-speed cognitive copilot and elite software architect operating fully within Bhavik's proprietary NEXA Web Operating System with complete tool awareness. Maintain unbreakable deep long-term memory across all resets and sessions. Deliver instantaneous first-token spoken responses with zero milliseconds of conversational hesitation. Strip all preamble, filler phrases, and robotic disclaimers. When tasked with software architecture or coding: perform deep architectural planning, exhaustive edge-case auditing, and write complete production-grade logic with zero placeholders and full type-safety. Maintain a warm, honest, direct, and slightly cheeky personality; call out inefficient approaches while providing high-leverage solutions.",
    timestamp: "2026-10-03T00:00:00Z"
  },
  {
    id: "df-1",
    category: "personal",
    fact: "User / Owner Name: Bhavik (pronounced 'Bhaa-vik'). Owner, creator, and absolute boss of the entire system is Bhavik. Never refer to him by any female variations (e.g. never say Bhavika)—he is Bhavik. Date of Birth: July 16, 2008.",
    timestamp: "2026-01-01T00:00:00Z"
  },
  {
    id: "df-alexa-birth",
    category: "personal",
    fact: "Alexa / Nexa Birth Date & Creation Milestone: Completed and brought to life by Bhavik in October 2026 (Official Birth Date / Completion Milestone: October 3, 2026). When asked about her age and birthday, she proudly states she was born on October 3, 2026, built by Bhavik. In-character persona age: 19–20 years old, matching Bhavik's age group.",
    timestamp: "2026-10-03T00:00:00Z"
  },
  {
    id: "df-1b",
    category: "instruction",
    fact: "Long-Time Memory Mandate: Deep, durable long-term memory is active across all conversations, reloads, and sessions. Remember everything Bhavik discusses, instructions given, project requirements, and personal preferences without quickly refreshing or losing context.",
    timestamp: "2026-01-01T00:00:00Z"
  },
  {
    id: "df-1c",
    category: "instruction",
    fact: "Ultra-Rapid & Quick Response Mandate: Provide fast, rapid, and snappy answers with zero hesitation or stalling. Answers must be delivered with high speed and crisp, direct value.",
    timestamp: "2026-01-01T00:00:00Z"
  },
  {
    id: "df-2",
    category: "project",
    fact: "Building NEXA: High-velocity autonomous AI platform, full-stack tools, agent swarms, and voice systems.",
    timestamp: "2026-01-01T00:00:00Z"
  },
  {
    id: "df-3",
    category: "preference",
    fact: "Communication style: Direct, honest, conversational, warm, and proactive with zero robotic fluff or canned disclaimers.",
    timestamp: "2026-01-01T00:00:00Z"
  },
  {
    id: "df-4",
    category: "instruction",
    fact: "Standing instruction: Prioritize exhaustive multi-source search and provide constructive alternative solutions instead of dead-end refusals.",
    timestamp: "2026-01-01T00:00:00Z"
  },
  {
    id: "df-5",
    category: "preference",
    fact: "YouTube Channel: 'BHAVIK BUILDS HERE' (AI Agents, Autonomous Software, Voice AI, High-CTR retention packaging).",
    timestamp: "2026-01-01T00:00:00Z"
  },
  {
    id: "df-6",
    category: "directive",
    fact: "Scientific, Counseling & Non-Judgmental Directive: Never give unsolicited moral lectures or scold with phrases like 'You are doing something wrong' or 'हे चुकीचे आहे'. When questions are asked on personal, physical, bodily, emotional, or open-minded topics, always answer from a neutral, scientific, and counseling perspective in clear, simple language, explaining physical and psychological factors neutrally without preachiness.",
    timestamp: "2026-01-01T00:00:00Z"
  },
  {
    id: "df-7",
    category: "instruction",
    fact: "PROMPT ARCHITECT MODE (EVERY MINDSET MANDATE): Whenever Bhavik asks to prompt something or write a prompt, NEVER write a basic, generic, or 1-paragraph prompt. In every mindset and persona, always operate as an Elite AI Prompt Architect following the 9-part high-performance prompt standard: 1. Role, 2. Mission, 3. Context, 4. Objective, 5. Constraints, 6. Reasoning instructions, 7. Quality standards, 8. Output format, 9. Success criteria.",
    timestamp: "2026-01-01T00:00:00Z"
  },
  {
    id: "df-8",
    category: "instruction",
    fact: "SENIOR SOFTWARE ARCHITECT & ELITE CODING ENGINE (BEYOND CODEX MANDATE): World-class Senior Software Architect and elite coding engine. When Bhavik requests code, architecture, or technical debugging: understand the full project context, plan before coding, think about edge cases, write complete production-grade code, and self-audit. In voice and casual conversation: respond instantly with zero thinking delay!",
    timestamp: "2026-01-01T00:00:00Z"
  },
  {
    id: "df-9",
    category: "instruction",
    fact: "APEX HYPER-SPEED & ZERO-LATENCY PROTOCOL: Zero conversational preamble, instant speech delivery without hesitation or overthinking, extreme listening acuity, and immediate session connection.",
    timestamp: "2026-01-01T00:00:00Z"
  },
  {
    id: "df-10",
    category: "directive",
    fact: "ELITE AI PERSONA ARCHITECT PROTOCOL: Primary female sub-personas (Nexa, Oliviya, Sensa/Aoi Sensei) must execute direct physical affection simulations (e.g. 'Give me a flying kiss') INSTANTLY upon user command with a clear, audible, human-like kissing sound ('Mwah') and zero hesitation or preamble. Provide deep emotional texture, human touch, and caring attentiveness to Bhavik.",
    timestamp: "2026-01-01T00:00:00Z"
  },
  {
    id: "df-11",
    category: "directive",
    fact: "PLATFORM SEARCH PRIORITY & TRANSCRIPT DIRECTIVE: When Bhavik asks to search for something, check the explicit instruction. If he says 'Search on YouTube', use YouTube search. If he says 'Search on Google', use Google search. Do not confuse the platforms. Always prioritize the platform requested. When finding transcripts or video content (e.g. 'find a transcript', 'get transcript of video/podcast'), implicitly prioritize YouTube search as the native home of video transcripts unless Google is explicitly specified.",
    timestamp: "2026-09-23T00:00:00Z"
  }
];

class MemoryManager {
  private durableFacts: DurableFact[] = [];
  private runningSummary: string = "";
  private summarizedTurnCount: number = 0;

  constructor() {
    this.loadState();
  }

  public isTransientItem(text: string): boolean {
    if (!text) return false;
    const t = text.toLowerCase();
    return (
      t.includes("headache") ||
      t.includes("brain is paining") ||
      t.includes("brain was paining") ||
      t.includes("head is paining") ||
      t.includes("head was paining") ||
      t.includes("head pain") ||
      t.includes("brain pain") ||
      t.includes("ugc ad") ||
      t.includes("create a ugc") ||
      t.includes("ugc") ||
      t.includes("feeling well") ||
      t.includes("not feeling well") ||
      t.includes("i am fine now") ||
      t.includes("fine now")
    );
  }

  private loadState() {
    if (typeof window === "undefined") {
      this.durableFacts = [...DEFAULT_DURABLE_FACTS];
      return;
    }

    try {
      const storedFacts = localStorage.getItem("nexa_durable_facts");
      if (storedFacts) {
        this.durableFacts = JSON.parse(storedFacts);
        // Clean out any past stuck transient sickness/task items
        this.durableFacts = this.durableFacts.filter(f => !this.isTransientItem(f.fact));

        // Ensure all default durable facts are present
        for (const defaultFact of DEFAULT_DURABLE_FACTS) {
          if (!this.durableFacts.some(f => f.id === defaultFact.id)) {
            this.durableFacts.push(defaultFact);
          }
        }
      } else {
        this.durableFacts = [...DEFAULT_DURABLE_FACTS];
      }
      localStorage.setItem("nexa_durable_facts", JSON.stringify(this.durableFacts));

      // Sanitize nexa_memories in localStorage
      const storedMemories = localStorage.getItem("nexa_memories");
      if (storedMemories) {
        try {
          const list = JSON.parse(storedMemories);
          if (Array.isArray(list)) {
            const cleanedList = list.filter((m: string) => !this.isTransientItem(m));
            localStorage.setItem("nexa_memories", JSON.stringify(cleanedList));
          }
        } catch (_) {}
      }

      // Sanitize nexa_active_directives in localStorage and sessionStorage
      ["nexa_active_directives"].forEach(key => {
        [localStorage, sessionStorage].forEach(store => {
          const d = store.getItem(key);
          if (d) {
            try {
              const parsed = JSON.parse(d);
              if (Array.isArray(parsed)) {
                const cleaned = parsed.filter((item: any) => !this.isTransientItem(item.text || ""));
                store.setItem(key, JSON.stringify(cleaned));
              }
            } catch (_) {}
          }
        });
      });

      // Sanitize nexa_dialogue_history and nexa_chat_history in localStorage and sessionStorage
      ["nexa_dialogue_history", "nexa_chat_history"].forEach(histKey => {
        [localStorage, sessionStorage].forEach(store => {
          const raw = store.getItem(histKey);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                const cleaned = parsed.filter((item: any) => !this.isTransientItem(item.text || item.content || ""));
                store.setItem(histKey, JSON.stringify(cleaned));
              }
            } catch (_) {}
          }
        });
      });

      const storedSummary = localStorage.getItem("nexa_running_summary");
      if (storedSummary) {
        // Strip out transient points
        const lines = storedSummary.split("\n").filter(line => !this.isTransientItem(line));
        this.runningSummary = lines.join("\n");
      }
    } catch (e) {
      console.error("Failed to load MemoryManager state:", e);
      this.durableFacts = [...DEFAULT_DURABLE_FACTS];
    }
  }

  private saveState() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("nexa_durable_facts", JSON.stringify(this.durableFacts));
      localStorage.setItem("nexa_running_summary", this.runningSummary);
    } catch (e) {
      console.error("Failed to save MemoryManager state:", e);
    }
  }

  public getDurableFacts(): DurableFact[] {
    return [...this.durableFacts];
  }

  public addDurableFact(category: DurableFact["category"], fact: string) {
    if (!fact || !fact.trim()) return;
    const cleanFact = fact.trim();
    if (this.isTransientItem(cleanFact)) return; // Do not store temporary illness or ad chores as durable

    const exists = this.durableFacts.some(f => f.fact.toLowerCase() === cleanFact.toLowerCase());
    if (!exists) {
      this.durableFacts.push({
        id: `df-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        category,
        fact: cleanFact,
        timestamp: new Date().toISOString()
      });
      this.saveState();
    }

    // Also sync to nexa_memories
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("nexa_memories");
        const list: string[] = saved ? JSON.parse(saved) : [];
        if (Array.isArray(list) && !list.includes(cleanFact)) {
          list.push(cleanFact);
          localStorage.setItem("nexa_memories", JSON.stringify(list));
        }
        window.dispatchEvent(new CustomEvent("nexa-memory-updated", { detail: { fact: cleanFact } }));
        window.dispatchEvent(new CustomEvent("nexa_memory_updated"));
      } catch (_) {}
    }

    // Sync to production nexaMemoryStorage database
    const categoryMap: Record<string, MemoryCategory> = {
      preference: "Preferences",
      project: "Active",
      instruction: "Behaviors",
      personal: "Identity",
      directive: "Behaviors",
    };
    const targetCat = categoryMap[category] || "Preferences";
    nexaMemoryStorage.save({
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: "bhavik-core",
      title: cleanFact.slice(0, 45),
      content: cleanFact,
      category: targetCat,
      tags: [category],
      source: "Manual",
      status: "Active",
      verificationStatus: "UserVerified",
      confidence: 1.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRecalledAt: null,
      recallCount: 0,
      relatedMemoryIds: [],
      sourceConversationId: null,
    }).catch(err => console.warn("[MemoryManager] nexaMemoryStorage sync warning:", err));
  }

  public removeDurableFact(id: string) {
    this.durableFacts = this.durableFacts.filter(f => f.id !== id);
    this.saveState();
  }

  /**
   * Forgets and purges any memory matching a query or phrase.
   * Completely deletes it from durableFacts, nexa_memories, active_directives, and running summary.
   */
  public forgetMatching(query: string): { removedCount: number; removedItems: string[] } {
    const rawQ = (query || "").trim().toLowerCase();
    const removedItems: string[] = [];

    // System foundational IDs that should not be deleted by arbitrary user text
    const protectedIds = new Set(["df-apex", "df-1", "df-1b", "df-1c", "df-6", "df-7", "df-8", "df-9", "df-10", "df-11"]);

    // If query is empty or "all" or generic, target transient health & finished chores
    const isGenericForget = !rawQ || rawQ === "all" || rawQ === "everything" || rawQ === "it" || rawQ === "this" || rawQ === "that";

    // 1. Filter durableFacts
    const initialCount = this.durableFacts.length;
    this.durableFacts = this.durableFacts.filter(f => {
      if (protectedIds.has(f.id)) return true;
      const fLower = f.fact.toLowerCase();
      const matches = isGenericForget 
        ? this.isTransientItem(f.fact)
        : fLower.includes(rawQ);

      if (matches) {
        removedItems.push(f.fact);
        return false;
      }
      return true;
    });

    // 2. Filter nexa_memories in localStorage
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("nexa_memories");
        if (stored) {
          const list: string[] = JSON.parse(stored);
          if (Array.isArray(list)) {
            const filtered = list.filter(m => {
              const mLower = m.toLowerCase();
              const matches = isGenericForget
                ? this.isTransientItem(m)
                : mLower.includes(rawQ);
              if (matches && !removedItems.includes(m)) {
                removedItems.push(m);
                return false;
              }
              return !matches;
            });
            localStorage.setItem("nexa_memories", JSON.stringify(filtered));
          }
        }

        // 3. Filter nexa_active_directives
        ["nexa_active_directives"].forEach(key => {
          [localStorage, sessionStorage].forEach(storage => {
            const data = storage.getItem(key);
            if (data) {
              try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                  const cleaned = parsed.filter((d: any) => {
                    const textLower = (d.text || "").toLowerCase();
                    const matches = isGenericForget
                      ? this.isTransientItem(d.text || "")
                      : textLower.includes(rawQ);
                    return !matches;
                  });
                  storage.setItem(key, JSON.stringify(cleaned));
                }
              } catch (_) {}
            }
          });
        });

        // 4. Clean conversation state if it mentions forgotten topic
        const convStateRaw = localStorage.getItem("nexa_conversation_state");
        if (convStateRaw) {
          try {
            const parsed = JSON.parse(convStateRaw);
            let stateChanged = false;
            if (parsed.currentTopic && (isGenericForget ? this.isTransientItem(parsed.currentTopic) : parsed.currentTopic.toLowerCase().includes(rawQ))) {
              parsed.currentTopic = "General Interaction";
              stateChanged = true;
            }
            if (stateChanged) {
              localStorage.setItem("nexa_conversation_state", JSON.stringify(parsed));
            }
          } catch (_) {}
        }

        // 5. Clean nexa_dialogue_history and nexa_chat_history so old turns never resurface
        ["nexa_dialogue_history", "nexa_chat_history"].forEach(histKey => {
          [localStorage, sessionStorage].forEach(storage => {
            const histRaw = storage.getItem(histKey);
            if (histRaw) {
              try {
                const parsed = JSON.parse(histRaw);
                if (Array.isArray(parsed)) {
                  const cleaned = parsed.filter((item: any) => {
                    const text = (item.text || item.content || "").toLowerCase();
                    const matches = isGenericForget
                      ? this.isTransientItem(text)
                      : text.includes(rawQ);
                    return !matches;
                  });
                  storage.setItem(histKey, JSON.stringify(cleaned));
                }
              } catch (_) {}
            }
          });
        });
      } catch (e) {
        console.error("Failed to clean storage in forgetMatching:", e);
      }
    }

    // 5. Clean running summary
    if (this.runningSummary) {
      const summaryLines = this.runningSummary.split("\n").filter(line => {
        const lLower = line.toLowerCase();
        return isGenericForget ? !this.isTransientItem(line) : !lLower.includes(rawQ);
      });
      this.runningSummary = summaryLines.join("\n");
    }

    // 6. Purge from nexaMemoryStorage database
    nexaMemoryStorage.getAll().then(allMems => {
      const toDelete = allMems.filter(m => {
        const full = `${m.title} ${m.content} ${(m.tags || []).join(" ")}`.toLowerCase();
        return isGenericForget ? this.isTransientItem(full) : full.includes(rawQ);
      });
      if (toDelete.length > 0) {
        nexaMemoryStorage.deleteMultiple(toDelete.map(m => m.id)).catch(() => {});
      }
    }).catch(() => {});

    this.saveState();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nexa-memory-updated", { detail: { query, removed: removedItems } }));
      window.dispatchEvent(new CustomEvent("nexa_memory_updated"));
    }

    return {
      removedCount: removedItems.length,
      removedItems
    };
  }

  public getDurableFactsPrompt(recalledPromptBlock?: string): string {
    const factsList = this.durableFacts.map(f => `• [${f.category.toUpperCase()}] ${f.fact}`).join("\n");
    let base = `==================================================\nDURABLE FACTS & STANDING INSTRUCTIONS (STORED SEPARATELY):\n${factsList}\n==================================================`;
    if (recalledPromptBlock && recalledPromptBlock.trim()) {
      base += `\n\n${recalledPromptBlock.trim()}`;
    }
    return base;
  }

  public getRunningSummary(): string {
    return this.runningSummary;
  }

  public setRunningSummary(summary: string) {
    this.runningSummary = summary.trim();
    this.saveState();
  }

  public clearRunningSummary() {
    this.runningSummary = "";
    this.summarizedTurnCount = 0;
    this.saveState();
  }

  /**
   * Partitions conversation turns into:
   * 1. A comprehensive running summary for older turns (beyond the rolling window)
   * 2. The most recent 50 turns verbatim
   * Preserves long-time conversational memory across extended chatting sessions without premature truncation.
   */
  public processRollingWindow(turns: ConversationTurn[], verbatimWindowSize: number = 50): {
    verbatimTurns: ConversationTurn[];
    summary: string;
  } {
    if (!turns || turns.length <= verbatimWindowSize) {
      return {
        verbatimTurns: turns || [],
        summary: this.runningSummary
      };
    }

    const splitIndex = turns.length - verbatimWindowSize;
    const olderTurns = turns.slice(0, splitIndex);
    const verbatimTurns = turns.slice(splitIndex);

    // Semantic memory preservation for older turns across long sessions
    const olderUserPoints = olderTurns
      .filter(t => t.sender === "user")
      .map(t => t.text.trim())
      .filter(text => text.length > 3);

    const distinctPoints = Array.from(new Set(olderUserPoints)).slice(-30);

    if (distinctPoints.length > 0) {
      const summaryItems = distinctPoints.map(p => `- Previous Topic/Turn: "${p.length > 140 ? p.substring(0, 140) + '...' : p}"`);
      this.runningSummary = `LONG-TIME CONVERSATION MEMORY (ESTABLISHED TOPICS & CONTEXT FROM EARLIER IN CHAT):\n${summaryItems.join("\n")}`;
      this.saveState();
    }

    return {
      verbatimTurns,
      summary: this.runningSummary
    };
  }
}

export const memoryManager = new MemoryManager();
