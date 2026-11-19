// NEXA Chrome Companion Extension v1.2.0 — Background Service Worker (Manifest V3)
// Supports BOTH:
// 1. Authenticated Page-Bridge Relay (content_bridge.js inside AI Studio / .run.app / localhost tabs)
// 2. Direct Service-Worker WebSocket Relay (/api/browser-ws?role=extension)

const DEFAULT_WS_URL = "ws://localhost:3000/api/browser-ws?role=extension";
const EXT_VERSION = "1.2.0";

let ws = null;
let wsUrl = DEFAULT_WS_URL;
let reconnectTimer = null;
let keepaliveTimer = null;
let tabSyncTimer = null;
let lastConnectionError = "";
let connectedAt = "";
let pageBridgeLastSeenAt = 0;
let pageBridgeWsConnected = false;

function isPageBridgeActive() {
  return Date.now() - pageBridgeLastSeenAt < 25000;
}

function isNexaHostTab(url = "") {
  return (
    url.includes("aistudio.google.com") ||
    url.includes(".run.app") ||
    url.includes("localhost:3000") ||
    url.includes("127.0.0.1:3000")
  );
}

async function injectContentBridgeIntoOpenNexaTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const targetTabs = tabs.filter((t) => typeof t.id === "number" && isNexaHostTab(t.url || ""));
    let injectedCount = 0;
    for (const tab of targetTabs) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ["content_bridge.js"],
        });
        injectedCount++;
      } catch {}
    }
    return { scanned: targetTabs.length, injectedCount };
  } catch {
    return { scanned: 0, injectedCount: 0 };
  }
}

chrome.storage.local.get(["nexaWsUrl"], (res) => {
  if (res && res.nexaWsUrl) {
    wsUrl = res.nexaWsUrl;
  }
  connectRelay();
  injectContentBridgeIntoOpenNexaTabs();
});

chrome.runtime.onInstalled.addListener(() => {
  injectContentBridgeIntoOpenNexaTabs();
  try {
    chrome.alarms.create("nexa-keepalive", { periodInMinutes: 0.5 });
  } catch {}
});

chrome.runtime.onStartup.addListener(() => {
  injectContentBridgeIntoOpenNexaTabs();
  connectRelay();
  try {
    chrome.alarms.create("nexa-keepalive", { periodInMinutes: 0.5 });
  } catch {}
});

try {
  chrome.alarms.create("nexa-keepalive", { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "nexa-keepalive") {
      if (!isPageBridgeActive() && (!ws || ws.readyState !== WebSocket.OPEN)) {
        connectRelay();
      }
      broadcastTabSnapshot();
    }
  });
} catch {}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.nexaWsUrl?.newValue && changes.nexaWsUrl.newValue !== wsUrl) {
    wsUrl = changes.nexaWsUrl.newValue;
    if (ws) {
      try { ws.close(); } catch {}
    }
    connectRelay();
  }
});

function isNexaUrl(url = "") {
  return (
    url.includes("localhost:3000") ||
    url.includes("127.0.0.1:3000") ||
    url.includes(".run.app") ||
    url.includes("aistudio.google.com") ||
    url.toLowerCase().includes("nexa")
  );
}

async function getFormattedTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.map((t) => ({
    id: t.id,
    windowId: t.windowId,
    title: t.title || "Untitled Tab",
    url: t.url || "",
    active: Boolean(t.active),
    favIconUrl: t.favIconUrl || "",
    isNexaTab: isNexaUrl(t.url || ""),
  }));
}

function sendRelay(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

async function broadcastTabSnapshot() {
  try {
    const tabs = await getFormattedTabs();
    sendRelay({
      type: "extension_hello",
      version: EXT_VERSION,
      tabs,
    });
  } catch {}
}

function scheduleTabSnapshotPush() {
  if (tabSyncTimer) clearTimeout(tabSyncTimer);
  tabSyncTimer = setTimeout(() => {
    broadcastTabSnapshot();
  }, 250);
}

chrome.tabs.onCreated.addListener(scheduleTabSnapshotPush);
chrome.tabs.onRemoved.addListener(scheduleTabSnapshotPush);
chrome.tabs.onActivated.addListener(scheduleTabSnapshotPush);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab?.url && isNexaHostTab(tab.url)) {
    chrome.scripting
      .executeScript({
        target: { tabId, allFrames: true },
        files: ["content_bridge.js"],
      })
      .catch(() => {});
  }
  if (changeInfo.status === "complete" || changeInfo.title) {
    scheduleTabSnapshotPush();
  }
});

function connectRelay() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  // If an authenticated in-page relay is already serving a .run.app Cloud Run host,
  // avoid noisy unauthenticated service-worker WebSocket loops unless user uses localhost.
  if (pageBridgeWsConnected && wsUrl.includes(".run.app")) {
    return;
  }

  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    lastConnectionError = String(err?.message || err);
    scheduleReconnect();
    return;
  }

  ws.onopen = async () => {
    lastConnectionError = "";
    connectedAt = new Date().toISOString();
    await broadcastTabSnapshot();
    if (keepaliveTimer) clearInterval(keepaliveTimer);
    keepaliveTimer = setInterval(() => {
      sendRelay({ type: "ping" });
      broadcastTabSnapshot();
    }, 15000);
  };

  ws.onmessage = async (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === "command" && payload.requestId) {
        const result = await executeBridgeCommand(payload.action, payload.params || {});
        sendRelay({
          type: "command_result",
          requestId: payload.requestId,
          ok: result.ok,
          data: result.data,
          error: result.error,
        });
        await broadcastTabSnapshot();
      }
    } catch (e) {
      console.warn("Extension message error:", e);
    }
  };

  ws.onclose = () => {
    if (keepaliveTimer) clearInterval(keepaliveTimer);
    scheduleReconnect();
  };

  ws.onerror = () => {
    lastConnectionError = pageBridgeWsConnected
      ? "Using authenticated NEXA Page Relay"
      : "Direct WebSocket blocked or offline; open a NEXA tab or click Connect Open Tabs";
    try { ws.close(); } catch {}
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectRelay();
  }, 6000);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "page_bridge_heartbeat") {
    pageBridgeLastSeenAt = Date.now();
    pageBridgeWsConnected = Boolean(msg.wsRelayOpen);
    if (!connectedAt) connectedAt = new Date().toISOString();
    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === "get_status") {
    const wsConnected = Boolean(ws && ws.readyState === WebSocket.OPEN);
    const pageActive = isPageBridgeActive();
    chrome.tabs.query({}, (tabs) => {
      sendResponse({
        connected: wsConnected || pageActive,
        wsConnected,
        pageBridgeActive: pageActive,
        pageBridgeWsConnected,
        mode: wsConnected ? "ws" : pageActive ? "page_relay" : "offline",
        version: EXT_VERSION,
        tabCount: Array.isArray(tabs) ? tabs.length : 0,
        wsUrl,
        lastError: lastConnectionError,
      });
    });
    return true;
  }

  if (msg?.type === "get_full_bridge_status") {
    pageBridgeLastSeenAt = Date.now();
    getFormattedTabs()
      .then((tabs) => {
        sendResponse({
          version: EXT_VERSION,
          connectedAt: connectedAt || new Date().toISOString(),
          tabs,
        });
      })
      .catch(() => sendResponse({ version: EXT_VERSION, tabs: [] }));
    return true;
  }

  if (msg?.type === "auto_configure_ws" && msg.wsUrl) {
    pageBridgeLastSeenAt = Date.now();
    if (msg.wsUrl !== wsUrl) {
      wsUrl = msg.wsUrl;
      chrome.storage.local.set({ nexaWsUrl: wsUrl });
    }
    sendResponse({ ok: true, wsUrl });
    return true;
  }

  if (msg?.type === "direct_command") {
    pageBridgeLastSeenAt = Date.now();
    executeBridgeCommand(msg.action, msg.params || {})
      .then(async (result) => {
        await broadcastTabSnapshot();
        sendResponse(result);
      })
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg?.type === "scan_tabs" || msg?.type === "reconnect") {
    injectContentBridgeIntoOpenNexaTabs().then((scanRes) => {
      if (ws) try { ws.close(); } catch {}
      connectRelay();
      sendResponse({ ok: true, ...scanRes });
    });
    return true;
  }
});

async function waitForTabComplete(tabId, timeoutMs = 14000) {
  try {
    const existing = await chrome.tabs.get(tabId);
    if (existing.status === "complete") return existing;
  } catch {}

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.tabs.get(tabId).then(resolve).catch(() => resolve({ id: tabId }));
    }, timeoutMs);

    function listener(updatedId, info, tab) {
      if (updatedId === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(tab);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function focusChromeWindowForTab(tab) {
  if (tab && typeof tab.windowId === "number") {
    try {
      await chrome.windows.update(tab.windowId, { focused: true });
    } catch {}
  }
}

async function executeBridgeCommand(action, params) {
  try {
    switch (action) {
      case "LIST_TABS": {
        const tabs = await getFormattedTabs();
        return { ok: true, data: { tabs } };
      }

      case "OPEN_URL": {
        let url = String(params.url || "https://www.google.com");
        if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
        const tab = await chrome.tabs.create({ url, active: params.active !== false });
        if (params.active !== false) await focusChromeWindowForTab(tab);
        return { ok: true, data: { tab: { id: tab.id, url: tab.url || url, title: tab.title || url } } };
      }

      case "SEARCH_WEB": {
        const query = String(params.query || "").trim();
        const engine = String(params.engine || "google").toLowerCase();
        let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        if (engine === "duckduckgo") searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
        else if (engine === "bing") searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        else if (engine === "youtube") searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

        const tab = await chrome.tabs.create({ url: searchUrl, active: true });
        await focusChromeWindowForTab(tab);
        await waitForTabComplete(tab.id, 8000);
        return { ok: true, data: { tabId: tab.id, url: searchUrl, query, engine } };
      }

      case "FOCUS_TAB": {
        const tabs = await chrome.tabs.query({});
        let target = null;
        if (typeof params.tabId === "number") {
          target = tabs.find((t) => t.id === params.tabId);
        } else if (params.returnToNexa) {
          target = tabs.find((t) => isNexaUrl(t.url || ""));
        } else if (params.match) {
          const needle = String(params.match).toLowerCase();
          target = tabs.find(
            (t) =>
              (t.title || "").toLowerCase().includes(needle) ||
              (t.url || "").toLowerCase().includes(needle)
          );
        }
        if (!target) {
          return { ok: false, error: `No open tab matched "${params.match || params.tabId || "NEXA"}".` };
        }
        await focusChromeWindowForTab(target);
        await chrome.tabs.update(target.id, { active: true });
        return { ok: true, data: { focusedTab: { id: target.id, title: target.title, url: target.url } } };
      }

      case "CLOSE_TABS": {
        const tabIds = Array.isArray(params.tabIds) ? params.tabIds.filter((n) => typeof n === "number") : [];
        if (tabIds.length === 0) {
          return { ok: false, error: "No explicit tab IDs specified for closing." };
        }
        const currentTabs = await chrome.tabs.query({});
        const closed = [];
        for (const id of tabIds) {
          const t = currentTabs.find((x) => x.id === id);
          if (t && !isNexaUrl(t.url || "")) {
            await chrome.tabs.remove(id);
            closed.push({ id, title: t.title, url: t.url });
          }
        }
        return { ok: true, data: { closed } };
      }

      case "EXTRACT_PAGE_SUMMARY": {
        const tabs = await chrome.tabs.query({});
        let target = typeof params.tabId === "number"
          ? tabs.find((t) => t.id === params.tabId)
          : tabs.find((t) => t.active && !isNexaUrl(t.url || "")) || tabs.find((t) => t.active);

        if (!target) return { ok: false, error: "No readable tab found." };
        const [inj] = await chrome.scripting.executeScript({
          target: { tabId: target.id },
          func: () => {
            const title = document.title;
            const url = location.href;
            const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
              .slice(0, 15)
              .map((h) => h.textContent?.trim())
              .filter(Boolean);
            const searchResults = Array.from(document.querySelectorAll("a h3"))
              .slice(0, 8)
              .map((h3) => {
                const a = h3.closest("a");
                return { title: h3.textContent?.trim() || "", url: a?.href || "" };
              });
            const bodyText = (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 4500);
            return { title, url, headings, searchResults, bodyText };
          },
        });
        return { ok: true, data: inj.result };
      }

      case "YOUTUBE_CONTROL": {
        const op = String(params.operation || "play_first");
        const query = String(params.query || "").trim();
        const tabs = await chrome.tabs.query({});
        let ytTab = tabs.find((t) => (t.url || "").includes("youtube.com"));

        if (op === "open_channel") {
          const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%253D%253D`;
          ytTab = ytTab
            ? await chrome.tabs.update(ytTab.id, { url: searchUrl, active: true })
            : await chrome.tabs.create({ url: searchUrl, active: true });
          await focusChromeWindowForTab(ytTab);
          await waitForTabComplete(ytTab.id, 10000);
          await new Promise((r) => setTimeout(r, 1600));

          const [res] = await chrome.scripting.executeScript({
            target: { tabId: ytTab.id },
            args: [query, Boolean(params.playFirstVideo)],
            func: async (channelQuery, playFirst) => {
              const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
              const targetNorm = norm(channelQuery);
              let renderers = [];
              for (let i = 0; i < 12; i++) {
                renderers = Array.from(document.querySelectorAll("ytd-channel-renderer"));
                if (renderers.length > 0) break;
                await new Promise((r) => setTimeout(r, 300));
              }
              let best = null;
              let bestScore = -1;

              for (const r of renderers) {
                const titleEl = r.querySelector("#channel-title, yt-formatted-string#text");
                const name = titleEl?.textContent?.trim() || "";
                const nameNorm = norm(name);
                let score = 0;
                if (nameNorm === targetNorm) score = 100;
                else if (nameNorm.startsWith(targetNorm) || targetNorm.startsWith(nameNorm)) score = 70;
                else if (nameNorm.includes(targetNorm)) score = 45;
                if (score > bestScore) {
                  bestScore = score;
                  best = { name, link: r.querySelector("a#main-link")?.href || r.querySelector("a")?.href || "" };
                }
              }

              if (!best || !best.link) {
                return { found: false, message: "No exact YouTube channel match rendered yet." };
              }
              location.href = best.link;
              return { found: true, channelName: best.name, channelUrl: best.link, willPlayFirst: playFirst };
            },
          });

          if (res.result?.found && params.playFirstVideo) {
            await waitForTabComplete(ytTab.id, 9000);
            await new Promise((r) => setTimeout(r, 1800));
            await chrome.scripting.executeScript({
              target: { tabId: ytTab.id },
              func: () => {
                const firstVid = document.querySelector("ytd-rich-grid-media a#thumbnail, ytd-grid-video-renderer a#thumbnail, ytd-video-renderer a#thumbnail");
                if (firstVid) firstVid.click();
              },
            });
          }
          return { ok: true, data: res.result };
        }

        if (op === "search_and_play") {
          const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
          ytTab = ytTab
            ? await chrome.tabs.update(ytTab.id, { url: searchUrl, active: true })
            : await chrome.tabs.create({ url: searchUrl, active: true });
          await focusChromeWindowForTab(ytTab);
          await waitForTabComplete(ytTab.id, 10000);
          await new Promise((r) => setTimeout(r, 1500));

          const [res] = await chrome.scripting.executeScript({
            target: { tabId: ytTab.id },
            func: async () => {
              let first = null;
              for (let i = 0; i < 12; i++) {
                first = document.querySelector("ytd-video-renderer a#video-title");
                if (first) break;
                await new Promise((r) => setTimeout(r, 300));
              }
              if (first) {
                const title = first.textContent?.trim() || "YouTube Video";
                first.click();
                return { played: true, title };
              }
              return { played: false };
            },
          });
          return { ok: true, data: res.result };
        }

        if (!ytTab) {
          return { ok: false, error: "No YouTube tab is currently open." };
        }

        const [ctrlRes] = await chrome.scripting.executeScript({
          target: { tabId: ytTab.id },
          args: [op],
          func: (operation) => {
            const video = document.querySelector("video");
            if (operation === "pause" && video) {
              video.pause();
              return { status: "paused" };
            }
            if ((operation === "resume" || operation === "play") && video) {
              video.play();
              return { status: "playing" };
            }
            if (operation === "next") {
              const nextBtn = document.querySelector(".ytp-next-button");
              if (nextBtn) { nextBtn.click(); return { status: "next_clicked" }; }
            }
            if (operation === "previous") {
              history.back();
              return { status: "navigated_previous" };
            }
            return { status: "no_player_found" };
          },
        });
        return { ok: true, data: ctrlRes.result };
      }

      case "AI_PLATFORM_OPERATE": {
        const platform = String(params.platform || "chatgpt").toLowerCase();
        const promptText = String(params.prompt || "");
        const autoSubmit = Boolean(params.autoSubmit); // STRICT: Only true when user explicitly requested submit

        const platformUrls = {
          chatgpt: "https://chatgpt.com/",
          claude: "https://claude.ai/new",
          gemini: "https://gemini.google.com/app",
          grok: "https://grok.com/",
          perplexity: "https://www.perplexity.ai/",
        };
        const targetUrl = platformUrls[platform] || "https://chatgpt.com/";
        const domainHint =
          platform === "chatgpt"
            ? "chatgpt.com"
            : platform === "claude"
              ? "claude.ai"
              : platform === "gemini"
                ? "gemini.google.com"
                : platform === "perplexity"
                  ? "perplexity.ai"
                  : "grok.com";

        const tabs = await chrome.tabs.query({});
        let aiTab = tabs.find((t) => (t.url || "").includes(domainHint));
        if (aiTab) {
          await focusChromeWindowForTab(aiTab);
          aiTab = await chrome.tabs.update(aiTab.id, { active: true });
        } else {
          aiTab = await chrome.tabs.create({ url: targetUrl, active: true });
          await focusChromeWindowForTab(aiTab);
          await waitForTabComplete(aiTab.id, 14000);
        }

        const [injectRes] = await chrome.scripting.executeScript({
          target: { tabId: aiTab.id },
          args: [platform, promptText, autoSubmit],
          func: async (plat, text, shouldSubmit) => {
            const selectors = [
              "#prompt-textarea",
              "div[contenteditable='true'].ProseMirror",
              "rich-textarea div[contenteditable='true']",
              "div.ql-editor[contenteditable='true']",
              "div[role='textbox'][contenteditable='true']",
              "textarea[placeholder]",
              "textarea",
              "div[contenteditable='true']",
            ];

            let inputEl = null;
            // Poll up to 8 seconds for React/SPA hydration
            for (let attempt = 0; attempt < 32; attempt++) {
              for (const sel of selectors) {
                const candidates = Array.from(document.querySelectorAll(sel));
                const visible = candidates.find((el) => {
                  const rect = el.getBoundingClientRect();
                  return rect.width > 40 && rect.height > 15;
                });
                if (visible) {
                  inputEl = visible;
                  break;
                }
              }
              if (inputEl) break;
              await new Promise((r) => setTimeout(r, 250));
            }

            if (!inputEl) {
              return {
                inserted: false,
                submitted: false,
                reason: `Prompt input box did not appear on ${plat} (login or page verification may be required).`,
              };
            }

            inputEl.focus();
            if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
              const proto = inputEl.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
              if (setter) setter.call(inputEl, text);
              else inputEl.value = text;
              inputEl.dispatchEvent(new Event("input", { bubbles: true }));
              inputEl.dispatchEvent(new Event("change", { bubbles: true }));
            } else {
              // ProseMirror / TipTap / Quill reliable text insertion
              const selection = window.getSelection();
              const range = document.createRange();
              range.selectNodeContents(inputEl);
              selection?.removeAllRanges();
              selection?.addRange(range);
              const insertedViaExec = document.execCommand("insertText", false, text);
              if (!insertedViaExec || !(inputEl.textContent || "").includes(text.slice(0, 12))) {
                inputEl.textContent = text;
                inputEl.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
              }
            }

            let submitted = false;
            if (shouldSubmit) {
              await new Promise((r) => setTimeout(r, 250));
              const sendSelectors = [
                "button[data-testid='send-button']",
                "button[aria-label*='Send' i]",
                "button[aria-label*='Submit' i]",
                "button[type='submit']",
              ];
              for (const sSel of sendSelectors) {
                const btn = document.querySelector(sSel);
                if (btn && !btn.disabled) {
                  btn.click();
                  submitted = true;
                  break;
                }
              }
            }
            return { inserted: true, submitted, platform: plat };
          },
        });

        return { ok: Boolean(injectRes.result?.inserted), data: injectRes.result, error: injectRes.result?.reason };
      }

      default:
        return { ok: false, error: `Unsupported extension action: ${action}` };
    }
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
