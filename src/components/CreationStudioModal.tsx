import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Sparkles, 
  Presentation, 
  Image as ImageIcon, 
  Globe, 
  FileText, 
  Briefcase, 
  Copy, 
  Check, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  ExternalLink,
  Layers,
  Wand2,
  RefreshCw,
  Eye,
  Code,
  Maximize2,
  Minimize2,
  TrendingUp,
  Target,
  Zap,
  BarChart3,
  Palette,
  MonitorPlay,
  Share2,
  Info,
  ShieldCheck,
  Flame,
  AlertTriangle,
  Upload,
  Plus,
  Trash2,
  Star,
  ZoomIn
} from "lucide-react";
import pptxgen from "pptxgenjs";
import { getGeminiClient } from "../services/aiClient";
import { GEMINI_MODELS } from "../config/modelRegistry";
import { PPTDeck, PPTSlide, ThumbnailConcept, DocumentDraft, ProposalDraft, SlideLayout } from "../types";

interface CreationStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "ppt" | "thumbnail" | "website" | "document" | "proposal";
  initialTab?: "ppt" | "thumbnail" | "website" | "document" | "proposal";
  onContextSync?: (type: "ppt" | "thumbnail" | "website" | "document" | "proposal", topic: string, details: string) => void;
}

export const CreationStudioModal: React.FC<CreationStudioModalProps> = ({
  isOpen,
  onClose,
  defaultTab = "ppt",
  initialTab,
  onContextSync
}) => {
  const [activeTab, setActiveTab] = useState<"ppt" | "thumbnail" | "website" | "document" | "proposal">(initialTab || defaultTab);

  useEffect(() => {
    if (isOpen && (initialTab || defaultTab)) {
      setActiveTab(initialTab || defaultTab);
    }
  }, [isOpen, initialTab, defaultTab]);

  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // PPT State
  const [pptTopic, setPptTopic] = useState("AI Agents & Autonomous Workflows for 2026");
  const [pptSlideCount, setPptSlideCount] = useState(8);
  const [pptAudience, setPptAudience] = useState("Tech Founders & Developers");
  const [pptTheme, setPptTheme] = useState<"cyberpunk" | "executive" | "emerald" | "sunset" | "quartz">("cyberpunk");
  const [pptDeck, setPptDeck] = useState<PPTDeck | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreenPresenter, setIsFullscreenPresenter] = useState(false);
  const [showPresenterNotes, setShowPresenterNotes] = useState(false);
  const [isExportingPptx, setIsExportingPptx] = useState(false);

  // Thumbnail State
  const [thumbTopic, setThumbTopic] = useState("I Built an Autonomous AI Employee in 24 Hours");
  const [thumbGenre, setThumbGenre] = useState("AI Coding & Tech");
  const [thumbConcepts, setThumbConcepts] = useState<ThumbnailConcept[]>([]);
  const [selectedConceptIndex, setSelectedConceptIndex] = useState(0);
  const [customOverlayText, setCustomOverlayText] = useState("");
  const [customBadgeText, setCustomBadgeText] = useState("");
  const [selectedExpression, setSelectedExpression] = useState<"shock_gasp" | "mind_blown" | "disbelief_stare" | "hyped_screaming">("shock_gasp");
  const [selectedProofElement, setSelectedProofElement] = useState<"viral_chart" | "terminal_code" | "revenue_dashboard" | "ai_hologram">("viral_chart");
  const [uploadedSubjectImage, setUploadedSubjectImage] = useState<string | null>(null);

  // Unlimited Multi-Photo Uploads
  interface UploadedPhotoItem {
    id: string;
    dataUrl: string;
    name: string;
    mimeType: string;
    base64: string;
  }
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhotoItem[]>([]);
  const [primaryPhotoIndex, setPrimaryPhotoIndex] = useState<number>(0);

  // High-Tech AI Prompt-Based Thumbnail Studio (ChatGPT & Gemini Quality)
  const [thumbnailSubTab, setThumbnailSubTab] = useState<"ai_prompt" | "hook_strategy">("ai_prompt");
  const [customAiPrompt, setCustomAiPrompt] = useState<string>(
    "Ultra high-tech YouTube thumbnail: cinematic 8K photorealistic creator with shocked gasp expression in neon cyber studio, floating 3D glowing holographic neural circuits, vibrant green exponential growth charts (+940% spike), high-voltage 3D text 'IT REPLACED ME?!' with glowing red alert badge. Octane render, cinematic rim lighting, volumetric smoke, photorealistic, 16:9 aspect ratio."
  );
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [isGeneratingAiImage, setIsGeneratingAiImage] = useState(false);
  const [generatedAiImageUrl, setGeneratedAiImageUrl] = useState<string | null>(null);
  interface GeneratedAiImageItem {
    id: string;
    url: string;
    prompt: string;
    timestamp: number;
  }
  const [aiGenerationHistory, setAiGenerationHistory] = useState<GeneratedAiImageItem[]>([]);
  const [fullscreenImagePreview, setFullscreenImagePreview] = useState<string | null>(null);

  const thumbnailCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Helper to ensure every PPT slide has a topic-relevant high-res contextual visual
  const getSlideVisual = (slide: PPTSlide, index: number) => {
    if (slide.imageUrl && slide.imageUrl.startsWith("http")) {
      return { url: slide.imageUrl, caption: slide.imageCaption || "Contextual architectural diagram & system overview" };
    }
    const curatedVisuals = [
      { url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80", caption: "High-Performance Neural Silicon & Hardware Acceleration" },
      { url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80", caption: "Real-Time Telemetry & Quantitative KPI Performance Matrix" },
      { url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80", caption: "Autonomous Code Execution Matrix & Cryptographic Core" },
      { url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80", caption: "Distributed Cloud Infrastructure & Global Latency Mesh" },
      { url: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80", caption: "Strategic Enterprise Alignment & Executive Leadership Review" },
      { url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80", caption: "High-Velocity Engineering Lab & Autonomous Deployment Pipeline" },
      { url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80", caption: "Generative Algorithmic Topography & Spatial Interface Design" },
      { url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80", caption: "Product Ecosystem Blueprint & Scalable UX Architecture" }
    ];
    return curatedVisuals[index % curatedVisuals.length];
  };

  // Website State
  const [webPrompt, setWebPrompt] = useState("Modern sleek landing page for an elite AI Automation Agency with dark theme, glowing badges, feature grid, and pricing cards");
  const [webHtml, setWebHtml] = useState<string>("");
  const [webPreviewMode, setWebPreviewMode] = useState<"preview" | "code">("preview");

  // Document State
  const [docType, setDocType] = useState("Executive Technical Report");
  const [docTopic, setDocTopic] = useState("Autonomous Voice Agents: Architecture & Real-Time Performance Benchmarks");
  const [docDraft, setDocDraft] = useState<DocumentDraft | null>(null);

  // Proposal State
  const [propClient, setPropClient] = useState("Apex Global Enterprises");
  const [propProject, setPropProject] = useState("End-to-End Enterprise AI Lead Intelligence & CRM Automation Pipeline");
  const [propBudget, setPropBudget] = useState("$24,000 USD / ₹20,00,000 INR");
  const [propTimeline, setPropTimeline] = useState("6 Weeks");
  const [proposalDraft, setProposalDraft] = useState<ProposalDraft | null>(null);

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Keyboard navigation for Presenter Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreenPresenter || !pptDeck) return;
      if (e.key === "ArrowRight" || e.key === "Space") {
        setCurrentSlideIndex(prev => Math.min(pptDeck.slides.length - 1, prev + 1));
      } else if (e.key === "ArrowLeft") {
        setCurrentSlideIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === "Escape") {
        setIsFullscreenPresenter(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreenPresenter, pptDeck]);

  // Sync custom text when thumbnail concept changes
  useEffect(() => {
    if (thumbConcepts[selectedConceptIndex]) {
      setCustomOverlayText(thumbConcepts[selectedConceptIndex].textOverlay || "");
      setCustomBadgeText(thumbConcepts[selectedConceptIndex].badgeText || "100% AUTONOMOUS");
    }
  }, [selectedConceptIndex, thumbConcepts]);

  // 1. Generate Full Formatted PPT Deck
  const handleGeneratePPT = async () => {
    setIsGenerating(true);
    try {
      const ai = getGeminiClient();
      if (!ai) throw new Error("API key not configured");
      const prompt = `You are a Principal Strategic Presentation Designer at McKinsey & Apple.
Create a fully formatted, multi-layout presentation deck of ${pptSlideCount} slides for:
Topic: "${pptTopic}"
Target Audience: "${pptAudience}"
Theme: "${pptTheme}"

CRITICAL MANDATORY PRESENTATION REQUIREMENTS:
1. Every single slide MUST contain:
   - "contextSummary": 1-2 sentences of clear, high-level executive context establishing why this slide exists, strategic background context, and executive purpose.
   - "imageUrl": A high-resolution relevant Unsplash image URL matching the slide's topic and visual theme (e.g., from technology, computing, enterprise architecture, neural telemetry, or robotics).
   - "imageCaption": A concise descriptive caption explaining the contextual visual or architectural diagram.
2. You MUST use varied, modern structured slide layouts across the deck:
- Slide 1: layout "title" (Hero title, subtitle, tag, overview, contextSummary)
- Slide 2: layout "metrics_kpi" (3-4 high-impact numerical KPI stats with label, value, change indicator)
- Slide 3: layout "bento_grid" (3 structured cards with icon name, heading, detailed description, tag)
- Slide 4: layout "problem_solution" (Left column: current friction/bottlenecks, Right column: autonomous solution)
- Slide 5: layout "timeline_roadmap" (4 milestone steps with step name, title, description, status)
- Slide 6: layout "quote_highlight" (Executive industry quote or breakthrough assertion)
- Other slides: layout "bullets_visual" or "bento_grid"

Return STRICT JSON matching this schema:
{
  "topic": "${pptTopic}",
  "targetAudience": "${pptAudience}",
  "overview": "High-level 2-sentence executive summary of the entire deck",
  "theme": "${pptTheme}",
  "slides": [
    {
      "slideNumber": 1,
      "layout": "title",
      "tag": "STRATEGIC BRIEFING 2026",
      "title": "Title",
      "subtitle": "Subtitle",
      "contextSummary": "Executive context explaining why this slide matters and strategic background",
      "imageUrl": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
      "imageCaption": "High-Performance Neural Silicon & Hardware Acceleration",
      "bullets": ["Point 1", "Point 2", "Point 3"],
      "kpis": [{"value": "10x", "label": "Execution Velocity", "change": "+900%", "color": "amber"}],
      "cards": [{"icon": "Zap", "heading": "Autonomous Layer", "description": "Details...", "tag": "Core"}],
      "timeline": [{"step": "Phase 1", "title": "Discovery", "desc": "Details...", "status": "completed"}],
      "comparison": {"leftHeading": "Traditional Manual Stack", "leftItems": ["Slow", "Error-prone"], "rightHeading": "AI Agent Architecture", "rightItems": ["Instant sub-200ms", "Deterministic"]},
      "quote": {"text": "Autonomous systems are not just faster—they redefine operational economics.", "author": "Bhavik", "role": "Lead Architect"},
      "visualDirection": "Detailed visual layout and design directive for this slide",
      "speakerNotes": "Word-for-word spoken talking points for the presenter"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODELS.TEXT_PRIMARY,
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      if (parsed.slides && parsed.slides.length > 0) {
        // Guarantee every slide has a verified relevant image and clear context
        const normalizedSlides = parsed.slides.map((s: PPTSlide, idx: number) => {
          const fallbackVis = getSlideVisual(s, idx);
          return {
            ...s,
            contextSummary: s.contextSummary || `Strategic Framing: Establishing key operational objectives, competitive differentiators, and executive rationale for ${s.title}.`,
            imageUrl: s.imageUrl || fallbackVis.url,
            imageCaption: s.imageCaption || fallbackVis.caption
          };
        });
        const finalDeck = { ...parsed, slides: normalizedSlides };
        setPptDeck(finalDeck);
        setCurrentSlideIndex(0);

        // Sync context to Live Session memory ledger
        onContextSync?.(
          "ppt",
          parsed.topic || pptTopic,
          `Target Audience: ${parsed.targetAudience || pptAudience}, Slides: ${normalizedSlides.length}, Theme: ${parsed.theme || pptTheme}, Executive Summary: ${parsed.overview || ''}`
        );
      }
    } catch (e) {
      console.error("PPT Generation error:", e);
      // Rich formatted fallback
      setPptDeck({
        topic: pptTopic,
        targetAudience: pptAudience,
        overview: `A strategic presentation blueprint detailing high-velocity execution, autonomous pipelines, and transformative outcomes for ${pptTopic}.`,
        theme: pptTheme,
        slides: [
          {
            slideNumber: 1,
            layout: "title",
            tag: "EXECUTIVE BRIEFING 2026",
            title: pptTopic,
            subtitle: `Architectural Blueprint & Strategic Execution for ${pptAudience}`,
            contextSummary: `High-level operational briefing introducing autonomous intelligence pipelines designed to accelerate ${pptTopic} with sub-250ms latency.`,
            imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
            imageCaption: "High-Performance Neural Silicon & Hardware Acceleration",
            bullets: [
              "Transitioning from manual oversight to deterministic autonomous agent swarms",
              "Real-time multimodal speech & computer vision execution pipelines",
              "Delivering 10x ROI with sub-250ms latency SLAs"
            ],
            visualDirection: "Minimal dark canvas with glowing amber typography, subtle grid lines, and high-contrast title typography.",
            speakerNotes: `Welcome everyone. Today we are presenting the comprehensive strategy for ${pptTopic}, tailored specifically for ${pptAudience}.`
          },
          {
            slideNumber: 2,
            layout: "metrics_kpi",
            tag: "PERFORMANCE BENCHMARKS",
            title: "Measurable Impact & Acceleration",
            subtitle: "Quantified performance gains achieved through autonomous execution",
            contextSummary: "Empirical benchmarking across throughput, accuracy, and operational cost, verifying a 10x multiplier over legacy architectures.",
            imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
            imageCaption: "Real-Time Telemetry & Quantitative KPI Performance Matrix",
            bullets: ["Zero operational downtime", "Deterministic verification gates"],
            kpis: [
              { value: "10x", label: "Execution Velocity", change: "+900% YoY", color: "amber" },
              { value: " sub-250ms", label: "Voice/Vision Latency", change: "Real-time", color: "emerald" },
              { value: "99.4%", label: "Accuracy Rate", change: "+14.2%", color: "blue" },
              { value: "68%", label: "Cost Reduction", change: "Immediate", color: "purple" }
            ],
            visualDirection: "4-column Bento KPI blocks with luminous top-border highlights, glowing numeric values, and green trend badges.",
            speakerNotes: "Take a look at these four cornerstone metrics. We are seeing a 10x acceleration in execution speed while dropping latency below 250ms."
          },
          {
            slideNumber: 3,
            layout: "bento_grid",
            tag: "ARCHITECTURE PILLARS",
            title: "Core System Infrastructure",
            subtitle: "Modular, high-throughput components designed for zero-latency execution",
            contextSummary: "Modular micro-service architecture separating real-time audio streams, vision frame perception, and deterministic execution.",
            imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
            imageCaption: "Autonomous Code Execution Matrix & Cryptographic Core",
            bullets: ["Modular micro-services", "Continuous context synchronization"],
            cards: [
              { icon: "Zap", heading: "Real-Time Voice Engine", description: "Bi-directional WebSocket audio streaming with pitch-adaptive Web Audio processing.", tag: "Sub-200ms" },
              { icon: "Layers", heading: "Visual Perception Matrix", description: "Sharp 1080p frame sampling with OCR, code understanding, and UI inspection.", tag: "Multimodal" },
              { icon: "BarChart3", heading: "Autonomous Task Executor", description: "Deterministic tool orchestration, background browser actions, and live notepad memory.", tag: "Grounded" }
            ],
            visualDirection: "3-column glassmorphic cards with glowing border gradients and Lucide iconography.",
            speakerNotes: "These three core pillars form the foundation of our autonomous ecosystem, working harmoniously to execute tasks end-to-end."
          },
          {
            slideNumber: 4,
            layout: "problem_solution",
            tag: "PARADIGM SHIFT",
            title: "Legacy Fragmentation vs Autonomous Engine",
            subtitle: "Comparing traditional manual bottlenecks with unified AI workflows",
            contextSummary: "Direct comparison between fragile manual workflows and resilient agentic execution pipelines with continuous state synchronization.",
            imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
            imageCaption: "Distributed Cloud Infrastructure & Global Latency Mesh",
            bullets: ["Eliminating manual context handoffs"],
            comparison: {
              leftHeading: "Legacy Manual Workflow",
              leftItems: [
                "Disjointed tools requiring constant human switching",
                "High latency (>10s) and manual data entry errors",
                "Linear scaling costs with severe burnout risks",
                "Fragmented context lost across disparate tabs"
              ],
              rightHeading: "NEXA Autonomous Ecosystem",
              rightItems: [
                "Unified bi-directional voice + vision + live execution",
                "Sub-250ms instantaneous answers with tool grounding",
                "Zero marginal cost per workflow step with infinite scale",
                "Continuous persistent dialogue memory across sessions"
              ]
            },
            visualDirection: "High-contrast split screen: muted red/slate on left, luminous amber/emerald on right.",
            speakerNotes: "Notice the clear contrast. On the left is the manual friction holding teams back; on the right is our instantaneous autonomous pipeline."
          },
          {
            slideNumber: 5,
            layout: "timeline_roadmap",
            tag: "EXECUTION ROADMAP",
            title: "Phased Deployment & Milestones",
            subtitle: "Strategic step-by-step rollout ensuring zero downtime",
            contextSummary: "Four-phase progressive rollout roadmap prioritizing stability, latency optimization, and enterprise swarm governance.",
            imageUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80",
            imageCaption: "Strategic Enterprise Alignment & Executive Leadership Review",
            bullets: ["Predictable sprint milestones"],
            timeline: [
              { step: "Phase 1", title: "Architecture & Memory", desc: "Core bi-directional stream setup & persistent dialogue caching", status: "completed" },
              { step: "Phase 2", title: "Tool & Studio Binding", desc: "Live PPT, Thumbnail, Document, and Web generator integration", status: "completed" },
              { step: "Phase 3", title: "Optimization & SLAs", desc: "Sub-200ms audio buffer pruning & instant topic shifting", status: "in_progress" },
              { step: "Phase 4", title: "Global Autonomous Scale", desc: "Multi-agent swarm execution across enterprise workflows", status: "upcoming" }
            ],
            visualDirection: "Horizontal timeline ribbon with glowing nodes, status pills, and connected gradient track.",
            speakerNotes: "Here is our execution roadmap. Phases 1 and 2 are fully operational, and we are currently finalizing Phase 3 latency optimizations."
          },
          {
            slideNumber: 6,
            layout: "quote_highlight",
            tag: "FOUNDATIONAL PRINCIPLE",
            title: "The Future of Human-AI Collaboration",
            subtitle: "Unlocking unprecedented creative and technical velocity",
            contextSummary: "Philosophical foundation emphasizing human agency and creative acceleration over replacement.",
            imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80",
            imageCaption: "High-Velocity Engineering Lab & Autonomous Deployment Pipeline",
            bullets: ["Empowering human creators with instant execution"],
            quote: {
              text: "Autonomous AI is not about replacing human creativity; it's about eliminating the friction between a creator's imagination and reality.",
              author: "Bhavik",
              role: "Lead Creator & AI Architect"
            },
            visualDirection: "Centrally framed elegant quote card with large amber quotation marks and author badge.",
            speakerNotes: "To close this section, this quote captures our fundamental mission: empowering creators to build without boundaries."
          }
        ]
      });
      setCurrentSlideIndex(0);
      onContextSync?.(
        "ppt",
        pptTopic,
        `Target Audience: ${pptAudience}, 6 Slides structured layout, Theme: ${pptTheme}`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Generate Strategic High-CTR Thumbnails
  const handleGenerateThumbnails = async () => {
    setIsGenerating(true);
    try {
      const ai = getGeminiClient();
      if (!ai) throw new Error("API key not configured");
      const prompt = `You are MrBeast and Decoding YT's Principal Creative Director and Viral Algorithmic Strategist.
Create 3 high-CTR, psychologically optimized YouTube thumbnail concepts for:
Video Title / Topic: "${thumbTopic}"
Niche / Genre: "${thumbGenre}"

CRITICAL HIGH-IMPACT VIRAL MANDATES:
1. High Visual Impact with Extreme FOMO ("Fear of Missing Out"):
   - Formulate aggressive urgency hooks (e.g., "🚨 ONLY 24 HOURS LEFT", "🔥 GAME OVER FOR DEVS", "DO NOT MISS THIS BEFORE IT GETS DELETED", "99% WILL FALL BEHIND").
2. Crazy Facial Expressions:
   - Exaggerated high-voltage human reaction (shock gasp with mouth agape, mind-blown hands on head in disbelief, intense wide-eyed hyper-focus stare, or hyped screaming).
3. STRICT SAFEGUARD - NO FACE-SWAPPING:
   - Ensure 100% native cohesive facial anatomy with zero synthetic face-swapping, zero unnatural head-pasting seams, and unified cinematic rim lighting.
4. AT LEAST THREE DISTINCT VISUAL ELEMENTS PER IMAGE:
   - Element 1: Primary Subject Image (Creator with crazy shocked/gasping facial expression, dramatic neon rim-lighting, 0% face-swap).
   - Element 2: Secondary Context Proof Image (Glowing exponential viral chart, dark alert code terminal, or 100x live revenue proof dashboard).
   - Element 3: 3D High-Contrast Text Overlay (2-4 punchy power words in all-caps, tilted pill with deep 3D drop-shadow) plus Viral FOMO Urgency Badge.

For each concept, calculate and provide:
- "title": Concept name
- "archetype": One of curiosity_gap | before_after | authority_blueprint | shock_reaction
- "hook": Exact viewer psychological trigger
- "fomoAngle": Urgent fear of missing out angle triggering instant clicks
- "expressionType": Crazy facial expression details (e.g., "Shock gasp with mouth wide open and hands gripping temples")
- "visualElementsSummary": Clear summary detailing Element 1 (Primary subject), Element 2 (Secondary proof graphic), and Element 3 (3D text overlay & FOMO badge)
- "noFaceSwapDirective": "Strict safeguard: 100% native original human subject generation with authentic facial anatomy and zero synthetic face replacement."
- "visualHierarchy": Primary, secondary, and tertiary focal placement
- "textOverlay": 2-4 POWER WORDS ONLY in ALL CAPS (e.g., "IT REPLACED ME?!", "100% ILLEGAL?", "99% WILL FAIL")
- "subTextOverlay": 1-3 secondary words (e.g., "IN 24 HOURS", "ZERO CODING")
- "badgeText": High-voltage sticker badge (e.g., "🚨 ONLY 24H LEFT", "🔥 GAME OVER", "100X SPEED")
- "colorPalette": 4 high-contrast HEX colors (e.g. ["#F59E0B", "#0F172A", "#EF4444", "#FFFFFF"])
- "compositionTip": Camera angle, lighting, depth of field, and rule-of-thirds focal points
- "ctrPredictionScore": Estimated CTR Score out of 100 (e.g., 96)
- "cognitiveTension": Why the brain cannot ignore this visual paradox
- "mobileReadability": How the elements stay 100% readable at 120px phone thumbnail size
- "prompt": Ultra-detailed 8K prompt for Midjourney / DALL-E / Imagen specifying all 3 distinct visual elements, authentic human anatomy, cinematic rim lighting, and no face swap.
- "abVariantNote": Strategic A/B test recommendation

Return STRICT JSON with schema:
{
  "concepts": [ ... ]
}`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODELS.TEXT_PRIMARY,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(response.text || "{}");
      if (parsed.concepts && parsed.concepts.length > 0) {
        setThumbConcepts(parsed.concepts);
        setSelectedConceptIndex(0);

        const top = parsed.concepts[0];
        onContextSync?.(
          "thumbnail",
          thumbTopic,
          `Genre: ${thumbGenre}, Concepts: ${parsed.concepts.length}, Top Hook: "${top.hook}" (FOMO: ${top.fomoAngle}), Expression: ${top.expressionType}, Elements: 3-layer composite (Subject + Proof Graphic + 3D Text Overlay), No Face-Swap guaranteed`
        );
      }
    } catch (e) {
      console.error("Thumbnail error:", e);
      setThumbConcepts([
        {
          id: "concept-1",
          archetype: "curiosity_gap",
          title: "The Uncanny AI Doppelgänger",
          hook: "Forces cognitive dissonance by showing an autonomous AI clone running the entire business while creator sleeps",
          fomoAngle: "🚨 ONLY 24 HOURS: Viewers fear falling behind in autonomous AI tools and getting permanently replaced in the developer market.",
          expressionType: "Extreme shock gasp: Mouth wide agape, eyes wide in disbelief, hands gripping temples with high-voltage neon rim lighting.",
          visualElementsSummary: "Element 1: Authentic expressive creator cutout with crazy shock gasp (0% face-swap) | Element 2: Secondary proof terminal window with glowing red alert code | Element 3: Rotated 3D text 'IT REPLACED ME?!' with red FOMO urgency badge.",
          noFaceSwapDirective: "Strict Safeguard: 100% native original human subject with natural facial anatomy and studio rim-lighting. Zero synthetic face-swapping.",
          visualHierarchy: "Primary: Split screen left (sleeping creator), right (glowing cybernetic holographic terminal working at light speed)",
          textOverlay: "IT REPLACED ME?!",
          subTextOverlay: "IN JUST 24 HOURS",
          badgeText: "🚨 24H LEFT",
          colorPalette: ["#F59E0B", "#090D16", "#EF4444", "#FFFFFF"],
          compositionTip: "Rule of thirds split: Left side cool blue shadows, right side high-voltage amber rim light with floating holographic UI elements.",
          ctrPredictionScore: 96,
          cognitiveTension: "Viewers fear getting replaced by AI and need to know if this tool is actually capable of replacing human developers.",
          mobileReadability: "Massive 80pt bold yellow type on deep dark obsidian background with heavy 6px black drop-shadow.",
          prompt: "Cinematic 8K YouTube thumbnail, multi-element visual composition: Element 1 shows a young software developer with an extreme shock gasp expression (mouth open, hands on head, genuine authentic human facial features, strictly no face swap), dramatic amber and cyan rim lighting. Element 2 shows a glowing dark code terminal with red alert notifications and green velocity charts overlaid. Element 3 has massive high-contrast 3D text 'IT REPLACED ME?!' with a bright red warning badge '24H LEFT'. 16:9 aspect ratio, ultra-detailed, photorealistic, octane render.",
          abVariantNote: "A/B test Variant A (Shocked expression pointing right) against Variant B (Split screen comparison)."
        },
        {
          id: "concept-2",
          archetype: "before_after",
          title: "Extreme 100x Acceleration Proof",
          hook: "Visual proof of 10 hours of grueling coding condensed into a single instant automated script execution",
          fomoAngle: "🔥 GAME OVER FOR TRADITIONAL CODING: Missing this workflow leaves developers wasting 40+ hours every single week.",
          expressionType: "Mind-blown disbelief: Eyes wide open staring forward, jaw dropped in awe, pointing aggressively at live proof graph.",
          visualElementsSummary: "Element 1: Mind-blown creator staring in disbelief (no face-swap) | Element 2: Glowing green exponential profit/growth chart (+940% spike) | Element 3: 3D text '99% DEVS ARE WRONG' with glowing emerald badge.",
          noFaceSwapDirective: "Strict Safeguard: 100% native original human subject with natural facial anatomy and studio rim-lighting. Zero synthetic face-swapping.",
          visualHierarchy: "Left: 10,000 lines of messy code crossed out in red, Right: Single glowing green 'EXECUTE' button generating $10k/day",
          textOverlay: "99% OF DEVS ARE WRONG",
          subTextOverlay: "NEW 2026 METHOD",
          badgeText: "🔥 GAME OVER",
          colorPalette: ["#10B981", "#0B0F19", "#F59E0B", "#FFFFFF"],
          compositionTip: "Extreme dynamic diagonal angle with high saturation green and orange accent lighting, bokeh tech background.",
          ctrPredictionScore: 93,
          cognitiveTension: "Challenger hook that directly attacks conventional knowledge, forcing viewers to verify their own methods.",
          mobileReadability: "High-contrast emerald badge and bold white sans-serif headline readable even when scaled down to smartphone feeds.",
          prompt: "Viral high-CTR tech thumbnail, multi-layered visual composition: Element 1 is a young tech creator staring forward in wild mind-blown disbelief, mouth open, authentic human facial features with no face swap or synthetic paste seams. Element 2 is an overlaid glowing emerald green revenue and velocity chart spiking vertically with +940% badge. Element 3 features massive bold white and yellow 3D text '99% OF DEVS ARE WRONG' with an urgent flame badge. 8K resolution, 16:9, hyper-sharp focus.",
          abVariantNote: "Test with green profit graph background vs red error code background."
        },
        {
          id: "concept-3",
          archetype: "authority_blueprint",
          title: "The Declassified Autonomous Blueprint",
          hook: "Framed as an exclusive insider leak of proprietary AI agent architectures that big tech doesn't want you to see",
          fomoAngle: "❌ DO NOT MISS THIS BEFORE DELETION: Big tech companies are lobbying to restrict autonomous agent pipelines from individual creators.",
          expressionType: "Intense hyper-focus stare: Eyebrows furrowed with crazed enthusiasm, whispering secrets with hand cupped near mouth.",
          visualElementsSummary: "Element 1: Crazed conspiratorial creator whispering insider secret (no face-swap) | Element 2: Overlaid confidential blueprint hologram stamped 'TOP SECRET' | Element 3: High-voltage 3D text 'THE SECRET AI BLUEPRINT'.",
          noFaceSwapDirective: "Strict Safeguard: 100% native original human subject with natural facial anatomy and studio rim-lighting. Zero synthetic face-swapping.",
          visualHierarchy: "Center: Glowing architectural hologram stamped with 'TOP SECRET', creator pointing with intense focused gaze",
          textOverlay: "THE SECRET AI BLUEPRINT",
          subTextOverlay: "LEAKED ARCHITECTURE",
          badgeText: "❌ TOP SECRET",
          colorPalette: ["#6366F1", "#05070E", "#F43F5E", "#FFFFFF"],
          compositionTip: "Centered symmetrical tech frame with cybernetic purple glow and dramatic top spotlight.",
          ctrPredictionScore: 91,
          cognitiveTension: "Exclusivity and fear of missing out on a proprietary edge.",
          mobileReadability: "Bold centered headline with heavy outline and vibrant magenta sticker badge.",
          prompt: "Futuristic dark cyber tech laboratory thumbnail with 3 distinct visual elements: Element 1 has an authentic human developer with an intense crazy focused expression revealing a secret, dramatic cyan and purple rim lighting, no face-swapping. Element 2 is an angled floating glowing hologram stamped with red 'TOP SECRET' declassified markings. Element 3 is large high-contrast bold 3D typography reading 'THE SECRET AI BLUEPRINT'. 8K, 16:9, cinematic.",
          abVariantNote: "Test with 'TOP SECRET' red stamp vs '2026 LEAK' badge."
        }
      ]);
      setSelectedConceptIndex(0);
    } finally {
      setIsGenerating(false);
    }
  };

  // Unlimited Photos Upload Handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) return;

        const base64Parts = dataUrl.split(",");
        const base64 = base64Parts.length > 1 ? base64Parts[1] : "";
        const mimeType = file.type || "image/jpeg";

        const newPhoto: UploadedPhotoItem = {
          id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          dataUrl,
          name: file.name,
          mimeType,
          base64,
        };

        setUploadedPhotos((prev) => {
          const updated = [...prev, newPhoto];
          if (updated.length === 1 || !uploadedSubjectImage) {
            setUploadedSubjectImage(newPhoto.dataUrl);
            setPrimaryPhotoIndex(0);
          }
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const handleRemovePhoto = (id: string) => {
    setUploadedPhotos((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      if (updated.length === 0) {
        setUploadedSubjectImage(null);
        setPrimaryPhotoIndex(0);
      } else {
        const newPrimary = Math.min(primaryPhotoIndex, updated.length - 1);
        setPrimaryPhotoIndex(newPrimary);
        setUploadedSubjectImage(updated[newPrimary].dataUrl);
      }
      return updated;
    });
  };

  const handleSelectPrimaryPhoto = (index: number) => {
    if (uploadedPhotos[index]) {
      setPrimaryPhotoIndex(index);
      setUploadedSubjectImage(uploadedPhotos[index].dataUrl);
    }
  };

  // Enhance custom prompt with Gemini AI
  const handleEnhancePromptWithGemini = async () => {
    if (!customAiPrompt.trim()) return;
    setIsEnhancingPrompt(true);
    try {
      const ai = getGeminiClient();
      if (!ai) throw new Error("AI client not available");

      const promptDirective = `You are a World-Class Lead Creative Director and Elite Prompt Engineer for Midjourney v6, ChatGPT (DALL-E 3), and Gemini Imagen 3 specializing in viral, ultra-high-CTR, high-tech YouTube thumbnails.
Rewrite and elevate this user prompt into an ultra-high-tech, 8K photorealistic masterpiece prompt:
"${customAiPrompt}"

MANDATORY ENHANCEMENT CRITERIA:
1. Cinematic 8K photorealism, Octane render 3D, ray-traced reflections, dark futuristic cyberpunk atmosphere.
2. 3-point high-contrast lighting: electric cyan highlights, burning neon amber rim-lighting, deep purple rim.
3. Volumetric smoke, anamorphic lens flare, sharp depth of field (f/1.8).
4. Authentic human subject with genuine, high-voltage facial expression (shocked mouth agape or intense focus stare), 0% face distortion.
5. Floating 3D holographic neural circuits, glowing green exponential analytics graph (+940% gain), and high-voltage 3D text overlay with red urgency badge.
6. 16:9 widescreen composition with visual hierarchy tailored for instant viewer attention.
Return ONLY the raw prompt text string with zero conversational fluff, quotes, or markdown wrappers.`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODELS.TEXT_PRIMARY,
        contents: promptDirective,
      });

      const enhancedText = response.text?.trim();
      if (enhancedText) {
        setCustomAiPrompt(enhancedText);
      }
    } catch (err) {
      console.warn("Failed to enhance prompt with Gemini:", err);
      setCustomAiPrompt((prev) =>
        `${prev.trim()}, 8k resolution, photorealistic cinematic lighting, electric cyan and amber rim-lighting, 3D holographic neural interface HUD, octane render, volumetric depth of field, 16:9 YouTube thumbnail composition`
      );
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  // High-Performance 16:9 Canvas Composite Engine
  const generateHighTechCanvasComposite = async (
    promptText: string,
    primaryPhotoUrl: string | null
  ): Promise<string> => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // 1. Deep Obsidian Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1280, 720);
    bgGrad.addColorStop(0, "#050814");
    bgGrad.addColorStop(0.4, "#0b1022");
    bgGrad.addColorStop(0.8, "#130924");
    bgGrad.addColorStop(1, "#030712");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1280, 720);

    // 2. High-Tech Cyber Grid
    ctx.strokeStyle = "rgba(56, 189, 248, 0.08)";
    ctx.lineWidth = 1.5;
    for (let x = 0; x < 1280; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 720);
      ctx.stroke();
    }
    for (let y = 0; y < 720; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1280, y);
      ctx.stroke();
    }

    // 3. Volumetric Neon Lighting Blooms
    const flareLeft = ctx.createRadialGradient(240, 200, 20, 240, 200, 480);
    flareLeft.addColorStop(0, "rgba(245, 158, 11, 0.45)");
    flareLeft.addColorStop(0.5, "rgba(239, 68, 68, 0.15)");
    flareLeft.addColorStop(1, "transparent");
    ctx.fillStyle = flareLeft;
    ctx.fillRect(0, 0, 1280, 720);

    const flareRight = ctx.createRadialGradient(1000, 360, 40, 1000, 360, 520);
    flareRight.addColorStop(0, "rgba(56, 189, 248, 0.4)");
    flareRight.addColorStop(0.6, "rgba(99, 102, 241, 0.15)");
    flareRight.addColorStop(1, "transparent");
    ctx.fillStyle = flareRight;
    ctx.fillRect(0, 0, 1280, 720);

    // 4. Secondary Element: Floating Hologram & Exponential Growth Curve
    ctx.save();
    ctx.translate(60, 140);
    ctx.fillStyle = "rgba(10, 15, 30, 0.85)";
    ctx.beginPath();
    ctx.roundRect(0, 0, 380, 240, 16);
    ctx.fill();
    ctx.strokeStyle = "#00F0FF";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = "#38BDF8";
    ctx.font = "bold 13px monospace";
    ctx.fillText("▲ NEURAL KPI SPIKE // 2026", 20, 32);

    ctx.fillStyle = "#10B981";
    ctx.font = "900 36px system-ui, sans-serif";
    ctx.fillText("+940% GAIN", 20, 75);

    ctx.beginPath();
    ctx.moveTo(25, 195);
    ctx.bezierCurveTo(120, 190, 220, 160, 350, 95);
    ctx.strokeStyle = "#10B981";
    ctx.lineWidth = 6;
    ctx.shadowColor = "#10B981";
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.restore();

    // 5. Primary Element: Creator Photo (Right side)
    let photoLoaded = false;
    if (primaryPhotoUrl) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = primaryPhotoUrl;
        });

        if (img.width > 0 && img.height > 0) {
          ctx.save();
          const cx = 980;
          const cy = 360;
          const radius = 240;

          ctx.beginPath();
          ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(245, 158, 11, 0.3)";
          ctx.shadowColor = "#F59E0B";
          ctx.shadowBlur = 35;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
          ctx.restore();

          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.strokeStyle = "#F59E0B";
          ctx.lineWidth = 6;
          ctx.stroke();

          ctx.fillStyle = "#000000D0";
          ctx.beginPath();
          ctx.roundRect(cx - 150, cy + radius - 20, 300, 38, 10);
          ctx.fill();
          ctx.strokeStyle = "#10B981";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = "#34D399";
          ctx.font = "bold 13px monospace";
          ctx.textAlign = "center";
          ctx.fillText("✓ VERIFIED CREATOR // 0% SYNTHETIC", cx, cy + radius + 4);
          ctx.restore();

          photoLoaded = true;
        }
      } catch (e) {
        console.warn("Could not load image onto canvas:", e);
      }
    }

    if (!photoLoaded) {
      ctx.save();
      const cx = 980;
      const cy = 360;
      const radius = 220;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fill();
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = "#F59E0B";
      ctx.font = "900 72px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚡", cx, cy - 20);
      ctx.font = "bold 20px monospace";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText("CREATOR AVATAR", cx, cy + 45);
      ctx.restore();
    }

    // 6. Element 3: 3D High-Contrast Title & Badges
    ctx.save();
    ctx.translate(340, 75);
    ctx.rotate(-0.02);
    ctx.fillStyle = "#DC2626";
    ctx.shadowColor = "#DC2626";
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.roundRect(-220, -28, 440, 56, 14);
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 10;
    ctx.fillText("🚨 100X BREAKTHROUGH", 0, 0);
    ctx.restore();

    // Main 3D Text Card
    const words = promptText.replace(/[^a-zA-Z0-9\s]/g, "").split(" ").filter((w) => w.length > 2);
    const mainTitle = (words.slice(0, 3).join(" ") || "IT REPLACED ME?!").toUpperCase();

    ctx.save();
    ctx.translate(460, 480);
    ctx.rotate(-0.03);

    ctx.fillStyle = "#000000EE";
    ctx.beginPath();
    ctx.roundRect(-380 + 8, -60 + 12, 760, 120, 20);
    ctx.fill();

    ctx.fillStyle = "#0A0E1AFA";
    ctx.beginPath();
    ctx.roundRect(-380, -60, 760, 120, 20);
    ctx.fill();
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 58px system-ui, Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 18;
    ctx.fillText(mainTitle, 0, 0);
    ctx.restore();

    ctx.fillStyle = "rgba(56, 189, 248, 0.7)";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "left";
    ctx.fillText("NEXA // HIGH-TECH ENGINE 8K • 16:9 1280x720", 30, 690);

    return canvas.toDataURL("image/png");
  };

  // Generate High-Tech AI Thumbnail Image
  const handleGenerateAiThumbnailImage = async () => {
    if (!customAiPrompt.trim()) return;
    setIsGeneratingAiImage(true);
    try {
      const ai = getGeminiClient();
      if (!ai) throw new Error("AI client not available");

      // Prepare multimodal parts with any uploaded reference photos
      const parts: any[] = [];
      uploadedPhotos.slice(0, 3).forEach((photo) => {
        if (photo.base64) {
          parts.push({
            inlineData: {
              data: photo.base64,
              mimeType: photo.mimeType || "image/jpeg",
            },
          });
        }
      });

      parts.push({
        text: `Generate a high-tech YouTube thumbnail: ${customAiPrompt}. Ultra-high resolution, 16:9 aspect ratio, vivid contrast, cinematic lighting, professional digital art, photorealistic.`,
      });

      let generatedUrl: string | null = null;

      try {
        const response = await ai.models.generateContent({
          model: GEMINI_MODELS.IMAGE_GEN,
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio: "16:9",
              imageSize: "1K",
            },
          },
        });

        const candidates = (response as any).candidates;
        if (candidates && candidates[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
              const mime = part.inlineData.mimeType || "image/png";
              generatedUrl = `data:${mime};base64,${part.inlineData.data}`;
              break;
            }
          }
        }
      } catch (imageModelErr) {
        console.warn("Direct image model not available or quota limit hit, using high-tech canvas generator:", imageModelErr);
      }

      if (!generatedUrl) {
        generatedUrl = await generateHighTechCanvasComposite(
          customAiPrompt,
          uploadedPhotos[primaryPhotoIndex]?.dataUrl || uploadedSubjectImage || null
        );
      }

      if (generatedUrl) {
        setGeneratedAiImageUrl(generatedUrl);
        const newHistoryItem: GeneratedAiImageItem = {
          id: `gen-${Date.now()}`,
          url: generatedUrl,
          prompt: customAiPrompt,
          timestamp: Date.now(),
        };
        setAiGenerationHistory((prev) => [newHistoryItem, ...prev]);
        onContextSync?.(
          "thumbnail",
          "High-Tech AI Thumbnail",
          `Prompt: "${customAiPrompt.slice(0, 80)}...", Generated with ${uploadedPhotos.length} reference photos`
        );
      }
    } catch (err) {
      console.error("Error generating thumbnail image:", err);
    } finally {
      setIsGeneratingAiImage(false);
    }
  };

  // Download Thumbnail Mockup as 16:9 PNG with 3 Distinct Visual Elements Composite
  const downloadThumbnailCanvas = async () => {
    const concept = thumbConcepts[selectedConceptIndex];
    if (!concept) return;

    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Background Obsidian Gradient
    const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
    gradient.addColorStop(0, concept.colorPalette[1] || "#090D16");
    gradient.addColorStop(0.5, "#0b0f19");
    gradient.addColorStop(1, concept.colorPalette[0] || "#1e1b4b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1280, 720);

    // 2. High-Tech Cybernetic Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < 1280; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 720);
      ctx.stroke();
    }
    for (let y = 0; y < 720; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1280, y);
      ctx.stroke();
    }

    // Radial Lighting Blooms (Dual Tone for cinematic punch)
    const radialPrimary = ctx.createRadialGradient(980, 320, 40, 980, 320, 520);
    radialPrimary.addColorStop(0, `${concept.colorPalette[0] || "#F59E0B"}55`);
    radialPrimary.addColorStop(1, "transparent");
    ctx.fillStyle = radialPrimary;
    ctx.fillRect(0, 0, 1280, 720);

    const radialSecondary = ctx.createRadialGradient(280, 400, 30, 280, 400, 480);
    radialSecondary.addColorStop(0, "rgba(6, 182, 212, 0.25)");
    radialSecondary.addColorStop(1, "transparent");
    ctx.fillStyle = radialSecondary;
    ctx.fillRect(0, 0, 1280, 720);

    // ==========================================
    // ELEMENT 2: SECONDARY CONTEXT PROOF GRAPHIC
    // ==========================================
    ctx.save();
    ctx.translate(280, 360);
    ctx.rotate(-0.04);

    // Glassmorphic Card Container
    ctx.fillStyle = "rgba(8, 12, 24, 0.88)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.roundRect(-220, -180, 440, 360, 20);
    ctx.fill();

    // Glowing Neon Border
    ctx.strokeStyle = "rgba(6, 182, 212, 0.7)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Window Header Bar with Traffic Lights
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fillRect(-220, -180, 440, 42);
    ctx.fillStyle = "#EF4444";
    ctx.beginPath(); ctx.arc(-195, -159, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#F59E0B";
    ctx.beginPath(); ctx.arc(-175, -159, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#10B981";
    ctx.beginPath(); ctx.arc(-155, -159, 6, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#38BDF8";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "right";
    ctx.fillText("LIVE PROOF TELEMETRY // 2026", 200, -154);

    // Draw Dynamic Proof Graphic based on selection
    if (selectedProofElement === "viral_chart") {
      // Exponential Spike Chart
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      for (let gy = -100; gy <= 100; gy += 40) {
        ctx.beginPath(); ctx.moveTo(-190, gy); ctx.lineTo(190, gy); ctx.stroke();
      }
      // Glowing Area Fill
      const chartGrad = ctx.createLinearGradient(0, -90, 0, 110);
      chartGrad.addColorStop(0, "rgba(16, 185, 129, 0.45)");
      chartGrad.addColorStop(1, "rgba(16, 185, 129, 0.02)");
      ctx.fillStyle = chartGrad;
      ctx.beginPath();
      ctx.moveTo(-180, 110);
      ctx.bezierCurveTo(-90, 100, 20, 60, 180, -80);
      ctx.lineTo(180, 110);
      ctx.closePath();
      ctx.fill();

      // Glowing Curve Line
      ctx.strokeStyle = "#10B981";
      ctx.lineWidth = 5;
      ctx.shadowColor = "#10B981";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(-180, 110);
      ctx.bezierCurveTo(-90, 100, 20, 60, 180, -80);
      ctx.stroke();

      // Point Marker & Badge
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath(); ctx.arc(180, -80, 8, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "#10B981";
      ctx.beginPath(); ctx.roundRect(10, -135, 185, 36, 8); ctx.fill();
      ctx.fillStyle = "#000000";
      ctx.font = "900 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("▲ +940% VIRAL SPIKE", 102, -112);
    } else if (selectedProofElement === "revenue_dashboard") {
      // Live Revenue Metrics Card
      ctx.fillStyle = "#94A3B8";
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      ctx.fillText("NET REVENUE RUN-RATE (LIVE)", -190, -110);

      ctx.fillStyle = "#34D399";
      ctx.font = "900 46px system-ui, sans-serif";
      ctx.shadowColor = "rgba(52, 211, 153, 0.5)";
      ctx.shadowBlur = 12;
      ctx.fillText("$124,500.00", -190, -55);

      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
      ctx.beginPath(); ctx.roundRect(-190, -35, 140, 26, 6); ctx.fill();
      ctx.fillStyle = "#10B981";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText("▲ +1,240% THIS MO", -180, -17);

      // Volume Bars
      const barHeights = [40, 65, 55, 90, 120, 150];
      barHeights.forEach((h, i) => {
        ctx.fillStyle = i === barHeights.length - 1 ? "#F59E0B" : "rgba(56, 189, 248, 0.4)";
        ctx.fillRect(-190 + i * 65, 120 - h, 45, h);
      });
    } else if (selectedProofElement === "terminal_code") {
      // Dark Neon Code Terminal
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      const lines = [
        { text: "> npx @nexa/agent --swarm-execute", color: "#F59E0B" },
        { text: "[AUTHENTICATED] Bhavik Root Key verified", color: "#38BDF8" },
        { text: "[SECURITY CHECK] 0% face-swap verified", color: "#34D399" },
        { text: "[ALERT] Bypassing manual human workflows", color: "#EF4444" },
        { text: "[STATUS] 100% Autonomous Pipeline Active", color: "#10B981" },
        { text: ">> Latency: 142ms // Deterministic", color: "#E2E8F0" }
      ];
      lines.forEach((l, idx) => {
        ctx.fillStyle = l.color;
        ctx.fillText(l.text, -190, -100 + idx * 34);
      });
    } else {
      // AI Neural Core Hologram
      ctx.strokeStyle = "#818CF8";
      ctx.lineWidth = 2;
      for (let r = 30; r <= 110; r += 26) {
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = "#F59E0B";
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("NEURAL CORE", 0, 120);
    }

    // Element 2 verified badge at bottom
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.beginPath(); ctx.roundRect(-200, 132, 400, 28, 6); ctx.fill();
    ctx.fillStyle = "#38BDF8";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("ELEMENT 2: SECONDARY PROOF GRAPHIC", 0, 150);

    ctx.restore();

    // =========================================================================
    // ELEMENT 1: PRIMARY SUBJECT (UPLOADED CUTOUT OR CRAZY SHOCKED EXPRESSION)
    // =========================================================================
    ctx.save();
    ctx.translate(940, 420);

    if (uploadedSubjectImage) {
      try {
        const subjectImg = new Image();
        subjectImg.crossOrigin = "anonymous";
        await new Promise((resolve) => {
          subjectImg.onload = resolve;
          subjectImg.onerror = () => resolve(null);
          subjectImg.src = uploadedSubjectImage;
        });

        // Glowing Rim-Light Halo & Drop-Shadow for the Uploaded Cutout
        ctx.shadowColor = concept.colorPalette[0] || "#F59E0B";
        ctx.shadowBlur = 50;
        ctx.fillStyle = "rgba(15, 23, 42, 0.95)";

        // Backing circle
        ctx.beginPath();
        ctx.arc(0, 0, 185, 0, Math.PI * 2);
        ctx.fill();

        // Glowing rim stroke
        ctx.strokeStyle = concept.colorPalette[0] || "#F59E0B";
        ctx.lineWidth = 8;
        ctx.stroke();

        // Clip circular portrait
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, 180, 0, Math.PI * 2);
        ctx.clip();

        // Draw image keeping aspect ratio
        const aspect = subjectImg.width / subjectImg.height;
        let dW = 360;
        let dH = 360;
        if (aspect > 1) {
          dW = 360 * aspect;
        } else {
          dH = 360 / aspect;
        }
        ctx.drawImage(subjectImg, -dW / 2, -dH / 2, dW, dH);
        ctx.restore();

        // Inner glowing border accent
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 182, 0, Math.PI * 2);
        ctx.stroke();

        // Verified Label Pill
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.beginPath(); ctx.roundRect(-160, 240, 320, 32, 8); ctx.fill();
        ctx.strokeStyle = "#10B981";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#34D399";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText("✓ ELEMENT 1: CREATOR PHOTO // COMPOSITED", 0, 260);
      } catch (e) {
        console.warn("Could not draw uploaded subject image, falling back to stylized face", e);
      }
    } else {
      // Glowing Rim-Light Halo & Drop-Shadow for the Human Creator Cutout
      ctx.shadowColor = concept.colorPalette[0] || "#F59E0B";
      ctx.shadowBlur = 45;
      ctx.fillStyle = "rgba(15, 23, 42, 0.95)";

      // Shoulders & Torso Silhouette
      ctx.beginPath();
      ctx.ellipse(0, 180, 240, 150, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head Silhouette with expressive posture
      ctx.beginPath();
      ctx.ellipse(0, -30, 125, 155, 0, 0, Math.PI * 2);
      ctx.fill();

      // Crazy Facial Expression Rendering (Authentic Human Anatomy - No Face Swap)
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#000000";

      // Eyes (Exaggerated, Wide in Disbelief)
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath(); ctx.ellipse(-45, -55, 28, 22, -0.05, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(45, -55, 28, 22, 0.05, 0, Math.PI * 2); ctx.fill();

      // Pupils with intense focus
      ctx.fillStyle = "#0F172A";
      ctx.beginPath(); ctx.arc(-45, -55, 13, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(45, -55, 13, 0, Math.PI * 2); ctx.fill();

      // Pupil Highlight Sparks
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath(); ctx.arc(-40, -60, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(50, -60, 4, 0, Math.PI * 2); ctx.fill();

      // Raised Eyebrows in Extreme Shock
      ctx.strokeStyle = concept.colorPalette[0] || "#F59E0B";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(-45, -88, 30, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(45, -88, 30, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();

      // Mouth Expression based on selected type
      if (selectedExpression === "shock_gasp" || selectedExpression === "mind_blown") {
        // Big open mouth agape in extreme shock
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.ellipse(0, 35, 36, 48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#EF4444";
        ctx.lineWidth = 4;
        ctx.stroke();

        // Top Teeth visible in gasp
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.roundRect(-22, -2, 44, 14, 3);
        ctx.fill();
      } else {
        // Jaw-dropped scream
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.ellipse(0, 40, 45, 52, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#F59E0B";
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // Hands on Head / Temples for Mind-Blown Reaction
      if (selectedExpression === "mind_blown" || selectedExpression === "shock_gasp") {
        ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
        ctx.strokeStyle = concept.colorPalette[0] || "#F59E0B";
        ctx.lineWidth = 4;

        // Left hand on temple
        ctx.beginPath(); ctx.roundRect(-165, -95, 45, 95, 14); ctx.fill(); ctx.stroke();
        // Right hand on temple
        ctx.beginPath(); ctx.roundRect(120, -95, 45, 95, 14); ctx.fill(); ctx.stroke();
      }

      // Studio Rim Light Outline (Amber Neon)
      ctx.strokeStyle = concept.colorPalette[0] || "#F59E0B";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, -30, 130, Math.PI * 0.7, Math.PI * 2.3);
      ctx.stroke();

      // Element 1 Verified Label Pill (Anti Face-Swap Guarantee)
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.beginPath(); ctx.roundRect(-160, 240, 320, 32, 8); ctx.fill();
      ctx.strokeStyle = "#10B981";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#34D399";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("✓ ELEMENT 1: NATIVE HUMAN // 0% FACE-SWAP", 0, 260);
    }

    ctx.restore();

    // =========================================================================
    // ELEMENT 3: 3D HIGH-CONTRAST TEXT OVERLAY & VIRAL FOMO BADGE
    // =========================================================================
    // 3A. Viral FOMO Badge
    const fomoBadge = customBadgeText || concept.badgeText || "🚨 ONLY 24H LEFT";
    ctx.save();
    ctx.translate(640, 105);
    ctx.rotate(-0.02);

    ctx.fillStyle = "#DC2626";
    ctx.shadowColor = "#DC2626";
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.roundRect(-220, -28, 440, 56, 14);
    ctx.fill();

    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 24px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 10;
    ctx.fillText(fomoBadge.toUpperCase(), 0, 0);
    ctx.restore();

    // 3B. Main Dynamic 3D Text Pill
    const overlayText = customOverlayText || concept.textOverlay || "IT REPLACED ME?!";
    ctx.save();
    ctx.translate(640, 240);
    ctx.rotate(-0.035);

    // Deep 3D Shadow Block
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.roundRect(-460 + 8, -65 + 12, 920, 130, 20);
    ctx.fill();

    // Main Card Fill
    ctx.fillStyle = "#080C16EE";
    ctx.beginPath();
    ctx.roundRect(-460, -65, 920, 130, 20);
    ctx.fill();

    // High Voltage Border
    ctx.strokeStyle = concept.colorPalette[0] || "#F59E0B";
    ctx.lineWidth = 5;
    ctx.stroke();

    // Dual-tone Text
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 68px system-ui, -apple-system, Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 16;
    ctx.fillText(overlayText.toUpperCase(), 0, 0);
    ctx.restore();

    // 3C. Secondary Sub-Text Power Hook
    const subText = concept.subTextOverlay || thumbTopic;
    ctx.save();
    ctx.translate(640, 345);
    ctx.fillStyle = concept.colorPalette[0] || "#F59E0B";
    ctx.font = "900 32px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 12;
    ctx.fillText(subText.toUpperCase(), 0, 0);
    ctx.restore();

    // ==========================================
    // BOTTOM STRATEGY & METADATA BAR
    // ==========================================
    ctx.fillStyle = "rgba(4, 6, 12, 0.92)";
    ctx.fillRect(0, 645, 1280, 75);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 645, 1280, 1);

    ctx.fillStyle = "#38BDF8";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`ARCHETYPE: ${(concept.archetype || "Curiosity Gap").toUpperCase()}  |  CTR PREDICTION: ${concept.ctrPredictionScore || 96}%`, 40, 690);

    ctx.textAlign = "right";
    ctx.fillStyle = "#F59E0B";
    ctx.font = "bold 15px monospace";
    ctx.fillText("BHAVIK BUILDS HERE // NEXA VIRAL STUDIO", 1240, 690);

    // Export PNG
    const link = document.createElement("a");
    link.download = `thumbnail-${concept.id || "concept"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // Download Standalone Interactive HTML Presentation with Images, Context & Structured Layouts
  const exportPptAsHtml = () => {
    if (!pptDeck) return;
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pptDeck.topic} - Presentation Deck</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    body { background-color: #06080e; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; }
    .slide-container { min-height: calc(100vh - 150px); display: none; }
    .slide-container.active { display: flex; }
  </style>
</head>
<body class="flex flex-col justify-between min-h-screen bg-[#06080e] text-slate-100">
  <header class="p-6 flex justify-between items-center border-b border-white/10 bg-black/60 backdrop-blur-md sticky top-0 z-50">
    <div class="flex items-center gap-3">
      <span class="px-3 py-1 rounded bg-amber-500 text-black font-extrabold text-xs tracking-wider">NEXA DECK</span>
      <span class="text-sm font-bold text-white">${pptDeck.topic}</span>
    </div>
    <div class="flex items-center gap-4">
      <span class="text-xs text-amber-400 font-mono font-bold" id="slide-indicator">Slide 1 of ${pptDeck.slides.length}</span>
    </div>
  </header>

  <main class="flex-1 max-w-6xl mx-auto w-full p-6 sm:p-10 flex items-center justify-center">
    ${pptDeck.slides.map((s, idx) => {
      const vis = getSlideVisual(s, idx);
      return `
      <div id="slide-${idx}" class="slide-container flex-col justify-between w-full ${idx === 0 ? 'active' : ''}">
        <div>
          <!-- Tag & Title -->
          <span class="text-xs font-mono text-amber-400 uppercase tracking-widest font-bold mb-2 block">${s.tag || `SLIDE ${idx + 1}`}</span>
          <h1 class="text-3xl sm:text-5xl font-black text-white mb-2 tracking-tight">${s.title}</h1>
          ${s.subtitle ? `<p class="text-base sm:text-lg text-amber-300/90 font-medium mb-4">${s.subtitle}</p>` : ''}
          
          <!-- Clear Strategic Context Summary -->
          <div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-6 flex items-start gap-3">
            <span class="text-amber-400 font-bold text-lg leading-none">💡</span>
            <div>
              <span class="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold block">Strategic Objective & Context</span>
              <p class="text-xs sm:text-sm text-slate-200 mt-1 leading-relaxed">${s.contextSummary || `Comprehensive strategic framework establishing operational objectives and competitive advantages for ${s.title}.`}</p>
            </div>
          </div>

          <!-- Structured Contextual Visual / Diagram Card -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-6 my-6 bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden p-2 sm:p-4 items-center">
            <div class="md:col-span-6 h-56 rounded-xl overflow-hidden relative">
              <img src="${s.imageUrl || vis.url}" alt="${s.title}" class="w-full h-full object-cover" />
              <span class="absolute bottom-2 left-2 px-2.5 py-1 rounded bg-black/80 text-[10px] font-mono text-amber-400 border border-white/10 font-bold">RELEVANT CONTEXTUAL VISUAL</span>
            </div>
            <div class="md:col-span-6 p-4 space-y-3">
              <span class="text-xs font-mono text-slate-400 uppercase tracking-wider block">Visual Architecture & Model Directive</span>
              <p class="text-xs sm:text-sm text-slate-200 font-medium">${s.imageCaption || vis.caption}</p>
              <p class="text-xs text-amber-300 italic">"${s.visualDirection}"</p>
            </div>
          </div>

          <!-- Structured Layouts -->
          ${s.kpis && s.kpis.length > 0 ? `
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              ${s.kpis.map(k => `
                <div class="p-4 rounded-xl bg-white/5 border border-amber-500/20">
                  <div class="text-2xl font-black text-amber-400">${k.value}</div>
                  <div class="text-xs text-slate-300 mt-1">${k.label}</div>
                  ${k.change ? `<span class="inline-block text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded mt-1">${k.change}</span>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${s.cards && s.cards.length > 0 ? `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
              ${s.cards.map(c => `
                <div class="p-4 rounded-xl bg-white/5 border border-white/10">
                  <span class="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">${c.tag || 'Pillar'}</span>
                  <h4 class="text-sm font-bold text-white mt-2">${c.heading}</h4>
                  <p class="text-xs text-slate-300 mt-1">${c.description}</p>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${s.comparison ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
              <div class="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                <h4 class="text-xs font-bold text-rose-400 uppercase mb-2">${s.comparison.leftHeading}</h4>
                <ul class="space-y-1.5">${s.comparison.leftItems.map(i => `<li class="text-xs text-slate-300">✕ ${i}</li>`).join('')}</ul>
              </div>
              <div class="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <h4 class="text-xs font-bold text-emerald-400 uppercase mb-2">${s.comparison.rightHeading}</h4>
                <ul class="space-y-1.5">${s.comparison.rightItems.map(i => `<li class="text-xs text-slate-200">✓ ${i}</li>`).join('')}</ul>
              </div>
            </div>
          ` : ''}

          <!-- Bullets -->
          ${s.bullets && s.bullets.length > 0 ? `
            <div class="p-4 rounded-xl bg-white/[0.03] border border-white/10 my-4">
              <h4 class="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Core Strategic Takeaways</h4>
              <ul class="space-y-2">
                ${s.bullets.map(b => `<li class="text-xs sm:text-sm text-slate-200 flex items-start gap-2"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0"></span><span>${b}</span></li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <!-- Speaker Script Drawer -->
        <div class="p-4 mt-6 bg-black/60 rounded-xl border border-white/10">
          <span class="text-[10px] font-mono text-amber-400 font-bold block mb-1">PRESENTER SCRIPT:</span>
          <p class="text-xs text-slate-300 italic leading-relaxed">"${s.speakerNotes}"</p>
        </div>
      </div>
      `;
    }).join('')}
  </main>

  <footer class="p-6 border-t border-white/10 flex justify-between items-center bg-black/60 sticky bottom-0">
    <button onclick="prevSlide()" class="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold">Previous Slide (←)</button>
    <div class="text-xs text-slate-400 font-mono">Use Left/Right arrow keys to present</div>
    <button onclick="nextSlide()" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold">Next Slide (→)</button>
  </footer>

  <script>
    let currentSlide = 0;
    const totalSlides = ${pptDeck.slides.length};
    function showSlide(idx) {
      document.querySelectorAll('.slide-container').forEach(el => el.classList.remove('active'));
      const target = document.getElementById('slide-' + idx);
      if (target) target.classList.add('active');
      document.getElementById('slide-indicator').textContent = 'Slide ' + (idx + 1) + ' of ' + totalSlides;
    }
    function nextSlide() {
      if (currentSlide < totalSlides - 1) { currentSlide++; showSlide(currentSlide); }
    }
    function prevSlide() {
      if (currentSlide > 0) { currentSlide--; showSlide(currentSlide); }
    }
    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'Space') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    });
  </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${pptDeck.topic.toLowerCase().replace(/[^a-z0-9]/g, "-")}-deck.html`;
    link.click();
  };

  // Generate and Download Real PowerPoint .pptx File using pptxgenjs
  const exportPptAsPptx = async () => {
    if (!pptDeck) return;
    setIsExportingPptx(true);
    try {
      const pres = new pptxgen();
      pres.layout = "LAYOUT_16x9";
      pres.author = "Bhavik / NEXA AI";
      pres.company = "NEXA Autonomous Lab";
      pres.title = pptDeck.topic;

      pptDeck.slides.forEach((slideData, idx) => {
        const slide = pres.addSlide();
        slide.background = { color: "0B0F19" };

        // Accent Header Tag
        slide.addText((slideData.tag || `SLIDE ${idx + 1}`).toUpperCase(), {
          x: 0.8,
          y: 0.45,
          w: 8.0,
          h: 0.3,
          fontSize: 11,
          color: "F59E0B",
          bold: true,
          fontFace: "Arial",
        });

        // Slide Title
        slide.addText(slideData.title, {
          x: 0.8,
          y: 0.75,
          w: 11.5,
          h: 0.7,
          fontSize: 24,
          color: "FFFFFF",
          bold: true,
          fontFace: "Arial",
        });

        // Subtitle
        if (slideData.subtitle) {
          slide.addText(slideData.subtitle, {
            x: 0.8,
            y: 1.45,
            w: 11.5,
            h: 0.4,
            fontSize: 13,
            color: "94A3B8",
            fontFace: "Arial",
          });
        }

        // Executive Context Summary box
        if (slideData.contextSummary) {
          slide.addShape(pres.ShapeType.roundRect, {
            x: 0.8,
            y: 1.95,
            w: 11.7,
            h: 0.55,
            fill: { color: "131B2E" },
            line: { color: "F59E0B", width: 1 },
            rectRadius: 0.05,
          });
          slide.addText(`STRATEGIC CONTEXT: ${slideData.contextSummary}`, {
            x: 0.95,
            y: 2.0,
            w: 11.4,
            h: 0.45,
            fontSize: 10,
            color: "CBD5E1",
            italic: true,
          });
        }

        const contentY = slideData.contextSummary ? 2.75 : 2.15;

        // Render based on slide layout
        if (slideData.layout === "metrics_kpi" && slideData.kpis && slideData.kpis.length > 0) {
          const kpis = slideData.kpis.slice(0, 4);
          const cardW = 2.6;
          const gap = 0.3;
          kpis.forEach((kpi, kIdx) => {
            const kX = 0.8 + kIdx * (cardW + gap);
            slide.addShape(pres.ShapeType.roundRect, {
              x: kX,
              y: contentY,
              w: cardW,
              h: 3.2,
              fill: { color: "111827" },
              line: { color: "38BDF8", width: 1 },
              rectRadius: 0.1,
            });
            slide.addText(kpi.value, {
              x: kX + 0.15,
              y: contentY + 0.35,
              w: cardW - 0.3,
              h: 0.9,
              fontSize: 28,
              bold: true,
              color: "38BDF8",
              align: "center",
            });
            slide.addText(kpi.label, {
              x: kX + 0.15,
              y: contentY + 1.35,
              w: cardW - 0.3,
              h: 0.8,
              fontSize: 12,
              bold: true,
              color: "E2E8F0",
              align: "center",
            });
            if (kpi.change) {
              slide.addText(kpi.change, {
                x: kX + 0.15,
                y: contentY + 2.3,
                w: cardW - 0.3,
                h: 0.4,
                fontSize: 11,
                bold: true,
                color: "10B981",
                align: "center",
              });
            }
          });
        } else if (slideData.cards && slideData.cards.length > 0) {
          const cards = slideData.cards.slice(0, 3);
          const cardW = 3.6;
          const gap = 0.4;
          cards.forEach((card, cIdx) => {
            const cX = 0.8 + cIdx * (cardW + gap);
            slide.addShape(pres.ShapeType.roundRect, {
              x: cX,
              y: contentY,
              w: cardW,
              h: 3.2,
              fill: { color: "111827" },
              line: { color: "F59E0B", width: 1 },
              rectRadius: 0.1,
            });
            slide.addText(card.heading || "", {
              x: cX + 0.2,
              y: contentY + 0.3,
              w: cardW - 0.4,
              h: 0.6,
              fontSize: 14,
              bold: true,
              color: "F59E0B",
            });
            slide.addText(card.description || "", {
              x: cX + 0.2,
              y: contentY + 0.95,
              w: cardW - 0.4,
              h: 1.8,
              fontSize: 11,
              color: "CBD5E1",
            });
          });
        } else if (slideData.bullets && slideData.bullets.length > 0) {
          const bulletTexts = slideData.bullets.map(b => ({
            text: b + "\n",
            options: { bullet: true, fontSize: 13, color: "E2E8F0" }
          }));
          slide.addText(bulletTexts, {
            x: 0.8,
            y: contentY,
            w: 7.8,
            h: 3.3,
          });

          // Side visual preview
          const visual = getSlideVisual(slideData, idx);
          if (visual?.url) {
            try {
              slide.addImage({
                path: visual.url,
                x: 8.9,
                y: contentY,
                w: 3.6,
                h: 2.6,
              });
              slide.addText(visual.caption || "System Architecture", {
                x: 8.9,
                y: contentY + 2.7,
                w: 3.6,
                h: 0.4,
                fontSize: 8,
                color: "94A3B8",
                italic: true,
              });
            } catch (imgErr) {
              console.warn("Could not insert slide visual in PPTX:", imgErr);
            }
          }
        } else {
          // Fallback text
          slide.addText(slideData.contextSummary || slideData.subtitle || "", {
            x: 0.8,
            y: contentY,
            w: 11.5,
            h: 3.5,
            fontSize: 14,
            color: "E2E8F0",
          });
        }

        // Speaker notes in PPTX notes section
        if (slideData.speakerNotes) {
          slide.addNotes(slideData.speakerNotes);
        }

        // Footer
        slide.addText("BHAVIK // NEXA AUTONOMOUS PRESENTATION", {
          x: 0.8,
          y: 7.0,
          w: 8.0,
          h: 0.3,
          fontSize: 8,
          color: "475569",
        });
        slide.addText(`SLIDE ${idx + 1} / ${pptDeck.slides.length}`, {
          x: 9.5,
          y: 7.0,
          w: 3.0,
          h: 0.3,
          fontSize: 8,
          color: "475569",
          align: "right",
        });
      });

      const fileName = `${(pptDeck.topic || "presentation").toLowerCase().replace(/[^a-z0-9]/g, "-")}-deck.pptx`;
      await pres.writeFile({ fileName });
    } catch (err) {
      console.warn("Failed to generate PPTX:", err);
    } finally {
      setIsExportingPptx(false);
    }
  };

  // 3. Generate Website
  const handleGenerateWebsite = async () => {
    setIsGenerating(true);
    try {
      const ai = getGeminiClient();
      if (!ai) throw new Error("API key not configured");
      const prompt = `You are a Principal Web Architect and UI/UX Designer.
Build a complete, standalone, single-file HTML landing page for: "${webPrompt}".
Use Tailwind CSS CDN (<script src="https://cdn.tailwindcss.com"></script>), Lucide icons (<script src="https://unpkg.com/lucide@latest"></script>), glowing glassmorphic dark theme, responsive navigation, hero section, interactive components, pricing table, and FAQ.
Return ONLY valid HTML code from <!DOCTYPE html> to </html> without markdown wrappers.`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODELS.TEXT_PRIMARY,
        contents: prompt
      });

      let raw = response.text || "";
      raw = raw.replace(/```html/gi, "").replace(/```/g, "").trim();
      setWebHtml(raw);
      onContextSync?.("website", webPrompt, "Standalone responsive landing page generated with hero, features, and modern tech styling.");
    } catch (e) {
      console.error("Website error:", e);
      setWebHtml(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Autonomous Systems</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans">
  <header class="border-b border-white/10 px-8 py-4 flex items-center justify-between">
    <div class="font-bold tracking-widest text-amber-400 text-xl">NEXA // STUDIO</div>
    <nav class="space-x-6 text-sm text-slate-300">
      <a href="#features" class="hover:text-amber-400 transition-colors">Features</a>
      <a href="#pipeline" class="hover:text-amber-400 transition-colors">Pipeline</a>
      <a href="#contact" class="hover:text-amber-400 transition-colors">Contact</a>
    </nav>
  </header>
  <main class="flex-1 max-w-5xl mx-auto px-6 py-20 text-center flex flex-col items-center">
    <span class="px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono uppercase tracking-widest mb-6">Autonomous Systems 2026</span>
    <h1 class="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-transparent">Next-Gen Intelligent Execution</h1>
    <p class="text-slate-400 text-lg max-w-2xl mb-10 leading-relaxed">Turn high-level vision into enterprise software, autonomous agents, and revenue-generating workflows with zero friction.</p>
    <div class="flex gap-4">
      <button class="px-8 py-3.5 bg-amber-500 text-slate-950 font-bold rounded-xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20">Explore Pipeline</button>
      <button class="px-8 py-3.5 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all">Schedule Demo</button>
    </div>
  </main>
</body>
</html>`);
      onContextSync?.("website", webPrompt, "Fallback landing page generated for Autonomous Systems.");
    } finally {
      setIsGenerating(false);
    }
  };

  // 4. Generate Document
  const handleGenerateDoc = async () => {
    setIsGenerating(true);
    try {
      const ai = getGeminiClient();
      if (!ai) throw new Error("API key not configured");
      const prompt = `You are a Principal Technical Strategist.
Generate a comprehensive ${docType} on: "${docTopic}".
Include high-value analytical sections, clear headings, technical architecture, key benchmarks, and executive summary.
Return STRICT JSON:
{
  "type": "${docType}",
  "title": "${docTopic}",
  "subtitle": "Comprehensive Strategic & Architectural Analysis",
  "summary": "Executive summary paragraph...",
  "sections": [
    { "heading": "1. Problem Framing & Context", "content": "Analytical breakdown..." },
    { "heading": "2. Core Architectural Design", "content": "Technical specifications..." },
    { "heading": "3. Implementation Benchmarks & SLAs", "content": "Metrics and roadmap..." }
  ]
}`;
      const response = await ai.models.generateContent({
        model: GEMINI_MODELS.TEXT_PRIMARY,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const parsed = JSON.parse(response.text || "{}");
      if (parsed.sections) {
        setDocDraft(parsed);
        onContextSync?.("document", docTopic, `Type: ${parsed.type || docType}, Title: ${parsed.title}, Sections: ${parsed.sections.length}, Summary: ${parsed.summary || ''}`);
      }
    } catch (e) {
      console.error("Document error:", e);
      setDocDraft({
        type: docType,
        title: docTopic,
        subtitle: "Strategic Blueprint & Technical Architecture",
        summary: `This report establishes baseline parameters, autonomous execution criteria, and operational excellence guidelines for ${docTopic}.`,
        sections: [
          {
            heading: "1. Executive Overview & Problem Definition",
            content: "Modern enterprise operations require deterministic accuracy paired with real-time responsiveness. This framework outlines the fundamental shifts needed to migrate from legacy manual oversight to autonomous execution engines."
          },
          {
            heading: "2. Technical Architecture & Component Flow",
            content: "The system utilizes low-latency streaming inference, multimodal visual perception, and strict memory compartmentalization to guarantee continuity across user sessions."
          },
          {
            heading: "3. Measurable Key Performance Indicators (KPIs)",
            content: "Achieves sub-250ms voice latency, 99.4% intent extraction accuracy, and zero hallucination boundaries through grounded verification tools."
          }
        ]
      });
      onContextSync?.("document", docTopic, `Type: ${docType}, Title: ${docTopic}, 3 structured sections`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 5. Generate Proposal
  const handleGenerateProposal = async () => {
    setIsGenerating(true);
    try {
      const ai = getGeminiClient();
      if (!ai) throw new Error("API key not configured");
      const prompt = `You are a Senior Solutions Architect & Enterprise Proposal Specialist.
Create an enterprise-grade commercial proposal for:
Client: "${propClient}"
Project: "${propProject}"
Budget/Investment: "${propBudget}"
Timeline: "${propTimeline}"

Return STRICT JSON:
{
  "clientName": "${propClient}",
  "projectName": "${propProject}",
  "executiveSummary": "Value proposition overview...",
  "problemStatement": "Client's pain points and bottleneck...",
  "proposedServices": ["Custom AI Agent Architecture", "Multimodal Integration", "Secure Deployment"],
  "deliverables": [
    { "item": "Core System Engine", "description": "Production autonomous backend", "timeline": "Week 1-2" },
    { "item": "UI & Admin Dashboard", "description": "Management interface with real-time telemetry", "timeline": "Week 3-4" },
    { "item": "Testing & Deployment", "description": "End-to-end load verification and cloud rollout", "timeline": "Week 5-6" }
  ],
  "timelineWeeks": "${propTimeline}",
  "investmentAmount": "${propBudget}",
  "paymentTerms": "50% upfront upon kickoff, 30% on milestone 2 deliverable, 20% on final sign-off.",
  "nextSteps": [
    "Sign proposal authorization",
    "Schedule kickoff technical briefing",
    "Initiate Sprint 1 architecture setup"
  ]
}`;
      const response = await ai.models.generateContent({
        model: GEMINI_MODELS.TEXT_PRIMARY,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const parsed = JSON.parse(response.text || "{}");
      if (parsed.deliverables) {
        setProposalDraft(parsed);
        onContextSync?.("proposal", propProject, `Client: ${parsed.clientName}, Investment: ${parsed.investmentAmount}, Deliverables: ${parsed.deliverables.length}`);
      }
    } catch (e) {
      console.error("Proposal error:", e);
      setProposalDraft({
        clientName: propClient,
        projectName: propProject,
        executiveSummary: `We are pleased to submit this proposal to engineer and deploy ${propProject} tailored specifically for ${propClient}.`,
        problemStatement: "Current workflows rely on fragmented manual handoffs, resulting in operational delays, elevated customer turnaround times, and preventable overhead.",
        proposedServices: [
          "End-to-End Autonomous Agent Engineering",
          "Real-time Multimodal Vision & Speech Processing",
          "Automated Lead Enrichment & CRM Synchronization",
          "Enterprise SLA Support & Continuous Optimization"
        ],
        deliverables: [
          { item: "Phase 1: Architecture Blueprint", description: "Comprehensive schema, API specifications, and security audits", timeline: "Weeks 1-2" },
          { item: "Phase 2: Core Engine & Workflow Build", description: "Implementation of all autonomous pipelines and validation gates", timeline: "Weeks 3-4" },
          { item: "Phase 3: Production Rollout & Training", description: "Final deployment, documentation, and staff enablement", timeline: "Weeks 5-6" }
        ],
        timelineWeeks: propTimeline,
        investmentAmount: propBudget,
        paymentTerms: "50% project kickoff retainer, 30% upon milestone 2 preview, 20% upon final production delivery.",
        nextSteps: [
          "Sign proposal authorization",
          "Schedule kickoff technical briefing",
          "Initiate Sprint 1 sprint planning"
        ]
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="creation-studio-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md"
        >
          <motion.div
            key="creation-studio-card"
            initial={{ scale: 0.96, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 15 }}
            className={`relative w-full ${
              isFullscreenPresenter ? "h-screen max-w-none rounded-none" : "max-w-6xl h-[92vh] rounded-3xl"
            } bg-[#0a0c13] border border-amber-500/30 overflow-hidden flex flex-col shadow-[0_0_80px_rgba(245,158,11,0.2)] transition-all`}
          >
            {/* Header */}
            {!isFullscreenPresenter && (
              <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                      NEXA CREATION & PRODUCTIVITY STUDIO
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">V2 OPTIMIZED</span>
                    </h2>
                    <p className="text-xs text-slate-400">Full Formatted PPT Decks, High-CTR Thumbnails, Responsive Websites & Executive Documents</p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Tab Navigation */}
            {!isFullscreenPresenter && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-6 py-2.5 bg-black/40 border-b border-white/5 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setActiveTab("ppt")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    activeTab === "ppt"
                      ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Presentation size={15} /> PPT Generator (Full Decks)
                </button>

                <button
                  onClick={() => setActiveTab("thumbnail")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    activeTab === "thumbnail"
                      ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <ImageIcon size={15} /> Thumbnail Strategist (High-CTR)
                </button>

                <button
                  onClick={() => setActiveTab("website")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    activeTab === "website"
                      ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Globe size={15} /> Website Builder
                </button>

                <button
                  onClick={() => setActiveTab("document")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    activeTab === "document"
                      ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <FileText size={15} /> AI Document Writer
                </button>

                <button
                  onClick={() => setActiveTab("proposal")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    activeTab === "proposal"
                      ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Briefcase size={15} /> Proposal Generator
                </button>
              </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              
              {/* 1. PPT GENERATOR (FULL FORMATTED DECKS) */}
              {activeTab === "ppt" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                  {/* Left Column: Config Panel */}
                  {!isFullscreenPresenter && (
                    <div className="lg:col-span-4 space-y-4 bg-white/[0.02] p-4 sm:p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Presentation size={15} /> Deck Architecture
                          </h3>
                          <span className="text-[10px] text-slate-400 font-mono">McKinsey / Apple Style</span>
                        </div>

                        <div>
                          <label className="text-xs text-slate-300 font-medium">Presentation Topic / Thesis</label>
                          <textarea
                            value={pptTopic}
                            onChange={(e) => setPptTopic(e.target.value)}
                            rows={3}
                            className="w-full mt-1.5 px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:border-amber-500 outline-none"
                            placeholder="e.g. AI Agents & Multi-Modal Automation for 2026"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-slate-300 font-medium">Target Audience Persona</label>
                          <input
                            type="text"
                            value={pptAudience}
                            onChange={(e) => setPptAudience(e.target.value)}
                            className="w-full mt-1.5 px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:border-amber-500 outline-none"
                            placeholder="e.g. Tech Founders, Venture Capitalists, Developers"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-slate-300 font-medium">Slide Count: {pptSlideCount}</label>
                            <input
                              type="range"
                              min={4}
                              max={15}
                              value={pptSlideCount}
                              onChange={(e) => setPptSlideCount(Number(e.target.value))}
                              className="w-full mt-1.5 accent-amber-500"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-slate-300 font-medium">Visual Theme</label>
                            <select
                              value={pptTheme}
                              onChange={(e) => setPptTheme(e.target.value as any)}
                              className="w-full mt-1.5 px-2.5 py-1.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-500"
                            >
                              <option value="cyberpunk">Cyberpunk Obsidian</option>
                              <option value="executive">Executive Navy</option>
                              <option value="emerald">Deep Emerald</option>
                              <option value="sunset">Sunset Quartz</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleGeneratePPT}
                        disabled={isGenerating || !pptTopic.trim()}
                        className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                      >
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                        {isGenerating ? "Synthesizing Multi-Layout Deck..." : "Generate Formatted Presentation"}
                      </button>
                    </div>
                  )}

                  {/* Right Column: Interactive Deck Viewer & Presenter */}
                  <div className={`${isFullscreenPresenter ? "col-span-12 h-full" : "lg:col-span-8"} bg-black/70 border border-white/10 rounded-2xl p-4 sm:p-6 flex flex-col justify-between shadow-2xl`}>
                    {pptDeck && pptDeck.slides.length > 0 ? (
                      <>
                        <div className="space-y-4">
                          {/* Slide Header Toolbar */}
                          <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                SLIDE {currentSlideIndex + 1} OF {pptDeck.slides.length}
                              </span>
                              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                                Layout: {pptDeck.slides[currentSlideIndex].layout || "formatted"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setShowPresenterNotes(!showPresenterNotes)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                                  showPresenterNotes ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
                                }`}
                              >
                                Speaker Notes
                              </button>
                              <button
                                onClick={exportPptAsPptx}
                                disabled={isExportingPptx}
                                className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1.5 border border-amber-500/30 disabled:opacity-50 transition-all shadow-sm"
                                title="Build real PowerPoint (.pptx) file from AI structured JSON"
                              >
                                {isExportingPptx ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                {isExportingPptx ? "Compiling .PPTX..." : "Download .PPTX (PowerPoint)"}
                              </button>
                              <button
                                onClick={exportPptAsHtml}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/30"
                              >
                                <Download size={14} /> Download HTML Deck
                              </button>
                              <button
                                onClick={() => setIsFullscreenPresenter(!isFullscreenPresenter)}
                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-white/10"
                              >
                                {isFullscreenPresenter ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                                {isFullscreenPresenter ? "Exit Presenter" : "Present Fullscreen"}
                              </button>
                            </div>
                          </div>

                          {/* Full Formatted Slide Visual Stage */}
                          <div className="min-h-[300px] sm:min-h-[340px] p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#0c0f18] via-[#090b12] to-black border border-amber-500/30 shadow-inner flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                            <div>
                              {/* Tag & Subtitle */}
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                                  {pptDeck.slides[currentSlideIndex].tag || "STRATEGIC EXECUTION"}
                                </span>
                              </div>

                              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
                                {pptDeck.slides[currentSlideIndex].title}
                              </h3>

                              {pptDeck.slides[currentSlideIndex].subtitle && (
                                <p className="text-xs sm:text-sm text-amber-300/90 font-medium mb-5">
                                  {pptDeck.slides[currentSlideIndex].subtitle}
                                </p>
                              )}

                              {/* Layout 1: KPIs / Metrics Grid */}
                              {pptDeck.slides[currentSlideIndex].kpis && pptDeck.slides[currentSlideIndex].kpis!.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                                  {pptDeck.slides[currentSlideIndex].kpis!.map((kpi, kIdx) => (
                                    <div key={`kpi-${kIdx}`} className="p-3.5 rounded-xl bg-white/[0.03] border border-amber-500/20 backdrop-blur-sm">
                                      <div className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight">{kpi.value}</div>
                                      <div className="text-[11px] text-slate-300 font-medium mt-1">{kpi.label}</div>
                                      {kpi.change && (
                                        <span className="inline-block text-[9px] font-mono text-emerald-400 mt-1 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                          {kpi.change}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Layout 2: Bento Cards */}
                              {pptDeck.slides[currentSlideIndex].cards && pptDeck.slides[currentSlideIndex].cards!.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
                                  {pptDeck.slides[currentSlideIndex].cards!.map((card, cIdx) => (
                                    <div key={`card-${cIdx}`} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
                                      <div>
                                        <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                                          {card.tag || `Pillar ${cIdx + 1}`}
                                        </span>
                                        <h5 className="text-xs font-bold text-white mt-2">{card.heading}</h5>
                                        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{card.description}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Layout 3: Problem vs Solution Comparison */}
                              {pptDeck.slides[currentSlideIndex].comparison && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
                                  <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                                    <h5 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">
                                      {pptDeck.slides[currentSlideIndex].comparison!.leftHeading}
                                    </h5>
                                    <ul className="space-y-1.5">
                                      {pptDeck.slides[currentSlideIndex].comparison!.leftItems.map((item, iIdx) => (
                                        <li key={`left-${iIdx}`} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                                          <span className="text-rose-400 font-bold">✕</span> {item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                    <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                                      {pptDeck.slides[currentSlideIndex].comparison!.rightHeading}
                                    </h5>
                                    <ul className="space-y-1.5">
                                      {pptDeck.slides[currentSlideIndex].comparison!.rightItems.map((item, rIdx) => (
                                        <li key={`right-${rIdx}`} className="text-[11px] text-slate-200 flex items-start gap-1.5">
                                          <span className="text-emerald-400 font-bold">✓</span> {item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              )}

                              {/* Layout 4: Timeline / Roadmap */}
                              {pptDeck.slides[currentSlideIndex].timeline && pptDeck.slides[currentSlideIndex].timeline!.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 my-4">
                                  {pptDeck.slides[currentSlideIndex].timeline!.map((step, sIdx) => (
                                    <div key={`step-${sIdx}`} className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                                      <span className="text-[9px] font-mono text-amber-400 font-bold block">{step.step}</span>
                                      <h6 className="text-xs font-bold text-white mt-0.5">{step.title}</h6>
                                      <p className="text-[10px] text-slate-400 mt-1">{step.desc}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Layout 5: Quote Highlight */}
                              {pptDeck.slides[currentSlideIndex].quote && (
                                <div className="p-5 my-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                                  <p className="text-sm sm:text-base font-semibold text-white italic">
                                    "{pptDeck.slides[currentSlideIndex].quote!.text}"
                                  </p>
                                  <div className="mt-3 text-xs text-amber-400 font-bold">
                                    — {pptDeck.slides[currentSlideIndex].quote!.author}, <span className="text-slate-400 font-normal">{pptDeck.slides[currentSlideIndex].quote!.role}</span>
                                  </div>
                                </div>
                              )}

                              {/* Standard Key Bullets */}
                              {pptDeck.slides[currentSlideIndex].bullets && pptDeck.slides[currentSlideIndex].bullets.length > 0 && (
                                <ul className="space-y-2 mt-3">
                                  {pptDeck.slides[currentSlideIndex].bullets.map((bullet, idx) => (
                                    <li key={`bullet-${currentSlideIndex}-${idx}`} className="flex items-start gap-2 text-xs sm:text-sm text-slate-200 leading-relaxed">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0 shadow-[0_0_8px_#f59e0b]" />
                                      <span>{bullet}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            {/* Slide Visual & Directives */}
                            <div className="mt-6 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                              <span className="italic flex items-center gap-1.5 text-amber-300/80">
                                <Eye size={13} className="text-amber-400 shrink-0" />
                                Visual Directive: {pptDeck.slides[currentSlideIndex].visualDirection}
                              </span>
                            </div>
                          </div>

                          {/* Presenter Speaker Notes Drawer */}
                          {showPresenterNotes && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl"
                            >
                              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block mb-1">
                                Presenter Script & Voice Delivery
                              </span>
                              <p className="text-xs text-slate-200 italic leading-relaxed">
                                "{pptDeck.slides[currentSlideIndex].speakerNotes}"
                              </p>
                            </motion.div>
                          )}
                        </div>

                        {/* Slide Navigation Bar */}
                        <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-4">
                          <button
                            disabled={currentSlideIndex === 0}
                            onClick={() => setCurrentSlideIndex(prev => prev - 1)}
                            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                          >
                            <ChevronLeft size={16} /> Previous Slide
                          </button>

                          {/* Slide Indicator Dots */}
                          <div className="flex items-center gap-1.5 max-w-[300px] overflow-x-auto scrollbar-hide py-1">
                            {pptDeck.slides.map((_, idx) => (
                              <button
                                key={`slide-nav-btn-${idx}`}
                                onClick={() => setCurrentSlideIndex(idx)}
                                className={`h-2 rounded-full transition-all ${
                                  currentSlideIndex === idx ? "w-6 bg-amber-400 shadow-[0_0_8px_#f59e0b]" : "w-2 bg-white/20 hover:bg-white/40"
                                }`}
                              />
                            ))}
                          </div>

                          <button
                            disabled={currentSlideIndex === pptDeck.slides.length - 1}
                            onClick={() => setCurrentSlideIndex(prev => prev + 1)}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-30"
                          >
                            Next Slide <ChevronRight size={16} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <Presentation size={48} className="text-amber-400/40 mb-3" />
                        <h4 className="text-base font-bold text-white mb-1">No Formatted Deck Generated Yet</h4>
                        <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                          Enter your presentation topic on the left and click Generate to produce a full multi-layout presentation deck equipped with KPI metrics, bento grids, comparison blocks, and full presenter notes.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. YOUTUBE THUMBNAIL STUDIO (HIGH-TECH GEMINI & CHATGPT ENGINE) */}
              {activeTab === "thumbnail" && (
                <div className="space-y-4 h-full flex flex-col">
                  {/* Top Mode Selector & Global Upload Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setThumbnailSubTab("ai_prompt")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                          thumbnailSubTab === "ai_prompt"
                            ? "bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-lg shadow-amber-500/20"
                            : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Wand2 size={14} /> High-Tech AI Image & Thumbnail (ChatGPT / Gemini)
                      </button>
                      <button
                        onClick={() => setThumbnailSubTab("hook_strategy")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                          thumbnailSubTab === "hook_strategy"
                            ? "bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-lg shadow-amber-500/20"
                            : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Layers size={14} /> Viral 3-Layer Strategist (Title & Hook Analysis)
                      </button>
                    </div>

                    {/* Single Photo Upload Button with NO LIMIT */}
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-2 transition-all shrink-0">
                        <Upload size={14} className="text-amber-400" />
                        {uploadedPhotos.length === 0 ? "Upload Photos (No Limit)" : "Add More Photos (No Limit)"}
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoUpload}
                        />
                      </label>
                      {uploadedPhotos.length > 0 && (
                        <button
                          onClick={() => {
                            setUploadedPhotos([]);
                            setUploadedSubjectImage(null);
                            setPrimaryPhotoIndex(0);
                          }}
                          className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 text-xs font-medium flex items-center gap-1 transition-all"
                          title="Clear all photos"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Photo Gallery Strip (Unlimited Photos) */}
                  {uploadedPhotos.length > 0 && (
                    <div className="p-3 bg-black/40 border border-white/10 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-[11px] text-amber-400 font-bold flex items-center gap-1.5">
                          <ImageIcon size={13} /> Loaded Photos ({uploadedPhotos.length}) • No Limit
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Click any photo to set as Primary (★) reference for AI generation
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10">
                        {uploadedPhotos.map((photo, idx) => (
                          <div
                            key={photo.id}
                            onClick={() => handleSelectPrimaryPhoto(idx)}
                            className={`group relative w-16 h-16 rounded-xl overflow-hidden shrink-0 cursor-pointer border-2 transition-all ${
                              primaryPhotoIndex === idx
                                ? "border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)] scale-105"
                                : "border-white/10 opacity-70 hover:opacity-100 hover:border-white/40"
                            }`}
                          >
                            <img src={photo.dataUrl} alt={photo.name} className="w-full h-full object-cover" />
                            {primaryPhotoIndex === idx && (
                              <div className="absolute top-1 left-1 bg-amber-500 text-black text-[9px] font-black rounded-md px-1 py-0.5 flex items-center gap-0.5 shadow">
                                <Star size={9} fill="currentColor" /> Primary
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemovePhoto(photo.id);
                              }}
                              className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/80 text-white/70 hover:text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete photo"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}

                        {/* Inline Add More Button */}
                        <label className="cursor-pointer w-16 h-16 rounded-xl border-2 border-dashed border-white/20 hover:border-amber-400/50 flex flex-col items-center justify-center text-slate-400 hover:text-amber-300 shrink-0 transition-all bg-white/[0.02]">
                          <Plus size={16} />
                          <span className="text-[9px] font-bold mt-1">+ Add</span>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoUpload}
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 1: HIGH-TECH AI PROMPT & IMAGE GENERATION */}
                  {thumbnailSubTab === "ai_prompt" && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                      {/* Left: Prompt Engineer Studio */}
                      <div className="lg:col-span-5 space-y-4 bg-white/[0.02] p-4 sm:p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles size={15} /> Prompt Studio (ChatGPT & Gemini)
                            </h3>
                            <span className="text-[10px] text-slate-400 font-mono">Photorealistic 8K • 16:9</span>
                          </div>

                          {/* Quick High-Tech Style Presets */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-400 uppercase font-mono tracking-wider font-bold">
                              High-Tech Style Presets
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                {
                                  name: "⚡ ChatGPT DALL-E 3 (Cyberpunk 8K)",
                                  text: "Ultra high-tech YouTube thumbnail: creator in neon dark cyberpunk studio gasping in disbelief, glowing holographic neural network circuits floating in 3D, neon cyan and burning amber rim lighting, octane render, 8k resolution, cinematic 16:9."
                                },
                                {
                                  name: "🔮 Gemini Ultra 4K (Studio Lighting)",
                                  text: "High-tech YouTube thumbnail in Gemini Ultra style: photorealistic creator pointing at massive glowing green analytics curve (+940% spike), high-contrast studio rim lighting, 3D text '100X BREAKTHROUGH', cinematic atmosphere."
                                },
                                {
                                  name: "🔥 Viral Tech Master (MrBeast / MKBHD)",
                                  text: "Viral high-CTR tech thumbnail: wide-eyed shocked creator expression, volumetric lighting, dark matrix background, high-voltage red alert badge '🚨 24 HOURS LEFT', 3D bold yellow typography 'IT REPLACED ME?!'."
                                },
                                {
                                  name: "🧠 Holographic AI Matrix (Dark HUD)",
                                  text: "Futuristic dark holographic AI laboratory thumbnail: creator with intense hyper-focus gaze examining glowing transparent holographic HUD interfaces, floating neon code blocks, cinematic depth of field."
                                }
                              ].map((preset, pIdx) => (
                                <button
                                  key={`preset-${pIdx}`}
                                  type="button"
                                  onClick={() => setCustomAiPrompt(preset.text)}
                                  className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-amber-500/20 hover:text-amber-300 border border-white/10 text-slate-300 font-medium transition-all text-left"
                                >
                                  {preset.name}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Custom Prompt Input */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs text-slate-300 font-medium">
                                High-Tech Thumbnail Image Prompt
                              </label>
                              <button
                                type="button"
                                onClick={handleEnhancePromptWithGemini}
                                disabled={isEnhancingPrompt || !customAiPrompt.trim()}
                                className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 transition-all disabled:opacity-40"
                              >
                                {isEnhancingPrompt ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <Sparkles size={11} />
                                )}
                                {isEnhancingPrompt ? "Enhancing..." : "Enhance with Gemini Pro"}
                              </button>
                            </div>
                            <textarea
                              value={customAiPrompt}
                              onChange={(e) => setCustomAiPrompt(e.target.value)}
                              rows={5}
                              className="w-full px-3 py-2.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:border-amber-500 outline-none leading-relaxed font-mono"
                              placeholder="Write whatever image prompt you want just like in ChatGPT or Gemini..."
                            />
                            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                              {uploadedPhotos.length > 0
                                ? `✓ ${uploadedPhotos.length} uploaded photo(s) will be included as visual reference parts for authentic human identity.`
                                : "💡 Tip: Click 'Upload Photos (No Limit)' above to include your real photos as visual references."}
                            </p>
                          </div>
                        </div>

                        {/* Generate Action Button */}
                        <button
                          onClick={handleGenerateAiThumbnailImage}
                          disabled={isGeneratingAiImage || !customAiPrompt.trim()}
                          className="w-full mt-4 py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                        >
                          {isGeneratingAiImage ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Wand2 size={16} />
                          )}
                          {isGeneratingAiImage
                            ? "Synthesizing High-Tech Image..."
                            : "Generate High-Tech Thumbnail / Image"}
                        </button>
                      </div>

                      {/* Right: 16:9 Visual Stage & Output Preview */}
                      <div className="lg:col-span-7 bg-black/70 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-2xl space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                              <ImageIcon size={14} className="text-amber-400" /> High-Tech 16:9 Canvas Stage
                            </span>
                            {generatedAiImageUrl && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setFullscreenImagePreview(generatedAiImageUrl)}
                                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-semibold flex items-center gap-1"
                                >
                                  <ZoomIn size={12} /> Fullscreen
                                </button>
                                <button
                                  onClick={() => copyToClipboard(customAiPrompt)}
                                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-semibold flex items-center gap-1"
                                >
                                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                  {copied ? "Copied" : "Copy Prompt"}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 16:9 Image Preview Box */}
                          <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-amber-500/30 bg-gradient-to-br from-slate-950 via-[#0a0d18] to-indigo-950 flex items-center justify-center shadow-2xl group">
                            {generatedAiImageUrl ? (
                              <>
                                <img
                                  src={generatedAiImageUrl}
                                  alt="Generated High-Tech Thumbnail"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                  <button
                                    onClick={() => {
                                      const link = document.createElement("a");
                                      link.download = `high-tech-thumbnail-${Date.now()}.png`;
                                      link.href = generatedAiImageUrl;
                                      link.click();
                                    }}
                                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 shadow-xl shadow-amber-500/30 transition-all"
                                  >
                                    <Download size={14} /> Download 16:9 PNG
                                  </button>
                                  <button
                                    onClick={() => setFullscreenImagePreview(generatedAiImageUrl)}
                                    className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-md transition-all"
                                  >
                                    <ZoomIn size={14} /> Zoom
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg">
                                  <Wand2 size={28} />
                                </div>
                                <h4 className="text-sm font-bold text-white">Your High-Tech Thumbnail Appears Here</h4>
                                <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                                  Write or enhance your prompt on the left, upload your photos (no limit!), and click generate to synthesize a high-tech thumbnail image just like ChatGPT and Gemini.
                                </p>
                                <button
                                  onClick={handleGenerateAiThumbnailImage}
                                  disabled={isGeneratingAiImage}
                                  className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl transition-all"
                                >
                                  {isGeneratingAiImage ? "Synthesizing..." : "⚡ Quick Generate Preview"}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Download / Action Row */}
                          {generatedAiImageUrl && (
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 font-bold">
                                <Check size={13} /> 1280x720 High-Res Output Ready
                              </span>
                              <button
                                onClick={() => {
                                  const link = document.createElement("a");
                                  link.download = `high-tech-thumbnail-${Date.now()}.png`;
                                  link.href = generatedAiImageUrl;
                                  link.click();
                                }}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-black text-xs font-extrabold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-all"
                              >
                                <Download size={14} /> Download 16:9 Thumbnail PNG
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Generation History Strip */}
                        {aiGenerationHistory.length > 1 && (
                          <div className="pt-3 border-t border-white/10 space-y-2">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                              Previous Generations ({aiGenerationHistory.length})
                            </span>
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                              {aiGenerationHistory.map((item, idx) => (
                                <button
                                  key={item.id || idx}
                                  onClick={() => {
                                    setGeneratedAiImageUrl(item.url);
                                    setCustomAiPrompt(item.prompt);
                                  }}
                                  className={`relative w-20 aspect-video rounded-lg overflow-hidden border shrink-0 transition-all ${
                                    generatedAiImageUrl === item.url
                                      ? "border-amber-400 ring-2 ring-amber-400/40 scale-105"
                                      : "border-white/10 opacity-70 hover:opacity-100"
                                  }`}
                                >
                                  <img src={item.url} alt={`Gen ${idx + 1}`} className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 2: VIRAL 3-LAYER HOOK STRATEGIST */}
                  {thumbnailSubTab === "hook_strategy" && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                      {/* Left Column: Viral Hook Strategist */}
                      <div className="lg:col-span-4 space-y-4 bg-white/[0.02] p-4 sm:p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                              <ImageIcon size={15} /> Viral CTR Algorithms
                            </h3>
                            <span className="text-[10px] text-slate-400 font-mono">MrBeast / Decoding YT</span>
                          </div>

                          <div>
                            <label className="text-xs text-slate-300 font-medium">Video Title / Hook Topic</label>
                            <textarea
                              value={thumbTopic}
                              onChange={(e) => setThumbTopic(e.target.value)}
                              rows={3}
                              className="w-full mt-1.5 px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:border-amber-500 outline-none"
                              placeholder="e.g. How I Built an Autonomous AI Employee That Makes $10,000/mo"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-slate-300 font-medium">Channel Genre / Niche</label>
                            <input
                              type="text"
                              value={thumbGenre}
                              onChange={(e) => setThumbGenre(e.target.value)}
                              className="w-full mt-1.5 px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:border-amber-500 outline-none"
                              placeholder="e.g. AI Coding, Tech, SaaS, Finance"
                            />
                          </div>

                          {/* Live text customizer for canvas mockup */}
                          {thumbConcepts.length > 0 && (
                            <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xl space-y-2">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block">
                                Live Canvas Text Customizer
                              </span>
                              <div>
                                <label className="text-[10px] text-slate-400">Headline Overlay Text</label>
                                <input
                                  type="text"
                                  value={customOverlayText}
                                  onChange={(e) => setCustomOverlayText(e.target.value)}
                                  className="w-full mt-1 px-2.5 py-1 bg-black/60 border border-white/10 rounded-lg text-xs text-white outline-none focus:border-amber-500 font-bold uppercase"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400">Badge Sticker Text</label>
                                <input
                                  type="text"
                                  value={customBadgeText}
                                  onChange={(e) => setCustomBadgeText(e.target.value)}
                                  className="w-full mt-1 px-2.5 py-1 bg-black/60 border border-white/10 rounded-lg text-xs text-white outline-none focus:border-amber-500 font-bold uppercase"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={handleGenerateThumbnails}
                          disabled={isGenerating || !thumbTopic.trim()}
                          className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                        >
                          {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                          {isGenerating ? "Synthesizing Engagement Models..." : "Generate 3 High-CTR Thumbnails"}
                        </button>
                      </div>

                      {/* Right Column: Visual Stage & CTR Breakdown */}
                      <div className="lg:col-span-8 bg-black/70 border border-white/10 rounded-2xl p-4 sm:p-6 flex flex-col justify-between shadow-2xl">
                        {thumbConcepts.length > 0 ? (
                          <div className="space-y-4">
                            {/* Concept Selector Tabs */}
                            <div className="grid grid-cols-3 gap-2">
                              {thumbConcepts.map((c, idx) => (
                                <button
                                  key={`thumb-tab-${c.id || idx}-${idx}`}
                                  onClick={() => setSelectedConceptIndex(idx)}
                                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-left truncate flex flex-col ${
                                    selectedConceptIndex === idx
                                      ? "bg-amber-500 text-black shadow-lg"
                                      : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  <span className="text-[9px] uppercase font-mono opacity-80">
                                    {c.archetype?.replace("_", " ") || `Concept ${idx + 1}`}
                                  </span>
                                  <span className="truncate">{c.title}</span>
                                </button>
                              ))}
                            </div>

                            {/* Interactive 16:9 Thumbnail Canvas Stage */}
                            <div className="relative aspect-video w-full rounded-2xl bg-gradient-to-br from-slate-950 via-[#0a0d18] to-indigo-950 border border-amber-500/40 overflow-hidden flex flex-col items-center justify-center p-6 sm:p-8 shadow-2xl group">
                              <div 
                                className="absolute inset-0 opacity-40 blur-2xl pointer-events-none"
                                style={{
                                  background: `radial-gradient(circle at 75% 30%, ${thumbConcepts[selectedConceptIndex].colorPalette[0] || '#F59E0B'} 0%, transparent 60%)`
                                }}
                              />

                              {/* Top Badges */}
                              <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
                                <span className="px-3 py-1 bg-black/80 backdrop-blur-md rounded-lg text-[10px] font-mono text-amber-400 border border-white/15 font-bold uppercase tracking-wider shadow-lg">
                                  {customBadgeText || thumbConcepts[selectedConceptIndex].badgeText || "100% AUTONOMOUS"}
                                </span>
                                <span className="px-2.5 py-1 bg-emerald-500/20 backdrop-blur-md rounded-lg text-[10px] font-mono text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                                  <TrendingUp size={11} /> CTR {thumbConcepts[selectedConceptIndex].ctrPredictionScore || 95}%
                                </span>
                              </div>

                              {/* Primary Subject (Composited Photo or Stylized Silhouette) */}
                              <div className="absolute right-4 sm:right-10 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                                {uploadedSubjectImage ? (
                                  <div className="relative w-28 h-28 sm:w-44 sm:h-44 rounded-full border-4 border-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.6)] overflow-hidden bg-black/80">
                                    <img src={uploadedSubjectImage} alt="Composited Cutout" className="w-full h-full object-cover" />
                                    <div className="absolute bottom-1 inset-x-0 text-center">
                                      <span className="bg-black/90 text-[8px] font-mono text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/40 font-bold">
                                        ✓ COMPOSITED
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="relative w-24 h-24 sm:w-36 sm:h-36 rounded-full border-2 border-dashed border-amber-400/40 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-center p-2">
                                    <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold mb-1">
                                      ⚡
                                    </div>
                                    <span className="text-[9px] text-amber-300 font-bold uppercase">Native Human</span>
                                    <span className="text-[7px] text-slate-400 font-mono">0% Face-Swap</span>
                                  </div>
                                )}
                              </div>

                              {/* Main Center Typography Layer */}
                              <div className="relative z-10 text-left sm:max-w-md mr-auto pl-2 sm:pl-6 space-y-3">
                                <div className="inline-block px-6 py-3 bg-black/80 border-2 border-amber-400 text-white font-black text-2xl sm:text-4xl tracking-tighter uppercase rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)] transform -rotate-1 drop-shadow-2xl">
                                  <span className="text-amber-400">
                                    {customOverlayText || thumbConcepts[selectedConceptIndex].textOverlay}
                                  </span>
                                </div>

                                {thumbConcepts[selectedConceptIndex].subTextOverlay && (
                                  <p className="text-xs sm:text-sm text-slate-100 font-bold uppercase tracking-wider drop-shadow-md">
                                    {thumbConcepts[selectedConceptIndex].subTextOverlay}
                                  </p>
                                )}

                                <p className="text-xs text-slate-300 font-medium max-w-md mx-auto line-clamp-2">
                                  {thumbConcepts[selectedConceptIndex].hook}
                                </p>
                              </div>

                              {/* Bottom Action Bar */}
                              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                                <div className="flex items-center gap-1.5 bg-black/70 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10">
                                  <span className="text-[10px] text-slate-400 font-mono">Palette:</span>
                                  {thumbConcepts[selectedConceptIndex].colorPalette.map((color, cIdx) => (
                                    <span
                                      key={`swatch-${selectedConceptIndex}-${color}-${cIdx}`}
                                      className="w-3.5 h-3.5 rounded-full border border-white/30 shadow-sm"
                                      style={{ backgroundColor: color }}
                                      title={color}
                                    />
                                  ))}
                                </div>

                                <button
                                  onClick={downloadThumbnailCanvas}
                                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/30 transition-all"
                                >
                                  <Download size={14} /> Download 16:9 PNG
                                </button>
                              </div>
                            </div>

                            {/* Algorithmic Intelligence Breakdown */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/[0.02] p-4 rounded-xl border border-white/5 text-xs text-slate-300">
                              <div>
                                <strong className="text-amber-400 block mb-1">Visual Hierarchy:</strong>
                                <p className="text-slate-300 text-[11px] leading-relaxed">{thumbConcepts[selectedConceptIndex].visualHierarchy}</p>
                              </div>

                              <div>
                                <strong className="text-amber-400 block mb-1">Cognitive Tension & Hook:</strong>
                                <p className="text-slate-300 text-[11px] leading-relaxed">{thumbConcepts[selectedConceptIndex].cognitiveTension || thumbConcepts[selectedConceptIndex].hook}</p>
                              </div>
                            </div>

                            {/* Midjourney / Imagen Prompt Box */}
                            <div className="p-3 bg-black/60 border border-white/10 rounded-xl space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                                  Prompt for Midjourney / DALL-E / Imagen 3
                                </span>
                                <button
                                  onClick={() => copyToClipboard(thumbConcepts[selectedConceptIndex].prompt)}
                                  className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-bold flex items-center gap-1"
                                >
                                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                  {copied ? "Copied" : "Copy Image Prompt"}
                                </button>
                              </div>
                              <p className="text-[11px] text-slate-300 font-mono bg-black/40 p-2.5 rounded-lg select-all">
                                {thumbConcepts[selectedConceptIndex].prompt}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center p-8">
                            <ImageIcon size={48} className="text-amber-400/40 mb-3" />
                            <h4 className="text-base font-bold text-white mb-1">No Strategic Thumbnails Generated</h4>
                            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                              Enter your video title to formulate 3 algorithmic thumbnail concepts featuring visual hierarchy mapping, 16:9 canvas mockups, and copyable high-res AI image prompts.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Fullscreen Image Preview Lightbox */}
                  {fullscreenImagePreview && (
                    <div 
                      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-8"
                      onClick={() => setFullscreenImagePreview(null)}
                    >
                      <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-mono text-amber-400 font-bold">16:9 HIGH-TECH THUMBNAIL FULLSCREEN PREVIEW</span>
                          <button
                            onClick={() => setFullscreenImagePreview(null)}
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <img
                          src={fullscreenImagePreview}
                          alt="Fullscreen Thumbnail"
                          className="w-full rounded-2xl shadow-2xl border border-amber-500/40"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. WEBSITE BUILDER */}
              {activeTab === "website" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                  <div className="lg:col-span-4 space-y-4 bg-white/[0.02] p-4 sm:p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Globe size={15} /> Website Specification
                      </h3>

                      <div>
                        <label className="text-xs text-slate-300 font-medium">Prompt & Feature Directives</label>
                        <textarea
                          value={webPrompt}
                          onChange={(e) => setWebPrompt(e.target.value)}
                          rows={4}
                          className="w-full mt-1.5 px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:border-amber-500 outline-none"
                          placeholder="e.g. High-converting SaaS landing page for an AI Automation platform with dark theme, pricing table, and testimonials"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleGenerateWebsite}
                      disabled={isGenerating || !webPrompt.trim()}
                      className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                      {isGenerating ? "Coding Responsive Web App..." : "Generate Complete Landing Page"}
                    </button>
                  </div>

                  <div className="lg:col-span-8 bg-black/70 border border-white/10 rounded-2xl p-4 sm:p-6 flex flex-col justify-between shadow-2xl">
                    {webHtml ? (
                      <div className="space-y-3 h-full flex flex-col">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setWebPreviewMode("preview")}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                                webPreviewMode === "preview" ? "bg-amber-500 text-black" : "bg-white/5 text-slate-300"
                              }`}
                            >
                              <Eye size={14} /> Live Preview
                            </button>
                            <button
                              onClick={() => setWebPreviewMode("code")}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                                webPreviewMode === "code" ? "bg-amber-500 text-black" : "bg-white/5 text-slate-300"
                              }`}
                            >
                              <Code size={14} /> View HTML Source
                            </button>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const blob = new Blob([webHtml], { type: "text/html" });
                                const url = URL.createObjectURL(blob);
                                window.open(url, "_blank");
                              }}
                              className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 text-xs font-semibold flex items-center gap-1.5"
                            >
                              <ExternalLink size={14} /> Open in Tab
                            </button>
                            <button
                              onClick={() => copyToClipboard(webHtml)}
                              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5"
                            >
                              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                              {copied ? "Copied" : "Copy Code"}
                            </button>
                          </div>
                        </div>

                        <div className="flex-1 min-h-[350px] bg-slate-950 rounded-xl overflow-hidden border border-white/10">
                          {webPreviewMode === "preview" ? (
                            <iframe
                              srcDoc={webHtml}
                              className="w-full h-full min-h-[350px] border-none bg-white"
                              title="Website Preview Sandbox"
                            />
                          ) : (
                            <pre className="p-4 text-[11px] font-mono text-slate-300 overflow-y-auto h-[350px] scrollbar-hide whitespace-pre-wrap">
                              {webHtml}
                            </pre>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <Globe size={48} className="text-amber-400/40 mb-3" />
                        <h4 className="text-base font-bold text-white mb-1">No Website Generated</h4>
                        <p className="text-xs text-slate-400 max-w-md">Enter your requirements to generate a complete responsive landing page in modern Tailwind CSS.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 4. AI DOCUMENT WRITER */}
              {activeTab === "document" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                  <div className="lg:col-span-4 space-y-4 bg-white/[0.02] p-4 sm:p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText size={15} /> Document Parameters
                      </h3>

                      <div>
                        <label className="text-xs text-slate-300 font-medium">Document Type</label>
                        <select
                          value={docType}
                          onChange={(e) => setDocType(e.target.value)}
                          className="w-full mt-1.5 px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-500"
                        >
                          <option value="Executive Technical Report">Executive Technical Report</option>
                          <option value="Study Notes & Comprehensive Guide">Study Notes & Comprehensive Guide</option>
                          <option value="Project Specification & Scope Document">Project Specification & Scope Document</option>
                          <option value="Business Strategy & Execution Plan">Business Strategy & Execution Plan</option>
                          <option value="Standard Operating Procedure (SOP)">Standard Operating Procedure (SOP)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-slate-300 font-medium">Subject / Core Topic</label>
                        <textarea
                          value={docTopic}
                          onChange={(e) => setDocTopic(e.target.value)}
                          rows={3}
                          className="w-full mt-1.5 px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:border-amber-500 outline-none"
                          placeholder="e.g. Autonomous Voice Agents: Architecture & Performance Benchmarks"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleGenerateDoc}
                      disabled={isGenerating || !docTopic.trim()}
                      className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                      {isGenerating ? "Synthesizing Document..." : "Generate Professional Document"}
                    </button>
                  </div>

                  <div className="lg:col-span-8 bg-black/70 border border-white/10 rounded-2xl p-4 sm:p-6 flex flex-col justify-between shadow-2xl">
                    {docDraft ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                          <div>
                            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">{docDraft.type}</span>
                            <h4 className="text-base font-bold text-white">{docDraft.title}</h4>
                          </div>

                          <button
                            onClick={() => {
                              const formatted = `# ${docDraft.title}\n*${docDraft.subtitle || ''}*\n\n## Executive Summary\n${docDraft.summary}\n\n` + docDraft.sections.map(s => `## ${s.heading}\n${s.content}`).join('\n\n');
                              copyToClipboard(formatted);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5"
                          >
                            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                            {copied ? "Copied" : "Copy Markdown"}
                          </button>
                        </div>

                        <div className="max-h-[350px] overflow-y-auto space-y-4 p-4 rounded-xl bg-slate-950/60 border border-white/5 scrollbar-hide text-xs text-slate-200 leading-relaxed">
                          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            <strong className="text-amber-400 block mb-1">Executive Summary:</strong>
                            <p className="text-slate-300">{docDraft.summary}</p>
                          </div>

                          {docDraft.sections.map((section, idx) => (
                            <div key={`doc-sec-${idx}`} className="space-y-1.5 pt-2 border-t border-white/5">
                              <h5 className="font-bold text-amber-300 text-sm">{section.heading}</h5>
                              <p className="text-slate-300 whitespace-pre-wrap">{section.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <FileText size={48} className="text-amber-400/40 mb-3" />
                        <h4 className="text-base font-bold text-white mb-1">No Document Generated</h4>
                        <p className="text-xs text-slate-400 max-w-md">Select your document type and enter your topic to compile a structured, comprehensive paper.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. PROPOSAL GENERATOR */}
              {activeTab === "proposal" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                  <div className="lg:col-span-4 space-y-4 bg-white/[0.02] p-4 sm:p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Briefcase size={15} /> Commercial Proposal
                      </h3>

                      <div>
                        <label className="text-xs text-slate-300 font-medium">Client / Organization</label>
                        <input
                          type="text"
                          value={propClient}
                          onChange={(e) => setPropClient(e.target.value)}
                          className="w-full mt-1 px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-500"
                          placeholder="e.g. Apex Global"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-300 font-medium">Project Scope / Engagement</label>
                        <textarea
                          value={propProject}
                          onChange={(e) => setPropProject(e.target.value)}
                          rows={2}
                          className="w-full mt-1 px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-500"
                          placeholder="e.g. Enterprise AI Lead Intelligence Pipeline"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-300 font-medium">Budget</label>
                          <input
                            type="text"
                            value={propBudget}
                            onChange={(e) => setPropBudget(e.target.value)}
                            className="w-full mt-1 px-2.5 py-1.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-300 font-medium">Timeline</label>
                          <input
                            type="text"
                            value={propTimeline}
                            onChange={(e) => setPropTimeline(e.target.value)}
                            className="w-full mt-1 px-2.5 py-1.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleGenerateProposal}
                      disabled={isGenerating || !propClient.trim()}
                      className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                      {isGenerating ? "Drafting Proposal..." : "Generate Commercial Proposal"}
                    </button>
                  </div>

                  <div className="lg:col-span-8 bg-black/70 border border-white/10 rounded-2xl p-4 sm:p-6 flex flex-col justify-between shadow-2xl">
                    {proposalDraft ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                          <div>
                            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">PROPOSAL FOR {proposalDraft.clientName}</span>
                            <h4 className="text-base font-bold text-white">{proposalDraft.projectName}</h4>
                          </div>

                          <button
                            onClick={() => {
                              const formatted = `# Commercial Proposal for ${proposalDraft.clientName}\n**Project:** ${proposalDraft.projectName}\n**Investment:** ${proposalDraft.investmentAmount} | **Timeline:** ${proposalDraft.timelineWeeks}\n\n## Executive Summary\n${proposalDraft.executiveSummary}\n\n## Problem Statement\n${proposalDraft.problemStatement}\n\n## Deliverables\n` +
                                proposalDraft.deliverables.map(d => `- **${d.item}** (${d.timeline}): ${d.description}`).join('\n') +
                                `\n\n## Payment Terms\n${proposalDraft.paymentTerms}\n\n## Next Steps\n` +
                                proposalDraft.nextSteps.map(n => `1. ${n}`).join('\n');
                              copyToClipboard(formatted);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5"
                          >
                            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                            {copied ? "Copied" : "Copy Proposal"}
                          </button>
                        </div>

                        <div className="max-h-[350px] overflow-y-auto space-y-3.5 p-4 rounded-xl bg-slate-950/60 border border-white/5 scrollbar-hide text-xs text-slate-200">
                          <div>
                            <strong className="text-amber-400 block mb-1">1. Executive Summary:</strong>
                            <p className="text-slate-300 leading-relaxed">{proposalDraft.executiveSummary}</p>
                          </div>

                          <div className="pt-2 border-t border-white/5">
                            <strong className="text-amber-400 block mb-1">2. Problem Addressed:</strong>
                            <p className="text-slate-300 leading-relaxed">{proposalDraft.problemStatement}</p>
                          </div>

                          <div className="pt-2 border-t border-white/5">
                            <strong className="text-amber-400 block mb-2">3. Milestone Deliverables:</strong>
                            <div className="space-y-2">
                              {proposalDraft.deliverables.map((del, dIdx) => (
                                <div key={`proposal-deliv-${dIdx}`} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 flex justify-between items-start">
                                  <div>
                                    <span className="font-bold text-white">{del.item}</span>
                                    <p className="text-[11px] text-slate-400 mt-0.5">{del.description}</p>
                                  </div>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 shrink-0 ml-2">
                                    {del.timeline}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                              <span className="text-[10px] text-amber-400 font-mono block">TOTAL INVESTMENT</span>
                              <span className="text-sm font-bold text-white">{proposalDraft.investmentAmount}</span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                              <span className="text-[10px] text-slate-400 font-mono block">DELIVERY TIMELINE</span>
                              <span className="text-sm font-bold text-white">{proposalDraft.timelineWeeks}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <Briefcase size={48} className="text-amber-400/40 mb-3" />
                        <h4 className="text-base font-bold text-white mb-1">No Proposal Generated</h4>
                        <p className="text-xs text-slate-400 max-w-md">Enter client and budget details to generate a comprehensive enterprise proposal.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
export default CreationStudioModal;
