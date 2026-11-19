export type AppState = "idle" | "listening" | "processing" | "speaking";
export type NexaMood = "sassy" | "dramatic" | "happy" | "neutral" | "analytical" | "visionary" | "shy";
export type KissAnimationType = "heart_burst" | "floating_lips" | "love_letter_swarm";

export type AvatarVocalEmotion = 
  | "neutral" 
  | "shocked" 
  | "happy" 
  | "flattered" 
  | "intimate" 
  | "sad" 
  | "defensive" 
  | "playful"
  | "shy";

export interface VocalEmotionData {
  emotion: AvatarVocalEmotion;
  intensity: number; // 0 to 1
  trigger: "acoustic_shout" | "acoustic_whisper" | "praise" | "scolding" | "model_tool" | "manual" | "sentiment";
  decibels?: number;
  userSpokeText?: string;
  timestamp?: number;
}
export type PersonalityMode = 
  | "default" 
  | "oliviya"
  | "zoya"
  | "elon" 
  | "jobs" 
  | "altman" 
  | "hormozi" 
  | "mrbeast" 
  | "naval" 
  | "buffett" 
  | "goggins" 
  | "communication" 
  | "kahneman"
  | "sensei"
  | "feynman"
  | "tesla"
  | "munger"
  | "davinci"
  | "lincoln"
  | "aurelius"
  | "turing"
  | string;

export interface Personality {
  id: string;
  name: string;
  shortName: string;
  title: string;
  subtitle: string;
  gender: "male" | "female" | "neutral";
  defaultVoice: string; // "Fenrir" | "Charon" | "Kore" | "Zephyr" | "Puck"
  avatarIcon: string;
  avatarLetter: string;
  badge: string;
  accentColor: string;
  themeColor: string;
  tagline: string;
  tags: string[];
  welcomeMessage: string;
  safetyRedirect: string;
  systemInstruction: string;
  isCustom?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "nexa";
  text: string;
  image?: string;
  isFinal?: boolean;
  timestamp?: number;
}

export interface Habit {
  id: string;
  name: string;
  completedDays: string[]; // ISO dates
}

export type SoundscapeType = "rain" | "lofi" | "binaural" | "ocean" | "cafe" | "nature" | "whitenoise" | "off";

export type SlideLayout = 
  | "title" 
  | "bento_grid" 
  | "metrics_kpi" 
  | "problem_solution" 
  | "timeline_roadmap" 
  | "quote_highlight" 
  | "bullets_visual";

export interface PPTSlide {
  slideNumber: number;
  layout?: SlideLayout;
  title: string;
  subtitle?: string;
  tag?: string;
  contextSummary?: string; // Clear executive context establishing the slide's purpose
  imageUrl?: string;       // High-resolution relevant contextual visual
  imageCaption?: string;   // Descriptive caption for the visual
  bullets: string[];
  kpis?: { value: string; label: string; change?: string; color?: string }[];
  cards?: { icon?: string; heading: string; description: string; tag?: string }[];
  timeline?: { step: string; title: string; desc: string; status?: "completed" | "in_progress" | "upcoming" }[];
  comparison?: { leftHeading: string; leftItems: string[]; rightHeading: string; rightItems: string[] };
  quote?: { text: string; author?: string; role?: string };
  visualDirection: string;
  speakerNotes: string;
}

export interface PPTDeck {
  topic: string;
  targetAudience: string;
  overview: string;
  theme?: "cyberpunk" | "executive" | "emerald" | "sunset" | "quartz";
  slides: PPTSlide[];
}

export interface ThumbnailConcept {
  id: string;
  archetype?: "curiosity_gap" | "before_after" | "authority_blueprint" | "shock_reaction";
  title: string;
  hook: string;
  fomoAngle?: string;              // High-voltage FOMO trigger (e.g. "99% will be replaced", "Disappearing in 24h")
  expressionType?: string;          // Crazy human expression (e.g. "Shock gasp wide eyes", "Mind-blown disbelief")
  visualHierarchy: string;
  textOverlay: string;
  subTextOverlay?: string;
  badgeText?: string;
  colorPalette: string[];
  compositionTip: string;
  ctrPredictionScore?: number;
  cognitiveTension?: string;
  mobileReadability?: string;
  prompt: string;
  imageUrl?: string;
  primarySubjectImage?: string;     // Element 1: Crazy expression human subject (no face-swap)
  secondaryProofImage?: string;     // Element 2: Contextual proof image (chart, terminal, dashboard)
  visualElementsSummary?: string[] | string; // Breakdown of the 3+ distinct overlaid visual elements
  noFaceSwapDirective?: string;     // Explicit safeguard ensuring no face-swapping occurs
  abVariantNote?: string;
}

export interface DocumentDraft {
  type: string;
  title: string;
  subtitle?: string;
  sections: { heading: string; content: string }[];
  summary: string;
}

export interface ProposalDraft {
  clientName: string;
  projectName: string;
  executiveSummary: string;
  problemStatement: string;
  proposedServices: string[];
  deliverables: { item: string; description: string; timeline: string }[];
  timelineWeeks: string;
  investmentAmount: string;
  paymentTerms: string;
  nextSteps: string[];
}

export type OutreachStatus = "draft" | "approved" | "sent" | "replied" | "followup_needed";

export interface LeadProspect {
  id: string;
  businessName: string;
  industry: string;
  countryOrRegion: string;
  companySize: string;
  website: string;
  contactEmail: string;
  contactPageUrl: string;
  linkedinUrl: string;
  instagramUrl: string;
  prospectScore: number;
  qualificationReason: string;
  emailSubject: string;
  emailBody: string;
  status: OutreachStatus;
  followUpDate?: string;
  notes?: string;
  lastUpdated: string;
}

export interface LeadSearchCriteria {
  targetClientType: string;
  region: string;
  industry: string;
  companySize: string;
  offeringDescription: string;
  tone: "professional" | "conversational" | "high-impact" | "value-led";
  leadCount: number;
}

export type StudyDifficulty = "easy" | "medium" | "hard";

export interface StudyQuestion {
  id: string;
  questionNumber: number;
  question: string;
  marks?: number;
  difficulty: StudyDifficulty;
  topic: string;
  visualType?: "diagram" | "flowchart" | "equation" | "mindmap" | "table" | "ascii_art";
  visualIllustration: string;
  explanation: string;
  keyFormulas?: string[];
  examTip?: string;
  practiceAnswer?: string;
  isMastered?: boolean;
}

export interface StudyChatMessage {
  id: string;
  sender: "sensei" | "student";
  text: string;
  timestamp: number;
  visualSnippet?: string;
}

export interface StudyBoxState {
  subject: string;
  sourceTitle: string;
  sourceType: "uploaded_paper" | "uploaded_pdf" | "uploaded_image" | "online_search" | "preset_syllabus";
  difficultyLevel: StudyDifficulty;
  overviewSummary: string;
  syllabusBreakdown: {
    topic: string;
    weightage: string;
    importantTips: string;
  }[];
  questions: StudyQuestion[];
  currentQuestionIndex: number;
  blackboardNotes: string;
  studyChat: StudyChatMessage[];
  lastUpdated: string;
}

// ==========================================
// NEXA ADVANCED LONG-TERM MEMORY SYSTEM TYPES
// ==========================================

export type MemoryCategory = 
  | "Identity" 
  | "Preferences" 
  | "Life" 
  | "Active" 
  | "Relationships" 
  | "Milestones" 
  | "Behaviors";

export type MemorySource = "Manual" | "Automatic";
export type MemoryStatus = "Active" | "Planned" | "Completed" | "Archived";
export type VerificationStatus = "UserVerified" | "AIExtracted" | "Uncertain";

export interface NexaMemory {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: MemoryCategory;
  tags: string[];
  source: MemorySource;
  status: MemoryStatus;
  verificationStatus: VerificationStatus;
  confidence: number | null; // 0.0 - 1.0 or null
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastRecalledAt: string | null; // ISO
  recallCount: number;
  relatedMemoryIds: string[];
  sourceConversationId: string | null;
}

export interface MemorySettings {
  autoMemoryEnabled: boolean;
  notifyOnAutoSave: boolean;
  reviewBeforeSave: boolean;
  maxRecallItems: number;
}

export type MemorySortOption = 
  | "updated_desc" 
  | "created_desc" 
  | "created_asc" 
  | "alphabetical" 
  | "recall_count";

export interface MemoryExtractionResult {
  action: "SAVE" | "UPDATE" | "SKIP" | "ASK";
  title?: string;
  content?: string;
  category?: MemoryCategory;
  tags?: string[];
  status?: MemoryStatus;
  existingMemoryId?: string | null;
  reason?: string;
  confidence?: number;
}
