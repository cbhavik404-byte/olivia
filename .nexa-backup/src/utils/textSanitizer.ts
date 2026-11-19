// src/utils/textSanitizer.ts
// Utility to sanitize model speech, eliminating all stage directions, behavioral cues,
// dramatic expressions, annoying verbal fillers, and dangling incomplete example crutches.

/**
 * Strips all stage directions, behavioral cues, physical actions, and theatrical annotations
 * from spoken responses.
 *
 * Removes:
 * - Asterisk stage directions & action cues (e.g., *sighs*, *sighs dramatically*, *rolls eyes*, *smirks*, *winks*, *giggles*, *chuckles*, *laughs*)
 * - Bracketed mood/tone tags (e.g., [SASSY], [DRAMATIC], [HAPPY], [SHY], [FLATTERED], [ANALYTICAL], [VISIONARY], [sighs], [smiles])
 * - Parenthetical behavioral cues (e.g., (sighs), (laughs), (smirks), (giggles), (dramatically gasps), (whispering))
 * - Residual metadata tags ([persona: ...], [voice: ...], etc.)
 */
export function stripStageDirectionsAndCues(rawText: string): string {
  if (!rawText) return "";
  let text = rawText;

  // 1. Remove bracketed persona or voice directives
  text = text.replace(/\[persona:\s*[^\]]+\]\n?/gi, "");
  text = text.replace(/\[voice:\s*[^\]]+\]\n?/gi, "");

  // 2. Remove bracketed mood, tone, or stage cues
  text = text.replace(/\[(SASSY|DRAMATIC|HAPPY|SHY|FLATTERED|ANALYTICAL|VISIONARY|VIOLATION|CONFIDENT|SARCASTIC|TEASING)\]/gi, "");
  text = text.replace(/\[(?:dramatically\s+|softly\s+|gently\s+|loudly\s+|playfully\s+)?(?:sighs|smirks|rolls\s+eyes|giggles|chuckles|laughs|gasps|whispers|smiles|winks|clears\s+throat|pauses|crying|sobs)[^\]]*\]/gi, "");

  // 3. Remove all asterisk stage directions, actions, and theatrical annotations
  // e.g. *sighs dramatically then smirks with bright swagger*, *rolls eyes playfully*, *giggles*, *winks*, *laughs*
  text = text.replace(/\*[^*]+\*/g, " ");

  // 4. Remove parenthetical behavioral cues and stage directions
  // e.g. (sighs), (dramatically sighs), (laughs), (giggles), (smirks), (whispers), (winks), (gasps)
  text = text.replace(/\((?:dramatically\s+|softly\s+|gently\s+|loudly\s+|playfully\s+)?(?:sighs|smirks|rolls\s+eyes|giggles|chuckles|laughs|gasps|whispers|smiles|winks|clears\s+throat|pauses|crying|sobs)[^)]*\)/gi, " ");

  // 5. Clean up any orphaned asterisks
  text = text.replace(/\*/g, "");

  // 6. Clean up spacing and punctuation glitches caused by stripped cues
  text = text.replace(/\s+([,.;?!])/g, "$1");
  text = text.replace(/[,;]\s*([.?!])/g, "$1");
  text = text.replace(/([.?!])\s*([.?!])+/g, "$1");
  text = text.replace(/\s{2,}/g, " ");

  return text.trim();
}

/**
 * Strips annoying verbal crutches, repetitive "jaise jaise" fillers,
 * dangling "jaise..." example prefixes, and all stage directions/behavioral cues.
 */
export function sanitizeSpeechAndFiller(rawText: string): string {
  if (!rawText) return "";
  let text = stripStageDirectionsAndCues(rawText);

  // 1. Remove dangling "jaise jaise" / "jaise ki" / "jaise" / "जैसे जैसे" at the end of the text
  // e.g. "..., jaise jaise...", "... jaise ki...", "... jaise..."
  text = text.replace(/(?:[,،\s]+)?(?:jaise\s*[-–—]?\s*jaise|jaise\s+ki|jaise|जैसे\s*[-–—]?\s*जैसे|जैसे\s+कि|जैसे)\s*(?:[.?!…]+|\s*)*$/i, "");

  // 2. Remove dangling "jaise" / "jaise jaise" before end-of-sentence punctuation throughout the text
  // e.g. "Main sab kar sakti hoon, jaise ki... Bhavik bolo kya karna hai." -> "Main sab kar sakti hoon. Bhavik bolo kya karna hai."
  text = text.replace(/(?:[,،\s]+)?(?:jaise\s*[-–—]?\s*jaise|jaise\s+ki|jaise|जैसे\s*[-–—]?\s*जैसे|जैसे\s+कि|जैसे)\s*(?:[.?!…]+|\s*)+(?=[A-Z\s\n\u0900-\u097F]|$)/gi, () => {
    return ". ";
  });

  // 3. Remove repetitive "jaise jaise" / "jaise-jaise" / "जैसे जैसे" mid-sentence crutches
  text = text.replace(/\bjaise\s*[-–—]?\s*jaise\b/gi, "jaise");
  text = text.replace(/जैसे\s*[-–—]?\s*जैसे/g, "जैसे");

  // 4. Remove dangling "jaise..." followed directly by ellipsis mid-sentence without completing an example
  text = text.replace(/(?:[,،\s]+)?\b(?:jaise\s+ki|jaise|जैसे\s+कि|जैसे)\s*(?:\.{2,}|…)\s*/gi, " ");

  // 5. Final cleanup of spacing and punctuation
  text = text.replace(/\s+([,.;?!])/g, "$1");
  text = text.replace(/[,;]\s*([.?!])/g, "$1");
  text = text.replace(/([.?!])\s*([.?!])+/g, "$1");
  text = text.replace(/\s{2,}/g, " ");

  return text.trim();
}
