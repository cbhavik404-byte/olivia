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
} from "lucide-react";
import { voiceEmotionService } from "../services/voiceEmotionService";

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
  audioEnergy = 0,
  spokenText = "",
  kissTriggerCount = 0,
  onStopAnimation,
  onKissEnd,
  onDismissShy,
}: VisualizerProps) {
  const lookingRef = useRef<HTMLVideoElement>(null);
  const thinkingRef = useRef<HTMLVideoElement>(null);
  const talkingRef = useRef<HTMLVideoElement>(null);
  const kissRef = useRef<HTMLVideoElement>(null);

  // Default mode is continuous looking
  const [activeMode, setActiveMode] = useState<AvatarVideoMode>("looking");

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

  // Determine active video mode based on user directives:
  // 1. "when ever she will give kiss or spread automatic play giving kiss full video then shift to another video"
  // 2. "when she is speaking talking at that time talking video should play"
  // 3. "when she is finding on internet at that time and thinking time this thinking video should play"
  // 4. "when ever i open app and even i am looking the nexa no speaking at that time play video of continous looking"
  useEffect(() => {
    const playSafe = (video: HTMLVideoElement | null) => {
      if (video) {
        video.muted = true;
        video.playsInline = true;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.debug("[Nexa Video] Auto-play pending interaction:", err);
          });
        }
      }
    };

    if (isKissing) {
      setActiveMode("kiss");
      if (kissRef.current) {
        kissRef.current.muted = true;
        kissRef.current.playsInline = true;
        kissRef.current.currentTime = 0;
        playSafe(kissRef.current);
      }
      lookingRef.current?.pause();
      talkingRef.current?.pause();
      thinkingRef.current?.pause();
    } else if (state === "speaking" || Boolean(spokenText) || isSinging || isDancing) {
      setActiveMode("talking");
      playSafe(talkingRef.current);
    } else if (state === "processing") {
      setActiveMode("thinking");
      playSafe(thinkingRef.current);
    } else {
      // Idle, listening, paused, looking at Nexa with no speaking
      setActiveMode("looking");
      playSafe(lookingRef.current);
    }
  }, [state, isKissing, spokenText, isSinging, isDancing, kissTriggerCount]);

  // Autoplay bootstrap on mount and user interaction
  useEffect(() => {
    const attemptPlay = () => {
      if (lookingRef.current) {
        lookingRef.current.muted = true;
        lookingRef.current.play().catch(() => {});
      }
      if (thinkingRef.current) {
        thinkingRef.current.muted = true;
        thinkingRef.current.play().catch(() => {});
      }
      if (talkingRef.current) {
        talkingRef.current.muted = true;
        talkingRef.current.play().catch(() => {});
      }
      if (kissRef.current && isKissing) {
        kissRef.current.muted = true;
        kissRef.current.play().catch(() => {});
      }
    };

    attemptPlay();
    const handleInteract = () => {
      attemptPlay();
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
  }, [isKissing]);

  // Handle completion of the full giving kiss video
  const handleKissEnded = useCallback(() => {
    console.log("[Visualizer] Giving kiss full video completed. Automatically shifting to next video.");
    if (onKissEnd) {
      onKissEnd();
    }
    if (state === "speaking" || Boolean(spokenText) || isSinging || isDancing) {
      setActiveMode("talking");
      if (talkingRef.current) {
        talkingRef.current.muted = true;
        talkingRef.current.play().catch(() => {});
      }
    } else if (state === "processing") {
      setActiveMode("thinking");
      if (thinkingRef.current) {
        thinkingRef.current.muted = true;
        thinkingRef.current.play().catch(() => {});
      }
    } else {
      setActiveMode("looking");
      if (lookingRef.current) {
        lookingRef.current.muted = true;
        lookingRef.current.play().catch(() => {});
      }
    }
  }, [onKissEnd, state, spokenText, isSinging, isDancing]);

  const isShocked = vocalEmotion.emotion === "shocked";
  const isHappy = vocalEmotion.emotion === "happy" || vocalEmotion.emotion === "flattered";
  const isCurrentlyShy = isShy || mood === "shy" || vocalEmotion.emotion === "flattered" || vocalEmotion.emotion === "shy";

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
            ? {
                scale: [1, 1.02, 1],
                y: [0, -4, 0],
              }
            : activeMode === "talking"
            ? {
                scale: [1, 1.015, 1],
                y: [0, -2, 0],
              }
            : activeMode === "thinking"
            ? {
                scale: [1, 0.99, 1],
              }
            : {
                x: 0,
                y: 0,
                scale: 1,
              }
        }
        transition={{
          repeat: Infinity,
          duration: activeMode === "kiss" ? 2.4 : activeMode === "talking" ? 1.5 : 2.0,
          ease: "easeInOut",
        }}
        className={`relative w-full aspect-video max-h-[460px] rounded-2xl overflow-hidden bg-black/95 backdrop-blur-md border transition-all duration-500 ${getGlowStyles()}`}
      >
        {/* 1. Continuous Looking Video (Default when opening app, idle, attentive looking, listening) */}
        <video
          ref={lookingRef}
          src="/videos/looking.mp4"
          playsInline
          muted
          loop
          autoPlay
          preload="auto"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out ${
            activeMode === "looking" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          <source src="/videos/looking.mp4" type="video/mp4" />
          <source src="/videos/continous_looking.mp4" type="video/mp4" />
          <source src="/assets/contonous looking.mp4" type="video/mp4" />
        </video>

        {/* 2. Talking Video (Plays whenever Nexa is speaking / replying / singing) */}
        <video
          ref={talkingRef}
          src="/videos/talking.mp4"
          playsInline
          muted
          loop
          autoPlay
          preload="auto"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out ${
            activeMode === "talking" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          <source src="/videos/talking.mp4" type="video/mp4" />
          <source src="/assets/talking.mp4" type="video/mp4" />
        </video>

        {/* 3. Thinking Video (Plays when Nexa is searching on internet / processing) */}
        <video
          ref={thinkingRef}
          src="/videos/thinking.mp4"
          playsInline
          muted
          loop
          autoPlay
          preload="auto"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out ${
            activeMode === "thinking" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          <source src="/videos/thinking.mp4" type="video/mp4" />
          <source src="/assets/aistudio/thinking.mp4" type="video/mp4" />
        </video>

        {/* 4. Giving Kiss Full Video (Plays complete video on kiss, then automatically shifts back) */}
        <video
          ref={kissRef}
          src="/videos/kiss.mp4"
          playsInline
          muted
          autoPlay
          preload="auto"
          onEnded={handleKissEnded}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out ${
            activeMode === "kiss" ? "opacity-100 z-20" : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          <source src="/videos/kiss.mp4" type="video/mp4" />
          <source src="/videos/giving_kiss.mp4" type="video/mp4" />
        </video>

        {/* Clean Live Reply / Spoken Subtitle Text Overlay */}
        <AnimatePresence>
          {spokenText && (activeMode === "talking" || state === "speaking") && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-6 left-5 right-5 z-30 pointer-events-none flex justify-center"
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
                <span>Continous Looking</span>
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

        {/* Bottom Status Ticker */}
        <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-auto">
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
            <span className="text-[11px] font-mono uppercase tracking-wider text-white/70">
              {activeMode === "kiss"
                ? "Nexa Giving Kiss"
                : activeMode === "talking"
                ? "Nexa Speaking"
                : activeMode === "thinking"
                ? "Nexa Searching Internet"
                : "Nexa Continous Looking"}
            </span>
          </div>

          {isSinging && songTitle && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-mono text-pink-300 bg-pink-950/80 px-2.5 py-0.5 rounded-full border border-pink-500/40"
            >
              ♪ {songTitle}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
