import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import JSZip from "jszip";
import {
  X,
  Upload,
  Trash2,
  Eye,
  Brain,
  MessageSquare,
  Heart,
  Check,
  Film,
  Download,
  Cpu,
  Sparkles,
  Loader2,
  RotateCcw,
} from "lucide-react";
import {
  VideoSlot,
  AvatarCharacterId,
  ALL_VIDEO_SLOTS,
  AVATAR_CHARACTER_CONFIGS,
  getCharacterConfig,
  getActiveAvatarCharacter,
  setActiveAvatarCharacter,
  getAllMatrixCustomVideos,
  saveCharacterVideo,
  removeCharacterVideo,
  resetCharacterVideos,
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
}

const SLOTS: SlotInfo[] = [
  {
    slot: "looking",
    title: "Continuous Looking",
    role: "Idle & Listening",
    description:
      "Plays automatically when opening the app, while in idle state, and during quiet listening.",
    icon: Eye,
  },
  {
    slot: "talking",
    title: "Talking & Lip-Sync",
    role: "Speaking & Singing",
    description:
      "Plays whenever Nexa is talking, answering questions, explaining concepts, or singing.",
    icon: MessageSquare,
  },
  {
    slot: "thinking",
    title: "Thinking & Processing",
    role: "Internet Search & Reasoning",
    description:
      "Plays when Nexa is searching the live internet or processing complex prompts.",
    icon: Brain,
  },
  {
    slot: "kiss",
    title: "Kiss & Affection",
    role: "Full Affection Clip",
    description:
      "Plays full animation whenever you ask for affection or a sweet flying kiss.",
    icon: Heart,
  },
];

type MatrixBlobMap = Record<AvatarCharacterId, Record<VideoSlot, Blob | null>>;
type MatrixUrlMap = Record<AvatarCharacterId, Record<VideoSlot, string | null>>;

function emptyMatrixUrls(): MatrixUrlMap {
  return {
    purple: { looking: null, talking: null, thinking: null, kiss: null },
    pink: { looking: null, talking: null, thinking: null, kiss: null },
    realistic: { looking: null, talking: null, thinking: null, kiss: null },
  };
}

function emptyMatrixBlobs(): MatrixBlobMap {
  return {
    purple: { looking: null, talking: null, thinking: null, kiss: null },
    pink: { looking: null, talking: null, thinking: null, kiss: null },
    realistic: { looking: null, talking: null, thinking: null, kiss: null },
  };
}

export default function CustomVideoManagerModal({
  isOpen,
  onClose,
}: CustomVideoManagerModalProps) {
  const [activeCharacter, setActiveCharacter] = useState<AvatarCharacterId>(() =>
    getActiveAvatarCharacter()
  );
  const [selectedCharacter, setSelectedCharacter] = useState<AvatarCharacterId>(() =>
    getActiveAvatarCharacter()
  );
  const [matrixBlobs, setMatrixBlobs] = useState<MatrixBlobMap>(emptyMatrixBlobs);
  const [matrixUrls, setMatrixUrls] = useState<MatrixUrlMap>(emptyMatrixUrls);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState<"all" | AvatarCharacterId | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const createdUrlsRef = useRef<string[]>([]);
  const fileInputRefs = useRef<Record<VideoSlot, HTMLInputElement | null>>({
    looking: null,
    thinking: null,
    talking: null,
    kiss: null,
  });

  const showToast = useCallback((msg: string) => {
    setStatusMessage(msg);
    window.setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const loadMatrix = useCallback(async () => {
    const blobs = await getAllMatrixCustomVideos();

    createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    createdUrlsRef.current = [];

    const nextUrls = emptyMatrixUrls();
    (["purple", "pink", "realistic"] as AvatarCharacterId[]).forEach((charId) => {
      ALL_VIDEO_SLOTS.forEach((slot) => {
        const blob = blobs[charId][slot];
        if (blob) {
          const url = URL.createObjectURL(blob);
          createdUrlsRef.current.push(url);
          nextUrls[charId][slot] = url;
        }
      });
    });

    setMatrixBlobs(blobs);
    setMatrixUrls(nextUrls);
    setActiveCharacter(getActiveAvatarCharacter());
  }, []);

  useEffect(() => {
    if (isOpen) {
      const current = getActiveAvatarCharacter();
      setActiveCharacter(current);
      setSelectedCharacter(current);
      loadMatrix();
    }
    return () => {
      if (!isOpen) return;
      createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      createdUrlsRef.current = [];
    };
  }, [isOpen, loadMatrix]);

  if (!isOpen) return null;

  const selectedConfig = getCharacterConfig(selectedCharacter);
  const activeConfig = getCharacterConfig(activeCharacter);

  const handleSelectAndActivateCharacter = (charId: AvatarCharacterId) => {
    setSelectedCharacter(charId);
    setActiveAvatarCharacter(charId);
    setActiveCharacter(charId);
    const cfg = getCharacterConfig(charId);
    showToast(`Switched active screen avatar to ${cfg.name}`);
  };

  const handleFileUpload = async (slot: VideoSlot, file: File) => {
    if (!file) return;
    const key = `${selectedCharacter}:${slot}`;
    setUploadingSlot(key);
    try {
      await saveCharacterVideo(selectedCharacter, slot, file);
      await loadMatrix();
      // Activate this character automatically when user uploads a new video into it
      if (activeCharacter !== selectedCharacter) {
        setActiveAvatarCharacter(selectedCharacter);
        setActiveCharacter(selectedCharacter);
      }
      showToast(`Uploaded ${slot} video for ${selectedConfig.name}!`);
    } catch (e) {
      console.error("Failed to save character video:", e);
      showToast("Upload failed. Please check file format (.mp4, .webm, .mov).");
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleRemoveSlot = async (slot: VideoSlot) => {
    await removeCharacterVideo(selectedCharacter, slot);
    await loadMatrix();
    const hasStock = Boolean(selectedConfig.stockAssets[slot]);
    showToast(
      hasStock
        ? `Removed custom ${slot} video. Stock Asset restored.`
        : `Removed ${slot} video from ${selectedConfig.name}.`
    );
  };

  const handleResetCharacter = async (charId: AvatarCharacterId) => {
    await resetCharacterVideos(charId);
    await loadMatrix();
    const cfg = getCharacterConfig(charId);
    showToast(
      charId === "purple"
        ? `Reset ${cfg.shortLabel} back to Stock Assets.`
        : `Cleared all custom videos for ${cfg.shortLabel}.`
    );
  };

  const resolveSlotDisplay = (charId: AvatarCharacterId, slot: VideoSlot) => {
    const customUrl = matrixUrls[charId][slot];
    const cfg = getCharacterConfig(charId);
    const stockUrl = cfg.stockAssets[slot] || null;
    if (customUrl) {
      return { url: customUrl, isCustom: true, isStock: false };
    }
    if (stockUrl) {
      return { url: stockUrl, isCustom: false, isStock: true };
    }
    return { url: null, isCustom: false, isStock: false };
  };

  const getCustomCount = (charId: AvatarCharacterId) =>
    ALL_VIDEO_SLOTS.filter((s) => Boolean(matrixBlobs[charId][s])).length;

  const getFilledCount = (charId: AvatarCharacterId) =>
    ALL_VIDEO_SLOTS.filter((s) => Boolean(resolveSlotDisplay(charId, s).url)).length;

  const handleDownloadSingleSlot = async (charId: AvatarCharacterId, slot: VideoSlot) => {
    const blob = matrixBlobs[charId][slot];
    const cfg = getCharacterConfig(charId);
    const filename = `${charId}-${slot}.mp4`;

    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Downloading ${filename}`);
      return;
    }

    const stockUrl = cfg.stockAssets[slot];
    if (stockUrl) {
      const a = document.createElement("a");
      a.href = stockUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Downloading stock ${filename}`);
    }
  };

  const handleDownloadPack = async (charId: AvatarCharacterId) => {
    const cfg = getCharacterConfig(charId);
    if (getFilledCount(charId) === 0) {
      showToast(`No videos available in ${cfg.name} yet.`);
      return;
    }

    setDownloadingZip(charId);
    try {
      const zip = new JSZip();
      for (const slot of ALL_VIDEO_SLOTS) {
        const customBlob = matrixBlobs[charId][slot];
        if (customBlob) {
          zip.file(`${charId}-${slot}.mp4`, customBlob);
        } else if (cfg.stockAssets[slot]) {
          const resp = await fetch(cfg.stockAssets[slot]!);
          if (resp.ok) {
            const arr = await resp.arrayBuffer();
            zip.file(`${charId}-${slot}-stock.mp4`, arr);
          }
        }
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexa-${charId}-avatar-pack.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Downloaded ${cfg.shortLabel} Pack!`);
    } catch (e) {
      console.error("Failed to download character pack:", e);
      showToast("Failed to package videos.");
    } finally {
      setDownloadingZip(null);
    }
  };

  const handleDownloadAllMatrix = async () => {
    setDownloadingZip("all");
    try {
      const zip = new JSZip();
      for (const char of AVATAR_CHARACTER_CONFIGS) {
        const folder = zip.folder(char.id);
        if (!folder) continue;
        for (const slot of ALL_VIDEO_SLOTS) {
          const customBlob = matrixBlobs[char.id][slot];
          if (customBlob) {
            folder.file(`${slot}.mp4`, customBlob);
          } else if (char.stockAssets[slot]) {
            const resp = await fetch(char.stockAssets[slot]!);
            if (resp.ok) {
              const arr = await resp.arrayBuffer();
              folder.file(`${slot}-stock.mp4`, arr);
            }
          }
        }
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nexa-12-video-avatar-matrix.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Downloaded all available 12-Matrix videos!");
    } catch (e) {
      console.error("Failed to download full matrix:", e);
      showToast("Failed to create matrix archive.");
    } finally {
      setDownloadingZip(null);
    }
  };

  const selectedCustomCount = getCustomCount(selectedCharacter);
  const selectedFilledCount = getFilledCount(selectedCharacter);

  const getCharacterHeartColor = (charId: AvatarCharacterId) => {
    if (charId === "purple") return "text-purple-400 fill-purple-400";
    if (charId === "pink") return "text-pink-400 fill-pink-400";
    return "text-amber-300";
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-[#09090d] border border-purple-500/30 shadow-[0_0_90px_rgba(147,51,234,0.22)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-7 py-4 border-b border-white/10 bg-gradient-to-r from-purple-950/35 via-[#0b0b11] to-rose-950/20">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-2.5 rounded-2xl bg-purple-500/20 border border-purple-400/40 text-purple-300 shadow-[0_0_18px_rgba(168,85,247,0.35)] shrink-0">
                <Film size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-base sm:text-xl font-bold tracking-tight text-white">
                    12-Video Multi-Character Avatar Matrix
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-200 text-[11px] font-mono whitespace-nowrap">
                    3 Characters × 4 Actions = 12 Slots
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Switch effortlessly between Olivia Purple, Pink Hair, and Realistic AI with one click
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadAllMatrix}
                disabled={downloadingZip !== null}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {downloadingZip === "all" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                <span>Download All Matrix Videos</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white transition-colors border border-white/10 cursor-pointer"
                aria-label="Close Video Matrix"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* System Load Engine Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-7 py-2.5 border-b border-white/10 bg-[#0d1118]/90 text-xs">
            <div className="flex items-center gap-2.5 text-emerald-400 font-mono text-[11px] sm:text-xs">
              <Cpu size={15} className="shrink-0 text-emerald-400" />
              <span>
                System Load Engine: Zero GPU overhead. Only 1 video decodes at 60 FPS at any time. All 12 files are cached instantly in local IndexedDB.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <span className="text-[11px] font-mono text-neutral-400">Active on screen:</span>
              <span className="px-3 py-1 rounded-full bg-purple-600/25 border border-purple-400/50 text-purple-200 text-[10px] font-mono font-bold tracking-wider uppercase whitespace-nowrap">
                {activeConfig.screenBadge}
              </span>
            </div>
          </div>

          {/* Toast Notification */}
          <AnimatePresence>
            {statusMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mx-5 sm:mx-7 mt-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs flex items-center gap-2"
              >
                <Check size={14} className="text-emerald-400 shrink-0" />
                <span>{statusMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Scrollable Matrix Content */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-4 space-y-4">
            {/* Character Switcher Pills */}
            <div className="flex flex-wrap items-center gap-3">
              {AVATAR_CHARACTER_CONFIGS.map((char) => {
                const isSelected = selectedCharacter === char.id;
                const isActiveOnScreen = activeCharacter === char.id;
                const customCnt = getCustomCount(char.id);
                const filledCnt = getFilledCount(char.id);

                return (
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => handleSelectAndActivateCharacter(char.id)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-purple-600/20 border-purple-400 text-white shadow-[0_0_25px_rgba(168,85,247,0.3)]"
                        : "bg-white/[0.03] border-white/10 text-neutral-300 hover:bg-white/[0.07] hover:border-white/25"
                    }`}
                  >
                    {char.id === "realistic" ? (
                      <Sparkles size={15} className={getCharacterHeartColor(char.id)} />
                    ) : (
                      <Heart size={15} className={getCharacterHeartColor(char.id)} />
                    )}
                    <span className="whitespace-nowrap">{char.name}</span>

                    {isActiveOnScreen && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-mono font-bold tracking-wider uppercase">
                        ACTIVE
                      </span>
                    )}

                    <span className="px-2 py-0.5 rounded-md bg-black/50 border border-white/10 text-neutral-300 text-[10px] font-mono tabular-nums">
                      {char.id === "purple" && customCnt > 0
                        ? `${customCnt}/4 custom`
                        : `${filledCnt}/4`}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Pack Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDownloadPack(selectedCharacter)}
                  disabled={downloadingZip !== null || selectedFilledCount === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {downloadingZip === selectedCharacter ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  <span>Download {selectedConfig.shortLabel} Pack</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleResetCharacter(selectedCharacter)}
                  disabled={selectedCustomCount === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {selectedCharacter === "purple" ? (
                    <Trash2 size={14} />
                  ) : (
                    <RotateCcw size={14} />
                  )}
                  <span>Reset {selectedConfig.shortLabel}</span>
                </button>
              </div>
            </div>

            {/* Character Info Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-y border-white/10 text-xs">
              <div className="flex items-center gap-2 text-neutral-300">
                {selectedConfig.id === "realistic" ? (
                  <Sparkles size={14} className={getCharacterHeartColor(selectedConfig.id)} />
                ) : (
                  <Heart size={14} className={getCharacterHeartColor(selectedConfig.id)} />
                )}
                <span className="font-bold text-white">{selectedConfig.name}:</span>
                <span className="text-neutral-400">{selectedConfig.description}</span>
              </div>
              <div className="text-xs font-mono text-neutral-400 shrink-0">
                Hair: <span className="text-white font-semibold">{selectedConfig.hairLabel}</span>
              </div>
            </div>

            {/* 4 Action Video Cards Grid (2x2) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
              {SLOTS.map((item) => {
                const IconComponent = item.icon;
                const { url, isCustom, isStock } = resolveSlotDisplay(
                  selectedCharacter,
                  item.slot
                );
                const isUploading = uploadingSlot === `${selectedCharacter}:${item.slot}`;

                return (
                  <div
                    key={`${selectedCharacter}-${item.slot}`}
                    className="flex flex-col justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-purple-400/35 transition-all gap-3"
                  >
                    {/* Description */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    {/* Video Preview or Empty Upload Dropzone */}
                    {url ? (
                      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/10">
                        <video
                          key={`${selectedCharacter}-${item.slot}-${url}`}
                          src={url}
                          playsInline
                          muted
                          loop
                          autoPlay
                          className="w-full h-full object-cover"
                        />

                        {/* Top-Left Origin Pill */}
                        <span
                          className={`absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md text-[11px] font-semibold backdrop-blur-md border ${
                            isCustom
                              ? "bg-emerald-950/85 text-emerald-200 border-emerald-400/40"
                              : "bg-black/75 text-white/95 border-white/20"
                          }`}
                        >
                          {isCustom ? "Custom File" : "Stock Asset"}
                        </span>

                        {/* Top-Right Single File Download Button */}
                        <button
                          type="button"
                          onClick={() => handleDownloadSingleSlot(selectedCharacter, item.slot)}
                          className="absolute top-2.5 right-2.5 p-2 rounded-lg bg-black/75 hover:bg-black text-white border border-white/20 backdrop-blur-md transition-colors cursor-pointer"
                          title={`Download ${selectedConfig.shortLabel} ${item.title}`}
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRefs.current[item.slot]?.click()}
                        className="relative aspect-video w-full rounded-xl border border-dashed border-white/20 hover:border-purple-400/60 bg-black/50 flex flex-col items-center justify-center cursor-pointer transition-colors p-4 text-center group"
                      >
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-neutral-900/90 text-neutral-400 border border-white/10">
                          Empty Slot
                        </span>
                        <Upload
                          size={24}
                          className="text-neutral-500 group-hover:text-purple-400 transition-colors mb-2"
                        />
                        <span className="text-xs font-semibold text-neutral-200 group-hover:text-purple-200">
                          {isUploading
                            ? "Uploading..."
                            : `Click to Upload ${item.title}`}
                        </span>
                        <span className="text-[11px] text-neutral-500 mt-1">
                          Select .mp4, .webm or .mov from your device
                        </span>
                      </div>
                    )}

                    {/* Slot Header + Action Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-purple-300 shrink-0">
                          <IconComponent size={14} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-white truncate">
                            {item.title}
                          </h3>
                          <span className="text-[10px] font-mono text-neutral-400">
                            {item.role}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          ref={(el) => {
                            fileInputRefs.current[item.slot] = el;
                          }}
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(item.slot, file);
                            e.target.value = "";
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[item.slot]?.click()}
                          disabled={isUploading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-400/40 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
                        >
                          <Upload size={13} />
                          <span>
                            {isUploading
                              ? "Saving..."
                              : isCustom || isStock
                              ? "Replace Video"
                              : "Upload Video"}
                          </span>
                        </button>

                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSlot(item.slot)}
                            className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-colors cursor-pointer"
                            title={`Remove custom ${item.title} video`}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
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
