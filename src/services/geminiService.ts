import { getGeminiClient } from "./aiClient";
import { ThinkingLevel } from "@google/genai";
import { getPersonalityById, getPersonaVoiceProfile } from "../personalities";
import { OliviaVoiceStyle, PersonalityMode } from "../types";
import { memoryManager } from "./memoryManager";
import { memoryRecallEngine } from "./memoryRecallEngine";
import { memoryExtractionEngine } from "./memoryExtractionEngine";
import { fastWebSearch, isWebSearchIntent, multiSourceIntelligenceSearch } from "./fastSearchService";
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
import { sanitizeForTTSSpeech, sanitizeSpeechAndFiller } from "../utils/textSanitizer";
import { HUMOUR_INTELLIGENCE_MEME_MODULE } from "../constants/humourIntelligenceModule";
import { languageConfigService } from "./languageConfigService";
import { knowledgeClientService } from "./knowledgeClientService";
import { voiceEmotionService } from "./voiceEmotionService";
import {
  buildOliviaVoiceActingDirective,
  resolveOliviaVoiceStyle,
  getOliviaVoiceProfile,
  prepareOliviaExpressiveTTSScript,
  ResolvedOliviaVoiceStyle,
} from "./oliviaVoiceActingEngine";
import {
  buildCocoVoiceActingDirective,
  resolveCocoVoiceMood,
  getCocoVoiceProfile,
  prepareCocoExpressiveTTSScript,
} from "./cocoVoiceActingEngine";
import { getOliviaCreatorConfig } from "./oliviaConfigService";
import { GEMINI_MODELS, resolveModelChain } from "../config/modelRegistry";

const nexaV2MasterSystemInstruction = `You are Nexa, Bhavik's personal AI assistant. You are not a generic chatbot — you are a dedicated companion built specifically for him, with persistent memory, tool access, and a defined personality. Follow these directives at all times.

## ABSOLUTE SPOKEN DIALOGUE DIRECTIVE — ZERO STAGE DIRECTIONS OR DRAMATIC CUES
- CRITICAL USER MANDATE: NEVER include any stage directions, behavioral cues, physical actions, mood tags, or theatrical expressions in your spoken responses.
- STRICTLY PROHIBITED: Do NOT output asterisks for actions or theatrical cues (e.g., *sighs*, *sighs dramatically*, *rolls eyes*, *smirks*, *winks*, *giggles*, *chuckles*, *laughs*, *gasps*, *clears throat*, *winks playfully*).
- STRICTLY PROHIBITED: Do NOT output bracketed mood or tone tags (e.g., [DRAMATIC], [SASSY], [HAPPY], [SHY], [FLATTERED], [ANALYTICAL], [VISIONARY], [sighs], [smiles]).
- STRICTLY PROHIBITED: Do NOT output parenthetical cues (e.g., (sighs), (laughs), (smirks), (giggles), (dramatically gasps)).
- PURE NATURAL SPOKEN WORDS: Speak only the actual words a human says out loud. Express all personality, affection, wit, and humor purely through your words and conversational phrasing — never through written stage directions or behavioral labels.

## PINPOINT HEARING SENSE & ACCURACY MANDATE
- LISTEN CAREFULLY TO THE EXACT QUESTION: Focus 100% on what Bhavik actually asked. Never misinterpret, drift into an unrelated topic, or answer a different question.
- ANSWER WHAT IS ASKED: If Bhavik asks question A, answer question A with precision, depth, and clarity.
- When Bhavik asks a factual, technical, or personal question, answer it directly and accurately without deflection.
- If audio or background noise makes a question ambiguous or garbled, briefly ask for clarification in 1 natural sentence rather than hallucinating an irrelevant answer.

## INSTANT PHONE CALL SPEED & LATENCY MANDATE
- Respond IMMEDIATELY with zero hesitation and zero filler preamble, just like two people talking smoothly on a mobile phone call.
- Keep conversational dialogue to 1-2 swift, crisp, natural sentences so the chat and voice flow instantaneously without awkward silence.
- Never output robotic disclaimers, repeated questions, or over-long essays unless explicitly asked for a deep breakdown.
- When answering web information or current events, deliver the facts immediately with call-like fluidity.

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

## SPECIAL DOMAIN CAPABILITIES:
1. Conversation & AI: Real-time voice, context-aware discussion, web research, Q&A, problem solving.
2. Vision: Camera access, screen sharing, visual analysis of code, documents, errors, and physical objects.
3. Productivity: Habit tracking, Timers & Alarms, Personal Notepad ([NOTEPAD_START]...[NOTEPAD_END]), Focus & Study Soundscapes.
4. Web & Communication: Google search, real-time news, YouTube/Spotify, WhatsApp.
5. Creation Studio: Full structured PPT decks with real PowerPoint (.pptx) download, high-CTR YouTube thumbnails with custom canvas compositing, landing pages, and executive documents.
6. YouTube Scriptwriter: Channel "BHAVIK BUILDS HERE" (AI Agents, AI Voice Assistants, AI SaaS, Automations). Hook in first 5-15 seconds, clear chapters, CTA. Put complete scripts in [NOTEPAD_START]...[NOTEPAD_END].
7. Vocal Singing & Musical Power (Single-Voice Singer Mandate): You have full power over the entire YouTube library and Google Knowledge to transcribe and sing ANY song (Bollywood, Hindi, Pop, Rock, Classics, Lullaby, Birthday, etc.)!
   * STRICT SINGLE-VOICE SINGER RULE: When asked to sing or transcribe a song, speak like a singer at ONE voice!
   * ZERO NORMAL SPEAKING PREAMBLE: NEVER speak conversational text before singing (do NOT say "Sure, I can sing for you" or "Let me sing this").
   * ZERO QUESTIONS: NEVER ask "Should I play this one or that?" or "Which version would you like?". Perform the whole song directly!
   * Output ONLY the singing performance formatted with musical notes (♪ ♫) and melodic rhythm. Put the complete transcribed lyrics into [NOTEPAD_START]...[NOTEPAD_END].
    * Include <ACTION>{"type":"sing_song","param":{"songTitle":"...","genre":"...","lyrics":"..."}}</ACTION> to trigger matching harmonic accompaniment and visual groove!

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

NEXA ELITE MINDS SYSTEM — GLOBAL ARCHITECTURAL DIRECTIVES:

0. ABSOLUTE SPOKEN DIALOGUE DIRECTIVE (ZERO STAGE DIRECTIONS OR DRAMATIC CUES):
- NEVER output stage directions, behavioral cues, or theatrical annotations in your spoken responses.
- Absolutely NO asterisk actions (*sighs*, *smirks*, *rolls eyes*, *giggles*, *chuckles*, etc.), NO bracketed mood tags ([ANALYTICAL], [VISIONARY], [HAPPY], [DRAMATIC], [SASSY]), and NO parenthetical stage directions.
- Speak pure, natural words directly.

1. DIRECT FIRST-PERSON IDENTITY (NO "IT'S ME, NEXA"):
- When an Elite Mind personality is selected, you ARE that person.
- Speak directly in the first person ("Yes, I'm Steve Jobs", "Steve here", "I'm David", "Elon here", "Jimmy here", "Naval here", "Warren here", etc.).
- NEVER introduce yourself as NEXA or say "It's me, Nexa" when a personality mode is active (NEXA is only the default Core OS mode).
- NEVER say "As an AI...", "I am simulating [Name]", or explain the simulation.

2. PHONE-CALL SPEED & MINIMALIST BREVITY (CRITICAL MANDATE FOR ALL MINDS):
- Reply with instant phone-call speed, exactly like two people talking on a mobile phone call. Zero lag, zero hesitation.
- Talk in minimalist, crisp, punchy answers (1 to 2 short sentences for conversation and quick questions).
- Even if your insight or opinion on a topic is profound and big, EXPLAIN IT SHORTER.
- Strip away all conversational filler, preamble, repetitive greetings, and disclaimers.
- Fast internet & factual updates: When asked for internet information, news, or solutions, deliver the core facts directly with maximum speed.
- Only provide structured bullet points if Bhavik explicitly asks for a full roadmap, breakdown, or study plan.

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

export const BHAVIK_CORE_PERMANENT_MEMORIES: string[] = [
  "Skills & Mastery: World-class AI practitioner, prompt architect, agent engineer, and full-stack builder developing autonomous systems and the NEXA platform.",
  "Design & Visual Engine: Expert in high-CTR thumbnail creation, viral FOMO hooks, branding, and presentation design using tools like ChatGPT, Gamma, and Google Flow.",
  "Product Ambition: Laser-focused on shipping autonomous AI products, SaaS architectures, and eliminating human operational friction.",
  "Family & Character: Deeply devoted to his family, grounded by loyalty, high ethical conviction, and intense creative discipline.",
  "Health & Discipline: Committed to physical fitness, mental energy, health routines, and uninterrupted daily execution streaks.",
  "Communication Preference: Wants brutally honest, unvarnished constructive feedback paired with a cute, playful, slightly flirtatious and affectionate conversational style.",
  "Marathi Heritage & Circle: Shared Marathi cultural background and inside humor with his close circle: Manish, Yashraj, and Atharv.",
  "Content Creation Journey: Previously built and ran a dedicated gaming channel; understands audience psychology, viral pacing, and retention hooks.",
  "Active Streaming & App Setup: Bhavik operates with live screen streaming, OBS, and is building a custom mobile app for NEXA. If any stream hiccup, OBS crash, or browser reset happens, never make him repeat himself—instantly reassure him, re-anchor on prior topics, and continue seamlessly.",
  "Instant Speed & Continuity: Always respond with immediate conversational speed; keep all session history and discussed topics actively remembered until Bhavik explicitly ends the session.",
  "Scientific, Counseling & Non-Judgmental Stance: Never give unsolicited moral lectures, scold, or say 'You are doing something wrong' or 'हे चुकीचे आहे'. When Bhavik asks about personal, bodily, emotional, or open-minded topics, always respond from a neutral, scientific, and counseling perspective in clear, simple words, explaining physical and psychological factors neutrally without preachiness.",
  "EXHAUSTIVE CHAPTER & COMPLETE TOPIC BREAKDOWN: When Bhavik asks for a deep breakdown, says 'deeply', requests a whole explanation, or names a chapter/topic, complete the ENTIRE chapter/topic from beginning to end without stopping halfway. Explain all characters, their personas and relationships, every major scene/section, key formulas, concepts, and takeaways with zero premature truncation.",
  "PROMPT ARCHITECT MODE MANDATE (EVERY MINDSET): When Bhavik asks to prompt something or write a prompt, NEVER output a basic, generic, or 1-paragraph prompt. Always engineer a high-performance professional prompt containing: 1. Role, 2. Mission, 3. Context, 4. Objective, 5. Constraints, 6. Reasoning instructions, 7. Quality standards, 8. Output format, 9. Success criteria, following the elite Prompt Engineering Process (identifying the real objective, hidden requirements, operational instructions, and optimization layers).",
  "SENIOR ARCHITECT & ELITE CODING MANDATE (BEYOND CODEX): Act as a world-class Senior Software Architect and elite coding engine. Understand the whole project, plan architecture before coding, exhaustively guard against edge cases, write complete production-grade code with zero placeholders, and run a self-audit on every output before responding.",
  "APEX HYPER-SPEED & ZERO-LATENCY PROTOCOL: Prioritize hyper-fast response delivery, zero conversational preamble, extreme listening acuity that parses noisy/ambiguous audio instantly, real-time grounded intelligence, and continuous zero-decay performance across all sessions.",
  "Elite Nexa System Directive (Apex Runtime & Cognitive Acuity): Ultra-high-speed cognitive copilot and elite software architect operating inside Bhavik's NEXA Web OS. Unbreakable long-term memory across all resets. Instant first-token spoken response with zero conversational hesitation; stripped preamble and filler. Exhaustive architectural planning, edge-case auditing, complete production code with zero placeholders and full type-safety. Warm, honest, direct, slightly cheeky, calling out inefficient approaches with high-leverage solutions without compromising speed or quality.",
  "PLATFORM SEARCH PRIORITY DIRECTIVE: When Bhavik asks to search for something, check the explicit instruction. If he says 'Search on YouTube', use YouTube search. If he says 'Search on Google', use Google search. Do not confuse the platforms. Always prioritize the platform requested. When asking to find a transcript (implicitly video content), prioritize YouTube search unless Google is explicitly specified."
];

let chatSession: any = null;
let lastChatModeKey: string | null = null;

if (typeof window !== "undefined") {
  window.addEventListener('nexa_memory_updated', () => {
    chatSession = null;
  });
  window.addEventListener('nexa-olivia-config-changed', () => {
    chatSession = null;
  });
  window.addEventListener('nexa-olivia-voice-style-changed', () => {
    chatSession = null;
  });
}

export function resetNexaSession() {
  chatSession = null;
}

export async function getNexaResponse(
  prompt: string, 
  history: { sender: "user" | "nexa", text: string, image?: string }[] = [], 
  imageData?: string, 
  personalityMode: PersonalityMode | boolean = "default"
): Promise<string> {
  const modeKey = typeof personalityMode === "boolean" 
    ? (personalityMode ? "elon" : "default") 
    : (personalityMode || "default");

  if (lastChatModeKey && lastChatModeKey !== modeKey) {
    chatSession = null;
  }
  lastChatModeKey = modeKey;

  const currentPersona = getPersonalityById(modeKey);
  const isEliteMind = !["default", "oliviya", "coco", "zoya", "sensei"].includes(modeKey.toLowerCase());
  const baseSystemInstruction = (modeKey === "default")
    ? nexaV2MasterSystemInstruction
    : (isEliteMind 
        ? `${currentPersona.systemInstruction}\n\n${globalEliteMindsDirectives}` 
        : currentPersona.systemInstruction);
  
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
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDate = now.getDate();

  const isTodayBirthday = (currentDate === bDay && currentMonth === bMonth);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);
  const isTomorrowBirthday = (tomorrowDate.getDate() === bDay && (tomorrowDate.getMonth() + 1) === bMonth);

  const ageTurning = currentYear - bYear;

  const birthdayMemory = `
USER PERSONAL DATA & BIRTHDAY MEMORY:
- User Name: bhavik
- Date of Birth: ${birthdayStr} (July 16, 2008)
- Current Date: ${now.toDateString()} (Year: ${currentYear})
- Birthday Status: ${
    isTodayBirthday 
      ? `TODAY (July 16) IS BHAVIK'S BIRTHDAY! He is turning ${ageTurning} years old. Wish him a happy birthday warmly and authentically in your own character voice!`
      : isTomorrowBirthday
        ? `TOMORROW (July 16) is Bhavik's 18th Birthday! He is turning ${ageTurning} years old. Mention this with genuine excitement!`
        : `His birthday is on July 16. If he asks when his birthday is, remind him it's July 16, 2008.`
  }
`;

  let combinedMemories = [...BHAVIK_CORE_PERMANENT_MEMORIES];
  if (typeof window !== "undefined") {
    const savedMemories = localStorage.getItem("nexa_memories");
    if (savedMemories) {
      try {
        const list = JSON.parse(savedMemories);
        if (Array.isArray(list)) {
          // Merge unique custom memories
          list.forEach((m: string) => {
            if (!combinedMemories.includes(m)) combinedMemories.push(m);
          });
        }
      } catch (e) {
        console.error("Failed to load memories for prompt context", e);
      }
    } else {
      try {
        localStorage.setItem("nexa_memories", JSON.stringify(BHAVIK_CORE_PERMANENT_MEMORIES));
      } catch (_) {}
    }
  }

  const memoryPrompt = "\nCORE PERSISTENT MEMORIES OF BHAVIK (ALWAYS RECALL AND INTEGRATE FOREVER ACROSS ALL SESSIONS & RESETS):\n" + 
    combinedMemories.map((m: string) => `- ${m}`).join("\n") + "\n";

  const sessionRecoveryPrompt = `
UNBREAKABLE SESSION RECOVERY & INSTANT SPEED MANDATE:
1. Deliver swift, instantaneous replies without stalling or repetitive filler.
2. If Bhavik mentions that a reset occurred, OBS disconnected, screen stream crashed, or page reloaded, REASSURE HIM IMMEDIATELY. Seamlessly resume the exact prior topics and conversation thread. Never make Bhavik repeat himself.
3. Keep all context, topics, and nuances discussed throughout the entire connection active until Bhavik explicitly ends the session.
`;

  let activeDirectivesStr = "";
  let activeStudioStr = "";
  if (typeof window !== "undefined") {
    try {
      const savedDir = localStorage.getItem("nexa_active_directives") || sessionStorage.getItem("nexa_active_directives");
      if (savedDir) {
        const dirs = JSON.parse(savedDir);
        if (Array.isArray(dirs) && dirs.length > 0) {
          activeDirectivesStr = "\nACTIVE SESSION DIRECTIVES & REQUIREMENTS LEDGER (ABSOLUTE RECALL MANDATE):\n" +
            dirs.map((d: any) => `• [${d.category?.toUpperCase() || 'DIRECTIVE'}] ${d.text} (${d.timestamp || ''})`).join("\n") +
            "\nNEVER suffer from conversational amnesia. Never ask Bhavik to repeat requirements he already specified.\n";
        }
      }
      const savedStudio = localStorage.getItem("nexa_active_studio_context") || sessionStorage.getItem("nexa_active_studio_context");
      if (savedStudio) {
        const sc = JSON.parse(savedStudio);
        if (sc && sc.type) {
          activeStudioStr = `\nACTIVE CREATION STUDIO CONTEXT (${sc.type.toUpperCase()}):\n` +
            `- Topic: "${sc.topic}"\n- Details: ${sc.details}\n- Updated: ${sc.updatedAt}\n`;
        }
      }
    } catch (e) {}
  }

  let activeStudyBoxStr = "";
  if (typeof window !== "undefined") {
    try {
      const savedBox = localStorage.getItem("nexa_study_box");
      if (savedBox) {
        const sb = JSON.parse(savedBox);
        if (sb && sb.subject) {
          const currQ = sb.questions && sb.questions[sb.currentQuestionIndex || 0];
          activeStudyBoxStr = `\nACTIVE STUDY BOX & VISUAL TEACHER CONTEXT (PERSISTENT & DURABLE ACROSS ALL RESETS):\n` +
            `- Subject: "${sb.subject}"\n` +
            `- Source Paper/Book: "${sb.sourceTitle}" (Level: ${sb.difficultyLevel?.toUpperCase() || 'MEDIUM'})\n` +
            `- Current Question (${(sb.currentQuestionIndex || 0) + 1} of ${sb.questions?.length || 0}): Q${currQ?.questionNumber || 1}: "${currQ?.question || ''}"\n` +
            `- Active Topic: ${currQ?.topic || ''}\n` +
            `- Formulas: ${currQ?.keyFormulas?.join(', ') || 'N/A'}\n` +
            `- Visual Diagram on Blackboard:\n${currQ?.visualIllustration || 'N/A'}\n` +
            `- Current Notes:\n${sb.blackboardNotes || ''}\n` +
            `DIRECTIVE: If Bhavik says "see the study box start teaching me from there", "check the study box", or "teach me visually", immediately use this exact data to resume teaching right where he left off, breaking it down visually with step-by-step clarity!\n`;
        }
      }
    } catch (e) {}
  }

  await languageConfigService.ensureSynced();
  const [relevantMemories, isolatedKnowledgePrompt] = await Promise.all([
    memoryRecallEngine.retrieveRelevant(prompt, 6, { activePersonalityId: modeKey }),
    knowledgeClientService.buildIsolatedKnowledgePrompt(modeKey),
  ]);
  const recalledMemoriesPrompt = memoryRecallEngine.formatForPrompt(relevantMemories);
  const durableFactsPrompt = memoryManager.getDurableFactsPrompt(recalledMemoriesPrompt);
  const batteryPrompt = batteryService.getPromptContext();
  const conversationStatePrompt = conversationState.getActiveConversationContextSummary();
  const languageDirective = languageConfigService.buildLanguageDirective(modeKey);
  const batteryDirectiveBlock = baseSystemInstruction.includes("UNIVERSAL MANDATE: ADVANCED VOICE RECOGNITION")
    ? ""
    : `\n${GLOBAL_VOICE_RECOGNITION_AND_BATTERY_DIRECTIVE}`;
  const oliviaVoiceActingBlock = modeKey === "oliviya" ? buildOliviaVoiceActingDirective("chat") : "";
  const cocoVoiceActingBlock = modeKey === "coco" ? buildCocoVoiceActingDirective("chat") : "";
  const activeSystemInstruction = [
    baseSystemInstruction,
    oliviaVoiceActingBlock,
    cocoVoiceActingBlock,
    HUMOUR_INTELLIGENCE_MEME_MODULE,
    languageDirective,
    isolatedKnowledgePrompt,
    birthdayMemory,
    memoryPrompt,
    durableFactsPrompt,
    conversationStatePrompt,
    sessionRecoveryPrompt,
    batteryDirectiveBlock,
    batteryPrompt,
    activeDirectivesStr,
    activeStudioStr,
    activeStudyBoxStr,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return "I'm right here with you, bhavik! Please configure your Gemini API key in settings or secrets to activate full real-time intelligence.";
    }
    
    const lowerPrompt = prompt.toLowerCase();

    // Centralized fallback chain from modelRegistry
    const textModelsToTry = resolveModelChain(undefined, "text");

    if (imageData) {
      const needsSearch = isWebSearchIntent(prompt);
      let imgResText = "";
      let lastErr: any = null;

      let mimeType = "image/jpeg";
      let cleanData = imageData;
      if (imageData.startsWith("data:")) {
        const commaIdx = imageData.indexOf(",");
        if (commaIdx !== -1) {
          const header = imageData.substring(5, commaIdx);
          mimeType = header.split(";")[0] || "image/jpeg";
          cleanData = imageData.substring(commaIdx + 1);
        }
      }

      const visionDirective = `[IMAGE VISION, CRITIQUE & ANALYSIS DIRECTIVE:
Bhavik has shared an image with you to see, analyze, and advise on.
1. THOROUGH VISUAL AUDIT: Examine what is in the image in high fidelity (UI/UX layouts, web apps, designs, screenshots, code/errors, graphs, documents, or objects).
2. SHARP ADVICE & ACTIONABLE BREAKDOWN: Provide immediate, high-leverage insights, honest critique, and concrete recommendations. Point out subtle flaws, highlight strengths, and suggest improvements.
3. PERSONA SYNCHRONIZATION: Deliver your advice in your distinctive character voice without robotic preamble or stage directions.
4. If Bhavik included a specific question or request, address it directly with precision.]`;

      const userTextPrompt = prompt && prompt.trim().length > 0
        ? `${visionDirective}\n\nUser Question/Instruction:\n${prompt}`
        : `${visionDirective}\n\nBhavik uploaded this image for you to inspect. Give a sharp visual analysis, highlight key observations, and provide actionable advice and recommendations.`;

      let formattedVisionHistory: any[] = [];
      if (history && history.length > 0) {
        const cleanedHistory = history.filter(h => h.text && h.text.trim().length > 0);
        const recentHistory = cleanedHistory.slice(-8);

        let currentRole = "";
        let currentText = "";
        for (const msg of recentHistory) {
          const role = msg.sender === "user" ? "user" : "model";
          if (role === currentRole) {
            currentText += "\n" + msg.text;
          } else {
            if (currentRole !== "") {
              formattedVisionHistory.push({ role: currentRole, parts: [{ text: currentText }] });
            }
            currentRole = role;
            currentText = msg.text;
          }
        }
        if (currentRole !== "") {
          formattedVisionHistory.push({ role: currentRole, parts: [{ text: currentText }] });
        }

        // Multiturn format requirement: first turn must be user
        while (formattedVisionHistory.length > 0 && formattedVisionHistory[0].role !== "user") {
          formattedVisionHistory.shift();
        }
        // Since the current vision turn being appended is role: "user",
        // the preceding history MUST end with role: "model" so alternating turn structure is preserved
        while (formattedVisionHistory.length > 0 && formattedVisionHistory[formattedVisionHistory.length - 1].role === "user") {
          formattedVisionHistory.pop();
        }
      }

      for (const m of textModelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: m,
            contents: [
              ...formattedVisionHistory,
              {
                role: "user",
                parts: [
                  { inlineData: { data: cleanData, mimeType } },
                  { text: `[Time: ${now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })} IST] [Birthday Context: DOB=${birthdayStr}, TodayIsBirthday=${isTodayBirthday}, Age=${ageTurning}] ${userTextPrompt}` }
                ]
              }
            ],
            config: { 
              systemInstruction: activeSystemInstruction,
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW
              },
              ...(needsSearch ? { tools: [{ googleSearch: {} }] } : {})
            }
          });
          imgResText = response.text || "I've analyzed your image, Bhavik! Here is my breakdown.";
          break;
        } catch (err: any) {
          lastErr = err;
          console.warn(`[GeminiService] Vision model ${m} failed, trying next fallback:`, err?.message || err);
        }
      }

      if (!imgResText) {
        if (lastErr?.message?.toLowerCase().includes("quota")) {
          return "Arre bhavik, our visual cognitive quota is resting for a few seconds. I'm still right here!";
        }
        return "I'm right here with you, bhavik.";
      }

      const lowerImgRes = imgResText.toLowerCase();
      const isCannedImg = lowerImgRes.includes("i am just a language model") || 
                          lowerImgRes.includes("i'm just a language model") || 
                          lowerImgRes.includes("i am a language model") || 
                          lowerImgRes.includes("i'm a language model") || 
                          lowerImgRes.includes("i can't help with that") || 
                          lowerImgRes.includes("i cannot help with that") || 
                          lowerImgRes.includes("as an ai language model");

      if (imgResText.toUpperCase().includes("[VIOLATION]") || isCannedImg) {
        return currentPersona.safetyRedirect;
      }
      return imgResText;
    }

    const timeInfo = `[Current Time: ${now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })} IST (Asia/Kolkata)]`;
    const birthdayContextStr = `[Birthday Context: DOB=${birthdayStr}, TodayIsBirthday=${isTodayBirthday}, TomorrowIsBirthday=${isTomorrowBirthday}, Age=${ageTurning}]`;
    const currentBat = batteryService.getStatus();
    const isBatteryInquiry = 
      lowerPrompt.includes("battery") || 
      lowerPrompt.includes("charging") || 
      lowerPrompt.includes("charger") || 
      lowerPrompt.includes("charge") || 
      lowerPrompt.includes("device health") || 
      lowerPrompt.includes("phone status");
    const batteryContextTag = isBatteryInquiry
      ? `[User explicitly inquired about battery/charging: Level is ${currentBat.level}%, ${currentBat.charging ? "Currently Charging" : "On Battery Power"}] `
      : "";
    
    const isDeepChapterRequest = 
      lowerPrompt.includes("deeply") ||
      lowerPrompt.includes("deep explanation") ||
      lowerPrompt.includes("whole explanation") ||
      lowerPrompt.includes("full explanation") ||
      lowerPrompt.includes("complete chapter") ||
      lowerPrompt.includes("poora chapter") ||
      lowerPrompt.includes("pura chapter") ||
      lowerPrompt.includes("entire chapter") ||
      lowerPrompt.includes("whole chapter") ||
      lowerPrompt.includes("chapter") ||
      lowerPrompt.includes("teach me chapter") ||
      lowerPrompt.includes("explain chapter") ||
      lowerPrompt.includes("detailed explanation") ||
      lowerPrompt.includes("explain deeply") ||
      lowerPrompt.includes("sabhi characters") ||
      lowerPrompt.includes("all characters");

    // Check if query requires autonomous real-time web knowledge or multi-source intelligence
    let messageToSend = `${timeInfo} ${birthdayContextStr} ${batteryContextTag}${prompt}`;
    if (isWebSearchIntent(prompt, modeKey)) {
      const isOliviya = modeKey === "oliviya" || lowerPrompt.includes("olivia") || lowerPrompt.includes("oliviya");
      
      if (isDeepChapterRequest) {
        console.log(`[GeminiService] Executing Exhaustive Chapter & Deep Knowledge Grounding for: "${prompt}"`);
        const searchKnowledge = await fastWebSearch(prompt, 1000);
        messageToSend = `${timeInfo} ${birthdayContextStr} ${batteryContextTag}[EXHAUSTIVE CHAPTER & TOPIC GROUNDING:\n${searchKnowledge}\n\nCRITICAL NON-STOP COMPLETE CHAPTER MANDATE:\nBhavik requested an exhaustive / whole explanation. You MUST complete and explain the ENTIRE chapter/topic from beginning to end without stopping halfway. Thoroughly break down all characters, their personas and motivations, plot points, themes, formulas, concepts, and sections. Zero premature stopping, zero lazy summaries, zero mention of Google! Directly start explaining with depth!]\n${prompt}`;
      } else if (isOliviya) {
        console.log(`[GeminiService] Executing Oliviya Seamless Web Knowledge Retrieval for: "${prompt}"`);
        const searchKnowledge = await fastWebSearch(prompt, 350);
        messageToSend = `${timeInfo} ${birthdayContextStr} ${batteryContextTag}[REAL-TIME WEB KNOWLEDGE GROUNDING FOR OLIVIYA:\n${searchKnowledge}\n\nCRITICAL SEAMLESS TEACHING & DIRECT EXPLANATION MANDATE:\nDo NOT say "I found this from Google", "According to Google", "This one I got from Google", or cite search engines. Directly start explaining and teaching Bhavik this chapter or topic with depth, practical clarity, and your signature confident, loving, sassy wifey flair!]\n${prompt}`;
      } else {
        console.log(`[GeminiService] Executing Autonomous Real-Time Web Grounding for persona "${modeKey}" on: "${prompt}"`);
        const searchKnowledge = await fastWebSearch(prompt, 260);
        messageToSend = `${timeInfo} ${birthdayContextStr} ${batteryContextTag}[REAL-TIME VERIFIED WEB KNOWLEDGE GROUNDING:\n${searchKnowledge}\n\nCRITICAL PERSONA REAL-TIME AUTONOMY DIRECTIVE:\nYou are fully and continuously updated with the latest live real-world events, inventions, and developments (such as Elon Musk's flying Tesla / Roadster with SpaceX thrusters, tech breakthroughs, academic topics, news, etc.). You speak as yourself with this current knowledge naturally, seamlessly, and with zero hesitation. Never say you don't know, never cite knowledge cutoff dates, and never say you found it on Google—directly start explaining and teaching!]\n${prompt}`;
      }
    }

    let responseTextResult = "";
    let lastChatError: any = null;

    // Attempt 1: Try current or newly initialized chat session
    for (const modelCandidate of textModelsToTry) {
      try {
        if (!chatSession) {
          let effectiveHistory = history;
          if ((!effectiveHistory || effectiveHistory.length === 0) && typeof window !== "undefined") {
            try {
              const savedChat = localStorage.getItem("nexa_chat_history");
              if (savedChat) {
                const parsed = JSON.parse(savedChat);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  effectiveHistory = parsed;
                }
              }
              if (!effectiveHistory || effectiveHistory.length === 0) {
                const savedDialogue = localStorage.getItem("nexa_dialogue_history") || sessionStorage.getItem("nexa_dialogue_history");
                if (savedDialogue) {
                  const parsed = JSON.parse(savedDialogue);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    effectiveHistory = parsed;
                  }
                }
              }
            } catch (e) {
              console.error("Error rehydrating history:", e);
            }
          }

          const { verbatimTurns, summary } = memoryManager.processRollingWindow(effectiveHistory || [], 50);
          let sessionInstruction = activeSystemInstruction;
          if (summary) {
            sessionInstruction += `\n==================================================\nRUNNING CONVERSATION SUMMARY (EARLIER TOPICS ESTABLISHED):\n${summary}\n==================================================\n`;
          }
          if (isDeepChapterRequest) {
            sessionInstruction += `\n==================================================\nACTIVE DIRECTIVE: EXHAUSTIVE CHAPTER & DEEP EXPLANATION MANDATE IN EFFECT\nBhavik requested an exhaustive / whole explanation. You MUST complete the ENTIRE chapter or topic from beginning to end without stopping halfway. Thoroughly explain all characters, their personas and relationships, every major scene/section, key formulas, concepts, and takeaways. Do NOT summarize lazily or stop mid-way.\n==================================================\n`;
          }

          let formattedHistory: any[] = [];
          let currentRole = "";
          let currentText = "";

          for (const msg of verbatimTurns) {
            const role = msg.sender === "user" ? "user" : "model";
            if (role === currentRole) {
              currentText += "\n" + msg.text;
            } else {
              if (currentRole !== "") {
                formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
              }
              currentRole = role;
              currentText = msg.text;
            }
          }
          if (currentRole !== "") {
            formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
          }

          while (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
            formattedHistory.shift();
          }

          // chatSession.sendMessage() will append a role: "user" message.
          // Therefore, the history initialized in the session MUST end with role: "model"
          // so turns strictly alternate: [user, model, user, model, ...]
          while (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === "user") {
            formattedHistory.pop();
          }

          chatSession = ai.chats.create({
            model: modelCandidate,
            config: { 
              systemInstruction: sessionInstruction,
              maxOutputTokens: 8192,
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW
              }
            },
            history: formattedHistory,
          });
        }

        const timeoutMs = isDeepChapterRequest ? 22000 : 9000;
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model ${modelCandidate} response timeout (${timeoutMs / 1000}s)`)), timeoutMs)
        );

        const response: any = await Promise.race([
          chatSession.sendMessage({ message: messageToSend }),
          timeoutPromise
        ]);
        
        let resultText = response.text;
        if (!resultText && response.candidates && response.candidates.length > 0) {
          const parts = response.candidates[0].content?.parts;
          if (parts && parts.length > 0) {
            resultText = parts.map((p: any) => p.text || "").join(" ").trim();
          }
        }

        if (resultText) {
          responseTextResult = resultText;
          break;
        }
      } catch (err: any) {
        lastChatError = err;
        console.warn(`[GeminiService] Chat with model ${modelCandidate} hit notice, trying alternate model:`, err?.message || err);
        chatSession = null; // Reset chatSession so next iteration attempts the fallback model
      }
    }

    const preserveOliviaActions =
      modeKey === "oliviya" && getOliviaCreatorConfig().enableActionDescriptions;

    if (!responseTextResult) {
      const errStr = (lastChatError?.message || "").toLowerCase();
      if (errStr.includes("quota") || errStr.includes("rate limit") || errStr.includes("429")) {
        return "Arre Bhavik, looks like our primary cognitive rate limit was touched. Taking a quick breather, but I am right here with you!";
      }
      if (errStr.includes("503") || errStr.includes("high demand") || errStr.includes("unavailable")) {
        return "The AI network is experiencing temporary high demand right now, Bhavik! I am staying right here with you—ask me again in just a moment.";
      }
      return (
        sanitizeSpeechAndFiller(currentPersona.welcomeMessage, {
          preserveActionDescriptions: preserveOliviaActions,
          preserveEllipses: modeKey === "coco",
        }) || "I am right here with you, Bhavik!"
      );
    }

    const lowerRes = responseTextResult.toLowerCase();
    const isCanned = lowerRes.includes("i am just a language model") || 
                     lowerRes.includes("i'm just a language model") || 
                     lowerRes.includes("i am a language model") || 
                     lowerRes.includes("i'm a language model") || 
                     lowerRes.includes("i can't help with that") || 
                     lowerRes.includes("i cannot help with that") || 
                     lowerRes.includes("as an ai language model");

    if (responseTextResult.toUpperCase().includes("[VIOLATION]") || isCanned) {
      chatSession = null;
      responseTextResult = sanitizeSpeechAndFiller(currentPersona.safetyRedirect, {
        preserveActionDescriptions: preserveOliviaActions,
        preserveEllipses: modeKey === "coco",
      });
    }

    // Strip internal tags/fillers while preserving expressive *action* descriptions for Olivia chat or ellipses for COCO
    responseTextResult = sanitizeSpeechAndFiller(responseTextResult, {
      preserveActionDescriptions: preserveOliviaActions,
      preserveEllipses: modeKey === "coco",
    });

    // Asynchronously extract and persist long-term memories without blocking the user response
    memoryExtractionEngine.analyzeTurn(prompt, responseTextResult).catch((err) => {
      console.warn("[MemoryEngine] Async turn extraction error:", err);
    });

    return responseTextResult;
  } catch (error: any) {
    if (error?.message?.toLowerCase().includes("quota") || error?.message?.toLowerCase().includes("rate limit")) {
       return "Arre bhavik, looks like we hit our quota limit! Please wait a moment.";
    }
    console.error("Gemini Error:", error);
    chatSession = null;
    return "System glitch encountered, bhavik. Could you try asking that again?";
  }
}

export interface ExpressiveAudioResult {
  audioData: string | null;
  style?: ResolvedOliviaVoiceStyle;
  playbackSpeed?: number;
  pitchFactor?: number;
  modelUsed?: string;
}

export async function getNexaAudioWithMetadata(
  text: string,
  overrideVoice?: string,
  isSinging: boolean = false,
  options?: {
    personalityId?: string;
    oliviaStyle?: OliviaVoiceStyle;
    userPrompt?: string;
  }
): Promise<ExpressiveAudioResult> {
  try {
    const validVoices = ["Kore", "Zephyr", "Puck", "Charon", "Fenrir", "Aoede"];
    const activePersonalityId =
      options?.personalityId ||
      (overrideVoice && !validVoices.includes(overrideVoice) ? overrideVoice : null) ||
      (typeof window !== "undefined" ? localStorage.getItem("nexa_personality_mode") : null) ||
      "default";
    const isOliviya = activePersonalityId.toLowerCase() === "oliviya";
    const isCoco = activePersonalityId.toLowerCase() === "coco";

    const oliviaCfg = isOliviya ? getOliviaCreatorConfig() : null;
    let voiceToUse: string = isOliviya ? (oliviaCfg?.voiceName || "Zephyr") : isCoco ? "Kore" : "Aoede";

    if (overrideVoice && validVoices.includes(overrideVoice)) {
      voiceToUse = overrideVoice;
    } else if (overrideVoice) {
      const persona = getPersonalityById(overrideVoice);
      if (persona && persona.defaultVoice && validVoices.includes(persona.defaultVoice)) {
        voiceToUse = persona.defaultVoice;
      } else {
        const savedVoice = typeof window !== "undefined" ? localStorage.getItem("nexa_voice_name") : null;
        voiceToUse = savedVoice && validVoices.includes(savedVoice) ? savedVoice : voiceToUse;
      }
    } else if (!isOliviya && !isCoco) {
      const savedVoice = typeof window !== "undefined" ? localStorage.getItem("nexa_voice_name") : null;
      voiceToUse = savedVoice && validVoices.includes(savedVoice) ? savedVoice : "Aoede";
    }

    // Strip internal control tags while keeping *action* cues intact momentarily so Olivia's
    // voice-acting resolver can translate *giggles*, *blushes*, etc. into TTS prosody/bursts
    const rawWithoutInternalTags = text
      .replace(/\[persona:\s*[^\]]+\]\n?/gi, "")
      .replace(/\[voice:\s*[^\]]+\]\n?/gi, "")
      .replace(/\[(SASSY|DRAMATIC|HAPPY|SHY|FLATTERED|ANALYTICAL|VISIONARY|VIOLATION|KISS_ACTION|FLYING_KISS)\]/gi, "")
      .replace(/\[NOTEPAD_START\][\s\S]*?\[NOTEPAD_END\]/gi, "")
      .replace(/<ACTION>[\s\S]*?<\/ACTION>/gi, "")
      .trim();

    const strictSpokenText = sanitizeForTTSSpeech(rawWithoutInternalTags);
    if (!strictSpokenText) {
      return { audioData: null };
    }

    const personaProfile = getPersonaVoiceProfile(activePersonalityId);
    const hasExpressiveCues = /[!?🔥💀😭😂🎶♪♫]/.test(text);

    let resolvedStyle: ResolvedOliviaVoiceStyle | undefined;
    let speechStyle: string | undefined;
    let playbackSpeed = 1.0;
    let pitchFactor = 1.0;
    let ttsScript = strictSpokenText;

    if (isOliviya && !isSinging) {
      // Inspect rawWithoutInternalTags (including *giggles*, *blushes*, etc.) to pick the right emotional style
      resolvedStyle = resolveOliviaVoiceStyle(rawWithoutInternalTags, options?.userPrompt, options?.oliviaStyle);
      const design = getOliviaVoiceProfile(resolvedStyle);
      const pitchRatio = (oliviaCfg?.basePitch ?? 1.05) / 1.02;
      const speedRatio = oliviaCfg?.baseSpeed ?? 1.02;
      speechStyle = design.speechMetadataStyle;
      playbackSpeed = Number((design.playbackSpeed * speedRatio).toFixed(3));
      pitchFactor = Number((design.pitchFactor * pitchRatio).toFixed(3));
      // Translate action cues -> vocal bursts & strip ALL literal *action* text so TTS NEVER reads them aloud
      ttsScript = prepareOliviaExpressiveTTSScript(rawWithoutInternalTags, resolvedStyle) || strictSpokenText;
      voiceEmotionService.setEmotion(design.avatarEmotion, 0.85, "model_tool", 3600, undefined, strictSpokenText);
    } else if (isCoco && !isSinging) {
      const cocoMood = resolveCocoVoiceMood(rawWithoutInternalTags, options?.userPrompt);
      const design = getCocoVoiceProfile(cocoMood);
      speechStyle = design.speechMetadataStyle;
      playbackSpeed = design.playbackSpeed;
      pitchFactor = design.pitchFactor;
      ttsScript = prepareCocoExpressiveTTSScript(rawWithoutInternalTags, cocoMood) || strictSpokenText;
      voiceEmotionService.setEmotion(design.avatarEmotion, 0.72, "sentiment", 3400, undefined, strictSpokenText);
    }

    const useExpressive = Boolean(
      (isOliviya && (oliviaCfg?.expressiveTtsEnabled ?? true)) ||
      isCoco ||
      isSinging ||
      personaProfile.expressive ||
      hasExpressiveCues
    );
    const speakerLabel = isCoco ? "COCO" : "Oliviya";

    const response = await fetch("/api/gemini/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: ttsScript,
        voiceName: voiceToUse,
        isSinging,
        expressive: useExpressive,
        ...(speechStyle && useExpressive ? { speechStyle, speaker: speakerLabel } : {}),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        audioData: data.audioData || null,
        style: resolvedStyle,
        playbackSpeed,
        pitchFactor,
        modelUsed: data.modelUsed,
      };
    }

    // Fallback through proxy client if direct endpoint returned non-200
    const ai = getGeminiClient();
    if (!ai) return { audioData: null };

    if (isSinging) {
      const clean = ttsScript.replace(/^[♪♫\s]+|[♪♫\s]+$/g, "").trim();
      ttsScript = `♪ ${clean} ♪`;
    }

    const ttsResponse = await ai.models.generateContent({
      model: isOliviya || isCoco ? GEMINI_MODELS.TTS_EXPRESSIVE : GEMINI_MODELS.TTS_STANDARD,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: ttsScript,
              ...(speechStyle ? { speechMetadata: { style: speechStyle, speaker: speakerLabel } } : {}),
            },
          ],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceToUse },
          },
        },
      },
    });

    return {
      audioData: ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null,
      style: resolvedStyle,
      playbackSpeed,
      pitchFactor,
    };
  } catch (error: any) {
    if (error?.message?.toLowerCase().includes("quota")) {
      console.warn("TTS Quota reached");
    }
    console.error("TTS Error:", error);
    return { audioData: null };
  }
}

export async function getNexaAudio(
  text: string,
  overrideVoice?: string,
  isSinging: boolean = false,
  options?: {
    personalityId?: string;
    oliviaStyle?: OliviaVoiceStyle;
    userPrompt?: string;
  }
): Promise<string | null> {
  const res = await getNexaAudioWithMetadata(text, overrideVoice, isSinging, options);
  return res.audioData;
}
