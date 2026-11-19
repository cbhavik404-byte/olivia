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

export type OliviaVoiceStyle =
  | "auto"
  | "kawaii"
  | "tsundere"
  | "playful"
  | "shy"
  | "romantic"
  | "excited"
  | "dramatic"
  | "mischievous"
  | "serious";

export interface OliviaCreatorConfig {
  cutePercent: number;
  naughtyPercent: number;
  playfulPercent: number;
  voiceName: "Zephyr" | "Aoede" | "Kore" | "Puck" | "Charon" | "Fenrir";
  basePitch: number;
  baseSpeed: number;
  expressiveTtsEnabled: boolean;
  hinglishMix: "balanced" | "heavy_hinglish" | "english_dominant";
  enableJapaneseExpressions: boolean;
  enableActionDescriptions: boolean;
  actionFrequency: "occasional" | "minimal" | "expressive";
  signaturePhrase: string;
  seriousModeAutoAdapt: boolean;
  customDirectives: string;
}

export type CocoVoiceStyle =
  | "auto"
  | "late_night"
  | "affectionate"
  | "curious"
  | "playful"
  | "gentle_sad"
  | "excited"
  | "casual_gossip"
  | "technical_warm";

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
  | "coco"
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
export type MemoryTier = "long_term" | "temporary" | "project";
export type MemoryResolutionStatus = "open" | "resolved";

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
  tier?: MemoryTier;
  projectId?: string | null;
  projectName?: string | null;
  personalityId?: string | null;
  resolutionStatus?: MemoryResolutionStatus;
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

export type LanguageRegister = "professional" | "casual" | "friendly" | "playful" | "slang" | "mild_profanity";
export type ProfanityLevel = 0 | 1 | 2 | 3;

export interface PersonalityLanguageConfig {
  personalityId: string;
  languageRegister: LanguageRegister;
  profanityLevel: ProfanityLevel;
  allowSlang: boolean;
  updatedAt: string;
}

export interface PersonalityKnowledgeEntry {
  id: string;
  personalityId: string;
  topic: string;
  summary: string;
  sourceUrl: string;
  sourceTitle: string;
  publishedAt: string;
  retrievedAt: string;
  contentHash: string;
  version: number;
  verificationStatus: "CONFIRMED" | "UNVERIFIED" | "DISPUTED" | "FALSE";
  layer?: "core" | "knowledge_update" | "perspective";
  isHistorical?: boolean;
  sourceDate?: string;
  confidence?: number;
}

export interface KnowledgeUpdateLog {
  id: string;
  personalityId: string;
  status: "success" | "skipped" | "error";
  itemsAdded: number;
  itemsUpdated: number;
  message: string;
  timestamp: string;
}

export interface ConversationSnapshot {
  id: string;
  title: string;
  projectId?: string | null;
  personalityId: string;
  summary: string;
  turns: { sender: "user" | "nexa"; text: string; timestamp?: string }[];
  savedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actionType: string;
  target: string;
  status: "confirmed" | "executed" | "rejected" | "failed";
  confirmedByUser: boolean;
  details: string;
  timestamp: string;
}

export interface ApiTelemetryEntry {
  id: string;
  endpoint: string;
  operation: string;
  model: string;
  attemptCount: number;
  fallbackUsed: boolean;
  latencyMs: number;
  status: "success" | "quota_limited" | "error";
  httpStatus: number;
  errorMessage?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
  costStatus: string;
  createdAt: string;
}

export interface ApiTelemetrySummary {
  totalCalls: number;
  successCalls: number;
  quotaLimitedCalls: number;
  errorCalls: number;
  fallbackCalls: number;
  avgLatencyMs: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  knownCostUsd: number | null;
}

// ==========================================
// BROWSER OPERATOR & CHROME EXTENSION TYPES
// ==========================================

export interface BrowserTabInfo {
  id: number;
  windowId: number;
  title: string;
  url: string;
  active: boolean;
  favIconUrl?: string;
  isNexaTab?: boolean;
}

export type SupportedAiPlatform = "chatgpt" | "claude" | "gemini" | "grok" | "perplexity";

export interface BrowserBridgeStatus {
  extensionConnected: boolean;
  extensionlessReady?: boolean;
  extensionVersion?: string;
  connectedAt?: string;
  tabCount: number;
  tabs: BrowserTabInfo[];
}

// ==========================================
// GMAIL AI ASSISTANT TYPES
// ==========================================

export interface GmailAttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  bodyText: string;
  date: string;
  internalDateMs: number;
  isUnread: boolean;
  labels: string[];
  attachments: GmailAttachmentMeta[];
  urgency: "high" | "normal" | "low";
  detectedDeadlines: string[];
}

export interface PendingGmailSendApproval {
  id: string;
  mode: "reply" | "new" | "draft_send";
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  draftId?: string;
  requiresPhraseConfirmation: boolean;
}

// ==========================================
// LIVE NEWS INTELLIGENCE ENGINE TYPES
// ==========================================

export const NEWS_CATEGORIES = [
  "National",
  "International",
  "Politics & Government",
  "Technology & AI",
  "Business & Startups",
  "Economy & Finance",
  "Science & Space",
  "Entertainment",
  "Gaming",
  "Sports",
  "Education",
  "Cybersecurity",
  "Major Breaking News",
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];
export type NewsConfidenceStatus = "CONFIRMED" | "DEVELOPING" | "UNVERIFIED";

export interface NewsSourceLink {
  title: string;
  url: string;
  publisher: string;
}

export interface NewsArticle {
  id: string;
  headline: string;
  category: NewsCategory;
  summary: string;
  whyItMatters: string;
  publishedAt: string;
  eventTime: string;
  sourceLinks: NewsSourceLink[];
  confidenceStatus: NewsConfidenceStatus;
  crossCheckCount: number;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// CONTINUOUS SCREEN SESSION OBSERVER TYPES
// ==========================================

export interface ScreenObservationFrame {
  index: number;
  timestamp: string;
  label: string;
  imageDataUrl: string;
  changeScore: number;
  note?: string;
}

export interface ScreenWebsiteAnalysisReport {
  sessionStartedAt: string;
  sessionEndedAt: string;
  totalFramesCaptured: number;
  observedSections: string[];
  structureAndHierarchy: string;
  navigationAndUx: string;
  designConsistency: string;
  contentAndClarity: string;
  missingSections: string[];
  bugsOrIssues: string[];
  prioritizedImprovements: string[];
  coverageDisclaimer: string;
}

// ==========================================
// SELF-IMPROVEMENT ADVISOR & BACKLOG TYPES
// ==========================================

export type ImprovementStatus = "Proposed" | "Approved" | "In Progress" | "Completed" | "Rejected";
export type ImprovementDifficulty = "Low" | "Medium" | "High";
export type ImprovementPriority = "Critical" | "High" | "Medium" | "Low";

export interface ImprovementBacklogItem {
  id: string;
  proposedFeature: string;
  whyNeeded: string;
  expectedBenefit: string;
  difficulty: ImprovementDifficulty;
  dependencies: string[];
  priority: ImprovementPriority;
  status: ImprovementStatus;
  sourceType: "telemetry" | "gap" | "user_request" | "system_audit";
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CapabilityGapEntry {
  id: string;
  commandText: string;
  intent: string;
  reason: string;
  category: string;
  status: "logged" | "addressed";
  occurrenceCount: number;
  lastOccurredAt: string;
  createdAt: string;
}


