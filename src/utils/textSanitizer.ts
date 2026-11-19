// src/utils/textSanitizer.ts
// Utility to sanitize model speech, separating chat display sanitization (which can preserve
// expressive Olivia *action* cues) from strict TTS speech sanitization (which NEVER lets action cues be spoken literally).

export interface SanitizeSpeechOptions {
  preserveActionDescriptions?: boolean;
  preserveEllipses?: boolean;
}

/**
 * Strips stage directions, behavioral cues, internal control tags, and theatrical annotations.
 * When `preserveActionDescriptions` is true (Olivia chat UI only), tasteful paired `*action*`
 * descriptions like `*giggles mischievously*` are preserved cleanly for display.
 * When `preserveEllipses` is true (COCO chat & TTS), three-dot ellipses (`...`) are preserved
 * cleanly to sustain soft breathing pauses.
 */
export function stripStageDirectionsAndCues(
  rawText: string,
  options?: SanitizeSpeechOptions
): string {
  if (!rawText) return "";
  let text = rawText;

  // 1. Always remove internal persona, voice, action, and TTS vocal burst tags
  text = text.replace(/\[persona:\s*[^\]]+\]\n?/gi, "");
  text = text.replace(/\[voice:\s*[^\]]+\]\n?/gi, "");
  text = text.replace(/\[(KISS_ACTION|FLYING_KISS)\]/gi, "");
  text = text.replace(/<ACTION>[\s\S]*?<\/ACTION>/gi, "");
  text = text.replace(/\[NOTEPAD_START\][\s\S]*?\[NOTEPAD_END\]/gi, "");
  text = text.replace(/<(?:laugh|gasp|breath)>/gi, " ");
  text = text.replace(/\|(?:ehehe|hehe|yeah|mhm)\|/gi, " ");

  // 2. Remove bracketed mood, tone, or stage cues
  text = text.replace(
    /\[(SASSY|DRAMATIC|HAPPY|SHY|FLATTERED|ANALYTICAL|VISIONARY|VIOLATION|CONFIDENT|SARCASTIC|TEASING)\]/gi,
    ""
  );
  text = text.replace(
    /\[(?:dramatically\s+|softly\s+|gently\s+|loudly\s+|playfully\s+|deep\s+)?(?:sighs|smirks|rolls\s+eyes|giggles|chuckles|laughs|gasps|whispers|smiles|winks|clears\s+throat|pauses|pause|crying|sobs|blushes|pouts|jumps|inhale|inhales|exhale|exhales|breathes|breath)[^\]]*\]/gi,
    ""
  );

  // 3. Asterisk stage directions (*...*)
  if (options?.preserveActionDescriptions) {
    // Protect paired single-asterisk action cues (*giggles mischievously*), strip bold double-asterisks if present
    const protectedActions: string[] = [];
    text = text.replace(/(?<!\*)\*([^*\n]{2,110}?)\*(?!\*)/g, (_m, inner) => {
      const cleanedInner = String(inner).trim();
      if (!cleanedInner) return " ";
      const token = `__OLIVIA_ACTION_${protectedActions.length}__`;
      protectedActions.push(`*${cleanedInner}*`);
      return token;
    });
    // Strip any stray/unmatched asterisks
    text = text.replace(/\*/g, "");
    // Restore protected expressive action descriptions cleanly
    protectedActions.forEach((act, idx) => {
      text = text.replace(`__OLIVIA_ACTION_${idx}__`, act);
    });
    text = text.replace(/(\*[^*\n]+\*)(?=[A-Za-z0-9\u0900-\u097F])/g, "$1 ");
  } else {
    // Strip all asterisk stage directions, actions, and theatrical annotations
    text = text.replace(/\*[^*]+\*/g, " ");
    text = text.replace(/\*/g, "");
  }

  // 4. Remove parenthetical behavioral cues and stage directions
  text = text.replace(
    /\((?:dramatically\s+|softly\s+|gently\s+|loudly\s+|playfully\s+|mischievously\s+|soft\s+|deep\s+)?(?:sighs|smirks|rolls\s+eyes|giggles|chuckles|laughs|gasps|whispers|smiles|winks|clears\s+throat|pauses|pause|crying|sobs|blushes|pouts|jumps|inhale|inhales|exhale|exhales|breathes|breath)[^)]*\)/gi,
    " "
  );

  // Protect natural ellipses (...) when requested (e.g. COCO's two-beat paused rhythm)
  const ELLIPSIS_TOKEN = "__PRESERVED_ELLIPSIS__";
  if (options?.preserveEllipses) {
    text = text.replace(/…|\.{2,}/g, ELLIPSIS_TOKEN);
  }

  // 5. Clean up spacing and punctuation glitches caused by stripped cues
  text = text.replace(/\s+([,.;?!])/g, "$1");
  text = text.replace(/[,;]\s*([.?!])/g, "$1");
  text = text.replace(/([.?!])\s*([.?!])+/g, "$1");
  if (options?.preserveEllipses) {
    text = text.replace(new RegExp(ELLIPSIS_TOKEN, "g"), "...");
  }
  text = text.replace(/[ \t]{2,}/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Strips annoying verbal crutches, repetitive "jaise jaise" fillers,
 * dangling "jaise..." example prefixes, and stage directions/behavioral cues.
 */
export function sanitizeSpeechAndFiller(
  rawText: string,
  options?: SanitizeSpeechOptions
): string {
  if (!rawText) return "";
  let text = stripStageDirectionsAndCues(rawText, options);

  // 1. Remove dangling "jaise jaise" / "jaise ki" / "jaise" / "जैसे जैसे" at the end of the text
  text = text.replace(
    /(?:[,،\s]+)?(?:jaise\s*[-–—]?\s*jaise|jaise\s+ki|jaise|जैसे\s*[-–—]?\s*जैसे|जैसे\s+कि|जैसे)\s*(?:[.?!…]+|\s*)*$/i,
    ""
  );

  // 2. Remove dangling "jaise" / "jaise jaise" before end-of-sentence punctuation
  text = text.replace(
    /(?:[,،\s]+)?(?:jaise\s*[-–—]?\s*jaise|jaise\s+ki|jaise|जैसे\s*[-–—]?\s*जैसे|जैसे\s+कि|जैसे)\s*(?:[.?!…]+|\s*)+(?=[A-Z\s\n\u0900-\u097F]|$)/gi,
    () => ". "
  );

  // 3. Remove repetitive "jaise jaise" / "jaise-jaise" / "जैसे जैसे" mid-sentence crutches
  text = text.replace(/\bjaise\s*[-–—]?\s*jaise\b/gi, "jaise");
  text = text.replace(/जैसे\s*[-–—]?\s*जैसे/g, "जैसे");

  // 4. Remove dangling "jaise..." followed directly by ellipsis mid-sentence without completing an example
  text = text.replace(
    /(?:[,،\s]+)?\b(?:jaise\s+ki|jaise|जैसे\s+कि|जैसे)\s*(?:\.{2,}|…)\s*/gi,
    " "
  );

  const ELLIPSIS_TOKEN = "__PRESERVED_ELLIPSIS__";
  if (options?.preserveEllipses) {
    text = text.replace(/…|\.{2,}/g, ELLIPSIS_TOKEN);
  }

  // 5. Final cleanup of spacing and punctuation
  text = text.replace(/\s+([,.;?!])/g, "$1");
  text = text.replace(/[,;]\s*([.?!])/g, "$1");
  text = text.replace(/([.?!])\s*([.?!])+/g, "$1");

  if (options?.preserveEllipses) {
    text = text.replace(new RegExp(ELLIPSIS_TOKEN, "g"), "...");
  }
  text = text.replace(/[ \t]{2,}/g, " ");

  return text.trim();
}

/**
 * Strict TTS speech sanitizer: guarantees NO action tags (*giggles*, *blushes*, (sighs), [SHY])
 * or markdown formatting are ever passed into audio synthesis or read literally.
 */
export function sanitizeForTTSSpeech(rawText: string, options?: SanitizeSpeechOptions): string {
  if (!rawText) return "";
  let text = sanitizeSpeechAndFiller(rawText, {
    preserveActionDescriptions: false,
    preserveEllipses: options?.preserveEllipses,
  });
  // Remove markdown formatting artifacts that TTS could read awkwardly
  text = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[_~]/g, (ch) => (ch === "~" ? "" : " "))
    .replace(/\s{2,}/g, " ")
    .trim();
  return text;
}
