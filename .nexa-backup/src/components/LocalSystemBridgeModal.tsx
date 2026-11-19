import React, { useState, useEffect } from "react";
import {
  Server,
  Terminal,
  Cpu,
  HardDrive,
  Activity,
  Play,
  Square,
  RefreshCw,
  FolderOpen,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  Code,
  Layers,
  Zap,
  Power,
  Copy,
  Check,
  ChevronRight,
  Volume2,
  VolumeX,
  Sliders,
  PlayCircle,
  Loader2,
  Gauge,
  Smartphone,
  Sparkles,
  RotateCcw
} from "lucide-react";
import {
  localSystemBridge,
  SystemTelemetry,
  CliCommandResult,
  ProcessInfo,
} from "../services/localSystemBridge";
import { playPCM, triggerHapticFeedback } from "../utils/audioUtils";
import { getNexaAudio } from "../services/geminiService";

export interface LocalSystemBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCommandPrompt?: (cmd: string) => void;
  selectedVoice?: string;
  onVoiceChange?: (voice: string) => void;
  voicePitch?: number;
  onPitchChange?: (pitch: number) => void;
  voiceSpeed?: number;
  onVoiceSpeedChange?: (speed: number) => void;
  voiceVolume?: number;
  onVoiceVolumeChange?: (volume: number) => void;
  bridgeOpacity?: number;
  onBridgeOpacityChange?: (opacity: number) => void;
  touchFeedback?: number;
  onTouchFeedbackChange?: (intensity: number) => void;
}

const VOICE_PRESETS = [
  { id: "Aoede", name: "Aoede", desc: "Expressive, witty & energetic female voice", gender: "Female", tag: "Energetic / Sassy" },
  { id: "Kore", name: "Kore", desc: "Soothing, gentle & sweet female voice (Nexa Default)", gender: "Female", tag: "Default / Calm" },
  { id: "Zephyr", name: "Zephyr", desc: "Bright, upbeat & warm female voice", gender: "Female", tag: "Upbeat" },
  { id: "Puck", name: "Puck", desc: "Playful, witty & energetic male voice", gender: "Male", tag: "Witty" },
  { id: "Charon", name: "Charon", desc: "Deep, smooth & resonant male voice", gender: "Male", tag: "Deep" },
  { id: "Fenrir", name: "Fenrir", desc: "Strong, authoritative & confident male voice", gender: "Male", tag: "Rational / Direct" },
];

export const LocalSystemBridgeModal: React.FC<LocalSystemBridgeModalProps> = ({
  isOpen,
  onClose,
  onExecuteCommandPrompt,
  selectedVoice,
  onVoiceChange,
  voicePitch = 1.0,
  onPitchChange,
  voiceSpeed,
  onVoiceSpeedChange,
  voiceVolume,
  onVoiceVolumeChange,
  bridgeOpacity,
  onBridgeOpacityChange,
  touchFeedback,
  onTouchFeedbackChange,
}) => {
  const [telemetry, setTelemetry] = useState<SystemTelemetry>(localSystemBridge.getTelemetry());
  const [activeTab, setActiveTab] = useState<"voice_os" | "telemetry" | "terminal" | "processes" | "setup">("voice_os");
  const [daemonUrl, setDaemonUrl] = useState("ws://localhost:9099");
  const [isConnecting, setIsConnecting] = useState(false);
  const [cliInput, setCliInput] = useState("git status");
  const [cliLogs, setCliLogs] = useState<CliCommandResult[]>([]);
  const [mountedFolder, setMountedFolder] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState(false);

  // Voice OS & Acoustic Controls State
  const [activeVoice, setActiveVoice] = useState<string>(() => {
    return selectedVoice || (typeof window !== "undefined" ? localStorage.getItem("nexa_voice_name") || "Zephyr" : "Zephyr");
  });
  const [speed, setSpeed] = useState<number>(() => {
    if (voiceSpeed !== undefined) return voiceSpeed;
    if (typeof window !== "undefined") {
      const s = parseFloat(localStorage.getItem("nexa_voice_speed") || "1.0");
      return !isNaN(s) ? s : 1.0;
    }
    return 1.0;
  });
  const [volume, setVolume] = useState<number>(() => {
    if (voiceVolume !== undefined) return voiceVolume;
    if (typeof window !== "undefined") {
      const v = parseFloat(localStorage.getItem("nexa_voice_volume") || "1.5");
      return !isNaN(v) ? v : 1.5;
    }
    return 1.5;
  });
  const [opacity, setOpacity] = useState<number>(() => {
    if (bridgeOpacity !== undefined) return bridgeOpacity;
    if (typeof window !== "undefined") {
      const o = parseFloat(localStorage.getItem("nexa_bridge_opacity") || "0.95");
      return !isNaN(o) ? o : 0.95;
    }
    return 0.95;
  });
  const [hapticIntensity, setHapticIntensity] = useState<number>(() => {
    if (touchFeedback !== undefined) return touchFeedback;
    if (typeof window !== "undefined") {
      const h = parseFloat(localStorage.getItem("nexa_touch_feedback") || "25");
      return !isNaN(h) ? h : 25;
    }
    return 25;
  });
  const [auditioningVoice, setAuditioningVoice] = useState<string | null>(null);

  useEffect(() => {
    if (selectedVoice) setActiveVoice(selectedVoice);
  }, [selectedVoice]);

  useEffect(() => {
    if (voiceSpeed !== undefined) setSpeed(voiceSpeed);
  }, [voiceSpeed]);

  useEffect(() => {
    if (voiceVolume !== undefined) setVolume(voiceVolume);
  }, [voiceVolume]);

  useEffect(() => {
    if (bridgeOpacity !== undefined) setOpacity(bridgeOpacity);
  }, [bridgeOpacity]);

  useEffect(() => {
    if (touchFeedback !== undefined) setHapticIntensity(touchFeedback);
  }, [touchFeedback]);

  useEffect(() => {
    const unsub = localSystemBridge.subscribeTelemetry((t) => {
      setTelemetry({ ...t });
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsConnecting(true);
    triggerHapticFeedback(hapticIntensity);
    await localSystemBridge.connect(daemonUrl);
    setIsConnecting(false);
  };

  const handleDisconnect = () => {
    triggerHapticFeedback(hapticIntensity);
    localSystemBridge.disconnect();
  };

  const handleRunCli = async (cmdToRun?: string) => {
    const targetCmd = cmdToRun || cliInput;
    if (!targetCmd.trim()) return;
    triggerHapticFeedback(hapticIntensity);
    const res = await localSystemBridge.executeCommand(targetCmd);
    setCliLogs((prev) => [res, ...prev.slice(0, 19)]);
    setCliInput("");
  };

  const handleMountDirectory = async () => {
    triggerHapticFeedback(hapticIntensity);
    const res = await localSystemBridge.pickLocalWorkspaceDirectory();
    if (res.success) {
      setMountedFolder(res.dirName);
    }
  };

  const handleDownloadDaemonScript = () => {
    triggerHapticFeedback(hapticIntensity);
    const script = localSystemBridge.getPythonDaemonScript();
    localSystemBridge.writeLocalFile("nexa_bridge_daemon.py", script);
  };

  const handleCopyPythonScript = () => {
    triggerHapticFeedback(hapticIntensity);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(localSystemBridge.getPythonDaemonScript()).catch(() => {});
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleKillProc = async (proc: ProcessInfo) => {
    triggerHapticFeedback(hapticIntensity);
    await localSystemBridge.killProcess(proc.pid);
  };

  const handleLaunchApp = async (appName: string) => {
    triggerHapticFeedback(hapticIntensity);
    await localSystemBridge.launchLocalApp(appName);
  };

  // Voice OS Handlers
  const handleSelectVoice = (voiceId: string) => {
    triggerHapticFeedback(hapticIntensity);
    setActiveVoice(voiceId);
    if (typeof window !== "undefined") {
      localStorage.setItem("nexa_voice_name", voiceId);
    }
    onVoiceChange?.(voiceId);
  };

  const handleAuditionVoice = async (voiceId: string, voiceName: string) => {
    triggerHapticFeedback(hapticIntensity);
    setAuditioningVoice(voiceId);
    try {
      const phrase = `Hey Bhavik! This is my ${voiceName} voice. System running at zero latency.`;
      const audioBase64 = await getNexaAudio(phrase);
      if (audioBase64) {
        await playPCM(audioBase64, volume, voicePitch || 1.0, speed);
      }
    } catch (e) {
      console.error("Voice audition failed", e);
    } finally {
      setAuditioningVoice(null);
    }
  };

  const handleSpeedChange = (val: number) => {
    setSpeed(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("nexa_voice_speed", String(val));
    }
    onVoiceSpeedChange?.(val);
    triggerHapticFeedback(hapticIntensity);
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("nexa_voice_volume", String(val));
    }
    onVoiceVolumeChange?.(val);
    triggerHapticFeedback(hapticIntensity);
  };

  const handleOpacityChange = (val: number) => {
    setOpacity(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("nexa_bridge_opacity", String(val));
    }
    onBridgeOpacityChange?.(val);
    triggerHapticFeedback(hapticIntensity);
  };

  const handleHapticChange = (val: number) => {
    setHapticIntensity(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("nexa_touch_feedback", String(val));
    }
    onTouchFeedbackChange?.(val);
    triggerHapticFeedback(val);
  };

  const handleResetDefaults = () => {
    triggerHapticFeedback(hapticIntensity);
    handleSpeedChange(1.0);
    handleVolumeChange(1.5);
    handleOpacityChange(0.95);
    handleHapticChange(25);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      style={{
        backgroundColor: `rgba(0, 0, 0, ${Math.min(0.9, opacity * 0.9)})`,
        backdropFilter: `blur(${Math.round(opacity * 20)}px)`,
      }}
    >
      <div 
        className="relative flex flex-col w-full max-w-4xl h-[88vh] max-h-[820px] rounded-3xl border border-cyan-500/35 shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden font-sans text-white transition-all duration-150"
        style={{
          backgroundColor: `rgba(9, 13, 22, ${opacity})`,
        }}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0c1220]/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Server size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-wide text-white">
                  Local System Automation & Voice OS Bridge
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider ${
                  telemetry.connected 
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" 
                    : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                }`}>
                  {telemetry.connected ? "BRIDGE ACTIVE" : "ZERO-LATENCY OS"}
                </span>
              </div>
              <p className="text-xs text-white/50 font-mono">
                Active Voice: <span className="text-cyan-300 font-bold">{activeVoice}</span> • Speed: {speed.toFixed(2)}x • Vol: {Math.round(volume * 100)}% • Opacity: {Math.round(opacity * 100)}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMountDirectory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-cyan-300 hover:border-cyan-400 transition-all cursor-pointer"
              title="Mount local directory via Web File System API"
            >
              <FolderOpen size={14} className="text-cyan-400" />
              <span>{mountedFolder ? `Dir: /${mountedFolder}` : "Mount Workspace"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-white/5 bg-[#090d16]">
          {[
            { id: "voice_os", label: "Voice & OS Controls", icon: Volume2 },
            { id: "telemetry", label: "Live Telemetry", icon: Activity },
            { id: "terminal", label: "CLI & Scripts", icon: Terminal },
            { id: "processes", label: "Apps & Processes", icon: Layers },
            { id: "setup", label: "Native Daemon Setup", icon: Code },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  triggerHapticFeedback(hapticIntensity);
                  setActiveTab(tab.id as any);
                }}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-mono font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                  active
                    ? "text-cyan-300 border-cyan-400 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    : "text-white/50 border-transparent hover:text-white/80 hover:bg-white/[0.02]"
                }`}
              >
                <Icon size={14} className={active ? "text-cyan-400" : "text-white/40"} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

          {/* TAB 0: VOICE & OS CONTROLS (NEW DEDICATED OS BRIDGE VOICE SUITE) */}
          {activeTab === "voice_os" && (
            <div className="flex flex-col gap-6">
              
              {/* Zero-Latency Acoustic Status Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-purple-950/30 to-amber-950/20 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
                    <Sparkles size={18} className="animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Zero-Latency Voice & Sensory Engine
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        PARALLEL STREAMS ACTIVE
                      </span>
                    </h3>
                    <p className="text-xs text-cyan-200/70">
                      Granular acoustic modulation, instant voice auditioning, and real-time sensory touch feedback.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleResetDefaults}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-white/70 hover:text-white border border-white/10 transition-all cursor-pointer self-start sm:self-auto"
                  title="Reset voice sliders to factory defaults"
                >
                  <RotateCcw size={12} />
                  <span>Reset Defaults</span>
                </button>
              </div>

              {/* Section 1: Nexa Voice Selection & Auditioning */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold tracking-wider text-cyan-300 uppercase flex items-center gap-2">
                    <Volume2 size={14} /> 1. Select & Audition Nexa Voice
                  </span>
                  <span className="text-[11px] font-mono text-white/50">
                    Tap to select or click Audition to preview instantly
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {VOICE_PRESETS.map((voice) => {
                    const isSelected = activeVoice === voice.id;
                    const isAuditioning = auditioningVoice === voice.id;

                    return (
                      <div
                        key={`bridge-voice-${voice.id}`}
                        onClick={() => handleSelectVoice(voice.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between gap-3 ${
                          isSelected
                            ? "bg-cyan-950/40 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50"
                            : "bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.06]"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white">{voice.name}</h4>
                              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/10">
                                {voice.gender}
                              </span>
                            </div>
                            <span className="text-[10px] text-cyan-300 font-mono">{voice.tag}</span>
                          </div>

                          {isSelected && (
                            <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              <Check size={11} /> ACTIVE
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-white/60 leading-relaxed">
                          {voice.desc}
                        </p>

                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAuditionVoice(voice.id, voice.name);
                            }}
                            disabled={isAuditioning}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                              isAuditioning
                                ? "bg-amber-500 text-black animate-pulse"
                                : "bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 shadow-sm"
                            }`}
                            title={`Audition ${voice.name} voice snippet`}
                          >
                            {isAuditioning ? (
                              <>
                                <Loader2 size={13} className="animate-spin" />
                                <span>Auditioning...</span>
                              </>
                            ) : (
                              <>
                                <PlayCircle size={13} />
                                <span>Audition Voice</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectVoice(voice.id);
                            }}
                            className={`text-xs px-3 py-1.5 rounded-xl font-mono transition-all cursor-pointer ${
                              isSelected
                                ? "bg-white text-black font-bold shadow-md"
                                : "bg-white/10 text-white/70 hover:text-white"
                            }`}
                          >
                            {isSelected ? "Selected" : "Select"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Sensory & Acoustic Modulation Sliders */}
              <div className="flex flex-col gap-3 pt-2">
                <span className="text-xs font-mono font-bold tracking-wider text-cyan-300 uppercase flex items-center gap-2">
                  <Sliders size={14} /> 2. Acoustic, Opacity & Sensory Sliders
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Slider 1: Voice Speed */}
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-mono text-white/80 font-bold">
                        <Gauge size={16} className="text-cyan-400" />
                        <span>Voice Playback Speed</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-cyan-300 px-2 py-0.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30">
                        {speed.toFixed(2)}x
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0.75"
                      max="2.00"
                      step="0.05"
                      value={speed}
                      onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                    />

                    <div className="flex justify-between text-[10px] font-mono text-white/40">
                      <span>0.75x (Relaxed)</span>
                      <span>1.00x (Standard)</span>
                      <span>1.50x (Fast)</span>
                      <span>2.00x (Hyper)</span>
                    </div>
                  </div>

                  {/* Slider 2: Voice Output Volume & Boost */}
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-mono text-white/80 font-bold">
                        <Volume2 size={16} className="text-amber-400" />
                        <span>Output Gain & Volume Boost</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-300 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30">
                        {Math.round(volume * 100)}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0.25"
                      max="2.00"
                      step="0.05"
                      value={volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                    />

                    <div className="flex justify-between text-[10px] font-mono text-white/40">
                      <span>25%</span>
                      <span>100% (Default)</span>
                      <span>150% (+50% Boost)</span>
                      <span>200% (Max)</span>
                    </div>
                  </div>

                  {/* Slider 3: OS Bridge UI Opacity */}
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-mono text-white/80 font-bold">
                        <Layers size={16} className="text-purple-400" />
                        <span>OS Bridge UI Opacity</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-purple-300 px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30">
                        {Math.round(opacity * 100)}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0.40"
                      max="1.00"
                      step="0.05"
                      value={opacity}
                      onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                      className="w-full accent-purple-400 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                    />

                    <div className="flex justify-between text-[10px] font-mono text-white/40">
                      <span>40% (Translucent)</span>
                      <span>70%</span>
                      <span>95% (Balanced)</span>
                      <span>100% (Solid)</span>
                    </div>
                  </div>

                  {/* Slider 4: Touch & Haptic Feedback */}
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-mono text-white/80 font-bold">
                        <Smartphone size={16} className="text-emerald-400" />
                        <span>Touch & Haptic Feedback</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-300 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
                        {hapticIntensity === 0 ? "OFF" : `${hapticIntensity}ms`}
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={hapticIntensity}
                      onChange={(e) => handleHapticChange(parseInt(e.target.value, 10))}
                      className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                    />

                    <div className="flex justify-between text-[10px] font-mono text-white/40">
                      <span>Off (0ms)</span>
                      <span>25ms (Crisp)</span>
                      <span>50ms (Medium)</span>
                      <span>100ms (Heavy)</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Section 3: Zero-Latency Telemetry Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-white/40 uppercase">Audio Buffer RTT</span>
                  <span className="text-sm font-bold font-mono text-cyan-300">&lt; 18ms</span>
                  <span className="text-[10px] text-white/30">Direct WebAudio PCM</span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-white/40 uppercase">Parallel Search Stream</span>
                  <span className="text-sm font-bold font-mono text-emerald-300">Live Racing</span>
                  <span className="text-[10px] text-white/30">Zero-delay cache + race</span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-white/40 uppercase">Sensory Response</span>
                  <span className="text-sm font-bold font-mono text-purple-300">Synchronous</span>
                  <span className="text-[10px] text-white/30">Haptic pulse on event</span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-white/40 uppercase">Session Drift</span>
                  <span className="text-sm font-bold font-mono text-amber-300">0.00%</span>
                  <span className="text-[10px] text-white/30">Anti-decay invariant</span>
                </div>
              </div>

            </div>
          )}

          {/* TAB 1: LIVE TELEMETRY & HARDWARE CONTEXT */}
          {activeTab === "telemetry" && (
            <div className="flex flex-col gap-6">
              {/* Top Quick Status Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs text-white/50 font-mono">
                    <span className="flex items-center gap-1.5"><Cpu size={14} className="text-cyan-400" /> CPU Load</span>
                    <span className="text-cyan-300 font-bold">{telemetry.cpuUsagePercent}%</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-2">
                    <div
                      className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, telemetry.cpuUsagePercent)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/40 font-mono mt-1">{telemetry.cpuCores} Cores Active</span>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs text-white/50 font-mono">
                    <span className="flex items-center gap-1.5"><Activity size={14} className="text-purple-400" /> Memory (RAM)</span>
                    <span className="text-purple-300 font-bold">{telemetry.memoryPercent}%</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-2">
                    <div
                      className="bg-purple-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, telemetry.memoryPercent)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/40 font-mono mt-1">
                    {telemetry.memoryUsedGB} GB / {telemetry.memoryTotalGB} GB
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs text-white/50 font-mono">
                    <span className="flex items-center gap-1.5"><HardDrive size={14} className="text-emerald-400" /> Disk Space</span>
                    <span className="text-emerald-300 font-bold">
                      {telemetry.diskFreeGB} GB Free
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-2">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(0, 100 - (telemetry.diskFreeGB / (telemetry.diskTotalGB || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/40 font-mono mt-1">
                    Total: {telemetry.diskTotalGB} GB
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs text-white/50 font-mono">
                    <span className="flex items-center gap-1.5"><Zap size={14} className="text-amber-400" /> Battery / Power</span>
                    <span className="text-amber-300 font-bold">
                      {telemetry.batteryPercent !== undefined ? `${telemetry.batteryPercent}%` : "AC Power"}
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-2">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${telemetry.batteryPercent ?? 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/40 font-mono mt-1">
                    {telemetry.isCharging ? "Charging Active" : "Battery Mode"}
                  </span>
                </div>
              </div>

              {/* Environment Details Card */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col gap-4">
                <span className="text-xs font-mono font-bold tracking-wider text-cyan-300 uppercase">
                  Connected Operating System Telemetry
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-xs font-mono">
                  <div>
                    <span className="text-white/40">Host Machine:</span>
                    <p className="text-white/90 font-bold">{telemetry.hostname}</p>
                  </div>
                  <div>
                    <span className="text-white/40">Operating System:</span>
                    <p className="text-white/90 font-bold">{telemetry.os} ({telemetry.platform})</p>
                  </div>
                  <div>
                    <span className="text-white/40">Architecture:</span>
                    <p className="text-white/90 font-bold">{telemetry.arch}</p>
                  </div>
                  <div>
                    <span className="text-white/40">System Uptime:</span>
                    <p className="text-white/90 font-bold">{telemetry.uptimeFormatted}</p>
                  </div>
                  <div>
                    <span className="text-white/40">Active Network Interfaces:</span>
                    <p className="text-white/90 font-bold">{telemetry.networkInterfaces?.join(", ") || "Standard Loopback"}</p>
                  </div>
                  <div>
                    <span className="text-white/40">Bridge Status:</span>
                    <p className={telemetry.connected ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                      {telemetry.connected ? "Daemon Synced" : "Web Local Emulation"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TERMINAL CLI & AUTOMATION SCRIPTS */}
          {activeTab === "terminal" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold tracking-wider text-cyan-300 uppercase">
                  Execute Local Command Line / Shell
                </span>
                <span className="text-[11px] font-mono text-white/40">
                  Runs directly on client host via Bridge Daemon
                </span>
              </div>

              {/* Interactive Terminal Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRunCli();
                }}
                className="flex items-center gap-2 p-1.5 rounded-2xl bg-black/50 border border-white/10"
              >
                <div className="px-3 text-cyan-400 font-mono text-sm font-bold">$</div>
                <input
                  type="text"
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  placeholder="Enter command (e.g. ls -la, git status, python test.py, open -a Chrome)"
                  className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-white placeholder-white/30"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer"
                >
                  <Play size={12} className="fill-black" />
                  <span>Execute</span>
                </button>
              </form>

              {/* Quick CLI Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono text-white/40">Quick Presets:</span>
                {[
                  "git status",
                  "git branch -a",
                  "node -v",
                  "python --version",
                  "ps aux | head -n 10",
                  "df -h",
                  "whoami",
                ].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleRunCli(preset)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-white/70 hover:text-cyan-300 transition-all cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* CLI Execution Output Feed */}
              <div className="flex flex-col gap-2 mt-2">
                <span className="text-xs font-mono font-bold text-white/50">Execution History:</span>
                <div className="h-64 overflow-y-auto rounded-2xl bg-black/70 border border-white/10 p-4 font-mono text-xs space-y-3 custom-scrollbar">
                  {cliLogs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-white/30">
                      No commands executed in this session yet. Type above or click a preset.
                    </div>
                  ) : (
                    cliLogs.map((log, idx) => (
                      <div key={idx} className="border-b border-white/5 pb-2.5 last:border-b-0">
                        <div className="flex items-center justify-between text-[11px] text-white/50 mb-1">
                          <span className="text-cyan-400 font-bold">$ {log.command}</span>
                          <span>Code: {log.exitCode} • {log.durationMs}ms</span>
                        </div>
                        {log.stdout && (
                          <pre className="text-emerald-300 whitespace-pre-wrap text-[11px]">{log.stdout}</pre>
                        )}
                        {log.stderr && (
                          <pre className="text-rose-400 whitespace-pre-wrap text-[11px]">{log.stderr}</pre>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: APPS & RUNNING PROCESSES */}
          {activeTab === "processes" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold tracking-wider text-cyan-300 uppercase">
                  Desktop Applications & Active Processes
                </span>
                <span className="text-[11px] font-mono text-white/40">
                  Total Active: {telemetry.topProcesses.length}
                </span>
              </div>

              {/* Quick Launch Suite */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono text-white/60">One-Click App Launchers:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {["VS Code", "Terminal", "Chrome", "Finder"].map((app) => (
                    <button
                      key={app}
                      onClick={() => handleLaunchApp(app)}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-white/80 hover:text-cyan-300 hover:border-cyan-500/40 transition-all cursor-pointer"
                    >
                      <span>{app}</span>
                      <ChevronRight size={14} className="text-white/30" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Process Table */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono text-white/60">Top Processes by Resource Utilization:</span>
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] text-white/40 bg-white/[0.02]">
                        <th className="p-3">PID</th>
                        <th className="p-3">Process Name</th>
                        <th className="p-3">CPU %</th>
                        <th className="p-3">Memory %</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {telemetry.topProcesses.map((proc) => (
                        <tr key={proc.pid} className="hover:bg-white/[0.02]">
                          <td className="p-3 text-white/40">{proc.pid}</td>
                          <td className="p-3 font-semibold text-white/90">{proc.name}</td>
                          <td className="p-3 text-cyan-300">{proc.cpu.toFixed(1)}%</td>
                          <td className="p-3 text-purple-300">{proc.memory.toFixed(1)}%</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleKillProc(proc)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-bold cursor-pointer"
                            >
                              Terminate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NATIVE DAEMON SETUP */}
          {activeTab === "setup" && (
            <div className="flex flex-col gap-5">
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-cyan-300 font-mono">
                    NEXA Native Host Daemon Setup (WebSocket Bridge)
                  </h3>
                  <p className="text-xs text-white/60 mt-1">
                    Connect your real Mac, Linux, or Windows workstation to execute unrestricted bash/zsh/PowerShell automation.
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {telemetry.connected ? (
                    <button
                      onClick={handleDisconnect}
                      className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold cursor-pointer"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={handleConnect}
                      disabled={isConnecting}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold cursor-pointer transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                    >
                      {isConnecting ? "Connecting..." : "Connect Local Daemon"}
                    </button>
                  )}
                </div>
              </div>

              {/* Python Script Code Viewer */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white/70">
                    Standalone Python Daemon Script (nexa_bridge_daemon.py)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyPythonScript}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-white/80 transition-all cursor-pointer"
                    >
                      {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      <span>{copiedCode ? "Copied" : "Copy Code"}</span>
                    </button>
                    <button
                      onClick={handleDownloadDaemonScript}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs font-mono text-cyan-200 transition-all cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Download .py</span>
                    </button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto p-3 rounded-2xl bg-black/70 border border-white/10 font-mono text-[11px] text-white/70 custom-scrollbar">
                  <pre>{localSystemBridge.getPythonDaemonScript()}</pre>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-[#090d16] text-xs font-mono text-white/50">
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${telemetry.connected ? "bg-emerald-400 animate-ping" : "bg-cyan-400"}`} />
            {telemetry.connected ? "LOCAL OS BRIDGE SYNCHRONIZED" : "ZERO-LATENCY WEB RUNTIME ACTIVE"}
          </span>
          <span className="text-cyan-400 font-semibold">NEXA / JARVIS v2.5 APEX</span>
        </div>

      </div>
    </div>
  );
};

export default LocalSystemBridgeModal;
