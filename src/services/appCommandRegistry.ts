export type ActionRiskLevel = "read" | "ui" | "mutating" | "external_send" | "destructive";

export interface AppActionDefinition {
  id: string;
  module: string;
  label: string;
  description: string;
  routeOrPanel: string;
  aliases: string[];
  requiredPermissions: string[];
  riskLevel: ActionRiskLevel;
  requiresConfirmation: boolean;
  verifyState?: () => boolean;
}

export const NEXA_APP_COMMAND_REGISTRY: AppActionDefinition[] = [
  {
    id: "app.open_personality",
    module: "Personality",
    label: "Personality & Elite Minds",
    description: "Switch between NEXA Core, Olivia, Zoya, Aoi Sensei, and Elite Minds.",
    routeOrPanel: "personality_sidebar",
    aliases: ["open personality", "personality", "change persona", "elite minds", "vyaktitva", "personality kholo"],
    requiredPermissions: [],
    riskLevel: "ui",
    requiresConfirmation: false,
  },
  {
    id: "app.open_study_board",
    module: "Study Board",
    label: "Visual Study Board",
    description: "Open Aoi Sensei Visual Study Board for syllabus breakdown and blackboard diagrams.",
    routeOrPanel: "study_board",
    aliases: ["open study board", "study board", "study box", "padhai", "teach me", "aoi sensei"],
    requiredPermissions: [],
    riskLevel: "ui",
    requiresConfirmation: false,
  },
  {
    id: "app.open_memory",
    module: "Memory",
    label: "NEXA Memory Center",
    description: "Inspect and manage long-term durable facts and conversation snapshots.",
    routeOrPanel: "memory_center",
    aliases: ["open memory", "memory center", "show memories", "yaadash", "memory kholo"],
    requiredPermissions: [],
    riskLevel: "ui",
    requiresConfirmation: false,
  },
  {
    id: "app.open_leads",
    module: "Leads Finder",
    label: "B2B Lead Finder",
    description: "Discover business prospects, emails, and export lead CSVs.",
    routeOrPanel: "lead_finder",
    aliases: ["open leads", "lead finder", "leads finder", "find leads", "b2b leads"],
    requiredPermissions: ["network"],
    riskLevel: "ui",
    requiresConfirmation: false,
  },
  {
    id: "app.open_studio",
    module: "Studio",
    label: "Creation Studio",
    description: "Generate PPTX pitch decks, thumbnails, websites, documents, and proposals.",
    routeOrPanel: "creation_studio",
    aliases: ["open studio", "creation studio", "open creation studio", "studio kholo", "make ppt"],
    requiredPermissions: [],
    riskLevel: "ui",
    requiresConfirmation: false,
  },
  {
    id: "app.open_smart_focus",
    module: "Smart Focus",
    label: "Smart Focus Soundscapes",
    description: "Launch ambient focus soundscapes (rain, lofi, binaural, waves).",
    routeOrPanel: "soundscapes",
    aliases: ["open smart focus", "smart focus", "soundscapes", "focus music", "rain sound"],
    requiredPermissions: ["audio_playback"],
    riskLevel: "ui",
    requiresConfirmation: false,
  },
  {
    id: "app.open_whatsapp",
    module: "Bulk WhatsApp",
    label: "Bulk WhatsApp Outreach",
    description: "Open Bulk WhatsApp outreach drafter and campaign manager.",
    routeOrPanel: "whatsapp",
    aliases: ["open whatsapp", "bulk whatsapp", "whatsapp sender", "whatsapp kholo"],
    requiredPermissions: ["user_confirmation_before_send"],
    riskLevel: "external_send",
    requiresConfirmation: false,
  },
  {
    id: "app.open_habits",
    module: "Habit Tracker",
    label: "Habit Tracker",
    description: "Open daily discipline and habit streak tracker.",
    routeOrPanel: "habits",
    aliases: ["open habit tracker", "habit tracker", "habits", "aadat tracker", "habits kholo"],
    requiredPermissions: [],
    riskLevel: "ui",
    requiresConfirmation: false,
  },
  {
    id: "app.open_chat",
    module: "Chat NEXA",
    label: "Corner Chat Box",
    description: "Open or focus interactive text chat with NEXA.",
    routeOrPanel: "chat_box",
    aliases: ["open chat", "chat nexa", "chat with nexa", "baat karo", "chat kholo"],
    requiredPermissions: [],
    riskLevel: "ui",
    requiresConfirmation: false,
  },
  {
    id: "app.open_notepad",
    module: "Notepad",
    label: "Personal Notepad",
    description: "Open NEXA interactive side-drawer Notepad.",
    routeOrPanel: "notepad",
    aliases: ["open notepad", "notepad", "notes kholo", "show notepad"],
    requiredPermissions: [],
    riskLevel: "ui",
    requiresConfirmation: false,
  },
  {
    id: "app.toggle_webcam",
    module: "Webcam",
    label: "Webcam Vision",
    description: "Turn on or off real browser webcam access and live frame understanding.",
    routeOrPanel: "vision_camera",
    aliases: ["turn on webcam", "turn off webcam", "open camera", "close camera", "can you see me", "webcam on", "webcam off", "camera kholo"],
    requiredPermissions: ["camera"],
    riskLevel: "ui",
    requiresConfirmation: false,
  },
  {
    id: "app.toggle_screen_share",
    module: "Share Screen",
    label: "Screen Share & Continuous Website Observer",
    description: "Share Chrome tab/screen and analyze continuously observed website sections.",
    routeOrPanel: "vision_screen",
    aliases: ["share screen", "share my screen", "stop screen sharing", "look at this tab", "analyze this website", "screen share", "screen dikhao"],
    requiredPermissions: ["display_media"],
    riskLevel: "ui",
    requiresConfirmation: false,
  },
  {
    id: "app.toggle_mute",
    module: "Mute",
    label: "Speaker / Mic Mute Control",
    description: "Mute or unmute NEXA voice output or microphone input.",
    routeOrPanel: "audio_mute",
    aliases: ["mute", "unmute", "mute speaker", "unmute speaker", "mute mic", "unmute mic", "chup ho jao", "awaz band"],
    requiredPermissions: [],
    riskLevel: "ui",
    requiresConfirmation: false,
  },
  {
    id: "app.open_gmail",
    module: "Gmail AI Assistant",
    label: "Gmail AI Assistant",
    description: "Open Gmail AI Assistant for inbox monitoring, summaries, search, drafts, and verified sending.",
    routeOrPanel: "gmail_assistant",
    aliases: ["open gmail", "open gmail assistant", "gmail ai assistant", "check gmail", "check my emails", "read my emails", "gmail assistant", "email dikhao", "naya email", "inbox check", "check mail"],
    requiredPermissions: ["gmail_oauth"],
    riskLevel: "read",
    requiresConfirmation: false,
  },
  {
    id: "app.open_news",
    module: "Live News Engine",
    label: "Live News Intelligence",
    description: "Open 13-category live news intelligence briefing and breaking news verifier.",
    routeOrPanel: "news_hub",
    aliases: ["open live news", "live news", "live news hub", "live news intelligence", "news hub", "open news", "today news", "aaj ki news", "news pata hai", "breaking news", "latest news", "samachar"],
    requiredPermissions: ["network"],
    riskLevel: "read",
    requiresConfirmation: false,
  },
  {
    id: "app.open_screen_audit",
    module: "Screen Audit",
    label: "Continuous Screen & Website Audit",
    description: "Open consolidated multi-section screen capture timeline and UX/bug audit report.",
    routeOrPanel: "screen_audit",
    aliases: ["open screen audit", "screen audit", "website audit", "screen audit report", "observed screen"],
    requiredPermissions: ["display_media"],
    riskLevel: "read",
    requiresConfirmation: false,
  },
  {
    id: "app.open_browser_operator",
    module: "Browser Operator",
    label: "Universal Browser & AI Operator",
    description: "Open Chrome Extension Bridge & Tab/YouTube/AI Platform controller.",
    routeOrPanel: "browser_operator",
    aliases: ["open browser operator", "browser operator", "open chrome operator", "chrome operator", "browser control", "chrome extension", "open tabs manager", "tab manager"],
    requiredPermissions: ["chrome_extension"],
    riskLevel: "ui",
    requiresConfirmation: false,
  },
  {
    id: "app.open_self_improvement",
    module: "Self-Improvement",
    label: "Self-Improvement Advisor & Backlog",
    description: "Inspect system telemetry, capability gaps, and approve proposed upgrades.",
    routeOrPanel: "self_improvement",
    aliases: ["open improvements", "open self improvement", "open self-improvement", "self improvement", "self-improvement", "update hone ke liye", "what do you need to improve", "what do you need to update", "improve yourself", "improvement backlog", "diagnostics"],
    requiredPermissions: [],
    riskLevel: "read",
    requiresConfirmation: false,
  },
  {
    id: "app.open_settings",
    module: "Settings",
    label: "NEXA Settings & Olivia Studio",
    description: "Configure voices, Olivia personality ratios, telemetry, and backup/restore.",
    routeOrPanel: "settings",
    aliases: ["open settings", "settings", "audio settings", "settings kholo"],
    requiredPermissions: [],
    riskLevel: "ui",
    requiresConfirmation: false,
  },
  {
    id: "app.open_local_bridge",
    module: "System Bridge",
    label: "Local System & Browser Bridge",
    description: "Manage native Python daemon, Chrome extension pairing, and Voice OS controls.",
    routeOrPanel: "local_bridge",
    aliases: ["open local bridge", "system bridge", "open terminal", "bridge setup"],
    requiredPermissions: [],
    riskLevel: "ui",
    requiresConfirmation: false,
  },
];

export function matchAppRegistryCommand(rawText: string): AppActionDefinition | null {
  const clean = rawText
    .toLowerCase()
    .replace(/^(?:hey|hi|hello|ok|okay)?\s*(?:nexa|olivia|oliviya|coco|zoya|alexa)\s*[,:\s]*/i, "")
    .trim();

  if (!clean) return null;

  // Exact or high-confidence alias matching
  let bestMatch: AppActionDefinition | null = null;
  let bestScore = 0;

  for (const def of NEXA_APP_COMMAND_REGISTRY) {
    for (const alias of def.aliases) {
      if (clean === alias) {
        return def;
      }
      if (clean.includes(alias)) {
        const score = alias.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = def;
        }
      }
    }
  }
  return bestMatch;
}
