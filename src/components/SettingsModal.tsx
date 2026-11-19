import React, { useState, useEffect } from "react";
import { 
  Sliders, Brain, Music, Trash2, Plus, X, Sparkles, Volume2, Check, 
  Play, Loader2, Cpu, ShieldCheck, Zap, Activity, Flame, Rocket, 
  Compass, CheckCircle2, DollarSign, Shield, Dumbbell, MessageSquare, User, Award, Heart,
  Mail, Smile, Upload, Languages, RefreshCw, FileText, Globe
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getNexaAudio, getNexaAudioWithMetadata } from "../services/geminiService";
import { PersonalityMode, KissAnimationType, LanguageRegister, ProfanityLevel, PersonalityKnowledgeEntry, KnowledgeUpdateLog, AuditLogEntry, OliviaVoiceStyle, OliviaCreatorConfig, ApiTelemetryEntry, ApiTelemetrySummary } from "../types";
import { getAllPersonalities, getPersonalityById } from "../personalities";
import { languageConfigService } from "../services/languageConfigService";
import { knowledgeClientService } from "../services/knowledgeClientService";
import { fetchAuditLogs, fetchApiTelemetry, clearApiTelemetry } from "../services/auditClientService";
import { decodeBase64AudioToAudioBuffer, playPCM, stopAllPCM } from "../utils/audioUtils";
import {
  getStoredOliviaVoiceStyle,
  setStoredOliviaVoiceStyle,
  getAllOliviaVoiceProfiles,
  ResolvedOliviaVoiceStyle,
} from "../services/oliviaVoiceActingEngine";
import {
  getOliviaCreatorConfig,
  updateOliviaCreatorConfig,
  resetOliviaCreatorConfig,
  getNormalizedBalance,
} from "../services/oliviaConfigService";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  voicePitch: number;
  onPitchChange: (pitch: number) => void;
  selectedVoice?: string;
  onVoiceChange?: (voice: string) => void;
  isDancing: boolean;
  onToggleTestDance: () => void;
  personalityMode?: PersonalityMode;
  onPersonalityModeChange?: (mode: PersonalityMode) => void;
  isKissEffectEnabled?: boolean;
  onToggleKissEffectEnabled?: (enabled: boolean) => void;
  isKissOverlayActive?: boolean;
  onToggleKissOverlayActive?: () => void;
  kissAnimationType?: KissAnimationType;
  onChangeKissAnimationType?: (type: KissAnimationType) => void;
}

const VOICE_PRESETS = [
  { id: "Zephyr", name: "Zephyr", desc: "Bright, energetic & sassy female voice (Absolute Default)", gender: "Female", tag: "Default / Sassy" },
  { id: "Aoede", name: "Aoede", desc: "Expressive, theatrical & dramatic female voice", gender: "Female", tag: "Dramatic / Theatrical" },
  { id: "Kore", name: "Kore", desc: "Soothing, gentle & sweet female voice", gender: "Female", tag: "Calm / Gentle" },
  { id: "Puck", name: "Puck", desc: "Playful, witty & energetic male voice", gender: "Male", tag: "Witty" },
  { id: "Charon", name: "Charon", desc: "Deep, smooth & resonant male voice", gender: "Male", tag: "Deep" },
  { id: "Fenrir", name: "Fenrir", desc: "Warm, strong & confident male voice", gender: "Male", tag: "Rational / Direct" },
];

export default function SettingsModal({
  isOpen,
  onClose,
  voicePitch,
  onPitchChange,
  selectedVoice = "Zephyr",
  onVoiceChange,
  isDancing,
  onToggleTestDance,
  personalityMode = "default",
  onPersonalityModeChange,
  isKissEffectEnabled = true,
  onToggleKissEffectEnabled,
  isKissOverlayActive = false,
  onToggleKissOverlayActive,
  kissAnimationType = "floating_lips",
  onChangeKissAnimationType,
}: SettingsModalProps) {
  const [memories, setMemories] = useState<string[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [activeTab, setActiveTab] = useState<"personality" | "voice" | "language" | "effects" | "memory" | "music" | "audit">("personality");
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [selectedLangPersonaId, setSelectedLangPersonaId] = useState<string>(personalityMode || "default");
  const [langRegister, setLangRegister] = useState<LanguageRegister>("casual");
  const [profanityLevel, setProfanityLevel] = useState<ProfanityLevel>(1);
  const [allowSlang, setAllowSlang] = useState<boolean>(true);
  const [langConfigVersion, setLangConfigVersion] = useState<number>(0);
  const [knowledgeEntries, setKnowledgeEntries] = useState<PersonalityKnowledgeEntry[]>([]);
  const [knowledgeLogs, setKnowledgeLogs] = useState<KnowledgeUpdateLog[]>([]);
  const [isRefreshingKnowledge, setIsRefreshingKnowledge] = useState(false);
  const [knowledgeRefreshMsg, setKnowledgeRefreshMsg] = useState<string>("");
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [apiTelemetrySummary, setApiTelemetrySummary] = useState<ApiTelemetrySummary | null>(null);
  const [apiTelemetryRecent, setApiTelemetryRecent] = useState<ApiTelemetryEntry[]>([]);
  const [oliviaStyle, setOliviaStyle] = useState<OliviaVoiceStyle>(() => getStoredOliviaVoiceStyle());
  const [auditioningOliviaStyle, setAuditioningOliviaStyle] = useState<string | null>(null);
  const [oliviaCreatorConfig, setOliviaCreatorConfig] = useState<OliviaCreatorConfig>(() =>
    getOliviaCreatorConfig()
  );

  const handleUpdateOliviaCreator = (patch: Partial<OliviaCreatorConfig>) => {
    const next = updateOliviaCreatorConfig(patch);
    setOliviaCreatorConfig(next);
  };

  const loadMemories = () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nexa_memories");
      if (saved) {
        try {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) setMemories(list);
        } catch (e) {
          console.error("Failed to load memories", e);
        }
      } else {
        setMemories([]);
      }
    }
  };

  const loadLanguageAndKnowledge = async (targetPersonaId: string = selectedLangPersonaId || personalityMode || "default") => {
    await languageConfigService.ensureSynced();
    const cfg = languageConfigService.getConfig(targetPersonaId);
    setLangRegister(cfg.languageRegister);
    setProfanityLevel(cfg.profanityLevel);
    setAllowSlang(cfg.allowSlang);
    setLangConfigVersion((v) => v + 1);
    const [entries, kLogs] = await Promise.all([
      knowledgeClientService.getKnowledge(targetPersonaId, true),
      knowledgeClientService.listLogs(12),
    ]);
    setKnowledgeEntries(entries);
    setKnowledgeLogs(kLogs);
  };

  const loadAuditAndTelemetry = async () => {
    const [logs, telemetryData] = await Promise.all([
      fetchAuditLogs(30),
      fetchApiTelemetry(40),
    ]);
    setAuditLogs(logs);
    setApiTelemetrySummary(telemetryData.summary);
    setApiTelemetryRecent(telemetryData.recent);
  };

  useEffect(() => {
    if (isOpen) {
      const activeId = personalityMode || "default";
      setSelectedLangPersonaId(activeId);
      loadMemories();
      loadLanguageAndKnowledge(activeId);
      loadAuditAndTelemetry().catch(() => {});
    }
  }, [isOpen, personalityMode]);

  useEffect(() => {
    const handleMemoryUpdate = () => loadMemories();
    window.addEventListener("nexa-memory-updated", handleMemoryUpdate);
    return () => window.removeEventListener("nexa-memory-updated", handleMemoryUpdate);
  }, []);

  const handleAddMemory = () => {
    if (!newMemory.trim()) return;
    const updated = [...memories, newMemory.trim()];
    setMemories(updated);
    localStorage.setItem("nexa_memories", JSON.stringify(updated));
    setNewMemory("");
  };

  const handleDeleteMemory = (index: number) => {
    const updated = memories.filter((_, i) => i !== index);
    setMemories(updated);
    localStorage.setItem("nexa_memories", JSON.stringify(updated));
  };

  const handleClearAllMemories = () => {
    setMemories([]);
    localStorage.removeItem("nexa_memories");
  };

  const handlePreviewVoice = async (voiceId: string) => {
    if (previewingVoice) return;
    setPreviewingVoice(voiceId);
    try {
      const sampleText = `Hello Bhavik! This is my ${voiceId} voice. How do I sound to you?`;
      const base64Audio = await getNexaAudio(sampleText, voiceId);
      if (base64Audio) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const audioBuffer = decodeBase64AudioToAudioBuffer(audioCtx, base64Audio);

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = voicePitch;

        // Global +50% volume boost for all NEXA Elite Minds
        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(1.5, audioCtx.currentTime);

        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-12, audioCtx.currentTime);
        compressor.knee.setValueAtTime(10, audioCtx.currentTime);
        compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
        compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
        compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

        source.connect(gainNode);
        gainNode.connect(compressor);
        compressor.connect(audioCtx.destination);
        source.onended = () => {
          setPreviewingVoice(null);
        };
        source.start();
      } else {
        setPreviewingVoice(null);
      }
    } catch (e) {
      console.error("Failed voice preview", e);
      setPreviewingVoice(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="settings-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <motion.div
            key="settings-modal-dialog"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-lg bg-[#0d1322] border border-cyan-500/30 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.15)] overflow-hidden text-white"
          >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/10 bg-gradient-to-r from-cyan-950/40 to-purple-950/40">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-wide">Nexa Voice & Core Settings</h3>
                <p className="text-xs text-cyan-300/70">Custom Voices, Pitch, Memory & Audio Perception</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-white/10 bg-black/20 p-1 gap-1 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab("personality")}
              className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "personality"
                  ? "bg-gradient-to-r from-amber-500/20 via-cyan-500/20 to-rose-500/20 text-white border border-cyan-500/40 shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              Personality
            </button>
            <button
              onClick={() => setActiveTab("voice")}
              className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "voice"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              Voice & Pitch
            </button>
            <button
              onClick={() => setActiveTab("effects")}
              className={`flex-1 min-w-[95px] flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "effects"
                  ? "bg-gradient-to-r from-pink-500/20 via-rose-500/20 to-purple-500/20 text-pink-300 border border-pink-400/50 shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Heart className="w-3.5 h-3.5 text-pink-400" />
              Visual Effects
            </button>
            <button
              onClick={() => setActiveTab("memory")}
              className={`flex-1 min-w-[80px] flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "memory"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              Memory ({memories.length})
            </button>
            <button
              onClick={() => setActiveTab("music")}
              className={`flex-1 min-w-[70px] flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "music"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              Music
            </button>
            <button
              onClick={() => setActiveTab("language")}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "language"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Languages className="w-3.5 h-3.5 text-emerald-400" />
              Tone & Brain
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`flex-1 min-w-[85px] flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "audit"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              Audit Log
            </button>
          </div>

          {/* Content Area */}
          <div className="p-5 max-h-[60vh] overflow-y-auto space-y-5">
            {/* Personality Mode Tab */}
            {activeTab === "personality" && (
              <div className="space-y-4">
                <div className="text-xs text-white/70 leading-relaxed">
                  Select an active AI personality overlay for NEXA. Switching personalities immediately adopts that mind's reasoning framework and communication style while keeping all tools, vision, and memory intact.
                </div>

                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {getAllPersonalities().map((p) => {
                    const isSelected = personalityMode === p.id;
                    const getIcon = (iconName: string) => {
                      switch (iconName) {
                        case "Rocket": return <Rocket className="w-4 h-4 text-cyan-400" />;
                        case "Flame": return <Flame className="w-4 h-4 text-rose-400" />;
                        case "Zap": return <Zap className="w-4 h-4 text-emerald-400" />;
                        case "DollarSign": return <DollarSign className="w-4 h-4 text-amber-400" />;
                        case "Shield": return <Shield className="w-4 h-4 text-yellow-500" />;
                        case "Dumbbell": return <Dumbbell className="w-4 h-4 text-red-500" />;
                        case "MessageSquare": return <MessageSquare className="w-4 h-4 text-purple-400" />;
                        case "Compass": return <Compass className="w-4 h-4 text-indigo-400" />;
                        case "Brain": return <Brain className="w-4 h-4 text-sky-400" />;
                        case "Award": return <Award className="w-4 h-4 text-blue-400" />;
                        case "Cpu": return <Cpu className="w-4 h-4 text-blue-400" />;
                        case "Heart": return <Heart className="w-4 h-4 text-rose-400" />;
                        default: return <Sparkles className="w-4 h-4 text-amber-400" />;
                      }
                    };

                    return (
                      <div
                        key={`settings-persona-${p.id}`}
                        onClick={() => onPersonalityModeChange && onPersonalityModeChange(p.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-white/10 border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.1)] ring-1 ring-white/30"
                            : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.08]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-lg bg-white/10 border border-white/10`}>
                              {getIcon(p.avatarIcon)}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                {p.name}
                                {isSelected && (
                                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                                    ACTIVE
                                  </span>
                                )}
                              </h4>
                              <span className="text-[10px] text-white/60 font-mono">{p.title}</span>
                            </div>
                          </div>
                          <button
                            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                              isSelected
                                ? "bg-white text-black font-bold shadow-md"
                                : "bg-white/10 text-white/70 hover:text-white"
                            }`}
                          >
                            {isSelected ? "Selected" : "Activate"}
                          </button>
                        </div>
                        <p className="text-xs text-white/70 leading-relaxed mb-2.5">
                          {p.subtitle}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10 text-[10px] font-mono text-white/50">
                          <span className="px-2 py-0.5 rounded bg-white/5 text-cyan-300 border border-cyan-500/20">
                            Voice: {p.defaultVoice}
                          </span>
                          {p.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-white/5 text-white/40">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/20 text-xs text-cyan-200/80 leading-relaxed flex items-start gap-2">
                  <span className="text-sm">💡</span>
                  <span>
                    When an Elite Mind is active, all questions are processed using that mind's mental models, decision frameworks, and mandatory 5-part Action structure.
                  </span>
                </div>
              </div>
            )}
            {/* Voice & Pitch Tab */}
            {activeTab === "voice" && (
              <div className="space-y-5">
                {/* Voice Selection Section */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Choose AI Voice Model
                    </label>
                    <span className="text-[11px] font-mono px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-md">
                      Current: {selectedVoice}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {VOICE_PRESETS.map((v, idx) => {
                      const isSelected = selectedVoice === v.id;
                      const isPreviewing = previewingVoice === v.id;

                      return (
                        <div
                          key={`voice-preset-${v.id}-${idx}`}
                          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                            isSelected
                              ? "bg-cyan-950/60 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                              : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                                {v.name}
                                {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                                {v.tag}
                              </span>
                            </div>
                            <p className="text-[11px] text-white/60 leading-snug mb-2">{v.desc}</p>
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                            <button
                              onClick={() => onVoiceChange && onVoiceChange(v.id)}
                              className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition-all ${
                                isSelected
                                  ? "bg-cyan-500 text-black font-bold"
                                  : "bg-white/10 text-white hover:bg-white/20"
                              }`}
                            >
                              {isSelected ? "Selected" : "Use Voice"}
                            </button>
                            <button
                              onClick={() => handlePreviewVoice(v.id)}
                              disabled={isPreviewing}
                              title={`Preview ${v.name} voice`}
                              className="p-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 transition-colors flex items-center justify-center"
                            >
                              {isPreviewing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-300" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pitch Slider Section */}
                <div className="pt-2 border-t border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Pitch Multiplier
                    </label>
                    <span className="text-xs font-mono px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-md">
                      {voicePitch.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.35"
                    step="0.05"
                    value={voicePitch}
                    onChange={(e) => onPitchChange(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-2 bg-white/10 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-white/40 mt-1 font-mono">
                    <span>0.75x (Deep)</span>
                    <span>1.00x (Natural)</span>
                    <span>1.35x (Sassy)</span>
                  </div>
                </div>

                {/* Global Volume Setting Status */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-cyan-500/10 border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed flex items-start gap-3">
                  <Volume2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>Global Output Volume: 150%</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                        +50% Boost Active
                      </span>
                    </div>
                    <p className="text-[11px] text-white/70 mt-1">
                      Increased by 50% across all NEXA Elite Minds (Steve Jobs, Elon Musk, Naval Ravikant, David Goggins, Oliviya, etc.). Dynamic vocal compression is automatically engaged to ensure crystal-clear speech intelligibility with zero clipping.
                    </p>
                  </div>
                </div>

                {/* Olivia Dynamic Anime Voice Acting Studio */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/10 via-fuchsia-500/10 to-purple-500/10 border border-pink-500/30 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-pink-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                        Olivia Anime Voice Acting Studio
                      </h4>
                      <p className="text-[11px] text-white/65 mt-0.5">
                        Consistent original female voice acting across Kawaii, Tsundere, Playful, Shy, Romantic, Excited, Dramatic &amp; Mischievous styles.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOliviaStyle("auto");
                        setStoredOliviaVoiceStyle("auto");
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all shrink-0 ${
                        oliviaStyle === "auto"
                          ? "bg-pink-500 text-white border-pink-400 shadow-[0_0_12px_rgba(236,72,153,0.5)]"
                          : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      Auto Dynamic
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {getAllOliviaVoiceProfiles().map((prof) => {
                      const isPinned = oliviaStyle === prof.style;
                      const isAuditioning = auditioningOliviaStyle === prof.style;
                      return (
                        <div
                          key={prof.style}
                          className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                            isPinned
                              ? "bg-pink-500/20 border-pink-400/70"
                              : "bg-black/30 border-white/10 hover:border-white/25"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOliviaStyle(prof.style);
                              setStoredOliviaVoiceStyle(prof.style);
                            }}
                            className="text-left flex-1 min-w-0"
                          >
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>{prof.label}</span>
                              {isPinned && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-pink-500/30 text-pink-200">
                                  PINNED
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-white/55 truncate">{prof.description}</p>
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(auditioningOliviaStyle)}
                            onClick={async () => {
                              stopAllPCM();
                              setAuditioningOliviaStyle(prof.style);
                              try {
                                const res = await getNexaAudioWithMetadata(
                                  prof.sampleLine,
                                  oliviaCreatorConfig.voiceName,
                                  false,
                                  {
                                    personalityId: "oliviya",
                                    oliviaStyle: prof.style as ResolvedOliviaVoiceStyle,
                                  }
                                );
                                if (res.audioData) {
                                  await playPCM(
                                    res.audioData,
                                    1.5,
                                    voicePitch * (res.pitchFactor || 1.0),
                                    res.playbackSpeed || 1.0
                                  );
                                }
                              } finally {
                                setAuditioningOliviaStyle(null);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/35 border border-pink-500/40 text-pink-200 transition-colors shrink-0"
                            title={`Audition Olivia (${prof.label})`}
                          >
                            {isAuditioning ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Olivia Creator Personality & Delivery Config */}
                  <div className="pt-3 border-t border-pink-500/20 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-bold text-pink-200">
                          Olivia Creator Personality &amp; Voice Config
                        </h5>
                        <p className="text-[10px] text-white/55">
                          Normalized balance:{" "}
                          {(() => {
                            const b = getNormalizedBalance(oliviaCreatorConfig);
                            return `${b.cute}% Cute • ${b.naughty}% Naughty • ${b.playful}% Playful`;
                          })()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOliviaCreatorConfig(resetOliviaCreatorConfig())}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-[10px] font-mono text-white/75 transition-colors"
                      >
                        Reset 30/35/35
                      </button>
                    </div>

                    {/* Personality Balance Sliders */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="p-2.5 rounded-xl bg-black/35 border border-white/10 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-pink-200 font-semibold">Cute</span>
                          <span className="font-mono text-white/80">{oliviaCreatorConfig.cutePercent}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={oliviaCreatorConfig.cutePercent}
                          onChange={(e) => handleUpdateOliviaCreator({ cutePercent: Number(e.target.value) })}
                          className="w-full accent-pink-400 cursor-pointer"
                        />
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/35 border border-white/10 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-rose-200 font-semibold">Naughty</span>
                          <span className="font-mono text-white/80">{oliviaCreatorConfig.naughtyPercent}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={oliviaCreatorConfig.naughtyPercent}
                          onChange={(e) => handleUpdateOliviaCreator({ naughtyPercent: Number(e.target.value) })}
                          className="w-full accent-rose-400 cursor-pointer"
                        />
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/35 border border-white/10 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-purple-200 font-semibold">Playful</span>
                          <span className="font-mono text-white/80">{oliviaCreatorConfig.playfulPercent}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={oliviaCreatorConfig.playfulPercent}
                          onChange={(e) => handleUpdateOliviaCreator({ playfulPercent: Number(e.target.value) })}
                          className="w-full accent-purple-400 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Voice Identity, Pitch, Speed & Hinglish Mix */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="p-2.5 rounded-xl bg-black/35 border border-white/10 space-y-1">
                        <label className="text-[10px] font-mono uppercase text-white/60 block">
                          Olivia Voice Identity
                        </label>
                        <select
                          value={oliviaCreatorConfig.voiceName}
                          onChange={(e) =>
                            handleUpdateOliviaCreator({
                              voiceName: e.target.value as OliviaCreatorConfig["voiceName"],
                            })
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 text-xs text-white outline-none"
                        >
                          {VOICE_PRESETS.map((vp) => (
                            <option key={vp.id} value={vp.id}>
                              {vp.name} ({vp.gender})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="p-2.5 rounded-xl bg-black/35 border border-white/10 space-y-1">
                        <label className="text-[10px] font-mono uppercase text-white/60 block">
                          Hinglish / English Style
                        </label>
                        <select
                          value={oliviaCreatorConfig.hinglishMix}
                          onChange={(e) =>
                            handleUpdateOliviaCreator({
                              hinglishMix: e.target.value as OliviaCreatorConfig["hinglishMix"],
                            })
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 text-xs text-white outline-none"
                        >
                          <option value="balanced">Balanced Natural Hinglish + English</option>
                          <option value="heavy_hinglish">Heavy Urban Hinglish</option>
                          <option value="english_dominant">English Dominant + Light Hinglish</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="p-2.5 rounded-xl bg-black/35 border border-white/10 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-white/75">Olivia Base Pitch</span>
                          <span className="font-mono text-pink-300">{oliviaCreatorConfig.basePitch.toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min={0.85}
                          max={1.25}
                          step={0.01}
                          value={oliviaCreatorConfig.basePitch}
                          onChange={(e) => handleUpdateOliviaCreator({ basePitch: Number(e.target.value) })}
                          className="w-full accent-pink-400 cursor-pointer"
                        />
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/35 border border-white/10 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-white/75">Olivia Speech Speed</span>
                          <span className="font-mono text-pink-300">{oliviaCreatorConfig.baseSpeed.toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min={0.85}
                          max={1.25}
                          step={0.01}
                          value={oliviaCreatorConfig.baseSpeed}
                          onChange={(e) => handleUpdateOliviaCreator({ baseSpeed: Number(e.target.value) })}
                          className="w-full accent-pink-400 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Expression & Behavior Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center justify-between p-2.5 rounded-xl bg-black/35 border border-white/10 cursor-pointer">
                        <span className="text-white/80">Chat Action Cues (*giggles*)</span>
                        <input
                          type="checkbox"
                          checked={oliviaCreatorConfig.enableActionDescriptions}
                          onChange={(e) =>
                            handleUpdateOliviaCreator({ enableActionDescriptions: e.target.checked })
                          }
                          className="w-4 h-4 accent-pink-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-2.5 rounded-xl bg-black/35 border border-white/10 cursor-pointer">
                        <span className="text-white/80">Japanese Expressions</span>
                        <input
                          type="checkbox"
                          checked={oliviaCreatorConfig.enableJapaneseExpressions}
                          onChange={(e) =>
                            handleUpdateOliviaCreator({ enableJapaneseExpressions: e.target.checked })
                          }
                          className="w-4 h-4 accent-pink-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-2.5 rounded-xl bg-black/35 border border-white/10 cursor-pointer">
                        <span className="text-white/80">Auto Serious Adaptation</span>
                        <input
                          type="checkbox"
                          checked={oliviaCreatorConfig.seriousModeAutoAdapt}
                          onChange={(e) =>
                            handleUpdateOliviaCreator({ seriousModeAutoAdapt: e.target.checked })
                          }
                          className="w-4 h-4 accent-pink-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-2.5 rounded-xl bg-black/35 border border-white/10 cursor-pointer">
                        <span className="text-white/80">Expressive TTS Voice Acting</span>
                        <input
                          type="checkbox"
                          checked={oliviaCreatorConfig.expressiveTtsEnabled}
                          onChange={(e) =>
                            handleUpdateOliviaCreator({ expressiveTtsEnabled: e.target.checked })
                          }
                          className="w-4 h-4 accent-pink-500"
                        />
                      </label>
                    </div>

                    {/* Signature Phrase & Custom Creator Directives */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="p-2.5 rounded-xl bg-black/35 border border-white/10 space-y-1">
                        <label className="text-[10px] font-mono uppercase text-white/60 block">
                          Signature Phrase
                        </label>
                        <input
                          type="text"
                          value={oliviaCreatorConfig.signaturePhrase}
                          onChange={(e) =>
                            handleUpdateOliviaCreator({ signaturePhrase: e.target.value })
                          }
                          placeholder="Ollie Baby!"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-xs text-white outline-none focus:border-pink-400"
                        />
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/35 border border-white/10 space-y-1">
                        <label className="text-[10px] font-mono uppercase text-white/60 block">
                          Action Cue Frequency
                        </label>
                        <select
                          value={oliviaCreatorConfig.actionFrequency}
                          onChange={(e) =>
                            handleUpdateOliviaCreator({
                              actionFrequency: e.target.value as OliviaCreatorConfig["actionFrequency"],
                            })
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 text-xs text-white outline-none"
                        >
                          <option value="minimal">Minimal</option>
                          <option value="occasional">Occasional (Recommended)</option>
                          <option value="expressive">Expressive</option>
                        </select>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-black/35 border border-white/10 space-y-1">
                      <label className="text-[10px] font-mono uppercase text-white/60 block">
                        Creator Custom Character Directives (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={oliviaCreatorConfig.customDirectives}
                        onChange={(e) =>
                          handleUpdateOliviaCreator({ customDirectives: e.target.value })
                        }
                        placeholder="Add custom rules for Olivia's voice, tone, expressions, or behavior..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-xs text-white placeholder-white/35 outline-none focus:border-pink-400 resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs text-cyan-200/80 leading-relaxed">
                  ✨ Voice selection directly updates Gemini Live API and Expressive TTS Voice Design engines. Pitch and speed inflection adapt dynamically without changing Olivia&apos;s core voice identity.
                </div>
              </div>
            )}

            {/* Memory Bank Tab */}
            {activeTab === "memory" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddMemory()}
                    placeholder="Add a fact to Nexa's memory (e.g. Bhavik loves AI)..."
                    className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    onClick={handleAddMemory}
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Save
                  </button>
                </div>

                {memories.length === 0 ? (
                  <div className="text-center py-8 text-white/40 text-xs font-mono">
                    No memories saved yet. Speak to Nexa or add memories manually!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {memories.map((mem, idx) => (
                      <div
                        key={`mem-item-${idx}-${mem.slice(0, 10)}`}
                        className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl hover:border-cyan-500/30 transition-colors"
                      >
                        <span className="text-xs text-white/90 font-mono leading-snug">{mem}</span>
                        <button
                          onClick={() => handleDeleteMemory(idx)}
                          className="text-white/40 hover:text-red-400 p-1 transition-colors"
                          title="Delete Memory"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {memories.length > 0 && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleClearAllMemories}
                      className="text-xs text-red-400/80 hover:text-red-400 underline font-mono"
                    >
                      Clear All Memories
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Visual Effects & Flying Kiss Controls Tab */}
            {activeTab === "effects" && (
              <div className="space-y-5">
                {/* Main Flying Kiss Master Toggle Card */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-pink-950/40 via-rose-950/30 to-purple-950/40 border border-pink-500/30 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-pink-500/20 text-pink-400 border border-pink-500/30">
                        <Heart className="w-5 h-5 fill-pink-500 text-pink-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          Flying Kiss Visual Effect
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                            isKissEffectEnabled 
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                              : "bg-red-500/20 text-red-300 border border-red-500/30"
                          }`}>
                            {isKissEffectEnabled ? "ENABLED" : "DISABLED"}
                          </span>
                        </h4>
                        <p className="text-xs text-pink-200/70">
                          Global master toggle independent of voice commands
                        </p>
                      </div>
                    </div>

                    {/* Interactive Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isKissEffectEnabled}
                      onClick={() => onToggleKissEffectEnabled?.(!isKissEffectEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2 focus:ring-offset-black ${
                        isKissEffectEnabled ? "bg-gradient-to-r from-pink-500 to-rose-500" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          isKissEffectEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-xs text-white/70 leading-relaxed border-t border-pink-500/20 pt-3">
                    When enabled, the interactive flying kiss animation with floating heart particles, romantic radiant glow, and sound triggers across the application. When disabled, all flying kiss visual overlays are suppressed globally.
                  </p>
                </div>

                {/* Kiss Animation Style Selector (3 Distinct Styles) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span>Kiss Animation Style</span>
                        <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                      </h4>
                      <p className="text-xs text-white/60">
                        Choose which visual kiss animation is triggered on commands
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* 1. Small Heart Burst */}
                    <button
                      type="button"
                      disabled={!isKissEffectEnabled}
                      onClick={() => onChangeKissAnimationType?.("heart_burst")}
                      className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-2 ${
                        kissAnimationType === "heart_burst"
                          ? "bg-gradient-to-br from-rose-950/80 via-pink-950/70 to-red-950/80 border-rose-400/80 shadow-[0_0_20px_rgba(244,63,94,0.35)] ring-1 ring-rose-400"
                          : "bg-white/5 hover:bg-white/10 border-white/10"
                      } ${!isKissEffectEnabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="p-2 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          <Heart className="w-4 h-4 fill-rose-500 text-rose-400" />
                        </div>
                        {kissAnimationType === "heart_burst" && (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/40">
                            <Check className="w-3 h-3 text-rose-300" />
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1">
                          <span>Small Heart Burst</span>
                          <span>💖</span>
                        </div>
                        <div className="text-[11px] text-white/60 mt-1 leading-snug">
                          Explosive radial burst of radiant neon hearts and sparkle trails.
                        </div>
                      </div>
                    </button>

                    {/* 2. Floating Lips */}
                    <button
                      type="button"
                      disabled={!isKissEffectEnabled}
                      onClick={() => onChangeKissAnimationType?.("floating_lips")}
                      className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-2 ${
                        kissAnimationType === "floating_lips"
                          ? "bg-gradient-to-br from-pink-950/80 via-fuchsia-950/70 to-purple-950/80 border-pink-400/80 shadow-[0_0_20px_rgba(244,114,182,0.35)] ring-1 ring-pink-400"
                          : "bg-white/5 hover:bg-white/10 border-white/10"
                      } ${!isKissEffectEnabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="p-2 rounded-lg bg-pink-500/20 text-pink-300 border border-pink-500/30">
                          <Smile className="w-4 h-4 text-pink-300" />
                        </div>
                        {kissAnimationType === "floating_lips" && (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-pink-300 bg-pink-500/20 px-2 py-0.5 rounded-full border border-pink-500/40">
                            <Check className="w-3 h-3 text-pink-300" />
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1">
                          <span>Floating Lips</span>
                          <span>💋</span>
                        </div>
                        <div className="text-[11px] text-white/60 mt-1 leading-snug">
                          Playful swaying lip prints and kiss marks drifting upward.
                        </div>
                      </div>
                    </button>

                    {/* 3. Love-Letter Swarm */}
                    <button
                      type="button"
                      disabled={!isKissEffectEnabled}
                      onClick={() => onChangeKissAnimationType?.("love_letter_swarm")}
                      className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-2 ${
                        kissAnimationType === "love_letter_swarm"
                          ? "bg-gradient-to-br from-purple-950/80 via-indigo-950/70 to-pink-950/80 border-purple-400/80 shadow-[0_0_20px_rgba(192,132,252,0.35)] ring-1 ring-purple-400"
                          : "bg-white/5 hover:bg-white/10 border-white/10"
                      } ${!isKissEffectEnabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          <Mail className="w-4 h-4 text-purple-300" />
                        </div>
                        {kissAnimationType === "love_letter_swarm" && (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/40">
                            <Check className="w-3 h-3 text-purple-300" />
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1">
                          <span>Love-Letter Swarm</span>
                          <span>💌</span>
                        </div>
                        <div className="text-[11px] text-white/60 mt-1 leading-snug">
                          Whimsical fluttering swarm of sealed love letters and romantic notes.
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Instant Trigger / Preview Toggle Control */}
                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl gap-3">
                  <div>
                    <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <span>Manual Flying Kiss Overlay Trigger</span>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    </h4>
                    <p className="text-[11px] text-white/50">
                      Instantly preview or toggle the persistent kiss overlay right now
                    </p>
                  </div>

                  <button
                    disabled={!isKissEffectEnabled}
                    onClick={onToggleKissOverlayActive}
                    className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
                      !isKissEffectEnabled
                        ? "opacity-40 cursor-not-allowed bg-white/5 text-white/40 border-white/10"
                        : isKissOverlayActive
                          ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white border-pink-400 shadow-[0_0_15px_rgba(244,63,94,0.5)]"
                          : "bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-pink-400/50"
                    }`}
                  >
                    <span>{isKissOverlayActive ? "Hide Overlay" : "💋 Test Kiss Now"}</span>
                  </button>
                </div>

                {/* Info Card on Voice Independence */}
                <div className="p-3 rounded-lg bg-black/30 border border-white/10 text-[11px] text-white/60 space-y-1">
                  <div className="font-semibold text-white/80">Voice Independence Note:</div>
                  <div>This setting acts as a global master switch. If turned OFF here, voice commands like &quot;Nexa, give me a kiss&quot; will not display visual overlays until re-enabled in this menu.</div>
                </div>

                {/* Avatar Video Manager for User's New Videos */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-neutral-900 to-orange-950/40 border border-amber-500/30 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <span>Avatar Video Manager</span>
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    </h4>
                    <p className="text-[11px] text-white/50">
                      Upload your newly created continuous looking, talking, thinking, or kiss videos, or remove existing ones.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      window.dispatchEvent(new CustomEvent('nexa-open-custom-videos-manager'));
                    }}
                    className="px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Manage Videos</span>
                  </button>
                </div>
              </div>
            )}

            {/* Music & Dance Tab */}
            {activeTab === "music" && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-semibold text-purple-200">
                        Direct Audio Perception Model
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">
                    Nexa continuously analyzes incoming mic sound spectra to recognize background music, instrumental tones, autotune, or songs.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div>
                    <h4 className="text-xs font-semibold text-white">Manual Dance Animation Test</h4>
                    <p className="text-[11px] text-white/50">Preview Nexa_professional_dance_animation_202607302150</p>
                  </div>
                  <button
                    onClick={onToggleTestDance}
                    className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                      isDancing
                        ? "bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                        : "bg-white/10 hover:bg-white/20 text-white border-white/20"
                    }`}
                  >
                    {isDancing ? "Stop Dance" : "💃 Dance Now!"}
                  </button>
                </div>
              </div>
            )}

            {/* Language Calibration & Isolated Knowledge Tab */}
            {activeTab === "language" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Languages className="w-4 h-4" />
                      Language & Profanity Calibration (All {getAllPersonalities().length} Personalities)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      SQLite Synced
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] text-white/60 block mb-1">
                      Target Personality Profile ({getPersonalityById(selectedLangPersonaId).shortName})
                    </label>
                    <select
                      value={selectedLangPersonaId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setSelectedLangPersonaId(nextId);
                        loadLanguageAndKnowledge(nextId);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-white text-xs outline-none"
                    >
                      {getAllPersonalities().map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.shortName}) {p.id === personalityMode ? "• ACTIVE" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[11px] text-white/60 block mb-1">Language Register</label>
                      <select
                        value={langRegister}
                        onChange={async (e) => {
                          const reg = e.target.value as LanguageRegister;
                          setLangRegister(reg);
                          await languageConfigService.updateConfig(selectedLangPersonaId, { languageRegister: reg });
                          setLangConfigVersion((v) => v + 1);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-white text-xs outline-none"
                      >
                        <option value="professional">Professional / Crisp</option>
                        <option value="friendly">Warm / Friendly</option>
                        <option value="playful">Playful / Cheeky</option>
                        <option value="casual">Casual Hinglish</option>
                        <option value="slang">Urban Slang / Desi Banter</option>
                        <option value="mild_profanity">Edgy Casual</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-white/60 block mb-1">Profanity Intensity (0–3)</label>
                      <select
                        value={profanityLevel}
                        onChange={async (e) => {
                          const lvl = Number(e.target.value) as ProfanityLevel;
                          setProfanityLevel(lvl);
                          await languageConfigService.updateConfig(selectedLangPersonaId, { profanityLevel: lvl });
                          setLangConfigVersion((v) => v + 1);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-white text-xs outline-none"
                      >
                        <option value={0}>0 — Clean Only</option>
                        <option value={1}>1 — Playful / Mild</option>
                        <option value={2}>2 — Bold Banter</option>
                        <option value={3}>3 — Unfiltered Casual Adult</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center justify-between pt-1 cursor-pointer text-xs">
                    <span className="text-white/80">Allow Desi/Hinglish Slang & Meme Banter</span>
                    <input
                      type="checkbox"
                      checked={allowSlang}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        setAllowSlang(checked);
                        await languageConfigService.updateConfig(selectedLangPersonaId, { allowSlang: checked });
                        setLangConfigVersion((v) => v + 1);
                      }}
                      className="w-4 h-4 accent-emerald-500"
                    />
                  </label>

                  {selectedLangPersonaId === "oliviya" && (
                    <div className="p-2.5 rounded-lg bg-pink-500/10 border border-pink-400/30 text-[11px] text-pink-200/90 leading-snug">
                      Oliviya Calibration: Levels 0–3 adjust her bold flirting, mature teasing, and playful adult banter while keeping non-explicit boundaries active.
                    </div>
                  )}

                  <div key={langConfigVersion} className="pt-2 border-t border-white/10">
                    <div className="text-[10px] font-mono uppercase text-white/50 mb-1.5">
                      Active Calibration Matrix ({getAllPersonalities().length} Profiles)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-28 overflow-y-auto pr-1">
                      {getAllPersonalities().map((p) => {
                        const pCfg = languageConfigService.getConfig(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedLangPersonaId(p.id);
                              loadLanguageAndKnowledge(p.id);
                            }}
                            className={`text-left px-2 py-1 rounded-md border text-[10px] font-mono transition-colors cursor-pointer ${
                              selectedLangPersonaId === p.id
                                ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-200"
                                : "bg-black/30 border-white/10 text-white/65 hover:text-white"
                            }`}
                          >
                            <div className="truncate font-semibold">{p.shortName}</div>
                            <div className="text-[9px] text-white/50 truncate">
                              {pCfg.languageRegister} • P{pCfg.profanityLevel}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-[10px] text-white/50">
                    Strict guardrails remain active across all levels: zero hate speech, slurs, harassment, or explicit pornographic generation.
                  </p>
                </div>

                {/* Isolated Persona Knowledge */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                      <Globe className="w-4 h-4" />
                      <span>Isolated Knowledge ({selectedLangPersonaId})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={isRefreshingKnowledge}
                        onClick={async () => {
                          setIsRefreshingKnowledge(true);
                          setKnowledgeRefreshMsg("");
                          const res = await knowledgeClientService.refreshNow(selectedLangPersonaId);
                          setKnowledgeRefreshMsg(res.message || res.status);
                          await loadLanguageAndKnowledge(selectedLangPersonaId);
                          setIsRefreshingKnowledge(false);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRefreshingKnowledge ? "animate-spin" : ""}`} />
                        <span>Sync Domain</span>
                      </button>
                      <button
                        disabled={isRefreshingKnowledge}
                        onClick={async () => {
                          setIsRefreshingKnowledge(true);
                          const res = await knowledgeClientService.refreshNow("meme_culture");
                          setKnowledgeRefreshMsg(res.message || res.status);
                          await loadLanguageAndKnowledge(selectedLangPersonaId);
                          setIsRefreshingKnowledge(false);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                      >
                        Sync Memes
                      </button>
                    </div>
                  </div>

                  {knowledgeRefreshMsg && (
                    <div className="text-[11px] px-2.5 py-1.5 rounded-lg bg-black/40 border border-cyan-500/30 text-cyan-200">
                      {knowledgeRefreshMsg}
                    </div>
                  )}

                  {knowledgeEntries.length === 0 ? (
                    <div className="text-[11px] text-white/50 py-2">
                      No domain entries synced yet for this personality. Background scheduler updates domains automatically or click Sync Domain.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {knowledgeEntries.map((entry) => (
                        <div key={entry.id} className="p-2.5 rounded-lg bg-black/40 border border-white/10 text-[11px]">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-white">{entry.topic}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                              v{entry.version} • {entry.verificationStatus}
                            </span>
                          </div>
                          <p className="text-white/70 leading-snug">{entry.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {knowledgeLogs.length > 0 && (
                    <div className="pt-2 border-t border-white/10">
                      <div className="text-[10px] font-mono uppercase text-white/50 mb-1">Recent Scheduler Logs</div>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {knowledgeLogs.slice(0, 5).map((log) => (
                          <div key={log.id} className="text-[10px] font-mono text-white/60 flex justify-between gap-2">
                            <span className="truncate">[{log.personalityId}] {log.message}</span>
                            <span className="shrink-0 text-white/40">{new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Audit Log & SQLite API Telemetry Tab */}
            {activeTab === "audit" && (
              <div className="space-y-4">
                {/* SQLite API Telemetry Card */}
                <div className="p-4 rounded-xl bg-cyan-950/25 border border-cyan-500/30 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Activity className="w-4 h-4" />
                      <span>SQLite API Usage, Latency & Cost Telemetry</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => loadAuditAndTelemetry().catch(() => {})}
                        className="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/80 cursor-pointer"
                      >
                        Refresh
                      </button>
                      <button
                        onClick={async () => {
                          await clearApiTelemetry();
                          await loadAuditAndTelemetry();
                        }}
                        className="text-[11px] px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {apiTelemetrySummary && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                      <div className="p-2 rounded-lg bg-black/40 border border-white/10">
                        <div className="text-white/40 text-[10px]">Calls (OK / Err / 429)</div>
                        <div className="text-white font-bold">
                          {apiTelemetrySummary.totalCalls} ({apiTelemetrySummary.successCalls}/{apiTelemetrySummary.errorCalls}/{apiTelemetrySummary.quotaLimitedCalls})
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-black/40 border border-white/10">
                        <div className="text-white/40 text-[10px]">Avg Latency</div>
                        <div className="text-cyan-300 font-bold">{apiTelemetrySummary.avgLatencyMs} ms</div>
                      </div>
                      <div className="p-2 rounded-lg bg-black/40 border border-white/10">
                        <div className="text-white/40 text-[10px]">Verified Tokens</div>
                        <div className="text-emerald-300 font-bold">{apiTelemetrySummary.totalTokens.toLocaleString()}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-black/40 border border-white/10">
                        <div className="text-white/40 text-[10px]">Estimated Cost</div>
                        <div className="text-amber-300 font-bold">
                          {apiTelemetrySummary.knownCostUsd !== null
                            ? `$${apiTelemetrySummary.knownCostUsd.toFixed(6)}`
                            : "Pricing N/A"}
                        </div>
                      </div>
                    </div>
                  )}

                  {apiTelemetryRecent.length === 0 ? (
                    <div className="text-[11px] text-white/50 py-2">
                      No API telemetry recorded yet. Gemini chat, generate, TTS, and search requests log here automatically.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {apiTelemetryRecent.slice(0, 20).map((item) => (
                        <div key={item.id} className="p-2 rounded-lg bg-black/40 border border-white/10 text-[11px] font-mono">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-cyan-300 font-semibold truncate">
                              {item.endpoint} • {item.model}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                              item.status === "success"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : item.status === "quota_limited"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-rose-500/20 text-rose-300"
                            }`}>
                              {item.status.toUpperCase()} • {item.latencyMs}ms
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[10px] text-white/55 mt-0.5">
                            <span>
                              Tokens: {item.totalTokens !== null ? item.totalTokens : "unavailable"}
                              {item.fallbackUsed ? ` • Fallback (${item.attemptCount} tries)` : ""}
                            </span>
                            <span>
                              {item.estimatedCostUsd !== null
                                ? `$${item.estimatedCostUsd.toFixed(6)}`
                                : item.costStatus === "pricing_unavailable"
                                  ? "Cost: N/A (preview pricing unverified)"
                                  : `Cost: ${item.costStatus}`}
                            </span>
                          </div>
                          {item.errorMessage && (
                            <div className="text-[10px] text-rose-300 truncate mt-0.5">{item.errorMessage}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Audit Log Section */}
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>Action Confirmation & Memory Audit Trail</span>
                  </div>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="p-5 text-center text-xs text-white/50 border border-dashed border-white/10 rounded-xl">
                    No sensitive action logs recorded yet. Deletions, imports, WhatsApp dispatches, and CLI confirmations are tracked here.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono font-bold text-cyan-300">{log.actionType}</span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            log.status === "rejected" || log.status === "failed"
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}>
                            {log.status.toUpperCase()} {log.confirmedByUser ? "• CONFIRMED" : ""}
                          </span>
                        </div>
                        <div className="text-white/80">{log.details || log.target}</div>
                        <div className="text-[10px] text-white/40 mt-1 font-mono">{new Date(log.timestamp).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}
