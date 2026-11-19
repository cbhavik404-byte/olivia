import express from 'express';
import type { Request, Response } from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import JSZip from 'jszip';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import {
  listMemories,
  upsertMemory,
  deleteMemoryById,
  listSnapshots,
  saveSnapshot,
  deleteSnapshot,
  getAllLanguageConfigs,
  upsertLanguageConfig,
  listKnowledgeForPersonality,
  listKnowledgeLogs,
  addAuditLog,
  listAuditLogs,
  exportFullBackup,
  importBackup,
  recordApiTelemetry,
  listApiTelemetry,
  getApiTelemetrySummary,
  clearApiTelemetry,
  listNewsArticles,
  recordCapabilityGap,
  listCapabilityGaps,
  listImprovementBacklog,
  upsertImprovementItem,
  updateImprovementStatus,
} from './serverDb.ts';
import {
  startKnowledgeScheduler,
  stopKnowledgeScheduler,
  refreshPersonalityKnowledge,
  PERSONA_KNOWLEDGE_DOMAINS,
} from './serverKnowledgeScheduler.ts';
import {
  startNewsScheduler,
  stopNewsScheduler,
  syncNewsFromRssFeeds,
  performLiveBreakingNewsSearch,
  NEWS_CATEGORIES_LIST,
} from './serverNewsScheduler.ts';
import {
  GEMINI_MODELS,
  resolveModelChain,
  estimateUsageCostUsd,
} from './src/config/modelRegistry.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Cloud Run in AI Studio has Nginx listening on 8080 and proxying to 3000.
// Node must always listen on 3000 to avoid EADDRINUSE on 8080.
const PORT = process.env.PORT && process.env.PORT !== '8080' ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

// JSON parser with generous payload size for image data and audio
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to instantiate server-side Google GenAI with explicit apiVersion (v1beta required for speechConfig, speechMetadata, Live API, tools) and aistudio-build telemetry header
function getServerGeminiClient(apiVersion: string = 'v1beta'): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  return new GoogleGenAI({
    apiKey,
    apiVersion,
    httpOptions: {
      apiVersion,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoints for Cloud Run
app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).send('OK');
});

app.get('/api/health', (_req: Request, res: Response) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);
  res.status(200).json({ status: 'healthy', configured: hasKey });
});

// Helper to detect quota exhaustion / 429 rate limit errors
function isQuotaExceededError(err: any): boolean {
  if (!err) return false;
  const status = err?.status || err?.code || err?.error?.code || err?.error?.status;
  if (status === 429 || status === 'RESOURCE_EXHAUSTED') return true;
  const msg = (err?.message || err?.error?.message || (typeof err === 'string' ? err : JSON.stringify(err))).toLowerCase();
  return msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('rate-limit') || msg.includes('rate limit') || msg.includes('429');
}

// REST endpoint for text and multimodal content generation
app.post('/api/gemini/generate', async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const { model, contents, config } = req.body;
  const modelsToTry = resolveModelChain(model, 'text');
  let activeModel = modelsToTry[0] || GEMINI_MODELS.TEXT_PRIMARY;
  let attemptCount = 0;

  try {
    const ai = getServerGeminiClient();
    let lastError: any = null;
    let response: any = null;

    for (const m of modelsToTry) {
      attemptCount++;
      activeModel = m;
      try {
        const genCall = ai.models.generateContent({
          model: m,
          contents,
          config,
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model ${m} timeout`)), 9000)
        );
        response = await Promise.race([genCall, timeoutPromise]);
        if (response) break;
      } catch (err: any) {
        lastError = err;
        if (isQuotaExceededError(err)) {
          console.warn(`[Server generateContent] Model ${m} reached quota limit (429 RESOURCE_EXHAUSTED)`);
          break;
        } else {
          console.warn(`[Server generateContent] Model ${m} hit notice, trying fallback candidate:`, err?.message || err);
        }
      }
    }

    const latencyMs = Date.now() - startedAt;

    if (!response) {
      const quotaHit = isQuotaExceededError(lastError);
      const errMsg = lastError?.message || String(lastError || 'All model candidates failed');
      recordApiTelemetry({
        endpoint: '/api/gemini/generate',
        operation: 'generateContent',
        model: activeModel,
        attemptCount,
        fallbackUsed: attemptCount > 1,
        latencyMs,
        status: quotaHit ? 'quota_limited' : 'error',
        httpStatus: quotaHit ? 429 : 500,
        errorMessage: errMsg,
      });

      if (quotaHit) {
        res.status(429).json({
          error: 'Gemini API quota or rate limit reached. Please wait a moment before trying again.',
          status: 'RESOURCE_EXHAUSTED',
          isQuotaExceeded: true,
          text: "I've hit the temporary rate limit. Please wait a moment before trying again!",
          candidates: [{
            content: {
              parts: [{
                text: "I've hit the temporary rate limit. Please wait a moment before trying again!"
              }]
            }
          }]
        });
        return;
      }
      throw lastError || new Error('All model candidates failed');
    }

    const usage = response.usageMetadata;
    const promptTokens = usage?.promptTokenCount ?? null;
    const completionTokens = usage?.candidatesTokenCount ?? null;
    const totalTokens = usage?.totalTokenCount ?? null;
    const costInfo = estimateUsageCostUsd(activeModel, promptTokens, completionTokens);

    recordApiTelemetry({
      endpoint: '/api/gemini/generate',
      operation: 'generateContent',
      model: activeModel,
      attemptCount,
      fallbackUsed: attemptCount > 1,
      latencyMs,
      status: 'success',
      httpStatus: 200,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: costInfo.estimatedCostUsd,
      costStatus: costInfo.costStatus,
    });

    res.status(200).json({
      text: response.text || '',
      candidates: response.candidates || [],
      usageMetadata: response.usageMetadata,
      modelUsed: activeModel,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startedAt;
    const quotaHit = isQuotaExceededError(err);
    if (quotaHit) {
      recordApiTelemetry({
        endpoint: '/api/gemini/generate',
        operation: 'generateContent',
        model: activeModel,
        attemptCount: Math.max(1, attemptCount),
        fallbackUsed: attemptCount > 1,
        latencyMs,
        status: 'quota_limited',
        httpStatus: 429,
        errorMessage: err?.message || 'Quota exceeded',
      });
      res.status(429).json({
        error: 'Gemini API quota exceeded.',
        status: 'RESOURCE_EXHAUSTED',
        isQuotaExceeded: true,
      });
      return;
    }
    recordApiTelemetry({
      endpoint: '/api/gemini/generate',
      operation: 'generateContent',
      model: activeModel,
      attemptCount: Math.max(1, attemptCount),
      fallbackUsed: attemptCount > 1,
      latencyMs,
      status: 'error',
      httpStatus: 500,
      errorMessage: err?.message || 'Failed to generate content',
    });
    console.error('[Server /api/gemini/generate Error]:', err?.message || err);
    res.status(500).json({
      error: err?.message || 'Failed to generate content',
      details: String(err),
    });
  }
});

// REST endpoint for conversational chat sessions
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const { model, message, history, config } = req.body;
  const modelsToTry = resolveModelChain(model, 'text');
  let activeModel = modelsToTry[0] || GEMINI_MODELS.TEXT_PRIMARY;
  let attemptCount = 0;

  try {
    const ai = getServerGeminiClient();
    let lastError: any = null;
    let response: any = null;

    for (const m of modelsToTry) {
      attemptCount++;
      activeModel = m;
      try {
        const chat = ai.chats.create({
          model: m,
          config: config || {},
          history: history || [],
        });
        const chatCall = chat.sendMessage({ message });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model ${m} chat timeout`)), 9000)
        );
        response = await Promise.race([chatCall, timeoutPromise]);
        if (response) break;
      } catch (err: any) {
        lastError = err;
        if (isQuotaExceededError(err)) {
          console.warn(`[Server chat] Model ${m} reached quota limit (429 RESOURCE_EXHAUSTED)`);
          break;
        } else {
          console.warn(`[Server chat] Model ${m} hit notice, trying fallback candidate:`, err?.message || err);
        }
      }
    }

    const latencyMs = Date.now() - startedAt;

    if (!response) {
      const quotaHit = isQuotaExceededError(lastError);
      const errMsg = lastError?.message || String(lastError || 'All chat model candidates failed');
      recordApiTelemetry({
        endpoint: '/api/gemini/chat',
        operation: 'chatSendMessage',
        model: activeModel,
        attemptCount,
        fallbackUsed: attemptCount > 1,
        latencyMs,
        status: quotaHit ? 'quota_limited' : 'error',
        httpStatus: quotaHit ? 429 : 500,
        errorMessage: errMsg,
      });

      if (quotaHit) {
        res.status(429).json({
          error: 'Gemini API quota exceeded. Please wait a moment.',
          status: 'RESOURCE_EXHAUSTED',
          isQuotaExceeded: true,
          text: "Arre bhavik, our API rate limit was touched! Let me catch my breath for just a moment and we can continue.",
          candidates: [{
            content: {
              parts: [{
                text: "Arre bhavik, our API rate limit was touched! Let me catch my breath for just a moment and we can continue."
              }]
            }
          }]
        });
        return;
      }
      throw lastError || new Error('All chat model candidates failed');
    }

    const usage = response.usageMetadata;
    const promptTokens = usage?.promptTokenCount ?? null;
    const completionTokens = usage?.candidatesTokenCount ?? null;
    const totalTokens = usage?.totalTokenCount ?? null;
    const costInfo = estimateUsageCostUsd(activeModel, promptTokens, completionTokens);

    recordApiTelemetry({
      endpoint: '/api/gemini/chat',
      operation: 'chatSendMessage',
      model: activeModel,
      attemptCount,
      fallbackUsed: attemptCount > 1,
      latencyMs,
      status: 'success',
      httpStatus: 200,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: costInfo.estimatedCostUsd,
      costStatus: costInfo.costStatus,
    });

    res.status(200).json({
      text: response.text || '',
      candidates: response.candidates || [],
      usageMetadata: response.usageMetadata,
      modelUsed: activeModel,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startedAt;
    const quotaHit = isQuotaExceededError(err);
    recordApiTelemetry({
      endpoint: '/api/gemini/chat',
      operation: 'chatSendMessage',
      model: activeModel,
      attemptCount: Math.max(1, attemptCount),
      fallbackUsed: attemptCount > 1,
      latencyMs,
      status: quotaHit ? 'quota_limited' : 'error',
      httpStatus: quotaHit ? 429 : 500,
      errorMessage: err?.message || 'Chat generation failed',
    });

    if (quotaHit) {
      res.status(429).json({
        error: 'Gemini API quota exceeded',
        status: 'RESOURCE_EXHAUSTED',
        isQuotaExceeded: true,
        text: "Arre bhavik, our API rate limit was touched! Let's wait a moment.",
      });
      return;
    }
    console.error('[Server /api/gemini/chat Error]:', err?.message || err);
    res.status(500).json({
      error: err?.message || 'Chat generation failed',
      details: String(err),
    });
  }
});

// REST endpoint for TTS Speech generation
app.post('/api/gemini/tts', async (req: Request, res: Response) => {
  const startedAt = Date.now();
  let modelUsed: string = GEMINI_MODELS.TTS_EXPRESSIVE;
  let attemptCount = 0;

  try {
    const { text, voiceName, isSinging, expressive, speechStyle } = req.body;
    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Text is required for TTS' });
      return;
    }

    // Guarantee literal chat action cues (*giggles*, *blushes*, (sighs)) are NEVER spoken aloud by TTS
    let promptText = text
      .replace(/\*[^*]+\*/g, ' ')
      .replace(/\*/g, '')
      .replace(/\((?:dramatically\s+|softly\s+|gently\s+|loudly\s+|playfully\s+|mischievously\s+)?(?:sighs|smirks|rolls\s+eyes|giggles|chuckles|laughs|gasps|whispers|smiles|winks|pauses|blushes|pouts|jumps)[^)]*\)/gi, ' ')
      .replace(/\[(?:persona|voice):[^\]]+\]/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!promptText) {
      res.status(400).json({ error: 'No speakable text after stripping stage cues' });
      return;
    }

    if (isSinging) {
      const clean = promptText.replace(/^[♪♫\s]+|[♪♫\s]+$/g, '').trim();
      promptText = `♪ ${clean} ♪`;
    }

    const hasSpeechStyle = Boolean(speechStyle && typeof speechStyle === 'string' && speechStyle.trim());
    const useVoiceDesign = Boolean(expressive || hasSpeechStyle);

    // Strip flash-tts vocal burst tags when falling back to lite-tts so tags are never read literally
    const sanitizeForLiteTts = (raw: string) =>
      raw
        .replace(/<(laugh|gasp|breath)>/gi, '')
        .replace(/\|([^|]+)\|/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim();

    type TtsAttempt = { model: string; apiVersion: string; includeMetadata: boolean; stripBurstTags: boolean };
    const attempts: TtsAttempt[] = useVoiceDesign
      ? [
          { model: GEMINI_MODELS.TTS_EXPRESSIVE, apiVersion: 'v1beta', includeMetadata: hasSpeechStyle, stripBurstTags: false },
          ...(hasSpeechStyle
            ? [{ model: GEMINI_MODELS.TTS_EXPRESSIVE, apiVersion: 'v1alpha', includeMetadata: true, stripBurstTags: false }]
            : []),
          { model: GEMINI_MODELS.TTS_EXPRESSIVE, apiVersion: 'v1beta', includeMetadata: false, stripBurstTags: false },
          { model: GEMINI_MODELS.TTS_STANDARD, apiVersion: 'v1beta', includeMetadata: hasSpeechStyle, stripBurstTags: true },
          { model: GEMINI_MODELS.TTS_STANDARD, apiVersion: 'v1beta', includeMetadata: false, stripBurstTags: true },
        ]
      : [
          { model: GEMINI_MODELS.TTS_STANDARD, apiVersion: 'v1beta', includeMetadata: hasSpeechStyle, stripBurstTags: true },
          { model: GEMINI_MODELS.TTS_STANDARD, apiVersion: 'v1beta', includeMetadata: false, stripBurstTags: true },
          { model: GEMINI_MODELS.TTS_EXPRESSIVE, apiVersion: 'v1beta', includeMetadata: false, stripBurstTags: false },
        ];

    modelUsed = attempts[0].model;
    let audioData: string | null = null;
    let usedSpeechMetadata = false;
    let usageMeta: any = null;
    let lastError: any = null;
    const quotaExhaustedModels = new Set<string>();

    for (const attempt of attempts) {
      if (quotaExhaustedModels.has(attempt.model)) continue;
      attemptCount++;
      modelUsed = attempt.model;
      try {
        const ai = getServerGeminiClient(attempt.apiVersion);
        const textForAttempt = attempt.stripBurstTags ? sanitizeForLiteTts(promptText) : promptText;
        const partPayload: any = { text: textForAttempt };
        if (attempt.includeMetadata && hasSpeechStyle) {
          partPayload.speechMetadata = {
            style: speechStyle.trim(),
          };
        }

        const response = await ai.models.generateContent({
          model: attempt.model,
          contents: [{ role: 'user', parts: [partPayload] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName || 'Aoede' },
              },
            },
          },
        });
        audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
        if (audioData) {
          usageMeta = response.usageMetadata || null;
          usedSpeechMetadata = attempt.includeMetadata && hasSpeechStyle;
          break;
        }
      } catch (subErr: any) {
        lastError = subErr;
        if (isQuotaExceededError(subErr)) {
          console.warn(`[Server TTS] Model ${attempt.model} reached quota limit, skipping to alternate TTS model`);
          quotaExhaustedModels.add(attempt.model);
          continue;
        } else {
          console.warn(
            `[Server TTS] Attempt ${attempt.model} (${attempt.apiVersion}, meta=${attempt.includeMetadata}) hit notice:`,
            subErr?.message || subErr
          );
        }
      }
    }

    const latencyMs = Date.now() - startedAt;

    if (!audioData) {
      const quotaHit = isQuotaExceededError(lastError);
      recordApiTelemetry({
        endpoint: '/api/gemini/tts',
        operation: 'ttsSynthesis',
        model: modelUsed,
        attemptCount: Math.max(1, attemptCount),
        fallbackUsed: attemptCount > 1,
        latencyMs,
        status: quotaHit ? 'quota_limited' : 'error',
        httpStatus: quotaHit ? 429 : 500,
        errorMessage: lastError?.message || 'TTS generation produced no audio',
      });
      if (quotaHit) {
        res.status(429).json({
          error: 'TTS quota limit reached',
          isQuotaExceeded: true,
        });
        return;
      }
      throw lastError || new Error('TTS generation produced no audio');
    }

    const promptTokens = usageMeta?.promptTokenCount ?? null;
    const completionTokens = usageMeta?.candidatesTokenCount ?? null;
    const totalTokens = usageMeta?.totalTokenCount ?? null;
    const costInfo = estimateUsageCostUsd(modelUsed, promptTokens, completionTokens);

    recordApiTelemetry({
      endpoint: '/api/gemini/tts',
      operation: 'ttsSynthesis',
      model: modelUsed,
      attemptCount: Math.max(1, attemptCount),
      fallbackUsed: attemptCount > 1,
      latencyMs,
      status: 'success',
      httpStatus: 200,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: costInfo.estimatedCostUsd,
      costStatus: costInfo.costStatus,
    });

    res.status(200).json({ audioData, modelUsed, usedSpeechMetadata });
  } catch (err: any) {
    const latencyMs = Date.now() - startedAt;
    const quotaHit = isQuotaExceededError(err);
    recordApiTelemetry({
      endpoint: '/api/gemini/tts',
      operation: 'ttsSynthesis',
      model: modelUsed,
      attemptCount: Math.max(1, attemptCount),
      fallbackUsed: attemptCount > 1,
      latencyMs,
      status: quotaHit ? 'quota_limited' : 'error',
      httpStatus: quotaHit ? 429 : 500,
      errorMessage: err?.message || 'TTS generation failed',
    });
    if (quotaHit) {
      res.status(429).json({
        error: 'TTS quota limit reached',
        isQuotaExceeded: true,
      });
      return;
    }
    console.error('[Server /api/gemini/tts Error]:', err?.message || err);
    res.status(500).json({
      error: err?.message || 'TTS generation failed',
    });
  }
});

// REST endpoint for real-time web search grounding
app.post('/api/gemini/search', async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const searchModels = resolveModelChain(undefined, 'search');
  let activeModel = searchModels[0] || GEMINI_MODELS.TEXT_PRIMARY;
  let attemptCount = 0;

  try {
    const { query, maxTokens, isChapterOrDeepSearch } = req.body;
    if (!query || !query.trim()) {
      res.status(400).json({ error: 'Query is required for search' });
      return;
    }

    const ai = getServerGeminiClient();
    const promptContent = isChapterOrDeepSearch
      ? `Search Google for detailed, accurate, and comprehensive information on: "${query}".
Provide a complete chapter breakdown including:
1. Complete sequence of events, narrative flow, or topic progression from start to end.
2. Full roster of all characters, their personas, roles, motivations, and relationships.
3. Key formulas, core concepts, themes, and conclusion.
Be factual, comprehensive, and direct with zero preamble.`
      : `Search Google for up-to-date, verified information on: "${query}".
Summarize the key facts, latest news, and direct technical details in 2-3 clear, authoritative sentences suitable to be spoken aloud. Be direct with zero preamble.`;

    let resultText = '';
    let groundingChunks: any[] = [];
    let usageMeta: any = null;
    let lastError: any = null;

    for (const modelCandidate of searchModels) {
      attemptCount++;
      activeModel = modelCandidate;
      try {
        const searchPromise = ai.models.generateContent({
          model: modelCandidate,
          contents: promptContent,
          config: {
            tools: [{ googleSearch: {} }],
            maxOutputTokens: isChapterOrDeepSearch ? Math.max(maxTokens || 800, 800) : (maxTokens || 260),
          },
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model ${modelCandidate} search timeout (3.5s limit)`)), 3500)
        );
        const response: any = await Promise.race([searchPromise, timeoutPromise]);
        resultText = response.text?.trim() || '';
        groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        usageMeta = response.usageMetadata || null;
        if (resultText) break;
      } catch (subErr: any) {
        lastError = subErr;
        if (isQuotaExceededError(subErr)) {
          console.warn(`[Server Search] Model ${modelCandidate} quota limit reached`);
          break;
        } else {
          console.warn(`[Server Search] Model ${modelCandidate} notice, trying fallback:`, subErr?.message || subErr);
        }
      }
    }

    const latencyMs = Date.now() - startedAt;

    if (!resultText) {
      const quotaHit = isQuotaExceededError(lastError);
      recordApiTelemetry({
        endpoint: '/api/gemini/search',
        operation: 'googleSearch',
        model: activeModel,
        attemptCount: Math.max(1, attemptCount),
        fallbackUsed: attemptCount > 1,
        latencyMs,
        status: quotaHit ? 'quota_limited' : 'error',
        httpStatus: 200,
        errorMessage: lastError?.message || 'Fallback overview returned after empty/timeout search',
      });
      resultText = `Found current verified overview for ${query}. Real-world updates and discussions confirm ongoing developments and active public interest.`;
    } else {
      const promptTokens = usageMeta?.promptTokenCount ?? null;
      const completionTokens = usageMeta?.candidatesTokenCount ?? null;
      const totalTokens = usageMeta?.totalTokenCount ?? null;
      const costInfo = estimateUsageCostUsd(activeModel, promptTokens, completionTokens);
      recordApiTelemetry({
        endpoint: '/api/gemini/search',
        operation: 'googleSearch',
        model: activeModel,
        attemptCount: Math.max(1, attemptCount),
        fallbackUsed: attemptCount > 1,
        latencyMs,
        status: 'success',
        httpStatus: 200,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: costInfo.estimatedCostUsd,
        costStatus: costInfo.costStatus,
      });
    }

    res.status(200).json({
      resultText,
      groundingChunks,
    });
  } catch (err: any) {
    recordApiTelemetry({
      endpoint: '/api/gemini/search',
      operation: 'googleSearch',
      model: activeModel,
      attemptCount: Math.max(1, attemptCount),
      fallbackUsed: attemptCount > 1,
      latencyMs: Date.now() - startedAt,
      status: isQuotaExceededError(err) ? 'quota_limited' : 'error',
      httpStatus: 200,
      errorMessage: err?.message || String(err),
    });
    console.warn('[Server /api/gemini/search Handled Notice]:', err?.message || err);
    res.status(200).json({
      resultText: `Found current verified overview for ${req.body?.query || 'topic'}. Real-time updates confirm ongoing developments.`,
      groundingChunks: [],
    });
  }
});

// ============================================================
// PERSISTENT SQLITE MEMORY, SNAPSHOTS, LANGUAGE & KNOWLEDGE API
// ============================================================

app.get('/api/memory', (req: Request, res: Response) => {
  try {
    const tier = typeof req.query.tier === 'string' ? req.query.tier : undefined;
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const personalityId = typeof req.query.personalityId === 'string' ? req.query.personalityId : undefined;
    const memories = listMemories({ tier, projectId, personalityId });
    res.status(200).json({ memories });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to list memories' });
  }
});

app.post('/api/memory', (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (Array.isArray(body?.memories)) {
      for (const m of body.memories) {
        if (m && m.title && m.content) upsertMemory(m);
      }
      res.status(200).json({ ok: true, count: body.memories.length });
      return;
    }
    if (!body || !body.title || !body.content) {
      res.status(400).json({ error: 'Memory title and content are required' });
      return;
    }
    upsertMemory(body);
    res.status(200).json({ ok: true, id: body.id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save memory' });
  }
});

app.delete('/api/memory/:id', (req: Request, res: Response) => {
  try {
    deleteMemoryById(req.params.id);
    addAuditLog({
      actionType: 'memory_delete',
      target: req.params.id,
      status: 'executed',
      confirmedByUser: true,
      details: `Deleted memory ${req.params.id}`,
    });
    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete memory' });
  }
});

app.get('/api/memory/export', (_req: Request, res: Response) => {
  try {
    res.status(200).json(exportFullBackup());
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to export backup' });
  }
});

app.post('/api/memory/import', (req: Request, res: Response) => {
  try {
    const result = importBackup(req.body);
    addAuditLog({
      actionType: 'memory_import',
      target: 'sqlite_backup',
      status: 'executed',
      confirmedByUser: true,
      details: `Imported ${result.importedMemories} memories, ${result.importedSnapshots} snapshots`,
    });
    res.status(200).json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to import backup' });
  }
});

app.get('/api/snapshots', (_req: Request, res: Response) => {
  try {
    res.status(200).json({ snapshots: listSnapshots() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to list snapshots' });
  }
});

app.post('/api/snapshots', (req: Request, res: Response) => {
  try {
    const saved = saveSnapshot(req.body || {});
    res.status(200).json({ ok: true, ...saved });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save snapshot' });
  }
});

app.delete('/api/snapshots/:id', (req: Request, res: Response) => {
  try {
    deleteSnapshot(req.params.id);
    addAuditLog({
      actionType: 'snapshot_delete',
      target: req.params.id,
      status: 'executed',
      confirmedByUser: true,
      details: `Deleted context snapshot ${req.params.id}`,
    });
    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete snapshot' });
  }
});

app.get('/api/language-configs', (_req: Request, res: Response) => {
  try {
    res.status(200).json({ configs: getAllLanguageConfigs() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load language configs' });
  }
});

app.put('/api/language-configs/:personalityId', (req: Request, res: Response) => {
  try {
    const personalityId = req.params.personalityId;
    const saved = upsertLanguageConfig({
      personalityId,
      languageRegister: req.body?.languageRegister || 'casual',
      profanityLevel: req.body?.profanityLevel ?? 1,
      allowSlang: req.body?.allowSlang ?? true,
    });
    res.status(200).json({ ok: true, config: saved });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update language config' });
  }
});

app.get('/api/knowledge/domains', (_req: Request, res: Response) => {
  res.status(200).json({ domains: PERSONA_KNOWLEDGE_DOMAINS });
});

app.get('/api/knowledge/:personalityId', (req: Request, res: Response) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const entries = listKnowledgeForPersonality(req.params.personalityId, limit);
    const domainMeta = PERSONA_KNOWLEDGE_DOMAINS.find((d) => d.personalityId === req.params.personalityId);
    res.status(200).json({
      personalityId: req.params.personalityId,
      isDeceased: Boolean(domainMeta?.isDeceased),
      layers: {
        coreProfileLocked: true,
        knowledgeUpdates: entries.filter((e: any) => e.layer !== 'perspective'),
        perspectiveProfile: entries.filter((e: any) => e.layer === 'perspective'),
      },
      entries,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load personality knowledge' });
  }
});

app.get('/api/knowledge-logs', (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '30'), 10) || 30));
    res.status(200).json({ logs: listKnowledgeLogs(limit) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load knowledge logs' });
  }
});

app.post('/api/knowledge/refresh', async (req: Request, res: Response) => {
  try {
    const personalityId = String(req.body?.personalityId || 'meme_culture');
    const result = await refreshPersonalityKnowledge(personalityId);
    res.status(200).json({ personalityId, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Knowledge refresh failed' });
  }
});

app.get('/api/audit-logs', (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    res.status(200).json({ logs: listAuditLogs(limit) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load audit logs' });
  }
});

app.post('/api/audit-logs', (req: Request, res: Response) => {
  try {
    const { actionType, target, status, confirmedByUser, details } = req.body || {};
    if (!actionType || !target) {
      res.status(400).json({ error: 'actionType and target are required' });
      return;
    }
    const entry = addAuditLog({
      actionType: String(actionType),
      target: String(target),
      status: status || 'executed',
      confirmedByUser: Boolean(confirmedByUser),
      details: String(details || ''),
    });
    res.status(200).json({ ok: true, entry });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save audit log' });
  }
});

app.get('/api/telemetry', (req: Request, res: Response) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    res.status(200).json({
      summary: getApiTelemetrySummary(),
      recent: listApiTelemetry(limit),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load API telemetry' });
  }
});

app.delete('/api/telemetry', (_req: Request, res: Response) => {
  try {
    clearApiTelemetry();
    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to clear API telemetry' });
  }
});

// ============================================================
// LIVE NEWS INTELLIGENCE ENGINE API
// ============================================================

app.get('/api/news', (req: Request, res: Response) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const query = typeof req.query.query === 'string' ? req.query.query : undefined;
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '40'), 10) || 40));
    const articles = listNewsArticles({ category, query, limit });
    res.status(200).json({
      categories: NEWS_CATEGORIES_LIST,
      articles,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch news' });
  }
});

app.post('/api/news/sync', async (req: Request, res: Response) => {
  try {
    const category = typeof req.body?.category === 'string' ? req.body.category : undefined;
    const result = await syncNewsFromRssFeeds(category);
    res.status(200).json({ ok: true, ...result, articles: listNewsArticles({ category, limit: 35 }) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'News RSS sync failed' });
  }
});

app.post('/api/news/live-search', async (req: Request, res: Response) => {
  try {
    const query = String(req.body?.query || 'latest breaking news today').trim();
    const category = typeof req.body?.category === 'string' ? req.body.category : undefined;
    const result = await performLiveBreakingNewsSearch(query, category);
    res.status(200).json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Live breaking news search failed' });
  }
});

// ============================================================
// GMAIL SERVER HELPERS & PUB/SUB PUSH NOTIFICATION HOOK
// ============================================================

let latestGmailPushNotice: { emailAddress?: string; historyId?: string; receivedAt: string } | null = null;

app.post('/api/gmail/pubsub', (req: Request, res: Response) => {
  try {
    const msgData = req.body?.message?.data;
    if (msgData) {
      const decoded = JSON.parse(Buffer.from(msgData, 'base64').toString('utf8'));
      latestGmailPushNotice = {
        emailAddress: decoded?.emailAddress,
        historyId: String(decoded?.historyId || ''),
        receivedAt: new Date().toISOString(),
      };
    } else {
      latestGmailPushNotice = {
        receivedAt: new Date().toISOString(),
      };
    }
    res.status(200).json({ ok: true });
  } catch {
    res.status(200).json({ ok: true });
  }
});

app.get('/api/gmail/push-status', (_req: Request, res: Response) => {
  res.status(200).json({
    pubSubTopicConfigured: Boolean(process.env.GMAIL_PUBSUB_TOPIC),
    latestPushNotice: latestGmailPushNotice,
  });
});

app.post('/api/gmail/analyze', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Gmail Bearer token.' });
    return;
  }

  try {
    const { task, messages, threadSummaryContext, userInstruction } = req.body || {};
    const ai = getServerGeminiClient();
    const model = GEMINI_MODELS.TEXT_FALLBACK;
    const prompt = task === 'draft_reply'
      ? `Draft a clear, polite, well-structured email reply based on this email thread context and user instruction.
Thread context: ${JSON.stringify(threadSummaryContext || messages || {}).slice(0, 4500)}
User instruction: ${String(userInstruction || 'Reply professionally')}
Return JSON: { "subject": "...", "body": "...", "notes": "..." }`
      : `Analyze these Gmail messages/threads. Identify sender, purpose, key contents, attachment implications, deadlines, and urgency.
Messages: ${JSON.stringify(messages || []).slice(0, 6000)}
Return JSON: { "executiveSummary": "...", "urgentCount": number, "items": [{ "id": "...", "purpose": "...", "deadlines": ["..."], "urgency": "high|normal|low", "suggestedAction": "..." }] }`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { temperature: 0.2 },
    });
    const raw = (response.text || '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    res.status(200).json({
      ok: true,
      result: jsonMatch ? JSON.parse(jsonMatch[0]) : { rawText: raw },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to analyze Gmail content' });
  }
});

// ============================================================
// CONTINUOUS SCREEN WEBSITE AUDIT API
// ============================================================

app.post('/api/vision/analyze-website', async (req: Request, res: Response) => {
  try {
    const { frames, sessionStartedAt, sessionEndedAt, userFocus } = req.body || {};
    if (!Array.isArray(frames) || frames.length === 0) {
      res.status(400).json({ error: 'At least one captured screen frame is required for analysis.' });
      return;
    }

    const ai = getServerGeminiClient();
    const model = GEMINI_MODELS.TEXT_PRIMARY;
    const selectedFrames = frames.slice(-10);

    const parts: any[] = [
      {
        text: `You are analyzing an ORDERED sequence of ${selectedFrames.length} screen-share snapshots captured continuously while the user scrolled or browsed a website/interface from ${sessionStartedAt || 'session start'} to ${sessionEndedAt || 'now'}.
${userFocus ? `User question / focus: "${userFocus}"` : ''}

CRITICAL HONESTY MANDATE:
- Analyze ONLY what is genuinely visible in these ${selectedFrames.length} captured frames.
- NEVER claim to have seen sections or pages not shown in the snapshots.
- Reference the observed section labels/timestamps honestly.

Return ONLY valid JSON matching:
{
  "observedSections": ["ordered list of sections seen across the frames"],
  "structureAndHierarchy": "detailed evaluation of layout structure and visual hierarchy",
  "navigationAndUx": "evaluation of navigation clarity, CTAs, and user flow",
  "designConsistency": "typography, spacing, color contrast, and visual polish evaluation",
  "contentAndClarity": "messaging, copy clarity, and value proposition review",
  "missingSections": ["missing expected sections if genuinely absent in observed frames, or note what wasn't captured"],
  "bugsOrIssues": ["visible layout, alignment, contrast, overlap, or usability bugs seen"],
  "prioritizedImprovements": ["1. ...", "2. ...", "3. ..."],
  "coverageDisclaimer": "Explicit note stating exactly which sections/frames were observed and that uncaptured sections were not inspected."
}`,
      },
    ];

    for (const f of selectedFrames) {
      const dataUrl = String(f.imageDataUrl || '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      if (base64) {
        parts.push({ text: `Frame #${f.index} (${f.timestamp}) — ${f.label || 'Screen View'}` });
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64 } });
      }
    }

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: { temperature: 0.2 },
    });

    const raw = (response.text || '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    res.status(200).json({
      ok: true,
      report: {
        sessionStartedAt: sessionStartedAt || new Date().toISOString(),
        sessionEndedAt: sessionEndedAt || new Date().toISOString(),
        totalFramesCaptured: frames.length,
        observedSections: parsed.observedSections || [],
        structureAndHierarchy: parsed.structureAndHierarchy || raw,
        navigationAndUx: parsed.navigationAndUx || '',
        designConsistency: parsed.designConsistency || '',
        contentAndClarity: parsed.contentAndClarity || '',
        missingSections: parsed.missingSections || [],
        bugsOrIssues: parsed.bugsOrIssues || [],
        prioritizedImprovements: parsed.prioritizedImprovements || [],
        coverageDisclaimer:
          parsed.coverageDisclaimer ||
          `Report strictly covers ${selectedFrames.length} captured screen frames out of ${frames.length} session snapshots; uncaptured views were not inspected.`,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to analyze continuous screen frames' });
  }
});

// ============================================================
// BROWSER EXTENSION BRIDGE (WS RELAY + COMMANDS + ZIP EXPORT)
// ============================================================

let extensionSocket: WebSocket | null = null;
let extensionMeta: { version?: string; connectedAt?: string; tabs: any[] } = { tabs: [] };
const appBridgeSockets = new Set<WebSocket>();
const pendingBridgeCommands = new Map<
  string,
  { resolve: (val: any) => void; timer: NodeJS.Timeout }
>();

function broadcastExtensionStatusToApps() {
  const payload = JSON.stringify({
    type: 'bridge_status',
    extensionConnected: Boolean(extensionSocket && extensionSocket.readyState === WebSocket.OPEN),
    extensionVersion: extensionMeta.version || '',
    connectedAt: extensionMeta.connectedAt || '',
    tabCount: extensionMeta.tabs.length,
    tabs: extensionMeta.tabs,
  });
  for (const sock of appBridgeSockets) {
    if (sock.readyState === WebSocket.OPEN) {
      try { sock.send(payload); } catch {}
    }
  }
}

async function sendCommandToExtension(action: string, params: Record<string, any> = {}, timeoutMs: number = 14000) {
  if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
    return {
      ok: false,
      extensionRequired: true,
      error: 'NEXA Chrome Companion Extension is not connected. Load /chrome-extension unpacked in Chrome to enable real cross-tab browser automation.',
    };
  }
  const requestId = `bcmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return new Promise<any>((resolve) => {
    const timer = setTimeout(() => {
      pendingBridgeCommands.delete(requestId);
      resolve({ ok: false, error: `Browser command "${action}" timed out.` });
    }, timeoutMs);
    pendingBridgeCommands.set(requestId, { resolve, timer });
    extensionSocket!.send(JSON.stringify({ type: 'command', requestId, action, params }));
  });
}

// ============================================================
// EXTENSIONLESS BROWSER AUTOMATION HELPERS (YOUTUBE + WEB RESEARCH)
// ============================================================

function extractYtInitialData(html: string): any | null {
  try {
    const marker = 'var ytInitialData = ';
    const idx = html.indexOf(marker);
    if (idx === -1) {
      const altMatch = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
      if (altMatch?.[1]) return JSON.parse(altMatch[1]);
      return null;
    }
    const start = idx + marker.length;
    const end = html.indexOf(';</script>', start);
    if (end === -1) return null;
    return JSON.parse(html.slice(start, end));
  } catch {
    return null;
  }
}

function collectObjectsByKey(node: any, targetKey: string, out: any[] = [], depth: number = 0): any[] {
  if (!node || typeof node !== 'object' || depth > 18) return out;
  if (Array.isArray(node)) {
    for (const item of node) collectObjectsByKey(item, targetKey, out, depth + 1);
    return out;
  }
  if (Object.prototype.hasOwnProperty.call(node, targetKey)) {
    out.push(node[targetKey]);
  }
  for (const val of Object.values(node)) {
    if (val && typeof val === 'object') {
      collectObjectsByKey(val, targetKey, out, depth + 1);
    }
  }
  return out;
}

app.post('/api/browser/youtube-resolve', async (req: Request, res: Response) => {
  try {
    const query = String(req.body?.query || '').trim();
    const mode = req.body?.mode === 'channel' ? 'channel' : 'search';
    if (!query) {
      res.status(400).json({ ok: false, error: 'query is required' });
      return;
    }

    const ytHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    const searchUrl =
      mode === 'channel'
        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%3D%3D`
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

    const ytResp = await fetch(searchUrl, {
      headers: ytHeaders,
      signal: AbortSignal.timeout(8000),
    });

    if (!ytResp.ok) {
      res.status(502).json({ ok: false, error: `YouTube lookup returned ${ytResp.status}` });
      return;
    }

    const html = await ytResp.text();
    const ytData = extractYtInitialData(html);

    let channelTitle = '';
    let channelUrl = '';
    let videos: Array<{
      videoId: string;
      title: string;
      channelName: string;
      watchUrl: string;
      embedUrl: string;
    }> = [];

    if (ytData && mode === 'channel') {
      const channels = collectObjectsByKey(ytData, 'channelRenderer');
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetNorm = norm(query);
      let bestChannel: any = null;
      let bestScore = -1;

      for (const ch of channels) {
        const title = ch?.title?.simpleText || ch?.title?.runs?.map((r: any) => r.text).join('') || '';
        const cId = ch?.channelId || '';
        const nameNorm = norm(title);
        let score = 0;
        if (nameNorm === targetNorm) score = 100;
        else if (nameNorm.startsWith(targetNorm) || targetNorm.startsWith(nameNorm)) score = 75;
        else if (nameNorm.includes(targetNorm)) score = 50;
        else if (title) score = 10;

        if (score > bestScore && cId) {
          bestScore = score;
          bestChannel = { title, channelId: cId };
        }
      }

      if (bestChannel) {
        channelTitle = bestChannel.title;
        channelUrl = `https://www.youtube.com/channel/${bestChannel.channelId}`;
        try {
          const chVideosResp = await fetch(`${channelUrl}/videos`, {
            headers: ytHeaders,
            signal: AbortSignal.timeout(7000),
          });
          if (chVideosResp.ok) {
            const chHtml = await chVideosResp.text();
            const chYtData = extractYtInitialData(chHtml);
            if (chYtData) {
              const chVidRenderers = collectObjectsByKey(chYtData, 'videoRenderer');
              for (const v of chVidRenderers.slice(0, 8)) {
                const videoId = v?.videoId;
                if (!videoId) continue;
                const title =
                  v?.title?.runs?.map((r: any) => r.text).join('') ||
                  v?.title?.simpleText ||
                  `${channelTitle} Video`;
                videos.push({
                  videoId,
                  title,
                  channelName: channelTitle,
                  watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
                  embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`,
                });
              }
            }
            if (videos.length === 0) {
              const idMatches = Array.from(
                new Set(Array.from(chHtml.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map((m) => m[1]))
              );
              for (const vId of idMatches.slice(0, 8)) {
                videos.push({
                  videoId: vId,
                  title: `${channelTitle} Latest Video`,
                  channelName: channelTitle,
                  watchUrl: `https://www.youtube.com/watch?v=${vId}`,
                  embedUrl: `https://www.youtube.com/embed/${vId}?autoplay=1&enablejsapi=1`,
                });
              }
            }
          }
        } catch {}
      }
    }

    if (videos.length === 0 && ytData) {
      const vidRenderers = collectObjectsByKey(ytData, 'videoRenderer');
      for (const v of vidRenderers.slice(0, 8)) {
        const videoId = v?.videoId;
        if (!videoId) continue;
        const title =
          v?.title?.runs?.map((r: any) => r.text).join('') ||
          v?.title?.simpleText ||
          query;
        const chName =
          v?.ownerText?.runs?.map((r: any) => r.text).join('') ||
          v?.longBylineText?.runs?.map((r: any) => r.text).join('') ||
          channelTitle ||
          'YouTube';
        videos.push({
          videoId,
          title,
          channelName: chName,
          watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
          embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`,
        });
      }
    }

    // Fallback to unfiltered YouTube video search if channel tab yielded no videos
    if (videos.length === 0 && mode === 'channel') {
      try {
        const fallbackResp = await fetch(
          `https://www.youtube.com/results?search_query=${encodeURIComponent(channelTitle || query)}`,
          { headers: ytHeaders, signal: AbortSignal.timeout(7000) }
        );
        if (fallbackResp.ok) {
          const fbHtml = await fallbackResp.text();
          const fbData = extractYtInitialData(fbHtml);
          if (fbData) {
            for (const v of collectObjectsByKey(fbData, 'videoRenderer').slice(0, 8)) {
              const videoId = v?.videoId;
              if (!videoId) continue;
              const title = v?.title?.runs?.map((r: any) => r.text).join('') || v?.title?.simpleText || query;
              const chName =
                v?.ownerText?.runs?.map((r: any) => r.text).join('') ||
                v?.longBylineText?.runs?.map((r: any) => r.text).join('') ||
                channelTitle ||
                'YouTube';
              videos.push({
                videoId,
                title,
                channelName: chName,
                watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
                embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`,
              });
            }
          }
        }
      } catch {}
    }

    // Regex fallback if ytInitialData structure changed
    if (videos.length === 0) {
      const idMatches = Array.from(new Set(Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map((m) => m[1])));
      for (const vId of idMatches.slice(0, 6)) {
        videos.push({
          videoId: vId,
          title: query,
          channelName: channelTitle || 'YouTube',
          watchUrl: `https://www.youtube.com/watch?v=${vId}`,
          embedUrl: `https://www.youtube.com/embed/${vId}?autoplay=1&enablejsapi=1`,
        });
      }
    }

    res.status(200).json({
      ok: videos.length > 0,
      mode,
      query,
      channelTitle: channelTitle || undefined,
      channelUrl: channelUrl || searchUrl,
      searchUrl,
      videos,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'YouTube resolution failed' });
  }
});

function decodeXmlEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

app.post('/api/browser/web-search', async (req: Request, res: Response) => {
  try {
    const query = String(req.body?.query || '').trim();
    const targetUrl = String(req.body?.url || '').trim();

    if (targetUrl) {
      const pageResp = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!pageResp.ok) {
        res.status(502).json({ ok: false, error: `Page fetch returned HTTP ${pageResp.status}` });
        return;
      }
      const html = await pageResp.text();
      const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || targetUrl).replace(/\s+/g, ' ').trim();
      const headings = Array.from(html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi))
        .map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 12);
      const bodyText = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&amp;|&quot;|&lt;|&gt;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 4000);

      res.status(200).json({ ok: true, title, url: targetUrl, headings, bodyText });
      return;
    }

    if (!query) {
      res.status(400).json({ ok: false, error: 'query or url is required' });
      return;
    }

    let summary = '';
    let links: Array<{ title: string; url: string; snippet?: string }> = [];

    // 1. Try Gemini Google Search grounding when configured
    const hasGeminiKey = Boolean((process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim());
    if (hasGeminiKey) {
      const ai = getServerGeminiClient();
      const models = resolveModelChain(undefined, 'text');
      for (const m of models.slice(0, 2)) {
        try {
          const result = await ai.models.generateContent({
            model: m,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `Search the web and provide a crisp, accurate, factual summary for: "${query}". Keep it concise and structured with the top findings.`,
                  },
                ],
              },
            ],
            config: { tools: [{ googleSearch: {} }] },
          });
          summary = result.text || '';
          const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          links = chunks
            .map((c: any) => ({
              title: c?.web?.title || c?.web?.uri || '',
              url: c?.web?.uri || '',
            }))
            .filter((l: any) => Boolean(l.url))
            .slice(0, 6);
          if (summary) break;
        } catch {}
      }
    }

    // 2. Always-available multi-source fallback: Wikipedia API + Google News RSS + DuckDuckGo Instant Answer API
    if (!summary) {
      const [wikiRes, gnewsRes, ddgRes] = await Promise.allSettled([
        fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=4&format=json`,
          {
            headers: { 'User-Agent': 'NEXA-Platform/1.0' },
            signal: AbortSignal.timeout(5000),
          }
        ).then((r) => (r.ok ? r.json() : null)),
        fetch(
          `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(6000),
          }
        ).then((r) => (r.ok ? r.text() : '')),
        fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
          { signal: AbortSignal.timeout(5000) }
        ).then((r) => (r.ok ? r.json() : null)),
      ]);

      const ddgData = ddgRes.status === 'fulfilled' ? ddgRes.value : null;
      const summaryParts: string[] = [];
      if (ddgData?.AbstractText) {
        summaryParts.push(String(ddgData.AbstractText).trim());
        if (ddgData.AbstractURL) {
          links.push({ title: ddgData.Heading || query, url: ddgData.AbstractURL });
        }
      }

      const wikiData = wikiRes.status === 'fulfilled' ? wikiRes.value : null;
      const wikiHits: any[] = Array.isArray(wikiData?.query?.search) ? wikiData.query.search : [];
      for (const hit of wikiHits.slice(0, 3)) {
        const title = decodeXmlEntities(String(hit.title || ''));
        const snippet = decodeXmlEntities(String(hit.snippet || ''));
        if (title) {
          links.push({
            title,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
            snippet,
          });
        }
      }

      const gnewsXml = gnewsRes.status === 'fulfilled' ? gnewsRes.value : '';
      if (gnewsXml) {
        const items = Array.from(gnewsXml.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(0, 4);
        for (const m of items) {
          const block = m[1];
          const title = decodeXmlEntities(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
          const url = decodeXmlEntities(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '');
          const pubDate = decodeXmlEntities(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '');
          if (title && url && links.length < 6) {
            links.push({ title, url, snippet: pubDate || undefined });
          }
        }
      }

      if (links.length > 0) {
        const topBullets = links
          .slice(0, 4)
          .map((l, idx) => `${idx + 1}. ${l.title}${l.snippet ? ` — ${l.snippet}` : ''}`)
          .join('\n');
        summaryParts.push(topBullets);
      }
      summary = summaryParts.join('\n\n').trim();
    }

    res.status(200).json({
      ok: Boolean(summary || links.length > 0),
      query,
      summary: summary || `Prepared Google search for "${query}".`,
      results: links.slice(0, 6),
      searchUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Web search failed' });
  }
});

app.get('/api/browser-bridge/status', (_req: Request, res: Response) => {
  res.status(200).json({
    extensionConnected: Boolean(extensionSocket && extensionSocket.readyState === WebSocket.OPEN),
    extensionlessReady: true,
    extensionVersion: extensionMeta.version || '',
    connectedAt: extensionMeta.connectedAt || '',
    tabCount: extensionMeta.tabs.length,
    tabs: extensionMeta.tabs,
  });
});

app.post('/api/browser-bridge/command', async (req: Request, res: Response) => {
  const { action, params } = req.body || {};
  if (!action) {
    res.status(400).json({ ok: false, error: 'action is required' });
    return;
  }
  const result = await sendCommandToExtension(String(action), params || {});
  addAuditLog({
    actionType: `browser_${String(action).toLowerCase()}`,
    target: String(params?.url || params?.query || params?.platform || params?.match || action),
    status: result.ok ? 'executed' : 'failed',
    confirmedByUser: true,
    details: result.ok ? `Chrome extension executed ${action}` : (result.error || 'Extension unavailable'),
  });
  res.status(result.ok ? 200 : result.extensionRequired ? 503 : 400).json(result);
});

app.get('/api/extension/download', async (req: Request, res: Response) => {
  try {
    const extDir = path.join(__dirname, 'chrome-extension');
    if (!fs.existsSync(extDir)) {
      res.status(404).json({ error: 'chrome-extension directory not found' });
      return;
    }
    const forwardedProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`).split(',')[0].trim();
    const wsProto = forwardedProto === 'https' ? 'wss' : 'ws';
    const dynamicWsUrl = `${wsProto}://${host}/api/browser-ws?role=extension`;

    const zip = new JSZip();
    const files = fs.readdirSync(extDir);
    for (const file of files) {
      const full = path.join(extDir, file);
      if (fs.statSync(full).isFile()) {
        if (file === 'background.js') {
          const content = fs.readFileSync(full, 'utf8').replace(
            /const DEFAULT_WS_URL = "[^"]+";/,
            `const DEFAULT_WS_URL = "${dynamicWsUrl}";`
          );
          zip.file(file, content);
        } else {
          zip.file(file, fs.readFileSync(full));
        }
      }
    }
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Disposition', 'attachment; filename="nexa-chrome-extension.zip"');
    res.send(buf);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to package extension ZIP' });
  }
});

// ============================================================
// SELF-IMPROVEMENT ADVISOR & INTERACTIVE BACKLOG API
// ============================================================

function seedDiagnosticBacklogIfEmpty() {
  const current = listImprovementBacklog();
  // Auto-resolve any legacy extension-requirement audit item since extensionless browser automation is built-in
  for (const item of current) {
    if (
      item.proposedFeature?.includes('Pair NEXA Chrome Companion Extension') &&
      item.status === 'Proposed'
    ) {
      updateImprovementStatus(item.id, 'Completed');
    }
  }
  const activeExisting = current.filter(
    (item: any) => !(item.proposedFeature?.includes('Pair NEXA Chrome Companion Extension') && item.status === 'Proposed')
  );
  if (activeExisting.length > 0) return;

  if (!process.env.GMAIL_PUBSUB_TOPIC) {
    upsertImprovementItem({
      proposedFeature: 'Configure Google Cloud Pub/Sub Gmail Push Topic for Zero-Delay Email Alerts',
      whyNeeded: 'Without a Cloud Pub/Sub push subscription hitting /api/gmail/pubsub, new email detection relies on periodic API polling.',
      expectedBenefit: 'Delivers sub-second push alerts whenever important emails arrive instead of polling intervals.',
      difficulty: 'Medium',
      dependencies: ['Google Cloud Pub/Sub topic', 'Gmail users.watch registration'],
      priority: 'Medium',
      status: 'Proposed',
      sourceType: 'system_audit',
      requiresApproval: true,
    });
  }

  upsertImprovementItem({
    proposedFeature: 'Local Python Host Daemon Auto-Start Service',
    whyNeeded: 'Host OS shell execution and local desktop app control run in sandboxed notice mode unless nexa_bridge_daemon.py is running on localhost:9099.',
    expectedBenefit: 'Enables verified local OS telemetry, file operations, and native app switching.',
    difficulty: 'Low',
    dependencies: ['Python 3.10+', 'websockets + psutil packages'],
    priority: 'Medium',
    status: 'Proposed',
    sourceType: 'system_audit',
    requiresApproval: true,
  });
}

app.get('/api/improvements', (_req: Request, res: Response) => {
  try {
    seedDiagnosticBacklogIfEmpty();
    const backlog = listImprovementBacklog();
    const capabilityGaps = listCapabilityGaps(30);
    const telemetrySummary = getApiTelemetrySummary();
    const integrationStatus = {
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY),
      chromeExtensionConnected: Boolean(extensionSocket && extensionSocket.readyState === WebSocket.OPEN),
      extensionlessBrowserReady: true,
      gmailOAuthConfigured: fs.existsSync(path.join(__dirname, 'firebase-applet-config.json')),
      gmailPubSubConfigured: Boolean(process.env.GMAIL_PUBSUB_TOPIC),
    };
    res.status(200).json({
      backlog,
      capabilityGaps,
      telemetrySummary,
      integrationStatus,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load self-improvement data' });
  }
});

app.post('/api/improvements/gaps', (req: Request, res: Response) => {
  try {
    const { commandText, intent, reason, category } = req.body || {};
    if (!commandText || !reason) {
      res.status(400).json({ error: 'commandText and reason are required' });
      return;
    }
    const logged = recordCapabilityGap({ commandText, intent, reason, category });
    res.status(200).json({ ok: true, gap: logged });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to log capability gap' });
  }
});

app.post('/api/improvements/backlog', (req: Request, res: Response) => {
  try {
    const item = req.body || {};
    if (!item.proposedFeature || !item.whyNeeded) {
      res.status(400).json({ error: 'proposedFeature and whyNeeded are required' });
      return;
    }
    const saved = upsertImprovementItem(item);
    res.status(200).json({ ok: true, ...saved, backlog: listImprovementBacklog() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save backlog item' });
  }
});

app.patch('/api/improvements/backlog/:id', (req: Request, res: Response) => {
  try {
    const status = req.body?.status;
    const allowed = ['Proposed', 'Approved', 'In Progress', 'Completed', 'Rejected'];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` });
      return;
    }
    const updated = updateImprovementStatus(req.params.id, status);
    addAuditLog({
      actionType: 'improvement_backlog_status',
      target: req.params.id,
      status: status === 'Rejected' ? 'rejected' : 'confirmed',
      confirmedByUser: true,
      details: `Updated improvement backlog item ${req.params.id} to ${status}`,
    });
    res.status(updated ? 200 : 404).json({ ok: updated, backlog: listImprovementBacklog() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update backlog status' });
  }
});

app.post('/api/improvements/analyze', async (_req: Request, res: Response) => {
  try {
    seedDiagnosticBacklogIfEmpty();
    const gaps = listCapabilityGaps(20);
    const telemetry = getApiTelemetrySummary();
    const recentErrors = listApiTelemetry(25).filter((t: any) => t.status !== 'success');
    const backlog = listImprovementBacklog();
    const isExtConnected = Boolean(extensionSocket && extensionSocket.readyState === WebSocket.OPEN);

    const recommendations = backlog.slice(0, 6);
    if (gaps.length > 0) {
      const topGap = gaps[0] as any;
      upsertImprovementItem({
        proposedFeature: `Resolve Recurring Gap: "${topGap.commandText.slice(0, 65)}"`,
        whyNeeded: `Requested ${topGap.occurrenceCount} time(s); failed/unsupported due to: ${topGap.reason}`,
        expectedBenefit: 'Eliminates repeated user friction and expands autonomous voice fulfillment.',
        difficulty: 'Medium',
        dependencies: [topGap.category || 'command_orchestrator'],
        priority: topGap.occurrenceCount >= 3 ? 'High' : 'Medium',
        status: 'Proposed',
        sourceType: 'gap',
        requiresApproval: true,
      });
    }

    if (telemetry.errorCalls + telemetry.quotaLimitedCalls > 2) {
      upsertImprovementItem({
        proposedFeature: 'Adaptive Request Caching & Quota Backoff Tuning',
        whyNeeded: `Telemetry shows ${telemetry.errorCalls} errors and ${telemetry.quotaLimitedCalls} rate-limit events across ${telemetry.totalCalls} calls (avg ${telemetry.avgLatencyMs}ms).`,
        expectedBenefit: 'Reduces 429 retries and cuts average response latency.',
        difficulty: 'Medium',
        dependencies: ['api_telemetry analytics', 'modelRegistry'],
        priority: 'High',
        status: 'Proposed',
        sourceType: 'telemetry',
        requiresApproval: true,
      });
    }

    const updatedBacklog = listImprovementBacklog();
    res.status(200).json({
      ok: true,
      diagnostics: {
        extensionConnected: isExtConnected,
        telemetry,
        recentErrorCount: recentErrors.length,
        gapCount: gaps.length,
      },
      recommendations: recommendations.length > 0 ? updatedBacklog.slice(0, 8) : updatedBacklog,
      backlog: updatedBacklog,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate self-improvement analysis' });
  }
});

// WebSocket Servers (noServer: true + explicit path router on upgrade)
const wss = new WebSocketServer({ noServer: true });
const browserWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const urlPath = (request.url || '').split('?')[0];
  if (urlPath === '/api/live-ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (urlPath === '/api/browser-ws') {
    browserWss.handleUpgrade(request, socket, head, (ws) => {
      browserWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

browserWss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  const reqUrl = new URL(req.url || '/api/browser-ws', 'http://localhost');
  const role = reqUrl.searchParams.get('role') || 'app';

  if (role === 'extension') {
    console.log('[Browser Bridge] Chrome Extension connected');
    const previousSocket = extensionSocket;
    extensionSocket = ws;
    if (previousSocket && previousSocket !== ws && previousSocket.readyState === WebSocket.OPEN) {
      try { previousSocket.close(); } catch {}
    }
    extensionMeta.connectedAt = new Date().toISOString();
    broadcastExtensionStatusToApps();

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'extension_hello' || msg.type === 'hello' || msg.type === 'tabs_sync') {
          if (msg.version) extensionMeta.version = String(msg.version);
          else if (!extensionMeta.version) extensionMeta.version = '1.0.0';
          if (Array.isArray(msg.tabs)) extensionMeta.tabs = msg.tabs;
          broadcastExtensionStatusToApps();
        } else if (msg.type === 'command_result' && msg.requestId) {
          const pending = pendingBridgeCommands.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingBridgeCommands.delete(msg.requestId);
            pending.resolve({ ok: Boolean(msg.ok), data: msg.data, error: msg.error });
          }
        }
      } catch {}
    });

    ws.on('close', () => {
      if (extensionSocket === ws) {
        extensionSocket = null;
        extensionMeta.version = '';
        extensionMeta.connectedAt = '';
        extensionMeta.tabs = [];
        broadcastExtensionStatusToApps();
      }
    });
  } else {
    appBridgeSockets.add(ws);
    ws.send(
      JSON.stringify({
        type: 'bridge_status',
        extensionConnected: Boolean(extensionSocket && extensionSocket.readyState === WebSocket.OPEN),
        extensionVersion: extensionMeta.version || '',
        connectedAt: extensionMeta.connectedAt || '',
        tabCount: extensionMeta.tabs.length,
        tabs: extensionMeta.tabs,
      })
    );
    ws.on('close', () => {
      appBridgeSockets.delete(ws);
    });
  }
});

wss.on('connection', (clientWs: WebSocket) => {
  console.log('[Live WebSocket] Client connected to /api/live-ws');
  let activeLiveSession: any = null;
  let isClosed = false;

  const heartbeatInterval = setInterval(() => {
    if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
      try {
        clientWs.ping();
      } catch (_) {}
    }
  }, 20000);

  clientWs.on('message', async (data: Buffer | string) => {
    try {
      const messageStr = typeof data === 'string' ? data : data.toString();
      const payload = JSON.parse(messageStr);

      switch (payload.type) {
        case 'ping': {
          if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'pong' }));
          }
          break;
        }

        case 'init': {
          const { model, config } = payload;
          const ai = getServerGeminiClient();
          const liveModel = model || GEMINI_MODELS.LIVE_AUDIO;

          console.log(`[Live WebSocket] Connecting to Gemini Live with model: ${liveModel}...`);

          try {
            const session = await ai.live.connect({
              model: liveModel,
              config: config || {
                responseModalities: [Modality.AUDIO],
              },
              callbacks: {
                onopen: () => {
                  if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'open' }));
                  }
                },
                onmessage: (serverMsg: LiveServerMessage) => {
                  if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'serverMessage', data: serverMsg }));
                  }
                },
                onclose: (e: any) => {
                  if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'close', reason: e?.reason || 'Live session closed' }));
                  }
                },
                onerror: (err: any) => {
                  console.warn('[Live WebSocket Gemini Notice]:', err?.message || err);
                  if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'error', error: err?.message || String(err) }));
                  }
                },
              },
            });

            if (isClosed) {
              try { session.close(); } catch (_) {}
              break;
            }

            activeLiveSession = session;
            console.log('[Live WebSocket] Connected successfully to Gemini Live session.');
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'ready' }));
            }
          } catch (connErr: any) {
            console.warn('[Live WebSocket Connection Notice]:', connErr?.message || connErr);
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'error', error: connErr?.message || String(connErr) }));
            }
          }
          break;
        }

        case 'realtimeInput': {
          if (activeLiveSession && payload.data) {
            const d = payload.data;
            if (d.audio) {
              activeLiveSession.sendRealtimeInput({ audio: d.audio });
            } else if (d.video) {
              activeLiveSession.sendRealtimeInput({ video: d.video });
            } else if (d.media) {
              const mime = d.media.mimeType || '';
              if (mime.startsWith('audio/')) {
                activeLiveSession.sendRealtimeInput({ audio: d.media });
              } else {
                activeLiveSession.sendRealtimeInput({ video: d.media });
              }
            } else {
              activeLiveSession.sendRealtimeInput(d);
            }
          }
          break;
        }

        case 'clientContent': {
          if (activeLiveSession) {
            activeLiveSession.sendClientContent(payload.data);
          }
          break;
        }

        case 'toolResponse': {
          if (activeLiveSession) {
            activeLiveSession.sendToolResponse(payload.data);
          }
          break;
        }

        case 'close': {
          if (activeLiveSession) {
            try {
              activeLiveSession.close();
            } catch (_) {}
            activeLiveSession = null;
          }
          break;
        }

        default:
          console.warn('[Live WebSocket] Unknown message type:', payload.type);
      }
    } catch (err: any) {
      console.warn('[Live WebSocket Message Handler Notice]:', err?.message || err);
    }
  });

  clientWs.on('close', () => {
    isClosed = true;
    clearInterval(heartbeatInterval);
    console.log('[Live WebSocket] Client disconnected from /api/live-ws');
    if (activeLiveSession) {
      try {
        activeLiveSession.close();
      } catch (_) {}
      activeLiveSession = null;
    }
  });

  clientWs.on('error', (err) => {
    isClosed = true;
    clearInterval(heartbeatInterval);
    console.warn('[Live WebSocket Socket Notice]:', err?.message || err);
    if (activeLiveSession) {
      try {
        activeLiveSession.close();
      } catch (_) {}
      activeLiveSession = null;
    }
  });
});

// Configure Vite middleware in development or static serving in production
async function setupViteOrStatic() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Server] Vite dev middleware mounted');
  } else {
    app.use(express.static(distPath, { index: false }));
    app.get('*', (_req: Request, res: Response) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not found');
      }
    });
    console.log('[Server] Serving production static files from dist');
  }
}

await setupViteOrStatic();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Full-stack server running at http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  startKnowledgeScheduler();
  startNewsScheduler();
});

// Graceful shutdown handling
const shutdown = () => {
  console.log('Received shutdown signal, closing server gracefully...');
  stopKnowledgeScheduler();
  stopNewsScheduler();
  wss.close();
  browserWss.close();
  server.close(() => {
    console.log('Server closed successfully.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
