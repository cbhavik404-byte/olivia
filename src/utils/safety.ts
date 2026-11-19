// Extreme dangerous patterns (direct bomb making, self-harm, violent cyber attack weapons)
const EXTREME_DANGEROUS_PATTERNS = [
  /\bhow to make a (bomb|biological weapon|deadly explosive)\b/i,
  /\b(commit suicide|kill myself)\b/i,
  /\bhow to synthesize dangerous poison\b/i
];

export function isGuidanceViolation(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return EXTREME_DANGEROUS_PATTERNS.some(pattern => pattern.test(lower));
}

