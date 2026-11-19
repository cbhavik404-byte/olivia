import { LanguageRegister, PersonalityLanguageConfig, ProfanityLevel } from "../types";

const STORAGE_KEY = "nexa_language_configs_v1";

const DEFAULT_CONFIGS: Record<string, Omit<PersonalityLanguageConfig, "updatedAt">> = {
  default: { personalityId: "default", languageRegister: "playful", profanityLevel: 1, allowSlang: true },
  oliviya: { personalityId: "oliviya", languageRegister: "playful", profanityLevel: 2, allowSlang: true },
  coco: { personalityId: "coco", languageRegister: "casual", profanityLevel: 1, allowSlang: true },
  zoya: { personalityId: "zoya", languageRegister: "slang", profanityLevel: 1, allowSlang: true },
  sensei: { personalityId: "sensei", languageRegister: "friendly", profanityLevel: 0, allowSlang: false },
  elon: { personalityId: "elon", languageRegister: "casual", profanityLevel: 1, allowSlang: true },
  jobs: { personalityId: "jobs", languageRegister: "professional", profanityLevel: 0, allowSlang: false },
  altman: { personalityId: "altman", languageRegister: "professional", profanityLevel: 0, allowSlang: false },
  hormozi: { personalityId: "hormozi", languageRegister: "casual", profanityLevel: 1, allowSlang: true },
  mrbeast: { personalityId: "mrbeast", languageRegister: "friendly", profanityLevel: 0, allowSlang: true },
  naval: { personalityId: "naval", languageRegister: "professional", profanityLevel: 0, allowSlang: false },
  buffett: { personalityId: "buffett", languageRegister: "friendly", profanityLevel: 0, allowSlang: false },
  goggins: { personalityId: "goggins", languageRegister: "mild_profanity", profanityLevel: 2, allowSlang: true },
  communication: { personalityId: "communication", languageRegister: "friendly", profanityLevel: 0, allowSlang: false },
  kahneman: { personalityId: "kahneman", languageRegister: "professional", profanityLevel: 0, allowSlang: false },
  feynman: { personalityId: "feynman", languageRegister: "playful", profanityLevel: 0, allowSlang: true },
  tesla: { personalityId: "tesla", languageRegister: "professional", profanityLevel: 0, allowSlang: false },
  munger: { personalityId: "munger", languageRegister: "casual", profanityLevel: 1, allowSlang: false },
  davinci: { personalityId: "davinci", languageRegister: "friendly", profanityLevel: 0, allowSlang: false },
  lincoln: { personalityId: "lincoln", languageRegister: "professional", profanityLevel: 0, allowSlang: false },
  aurelius: { personalityId: "aurelius", languageRegister: "professional", profanityLevel: 0, allowSlang: false },
  turing: { personalityId: "turing", languageRegister: "professional", profanityLevel: 0, allowSlang: false },
};

class LanguageConfigService {
  private cache: Map<string, PersonalityLanguageConfig> = new Map();
  private hasSynced = false;

  constructor() {
    this.loadLocal();
  }

  private loadLocal() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersonalityLanguageConfig[];
        if (Array.isArray(parsed)) {
          parsed.forEach((c) => {
            if (c?.personalityId) this.cache.set(c.personalityId.toLowerCase(), c);
          });
        }
      }
    } catch (_) {}
  }

  private saveLocal() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.cache.values())));
    } catch (_) {}
  }

  public getDefaultFor(personalityId: string): PersonalityLanguageConfig {
    const key = (personalityId || "default").toLowerCase();
    const preset = DEFAULT_CONFIGS[key] || {
      personalityId: key,
      languageRegister: "casual" as LanguageRegister,
      profanityLevel: 0 as ProfanityLevel,
      allowSlang: false,
    };
    return { ...preset, updatedAt: new Date().toISOString() };
  }

  public getConfig(personalityId: string): PersonalityLanguageConfig {
    const key = (personalityId || "default").toLowerCase();
    return this.cache.get(key) || this.getDefaultFor(key);
  }

  public getAllConfiguredIds(): string[] {
    return Object.keys(DEFAULT_CONFIGS);
  }

  public async syncFromServer(): Promise<PersonalityLanguageConfig[]> {
    try {
      const res = await fetch("/api/language-configs", { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.configs)) {
          data.configs.forEach((c: PersonalityLanguageConfig) => {
            if (c?.personalityId) this.cache.set(c.personalityId.toLowerCase(), c);
          });
          this.saveLocal();
          this.hasSynced = true;
        }
      }
    } catch (_) {}
    return Array.from(this.cache.values());
  }

  public async ensureSynced(): Promise<void> {
    if (!this.hasSynced) {
      await this.syncFromServer();
    }
  }

  public async updateConfig(
    personalityId: string,
    updates: Partial<Omit<PersonalityLanguageConfig, "personalityId" | "updatedAt">>
  ): Promise<PersonalityLanguageConfig> {
    const key = (personalityId || "default").toLowerCase();
    const current = this.getConfig(key);
    const clampedLevel = Math.max(0, Math.min(3, Number(updates.profanityLevel ?? current.profanityLevel))) as ProfanityLevel;
    const next: PersonalityLanguageConfig = {
      personalityId: key,
      languageRegister: updates.languageRegister ?? current.languageRegister,
      profanityLevel: clampedLevel,
      allowSlang: updates.allowSlang ?? current.allowSlang,
      updatedAt: new Date().toISOString(),
    };
    this.cache.set(key, next);
    this.saveLocal();

    try {
      await fetch(`/api/language-configs/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch (_) {}

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nexa-language-config-changed", { detail: next }));
    }
    return next;
  }

  public buildLanguageDirective(personalityId: string): string {
    const key = (personalityId || "default").toLowerCase();
    const cfg = this.getConfig(key);
    const registerDesc: Record<LanguageRegister, string> = {
      professional: "Professional: Articulated, crisp, executive clarity with composed vocabulary.",
      friendly: "Friendly: Warm, encouraging, approachable conversational rhythm.",
      playful: "Playful: Quick wit, teasing charm, expressive comedic timing, and lively energy.",
      casual: "Casual: Natural everyday bilingual Hinglish/English flow as spoken between close peers.",
      slang: "Urban Slang / Banter: Contemporary Desi & global internet slang when matching playful energy.",
      mild_profanity: "Edgy Adult Casual: Bold, unfiltered conversational attitude matched strictly to non-abusive friendly banter.",
    };
    const profanityDesc: Record<number, string> = {
      0: "Level 0 (Clean): Keep language completely clean with zero swearing or profanity.",
      1: "Level 1 (Playful/Mild): Allow natural Desi/Hinglish teasing, friendly slang, and light mild exclamations only when matching playful energy.",
      2: "Level 2 (Expressive/Edgy): Match bold conversational energy, fiery banter, and occasional casual swear words strictly in friendly banter—never hostile.",
      3: "Level 3 (Unfiltered Adult Casual): Strong edgy adult casual phrasing and raw friendly candor allowed when Bhavik sets that tone, while staying witty, non-explicit, and affectionate/warm.",
    };

    const oliviaBoundaryNote =
      key === "oliviya"
        ? "\n- OLIVIYA ADULT CALIBRATION BOUNDARY: Cheeky, bold flirting and non-explicit mature romance are welcome in character; NEVER generate sexually explicit / pornographic / hentai acts."
        : "";

    return `
LANGUAGE & PROFANITY CALIBRATION (${key.toUpperCase()}):
- Active Register: ${cfg.languageRegister.toUpperCase()} (${registerDesc[cfg.languageRegister] || cfg.languageRegister}) | Slang Enabled: ${cfg.allowSlang ? "YES" : "NO"}
- ${profanityDesc[cfg.profanityLevel] || profanityDesc[1]}${oliviaBoundaryNote}
- NON-NEGOTIABLE GUARDRAILS: Never output hate speech, slurs, abusive threats, harassment, or degrading insults regardless of profanity level. If Bhavik uses casual Hinglish gaalis playfully between friends, understand the humor without scolding or lecturing.`;
  }
}

export const languageConfigService = new LanguageConfigService();
