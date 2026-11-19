// Centralized Gemini Model Registry & Cost Telemetry Pricing Configuration
// Pure TypeScript (no DOM dependencies, no TypeScript enums) so it runs identically in Node v22 and Vite browser builds.

export const GEMINI_MODELS = {
  TEXT_PRIMARY: 'gemini-4-hydrogen',
  TEXT_FALLBACK: 'gemini-3.1-flash-lite',
  TTS_EXPRESSIVE: 'gemini-3.8-flash-tts',
  TTS_STANDARD: 'gemini-3.8-flash-lite-tts',
  LIVE_AUDIO: 'gemini-3.8-live',
  IMAGE_GEN: 'gemini-3.1-flash-lite-image',
} as const;

export type GeminiModelId = (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS];

export const GEMINI_MODEL_CHAINS = {
  text: [GEMINI_MODELS.TEXT_PRIMARY, GEMINI_MODELS.TEXT_FALLBACK] as const,
  search: [GEMINI_MODELS.TEXT_PRIMARY, GEMINI_MODELS.TEXT_FALLBACK] as const,
  vision: [GEMINI_MODELS.TEXT_PRIMARY, GEMINI_MODELS.TEXT_FALLBACK] as const,
  memoryExtraction: [GEMINI_MODELS.TEXT_FALLBACK, GEMINI_MODELS.TEXT_PRIMARY] as const,
  knowledgeRefresh: [GEMINI_MODELS.TEXT_FALLBACK] as const,
  live: [GEMINI_MODELS.LIVE_AUDIO] as const,
  image: [GEMINI_MODELS.IMAGE_GEN] as const,
  ttsExpressive: [GEMINI_MODELS.TTS_EXPRESSIVE, GEMINI_MODELS.TTS_STANDARD] as const,
  ttsStandard: [GEMINI_MODELS.TTS_STANDARD, GEMINI_MODELS.TTS_EXPRESSIVE] as const,
};

export type GeminiChainKey = keyof typeof GEMINI_MODEL_CHAINS;

export interface ModelPricingRate {
  inputPer1MUsd: number;
  outputPer1MUsd: number;
  sourceNote: string;
}

/**
 * Published per-1M token pricing rates (USD).
 * Note: Preview/custom model IDs without verified published USD pricing remain omitted (null cost)
 * so telemetry never fabricates cost numbers.
 */
export const GEMINI_PRICING_PER_1M_USD: Record<string, ModelPricingRate> = {};

export function resolveModelChain(preferredModel?: string, chainKey: GeminiChainKey = 'text'): string[] {
  const baseChain = [...GEMINI_MODEL_CHAINS[chainKey]];
  const candidates = preferredModel && preferredModel.trim() ? [preferredModel.trim(), ...baseChain] : baseChain;
  return candidates.filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);
}

export function estimateUsageCostUsd(
  model: string,
  promptTokens?: number | null,
  completionTokens?: number | null
): { estimatedCostUsd: number | null; costStatus: 'estimated' | 'pricing_unavailable' | 'tokens_unavailable' } {
  if (promptTokens == null && completionTokens == null) {
    return { estimatedCostUsd: null, costStatus: 'tokens_unavailable' };
  }
  const rate = GEMINI_PRICING_PER_1M_USD[model];
  if (!rate) {
    return { estimatedCostUsd: null, costStatus: 'pricing_unavailable' };
  }
  const inCost = ((promptTokens || 0) / 1_000_000) * rate.inputPer1MUsd;
  const outCost = ((completionTokens || 0) / 1_000_000) * rate.outputPer1MUsd;
  return {
    estimatedCostUsd: Number((inCost + outCost).toFixed(8)),
    costStatus: 'estimated',
  };
}
