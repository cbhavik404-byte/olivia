import { SupportedAiPlatform } from "../types";
import { browserOperatorService } from "./browserOperatorService";
import { recordAuditLog } from "./auditClientService";
import { matchAppRegistryCommand } from "./appCommandRegistry";

export interface OrchestratorContext {
  getNotepadText: () => string;
  requestConfirmation: (actionType: string, target: string, description: string) => Promise<boolean>;
  openModulePanel: (panel: string) => void;
  closeModulePanel: (panel?: string) => void;
  toggleWebcam: (desired?: boolean) => Promise<{ ok: boolean; message: string }>;
  toggleScreenShare: (desired?: boolean) => Promise<{ ok: boolean; message: string }>;
  analyzeObservedWebsite: (focus?: string) => Promise<void>;
  toggleMute: (kind: "speaker" | "mic", muted: boolean) => void;
  emergencyStopAll: () => void;
  runNewsBriefing: (query?: string, category?: string) => Promise<string>;
  runSelfImprovementBriefing: () => Promise<string>;
  runGmailVoiceQuery: (command: string) => Promise<string | null>;
}

export interface OrchestratedOutcome {
  handled: boolean;
  responseText: string;
  requiresSeriousTone?: boolean;
  verified?: boolean;
  actionId?: string;
}

const KNOWN_PLATFORM_NAMES: { key: SupportedAiPlatform; pattern: RegExp }[] = [
  { key: "chatgpt", pattern: /\b(?:chatgpt|chat\s*gpt|openai)\b/i },
  { key: "claude", pattern: /\bclaude\b/i },
  { key: "gemini", pattern: /\bgemini\b/i },
  { key: "grok", pattern: /\bgrok\b/i },
  { key: "perplexity", pattern: /\bperplexity\b/i },
];

function extractInlinePromptForPlatform(cleaned: string, platformKey: string): string {
  // Prefer quoted text if user provided quotes
  const quoted = cleaned.match(/["“]([^"”]{2,})["”]/);
  if (quoted?.[1]) return quoted[1].trim();

  // If user explicitly references notepad, return empty so caller reads Notepad
  if (/\bnotepad\b/i.test(cleaned)) return "";

  // Extract after verbs: write / type / paste / insert / put / enter / ask / tell / send / prompt[:]
  let candidate = "";
  const afterVerb = cleaned.match(
    /(?:and\s+)?(?:paste|insert|write|type|put|enter|send|ask\s+(?:it|chatgpt|claude|gemini|grok|perplexity)?|tell\s+(?:it|chatgpt|claude|gemini|grok|perplexity)?(?:\s+to)?)\s+(?:this\s+prompt\s*[:,-]?\s*|the\s+prompt\s*[:,-]?\s*|my\s+prompt\s*[:,-]?\s*|prompt\s*[:,-]?\s*|about\s+)?(.+)$/i
  );
  if (afterVerb?.[1]) {
    candidate = afterVerb[1].trim();
  } else {
    const colonSplit = cleaned.split(/:\s*(.+)$/);
    if (colonSplit[1]) candidate = colonSplit[1].trim();
  }

  if (!candidate) return "";

  // Clean trailing/leading filler phrases like "in that prompt box", "into chatgpt prompt box"
  candidate = candidate
    .replace(/\s+(?:in|into|inside|on)\s+(?:the\s+|that\s+|its\s+)?(?:chatgpt|claude|gemini|grok|perplexity)?\s*(?:prompt\s*box|chat\s*box|input\s*box|text\s*box|prompt\s*field|box)\s*$/i, "")
    .replace(/^(?:about|that)\s+/i, "")
    .trim();

  // Avoid treating pure navigation phrases ("the prompt box") as actual prompt text
  if (/^(?:the\s+)?(?:prompt\s*box|chat\s*box|input\s*box|it|that|there|here|prompt)$/i.test(candidate)) {
    return "";
  }
  if (candidate.toLowerCase() === platformKey) return "";
  return candidate;
}

export async function orchestrateMasterIntent(
  rawInput: string,
  ctx: OrchestratorContext
): Promise<OrchestratedOutcome> {
  const cleaned = rawInput
    .replace(/^(?:hey|hi|hello|ok|okay)?\s*(?:nexa|nexus|olivia|oliviya|coco|zoya|alexa)\s*[,:\s]*/i, "")
    .trim();
  const lower = cleaned.toLowerCase();

  // 0. EMERGENCY STOP
  if (
    lower === "emergency stop" ||
    lower === "abort all" ||
    lower === "stop everything" ||
    lower === "halt all actions"
  ) {
    ctx.emergencyStopAll();
    await recordAuditLog({
      actionType: "emergency_stop",
      target: "all_active_systems",
      status: "executed",
      confirmedByUser: true,
      details: "Emergency stop triggered by user.",
    });
    return {
      handled: true,
      verified: true,
      requiresSeriousTone: true,
      actionId: "security.emergency_stop",
      responseText: "Emergency Stop activated. All audio, animations, active streams, and pending automation have been halted.",
    };
  }

  // 1. SELF-IMPROVEMENT ADVISOR ("NEXA, तुम्हें update होने के लिए और क्या चाहिए?" / "what do you need to improve?")
  if (
    lower.includes("update होने के लिए") ||
    lower.includes("update hone ke liye") ||
    lower.includes("improve yourself") ||
    lower.includes("what do you need to update") ||
    lower.includes("what do you need to improve") ||
    lower.includes("self improvement") ||
    lower.includes("capability gaps") ||
    lower.includes("upgrade backlog")
  ) {
    const briefing = await ctx.runSelfImprovementBriefing();
    ctx.openModulePanel("self_improvement");
    return {
      handled: true,
      verified: true,
      requiresSeriousTone: true,
      actionId: "advisor.self_improvement",
      responseText: briefing,
    };
  }

  // 2. LIVE NEWS INTELLIGENCE ("Olivia, आज की news पता है?" / breaking news)
  if (
    lower.includes("आज की news") ||
    lower.includes("aaj ki news") ||
    lower.includes("news पता है") ||
    lower.includes("news pata hai") ||
    lower.includes("today's news") ||
    lower.includes("todays news") ||
    lower.includes("latest news") ||
    lower.includes("breaking news") ||
    lower === "news" ||
    lower === "open news"
  ) {
    const briefing = await ctx.runNewsBriefing(cleaned);
    ctx.openModulePanel("news_hub");
    return {
      handled: true,
      verified: true,
      requiresSeriousTone: true,
      actionId: "news.live_briefing",
      responseText: briefing,
    };
  }

  // 3. WEBCAM CONTROL
  if (
    /\b(?:turn\s+on|enable|start|open)\s+(?:the\s+|my\s+)?webcam\b/i.test(lower) ||
    lower === "can you see me" ||
    lower === "can you see me?"
  ) {
    const res = await ctx.toggleWebcam(true);
    return {
      handled: true,
      verified: res.ok,
      requiresSeriousTone: !res.ok,
      actionId: "vision.webcam_on",
      responseText: res.message,
    };
  }
  if (/\b(?:turn\s+off|disable|stop|close)\s+(?:the\s+|my\s+)?webcam\b/i.test(lower)) {
    const res = await ctx.toggleWebcam(false);
    return {
      handled: true,
      verified: res.ok,
      actionId: "vision.webcam_off",
      responseText: res.message,
    };
  }

  // 4. SCREEN SHARE & CONTINUOUS WEBSITE OBSERVATION
  if (
    /\b(?:share\s+(?:my\s+)?screen|start\s+screen\s+shar(?:e|ing)|look\s+at\s+this\s+tab)\b/i.test(lower)
  ) {
    const res = await ctx.toggleScreenShare(true);
    return {
      handled: true,
      verified: res.ok,
      requiresSeriousTone: true,
      actionId: "vision.screen_on",
      responseText: res.message,
    };
  }
  if (/\b(?:stop\s+screen\s+shar(?:e|ing)|end\s+screen\s+share|close\s+screen\s+share)\b/i.test(lower)) {
    const res = await ctx.toggleScreenShare(false);
    return {
      handled: true,
      verified: res.ok,
      requiresSeriousTone: true,
      actionId: "vision.screen_off",
      responseText: res.message,
    };
  }
  if (
    lower.includes("analyze this website") ||
    lower.includes("analyze the website") ||
    lower.includes("review this website") ||
    lower.includes("audit this website") ||
    lower.includes("evaluate my screen") ||
    lower.includes("what did you observe on my screen")
  ) {
    await ctx.analyzeObservedWebsite(cleaned);
    return {
      handled: true,
      verified: true,
      requiresSeriousTone: true,
      actionId: "vision.analyze_website",
      responseText: "Running consolidated audit across all continuously captured screen snapshots now. Check the Screen Audit report panel!",
    };
  }

  // 5. GMAIL ASSISTANT VOICE QUERIES
  if (
    /\b(?:check|read|summarize|search|find|draft|reply|send)\b.*\b(?:email|emails|gmail|inbox|mail)\b/i.test(lower) ||
    lower.includes("unread emails") ||
    lower.includes("new email")
  ) {
    const gmailReply = await ctx.runGmailVoiceQuery(cleaned);
    if (gmailReply) {
      return {
        handled: true,
        verified: true,
        requiresSeriousTone: true,
        actionId: "gmail.voice_assistant",
        responseText: gmailReply,
      };
    }
  }

  // 6. UNIVERSAL AI PLATFORM OPERATOR ("Open ChatGPT and write X in the prompt box" / "Open Claude and paste from Notepad" / "...and submit")
  const matchedPlatform = KNOWN_PLATFORM_NAMES.find((p) => p.pattern.test(lower));
  const wantsPromptPaste =
    Boolean(matchedPlatform) &&
    (lower.includes("notepad") ||
      lower.includes("paste") ||
      lower.includes("insert") ||
      lower.includes("write") ||
      lower.includes("type") ||
      lower.includes("put") ||
      lower.includes("enter") ||
      lower.includes("prompt") ||
      lower.includes("box") ||
      lower.includes("ask ") ||
      lower.includes("tell ") ||
      lower.includes("submit"));

  if (matchedPlatform && wantsPromptPaste) {
    const inlinePrompt = extractInlinePromptForPlatform(cleaned, matchedPlatform.key);
    const notepadPrompt = ctx.getNotepadText().trim();
    const promptToInsert = /\bnotepad\b/i.test(lower)
      ? notepadPrompt || inlinePrompt
      : inlinePrompt || notepadPrompt;

    if (!promptToInsert) {
      // Open the platform cleanly anyway and inform user prompt was empty
      const openRes = await browserOperatorService.openWebsite(matchedPlatform.key);
      return {
        handled: true,
        verified: openRes.ok,
        requiresSeriousTone: true,
        actionId: "browser.ai_operator_open_only",
        responseText: `Opened ${matchedPlatform.key.toUpperCase()}, but I didn't hear the prompt text and your NEXA Notepad is empty. Tell me the exact prompt to write or save it in Notepad first.`,
      };
    }

    const explicitSubmit =
      /\b(?:and\s+submit|submit\s+it|press\s+send|send\s+it\s+now|run\s+it)\b/i.test(lower) &&
      !lower.includes("don't submit") &&
      !lower.includes("without submitting");

    if (explicitSubmit) {
      const ok = await ctx.requestConfirmation(
        "ai_platform_submit",
        matchedPlatform.key.toUpperCase(),
        `Insert prompt (${promptToInsert.length} chars) and automatically SUBMIT on ${matchedPlatform.key.toUpperCase()}?`
      );
      if (!ok) {
        const stageRes = await browserOperatorService.operateAiPlatform(matchedPlatform.key, promptToInsert, false);
        return {
          handled: true,
          verified: stageRes.ok,
          requiresSeriousTone: true,
          actionId: "browser.ai_operator_staged",
          responseText: `Submission cancelled; staged prompt in ${matchedPlatform.key.toUpperCase()} for your review instead. ${stageRes.message}`,
        };
      }
    }

    const res = await browserOperatorService.operateAiPlatform(matchedPlatform.key, promptToInsert, explicitSubmit);
    return {
      handled: true,
      verified: res.ok,
      requiresSeriousTone: true,
      actionId: "browser.ai_operator",
      responseText: res.message,
    };
  }

  // 7. BROWSER TAB MANAGEMENT ("Return to NEXA", "Close the Instagram tab", "Close Facebook and Instagram", "Open a new tab", "List open tabs")
  if (
    lower === "return to nexa" ||
    lower === "switch back to nexa" ||
    lower === "go back to nexa" ||
    lower === "focus nexa"
  ) {
    const res = await browserOperatorService.focusTab("", true);
    return {
      handled: true,
      verified: res.ok,
      requiresSeriousTone: true,
      actionId: "browser.return_to_nexa",
      responseText: res.message,
    };
  }

  if (lower === "open a new tab" || lower === "new tab") {
    const res = await browserOperatorService.openWebsite("https://www.google.com");
    return {
      handled: true,
      verified: res.ok,
      requiresSeriousTone: true,
      actionId: "browser.new_tab",
      responseText: res.message,
    };
  }

  if (lower === "list open tabs" || lower === "show open tabs" || lower === "what tabs are open") {
    const res = await browserOperatorService.listOpenTabs();
    if (!res.ok) {
      return {
        handled: true,
        verified: false,
        requiresSeriousTone: true,
        actionId: "browser.list_tabs",
        responseText: res.error || "Could not retrieve open tabs.",
      };
    }
    const summary = res.tabs.slice(0, 12).map((t, i) => `${i + 1}. ${t.title} (${t.url})`).join("\n");
    return {
      handled: true,
      verified: true,
      requiresSeriousTone: true,
      actionId: "browser.list_tabs",
      responseText: `Found ${res.tabs.length} managed Chrome tab(s):\n${summary}`,
    };
  }

  // Close specific tabs ("Close the Instagram tab", "Close Facebook and Instagram")
  const closeTabMatch = lower.match(/^close\s+(?:the\s+)?(.+?)(?:\s+tabs?)?$/i);
  if (
    closeTabMatch &&
    !lower.includes("notepad") &&
    !lower.includes("study") &&
    !lower.includes("habit") &&
    !lower.includes("setting") &&
    !lower.includes("lead") &&
    !lower.includes("studio") &&
    !lower.includes("whatsapp") &&
    !lower.includes("soundscape") &&
    !lower.includes("panel") &&
    !lower.includes("window") &&
    !lower.includes("it") &&
    !lower.includes("that") &&
    !lower.includes("this")
  ) {
    const rawTargets = closeTabMatch[1]
      .split(/\s*(?:,|and)\s*/i)
      .map((s) => s.replace(/\btab\b/gi, "").trim())
      .filter(Boolean);

    const lookup = await browserOperatorService.findTabsMatchingNames(rawTargets);
    if (!lookup.ok) {
      return {
        handled: true,
        verified: false,
        requiresSeriousTone: true,
        actionId: "browser.close_tabs",
        responseText: lookup.error || "Could not inspect open tabs right now.",
      };
    }

    if (lookup.matches.length === 0) {
      return {
        handled: true,
        verified: true,
        requiresSeriousTone: true,
        actionId: "browser.close_tabs",
        responseText: `No open Chrome tab matched "${rawTargets.join(", ")}". Unrelated tabs were left untouched.`,
      };
    }

    const tabSummaryList = lookup.matches.map((t) => `• ${t.title} (${t.url})`).join("\n");
    const confirmed = await ctx.requestConfirmation(
      "close_browser_tabs",
      `${lookup.matches.length} browser tab(s)`,
      `Close ONLY these matching tab(s) while preserving all other tabs?\n${tabSummaryList}`
    );

    if (!confirmed) {
      await recordAuditLog({
        actionType: "browser_close_tabs",
        target: rawTargets.join(", "),
        status: "rejected",
        confirmedByUser: false,
        details: "User cancelled tab close confirmation.",
      });
      return {
        handled: true,
        verified: true,
        requiresSeriousTone: true,
        actionId: "browser.close_tabs_cancelled",
        responseText: "Tab closure cancelled. All open tabs were preserved.",
      };
    }

    const closeRes = await browserOperatorService.closeSpecificTabs(lookup.matches.map((m) => m.id));
    return {
      handled: true,
      verified: closeRes.ok,
      requiresSeriousTone: true,
      actionId: "browser.close_tabs",
      responseText: closeRes.message,
    };
  }

  // 8. YOUTUBE OPEN, SEARCH, CHANNEL & PLAYBACK CONTROL
  const ytChannelMatch = lower.match(/(?:open|go\s+to|find)\s+(?:the\s+)?(.+?)\s+youtube\s+channel(?:\s+and\s+play(?:\s+the\s+first\s+video)?)?/i);
  if (ytChannelMatch) {
    const channelName = ytChannelMatch[1].trim();
    const playFirst = lower.includes("play") || true;
    const res = await browserOperatorService.controlYouTube("open_channel", channelName, playFirst);
    return {
      handled: true,
      verified: res.ok,
      requiresSeriousTone: true,
      actionId: "youtube.open_channel",
      responseText: res.message,
    };
  }

  if (lower === "pause youtube" || lower === "pause the video" || lower === "pause video") {
    const res = await browserOperatorService.controlYouTube("pause");
    return { handled: true, verified: res.ok, requiresSeriousTone: true, actionId: "youtube.pause", responseText: res.message };
  }
  if (lower === "resume youtube" || lower === "resume the video" || lower === "resume video") {
    const res = await browserOperatorService.controlYouTube("resume");
    return { handled: true, verified: res.ok, requiresSeriousTone: true, actionId: "youtube.resume", responseText: res.message };
  }
  if (lower === "next youtube video" || lower === "next video on youtube" || lower === "play next video") {
    const res = await browserOperatorService.controlYouTube("next");
    return { handled: true, verified: res.ok, requiresSeriousTone: true, actionId: "youtube.next", responseText: res.message };
  }
  if (lower === "previous youtube video" || lower === "previous video on youtube") {
    const res = await browserOperatorService.controlYouTube("previous");
    return { handled: true, verified: res.ok, requiresSeriousTone: true, actionId: "youtube.previous", responseText: res.message };
  }

  // Open YouTube & search/play
  const ytOpenAndPlay = lower.match(/^(?:open|launch|go\s+to)\s+youtube\s+(?:and\s+|to\s+)?(?:search|find|look\s+up|play)\s+(?:for\s+)?(.+)$/i);
  const ytSearchPlayMatch = lower.match(/^(?:search|find|play|watch)\s+(.+?)\s+(?:on|in)\s+youtube$/i) || lower.match(/^(?:youtube\s+search|search\s+youtube|search\s+on\s+youtube|play\s+on\s+youtube)\s+(?:for\s+)?(.+)$/i);
  if (ytOpenAndPlay || ytSearchPlayMatch) {
    const query = (ytOpenAndPlay?.[1] || ytSearchPlayMatch?.[1] || "").trim();
    const isPlay = /\b(?:play|watch)\b/i.test(lower);
    const res = isPlay
      ? await browserOperatorService.controlYouTube("search_and_play", query, true)
      : await browserOperatorService.searchWeb(query, "youtube");
    return {
      handled: true,
      verified: res.ok,
      requiresSeriousTone: true,
      actionId: isPlay ? "youtube.search_play" : "youtube.search",
      responseText: res.message,
    };
  }

  // 9. GOOGLE SEARCH & GENERAL WEB SEARCH ("Open Google and search X", "Search for X", "Google X")
  const googleOpenSearch = cleaned.match(/^(?:open|launch|go\s+to)\s+google\s+(?:and\s+|to\s+)?(?:search|find|look\s+up)\s+(?:for\s+|about\s+)?(.+)$/i);
  const googleExplicitSearch =
    cleaned.match(/^(?:search\s+(?:on\s+)?google\s+(?:for\s+)?|google\s+search\s+(?:for\s+)?|search\s+the\s+web\s+for\s+|google\s+)(.+)$/i) ||
    cleaned.match(/^(?:search|find|look\s+up)\s+(?:for\s+)?(.+?)\s+(?:on|in)\s+google$/i);
  const genericWebSearch = cleaned.match(/^search\s+(?:for\s+)?(.+)$/i);

  if (googleOpenSearch || googleExplicitSearch || (genericWebSearch && !lower.includes("email") && !lower.includes("gmail") && !lower.includes("youtube") && !lower.includes("lead"))) {
    const query = (googleOpenSearch?.[1] || googleExplicitSearch?.[1] || genericWebSearch?.[1] || "")
      .replace(/^(?:for|about)\s+/i, "")
      .trim();
    if (query) {
      const res = await browserOperatorService.searchWeb(query, "google");
      return {
        handled: true,
        verified: res.ok,
        requiresSeriousTone: true,
        actionId: "browser.google_search",
        responseText: res.message,
      };
    }
  }

  // 10. SWITCH TO OR OPEN WEBSITE (YouTube, Google, ChatGPT, Claude, Gemini, Grok, Perplexity, etc.)
  const openSiteMatch = lower.match(/^(?:open|launch|go\s+to|switch\s+to)\s+(?:the\s+)?(youtube|chatgpt|google|claude|gemini|grok|instagram|facebook|perplexity|github|linkedin|spotify|whatsapp|gmail\s+web|twitter|x)(?:\s+(?:tab|website|site|app))?$/i);
  if (openSiteMatch) {
    const rawSite = openSiteMatch[1].toLowerCase().replace(/\s+web$/, "");
    const res = await browserOperatorService.openWebsite(rawSite);
    return {
      handled: true,
      verified: res.ok,
      requiresSeriousTone: true,
      actionId: "browser.open_site",
      responseText: res.message,
    };
  }

  // 10. WEB RESEARCH & SUMMARIZE ("Summarize this page" / "Summarize https://...")
  const summarizeUrlMatch =
    cleaned.match(/^(?:summarize|read)\s+(https?:\/\/\S+|[a-z0-9.-]+\.[a-z]{2,}(?:\/\S*)?)$/i);
  if (
    lower === "summarize this page" ||
    lower === "read this page" ||
    lower === "summarize the active tab" ||
    Boolean(summarizeUrlMatch)
  ) {
    const targetUrl = summarizeUrlMatch?.[1]
      ? (/^https?:\/\//i.test(summarizeUrlMatch[1]) ? summarizeUrlMatch[1] : `https://${summarizeUrlMatch[1]}`)
      : undefined;
    const extRes = await browserOperatorService.extractActiveTabSummary(targetUrl);
    if (!extRes.ok) {
      const errMsg = "error" in extRes ? extRes.error : ("message" in extRes ? extRes.message : undefined);
      return {
        handled: true,
        verified: false,
        requiresSeriousTone: true,
        actionId: "browser.extract_summary",
        responseText:
          errMsg ||
          'Open a link through NEXA or provide a URL (e.g., "summarize https://example.com"), or say "share my screen" so I can analyze any active tab visually.',
      };
    }
    const page = "data" in extRes ? extRes.data : undefined;
    if (!page) {
      return {
        handled: true,
        verified: false,
        requiresSeriousTone: true,
        actionId: "browser.extract_summary",
        responseText: "Page content could not be extracted. Try sharing your screen for visual analysis.",
      };
    }
    return {
      handled: true,
      verified: true,
      requiresSeriousTone: true,
      actionId: "browser.extract_summary",
      responseText: `Page observed: "${page.title}" (${page.url})\nKey Headings: ${(page.headings || []).slice(0, 5).join(" | ")}\nPreview: ${(page.bodyText || "").slice(0, 600)}`,
    };
  }

  // 11. REGISTERED NEXA APP MODULE FALLBACK (only on exact alias match or explicit open/show/toggle verb)
  const appDef = matchAppRegistryCommand(cleaned);
  if (appDef) {
    const isExact = appDef.aliases.some((a) => lower === a);
    const hasActionVerb = /^(?:open|show|launch|start|toggle|switch|enable|disable|mute|unmute|check|view)\b/i.test(lower) || /\b(?:kholo|dikhao)\b/i.test(lower);
    if (isExact || hasActionVerb) {
      if (appDef.routeOrPanel === "audio_mute") {
        const shouldMute = !lower.includes("unmute");
        ctx.toggleMute(lower.includes("mic") ? "mic" : "speaker", shouldMute);
        return {
          handled: true,
          verified: true,
          requiresSeriousTone: true,
          actionId: appDef.id,
          responseText: shouldMute ? "Audio muted." : "Audio unmuted.",
        };
      }
      if (appDef.routeOrPanel === "vision_camera") {
        const res = await ctx.toggleWebcam();
        return { handled: true, verified: res.ok, requiresSeriousTone: !res.ok, actionId: appDef.id, responseText: res.message };
      }
      if (appDef.routeOrPanel === "vision_screen") {
        const res = await ctx.toggleScreenShare();
        return { handled: true, verified: res.ok, requiresSeriousTone: true, actionId: appDef.id, responseText: res.message };
      }
      ctx.openModulePanel(appDef.routeOrPanel);
      return {
        handled: true,
        verified: true,
        requiresSeriousTone: appDef.riskLevel === "read" || appDef.riskLevel === "external_send",
        actionId: appDef.id,
        responseText: `Opened ${appDef.label}.`,
      };
    }
  }

  return { handled: false, responseText: "" };
}
