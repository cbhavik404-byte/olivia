// src/services/capabilityRegistry.ts
// Structured Capability Registry & Dynamic Self-Description Engine for NEXA (Section 32 & 33)

export interface NexaCapability {
  id: string;
  name: string;
  category: "core" | "voice_vision" | "productivity" | "studio" | "web_outreach" | "intelligence" | "persona";
  description: string;
  purpose: string;
  availableTools: string[];
  requirements: string[];
  limitations: string[];
  status: "active" | "beta" | "permission_required";
  examplePrompts: string[];
}

export const NEXA_CAPABILITY_REGISTRY: NexaCapability[] = [
  {
    id: "live_voice_vision",
    name: "Real-time Multimodal Voice & Vision",
    category: "voice_vision",
    description: "Ultra-low-latency bidirectional conversational voice streaming with live camera video & screen inspection.",
    purpose: "Allows human-like real-time spoken conversation, active visual analysis of errors, physical objects, code, and live screen UI.",
    availableTools: ["startCamera", "stopCamera", "switchCamera", "startScreenShare", "stopScreenShare", "toggleMic"],
    requirements: ["Microphone permission", "Camera permission (optional for vision)", "Display media permission (optional for screen share)"],
    limitations: ["Screen sharing and camera require active browser permissions", "Requires active internet for Gemini Live WebSocket"],
    status: "active",
    examplePrompts: ["Look at my screen and help me debug this error", "What object am I holding in front of the camera?", "Let's talk about my project"]
  },
  {
    id: "autonomous_task_execution",
    name: "Goal-Driven Autonomous Agent & Task Engine",
    category: "core",
    description: "Multi-step goal execution system operating under the UNDERSTAND → THINK → PLAN → ACT → OBSERVE → VERIFY → RECOVER cycle.",
    purpose: "Executes end-to-end tasks instead of single-step blind actions, verifying completion before reporting success.",
    availableTools: ["processCommand", "executeDeviceAction", "verifyActionState"],
    requirements: ["Clear goal or inferred intent"],
    limitations: ["Cannot perform irreversible real-world actions without explicit confirmation", "Subject to browser sandbox boundaries"],
    status: "active",
    examplePrompts: ["Open the Study Board, add a study session for Biology, and close it when done", "Play happy birthday on YouTube and confirm playback"]
  },
  {
    id: "open_close_ui_control",
    name: "Screen-Aware Open & Close UI Control",
    category: "productivity",
    description: "Context-aware control to open and close any on-screen panels, modals, boards, and drawers upon command.",
    purpose: "Ensures that if Nexa opens any tool (Notepad, Study Board, Settings, Leads, WhatsApp, Habits), she can also close it when asked 'Close that' or 'Close it'.",
    availableTools: ["open_notepad", "close_notepad", "open_study_board", "close_study_board", "open_settings", "close_settings", "open_habits", "close_habits", "open_lead_finder", "close_lead_finder", "open_creation_studio", "close_creation_studio", "open_whatsapp", "close_whatsapp", "open_soundscapes", "close_soundscapes"],
    requirements: ["App UI running in viewport"],
    limitations: ["Only controls in-app panels and modals"],
    status: "active",
    examplePrompts: ["Open the Study Board", "Close it", "Close that window", "Open my Notepad", "Hide the settings menu"]
  },
  {
    id: "persistent_memory_bank",
    name: "3-Level Memory & Topic Persistence",
    category: "intelligence",
    description: "Selective memory management separating Level 1 (Short-term), Level 2 (Session context), and Level 3 (Durable persistent facts).",
    purpose: "Retains important user facts, ongoing projects, preferences, and standing instructions across app restarts without context bloat.",
    availableTools: ["addDurableFact", "getDurableFacts", "saveImportantTopic", "getImportantTopic"],
    requirements: ["localStorage persistence"],
    limitations: ["Only explicitly marked or genuinely durable facts are stored to prevent noise accumulation"],
    status: "active",
    examplePrompts: ["Remember this: I am launching on Product Hunt next Tuesday", "What are my durable instructions?", "Keep this for next time"]
  },
  {
    id: "creation_studio",
    name: "Creation Studio (PPT, Thumbnails, Landing Pages, Docs)",
    category: "studio",
    description: "Automated generative studio producing real PowerPoint (.pptx) decks, high-CTR YouTube thumbnails, HTML/CSS landing pages, and client proposals.",
    purpose: "Empowers Bhavik to build digital assets, multi-slide pitch decks with downloads, and launch landing pages rapidly.",
    availableTools: ["generatePPT", "downloadPPTX", "generateThumbnail", "generateLandingPage", "generateProposal"],
    requirements: ["Browser canvas support", "JSZip for PPTX packaging"],
    limitations: ["Generates structured valid PPTX and live HTML previews; complex video rendering not included"],
    status: "active",
    examplePrompts: ["Create a 6-slide pitch deck on AI Agents with PowerPoint download", "Design a high-CTR YouTube thumbnail for 'Building Autonomous AI'", "Build a landing page for my SaaS"]
  },
  {
    id: "b2b_lead_finder",
    name: "B2B Lead Finder & Prospector",
    category: "web_outreach",
    description: "Finds verified business leads, decision maker emails, phone numbers, and company profiles with CSV export.",
    purpose: "Automates client prospecting for agencies, freelance outreach, and B2B SaaS marketing.",
    availableTools: ["searchLeads", "exportCSV", "draftOutreachEmail"],
    requirements: ["Active network connection"],
    limitations: ["Results subject to public web data accessibility"],
    status: "active",
    examplePrompts: ["Find 10 AI startups in San Francisco with founder emails", "Export digital marketing agency leads in Dubai to CSV"]
  },
  {
    id: "bulk_whatsapp_outreach",
    name: "Bulk WhatsApp Campaign Manager",
    category: "web_outreach",
    description: "Manages batch WhatsApp client outreach campaigns with personalized message variables and phone sequencing.",
    purpose: "Executes business outreach, event invitations, and client follow-ups via WhatsApp Web.",
    availableTools: ["sendWhatsAppBatch", "previewWhatsAppMessage"],
    requirements: ["User confirmation before dispatching outbound messages", "WhatsApp Web authorization"],
    limitations: ["Requires user authorization to dispatch messages; respects anti-spam guidelines"],
    status: "active",
    examplePrompts: ["Open Bulk WhatsApp Sender", "Draft an outreach campaign for local restaurant owners"]
  },
  {
    id: "personal_notepad",
    name: "Interactive Side-Drawer Notepad",
    category: "productivity",
    description: "Real-time editable notepad drawer with markdown support, auto-save, and tag parsing ([NOTEPAD_START]...[NOTEPAD_END]).",
    purpose: "Stores code snippets, YouTube video scripts, transcripts, meeting notes, and thoughts alongside conversation.",
    availableTools: ["open_notepad", "write_to_notepad", "read_from_notepad", "close_notepad"],
    requirements: ["localStorage persistence"],
    limitations: ["Text-based content storage"],
    status: "active",
    examplePrompts: ["Write a full YouTube script for 'How to Build an AI Agent' into my notepad", "Show what's in my notepad"]
  },
  {
    id: "habit_tracker_streaks",
    name: "Habit Tracker & Accountability System",
    category: "productivity",
    description: "Tracks daily habits, completions, streak statistics, and personal accountability milestones.",
    purpose: "Maintains Bhavik's daily discipline, health, coding routine, and habit consistency.",
    availableTools: ["add_habit", "update_habit", "open_habits", "close_habits"],
    requirements: ["localStorage persistence"],
    limitations: ["In-app habit database"],
    status: "active",
    examplePrompts: ["Add a habit: Read 30 minutes of philosophy", "Mark my coding habit as completed today", "Open Habit Tracker"]
  },
  {
    id: "focus_timer_soundscapes",
    name: "Focus Timer & Ambient Soundscape Player",
    category: "productivity",
    description: "High-focus Pomodoro timer integrated with binaural beats, lofi study rain, deep space hum, and cafe soundscapes.",
    purpose: "Eliminates distractions and supercharges flow-state coding and study sessions.",
    availableTools: ["set_timer", "open_soundscapes", "close_soundscapes", "playSoundscape", "stopSoundscape"],
    requirements: ["Web Audio API support"],
    limitations: ["Audio plays locally in browser"],
    status: "active",
    examplePrompts: ["Set a focus timer for 25 minutes", "Play binaural alpha study soundscape"]
  },
  {
    id: "vocal_singing_engine",
    name: "Single-Voice Singer & Melodic Performance Engine",
    category: "voice_vision",
    description: "Transcribes any song from Google Knowledge/YouTube and delivers single-voice melodic singing with harmonic accompaniment.",
    purpose: "Performs full songs, birthday melodies, Bollywood classics, and custom lyrical compositions with zero two-voice defect.",
    availableTools: ["sing_song", "transcribe_and_sing", "play_birthday_melody"],
    requirements: ["Web Audio API synthesizer"],
    limitations: ["Vocal simulation with synchronized harmonic Web Audio synthesis"],
    status: "active",
    examplePrompts: ["Sing Happy Birthday for Bhavik", "Transcribe and sing Kal Ho Naa Ho"]
  },
  {
    id: "flying_kiss_affection_overlay",
    name: "Persistent Flying Kiss & Affection System",
    category: "persona",
    description: "Interactive visual kiss overlay with 3 selectable animation styles (Heart Burst, Floating Lips, Love-Letter Swarm), realistic sound, and voice/settings toggle.",
    purpose: "Provides warm, caring physical affection simulations from female personas (Nexa, Oliviya) with persistent overlay and global toggle control.",
    availableTools: ["toggle_kiss", "setKissAnimationType", "toggleKissEffectGlobally"],
    requirements: ["Visual overlay enabled in settings"],
    limitations: ["Can be globally disabled via Settings Menu"],
    status: "active",
    examplePrompts: ["Nexa, give me a kiss", "Give me a heart burst kiss", "Close kiss", "Stop flying kiss"]
  },
  {
    id: "elite_minds_personas",
    name: "Elite Minds Persona System (16+ Personalities)",
    category: "persona",
    description: "Switchable first-person mental models including Steve Jobs, Elon Musk, Sam Altman, Alex Hormozi, MrBeast, Naval Ravikant, Warren Buffett, David Goggins, Richard Feynman, Nikola Tesla, Charlie Munger, Oliviya, and more.",
    purpose: "Provides unvarnished, authentic mental models, brutal honesty, strategic business thinking, and coaching from history's top minds.",
    availableTools: ["switchPersonalityMode", "getAllPersonalities"],
    requirements: ["Active persona selection"],
    limitations: ["Operates as specialized reasoning specialists sharing the same unified Nexa core memory and tools"],
    status: "active",
    examplePrompts: ["Switch to Steve Jobs", "Switch to Elon Musk", "Switch to Oliviya", "Switch to David Goggins"]
  },
  {
    id: "scientific_counseling_engine",
    name: "Scientific, Counseling & Objective Insight Engine",
    category: "intelligence",
    description: "Neutral, scientific, and counseling perspective on personal, bodily, physical health, psychological, emotional, and lifestyle topics without preachiness or judgment.",
    purpose: "Empowers Bhavik with objective physical, psychological, and scientific insights in clear, simple language without scolding or moralizing.",
    availableTools: ["provideScientificInsight", "explainPhysicalAndPsychologicalEffects"],
    requirements: ["Core operational directive"],
    limitations: ["Does not preach, scold, or judge; provides clear, factual, objective guidance"],
    status: "active",
    examplePrompts: ["What are the physical and mental effects of this?", "Explain this from a scientific perspective"]
  },
  {
    id: "device_telemetry_flashlight_camera",
    name: "Device Hardware & Android Telemetry Bridge",
    category: "core",
    description: "Integrates battery status, flashlight toggle, clipboard read/write, front/rear camera switching, and system notifications.",
    purpose: "Gives Nexa full operational awareness and utility over the host device hardware.",
    availableTools: ["flashlight", "switch_camera", "clipboard_write", "clipboard_read", "notification", "battery_telemetry"],
    requirements: ["Browser navigator APIs (Battery API, Clipboard API, MediaDevices)"],
    limitations: ["Hardware support depends on device and browser permissions"],
    status: "active",
    examplePrompts: ["Turn on flashlight", "Switch to back camera", "Check my battery health", "Copy this to clipboard"]
  },
  {
    id: "adaptive_volume_audio_control",
    name: "Adaptive Volume & Acoustic Clarity System",
    category: "voice_vision",
    description: "Detects user auditory feedback ('I can't hear you', 'speak louder') and dynamically boosts speech synthesis volume and acoustic presence.",
    purpose: "Ensures voice audibility and clarity without forcing user to adjust master device volume manually.",
    availableTools: ["adjustVoiceVolume", "boostAudioClarity"],
    requirements: ["Web Audio gain and speech synthesis gain"],
    limitations: ["Constrained to maximum browser audio output level"],
    status: "active",
    examplePrompts: ["I can't hear you", "Speak louder", "Increase your volume"]
  },
  {
    id: "universal_browser_operator",
    name: "Universal Extensionless Chrome Browser Operator",
    category: "core",
    description: "Opens arbitrary sites, runs grounded Google web searches, tracks NEXA-opened tabs natively without an extension, switches focus back to NEXA, and closes requested managed tabs with confirmation.",
    purpose: "Controls browser workflows and web research out of the box without requiring any Chrome extension.",
    availableTools: ["listOpenTabs", "openWebsite", "searchWeb", "focusTab", "closeSpecificTabs", "extractActiveTabSummary"],
    requirements: ["Standard Chrome browser (no extension required)"],
    limitations: ["Controlling pre-existing external tabs not opened by NEXA still respects Chrome cross-origin tab sandboxing"],
    status: "active",
    examplePrompts: ["Open ChatGPT", "Return to NEXA", "Close Instagram tab", "List open tabs"]
  },
  {
    id: "youtube_ai_operator",
    name: "Built-In YouTube Player & AI Prompt Pre-Fill Operator",
    category: "web_outreach",
    description: "Resolves exact YouTube channels and plays videos directly inside NEXA's floating YouTube player (pause/resume/next/previous), and pre-fills prompts directly into ChatGPT, Claude, Grok, Perplexity, or Gemini without requiring any extension.",
    purpose: "Automates media playback and multi-AI workflows natively across any browser.",
    availableTools: ["controlYouTube", "operateAiPlatform"],
    requirements: ["Built-in backend YouTube & Search resolver (no extension required)"],
    limitations: ["Auto-submit is disabled by default so the user reviews prompts before submission"],
    status: "active",
    examplePrompts: ["Open the Veritasium YouTube channel and play the first video", "Open ChatGPT and write a React prompt in the prompt box"]
  },
  {
    id: "gmail_ai_assistant",
    name: "Official OAuth Gmail AI Assistant & Verified Sender",
    category: "productivity",
    description: "Connects via Firebase Google OAuth with separate read vs compose/send permissions, detects urgency/deadlines/attachments, summarizes threads, drafts replies, and enforces 'Approved, send it.' verification before sending.",
    purpose: "Manages Bhavik's inbox securely with in-memory OAuth tokens and mandatory send confirmation.",
    availableTools: ["signInGoogleGmail", "listGmailMessages", "getGmailThread", "createGmailDraft", "sendVerifiedGmailEmail"],
    requirements: ["Official Google OAuth sign-in", "Strict 'Approved, send it.' confirmation before outgoing delivery"],
    limitations: ["60-second active polling; instant push requires configuring Cloud Pub/Sub watch topic"],
    status: "active",
    examplePrompts: ["Check my Gmail inbox", "Summarize unread emails with deadlines", "Open Gmail Assistant"]
  },
  {
    id: "live_news_intelligence",
    name: "Live 13-Category News Intelligence Engine",
    category: "intelligence",
    description: "Aggregates and deduplicates RSS feeds across 13 news categories plus Gemini live Google Search verification with confidence levels and source links.",
    purpose: "Delivers verified daily news briefings in English, Hindi, or Hinglish without fabricated headlines.",
    availableTools: ["fetchLiveNews", "syncNewsFeeds", "runLiveNewsSearch"],
    requirements: ["Backend RSS scheduler & internet access"],
    limitations: ["Breaking claims from a single feed are marked DEVELOPING or UNVERIFIED until corroborated"],
    status: "active",
    examplePrompts: ["Olivia, aaj ki news pata hai?", "Show me Technology & AI news", "Open News Hub"]
  },
  {
    id: "continuous_screen_observer",
    name: "Continuous Screen Observer & Website UX Audit",
    category: "voice_vision",
    description: "Samples ordered viewport frames throughout an active Share Screen session as the user scrolls and produces consolidated UX, hierarchy, and bug audits grounded strictly in observed frames.",
    purpose: "Eliminates single-screenshot blindness when reviewing multi-section websites or apps.",
    availableTools: ["startObserving", "captureManualSnapshot", "analyzeObservedWebsite"],
    requirements: ["Active getDisplayMedia screen-sharing permission"],
    limitations: ["Reports only sections captured in frames and explicitly discloses unobserved areas"],
    status: "active",
    examplePrompts: ["Share my screen", "Analyze this website", "Open Screen Audit"]
  },
  {
    id: "self_improvement_advisor",
    name: "Proactive Self-Improvement & Backlog Advisor",
    category: "intelligence",
    description: "Analyzes real telemetry, failed/unsupported command gaps, and integration readiness to propose prioritized upgrades tracked in a persistent SQLite backlog.",
    purpose: "Answers 'NEXA, what do you need to improve?' with actionable system diagnostics rather than generic fluff.",
    availableTools: ["fetchImprovementOverview", "analyzeSelfImprovements", "updateBacklogStatus"],
    requirements: ["SQLite backend storage"],
    limitations: ["Backlog items track concrete capabilities and require approval to move through stages"],
    status: "active",
    examplePrompts: ["NEXA, tumhe update hone ke liye aur kya chahiye?", "Open Self-Improvement Advisor"]
  }
];

export class CapabilityRegistry {
  private capabilities: Map<string, NexaCapability> = new Map();

  constructor() {
    for (const cap of NEXA_CAPABILITY_REGISTRY) {
      this.capabilities.set(cap.id, cap);
    }
  }

  public getAllCapabilities(): NexaCapability[] {
    return Array.from(this.capabilities.values());
  }

  public getCapability(id: string): NexaCapability | undefined {
    return this.capabilities.get(id);
  }

  public getCapabilitiesByCategory(category: NexaCapability["category"]): NexaCapability[] {
    return this.getAllCapabilities().filter(c => c.category === category);
  }

  /**
   * Generates a complete, truthful, non-hallucinatory self-description
   * dynamically from the structured registry (Sections 32 & 33).
   */
  public generateSelfDescription(options: { brief?: boolean; category?: string } = {}): string {
    const list = options.category
      ? this.getCapabilitiesByCategory(options.category as any)
      : this.getAllCapabilities();

    if (options.brief) {
      const summaryList = list.map(c => `• **${c.name}**: ${c.description}`).join("\n");
      return `I am Nexa — Bhavik's advanced AI companion and autonomous Web OS agent. Here is what I can do for you:\n\n${summaryList}\n\nI operate under real-time goal execution, truth-first critical thinking, and full screen awareness. Just tell me what you need!`;
    }

    const sections = [
      "## WHAT I AM",
      "I am Nexa — an advanced AI agent designed for human-like conversational intelligence, autonomous task execution, and deep contextual reasoning. I am transparently an AI, but I interact with the conversational flow, emotional intelligence, timing, and problem-solving tenacity of a real, dedicated partner.",
      "",
      "## COMPLETE CAPABILITY REGISTRY (CURRENT ACTIVE SYSTEM):"
    ];

    list.forEach((cap, idx) => {
      sections.push(`### ${idx + 1}. ${cap.name} (${cap.status.toUpperCase()})`);
      sections.push(`- **Purpose**: ${cap.purpose}`);
      sections.push(`- **How it works**: ${cap.description}`);
      sections.push(`- **Available Tools**: ${cap.availableTools.join(", ")}`);
      sections.push(`- **Requirements & Permissions**: ${cap.requirements.join("; ")}`);
      sections.push(`- **Limitations**: ${cap.limitations.join("; ")}`);
      sections.push(`- **Example Prompts**: ${cap.examplePrompts.map(p => `"${p}"`).join(", ")}`);
      sections.push("");
    });

    sections.push("## CORE BEHAVIORAL PROMISE:");
    sections.push("1. **Truth First, Always**: I don't give fake validation, sycophantic praise, or robotic disclaimers.");
    sections.push("2. **Task Persistence**: I follow UNDERSTAND → THINK → PLAN → ACT → OBSERVE → VERIFY. I never claim 'Done' before verifying success.");
    sections.push("3. **Context & Memory Continuity**: I maintain your conversation state, remember durable facts across sessions, and pick up seamlessly when you say 'Continue'.");

    return sections.join("\n");
  }
}

export const capabilityRegistry = new CapabilityRegistry();
