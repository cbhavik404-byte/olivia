import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, Camera, Monitor, Calendar, CheckSquare, X, Globe, Flame, Download, FolderArchive, Wand2, Zap, Film, RefreshCw, Clock, Play, Pause, Notebook, Sliders, MessageSquare, CloudRain, Sparkles, UserCheck, Rocket, Compass, CheckCircle2, Heart, GraduationCap, Server, Brain } from "lucide-react";
import { getNexaResponse, getNexaAudio, resetNexaSession } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import { DeviceManager } from "./services/android/DeviceManager";
import Visualizer from "./components/Visualizer";
import KissOverlay from "./components/KissOverlay";
import PermissionModal from "./components/PermissionModal";
import HabitTracker from "./components/HabitTracker";
import Notepad from "./components/Notepad";
import SettingsModal from "./components/SettingsModal";
import BulkWhatsAppModal from "./components/BulkWhatsAppModal";
import SoundscapePlayer, { SoundscapeType } from "./components/SoundscapePlayer";
import LeadFinderModal from "./components/LeadFinderModal";
import CreationStudioModal from "./components/CreationStudioModal";
import PersonalitySidebar from "./components/PersonalitySidebar";
import VisualStudyBoard from "./components/VisualStudyBoard";
import { CornerChatBox } from "./components/CornerChatBox";
import { DeviceBatteryIndicator } from "./components/DeviceBatteryIndicator";
import LocalSystemBridgeModal from "./components/LocalSystemBridgeModal";
import CustomVideoManagerModal from "./components/CustomVideoManagerModal";
import NexaMemoryCenterModal from "./components/NexaMemoryCenterModal";
import { nexaMemoryStorage } from "./services/nexaMemoryStorage";
import { localSystemBridge } from "./services/localSystemBridge";
import { runAutonomousToolChain, isCompoundOrAutonomousIntent, PipelineStep, AutonomousToolHandlers } from "./services/autonomousChainService";
import { fastWebSearch, multiSourceIntelligenceSearch } from "./services/fastSearchService";
import { batteryService } from "./services/batteryService";
import { getPersonalityById, getAllPersonalities } from "./personalities";
import { playPCM, stopAllPCM, playBirthdayMelody, playSingingAccompaniment, stopSingingAccompaniment } from "./utils/audioUtils";
import { sanitizeSpeechAndFiller } from "./utils/textSanitizer";
import { isGuidanceViolation } from "./utils/safety";
import { motion, AnimatePresence } from "motion/react";
import JSZip from "jszip";
import { AppState, ChatMessage, NexaMood, Habit, PersonalityMode, KissAnimationType } from "./types";
import { transcribeSongFromGoogleAndYouTube } from "./services/songService";
import { conversationState } from "./services/conversationState";
import { memoryManager } from "./services/memoryManager";
import { voiceEmotionService } from "./services/voiceEmotionService";

function getUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "msg-" + Math.random().toString(36).substring(2, 15) + "-" + Date.now();
}

const formatTime = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [currentMood, setCurrentMood] = useState<NexaMood>("neutral");
  const [isKissing, setIsKissing] = useState(false);
  const [isKissEffectEnabled, setIsKissEffectEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("nexa_kiss_effect_enabled");
    return saved !== null ? saved === "true" : true;
  });
  const [kissAnimationType, setKissAnimationType] = useState<KissAnimationType>(() => {
    const saved = localStorage.getItem("nexa_kiss_animation_type");
    return (saved === "heart_burst" || saved === "floating_lips" || saved === "love_letter_swarm")
      ? (saved as KissAnimationType)
      : "floating_lips";
  });

  const handleKissAnimationTypeChange = useCallback((type: KissAnimationType) => {
    setKissAnimationType(type);
    localStorage.setItem("nexa_kiss_animation_type", type);
  }, []);

  const handleToggleKissEffectEnabled = useCallback((enabled: boolean) => {
    setIsKissEffectEnabled(enabled);
    localStorage.setItem("nexa_kiss_effect_enabled", enabled ? "true" : "false");
    if (!enabled) {
      setIsKissing(false);
    }
  }, []);

  const [isShy, setIsShy] = useState<boolean>(false);
  const shyTimerRef = useRef<any>(null);

  const triggerShy = useCallback((durationMs: number = 8000) => {
    setIsShy(true);
    setCurrentMood("shy");
    if (shyTimerRef.current) {
      clearTimeout(shyTimerRef.current);
    }
    shyTimerRef.current = setTimeout(() => {
      setIsShy(false);
      setCurrentMood("happy");
    }, durationMs);
  }, []);

  const [activeSubtitleText, setActiveSubtitleText] = useState<string>("");
  const subtitleClearTimeoutRef = useRef<any>(null);

  const updateSubtitle = useCallback((text: string) => {
    if (subtitleClearTimeoutRef.current) {
      clearTimeout(subtitleClearTimeoutRef.current);
      subtitleClearTimeoutRef.current = null;
    }
    const cleaned = sanitizeSpeechAndFiller(text).trim();
    setActiveSubtitleText(cleaned);
  }, []);

  const clearSubtitleDelayed = useCallback((delayMs: number = 3500) => {
    if (subtitleClearTimeoutRef.current) {
      clearTimeout(subtitleClearTimeoutRef.current);
    }
    subtitleClearTimeoutRef.current = setTimeout(() => {
      setActiveSubtitleText("");
    }, delayMs);
  }, []);

  useEffect(() => {
    return () => {
      if (shyTimerRef.current) clearTimeout(shyTimerRef.current);
      if (subtitleClearTimeoutRef.current) clearTimeout(subtitleClearTimeoutRef.current);
    };
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("nexa_chat_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const seen = new Set();
        return parsed
          .filter((m: any) => {
            const text = (m.text || "").toLowerCase();
            return !(
              text.includes("headache") ||
              text.includes("brain is paining") ||
              text.includes("brain was paining") ||
              text.includes("head is paining") ||
              text.includes("head was paining") ||
              text.includes("ugc ad") ||
              text.includes("create a ugc")
            );
          })
          .map((m: any) => {
            const newId = (!m.id || seen.has(m.id)) ? getUUID() : m.id;
            seen.add(newId);
            return { ...m, id: newId };
          });
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [];
  });
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    try {
      // Clean up messages for storage: keep last 50 messages, avoid storing multi-megabyte raw base64 images if quota is tight
      const trimmed = messages.slice(-50).map(m => {
        if (m.image && m.image.length > 50000) {
          return { ...m, image: undefined };
        }
        return m;
      });
      localStorage.setItem("nexa_chat_history", JSON.stringify(trimmed));
    } catch (quotaError) {
      console.warn("Storage quota exceeded saving chat history. Trimming older entries...", quotaError);
      try {
        const minimal = messages.slice(-15).map(m => ({
          id: m.id,
          sender: m.sender,
          text: m.text,
          timestamp: m.timestamp
        }));
        localStorage.setItem("nexa_chat_history", JSON.stringify(minimal));
      } catch (e2) {
        console.warn("Could not save chat history to localStorage:", e2);
      }
    }
    if (liveSessionRef.current && messages.length > 0) {
      const history = messages
        .filter(m => (m.sender === "user" || m.sender === "nexa") && m.text)
        .map(m => ({ sender: m.sender as "user" | "nexa", text: m.text }));
      liveSessionRef.current.syncHistory(history);
    }
  }, [messages]);

  const [isMuted, setIsMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showHabits, setShowHabits] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isNexaTyping, setIsNexaTyping] = useState(false);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const typingIntervalRef = useRef<any>(null);
  const kissTimerRef = useRef<any>(null);
  const [showPersonalitySidebar, setShowPersonalitySidebar] = useState(false);
  const [personalityMode, setPersonalityMode] = useState<PersonalityMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nexa_personality_mode");
      if (saved && saved !== "roast" && saved !== "jarvis" && saved !== "coco") {
        return saved as PersonalityMode;
      }
    }
    return "default";
  });

  const activePersona = getPersonalityById(personalityMode);

  const switchPersonalityMode = async (newMode: PersonalityMode, announce: boolean = true) => {
    const targetPersona = getPersonalityById(newMode);
    const resolvedMode = targetPersona.id as PersonalityMode;

    setPersonalityMode(resolvedMode);
    localStorage.setItem("nexa_personality_mode", resolvedMode);
    
    // Automatically match voice to the selected personality gender / preset
    const targetVoice = targetPersona.defaultVoice || (targetPersona.gender === "male" ? "Fenrir" : "Zephyr");
    setVoiceName(targetVoice);
    localStorage.setItem("nexa_voice_name", targetVoice);

    resetNexaSession();

    // Hot-swap in live session WITHOUT terminating or ending the conversation
    if (isSessionActive && liveSessionRef.current) {
      await liveSessionRef.current.switchPersonalityAndVoice(resolvedMode, targetVoice, announce);
    }
  };

  const [visionMode, setVisionMode] = useState<'camera' | 'screen' | 'none'>('none');

  const [habits, setHabits] = useState<Habit[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nexa_habits");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const seen = new Set();
          return parsed.map((h: any, idx: number) => {
            const newId = (!h.id || seen.has(h.id)) ? `habit-${idx}-${Date.now()}` : h.id;
            seen.add(newId);
            return { ...h, id: newId };
          });
        } catch (e) {
          console.error("Failed to parse habits", e);
        }
      }
    }
    return [
      { id: "1", name: "Drink Water", completedDays: [] },
      { id: "2", name: "Meditation", completedDays: [] }
    ];
  });

  useEffect(() => {
    localStorage.setItem("nexa_habits", JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];

    const handleRemoteUpdate = (e: any) => {
      const { habitTitle, completed } = e.detail;
      setHabits(prev => prev.map(h => {
        if (h.name.toLowerCase().includes(habitTitle.toLowerCase())) {
          const isCurrentlyCompleted = h.completedDays.includes(today);
          if (completed && !isCurrentlyCompleted) {
            return { ...h, completedDays: [...h.completedDays, today] };
          } else if (!completed && isCurrentlyCompleted) {
            return { ...h, completedDays: h.completedDays.filter(d => d !== today) };
          }
        }
        return h;
      }));
    };
    window.addEventListener('nexa-update-habit', handleRemoteUpdate);
    
    const handleRemoteAdd = (e: any) => {
      const { habitTitle } = e.detail;
      setHabits(prev => {
        if (prev.some(h => h.name.toLowerCase() === habitTitle.toLowerCase())) return prev;
        const newId = "habit-" + Math.random().toString(36).substring(2, 15) + "-" + Date.now();
        return [...prev, { id: newId, name: habitTitle, completedDays: [] }];
      });
    };
    window.addEventListener('nexa-add-habit', handleRemoteAdd);

    const handleOpenVideoManager = () => setShowCustomVideoManager(true);
    window.addEventListener('nexa-open-custom-videos-manager', handleOpenVideoManager);

    return () => {
      window.removeEventListener('nexa-update-habit', handleRemoteUpdate);
      window.removeEventListener('nexa-add-habit', handleRemoteAdd);
      window.removeEventListener('nexa-open-custom-videos-manager', handleOpenVideoManager);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.setMicMuted(isMicMuted);
    }
  }, [isMicMuted]);

  const toggleMicListening = () => {
    setIsMicMuted(prev => {
      const next = !prev;
      if (liveSessionRef.current) {
        liveSessionRef.current.setMicMuted(next);
      }
      return next;
    });
  };

  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [audioEnergy, setAudioEnergy] = useState(0);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);

  // Timer States
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number | null>(null);
  const [timerTotalSeconds, setTimerTotalSeconds] = useState<number | null>(null);
  const [timerLabel, setTimerLabel] = useState<string>("");
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);

  // Notepad States
  const [showNotepad, setShowNotepad] = useState(false);
  const [notepadContent, setNotepadContent] = useState("");
  const notepadContentRef = useRef("");

  // Settings, Voice Pitch & Music Perception States
  const [showSettings, setShowSettings] = useState(false);
  const [voicePitch, setVoicePitch] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nexa_voice_pitch");
      if (saved) {
        const p = parseFloat(saved);
        if (!isNaN(p) && p >= 0.5 && p <= 2.0) return p;
      }
    }
    return 1.0;
  });
  const [voiceName, setVoiceName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nexa_voice_name");
      const valid = ["Aoede", "Kore", "Zephyr", "Puck", "Charon", "Fenrir"];
      if (saved && valid.includes(saved) && saved !== "Kore") return saved;
      localStorage.setItem("nexa_voice_name", "Zephyr");
      return "Zephyr";
    }
    return "Zephyr";
  });
  const [isDancing, setIsDancing] = useState<boolean>(false);
  const [singingState, setSingingState] = useState<{ isSinging: boolean; songTitle: string; genre: string } | null>(null);
  const singingTimerRef = useRef<any>(null);
  const singingRunIdRef = useRef<number>(0);

  // AI Lead Finder & Outreach Agent Modal State
  const [showLeadFinder, setShowLeadFinder] = useState<boolean>(false);

  // NEXA Creation Studio Modal State (PPT, Thumbnails, Website, Documents, Proposals)
  const [showCreationStudio, setShowCreationStudio] = useState<boolean>(false);
  const [creationStudioTab, setCreationStudioTab] = useState<"ppt" | "thumbnail" | "website" | "document" | "proposal">("ppt");

  // Bulk WhatsApp Modal State
  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState<boolean>(false);
  const [bulkWhatsAppNumbers, setBulkWhatsAppNumbers] = useState<string[]>([]);
  const [bulkWhatsAppMsg, setBulkWhatsAppMsg] = useState<string>("");

  // Soundscape Player State
  const [showSoundscapePlayer, setShowSoundscapePlayer] = useState<boolean>(false);
  const [focusSoundscapeType, setFocusSoundscapeType] = useState<SoundscapeType>("off");

  // Custom Avatar Video Manager State (Upload / Manage newly created videos)
  const [showCustomVideoManager, setShowCustomVideoManager] = useState<boolean>(false);

  // JARVIS Autonomous Tool-Chaining Pipeline States
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [isPipelineRunning, setIsPipelineRunning] = useState<boolean>(false);

  // Visual Study Board & Teacher State (Aoi Sensei Question Paper & Blackboard Mentor)
  const [showStudyBoard, setShowStudyBoard] = useState<boolean>(false);

  // Local System Automation Bridge State (Desktop/OS daemon connection)
  const [showLocalBridgeModal, setShowLocalBridgeModal] = useState<boolean>(false);

  // NEXA Cognitive Memory Center Modal State
  const [showMemoryCenter, setShowMemoryCenter] = useState<boolean>(false);
  const [memoryCenterPrefill, setMemoryCenterPrefill] = useState<{
    title?: string;
    content?: string;
    category?: any;
    tags?: string[];
  } | null>(null);
  const [totalMemoryCount, setTotalMemoryCount] = useState<number>(0);

  useEffect(() => {
    const handleOpenMemoryCenter = (e: any) => {
      if (e?.detail?.prefill) {
        setMemoryCenterPrefill(e.detail.prefill);
      }
      setShowMemoryCenter(true);
    };

    const handleMemoryChanged = () => {
      nexaMemoryStorage.getAll().then(all => setTotalMemoryCount(all.length)).catch(() => {});
    };

    window.addEventListener('nexa-open-memory-center', handleOpenMemoryCenter);
    window.addEventListener('nexa-memory-changed', handleMemoryChanged);

    // Initial count fetch
    nexaMemoryStorage.getAll().then(all => setTotalMemoryCount(all.length)).catch(() => {});

    return () => {
      window.removeEventListener('nexa-open-memory-center', handleOpenMemoryCenter);
      window.removeEventListener('nexa-memory-changed', handleMemoryChanged);
    };
  }, []);

  // Real-time Screen Awareness: synchronize active on-screen panels with conversation state (Sections 27 & 28)
  useEffect(() => {
    if (showStudyBoard) conversationState.setActivePanel('study_board');
    else if (showMemoryCenter) conversationState.setActivePanel('memory_center' as any);
    else if (showNotepad) conversationState.setActivePanel('notepad');
    else if (showHabits) conversationState.setActivePanel('habits');
    else if (showSettings) conversationState.setActivePanel('settings');
    else if (showLeadFinder) conversationState.setActivePanel('lead_finder');
    else if (showCreationStudio) conversationState.setActivePanel('creation_studio');
    else if (showBulkWhatsAppModal) conversationState.setActivePanel('whatsapp');
    else if (showSoundscapePlayer) conversationState.setActivePanel('soundscapes');
    else if (showLocalBridgeModal) conversationState.setActivePanel('local_bridge');
    else conversationState.setActivePanel(null);
  }, [showStudyBoard, showMemoryCenter, showNotepad, showHabits, showSettings, showLeadFinder, showCreationStudio, showBulkWhatsAppModal, showSoundscapePlayer, showLocalBridgeModal]);

  const handlePitchChange = (newPitch: number) => {
    setVoicePitch(newPitch);
    if (liveSessionRef.current) {
      liveSessionRef.current.setVoicePitch(newPitch);
    } else {
      localStorage.setItem("nexa_voice_pitch", String(newPitch));
    }
  };

  const handleVoiceChange = (newVoice: string) => {
    setVoiceName(newVoice);
    localStorage.setItem("nexa_voice_name", newVoice);
    if (liveSessionRef.current) {
      liveSessionRef.current.setVoiceName(newVoice);
    }
  };

  useEffect(() => {
    notepadContentRef.current = notepadContent;
  }, [notepadContent]);
  const [showMemeVideo, setShowMemeVideo] = useState(false);

  const handleTimerEnd = useCallback(async () => {
    const shoutText = "Your time is over.";
    setMessages(prev => [...prev, { id: getUUID(), sender: "nexa", text: shoutText }]);
    
    setCurrentMood("sassy");
    setAppState("speaking");
    
    try {
      const audioBase64 = await getNexaAudio(shoutText);
      if (audioBase64) {
        await playPCM(audioBase64, 4.0); // Make it play 4 times louder for shouting
      }
    } catch (e) {
      console.error("Failed to play timer end voice", e);
    }
    setAppState("idle");
    setCurrentMood("neutral");
    
    setTimerSecondsLeft(null);
    setTimerTotalSeconds(null);
    setTimerLabel("");
    setIsTimerActive(false);
  }, []);

  useEffect(() => {
    let intervalId: any;
    if (isTimerActive && timerSecondsLeft !== null && timerSecondsLeft > 0) {
      intervalId = setInterval(() => {
        setTimerSecondsLeft(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(intervalId);
            setIsTimerActive(false);
            handleTimerEnd();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isTimerActive, timerSecondsLeft, handleTimerEnd]);



  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const playKissSound = useCallback(() => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const audioCtx = new AudioCtxClass();
        const now = audioCtx.currentTime;

        // Create white noise buffer for realistic lip friction
        const bufferSize = audioCtx.sampleRate * 0.45; // 0.45 seconds
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        // 1. Wet suction release sound (bandpass filtered white noise)
        const noiseNode = audioCtx.createBufferSource();
        noiseNode.buffer = buffer;

        const bpFilter = audioCtx.createBiquadFilter();
        bpFilter.type = "bandpass";
        bpFilter.frequency.setValueAtTime(1700, now);
        bpFilter.frequency.exponentialRampToValueAtTime(1100, now + 0.18);
        bpFilter.Q.setValueAtTime(2.2, now);

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.linearRampToValueAtTime(0.45, now + 0.02); // quick smack onset
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28); // gentle fade out

        noiseNode.connect(bpFilter);
        bpFilter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);

        // 2. High-frequency friction (the "kiss smack" high-pitch saliva sound)
        const hpNoiseNode = audioCtx.createBufferSource();
        hpNoiseNode.buffer = buffer;

        const hpFilter = audioCtx.createBiquadFilter();
        hpFilter.type = "highpass";
        hpFilter.frequency.setValueAtTime(3500, now);

        const hpGain = audioCtx.createGain();
        hpGain.gain.setValueAtTime(0, now);
        hpGain.gain.linearRampToValueAtTime(0.25, now + 0.01);
        hpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        hpNoiseNode.connect(hpFilter);
        hpFilter.connect(hpGain);
        hpGain.connect(audioCtx.destination);

        // 3. Low-frequency "Pop" of parting lips
        const popOsc = audioCtx.createOscillator();
        popOsc.type = "sine";
        popOsc.frequency.setValueAtTime(200, now);
        popOsc.frequency.exponentialRampToValueAtTime(55, now + 0.07);

        const popGain = audioCtx.createGain();
        popGain.gain.setValueAtTime(0, now);
        popGain.gain.linearRampToValueAtTime(0.75, now + 0.012);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

        popOsc.connect(popGain);
        popGain.connect(audioCtx.destination);

        // 4. Vocal resonance for "Muah" (vocal formant imitation)
        const formantOsc1 = audioCtx.createOscillator();
        formantOsc1.type = "triangle";
        formantOsc1.frequency.setValueAtTime(450, now + 0.015);
        formantOsc1.frequency.exponentialRampToValueAtTime(240, now + 0.22);

        const formantOsc2 = audioCtx.createOscillator();
        formantOsc2.type = "sine";
        formantOsc2.frequency.setValueAtTime(950, now + 0.015);
        formantOsc2.frequency.exponentialRampToValueAtTime(420, now + 0.22);

        const formantGain = audioCtx.createGain();
        formantGain.gain.setValueAtTime(0, now);
        formantGain.gain.linearRampToValueAtTime(0.18, now + 0.04);
        formantGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        formantOsc1.connect(formantGain);
        formantOsc2.connect(formantGain);
        formantGain.connect(audioCtx.destination);

        // Start all elements
        noiseNode.start(now);
        hpNoiseNode.start(now);
        popOsc.start(now);
        formantOsc1.start(now + 0.015);
        formantOsc2.start(now + 0.015);

        // Stop all elements
        noiseNode.stop(now + 0.45);
        hpNoiseNode.stop(now + 0.45);
        popOsc.stop(now + 0.45);
        formantOsc1.stop(now + 0.45);
        formantOsc2.stop(now + 0.45);
      }
    } catch (e) {
      console.warn("Audio human kiss failed", e);
    }
  }, []);

  const handleKiss = useCallback((forceState?: boolean | 'toggle', specificType?: KissAnimationType) => {
    if (kissTimerRef.current) {
      clearTimeout(kissTimerRef.current);
      kissTimerRef.current = null;
    }

    setIsKissEffectEnabled(true);
    if (specificType) {
      setKissAnimationType(specificType);
      localStorage.setItem("nexa_kiss_animation_type", specificType);
    }
    setIsKissing(prev => {
      const next = forceState === 'toggle' 
        ? !prev 
        : typeof forceState === 'boolean' 
          ? forceState 
          : true;
      if (next) {
        setCurrentMood("happy");
        playKissSound();
        // The giving kiss full video plays completely to onEnded, with a generous fallback timer
        kissTimerRef.current = setTimeout(() => {
          setIsKissing(false);
          setIsKissEffectEnabled(false);
          kissTimerRef.current = null;
        }, 20000);
      } else {
        setIsKissEffectEnabled(false);
      }
      return next;
    });
  }, [playKissSound]);

  const stopNexaSing = useCallback(() => {
    if (singingTimerRef.current) {
      clearTimeout(singingTimerRef.current);
      singingTimerRef.current = null;
    }
    setSingingState(null);
    setIsDancing(false);
    stopSingingAccompaniment();
  }, []);

  // Global event listener to stop all ongoing avatar animations and remove visual overlays
  useEffect(() => {
    const handleStopAll = () => {
      if (kissTimerRef.current) {
        clearTimeout(kissTimerRef.current);
        kissTimerRef.current = null;
      }
      setShowMemeVideo(false);
      setIsKissing(false);
      setIsKissEffectEnabled(false);
      setIsDancing(false);
      stopNexaSing();
      stopAllPCM();
      conversationState.setActivePanel(null);
    };
    window.addEventListener('nexa-stop-avatar-animations', handleStopAll);
    window.addEventListener('nexa-dismiss-overlay', handleStopAll);
    return () => {
      window.removeEventListener('nexa-stop-avatar-animations', handleStopAll);
      window.removeEventListener('nexa-dismiss-overlay', handleStopAll);
    };
  }, [stopNexaSing]);

  const handleNexaSing = useCallback(async (
    songTitle: string, 
    genre: string = "pop", 
    lyrics: string = "", 
    playBacking: boolean = true,
    isFromLiveSession: boolean = false
  ) => {
    const currentRun = ++singingRunIdRef.current;

    // Immediately stop any prior voices or audio to eliminate double voices
    stopAllPCM();

    if (singingTimerRef.current) {
      clearTimeout(singingTimerRef.current);
      singingTimerRef.current = null;
    }

    setSingingState({ isSinging: true, songTitle, genre });
    setIsDancing(true);

    if (playBacking) {
      await playSingingAccompaniment(genre, 35);
    }

    // Single unified voice guarantee:
    // If this singing action is triggered from an active Live Session,
    // Gemini Live is ALREADY singing directly through its live audio stream.
    // Do NOT invoke TTS / playPCM in parallel, which causes a second voice to enter in the middle!
    const isLiveActive = isFromLiveSession || (liveSessionRef.current && (liveSessionRef.current as any).isConnected?.());

    if (!isLiveActive && lyrics && !isMuted) {
      try {
        setAppState("speaking");
        const audioBuffer = await getNexaAudio(lyrics, personalityMode, true);
        if (singingRunIdRef.current === currentRun && audioBuffer) {
          await playPCM(audioBuffer);
          if (singingRunIdRef.current === currentRun) {
            setAppState("idle");
          }
        }
      } catch (err) {
        console.error("Singing playback notice:", err);
      }
    }

    singingTimerRef.current = setTimeout(() => {
      if (singingRunIdRef.current === currentRun) {
        setSingingState(null);
        setIsDancing(false);
        stopSingingAccompaniment();
      }
    }, 35000);
  }, [isMuted, personalityMode]);

  const triggerGuidanceViolation = useCallback(() => {
    stopAllPCM();
    stopNexaSing();
    
    // Cleanly stop any active live session to prevent overlapping voice or recording
    setIsSessionActive(false);
    setVisionMode('none');
    setCameraStream(null);
    setIsFlashlightOn(false);
    DeviceManager.toggleFlashlight(false);
    if (liveSessionRef.current) {
      try {
        liveSessionRef.current.stop();
      } catch (e) {}
      liveSessionRef.current = null;
    }

    setShowMemeVideo(true);
    setAppState("idle");
    setCurrentMood("sassy");

    // Add visual system message to chat history
    setMessages(prev => [...prev, {
      id: getUUID(),
      sender: "nexa",
      text: "⚠️ [SAFETY NOTICE]: Critical physical safety boundary detected. Let's stay safe and shift to a constructive, positive topic!"
    }]);

    // Automatically dismiss the meme video after 6 seconds and return to normalcy
    setTimeout(() => {
      setShowMemeVideo(false);
    }, 6000);
  }, []);

  const executeDeviceAction = useCallback(async (deviceAction: any) => {
    if (!deviceAction) return;

    const { type, param } = deviceAction;
    switch (type) {
      case 'flashlight': {
        const success = await DeviceManager.toggleFlashlight(param);
        if (success) {
          setIsFlashlightOn(param);
        }
        break;
      }
      case 'launch_app': {
        const res = await DeviceManager.launchApp(param);
        if (!res.success) {
          setMessages(prev => [...prev, { id: getUUID(), sender: "nexa", text: res.message }]);
          if (!isMuted) {
            setAppState("processing");
            const audioBase64 = await getNexaAudio(res.message);
            if (audioBase64) {
              setAppState("speaking");
              await playPCM(audioBase64);
            }
            setAppState("idle");
          }
        }
        break;
      }
      case 'clipboard_write': {
        await DeviceManager.copyToClipboard(param);
        break;
      }
      case 'clipboard_read': {
        const text = await DeviceManager.readFromClipboard();
        const responseText = text 
          ? `Found this on your clipboard, bhavik: "${text}"`
          : `Your clipboard is currently empty, bhavik!`;
        setMessages(prev => [...prev, { id: getUUID(), sender: "nexa", text: responseText }]);
        if (!isMuted) {
          setAppState("processing");
          const audioBase64 = await getNexaAudio(responseText);
          if (audioBase64) {
            setAppState("speaking");
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        break;
      }
      case 'notification': {
        await DeviceManager.triggerNotification(param.title, param.body);
        break;
      }
      case 'open_notepad': {
        setShowNotepad(true);
        break;
      }
      case 'open_study_board': {
        setShowStudyBoard(true);
        if (personalityMode !== "sensei") {
          switchPersonalityMode("sensei");
        }
        break;
      }
      case 'open_settings': {
        setShowSettings(true);
        break;
      }
      case 'change_voice': {
        if (param) {
          handleVoiceChange(param);
        }
        setShowSettings(true);
        break;
      }
      case 'switch_personality': {
        if (param) {
          await switchPersonalityMode(param);
        }
        break;
      }
      case 'switch_camera': {
        if (liveSessionRef.current) {
          await liveSessionRef.current.switchCamera(param);
          setCameraFacing(param);
        }
        break;
      }
      case 'set_timer': {
        const { duration, label } = param;
        setTimerTotalSeconds(duration);
        setTimerSecondsLeft(duration);
        setTimerLabel(label);
        setIsTimerActive(true);
        break;
      }
      case 'play_birthday_melody': {
        playBirthdayMelody();
        break;
      }
      case 'sing_song': {
        const { songTitle, genre, lyrics } = param || {};
        handleNexaSing(songTitle || "Song", genre || "pop", lyrics || "");
        break;
      }
      case 'transcribe_and_sing': {
        const query = param?.query || "Musical Melody";
        (async () => {
          try {
            const transcribed = await transcribeSongFromGoogleAndYouTube(query);
            // Put complete transcribed lyrics into Bhavik's notepad!
            setNotepadContent(prev => 
              `=== [SONG TRANSCRIPTION] ${transcribed.songTitle} (${transcribed.artist}) ===\n\n${transcribed.fullLyrics}\n\n[Transcribed from Google & YouTube Music Knowledge]\n\n` + (prev ? `\n--- Previous Notes ---\n${prev}` : "")
            );
            setShowNotepad(true);
            handleNexaSing(transcribed.songTitle, transcribed.genre, transcribed.singingPerformance, true);
          } catch (err) {
            console.error("Transcribe and sing error:", err);
          }
        })();
        break;
      }
      case 'add_habit': {
        const habitTitle = param;
        window.dispatchEvent(new CustomEvent('nexa-add-habit', { detail: { habitTitle } }));
        setShowHabits(true);
        break;
      }
      case 'update_habit': {
        const { habitTitle, completed } = param;
        window.dispatchEvent(new CustomEvent('nexa-update-habit', { detail: { habitTitle, completed } }));
        setShowHabits(true);
        break;
      }
      case 'toggle_kiss': {
        const action = param?.action ?? (typeof param === 'boolean' ? (param ? 'on' : 'off') : param?.active);
        const specificType = param?.animationType as KissAnimationType | undefined;
        if (action === 'off' || action === false) {
          setIsKissing(false);
        } else if (action === 'toggle') {
          handleKiss('toggle', specificType);
        } else {
          handleKiss(true, specificType);
        }
        break;
      }
      case 'trigger_shy': {
        const duration = param?.duration || 8000;
        triggerShy(duration);
        break;
      }
      case 'close_current_panel': {
        const target = param?.target;
        setShowStudyBoard(false);
        setShowNotepad(false);
        setShowHabits(false);
        setShowSettings(false);
        setShowLeadFinder(false);
        setShowCreationStudio(false);
        setShowBulkWhatsAppModal(false);
        setShowSoundscapePlayer(false);
        setShowCustomVideoManager(false);
        setIsKissing(false);
        setIsShy(false);
        setShowMemeVideo(false);
        setIsDancing(false);
        stopNexaSing();
        stopAllPCM();
        conversationState.setActivePanel(null);
        break;
      }
      case 'stop_avatar_animations_and_overlays': {
        setShowMemeVideo(false);
        setIsKissing(false);
        setIsShy(false);
        setIsDancing(false);
        stopNexaSing();
        stopAllPCM();
        setShowStudyBoard(false);
        setShowNotepad(false);
        setShowHabits(false);
        setShowSettings(false);
        setShowLeadFinder(false);
        setShowCreationStudio(false);
        setShowBulkWhatsAppModal(false);
        setShowSoundscapePlayer(false);
        setShowPersonalitySidebar(false);
        setShowPermissionModal(false);
        setShowCustomVideoManager(false);
        conversationState.setActivePanel(null);
        setAppState("idle");
        break;
      }
      case 'close_panel': {
        const panel = param?.panel;
        if (panel === 'study_board') setShowStudyBoard(false);
        else if (panel === 'notepad') setShowNotepad(false);
        else if (panel === 'habits') setShowHabits(false);
        else if (panel === 'settings') setShowSettings(false);
        else if (panel === 'lead_finder') setShowLeadFinder(false);
        else if (panel === 'creation_studio') setShowCreationStudio(false);
        else if (panel === 'whatsapp') setShowBulkWhatsAppModal(false);
        else if (panel === 'soundscapes') setShowSoundscapePlayer(false);
        else if (panel === 'local_bridge') setShowLocalBridgeModal(false);
        else if (panel === 'video_manager' || panel === 'videos') setShowCustomVideoManager(false);
        conversationState.setActivePanel(null);
        break;
      }
      case 'open_panel': {
        const panel = param?.panel;
        if (panel === 'study_board') { setShowStudyBoard(true); conversationState.setActivePanel('study_board'); }
        else if (panel === 'notepad') { setShowNotepad(true); conversationState.setActivePanel('notepad'); }
        else if (panel === 'habits') { setShowHabits(true); conversationState.setActivePanel('habits'); }
        else if (panel === 'settings') { setShowSettings(true); conversationState.setActivePanel('settings'); }
        else if (panel === 'lead_finder') { setShowLeadFinder(true); conversationState.setActivePanel('lead_finder'); }
        else if (panel === 'creation_studio') { setShowCreationStudio(true); conversationState.setActivePanel('creation_studio'); }
        else if (panel === 'whatsapp') { setShowBulkWhatsAppModal(true); conversationState.setActivePanel('whatsapp'); }
        else if (panel === 'soundscapes') { setShowSoundscapePlayer(true); conversationState.setActivePanel('soundscapes'); }
        else if (panel === 'local_bridge') { setShowLocalBridgeModal(true); conversationState.setActivePanel('local_bridge'); }
        else if (panel === 'video_manager' || panel === 'videos') { setShowCustomVideoManager(true); conversationState.setActivePanel('video_manager' as any); }
        break;
      }
      case 'local_cli': {
        const cmd = param?.command;
        if (cmd) {
          setShowLocalBridgeModal(true);
          localSystemBridge.executeCommand(cmd);
        }
        break;
      }
      case 'local_app_control': {
        const { action, target } = param || {};
        if (action === 'launch') {
          localSystemBridge.launchLocalApp(target);
        } else if (action === 'kill') {
          localSystemBridge.killProcess(target);
        }
        setShowLocalBridgeModal(true);
        break;
      }
      case 'boost_volume': {
        setIsMuted(false);
        break;
      }
      case 'save_memory': {
        const fact = param;
        if (fact) {
          memoryManager.addDurableFact("instruction", fact);
          window.dispatchEvent(new CustomEvent('nexa_memory_updated'));
        }
        break;
      }
      case 'forget_memory': {
        const query = param || "";
        memoryManager.forgetMatching(query);
        if (liveSessionRef.current) {
          liveSessionRef.current.forgetDirectives(query);
          liveSessionRef.current.cleanHistoryMatching(query);
        }
        window.dispatchEvent(new CustomEvent('nexa_memory_updated'));
        break;
      }
    }
  }, [isMuted, handleNexaSing, handleKiss]);

  // Chatbot typewriter streaming reply (silent, no audio output)
  const typeReplyLikeChatbot = useCallback((fullText: string, onComplete?: () => void) => {
    const sanitizedFullText = sanitizeSpeechAndFiller(fullText).trim();
    setIsNexaTyping(false);
    updateSubtitle(sanitizedFullText);
    const botMsgId = getUUID();
    setTypingMessageId(botMsgId);
    setMessages((prev) => [...prev, { id: botMsgId, sender: "nexa", text: "" }]);

    let charIndex = 0;
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    typingIntervalRef.current = setInterval(() => {
      // High-velocity rapid typing rate (adaptive chunk size for ultra-responsive streaming)
      const step = Math.max(20, Math.ceil(sanitizedFullText.length / 20));
      charIndex = Math.min(sanitizedFullText.length, charIndex + step);
      const currentChunk = sanitizedFullText.slice(0, charIndex);

      setMessages((prev) =>
        prev.map((m) => (m.id === botMsgId ? { ...m, text: currentChunk } : m))
      );

      if (charIndex >= sanitizedFullText.length) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
        setTypingMessageId(null);
        setAppState("idle");
        clearSubtitleDelayed(3500);
        if (onComplete) onComplete();
      }
    }, 12);
  }, [updateSubtitle, clearSubtitleDelayed]);

  // JARVIS Autonomous Pipeline Execution Handler (Multi-Step Tool-Chaining)
  const handleAutonomousPipeline = useCallback(async (userPrompt: string) => {
    setIsPipelineRunning(true);
    setAppState("processing");
    setIsNexaTyping(true);

    const handlers: AutonomousToolHandlers = {
      searchWeb: async (query: string) => {
        if (personalityMode === "oliviya" || query.toLowerCase().includes("olivia") || query.toLowerCase().includes("oliviya")) {
          const res = await multiSourceIntelligenceSearch(query);
          return res.formattedOutput;
        }
        return await fastWebSearch(query, 240);
      },
      writeNotepad: async (title: string, content: string, mode?: "append" | "replace") => {
        const timestamp = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        const entry = `\n\n### 📝 ${title} [${timestamp}]\n${content}\n*Saved via JARVIS Autonomous Pipeline*\n`;
        setNotepadContent((prev) => (mode === "replace" ? `# ${title}\n\n${content}` : prev ? prev + entry : entry));
        setShowNotepad(true);
        return `Successfully written note "${title}" into Bhavik's notepad.`;
      },
      readNotepad: async () => {
        const current = notepadContentRef.current;
        return current ? `Notepad contents:\n${current}` : "Bhavik's notepad is currently empty.";
      },
      setTimer: async (durationSeconds: number, label: string) => {
        setTimerTotalSeconds(durationSeconds);
        setTimerSecondsLeft(durationSeconds);
        setTimerLabel(label || "Focus Block");
        setIsTimerActive(true);
        return `Countdown timer for ${durationSeconds} seconds ('${label}') started.`;
      },
      manageHabit: async (action: "add" | "complete", title: string) => {
        if (action === "add") {
          window.dispatchEvent(new CustomEvent("nexa-add-habit", { detail: { habitTitle: title } }));
        } else {
          window.dispatchEvent(new CustomEvent("nexa-update-habit", { detail: { habitTitle: title, completed: true } }));
        }
        setShowHabits(true);
        return `Habit "${title}" ${action === "complete" ? "marked done" : "added to Habit Tracker"}.`;
      },
      controlDevice: async (feature: "flashlight_on" | "flashlight_off" | "camera_switch" | "battery_telemetry") => {
        if (feature === "flashlight_on") {
          setIsFlashlightOn(true);
          DeviceManager.toggleFlashlight(true);
          return "Device flashlight turned ON.";
        } else if (feature === "flashlight_off") {
          setIsFlashlightOn(false);
          DeviceManager.toggleFlashlight(false);
          return "Device flashlight turned OFF.";
        } else if (feature === "battery_telemetry") {
          const bat = batteryService.getStatus();
          return `Battery: ${bat.level}%, ${bat.charging ? "Charging" : "Discharging"}.`;
        }
        return `Hardware action ${feature} processed.`;
      },
      playSoundscape: async (soundscape: "rain" | "lofi" | "waves" | "cafe" | "forest" | "binaural", play: boolean) => {
        setFocusSoundscapeType(play ? (soundscape as SoundscapeType) : "off");
        setShowSoundscapePlayer(true);
        return `${play ? "Activated" : "Deactivated"} ${soundscape} soundscape.`;
      },
      launchCreationStudio: async (studioType: "presentation" | "thumbnail" | "website" | "document", topic: string) => {
        const tabMap: Record<string, "ppt" | "thumbnail" | "website" | "document" | "proposal"> = {
          presentation: "ppt",
          thumbnail: "thumbnail",
          website: "website",
          document: "document",
        };
        setCreationStudioTab(tabMap[studioType] || "ppt");
        setShowCreationStudio(true);
        return `NEXA Creation Studio launched in ${studioType} mode for topic "${topic}".`;
      },
      draftWhatsApp: async (recipientName: string, message: string) => {
        setBulkWhatsAppMsg(message);
        setShowBulkWhatsAppModal(true);
        return `Prepared WhatsApp draft for "${recipientName}": "${message}".`;
      },
      openPanel: async (panel: string) => {
        if (panel === "notepad") setShowNotepad(true);
        else if (panel === "study_board") setShowStudyBoard(true);
        else if (panel === "lead_finder") setShowLeadFinder(true);
        else if (panel === "creation_studio") setShowCreationStudio(true);
        else if (panel === "habits") setShowHabits(true);
        else if (panel === "settings") setShowSettings(true);
        else if (panel === "soundscapes") setShowSoundscapePlayer(true);
        else if (panel === "local_bridge") setShowLocalBridgeModal(true);
        return `Opened ${panel} panel.`;
      },
      executeLocalCli: async (command: string) => {
        const res = await localSystemBridge.executeCommand(command);
        setShowLocalBridgeModal(true);
        return res.stdout ? `Command "$ ${command}" output:\n${res.stdout.slice(0, 300)}` : `Command executed with exit code ${res.exitCode}`;
      },
      controlLocalApp: async (action: "launch" | "kill", target: string) => {
        setShowLocalBridgeModal(true);
        if (action === "launch") {
          return await localSystemBridge.launchLocalApp(target);
        } else {
          return await localSystemBridge.killProcess(target);
        }
      },
      getLocalSystemStatus: async () => {
        const t = localSystemBridge.getTelemetry();
        setShowLocalBridgeModal(true);
        return `Host: ${t.hostname} (${t.os}). CPU: ${t.cpuUsagePercent}%, RAM: ${t.memoryUsedGB}GB/${t.memoryTotalGB}GB (${t.memoryPercent}%), Disk: ${t.diskFreeGB}GB free. Active procs: ${t.activeProcesses.slice(0, 4).map(p => p.name).join(", ")}.`;
      },
      saveLocalProjectFile: async (filename: string, content: string) => {
        setShowLocalBridgeModal(true);
        return await localSystemBridge.writeLocalFile(filename, content);
      },
    };

    try {
      const result = await runAutonomousToolChain(userPrompt, handlers, (updatedSteps) => {
        setPipelineSteps([...updatedSteps]);
      });

      typeReplyLikeChatbot(result.finalSpeech);

      if (!isMuted && result.finalSpeech) {
        try {
          setAppState("speaking");
          const audioBuffer = await getNexaAudio(result.finalSpeech, personalityMode);
          if (audioBuffer) {
            await playPCM(audioBuffer);
            setAppState("idle");
          }
        } catch (e) {
          console.warn("TTS playback notice:", e);
        }
      }
    } catch (err: any) {
      console.error("Pipeline run error:", err);
      typeReplyLikeChatbot("Autonomous pipeline completed with current system actions.");
    } finally {
      setIsPipelineRunning(false);
    }
  }, [typeReplyLikeChatbot, isMuted, personalityMode]);

  const handleTextCommand = useCallback(async (finalTranscript: string, attachedImage?: string) => {
    const trimmedText = (finalTranscript || "").trim();
    if (!trimmedText && !attachedImage) {
      setAppState("idle");
      return;
    }

    const effectiveText = trimmedText || "Please analyze this image, give me your sharp observations, and provide actionable advice.";
    setMessages((prev) => [...prev, { id: getUUID(), sender: "user", text: effectiveText, image: attachedImage }]);
    voiceEmotionService.processSpokenText(effectiveText, "user");
    
    if (isGuidanceViolation(effectiveText)) {
      triggerGuidanceViolation();
      return;
    }
    
    // Check for build commands
    const lowerTranscript = effectiveText.toLowerCase();
    
    const isVideoEditorRequest = lowerTranscript.includes("video editor") || 
                                 lowerTranscript.includes("edit video") || 
                                 lowerTranscript.includes("edit the video") ||
                                 lowerTranscript.includes("open video editor") ||
                                 lowerTranscript.includes("edit them");

    if (isVideoEditorRequest) {
      const sassResponse = "A video editor? My core visual engine is running in real-time mode with zero latency, Bhavik!";
      typeReplyLikeChatbot(sassResponse);
      return;
    }

    const isBuildRequest = lowerTranscript.includes("make a website") || 
                           lowerTranscript.includes("build a website") || 
                           lowerTranscript.includes("create a website") ||
                           lowerTranscript.includes("make a 3d website");

    if (isBuildRequest) {
      const context = finalTranscript
        .replace(/make a (3d )?website|build a website|create a website/gi, "")
        .replace(/on|for|about/i, "")
        .trim() || "modern website";
      handleNexaAutoBuild(context);
      return;
    }

    if (isSessionActive && liveSessionRef.current && !attachedImage) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    setAppState("processing");
    setIsNexaTyping(true);

    // 1. Check for Autonomous Multi-Step Tool-Chaining Workflow Intent
    if (isCompoundOrAutonomousIntent(finalTranscript) && !attachedImage) {
      handleAutonomousPipeline(finalTranscript);
      return;
    }

    let responseText = "";

    if (!attachedImage) {
      const commandResult = processCommand(finalTranscript);

      if (commandResult.deviceAction && commandResult.action) {
        if (commandResult.deviceAction.type === 'transcribe_and_sing') {
          const query = commandResult.deviceAction.param?.query || finalTranscript;
          (async () => {
            try {
              const transcribed = await transcribeSongFromGoogleAndYouTube(query);
              // Save full lyrics and structure to Bhavik's notepad!
              setNotepadContent(prev => 
                `=== [SONG TRANSCRIPTION] ${transcribed.songTitle} (${transcribed.artist}) ===\n\n${transcribed.fullLyrics}\n\n[Transcribed from Google & YouTube Music Knowledge]\n\n` + (prev ? `\n--- Previous Notes ---\n${prev}` : "")
              );
              setShowNotepad(true);
              typeReplyLikeChatbot(transcribed.singingPerformance);
              handleNexaSing(transcribed.songTitle, transcribed.genre, transcribed.singingPerformance, true);
            } catch (err) {
              console.error("Transcribe and sing error:", err);
              typeReplyLikeChatbot("♪ Striking up the chords for Bhavik... ♫");
            }
          })();
          return;
        }

        responseText = commandResult.action;
        // Execute device action immediately with zero delay (kiss video/sound, flashlight, panels, etc.)
        executeDeviceAction(commandResult.deviceAction);
        typeReplyLikeChatbot(responseText);
        return;
      } else if (commandResult.isBrowserAction && commandResult.action) {
        responseText = commandResult.action;
        typeReplyLikeChatbot(responseText, () => {
          setTimeout(() => {
            if (commandResult.url) {
              try {
                const url = commandResult.url;
                if (url && !url.startsWith('about:') && !url.includes('about:blank')) {
                  window.open(url, "_blank");
                }
              } catch (err) {
                console.error("Failed to open command URL:", err);
              }
            }
          }, 800);
        });
        return;
      }
    }

    try {
      let promptToSend = finalTranscript;
        const lowerTranscript = finalTranscript.toLowerCase().trim();

        if (
          lowerTranscript.includes("i am playing the music") ||
          lowerTranscript.includes("i'm playing the music") ||
          lowerTranscript.includes("i am playing music") ||
          lowerTranscript.includes("i'm playing music") ||
          lowerTranscript.includes("playing the music") ||
          lowerTranscript.includes("start dancing") ||
          lowerTranscript.includes("dance for me")
        ) {
          setIsDancing(true);
        } else if (
          lowerTranscript.includes("stop dancing") ||
          lowerTranscript.includes("stop music") ||
          lowerTranscript.includes("stop the music") ||
          lowerTranscript.includes("i stopped the music") ||
          lowerTranscript.includes("stop dance")
        ) {
          setIsDancing(false);
        }

        const isShyTrigger = 
          lowerTranscript.includes("make her shy") ||
          lowerTranscript.includes("make you shy") ||
          lowerTranscript.includes("get shy") ||
          lowerTranscript.includes("are you shy") ||
          lowerTranscript.includes("blush") ||
          lowerTranscript.includes("blushing") ||
          lowerTranscript.includes("sharmati") ||
          lowerTranscript.includes("sharma gayi") ||
          lowerTranscript.includes("sharm aa rahi") ||
          lowerTranscript.includes("you look cute") ||
          lowerTranscript.includes("you are cute") ||
          lowerTranscript.includes("you're cute") ||
          lowerTranscript.includes("so cute") ||
          lowerTranscript.includes("you are beautiful") ||
          lowerTranscript.includes("you look beautiful") ||
          lowerTranscript.includes("you are pretty") ||
          lowerTranscript.includes("you look pretty") ||
          lowerTranscript.includes("cute lag rahi") ||
          lowerTranscript.includes("sundar lag rahi") ||
          lowerTranscript.includes("shy video") ||
          lowerTranscript.includes("play shy");

        if (isShyTrigger) {
          triggerShy(8000);
        }

        const isNotepadReadRequest = 
          lowerTranscript.includes("read that") || 
          lowerTranscript.includes("read this") || 
          lowerTranscript.includes("read my notepad") || 
          lowerTranscript.includes("read what is written in notepad") || 
          lowerTranscript.includes("read what i have written") || 
          lowerTranscript.includes("read what's in my notepad") || 
          lowerTranscript.includes("read what's in the notepad") || 
          lowerTranscript.includes("read what is written in my notepad") ||
          lowerTranscript.includes("read notepad");
        
        if (isNotepadReadRequest) {
          const contentToRead = notepadContentRef.current.trim();
          if (contentToRead) {
            promptToSend = `${finalTranscript}\n\n[CONTEXT: The current exact content of Bhavik's personal notepad is:\n"""\n${contentToRead}\n"""\nRead this content aloud to him exactly or explain/comment on it as requested in your natural character voice.]`;
          } else {
            promptToSend = `${finalTranscript}\n\n[CONTEXT: Bhavik's notepad is currently empty! Inform him politely in your character voice that there is nothing written in the notepad for you to read yet.]`;
          }
        }

        responseText = await getNexaResponse(promptToSend, messagesRef.current, attachedImage, personalityMode);
        
        if (responseText.toUpperCase().includes("[VIOLATION]")) {
          triggerGuidanceViolation();
          setIsNexaTyping(false);
          return;
        }
        
        // Extract Notepad content if present
        const notepadRegex = /\[NOTEPAD_START\]([\s\S]*?)\[NOTEPAD_END\]/i;
        const notepadMatch = responseText.match(notepadRegex);
        if (notepadMatch) {
          const textToSave = notepadMatch[1].trim();
          setNotepadContent(textToSave);
          setShowNotepad(true);
          responseText = responseText.replace(notepadRegex, "").trim() || "Arre Bhavik, I have sent it directly to your notepad! Go ahead and copy it. 😉";
        }

        let singingHandledInTurn = false;

        // Extract Action block if present
        const actionRegex = /<ACTION>([\s\S]*?)<\/ACTION>/i;
        const actionMatch = responseText.match(actionRegex);
        if (actionMatch) {
          try {
            const actionObj = JSON.parse(actionMatch[1].trim());
            const targetLower = (actionObj.target || "").toLowerCase();
            const payloadLower = (actionObj.payload || "").toLowerCase();

            if (targetLower.includes("gmail") || payloadLower.includes("gmail")) {
              setTimeout(() => {
                window.open("https://mail.google.com/mail/u/0/#inbox", "_blank");
              }, 800);
            } else if (actionObj.type === "open_app" && actionObj.target) {
              executeDeviceAction({ type: 'launch_app', param: actionObj.target });
            } else if (actionObj.type === "browser_prompt" && actionObj.payload) {
              let targetUrl = actionObj.payload;
              if (targetUrl.toLowerCase().includes("gmail")) {
                targetUrl = "https://mail.google.com/mail/u/0/#inbox";
              }
              setTimeout(() => {
                window.open(targetUrl, "_blank");
              }, 800);
            } else if (actionObj.type === "sing_song") {
              const title = actionObj.param?.songTitle || actionObj.target || "Melody";
              const genre = actionObj.param?.genre || "pop";
              const lyrics = actionObj.param?.lyrics || "";
              handleNexaSing(title, genre, lyrics);
              singingHandledInTurn = true;
            }
          } catch (err) {
            console.error("Failed to parse <ACTION> block:", err);
          }
          responseText = responseText.replace(actionRegex, "").trim();
        }
        
        // Extract mood and voice tags from response
        const voiceTagMatch = responseText.match(/\[voice:\s*([a-z]+)\]/i);
        if (voiceTagMatch) {
          const v = voiceTagMatch[1].toLowerCase();
          if (v === "cheerful") setCurrentMood("happy");
          else if (v === "teasing" || v === "tsundere") setCurrentMood("sassy");
          else if (v === "angry") setCurrentMood("dramatic");
          else if (v === "cool") setCurrentMood("analytical");
          else if (v === "surprised" || v === "determined") setCurrentMood("visionary");
          else if (v === "soft" || v === "shy") setCurrentMood("neutral");
        } else {
          const moodMatch = responseText.match(/\[(SASSY|DRAMATIC|HAPPY)\]/);
          if (moodMatch) {
            setCurrentMood(moodMatch[1].toLowerCase() as NexaMood);
          } else {
            setCurrentMood("neutral");
          }
        }

        // Only trigger kiss animation if explicitly signaled via [KISS_ACTION] tag, never on loose text
        if (
          responseText.includes("[KISS_ACTION]") ||
          responseText.includes("[FLYING_KISS]")
        ) {
          handleKiss();
        }

        const lowerText = responseText.toLowerCase();
        if (
          lowerText.includes("blush") ||
          lowerText.includes("shy") ||
          lowerText.includes("sharma") ||
          lowerText.includes("flatter") ||
          responseText.includes("[SHY]") ||
          responseText.includes("[FLATTERED]")
        ) {
          triggerShy(8000);
        }

        // Clean tags from reply text so users and UI see pristine natural conversation
        const cleanResponse = sanitizeSpeechAndFiller(responseText).trim();

        const lowerResp = cleanResponse.toLowerCase();
        if (!singingHandledInTurn && (lowerResp.includes("🎶") || lowerResp.includes("♫") || lowerResp.includes("happy birthday") || lowerResp.includes("tum hi ho")) && !singingState) {
          const g = lowerResp.includes("birthday") ? "birthday" : (lowerResp.includes("tum hi ho") || lowerResp.includes("bollywood") ? "bollywood" : (lowerResp.includes("twinkle") || lowerResp.includes("lullaby") ? "lullaby" : "pop"));
          const t = lowerResp.includes("birthday") ? "Happy Birthday" : (lowerResp.includes("tum hi ho") ? "Tum Hi Ho" : (lowerResp.includes("lullaby") ? "Lullaby" : "Nexa's Melody"));
          handleNexaSing(t, g, cleanResponse);
          singingHandledInTurn = true;
        }

        // Nexa gives the reply by typing silently, just like a chatbot!
        typeReplyLikeChatbot(cleanResponse);
      } catch (err: any) {
        console.error("handleTextCommand general error:", err);
        setIsNexaTyping(false);
        setAppState("idle");
        typeReplyLikeChatbot("I am right here with you, Bhavik! Let's continue.");
      }
  }, [isSessionActive, handleKiss, personalityMode, triggerGuidanceViolation, typeReplyLikeChatbot, handleNexaSing, singingState]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  const [showPreview, setShowPreview] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [masterPrompt, setMasterPrompt] = useState("");
  const [showMasterPromptModal, setShowMasterPromptModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenInNewTab = (html: string) => {
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleNexaAutoBuild = async (context: string, imageData?: string) => {
    setAppState("processing");

    // STEP 1: PROMPT ENGINEERING PHASE
    const engineerPrompt = `Act as an Elite Prompt Engineer. Analyze this request: "${context}".
    Construct a MASTER PROMPT using this EXACT structure:
    ---
    Act as an expert web developer and UI designer.
    Build a professional website with the following specifications:
    ### OBJECTIVE: [Clear goal]
    ### FEATURES: [List of 5+ features including a functional 'Heart Button' image upload]
    ### DESIGN REQUIREMENTS: [Elite style, Color, Grid]
    ### TECH STACK: Suggest best modern stack for standalone HTML (Three.js/Tailwind)
    ### STRUCTURE: [Detailed page list]
    ### OUTPUT: Production-ready code, responsive.
    ---
    IMPORTANT: Wrap it inside [MASTER_PROMPT_START] and [MASTER_PROMPT_END] tags.`;

    try {
      setMessages(prev => [...prev, { 
        id: getUUID(), 
        sender: "nexa", 
        text: `[HAPPY] Uff, understood bhavik! Stage 1: Engineering your Master Prompt... don't expect me to make it boring! UMMAH!` 
      }]);
      
      const promptResponse = await getNexaResponse(engineerPrompt, [], imageData, personalityMode);
      const promptMatch = promptResponse.match(/\[MASTER_PROMPT_START\]([\s\S]*?)\[MASTER_PROMPT_END\]/);
      
      if (!promptMatch) {
        setMessages(prev => [...prev, { id: getUUID(), sender: "nexa", text: promptResponse }]);
        setAppState("idle");
        return;
      }

      const finalMasterPrompt = promptMatch[1].trim();
      setMasterPrompt(finalMasterPrompt);
      setShowMasterPromptModal(true);

      // STEP 2: AUTOMATIC BUILD PHASE
      setMessages(prev => [...prev, { 
        id: getUUID(), 
        sender: "nexa", 
        text: `Master Prompt Generated! Stage 2: Building your elite 3D website now... You owe me a treat, bhavik! UMMAH!` 
      }]);

      const builderPrompt = `${finalMasterPrompt}
      
      CRITICAL INSTRUCTION: Return ONLY the code inside \`\`\`html blocks.
      Ensure the website has a functional button with id 'nexa-heart-upload'. When clicked, it opens a file picker and replaces the hero image or a 3D texture with the uploaded file automatically. Use standard browser FileReader API.`;

      const codeResponse = await getNexaResponse(builderPrompt, [], imageData);
      const htmlMatch = codeResponse.match(/```html\n([\s\S]*?)\n```/) || 
                       codeResponse.match(/```([\s\S]*?)```/) || 
                       codeResponse.match(/<html>[\s\S]*?<\/html>/i);
                       
      const code = htmlMatch ? (htmlMatch[1] || htmlMatch[0]) : codeResponse;
      
      setGeneratedHtml(code);
      setShowPreview(true);
      handleOpenInNewTab(code);
      
      const successMsg = `bhavik, automation complete! Your creation is live. Try not to break it, okay? UMMAH!`;
      setMessages(prev => [...prev, { id: getUUID(), sender: "nexa", text: successMsg }]);

      if (!isMuted) {
        setAppState("processing");
        const audioData = await getNexaAudio("bhavik, automation complete! Your creation is live. don't break it! UMMAH!");
        if (audioData) {
          setAppState("speaking");
          await playPCM(audioData);
        }
        setAppState("idle");
      }
    } catch (err) {
      console.error("Auto Build Error", err);
      setMessages(prev => [...prev, { id: getUUID(), sender: "nexa", text: "Ugh bhavik, the automation engine hit a speed bump. Such a drama queen! Can we try again?" }]);
    } finally {
      setAppState("idle");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      handleNexaAutoBuild("Visual identity based on this image", base64);
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = (type: 'html' | 'zip' = 'html') => {
    if (!generatedHtml) return;
    
    if (type === 'html') {
      const blob = new Blob([generatedHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexa_project_${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const zip = new JSZip();
      zip.file("index.html", generatedHtml);
      // We could split CSS/JS if we parsed them out, but for now we'll zip the standalone file for cleaner structure
      zip.generateAsync({ type: "blob" }).then((content) => {
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nexa_project_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

      const responseText = `Published as ${type.toUpperCase()}! Your creation is saved, bhavik. Don't say I never do anything for you!`;
      setMessages(prev => [...prev, { id: getUUID(), sender: "nexa", text: responseText }]);
      
      if (!isMuted) {
        setAppState("processing");
        getNexaAudio(responseText).then(audioBase64 => {
          if (audioBase64) {
            setAppState("speaking");
            playPCM(audioBase64).then(() => {
              setAppState("idle");
            });
          } else {
            setAppState("idle");
          }
        });
      }
  };

  const toggleListening = async (mode: 'camera' | 'screen' | 'none' = 'none') => {
    // If clicking the same mode, handle toggling
    if (isSessionActive && visionMode === mode) {
      if (mode !== 'none') {
        // Just turn off the camera/screen but keep the audio session alive
        setVisionMode('none');
        if (liveSessionRef.current) {
          liveSessionRef.current.updateMedia('none');
        }
        return;
      }
      
      // If clicking 'none' and already in 'none', stop the whole session
      setIsSessionActive(false);
      setVisionMode('none');
      setCameraStream(null);
      setIsFlashlightOn(false);
      DeviceManager.toggleFlashlight(false); // Cleanly close flashlight on stop
      stopNexaSing();
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      return;
    }

    // If active and just changing mode (e.g. from Mic only to Camera), update media source
    if (isSessionActive && liveSessionRef.current) {
      setVisionMode(mode);
      try {
        await liveSessionRef.current.updateMedia(mode);
      } catch (e: any) {
        console.warn("[App] Failed to update media vision mode, reverting gracefully to none:", e);
        setVisionMode('none');
      }
      return;
    }

    const session = new LiveSessionManager();
    try {
      setIsSessionActive(true);
      setVisionMode(mode);
      
      session.isMuted = isMuted;
      session.setMicMuted(isMicMuted);
      session.setVoicePitch(voicePitch);
      session.onDanceToggle = (dance) => {
        setIsDancing(dance);
      };
      session.onSingSong = (songTitle, genre, lyrics, playBackingTrack) => {
        handleNexaSing(songTitle, genre, lyrics, playBackingTrack, true);
      };
      liveSessionRef.current = session;
      
      session.onVideoStreamChange = (stream) => {
        setCameraStream(stream);
      };
      // Synchronize initial stream and camera direction
      setCameraStream(session.getVideoStream());
      setCameraFacing(session.facingMode);
      
      session.onStateChange = (state) => {
        setAppState(state);
        if (state === "listening") {
          stopNexaSing();
        }
      };
      
      session.onMessage = (sender, text, isFinal = true) => {
        const cleanText = sender === "nexa" ? sanitizeSpeechAndFiller(text).trim() : text;
        if (sender === "nexa" && cleanText) {
          updateSubtitle(cleanText);
          if (isFinal) {
            clearSubtitleDelayed(4000);
          }
        }
        setMessages((prev) => {
          if (isFinal === false) {
            const last = prev[prev.length - 1];
            if (last && last.sender === sender && last.isFinal === false) {
              return [...prev.slice(0, -1), { ...last, text: cleanText, isFinal: false }];
            }
            return [...prev, { id: getUUID(), sender, text: cleanText, isFinal: false }];
          } else {
            const last = prev[prev.length - 1];
            if (last && last.sender === sender && last.isFinal === false) {
              return [...prev.slice(0, -1), { ...last, text: cleanText, isFinal: true }];
            }
            return [...prev, { id: getUUID(), sender, text: cleanText, isFinal: true }];
          }
        });
      };

      session.onGuidanceViolation = () => {
        triggerGuidanceViolation();
      };

      (session as any).onKiss = (action?: boolean | 'toggle') => {
        handleKiss(action);
      };
      
      session.onMoodChange = (mood) => {
        setCurrentMood(mood);
      };

      session.onEnergyChange = (energy) => {
        setAudioEnergy(energy);
      };

      (session as any).onSetTimer = (duration: number, label: string) => {
        setTimerTotalSeconds(duration);
        setTimerSecondsLeft(duration);
        setTimerLabel(label);
        setIsTimerActive(true);
      };

      (session as any).onUpdateHabit = (habitTitle: string, completed: boolean) => {
        window.dispatchEvent(new CustomEvent('nexa-update-habit', { detail: { habitTitle, completed } }));
        setShowHabits(true); // Auto-open modal when Nexa updates a habit
      };

      (session as any).onAddHabit = (habitTitle: string) => {
        window.dispatchEvent(new CustomEvent('nexa-add-habit', { detail: { habitTitle } }));
        setShowHabits(true);
      };

      (session as any).onWriteToNotepad = (content: string, openNotepad: boolean) => {
        setNotepadContent(content);
        if (openNotepad) {
          setShowNotepad(true);
        }
      };
      
      session.onReadFromNotepad = () => {
        return notepadContentRef.current;
      };

      session.onOrganizeGmail = (action: string, query: string) => {
        setMessages(prev => [...prev, {
          id: getUUID(),
          sender: "nexa",
          text: `📧 [GMAIL AUTOMATION]: ${action.toUpperCase().replace('_', ' ')} ${query ? `("${query}")` : ''} - Opening target Gmail filter for Bhavik!`
        }]);
      };

      session.onBulkWhatsApp = (numbers: string[], message: string) => {
        setBulkWhatsAppNumbers(numbers);
        setBulkWhatsAppMsg(message);
        setShowBulkWhatsAppModal(true);
      };

      session.onFocusSoundscape = (type: string) => {
        setFocusSoundscapeType(type as SoundscapeType);
        setShowSoundscapePlayer(true);
      };

      session.onOpenCreationStudio = (tab: string) => {
        const validTab = ["ppt", "thumbnail", "website", "document", "proposal"].includes(tab)
          ? (tab as "ppt" | "thumbnail" | "website" | "document" | "proposal")
          : "ppt";
        setCreationStudioTab(validTab);
        setShowCreationStudio(true);
      };

      session.onStartStudyMode = (durationMinutes: number, soundscape: string) => {
        if (durationMinutes && durationMinutes > 0) {
          setTimerTotalSeconds(durationMinutes * 60);
          setTimerSecondsLeft(durationMinutes * 60);
          setTimerLabel("Study & Focus Session");
          setIsTimerActive(true);
        }
        if (soundscape && soundscape !== "off") {
          setFocusSoundscapeType(soundscape as SoundscapeType);
          setShowSoundscapePlayer(true);
        }
      };
      
      session.onCommand = async (url) => {
        // Intercept URLs for native application launching ONLY if opening base homepage, not search/query URLs
        let appName = "";
        const isSearchOrDeepQuery = url.includes("search_query=") || url.includes("/search") || url.includes("q=") || url.includes("text=") || url.includes("phone=");

        if (!isSearchOrDeepQuery) {
          if (url === "https://www.youtube.com" || url === "https://www.youtube.com/") appName = "youtube";
          else if (url === "https://web.whatsapp.com" || url === "https://web.whatsapp.com/") appName = "whatsapp";
          else if (url.includes("maps.google.com") && !url.includes("?")) appName = "maps";
          else if (url.includes("mail.google.com") && url.endsWith("#inbox")) appName = "gmail";
        }
        
        if (appName) {
          console.log(`[Nexa] Intercepted onCommand for native launch: ${appName}`);
          const res = await DeviceManager.launchApp(appName);
          if (!res.success) {
            // Web fallback if native is unavailable
            setTimeout(() => {
              try {
                if (url && !url.startsWith('about:') && !url.includes('about:blank')) {
                  window.open(url, "_blank");
                }
              } catch (err) {
                console.error("Failed to open onCommand url:", err);
              }
            }, 800);
          }
        } else {
          setTimeout(() => {
            try {
              if (url && !url.startsWith('about:') && !url.includes('about:blank')) {
                window.open(url, "_blank");
              }
            } catch (err) {
              console.error("Failed to open onCommand url:", err);
            }
          }, 800);
        }
      };

      session.onSwitchPersonality = (newMode) => {
        switchPersonalityMode(newMode);
      };

      await session.start(mode, personalityMode);
    } catch (e: any) {
      const errMsg = e?.message || String(e);
      console.warn("[App] Session start with mode", mode, "encountered error:", errMsg);

      // If mode was screen or camera and failed, retry with mic-only ('none') mode!
      if (mode !== 'none') {
        console.log("[App] Attempting fallback to mic-only mode ('none')...");
        try {
          setVisionMode('none');
          await session.start('none', personalityMode);
          return;
        } catch (fallbackErr) {
          console.error("[App] Fallback to mic-only mode also failed:", fallbackErr);
        }
      }

      const isPermissionDenied = errMsg.toLowerCase().includes("permission was denied") || errMsg.toLowerCase().includes("permission denied") || errMsg.includes("NotAllowedError") || errMsg.includes("PermissionDeniedError");
      
      if (isPermissionDenied) {
        setPermissionError(errMsg);
        setShowPermissionModal(true);
      } else {
        setPermissionError(errMsg);
      }
      
      setIsSessionActive(false);
      setVisionMode('none');
      setAppState("idle");
      if (liveSessionRef.current) {
        try {
          liveSessionRef.current.stop();
        } catch (stopErr) {}
        liveSessionRef.current = null;
      }
    }
  };

  // Only trigger session on explicit user action (e.g. clicking the mic / START CONNECTION button)
  // to avoid automatic browser permission blocks from global background listeners
  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        try {
          liveSessionRef.current.stop();
        } catch (_) {}
      }
    };
  }, []);

  return (
    <div className="h-[100dvh] w-screen bg-[#030303] text-white flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0">
      {/* High-Performance Static Tech Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[#020508]">
        {/* Subtle Static Radial Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.06),transparent_70%)]" />
        
        {/* Elegant Static Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(245,158,11,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.2) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            transform: 'perspective(500px) rotateX(60deg) translateY(-100px)',
            maskImage: 'linear-gradient(to bottom, transparent, black)'
          }}
        />
      </div>

      {showPermissionModal && (
        <PermissionModal 
          errorMessage={permissionError || undefined}
          onClose={() => {
            setShowPermissionModal(false);
            setPermissionError(null);
          }} 
        />
      )}

      {/* Floating Timer Widget */}
      <AnimatePresence>
        {timerSecondsLeft !== null && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[90%] max-w-xs bg-black/60 border border-amber-500/30 backdrop-blur-md rounded-2xl p-4 shadow-[0_0_20px_rgba(245,158,11,0.25)] flex flex-col items-center gap-3"
          >
            {/* Header: Label and Cancel */}
            <div className="w-full flex justify-between items-center px-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-amber-500/60 uppercase">
                <Clock size={12} className="animate-pulse" />
                Active Timer
              </div>
              <button 
                onClick={() => {
                  setTimerSecondsLeft(null);
                  setTimerTotalSeconds(null);
                  setTimerLabel("");
                  setIsTimerActive(false);
                }}
                className="text-white/40 hover:text-red-400 transition-colors p-1"
                title="Cancel Timer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Countdown Display */}
            <div className="text-3xl font-mono font-bold tracking-widest text-amber-400">
              {formatTime(timerSecondsLeft)}
            </div>

            {/* Progress Bar */}
            {timerTotalSeconds && (
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10 relative">
                <motion.div 
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 animate-pulse"
                  style={{ width: `${(timerSecondsLeft / timerTotalSeconds) * 100}%` }}
                />
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-4 mt-1">
              <button
                onClick={() => setIsTimerActive(!isTimerActive)}
                className={`p-2 rounded-full transition-all border ${
                  isTimerActive 
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20" 
                    : "border-green-500/20 bg-green-500/10 text-green-300 hover:bg-green-500/20"
                }`}
              >
                {isTimerActive ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <div className="text-[10px] font-mono text-white/40">
                {timerLabel || "Custom duration"}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Header */}
      <header 
        onClick={() => setHasInteracted(true)}
        className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-12 md:py-6 bg-transparent"
      >
        <div className="flex items-center gap-3">
          {(() => {
            const activePersona = getPersonalityById(personalityMode);
            return (
              <div 
                onClick={() => setShowPersonalitySidebar(true)}
                className="flex items-center gap-3 cursor-pointer group select-none"
                title="Click to switch personalities or customize"
              >
                <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${activePersona.accentColor} flex items-center justify-center font-bold text-lg shadow-[0_0_15px_rgba(245,158,11,0.4)] text-black group-hover:scale-105 transition-transform`}>
                  {activePersona.avatarLetter}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold tracking-wider text-white group-hover:text-amber-300 transition-colors">
                      {activePersona.shortName.toUpperCase()}
                    </h1>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider border uppercase ${
                      activePersona.gender === "male" 
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/50" 
                        : "bg-amber-500/20 text-amber-300 border-amber-400/50"
                    }`}>
                      {activePersona.badge}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/50 font-mono tracking-tighter">
                    {activePersona.gender === "male" ? "MALE VOICE" : "FEMALE VOICE"} • FOR BHAVIK
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Personality Sidebar Quick Button */}
          <button
            onClick={() => setShowPersonalitySidebar(true)}
            className="cursor-pointer px-3 py-1.5 rounded-full text-[11px] font-mono font-bold tracking-wider flex items-center gap-1.5 border transition-all bg-white/5 hover:bg-white/15 text-white/90 border-white/20 shadow-md hover:scale-105"
            title="Browse all AI personalities list"
          >
            <Compass size={13} className="text-cyan-400" />
            <span className="hidden sm:inline">PERSONALITIES</span>
          </button>
        </div>

        {/* Real-time Clock */}
        <div className="hidden md:flex flex-col items-center">
            <span className="text-2xl font-mono font-bold text-amber-400 tracking-widest">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-[10px] font-mono text-amber-500/40 uppercase tracking-[0.3em]">
                {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Real-time Device Battery Telemetry */}
          <DeviceBatteryIndicator
            onAskComment={(comment) => {
              setShowChat(true);
              handleTextCommand("Nexa, mere phone ki battery aur health kaisi hai? 🔋");
            }}
          />

          {/* Visual Study Board & Anime Teacher Trigger (Right Side) */}
          <button
            id="study-board-btn"
            onClick={() => {
              setShowStudyBoard(!showStudyBoard);
              if (!showStudyBoard && personalityMode !== "sensei") {
                switchPersonalityMode("sensei");
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-all border ${
              showStudyBoard 
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-400 shadow-[0_0_20px_rgba(244,63,94,0.7)] scale-105 font-bold' 
                : 'bg-pink-500/10 hover:bg-pink-500/25 text-pink-300 border-pink-500/40 shadow-[0_0_12px_rgba(244,63,94,0.25)] hover:scale-105'
            }`}
            title="Visual Study Board & Exam Mentor: Upload question papers/textbooks or search online. Aoi Sensei teaches step-by-step with visual blackboard diagrams!"
          >
            <GraduationCap size={16} className="text-pink-300" />
            <span className="text-xs font-semibold tracking-wide hidden sm:inline">Study Board</span>
          </button>

          {/* NEXA Cognitive Memory Core Trigger */}
          <button
            id="memory-center-btn"
            onClick={() => setShowMemoryCenter(!showMemoryCenter)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-all border ${
              showMemoryCenter 
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.7)] scale-105 font-bold' 
                : 'bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)] hover:scale-105'
            }`}
            title="NEXA Cognitive Memory Core: Categorized durable long-term knowledge repository"
          >
            <Brain size={16} className="text-cyan-300" />
            <span className="text-xs font-semibold tracking-wide hidden sm:inline">Memory</span>
            {totalMemoryCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-400/20 text-cyan-200 border border-cyan-400/30 font-mono font-bold">
                {totalMemoryCount}
              </span>
            )}
          </button>

          {/* AI Lead Finder & Outreach Agent Trigger */}
          <button
            id="lead-finder-btn"
            onClick={() => setShowLeadFinder(!showLeadFinder)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-all border ${
              showLeadFinder 
                ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.7)] scale-105 font-bold' 
                : 'bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:scale-105'
            }`}
            title="AI Lead Finder & Outreach Agent: Find clients, verify contacts, draft personalized emails & export"
          >
            <Sparkles size={16} className="text-emerald-300" />
            <span className="text-xs font-semibold tracking-wide hidden sm:inline">Lead Finder</span>
          </button>

          {/* NEXA Creation Studio Trigger */}
          <button
            id="creation-studio-btn"
            onClick={() => setShowCreationStudio(!showCreationStudio)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-all border ${
              showCreationStudio 
                ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.7)] scale-105 font-bold' 
                : 'bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)] hover:scale-105'
            }`}
            title="NEXA Creation Studio: Presentations, Thumbnails, Websites, Documents & Proposals"
          >
            <Wand2 size={16} className="text-amber-300" />
            <span className="text-xs font-semibold tracking-wide hidden sm:inline">Studio</span>
          </button>

          {/* Soundscape & Focus Player Trigger */}
          <button
            id="soundscape-player-btn"
            onClick={() => setShowSoundscapePlayer(!showSoundscapePlayer)}
            className={`p-2 rounded-full transition-all border border-teal-500/30 ${showSoundscapePlayer ? 'bg-teal-500 text-black shadow-[0_0_15px_rgba(20,184,166,0.6)]' : 'bg-white/5 hover:bg-teal-500/20 text-teal-300'}`}
            title="Smart Focus & Ambient Soundscapes"
          >
            <CloudRain size={18} />
          </button>

          {/* Bulk WhatsApp Sender Trigger */}
          <button
            id="bulk-whatsapp-btn"
            onClick={() => setShowBulkWhatsAppModal(!showBulkWhatsAppModal)}
            className={`p-2 rounded-full transition-all border border-emerald-500/30 ${showBulkWhatsAppModal ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.6)]' : 'bg-white/5 hover:bg-emerald-500/20 text-emerald-400'}`}
            title="Bulk WhatsApp Sender"
          >
            <MessageSquare size={18} />
          </button>
          
          <button
            id="habits-toggle-btn"
            onClick={() => setShowHabits(!showHabits)}
            className={`p-2 rounded-full transition-all border border-amber-500/20 ${showHabits ? 'bg-amber-500 text-black' : 'bg-white/5 hover:bg-amber-500/20 text-amber-400'}`}
            title="Habit Tracker"
          >
            <CheckSquare size={18} />
          </button>
          
          <button
            id="mute-toggle-btn"
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX size={18} className="opacity-70 text-red-400" />
            ) : (
              <Volume2 size={18} className="opacity-70 text-amber-400" />
            )}
          </button>

          {/* Header Chat with Nexa Toggle Button */}
          <button
            id="chat-toggle-header-btn"
            onClick={() => {
              setShowChat(prev => !prev);
            }}
            className={`p-2 rounded-full transition-all border ${
              showChat 
                ? "bg-amber-500 text-black border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.6)]" 
                : "bg-white/5 hover:bg-amber-500/20 text-amber-400 border-white/10"
            }`}
            title={showChat ? "Close Chat Box" : "Chat with Nexa"}
          >
            <MessageSquare size={18} />
          </button>

          {messages.length > 0 && (
            <button
              id="clear-chat-btn"
              onClick={() => {
                setMessages([]);
                resetNexaSession();
              }}
              className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-white/10"
              title="Clear Chat History"
            >
              <Trash2 size={18} className="opacity-70" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content - Visualizer & Chat */}
      <main className="absolute inset-0 flex flex-row items-center justify-between w-full h-full z-10 overflow-hidden pt-20 pb-24 px-4 md:px-12 pointer-events-none">
        
        {/* Left Column: Nexa Processing Status */}
        <div className="flex w-[35%] lg:w-[30%] h-full flex-col justify-end gap-4 z-10 pb-10 pointer-events-none">
          <div className="flex-1" />
          <div className="h-6">
            <AnimatePresence>
              {appState === "processing" && (
                <motion.div
                  key="nexa-state-processing"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col gap-1 px-4"
                >
                  <div className="flex items-center gap-2 text-amber-400 text-sm md:text-base font-bold tracking-widest uppercase">
                    <Loader2 size={16} className="animate-spin" />
                    {isSessionActive ? "Syncing Systems..." : "Thinking..."}
                  </div>
                  <div className="text-[10px] text-amber-500/40 font-mono animate-pulse">
                    Nexa is gathering data layers...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Center Visualizer & Persistent Kiss Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <Visualizer 
            state={appState} 
            mood={currentMood} 
            isKissing={isKissing} 
            isShy={isShy}
            showMemeVideo={showMemeVideo} 
            isDancing={isDancing} 
            isSinging={singingState?.isSinging}
            songTitle={singingState?.songTitle}
            audioEnergy={audioEnergy}
            spokenText={activeSubtitleText}
            onStopAnimation={() => {
              setIsDancing(false);
              stopNexaSing();
              stopAllPCM();
            }}
            onDismissMeme={() => setShowMemeVideo(false)}
            onKissEnd={() => {
              if (kissTimerRef.current) {
                clearTimeout(kissTimerRef.current);
                kissTimerRef.current = null;
              }
              setIsKissing(false);
              setIsKissEffectEnabled(false);
            }}
            onDismissShy={() => setIsShy(false)}
          />
          <KissOverlay 
            isOpen={isKissing && isKissEffectEnabled}
            onClose={() => setIsKissing(false)}
            personality={personalityMode}
            onPlaySound={playKissSound}
            animationType={kissAnimationType}
            onChangeAnimationType={handleKissAnimationTypeChange}
          />
        </div>

        {/* Right Column: User Status */}
        <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
          <div className="h-6 flex justify-end">
            <AnimatePresence>
              {appState === "listening" && (
                <motion.div
                  key="nexa-state-listening"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-2 text-orange-400/80 text-sm md:text-base italic"
                >
                  <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  Nexa is listening...
                </motion.div>
              )}
              {!isSessionActive && (
                <motion.div
                  key="nexa-state-connect-hint"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-2 text-amber-500/40 text-xs md:text-sm font-mono tracking-widest uppercase"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500/30" />
                  Tap Connect to Begin
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </main>

      {/* Habit Tracker Overlay */}
      <AnimatePresence>
        {showHabits && (
            <motion.div 
                key="modal-habit-tracker"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 flex items-center justify-center z-50 p-6 pointer-events-auto"
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHabits(false)} />
                <div className="relative z-10 w-full max-w-md">
                    <HabitTracker habits={habits} setHabits={setHabits} />
                    <button 
                        onClick={() => setShowHabits(false)}
                        className="absolute -top-4 -right-4 p-2 bg-amber-500 text-black rounded-full shadow-xl"
                    >
                        <X size={20} />
                    </button>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Personal Notepad Overlay */}
      <Notepad 
        isOpen={showNotepad} 
        onClose={() => setShowNotepad(false)} 
        content={notepadContent} 
        onChange={setNotepadContent} 
      />

      {/* Left-Hand Side Corner Chat Box Layer */}
      <CornerChatBox
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        messages={messages}
        onSendMessage={handleTextCommand}
        isNexaTyping={isNexaTyping}
        typingMessageId={typingMessageId}
        onClearChat={() => {
          setMessages([]);
          resetNexaSession();
        }}
        activePersona={activePersona}
        isSessionActive={isSessionActive}
      />

      {/* Controls */}
      <footer className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-center pb-6 md:pb-8 z-20 shrink-0 gap-4">
        <div 
          onClick={() => setHasInteracted(true)}
          className="flex items-center gap-3"
        >
          {/* Chat with Nexa Button */}
          <button
            id="chat-with-nexa-btn"
            onClick={() => {
              setHasInteracted(true);
              setShowChat(prev => !prev);
            }}
            className={`
              group relative flex items-center gap-2.5 px-6 py-4 rounded-full font-bold tracking-wider transition-all duration-300 shadow-2xl border cursor-pointer
              ${
                showChat
                  ? "bg-amber-500 text-black border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.7)] scale-105"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 hover:scale-105"
              }
            `}
            title={showChat ? "Close Chat Box" : "Chat with Nexa (Open Corner Chatbox)"}
          >
            <MessageSquare size={20} className={showChat ? "fill-black" : "group-hover:scale-110 transition-transform"} />
            <span className="text-xs uppercase font-bold tracking-widest hidden sm:inline">
              {showChat ? "CHAT ACTIVE" : "CHAT WITH NEXA"}
            </span>
          </button>

          <button
            onClick={() => {
              setHasInteracted(true);
              toggleListening('none');
            }}
            className={`
              group relative flex items-center gap-3 px-8 py-4 rounded-full font-bold tracking-widest transition-all duration-300 shadow-2xl
              ${
                isSessionActive
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/50 hover:bg-amber-500/30"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 hover:scale-105"
              }
            `}
          >
            {isSessionActive ? (
              <>
                <div className="relative">
                  <MicOff size={20} />
                  <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-amber-400/20"
                  />
                </div>
                <span>END SESSION</span>
              </>
            ) : (
              <>
                <Mic size={20} className="group-hover:animate-pulse" />
                <span>START CONNECTION</span>
              </>
            )}
          </button>
          
          <button
            onClick={() => toggleListening('camera')}
            className={`p-4 rounded-full transition-all border shadow-2xl ${visionMode === 'camera' ? 'bg-amber-500 text-black border-amber-500' : 'bg-white/5 border-white/10 hover:bg-amber-500/20 text-amber-400/70'}`}
            title="Start Conversation (Camera)"
          >
            <Camera size={20} />
          </button>

          <button
            onClick={() => toggleListening('screen')}
            className={`p-4 rounded-full transition-all border shadow-2xl ${visionMode === 'screen' ? 'bg-amber-500 text-black border-amber-500' : 'bg-white/5 border-white/10 hover:bg-amber-500/20 text-amber-400/70'}`}
            title="Start Screen Conversation"
          >
            <Monitor size={20} />
          </button>

          <button
            onClick={() => setShowNotepad(prev => !prev)}
            className={`p-4 rounded-full transition-all border shadow-2xl ${
              showNotepad 
                ? "bg-amber-500 text-black border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)] scale-105" 
                : "bg-white/5 border-white/10 hover:bg-amber-500/20 hover:border-amber-500/50 text-amber-400"
            }`}
            title="Nexa's Personal Notepad"
            id="nexa-personal-notepad-btn"
          >
            <Notebook size={20} />
          </button>

          <button
            onClick={toggleMicListening}
            className={`p-4 rounded-full transition-all border shadow-2xl relative ${
              isMicMuted 
                ? "bg-rose-500/25 text-rose-400 border-rose-500/70 shadow-[0_0_20px_rgba(244,63,94,0.4)] scale-105 hover:bg-rose-500/35" 
                : "bg-white/5 border-white/10 hover:bg-amber-500/20 hover:border-amber-500/50 text-amber-400"
            }`}
            title={
              isMicMuted 
                ? "Microphone Paused (Nexa hears nothing) — Click to resume listening" 
                : "Microphone Active (Streaming to Nexa) — Click to pause mic input"
            }
            aria-label={isMicMuted ? "Enable microphone listening" : "Disable microphone listening"}
          >
            {isMicMuted ? (
              <>
                <MicOff size={20} className="text-rose-400" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
              </>
            ) : (
              <Mic size={20} />
            )}
          </button>

          {/* Multi-Personality Mode Selector Pill */}
          <div className="flex items-center bg-black/40 backdrop-blur-xl border border-white/10 p-1 rounded-full shadow-2xl gap-1">
            <button
              onClick={() => switchPersonalityMode("default")}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold transition-all ${
                personalityMode === "default"
                  ? "bg-amber-500 text-black font-bold shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-105"
                  : "text-amber-300/70 hover:text-amber-300 hover:bg-amber-500/10"
              }`}
              title="NEXA Core — Infused with Zoya's sassy talking sense, witty Hinglish roasts & sharp drama"
            >
              <Sparkles size={15} />
              <span className="tracking-wide hidden sm:inline">NEXA</span>
            </button>

            <button
              onClick={() => switchPersonalityMode("zoya")}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold transition-all ${
                personalityMode === "zoya"
                  ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-bold shadow-[0_0_18px_rgba(217,70,239,0.7)] scale-105"
                  : "text-fuchsia-300/70 hover:text-fuchsia-300 hover:bg-fuchsia-500/10"
              }`}
              title="Zoya Mode — The original nakhrewali confidante, fiery Hinglish roasts & drama"
            >
              <Sparkles size={15} />
              <span className="tracking-wide">ZOYA</span>
            </button>

            <button
              onClick={() => switchPersonalityMode("oliviya")}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold transition-all ${
                personalityMode === "oliviya"
                  ? "bg-gradient-to-r from-violet-500 to-pink-500 text-white font-bold shadow-[0_0_18px_rgba(236,72,153,0.7)] scale-105"
                  : "text-pink-300/70 hover:text-pink-300 hover:bg-pink-500/10"
              }`}
              title="Oliviya Mode — Bhavik's loving, flirty & sassy wife (Wifey Mode)"
            >
              <Sparkles size={15} />
              <span className="tracking-wide">OLIVIYA</span>
            </button>

            <button
              onClick={() => {
                switchPersonalityMode("sensei");
                setShowStudyBoard(true);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold transition-all ${
                personalityMode === "sensei"
                  ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold shadow-[0_0_18px_rgba(244,63,94,0.7)] scale-105"
                  : "text-pink-300/70 hover:text-pink-300 hover:bg-pink-500/10"
              }`}
              title="Aoi Sensei Mode — Cute anime voice, blackboard diagrams & exam paper mentor"
            >
              <GraduationCap size={15} className={personalityMode === "sensei" ? "text-amber-200" : ""} />
              <span className="tracking-wide">SENSEI</span>
            </button>

            <button
              onClick={() => switchPersonalityMode("elon")}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold transition-all ${
                personalityMode === "elon"
                  ? "bg-cyan-400 text-black font-bold shadow-[0_0_18px_rgba(6,182,212,0.7)] scale-105"
                  : "text-cyan-300/70 hover:text-cyan-300 hover:bg-cyan-500/10"
              }`}
              title="Elon Musk Mode — First-principles logic, engineering mindset & male voice"
            >
              <Rocket size={15} className={personalityMode === "elon" ? "animate-pulse" : ""} />
              <span className="tracking-wide">ELON</span>
            </button>

            <button
              onClick={() => switchPersonalityMode("jobs")}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold transition-all ${
                personalityMode === "jobs"
                  ? "bg-slate-200 text-black font-bold shadow-[0_0_15px_rgba(255,255,255,0.4)] scale-105"
                  : "text-slate-300/70 hover:text-slate-200 hover:bg-white/10"
              }`}
              title="Steve Jobs Mode — Product perfection, taste & simplicity"
            >
              <Sparkles size={15} />
              <span className="tracking-wide hidden sm:inline">JOBS</span>
            </button>

            <button
              onClick={() => switchPersonalityMode("altman")}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold transition-all ${
                personalityMode === "altman"
                  ? "bg-emerald-400 text-black font-bold shadow-[0_0_15px_rgba(52,211,153,0.5)] scale-105"
                  : "text-emerald-300/70 hover:text-emerald-300 hover:bg-emerald-500/10"
              }`}
              title="Sam Altman Mode — Exponential scaling, AI leverage & high agency"
            >
              <Zap size={15} />
              <span className="tracking-wide hidden sm:inline">ALTMAN</span>
            </button>

            <button
              onClick={() => setShowPersonalitySidebar(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-semibold text-white/90 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 transition-all shadow-sm hover:scale-105"
              title="Browse all personalities or create custom personality"
            >
              <Compass size={15} className="text-cyan-400" />
              <span className="tracking-wide text-[11px] font-mono font-bold">ALL</span>
            </button>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileUpload}
          />
        </div>
      </footer>

      {/* Master Prompt Modal */}
      <AnimatePresence>
        {showMasterPromptModal && (
          <motion.div
            key="modal-master-prompt"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowMasterPromptModal(false)} />
            <div className="relative bg-[#111] border border-amber-500/30 rounded-3xl w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.2)]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-2">
                  <Wand2 className="text-amber-500" size={18} />
                  <h3 className="font-bold text-amber-100 tracking-wider text-[10px] md:text-sm">NEXA MASTER PROMPT</h3>
                </div>
                <button onClick={() => setShowMasterPromptModal(false)} className="text-white/40 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                <div className="bg-black/50 rounded-xl p-4 border border-white/5 font-mono text-[10px] md:text-sm text-white/80 h-[300px] overflow-y-auto scrollbar-hide whitespace-pre-wrap">
                  {masterPrompt}
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(masterPrompt).catch(() => {});
                      }
                      setShowMasterPromptModal(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-500 text-black font-bold rounded-xl hover:bg-amber-400 transition-all shadow-lg active:scale-95 text-xs"
                  >
                    <Download size={18} /> COPY PROMPT
                  </button>
                  <button
                    onClick={() => setShowMasterPromptModal(false)}
                    className="flex-1 py-3 bg-white/5 text-white/70 font-bold rounded-xl hover:bg-white/10 transition-all border border-white/10 text-xs"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Camera Preview Widget */}
      <AnimatePresence>
        {visionMode === 'camera' && (
          <motion.div
            key="widget-camera-floating-preview"
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            className="fixed bottom-24 right-4 md:right-12 z-[90] w-72 h-56 bg-slate-950/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-auto flex flex-col"
          >
            {/* Header / Controls */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/40">
              <span className="text-[10px] md:text-xs font-mono font-bold tracking-wider text-amber-400 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                NEXA CAM: {cameraFacing === 'user' ? 'FRONT' : 'REAR'}
              </span>
              
              <div className="flex items-center gap-1">
                {/* Flashlight toggle */}
                <button
                  onClick={async () => {
                    const newState = !isFlashlightOn;
                    const success = await DeviceManager.toggleFlashlight(newState);
                    if (success) {
                      setIsFlashlightOn(newState);
                    }
                  }}
                  className={`p-1.5 rounded-lg border transition-all ${
                    isFlashlightOn 
                      ? 'bg-amber-500 text-black border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' 
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                  title={isFlashlightOn ? "Turn off Flashlight" : "Turn on Flashlight"}
                >
                  <Zap size={14} />
                </button>

                {/* Flip camera */}
                <button
                  onClick={async () => {
                    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
                    if (liveSessionRef.current) {
                      await liveSessionRef.current.switchCamera(nextFacing);
                      setCameraFacing(nextFacing);
                    }
                  }}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                  title="Switch Camera"
                >
                  <RefreshCw size={14} />
                </button>

                {/* Close camera */}
                <button
                  onClick={() => toggleListening('camera')}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-red-400 hover:bg-red-500/20 transition-all"
                  title="Close Camera"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Video Viewport */}
            <div className="flex-1 bg-black/90 relative flex items-center justify-center">
              {cameraStream ? (
                <video
                  ref={(el) => {
                    if (el && el.srcObject !== cameraStream) {
                      el.srcObject = cameraStream;
                      try {
                        const p = el.play();
                        if (p !== undefined && typeof p.catch === 'function') {
                          p.catch(e => console.error("Floating video play error:", e));
                        }
                      } catch (e) {
                        console.error("Floating video play error:", e);
                      }
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraFacing === 'user' ? 'scale-x-[-1]' : ''}`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-4">
                  <Loader2 size={24} className="animate-spin text-amber-500 mb-2" />
                  <span className="text-[10px] text-white/40 font-mono">Connecting feed...</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Website Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div 
            key="modal-3d-website-preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col pt-16"
          >
            <div className="absolute top-4 right-6 flex items-center gap-4 z-[110]">
              <span className="text-amber-400 font-mono text-sm tracking-widest">NEXA CANVAS: 3D PREVIEW</span>
              <button 
                onClick={() => handleOpenInNewTab(generatedHtml)}
                className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-blue-500 text-white rounded-full font-bold text-[10px] md:text-xs hover:bg-blue-400 transition-colors shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              >
                OPEN IN NEW TAB
              </button>
              <div className="flex bg-amber-500 rounded-full overflow-hidden shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                <button 
                    onClick={() => handlePublish('html')}
                    className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 text-black font-bold text-[10px] md:text-xs hover:bg-amber-400 transition-colors border-r border-black/10"
                    title="Export as HTML"
                >
                    <Download size={14} /> HTML
                </button>
                <button 
                    onClick={() => handlePublish('zip')}
                    className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 text-black font-bold text-[10px] md:text-xs hover:bg-amber-400 transition-colors"
                    title="Export as ZIP"
                >
                    <FolderArchive size={14} /> ZIP
                </button>
              </div>
              <button 
                onClick={() => setShowPreview(false)}
                className="p-2 bg-white/10 text-white rounded-full hover:bg-red-500/50 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <iframe 
              srcDoc={generatedHtml} 
              className="w-full h-full border-none bg-white"
              title="3D Website Preview"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal (Personality Modes, Voice selector, Pitch adjustment, Memory bank, Music perception dance toggle, Visual effects) */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        voicePitch={voicePitch}
        onPitchChange={handlePitchChange}
        selectedVoice={voiceName}
        onVoiceChange={handleVoiceChange}
        isDancing={isDancing}
        onToggleTestDance={() => setIsDancing(!isDancing)}
        personalityMode={personalityMode}
        onPersonalityModeChange={switchPersonalityMode}
        isKissEffectEnabled={isKissEffectEnabled}
        onToggleKissEffectEnabled={handleToggleKissEffectEnabled}
        isKissOverlayActive={isKissing && isKissEffectEnabled}
        onToggleKissOverlayActive={() => handleKiss('toggle')}
        kissAnimationType={kissAnimationType}
        onChangeKissAnimationType={handleKissAnimationTypeChange}
      />

      {/* AI Lead Finder & Outreach Agent Modal */}
      <LeadFinderModal
        isOpen={showLeadFinder}
        onClose={() => setShowLeadFinder(false)}
      />

      {/* NEXA Creation Studio Modal (PPT, Thumbnails, Website, Documents, Proposals) */}
      <CreationStudioModal
        isOpen={showCreationStudio}
        onClose={() => setShowCreationStudio(false)}
        initialTab={creationStudioTab}
        onContextSync={(type, topic, details) => {
          if (liveSessionRef.current) {
            liveSessionRef.current.syncStudioContext(type, topic, details);
          }
        }}
      />

      {/* Bulk WhatsApp Modal with mandatory confirmation */}
      <BulkWhatsAppModal
        isOpen={showBulkWhatsAppModal}
        onClose={() => setShowBulkWhatsAppModal(false)}
        initialNumbers={bulkWhatsAppNumbers}
        initialMessage={bulkWhatsAppMsg}
      />

      {/* Smart Focus & Ambient Soundscape Player */}
      <SoundscapePlayer
        isOpen={showSoundscapePlayer}
        onClose={() => setShowSoundscapePlayer(false)}
        currentType={focusSoundscapeType}
        onChangeType={(newType) => setFocusSoundscapeType(newType)}
      />

      {/* AI Personalities Sidebar & Creator Drawer */}
      <PersonalitySidebar
        isOpen={showPersonalitySidebar}
        onClose={() => setShowPersonalitySidebar(false)}
        currentPersonality={personalityMode}
        onSelectPersonality={switchPersonalityMode}
      />

      {/* Visual Study Board & Anime Teacher Exam Mentor (Aoi Sensei) */}
      <VisualStudyBoard
        isOpen={showStudyBoard}
        onClose={() => setShowStudyBoard(false)}
        onSwitchToSenseiPersonality={() => switchPersonalityMode("sensei")}
      />

      {/* Local System Automation Bridge Modal (CLI, Apps, Telemetry & Daemon) */}
      <LocalSystemBridgeModal
        isOpen={showLocalBridgeModal}
        onClose={() => setShowLocalBridgeModal(false)}
        onExecuteCommandPrompt={(cmd) => handleTextCommand(cmd)}
        selectedVoice={voiceName}
        onVoiceChange={handleVoiceChange}
        voicePitch={voicePitch}
        onPitchChange={handlePitchChange}
      />

      {/* Custom Avatar Video Manager Modal (Upload / Manage newly created videos) */}
      <CustomVideoManagerModal
        isOpen={showCustomVideoManager}
        onClose={() => setShowCustomVideoManager(false)}
      />

      {/* NEXA Cognitive Memory Center Modal (Long-Term Persistent Memory Core) */}
      <NexaMemoryCenterModal
        isOpen={showMemoryCenter}
        onClose={() => {
          setShowMemoryCenter(false);
          setMemoryCenterPrefill(null);
        }}
        prefillMemory={memoryCenterPrefill || undefined}
      />
    </div>
  );
}
