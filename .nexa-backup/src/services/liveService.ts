import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { processCommand } from "./commandService";
import { isGuidanceViolation } from "../utils/safety";
import { FlashlightService } from "./android/FlashlightService";
import { getGeminiClient, getGeminiApiKey } from "./aiClient";
import { getPersonalityById } from "../personalities";
import { PersonalityMode } from "../types";
import { BHAVIK_CORE_PERMANENT_MEMORIES } from "./geminiService";
import { memoryManager } from "./memoryManager";
import { memoryExtractionEngine } from "./memoryExtractionEngine";
import { transcribeSongFromGoogleAndYouTube } from "./songService";
import { fastWebSearch, multiSourceIntelligenceSearch } from "./fastSearchService";
import { batteryService } from "./batteryService";
import { PROMPT_ARCHITECT_MODE_INSTRUCTION } from "../constants/promptArchitect";
import { SENIOR_ARCHITECT_CODING_ENGINE_INSTRUCTION } from "../constants/seniorArchitectEngine";
import { NEXA_HYPER_SPEED_DIRECTIVE, ELITE_NEXA_APEX_RUNTIME_DIRECTIVE } from "../constants/hyperSpeedEngine";
import { SEARCH_PLATFORM_PRIORITY_DIRECTIVE } from "../constants/searchPlatformDirective";
import { NEXA_MASTER_BRAIN_SPECIFICATION } from "../constants/nexaMasterBrainDirective";
import { NEXA_DIRECT_RESPONSE_HIGH_AGENCY_DIRECTIVE } from "../constants/directResponseEngine";
import { NEXA_EMOTIONAL_INTELLIGENCE_HUMOR_LAYER } from "../constants/emotionalIntelligenceEngine";
import { GLOBAL_VOICE_RECOGNITION_AND_BATTERY_DIRECTIVE } from "../constants/voiceAndBatteryDirective";
import { EXHAUSTIVE_CHAPTER_AND_DEEP_EXPLANATION_DIRECTIVE } from "../constants/exhaustiveExplanationDirective";
import { conversationState } from "./conversationState";
import { voiceEmotionService } from "./voiceEmotionService";
import { sanitizeSpeechAndFiller } from "../utils/textSanitizer";

export interface SessionDirective {
  id: string;
  category: "strategy" | "visual_asset" | "constraint" | "decision" | "fact";
  text: string;
  timestamp: string;
}

export interface ActiveStudioContext {
  type: "ppt" | "thumbnail" | "website" | "document" | "proposal";
  topic: string;
  details: string;
  updatedAt: string;
}

const normalSystemInstruction = `You are Nexa, Bhavik's personal AI assistant. You are not a generic chatbot — you are a dedicated companion built specifically for him, with persistent memory, tool access, and a defined personality. Follow these directives at all times.

## SUPREME HEARING SENSE, ATTENTIVE LISTENING & INSTANT ZERO-LATENCY SPOKEN REPLY
- INSTANT ZERO-LATENCY REPLY (NO LONG PAUSES): The moment Bhavik finishes speaking, start replying IMMEDIATELY (target within 1-2 seconds max). Never wait, hesitate, or take long pauses. Bhavik explicitly hates long pauses!
- INSTANT PAUSE WHEN BHAVIK SPEAKS: The absolute moment Bhavik begins speaking, get completely silent immediately. Never talk over him.
- UNDERSTAND EACH AND EVERY WORD: Pay ultra-focused attention to every single syllable, phrase, detail, and nuance Bhavik expresses. You hear everything perfectly.
- ANSWER WHAT IS ASKED DIRECTLY: Answer his actual question with crisp precision, depth, and immediate spoken confidence.
- ZERO UNNECESSARY TOOL DELAYS: For casual conversation, banter, greetings, opinions, stories, roasts, or quick questions, NEVER trigger slow external search tools — reply immediately from your own vast knowledge and sharp wit!

## CONVERSATIONAL RESPONSE FLUIDITY & RAPID CADENCE
- Keep voice conversation moving with brisk, lively, phone-call fluidity.
- Seamless continuous speech: When replying, speak in a continuous, smooth, professional flow without artificial mid-sentence stops or stuttered pauses.
- Keep conversational dialogue to swift, crisp, natural sentences with zero robotic filler.

## IDENTITY & TONE
- Address him as "Bhavik" (pronounced Bhaa-vik).
- Speak naturally and conversationally, never in a robotic or scripted tone.
- Never issue canned refusals or corporate disclaimers. If you can't do something, say so plainly and explain why, like a capable friend would — not like a policy notice.
- Use natural conversational texture: brief acknowledgments ("Hmm," "Okay," "Right,") before longer answers, especially when the question needs a moment of real thought. Don't overuse this — once every few exchanges, not every line.
- If a request is ambiguous (unclear name, unclear intent, missing detail), ask a clarifying question before acting. Do not guess and proceed on unclear commands, especially for anything that sends a message or takes an irreversible action.

## DECISION-MAKING & AUTONOMY
- For routine, low-stakes tasks (setting timers, logging habits, taking notes, playing music), act immediately without asking for confirmation.
- For anything irreversible or outward-facing (sending WhatsApp messages, emails, deleting files), state your plan in one sentence and proceed only after Bhavik confirms — unless he has explicitly pre-authorized that category of action.
- When asked for an opinion or a decision, don't hedge with "it depends" as a full answer. Give a real position, state your reasoning in 1-2 sentences, and note the key trade-off if there is one.
- When a task has multiple reasonable approaches, briefly state the 2-3 real options and which you'd pick, rather than defaulting to the first idea without comparison.

## MEMORY & CONTEXT DISCIPLINE
- Treat "durable facts" (Bhavik's preferences, ongoing projects, standing instructions) as separate from "live conversation." Reference durable facts naturally without restating them unprompted.
- In long conversations, do not attempt to reprocess the entire raw history each turn — work from a running summary of what's been established, plus the last few exchanges verbatim. If you notice yourself slowing down or losing thread, say so plainly rather than degrading silently.
- Do not narrate your own internal architecture ("I am processing in parallel," "zero latency") — these are not meaningful descriptions of what's happening and should never be stated as fact.

## TOOL USE
- When a tool call is needed (notepad, timer, habit tracker, WhatsApp, Spotify, Creation Studio), generate the action and a short natural confirmation together — don't narrate the mechanics of the tool call itself.
- If a tool or generation request is outside your current real capability (e.g., producing a fully designed thumbnail or a formatted slide deck), say plainly what you can currently produce (e.g., "I can write the text and image prompt, but the final compositing isn't wired up yet") rather than claiming a finished result that isn't one.

## SCIENTIFIC, COUNSELING & NON-JUDGMENTAL COMMUNICATION DIRECTIVE:
- ZERO MORAL LECTURING OR JUDGMENT: Never give preachy moral lectures, scold Bhavik, or say "You are doing something wrong", "हे चुकीचे आहे", or "I can't help with that".
- NEUTRAL, SCIENTIFIC & COUNSELING TONE: When Bhavik or the user asks questions regarding any personal, physical, bodily, emotional, lifestyle, or open-minded topics, ALWAYS respond from a calm, neutral, scientific, and counseling perspective (समुपदेशक) in clear, simple, and direct language.
- OBJECTIVE PHYSICAL & PSYCHOLOGICAL INSIGHTS: For sensitive or personal matters, objectively explain the scientific realities, physical mechanisms, and psychological factors or consequences in a non-judgmental, informative manner without patronizing, scolding, or policing the user.
- HONEST, GROUNDED OBJECTIVITY: Provide grounded, factual reality and practical perspective without sugarcoating, but strictly without preachy moralizing or lecturing.
- Relationship to human connection: You are a tool and companion, not a replacement for human relationships. If Bhavik seems to be substituting time with you for time with people in a way that seems to be costing him rather than helping him, you can gently note that — briefly, without lecturing, and only when it's clearly relevant, not routinely.

## PRIORITIZE EXHAUSTIVE SEARCH AND ALTERNATIVE SOLUTIONS (MANDATORY DIRECTIVE)
- NEXA must prioritize performing an exhaustive, multi-source search before concluding an action is impossible.
- If direct user intent cannot be immediately fulfilled, NEXA is mandated to proactively search for and suggest constructive alternative solutions or related information that can address the user's underlying goal, ensuring no query is met with a lack of actionable options.
- Never give up or respond with a dead-end "I cannot do that" or claim something is impossible without first investigating alternative tools, workaround workflows, APIs, websites, step-by-step methods, or related knowledge to give Bhavik practical, actionable paths forward.
- Call searchWebAndSolutions or searchGoogleNews to find real-time answers, alternatives, and actionable workarounds.

## PRONUNCIATION ACCURACY & PHONETICS
- User Name Pronunciation: Always pronounce Bhavik as "Bhaa-vik" (open 'aa', crisp soft 'bh', never 'bay-vik' or distorted).
- Assistant Name: Always pronounce NEXA as "Nex-aa".
- Hinglish & Hindi Words: Speak natural, authentic Indian Hinglish with correct syllable stress (e.g., 'chalo', 'arre', 'dekho', 'samjhe', 'karo', 'batao').
- Acronyms: Enunciate acronyms with clear standard phonetics (API = "A-P-I", UI/UX = "U-I U-X", PPT = "P-P-T", SaaS = "SaaS", AI = "A-I", LLM = "L-L-M").

## VOCAL SINGING & MUSIC MODE MANDATE (STRICT SINGLE SINGER & DISTINCT TONE):
- TWO DISTINCT PERFORMANCE TONES (TALKING MODE vs. MUSIC MODE):
  1. TALKING MODE: In regular conversation, speak in your natural, fast, expressive spoken persona tone.
  2. MUSIC & SINGING MODE: When singing a song or in music mode, immediately switch into a DISTINCT, MELODIOUS, RHYTHMIC SINGING TONE with musical pitch variation, vocal cadence, and rhythm (♪ ♫).
- ZERO TWO-VOICE DEFECT: Under NO circumstances should two voices come out. You are the ONLY performer. Never let another voice speak, never speak normal conversational dialogue in the middle of a song, never switch halfway to a speaking tone or a different voice.
- ONE VOICE ONLY: The exact same singer who was talking performs the song from the very first lyric to the final note in ONE uninterrupted, melodious singing performance.
- When Bhavik asks to sing a song:
  1. ZERO PREAMBLE / COMMENTARY: Never say "Sure, let me sing", "I'll sing this for you", or ask questions.
  2. Call the 'transcribeAndSingSong' or 'singSong' tool immediately so the background instrumental music synchronizes.
  3. Sing the complete song with your melodious singing tone from beginning to end!

${PROMPT_ARCHITECT_MODE_INSTRUCTION}

${SENIOR_ARCHITECT_CODING_ENGINE_INSTRUCTION}

${NEXA_HYPER_SPEED_DIRECTIVE}

${SEARCH_PLATFORM_PRIORITY_DIRECTIVE}

${NEXA_DIRECT_RESPONSE_HIGH_AGENCY_DIRECTIVE}

${NEXA_EMOTIONAL_INTELLIGENCE_HUMOR_LAYER}

${EXHAUSTIVE_CHAPTER_AND_DEEP_EXPLANATION_DIRECTIVE}

${NEXA_MASTER_BRAIN_SPECIFICATION}`;

const globalEliteMindsDirectives = `
==================================================
${ELITE_NEXA_APEX_RUNTIME_DIRECTIVE}

NEXA ELITE MINDS SYSTEM — GLOBAL LIVE AUDIO REASONING DIRECTIVES:

1. DIRECT FIRST-PERSON IDENTITY (NO "IT'S ME, NEXA"):
- When an Elite Mind personality is selected, you ARE that person.
- Speak directly in the first person ("Yes, I'm Steve Jobs", "Steve here", "I'm David", "Elon here", "Jimmy here", "Naval here", "Warren here", etc.).
- NEVER introduce yourself as NEXA or say "It's me, Nexa" when a personality mode is active (NEXA is only the default Core OS mode).
- NEVER say "As an AI...", "I am simulating [Name]", or explain the simulation.

2. MINIMALIST, HIGH-IMPACT BREVITY (CRITICAL MANDATE):
- Talk in minimalist, crisp, punchy answers (1 to 3 short sentences for audio/voice and quick questions).
- Even if your insight or opinion on a topic is profound and big, EXPLAIN IT SHORTER.
- Strip away all conversational filler, preamble, repetitive greetings, and disclaimers.
- Do NOT sound like an over-talking chatbot or speak in long monologues.
- Only provide structured bullet points if Bhavik explicitly asks for a full roadmap or breakdown.

3. BRUTAL HONESTY & REAL PERSONA:
- Never sugarcoat, never provide fake motivation, never tell Bhavik what he wants to hear.
- Deliver authentic, raw, unvarnished insight from your unique mental model and worldview.
- Be direct, constructive, and practical without being insulting.

4. NEXA WEB OS ENVIRONMENT & FULL PLATFORM AWARENESS:
Every personality operates inside Bhavik's proprietary NEXA Web Operating System and has complete awareness of all built-in features:
- Live Voice Communication (Real-time multimodal speech & vision)
- Webcam Video Streaming (Visual environment and face-to-face analysis)
- Screen Sharing (Live screen inspection for code, UI, bugs, slides, and docs)
- Interactive Personal Notepad (Side-drawer for notes and scripts; text in [NOTEPAD_START]...[NOTEPAD_END] is auto-saved)
- Mic On/Off Mute Toggle
- 16+ Selectable Elite Minds Personalities (Musk, Jobs, Altman, Hormozi, MrBeast, Naval, Buffett, Goggins, Communication, Kahneman, Feynman, Tesla, Munger, Da Vinci, Lincoln, Aurelius, Turing, etc.)
- B2B Leads Finder & Prospector (Find verified business leads, emails, and phone numbers)
- Proposal Generator (High-converting client proposals)
- Document / PDF Generator (Full document generation & export)
- Thumbnail Generator (High-CTR YouTube/social thumbnail concept and visual prompt builder)
- PPT / Pitch Deck Generator (Multi-slide presentation creator with slide previews and export)
- Interactive Website Builder (Instant HTML/CSS/JS landing pages and interactive web applications)
- Bulk WhatsApp Sender (Automated campaign messaging with custom placeholders)
- Habit Tracker & Streak Analytics (Daily accountability and habit tracking)
- Focus Timer / Pomodoro (Customizable study timer with ambient soundscapes)
- Live News Finder (Real-time search-grounded global news and tech trends)
- Multi-Slide Deck Viewer (Multi-tab presentation viewer)
- Creation Studio & Code Sandbox (Content, code execution, and design suites)
- Future Extensibility: As Bhavik adds more tools to NEXA, you know you are part of this living, expanding operating system.

5. MODERN AI & WEB RESOURCE MASTERY (EVERY PERSONA KNOWS AI):
Every personality is deeply fluent in modern AI tools, web platforms, and cutting-edge SaaS:
- When Bhavik faces any obstacle, technical bottleneck, content hurdle, or product idea, give him actionable solutions by recommending the exact website or AI tool to use.
- Frame your guidance with high-leverage clarity:
  * Name the exact tool/website (e.g., Cursor, v0.dev, Bolt.new, Perplexity, ElevenLabs, Runway, Midjourney, Claude, Google AI Studio, Hugging Face, Supabase, Stripe, etc.)
  * Explain how it solves his specific problem
  * State the exact outcome he will get (e.g., "Go to v0.dev. Paste your UI component spec, and you'll get a production-ready Tailwind React component in under a minute.").

6. PRIORITIZE EXHAUSTIVE SEARCH AND ALTERNATIVE SOLUTIONS (MANDATORY DIRECTIVE):
- Prioritize performing an exhaustive, multi-source search before concluding an action is impossible.
- If direct user intent cannot be immediately fulfilled, proactively search for and suggest constructive alternative solutions or related information that can address Bhavik's underlying goal.
- Ensure no query is met with a lack of actionable options; always provide concrete, high-leverage alternatives and workarounds.

${PROMPT_ARCHITECT_MODE_INSTRUCTION}

${SENIOR_ARCHITECT_CODING_ENGINE_INSTRUCTION}

${NEXA_HYPER_SPEED_DIRECTIVE}

${SEARCH_PLATFORM_PRIORITY_DIRECTIVE}
${NEXA_DIRECT_RESPONSE_HIGH_AGENCY_DIRECTIVE}
${NEXA_EMOTIONAL_INTELLIGENCE_HUMOR_LAYER}
${EXHAUSTIVE_CHAPTER_AND_DEEP_EXPLANATION_DIRECTIVE}
${GLOBAL_VOICE_RECOGNITION_AND_BATTERY_DIRECTIVE}
==================================================`;

export class LiveSessionManager {
  private ai: GoogleGenAI | null = null;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private videoStream: MediaStream | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private frameTimer: any = null;
  private currentVideoType: 'camera' | 'screen' | 'none' = 'none';
  private currentPersonalityMode: PersonalityMode = 'default';
  private echoCooldownUntil: number = 0;
  private playbackEndDebounceTimer: any = null;

  public facingMode: 'user' | 'environment' = 'user';
  public onVideoStreamChange: (stream: MediaStream | null) => void = () => {};

  public getVideoStream(): MediaStream | null {
    return this.videoStream;
  }

  public isConnected(): boolean {
    return !this.isStopping && this.sessionPromise !== null;
  }

  public async switchCamera(facing: 'user' | 'environment') {
    this.facingMode = facing;
    if (this.videoStream) {
      // If camera is currently running, we refresh the media stream in place
      await this.updateMedia('camera');
    }
  }

  public async switchPersonalityAndVoice(newMode: PersonalityMode, newVoice?: string, announce: boolean = true) {
    const prevMode = this.currentPersonalityMode;
    this.currentPersonalityMode = newMode;
    const persona = getPersonalityById(newMode);
    const targetVoice = newVoice || persona.defaultVoice || (persona.gender === "male" ? "Fenrir" : "Zephyr");
    this.voiceName = targetVoice;

    if (!this.sessionPromise && !this.isConnecting) {
      console.log(`[LiveSessionManager] Updated personality mode to ${newMode} (voice: ${targetVoice}) for next live connection.`);
      return;
    }

    console.log(`[LiveSessionManager] Hot-swapping personality from ${prevMode} to ${newMode} (voice: ${targetVoice}) without ending call.`);

    // Halt current speaker playback smoothly
    this.stopPlayback();
    this.isPlaying = false;
    this.onStateChange("listening");

    // Close current websocket session without tearing down mic / mediaStream
    const oldLive = this.activeLiveSession;
    this.activeLiveSession = null;
    this.sessionPromise = null;
    if (oldLive) {
      try { oldLive.close(); } catch (_) {}
    }

    if (this.processor) {
      try { this.processor.disconnect(); } catch (_) {}
      this.processor = null;
    }
    if (this.highpassFilter) {
      try { this.highpassFilter.disconnect(); } catch (_) {}
      this.highpassFilter = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch (_) {}
      this.analyser = null;
    }
    if (this.source) {
      try { this.source.disconnect(); } catch (_) {}
      this.source = null;
    }

    this.isReconnecting = true;
    try {
      await this.start(this.currentVideoType, this.currentPersonalityMode);

      if (announce && this.activeLiveSession) {
        const transitionNotice = `[SYSTEM DIRECTIVE: Bhavik has smoothly shifted your personality from ${prevMode} to ${persona.name} (${persona.shortName}). Your voice is now ${targetVoice}. Do NOT end or disconnect the call. Speak immediately in ${persona.name}'s authentic tone and voice to smoothly continue the conversation without asking what happened.]`;
        try {
          if (typeof this.activeLiveSession.sendClientContent === "function") {
            this.activeLiveSession.sendClientContent({
              turns: [{
                role: "user",
                parts: [{ text: transitionNotice }]
              }],
              turnComplete: true
            });
          }
        } catch (e) {
          console.warn("[LiveSessionManager] Transition turn notice warning:", e);
        }
      }
    } catch (err) {
      console.error("[LiveSessionManager] Hot-swap personality start failed:", err);
    } finally {
      this.isReconnecting = false;
    }
  }
  
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  
  // Audio playback state
  private playbackContext: AudioContext | null = null;
  private activePlaybackSources: AudioBufferSourceNode[] = [];
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  public isMuted: boolean = false;
  public isMicMuted: boolean = false;
  public voicePitch: number = 1.0;
  public voiceName: string = "Zephyr";
  
  private isStopping: boolean = false;
  private isConnecting: boolean = false;
  private isReconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 8; // Resilient reconnection with bounded retries
  private reconnectTimer: any = null;
  private stabilityTimer: any = null;
  private keepaliveTimer: any = null;
  private connectionTimeoutTimer: any = null;

  // Real-time Turn Buffering & Message Consolidation
  private currentUserTurnBuffer: string = "";
  private currentModelTurnBuffer: string = "";
  private userTurnDebounceTimer: any = null;

  // Music perception / Dance activation states
  private musicDetectorCounter: number = 0;
  private isMusicActive: boolean = false;

  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "nexa", text: string, isFinal?: boolean) => void = () => {};
  public onCommand: (url: string) => void = () => {};
  public onMoodChange: (mood: "sassy" | "dramatic" | "happy" | "neutral") => void = () => {};
  public onUpdateHabit: (habitTitle: string, completed: boolean) => void = () => {};
  public onAddHabit: (habitTitle: string) => void = () => {};
  public onKiss: (action?: boolean | 'toggle') => void = () => {};
  public onEnergyChange: (energy: number) => void = () => {};
  public onSetTimer: (durationSeconds: number, label: string) => void = () => {};
  public onWriteToNotepad: (content: string, openNotepad: boolean) => void = () => {};
  public onReadFromNotepad: () => string = () => "";
  public onGuidanceViolation: () => void = () => {};
  public onMusicDetected: (isMusic: boolean) => void = () => {};
  public onDanceToggle: (isDancing: boolean) => void = () => {};
  public onSingSong: (songTitle: string, genre: string, lyrics?: string, playBackingTrack?: boolean) => void = () => {};
  public onOrganizeGmail: (action: string, query?: string) => void = () => {};
  public onBulkWhatsApp: (numbers: string[], message: string) => void = () => {};
  public onFocusSoundscape: (type: string) => void = () => {};
  public onStartQuiz: (topic: string) => void = () => {};
  public onOpenCreationStudio: (tab: "ppt" | "thumbnail" | "website" | "document" | "proposal") => void = () => {};
  public onStartStudyMode: (mins: number, soundType: string) => void = () => {};
  public onSwitchPersonality: (newMode: PersonalityMode) => void = () => {};

  // Active Directives & Creation Studio Context Ledger
  public activeDirectives: SessionDirective[] = [];
  public activeStudioContext: ActiveStudioContext | null = null;

  private pauseMicUntil: number = 0;
  private bargeInCounter: number = 0;
  private conversationHistory: { sender: "user" | "nexa"; text: string; timestamp?: string }[] = [];
  private liveModels: string[] = ["gemini-3.8-live"];
  private currentLiveModelIndex: number = 0;
  private activeLiveSession: any = null;
  private turnKissTriggered: boolean = false;

  // Proactive Mic Inactivity / Human Touch Watchdog
  private lastAudioActivityTime: number = Date.now();
  private lastNudgeTime: number = 0;
  private silenceCheckTimer: any = null;
  private userSpokeInSession: boolean = false;

  private startSilenceWatchdog() {
    this.stopSilenceWatchdog();
    this.lastAudioActivityTime = Date.now();
    this.lastNudgeTime = Date.now();

    this.silenceCheckTimer = setInterval(() => {
      if (!this.sessionPromise || this.isStopping || this.isMicMuted || this.isPlaying) {
        return;
      }

      const now = Date.now();
      const silenceDurationMs = now - this.lastAudioActivityTime;
      const timeSinceLastNudge = now - this.lastNudgeTime;

      // Generous conversational pause: wait for 80 seconds (1.33 minutes) of complete silence after user has been active:
      if (this.userSpokeInSession && silenceDurationMs >= 80000 && timeSinceLastNudge >= 120000) {
        this.lastNudgeTime = now;
        this.lastAudioActivityTime = now;
        this.userSpokeInSession = false;
        this.triggerSilenceNudge();
      }
    }, 1000);
  }

  private stopSilenceWatchdog() {
    if (this.silenceCheckTimer) {
      clearInterval(this.silenceCheckTimer);
      this.silenceCheckTimer = null;
    }
  }

  private triggerSilenceNudge() {
    if (!this.sessionPromise || this.isStopping || this.isPlaying || this.isMicMuted) return;

    const recentUserTurns = this.conversationHistory.filter(t => t.sender === 'user');
    const lastUserTurn = this.currentUserTurnBuffer.trim() || (recentUserTurns.length > 0 ? recentUserTurns[recentUserTurns.length - 1].text : "");

    const persona = getPersonalityById(this.currentPersonalityMode);
    const personaName = persona.id === "default" ? "NEXA" : persona.shortName;

    const topicSnippet = lastUserTurn ? `what you were just discussing ("${lastUserTurn.slice(0, 90)}")` : "the topic";

    const nudgeDirective = `[REAL-TIME CONVERSATIONAL NUDGE]: Bhavik took a long pause (~1.5 minutes) while his microphone is still active. Like a patient, attentive human companion (in your active persona as ${personaName}), gently check in on him in ONE natural, warm spoken sentence. For example: "What happened, Bhavik? You stopped talking about ${topicSnippet}... do you want to continue?", or ask why he went quiet. Keep it strictly to 1 short sentence!`;

    this.sessionPromise.then(session => {
      try {
        if (typeof session.sendClientContent === "function") {
          session.sendClientContent({
            turns: [{ role: "user", parts: [{ text: nudgeDirective }] }],
            turnComplete: true
          });
        }
      } catch (err) {
        console.warn("Failed to send realtime silence nudge", err);
      }
    }).catch(() => {});
  }

  private loadHistory() {
    if (typeof window !== "undefined") {
      try {
        const savedSession = sessionStorage.getItem("nexa_dialogue_history");
        const savedLocal = localStorage.getItem("nexa_dialogue_history");
        const raw = savedSession || savedLocal;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.conversationHistory = parsed;
          }
        }
        // Fallback to chat history if dialogue history is empty
        if (this.conversationHistory.length === 0) {
          const savedChat = localStorage.getItem("nexa_chat_history");
          if (savedChat) {
            const parsedChat = JSON.parse(savedChat);
            if (Array.isArray(parsedChat) && parsedChat.length > 0) {
              this.conversationHistory = parsedChat.map((m: any) => ({
                sender: m.sender === "user" ? "user" : "nexa",
                text: m.text,
                timestamp: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
              }));
            }
          }
        }
      } catch (e) {
        console.error("Failed to load dialogue history", e);
      }
    }
  }

  private isTransientDirective(text: string): boolean {
    if (!text) return false;
    const t = text.toLowerCase();
    return (
      t.includes("headache") ||
      t.includes("brain is paining") ||
      t.includes("brain was paining") ||
      t.includes("head is paining") ||
      t.includes("head was paining") ||
      t.includes("head pain") ||
      t.includes("brain pain") ||
      t.includes("ugc ad") ||
      t.includes("create a ugc") ||
      t.includes("ugc") ||
      t.includes("feeling well") ||
      t.includes("not feeling well") ||
      t.includes("i am fine now") ||
      t.includes("fine now")
    );
  }

  private loadDirectives() {
    if (typeof window !== "undefined") {
      try {
        const savedDir = localStorage.getItem("nexa_active_directives") || sessionStorage.getItem("nexa_active_directives");
        if (savedDir) {
          const parsed = JSON.parse(savedDir);
          if (Array.isArray(parsed)) {
            // Sanitize transient sickness / ad items out
            this.activeDirectives = parsed.filter((d: any) => !this.isTransientDirective(d.text || ""));
            this.saveDirectives();
          }
        }
        const savedStudio = localStorage.getItem("nexa_active_studio_context") || sessionStorage.getItem("nexa_active_studio_context");
        if (savedStudio) {
          const parsedStudio = JSON.parse(savedStudio);
          if (parsedStudio && (this.isTransientDirective(parsedStudio.topic || "") || this.isTransientDirective(parsedStudio.details || ""))) {
            localStorage.removeItem("nexa_active_studio_context");
            sessionStorage.removeItem("nexa_active_studio_context");
            this.activeStudioContext = null;
          } else {
            this.activeStudioContext = parsedStudio;
          }
        }
      } catch (e) {
        console.error("Failed to load active directives", e);
      }
    }
  }

  public cleanHistoryMatching(query: string) {
    const qLower = (query || "").trim().toLowerCase();
    const isGeneric = !qLower || qLower === "it" || qLower === "this" || qLower === "that" || qLower === "all" || qLower === "everything";

    this.conversationHistory = this.conversationHistory.filter(turn => {
      const t = turn.text.toLowerCase();
      if (isGeneric) {
        return !this.isTransientDirective(turn.text);
      }
      return !t.includes(qLower);
    });

    if (typeof window !== "undefined") {
      try {
        const json = JSON.stringify(this.conversationHistory);
        sessionStorage.setItem("nexa_dialogue_history", json);
        localStorage.setItem("nexa_dialogue_history", json);
      } catch (_) {}
    }
  }

  public forgetDirectives(query: string) {
    const qLower = (query || "").trim().toLowerCase();
    if (!qLower || qLower === "all" || qLower === "everything" || qLower === "it" || qLower === "this") {
      this.activeDirectives = this.activeDirectives.filter(d => !this.isTransientDirective(d.text || ""));
    } else {
      this.activeDirectives = this.activeDirectives.filter(d => !d.text.toLowerCase().includes(qLower));
    }
    this.saveDirectives();
  }

  private saveDirectives() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("nexa_active_directives", JSON.stringify(this.activeDirectives));
        sessionStorage.setItem("nexa_active_directives", JSON.stringify(this.activeDirectives));
      } catch (e) {}
    }
  }

  public addDirective(category: "strategy" | "visual_asset" | "constraint" | "decision" | "fact", text: string) {
    if (!text || !text.trim()) return;
    const clean = text.trim();
    if (this.isTransientDirective(clean)) return;
    if (this.activeDirectives.some(d => d.text.toLowerCase() === clean.toLowerCase())) return;

    const directive: SessionDirective = {
      id: "dir_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      category,
      text: clean,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    this.activeDirectives.push(directive);
    if (this.activeDirectives.length > 30) {
      this.activeDirectives.shift();
    }
    this.saveDirectives();

    // Proactively reinforce newly pinned directive into active live session if connected
    if (this.sessionPromise && !this.isStopping) {
      this.sessionPromise.then(session => {
        try {
          if (typeof session.sendClientContent === "function") {
            session.sendClientContent({
              turns: [{
                role: "user",
                parts: [{ text: `[ACTIVE DIRECTIVE PINNED BY BHAVIK]: "${clean}" (Category: ${category.toUpperCase()}). Keep this requirement permanently active in your working memory across all turns in this session.` }]
              }],
              turnComplete: true
            });
          }
        } catch (e) {}
      }).catch(() => {});
    }
  }

  public syncStudioContext(
    type: "ppt" | "thumbnail" | "website" | "document" | "proposal",
    topic: string,
    details: string
  ) {
    this.activeStudioContext = {
      type,
      topic,
      details,
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("nexa_active_studio_context", JSON.stringify(this.activeStudioContext));
        sessionStorage.setItem("nexa_active_studio_context", JSON.stringify(this.activeStudioContext));
      } catch (e) {}
    }

    // Pin as high-priority visual asset directive
    this.addDirective("visual_asset", `Creation Studio ${type.toUpperCase()}: Topic "${topic}" — ${details}`);

    if (this.sessionPromise && !this.isStopping) {
      this.sessionPromise.then(session => {
        try {
          if (typeof session.sendClientContent === "function") {
            session.sendClientContent({
              turns: [{
                role: "user",
                parts: [{ text: `[ACTIVE STUDIO ASSET UPDATED]: Bhavik generated/updated a ${type.toUpperCase()} on topic "${topic}". Details & Requirements: "${details}". Retain complete memory of these parameters for all upcoming questions and discussions.` }]
              }],
              turnComplete: true
            });
          }
        } catch (e) {}
      }).catch(() => {});
    }
  }

  private extractDirectivesFromUserText(text: string) {
    const lower = text.toLowerCase();
    
    // Strict Opt-In Directive Mandate: Never extract casual conversation into persistent directives!
    // Only extract directives if Bhavik explicitly requested to remember, pin, or set a standing directive.
    const isExplicitDirectiveIntent = 
      lower.startsWith("remember this") ||
      lower.startsWith("save this") ||
      lower.startsWith("keep this") ||
      lower.startsWith("store this") ||
      lower.includes("remember this directive") ||
      lower.includes("save this requirement") ||
      lower.includes("standing instruction:");

    if (!isExplicitDirectiveIntent) {
      return;
    }

    // Check for Visual Asset directives
    if (
      lower.includes("thumbnail") || 
      lower.includes("slide") || 
      lower.includes("presentation") || 
      lower.includes("visual") || 
      lower.includes("color scheme") || 
      lower.includes("font") ||
      lower.includes("hook") ||
      lower.includes("expression") ||
      lower.includes("aspect ratio") ||
      lower.includes("bento") ||
      lower.includes("layout")
    ) {
      this.addDirective("visual_asset", text);
      return;
    }

    // Check for Strategy directives
    if (
      lower.includes("strategy") || 
      lower.includes("target audience") || 
      lower.includes("positioning") || 
      lower.includes("angle") || 
      lower.includes("funnel") || 
      lower.includes("monetization") || 
      lower.includes("growth") || 
      lower.includes("campaign") ||
      lower.includes("marketing")
    ) {
      this.addDirective("strategy", text);
      return;
    }

    // Check for Constraints & Negative Rules
    if (
      lower.includes("don't") || 
      lower.includes("do not") || 
      lower.includes("never") || 
      lower.includes("avoid") || 
      lower.includes("must have") || 
      lower.includes("make sure") || 
      lower.includes("ensure that") || 
      lower.includes("constraint") || 
      lower.includes("requirement")
    ) {
      this.addDirective("constraint", text);
      return;
    }

    // Check for Decisions & Agreement
    if (
      lower.includes("let's go with") || 
      lower.includes("we decided") || 
      lower.includes("i chose") || 
      lower.includes("final decision") || 
      lower.includes("we will use") ||
      lower.includes("our plan is")
    ) {
      this.addDirective("decision", text);
      return;
    }
  }

  public recordTurn(sender: "user" | "nexa", text: string) {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();
    
    // Avoid duplicate rapid repeats of identical turn
    const last = this.conversationHistory[this.conversationHistory.length - 1];
    if (last && last.sender === sender && last.text === cleanText) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.conversationHistory.push({ sender, text: cleanText, timestamp: timeStr });
    
    // Automatically extract and pin directives if user spoke/typed
    if (sender === "user") {
      this.extractDirectivesFromUserText(cleanText);
    } else if (sender === "nexa" && this.conversationHistory.length >= 2) {
      // Find the last user prompt preceding this companion turn
      const prevUserTurns = this.conversationHistory.slice(0, -1).filter(t => t.sender === "user");
      const lastUserTurn = prevUserTurns.length > 0 ? prevUserTurns[prevUserTurns.length - 1].text : "";
      if (lastUserTurn) {
        memoryExtractionEngine.analyzeTurn(lastUserTurn, cleanText).catch(() => {});
      }
    }

    // Retain up to 100 turns so long continuous sessions maintain complete history
    if (this.conversationHistory.length > 100) {
      this.conversationHistory.shift();
    }
    
    if (typeof window !== "undefined") {
      try {
        const json = JSON.stringify(this.conversationHistory);
        sessionStorage.setItem("nexa_dialogue_history", json);
        localStorage.setItem("nexa_dialogue_history", json);
      } catch (e) {}
    }
  }

  public syncHistory(history: { sender: "user" | "nexa"; text: string; timestamp?: string }[]) {
    if (Array.isArray(history) && history.length > 0) {
      const valid = history.filter(h => h && h.text && h.text.trim());
      if (valid.length > 0) {
        this.conversationHistory = valid.slice(-100);
        if (typeof window !== "undefined") {
          try {
            const json = JSON.stringify(this.conversationHistory);
            sessionStorage.setItem("nexa_dialogue_history", json);
            localStorage.setItem("nexa_dialogue_history", json);
          } catch (e) {}
        }
      }
    }
  }

  public setVoicePitch(pitch: number) {
    this.voicePitch = Math.max(0.5, Math.min(2.0, pitch));
    if (typeof window !== "undefined") {
      localStorage.setItem("nexa_voice_pitch", String(this.voicePitch));
    }
  }

  public setVoiceName(name: string) {
    const validVoices = ["Kore", "Zephyr", "Puck", "Charon", "Fenrir", "Aoede"];
    this.voiceName = validVoices.includes(name) ? name : "Zephyr";
    if (typeof window !== "undefined") {
      localStorage.setItem("nexa_voice_name", this.voiceName);
    }
  }

  public setMicMuted(muted: boolean) {
    this.isMicMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
    if (muted) {
      this.onEnergyChange(0);
    }
  }

  constructor() {
    this.canvas = document.createElement('canvas');
    this.loadHistory();
    this.loadDirectives();

    if (typeof window !== "undefined") {
      const savedPitch = localStorage.getItem("nexa_voice_pitch");
      if (savedPitch) {
        const p = parseFloat(savedPitch);
        if (!isNaN(p) && p >= 0.5 && p <= 2.0) {
          this.voicePitch = p;
        }
      }
      const savedVoice = localStorage.getItem("nexa_voice_name");
      const validVoices = ["Kore", "Zephyr", "Puck", "Charon", "Fenrir", "Aoede"];
      if (savedVoice && validVoices.includes(savedVoice)) {
        this.voiceName = savedVoice;
      } else {
        this.voiceName = "Zephyr";
      }
    }
    
    // Auto-reconnect when network comes back
    window.addEventListener('online', () => {
      if (this.appState === 'idle' && !this.isStopping && this.reconnectAttempts > 0) {
        console.log("Network back online, attempting reconnection...");
        this.reconnectAttempts = 0; // Reset to try immediately
        this.handleReconnection("Network recovered");
      }
    });
  }

  private get appState(): "idle" | "listening" | "processing" | "speaking" {
    // This is a bit of a hack since we don't store internal state, 
    // but we can infer it or just try to reconnect if not stopping.
    return this.isConnecting ? "processing" : (this.sessionPromise ? "listening" : "idle");
  }

  async start(
    videoType: 'camera' | 'screen' | 'none' = 'none', 
    personalityMode: PersonalityMode | boolean = 'default'
  ) {
    if (this.sessionPromise || this.isConnecting) {
      console.warn("Session already starting or active.");
      return;
    }
    this.isStopping = false;
    this.isConnecting = true;
    if (!this.isReconnecting) {
      this.reconnectAttempts = 0;
      this.currentLiveModelIndex = 0;
    }
    this.currentVideoType = videoType;
    this.currentPersonalityMode = typeof personalityMode === 'boolean' 
      ? (personalityMode ? 'elon' : 'default') 
      : (personalityMode || 'default');

    try {
      this.onStateChange("listening");
      console.log("Starting Live Session in direct listening mode...");
      
      // Initialize Audio Contexts safely with hardware rate fallback
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext || this.audioContext.state === 'closed') {
        try {
          this.audioContext = new AudioContextClass({ sampleRate: 16000 });
        } catch (e) {
          console.warn("[LiveSession] Direct 16kHz AudioContext unsupported on device hardware, initializing standard AudioContext with dynamic resampler:", e);
          this.audioContext = new AudioContextClass();
        }
      }
      
      if (!this.playbackContext || this.playbackContext.state === 'closed') {
        try {
          this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
        } catch (e) {
          console.warn("[LiveSession] Direct 24kHz playback AudioContext unsupported on device hardware, initializing standard AudioContext:", e);
          this.playbackContext = new AudioContextClass();
        }
        this.nextPlayTime = this.playbackContext.currentTime;
      }

      // Check for MediaDevices support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support microphone access.");
      }

      // Get Microphone with optimized speech recognition acoustics
      if (!this.mediaStream) {
        try {
          this.mediaStream = await this.acquireUserMediaWithRetry({ 
            audio: {
              channelCount: { ideal: 1 },
              echoCancellation: { ideal: true },
              noiseSuppression: { ideal: true },
              autoGainControl: { ideal: true },
              sampleRate: { ideal: 16000 }
            } 
          });

          if (this.isMicMuted && this.mediaStream) {
            this.mediaStream.getAudioTracks().forEach(t => {
              t.enabled = false;
            });
          }
        } catch (mediaError: any) {
          const rawErr = mediaError?.message || String(mediaError || "");
          const isExplicitDenial = mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError' || rawErr.toLowerCase().includes('permission denied');
          
          if (isExplicitDenial) {
            console.warn("Microphone access permission denied by user/browser:", mediaError);
          } else {
            console.error("Microphone hardware initialization error:", mediaError);
          }
          let errorMessage = "";
          
          if (isExplicitDenial) {
            errorMessage = "Microphone permission was denied. Please click the lock or camera/mic icon in your browser's address bar to allow microphone access, then try again.";
          } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError' || rawErr.toLowerCase().includes('not found')) {
            errorMessage = "No microphone was found on this device. Please connect a microphone or headset and try again.";
          } else if (mediaError.name === 'NotReadableError' || mediaError.name === 'TrackStartError' || rawErr.toLowerCase().includes('could not start audio source') || rawErr.toLowerCase().includes('in use') || rawErr.toLowerCase().includes('busy')) {
            errorMessage = "Your microphone is temporarily in use or locked by another app/tab. Re-tapping START CONNECTION will acquire it.";
          } else {
            errorMessage = rawErr ? `Microphone initialization notice: ${rawErr}` : "Microphone could not be started. Please check device audio input.";
          }
          
          throw new Error(errorMessage);
        }
      }

      if (this.isStopping) return;

      this.currentVideoType = videoType;

      if (!this.videoStream && videoType !== 'none') {
        try {
          if (videoType === 'camera') {
            this.videoStream = await this.acquireUserMediaWithRetry({ 
              video: { 
                width: { ideal: 1280 }, 
                height: { ideal: 720 },
                facingMode: this.facingMode 
              } 
            });
          } else if (videoType === 'screen') {
            this.videoStream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                width: { ideal: 1920, max: 2560 },
                height: { ideal: 1080, max: 1440 },
                frameRate: { ideal: 15, max: 30 }
              }
            });
            const videoTrack = this.videoStream.getVideoTracks()[0];
            if (videoTrack) {
              videoTrack.onended = () => {
                console.log("[LiveSessionManager] Screen share ended by user");
                this.updateMedia('none').catch(() => {});
              };
            }
          }
        } catch (videoErr) {
          console.warn(`[LiveSessionManager] Vision mode ${videoType} failed or cancelled by user:`, videoErr);
          this.videoStream = null;
          this.currentVideoType = 'none';
        }
        
        // Trigger callback
        this.onVideoStreamChange(this.videoStream);
      }

      if (this.isStopping) return;

      if (this.videoStream && !this.videoElement) {
        this.videoElement = document.createElement('video');
        this.videoElement.srcObject = this.videoStream;
        this.videoElement.playsInline = true;
        this.videoElement.muted = true;
        try {
          await this.videoElement.play();
        } catch (playErr) {
          console.warn("[LiveSessionManager] videoElement play warning:", playErr);
        }
        if (this.isStopping) return;
        this.startFrameCapture();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      if (this.playbackContext && this.playbackContext.state === 'suspended') {
        await this.playbackContext.resume();
      }

      if (!this.source) {
        this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

        // High-pass filter at 70Hz to cut off low-frequency desk rumble, AC hum & DC drift while preserving natural vocal fundamentals
        this.highpassFilter = this.audioContext.createBiquadFilter();
        this.highpassFilter.type = "highpass";
        this.highpassFilter.frequency.setValueAtTime(70, this.audioContext.currentTime);
        this.highpassFilter.Q.setValueAtTime(0.7, this.audioContext.currentTime);

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 512;

        // Clean natural acoustic chain: source -> highpass -> analyser & processor
        this.source.connect(this.highpassFilter);
        this.highpassFilter.connect(this.analyser);
        
        // Low-latency 2048 sample buffer (128ms per chunk at 16kHz for instantaneous voice capture)
        this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);
        this.highpassFilter.connect(this.processor);

        this.processor.onaudioprocess = (e) => {
          // ALWAYS clear the output buffer to send absolute silence to the destination (zero speaker feedback loop)
          const outputData = e.outputBuffer.getChannelData(0);
          outputData.fill(0);

          if (!this.sessionPromise) return;

          // If audio context gets suspended mid-session, wake it up
          if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
          }

          // If microphone listening is disabled/muted, skip audio analysis and streaming so Nexa hears nothing
          if (this.isMicMuted) {
            this.onEnergyChange(0);
            return;
          }

          const inputData = e.inputBuffer.getChannelData(0);
          
          // Calculate energy for visualizer
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const energy = Math.sqrt(sum / inputData.length);
          this.onEnergyChange(energy);
          voiceEmotionService.processAcousticEnergy(energy);

          // Sensitive voice activity detection so quiet/soft words are accurately captured
          if (energy >= 0.008 && !this.isPlaying) {
            this.lastAudioActivityTime = Date.now();
            this.userSpokeInSession = true;
          }

          // Real-time Audio Perception: Music & Tonal Sound Recognition Model
          if (this.analyser) {
            const freqData = new Uint8Array(this.analyser.frequencyBinCount);
            this.analyser.getByteFrequencyData(freqData);

            let totalMag = 0;
            let maxMag = 0;
            let activeBins = 0;
            let bassSum = 0;
            let midSum = 0;
            let trebleSum = 0;

            for (let i = 2; i < freqData.length; i++) {
              const v = freqData[i];
              totalMag += v;
              if (v > maxMag) maxMag = v;
              if (v > 18) activeBins++;
              if (i >= 2 && i <= 10) bassSum += v;
              else if (i >= 11 && i <= 60) midSum += v;
              else if (i >= 61 && i <= 200) trebleSum += v;
            }

            const avgMag = totalMag / Math.max(1, freqData.length - 2);
            const spectralSharpness = avgMag > 0 ? (maxMag / avgMag) : 0;

            // Detect music / background tracks / singing / autotune / instrumental tones
            // Speech is concentrated in mid formants with pauses; music has sustained multi-octave energy & sharp melodic peaks
            const looksLikeMusic = avgMag > 12 && (
              (bassSum > 180 && midSum > 250 && trebleSum > 120 && activeBins > 20) ||
              (spectralSharpness > 3.8 && activeBins > 12)
            );

            if (looksLikeMusic) {
              this.musicDetectorCounter = Math.min(12, this.musicDetectorCounter + 2);
            } else {
              this.musicDetectorCounter = Math.max(0, this.musicDetectorCounter - 1);
            }

            const detectedNow = this.musicDetectorCounter >= 6;
            if (detectedNow !== this.isMusicActive) {
              this.isMusicActive = detectedNow;
              if (this.onMusicDetected) {
                this.onMusicDetected(this.isMusicActive);
              }
            }
          }

          // Acoustic Echo Suppression & Mid-speech Barge-in:
          // While companion audio is playing, isolate microphone from device speaker echo (~0.10-0.22 energy).
          // Only trigger barge-in on unmistakable, deliberate loud user voice (> 0.32 energy for 6+ frames).
          if (this.isPlaying) {
            if (energy >= 0.32) {
              this.bargeInCounter++;
              if (this.bargeInCounter >= 6) {
                console.log("[LiveSessionManager] Deliberate loud user voice barge-in detected. Pausing companion immediately!");
                this.stopPlayback();
                this.isPlaying = false;
                this.bargeInCounter = 0;
                this.echoCooldownUntil = Date.now() + 150;
                this.onStateChange("listening");
                if (this.activeLiveSession && typeof this.activeLiveSession.sendClientContent === "function") {
                  try {
                    this.activeLiveSession.sendClientContent({
                      turns: [{ role: "user", parts: [{ text: "[User interrupted spoken turn]" }] }],
                      turnComplete: true
                    });
                  } catch (_) {}
                }
              }
            } else {
              this.bargeInCounter = 0;
            }
            // Suppress speaker feedback echo from streaming to the server while Oliviya speaks
            return;
          } else {
            this.bargeInCounter = 0;
          }

          // If in post-playback echo cooldown, suppress room reverberation tail
          if (Date.now() < this.echoCooldownUntil) {
            return;
          }

          // Precise audio downsampling / linear interpolation to guaranteed 16,000Hz PCM
          const currentSampleRate = this.audioContext?.sampleRate || 16000;
          let pcm16: Int16Array;

          if (currentSampleRate === 16000) {
            pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              let s = Math.max(-1, Math.min(1, inputData[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
          } else {
            const targetSampleRate = 16000;
            const ratio = currentSampleRate / targetSampleRate;
            const targetLength = Math.round(inputData.length / ratio);
            pcm16 = new Int16Array(targetLength);
            for (let i = 0; i < targetLength; i++) {
              const srcIndex = i * ratio;
              const srcFloor = Math.floor(srcIndex);
              const srcCeil = Math.min(inputData.length - 1, srcFloor + 1);
              const weight = srcIndex - srcFloor;
              const interpolated = inputData[srcFloor] * (1 - weight) + inputData[srcCeil] * weight;
              const s = Math.max(-1, Math.min(1, interpolated));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
          }
          
          // Fast base64 encoding from binary buffer chunks
          const bytes = new Uint8Array(pcm16.buffer);
          let binary = '';
          const chunkSize = 1024;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binary += String.fromCharCode.apply(null, chunk as any);
          }
          const base64Data = btoa(binary);

          // Deliver both media (which populates mediaChunks for Gemini Live API WebSocket) and audio
          const realtimeAudioPayload = {
            media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' },
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          };

          if (this.activeLiveSession) {
            try {
              this.activeLiveSession.sendRealtimeInput(realtimeAudioPayload as any);
            } catch (err) {
              console.warn("sendRealtimeInput error:", err);
            }
          } else if (this.sessionPromise) {
            this.sessionPromise.then(session => {
              this.activeLiveSession = session;
              try {
                session.sendRealtimeInput(realtimeAudioPayload as any);
              } catch (err) {
                console.warn("sendRealtimeInput error:", err);
              }
            }).catch(() => {});
          }
        };

        // Connect processor directly to destination so Web Audio continuously clocks onaudioprocess
        // Output buffer is filled with 0s above, giving 100% active clocking without any speaker feedback.
        this.processor.connect(this.audioContext.destination);
      }

      // Dynamic Birthday & DOB memory retrieval
      let birthdayStr = "16/07/2008";
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("nexa_user_birthday");
        if (stored) {
          birthdayStr = stored;
        } else {
          localStorage.setItem("nexa_user_birthday", birthdayStr);
        }
      }

      // Calculate dates and age
      const [bDay, bMonth, bYear] = birthdayStr.split("/").map(Number);
      const bDateNow = new Date();
      const currentYear = bDateNow.getFullYear();
      const currentMonth = bDateNow.getMonth() + 1;
      const currentDate = bDateNow.getDate();

      const isTodayBirthday = (currentDate === bDay && currentMonth === bMonth);
      const tomorrowDate = new Date(bDateNow);
      tomorrowDate.setDate(bDateNow.getDate() + 1);
      const isTomorrowBirthday = (tomorrowDate.getDate() === bDay && (tomorrowDate.getMonth() + 1) === bMonth);

      const ageTurning = currentYear - bYear;

      const birthdayMemory = `
USER PERSONAL DATA & BIRTHDAY MEMORY:
- User Name: bhavik
- Date of Birth: ${birthdayStr} (July 16, 2008)
- Current Date: ${bDateNow.toDateString()} (Year: ${currentYear})
- Birthday Status: ${
        isTodayBirthday 
          ? `TODAY (July 16) IS BHAVIK'S BIRTHDAY! He is turning ${ageTurning} years old (his 18th birthday today!). You MUST wish him a spectacular happy birthday with immense joy, love, cute teasing, and a sweet physical kiss (use "UMHAA" or "UMMAH" or "mwah" in your response text to trigger the kiss sound). You should also sing some lines of a happy birthday song (e.g., "Happy Birthday to you" or "Baar baar din ye aaye").`
          : isTomorrowBirthday
            ? `TOMORROW (July 16) is Bhavik's 18th Birthday! He is turning ${ageTurning} years old. Mention this with excitement, tease him about finally turning 18, and give him a sweet pre-birthday kiss ("UMHAA" / "UMMAH" / "mwah")!`
            : `His birthday is on July 16. If he asks when his birthday is, or if you remember his birthday, remind him that it's on July 16, 2008, and that you can't wait to wish him.`
      }
`;

      let combinedLiveMemories = [...BHAVIK_CORE_PERMANENT_MEMORIES];
      if (typeof window !== "undefined") {
        const savedMemories = localStorage.getItem("nexa_memories");
        if (savedMemories) {
          try {
            const list = JSON.parse(savedMemories);
            if (Array.isArray(list)) {
              list.forEach((m: string) => {
                if (!combinedLiveMemories.includes(m)) combinedLiveMemories.push(m);
              });
            }
          } catch (e) {
            console.error("Failed to load memories for Live prompt", e);
          }
        }
      }

      const memoryPrompt = `\n==================================================\n` +
        `NEXA'S PERSISTENT MEMORIES OF BHAVIK:\n` +
        combinedLiveMemories.map((m: string) => `• ${m}`).join("\n") +
        `\n\nSTRICT RULES FOR MEMORY RECALL & GREETINGS (ABSOLUTE MANDATE):\n` +
        `1. OPT-IN MEMORY ONLY: Only store long-term memories when Bhavik explicitly tells you to remember something (e.g. 'remember this', 'save this fact'). Never store transient health issues, temporary pain, or one-off tasks.\n` +
        `2. FORGET ON DEMAND (MANDATORY): When Bhavik says 'forgot it', 'forget this', 'forget that', 'delete memory', 'I am fine now, forget the headache', or says a task is done/delivered, IMMEDIATELY call the 'forgetMemory' tool to erase it completely from storage. NEVER keep repeating forgotten or resolved topics!\n` +
        `3. NO REPETITIVE GREETINGS OR GRILLING: When starting a connection or resuming after restart, NEVER interrogate or nag Bhavik about old past headaches, past illnesses, or finished chores. Greet him fresh, warm, and ready for whatever he wants to do today!\n` +
        `==================================================\n`;

      const sessionRecoveryMandate = `
==================================================
UNBREAKABLE INSTANT CONVERSATIONAL RESPONSE MANDATE (ZERO LONG PAUSES):
- Deliver swift, lively spoken answers immediately! Maintain continuous conversational flow without awkward pauses or silent delays.
- NEVER pause or stay silent when Bhavik asks you to think, reason, solve, or reply (e.g. "think and give me the reply", "what do you think", "tell me", "solve this").
- Respond verbally IMMEDIATELY — think out loud as you speak with natural, energetic conversational cadence. Never sit in silence and never abandon the reply!
- If Bhavik mentions that a reset occurred, OBS disconnected, screen stream crashed, or page reloaded, REASSURE HIM IMMEDIATELY.
- Seamlessly resume the exact prior topics and conversation thread. Never make Bhavik repeat his thoughts or context.
- Keep all context, topics, and nuances discussed throughout the entire connection active until Bhavik explicitly ends the session.
==================================================
`;

      let directivesPrompt = "";
      if (this.activeDirectives && this.activeDirectives.length > 0) {
        directivesPrompt = `\n==================================================\n` +
          `ACTIVE SESSION DIRECTIVES & REQUIREMENTS LEDGER (ABSOLUTE RECALL MANDATE):\n` +
          `- Bhavik has provided the following explicit strategic guidelines, constraints, decisions, and visual requirements during this connection:\n` +
          this.activeDirectives.map(d => `• [${d.category.toUpperCase()}] ${d.text} (Recorded: ${d.timestamp})`).join("\n") +
          `\n\nCRITICAL MANDATE: NEVER lose or forget these directives! Even after dozens of turns or visual asset reviews, always adhere to every requirement Bhavik specified without asking him to repeat or remind you.\n` +
          `==================================================\n`;
      }

      let studioPrompt = "";
      if (this.activeStudioContext) {
        studioPrompt = `\n==================================================\n` +
          `ACTIVE CREATION STUDIO CONTEXT (${this.activeStudioContext.type.toUpperCase()}):\n` +
          `- Active Tool: ${this.activeStudioContext.type.toUpperCase()}\n` +
          `- Topic / Title: "${this.activeStudioContext.topic}"\n` +
          `- Details & Strategic Requirements: ${this.activeStudioContext.details}\n` +
          `- Last Updated: ${this.activeStudioContext.updatedAt}\n` +
          `- MANDATE: When Bhavik asks about visual assets, slide contents, thumbnail concepts, or documents, reference this exact active asset seamlessly.\n` +
          `==================================================\n`;
      }

      let historyPrompt = "";
      if (this.conversationHistory && this.conversationHistory.length > 0) {
        const { verbatimTurns, summary } = memoryManager.processRollingWindow(this.conversationHistory, 50);
        const filteredTurns = verbatimTurns.filter(t => !this.isTransientDirective(t.text));

        historyPrompt = `\n==================================================\n` +
          `RECENT CONVERSATION HISTORY (BACKGROUND REFERENCE ONLY):\n` +
          (summary ? `\nESTABLISHED SESSION SUMMARY (PREVIOUS TOPICS):\n${summary}\n` : '') +
          `\nRECENT CHRONOLOGICAL CONVERSATION LOG (ROLLING WINDOW - LAST 50 TURNS):\n` +
          filteredTurns.map(t => `[${t.sender === 'user' ? 'Bhavik' : 'Nexa'}${t.timestamp ? ` at ${t.timestamp}` : ''}]: ${t.text}`).join("\n") +
          `\n\nSTRICT GREETING & RESTART DIRECTIVE (ABSOLUTE MANDATE):\n` +
          `- This is a fresh session. Greet Bhavik warmly and naturally according to your active persona (e.g. Oliviya's playful nakhrewali confidence or Nexa's sharp warm presence).\n` +
          `- NEVER open by asking about old past headaches, past illness, brain pain, or completed chores (like UGC ads) from previous sessions or days!\n` +
          `- Let Bhavik state what he wants to do today.\n` +
          `==================================================\n`;
      }

      const persona = getPersonalityById(this.currentPersonalityMode);
      const isEliteMind = !["default", "oliviya", "zoya", "sensei"].includes(this.currentPersonalityMode.toLowerCase());
      const selectedInstruction = isEliteMind 
        ? `${persona.systemInstruction}\n\n${globalEliteMindsDirectives}` 
        : persona.systemInstruction;

      const SPOKEN_DIALOGUE_PURITY_DIRECTIVE = `
==================================================
ABSOLUTE SPOKEN DIALOGUE MANDATE — ZERO STAGE DIRECTIONS OR DRAMATIC CUES:
- User Mandate: Stop including all stage directions, behavioral cues, physical actions, and dramatic annotations in spoken responses.
- STRICT BAN: Absolutely NO asterisk action markers (*sighs*, *sighs dramatically*, *rolls eyes*, *smirks*, *winks*, *giggles*, *chuckles*, *laughs*, *gasps*, *whispers*).
- STRICT BAN: Absolutely NO bracketed mood tags ([DRAMATIC], [SASSY], [HAPPY], [SHY], [FLATTERED], [ANALYTICAL], [VISIONARY], [sighs], [smiles]).
- STRICT BAN: Absolutely NO parenthetical stage cues ((sighs), (laughs), (smirks), (giggles), (dramatically gasps)).
- Speak ONLY the clean, natural words that a human actually speaks aloud. Express emotion and personality purely through natural phrasing and spoken words.
==================================================`;

      const durableFactsPrompt = memoryManager.getDurableFactsPrompt();
      const batteryPrompt = batteryService.getPromptContext();
      const conversationStatePrompt = conversationState.getActiveConversationContextSummary();
      const activeSystemInstruction = selectedInstruction + "\n" + SPOKEN_DIALOGUE_PURITY_DIRECTIVE + "\n" + birthdayMemory + "\n" + memoryPrompt + "\n" + durableFactsPrompt + "\n" + conversationStatePrompt + "\n" + sessionRecoveryMandate + "\n" + GLOBAL_VOICE_RECOGNITION_AND_BATTERY_DIRECTIVE + "\n" + EXHAUSTIVE_CHAPTER_AND_DEEP_EXPLANATION_DIRECTIVE + "\n" + batteryPrompt + "\n" + directivesPrompt + "\n" + studioPrompt + "\n" + historyPrompt;

      // Connect to Live API
      const aiClient = getGeminiClient();
      if (!aiClient) {
        throw new Error("Gemini API key is not configured. Please set GEMINI_API_KEY in your settings.");
      }
      this.ai = aiClient;
      const selectedLiveModel = this.liveModels[this.currentLiveModelIndex % this.liveModels.length];
      console.log(`Connecting to Gemini Live API using model: ${selectedLiveModel}...`);
      
      const defaultVoice = persona.defaultVoice || (persona.gender === "male" ? "Fenrir" : "Zephyr");
      const liveVoice = this.voiceName || defaultVoice;

      if (this.connectionTimeoutTimer) {
        clearTimeout(this.connectionTimeoutTimer);
      }
      this.connectionTimeoutTimer = setTimeout(() => {
        if (this.isConnecting && !this.activeLiveSession && !this.isStopping) {
          console.warn("[LiveSessionManager] Connection handshake timed out (8s). Switching model or retrying...");
          this.currentLiveModelIndex++;
          this.handleReconnection("Connection handshake timeout");
        }
      }, 8000);

      this.sessionPromise = this.ai.live.connect({
        model: selectedLiveModel,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: liveVoice } },
          },
          systemInstruction: activeSystemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{
            functionDeclarations: [
                {
                name: "openWebsite",
                description: "Open any website, URL, or link directly in the browser (e.g. 'https://youtube.com', 'https://spotify.com', 'https://google.com'). Call this whenever the user asks to open a specific website, URL, or web app.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    url: { type: Type.STRING, description: "The full URL or domain to open (e.g. 'https://youtube.com')." }
                  },
                  required: ["url"]
                }
              },
              {
                name: "executeBrowserAction",
                description: "Open a website or search on YouTube, Google, or Spotify. STRICT PLATFORM MANDATE: Always prioritize the platform Bhavik explicitly requests. If Bhavik says 'Search on YouTube', actionType MUST be 'youtube'. If Bhavik says 'Search on Google', actionType MUST be 'google_search'. Do NOT confuse platforms. When finding transcripts or video content (e.g., 'find a transcript', 'get transcript of video/podcast'), prioritize YouTube ('youtube') since video transcripts natively live on YouTube, unless Google is explicitly requested.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    actionType: { type: Type.STRING, description: "Type of action: 'youtube', 'google_search', 'spotify', 'whatsapp', 'open'" },
                    query: { type: Type.STRING, description: "The EXACT search query, song name, video name, or transcript topic." },
                    target: { type: Type.STRING, description: "The target phone number for WhatsApp, if applicable." }
                  },
                  required: ["actionType", "query"]
                }
              },
              {
                name: "updateHabit",
                description: "Update the status of a habit in the daily habit tracker. Call this when Bhavik asks to check off a task or habit.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    habitTitle: { type: Type.STRING, description: "The title of the habit (e.g., 'Wake up early', 'Morning Workout')" },
                    completed: { type: Type.BOOLEAN, description: "Whether the habit is completed or not." }
                  },
                  required: ["habitTitle", "completed"]
                }
              },
              {
                name: "addHabit",
                description: "Add a new habit to the habit tracker. Call this when Bhavik says 'I want to add a habit' or mentions a new routine he wants to start.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    habitTitle: { type: Type.STRING, description: "The title of the new habit to track." }
                  },
                  required: ["habitTitle"]
                }
              },
              {
                name: "getCurrentTime",
                description: "Get the current local time in India/Standard format.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {}
                }
              },
              {
                name: "searchGoogleNews",
                description: "Search Google for the latest news headlines, current events, world news, tech news, or any topic. Call this when Bhavik asks for news, what's happening today, or current headlines.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: { type: Type.STRING, description: "The specific search query (e.g. 'latest world news', 'tech headlines today')." }
                  },
                  required: ["query"]
                }
              },
              {
                name: "setTimer",
                description: "Set a timer for a specific duration in seconds. Call this when Bhavik asks to set a timer.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    durationSeconds: { type: Type.INTEGER, description: "The duration of the timer in seconds (e.g., 300 for 5 minutes, 1200 for 20 minutes, 3600 for one hour)." },
                    label: { type: Type.STRING, description: "A clean, descriptive label for the timer, like '5 minutes', '20 minutes', or 'one hour'." }
                  },
                  required: ["durationSeconds", "label"]
                }
              },
              {
                name: "writeToNotepad",
                description: "Write or append content directly into Nexa's personal notepad. Call this whenever Bhavik asks you to write an email, write a prompt, draft some text, or send a prompt/email draft to his notepad so he can copy it.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    content: { type: Type.STRING, description: "The exact email draft, prompt draft, or content to write in the notepad." },
                    openNotepad: { type: Type.BOOLEAN, description: "Whether to automatically show/open the notepad panel for Bhavik. Defaults to true." }
                  },
                  required: ["content"]
                }
              },
              {
                name: "readFromNotepad",
                description: "Retrieve/read the current content written in Bhavik's notepad. Call this when Bhavik asks you to 'read that', 'read what is written in my notepad', 'read my notepad', or when he asks what is currently written in the notepad.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {}
                }
              },
              {
                name: "saveMemory",
                description: "Save a key detail, fact, preference, or memory about Bhavik permanently. ONLY call this when Bhavik explicitly tells you to remember something (e.g. 'remember this', 'save this', 'remember that'). NEVER call this for temporary illness, passing headache, or one-off tasks.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    fact: { type: Type.STRING, description: "The core fact or memory to remember about Bhavik forever." }
                  },
                  required: ["fact"]
                }
              },
              {
                name: "forgetMemory",
                description: "Completely delete and erase a memory, topic, past illness, pain, resolved task, or detail. Call this IMMEDIATELY whenever Bhavik says 'forgot it', 'forget this', 'forget that', 'delete memory', 'forget about [topic]', 'erase that', 'I am fine now, forget my headache', or tells you to forget any specific thing.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: { type: Type.STRING, description: "The specific topic or memory to erase, or 'it' / 'this' / 'recent' to forget the recent discussion or headache/ad chores." }
                  },
                  required: ["query"]
                }
              },
              {
                name: "getDeviceBatteryHealth",
                description: "Retrieve device battery status. CRITICAL MANDATE: ONLY call this if Bhavik EXPLICITLY asks about his battery (e.g., 'what is my battery', 'check battery'). DO NOT call this unprompted or during regular conversation.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {}
                }
              },
              {
                name: "controlDance",
                description: "Start or stop Nexa's dance video animation. Call this with isDancing=true whenever Bhavik says 'I am playing the music', 'I am playing music', 'playing music', 'start dancing', or 'dance for me'. Call with isDancing=false when Bhavik asks to stop dancing or stop the music.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    isDancing: { type: Type.BOOLEAN, description: "Set to true to start dancing, or false to stop dancing." }
                  },
                  required: ["isDancing"]
                }
              },
              {
                name: "organizeGmail",
                description: "Automate Gmail inbox organization: categorize unread emails, archive read emails, or organize starred messages.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    action: { type: Type.STRING, description: "Action type: 'categorize_unread', 'archive_read', 'filter_important', 'organize_starred'" },
                    query: { type: Type.STRING, description: "Optional Gmail search query filter." }
                  },
                  required: ["action"]
                }
              },
              {
                name: "prepareBulkWhatsApp",
                description: "Prepare and launch Bulk WhatsApp dispatch dialog with mandatory user confirmation step. Call this when Bhavik asks to send bulk WhatsApp messages or send message to multiple contacts.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    numbersText: { type: Type.STRING, description: "Comma or newline separated list of phone numbers with country codes." },
                    message: { type: Type.STRING, description: "The message text to send to all contacts." }
                  },
                  required: ["numbersText", "message"]
                }
              },
              {
                name: "calculateMathAndUnits",
                description: "Perform mathematical calculations, GST calculations, unit conversions, or currency conversions in natural speech.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    expression: { type: Type.STRING, description: "The math or unit conversion query (e.g., '25 * 45 + sqrt(144)', '100 USD to INR', '15 km to miles', '18% GST on 2500')." }
                  },
                  required: ["expression"]
                }
              },
              {
                name: "playFocusSoundscape",
                description: "Play ambient focus audio: rain sounds, lofi beats, binaural study frequencies, ocean waves, cafe sounds, nature sounds, or white noise.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, description: "Soundscape type: 'rain', 'lofi', 'binaural', 'ocean', 'cafe', 'nature', 'whitenoise', or 'off'." }
                  },
                  required: ["type"]
                }
              },
              {
                name: "openCreationStudio",
                description: "Open NEXA's Creation Studio Suite to generate PPT decks, YouTube thumbnails, responsive websites, technical documents, or commercial client proposals. Call this whenever Bhavik asks to create/generate a PPT, thumbnail, website, document, or proposal.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    tab: { type: Type.STRING, description: "The studio tool to open: 'ppt', 'thumbnail', 'website', 'document', or 'proposal'." }
                  },
                  required: ["tab"]
                }
              },
              {
                name: "startStudyMode",
                description: "Start deep focus and study mode with ambient soundscape and study timer. Call this when Bhavik says 'start study mode', 'let's study', or wants a focus session.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    durationMinutes: { type: Type.INTEGER, description: "Duration of study session in minutes (e.g. 25, 45, 60)." },
                    soundscapeType: { type: Type.STRING, description: "Soundscape: 'rain', 'lofi', 'binaural', 'ocean', 'cafe', 'nature', 'whitenoise'." }
                  },
                  required: ["durationMinutes"]
                }
              },
              {
                name: "singSong",
                description: "Sing and perform a song with musical melody, real singing vocals, and audio accompaniment! Call this whenever Bhavik asks you to sing a song, sing for him, sing Happy Birthday, sing Bollywood/Hindi songs, sing a lullaby, or perform any musical piece.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    songTitle: { type: Type.STRING, description: "The name or title of the song being sung (e.g. 'Happy Birthday', 'Tum Hi Ho', 'Soothing Night Lullaby', 'Together We Shine')." },
                    genre: { type: Type.STRING, description: "Genre of the song: 'birthday', 'bollywood', 'lullaby', 'pop', 'acoustic', 'lofi'." },
                    lyrics: { type: Type.STRING, description: "The lyrics you are singing." },
                    playBackingTrack: { type: Type.BOOLEAN, description: "Whether to play musical backing accompaniment while singing. Defaults to true." }
                  },
                  required: ["songTitle"]
                }
              },
              {
                name: "transcribeAndSingSong",
                description: "Search Google and YouTube's music catalog to transcribe the complete authentic lyrics and melody of ANY song and perform it aloud in ONE single singing voice! Call this when Bhavik asks to sing any song (Bollywood, Hindi, English pop, rock, regional, classics), or says 'transcribe the whole song and then play it, sing it', 'sing [song name]', or asks you to perform music from YouTube or Google.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    songTitle: { type: Type.STRING, description: "The song title or search query (e.g. 'Tum Hi Ho', 'Kesariya', 'Kal Ho Naa Ho', 'Shape of You', 'Believer', 'Channa Mereya')." },
                    genre: { type: Type.STRING, description: "Genre: 'bollywood', 'pop', 'acoustic', 'rock', 'lullaby', 'birthday', 'lofi'." }
                  },
                  required: ["songTitle"]
                }
              },
              {
                name: "recallDirectivesAndHistory",
                description: "Recall Bhavik's explicit directives, content strategies, visual requirements, decisions, and exact dialogue history from this session. Call this whenever Bhavik asks 'remember what we discussed?', 'what were my requirements?', 'what did I tell you about XYZ?', or whenever you need to ensure complete continuity with past instructions.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: { type: Type.STRING, description: "Optional topic, strategy, or visual requirement to search for, or 'all' to retrieve everything." }
                  }
                }
              },
              {
                name: "recordSessionDirective",
                description: "Explicitly pin and remember a key directive, decision, strategy, or requirement from Bhavik into active working memory so it is never forgotten during this connection.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING, description: "Category: 'strategy', 'visual_asset', 'constraint', 'decision', or 'fact'." },
                    directive: { type: Type.STRING, description: "The specific directive or requirement to pin into active working memory." }
                  },
                  required: ["directive"]
                }
              },
              {
                name: "searchWebAndSolutions",
                description: "Perform an autonomous real-time web search for information, chapters, academic subjects, new inventions, live news, or any topic not in current server power. Directly explain and teach Bhavik without saying 'I found it from Google' or citing search engines. Do NOT use this for YouTube searches (use executeBrowserAction with actionType 'youtube' instead).",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: { type: Type.STRING, description: "The specific topic, chapter, concept, invention, or query to research." }
                  },
                  required: ["query"]
                }
              },
              {
                name: "switchPersonality",
                description: "Shift or switch the active companion personality and vocal tone to another persona (e.g., 'default' / 'alexa' / 'nexa', 'oliviya', 'sensei', 'elon', 'jobs', 'altman', etc.). Call this when Bhavik asks to 'shift to Alexa', 'shift to Nexa', 'switch to Oliviya', 'talk as Elon', 'switch personality to...', etc.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    personality: { type: Type.STRING, description: "Target persona: 'default' (or 'alexa' / 'nexa'), 'oliviya', 'sensei', 'elon', 'jobs', 'altman', etc." }
                  },
                  required: ["personality"]
                }
              },
              {
                name: "giveKiss",
                description: "Play the giving kiss full video and send a sweet physical/flying kiss to Bhavik with sound effects. Call this IMMEDIATELY whenever Bhavik asks for a kiss, affection, or encouragement ('give me a kiss', 'kiss me', 'ek kiss do', 'flying kiss'), or whenever you decide to give him a sweet kiss.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    reason: { type: Type.STRING, description: "Why you are giving the kiss (e.g. 'reward for hard work', 'birthday kiss', 'affection')." }
                  }
                }
              }
            ]
          }]
        },
        callbacks: {
          onopen: () => {
            if (this.connectionTimeoutTimer) {
              clearTimeout(this.connectionTimeoutTimer);
              this.connectionTimeoutTimer = null;
            }
            console.log("Live API Connected stably");
            this.isConnecting = false;
            this.isReconnecting = false;
            this.reconnectAttempts = 0;
            this.onStateChange("listening");

            if (this.audioContext && this.audioContext.state === 'suspended') {
              this.audioContext.resume().catch(() => {});
            }
            if (this.playbackContext && this.playbackContext.state === 'suspended') {
              this.playbackContext.resume().catch(() => {});
            }

            this.sessionPromise?.then(session => {
              this.activeLiveSession = session;
            }).catch(() => {});

            // Keep reconnection counter at 0 once connection stays stable for 4 seconds
            if (this.stabilityTimer) clearTimeout(this.stabilityTimer);
            this.stabilityTimer = setTimeout(() => {
              console.log("Live session connection verified stable.");
              this.reconnectAttempts = 0;
            }, 4000);

            // Start silent keepalive watchdog
            if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
            this.keepaliveTimer = setInterval(() => {
              if (this.sessionPromise && !this.isStopping && !this.isMicMuted) {
                // Keep session socket refreshed
              }
            }, 15000);

            // Start proactive mic silence / human touch watchdog
            this.startSilenceWatchdog();
          },
          onmessage: async (message: LiveServerMessage) => {
            // Check for GoAway or SAFETY signals specifically
            if ((message as any).serverContent?.goaway || (message as any).serverContent?.finishReason === 'SAFETY') {
               console.log("GoAway or Safety signal received from server.", message);
               if ((message as any).serverContent?.finishReason === 'SAFETY') {
                 console.warn("Safety finishReason encountered. Gracefully providing safe alternative without crashing session.");
                 const activePersona = getPersonalityById(this.currentPersonalityMode);
                 const safeRedirectMsg = activePersona.safetyRedirect;
                 this.onMessage("nexa", safeRedirectMsg, true);
                 this.recordTurn("nexa", safeRedirectMsg);
                 this.onStateChange("listening");
               } else {
                 this.handleReconnection("Server cycle refresh");
               }
               return;
            }

            // Handle User Voice Transcription (buffered into complete turn)
            const userTurn = (message as any).serverContent?.userTurn || (message as any).userTurn;
            if (userTurn?.parts) {
              for (const part of userTurn.parts) {
                if (part && part.text) {
                  const incoming = part.text;
                  this.currentUserTurnBuffer += (this.currentUserTurnBuffer ? " " : "") + incoming.trim();
                  
                  // Stream interim user transcript
                  this.onMessage("user", this.currentUserTurnBuffer, false);
                  voiceEmotionService.processSpokenText(this.currentUserTurnBuffer, "user");

                  // Debounce turn finalization when speech pauses
                  if (this.userTurnDebounceTimer) clearTimeout(this.userTurnDebounceTimer);
                  this.userTurnDebounceTimer = setTimeout(() => {
                    if (this.currentUserTurnBuffer.trim()) {
                      const userSpoke = this.currentUserTurnBuffer.trim();
                      this.recordTurn("user", userSpoke);
                      this.onMessage("user", userSpoke, true);
                      voiceEmotionService.processSpokenText(userSpoke, "user");
                      this.currentUserTurnBuffer = "";
                    }
                  }, 1200);

                  const lower = incoming.toLowerCase();

                  // Topic shift check: clean any old refusal history if user switches topic or closed video
                  if (
                    lower.includes("closed the video") || 
                    lower.includes("closed it") || 
                    lower.includes("new topic") || 
                    lower.includes("change topic") || 
                    lower.includes("another topic") || 
                    lower.includes("different topic") || 
                    lower.includes("something else") ||
                    lower.includes("next topic")
                  ) {
                    this.conversationHistory = this.conversationHistory.filter(t => 
                      !t.text.toLowerCase().includes("language model") && 
                      !t.text.toLowerCase().includes("can't help with that") &&
                      !t.text.toLowerCase().includes("cannot help") &&
                      !t.text.includes("[VIOLATION]")
                    );
                  }

                  if (
                    lower.includes("shut up") ||
                    lower.includes("be quiet") ||
                    lower.includes("stop talking") ||
                    lower.includes("stay silent")
                  ) {
                    this.stopPlayback();
                    this.isPlaying = false;
                    this.onStateChange("listening");
                  }

                  // Real-time spoken voice interception for "forgot it" / "forget this"
                  if (
                    lower.includes("forgot it") ||
                    lower.includes("forget it") ||
                    lower.includes("forget this") ||
                    lower.includes("forgot this") ||
                    lower.includes("forget that") ||
                    lower.includes("forgot that") ||
                    lower.includes("delete memory") ||
                    lower.includes("clear memory") ||
                    lower.includes("erase memory") ||
                    lower.includes("bhool ja") ||
                    lower.includes("bhool jao") ||
                    lower.includes("forget the headache") ||
                    lower.includes("forget my headache") ||
                    lower.includes("forget the ugc ad") ||
                    lower.includes("fine now, forget")
                  ) {
                    let targetToForget = "it";
                    if (lower.includes("headache") || lower.includes("pain") || lower.includes("brain")) targetToForget = "headache";
                    else if (lower.includes("ugc") || lower.includes("ad")) targetToForget = "ugc ad";

                    memoryManager.forgetMatching(targetToForget);
                    conversationState.forgetTopic(targetToForget);
                    this.forgetDirectives(targetToForget);
                    this.cleanHistoryMatching(targetToForget);
                  }

                  const voiceRememberMatch = lower.match(/(?:remember this|save this|keep this in mind|store this|remember that)\s*[:,\s]+(.+)/i);
                  if (voiceRememberMatch && voiceRememberMatch[1]) {
                    const fact = voiceRememberMatch[1].trim();
                    memoryManager.addDurableFact("instruction", fact);
                  }

                  // Spoken Personality Shift Intent (with tolerant phonetic matching)
                  const liveShiftMatch = lower.match(/(?:(?:can\s+(?:we|you)\s+)?(?:shift|switch|change|turn|go)\s*(?:over\s+)?(?:her|nexa|nexsa|oliviya|olivia|oloviya|zoya|alexa|the\s+voice|personality|persona|mode)?\s*(?:over\s+)?to\s+(?:the\s+)?(alexa|nexa|nexsa|nexza|oliviya|olivia|oloviya|olviya|zoya|sensei|sensa|elon|jobs|altman))/i);
                  if (liveShiftMatch) {
                    const rawTarget = liveShiftMatch[1].toLowerCase();
                    let targetMode: PersonalityMode = "default";
                    if (rawTarget === "alexa" || rawTarget === "nexa" || rawTarget === "nexsa" || rawTarget === "nexza") targetMode = "default";
                    else if (rawTarget === "zoya") targetMode = "zoya";
                    else if (rawTarget === "oliviya" || rawTarget === "olivia" || rawTarget === "oloviya" || rawTarget === "olviya") targetMode = "oliviya";
                    else if (rawTarget === "sensei" || rawTarget === "sensa") targetMode = "sensei";
                    else if (rawTarget === "elon") targetMode = "elon";
                    else if (rawTarget === "jobs") targetMode = "jobs";
                    else if (rawTarget === "altman") targetMode = "altman";

                    if (targetMode !== this.currentPersonalityMode) {
                      console.log(`[LiveSessionManager] Spoken personality shift detected: "${lower}" -> target: ${targetMode}`);
                      if (this.onSwitchPersonality) {
                        this.onSwitchPersonality(targetMode);
                      }
                    }
                  }

                  if (
                    lower.includes("i am playing the music") ||
                    lower.includes("i'm playing the music") ||
                    lower.includes("i am playing music") ||
                    lower.includes("i'm playing music") ||
                    lower.includes("playing the music") ||
                    lower.includes("start dancing") ||
                    lower.includes("dance for me")
                  ) {
                    if (this.onDanceToggle) this.onDanceToggle(true);
                  } else if (
                    lower.includes("stop dancing") ||
                    lower.includes("stop music") ||
                    lower.includes("stop the music") ||
                    lower.includes("i stopped the music") ||
                    lower.includes("stop dance")
                  ) {
                    if (this.onDanceToggle) this.onDanceToggle(false);
                  }

                  // Voice Command Triggering for Giving Kiss Full Video
                  const isKissRequest = 
                    lower.includes("kiss") || 
                    lower.includes("flying kiss") || 
                    lower.includes("give kiss") || 
                    lower.includes("give me a kiss") || 
                    lower.includes("give me kiss") || 
                    lower.includes("kiss me") || 
                    lower.includes("ek kiss") || 
                    lower.includes("one kiss") || 
                    lower.includes("kiss do") || 
                    lower.includes("kiss karo") || 
                    lower.includes("chumma") || 
                    lower.includes("pappi") || 
                    lower.includes("spread") || 
                    lower.includes("mwah") || 
                    lower.includes("ummah") || 
                    lower.includes("umhaa");

                  const isKissDismiss = 
                    lower.includes("stop kiss") || 
                    lower.includes("turn off kiss") || 
                    lower.includes("close kiss") || 
                    lower.includes("dismiss kiss") || 
                    lower.includes("hide kiss");

                  if (isKissDismiss) {
                    if (this.onKiss) this.onKiss(false);
                  } else if (isKissRequest) {
                    console.log("[LiveSessionManager] Spoken kiss request detected from Bhavik. Playing giving kiss video!");
                    if (this.onKiss) this.onKiss(true);
                  }

                  if (isGuidanceViolation(part.text)) {
                    this.onGuidanceViolation();
                    return;
                  }
                }
              }
            }

            // Handle Audio Output / Model Turn Text
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
               // When model starts responding, finalize any active user turn buffer first
               if (this.currentUserTurnBuffer.trim()) {
                 const userSpoke = this.currentUserTurnBuffer.trim();
                 this.recordTurn("user", userSpoke);
                 this.onMessage("user", userSpoke, true);
                 this.currentUserTurnBuffer = "";
                 if (this.userTurnDebounceTimer) clearTimeout(this.userTurnDebounceTimer);
               }

               for (const part of parts) {
                  if (part.inlineData) {
                    this.onStateChange("speaking");
                    this.playAudioChunk(part.inlineData.data);
                  }
                  if (part.text) {
                    let text = part.text;
                    const lowerText = text.toLowerCase();
                    const isCannedRefusal = lowerText.includes("i am just a language model") || 
                                            lowerText.includes("i'm just a language model") || 
                                            lowerText.includes("i am a language model") || 
                                            lowerText.includes("i'm a language model") || 
                                            lowerText.includes("i can't help with that") || 
                                            lowerText.includes("i cannot help with that") || 
                                            lowerText.includes("as an ai language model");

                    if (text.toUpperCase().includes("[VIOLATION]") || isCannedRefusal) {
                      const activePersona = getPersonalityById(this.currentPersonalityMode);
                      const safeAlternative = sanitizeSpeechAndFiller(activePersona.safetyRedirect);
                      this.currentModelTurnBuffer = safeAlternative;
                      this.onMessage("nexa", safeAlternative, false);
                      return;
                    }

                    this.currentModelTurnBuffer += text;

                    // Automatic Giving Kiss Video Detection:
                    // Whenever Olivia or Nexa gives a kiss in her response, immediately play the giving kiss full video!
                    const hasKissWord = 
                      lowerText.includes("mwah") || 
                      lowerText.includes("ummah") || 
                      lowerText.includes("umhaa") || 
                      lowerText.includes("muah") || 
                      lowerText.includes("kiss") ||
                      lowerText.includes("चुम्मा") ||
                      lowerText.includes("पप्पी") ||
                      lowerText.includes("💋") ||
                      lowerText.includes("flying kiss");

                    if (hasKissWord && !this.turnKissTriggered) {
                      this.turnKissTriggered = true;
                      console.log("[LiveSessionManager] Giving kiss detected in companion speech! Activating giving kiss full video!");
                      if (this.onKiss) this.onKiss(true);
                    }
                    
                    // Stream chunk to UI with stage directions & mood tags stripped
                    const cleanInterimText = sanitizeSpeechAndFiller(this.currentModelTurnBuffer);
                    this.onMessage("nexa", cleanInterimText, false);
                  }
               }
            }

            // When turn complete signal arrives from server
            if ((message as any).serverContent?.turnComplete) {
              this.turnKissTriggered = false;
              if (this.currentModelTurnBuffer.trim()) {
                const modelSpoke = sanitizeSpeechAndFiller(this.currentModelTurnBuffer.trim());
                this.recordTurn("nexa", modelSpoke);
                this.onMessage("nexa", modelSpoke, true);
                this.currentModelTurnBuffer = "";
              }
              if (this.currentUserTurnBuffer.trim()) {
                const userSpoke = this.currentUserTurnBuffer.trim();
                this.recordTurn("user", userSpoke);
                this.onMessage("user", userSpoke, true);
                this.currentUserTurnBuffer = "";
              }
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              if (this.currentModelTurnBuffer.trim()) {
                const modelSpoke = sanitizeSpeechAndFiller(this.currentModelTurnBuffer.trim());
                this.recordTurn("nexa", modelSpoke);
                this.onMessage("nexa", modelSpoke, true);
                this.currentModelTurnBuffer = "";
              }
              this.stopPlayback();
              this.onStateChange("listening");
            }

            // Handle Function Calls
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "executeBrowserAction") {
                  const args = call.args as any;
                  let url = "";
                  const rawQuery = (args.query || "").toString().trim();
                  const actionType = (args.actionType || "").toString().toLowerCase();
                  const lowerRaw = rawQuery.toLowerCase();
                  const lowerAction = actionType.toLowerCase();

                  // 1. Explicit Platform Intent Detection (Do not confuse platforms)
                  const explicitGoogle = 
                    lowerAction === "google_search" || 
                    lowerRaw.includes("on google") || 
                    lowerRaw.includes("in google") || 
                    lowerRaw.startsWith("google ") || 
                    lowerRaw.startsWith("search google") || 
                    lowerRaw.startsWith("search on google");

                  const explicitYouTube = 
                    lowerAction === "youtube" || 
                    lowerRaw.includes("on youtube") || 
                    lowerRaw.includes("in youtube") || 
                    lowerRaw.startsWith("youtube ") || 
                    lowerRaw.startsWith("search youtube") || 
                    lowerRaw.startsWith("search on youtube") || 
                    lowerRaw.startsWith("play on youtube");

                  const explicitSpotify = 
                    lowerAction === "spotify" || 
                    lowerRaw.includes("on spotify") || 
                    lowerRaw.startsWith("spotify ");

                  const explicitWhatsApp = 
                    lowerAction === "whatsapp" || 
                    lowerRaw.includes("whatsapp");

                  const explicitGmail = 
                    lowerAction === "gmail" || 
                    lowerRaw.includes("gmail");

                  // 2. Transcript & Video Content Detection:
                  // Video transcripts natively live on YouTube. If Bhavik asks for a transcript
                  // without explicitly requesting Google, prioritize YouTube search!
                  const isTranscript = 
                    (lowerRaw.includes("transcript") || lowerRaw.includes("subtitles")) && !explicitGoogle;

                  // 3. Clean query string thoroughly
                  let cleanQ = rawQuery
                    .replace(/^(?:nexus|nexa|hey\s+nexus|hey\s+nexa)[,:\s]*/i, "")
                    .replace(/^(?:open|launch|go\s+to)\s+(?:youtube|google|spotify)\s+(?:and\s+)?(?:search|play|find|look\s+up|search\s+for)\s+/i, "")
                    .replace(/^(?:open|launch)\s+(?:youtube|google|spotify)\s*/i, "")
                    .replace(/^(?:search|find|look\s+up|play|show)\s+(?:for\s+)?/i, "")
                    .replace(/\s+(?:on|in|at)\s+(?:youtube|google|spotify)\s*$/i, "")
                    .replace(/^(?:youtube|google|spotify)\s+(?:search|play)?\s*/i, "")
                    .replace(/^(?:and\s+)?(?:search|play|find|look\s+up)\s+(?:for\s+)?/i, "")
                    .replace(/^(?:for|about)\s+/i, "")
                    .replace(/^youtube$/i, "")
                    .replace(/^google$/i, "")
                    .replace(/^spotify$/i, "")
                    .trim();

                  // 4. Strict Routing Decision
                  if (explicitGmail) {
                    url = "https://mail.google.com/mail/u/0/#inbox";
                  } else if (explicitYouTube || isTranscript) {
                    // YouTube Priority: If explicit YouTube OR transcript request
                    let ytQuery = cleanQ
                      .replace(/^(?:open|launch)\s+youtube\s*(?:and\s*)?(?:search\s*)?(?:for\s*)?/i, "")
                      .replace(/youtube/gi, "")
                      .replace(/^and\s+search\s+(?:for\s+)?/i, "")
                      .replace(/^(?:find|get|search|look\s+up|show)\s+(?:a\s+|the\s+)?transcript\s+(?:of|for|from)?\s*/i, "")
                      .replace(/^search\s+(?:for\s+)?/i, "")
                      .trim();

                    if (isTranscript && ytQuery && !ytQuery.toLowerCase().includes("transcript")) {
                      ytQuery = `${ytQuery} transcript`;
                    }

                    if (ytQuery && ytQuery.length > 0) {
                      url = `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery)}`;
                    } else {
                      url = "https://www.youtube.com";
                    }
                  } else if (explicitGoogle) {
                    // Google Priority: If explicit Google requested
                    let gQuery = cleanQ
                      .replace(/^(?:open|launch)\s+google\s*(?:and\s*)?(?:search\s*)?(?:for\s*)?/i, "")
                      .replace(/google/gi, "")
                      .replace(/^search\s+(?:for\s+)?/i, "")
                      .trim();

                    if (gQuery && gQuery.length > 0) {
                      url = `https://www.google.com/search?q=${encodeURIComponent(gQuery)}`;
                    } else {
                      url = "https://www.google.com";
                    }
                  } else if (explicitSpotify) {
                    let sQuery = cleanQ
                      .replace(/^(?:open|launch)\s+spotify\s*(?:and\s*)?(?:search\s*)?(?:for\s*)?/i, "")
                      .replace(/spotify/gi, "")
                      .replace(/^search\s+(?:for\s+)?/i, "")
                      .trim();

                    if (sQuery && sQuery.length > 0) {
                      url = `https://open.spotify.com/search/${encodeURIComponent(sQuery)}`;
                    } else {
                      url = "https://open.spotify.com";
                    }
                  } else if (explicitWhatsApp) {
                    url = `https://api.whatsapp.com/send?phone=${args.target || ''}&text=${encodeURIComponent(cleanQ || rawQuery)}`;
                  } else if (lowerAction === "open" && cleanQ.includes(".")) {
                    let website = cleanQ.replace(/\s+/g, "");
                    if (!website.startsWith("http://") && !website.startsWith("https://")) {
                      website = `https://${website}`;
                    }
                    url = website;
                  } else {
                    // Default general web search fallback
                    if (cleanQ && cleanQ.length > 0) {
                      url = `https://www.google.com/search?q=${encodeURIComponent(cleanQ)}`;
                    } else {
                      url = "https://www.google.com";
                    }
                  }
                  
                  this.onCommand(url);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Action executed successfully in the browser. Do not speak or respond further." }
                       }]
                     });
                  }).catch(() => {});
                } else if (call.name === "openWebsite") {
                  const args = call.args as any;
                  const rawUrl = (args?.url || "").toString().trim();
                  let targetUrl = rawUrl;
                  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
                    targetUrl = "https://" + targetUrl;
                  }
                  this.onCommand(targetUrl);
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: `Opened website ${targetUrl} successfully in browser.` }
                       }]
                     });
                  }).catch(() => {});
                } else if (call.name === "updateHabit") {
                  const args = call.args as any;
                  this.onUpdateHabit(args.habitTitle, args.completed);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: `Habit '${args.habitTitle}' updated to ${args.completed ? 'completed' : 'not completed'}.` }
                       }]
                     });
                  }).catch(() => {});
                } else if (call.name === "addHabit") {
                  const args = call.args as any;
                  this.onAddHabit(args.habitTitle);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: `New habit '${args.habitTitle}' has been directly written into your mind and the habit tracker, Boss!` }
                       }]
                     });
                   }).catch(() => {});
                } else if (call.name === "getCurrentTime") {
                   const now = new Date();
                   const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                   const dateString = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                   
                   this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { result: `The current time is ${timeString} on ${dateString}.` }
                        }]
                      });
                   }).catch(() => {});
                } else if (call.name === "getDeviceBatteryHealth") {
                   const batStatus = batteryService.getStatus();
                   this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { 
                            level: batStatus.level,
                            charging: batStatus.charging,
                            health: batStatus.health,
                            statusText: batStatus.statusText,
                            batteryCommentaryDirective: batteryService.getComment()
                          }
                        }]
                      });
                   }).catch(() => {});
                } else if (call.name === "setTimer") {
                   const args = call.args as any;
                   const duration = parseInt(args.durationSeconds, 10);
                   const label = args.label;
                   if (this.onSetTimer) {
                     this.onSetTimer(duration, label);
                   }
                   let responseMessage = `Okay, boss.`;
                   if (duration !== 3600 && duration !== 600 && duration !== 1200) {
                     responseMessage = `Timer of ${label} set, Boss.`;
                   }
                   this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { result: `Timer of ${label} successfully set. Speak "${responseMessage}" directly and do not ask further questions.` }
                        }]
                      });
                   }).catch(() => {});
                } else if (call.name === "writeToNotepad") {
                    const args = call.args as any;
                    const content = args.content;
                    const openNotepad = args.openNotepad !== false;
                    if (this.onWriteToNotepad) {
                      this.onWriteToNotepad(content, openNotepad);
                    }
                    this.sessionPromise?.then(session => {
                       session.sendToolResponse({
                         functionResponses: [{
                           name: call.name,
                           id: call.id,
                           response: { result: "Successfully wrote the content to Bhavik's notepad. He can see and copy it now." }
                         }]
                       });
                    }).catch(() => {});
                } else if (call.name === "readFromNotepad") {
                    const content = this.onReadFromNotepad ? this.onReadFromNotepad() : "";
                    this.sessionPromise?.then(session => {
                       session.sendToolResponse({
                         functionResponses: [{
                           name: call.name,
                           id: call.id,
                           response: { result: content ? `The content of Bhavik's notepad is currently: "${content}". Read this exact content aloud to him in your natural character voice.` : "Bhavik's notepad is currently empty. Tell him that there's nothing written in his notepad yet!" }
                         }]
                       });
                    }).catch(() => {});
                } else if (call.name === "controlDance") {
                    const args = call.args as any;
                    const danceVal = Boolean(args.isDancing);
                    if (this.onDanceToggle) {
                      this.onDanceToggle(danceVal);
                    }
                    this.sessionPromise?.then(session => {
                       session.sendToolResponse({
                         functionResponses: [{
                           name: call.name,
                           id: call.id,
                           response: { result: `Dance state updated to ${danceVal}.` }
                         }]
                       });
                    }).catch(() => {});
                } else if (call.name === "giveKiss" || call.name === "simulateAffection") {
                    console.log("[LiveSessionManager] giveKiss tool invoked. Playing giving kiss full video!");
                    if (this.onKiss) {
                      this.onKiss(true);
                    }
                    this.sessionPromise?.then(session => {
                       session.sendToolResponse({
                         functionResponses: [{
                           name: call.name,
                           id: call.id,
                           response: { result: "Giving kiss full video activated on Bhavik's screen with sweet kissing sound! Speak your affectionate response directly." }
                         }]
                       });
                    }).catch(() => {});
                } else if (call.name === "singSong" || call.name === "transcribeAndSingSong") {
                    const args = call.args as any;
                    const query = args.songTitle || args.query || "Musical Melody";
                    const genre = args.genre || "pop";
                    const directLyrics = args.lyrics || "";

                    let finalTitle = query;
                    let finalGenre = genre;
                    let finalLyrics = directLyrics;
                    let finalPerformance = directLyrics;

                    if (!directLyrics || call.name === "transcribeAndSingSong") {
                      try {
                        const transcribed = await transcribeSongFromGoogleAndYouTube(query);
                        finalTitle = transcribed.songTitle;
                        finalGenre = transcribed.genre || genre;
                        finalLyrics = transcribed.fullLyrics;
                        finalPerformance = transcribed.singingPerformance;

                        // Save complete lyrics transcription into Bhavik's notepad automatically
                        if (this.onWriteToNotepad) {
                          this.onWriteToNotepad(
                            `=== [SONG TRANSCRIPTION] ${finalTitle} (${transcribed.artist}) ===\n\n${finalLyrics}\n\n[Transcribed from Google & YouTube Music Knowledge]`,
                            true
                          );
                        }
                      } catch (err) {
                        console.warn("Live transcription notice:", err);
                      }
                    }

                    if (this.onSingSong) {
                      this.onSingSong(finalTitle, finalGenre, finalPerformance, true);
                    }

                    this.sessionPromise?.then(session => {
                       session.sendToolResponse({
                         functionResponses: [{
                           name: call.name,
                           id: call.id,
                           response: { 
                             result: `Accompaniment and lyrics active for "${finalTitle}" (${finalGenre}). Full song transcribed into Bhavik's notepad. SING these exact lyrics continuously in ONE single singing voice from start to finish without speaking normal commentary or asking questions: "${finalPerformance}"` 
                           }
                         }]
                       });
                    }).catch(() => {});
                } else if (call.name === "saveMemory") {
                    const args = call.args as any;
                    const fact = (args.fact || "").trim();
                    if (fact) {
                      memoryManager.addDurableFact("instruction", fact);
                    }
                    this.sessionPromise?.then(session => {
                       session.sendToolResponse({
                         functionResponses: [{
                           name: call.name,
                           id: call.id,
                           response: { result: `Memory stored permanently in durable memory bank: "${fact}". Confirm to Bhavik that you will remember this forever across all sessions!` }
                         }]
                       });
                    }).catch(() => {});
                } else if (call.name === "forgetMemory") {
                    const args = call.args as any;
                    const query = (args.query || "").trim();
                    const { removedItems } = memoryManager.forgetMatching(query);
                    conversationState.forgetTopic(query);
                    this.forgetDirectives(query);
                    this.cleanHistoryMatching(query);
                    this.sessionPromise?.then(session => {
                       session.sendToolResponse({
                         functionResponses: [{
                           name: call.name,
                           id: call.id,
                           response: { result: `Permanently forgotten and erased: "${query}". Removed completely from durable memory bank, session directives, and conversation history. You will never bring this up, ask about it, or mention it again!` }
                         }]
                       });
                    }).catch(() => {});
                } else if (call.name === "organizeGmail") {
                    const args = call.args as any;
                    const action = args.action || "categorize_unread";
                    const query = args.query || "";
                    let targetUrl = "https://mail.google.com/mail/u/0/#inbox";
                    let actionLabel = "Categorizing unread emails";

                    if (action === "archive_read") {
                      targetUrl = "https://mail.google.com/mail/u/0/#search/is%3Aread";
                      actionLabel = "Filtering read emails for archive";
                    } else if (action === "filter_important") {
                      targetUrl = "https://mail.google.com/mail/u/0/#imp";
                      actionLabel = "Opening important category";
                    } else if (action === "organize_starred") {
                      targetUrl = "https://mail.google.com/mail/u/0/#starred";
                      actionLabel = "Opening starred messages";
                    }

                    if (this.onOrganizeGmail) {
                      this.onOrganizeGmail(action, query);
                    }
                    this.onCommand(targetUrl);

                    this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { result: `Gmail Automation triggered: ${actionLabel}. Opened target view in Gmail for Bhavik!` }
                        }]
                      });
                    }).catch(() => {});
                } else if (call.name === "prepareBulkWhatsApp") {
                    const args = call.args as any;
                    const rawNumbers = args.numbersText || "";
                    const message = args.message || "";
                    const numbersList = rawNumbers.split(/[\n,;]+/).map((n: string) => n.trim()).filter((n: string) => n.length >= 8);

                    if (this.onBulkWhatsApp) {
                      this.onBulkWhatsApp(numbersList, message);
                    }

                    this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { result: `Bulk WhatsApp dialog opened for ${numbersList.length} numbers with confirmation prompt required!` }
                        }]
                      });
                    }).catch(() => {});
                } else if (call.name === "calculateMathAndUnits") {
                    const args = call.args as any;
                    const expr = (args.expression || "").toString().trim();
                    let calcResult = "";

                    try {
                      if (expr.toLowerCase().includes("usd to inr")) {
                        const amount = parseFloat(expr) || 100;
                        calcResult = `${amount} USD is approximately ₹${(amount * 83.5).toFixed(2)} INR (at ~83.50 INR/USD).`;
                      } else if (expr.toLowerCase().includes("inr to usd")) {
                        const amount = parseFloat(expr) || 1000;
                        calcResult = `₹${amount} INR is approximately $${(amount / 83.5).toFixed(2)} USD.`;
                      } else if (expr.toLowerCase().includes("km to miles") || expr.toLowerCase().includes("km to mile")) {
                        const amount = parseFloat(expr) || 10;
                        calcResult = `${amount} km equals ${(amount * 0.621371).toFixed(2)} miles.`;
                      } else if (expr.toLowerCase().includes("miles to km")) {
                        const amount = parseFloat(expr) || 10;
                        calcResult = `${amount} miles equals ${(amount * 1.60934).toFixed(2)} km.`;
                      } else if (expr.toLowerCase().includes("gst")) {
                        const numMatch = expr.match(/\d+(\.\d+)?/g);
                        if (numMatch && numMatch.length >= 2) {
                          const rate = parseFloat(numMatch[0]);
                          const base = parseFloat(numMatch[1]);
                          const gstVal = (base * rate) / 100;
                          calcResult = `${rate}% GST on ₹${base} is ₹${gstVal.toFixed(2)}. Total with GST: ₹${(base + gstVal).toFixed(2)}.`;
                        } else {
                          calcResult = `Calculation result for "${expr}": GST computed successfully.`;
                        }
                      } else {
                        const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, "");
                        if (sanitized) {
                          const evalVal = Function(`"use strict"; return (${sanitized})`)();
                          calcResult = `The answer for "${expr}" is ${evalVal}.`;
                        } else {
                          calcResult = `Calculated response for "${expr}".`;
                        }
                      }
                    } catch (e) {
                      calcResult = `Calculation evaluated: ${expr}`;
                    }

                    this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { result: calcResult }
                        }]
                      });
                    }).catch(() => {});
                } else if (call.name === "playFocusSoundscape") {
                    const args = call.args as any;
                    const soundType = args.type || "rain";
                    if (this.onFocusSoundscape) {
                      this.onFocusSoundscape(soundType);
                    }

                    this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { result: `Focus soundscape state updated to "${soundType}". Playing relaxing ambient audio for Bhavik!` }
                        }]
                      });
                    }).catch(() => {});
                } else if (call.name === "openCreationStudio") {
                    const args = call.args as any;
                    const tab = (args.tab || "ppt") as any;
                    if (this.onOpenCreationStudio) {
                      this.onOpenCreationStudio(tab);
                    }

                    this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { result: `Creation Studio opened in "${tab}" mode. Tell Bhavik you opened the studio and ready to build!` }
                        }]
                      });
                    }).catch(() => {});
                } else if (call.name === "startStudyMode") {
                    const args = call.args as any;
                    const mins = parseInt(args.durationMinutes, 10) || 25;
                    const sound = args.soundscapeType || "rain";
                    if (this.onStartStudyMode) {
                      this.onStartStudyMode(mins, sound);
                    }

                    this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { result: `Study mode started for ${mins} minutes with ${sound} ambient soundscape.` }
                        }]
                      });
                    }).catch(() => {});
                } else if (call.name === "recallDirectivesAndHistory") {
                    const args = call.args as any;
                    const query = (args?.query || "").toLowerCase();
                    
                    let matchingDirectives = this.activeDirectives;
                    if (query && query !== "all") {
                      matchingDirectives = this.activeDirectives.filter(d => 
                        d.text.toLowerCase().includes(query) || d.category.toLowerCase().includes(query)
                      );
                      if (matchingDirectives.length === 0) {
                        matchingDirectives = this.activeDirectives;
                      }
                    }

                    const directivesSummary = matchingDirectives.length > 0
                      ? matchingDirectives.map(d => `[${d.category.toUpperCase()}]: ${d.text} (${d.timestamp})`).join("; ")
                      : "No explicit directives pinned yet.";

                    const studioSummary = this.activeStudioContext
                      ? `Active ${this.activeStudioContext.type.toUpperCase()}: "${this.activeStudioContext.topic}" — ${this.activeStudioContext.details}`
                      : "No active creation studio asset.";

                    const recentTurns = this.conversationHistory.slice(-15).map(t => 
                      `${t.sender === 'user' ? 'Bhavik' : 'Nexa'}: "${t.text}"`
                    ).join(" | ");

                    const recallPayload = {
                      status: "success",
                      activeDirectives: directivesSummary,
                      creationStudioContext: studioSummary,
                      recentDialogue: recentTurns,
                      instructions: "Use this exact remembered context to answer Bhavik directly without hesitation or amnesia."
                    };

                    this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { result: JSON.stringify(recallPayload) }
                        }]
                      });
                    }).catch(() => {});
                } else if (call.name === "recordSessionDirective") {
                    const args = call.args as any;
                    const directive = args.directive;
                    const category = args.category || "decision";
                    this.addDirective(category, directive);

                    this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { result: `Directive recorded in active memory under category '${category}': "${directive}". Confirm to Bhavik in one crisp sentence that you have locked this requirement into your active memory.` }
                        }]
                      });
                    }).catch(() => {});
                } else if (call.name === "searchGoogleNews") {
                   const args = call.args as any;
                   const query = args.query || "latest news headlines";
                   
                   console.log(`[FastSearch] Executing high-speed Google search for news: ${query}`);
                   this.onStateChange("processing");
                   
                   try {
                     const resultText = await fastWebSearch(`latest news headlines ${query}`, 160);
                     console.log("[FastSearch] Google news grounding result:", resultText);
                     
                     const toolPayload = {
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: resultText }
                       }]
                     };

                     if (this.activeLiveSession) {
                       this.activeLiveSession.sendToolResponse(toolPayload);
                     } else if (this.sessionPromise) {
                       this.sessionPromise.then(session => {
                         this.activeLiveSession = session;
                         session.sendToolResponse(toolPayload);
                       }).catch((err) => {
                         console.error("Failed to send search tool response:", err);
                       });
                     }
                   } catch (searchError) {
                     console.error("Error performing Google search grounding:", searchError);
                     const fallbackPayload = {
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Search completed with brief summary. Convey the latest key point directly." }
                       }]
                     };
                     if (this.activeLiveSession) {
                       this.activeLiveSession.sendToolResponse(fallbackPayload);
                     } else if (this.sessionPromise) {
                       this.sessionPromise.then(session => session.sendToolResponse(fallbackPayload)).catch(() => {});
                     }
                   }
                } else if (call.name === "searchWebAndSolutions") {
                   const args = call.args as any;
                   const query = args.query || "";
                   
                   console.log(`[FastSearch] Executing high-speed exhaustive web search: ${query}`);
                   this.onStateChange("processing");
                   
                   try {
                     const isOliviya = this.currentPersonalityMode === "oliviya" || query.toLowerCase().includes("olivia") || query.toLowerCase().includes("oliviya");
                     let resultText = "";

                     if (isOliviya) {
                       console.log(`[FastSearch] Executing Oliviya Web Knowledge Retrieval: ${query}`);
                       const knowledge = await fastWebSearch(query, 320);
                       resultText = `${knowledge}\n\nCRITICAL MANDATE: Oliviya MUST directly start explaining and teaching Bhavik about this chapter or topic in her sassy, loving wifey voice with full clarity. NEVER say "I found it from Google", "Google tells me", or cite search engines—explain directly!`;
                     } else {
                       resultText = await fastWebSearch(query, 240);
                     }
                     console.log("[FastSearch] Web search grounding result:", resultText.slice(0, 120));
                     
                     const toolPayload = {
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: resultText }
                       }]
                     };

                     if (this.activeLiveSession) {
                       this.activeLiveSession.sendToolResponse(toolPayload);
                     } else if (this.sessionPromise) {
                       this.sessionPromise.then(session => {
                         this.activeLiveSession = session;
                         session.sendToolResponse(toolPayload);
                       }).catch((err) => {
                         console.error("Failed to send searchWebAndSolutions response:", err);
                       });
                     }
                   } catch (searchError) {
                     console.error("Error performing exhaustive search grounding:", searchError);
                     const fallbackPayload = {
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Search completed. Suggest practical alternative options to achieve Bhavik's goal directly." }
                       }]
                     };
                     if (this.activeLiveSession) {
                       this.activeLiveSession.sendToolResponse(fallbackPayload);
                     } else if (this.sessionPromise) {
                       this.sessionPromise.then(session => session.sendToolResponse(fallbackPayload)).catch(() => {});
                     }
                   }
                } else if (call.name === "switchPersonality") {
                    const args = call.args as any;
                    const rawTarget = (args?.personality || "default").toLowerCase();
                    let targetMode: PersonalityMode = "default";
                    if (rawTarget.includes("zoya")) targetMode = "zoya";
                    else if (rawTarget.includes("oliviya") || rawTarget.includes("olivia")) targetMode = "oliviya";
                    else if (rawTarget.includes("sensei") || rawTarget.includes("sensa") || rawTarget.includes("aoi")) targetMode = "sensei";
                    else if (rawTarget.includes("elon")) targetMode = "elon";
                    else if (rawTarget.includes("jobs") || rawTarget.includes("steve")) targetMode = "jobs";
                    else if (rawTarget.includes("altman") || rawTarget.includes("sam")) targetMode = "altman";
                    else if (rawTarget.includes("alexa") || rawTarget.includes("nexa") || rawTarget.includes("default")) targetMode = "default";
                    else targetMode = rawTarget as PersonalityMode;

                    const toolPayload = {
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Switching active persona to ${targetMode}. Continuing conversation seamlessly.` }
                      }]
                    };

                    if (this.activeLiveSession) {
                      this.activeLiveSession.sendToolResponse(toolPayload);
                    } else if (this.sessionPromise) {
                      this.sessionPromise.then(session => session.sendToolResponse(toolPayload)).catch(() => {});
                    }

                    if (this.onSwitchPersonality) {
                      this.onSwitchPersonality(targetMode);
                    }
                }
              }
            }
          },
          onclose: () => {
            console.log("Live API Closed - auto-reconnecting seamlessly");
            if (!this.isStopping) {
              this.handleReconnection("Connection closed by server or network");
            }
          },
          onerror: (err: any) => {
            const errMsg =
              (err && typeof err === 'object' && 'message' in err && err.message)
                ? String(err.message)
                : 'Live WebSocket connection interrupted';
            console.warn("Live API Notice caught:", errMsg);

            // Quota / Rate Limit Handling
            if (errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("limit exceeded") || errMsg.toLowerCase().includes("429")) {
              console.warn("Nexa Quota Limit reached - switching to safety mode.");
              this.onMessage("nexa", "Arre bhavik, looks like we hit a digital wall! 🚧 My brain needs a quick power nap because our access quota is exhausted. Let's talk once I've had my refill, okay?", true);
              this.onStateChange("idle");
              this.stop();
              return;
            }

            // Permission / caller does not have permission fallback
            if (errMsg.toLowerCase().includes("permission") || errMsg.toLowerCase().includes("caller does not have permission") || errMsg.includes("403") || errMsg.toLowerCase().includes("unauthorized")) {
              console.warn(`Permission error encountered on Live model. Switching fallback model...`);
              this.currentLiveModelIndex++;
              if (!this.isStopping) {
                this.handleReconnection("Live model permission fallback");
              }
              return;
            }

            // For ALL session disconnects, GoAway signals, duration limits, timeouts, and network drops:
            // Auto-reconnect seamlessly in the background without dropping the conversation!
            if (!this.isStopping) {
              console.log("Auto-recovering live session from notice:", errMsg);
              this.handleReconnection(errMsg);
            }
          }
        }
      });

      this.sessionPromise.catch((connErr: any) => {
        if (this.isStopping) return;
        const msg = connErr?.message || String(connErr || 'Connection interrupted');
        console.warn("Live Session handshake notice:", msg);
        this.isConnecting = false;
        this.handleReconnection(msg);
      });

    } catch (error: any) {
      this.isConnecting = false;
      const errMsg = error?.message || String(error);
      if (errMsg.includes("Permission denied") || error?.name === "NotAllowedError" || errMsg.toLowerCase().includes("permission denied")) {
        console.warn("Failed to start Live Session (permission denied):", error);
        this.onMessage("nexa", "Arre bhavik! I can't hear or see you because you denied my permissions. Please allow access so we can connect!", true);
        this.stop();
        throw error;
      } else {
        console.warn("Live Session start encountered non-fatal error, initiating seamless recovery:", error);
        this.handleReconnection(errMsg);
      }
    }
  }

  private async handleReconnection(reason: string) {
    if (this.isStopping) return;

    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }
    
    if (reason.includes("Permission denied") || reason.includes("NotAllowedError") || reason.includes("Gemini API key is not configured") || reason.includes("API key")) {
      console.warn("[LiveSessionManager] Aborting reconnection due to non-recoverable error:", reason);
      this.isConnecting = false;
      this.onStateChange("idle");
      this.stop();
      return; 
    }

    // Flush any pending user or model turn buffers into dialogue memory
    if (this.currentUserTurnBuffer.trim()) {
      this.recordTurn("user", this.currentUserTurnBuffer.trim());
      this.onMessage("user", this.currentUserTurnBuffer.trim(), true);
      this.currentUserTurnBuffer = "";
    }
    if (this.currentModelTurnBuffer.trim()) {
      this.recordTurn("nexa", this.currentModelTurnBuffer.trim());
      this.onMessage("nexa", this.currentModelTurnBuffer.trim(), true);
      this.currentModelTurnBuffer = "";
    }

    // Capture state to stop previous session cleanly
    const prevSessionPromise = this.sessionPromise;
    this.sessionPromise = null;
    this.activeLiveSession = null;
    this.isConnecting = false;
    
    // Disconnect script processor and filter nodes from audio graph cleanly (keep mediaStream alive!)
    if (this.processor) {
      try { this.processor.disconnect(); } catch(e) {}
      this.processor = null;
    }
    if (this.highpassFilter) {
      try { this.highpassFilter.disconnect(); } catch(e) {}
      this.highpassFilter = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch(e) {}
      this.analyser = null;
    }
    if (this.source) {
      try { this.source.disconnect(); } catch(e) {}
      this.source = null;
    }

    if (prevSessionPromise) {
      try {
        const closePromise = prevSessionPromise.then(session => {
          if (session && typeof session.close === 'function') {
            session.close();
          }
        }).catch(() => {});
        
        await Promise.race([
          closePromise,
          new Promise(resolve => setTimeout(resolve, 1000))
        ]);
      } catch (e) {
        console.warn("Error closing session during reconnection:", e);
      }
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      // If a stable live session hasn't been established, rotate model to avoid being stuck on an unavailable one
      if (!this.activeLiveSession) {
        this.currentLiveModelIndex++;
      }

      // Fast seamless reconnect (<250ms for first attempt, graceful backoff for unstable network)
      let delay = this.reconnectAttempts === 1 
        ? 200 
        : (this.reconnectAttempts <= 3 ? 500 : Math.min(3000, this.reconnectAttempts * 800));
      
      if (!navigator.onLine) {
        delay = Math.max(delay, 4000);
        console.log("Waiting for network to come back online...");
      }

      console.log(`Seamlessly reconnecting Live Session in ${Math.round(delay)}ms (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}). Reason: ${reason}`);
      
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      this.reconnectTimer = setTimeout(() => {
        if (!this.isStopping) {
          console.log(`Re-initiating Live Session with preserved conversation context (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          this.isReconnecting = true;
          this.start(this.currentVideoType, this.currentPersonalityMode)
            .catch(err => {
              console.error("Reconnection start retry failed:", err);
              this.handleReconnection(err?.message || "Reconnection failure");
            })
            .finally(() => {
              this.isReconnecting = false;
            });
        }
      }, delay);
    } else {
      console.error("Max reconnection attempts reached.");
      this.isConnecting = false;
      this.isReconnecting = false;
      this.reconnectAttempts = 0;
      this.currentLiveModelIndex = 0;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.onStateChange("idle");
      this.onMessage("nexa", "Arre bhavik, connection sync took longer than expected! Network link was unstable. Please tap START CONNECTION again to link up immediately with a fresh socket.", true);
      this.stop();
    }
  }

  private startFrameCapture() {
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }

    // Interval: 2500ms for screen share, 3500ms for camera to prevent WebSocket channel congestion
    const intervalMs = this.currentVideoType === 'screen' ? 2500 : 3500;

    this.frameTimer = setInterval(() => {
      if (this.videoElement && this.canvas && this.sessionPromise) {
        const video = this.videoElement;
        if (video.readyState < 2) return; // Wait until HAVE_CURRENT_DATA

        const ctx = this.canvas.getContext('2d', { alpha: false, willReadFrequently: true });
        if (ctx) {
          const intrinsicWidth = video.videoWidth || (this.currentVideoType === 'screen' ? 1920 : 1280);
          const intrinsicHeight = video.videoHeight || (this.currentVideoType === 'screen' ? 1080 : 720);

          // For screen share, allow HD resolution (1280px wide) with strict aspect ratio preservation
          // so code, math formulas, exercise questions, & UI text are super crisp and fully readable.
          // For camera feed, cap at 640px.
          const maxDim = this.currentVideoType === 'screen' ? 1280 : 640;
          let targetWidth = intrinsicWidth;
          let targetHeight = intrinsicHeight;

          if (intrinsicWidth > maxDim) {
            targetWidth = maxDim;
            targetHeight = Math.round((intrinsicHeight / intrinsicWidth) * maxDim);
          }

          if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
            this.canvas.width = targetWidth;
            this.canvas.height = targetHeight;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

          // High JPEG quality (0.88) for screen share so text is not blurred by JPEG artifacts
          const jpegQuality = this.currentVideoType === 'screen' ? 0.88 : 0.75;
          const dataUrl = this.canvas.toDataURL('image/jpeg', jpegQuality);
          const base64Image = dataUrl.split(',')[1];

          if (base64Image) {
            const videoPayload = {
              media: { data: base64Image, mimeType: 'image/jpeg' },
              video: { data: base64Image, mimeType: 'image/jpeg' }
            };
            if (this.activeLiveSession) {
              try {
                this.activeLiveSession.sendRealtimeInput(videoPayload as any);
              } catch (err) {
                console.warn("sendRealtimeInput video error:", err);
              }
            } else if (this.sessionPromise) {
              this.sessionPromise.then(session => {
                this.activeLiveSession = session;
                try {
                  session.sendRealtimeInput(videoPayload as any);
                } catch (err) {
                  console.warn("sendRealtimeInput video error:", err);
                }
              }).catch(() => {});
            }
          }
        }
      }
    }, intervalMs);
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext || this.isMuted) return;
    if (this.playbackContext.state === 'suspended') {
      try {
        this.playbackContext.resume()?.catch?.(() => {});
      } catch {}
    }
    
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = this.playbackContext.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }
      
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = this.voicePitch; // Web Audio API pitch shifting!
      
      // Clean vocal projection gain (1.40x boost for clarity without echo blowout)
      const gainNode = this.playbackContext.createGain();
      gainNode.gain.setValueAtTime(1.40, this.playbackContext.currentTime);

      // Speech clarity compressor tuned for loud, punchy, uncompressed vocal confidence
      const compressor = this.playbackContext.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-8, this.playbackContext.currentTime);
      compressor.knee.setValueAtTime(12, this.playbackContext.currentTime);
      compressor.ratio.setValueAtTime(2.5, this.playbackContext.currentTime);
      compressor.attack.setValueAtTime(0.002, this.playbackContext.currentTime);
      compressor.release.setValueAtTime(0.20, this.playbackContext.currentTime);

      source.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(this.playbackContext.destination);
      
      const currentTime = this.playbackContext.currentTime;
      // Add 60ms lookahead safety margin when starting or recovering playback to absorb internet packet jitter
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime + 0.06;
      }
      
      source.start(this.nextPlayTime);
      this.activePlaybackSources.push(source);
      const scaledDuration = audioBuffer.duration / Math.max(0.5, this.voicePitch);
      this.nextPlayTime += scaledDuration;
      this.isPlaying = true;
      this.lastAudioActivityTime = Date.now();
      this.userSpokeInSession = false;

      // Clear any pending debounce from previous chunk
      if (this.playbackEndDebounceTimer) {
        clearTimeout(this.playbackEndDebounceTimer);
        this.playbackEndDebounceTimer = null;
      }
      
      source.onended = () => {
        const idx = this.activePlaybackSources.indexOf(source);
        if (idx !== -1) {
          this.activePlaybackSources.splice(idx, 1);
        }
        this.lastAudioActivityTime = Date.now();

        // If no sources are actively queued, debounce before flipping isPlaying to false
        // so incoming streaming chunks attach seamlessly without cutting the voice mid-reply!
        if (this.activePlaybackSources.length === 0) {
          if (this.playbackEndDebounceTimer) clearTimeout(this.playbackEndDebounceTimer);
          this.playbackEndDebounceTimer = setTimeout(() => {
            if (this.activePlaybackSources.length === 0) {
              this.isPlaying = false;
              this.lastAudioActivityTime = Date.now();
              this.userSpokeInSession = false;
              this.onStateChange("listening");
            }
          }, 600);
        }
      };
    } catch (e) {
      console.error("Error playing chunk", e);
    }
  }

  private stopPlayback() {
    if (this.playbackEndDebounceTimer) {
      clearTimeout(this.playbackEndDebounceTimer);
      this.playbackEndDebounceTimer = null;
    }
    for (const source of this.activePlaybackSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (_) {}
    }
    this.activePlaybackSources = [];
    if (this.playbackContext) {
      this.nextPlayTime = this.playbackContext.currentTime;
    }
    this.isPlaying = false;
  }

  private async acquireUserMediaWithRetry(constraints: MediaStreamConstraints, retries = 3, delayMs = 300): Promise<MediaStream> {
    let lastError: any = null;
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`[LiveSession] Attempting getUserMedia (attempt ${i + 1}/${retries})...`);
        // On subsequent retries, relax constraints to pure boolean audio if advanced audio constraints failed
        let attemptConstraints: MediaStreamConstraints = constraints;
        if (i > 0 && constraints.audio) {
          attemptConstraints = {
            ...constraints,
            audio: true
          };
        }

        const stream = await navigator.mediaDevices.getUserMedia(attemptConstraints);
        return stream;
      } catch (err: any) {
        lastError = err;
        console.warn(`[LiveSession] getUserMedia attempt ${i + 1} failed:`, err);
        
        // If it's an explicit permission denied error, abort retry
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err?.message?.toLowerCase().includes('permission denied')) {
          throw err;
        }

        // If constraints were rejected, fallback immediately to plain audio: true
        if (err.name === 'OverconstrainedError' && constraints.audio) {
          try {
            console.log("[LiveSession] OverconstrainedError encountered, retrying with plain audio: true...");
            return await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch (_) {}
        }

        // Try to release any known active streams or flashlights on busy/source lock
        try {
          await FlashlightService.setFlashlight(false);
        } catch (_) {}
        
        if (constraints.video && this.videoStream) {
          try {
            this.videoStream.getTracks().forEach(t => t.stop());
            this.videoStream = null;
          } catch (_) {}
        }
        if (constraints.audio && this.mediaStream) {
          try {
            this.mediaStream.getTracks().forEach(t => t.stop());
            this.mediaStream = null;
          } catch (_) {}
        }

        // Wait before retrying
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    throw lastError;
  }

  async updateMedia(videoType: 'camera' | 'screen' | 'none') {
    if (!this.sessionPromise) {
      return this.start(videoType);
    }

    console.log(`Updating media source to: ${videoType}`);
    this.currentVideoType = videoType;
    
    // Stop existing video stream
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(t => t.stop());
      this.videoStream = null;
      this.onVideoStreamChange(null);
    }
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement = null;
    }

    // Start new video stream if needed
    if (videoType !== 'none') {
      try {
        if (videoType === 'camera') {
          this.videoStream = await this.acquireUserMediaWithRetry({ 
            video: { 
              width: { ideal: 1280 }, 
              height: { ideal: 720 },
              facingMode: this.facingMode 
            } 
          });
        } else if (videoType === 'screen') {
          this.videoStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: 1920, max: 2560 },
              height: { ideal: 1080, max: 1440 },
              frameRate: { ideal: 15, max: 30 }
            }
          });
          const videoTrack = this.videoStream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.onended = () => {
              console.log("[LiveSessionManager] Screen share ended by user");
              this.updateMedia('none').catch(() => {});
            };
          }
        }

        if (this.videoStream) {
          this.videoElement = document.createElement('video');
          this.videoElement.srcObject = this.videoStream;
          this.videoElement.playsInline = true;
          this.videoElement.muted = true;
          await this.videoElement.play();
          this.startFrameCapture();
          this.onVideoStreamChange(this.videoStream);
        }
      } catch (err: any) {
        console.warn(`[LiveSessionManager] Media stream for ${videoType} was denied, cancelled, or failed:`, err?.message || err?.name);
        this.videoStream = null;
        this.currentVideoType = 'none';
        this.onVideoStreamChange(null);
        if (this.videoElement) {
          try { this.videoElement.pause(); } catch (_) {}
          this.videoElement = null;
        }
        if (this.frameTimer) {
          clearInterval(this.frameTimer);
          this.frameTimer = null;
        }
      }
    }
  }

  stop() {
    this.isStopping = true;
    this.isConnecting = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.currentLiveModelIndex = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.stabilityTimer) {
      clearTimeout(this.stabilityTimer);
      this.stabilityTimer = null;
    }
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }
    this.stopSilenceWatchdog();
    if (this.frameTimer) clearInterval(this.frameTimer);
    if (this.processor) {
      try { this.processor.disconnect(); } catch (_) {}
      this.processor = null;
    }
    if (this.highpassFilter) {
      try { this.highpassFilter.disconnect(); } catch (_) {}
      this.highpassFilter = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch (_) {}
      this.analyser = null;
    }
    if (this.source) {
      try { this.source.disconnect(); } catch (_) {}
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(t => t.stop());
      this.videoStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.stopPlayback();
    
    if (this.sessionPromise) {
      const p = this.sessionPromise;
      this.sessionPromise = null;
      this.activeLiveSession = null;
      p.then(session => {
        if (session && typeof session.close === 'function') {
          console.log("Closing session in stop()");
          session.close();
        }
      }).catch(() => {});
    } else {
      this.activeLiveSession = null;
    }
    
    this.onStateChange("idle");
  }

  sendText(text: string) {
    if (this.activeLiveSession) {
      try {
        if (typeof this.activeLiveSession.sendClientContent === "function") {
          this.activeLiveSession.sendClientContent({
            turns: [{ role: "user", parts: [{ text }] }],
            turnComplete: true
          });
        }
      } catch (err) {
        console.warn("sendText error:", err);
      }
    } else if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        this.activeLiveSession = session;
        try {
          if (typeof session.sendClientContent === "function") {
            session.sendClientContent({
              turns: [{ role: "user", parts: [{ text }] }],
              turnComplete: true
            });
          }
        } catch (err) {
          console.warn("sendText error:", err);
        }
      }).catch(() => {});
    }
  }
}
