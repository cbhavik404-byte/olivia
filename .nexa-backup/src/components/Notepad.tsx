import React, { useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Copy, Trash2, Download, ExternalLink, FileText } from "lucide-react";

interface NotepadProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onChange: (value: string) => void;
}

export default function Notepad({ isOpen, onClose, content, onChange }: NotepadProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      // Visual feedback can be displayed as a transient notification
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleClear = () => {
    onChange("");
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Nexa_Notes_${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn("Download error:", e);
    }
  };

  const handleOpenExternal = () => {
    try {
      window.open("https://notepad.js.org/", "_blank");
    } catch (e) {
      console.warn("External open blocked:", e);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="notepad-modal-wrapper"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-end p-4 md:p-6 pointer-events-none"
        >
          {/* Glass Overlay backdrop */}
          <motion.div
            key="notepad-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
          />

          {/* Floating Notepad Panel */}
          <motion.div
            key="notepad-panel"
            initial={{ opacity: 0, x: 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 260 }}
            className="relative w-full max-w-lg h-[80vh] md:h-[85vh] bg-[#070b13]/90 border border-amber-500/30 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.15)] flex flex-col overflow-hidden backdrop-blur-xl pointer-events-auto z-10"
          >
            {/* Sci-fi top corner decorative accent */}
            <div className="absolute top-0 left-0 w-32 h-[2px] bg-gradient-to-r from-amber-500 to-transparent" />
            <div className="absolute top-0 left-0 w-[2px] h-32 bg-gradient-to-b from-amber-500 to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                  <FileText size={18} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-[0.2em] text-amber-400 uppercase">
                    Nexa's Personal Notepad
                  </h3>
                  <p className="text-[10px] font-mono tracking-widest text-white/40 uppercase">
                    Direct Sync & Quick Copy
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 bg-white/5 border border-white/10 rounded-xl text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
                title="Close Notepad"
              >
                <X size={16} />
              </button>
            </div>

            {/* Main Textarea Container */}
            <div className="flex-1 p-6 flex flex-col min-h-0">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Bhavik, ask me to draft an email or a prompt, or jot down anything here... I can write directly into this notepad for you! 😉"
                className="w-full flex-1 bg-white/[0.02] border border-white/5 rounded-2xl p-5 text-white placeholder:text-white/25 text-sm leading-relaxed outline-none focus:border-amber-500/30 focus:bg-white/[0.04] transition-all resize-none font-sans overflow-y-auto custom-scrollbar shadow-inner"
              />
            </div>

            {/* Action Bar / Footer */}
            <div className="px-6 py-5 border-t border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Left utilities */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  disabled={!content.trim()}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 disabled:opacity-40 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:scale-105 active:scale-95 cursor-pointer"
                  title="Copy to Clipboard"
                >
                  <Copy size={14} />
                  <span>COPY</span>
                </button>

                <button
                  onClick={handleDownload}
                  disabled={!content.trim()}
                  className="p-2.5 bg-white/5 border border-white/10 text-white/80 rounded-xl hover:text-white hover:bg-white/10 hover:border-white/20 disabled:opacity-40 transition-all cursor-pointer"
                  title="Download as Text File"
                >
                  <Download size={14} />
                </button>

                <button
                  onClick={handleClear}
                  disabled={!content.trim()}
                  className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 hover:border-red-500/40 transition-all cursor-pointer"
                  title="Clear Notepad"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* External Link */}
              <button
                onClick={handleOpenExternal}
                className="flex items-center gap-2 px-3.5 py-2 bg-blue-500/10 border border-blue-500/25 hover:bg-blue-500/20 hover:border-blue-500/40 text-blue-400 font-bold text-xs rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="Open Notepad.js.org"
              >
                <ExternalLink size={14} />
                <span>NOTEPAD.JS.ORG</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
