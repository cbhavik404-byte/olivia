import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, Upload, Trash2, Eye, Brain, MessageSquare, Heart, 
  Check, AlertCircle, RefreshCw, Play, Pause, Sparkles
} from "lucide-react";
import { 
  VideoSlot, 
  getAllCustomVideos, 
  saveCustomVideo, 
  removeCustomVideo, 
  removeAllCustomVideos 
} from "../services/customVideoService";

interface CustomVideoManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SlotInfo {
  slot: VideoSlot;
  title: string;
  role: string;
  description: string;
  icon: typeof Eye;
  color: string;
}

const SLOTS: SlotInfo[] = [
  {
    slot: "looking",
    title: "Continuous Looking",
    role: "Idle & Attentive Listening",
    description: "Plays when Nexa is in idle mode or listening attentively to you.",
    icon: Eye,
    color: "from-amber-500 to-orange-500"
  },
  {
    slot: "thinking",
    title: "Thinking & Processing",
    role: "Cognitive Search & Reasoning",
    description: "Plays when Nexa is searching the live internet or processing complex prompts.",
    icon: Brain,
    color: "from-purple-500 to-pink-500"
  },
  {
    slot: "talking",
    title: "Talking & Lip-Sync",
    role: "Voice & Speech Replies",
    description: "Plays when Nexa is answering, talking, explaining concepts, or singing.",
    icon: MessageSquare,
    color: "from-cyan-500 to-blue-500"
  },
  {
    slot: "kiss",
    title: "Kiss & Affection",
    role: "Single Kiss Reaction",
    description: "Plays when you ask for affection or a sweet flying kiss.",
    icon: Heart,
    color: "from-rose-500 to-pink-600"
  }
];

export default function CustomVideoManagerModal({
  isOpen,
  onClose
}: CustomVideoManagerModalProps) {
  const [videoUrls, setVideoUrls] = useState<Record<VideoSlot, string | null>>({
    looking: null,
    thinking: null,
    talking: null,
    kiss: null
  });
  const [uploadingSlot, setUploadingSlot] = useState<VideoSlot | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRefs = useRef<Record<VideoSlot, HTMLInputElement | null>>({
    looking: null,
    thinking: null,
    talking: null,
    kiss: null
  });

  const loadVideos = async () => {
    const blobs = await getAllCustomVideos();
    const urls: Record<VideoSlot, string | null> = {
      looking: null,
      thinking: null,
      talking: null,
      kiss: null
    };
    (Object.keys(blobs) as VideoSlot[]).forEach((slot) => {
      if (blobs[slot]) {
        urls[slot] = URL.createObjectURL(blobs[slot]!);
      }
    });
    setVideoUrls(urls);
  };

  useEffect(() => {
    if (isOpen) {
      loadVideos();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (slot: VideoSlot, file: File) => {
    if (!file) return;
    setUploadingSlot(slot);
    try {
      await saveCustomVideo(slot, file);
      await loadVideos();
      setStatusMessage(`New ${slot} video uploaded and activated!`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {
      console.error("Failed to save video:", e);
      setStatusMessage(`Upload failed. Please check file format.`);
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleRemoveSlot = async (slot: VideoSlot) => {
    await removeCustomVideo(slot);
    await loadVideos();
    setStatusMessage(`Removed ${slot} video. Default visualizer restored.`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleRemoveAll = async () => {
    await removeAllCustomVideos();
    await loadVideos();
    setStatusMessage("All avatar videos have been removed. Nexa is now in default portrait mode.");
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const hasAnyVideo = Object.values(videoUrls).some(url => url !== null);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-neutral-950/95 border border-amber-500/30 shadow-[0_0_80px_rgba(245,158,11,0.25)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-amber-500/10 via-black to-orange-500/10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                <Sparkles size={22} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Avatar Video Manager
                </h2>
                <p className="text-xs text-neutral-400">
                  Upload your newly created videos for continuous looking, talking, thinking, or kiss
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasAnyVideo && (
                <button
                  onClick={handleRemoveAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-semibold transition-all"
                  title="Remove all videos"
                >
                  <Trash2 size={13} />
                  <span>Remove All</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white transition-colors border border-white/10"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Toast Notice */}
          <AnimatePresence>
            {statusMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mx-6 mt-4 p-3 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs flex items-center gap-2"
              >
                <Check size={14} className="text-amber-400" />
                <span>{statusMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Status Banner */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${hasAnyVideo ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" : "bg-neutral-500"}`} />
                <div>
                  <div className="text-xs font-bold text-white">
                    {hasAnyVideo ? "Custom Avatar Videos Active" : "Previous Videos Removed (Default Visualizer Active)"}
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    {hasAnyVideo
                      ? "Your new custom videos are playing seamlessly on Nexa's avatar."
                      : "The old looking and thinking videos were completely removed. Upload your new ones below whenever you wish!"}
                  </div>
                </div>
              </div>

              {hasAnyVideo && (
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Ready & Persistent
                </span>
              )}
            </div>

            {/* Slots Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SLOTS.map((item) => {
                const IconComponent = item.icon;
                const currentUrl = videoUrls[item.slot];
                const isUploading = uploadingSlot === item.slot;

                return (
                  <div
                    key={item.slot}
                    className="flex flex-col justify-between p-4 rounded-2xl bg-neutral-900/60 border border-white/10 hover:border-amber-500/30 transition-all gap-3"
                  >
                    <div>
                      {/* Slot Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-amber-300">
                            <IconComponent size={16} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white">
                              {item.title}
                            </h3>
                            <span className="text-[10px] font-mono text-amber-400/90">
                              {item.role}
                            </span>
                          </div>
                        </div>

                        {currentUrl ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Custom Video Loaded
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-white/5">
                            No Video (Default)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-neutral-400 mt-2">
                        {item.description}
                      </p>
                    </div>

                    {/* Preview or Empty State */}
                    {currentUrl ? (
                      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/10">
                        <video
                          src={currentUrl}
                          playsInline
                          muted
                          loop
                          autoPlay
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRefs.current[item.slot]?.click()}
                        className="aspect-video w-full rounded-xl border border-dashed border-white/15 hover:border-amber-500/50 bg-black/40 flex flex-col items-center justify-center cursor-pointer transition-colors p-4 text-center group"
                      >
                        <Upload size={24} className="text-neutral-500 group-hover:text-amber-400 transition-colors mb-2" />
                        <span className="text-xs font-semibold text-neutral-300 group-hover:text-amber-300">
                          {isUploading ? "Uploading..." : `Click to Upload New ${item.title}`}
                        </span>
                        <span className="text-[10px] text-neutral-500 mt-1">
                          Select .mp4 or .webm from your device
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                      <input
                        ref={(el) => { fileInputRefs.current[item.slot] = el; }}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(item.slot, file);
                          e.target.value = "";
                        }}
                      />

                      <button
                        onClick={() => fileInputRefs.current[item.slot]?.click()}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 text-xs font-semibold transition-all"
                      >
                        <Upload size={13} />
                        <span>{currentUrl ? "Replace Video" : "Upload Video"}</span>
                      </button>

                      {currentUrl && (
                        <button
                          onClick={() => handleRemoveSlot(item.slot)}
                          className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 transition-colors"
                          title={`Remove ${item.title} video`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
