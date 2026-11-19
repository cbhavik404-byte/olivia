// Server-side Gemini API client proxy
// Routes all Gemini calls through the Node.js/Express server so no API keys or raw SDK calls run in browser.

export function getGeminiApiKey(): string {
  // Always returns an active token identifier indicating server-managed key is operational
  return "server-managed-gemini-key";
}

let cachedProxyClient: any = null;

export function getGeminiClient(): any {
  if (cachedProxyClient) {
    return cachedProxyClient;
  }

  cachedProxyClient = {
    models: {
      generateContent: async ({ model, contents, config }: any) => {
        const res = await fetch('/api/gemini/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, contents, config }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server generation error: ${res.status}`);
        }

        const data = await res.json();
        return {
          text: data.text || '',
          candidates: data.candidates || [],
          usageMetadata: data.usageMetadata,
        };
      },

      generateContentStream: async function* ({ model, contents, config }: any) {
        const res = await fetch('/api/gemini/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, contents, config }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server stream error: ${res.status}`);
        }

        const data = await res.json();
        yield {
          text: data.text || '',
          candidates: data.candidates || [],
        };
      },
    },

    chats: {
      create: ({ model, config, history }: any) => {
        const internalHistory = [...(history || [])];

        return {
          sendMessage: async ({ message }: any) => {
            const res = await fetch('/api/gemini/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model,
                message,
                history: internalHistory,
                config,
              }),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `Server chat error: ${res.status}`);
            }

            const data = await res.json();
            const replyText = data.text || '';

            // Update rolling history
            internalHistory.push({
              role: 'user',
              parts: [{ text: typeof message === 'string' ? message : JSON.stringify(message) }],
            });
            internalHistory.push({
              role: 'model',
              parts: [{ text: replyText }],
            });

            return {
              text: replyText,
              candidates: data.candidates || [],
            };
          },
        };
      },
    },

    live: {
      connect: async ({ model, config, callbacks }: any) => {
        return new Promise((resolve, reject) => {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = `${protocol}//${window.location.host}/api/live-ws`;
          let ws: WebSocket;

          try {
            ws = new WebSocket(wsUrl);
          } catch (wsErr) {
            console.error('[Live WebSocket Init Error]:', wsErr);
            reject(wsErr);
            return;
          }

          let isResolved = false;
          let hasFiredOpen = false;
          let isManualClose = false;
          let pingTimer: any = null;

          const clearPing = () => {
            if (pingTimer) {
              clearInterval(pingTimer);
              pingTimer = null;
            }
          };

          ws.onopen = () => {
            console.log('[Client Live WebSocket] Connected to server bridge, sending session init...');
            ws.send(
              JSON.stringify({
                type: 'init',
                model,
                config,
              })
            );
            pingTimer = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN && !isManualClose) {
                try {
                  ws.send(JSON.stringify({ type: 'ping' }));
                } catch (_) {}
              }
            }, 20000);
          };

          ws.onmessage = (event) => {
            try {
              const payload = JSON.parse(event.data);

              if (payload.type === 'pong') {
                return;
              } else if (payload.type === 'ready' || payload.type === 'open') {
                if (!isResolved) {
                  isResolved = true;
                  resolve(liveSessionBridge);
                }
                if (!hasFiredOpen) {
                  hasFiredOpen = true;
                  callbacks?.onopen?.();
                }
              } else if (payload.type === 'serverMessage') {
                callbacks?.onmessage?.(payload.data);
              } else if (payload.type === 'close') {
                clearPing();
                if (!isManualClose) {
                  callbacks?.onclose?.(payload);
                }
              } else if (payload.type === 'error') {
                const errObj = new Error(payload.error || 'Live session server error');
                if (!isResolved) {
                  isResolved = true;
                  reject(errObj);
                }
                if (!isManualClose) {
                  callbacks?.onerror?.(errObj);
                }
              }
            } catch (parseErr) {
              console.warn('[Client Live WebSocket Parse Notice]:', parseErr);
            }
          };

          ws.onclose = (event) => {
            clearPing();
            console.log('[Client Live WebSocket] Closed by server');
            if (!isManualClose) {
              callbacks?.onclose?.(event);
            }
          };

          ws.onerror = (err: any) => {
            clearPing();
            if (isManualClose) {
              if (!isResolved) {
                isResolved = true;
                resolve(liveSessionBridge);
              }
              return;
            }
            const readableMessage =
              err && typeof err === 'object' && 'message' in err && err.message
                ? String(err.message)
                : 'Live WebSocket connection interrupted (auto-recovering)';
            const normalizedErr = new Error(readableMessage);
            console.warn('[Client Live WebSocket Notice]:', readableMessage);
            if (!isResolved) {
              isResolved = true;
              reject(normalizedErr);
            }
            callbacks?.onerror?.(normalizedErr);
          };

          const liveSessionBridge = {
            sendRealtimeInput: (data: any) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'realtimeInput', data }));
              }
            },
            sendClientContent: (data: any) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'clientContent', data }));
              }
            },
            sendToolResponse: (data: any) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'toolResponse', data }));
              }
            },
            close: () => {
              isManualClose = true;
              clearPing();
              try {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'close' }));
                }
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                  ws.close(1000, 'Client closed session');
                }
              } catch (_) {}
            },
          };
        });
      },
    },
  };

  return cachedProxyClient;
}
