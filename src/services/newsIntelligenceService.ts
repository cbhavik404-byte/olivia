import { NEWS_CATEGORIES, NewsArticle, NewsCategory } from "../types";

export async function fetchStoredNews(category?: string, query?: string): Promise<{
  categories: readonly string[];
  articles: NewsArticle[];
}> {
  const params = new URLSearchParams();
  if (category && category !== "All") params.set("category", category);
  if (query && query.trim()) params.set("query", query.trim());
  const resp = await fetch(`/api/news?${params.toString()}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!resp.ok) {
    throw new Error(`Failed to load news (${resp.status})`);
  }
  return resp.json();
}

export async function syncNewsRss(category?: string): Promise<{
  added: number;
  updated: number;
  articles: NewsArticle[];
}> {
  const resp = await fetch("/api/news/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category }),
  });
  if (!resp.ok) {
    throw new Error(`RSS sync failed (${resp.status})`);
  }
  return resp.json();
}

export async function searchLiveBreakingNews(query: string, category?: string): Promise<{
  articles: NewsArticle[];
  briefing: string;
}> {
  const resp = await fetch("/api/news/live-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, category }),
  });
  if (!resp.ok) {
    throw new Error(`Live news search failed (${resp.status})`);
  }
  return resp.json();
}

export function getAllNewsCategories(): readonly NewsCategory[] {
  return NEWS_CATEGORIES;
}
