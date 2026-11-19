import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Send, Trash2, X, Sparkles, Rocket, Zap, Bot, Plus, GraduationCap, ImagePlus, Eye, Image as ImageIcon, Heart, Brain } from "lucide-react";
import { ChatMessage, Personality } from "../types";

interface CornerChatBoxProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string, image?: string) => void;
  isNexaTyping: boolean;
  typingMessageId: string | null;
  onClearChat: () => void;
  activePersona: Personality;
  isSessionActive: boolean;
}

export const CornerChatBox: React.FC<CornerChatBoxProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isNexaTyping,
  typingMessageId,
  onClearChat,
  activePersona,
  isSessionActive,
}) => {
  const [inputText, setInputText] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom whenever messages change or while typing
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isNexaTyping, typingMessageId, isOpen, attachedImage]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAttachedImage(reader.result);
        inputRef.current?.focus();
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset file input so re-selecting same file triggers change
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processFile(file);
          break;
        }
      }
    }
  }, [processFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend && !attachedImage) return;

    onSendMessage(textToSend, attachedImage || undefined);
    setInputText("");
    setAttachedImage(null);
  };

  const handleQuickImageAction = (promptText: string) => {
    if (!attachedImage) return;
    onSendMessage(promptText, attachedImage);
    setInputText("");
    setAttachedImage(null);
  };

  const getPersonaIcon = () => {
    switch (activePersona.id) {
      case "sensei":
        return <GraduationCap size={16} className="text-pink-400" />;
      case "oliviya":
      case "zoya":
        return <Sparkles size={16} className="text-pink-400" />;
      case "elon":
        return <Rocket size={16} className="text-cyan-400" />;
      case "altman":
        return <Zap size={16} className="text-emerald-400" />;
      case "jobs":
        return <Sparkles size={16} className="text-slate-300" />;
      default:
        return <Bot size={16} className="text-amber-400" />;
    }
  };

  const quickPrompts = activePersona.id === "sensei" ? [
    "See the study box and start teaching me from there 🌸",
    "Explain Question 1 visually on our blackboard!",
    "Give me an exam-level question to test my understanding",
    "Can you inspect an image and explain the concepts?",
  ] : activePersona.id === "zoya" ? [
    "Uff Bhavik, ab kya naya drama hai? 😉",
    "Google karna bhool gaye the kya, hero? 😈",
    "Zoya, roast me brutally!",
    "Give me one kiss, nakhrewali! 💋",
  ] : activePersona.id === "oliviya" ? [
    "Oliviya, go on the internet and find out about Elon's flying Tesla! 🌐",
    "Oliviya, let's create a naughty story together! 🔥",
    "Will you marry me, wifey? 💍",
    "Give your hubby one kiss! 💋",
  ] : [
    "Nexa, roast me with your Zoya wit! 😉",
    "Uff Bhavik, ab kya naya drama hai? ⚡",
    "Give me one single kiss, nakhrewali! 💋",
    "Check out my screen and give me your honest critique!",
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="corner-chatbot-window"
          initial={{ opacity: 0, x: -30, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          exit={{ opacity: 0, x: -30, y: 15, scale: 0.95 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="fixed bottom-24 left-3 sm:left-6 z-40 w-[92vw] sm:w-[410px] md:w-[440px] h-[550px] max-h-[calc(100dvh-140px)] flex flex-col bg-[#070a10]/95 backdrop-blur-2xl border border-amber-500/30 rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.85),0_0_25px_rgba(245,158,11,0.15)] overflow-hidden pointer-events-auto"
        >
          {/* Drag Overlay Indicator */}
          {isDragging && (
            <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md border-2 border-dashed border-amber-400 flex flex-col items-center justify-center gap-3 text-amber-300 pointer-events-none p-6 text-center animate-pulse">
              <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-400/40">
                <ImagePlus size={36} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Drop Image to Analyze & Advise</p>
                <p className="text-xs text-amber-200/70 mt-1">Nexa will inspect layouts, UI, code, designs, or screenshots</p>
              </div>
            </div>
          )}

          {/* Top Header Bar */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                {getPersonaIcon()}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs tracking-wider text-white uppercase">
                    {activePersona.shortName} CHAT & VISION
                  </span>
                  <span className="flex h-2 w-2 relative">
                    {isNexaTyping ? (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    ) : isSessionActive ? (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    ) : null}
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        isNexaTyping
                          ? "bg-amber-400"
                          : isSessionActive
                          ? "bg-emerald-400"
                          : "bg-amber-500/70"
                      }`}
                    />
                  </span>
                </div>
                <span className="text-[10px] text-white/45 font-mono">
                  {isSessionActive
                    ? "Voice Active • Multimodal Vision"
                    : isNexaTyping
                    ? "Analyzing & Typing..."
                    : "Multimodal Chat • Image Analysis Ready"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* "+ New Chat" Button */}
              <button
                type="button"
                onClick={() => {
                  onClearChat();
                  setInputText("");
                  setAttachedImage(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all shadow-xs"
                title="Start a fresh new chat conversation"
              >
                <Plus size={13} />
                <span>New Chat</span>
              </button>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClearChat();
                    setAttachedImage(null);
                  }}
                  className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Clear Chat History"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                title="Minimize Chat Box"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
                  <MessageSquare size={22} />
                </div>
                <h3 className="text-sm font-semibold text-white tracking-wide">
                  Chat & Multimodal Vision with {activePersona.shortName}
                </h3>
                <p className="text-xs text-white/50 mt-1 max-w-[300px]">
                  Type a prompt, attach or paste any image, and Nexa will analyze it visually to give sharp advice, audit designs, or solve problems!
                </p>

                <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                  <ImagePlus size={14} className="shrink-0" />
                  <span>Tip: You can paste screenshots with Ctrl+V or drag & drop</span>
                </div>

                <div className="mt-5 w-full flex flex-col gap-2">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono text-left">
                    Suggestions:
                  </span>
                  {quickPrompts.map((prompt, idx) => (
                    <button
                      key={`quick-prompt-${idx}`}
                      onClick={() => onSendMessage(prompt)}
                      className="text-left text-xs text-amber-200/80 hover:text-amber-100 bg-white/[0.03] hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/30 rounded-xl px-3 py-2 transition-all"
                    >
                      "{prompt}"
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isUser = msg.sender === "user";
                const isCurrentlyTyping = typingMessageId === msg.id;
                const cleanText = msg.text.replace(/\[(SASSY|DRAMATIC|HAPPY)\]/, "").trim();

                return (
                  <motion.div
                    key={`corner-chat-${msg.id || idx}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`group max-w-[88%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed flex flex-col gap-2 ${
                        isUser
                          ? "bg-amber-500/15 border border-amber-500/30 text-amber-100 rounded-tr-xs shadow-md"
                          : "bg-white/[0.07] border border-white/10 text-white/90 rounded-tl-xs shadow-md"
                      }`}
                    >
                      {/* Attached image if present */}
                      {msg.image && (
                        <div className="relative group rounded-xl overflow-hidden border border-white/15 bg-black/40">
                          <img
                            src={msg.image}
                            alt="User attached visual"
                            className="max-h-48 w-full object-contain rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() => setLightboxImage(msg.image || null)}
                          />
                          <button
                            type="button"
                            onClick={() => setLightboxImage(msg.image || null)}
                            className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/75 hover:bg-black text-white/80 hover:text-white border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px]"
                            title="Expand Image"
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </button>
                        </div>
                      )}

                      {cleanText && (
                        <div className="whitespace-pre-wrap">
                          <span>{cleanText}</span>
                          {isCurrentlyTyping && (
                            <span className="inline-block w-1.5 h-3.5 ml-1 bg-amber-400 animate-pulse align-middle" />
                          )}
                        </div>
                      )}

                      {cleanText && !isCurrentlyTyping && (
                        <div className="flex items-center justify-end pt-1 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                          <button
                            type="button"
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('nexa-open-memory-center', {
                                detail: {
                                  prefill: {
                                    title: isUser ? "Bhavik Note / Requirement" : `${activePersona.shortName} Insight`,
                                    content: cleanText,
                                    category: isUser ? "Preferences" : "Active",
                                    tags: ["chat", isUser ? "user" : "nexa"]
                                  }
                                }
                              }));
                            }}
                            className="flex items-center gap-1 text-zinc-400 hover:text-cyan-300 transition-colors"
                            title="Save this message to NEXA long-term memory"
                          >
                            <Brain size={11} className="text-cyan-400" />
                            <span>Save to Memory</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}

            {/* Waiting for response typing indicator */}
            {isNexaTyping && !typingMessageId && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start"
              >
                <div className="bg-white/[0.07] border border-white/10 text-white/80 rounded-2xl rounded-tl-xs px-3.5 py-2.5 flex items-center gap-2 shadow-md">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" />
                  </div>
                  <span className="text-xs text-white/60 font-mono tracking-tight">
                    {activePersona.shortName} is inspecting & typing...
                  </span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Attached Image Preview Bar before sending */}
          <AnimatePresence>
            {attachedImage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-3 pt-2.5 pb-1.5 bg-[#0b101b] border-t border-amber-500/30 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative group w-12 h-12 rounded-lg overflow-hidden border border-amber-500/40 bg-black/60 shrink-0">
                      <img
                        src={attachedImage}
                        alt="Attached Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setLightboxImage(attachedImage)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                        title="Expand Image"
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                        <ImageIcon size={13} />
                        Image Attached Ready for Nexa
                      </span>
                      <span className="text-[10px] text-white/50 font-mono">
                        Ready to analyze, review UI/UX, or give advice
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedImage(null)}
                    className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-red-400 transition-colors"
                    title="Remove attached image"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Quick Advice & Analysis Action Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleQuickImageAction("Analyze this image thoroughly and give me actionable advice.")}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 shrink-0 transition-colors font-medium flex items-center gap-1"
                  >
                    🔍 Analyze & Advise
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickImageAction("Review this design / layout. What are the flaws and how can I improve it?")}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 shrink-0 transition-colors"
                  >
                    🎨 UI/UX Review
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickImageAction("Inspect this image for any errors, bugs, or inconsistencies.")}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 shrink-0 transition-colors"
                  >
                    🐛 Spot Errors
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickImageAction("Extract all the visible text, formulas, or code from this image.")}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 shrink-0 transition-colors"
                  >
                    📝 Extract Text/Code
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Integrated Input Footer */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-white/10 bg-black/40 flex flex-col gap-1.5"
          >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageFileChange}
            />

            <div className="flex items-center gap-2 bg-white/[0.05] border border-amber-500/25 focus-within:border-amber-500/60 rounded-xl px-2.5 py-1.5 transition-colors">
              {/* Image Attachment Trigger Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`p-1.5 rounded-lg transition-all ${
                  attachedImage
                    ? "bg-amber-500 text-black shadow-xs font-bold"
                    : "text-amber-400 hover:text-amber-300 hover:bg-amber-500/15"
                }`}
                title="Attach an image or screenshot for Nexa to see (or paste with Ctrl+V)"
              >
                <ImagePlus size={16} />
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPaste={handlePaste}
                placeholder={attachedImage ? "Ask Nexa anything about this image..." : `Message ${activePersona.shortName} or paste image...`}
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/35 text-xs sm:text-sm py-1"
              />

              <button
                type="submit"
                disabled={!inputText.trim() && !attachedImage}
                className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-amber-500 transition-all text-black font-semibold shadow-sm"
                title="Send Message"
              >
                <Send size={14} />
              </button>
            </div>
            <div className="flex items-center justify-between px-1 text-[10px] text-white/30 font-mono">
              <span>Press Enter to send • Ctrl+V to paste image</span>
              <span>Vision & Analysis Enabled</span>
            </div>
          </form>
        </motion.div>
      )}

      {/* Lightbox Modal for Fullscreen Image View */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-fadeIn"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[85vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Close Image"
            >
              <X size={20} />
            </button>
            <img
              src={lightboxImage}
              alt="Enlarged Visual"
              className="max-w-full max-h-[80vh] object-contain rounded-xl border border-white/20 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
