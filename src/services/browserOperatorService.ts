import { BrowserBridgeStatus, BrowserTabInfo, SupportedAiPlatform } from "../types";

export interface PendingBrowserLaunch {
  url: string;
  label: string;
  promptText?: string;
  extensionRequired?: boolean;
  reason?: string;
}

export interface ManagedTabEntry {
  id: number;
  windowId: number;
  title: string;
  url: string;
  active: boolean;
  isNexaTab?: boolean;
  winRef?: Window | null;
  openedAt: number;
}

export interface YouTubeResolvedVideo {
  videoId: string;
  title: string;
  channelName: string;
  watchUrl: string;
  embedUrl: string;
}

const KNOWN_SITE_MAP: Record<string, string> = {
  chatgpt: "https://chatgpt.com/",
  openai: "https://chatgpt.com/",
  claude: "https://claude.ai/new",
  anthropic: "https://claude.ai/new",
  gemini: "https://gemini.google.com/app",
  grok: "https://grok.com/",
  google: "https://www.google.com/",
  youtube: "https://www.youtube.com/",
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
  twitter: "https://x.com/",
  x: "https://x.com/",
  github: "https://github.com/",
  linkedin: "https://www.linkedin.com/",
  gmail: "https://mail.google.com/mail/u/0/#inbox",
  whatsapp: "https://web.whatsapp.com/",
  spotify: "https://open.spotify.com/",
  perplexity: "https://www.perplexity.ai/",
};

function buildAiPlatformPrefillUrl(platform: SupportedAiPlatform, promptText: string): string {
  const cleanPrompt = promptText.trim();
  const encoded = encodeURIComponent(cleanPrompt);
  switch (platform) {
    case "chatgpt":
      return cleanPrompt ? `https://chatgpt.com/?q=${encoded}` : "https://chatgpt.com/";
    case "claude":
      return cleanPrompt ? `https://claude.ai/new?q=${encoded}` : "https://claude.ai/new";
    case "grok":
      return cleanPrompt ? `https://grok.com/?q=${encoded}` : "https://grok.com/";
    case "perplexity":
      return cleanPrompt ? `https://www.perplexity.ai/search?q=${encoded}` : "https://www.perplexity.ai/";
    case "gemini":
    default:
      return "https://gemini.google.com/app";
  }
}

class BrowserOperatorService {
  private ws: WebSocket | null = null;
  private status: BrowserBridgeStatus = {
    extensionConnected: false,
    extensionlessReady: true,
    tabCount: 1,
    tabs: [],
  };
  private listeners = new Set<(s: BrowserBridgeStatus) => void>();
  private reconnectTimer: any = null;
  private directBridgeAvailable = false;
  private pendingDirectCommands = new Map<string, { resolve: (res: any) => void; timer: any }>();
  private pingTimer: any = null;

  // Extensionless Managed Tab Registry for tabs opened by NEXA
  private managedTabs = new Map<number, ManagedTabEntry>();
  private nextManagedTabId = 1;

  constructor() {
    if (typeof window !== "undefined") {
      this.syncMergedStatus();
      this.setupDirectContentBridge();
      this.connectStatusSocket();
    }
  }

  private pruneClosedManagedTabs() {
    for (const [id, entry] of this.managedTabs.entries()) {
      if (entry.winRef && entry.winRef.closed) {
        this.managedTabs.delete(id);
      }
    }
  }

  private getNexaRootTab(): BrowserTabInfo {
    const anyManagedActive = Array.from(this.managedTabs.values()).some((t) => t.active && !t.winRef?.closed);
    return {
      id: 0,
      windowId: 0,
      title: (typeof document !== "undefined" && document.title) || "NEXA AI OS",
      url: (typeof window !== "undefined" && window.location.href) || "",
      active: !anyManagedActive,
      isNexaTab: true,
    };
  }

  private buildManagedTabList(): BrowserTabInfo[] {
    this.pruneClosedManagedTabs();
    const list: BrowserTabInfo[] = [this.getNexaRootTab()];
    for (const entry of this.managedTabs.values()) {
      list.push({
        id: entry.id,
        windowId: entry.windowId,
        title: entry.title,
        url: entry.url,
        active: entry.active,
        isNexaTab: false,
      });
    }
    return list;
  }

  private syncMergedStatus(extensionStatus?: Partial<BrowserBridgeStatus>) {
    const extConnected = Boolean(
      extensionStatus?.extensionConnected ?? (this.status.extensionConnected || this.directBridgeAvailable)
    );
    const extTabs = Array.isArray(extensionStatus?.tabs) && extensionStatus.tabs.length > 0 ? extensionStatus.tabs : [];
    const tabs = extConnected && extTabs.length > 0 ? extTabs : this.buildManagedTabList();

    this.status = {
      ...this.status,
      ...extensionStatus,
      extensionConnected: extConnected,
      extensionlessReady: true,
      tabs,
      tabCount: tabs.length,
    };
    this.emit();
  }

  private managedOpenWindow(url: string, label: string, reusableKey?: string): { opened: boolean; tab?: ManagedTabEntry } {
    if (typeof window === "undefined") return { opened: false };
    this.pruneClosedManagedTabs();

    try {
      // IMPORTANT: Never pass "noopener,noreferrer" — the HTML spec forces window.open() to return null
      // whenever "noopener" is present, which breaks both popup detection and focus/close tab control.
      const windowName = reusableKey || `nexa_tab_${this.nextManagedTabId}`;
      const winRef = window.open(url, windowName);
      if (!winRef) {
        return { opened: false };
      }

      // Mark existing managed tabs inactive
      for (const entry of this.managedTabs.values()) {
        entry.active = false;
      }

      // Update existing entry if windowName reused, else create a new ManagedTabEntry
      let existingEntry: ManagedTabEntry | undefined;
      if (reusableKey) {
        for (const entry of this.managedTabs.values()) {
          if (entry.winRef === winRef) {
            existingEntry = entry;
            break;
          }
        }
      }

      if (existingEntry) {
        existingEntry.url = url;
        existingEntry.title = label;
        existingEntry.active = true;
        existingEntry.openedAt = Date.now();
        this.syncMergedStatus();
        return { opened: true, tab: existingEntry };
      }

      const id = this.nextManagedTabId++;
      const tabEntry: ManagedTabEntry = {
        id,
        windowId: 1,
        title: label,
        url,
        active: true,
        isNexaTab: false,
        winRef,
        openedAt: Date.now(),
      };
      this.managedTabs.set(id, tabEntry);
      this.syncMergedStatus();
      return { opened: true, tab: tabEntry };
    } catch {
      return { opened: false };
    }
  }

  private setupDirectContentBridge() {
    window.addEventListener("message", (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== "nexa-extension") return;

      if (data.type === "bridge_status") {
        this.directBridgeAvailable = true;
        if (this.pingTimer) {
          clearInterval(this.pingTimer);
          this.pingTimer = null;
        }
        this.syncMergedStatus({
          extensionConnected: Boolean(data.extensionConnected),
          extensionVersion: data.extensionVersion || "1.2.0",
          connectedAt: data.connectedAt || new Date().toISOString(),
          tabs: Array.isArray(data.tabs) ? data.tabs : [],
        });
      } else if (data.type === "command_result" && data.requestId) {
        const pending = this.pendingDirectCommands.get(data.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingDirectCommands.delete(data.requestId);
          pending.resolve({ ok: Boolean(data.ok), data: data.data, error: data.error });
        }
      }
    });

    const sendPing = () => {
      try {
        window.postMessage({ source: "nexa-app", type: "ping_extension" }, "*");
      } catch {}
    };
    sendPing();
    this.pingTimer = setInterval(() => {
      if (this.directBridgeAvailable) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
        return;
      }
      sendPing();
    }, 1500);
  }

  public getStatus(): BrowserBridgeStatus {
    this.pruneClosedManagedTabs();
    return this.status;
  }

  public subscribe(fn: (s: BrowserBridgeStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    for (const fn of this.listeners) {
      try {
        fn(this.status);
      } catch {}
    }
  }

  private notifyFallbackLaunch(detail: PendingBrowserLaunch) {
    if (typeof window === "undefined") return;
    try {
      window.dispatchEvent(new CustomEvent("nexa_browser_launch_fallback", { detail }));
    } catch {}
  }

  public connectStatusSocket() {
    if (typeof window === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    try {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      this.ws = new WebSocket(`${proto}//${window.location.host}/api/browser-ws?role=app`);
      this.ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "bridge_status") {
            const wsConnected = Boolean(msg.extensionConnected);
            if (!wsConnected && this.directBridgeAvailable) {
              return;
            }
            this.syncMergedStatus({
              extensionConnected: wsConnected || this.directBridgeAvailable,
              extensionVersion: msg.extensionVersion || this.status.extensionVersion || "",
              connectedAt: msg.connectedAt || this.status.connectedAt || "",
              tabs: Array.isArray(msg.tabs) && msg.tabs.length > 0 ? msg.tabs : [],
            });
          }
        } catch {}
      };
      this.ws.onclose = () => {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connectStatusSocket(), 6000);
      };
    } catch {}
  }

  public async refreshStatus(): Promise<BrowserBridgeStatus> {
    this.pruneClosedManagedTabs();
    if (typeof window !== "undefined") {
      try {
        window.postMessage({ source: "nexa-app", type: "ping_extension" }, "*");
      } catch {}
      if (!this.directBridgeAvailable) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    try {
      const resp = await fetch("/api/browser-bridge/status", { signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        const remote = await resp.json();
        this.syncMergedStatus({
          extensionConnected: Boolean(remote.extensionConnected || this.directBridgeAvailable),
          extensionlessReady: true,
          extensionVersion: remote.extensionVersion || this.status.extensionVersion,
          connectedAt: remote.connectedAt || this.status.connectedAt,
          tabs: Array.isArray(remote.tabs) && remote.tabs.length > 0 ? remote.tabs : [],
        });
      }
    } catch {
      this.syncMergedStatus();
    }
    return this.status;
  }

  public resolveSiteUrl(siteNameOrUrl: string): string {
    const clean = siteNameOrUrl.trim();
    const lower = clean.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    if (KNOWN_SITE_MAP[lower]) return KNOWN_SITE_MAP[lower];
    for (const [key, url] of Object.entries(KNOWN_SITE_MAP)) {
      if (lower === key || lower.includes(`${key}.`)) return url;
    }
    if (/^https?:\/\//i.test(clean)) return clean;
    if (clean.includes(".") && !clean.includes(" ")) return `https://${clean}`;
    return `https://www.${clean.replace(/\s+/g, "").toLowerCase()}.com`;
  }

  private async runExtensionCommand(action: string, params: Record<string, any> = {}): Promise<{
    ok: boolean;
    extensionRequired?: boolean;
    data?: any;
    error?: string;
  }> {
    if (this.directBridgeAvailable && typeof window !== "undefined") {
      const directRes = await new Promise<any>((resolve) => {
        const requestId = `dcmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const timer = setTimeout(() => {
          this.pendingDirectCommands.delete(requestId);
          resolve(null);
        }, 12000);
        this.pendingDirectCommands.set(requestId, { resolve, timer });
        window.postMessage({ source: "nexa-app", type: "extension_command", requestId, action, params }, "*");
      });
      if (directRes) return directRes;
    }

    try {
      const resp = await fetch("/api/browser-bridge/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, params }),
      });
      return await resp.json();
    } catch (err: any) {
      return { ok: false, error: err?.message || "Failed to reach NEXA browser bridge." };
    }
  }

  public async listOpenTabs(): Promise<{ ok: boolean; tabs: BrowserTabInfo[]; error?: string }> {
    if (this.status.extensionConnected || this.directBridgeAvailable) {
      const res = await this.runExtensionCommand("LIST_TABS");
      if (res.ok && Array.isArray(res.data?.tabs)) {
        return { ok: true, tabs: res.data.tabs };
      }
    }
    const tabs = this.buildManagedTabList();
    this.syncMergedStatus();
    return { ok: true, tabs };
  }

  public async openWebsite(siteNameOrUrl: string): Promise<{
    ok: boolean;
    url: string;
    viaExtension: boolean;
    blockedByPopup?: boolean;
    message: string;
  }> {
    const targetUrl = this.resolveSiteUrl(siteNameOrUrl);
    if (this.status.extensionConnected || this.directBridgeAvailable) {
      const res = await this.runExtensionCommand("OPEN_URL", { url: targetUrl, active: true });
      if (res.ok) {
        return {
          ok: true,
          url: targetUrl,
          viaExtension: true,
          message: `Opened ${targetUrl} in Chrome.`,
        };
      }
    }

    const label = /^https?:\/\//i.test(siteNameOrUrl) ? targetUrl : siteNameOrUrl.trim();
    const { opened } = this.managedOpenWindow(targetUrl, label);
    if (opened) {
      return {
        ok: true,
        url: targetUrl,
        viaExtension: false,
        message: `Opened ${targetUrl} in a new Chrome tab.`,
      };
    }

    this.notifyFallbackLaunch({
      url: targetUrl,
      label: `Open ${label}`,
      extensionRequired: false,
      reason: "Chrome paused the background popup. Click below to open it immediately in a new tab.",
    });
    return {
      ok: false,
      url: targetUrl,
      viaExtension: false,
      blockedByPopup: true,
      message: `Chrome paused the background popup for ${targetUrl}. Click the "Open ${label}" button on screen to launch it directly.`,
    };
  }

  public async searchWeb(query: string, engine: "google" | "duckduckgo" | "bing" | "youtube" = "google") {
    const q = query.trim();
    const urlMap = {
      google: q ? `https://www.google.com/search?q=${encodeURIComponent(q)}` : "https://www.google.com/",
      duckduckgo: q ? `https://duckduckgo.com/?q=${encodeURIComponent(q)}` : "https://duckduckgo.com/",
      bing: q ? `https://www.bing.com/search?q=${encodeURIComponent(q)}` : "https://www.bing.com/",
      youtube: q ? `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` : "https://www.youtube.com/",
    };
    const targetUrl = urlMap[engine];

    if (this.status.extensionConnected || this.directBridgeAvailable) {
      const res = await this.runExtensionCommand("SEARCH_WEB", { query: q, engine });
      if (res.ok) {
        return {
          ok: true,
          url: targetUrl,
          viaExtension: true,
          message: `Opened ${engine.toUpperCase()} and searched for "${q}" in Chrome.`,
        };
      }
    }

    // Open search tab synchronously before any async call to preserve user activation if present
    const { opened } = this.managedOpenWindow(targetUrl, `${engine.toUpperCase()}: ${q}`);

    // For web search engines, also fetch grounded live intelligence summary from backend
    let summary = "";
    let results: Array<{ title: string; url: string }> = [];
    if (q && engine !== "youtube") {
      try {
        const resp = await fetch("/api/browser/web-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
          signal: AbortSignal.timeout(7000),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.summary) summary = String(data.summary).trim();
          if (Array.isArray(data?.results)) results = data.results;
        }
      } catch {}
    }

    if (!opened) {
      this.notifyFallbackLaunch({
        url: targetUrl,
        label: `Open ${engine.toUpperCase()} Search`,
        extensionRequired: false,
        reason: summary
          ? `Live answer fetched! Click below to also open the full ${engine.toUpperCase()} results tab.`
          : `Chrome paused the background popup for "${q}". Click below to open ${engine.toUpperCase()} directly.`,
      });
    }

    if (opened && summary) {
      return {
        ok: true,
        url: targetUrl,
        viaExtension: false,
        summary,
        results,
        message: `Opened ${engine.toUpperCase()} search for "${q}". Here's what I found:\n\n${summary}`,
      };
    }

    if (opened) {
      return {
        ok: true,
        url: targetUrl,
        viaExtension: false,
        message: `Opened ${engine.toUpperCase()} search for "${q}" in a new Chrome tab.`,
      };
    }

    if (summary) {
      return {
        ok: true,
        url: targetUrl,
        viaExtension: false,
        blockedByPopup: true,
        summary,
        results,
        message: `Search results for "${q}":\n\n${summary}\n\n(Click the launch card at the bottom-right to open the ${engine.toUpperCase()} tab in Chrome.)`,
      };
    }

    return {
      ok: false,
      url: targetUrl,
      viaExtension: false,
      blockedByPopup: true,
      message: `Chrome paused the popup for ${engine} search "${q}". Click the "Open ${engine.toUpperCase()} Search" button on screen.`,
    };
  }

  public async focusTab(matchOrId: string | number, returnToNexa: boolean = false) {
    if (this.status.extensionConnected || this.directBridgeAvailable) {
      const params = returnToNexa
        ? { returnToNexa: true }
        : typeof matchOrId === "number"
          ? { tabId: matchOrId }
          : { match: matchOrId };
      const res = await this.runExtensionCommand("FOCUS_TAB", params);
      if (res.ok) {
        return {
          ok: true,
          data: res.data,
          message: `Switched Chrome focus to "${res.data?.focusedTab?.title || "target tab"}".`,
        };
      }
    }

    this.pruneClosedManagedTabs();

    if (returnToNexa || matchOrId === 0) {
      try {
        window.focus();
      } catch {}
      for (const entry of this.managedTabs.values()) {
        entry.active = false;
      }
      this.syncMergedStatus();
      return {
        ok: true,
        message: "Focused the NEXA workspace tab.",
      };
    }

    const found = Array.from(this.managedTabs.values()).find((t) => {
      if (typeof matchOrId === "number") return t.id === matchOrId;
      const needle = String(matchOrId).trim().toLowerCase();
      return t.title.toLowerCase().includes(needle) || t.url.toLowerCase().includes(needle);
    });

    if (found && found.winRef && !found.winRef.closed) {
      try {
        found.winRef.focus();
      } catch {}
      for (const entry of this.managedTabs.values()) {
        entry.active = entry.id === found.id;
      }
      this.syncMergedStatus();
      return {
        ok: true,
        message: `Focused managed Chrome tab "${found.title}".`,
      };
    }

    return {
      ok: false,
      extensionRequired: false,
      message: `No open NEXA-managed Chrome tab matched "${matchOrId}". Only tabs opened by NEXA can be focused automatically without browser permission escalation.`,
    };
  }

  public async findTabsMatchingNames(names: string[]): Promise<{
    ok: boolean;
    matches: BrowserTabInfo[];
    unmatched: string[];
    error?: string;
  }> {
    const listed = await this.listOpenTabs();
    if (!listed.ok) {
      return { ok: false, matches: [], unmatched: names, error: listed.error };
    }
    const matches: BrowserTabInfo[] = [];
    const unmatched: string[] = [];
    for (const rawName of names) {
      const needle = rawName.trim().toLowerCase();
      const found = listed.tabs.filter(
        (t) =>
          !t.isNexaTab &&
          ((t.title || "").toLowerCase().includes(needle) || (t.url || "").toLowerCase().includes(needle))
      );
      if (found.length > 0) {
        for (const f of found) {
          if (!matches.some((m) => m.id === f.id)) matches.push(f);
        }
      } else {
        unmatched.push(rawName);
      }
    }
    return { ok: true, matches, unmatched };
  }

  public async closeSpecificTabs(tabIds: number[]) {
    if (this.status.extensionConnected || this.directBridgeAvailable) {
      const res = await this.runExtensionCommand("CLOSE_TABS", { tabIds });
      if (res.ok) {
        return {
          ok: true,
          closed: res.data?.closed || [],
          message: `Closed ${res.data?.closed?.length || 0} specifically requested tab(s) while preserving all other tabs.`,
        };
      }
    }

    this.pruneClosedManagedTabs();
    const closed: BrowserTabInfo[] = [];
    for (const id of tabIds) {
      const entry = this.managedTabs.get(id);
      if (entry && !entry.isNexaTab) {
        try {
          if (entry.winRef && !entry.winRef.closed) {
            entry.winRef.close();
          }
        } catch {}
        closed.push({
          id: entry.id,
          windowId: entry.windowId,
          title: entry.title,
          url: entry.url,
          active: false,
        });
        this.managedTabs.delete(id);
      }
    }
    this.syncMergedStatus();

    if (closed.length > 0) {
      return {
        ok: true,
        closed,
        message: `Closed ${closed.length} specifically requested tab(s) while preserving all other tabs.`,
      };
    }

    return {
      ok: false,
      closed: [],
      extensionRequired: false,
      message: "None of the requested tabs were opened by NEXA in this session, so they remain untouched.",
    };
  }

  public async controlYouTube(
    operation: "open_channel" | "search_and_play" | "pause" | "resume" | "next" | "previous",
    query: string = "",
    playFirstVideo: boolean = true
  ) {
    if (this.status.extensionConnected || this.directBridgeAvailable) {
      const res = await this.runExtensionCommand("YOUTUBE_CONTROL", {
        operation,
        query,
        playFirstVideo,
      });
      if (res.ok) {
        return {
          ok: true,
          data: res.data,
          message: `YouTube "${operation}" executed${res.data?.channelName ? ` on channel ${res.data.channelName}` : ""}${res.data?.title ? `: ${res.data.title}` : ""}.`,
        };
      }
    }

    if (operation === "pause" || operation === "resume" || operation === "next" || operation === "previous") {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("nexa_youtube_player", {
            detail: { type: operation },
          })
        );
      }
      return {
        ok: true,
        viaBuiltInPlayer: true,
        message: `Executed YouTube "${operation}" on the built-in NEXA YouTube player.`,
      };
    }

    // Extensionless channel / search resolution via backend YouTube resolver
    const mode = operation === "open_channel" ? "channel" : "search";
    const fallbackSearchUrl =
      mode === "channel"
        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%253D%253D`
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

    let resolved: {
      ok?: boolean;
      channelTitle?: string;
      channelUrl?: string;
      searchUrl?: string;
      videos?: YouTubeResolvedVideo[];
    } | null = null;

    try {
      const resp = await fetch("/api/browser/youtube-resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode }),
        signal: AbortSignal.timeout(8500),
      });
      if (resp.ok) {
        resolved = await resp.json();
      }
    } catch {}

    const videos: YouTubeResolvedVideo[] = Array.isArray(resolved?.videos) ? resolved.videos : [];
    const firstVideo = videos[0];
    const targetUrl =
      (playFirstVideo && firstVideo?.watchUrl) ||
      resolved?.channelUrl ||
      resolved?.searchUrl ||
      fallbackSearchUrl;

    if (videos.length > 0 && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("nexa_youtube_player", {
          detail: {
            type: "load",
            channelTitle: resolved?.channelTitle || query,
            channelUrl: resolved?.channelUrl || targetUrl,
            videos,
          },
        })
      );
    }

    // Attempt to also open the resolved watch/channel page in a Chrome tab if popup is permitted
    const { opened } = this.managedOpenWindow(targetUrl, resolved?.channelTitle ? `YouTube: ${resolved.channelTitle}` : `YouTube: ${query}`);

    if (videos.length > 0) {
      const chLabel = resolved?.channelTitle ? ` on channel ${resolved.channelTitle}` : "";
      return {
        ok: true,
        viaBuiltInPlayer: true,
        data: { channelName: resolved?.channelTitle, title: firstVideo.title, url: targetUrl, videos },
        message: `Playing "${firstVideo.title}"${chLabel} right now in NEXA's YouTube player${opened ? " and opened YouTube tab in Chrome" : ""}. You can say "pause video", "resume video", or "next video".`,
      };
    }

    if (!opened) {
      this.notifyFallbackLaunch({
        url: targetUrl,
        label: `Open YouTube: ${query}`,
        extensionRequired: false,
        reason: "Could not resolve an embeddable video automatically. Click below to open YouTube results in Chrome.",
      });
    }

    return {
      ok: Boolean(opened),
      message: opened
        ? `Opened YouTube for "${query}" in a new Chrome tab.`
        : `Click the "Open YouTube: ${query}" launch card to view results on YouTube.`,
    };
  }

  public async operateAiPlatform(
    platform: SupportedAiPlatform,
    promptText: string,
    autoSubmit: boolean = false
  ) {
    if (this.status.extensionConnected || this.directBridgeAvailable) {
      const res = await this.runExtensionCommand("AI_PLATFORM_OPERATE", {
        platform,
        prompt: promptText,
        autoSubmit: Boolean(autoSubmit),
      });
      if (res.ok) {
        return {
          ok: true,
          data: res.data,
          message: autoSubmit
            ? `Inserted your prompt into ${platform.toUpperCase()} and submitted it.`
            : `Inserted your prompt into ${platform.toUpperCase()} and left it ready for your review (not submitted).`,
        };
      }
    }

    const prefillUrl = buildAiPlatformPrefillUrl(platform, promptText);
    if (typeof navigator !== "undefined" && navigator.clipboard && promptText) {
      navigator.clipboard.writeText(promptText).catch(() => {});
    }

    const { opened } = this.managedOpenWindow(prefillUrl, `${platform.toUpperCase()} Prompt`);

    if (!opened) {
      this.notifyFallbackLaunch({
        url: prefillUrl,
        label: `Open ${platform.toUpperCase()} with Prompt`,
        promptText,
        extensionRequired: false,
        reason:
          platform === "gemini"
            ? "Prompt copied to clipboard! Click below to open Gemini and paste (Ctrl+V)."
            : `Click below to open ${platform.toUpperCase()} with your prompt pre-filled in its prompt box (also copied to clipboard).`,
      });
      return {
        ok: false,
        blockedByPopup: true,
        extensionRequired: false,
        message: `Chrome paused the popup for ${platform.toUpperCase()}, so I copied your prompt to clipboard. Click the "Open ${platform.toUpperCase()} with Prompt" button on screen!`,
      };
    }

    if (platform === "gemini") {
      return {
        ok: true,
        extensionRequired: false,
        message: `Opened GEMINI in Chrome and copied your prompt to your clipboard (press Ctrl+V in Gemini's prompt box).`,
      };
    }

    return {
      ok: true,
      extensionRequired: false,
      message: `Opened ${platform.toUpperCase()} in Chrome with your prompt pre-filled in its prompt box (also copied to clipboard for convenience).`,
    };
  }

  public async extractActiveTabSummary(tabIdOrUrl?: number | string) {
    if (typeof tabIdOrUrl !== "string" && (this.status.extensionConnected || this.directBridgeAvailable)) {
      const extRes = await this.runExtensionCommand("EXTRACT_PAGE_SUMMARY", { tabId: tabIdOrUrl });
      if (extRes.ok) return extRes;
    }

    this.pruneClosedManagedTabs();
    let targetUrl = typeof tabIdOrUrl === "string" ? tabIdOrUrl.trim() : "";
    if (!targetUrl) {
      const managed = Array.from(this.managedTabs.values()).sort((a, b) => b.openedAt - a.openedAt);
      const preferred =
        (typeof tabIdOrUrl === "number" ? managed.find((m) => m.id === tabIdOrUrl) : managed[0]) || managed[0];
      targetUrl = preferred?.url || "";
    }

    if (!targetUrl) {
      return {
        ok: false,
        extensionRequired: false,
        message:
          'No external URL is currently tracked. Specify a URL (e.g., "summarize https://example.com") or open a site through NEXA first, or say "share my screen" so I can inspect any tab visually.',
      };
    }

    try {
      const resp = await fetch("/api/browser/web-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
        signal: AbortSignal.timeout(9000),
      });
      const data = await resp.json();
      if (resp.ok && data?.ok) {
        return {
          ok: true,
          data: {
            title: data.title,
            url: data.url,
            headings: data.headings || [],
            bodyText: data.bodyText || "",
          },
        };
      }
      return {
        ok: false,
        extensionRequired: false,
        message: data?.error || `Could not fetch readable content from ${targetUrl}. Try "share my screen" for visual inspection.`,
      };
    } catch (err: any) {
      return {
        ok: false,
        extensionRequired: false,
        message: err?.message || `Failed to summarize ${targetUrl}.`,
      };
    }
  }
}

export const browserOperatorService = new BrowserOperatorService();
