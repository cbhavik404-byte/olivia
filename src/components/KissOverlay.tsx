import React, { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Heart, Sparkles, X, Volume2, Mail, Smile } from "lucide-react";
import { KissAnimationType } from "../types";

export type { KissAnimationType };

interface KissOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle?: () => void;
  personality?: string;
  onPlaySound?: () => void;
  animationType?: KissAnimationType;
  onChangeAnimationType?: (type: KissAnimationType) => void;
}

interface ParticleConfig {
  id: number;
  icon: string;
  angle: number;
  distance: number;
  duration: number;
  delay: number;
  size: string;
  swayX?: number[];
  pathY?: number[];
  rotations?: number[];
}

export const KissOverlay: React.FC<KissOverlayProps> = ({
  isOpen,
  onClose,
  personality = "default",
  onPlaySound,
  animationType = "floating_lips",
  onChangeAnimationType,
}) => {
  // Generate specialized particle data based on current animation type
  const particles: ParticleConfig[] = useMemo(() => {
    if (animationType === "heart_burst") {
      // 1. Small Heart Burst: High-density radial explosive burst
      const icons = ["💖", "💕", "💗", "💓", "❤️", "💘", "✨", "💝", "💞", "✨", "💓", "💖"];
      return Array.from({ length: 24 }).map((_, i) => {
        const angle = (i / 24) * Math.PI * 2 + (i % 2 === 0 ? 0.15 : -0.15);
        const distance = 70 + (i % 5) * 35;
        const duration = 1.6 + (i % 4) * 0.3;
        const delay = (i * 0.08) % 1.2;
        const sizes = ["text-xl", "text-2xl", "text-3xl", "text-xl", "text-4xl"];
        return {
          id: i,
          icon: icons[i % icons.length],
          angle,
          distance,
          duration,
          delay,
          size: sizes[i % sizes.length],
        };
      });
    }

    if (animationType === "love_letter_swarm") {
      // 3. Love-Letter Swarm: Fluttering paper notes and winged letters swooping dynamically
      const icons = ["💌", "✉️", "🕊️", "💝", "📜", "💖", "✨", "💌", "🕊️", "💌", "💝", "✉️"];
      return Array.from({ length: 20 }).map((_, i) => {
        const startX = ((i % 5) - 2) * 60;
        const swayWidth = 40 + (i % 3) * 30;
        const duration = 2.8 + (i % 4) * 0.4;
        const delay = (i * 0.16) % 1.6;
        const sizes = ["text-2xl", "text-3xl", "text-4xl", "text-2xl"];
        return {
          id: i,
          icon: icons[i % icons.length],
          angle: (i / 20) * Math.PI * 2,
          distance: 120,
          duration,
          delay,
          size: sizes[i % sizes.length],
          swayX: [startX, startX - swayWidth, startX + swayWidth * 0.8, startX - swayWidth * 0.5, startX + 20],
          pathY: [100, 30, -50, -130, -210],
          rotations: [-25 + (i % 3) * 15, 20, -18, 30, -10],
        };
      });
    }

    // 2. Floating Lips (Default): Gentle swaying kiss marks drifting upward and towards user
    const icons = ["💋", "👄", "😘", "💄", "💋", "💋", "✨", "💋", "👄", "😘"];
    return Array.from({ length: 18 }).map((_, i) => {
      const angle = (i / 18) * Math.PI * 2;
      const distance = 85 + (i % 4) * 40;
      const duration = 2.4 + (i % 5) * 0.35;
      const delay = (i * 0.12) % 1.5;
      const sizes = ["text-2xl", "text-3xl", "text-4xl", "text-3xl"];
      const driftX = ((i % 4) - 1.5) * 35;
      return {
        id: i,
        icon: icons[i % icons.length],
        angle,
        distance,
        duration,
        delay,
        size: sizes[i % sizes.length],
        swayX: [0, driftX, -driftX * 0.7, driftX * 0.9, 0],
        pathY: [40, -10, -70, -135, -190],
        rotations: [-15, 12, -8, 18, 0],
      };
    });
  }, [animationType]);

  const isOliviya = personality === "oliviya" || personality === "zoya" || personality === "default";

  // Dynamic titles and color accents per animation type
  const typeConfig = useMemo(() => {
    switch (animationType) {
      case "heart_burst":
        return {
          title: isOliviya ? "OLIVIYA'S HEART BURST 💖" : "MWAH! HEART BURST 💖",
          subtitle: "Small Heart Burst • Radiant Love Sparks",
          accentColor: "from-pink-500 via-rose-500 to-red-500",
          glowColor: "from-pink-500/35 via-rose-500/30 to-red-500/25",
          badgeBorder: "border-rose-400/50",
          icon: <Heart className="w-5 h-5 fill-rose-500 text-rose-400" />,
        };
      case "love_letter_swarm":
        return {
          title: isOliviya ? "OLIVIYA'S LOVE LETTERS 💌" : "MWAH! LOVE-LETTER SWARM 💌",
          subtitle: "Love-Letter Swarm • Fluttering Notes",
          accentColor: "from-purple-500 via-pink-500 to-amber-400",
          glowColor: "from-purple-500/35 via-pink-500/25 to-amber-500/20",
          badgeBorder: "border-purple-400/50",
          icon: <Mail className="w-5 h-5 text-amber-300" />,
        };
      case "floating_lips":
      default:
        return {
          title: isOliviya ? "OLIVIYA'S FLOATING LIPS 💋" : "MWAH! FLOATING LIPS 💋",
          subtitle: "Floating Lips • Swaying Kiss Prints",
          accentColor: "from-pink-600 via-rose-500 to-purple-600",
          glowColor: "from-pink-500/35 via-rose-500/25 to-purple-500/25",
          badgeBorder: "border-pink-400/50",
          icon: <Smile className="w-5 h-5 text-pink-300" />,
        };
    }
  }, [animationType, isOliviya]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="persistent-kiss-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          className="absolute inset-0 z-30 pointer-events-none flex flex-col items-center justify-between pb-6 pt-2 overflow-hidden select-none"
        >
          {/* Ambient Warm Radiant Heart Aura (Continuous Breathing Loop) */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{
              scale: [0.8, 1.35, 1.05, 1.3, 0.8],
              opacity: [0.35, 0.7, 0.45, 0.75, 0.35],
              rotate: [0, 45, 90, 180, 360],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className={`absolute w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-gradient-to-r ${typeConfig.glowColor} blur-3xl pointer-events-none`}
          />

          {/* Secondary Soft Pulsing Core Glow */}
          <motion.div
            animate={{
              scale: [1, 1.25, 1],
              opacity: [0.4, 0.85, 0.4],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute w-56 h-56 rounded-full bg-rose-500/30 blur-2xl pointer-events-none"
          />

          {/* Dynamic Particle Animations Based on Selected Type */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {particles.map((p) => {
              if (animationType === "heart_burst") {
                // Heart burst: High velocity radial explosion
                const targetX = Math.cos(p.angle) * p.distance;
                const targetY = Math.sin(p.angle) * p.distance - 20;

                return (
                  <motion.div
                    key={`heart-burst-${p.id}`}
                    initial={{ opacity: 0, scale: 0.2, x: 0, y: 0 }}
                    animate={{
                      opacity: [0, 1, 0.95, 0],
                      scale: [0.2, 1.4, 1.1, 0.6],
                      x: [0, targetX * 0.4, targetX, targetX * 1.15],
                      y: [0, targetY * 0.4, targetY, targetY - 25],
                      rotate: [0, p.id % 2 === 0 ? 30 : -30, p.id % 2 === 0 ? -15 : 15],
                    }}
                    transition={{
                      duration: p.duration,
                      delay: p.delay,
                      repeat: Infinity,
                      repeatDelay: 0.15,
                      ease: "easeOut",
                    }}
                    className={`absolute ${p.size} drop-shadow-[0_0_16px_rgba(244,114,182,0.9)] select-none pointer-events-none`}
                  >
                    {p.icon}
                  </motion.div>
                );
              }

              if (animationType === "love_letter_swarm") {
                // Love-letter swarm: swooping gliding motion
                return (
                  <motion.div
                    key={`letter-swarm-${p.id}`}
                    initial={{ opacity: 0, scale: 0.3, x: p.swayX?.[0] || 0, y: p.pathY?.[0] || 80 }}
                    animate={{
                      opacity: [0, 1, 0.95, 0],
                      scale: [0.4, 1.25, 1.1, 0.8],
                      x: p.swayX || [0, 40, -40, 20, 0],
                      y: p.pathY || [80, 20, -50, -120, -180],
                      rotate: p.rotations || [-20, 20, -15, 25, 0],
                    }}
                    transition={{
                      duration: p.duration,
                      delay: p.delay,
                      repeat: Infinity,
                      repeatDelay: 0.25,
                      ease: "easeInOut",
                    }}
                    className={`absolute ${p.size} drop-shadow-[0_0_18px_rgba(216,180,254,0.9)] select-none pointer-events-none`}
                  >
                    {p.icon}
                  </motion.div>
                );
              }

              // Floating lips: Gentle sinusoidal upward float
              return (
                <motion.div
                  key={`floating-lips-${p.id}`}
                  initial={{ opacity: 0, scale: 0.3, x: 0, y: 30 }}
                  animate={{
                    opacity: [0, 1, 0.9, 0],
                    scale: [0.3, 1.35, 1.15, 0.8],
                    x: p.swayX || [0, 25, -25, 15, 0],
                    y: p.pathY || [30, -20, -70, -130, -180],
                    rotate: p.rotations || [-15, 15, -10, 15, 0],
                  }}
                  transition={{
                    duration: p.duration,
                    delay: p.delay,
                    repeat: Infinity,
                    repeatDelay: 0.2,
                    ease: "easeOut",
                  }}
                  className={`absolute ${p.size} drop-shadow-[0_0_16px_rgba(244,114,182,0.9)] select-none pointer-events-none`}
                >
                  {p.icon}
                </motion.div>
              );
            })}
          </div>

          {/* Interactive Kiss Badge at bottom (Pointer Events Enabled for Switcher, Dismiss & Audio) */}
          <div className="flex-1 pointer-events-none" />
          <motion.div
            initial={{ scale: 0.8, y: 35, opacity: 0 }}
            animate={{
              scale: 1,
              y: 0,
              opacity: 1,
            }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 320, damping: 22 }}
            className={`relative pointer-events-auto px-5 py-2.5 rounded-2xl bg-[#0a0508]/85 backdrop-blur-xl border ${typeConfig.badgeBorder} shadow-[0_0_35px_rgba(244,63,94,0.5)] flex flex-col items-center gap-1.5 max-w-[92%] sm:max-w-md mx-auto mb-2 z-40`}
          >
            {/* Header with Title and Close Button */}
            <div className="flex items-center justify-between w-full gap-3">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  {typeConfig.icon}
                </motion.div>
                <div>
                  <span className="font-black text-xs sm:text-sm tracking-wider uppercase bg-gradient-to-r from-pink-200 via-rose-100 to-amber-200 bg-clip-text text-transparent drop-shadow-md">
                    {typeConfig.title}
                  </span>
                  <div className="text-[10px] text-pink-300/70 font-mono">
                    {typeConfig.subtitle}
                  </div>
                </div>
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin ml-auto" />
              </div>

              {/* Close / Dismiss Button */}
              <button
                type="button"
                onClick={onClose}
                title="Dismiss flying kiss overlay"
                className="p-1 rounded-full bg-white/10 hover:bg-rose-500/30 text-pink-200 hover:text-white transition-all border border-pink-400/30 hover:border-pink-300 flex items-center justify-center shrink-0 ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Animation Style Selector Pills (Real-time live switcher) */}
            <div className="flex items-center justify-center bg-black/40 p-1 rounded-xl border border-pink-500/20 gap-1 w-full mt-0.5">
              <button
                type="button"
                onClick={() => onChangeAnimationType?.("heart_burst")}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                  animationType === "heart_burst"
                    ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-sm shadow-rose-500/50 scale-[1.02]"
                    : "text-pink-200/70 hover:text-white hover:bg-white/10"
                }`}
                title="Select Small Heart Burst Animation"
              >
                <span>💖 Burst</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeAnimationType?.("floating_lips")}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                  animationType === "floating_lips"
                    ? "bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow-sm shadow-fuchsia-500/50 scale-[1.02]"
                    : "text-pink-200/70 hover:text-white hover:bg-white/10"
                }`}
                title="Select Floating Lips Animation"
              >
                <span>💋 Lips</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeAnimationType?.("love_letter_swarm")}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                  animationType === "love_letter_swarm"
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-500/50 scale-[1.02]"
                    : "text-pink-200/70 hover:text-white hover:bg-white/10"
                }`}
                title="Select Love-Letter Swarm Animation"
              >
                <span>💌 Letters</span>
              </button>
            </div>

            {/* Persistent Indicator & Audio Replay Action */}
            <div className="flex items-center justify-between w-full pt-1 border-t border-pink-500/20 text-[11px] gap-2">
              <div className="flex items-center gap-1.5 text-pink-300/80 font-mono text-[10px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                <span>Single Kiss • One-Shot</span>
              </div>

              {onPlaySound && (
                <button
                  type="button"
                  onClick={onPlaySound}
                  title="Hear kissing sound again"
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 hover:bg-rose-500/40 text-pink-200 text-[10px] font-semibold transition-all border border-pink-400/30"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>Mwah 💋</span>
                </button>
              )}
            </div>

            {/* Voice Command Hint */}
            <div className="text-[10px] text-pink-300/60 font-mono text-center tracking-tight">
              Voice command: <span className="text-pink-200 font-bold">&quot;Give me one kiss&quot;</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KissOverlay;
