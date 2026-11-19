import React, { useEffect, useRef, useState } from "react";
import { 
  Volume2, 
  VolumeX, 
  Sparkles, 
  X, 
  CloudRain, 
  Music, 
  Radio, 
  Waves, 
  Coffee, 
  Trees, 
  Wind,
  Timer,
  Play,
  CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SoundscapeType } from "../types";
export type { SoundscapeType };

interface SoundscapePlayerProps {
  currentType: SoundscapeType;
  onChangeType: (type: SoundscapeType) => void;
  isOpen: boolean;
  onClose: () => void;
  onStartTimer?: (durationSeconds: number, label: string) => void;
}

export default function SoundscapePlayer({
  currentType,
  onChangeType,
  isOpen,
  onClose,
  onStartTimer
}: SoundscapePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [activeStudyDuration, setActiveStudyDuration] = useState<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeNodesRef = useRef<any[]>([]);

  // Stop active web audio nodes
  const stopSoundscape = () => {
    activeNodesRef.current.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    activeNodesRef.current = [];
  };

  // Soundscape audio generators using Web Audio API
  const startSoundscape = (type: SoundscapeType) => {
    stopSoundscape();
    if (type === "off") {
      setIsPlaying(false);
      return;
    }

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(volume, ctx.currentTime);
      masterGain.connect(ctx.destination);
      activeNodesRef.current.push(masterGain);

      if (type === "rain") {
        // Pink noise generator for realistic rain
        const bufferSize = ctx.sampleRate * 3;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          output[i] *= 0.11;
          b6 = white * 0.115926;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1000, ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(masterGain);
        whiteNoise.start();

        activeNodesRef.current.push(whiteNoise, filter);
      } else if (type === "binaural") {
        // 40Hz Gamma / 14Hz Alpha Binaural Study Frequencies (200Hz left, 214Hz right)
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        const merger = ctx.createChannelMerger(2);

        oscL.frequency.setValueAtTime(200, ctx.currentTime);
        oscR.frequency.setValueAtTime(214, ctx.currentTime);

        const gainL = ctx.createGain();
        const gainR = ctx.createGain();
        gainL.gain.setValueAtTime(0.2, ctx.currentTime);
        gainR.gain.setValueAtTime(0.2, ctx.currentTime);

        oscL.connect(gainL);
        gainL.connect(merger, 0, 0);

        oscR.connect(gainR);
        gainR.connect(merger, 0, 1);

        merger.connect(masterGain);
        oscL.start();
        oscR.start();

        activeNodesRef.current.push(oscL, oscR, gainL, gainR, merger);
      } else if (type === "lofi") {
        // Soft ambient chord synth (Cmaj7 / Am9 chill drone)
        const freqs = [130.81, 164.81, 196.00, 246.94]; // C3, E3, G3, B3
        freqs.forEach(f => {
          const osc = ctx.createOscillator();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(f, ctx.currentTime);

          const lfo = ctx.createOscillator();
          lfo.frequency.setValueAtTime(0.2, ctx.currentTime);
          const lfoGain = ctx.createGain();
          lfoGain.gain.setValueAtTime(1.5, ctx.currentTime);
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          lfo.start();

          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(600, ctx.currentTime);

          const oscGain = ctx.createGain();
          oscGain.gain.setValueAtTime(0.08, ctx.currentTime);

          osc.connect(filter);
          filter.connect(oscGain);
          oscGain.connect(masterGain);
          osc.start();

          activeNodesRef.current.push(osc, lfo, lfoGain, filter, oscGain);
        });
      } else if (type === "ocean") {
        // Ocean waves with modulated lowpass filter
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";

        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(0.1, ctx.currentTime);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(300, ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        filter.frequency.setValueAtTime(400, ctx.currentTime);

        noiseSource.connect(filter);
        filter.connect(masterGain);

        noiseSource.start();
        lfo.start();

        activeNodesRef.current.push(noiseSource, filter, lfo, lfoGain);
      } else if (type === "cafe") {
        // Warm cafe ambient noise
        const freqs = [180, 320, 520, 800];
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f + (idx * 15), ctx.currentTime);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.03, ctx.currentTime);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start();
          activeNodesRef.current.push(osc, gain);
        });
      } else if (type === "nature") {
        // Gentle wind & forest ambient chirp harmonics
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = (Math.random() * 2 - 1) * 0.15;
        }
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(850, ctx.currentTime);
        filter.Q.setValueAtTime(3.0, ctx.currentTime);

        noiseSource.connect(filter);
        filter.connect(masterGain);
        noiseSource.start();
        activeNodesRef.current.push(noiseSource, filter);
      } else if (type === "whitenoise") {
        // Clean white noise for deep focus
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = (Math.random() * 2 - 1) * 0.08;
        }
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;
        noiseSource.connect(masterGain);
        noiseSource.start();
        activeNodesRef.current.push(noiseSource);
      }

      setIsPlaying(true);
    } catch (err) {
      console.error("Failed to start soundscape audio:", err);
    }
  };

  useEffect(() => {
    if (currentType !== "off") {
      startSoundscape(currentType);
    } else {
      stopSoundscape();
      setIsPlaying(false);
    }
    return () => {
      stopSoundscape();
    };
  }, [currentType]);

  useEffect(() => {
    if (activeNodesRef.current.length > 0) {
      const masterGain = activeNodesRef.current[0];
      if (masterGain && masterGain.gain && audioCtxRef.current) {
        masterGain.gain.setValueAtTime(volume, audioCtxRef.current.currentTime);
      }
    }
  }, [volume]);

  const handleStartStudySession = (mins: number, sound: SoundscapeType) => {
    setActiveStudyDuration(mins);
    onChangeType(sound);
    if (onStartTimer) {
      onStartTimer(mins * 60, `${mins} Min Focus Session`);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="soundscape-player-panel"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-24 right-6 z-40 w-80 rounded-3xl bg-[#0d0f18]/95 backdrop-blur-xl border border-cyan-500/30 text-white p-5 shadow-[0_10px_40px_rgba(6,182,212,0.2)] space-y-4"
        >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-cyan-300 block">
                Focus & Study Mode
              </span>
              <span className="text-[10px] text-slate-400">Ambient audio & study timer</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Study Mode Sessions Quick Launcher */}
        <div className="space-y-1.5 bg-white/[0.02] p-3 rounded-2xl border border-white/5">
          <span className="text-[10px] font-mono uppercase text-amber-400 font-bold flex items-center gap-1">
            <Timer size={12} /> Launch Study Session
          </span>
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <button
              onClick={() => handleStartStudySession(25, "rain")}
              className={`py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all border ${
                activeStudyDuration === 25 ? "bg-amber-500 text-black border-amber-400" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
              }`}
            >
              25m Pomodoro
            </button>
            <button
              onClick={() => handleStartStudySession(45, "binaural")}
              className={`py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all border ${
                activeStudyDuration === 45 ? "bg-amber-500 text-black border-amber-400" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
              }`}
            >
              45m Deep
            </button>
            <button
              onClick={() => handleStartStudySession(60, "lofi")}
              className={`py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all border ${
                activeStudyDuration === 60 ? "bg-amber-500 text-black border-amber-400" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
              }`}
            >
              60m Master
            </button>
          </div>
        </div>

        {/* Soundscape Options */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">
            Select Ambience
          </span>
          <div className="grid grid-cols-4 gap-1.5 text-[10px]">
            {[
              { id: "rain", label: "Rain", icon: CloudRain },
              { id: "lofi", label: "Lo-Fi", icon: Music },
              { id: "binaural", label: "Binaural", icon: Radio },
              { id: "ocean", label: "Ocean", icon: Waves },
              { id: "cafe", label: "Café", icon: Coffee },
              { id: "nature", label: "Nature", icon: Trees },
              { id: "whitenoise", label: "White", icon: Wind },
              { id: "off", label: "Mute", icon: VolumeX }
            ].map((item, idx) => {
              const Icon = item.icon;
              const active = currentType === item.id;
              return (
                <button
                  key={`soundscape-${item.id}-${idx}`}
                  onClick={() => {
                    onChangeType(item.id as SoundscapeType);
                  }}
                  className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 font-medium transition border ${
                    active
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm"
                      : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Volume Slider */}
        {currentType !== "off" && (
          <div className="flex items-center gap-2 pt-1 border-t border-white/5">
            <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 rounded bg-white/10 cursor-pointer"
            />
            <span className="text-[10px] font-mono text-cyan-300 w-8 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>
        )}
      </motion.div>
      )}
    </AnimatePresence>
  );
}
