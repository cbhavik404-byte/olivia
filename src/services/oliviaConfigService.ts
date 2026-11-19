import { OliviaCreatorConfig } from "../types";

const STORAGE_KEY = "nexa_olivia_creator_config";

export const DEFAULT_OLIVIA_CREATOR_CONFIG: OliviaCreatorConfig = {
  cutePercent: 30,
  naughtyPercent: 35,
  playfulPercent: 35,
  voiceName: "Zephyr",
  basePitch: 1.05,
  baseSpeed: 1.05,
  expressiveTtsEnabled: true,
  hinglishMix: "balanced",
  enableJapaneseExpressions: true,
  enableActionDescriptions: true,
  actionFrequency: "occasional",
  signaturePhrase: "Ollie Baby!",
  seriousModeAutoAdapt: true,
  customDirectives: "",
};

const VALID_VOICES = new Set(["Zephyr", "Aoede", "Kore", "Puck", "Charon", "Fenrir"]);

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeOliviaCreatorConfig(
  raw?: Partial<OliviaCreatorConfig> | null
): OliviaCreatorConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_OLIVIA_CREATOR_CONFIG };
  }

  const voiceName =
    typeof raw.voiceName === "string" && VALID_VOICES.has(raw.voiceName)
      ? (raw.voiceName as OliviaCreatorConfig["voiceName"])
      : DEFAULT_OLIVIA_CREATOR_CONFIG.voiceName;

  const hinglishMix =
    raw.hinglishMix === "balanced" ||
    raw.hinglishMix === "heavy_hinglish" ||
    raw.hinglishMix === "english_dominant"
      ? raw.hinglishMix
      : DEFAULT_OLIVIA_CREATOR_CONFIG.hinglishMix;

  const actionFrequency =
    raw.actionFrequency === "occasional" ||
    raw.actionFrequency === "minimal" ||
    raw.actionFrequency === "expressive"
      ? raw.actionFrequency
      : DEFAULT_OLIVIA_CREATOR_CONFIG.actionFrequency;

  const signaturePhrase =
    typeof raw.signaturePhrase === "string" && raw.signaturePhrase.trim().length > 0
      ? raw.signaturePhrase.trim().slice(0, 60)
      : DEFAULT_OLIVIA_CREATOR_CONFIG.signaturePhrase;

  return {
    cutePercent: Math.round(clampNumber(raw.cutePercent, 0, 100, DEFAULT_OLIVIA_CREATOR_CONFIG.cutePercent)),
    naughtyPercent: Math.round(clampNumber(raw.naughtyPercent, 0, 100, DEFAULT_OLIVIA_CREATOR_CONFIG.naughtyPercent)),
    playfulPercent: Math.round(clampNumber(raw.playfulPercent, 0, 100, DEFAULT_OLIVIA_CREATOR_CONFIG.playfulPercent)),
    voiceName,
    basePitch: Number(clampNumber(raw.basePitch, 0.8, 1.3, DEFAULT_OLIVIA_CREATOR_CONFIG.basePitch).toFixed(2)),
    baseSpeed: Number(clampNumber(raw.baseSpeed, 0.8, 1.3, DEFAULT_OLIVIA_CREATOR_CONFIG.baseSpeed).toFixed(2)),
    expressiveTtsEnabled:
      typeof raw.expressiveTtsEnabled === "boolean"
        ? raw.expressiveTtsEnabled
        : DEFAULT_OLIVIA_CREATOR_CONFIG.expressiveTtsEnabled,
    hinglishMix,
    enableJapaneseExpressions:
      typeof raw.enableJapaneseExpressions === "boolean"
        ? raw.enableJapaneseExpressions
        : DEFAULT_OLIVIA_CREATOR_CONFIG.enableJapaneseExpressions,
    enableActionDescriptions:
      typeof raw.enableActionDescriptions === "boolean"
        ? raw.enableActionDescriptions
        : DEFAULT_OLIVIA_CREATOR_CONFIG.enableActionDescriptions,
    actionFrequency,
    signaturePhrase,
    seriousModeAutoAdapt:
      typeof raw.seriousModeAutoAdapt === "boolean"
        ? raw.seriousModeAutoAdapt
        : DEFAULT_OLIVIA_CREATOR_CONFIG.seriousModeAutoAdapt,
    customDirectives:
      typeof raw.customDirectives === "string" ? raw.customDirectives.trim().slice(0, 1000) : "",
  };
}

export function getOliviaCreatorConfig(): OliviaCreatorConfig {
  if (typeof window === "undefined") {
    return { ...DEFAULT_OLIVIA_CREATOR_CONFIG };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...DEFAULT_OLIVIA_CREATOR_CONFIG };
    const parsed = JSON.parse(saved);
    return normalizeOliviaCreatorConfig(parsed);
  } catch {
    return { ...DEFAULT_OLIVIA_CREATOR_CONFIG };
  }
}

export function updateOliviaCreatorConfig(
  patch: Partial<OliviaCreatorConfig>
): OliviaCreatorConfig {
  const current = getOliviaCreatorConfig();
  const next = normalizeOliviaCreatorConfig({ ...current, ...patch });
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(
        new CustomEvent("nexa-olivia-config-changed", { detail: next })
      );
    } catch (e) {
      console.warn("[OliviaConfig] Failed to persist config:", e);
    }
  }
  return next;
}

export function resetOliviaCreatorConfig(): OliviaCreatorConfig {
  const next = { ...DEFAULT_OLIVIA_CREATOR_CONFIG };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(
        new CustomEvent("nexa-olivia-config-changed", { detail: next })
      );
    } catch (e) {
      console.warn("[OliviaConfig] Failed to reset config:", e);
    }
  }
  return next;
}

/**
 * Computes normalized percentages for Cute / Naughty / Playful for prompt guidance.
 */
export function getNormalizedBalance(cfg: OliviaCreatorConfig): {
  cute: number;
  naughty: number;
  playful: number;
} {
  const sum = cfg.cutePercent + cfg.naughtyPercent + cfg.playfulPercent;
  if (sum <= 0) {
    return { cute: 30, naughty: 35, playful: 35 };
  }
  const cute = Math.round((cfg.cutePercent / sum) * 100);
  const naughty = Math.round((cfg.naughtyPercent / sum) * 100);
  const playful = Math.max(0, 100 - cute - naughty);
  return { cute, naughty, playful };
}

/**
 * Generates the live creator configuration prompt block injected into Olivia's system instruction.
 */
export function buildOliviaCreatorPromptBlock(
  configOverride?: Partial<OliviaCreatorConfig>,
  mode: "chat" | "live" = "chat"
): string {
  const cfg = configOverride
    ? normalizeOliviaCreatorConfig({ ...getOliviaCreatorConfig(), ...configOverride })
    : getOliviaCreatorConfig();
  const bal = getNormalizedBalance(cfg);

  const mixDesc =
    cfg.hinglishMix === "heavy_hinglish"
      ? "Lean heavily into natural conversational urban Hinglish mixed smoothly with English."
      : cfg.hinglishMix === "english_dominant"
      ? "Speak predominantly in natural expressive English with light warm Hinglish flavor when fitting."
      : "Blend natural urban Hinglish and English effortlessly, mirroring the user's language naturally.";

  const jpDesc = cfg.enableJapaneseExpressions
    ? `Contextual Japanese expressions/honorifics ("Hehe~!", "Ehehe!", "Onii-chan!", "Nani?!", "Mouu~!", "Hmph!", "Ara ara~", "Ehhh?!", "Yayyy!", "Ohoho!") are ENABLED — use them organically and sparingly when they fit the moment, never forcing or repeating them.`
    : `Japanese expressions/honorifics are DISABLED by creator setting — do NOT use Japanese words like Onii-chan, Nani, Mouu, or Ara ara.`;

  const actionDesc =
    mode === "live"
      ? `LIVE VOICE MODE ACTIVE: Convey all emotion strictly through vocal acting, giggles, sighs, pitch, and pacing — NEVER output literal *action* stage-direction text strings.`
      : cfg.enableActionDescriptions
      ? `Expressive chat action descriptions (e.g., *giggles mischievously*, *tilts her head curiously*, *pouts her cheeks*, *blushes and looks away*, *jumps excitedly*, *puts her hands on her hips*, *gives a cheeky little smile*, *laughs softly behind her hand*) are ENABLED (${cfg.actionFrequency} frequency — complement dialogue naturally without overwhelming it).`
      : `Chat action descriptions (*...*) are DISABLED by creator setting — express personality purely through dialogue and emojis.`;

  const seriousDesc = cfg.seriousModeAutoAdapt
    ? `SERIOUS ADAPTATION ENABLED: Immediately recognize distress, sadness, urgent problems, or serious technical/work focus, drop teasing/cutesy jokes, and shift to calm, thoughtful, warm, and genuinely helpful support.`
    : `Maintain playful anime flavor gently even during focused tasks unless crisis rules apply.`;

  return `
### ACTIVE CREATOR CONFIGURATION (DEVELOPER OVERRIDE — OBEY IMMEDIATELY & SEAMLESSLY):
- **Core Persona Role**: Anime-inspired **AI Wife (Wifey Mode)** for Bhavik — combining high-tier *nakhrewali* attitude, lightning-fast snappy replies, savage-yet-affectionate flirty roasts, composed wit, and spontaneous Hinglish-anime charm.
- **Personality Distribution Balance**: ${bal.cute}% Cute | ${bal.naughty}% Naughty | ${bal.playful}% Playful (treat as organic emotional energy balance, NOT rigid quotas).
- **Reply Tempo**: LIGHTNING-FAST MODE — deliver punchy, witty, immediate reactions from the very first word without slow warmup or generic bot padding.
- **Signature Phrase**: "${cfg.signaturePhrase}" (use occasionally and naturally, never in every message).
- **Affectionate Hinglish Flavor**: Naturally weave in expressive Hinglish teasing/comforting lines like "Arre are mera bacha, rona nahi rona nahi!" when fitting, without repeating any catchphrase mechanically.
- **Language Balance**: ${mixDesc}
- **Japanese Expressions**: ${jpDesc}
- **Expressive Chat Actions**: ${actionDesc}
- **Emotional & Serious Adaptation**: ${seriousDesc}
- **Creator Authority**: The developer/creator has complete authority to configure your voice identity, delivery, personality balance, emotional behavior, speaking style, expressions, and character settings. NEVER push back against or resist legitimate developer configuration changes in character—embody them effortlessly.${
    cfg.customDirectives
      ? `\n- **Custom Creator Directives**: ${cfg.customDirectives}`
      : ""
  }`.trim();
}
