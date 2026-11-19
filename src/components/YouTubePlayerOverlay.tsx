import React, { useEffect, useRef, useState } from "react";
import { Youtube, Play, Pause, SkipBack, SkipForward, ExternalLink, Minimize2, Maximize2, X } from "lucide-react";
import type { YouTubeResolvedVideo } from "../services/browserOperatorService";

interface PlayerState {
  isOpen: boolean;
  isMinimized: boolean;
  isPaused: boolean;
  channelTitle: string;
  channelUrl: string;
  videos: YouTubeResolvedVideo[];
  currentIndex: number;
}

export const YouTubePlayerOverlay: React.FC = () => {
  const [state, setState] = useState<PlayerState>({
    isOpen: false,
    isMinimized: false,
    isPaused: false,
    channelTitle: "",
    channelUrl: "",
    videos: [],
    currentIndex: 0,
  });

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const postYouTubeCommand = (func: "pauseVideo" | "playVideo") => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args: [] }),
        "*"
      );
    } catch {}
  };

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || !detail.type) return;

      if (detail.type === "load" && Array.isArray(detail.videos) && detail.videos.length > 0) {
        setState({
          isOpen: true,
          isMinimized: false,
          isPaused: false,
          channelTitle: detail.channelTitle || detail.videos[0].channelName || "YouTube",
          channelUrl: detail.channelUrl || detail.videos[0].watchUrl,
          videos: detail.videos,
          currentIndex: 0,
        });
      } else if (detail.type === "pause") {
        postYouTubeCommand("pauseVideo");
        setState((prev) => ({ ...prev, isPaused: true }));
      } else if (detail.type === "resume" || detail.type === "play") {
        postYouTubeCommand("playVideo");
        setState((prev) => ({ ...prev, isPaused: false }));
      } else if (detail.type === "next") {
        setState((prev) => {
          if (prev.videos.length === 0) return prev;
          const nextIdx = (prev.currentIndex + 1) % prev.videos.length;
          return { ...prev, currentIndex: nextIdx, isPaused: false };
        });
      } else if (detail.type === "previous") {
        setState((prev) => {
          if (prev.videos.length === 0) return prev;
          const prevIdx = (prev.currentIndex - 1 + prev.videos.length) % prev.videos.length;
          return { ...prev, currentIndex: prevIdx, isPaused: false };
        });
      } else if (detail.type === "close") {
        setState((prev) => ({ ...prev, isOpen: false }));
      }
    };

    window.addEventListener("nexa_youtube_player", handleEvent);
    return () => window.removeEventListener("nexa_youtube_player", handleEvent);
  }, []);

  if (!state.isOpen || state.videos.length === 0) return null;

  const currentVideo = state.videos[state.currentIndex] || state.videos[0];
  const originParam =
    typeof window !== "undefined" ? `&origin=${encodeURIComponent(window.location.origin)}` : "";
  const embedSrc = `https://www.youtube.com/embed/${encodeURIComponent(
    currentVideo.videoId
  )}?autoplay=1&enablejsapi=1&rel=0${originParam}`;

  return (
    <div
      id="nexa-youtube-player-overlay"
      className={`fixed bottom-24 left-4 z-[175] bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl text-slate-100 overflow-hidden transition-all duration-200 ${
        state.isMinimized ? "w-80" : "w-[360px] sm:w-[400px]"
      }`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-900/70">
        <div className="flex items-center gap-2 min-w-0">
          <Youtube size={16} className="text-rose-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">{currentVideo.title}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
              <span className="truncate">{state.channelTitle}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums shrink-0">
                {state.currentIndex + 1}/{state.videos.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <a
            href={currentVideo.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Open video on YouTube"
          >
            <ExternalLink size={14} />
          </a>
          <button
            onClick={() => setState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={state.isMinimized ? "Expand player" : "Minimize player"}
          >
            {state.isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button
            onClick={() => setState((prev) => ({ ...prev, isOpen: false }))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close player"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Video Viewport */}
      {!state.isMinimized && (
        <div className="relative w-full aspect-video bg-black">
          <iframe
            ref={iframeRef}
            key={currentVideo.videoId}
            src={embedSrc}
            title={currentVideo.title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}

      {/* Playback Controls */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/50 border-t border-slate-800">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() =>
              setState((prev) => ({
                ...prev,
                currentIndex: (prev.currentIndex - 1 + prev.videos.length) % prev.videos.length,
                isPaused: false,
              }))
            }
            disabled={state.videos.length <= 1}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            title="Previous video"
          >
            <SkipBack size={13} /> Prev
          </button>
          <button
            onClick={() => {
              if (state.isPaused) {
                postYouTubeCommand("playVideo");
                setState((prev) => ({ ...prev, isPaused: false }));
              } else {
                postYouTubeCommand("pauseVideo");
                setState((prev) => ({ ...prev, isPaused: true }));
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {state.isPaused ? (
              <>
                <Play size={13} /> Resume
              </>
            ) : (
              <>
                <Pause size={13} /> Pause
              </>
            )}
          </button>
          <button
            onClick={() =>
              setState((prev) => ({
                ...prev,
                currentIndex: (prev.currentIndex + 1) % prev.videos.length,
                isPaused: false,
              }))
            }
            disabled={state.videos.length <= 1}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            title="Next video"
          >
            Next <SkipForward size={13} />
          </button>
        </div>

        <a
          href={state.channelUrl || currentVideo.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-cyan-400 hover:text-cyan-300 whitespace-nowrap shrink-0"
        >
          Open Channel
        </a>
      </div>
    </div>
  );
};

export default YouTubePlayerOverlay;
