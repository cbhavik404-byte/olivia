import { GoogleGenAI } from '@google/genai';
import {
  addOrUpdateKnowledge,
  logKnowledgeUpdate,
  listKnowledgeForPersonality,
  recordApiTelemetry,
} from './serverDb.ts';
import { GEMINI_MODELS, estimateUsageCostUsd } from './src/config/modelRegistry.ts';

export interface PersonalityDomainConfig {
  personalityId: string;
  label: string;
  isDeceased: boolean;
  searchQueries: string[];
  perspectiveQueries: string[];
}

const PERSONA_KNOWLEDGE_DOMAINS: PersonalityDomainConfig[] = [
  {
    personalityId: 'meme_culture',
    label: 'Desi & Global Meme / Internet Culture',
    isDeceased: false,
    searchQueries: ['trending Indian Hinglish memes viral internet culture latest'],
    perspectiveQueries: [],
  },
  {
    personalityId: 'default',
    label: 'NEXA Core AI & Productivity',
    isDeceased: false,
    searchQueries: ['latest AI agents developer tools Gemini updates'],
    perspectiveQueries: [],
  },
  {
    personalityId: 'oliviya',
    label: 'Olivia (Pop Culture, Music, Cinema & Lifestyle)',
    isDeceased: false,
    searchQueries: ['trending Bollywood indie music anime films lifestyle India'],
    perspectiveQueries: [],
  },
  {
    personalityId: 'elon',
    label: 'Elon Musk (SpaceX, Tesla, xAI, Neuralink)',
    isDeceased: false,
    searchQueries: ['SpaceX Starship Tesla xAI latest verified developments news'],
    perspectiveQueries: ['Elon Musk recent documented public statements interviews AI SpaceX'],
  },
  {
    personalityId: 'altman',
    label: 'Sam Altman (OpenAI & AI Infrastructure)',
    isDeceased: false,
    searchQueries: ['OpenAI Sam Altman official announcements frontier AI infrastructure'],
    perspectiveQueries: ['Sam Altman recent documented public interviews essays on AGI compute'],
  },
  {
    personalityId: 'hormozi',
    label: 'Alex Hormozi (Acquisition.com, Offers & Distribution)',
    isDeceased: false,
    searchQueries: ['Alex Hormozi Acquisition.com latest verified business announcements'],
    perspectiveQueries: ['Alex Hormozi documented public advice pricing offers scaling'],
  },
  {
    personalityId: 'mrbeast',
    label: 'MrBeast / Jimmy Donaldson (YouTube & Creator Economy)',
    isDeceased: false,
    searchQueries: ['MrBeast Jimmy Donaldson latest verified projects Beast Games Feastables'],
    perspectiveQueries: ['MrBeast documented public interviews YouTube retention thumbnails creator economy'],
  },
  {
    personalityId: 'naval',
    label: 'Naval Ravikant (AngelList, Wealth & Philosophy)',
    isDeceased: false,
    searchQueries: ['Naval Ravikant latest verified writing podcasts investments'],
    perspectiveQueries: ['Naval Ravikant documented public quotes tweets AI leverage happiness'],
  },
  {
    personalityId: 'buffett',
    label: 'Warren Buffett (Berkshire Hathaway & Value Investing)',
    isDeceased: false,
    searchQueries: ['Warren Buffett Berkshire Hathaway latest shareholder letters news'],
    perspectiveQueries: ['Warren Buffett documented public statements capital allocation index funds'],
  },
  {
    personalityId: 'goggins',
    label: 'David Goggins (Ultra-Endurance & Mental Discipline)',
    isDeceased: false,
    searchQueries: ['David Goggins latest verified ultra marathon appearances books'],
    perspectiveQueries: ['David Goggins documented public statements mental toughness accountability'],
  },
  // DECEASED HISTORICAL FIGURES — STRICT HISTORICAL / POSTHUMOUS RULE ONLY
  {
    personalityId: 'jobs',
    label: 'Steve Jobs (Historical Apple & Design Archive)',
    isDeceased: true,
    searchQueries: ['Steve Jobs Archive newly released historical speeches letters Apple design scholarship'],
    perspectiveQueries: ['Steve Jobs historical documented quotes product design simplicity typography'],
  },
  {
    personalityId: 'munger',
    label: 'Charlie Munger (Historical Mental Models & Berkshire Archive)',
    isDeceased: true,
    searchQueries: ['Charlie Munger historical biography Poor Charlies Almanack published archives'],
    perspectiveQueries: ['Charlie Munger documented historical quotes inversion multidisciplinary thinking'],
  },
  {
    personalityId: 'kahneman',
    label: 'Daniel Kahneman (Behavioral Economics & Prospect Theory Archive)',
    isDeceased: true,
    searchQueries: ['Daniel Kahneman published books Thinking Fast and Slow Noise behavioral science scholarship'],
    perspectiveQueries: ['Daniel Kahneman documented academic statements cognitive bias decision hygiene'],
  },
  {
    personalityId: 'feynman',
    label: 'Richard Feynman (Quantum Electrodynamics & Physics Education Archive)',
    isDeceased: true,
    searchQueries: ['Richard Feynman Caltech lectures published letters newly digitized physics archives'],
    perspectiveQueries: ['Richard Feynman documented quotes first principles cargo cult science'],
  },
  {
    personalityId: 'tesla',
    label: 'Nikola Tesla (Historical Electrical Engineering & Wardenclyffe Archive)',
    isDeceased: true,
    searchQueries: ['Nikola Tesla historical patents alternating current newly digitized museum archives'],
    perspectiveQueries: ['Nikola Tesla historical documented writings wireless energy invention'],
  },
  {
    personalityId: 'davinci',
    label: 'Leonardo da Vinci (Renaissance Notebooks & Historical Scholarship)',
    isDeceased: true,
    searchQueries: ['Leonardo da Vinci Codex Atlanticus newly discovered historical scholarship'],
    perspectiveQueries: ['Leonardo da Vinci documented notebook entries anatomy observation engineering'],
  },
  {
    personalityId: 'lincoln',
    label: 'Abraham Lincoln (Historical Speeches & Library of Congress Archives)',
    isDeceased: true,
    searchQueries: ['Abraham Lincoln Papers Library of Congress newly digitized historical letters'],
    perspectiveQueries: ['Abraham Lincoln historical documented speeches Gettysburg Emancipation governance'],
  },
  {
    personalityId: 'aurelius',
    label: 'Marcus Aurelius (Stoic Meditations & Classical Scholarship)',
    isDeceased: true,
    searchQueries: ['Marcus Aurelius Meditations classical stoicism historical scholarship translations'],
    perspectiveQueries: ['Marcus Aurelius documented passages Meditations duty resilience equanimity'],
  },
  {
    personalityId: 'turing',
    label: 'Alan Turing (Foundations of Computing & Bletchley Park Archives)',
    isDeceased: true,
    searchQueries: ['Alan Turing Bletchley Park archival papers morphogenesis historical scholarship'],
    perspectiveQueries: ['Alan Turing documented 1950 Computing Machinery Intelligence paper'],
  },
];

let schedulerTimer: NodeJS.Timeout | null = null;
let isRunningCycle = false;
let lastQuotaPauseUntil = 0;

function getClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      apiVersion: 'v1beta',
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });
}

export async function refreshPersonalityKnowledge(personalityId: string): Promise<{
  status: 'success' | 'skipped' | 'error';
  itemsAdded: number;
  itemsUpdated: number;
  message: string;
}> {
  if (Date.now() < lastQuotaPauseUntil) {
    const msg = 'Skipped refresh during quota cooldown window.';
    logKnowledgeUpdate({ personalityId, status: 'skipped', itemsAdded: 0, itemsUpdated: 0, message: msg });
    return { status: 'skipped', itemsAdded: 0, itemsUpdated: 0, message: msg };
  }

  const domain = PERSONA_KNOWLEDGE_DOMAINS.find((d) => d.personalityId === personalityId);
  if (!domain) {
    return { status: 'skipped', itemsAdded: 0, itemsUpdated: 0, message: `No automated domain mapped for ${personalityId}` };
  }

  const ai = getClient();
  if (!ai) {
    return { status: 'skipped', itemsAdded: 0, itemsUpdated: 0, message: 'GEMINI_API_KEY not configured on server.' };
  }

  let itemsAdded = 0;
  let itemsUpdated = 0;

  const startedAt = Date.now();
  const refreshModel = GEMINI_MODELS.TEXT_FALLBACK;

  try {
    const deceasedGuardrail = domain.isDeceased
      ? `CRITICAL DECEASED-FIGURE GUARDRAIL: ${domain.label} is a historical/deceased figure.
- You MUST ONLY include verified historical works, archival discoveries, biographies, or posthumous publications.
- NEVER fabricate or attribute new contemporary opinions, 2025/2026 personal statements, or fictional reactions to current events.
- Mark isHistorical = true and include the original historical year/publication date in sourceDate.`
      : `CRITICAL VERIFICATION RULE: Only include verified public developments, official announcements, or documented public statements with real dates and sources.`;

    const query = domain.searchQueries[0];
    const perspectiveQuery = domain.perspectiveQueries[0] || '';
    const prompt = `Search Google for verified material for "${domain.label}".
Primary query: "${query}"
${perspectiveQuery ? `Perspective/quotes query: "${perspectiveQuery}"` : ''}

${deceasedGuardrail}

Return a JSON array of up to 4 factual items separated across:
- "layer": "knowledge_update" (verified developments, archival findings, published work) OR "perspective" (documented public opinion/quote with original date & source)
- "topic": short title (max 10 words)
- "summary": 1-2 factual sentences grounded ONLY in search results
- "sourceUrl": primary URL from search results if present, else ""
- "sourceTitle": publication or archive name
- "sourceDate": exact publication/historical date (YYYY-MM-DD or YYYY)
- "isHistorical": ${domain.isDeceased ? 'true' : 'false'}
- "verificationStatus": "CONFIRMED" | "UNVERIFIED" | "DISPUTED"

Return ONLY a valid JSON array.`;

    const response = await ai.models.generateContent({
      model: refreshModel,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    const usage = response.usageMetadata;
    const promptTokens = usage?.promptTokenCount ?? null;
    const completionTokens = usage?.candidatesTokenCount ?? null;
    const totalTokens = usage?.totalTokenCount ?? null;
    const costInfo = estimateUsageCostUsd(refreshModel, promptTokens, completionTokens);
    recordApiTelemetry({
      endpoint: 'scheduler:refreshPersonalityKnowledge',
      operation: `knowledgeSync:${personalityId}`,
      model: refreshModel,
      attemptCount: 1,
      fallbackUsed: false,
      latencyMs: Date.now() - startedAt,
      status: 'success',
      httpStatus: 200,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: costInfo.estimatedCostUsd,
      costStatus: costInfo.costStatus,
    });

    const raw = (response.text || '').trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) {
      const msg = 'No structured items extracted from search response.';
      logKnowledgeUpdate({ personalityId, status: 'skipped', itemsAdded: 0, itemsUpdated: 0, message: msg });
      return { status: 'skipped', itemsAdded: 0, itemsUpdated: 0, message: msg };
    }

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const fallbackUrl = groundingChunks?.[0]?.web?.uri || '';
    const fallbackTitle = groundingChunks?.[0]?.web?.title || '';

    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!item?.topic || !item?.summary) continue;
        if (item.verificationStatus === 'FALSE') continue;

        // Enforce strict deceased-figure check: reject any suspicious current-year fabricated quote claims
        if (domain.isDeceased) {
          const textLower = `${item.topic} ${item.summary}`.toLowerCase();
          if (
            item.layer === 'perspective' &&
            (textLower.includes('today he said') ||
              textLower.includes('recently tweeted') ||
              textLower.includes('in a 2025 interview') ||
              textLower.includes('in a 2026 interview'))
          ) {
            continue;
          }
        }

        const safeLayer = item.layer === 'perspective' ? 'perspective' : 'knowledge_update';
        const outcome = addOrUpdateKnowledge({
          personalityId,
          topic: String(item.topic).slice(0, 120),
          summary: String(item.summary).slice(0, 500),
          sourceUrl: item.sourceUrl || fallbackUrl || '',
          sourceTitle: item.sourceTitle || fallbackTitle || 'Web Grounding',
          publishedAt: item.sourceDate || item.publishedAt || new Date().toISOString().slice(0, 10),
          sourceDate: item.sourceDate || item.publishedAt || new Date().toISOString().slice(0, 10),
          verificationStatus: item.verificationStatus || 'CONFIRMED',
          layer: safeLayer,
          isHistorical: domain.isDeceased || Boolean(item.isHistorical),
          confidence: item.verificationStatus === 'CONFIRMED' ? 0.92 : 0.65,
        });

        if (outcome === 'added') itemsAdded++;
        else if (outcome === 'updated') itemsUpdated++;
      }
    }

    const msg = `Synced ${domain.label} (${domain.isDeceased ? 'Historical-Only' : 'Live 3-Layer'}): ${itemsAdded} added, ${itemsUpdated} updated.`;
    logKnowledgeUpdate({ personalityId, status: 'success', itemsAdded, itemsUpdated, message: msg });
    return { status: 'success', itemsAdded, itemsUpdated, message: msg };
  } catch (err: any) {
    const errMsg = String(err?.message || err);
    const isQuota = errMsg.toLowerCase().includes('429') || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('resource_exhausted');
    recordApiTelemetry({
      endpoint: 'scheduler:refreshPersonalityKnowledge',
      operation: `knowledgeSync:${personalityId}`,
      model: refreshModel,
      attemptCount: 1,
      fallbackUsed: false,
      latencyMs: Date.now() - startedAt,
      status: isQuota ? 'quota_limited' : 'error',
      httpStatus: isQuota ? 429 : 500,
      errorMessage: errMsg,
    });
    if (isQuota) {
      lastQuotaPauseUntil = Date.now() + 15 * 60 * 1000;
      logKnowledgeUpdate({ personalityId, status: 'skipped', itemsAdded: 0, itemsUpdated: 0, message: 'Quota cooldown triggered (15m pause).' });
      return { status: 'skipped', itemsAdded: 0, itemsUpdated: 0, message: 'Quota limit reached; paused background updates for 15 minutes.' };
    }
    logKnowledgeUpdate({ personalityId, status: 'error', itemsAdded: 0, itemsUpdated: 0, message: errMsg.slice(0, 180) });
    return { status: 'error', itemsAdded: 0, itemsUpdated: 0, message: errMsg };
  }
}

let rotationCursor = 0;

export async function runScheduledKnowledgeTick() {
  if (isRunningCycle) return;
  isRunningCycle = true;
  try {
    const target = PERSONA_KNOWLEDGE_DOMAINS[rotationCursor % PERSONA_KNOWLEDGE_DOMAINS.length];
    rotationCursor++;
    const existing = listKnowledgeForPersonality(target.personalityId, 1);
    const lastRetrievedMs = existing?.[0]?.retrievedAt ? new Date((existing[0] as any).retrievedAt).getTime() : 0;
    const sixHoursMs = 6 * 60 * 60 * 1000;
    if (Date.now() - lastRetrievedMs >= sixHoursMs) {
      await refreshPersonalityKnowledge(target.personalityId);
    }
  } finally {
    isRunningCycle = false;
  }
}

export function startKnowledgeScheduler() {
  if (schedulerTimer) return;
  setTimeout(() => {
    runScheduledKnowledgeTick().catch(() => {});
  }, 15000);

  schedulerTimer = setInterval(() => {
    runScheduledKnowledgeTick().catch(() => {});
  }, 30 * 60 * 1000);
}

export function stopKnowledgeScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

export { PERSONA_KNOWLEDGE_DOMAINS };
