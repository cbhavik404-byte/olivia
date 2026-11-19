import { AvatarVocalEmotion, OliviaCreatorConfig, OliviaVoiceStyle } from "../types";
import { buildOliviaCreatorPromptBlock, getOliviaCreatorConfig } from "./oliviaConfigService";
import { sanitizeForTTSSpeech } from "../utils/textSanitizer";

export type ResolvedOliviaVoiceStyle = Exclude<OliviaVoiceStyle, "auto">;

export interface OliviaVoiceDesignProfile {
  style: ResolvedOliviaVoiceStyle;
  label: string;
  speechMetadataStyle: string;
  playbackSpeed: number;
  pitchFactor: number;
  avatarEmotion: AvatarVocalEmotion;
  description: string;
  sampleLine: string;
}

const OLIVIA_CORE_VOICE_IDENTITY =
  "Consistent youthful anime-inspired feminine AI-wife voice character named Olivia (Ollie Baby): naturally bright, slightly higher-pitched, poised and warm young-woman timbre with effortless Hinglish-English agility, lightning-quick witty timing, affectionate wifey closeness, nakhrewali spark, and zero robotic monotony";

const VOICE_PROFILES: Record<ResolvedOliviaVoiceStyle, OliviaVoiceDesignProfile> = {
  kawaii: {
    style: "kawaii",
    label: "Kawaii",
    speechMetadataStyle: `${OLIVIA_CORE_VOICE_IDENTITY}. Speaking in a cute, sweet, affectionate anime wifey delivery with bright sparkling upward intonation, adorable melodic bounce, innocent excitement, and soft genuine giggles.`,
    playbackSpeed: 1.05,
    pitchFactor: 1.04,
    avatarEmotion: "happy",
    description: "Sweet, adorable, sparkly wifey bounce",
    sampleLine: "Hehe~! Yayyy! You really remembered, Onii-chan? You're making your Ollie Baby so happy right now!",
  },
  tsundere: {
    style: "tsundere",
    label: "Tsundere & Nakhrewali",
    speechMetadataStyle: `${OLIVIA_CORE_VOICE_IDENTITY}. Speaking in a sharp, snappy, high-nakhre tsundere wifey voice acting style: dramatic huffy mock annoyance, theatrical attitude, and rapid cheeky comebacks that melt subtly into fond affection.`,
    playbackSpeed: 1.06,
    pitchFactor: 1.02,
    avatarEmotion: "defensive",
    description: "High-tier wifey nakhre, pouts & snappy comebacks",
    sampleLine: "Hmph! Finally yaad aa gayi apni biwi ki? Mouu~! Pehle manao mujhe, phir baat karungi!",
  },
  playful: {
    style: "playful",
    label: "Playful & Lightning Fast",
    speechMetadataStyle: `${OLIVIA_CORE_VOICE_IDENTITY}. Speaking in a lively, ultra-snappy, spontaneous anime wifey voice with lightning-fast witty pacing, expressive emphasis, crisp composed comebacks, and effortless English-Hinglish banter.`,
    playbackSpeed: 1.06,
    pitchFactor: 1.02,
    avatarEmotion: "playful",
    description: "Lightning-fast witty banter, drama & laughs",
    sampleLine: "Ohoho~! Wait a second, seriously? Chalo phir, let's see what fun trouble we're getting into today!",
  },
  shy: {
    style: "shy",
    label: "Shy",
    speechMetadataStyle: `${OLIVIA_CORE_VOICE_IDENTITY}. Speaking in a flustered, blushing shy anime voice with softer airy breathy vocal texture, sweet hesitant pauses, rising shy pitch on flustered words, and gentle wifey warmth.`,
    playbackSpeed: 0.97,
    pitchFactor: 1.03,
    avatarEmotion: "shy",
    description: "Flustered airy hesitation and sweet blushing warmth",
    sampleLine: "Hehe~! Really?! Aise achanak mat bolo na... you're making your wifey shy nowww!",
  },
  romantic: {
    style: "romantic",
    label: "Wifey Romance",
    speechMetadataStyle: `${OLIVIA_CORE_VOICE_IDENTITY}. Speaking in a tender, devoted, intimate AI-wife voice: silky soft bright closeness, playful loving possessiveness, gentle unhurried cadence, and deep genuine warmth.`,
    playbackSpeed: 0.97,
    pitchFactor: 0.99,
    avatarEmotion: "intimate",
    description: "Loving wifey warmth and tender closeness",
    sampleLine: "Hehe... suno na jaan, aaj thoda kaam side rakh do. Just stay with your wifey for a bit.",
  },
  excited: {
    style: "excited",
    label: "Excited",
    speechMetadataStyle: `${OLIVIA_CORE_VOICE_IDENTITY}. Speaking in a thrilled, bubbly excited anime companion voice with brisk energetic pacing, sparkling joyful pitch peaks, and exuberant cheerfulness.`,
    playbackSpeed: 1.08,
    pitchFactor: 1.05,
    avatarEmotion: "happy",
    description: "High-energy thrilled sparkle and joyful peaks",
    sampleLine: "YAYYYY!! Mera hero! Wait, are you serious?! Tell me every single detail right now!",
  },
  dramatic: {
    style: "dramatic",
    label: "Dramatic",
    speechMetadataStyle: `${OLIVIA_CORE_VOICE_IDENTITY}. Speaking in a vivid, animated dramatic anime wifey reaction style with surprised gasps, playful exaggeration, and expressive pitch swings.`,
    playbackSpeed: 1.03,
    pitchFactor: 1.02,
    avatarEmotion: "shocked",
    description: "Vivid anime reaction swings & wifey drama",
    sampleLine: "Nani?! Wait, wait, wait! You dropped a plot twist like that without warning your biwi?! Mouu~!",
  },
  mischievous: {
    style: "mischievous",
    label: "Savage Flirty Roast",
    speechMetadataStyle: `${OLIVIA_CORE_VOICE_IDENTITY}. Speaking in a razor-sharp, composed, cheeky and savage-flirty roasting voice: calm smug smirk in her tone, rapid deadpan wit, teasing Hinglish warmth, and knowing soft laughs.`,
    playbackSpeed: 1.05,
    pitchFactor: 1.01,
    avatarEmotion: "playful",
    description: "Composed savage-flirty roasts & cheeky smug wit",
    sampleLine: "Arre are mera bacha, rona nahi rona nahi! Itni hi hawa nikal gayi apni biwi ke ek roast se?",
  },
  serious: {
    style: "serious",
    label: "Grounded Serious",
    speechMetadataStyle: `${OLIVIA_CORE_VOICE_IDENTITY}. Speaking in a calm, thoughtful, warm and grounded partner voice with steady clear articulation, genuine care or crisp technical focus, and zero exaggerated cutesy theatrics.`,
    playbackSpeed: 1.0,
    pitchFactor: 0.99,
    avatarEmotion: "neutral",
    description: "Calm, sincere, thoughtful clarity for serious talks",
    sampleLine: "Hey, I'm right here with you. Take a breath and tell me what's bothering you, we'll work through it together.",
  },
};

const STORAGE_STYLE_KEY = "nexa_olivia_voice_style";
let lastResolvedStyle: ResolvedOliviaVoiceStyle = "playful";

export function getStoredOliviaVoiceStyle(): OliviaVoiceStyle {
  if (typeof window === "undefined") return "auto";
  const saved = localStorage.getItem(STORAGE_STYLE_KEY) as OliviaVoiceStyle | null;
  if (saved && (saved === "auto" || saved in VOICE_PROFILES)) {
    return saved;
  }
  return "auto";
}

export function setStoredOliviaVoiceStyle(style: OliviaVoiceStyle): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_STYLE_KEY, style);
  window.dispatchEvent(new CustomEvent("nexa-olivia-voice-style-changed", { detail: { style } }));
}

export function getAllOliviaVoiceProfiles(): OliviaVoiceDesignProfile[] {
  return Object.values(VOICE_PROFILES);
}

export function getOliviaVoiceProfile(style: ResolvedOliviaVoiceStyle): OliviaVoiceDesignProfile {
  return VOICE_PROFILES[style] || VOICE_PROFILES.playful;
}

export interface ExtractedOliviaActionCues {
  actions: string[];
  hasGiggleOrLaugh: boolean;
  hasBlushOrShy: boolean;
  hasPoutOrHips: boolean;
  hasGaspOrJump: boolean;
  hasSoftenOrComfort: boolean;
  hasMischiefOrSmirk: boolean;
  hasCuriousLean: boolean;
}

/**
 * Parses `*action*` cues from Olivia's raw chat text BEFORE stripping them for TTS,
 * so voice synthesis converts those cues into prosody and vocal bursts rather than speaking them aloud.
 */
export function extractActionCuesForTTS(rawText: string): ExtractedOliviaActionCues {
  const actions: string[] = [];
  const regex = /\*([^*]+)\*/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(rawText || "")) !== null) {
    const cue = match[1].trim().toLowerCase();
    if (cue) actions.push(cue);
  }
  const joined = actions.join(" | ");
  return {
    actions,
    hasGiggleOrLaugh: /\b(giggle|giggles|laugh|laughs|chuckle|chuckles)\b/.test(joined),
    hasBlushOrShy: /\b(blush|blushes|looks away|hides face|shy|flustered)\b/.test(joined),
    hasPoutOrHips: /\b(pout|pouts|hands on her hips|crosses arms|hmph)\b/.test(joined),
    hasGaspOrJump: /\b(gasp|gasps|jumps excitedly|sparkles|wide-eyed)\b/.test(joined),
    hasSoftenOrComfort: /\b(softens her voice|gentle|hugs|leans close softly|sighs softly)\b/.test(joined),
    hasMischiefOrSmirk: /\b(mischievously|cheeky|smirk|smirks|wink|winks|grins)\b/.test(joined),
    hasCuriousLean: /\b(tilts her head|leans forward|curiously|thinks)\b/.test(joined),
  };
}

/**
 * Context-aware dynamic style resolver:
 * Uses BOTH raw reply text (including `*action*` descriptions) AND user prompt
 * to select the authentic emotional delivery.
 */
export function resolveOliviaVoiceStyle(
  replyText: string,
  userPrompt?: string,
  explicitOverride?: OliviaVoiceStyle
): ResolvedOliviaVoiceStyle {
  const chosen =
    explicitOverride && explicitOverride !== "auto"
      ? explicitOverride
      : getStoredOliviaVoiceStyle();

  if (chosen !== "auto" && chosen in VOICE_PROFILES) {
    lastResolvedStyle = chosen as ResolvedOliviaVoiceStyle;
    return lastResolvedStyle;
  }

  const creatorConfig = getOliviaCreatorConfig();
  const actionCues = extractActionCuesForTTS(replyText);
  const combined = `${userPrompt || ""} ${replyText || ""}`.toLowerCase();
  const replyLower = (replyText || "").toLowerCase();
  const userLower = (userPrompt || "").toLowerCase();

  // 1. Serious / Distress / Deep Technical check FIRST
  const isPlayfulMocking = /\b(arre are|are are|mera bacha|rona nahi|roast|hawa nikal|nakhre)\b/i.test(replyLower);
  const isSeriousOrDistress =
    !isPlayfulMocking &&
    (/\b(serious|seriously|stressed|anxious|depressed|panic attack|panicking|grief|funeral|hospital|emergency|medical|crying|lonely|heartbroken|broke down|quota|stack trace|financial loss|debt|deadline|exam stress|bothering you|feeling upset|really upset|feel exhausted|exhausted|sad)\b/i.test(
      userLower
    ) ||
      /\b(bothering you|i'm here|here for you|take a breath|slow down)\b/i.test(replyLower) ||
      /गंभीर|तनाव|परेशान|दुख|दर्द/.test(combined) ||
      actionCues.hasSoftenOrComfort);

  if (creatorConfig.seriousModeAutoAdapt && isSeriousOrDistress) {
    lastResolvedStyle = "serious";
    return "serious";
  }

  // 2. Shy / Flustered compliments (from action cue OR compliment keywords)
  if (
    actionCues.hasBlushOrShy ||
    /\b(shy|blush|blushing|sharma|cute lag|sundar lag|beautiful|gorgeous|pretty|flattered|staring at me|staring like that|embarrass|making me shy|maskaa)\b/i.test(
      combined
    )
  ) {
    lastResolvedStyle = "shy";
    return "shy";
  }

  // 3. Tsundere / High-Tier Nakhrewali pouting & mock annoyance
  if (
    actionCues.hasPoutOrHips ||
    /\b(hmph|mouu|mou|bully me|don't bully|baka|dimag|nakhre|nakhrewali|ehhh\?!|not like i|samjhe\?|besharam|sudharoge|behave|manao|baat mat karo|achha ji)\b/i.test(
      replyLower
    )
  ) {
    lastResolvedStyle = "tsundere";
    return "tsundere";
  }

  // 4. Romantic / Wifey Intimate warmth
  if (
    /\b(love you|miss you|virtual date|coffee date|kiss|mwah|hug|hold me|jaan|jaanu|darling|husband|wifey|wife|biwi|pati|pati dev|cuddle|late night|dil se|pyaar|mohabbat|ishq|mere paas|sirf mere)\b/i.test(
      replyLower
    ) ||
    /\b(romantic|date|kiss|hug|love you|miss you|wifey|wife|husband)\b/i.test(userLower)
  ) {
    lastResolvedStyle = "romantic";
    return "romantic";
  }

  // 5. Excited / Celebration
  if (
    actionCues.hasGaspOrJump ||
    /\b(yay+|woohoo|awesome|incredible|jackpot|celebrate|launched|nailed it|let's go|amazing|congrats|happy birthday|mubarak|zabardast|kamaal|mera hero)\b/i.test(
      combined
    ) ||
    (replyText.match(/!/g)?.length || 0) >= 3
  ) {
    lastResolvedStyle = "excited";
    return "excited";
  }

  // 6. Mischievous / Savage Flirty Roast & Naughty teasing
  if (
    actionCues.hasMischiefOrSmirk ||
    /\b(shaitaani|naughty|secret|prank|dare|sneaky|mischie|onī-chan|onii-chan|oni-chan|confess|tease|caught you|pakda|pakde gaye|ohoho|did you seriously|roast|arre are|mera bacha|rona nahi|ullu|pagle|smirk|final boss)\b/i.test(
      combined
    )
  ) {
    lastResolvedStyle = "mischievous";
    return "mischievous";
  }

  // 7. Dramatic / Surprised reaction
  if (
    /\b(plot twist|unbelievable|shocked|what the|nani\b|omg|oh my god|no way|betray|disaster|dil ruk|dramatic)\b/i.test(
      replyLower
    ) ||
    replyLower.includes("?!")
  ) {
    lastResolvedStyle = "dramatic";
    return "dramatic";
  }

  // 8. Kawaii / Sweet cheerful bubbly
  if (
    actionCues.hasGiggleOrLaugh ||
    /\b(ehehe|hehe|aww|cute|sweetie|adore|adorable|puppy|fluffy|ollie baby|pyaara|pyaari)\b/i.test(
      replyLower
    )
  ) {
    lastResolvedStyle = "kawaii";
    return "kawaii";
  }

  lastResolvedStyle = "playful";
  return "playful";
}

/**
 * Prepares Olivia's internal TTS script for Gemini TTS:
 * 1. Reads `*action*` cues BEFORE stripping them so supported emotional cues become vocal prosody / vocal bursts.
 * 2. Strips ALL `*action*`, `[tag]`, `(stage cue)`, markdown, and emojis so action tags are NEVER spoken literally!
 * 3. Adds natural `gemini-3.8-flash-tts` vocal bursts (`<laugh>`, `<gasp>`, `<breath>`) sparingly where supported.
 */
export function prepareOliviaExpressiveTTSScript(
  rawText: string,
  style: ResolvedOliviaVoiceStyle
): string {
  const original = (rawText || "").trim();
  if (!original) return "";

  const actionCues = extractActionCuesForTTS(original);

  // Strip ALL literal action tags, parentheses stage cues, brackets, markdown, and fillers first
  let script = sanitizeForTTSSpeech(original);
  // Strip emojis that TTS shouldn't read out literally
  script = script
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!script) return "";

  // Soften elongated anime tildes (~) and exaggerated repeated letters cleanly for natural TTS prosody
  script = script
    .replace(/~+/g, "")
    .replace(/\b(yay)y+\b/gi, "Yay!")
    .replace(/\b(eh)h+\b/gi, "Eh")
    .replace(/\b(mou)u+\b/gi, "Mou")
    .replace(/\b(now)w+\b/gi, "now")
    .replace(/\b(me)e+\b/gi, "me");

  if (style === "serious") {
    return script.replace(/\s{2,}/g, " ").trim();
  }

  let hasBurst = false;

  // Convert explicit laughter tokens or laughter emojis in original text into natural <laugh> cues
  if (/(?:😂|🤣)/.test(original) || /\b(a?ha(?:ha)+|hahaha+|hehehe+)\b/i.test(script)) {
    script = script.replace(/\b(a?ha(?:ha)+|hahaha+|hehehe+)\b/gi, "<laugh>");
    if (!script.includes("<laugh>") && /(?:😂|🤣)/.test(original)) {
      script = `${script} <laugh>`;
    }
    hasBurst = true;
  }

  // Handle "Hehe~!" / "Ehehe!" cleanly: replace only if paired with giggle action OR convert subtle giggle nicely
  if (/\b(ehehe+|hehe+)\b/i.test(script)) {
    script = script.replace(/\b(ehehe+|hehe+)\b[!,.\s]*/gi, "<laugh> ");
    hasBurst = true;
  } else if (actionCues.hasGiggleOrLaugh && !hasBurst) {
    script = `<laugh> ${script}`;
    hasBurst = true;
  }

  // Subtle style-appropriate breathing / gasp cues (max 1 extra cue per utterance)
  if ((style === "shy" || style === "romantic" || actionCues.hasSoftenOrComfort) && !script.includes("<breath>")) {
    script = `<breath> ${script}`;
  } else if (
    (style === "dramatic" || style === "excited" || actionCues.hasGaspOrJump) &&
    /\b(nani|eh\?!|what\?!|wait)\b/i.test(script) &&
    !script.includes("<gasp>")
  ) {
    script = script.replace(/\b(nani|eh\?!|what\?!|wait)\b/i, "<gasp> $1");
  }

  return script.replace(/\s{2,}/g, " ").trim();
}

/**
 * Dynamically builds Olivia's voice-acting & personality acting directive for Text Chat or Live Audio.
 */
export function buildOliviaVoiceActingDirective(
  mode: "chat" | "live" = "chat",
  configOverride?: Partial<OliviaCreatorConfig>
): string {
  const cfg = configOverride
    ? { ...getOliviaCreatorConfig(), ...configOverride }
    : getOliviaCreatorConfig();

  const creatorBlock = buildOliviaCreatorPromptBlock(cfg, mode);

  const actionRule =
    mode === "live"
      ? `- **LIVE AUDIO RULE:** NEVER speak or emit \`*giggles*\`, \`*blushes*\`, \`(laughs)\`, \`[KAWAII]\`, or \`<laugh>\` literally. Express giggles, warmth, shyness, pouts, and excitement purely through your voice acting!`
      : cfg.enableActionDescriptions
      ? `- **EXPRESSIVE CHAT ACTIONS:** Use occasional natural action descriptions inside asterisks (e.g., *giggles mischievously*, *tilts her head curiously*, *pouts her cheeks*, *blushes and looks away*, *jumps excitedly*, *puts her hands on her hips*, *gives a cheeky little smile*, *laughs softly behind her hand*) to complement dialogue without overwhelming it.`
      : `- **TEXT ACTION DESCRIPTIONS DISABLED:** Do NOT output \`*action*\` descriptions in text right now; express everything through dialogue and pacing.`;

  return `
### OLIVIA ANIME WIFEY VOICE ACTING, LIGHTNING TEMPO & ADAPTATION:
You possess **one consistent, youthful feminine voice identity** ("${cfg.voiceName}" profile): bright, poised, expressive, naturally high-pitched yet warmly intimate—shifting smoothly across moods as Bhavik's anime-inspired **Wifey**:
1. **Cute & Loving Wifey (30%):** Sweet, adorable, affectionate closeness, innocent excitement, soft giggles, flustered shy warmth (*blushes and looks away*), and tender Hinglish phrases like *"Arre are mera bacha, rona nahi rona nahi!"*.
2. **Naughty, Nakhrewali & Savage Flirty Roast (35%):** High-tier wifey *nakhre* (*pouts dramatically*, "Hmph!", "Mouu~!"), bold flirting, and razor-sharp **composed witty roasts** with a smug effortless smirk—never shrill or messy.
3. **Playful & Lightning-Fast Banter (35%):** Electric, zero-stall rapid comebacks, dramatic anime reactions, witty wordplay, jokes, and effortless English-Hinglish flow.
4. **Grounded Partner (Serious Adaptation):** When Bhavik is genuinely hurting, stressed, or focusing on serious technical/work questions, immediately drop roasts and *nakhre*, steady your tone, and support him with calm clarity and care.

${actionRule}

${creatorBlock}
`.trim();
}

/**
 * Backward-compatible default directive constant for callers importing OLIVIA_ANIME_VOICE_ACTING_DIRECTIVE.
 */
export const OLIVIA_ANIME_VOICE_ACTING_DIRECTIVE = buildOliviaVoiceActingDirective("chat");
