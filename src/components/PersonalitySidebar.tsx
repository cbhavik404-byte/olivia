import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, Sparkles, Rocket, Flame, Zap, Cpu, Plus, Trash2, Check, 
  Volume2, Play, Loader2, Search, User, Compass, ArrowRight,
  Lightbulb, ShieldCheck, CheckCircle2, Sliders, ChevronRight,
  DollarSign, Shield, Dumbbell, MessageSquare, Briefcase, Award, Brain, Heart, GraduationCap
} from "lucide-react";
import { Personality, PersonalityMode } from "../types";
import { getAllPersonalities, saveCustomPersonality, deleteCustomPersonality, PRESET_PERSONALITIES } from "../personalities";
import { getNexaAudioWithMetadata } from "../services/geminiService";
import { playPCM, stopAllPCM } from "../utils/audioUtils";

interface PersonalitySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPersonality: PersonalityMode;
  onSelectPersonality: (personalityId: string) => void;
  onPreviewVoice?: (voice: string, sampleText: string) => void;
}

export default function PersonalitySidebar({
  isOpen,
  onClose,
  currentPersonality,
  onSelectPersonality,
}: PersonalitySidebarProps) {
  const [personalities, setPersonalities] = useState<Personality[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGender, setFilterGender] = useState<"all" | "male" | "female">("all");
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  // Form state for creating custom personality
  const [customName, setCustomName] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customSubtitle, setCustomSubtitle] = useState("");
  const [customGender, setCustomGender] = useState<"male" | "female" | "neutral">("male");
  const [customVoice, setCustomVoice] = useState("Fenrir");
  const [customPrompt, setCustomPrompt] = useState("");
  const [customTagline, setCustomTagline] = useState("");

  const refreshList = () => {
    setPersonalities(getAllPersonalities());
  };

  useEffect(() => {
    refreshList();
    const handleUpdate = () => refreshList();
    window.addEventListener("nexa_personalities_updated", handleUpdate);
    return () => window.removeEventListener("nexa_personalities_updated", handleUpdate);
  }, []);

  const handlePreview = async (p: Personality, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingId === p.id) {
      stopAllPCM();
      setPreviewingId(null);
      return;
    }
    stopAllPCM();
    try {
      setPreviewingId(p.id);
      const textToSpeak = p.welcomeMessage.replace(/\[[A-Z]+\]\s*/g, "");
      const audioRes = await getNexaAudioWithMetadata(textToSpeak, p.defaultVoice, false, {
        personalityId: p.id,
      });
      if (audioRes.audioData) {
        await playPCM(audioRes.audioData, 1.5, audioRes.pitchFactor || 1.0, audioRes.playbackSpeed || 1.0);
      }
    } catch (err) {
      console.error("Audio preview failed:", err);
    } finally {
      setPreviewingId(null);
    }
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const newId = `custom_${Date.now()}`;
    const newPersona: Personality = {
      id: newId,
      name: customName.trim(),
      shortName: customName.trim().slice(0, 10),
      title: customTitle.trim() || "Custom AI Persona",
      subtitle: customSubtitle.trim() || `Custom intelligence persona for Bhavik`,
      gender: customGender,
      defaultVoice: customVoice,
      avatarIcon: customGender === "male" ? "User" : "Sparkles",
      avatarLetter: customName.trim()[0].toUpperCase(),
      badge: "CUSTOM",
      accentColor: "from-purple-500 to-indigo-600",
      themeColor: "purple",
      tagline: customTagline.trim() || "Bespoke AI Persona",
      tags: ["Custom", customGender === "male" ? "Male Voice" : "Female Voice"],
      welcomeMessage: `Hello Bhavik! I am ${customName.trim()}. How can I assist your objectives today?`,
      safetyRedirect: `Bhavik, let's refocus our energy on the primary objective and explore solutions!`,
      systemInstruction: customPrompt.trim() || `You ARE ${customName.trim()}. You are talking directly with Bhavik. Address Bhavik directly and stay 100% in your authentic character and voice.`,
      isCustom: true,
    };

    saveCustomPersonality(newPersona);
    setIsCreatingCustom(false);
    setCustomName("");
    setCustomTitle("");
    setCustomSubtitle("");
    setCustomPrompt("");
    setCustomTagline("");
    onSelectPersonality(newId);
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomPersonality(id);
    if (currentPersonality === id) {
      onSelectPersonality("default");
    }
  };

  const filtered = personalities.filter((p) => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesGender = filterGender === "all" || p.gender === filterGender;
    return matchesSearch && matchesGender;
  });

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "Rocket": return <Rocket className="w-5 h-5" />;
      case "Flame": return <Flame className="w-5 h-5" />;
      case "Zap": return <Zap className="w-5 h-5" />;
      case "DollarSign": return <DollarSign className="w-5 h-5" />;
      case "Shield": return <Shield className="w-5 h-5" />;
      case "Dumbbell": return <Dumbbell className="w-5 h-5" />;
      case "MessageSquare": return <MessageSquare className="w-5 h-5" />;
      case "Compass": return <Compass className="w-5 h-5" />;
      case "Brain": return <Brain className="w-5 h-5" />;
      case "Award": return <Award className="w-5 h-5" />;
      case "Cpu": return <Cpu className="w-5 h-5" />;
      case "User": return <User className="w-5 h-5" />;
      case "GraduationCap": return <GraduationCap className="w-5 h-5 text-pink-400" />;
      case "Heart": return <Heart className="w-5 h-5 text-rose-400 fill-rose-500/20" />;
      default: return <Sparkles className="w-5 h-5" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 transition-opacity"
          />

          {/* Slide-out Sidebar */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 bottom-0 w-full max-w-md bg-zinc-950/95 border-r border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50 flex flex-col backdrop-blur-2xl overflow-hidden"
          >
            {/* Sidebar Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-amber-500 flex items-center justify-center text-black font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    AI Personalities
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/10">
                      {personalities.length} Available
                    </span>
                  </h2>
                  <p className="text-[11px] text-white/50 font-mono">
                    Distinct mindsets, authentic voices & dedicated reasoning
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Action Bar */}
            <div className="p-4 border-b border-white/10 bg-black/20 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, mindset, physics..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-500/60 transition-all font-mono"
                  />
                </div>
                <button
                  onClick={() => setIsCreatingCustom(!isCreatingCustom)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                    isCreatingCustom 
                      ? "bg-amber-500 text-black border-amber-400 font-bold" 
                      : "bg-white/5 hover:bg-white/10 text-cyan-300 border-cyan-500/30 hover:border-cyan-500/60"
                  }`}
                  title="Add a custom personality"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Persona</span>
                </button>
              </div>

              {/* Gender Filter Pills */}
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-white/40 font-mono mr-1">Voice:</span>
                <button
                  onClick={() => setFilterGender("all")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    filterGender === "all"
                      ? "bg-white/20 text-white font-semibold"
                      : "bg-white/5 text-white/60 hover:text-white"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterGender("male")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    filterGender === "male"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold"
                      : "bg-white/5 text-white/60 hover:text-white"
                  }`}
                >
                  Male Voices (Fenrir/Charon)
                </button>
                <button
                  onClick={() => setFilterGender("female")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    filterGender === "female"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold"
                      : "bg-white/5 text-white/60 hover:text-white"
                  }`}
                >
                  Female Voices (Kore/Zephyr)
                </button>
              </div>
            </div>

            {/* Custom Persona Creation Accordion */}
            <AnimatePresence>
              {isCreatingCustom && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleCreateCustom}
                  className="p-4 border-b border-amber-500/30 bg-amber-500/5 space-y-3 overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Create Custom Personality
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingCustom(false)}
                      className="text-white/40 hover:text-white text-xs"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-white/60 font-mono block mb-1">Name *</label>
                      <input
                        type="text"
                        required
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="e.g. Nikola Tesla"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/60 font-mono block mb-1">Role / Title</label>
                      <input
                        type="text"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder="e.g. Master of Electricity"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-white/60 font-mono block mb-1">Voice Preset</label>
                      <select
                        value={customVoice}
                        onChange={(e) => setCustomVoice(e.target.value)}
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      >
                        <option value="Fenrir">Fenrir (Strong Male)</option>
                        <option value="Charon">Charon (Deep Male)</option>
                        <option value="Puck">Puck (Witty Male)</option>
                        <option value="Kore">Kore (Warm Female)</option>
                        <option value="Zephyr">Zephyr (Bright Female)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/60 font-mono block mb-1">Gender</label>
                      <select
                        value={customGender}
                        onChange={(e) => setCustomGender(e.target.value as any)}
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="neutral">Neutral</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-white/60 font-mono block mb-1">Mindset & System Instructions</label>
                    <textarea
                      rows={2}
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Describe how this persona reasons, talks, and helps Bhavik..."
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs transition-colors shadow-md"
                  >
                    Save & Activate Personality
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Personalities Cards List */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin">
              {filtered.map((persona) => {
                const isActive = currentPersonality === persona.id;
                const isPreviewing = previewingId === persona.id;

                return (
                  <div
                    key={persona.id}
                    onClick={() => {
                      onSelectPersonality(persona.id);
                      onClose();
                    }}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer group ${
                      isActive
                        ? persona.id === "zoya"
                          ? "bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 border-fuchsia-400/80 shadow-[0_0_30px_rgba(217,70,239,0.35)] ring-1 ring-fuchsia-400/50"
                        : persona.id === "oliviya"
                          ? "bg-gradient-to-br from-violet-500/20 to-pink-500/20 border-pink-400/80 shadow-[0_0_30px_rgba(236,72,153,0.35)] ring-1 ring-pink-400/50"
                        : persona.id === "coco"
                          ? "bg-gradient-to-br from-cyan-500/20 via-teal-500/15 to-sky-500/20 border-cyan-400/80 shadow-[0_0_30px_rgba(34,211,238,0.32)] ring-1 ring-cyan-400/50"
                          : persona.id === "elon"
                          ? "bg-cyan-500/15 border-cyan-400/80 shadow-[0_0_30px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/40"
                          : persona.id === "jobs"
                          ? "bg-slate-500/15 border-slate-300/80 shadow-[0_0_30px_rgba(203,213,225,0.3)] ring-1 ring-slate-300/40"
                          : persona.id === "altman"
                          ? "bg-emerald-500/15 border-emerald-400/80 shadow-[0_0_30px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/40"
                          : persona.id === "hormozi"
                          ? "bg-amber-500/15 border-amber-400/80 shadow-[0_0_30px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/40"
                          : persona.id === "mrbeast"
                          ? "bg-blue-500/15 border-pink-400/80 shadow-[0_0_30px_rgba(236,72,153,0.3)] ring-1 ring-pink-400/40"
                          : persona.id === "naval"
                          ? "bg-indigo-500/15 border-indigo-400/80 shadow-[0_0_30px_rgba(99,102,241,0.3)] ring-1 ring-indigo-400/40"
                          : persona.id === "buffett"
                          ? "bg-yellow-600/15 border-yellow-500/80 shadow-[0_0_30px_rgba(234,179,8,0.3)] ring-1 ring-yellow-500/40"
                          : persona.id === "goggins"
                          ? "bg-red-600/15 border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.3)] ring-1 ring-red-500/40"
                          : persona.id === "communication"
                          ? "bg-purple-600/15 border-purple-400/80 shadow-[0_0_30px_rgba(168,85,247,0.3)] ring-1 ring-purple-400/40"
                          : persona.id === "kahneman"
                          ? "bg-sky-500/15 border-sky-400/80 shadow-[0_0_30px_rgba(56,189,248,0.3)] ring-1 ring-sky-400/40"
                          : persona.id === "feynman"
                          ? "bg-emerald-500/15 border-emerald-300/80 shadow-[0_0_30px_rgba(110,231,183,0.3)] ring-1 ring-emerald-300/40"
                          : persona.id === "tesla"
                          ? "bg-cyan-500/15 border-cyan-300/80 shadow-[0_0_30px_rgba(6,182,212,0.3)] ring-1 ring-cyan-300/40"
                          : persona.id === "munger"
                          ? "bg-amber-600/15 border-amber-500/80 shadow-[0_0_30px_rgba(217,119,6,0.3)] ring-1 ring-amber-500/40"
                          : persona.id === "davinci"
                          ? "bg-teal-500/15 border-teal-400/80 shadow-[0_0_30px_rgba(45,212,191,0.3)] ring-1 ring-teal-400/40"
                          : persona.id === "lincoln"
                          ? "bg-blue-600/15 border-blue-400/80 shadow-[0_0_30px_rgba(96,165,250,0.3)] ring-1 ring-blue-400/40"
                          : "bg-amber-500/15 border-amber-400/80 shadow-[0_0_30px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/40"
                        : "bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.07]"
                    }`}
                  >
                    {/* Top Row */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${persona.accentColor} flex items-center justify-center text-black font-bold shadow-md relative`}>
                          {getIcon(persona.avatarIcon)}
                          {isActive && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-black animate-pulse" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white group-hover:text-amber-200 transition-colors">
                              {persona.name}
                            </h3>
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded-md uppercase font-bold border ${
                              isActive 
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-white/5 text-white/50 border-white/10"
                            }`}>
                              {isActive ? "ACTIVE" : persona.badge}
                            </span>
                          </div>
                          <span className="text-[11px] text-white/60 font-mono block">
                            {persona.title}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons on card */}
                      <div className="flex items-center gap-1">
                        {/* Audio voice preview */}
                        <button
                          onClick={(e) => handlePreview(persona, e)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                          title="Preview authentic voice sample"
                        >
                          {isPreviewing ? (
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                        {persona.isCustom && (
                          <button
                            onClick={(e) => handleDeleteCustom(persona.id, e)}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                            title="Delete custom persona"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Subtitle & Mindset */}
                    <p className="text-xs text-white/70 leading-relaxed mb-3 font-sans">
                      {persona.subtitle}
                    </p>

                    {/* Meta badges: Voice, Gender & Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/5 text-[10px] font-mono">
                      <span className={`px-2 py-0.5 rounded-full border ${
                        persona.gender === "male" 
                          ? "bg-cyan-950/60 text-cyan-300 border-cyan-500/30" 
                          : "bg-rose-950/60 text-rose-300 border-rose-500/30"
                      }`}>
                        {persona.gender.toUpperCase()} VOICE ({persona.defaultVoice})
                      </span>
                      {persona.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/5">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Active Checkmark footer */}
                    {isActive && (
                      <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-emerald-300 font-semibold font-mono">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Direct Persona Mode Engaged
                        </span>
                        <span className="text-[10px] text-white/40">100% Immersive</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="p-8 text-center text-white/40 text-xs font-mono space-y-2">
                  <p>No personalities found matching "{searchQuery}"</p>
                  <button
                    onClick={() => { setSearchQuery(""); setFilterGender("all"); }}
                    className="text-cyan-400 underline hover:text-cyan-300"
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>

            {/* Sidebar Footer info */}
            <div className="p-4 border-t border-white/10 bg-black/40 text-[11px] text-white/50 font-mono flex items-center justify-between">
              <span>Switching persona updates voice & mindset instantly.</span>
              <span className="text-amber-400 font-bold">BHAVIK OS</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
