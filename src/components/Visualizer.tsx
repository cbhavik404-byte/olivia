import React, { useEffect, useRef, useState, useCallback } from "react";
import { AppState as VisualizerState, NexaMood, VocalEmotionData } from "../types";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Music,
  Mic,
  Heart,
  Radio,
  Eye,
  Zap,
  Film,
  Upload,
} from "lucide-react";
import { voiceEmotionService } from "../services/voiceEmotionService";
import {
  AvatarCharacterId,
  VideoSlot,
  ALL_VIDEO_SLOTS,
  getActiveAvatarCharacter,
  getCharacterConfig,
  getCharacterCustomVideos,
} from "../services/customVideoService";

export interface VisualizerProps {
  state: VisualizerState;
  mood?: NexaMood;
  isKissing?: boolean;
  isShy?: boolean;
  showMemeVideo?: boolean;
  isDancing?: boolean;
  isSinging?: boolean;
  songTitle?: string;
  audioEnergy?: number;
  spokenText?: string;
  kissTriggerCount?: number;
  onStopAnimation?: () => void;
  onDismissMeme?: () => void;
  onKissEnd?: () => void;
  onDismissShy?: () => void;
  onOpenVideoMatrix?: () => void;
}

export type AvatarVideoMode = "looking" | "thinking" | "talking" | "kiss";

export default function Visualizer({
  state,
  mood,
  isKissing = false,
  isShy = false,
  isDancing = false,
  isSinging = false,
  songTitle,
  spokenText = "",
  kissTriggerCount = 0,
  onKissEnd,
  onOpenVideoMatrix,
}: VisualizerProps) {
  const lookingRef = useRef<HTMLVideoElement>(null);
  const thinkingRef = useRef<HTMLVideoElement>(null);
  const talkingRef = useRef<HTMLVideoElement>(null);
  const kissRef = useRef<HTMLVideoElement>(null);

  // Default mode is continuous looking
  const [activeMode, setActiveMode] = useState<AvatarVideoMode>("looking");

  // Multi-Character Avatar Matrix State
  const [activeCharacter, setActiveCharacter] = useState<AvatarCharacterId>(() =>
    getActiveAvatarCharacter()
  );
  const [customUrls, setCustomUrls] = useState<Record<VideoSlot, string | null>>({
    looking: null,
    thinking: null,
    talking: null,
    kiss: null,
  });
  const createdUrlsRef = useRef<string[]>([]);

  const reloadCharacterMedia = useCallback(async () => {
    const charId = getActiveAvatarCharacter();
    setActiveCharacter(charId);

    const blobs = await getCharacterCustomVideos(charId);

    // Revoke previous Object URLs cleanly to prevent memory leaks
    createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    createdUrlsRef.current = [];

    const nextUrls: Record<VideoSlot, string | null> = {
      looking: null,
      thinking: null,
      talking: null,
      kiss: null,
    };

    ALL_VIDEO_SLOTS.forEach((slot) => {
      const blob = blobs[slot];
      if (blob) {
        const objUrl = URL.createObjectURL(blob);
        createdUrlsRef.current.push(objUrl);
        nextUrls[slot] = objUrl;
      }
    });

    setCustomUrls(nextUrls);
  }, []);

  useEffect(() => {
    reloadCharacterMedia();
    const handleMediaUpdate = () => {
      reloadCharacterMedia();
    };
    window.addEventListener("nexa-custom-videos-updated", handleMediaUpdate);
    window.addEventListener("nexa-avatar-character-changed", handleMediaUpdate);
    return () => {
      window.removeEventListener("nexa-custom-videos-updated", handleMediaUpdate);
      window.removeEventListener("nexa-avatar-character-changed", handleMediaUpdate);
      createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      createdUrlsRef.current = [];
    };
  }, [reloadCharacterMedia]);

  const charConfig = getCharacterConfig(activeCharacter);

  // Resolve final source URL for each action slot:
  // Priority 1: Custom uploaded IndexedDB Blob for the active character
  // Priority 2: Bundled stock asset for that character (if any, e.g. Purple Olivia)
  // Priority 3: Another uploaded clip from the SAME character (e.g. 'looking') so character stays consistent
  const resolveSlotSrc = (slot: VideoSlot): string | null => {
    if (customUrls[slot]) return customUrls[slot];
    if (charConfig.stockAssets[slot]) return charConfig.stockAssets[slot] || null;
    if (customUrls.looking) return customUrls.looking;
    if (customUrls.talking) return customUrls.talking;
    if (customUrls.thinking) return customUrls.thinking;
    if (customUrls.kiss) return customUrls.kiss;
    return null;
  };

  const lookingSrc = resolveSlotSrc("looking");
  const talkingSrc = resolveSlotSrc("talking");
  const thinkingSrc = resolveSlotSrc("thinking");
  const kissSrc = resolveSlotSrc("kiss");

  const activeModeSrc =
    activeMode === "kiss"
      ? kissSrc
      : activeMode === "talking"
      ? talkingSrc
      : activeMode === "thinking"
      ? thinkingSrc
      : lookingSrc;

  // Live Vocal Emotion tracking from voiceEmotionService
  const [vocalEmotion, setVocalEmotion] = useState<VocalEmotionData>({
    emotion: "neutral",
    intensity: 0,
    trigger: "sentiment",
  });

  useEffect(() => {
    const unsubscribe = voiceEmotionService.subscribe((data) => {
      setVocalEmotion(data);
    });
    return unsubscribe;
  }, []);

  // Zero-GPU-Overhead Switcher: strictly decode and play ONLY the single active video at 60 FPS
  const syncActivePlayback = useCallback(
    (mode: AvatarVideoMode, resetKissTime = false) => {
      const refMap: Record<AvatarVideoMode, React.RefObject<HTMLVideoElement | null>> = {
        looking: lookingRef,
        talking: talkingRef,
        thinking: thinkingRef,
        kiss: kissRef,
      };

      (Object.keys(refMap) as AvatarVideoMode[]).forEach((key) => {
        const vid = refMap[key].current;
        if (!vid) return;
        if (key === mode) {
          vid.muted = true;
          vid.playsInline = true;
          if (key === "kiss" && resetKissTime) {
            vid.currentTime = 0;
          }
          const p = vid.play();
          if (p !== undefined) {
            p.catch((err) => {
              console.debug("[Nexa Video] Auto-play pending interaction:", err);
            });
          }
        } else {
          if (!vid.paused) {
            vid.pause();
          }
        }
      });
    },
    []
  );

  // Determine active video mode based on app state
  useEffect(() => {
    if (isKissing) {
      setActiveMode("kiss");
      syncActivePlayback("kiss", true);
    } else if (state === "speaking" || Boolean(spokenText) || isSinging || isDancing) {
      setActiveMode("talking");
      syncActivePlayback("talking");
    } else if (state === "processing") {
      setActiveMode("thinking");
      syncActivePlayback("thinking");
    } else {
      setActiveMode("looking");
      syncActivePlayback("looking");
    }
  }, [
    state,
    isKissing,
    spokenText,
    isSinging,
    isDancing,
    kissTriggerCount,
    lookingSrc,
    talkingSrc,
    thinkingSrc,
    kissSrc,
    syncActivePlayback,
  ]);

  // Autoplay bootstrap on mount and first user interaction
  useEffect(() => {
    syncActivePlayback(activeMode);
    const handleInteract = () => {
      syncActivePlayback(activeMode);
      window.removeEventListener("click", handleInteract);
      window.removeEventListener("keydown", handleInteract);
      window.removeEventListener("touchstart", handleInteract);
    };
    window.addEventListener("click", handleInteract);
    window.addEventListener("keydown", handleInteract);
    window.addEventListener("touchstart", handleInteract);

    return () => {
      window.removeEventListener("click", handleInteract);
      window.removeEventListener("keydown", handleInteract);
      window.removeEventListener("touchstart", handleInteract);
    };
  }, [activeMode, syncActivePlayback]);

  // Handle completion of the full giving kiss video
  const handleKissEnded = useCallback(() => {
    if (onKissEnd) {
      onKissEnd();
    }
    const nextMode: AvatarVideoMode =
      state === "speaking" || Boolean(spokenText) || isSinging || isDancing
        ? "talking"
        : state === "processing"
        ? "thinking"
        : "looking";
    setActiveMode(nextMode);
    syncActivePlayback(nextMode);
  }, [onKissEnd, state, spokenText, isSinging, isDancing, syncActivePlayback]);

  const handleOpenMatrix = () => {
    if (onOpenVideoMatrix) {
      onOpenVideoMatrix();
    } else {
      window.dispatchEvent(new CustomEvent("nexa-open-custom-videos-manager"));
    }
  };

  const isShocked = vocalEmotion.emotion === "shocked";
  const isHappy = vocalEmotion.emotion === "happy" || vocalEmotion.emotion === "flattered";
  const isCurrentlyShy =
    isShy || mood === "shy" || vocalEmotion.emotion === "flattered" || vocalEmotion.emotion === "shy";

  // Dynamic Aura Glow according to current active video mode
  const getGlowStyles = () => {
    if (activeMode === "kiss") {
      return "border-rose-400 shadow-[0_0_65px_rgba(244,63,94,0.65)] ring-1 ring-rose-400/50";
    }
    if (activeMode === "thinking") {
      return "border-amber-400/80 shadow-[0_0_55px_rgba(245,158,11,0.55)] ring-1 ring-amber-400/40";
    }
    if (activeMode === "talking") {
      return "border-cyan-400/80 shadow-[0_0_55px_rgba(6,182,212,0.55)] ring-1 ring-cyan-400/40";
    }
    if (state === "listening") {
      return "border-orange-500/70 shadow-[0_0_45px_rgba(249,115,22,0.45)]";
    }
    return "border-amber-500/40 shadow-[0_0_35px_rgba(245,158,11,0.25)]";
  };

  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-4 select-none pointer-events-auto">
      {/* Dynamic Ambient Background Aura */}
      <div
        className={`absolute -inset-6 rounded-3xl blur-[85px] transition-all duration-700 pointer-events-none opacity-50 ${
          activeMode === "kiss"
            ? "bg-gradient-to-r from-pink-600 via-rose-500 to-purple-500 scale-105 opacity-70"
            : activeMode === "thinking"
            ? "bg-gradient-to-r from-amber-600 via-yellow-500 to-orange-500 scale-105 opacity-60"
            : activeMode === "talking"
            ? "bg-gradient-to-r from-cyan-600 via-teal-500 to-emerald-500 scale-105 opacity-65"
            : state === "listening"
            ? "bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-400 opacity-55"
            : "bg-gradient-to-r from-amber-600/30 via-amber-500/20 to-yellow-600/20"
        }`}
      />

      {/* Main High-Definition Video Avatar Frame */}
      <motion.div
        animate={
          activeMode === "kiss"
            ? { scale: [1, 1.02, 1], y: [0, -4, 0] }
            : activeMode === "talking"
            ? { scale: [1, 1.015, 1], y: [0, -2, 0] }
            : activeMode === "thinking"
            ? { scale: [1, 0.99, 1] }
            : { x: 0, y: 0, scale: 1 }
        }
        transition={{
          repeat: Infinity,
          duration: activeMode === "kiss" ? 2.4 : activeMode === "talking" ? 1.5 : 2.0,
          ease: "easeInOut",
        }}
        className={`relative w-full aspect-video max-h-[460px] rounded-2xl overflow-hidden bg-black/95 backdrop-blur-md border transition-all duration-500 ${getGlowStyles()}`}
      >
        {/* Empty Character State Fallback (e.g. Pink Hair / Realistic AI with 0/4 clips uploaded yet) */}
        {!activeModeSrc && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br from-neutral-950 via-purple-950/30 to-neutral-950 p-6 text-center">
            <div className="p-3.5 rounded-2xl bg-purple-500/15 border border-purple-400/30 text-purple-300 mb-3">
              <Film size={28} />
            </div>
            <h3 className="text-base font-bold text-white">{charConfig.name}</h3>
            <p className="text-xs text-neutral-400 max-w-sm mt-1">
              No video clips uploaded for this character yet. Add Looking, Talking, Thinking, or Kiss videos in one click.
            </p>
            <button
              onClick={handleOpenMatrix}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/25 hover:bg-purple-500/35 text-purple-200 border border-purple-400/50 text-xs font-semibold transition-all cursor-pointer"
            >
              <Upload size={14} />
              <span>Upload Videos for {charConfig.shortLabel}</span>
            </button>
          </div>
        )}

        {/* 1. Continuous Looking Video */}
        {lookingSrc && (
          <video
            key={`looking-${activeCharacter}-${lookingSrc}`}
            ref={lookingRef}
            src={lookingSrc}
            playsInline
            muted
            loop
            autoPlay={activeMode === "looking"}
            preload={activeMode === "looking" ? "auto" : "metadata"}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out ${
              activeMode === "looking" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          />
        )}

        {/* 2. Talking Video */}
        {talkingSrc && (
          <video
            key={`talking-${activeCharacter}-${talkingSrc}`}
            ref={talkingRef}
            src={talkingSrc}
            playsInline
            muted
            loop
            autoPlay={activeMode === "talking"}
            preload={activeMode === "talking" ? "auto" : "metadata"}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out ${
              activeMode === "talking" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          />
        )}

        {/* 3. Thinking Video */}
        {thinkingSrc && (
          <video
            key={`thinking-${activeCharacter}-${thinkingSrc}`}
            ref={thinkingRef}
            src={thinkingSrc}
            playsInline
            muted
            loop
            autoPlay={activeMode === "thinking"}
            preload={activeMode === "thinking" ? "auto" : "metadata"}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out ${
              activeMode === "thinking" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          />
        )}

        {/* 4. Giving Kiss Full Video */}
        {kissSrc && (
          <video
            key={`kiss-${activeCharacter}-${kissSrc}`}
            ref={kissRef}
            src={kissSrc}
            playsInline
            muted
            autoPlay={activeMode === "kiss"}
            preload={activeMode === "kiss" ? "auto" : "metadata"}
            onEnded={handleKissEnded}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out ${
              activeMode === "kiss" ? "opacity-100 z-20" : "opacity-0 z-0 pointer-events-none"
            }`}
          />
        )}

        {/* Clean Live Reply / Spoken Subtitle Text Overlay */}
        <AnimatePresence>
          {spokenText && (activeMode === "talking" || state === "speaking") && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-11 left-5 right-5 z-30 pointer-events-none flex justify-center"
            >
              <div className="max-w-xl px-5 py-2.5 rounded-2xl bg-black/85 backdrop-blur-md border border-white/15 shadow-[0_4px_30px_rgba(0,0,0,0.8)] text-center">
                <p className="text-xs sm:text-sm md:text-base font-medium text-white/95 leading-relaxed tracking-wide drop-shadow-sm select-text">
                  {spokenText}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtle Scanline / Vignette Overlay */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-transparent to-black/30 z-20" />

        {/* Top-Right Mode Badge Indicator */}
        <div className="absolute top-3.5 right-3.5 z-30 flex items-center gap-2 pointer-events-auto">
          <AnimatePresence mode="wait">
            {activeMode === "kiss" ? (
              <motion.div
                key="badge-kiss"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/60 backdrop-blur-md text-xs font-mono text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.6)]"
              >
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400 animate-pulse" />
                <span className="font-semibold">Giving Kiss 💋</span>
              </motion.div>
            ) : activeMode === "thinking" ? (
              <motion.div
                key="badge-thinking"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/60 backdrop-blur-md text-xs font-mono text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>Searching Internet... 🧠</span>
              </motion.div>
            ) : activeMode === "talking" ? (
              <motion.div
                key="badge-talking"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/60 backdrop-blur-md text-xs font-mono text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.5)]"
              >
                {isSinging ? (
                  <Music className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
                ) : (
                  <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                )}
                <span>{isSinging ? "Singing" : "Replying"}</span>
              </motion.div>
            ) : state === "listening" ? (
              <motion.div
                key="badge-listening"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-950/80 border border-orange-500/60 backdrop-blur-md text-xs font-mono text-orange-200 shadow-[0_0_15px_rgba(249,115,22,0.4)]"
              >
                <Mic className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                <span>Listening</span>
              </motion.div>
            ) : (
              <motion.div
                key="badge-looking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 border border-amber-500/30 backdrop-blur-md text-[11px] font-mono text-amber-300/80"
              >
                <Eye className="w-3 h-3 text-amber-400/80" />
                <span>Continuous Looking</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Top-Left Live Vocal Emotion & Reflex Indicator */}
        <div className="absolute top-3.5 left-3.5 z-30 flex items-center gap-2 pointer-events-auto">
          <AnimatePresence mode="wait">
            {isShocked ? (
              <motion.div
                key="emotion-shock"
                initial={{ opacity: 0, scale: 0.8, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/25 border border-amber-400 text-amber-200 text-xs font-mono backdrop-blur-md shadow-[0_0_20px_rgba(251,191,36,0.6)]"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 animate-bounce" />
                <span className="font-bold">⚡ FEAR / SHOCK FLINCH</span>
              </motion.div>
            ) : isCurrentlyShy || isHappy ? (
              <motion.div
                key="emotion-shy"
                initial={{ opacity: 0, scale: 0.8, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/25 border border-rose-400 text-rose-200 text-xs font-mono backdrop-blur-md shadow-[0_0_20px_rgba(244,63,94,0.5)]"
              >
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400 animate-pulse" />
                <span className="font-bold">Blushing Matched</span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Bottom Status Ticker + Direct Avatar Matrix Quick Button */}
        <div className="absolute bottom-3 left-4 right-4 z-30 flex items-center justify-between gap-2 pointer-events-auto">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                activeMode === "kiss"
                  ? "bg-rose-400 animate-ping"
                  : activeMode === "thinking"
                  ? "bg-amber-400 animate-ping"
                  : activeMode === "talking"
                  ? "bg-cyan-400 animate-pulse"
                  : "bg-emerald-400 animate-pulse"
              }`}
            />
            <span className="text-[11px] font-mono uppercase tracking-wider text-white/75">
              {activeMode === "kiss"
                ? "Giving Kiss"
                : activeMode === "talking"
                ? "Speaking"
                : activeMode === "thinking"
                ? "Searching Internet"
                : "Continuous Looking"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isSinging && songTitle && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs font-mono text-pink-300 bg-pink-950/80 px-2.5 py-0.5 rounded-full border border-pink-500/40"
              >
                ♪ {songTitle}
              </motion.div>
            )}

            <button
              type="button"
              onClick={handleOpenMatrix}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/75 hover:bg-purple-950/85 text-purple-200 border border-purple-400/45 hover:border-purple-300/80 backdrop-blur-md text-[11px] font-mono font-semibold transition-all cursor-pointer shadow-lg"
              title="Open 12-Video Multi-Character Avatar Matrix to change character or upload new videos"
            >
              <Film size={12} className="text-purple-300" />
              <span>{charConfig.shortLabel}</span>
              <span className="text-white/40">•</span>
              <span className="text-white/85">Change / Add Videos</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
