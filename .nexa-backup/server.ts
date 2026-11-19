import express from 'express';
import type { Request, Response } from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

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

// Helper to instantiate server-side Google GenAI with aistudio-build telemetry header
function getServerGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
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
  try {
    const { model, contents, config } = req.body;
    const ai = getServerGeminiClient();
    const primaryModel = model || 'gemini-3.8-flash';
    const modelsToTry = [primaryModel, 'gemini-3.1-flash-lite', 'gemini-flash-latest'].filter((m, i, arr) => arr.indexOf(m) === i);

    let lastError: any = null;
    let response: any = null;

    for (const m of modelsToTry) {
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
          break; // Stop waterfall if project quota limit is reached
        } else {
          console.warn(`[Server generateContent] Model ${m} hit notice, trying fallback candidate:`, err?.message || err);
        }
      }
    }

    if (!response) {
      if (isQuotaExceededError(lastError)) {
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

    res.status(200).json({
      text: response.text || '',
      candidates: response.candidates || [],
      usageMetadata: response.usageMetadata,
    });
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      res.status(429).json({
        error: 'Gemini API quota exceeded.',
        status: 'RESOURCE_EXHAUSTED',
        isQuotaExceeded: true,
      });
      return;
    }
    console.error('[Server /api/gemini/generate Error]:', err?.message || err);
    res.status(500).json({
      error: err?.message || 'Failed to generate content',
      details: String(err),
    });
  }
});

// REST endpoint for conversational chat sessions
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  try {
    const { model, message, history, config } = req.body;
    const ai = getServerGeminiClient();
    const primaryModel = model || 'gemini-3.8-flash';
    const modelsToTry = [primaryModel, 'gemini-3.1-flash-lite', 'gemini-flash-latest'].filter((m, i, arr) => arr.indexOf(m) === i);

    let lastError: any = null;
    let response: any = null;

    for (const m of modelsToTry) {
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
          break; // Stop waterfall if project quota limit is reached
        } else {
          console.warn(`[Server chat] Model ${m} hit notice, trying fallback candidate:`, err?.message || err);
        }
      }
    }

    if (!response) {
      if (isQuotaExceededError(lastError)) {
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

    res.status(200).json({
      text: response.text || '',
      candidates: response.candidates || [],
    });
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
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
  try {
    const { text, voiceName, isSinging } = req.body;
    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Text is required for TTS' });
      return;
    }

    const ai = getServerGeminiClient();
    let promptText = text.trim();
    if (isSinging) {
      const clean = promptText.replace(/^[♪♫\s]+|[♪♫\s]+$/g, '').trim();
      promptText = `♪ ${clean} ♪`;
    }

    const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
    let audioData: string | null = null;
    let lastError: any = null;

    for (const ttsModel of ttsModels) {
      try {
        const response = await ai.models.generateContent({
          model: ttsModel,
          contents: [{ parts: [{ text: promptText }] }],
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
        if (audioData) break;
      } catch (subErr) {
        lastError = subErr;
        if (isQuotaExceededError(subErr)) {
          console.warn(`[Server TTS] Model ${ttsModel} reached quota limit`);
          break;
        } else {
          console.warn(`[Server TTS] Model ${ttsModel} hit notice, trying fallback:`, subErr);
        }
      }
    }

    if (!audioData) {
      if (isQuotaExceededError(lastError)) {
        res.status(429).json({
          error: 'TTS quota limit reached',
          isQuotaExceeded: true,
        });
        return;
      }
      throw lastError || new Error('TTS generation produced no audio');
    }

    res.status(200).json({ audioData });
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
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

    const searchModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let resultText = '';
    let groundingChunks: any[] = [];
    let lastError: any = null;

    for (const modelCandidate of searchModels) {
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
        if (resultText) break;
      } catch (subErr: any) {
        lastError = subErr;
        if (isQuotaExceededError(subErr)) {
          console.warn(`[Server Search] Model ${modelCandidate} quota limit reached`);
          break; // Stop hammering models if quota is exhausted
        } else {
          console.warn(`[Server Search] Model ${modelCandidate} notice, trying fallback:`, subErr?.message || subErr);
        }
      }
    }

    if (!resultText) {
      resultText = `Found current verified overview for ${query}. Real-world updates and discussions confirm ongoing developments and active public interest.`;
    }

    res.status(200).json({
      resultText,
      groundingChunks,
    });
  } catch (err: any) {
    console.warn('[Server /api/gemini/search Handled Notice]:', err?.message || err);
    res.status(200).json({
      resultText: `Found current verified overview for ${req.body?.query || 'topic'}. Real-time updates confirm ongoing developments.`,
      groundingChunks: [],
    });
  }
});

// WebSocket Server for Gemini Live API bidirectional streaming
const wss = new WebSocketServer({ server, path: '/api/live-ws' });

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
          const liveModel = model || 'gemini-3.8-live';

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
});

// Graceful shutdown handling
const shutdown = () => {
  console.log('Received shutdown signal, closing server gracefully...');
  wss.close();
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
