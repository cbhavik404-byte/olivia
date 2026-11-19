import React, { useState, useEffect } from "react";
import { Newspaper, X, RefreshCw, Search, ExternalLink, ShieldCheck, Clock } from "lucide-react";
import { NEWS_CATEGORIES, NewsArticle } from "../types";
import { fetchStoredNews, searchLiveBreakingNews, syncNewsRss } from "../services/newsIntelligenceService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewsIntelligenceModal({ isOpen, onClose }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [query, setQuery] = useState("");
  const [briefing, setBriefing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadArticles = async (cat = selectedCategory, q = query) => {
    setIsLoading(true);
    try {
      const data = await fetchStoredNews(cat, q);
      setArticles(data.articles || []);
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadArticles(selectedCategory, query);
    }
  }, [isOpen, selectedCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRssSync = async () => {
    setIsLoading(true);
    try {
      const res = await syncNewsRss(selectedCategory === "All" ? undefined : selectedCategory);
      setArticles(res.articles || []);
      setBriefing(`Synced RSS feeds: ${res.added} new story/stories added, ${res.updated} updated.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLiveSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await searchLiveBreakingNews(
        query || "latest breaking India and world news today",
        selectedCategory === "All" ? undefined : selectedCategory
      );
      setArticles(res.articles || []);
      setBriefing(res.briefing);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6">
      <div className="w-full max-w-5xl h-[88vh] max-h-[840px] rounded-3xl bg-[#090d16] border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col overflow-hidden text-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0d1424]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400">
              <Newspaper size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wide">Live News Intelligence Engine</h2>
              <p className="text-[11px] font-mono text-white/50">
                13 Verified Categories • Cross-Source Confidence Checks • Event vs Publication Timestamps
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Search & Sync Bar */}
        <div className="px-6 py-3 border-b border-white/10 bg-[#0b111e] flex flex-wrap items-center gap-2">
          <form onSubmit={handleLiveSearch} className="flex-1 min-w-[220px] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/50 border border-white/10">
            <Search size={14} className="text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask live news (e.g. AI regulation, India budget, breaking cyber news)..."
              className="flex-1 bg-transparent text-xs text-white outline-none"
            />
            <button type="submit" disabled={isLoading} className="px-3 py-1 rounded-lg bg-cyan-500 text-black font-bold text-xs cursor-pointer">
              Live Verify
            </button>
          </form>
          <button
            onClick={handleRssSync}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono cursor-pointer"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} /> Refresh Feeds
          </button>
        </div>

        {/* 13 Categories Bar */}
        <div className="px-6 py-2.5 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          {["All", ...NEWS_CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-[11px] font-mono whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-cyan-500 text-black font-bold"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {briefing && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-xs text-cyan-100 leading-relaxed">
            <strong className="text-cyan-300 font-mono">VERIFIED BRIEFING:</strong> {briefing}
          </div>
        )}

        {/* Articles Feed */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4 custom-scrollbar">
          {articles.length === 0 ? (
            <div className="col-span-full text-center py-12 text-xs text-white/40">
              {isLoading ? "Syncing verified news sources..." : "No cached articles in this category yet. Click 'Refresh Feeds' or 'Live Verify'."}
            </div>
          ) : (
            articles.map((art) => (
              <div key={art.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-cyan-300">
                      {art.category}
                    </span>
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                        art.confidenceStatus === "CONFIRMED"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : art.confidenceStatus === "DEVELOPING"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      <ShieldCheck size={10} /> {art.confidenceStatus} ({art.crossCheckCount} src)
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white leading-snug">{art.headline}</h3>
                  <p className="text-xs text-white/75 leading-relaxed">{art.summary}</p>
                  {art.whyItMatters && (
                    <p className="text-[11px] text-amber-200/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                      <strong>Why it matters:</strong> {art.whyItMatters}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-white/10 flex flex-col gap-1.5 text-[10px] font-mono text-white/45">
                  <div className="flex items-center gap-2">
                    <Clock size={10} />
                    <span>Published: {new Date(art.publishedAt).toLocaleString()}</span>
                    {art.eventTime && art.eventTime !== art.publishedAt && (
                      <span>• Event: {art.eventTime}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {art.sourceLinks.slice(0, 3).map((s, idx) => (
                      <a
                        key={idx}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-300 hover:underline"
                      >
                        {s.publisher || "Source"} <ExternalLink size={9} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
