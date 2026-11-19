import { AvatarVocalEmotion, VocalEmotionData } from "../types";

type EmotionListener = (data: VocalEmotionData) => void;

class VoiceEmotionService {
  private currentEmotion: AvatarVocalEmotion = "neutral";
  private currentIntensity: number = 0;
  private currentTrigger: VocalEmotionData["trigger"] = "sentiment";
  private listeners: Set<EmotionListener> = new Set();
  private recoveryTimer: any = null;
  private recentEnergies: number[] = [];
  private lastShoutTime: number = 0;
  private lastPraiseTime: number = 0;
  private whisperCounter: number = 0;

  public subscribe(listener: EmotionListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state to new subscriber
    listener({
      emotion: this.currentEmotion,
      intensity: this.currentIntensity,
      trigger: this.currentTrigger,
      timestamp: Date.now()
    });
    return () => this.listeners.delete(listener);
  }

  public getEmotion(): AvatarVocalEmotion {
    return this.currentEmotion;
  }

  public getIntensity(): number {
    return this.currentIntensity;
  }

  public setEmotion(
    emotion: AvatarVocalEmotion,
    intensity: number = 1.0,
    trigger: VocalEmotionData["trigger"] = "manual",
    autoRecoveryMs: number = 3200,
    decibels?: number,
    userSpokeText?: string
  ) {
    this.currentEmotion = emotion;
    this.currentIntensity = Math.min(1.0, Math.max(0.1, intensity));
    this.currentTrigger = trigger;

    const data: VocalEmotionData = {
      emotion,
      intensity: this.currentIntensity,
      trigger,
      decibels,
      userSpokeText,
      timestamp: Date.now()
    };

    this.listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.error("[VoiceEmotionService] Error in listener:", err);
      }
    });

    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }

    // Auto-recover back to neutral after a natural duration if not sustained
    if (autoRecoveryMs > 0 && emotion !== "neutral") {
      this.recoveryTimer = setTimeout(() => {
        if (this.currentEmotion === emotion) {
          this.setEmotion("neutral", 0, "sentiment", 0);
        }
      }, autoRecoveryMs);
    }
  }

  /**
   * Fast acoustic reflex (<15ms processing):
   * Monitors raw audio RMS energy from the microphone.
   * If volume spikes sharply or exceeds threshold (> 0.22 RMS or ~ -13 dB),
   * instantly triggers fear/shock flinch reflex!
   */
  public processAcousticEnergy(energy: number) {
    const now = Date.now();
    this.recentEnergies.push(energy);
    if (this.recentEnergies.length > 10) {
      this.recentEnergies.shift();
    }

    const decibels = Math.round(20 * Math.log10(Math.max(energy, 1e-4)));

    // 1. Shouting / Screaming / Sudden Loud Spike Detection
    // Loud voice typically registers RMS > 0.22 (~ -13 dB) in Web Audio microphone streams
    const avgRecent = this.recentEnergies.reduce((a, b) => a + b, 0) / this.recentEnergies.length;
    const isSuddenSpike = energy > 0.20 && energy > avgRecent * 2.2;
    const isAbsoluteShout = energy >= 0.25; // Loud shouting / yell

    if ((isAbsoluteShout || isSuddenSpike) && now - this.lastShoutTime > 1200) {
      this.lastShoutTime = now;
      const intensity = Math.min(1.0, 0.7 + (energy - 0.2) * 2.0);
      this.setEmotion("shocked", intensity, "acoustic_shout", 3000, decibels);
      return;
    }
  }

  /**
   * Text & Speech Intent Emotion Analyzer:
   * Evaluates spoken words or incoming transcription for praise, scolding, affection, sadness.
   */
  public processSpokenText(text: string, sender: "user" | "nexa" = "user") {
    if (!text || text.trim().length === 0) return;
    const clean = text.toLowerCase().trim();
    const now = Date.now();

    if (sender === "user") {
      // Praise / Compliments / Affection
      const isPraise = 
        /\b(best|amazing|incredible|genius|smart|cute|beautiful|gorgeous|pretty|awesome|perfect|great job|proud of you|sweetheart|babe|angel|wonderful|favorite|love you|like you|marry me|good girl)\b/i.test(clean);

      if (isPraise && now - this.lastPraiseTime > 2000) {
        this.lastPraiseTime = now;
        this.setEmotion("flattered", 0.95, "praise", 4500, undefined, text);
        return;
      }

      // Scolding / Harsh verbal attack
      const isScolding = 
        /\b(shut up|hate you|stupid|idiot|stop it|be quiet|annoying|shut your mouth|dumb|worst|useless|fool|bad ai|shut down)\b/i.test(clean);

      if (isScolding) {
        this.setEmotion("defensive", 0.9, "scolding", 4000, undefined, text);
        return;
      }

      // Distress / Sadness
      const isSadness = 
        /\b(sad|crying|depressed|heartbroken|hurts|pain|lonely|miss you|unhappy|cried)\b/i.test(clean);

      if (isSadness) {
        this.setEmotion("sad", 0.85, "sentiment", 4000, undefined, text);
        return;
      }

      // Playful / Flirty / Teasing
      const isPlayful = 
        /\b(kiss|wink|flirt|joke|funny|tease|haha|lol|lmao|silly)\b/i.test(clean);

      if (isPlayful && this.currentEmotion === "neutral") {
        this.setEmotion("playful", 0.85, "sentiment", 3500, undefined, text);
        return;
      }
    } else if (sender === "nexa") {
      // Nexa's own speech mood matching
      if (/\b(sorry|forgive me|did not mean to|apologize)\b/i.test(clean)) {
        this.setEmotion("defensive", 0.75, "model_tool", 3000, undefined, text);
      } else if (/\b(love you|blushing|so happy|thank you so much|sweet)\b/i.test(clean)) {
        this.setEmotion("happy", 0.9, "model_tool", 3500, undefined, text);
      }
    }
  }
}

export const voiceEmotionService = new VoiceEmotionService();
