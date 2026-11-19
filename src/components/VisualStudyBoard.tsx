import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  GraduationCap,
  BookOpen,
  UploadCloud,
  Search,
  Volume2,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Lightbulb,
  RefreshCw,
  Send,
  Download,
  Flame,
  Bookmark,
  Layers,
  MessageSquare
} from "lucide-react";
import { StudyBoxState, StudyDifficulty, StudyQuestion } from "../types";
import { GEMINI_MODELS } from "../config/modelRegistry";
import {
  getSavedStudyBox,
  saveStudyBox,
  analyzeStudyMaterial,
  searchAndFetchStudyMaterialOnline,
  explainVisuallyWithSensei
} from "../services/studyService";
import { getNexaAudio } from "../services/geminiService";
import { playPCM } from "../utils/audioUtils";

interface VisualStudyBoardProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSenseiPersonality?: () => void;
}

export const VisualStudyBoard: React.FC<VisualStudyBoardProps> = ({
  isOpen,
  onClose,
  onSwitchToSenseiPersonality,
}) => {
  const [studyBox, setStudyBox] = useState<StudyBoxState>(getSavedStudyBox);
  const [activeTab, setActiveTab] = useState<"blackboard" | "paper" | "chat" | "upload">("blackboard");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [onlineSearchQuery, setOnlineSearchQuery] = useState<string>("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<StudyDifficulty>(studyBox.difficultyLevel || "medium");
  const [chatInput, setChatInput] = useState<string>("");
  const [confusionNote, setConfusionNote] = useState<string>("");
  const [showVisualExplainModal, setShowVisualExplainModal] = useState<boolean>(false);
  const [practiceAnswerInput, setPracticeAnswerInput] = useState<string>("");
  const [showAnswerFeedback, setShowAnswerFeedback] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Sync with localStorage updates
  useEffect(() => {
    const handleUpdated = (e: any) => {
      if (e?.detail) {
        setStudyBox(e.detail);
      } else {
        setStudyBox(getSavedStudyBox());
      }
    };
    window.addEventListener("nexa-study-box-updated", handleUpdated);
    return () => window.removeEventListener("nexa-study-box-updated", handleUpdated);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [studyBox.studyChat, activeTab]);

  const currentQ: StudyQuestion | undefined =
    studyBox.questions && studyBox.questions[studyBox.currentQuestionIndex];

  // Voice narration using Aoi Sensei's voice (Aoede)
  const speakSenseiVoice = async (text: string) => {
    try {
      setIsSpeaking(true);
      const clean = text.replace(/\[.*?\]/g, "").replace(/[#*`]/g, "").trim();
      const base64Audio = await getNexaAudio(clean, "Aoede");
      if (base64Audio) {
        await playPCM(base64Audio);
      }
    } catch (err) {
      console.error("Sensei voice error:", err);
    } finally {
      setIsSpeaking(false);
    }
  };

  // Handle File Upload (PDF, image, text)
  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setLoadingText(`Aoi Sensei is analyzing "${file.name}" with visual intelligence...`);
    try {
      const mimeType = file.type || "application/pdf";
      if (mimeType.includes("pdf") || mimeType.includes("image")) {
        const reader = new FileReader();
        reader.onload = async () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          const analyzed = await analyzeStudyMaterial({
            name: file.name,
            mimeType,
            base64,
            level: selectedDifficulty,
          });
          setStudyBox(analyzed);
          setIsLoading(false);
          setActiveTab("blackboard");
          speakSenseiVoice(`Konnichiwa, Bhavik-kun! 🌸 I have examined your paper "${analyzed.sourceTitle}". Look at the blackboard for Question 1!`);
        };
        reader.readAsDataURL(file);
      } else {
        const text = await file.text();
        const analyzed = await analyzeStudyMaterial({
          name: file.name,
          text,
          level: selectedDifficulty,
        });
        setStudyBox(analyzed);
        setIsLoading(false);
        setActiveTab("blackboard");
        speakSenseiVoice(`Konnichiwa, Bhavik-kun! 🌸 I have analyzed your study material. Let's conquer Question 1 together!`);
      }
    } catch (err: any) {
      console.error("File analysis error:", err);
      speakSenseiVoice(`Gomen, Bhavik-kun! 🌸 Could not analyze the file cleanly. Let's try another document or search online.`);
      setIsLoading(false);
    }
  };

  // Handle Online Search for question paper / textbook
  const handleOnlineSearch = async (queryToSearch?: string) => {
    const q = queryToSearch || onlineSearchQuery;
    if (!q.trim()) return;
    setIsLoading(true);
    setLoadingText(`Searching Google & exam databases for "${q}" question papers...`);
    try {
      const result = await searchAndFetchStudyMaterialOnline(q.trim(), selectedDifficulty);
      setStudyBox(result);
      setIsLoading(false);
      setActiveTab("blackboard");
      speakSenseiVoice(`Sugoi, Bhavik-kun! 🌸 I found an authentic question bank for "${q}". Let's start with Question 1 on the blackboard!`);
    } catch (err: any) {
      console.error("Online study search error:", err);
      speakSenseiVoice(`Gomen, Bhavik-kun! 🌸 Search notice: ${err?.message || "Please check your network connection."}`);
      setIsLoading(false);
    }
  };

  // Visual Explanation trigger
  const handleExplainVisually = async () => {
    if (!currentQ) return;
    setIsLoading(true);
    setLoadingText("Aoi Sensei is drawing a new visual illustration on the blackboard...");
    try {
      const visualRes = await explainVisuallyWithSensei(currentQ, confusionNote || "Explain visually step-by-step");
      
      // Update the question's visual diagram & explanation
      const updatedQuestions = [...studyBox.questions];
      updatedQuestions[studyBox.currentQuestionIndex] = {
        ...currentQ,
        visualIllustration: visualRes.visualIllustration,
        explanation: `${visualRes.newExplanation}\n\n[Visual Insight]: ${visualRes.blackboardUpdate}`
      };

      const updatedBox: StudyBoxState = {
        ...studyBox,
        questions: updatedQuestions,
        blackboardNotes: `${studyBox.blackboardNotes}\n\n[VISUAL BREAKDOWN - Q${currentQ.questionNumber}]\n${visualRes.blackboardUpdate}`,
        studyChat: [
          ...studyBox.studyChat,
          {
            id: `explain-${Date.now()}`,
            sender: "sensei",
            text: visualRes.voiceScript,
            timestamp: Date.now(),
            visualSnippet: visualRes.visualIllustration
          }
        ]
      };

      setStudyBox(updatedBox);
      saveStudyBox(updatedBox);
      setIsLoading(false);
      setShowVisualExplainModal(false);
      setConfusionNote("");
      speakSenseiVoice(visualRes.voiceScript);
    } catch (err) {
      console.error("Visual explain error:", err);
      setIsLoading(false);
    }
  };

  // Navigate Questions
  const goToQuestion = (index: number) => {
    if (index >= 0 && index < studyBox.questions.length) {
      const updated = { ...studyBox, currentQuestionIndex: index };
      setStudyBox(updated);
      saveStudyBox(updated);
      setShowAnswerFeedback(false);
      setPracticeAnswerInput("");
    }
  };

  // Mark Question Mastered
  const toggleMastered = (index: number) => {
    const updatedQ = [...studyBox.questions];
    updatedQ[index] = { ...updatedQ[index], isMastered: !updatedQ[index].isMastered };
    const updated = { ...studyBox, questions: updatedQ };
    setStudyBox(updated);
    saveStudyBox(updated);
  };

  // Send Study Chat Message
  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    const newChat = [
      ...studyBox.studyChat,
      {
        id: `user-${Date.now()}`,
        sender: "student" as const,
        text: userMsg,
        timestamp: Date.now()
      }
    ];

    const updatedBox = { ...studyBox, studyChat: newChat };
    setStudyBox(updatedBox);
    saveStudyBox(updatedBox);
    setChatInput("");

    // Generate Sensei response
    (async () => {
      try {
        const prompt = `You are Aoi Sensei, Bhavik's encouraging anime visual teacher.
Current Subject: ${studyBox.subject} (${studyBox.sourceTitle})
Current Question: Q${currentQ?.questionNumber}: ${currentQ?.question}
Student says: "${userMsg}"

Respond in character:
- Address him as "Bhavik-kun"
- Cute, patient, highly motivating anime teacher tone (inflect with "Hai!", "Sugoi!", "Ganbatte! 🌸")
- If he asks for an explanation or hint, give a short, visual, intuitive hint in 2-3 sentences.`;

        const { getGeminiClient } = await import("../services/aiClient");
        const ai = getGeminiClient();
        if (ai) {
          const res = await ai.models.generateContent({
            model: GEMINI_MODELS.TEXT_PRIMARY,
            contents: [{ parts: [{ text: prompt }] }]
          });
          const replyText = res.text || "Hai Bhavik-kun! 🌸 Let's master this step together!";
          const replyChat = [
            ...newChat,
            {
              id: `sensei-${Date.now()}`,
              sender: "sensei" as const,
              text: replyText,
              timestamp: Date.now()
            }
          ];
          const finalBox = { ...studyBox, studyChat: replyChat };
          setStudyBox(finalBox);
          saveStudyBox(finalBox);
          speakSenseiVoice(replyText);
        }
      } catch (err) {
        console.error("Chat error:", err);
      }
    })();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="visual-study-board-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-xl pointer-events-auto"
      >
        <motion.div
          initial={{ scale: 0.96, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 20 }}
          className="relative w-full max-w-6xl h-[92vh] max-h-[900px] flex flex-col bg-[#0b1215] border border-emerald-500/30 rounded-3xl shadow-[0_20px_70px_rgba(0,0,0,0.95),0_0_35px_rgba(16,185,129,0.2)] overflow-hidden"
        >
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between px-5 py-3.5 bg-emerald-950/40 border-b border-emerald-500/20 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-400 flex items-center justify-center text-black font-black shadow-[0_0_15px_rgba(244,63,94,0.5)]">
                <GraduationCap size={22} className="text-white" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-1.5">
                    AOI SENSEI'S VISUAL STUDY BOARD
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-pink-500/20 text-pink-300 border border-pink-500/40">
                    ANIME TEACHER
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-300/80">
                  <span className="truncate max-w-[220px] sm:max-w-sm font-medium">
                    {studyBox.subject}
                  </span>
                  <span className="text-white/30">•</span>
                  <span className="text-[10px] font-mono text-white/50 uppercase">
                    Level: {studyBox.difficultyLevel.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Controls */}
            <div className="flex items-center gap-2">
              {/* Difficulty Level Switcher */}
              <div className="hidden sm:flex items-center bg-black/40 border border-white/10 p-1 rounded-xl text-xs gap-1">
                {(["easy", "medium", "hard"] as StudyDifficulty[]).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => {
                      setSelectedDifficulty(lvl);
                      const updated = { ...studyBox, difficultyLevel: lvl };
                      setStudyBox(updated);
                      saveStudyBox(updated);
                    }}
                    className={`px-2.5 py-1 rounded-lg capitalize font-mono text-[11px] transition-all ${
                      studyBox.difficultyLevel === lvl
                        ? lvl === "easy"
                          ? "bg-green-500 text-black font-bold"
                          : lvl === "medium"
                          ? "bg-amber-500 text-black font-bold"
                          : "bg-rose-500 text-white font-bold"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              {/* Speak Question / Lesson with Aoi Sensei */}
              <button
                onClick={() => {
                  if (currentQ) {
                    speakSenseiVoice(
                      `Bhavik-kun, here is Question ${currentQ.questionNumber}. ${currentQ.question}. Let's look at the blackboard. ${currentQ.explanation}`
                    );
                  }
                }}
                disabled={isSpeaking}
                className={`p-2 rounded-xl border transition-all flex items-center gap-1 text-xs font-semibold ${
                  isSpeaking
                    ? "bg-pink-500 text-white border-pink-400 animate-pulse shadow-[0_0_15px_rgba(236,72,153,0.6)]"
                    : "bg-pink-500/15 text-pink-300 border-pink-500/30 hover:bg-pink-500/25"
                }`}
                title="Hear Aoi Sensei explain in cute anime voice"
              >
                <Volume2 size={16} />
                <span className="hidden md:inline">{isSpeaking ? "Speaking..." : "Voice Lesson"}</span>
              </button>

              {/* Switch to Sensei Personality Mode */}
              {onSwitchToSenseiPersonality && (
                <button
                  onClick={() => {
                    onSwitchToSenseiPersonality();
                    speakSenseiVoice("Konnichiwa Bhavik-kun! 🌸 Aoi Sensei is now your active voice companion!");
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-semibold transition-all hidden lg:flex items-center gap-1.5"
                  title="Activate Sensei Mode globally"
                >
                  <Sparkles size={14} />
                  <span>Sensei Mode</span>
                </button>
              )}

              {/* Close Board */}
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                title="Close Visual Study Board"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center justify-between px-5 py-2 bg-black/40 border-b border-white/10 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("blackboard")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
                  activeTab === "blackboard"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <BookOpen size={14} />
                <span>Visual Blackboard</span>
              </button>

              <button
                onClick={() => setActiveTab("paper")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
                  activeTab === "paper"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <FileText size={14} />
                <span>Paper & Syllabus</span>
              </button>

              <button
                onClick={() => setActiveTab("chat")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
                  activeTab === "chat"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <MessageSquare size={14} />
                <span>Sensei Chat ({studyBox.studyChat.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("upload")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
                  activeTab === "upload"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <UploadCloud size={14} />
                <span>Upload / Find Online</span>
              </button>
            </div>

            {/* Questions Progress Indicator */}
            {studyBox.questions.length > 0 && (
              <div className="flex items-center gap-2 font-mono text-[11px] text-white/50">
                <span>
                  Question {studyBox.currentQuestionIndex + 1} of {studyBox.questions.length}
                </span>
                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400"
                    style={{
                      width: `${
                        ((studyBox.currentQuestionIndex + 1) / studyBox.questions.length) * 100
                      }%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mb-4" />
              <div className="text-lg font-bold text-emerald-300 tracking-wide">
                Aoi Sensei is at work! 🌸
              </div>
              <p className="text-sm text-white/60 max-w-md mt-2 animate-pulse">
                {loadingText}
              </p>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* TAB 1: VISUAL BLACKBOARD */}
            {activeTab === "blackboard" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Col: The Blackboard Canvas & Solution */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                  {currentQ ? (
                    <>
                      {/* Question Card */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs">
                              QUESTION {currentQ.questionNumber}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold ${
                              currentQ.difficulty === "easy"
                                ? "bg-green-500/20 text-green-300"
                                : currentQ.difficulty === "medium"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-rose-500/20 text-rose-300"
                            }`}>
                              {currentQ.difficulty}
                            </span>
                            {currentQ.marks && (
                              <span className="text-xs text-white/50 font-mono">
                                [{currentQ.marks} Marks]
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => toggleMastered(studyBox.currentQuestionIndex)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                              currentQ.isMastered
                                ? "bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.5)] font-bold"
                                : "bg-white/5 hover:bg-emerald-500/20 text-white/60 hover:text-emerald-300"
                            }`}
                          >
                            <CheckCircle2 size={14} />
                            <span>{currentQ.isMastered ? "Mastered!" : "Mark Mastered"}</span>
                          </button>
                        </div>

                        <div className="text-base sm:text-lg font-medium text-white leading-relaxed">
                          {currentQ.question}
                        </div>
                      </div>

                      {/* Visual Blackboard Container */}
                      <div className="rounded-2xl border-2 border-emerald-600/40 bg-[#07130f] p-4 sm:p-6 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
                        {/* Chalkboard texture background glow */}
                        <div className="absolute top-0 right-0 p-3 opacity-20 text-[10px] font-mono text-emerald-400">
                          VISUAL TEACHER CHALKBOARD • AOI SENSEI
                        </div>

                        <div className="flex items-center justify-between mb-3 border-b border-emerald-500/20 pb-2">
                          <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-300 uppercase tracking-wider">
                            <Sparkles size={14} className="text-pink-400" />
                            Visual Diagram & Representation
                          </div>
                          <button
                            onClick={() => setShowVisualExplainModal(true)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 transition-all font-semibold"
                          >
                            <HelpCircle size={13} />
                            <span>I Don't Understand (Visual Re-draw)</span>
                          </button>
                        </div>

                        {/* ASCII / Diagram Canvas */}
                        <pre className="font-mono text-xs sm:text-sm text-emerald-100 bg-black/60 p-4 rounded-xl overflow-x-auto border border-emerald-500/20 leading-snug whitespace-pre">
                          {currentQ.visualIllustration}
                        </pre>

                        {/* Step-by-Step Explanation */}
                        <div className="mt-4 pt-4 border-t border-emerald-500/20">
                          <div className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Lightbulb size={14} />
                            Step-by-Step Master Solution:
                          </div>
                          <div className="text-xs sm:text-sm text-white/90 leading-relaxed whitespace-pre-line bg-white/[0.02] p-3 rounded-xl border border-white/5">
                            {currentQ.explanation}
                          </div>
                        </div>

                        {/* Formulas & Exam Tip */}
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {currentQ.keyFormulas && currentQ.keyFormulas.length > 0 && (
                            <div className="p-3 rounded-xl bg-black/40 border border-cyan-500/30">
                              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider block mb-1.5">
                                Key Formulas
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {currentQ.keyFormulas.map((f, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 font-mono text-xs"
                                  >
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {currentQ.examTip && (
                            <div className="p-3 rounded-xl bg-black/40 border border-amber-500/30">
                              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                                <Flame size={12} />
                                Sensei Exam Trap Warning
                              </span>
                              <p className="text-xs text-amber-200/90 leading-normal">
                                {currentQ.examTip}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Question Navigation Bar */}
                      <div className="flex items-center justify-between pt-2">
                        <button
                          onClick={() => goToQuestion(studyBox.currentQuestionIndex - 1)}
                          disabled={studyBox.currentQuestionIndex === 0}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-xs font-semibold text-white transition-all"
                        >
                          <ChevronLeft size={16} />
                          <span>Previous Question</span>
                        </button>

                        <div className="flex items-center gap-1">
                          {studyBox.questions.map((q, idx) => (
                            <button
                              key={q.id}
                              onClick={() => goToQuestion(idx)}
                              className={`w-7 h-7 rounded-lg font-mono text-xs font-bold transition-all ${
                                studyBox.currentQuestionIndex === idx
                                  ? "bg-emerald-500 text-black shadow-md scale-110"
                                  : q.isMastered
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                                  : "bg-white/5 text-white/50 hover:bg-white/15 hover:text-white"
                              }`}
                            >
                              {idx + 1}
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={() => goToQuestion(studyBox.currentQuestionIndex + 1)}
                          disabled={studyBox.currentQuestionIndex === studyBox.questions.length - 1}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-30 disabled:hover:bg-emerald-500/20 text-xs font-semibold text-emerald-300 transition-all"
                        >
                          <span>Next Question</span>
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-white/50 bg-white/5 rounded-2xl">
                      No questions loaded yet. Upload a paper or search online!
                    </div>
                  )}
                </div>

                {/* Right Col: Quick Practice & Blackboard Notes */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                  {/* Practice Your Answer Box */}
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Bookmark size={14} className="text-pink-400" />
                        Solve & Test Yourself
                      </div>
                      <span className="text-[10px] text-white/40 font-mono">Bhavik's Workspace</span>
                    </div>

                    <textarea
                      value={practiceAnswerInput}
                      onChange={(e) => setPracticeAnswerInput(e.target.value)}
                      placeholder="Type your steps, final calculation, or formula here to test your understanding..."
                      rows={4}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500 resize-none font-mono"
                    />

                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setShowAnswerFeedback(!showAnswerFeedback)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold border border-emerald-500/40 transition-all"
                      >
                        {showAnswerFeedback ? "Hide Master Solution" : "Check My Steps"}
                      </button>

                      <button
                        onClick={() => {
                          if (practiceAnswerInput.trim()) {
                            setChatInput(`Sensei, check my answer for Q${currentQ?.questionNumber}: "${practiceAnswerInput.trim()}"`);
                            setActiveTab("chat");
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 text-xs font-semibold border border-pink-500/40 transition-all"
                      >
                        Ask Sensei to Grade
                      </button>
                    </div>

                    {showAnswerFeedback && currentQ && (
                      <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200">
                        <span className="font-bold block mb-1 text-emerald-400">Master Steps:</span>
                        {currentQ.explanation}
                      </div>
                    )}
                  </div>

                  {/* Aoi Sensei's Blackboard Chalk Ledger */}
                  <div className="p-4 rounded-2xl bg-[#091512] border border-emerald-500/25 flex flex-col gap-2 flex-1">
                    <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                      <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={14} />
                        Sensei's Running Notes
                      </span>
                      <span className="text-[10px] text-white/40 font-mono">Auto-saved</span>
                    </div>

                    <textarea
                      value={studyBox.blackboardNotes}
                      onChange={(e) => {
                        const updated = { ...studyBox, blackboardNotes: e.target.value };
                        setStudyBox(updated);
                        saveStudyBox(updated);
                      }}
                      rows={10}
                      className="w-full bg-transparent border-none outline-none text-xs font-mono text-emerald-200/90 leading-relaxed resize-none p-1 scrollbar-thin"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PAPER & SYLLABUS BREAKDOWN */}
            {activeTab === "paper" && (
              <div className="space-y-6">
                {/* Paper Summary Card */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">{studyBox.sourceTitle}</h3>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono uppercase font-bold border border-emerald-500/40">
                      {studyBox.sourceType.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {studyBox.overviewSummary}
                  </p>
                </div>

                {/* Syllabus & Weightage Cards */}
                <div>
                  <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider font-mono mb-3">
                    Syllabus Weightage & High-Yield Exam Topics
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {studyBox.syllabusBreakdown.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col gap-2 hover:border-emerald-500/30 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{item.topic}</span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                            {item.weightage}
                          </span>
                        </div>
                        <p className="text-xs text-white/60 leading-normal">
                          {item.importantTips}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* All Questions Directory */}
                <div>
                  <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider font-mono mb-3">
                    Question Paper Index ({studyBox.questions.length} Total Questions)
                  </h4>
                  <div className="space-y-2">
                    {studyBox.questions.map((q, idx) => (
                      <div
                        key={q.id}
                        onClick={() => {
                          goToQuestion(idx);
                          setActiveTab("blackboard");
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          studyBox.currentQuestionIndex === idx
                            ? "bg-emerald-500/20 border-emerald-400 text-white"
                            : "bg-white/[0.02] border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center font-mono text-xs font-bold">
                            {q.questionNumber}
                          </span>
                          <span className="text-xs truncate max-w-lg">{q.question}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                            q.difficulty === "easy"
                              ? "bg-green-500/20 text-green-300"
                              : q.difficulty === "medium"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-rose-500/20 text-rose-300"
                          }`}>
                            {q.difficulty}
                          </span>
                          {q.isMastered && (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SENSEI STUDY CHAT */}
            {activeTab === "chat" && (
              <div className="h-[550px] flex flex-col bg-[#070e0c] border border-emerald-500/20 rounded-2xl overflow-hidden">
                {/* Chat Message Scroll */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {studyBox.studyChat.map((msg) => {
                    const isSensei = msg.sender === "sensei";
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isSensei ? "items-start" : "items-end"}`}
                      >
                        <div
                          className={`max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                            isSensei
                              ? "bg-emerald-950/50 border border-emerald-500/30 text-emerald-100 rounded-tl-xs shadow-md"
                              : "bg-pink-500/20 border border-pink-500/40 text-pink-100 rounded-tr-xs shadow-md"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                              {isSensei ? "Aoi Sensei 🌸" : "Bhavik"}
                            </span>
                            {isSensei && (
                              <button
                                onClick={() => speakSenseiVoice(msg.text)}
                                className="text-white/40 hover:text-pink-300 transition-colors"
                                title="Listen to Aoi Sensei"
                              >
                                <Volume2 size={13} />
                              </button>
                            )}
                          </div>
                          <div className="whitespace-pre-line">{msg.text}</div>

                          {msg.visualSnippet && (
                            <pre className="mt-2 font-mono text-[11px] text-emerald-300 bg-black/60 p-2.5 rounded-lg border border-emerald-500/20 overflow-x-auto">
                              {msg.visualSnippet}
                            </pre>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatBottomRef} />
                </div>

                {/* Chat Input */}
                <form
                  onSubmit={handleSendChat}
                  className="p-3 bg-black/60 border-t border-emerald-500/20 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask Aoi Sensei anything about this paper or concept..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 text-black font-bold transition-all"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            )}

            {/* TAB 4: UPLOAD OR SEARCH ONLINE */}
            {activeTab === "upload" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload Local Paper / PDF / Image */}
                <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <UploadCloud size={28} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">
                      Upload Question Paper or Textbook PDF
                    </h4>
                    <p className="text-xs text-white/50 mt-1 max-w-xs">
                      Drop sample papers, board exam PDFs, textbook chapters, or photos of homework notes.
                    </p>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-lg transition-all"
                  >
                    Browse & Upload File
                  </button>
                </div>

                {/* Search Web / Google for Question Papers */}
                <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
                      <Search size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Find Paper & Textbook Online
                      </h4>
                      <p className="text-xs text-white/50">
                        Nexa searches Google for authentic papers and syllabus
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={onlineSearchQuery}
                      onChange={(e) => setOnlineSearchQuery(e.target.value)}
                      placeholder="e.g. CBSE Class 10 Science, JEE Physics, Python Exam..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-400"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleOnlineSearch();
                      }}
                    />
                    <button
                      onClick={() => handleOnlineSearch()}
                      className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-xs transition-all shrink-0"
                    >
                      Search
                    </button>
                  </div>

                  {/* Popular Preset Quick Searches */}
                  <div className="mt-2">
                    <span className="text-[10px] font-mono uppercase text-white/40 tracking-wider block mb-2">
                      Quick Syllabus Presets:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "CBSE Class 10 Science Board Paper",
                        "CBSE Class 12 Physics Electromagnetism",
                        "JEE Main Mathematics Calculus Exam",
                        "Class 10 Linear Equations & Polynomials",
                        "Python Data Structures College Exam Paper",
                        "Organic Chemistry Reaction Mechanisms"
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setOnlineSearchQuery(preset);
                            handleOnlineSearch(preset);
                          }}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/30 text-white/70 hover:text-white transition-all text-left"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Visual Explanation Modal ("I Don't Understand") */}
        <AnimatePresence>
          {showVisualExplainModal && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
            >
              <div className="w-full max-w-lg bg-[#081512] border border-pink-500/40 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🌸</span>
                    <h3 className="text-base font-bold text-white">
                      Ask Aoi Sensei for a Visual Re-Draw
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowVisualExplainModal(false)}
                    className="p-1 text-white/50 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <p className="text-xs text-white/70">
                  Tell Sensei which part confused you! She will draw a brand new visual diagram on the blackboard and explain it with simple analogies in her anime voice.
                </p>

                <textarea
                  value={confusionNote}
                  onChange={(e) => setConfusionNote(e.target.value)}
                  placeholder="e.g. I don't get why the sign is negative, or draw the rays more simply..."
                  rows={3}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-pink-400"
                />

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowVisualExplainModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-white/60 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExplainVisually}
                    className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-xs shadow-lg transition-all"
                  >
                    Re-Draw Visually 🌸
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default VisualStudyBoard;
