import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AvatarVocalEmotion } from "../types";

interface CinematicEmotionFXProps {
  emotion: AvatarVocalEmotion;
  intensity: number;
  isSpeaking: boolean;
  isListening: boolean;
  audioEnergy: number;
  isKissing?: boolean;
}

export default function CinematicEmotionFX({
  emotion,
  intensity,
  isSpeaking,
  isListening,
  audioEnergy,
  isKissing = false,
}: CinematicEmotionFXProps) {
  const [heartParticles, setHeartParticles] = useState<Array<{ id: number; x: number }>>([]);

  // Floating heart particles during praise, affection, or kiss
  useEffect(() => {
    if (emotion === "happy" || emotion === "flattered" || isKissing) {
      const interval = setInterval(() => {
        setHeartParticles((prev) => [
          ...prev.slice(-8),
          {
            id: Date.now() + Math.random(),
            x: 20 + Math.random() * 60,
          },
        ]);
      }, 450);
      return () => clearInterval(interval);
    } else {
      setHeartParticles([]);
    }
  }, [emotion, isKissing]);

  const isShocked = emotion === "shocked";
  const isHappy = emotion === "happy" || emotion === "flattered";
  const isIntimate = emotion === "intimate";

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-20">
      {/* 1. Acoustic Shock / Fear Electric Flash & Shockwave */}
      <AnimatePresence>
        {isShocked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{
              opacity: [0.85, 0.25, 0.9, 0.15, 0],
              scale: [0.98, 1.03, 0.99, 1.02, 1],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="absolute inset-0 border-4 border-amber-400 rounded-2xl shadow-[inset_0_0_80px_rgba(251,191,36,0.65)] bg-amber-500/10 backdrop-contrast-125"
          />
        )}
      </AnimatePresence>

      {/* 2. Floating Heart Sparks on Praise & Flattery */}
      <AnimatePresence>
        {heartParticles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 0, x: `${p.x}%`, scale: 0.4 }}
            animate={{
              opacity: [0, 1, 0.9, 0],
              y: -140,
              scale: [0.4, 1.25, 1],
              rotate: [0, (Math.random() - 0.5) * 35],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.4, ease: "easeOut" }}
            className="absolute text-2xl text-rose-400 filter drop-shadow-[0_0_12px_rgba(244,63,94,0.9)]"
            style={{ bottom: "20%" }}
          >
            💖
          </motion.div>
        ))}
      </AnimatePresence>

      {/* 3. Rosy Peach Bloom Tint on Happiness & Praise */}
      <AnimatePresence>
        {isHappy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 * intensity }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 bg-gradient-to-t from-rose-500/30 via-pink-400/15 to-amber-300/10 pointer-events-none mix-blend-screen"
          />
        )}
      </AnimatePresence>

      {/* 4. Intimate Twilight Bloom on Whisper */}
      <AnimatePresence>
        {isIntimate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 bg-gradient-to-t from-purple-900/40 via-violet-600/10 to-transparent pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* 5. Live Audio-Reactive Frequency Waveform Bar on Speaking */}
      {isSpeaking && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-black/60 border border-cyan-400/40 backdrop-blur-md z-30">
          <span className="text-[10px] font-mono text-cyan-300 uppercase tracking-wider mr-1">
            Voice Sync
          </span>
          {[0.4, 0.8, 1.2, 0.6, 1.4, 0.9, 0.5].map((factor, i) => (
            <motion.span
              key={i}
              animate={{
                height: Math.max(4, Math.min(22, 5 + audioEnergy * 35 * factor)),
              }}
              transition={{ duration: 0.08 }}
              className="w-1 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]"
            />
          ))}
        </div>
      )}

      {/* 6. Listening Audio Waveform Bar */}
      {isListening && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-black/60 border border-orange-500/40 backdrop-blur-md z-30">
          <span className="text-[10px] font-mono text-orange-300 uppercase tracking-wider mr-1">
            Listening
          </span>
          {[0.5, 1.0, 1.5, 0.7, 1.3].map((factor, i) => (
            <motion.span
              key={i}
              animate={{
                height: Math.max(3, Math.min(18, 4 + audioEnergy * 30 * factor)),
              }}
              transition={{ duration: 0.08 }}
              className="w-1 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.8)]"
            />
          ))}
        </div>
      )}
    </div>
  );
}
