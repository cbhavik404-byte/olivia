// NEXA Chrome Companion Extension v1.2.0 — Page Content Bridge + Authenticated WS Relay
// 1. Runs directly inside NEXA tabs AND AI Studio (.run.app) iframes using page session cookies.
// 2. Relays /api/browser-ws?role=extension using the authenticated iframe session (fixing Cloud Run 302 auth blocks).
// 3. Provides zero-latency window.postMessage <-> chrome.runtime direct RPC.

(function () {
  if (window.__nexaContentBridgeLoaded) {
    // Re-announce if re-injected on already-open tabs
    try {
      window.dispatchEvent(new CustomEvent("nexa-bridge-reping"));
    } catch {}
    return;
  }
  window.__nexaContentBridgeLoaded = true;

  const host = window.location.host || "";
  const isNexaHost =
    host.startsWith("localhost:3000") ||
    host.startsWith("127.0.0.1:3000") ||
    host.endsWith(".run.app");

  if (!isNexaHost) return;

  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const pageWsUrl = `${proto}//${host}/api/browser-ws?role=extension`;
  let relayWs = null;
  let relayReconnectTimer = null;
  let relayKeepaliveTimer = null;

  try {
    chrome.runtime.sendMessage({ type: "auto_configure_ws", wsUrl: pageWsUrl }, () => {
      void chrome.runtime.lastError;
    });
  } catch {}

  function sendPageHeartbeat() {
    try {
      chrome.runtime.sendMessage(
        {
          type: "page_bridge_heartbeat",
          host,
          wsRelayOpen: Boolean(relayWs && relayWs.readyState === WebSocket.OPEN),
        },
        () => {
          void chrome.runtime.lastError;
        }
      );
    } catch {}
  }

  function pushStatusToPage() {
    try {
      chrome.runtime.sendMessage({ type: "get_full_bridge_status" }, (res) => {
        if (chrome.runtime.lastError || !res) return;
        window.postMessage(
          {
            source: "nexa-extension",
            type: "bridge_status",
            extensionConnected: true,
            extensionVersion: res.version || "1.2.0",
            connectedAt: res.connectedAt || new Date().toISOString(),
            tabCount: Array.isArray(res.tabs) ? res.tabs.length : 0,
            tabs: Array.isArray(res.tabs) ? res.tabs : [],
            directBridge: true,
            wsRelayOpen: Boolean(relayWs && relayWs.readyState === WebSocket.OPEN),
          },
          "*"
        );
      });
    } catch {}
  }

  function pushTabsOverRelay() {
    if (!relayWs || relayWs.readyState !== WebSocket.OPEN) return;
    try {
      chrome.runtime.sendMessage({ type: "get_full_bridge_status" }, (res) => {
        if (chrome.runtime.lastError || !res) return;
        if (relayWs && relayWs.readyState === WebSocket.OPEN) {
          relayWs.send(
            JSON.stringify({
              type: "extension_hello",
              version: res.version || "1.2.0",
              tabs: Array.isArray(res.tabs) ? res.tabs : [],
            })
          );
        }
      });
    } catch {}
  }

  // Open an in-page WebSocket relay to /api/browser-ws?role=extension so Cloud Run cookie auth passes seamlessly
  function connectPageWsRelay() {
    if (relayWs && (relayWs.readyState === WebSocket.OPEN || relayWs.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (relayReconnectTimer) {
      clearTimeout(relayReconnectTimer);
      relayReconnectTimer = null;
    }

    try {
      relayWs = new WebSocket(pageWsUrl);
    } catch {
      scheduleRelayReconnect();
      return;
    }

    relayWs.onopen = () => {
      sendPageHeartbeat();
      pushTabsOverRelay();
      pushStatusToPage();
      if (relayKeepaliveTimer) clearInterval(relayKeepaliveTimer);
      relayKeepaliveTimer = setInterval(() => {
        sendPageHeartbeat();
        pushTabsOverRelay();
      }, 12000);
    };

    relayWs.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "command" && payload.requestId && payload.action) {
          chrome.runtime.sendMessage(
            {
              type: "direct_command",
              action: payload.action,
              params: payload.params || {},
            },
            (result) => {
              const err = chrome.runtime.lastError;
              if (relayWs && relayWs.readyState === WebSocket.OPEN) {
                relayWs.send(
                  JSON.stringify({
                    type: "command_result",
                    requestId: payload.requestId,
                    ok: err ? false : Boolean(result?.ok),
                    data: result?.data,
                    error: err ? err.message : result?.error,
                  })
                );
              }
              pushTabsOverRelay();
              pushStatusToPage();
            }
          );
        }
      } catch {}
    };

    relayWs.onclose = () => {
      if (relayKeepaliveTimer) clearInterval(relayKeepaliveTimer);
      sendPageHeartbeat();
      scheduleRelayReconnect();
    };

    relayWs.onerror = () => {
      try {
        relayWs.close();
      } catch {}
    };
  }

  function scheduleRelayReconnect() {
    if (relayReconnectTimer) return;
    relayReconnectTimer = setTimeout(() => {
      relayReconnectTimer = null;
      connectPageWsRelay();
    }, 5000);
  }

  // Listen for direct page RPC commands from BrowserOperatorService
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "nexa-app") return;

    if (data.type === "ping_extension") {
      sendPageHeartbeat();
      pushStatusToPage();
      if (!relayWs || relayWs.readyState !== WebSocket.OPEN) {
        connectPageWsRelay();
      }
      return;
    }

    if (data.type === "extension_command" && data.requestId && data.action) {
      try {
        chrome.runtime.sendMessage(
          {
            type: "direct_command",
            action: data.action,
            params: data.params || {},
          },
          (result) => {
            const err = chrome.runtime.lastError;
            window.postMessage(
              {
                source: "nexa-extension",
                type: "command_result",
                requestId: data.requestId,
                ok: err ? false : Boolean(result?.ok),
                data: result?.data,
                error: err ? err.message || "Extension runtime unavailable." : result?.error,
              },
              "*"
            );
            pushTabsOverRelay();
            pushStatusToPage();
          }
        );
      } catch (e) {
        window.postMessage(
          {
            source: "nexa-extension",
            type: "command_result",
            requestId: data.requestId,
            ok: false,
            error: String(e?.message || e),
          },
          "*"
        );
      }
    }
  });

  window.addEventListener("nexa-bridge-reping", () => {
    sendPageHeartbeat();
    pushStatusToPage();
    connectPageWsRelay();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      sendPageHeartbeat();
      pushStatusToPage();
      pushTabsOverRelay();
    }
  });

  // Connect authenticated page relay & push status reliably across load phases
  connectPageWsRelay();
  sendPageHeartbeat();
  pushStatusToPage();
  setTimeout(pushStatusToPage, 350);
  setTimeout(pushStatusToPage, 1200);
  setTimeout(pushStatusToPage, 2800);
  setInterval(() => {
    sendPageHeartbeat();
    pushStatusToPage();
  }, 5000);
})();
