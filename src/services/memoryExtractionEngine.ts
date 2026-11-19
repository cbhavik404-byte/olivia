// src/services/memoryExtractionEngine.ts
// AI Memory Extraction Engine for NEXA
// Uses heuristic pre-filtering, duplicate detection, and structured Gemini extraction to extract high-value memories.

import { nexaMemoryStorage } from "./nexaMemoryStorage";
import { getGeminiClient } from "./aiClient";
import { NexaMemory, MemoryExtractionResult, MemoryCategory, MemoryStatus } from "../types";
import { GEMINI_MODELS } from "../config/modelRegistry";

const LOW_VALUE_PATTERNS = [
  /^(hi|hello|hey|sup|yo|good morning|good afternoon|good evening|good night)[\s!.]*$/i,
  /^(ok|okay|k|cool|nice|great|awesome|sure|fine|thanks|thank you|thx|bye|goodbye|see ya)[\s!.]*$/i,
  /^(what time is it|what is the weather|tell me a joke|flip a coin|roll a dice)[\s!.]*$/i,
  /headache|head is paining|brain is paining|head pain|not feeling well|feeling sick/i,
];

const EXPLICIT_SAVE_PATTERNS = [
  /(?:remember\s+(?:this|that)|save\s+(?:this|that)\s+in\s+(?:your\s+)?memory|don'?t\s+forget\s+(?:this|that)|keep\s+(?:this|that)\s+for\s+future|add\s+(?:this|that)\s+to\s+(?:my\s+)?memory)/i,
  /^remember[:\s]/i,
  /^save to memory[:\s]/i,
];

export class MemoryExtractionEngine {
  private isProcessing = false;

  /**
   * Fast rule-based pre-filter to determine if a message is worth analyzing.
   * Avoids unnecessary API costs and latency for casual greetings or one-off questions.
   */
  public isWorthAnalyzing(text: string): boolean {
    if (!text || text.trim().length < 6) return false;
    const clean = text.trim();

    // Explicit save request is ALWAYS worth analyzing
    if (EXPLICIT_SAVE_PATTERNS.some((p) => p.test(clean))) {
      return true;
    }

    // Skip casual greetings, temporary pleasantries, or illness
    if (LOW_VALUE_PATTERNS.some((p) => p.test(clean))) {
      return false;
    }

    // Keywords signaling high-value memory potential
    const highValueSignals = [
      "i want to",
      "i plan to",
      "i am building",
      "i'm building",
      "my project",
      "my goal",
      "my name",
      "i prefer",
      "i like",
      "i don't like",
      "i dislike",
      "always use",
      "never use",
      "i completed",
      "i finished",
      "we launched",
      "i work as",
      "my channel",
      "my company",
      "my stack",
      "remember",
      "important",
    ];

    const lower = clean.toLowerCase();
    return highValueSignals.some((sig) => lower.includes(sig)) || clean.length > 50;
  }

  /**
   * Extracts meaningful memories from conversation turn and persists them if appropriate.
   */
  public async analyzeTurn(
    userMessage: string,
    assistantReply?: string,
    conversationId?: string
  ): Promise<NexaMemory | null> {
    if (this.isProcessing) return null;

    const settings = await nexaMemoryStorage.getSettings();
    const isExplicit = EXPLICIT_SAVE_PATTERNS.some((p) => p.test(userMessage));

    // If automatic memory is disabled and it's NOT an explicit save request, skip
    if (!settings.autoMemoryEnabled && !isExplicit) {
      return null;
    }

    if (!isExplicit && !this.isWorthAnalyzing(userMessage)) {
      return null;
    }

    this.isProcessing = true;

    try {
      const client = getGeminiClient();
      if (!client) {
        // Fallback for explicit save if API client is not configured
        if (isExplicit) {
          return await this.saveDirectExplicitMemory(userMessage);
        }
        return null;
      }

      // Fetch existing memories for duplicate check & update matching
      const existingMemories = await nexaMemoryStorage.getAll();
      const existingSummary = existingMemories
        .slice(0, 40)
        .map((m) => `[ID: ${m.id}] [${m.category}] ${m.title}: ${m.content.slice(0, 100)} (Status: ${m.status})`)
        .join("\n");

      const systemPrompt = `You are NEXA's Senior AI Memory Architect.
Your task is to analyze the conversation turn and decide if there is high-value, durable information worth storing into Bhavik's long-term memory.

ALLOWED CATEGORIES:
1. Identity: Stable user identity (name, role, skills, confirmed life goals).
2. Preferences: Communication style, workflow preferences, coding preferences, likes/dislikes.
3. Life: Education, career context, major personal plans outside immediate chat.
4. Active: Current projects being built, tasks in progress, unresolved problems, pending decisions (Status: Active | Planned | Completed | Archived).
5. Relationships: Key collaborators, partners (avoid gossip/private third-party info).
6. Milestones: Significant achievements, launches, completed projects with dates.
7. Behaviors: Confirmed recurring working habits and learning patterns.

RULES:
- HIGH-VALUE MEMORIES: User's active projects, goals, explicitly requested memories ("remember this"), recurring preferences, project completions.
- LOW-VALUE (SKIP): Greetings, temporary chat chatter, one-off facts, guesses about personality, temporary symptoms/headaches.
- DUPLICATE DETECTION: Check EXISTING MEMORIES below. If the fact is already stored, return "action": "SKIP".
- UPDATING: If user updates an existing project (e.g. "I completed my AI agent" or adds requirements), return "action": "UPDATE" with existingMemoryId.
- NEVER invent deadlines, technologies, or features that the user did not state.
- RETURN STRICT JSON format.

EXISTING MEMORIES:
${existingSummary || "(No prior memories stored)"}`;

      const userPrompt = `USER MESSAGE: "${userMessage}"
ASSISTANT REPLY: "${assistantReply || ""}"

Extract memory decision:
{
  "action": "SAVE | UPDATE | SKIP | ASK",
  "title": "string (concise descriptive title)",
  "content": "string (factual, objective summary)",
  "category": "Identity | Preferences | Life | Active | Relationships | Milestones | Behaviors",
  "tags": ["tag1", "tag2"],
  "status": "Active | Planned | Completed | Archived",
  "existingMemoryId": "id string or null",
  "reason": "brief explanation",
  "confidence": 0.0 to 1.0
}`;

      const response = await client.models.generateContent({
        model: GEMINI_MODELS.TEXT_FALLBACK,
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const responseText = response.text?.trim() || "";
      if (!responseText) return null;

      let result: MemoryExtractionResult;
      try {
        result = JSON.parse(responseText);
      } catch (err) {
        console.warn("[MemoryExtractionEngine] JSON parse error:", err);
        return null;
      }

      if (result.action === "SKIP" || result.action === "ASK") {
        return null;
      }

      // Handle UPDATE action
      if (result.action === "UPDATE" && result.existingMemoryId) {
        const existing = await nexaMemoryStorage.getById(result.existingMemoryId);
        if (existing) {
          const updated = await nexaMemoryStorage.update(existing.id, {
            content: result.content || existing.content,
            title: result.title || existing.title,
            status: result.status || existing.status,
            tags: Array.from(new Set([...(existing.tags || []), ...(result.tags || [])])),
            verificationStatus: isExplicit ? "UserVerified" : existing.verificationStatus,
          });

          if (settings.notifyOnAutoSave && typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("nexa-memory-toast", {
                detail: {
                  type: "update",
                  title: updated.title,
                  category: updated.category,
                },
              })
            );
          }
          return updated;
        }
      }

      // Handle SAVE action
      if (result.action === "SAVE" && result.title && result.content && result.category) {
        // Double check duplicate title/content locally
        const isDuplicate = existingMemories.some(
          (m) =>
            m.title.toLowerCase() === result.title!.toLowerCase() ||
            m.content.toLowerCase().includes(result.content!.toLowerCase())
        );
        if (isDuplicate) return null;

        const newMemory: NexaMemory = {
          id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          userId: "bhavik-core",
          title: result.title.trim(),
          content: result.content.trim(),
          category: result.category as MemoryCategory,
          tags: result.tags || [],
          source: isExplicit ? "Manual" : "Automatic",
          status: (result.status as MemoryStatus) || "Active",
          verificationStatus: isExplicit ? "UserVerified" : "AIExtracted",
          confidence: typeof result.confidence === "number" ? result.confidence : (isExplicit ? 1.0 : 0.88),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastRecalledAt: null,
          recallCount: 0,
          relatedMemoryIds: [],
          sourceConversationId: conversationId || null,
        };

        const saved = await nexaMemoryStorage.save(newMemory);

        if (settings.notifyOnAutoSave && typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("nexa-memory-toast", {
              detail: {
                type: "save",
                title: saved.title,
                category: saved.category,
              },
            })
          );
        }

        return saved;
      }
    } catch (err) {
      console.error("[MemoryExtractionEngine] Error analyzing turn:", err);
    } finally {
      this.isProcessing = false;
    }

    return null;
  }

  /**
   * Direct fallback for explicit user commands ("remember that...") when model is offline
   */
  private async saveDirectExplicitMemory(rawText: string): Promise<NexaMemory> {
    const cleaned = rawText
      .replace(EXPLICIT_SAVE_PATTERNS[0], "")
      .replace(/^remember[:\s]*/i, "")
      .replace(/^save to memory[:\s]*/i, "")
      .trim();

    const title = cleaned.length > 40 ? cleaned.slice(0, 40) + "..." : cleaned;

    const memory: NexaMemory = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: "bhavik-core",
      title: title || "User Standing Memory",
      content: cleaned,
      category: "Preferences",
      tags: ["explicit-save"],
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
    };

    return nexaMemoryStorage.save(memory);
  }
}

export const memoryExtractionEngine = new MemoryExtractionEngine();
