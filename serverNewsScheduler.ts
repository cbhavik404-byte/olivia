import { GoogleGenAI } from '@google/genai';
import {
  upsertNewsArticle,
  listNewsArticles,
  recordApiTelemetry,
} from './serverDb.ts';
import { GEMINI_MODELS, estimateUsageCostUsd } from './src/config/modelRegistry.ts';

export const NEWS_CATEGORIES_LIST = [
  'National',
  'International',
  'Politics & Government',
  'Technology & AI',
  'Business & Startups',
  'Economy & Finance',
  'Science & Space',
  'Entertainment',
  'Gaming',
  'Sports',
  'Education',
  'Cybersecurity',
  'Major Breaking News',
] as const;

interface RssFeedSource {
  category: (typeof NEWS_CATEGORIES_LIST)[number];
  publisher: string;
  url: string;
}

const RSS_SOURCES: RssFeedSource[] = [
  { category: 'Major Breaking News', publisher: 'BBC Top Stories', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
  { category: 'National', publisher: 'Google News India', url: 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en' },
  { category: 'International', publisher: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { category: 'Politics & Government', publisher: 'BBC Politics', url: 'https://feeds.bbci.co.uk/news/politics/rss.xml' },
  { category: 'Technology & AI', publisher: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { category: 'Technology & AI', publisher: 'Google News AI', url: 'https://news.google.com/rss/search?q=artificial+intelligence+OR+semiconductor&hl=en-US&gl=US&ceid=US:en' },
  { category: 'Business & Startups', publisher: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { category: 'Economy & Finance', publisher: 'Google News Finance', url: 'https://news.google.com/rss/search?q=economy+central+bank+inflation+markets&hl=en-US&gl=US&ceid=US:en' },
  { category: 'Science & Space', publisher: 'BBC Science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { category: 'Entertainment', publisher: 'BBC Entertainment', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml' },
  { category: 'Gaming', publisher: 'Google News Gaming', url: 'https://news.google.com/rss/search?q=video+games+esports+console+release&hl=en-US&gl=US&ceid=US:en' },
  { category: 'Sports', publisher: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
  { category: 'Education', publisher: 'Google News Education', url: 'https://news.google.com/rss/search?q=education+universities+exam+policy&hl=en-IN&gl=IN&ceid=IN:en' },
  { category: 'Cybersecurity', publisher: 'Google News Cyber', url: 'https://news.google.com/rss/search?q=cybersecurity+zero-day+ransomware+breach&hl=en-US&gl=US&ceid=US:en' },
];

function decodeXmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssXml(xml: string, fallbackCategory: string, publisher: string) {
  const items: {
    headline: string;
    category: string;
    summary: string;
    publishedAt: string;
    url: string;
    publisher: string;
  }[] = [];

  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null && items.length < 6) {
    const block = match[1];
    const titleMatch = block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
    const descMatch = block.match(/<description\b[^>]*>([\s\S]*?)<\/description>/i);
    const pubDateMatch = block.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i);

    const headline = titleMatch ? decodeXmlEntities(titleMatch[1]) : '';
    const url = linkMatch ? decodeXmlEntities(linkMatch[1]) : '';
    const desc = descMatch ? decodeXmlEntities(descMatch[1]) : '';
    const rawDate = pubDateMatch ? decodeXmlEntities(pubDateMatch[1]) : '';
    let publishedAt = new Date().toISOString();
    if (rawDate) {
      const parsedDate = new Date(rawDate);
      if (!isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate.toISOString();
      }
    }

    if (headline && url) {
      items.push({
        headline,
        category: fallbackCategory,
        summary: desc && desc.length > 20 ? desc.slice(0, 320) : headline,
        publishedAt,
        url,
        publisher,
      });
    }
  }
  return items;
}

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

let newsSchedulerTimer: NodeJS.Timeout | null = null;
let isSyncingNews = false;

export async function syncNewsFromRssFeeds(targetCategory?: string): Promise<{
  added: number;
  updated: number;
  totalSynced: number;
  errors: string[];
}> {
  const sources = targetCategory && targetCategory !== 'All'
    ? RSS_SOURCES.filter((s) => s.category === targetCategory)
    : RSS_SOURCES;

  let added = 0;
  let updated = 0;
  let totalSynced = 0;
  const errors: string[] = [];

  // Fetch RSS feeds in small concurrent batches
  const rawCollected: ReturnType<typeof parseRssXml> = [];
  for (const src of sources) {
    try {
      const resp = await fetch(src.url, {
        headers: { 'User-Agent': 'NEXA-News-Intelligence/1.0' },
        signal: AbortSignal.timeout(7000),
      });
      if (!resp.ok) {
        errors.push(`${src.publisher}: HTTP ${resp.status}`);
        continue;
      }
      const xml = await resp.text();
      const parsed = parseRssXml(xml, src.category, src.publisher);
      rawCollected.push(...parsed);
    } catch (err: any) {
      errors.push(`${src.publisher}: ${err?.message || 'fetch failed'}`);
    }
  }

  // Group near-duplicate headlines by normalized token overlap to count independent cross-checks
  const tokenSignature = (headline: string) =>
    headline
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5)
      .sort()
      .join('|');

  const buckets = new Map<string, typeof rawCollected>();
  for (const item of rawCollected) {
    const sig = tokenSignature(item.headline) || item.headline.toLowerCase().slice(0, 40);
    const list = buckets.get(sig) || [];
    list.push(item);
    buckets.set(sig, list);
  }

  for (const [, group] of buckets) {
    const primary = group[0];
    const distinctPublishers = new Set(group.map((g) => g.publisher));
    const sourceLinks = group.map((g) => ({
      title: g.headline,
      url: g.url,
      publisher: g.publisher,
    }));

    const confidenceStatus: 'CONFIRMED' | 'DEVELOPING' | 'UNVERIFIED' =
      distinctPublishers.size >= 2 || primary.publisher.startsWith('BBC')
        ? 'CONFIRMED'
        : 'DEVELOPING';

    const outcome = upsertNewsArticle({
      headline: primary.headline,
      category: primary.category,
      summary: primary.summary,
      whyItMatters: `Active story tracked under ${primary.category} via ${Array.from(distinctPublishers).join(', ')}.`,
      publishedAt: primary.publishedAt,
      eventTime: primary.publishedAt,
      sourceLinks,
      confidenceStatus,
      crossCheckCount: Math.max(1, distinctPublishers.size),
    });

    totalSynced++;
    if (outcome === 'added') added++;
    else if (outcome === 'updated') updated++;
  }

  return { added, updated, totalSynced, errors };
}

export async function performLiveBreakingNewsSearch(query: string, category?: string) {
  const ai = getClient();
  const startedAt = Date.now();
  const model = GEMINI_MODELS.TEXT_FALLBACK;

  // First ensure we have RSS baseline
  if (listNewsArticles({ limit: 5 }).length === 0) {
    await syncNewsFromRssFeeds(category).catch(() => {});
  }

  if (!ai) {
    return {
      articles: listNewsArticles({ category, query, limit: 15 }),
      briefing: 'Returned cached verified RSS headlines (server search key unavailable).',
    };
  }

  try {
    const prompt = `Search Google News right now for verified latest breaking news matching: "${query || 'top India and world headlines today'}"${category && category !== 'All' ? ` (Category focus: ${category})` : ''}.
Cross-check important claims across independent publications. Distinguish publication time vs actual event time.
Return a JSON object with:
{
  "briefing": "Concise 3-4 sentence spoken executive briefing covering top verified stories.",
  "stories": [
    {
      "headline": "Clear factual headline",
      "category": one of ${JSON.stringify(NEWS_CATEGORIES_LIST)},
      "summary": "2 factual sentences.",
      "whyItMatters": "1 sentence on impact/significance.",
      "publishedAt": "ISO timestamp or YYYY-MM-DD",
      "eventTime": "When the actual event happened (ISO or descriptive date)",
      "confidenceStatus": "CONFIRMED" | "DEVELOPING" | "UNVERIFIED",
      "crossCheckCount": integer >= 1,
      "sourceLinks": [{ "title": "...", "url": "https://...", "publisher": "..." }]
    }
  ]
}
Return ONLY valid JSON.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    const usage = response.usageMetadata;
    const costInfo = estimateUsageCostUsd(model, usage?.promptTokenCount ?? null, usage?.candidatesTokenCount ?? null);
    recordApiTelemetry({
      endpoint: '/api/news/live-search',
      operation: 'liveNewsIntelligence',
      model,
      attemptCount: 1,
      fallbackUsed: false,
      latencyMs: Date.now() - startedAt,
      status: 'success',
      httpStatus: 200,
      promptTokens: usage?.promptTokenCount ?? null,
      completionTokens: usage?.candidatesTokenCount ?? null,
      totalTokens: usage?.totalTokenCount ?? null,
      estimatedCostUsd: costInfo.estimatedCostUsd,
      costStatus: costInfo.costStatus,
    });

    const raw = (response.text || '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const fallbackSources = groundingChunks
      .map((c: any) => ({
        title: c?.web?.title || 'Verified Source',
        url: c?.web?.uri || '',
        publisher: c?.web?.title || 'Web Grounding',
      }))
      .filter((s: any) => s.url);

    let briefing = '';
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      briefing = String(parsed.briefing || '');
      if (Array.isArray(parsed.stories)) {
        for (const s of parsed.stories) {
          if (!s?.headline || !s?.summary) continue;
          const validCategory = NEWS_CATEGORIES_LIST.includes(s.category) ? s.category : (category && category !== 'All' ? category : 'Major Breaking News');
          const sources = Array.isArray(s.sourceLinks) && s.sourceLinks.length > 0 ? s.sourceLinks : fallbackSources.slice(0, 2);
          upsertNewsArticle({
            headline: s.headline,
            category: validCategory,
            summary: s.summary,
            whyItMatters: s.whyItMatters || '',
            publishedAt: s.publishedAt || new Date().toISOString(),
            eventTime: s.eventTime || s.publishedAt || new Date().toISOString(),
            sourceLinks: sources,
            confidenceStatus: s.confidenceStatus || (sources.length >= 2 ? 'CONFIRMED' : 'DEVELOPING'),
            crossCheckCount: Number(s.crossCheckCount || Math.max(1, sources.length)),
          });
        }
      }
    }

    return {
      articles: listNewsArticles({ category, limit: 25 }),
      briefing: briefing || 'Latest verified headlines updated.',
    };
  } catch (err: any) {
    recordApiTelemetry({
      endpoint: '/api/news/live-search',
      operation: 'liveNewsIntelligence',
      model,
      attemptCount: 1,
      fallbackUsed: false,
      latencyMs: Date.now() - startedAt,
      status: String(err?.message || '').includes('429') ? 'quota_limited' : 'error',
      httpStatus: 500,
      errorMessage: String(err?.message || err),
    });
    return {
      articles: listNewsArticles({ category, query, limit: 25 }),
      briefing: 'Showing latest stored verified headlines from RSS feeds.',
    };
  }
}

export function startNewsScheduler() {
  if (newsSchedulerTimer) return;
  // Initial non-blocking RSS collection 8 seconds after boot
  setTimeout(() => {
    if (!isSyncingNews) {
      isSyncingNews = true;
      syncNewsFromRssFeeds().finally(() => {
        isSyncingNews = false;
      });
    }
  }, 8000);

  // Periodic background refresh every 20 minutes
  newsSchedulerTimer = setInterval(() => {
    if (!isSyncingNews) {
      isSyncingNews = true;
      syncNewsFromRssFeeds().finally(() => {
        isSyncingNews = false;
      });
    }
  }, 20 * 60 * 1000);
}

export function stopNewsScheduler() {
  if (newsSchedulerTimer) {
    clearInterval(newsSchedulerTimer);
    newsSchedulerTimer = null;
  }
}
