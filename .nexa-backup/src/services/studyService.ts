import { getGeminiClient } from "./aiClient";
import { StudyBoxState, StudyDifficulty, StudyQuestion, StudyChatMessage } from "../types";

export const DEFAULT_SAMPLE_STUDY_BOX: StudyBoxState = {
  subject: "Physics - Light: Reflection & Refraction (CBSE Board Exam)",
  sourceTitle: "CBSE Class 10 Board Exam Sample Paper (Standard Level)",
  sourceType: "preset_syllabus",
  difficultyLevel: "medium",
  overviewSummary: "Core Board Exam unit focusing on ray diagrams, Snell's law, mirror & lens formula derivations, and refractive index numericals. High-frequency 3-mark and 5-mark questions.",
  syllabusBreakdown: [
    {
      topic: "Spherical Mirrors & Mirror Formula",
      weightage: "4-5 Marks",
      importantTips: "Sign convention is crucial! Object distance 'u' is always negative."
    },
    {
      topic: "Refraction through Glass Slab & Prism",
      weightage: "3 Marks",
      importantTips: "Remember lateral displacement is directly proportional to slab thickness."
    },
    {
      topic: "Lenses & Power of Lens",
      weightage: "4-5 Marks",
      importantTips: "P = 1/f (in meters). Convex lens power is positive, concave is negative."
    }
  ],
  questions: [
    {
      id: "q-1",
      questionNumber: 1,
      question: "An object 4 cm in size is placed at 25 cm in front of a concave mirror of focal length 15 cm. At what distance from the mirror should a screen be placed to obtain a sharp image? Find the nature and size of the image.",
      marks: 3,
      difficulty: "medium",
      topic: "Concave Mirror Numerical",
      visualType: "diagram",
      visualIllustration: `
┌─────────────────────────────────────────────────────────────┐
│               CONCAVE MIRROR RAY DIAGRAM                    │
│                                                             │
│              Object (h=4cm)                                 │
│                   ↑                                         │
│       ────────────┼───────────┬──────────────┬───────────── │
│                  (O)          C              F            P │
│                   │◄── 25cm ─►│◄── 15cm ────►│              │
│                                              │              │
│       Ray 1: Parallel to Principal Axis ───► Passes through F│
│       Ray 2: Passes through C ─────────────► Retraces path  │
│                                              ↓              │
│                             Image formed: Real, Inverted    │
│                             Position v = -37.5 cm           │
│                             Height h' = -6 cm               │
└─────────────────────────────────────────────────────────────┘`,
      explanation: "Using Mirror Formula: 1/f = 1/v + 1/u.\nHere: f = -15 cm, u = -25 cm, h = +4 cm.\n1/v = 1/f - 1/u = (-1/15) - (-1/25) = -2/75 => v = -37.5 cm (screen should be 37.5 cm in front of mirror).\nMagnification m = -v/u = -(-37.5)/(-25) = -1.5.\nSize of image h' = m * h = -1.5 * 4 = -6 cm. Nature: Real, inverted and magnified.",
      keyFormulas: [
        "1/f = 1/v + 1/u",
        "m = -v/u = h'/h",
        "Sign: Concave f < 0, Object u < 0"
      ],
      examTip: "Always draw the sign convention ray before starting numerical calculations!",
      isMastered: false
    },
    {
      id: "q-2",
      questionNumber: 2,
      question: "State Snell's Law of refraction. If the speed of light in water is 2.25 × 10^8 m/s and in vacuum is 3 × 10^8 m/s, calculate the absolute refractive index of water.",
      marks: 2,
      difficulty: "easy",
      topic: "Snell's Law & Refractive Index",
      visualType: "flowchart",
      visualIllustration: `
┌─────────────────────────────────────────────────────────────┐
│                    SNELL'S LAW & REFRACTION                 │
│                                                             │
│           Incident Ray \       Normal                       │
│                         \        |                          │
│                   Medium 1 (Air) |   Angle i                │
│             ═════════════════════╪═════════════════         │
│                   Medium 2 (Water|   Angle r                │
│                                  | \                        │
│                                  |  \ Refracted Ray         │
│                                                             │
│         Formula:  sin(i) / sin(r) = n2 / n1 = constant      │
│         Absolute Refractive Index: n = c / v                │
└─────────────────────────────────────────────────────────────┘`,
      explanation: "Snell's Law: The ratio of sine of angle of incidence (sin i) to sine of angle of refraction (sin r) is constant for a given pair of media.\nCalculation: n = c / v = (3 × 10^8) / (2.25 × 10^8) = 4 / 3 ≈ 1.33.",
      keyFormulas: ["sin(i) / sin(r) = n21", "n = c / v"],
      examTip: "Refractive index has NO units because it is a ratio of identical quantities!",
      isMastered: true
    },
    {
      id: "q-3",
      questionNumber: 3,
      question: "A convex lens forms a real and inverted image of a needle at a distance of 50 cm from it. Where is the needle placed in front of the convex lens if the image is equal to the size of the object? Also, find the optical power of the lens.",
      marks: 4,
      difficulty: "hard",
      topic: "Convex Lens & Power Calculation",
      visualType: "equation",
      visualIllustration: `
┌─────────────────────────────────────────────────────────────┐
│                 EQUAL SIZE IMAGE IN CONVEX LENS             │
│                                                             │
│         Condition: Image size = Object size (|m| = 1)       │
│         For Convex Lens: Real image -> m = -1               │
│                                                             │
│         m = v / u  =>  -1 = 50 / u  =>  u = -50 cm          │
│         Therefore, object is at 2F1: 2f = 50 cm => f = 25 cm│
│                                                             │
│         Power of Lens:                                      │
│         P = 1 / f(in meters) = 1 / (+0.25 m) = +4 Diopters  │
└─────────────────────────────────────────────────────────────┘`,
      explanation: "Since image is of equal size and real, m = -1.\nm = v/u => -1 = 50 / u => u = -50 cm.\nLens formula: 1/f = 1/v - 1/u = 1/50 - (-1/50) = 2/50 = 1/25 => f = +25 cm = +0.25 m.\nPower P = 1/f(m) = 1/0.25 = +4 D.",
      keyFormulas: ["1/f = 1/v - 1/u", "P = 1 / f (in meters)", "Unit of Power: Diopter (D)"],
      examTip: "Never forget to convert focal length from cm to meters before calculating Power!",
      isMastered: false
    }
  ],
  currentQuestionIndex: 0,
  blackboardNotes: `=== AOI SENSEI'S VISUAL BLACKBOARD ===\n* Topic: Light & Optics (Class 10 CBSE)\n* Key Mantra: Light slows down in denser medium -> bends toward normal!\n* Mirror Formula: 1/f = 1/v + 1/u  [+ sign between v and u]\n* Lens Formula:   1/f = 1/v - 1/u  [- sign between v and u]\n* Power: P = 1/f(m) (Unit: Diopters D)\n* Ganbatte, Bhavik-kun! Let's solve Question 1 together! 🌸`,
  studyChat: [
    {
      id: "msg-0",
      sender: "sensei",
      text: "Konnichiwa, Bhavik-kun! 🌸 Aoi Sensei is ready at the blackboard. I've prepared our Physics exam paper. Look at Question 1 on concave mirrors—shall we work through the ray diagram together? Ganbatte!",
      timestamp: Date.now() - 360000
    }
  ],
  lastUpdated: new Date().toISOString()
};

// Retrieve Study Box from Local Storage
export function getSavedStudyBox(): StudyBoxState {
  if (typeof window === "undefined") return DEFAULT_SAMPLE_STUDY_BOX;
  try {
    const raw = localStorage.getItem("nexa_study_box");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.questions && Array.isArray(parsed.questions)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error reading nexa_study_box:", err);
  }
  return DEFAULT_SAMPLE_STUDY_BOX;
}

// Persist Study Box to Local Storage and notify app
export function saveStudyBox(state: StudyBoxState): void {
  if (typeof window === "undefined") return;
  try {
    state.lastUpdated = new Date().toISOString();
    localStorage.setItem("nexa_study_box", JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("nexa-study-box-updated", { detail: state }));
  } catch (err) {
    console.error("Error saving nexa_study_box:", err);
  }
}

// AI Analysis of uploaded Question Paper, PDF, or Textbook excerpt
export async function analyzeStudyMaterial(
  input: {
    name: string;
    mimeType?: string;
    base64?: string;
    text?: string;
    level: StudyDifficulty;
  }
): Promise<StudyBoxState> {
  const ai = getGeminiClient();
  if (!ai) throw new Error("Gemini API key is not configured.");

  const prompt = `You are Aoi Sensei, an expert visual anime teacher and exam paper analyzer.
Analyze this exam question paper / textbook material for Bhavik.
Target Difficulty Level: "${input.level.toUpperCase()}".

Extract and structure into JSON with:
1. "subject": Clear subject and topic title (e.g. "Mathematics: Quadratic Equations", "Chemistry: Chemical Reactions", "Computer Science: Python DSA").
2. "sourceTitle": Short descriptive title of the paper or document (e.g. "Midterm Question Paper 2026", "NCERT Chapter 4 Exercise").
3. "overviewSummary": 2-3 sentences summarizing key concepts, exam weightage, and recurring patterns.
4. "syllabusBreakdown": Array of 3-5 topics, each with:
   - "topic": Name of subtopic
   - "weightage": Estimated marks or frequency
   - "importantTips": Practical advice for exams
5. "questions": Array of 4-8 questions extracted or synthesized from the paper, covering ${input.level} level (with a healthy mix of easy, medium, hard):
   - "questionNumber": integer (1, 2, 3...)
   - "question": Full question text with exact numbers/parameters
   - "marks": 1, 2, 3, 4, or 5
   - "difficulty": "easy" | "medium" | "hard"
   - "topic": specific subtopic
   - "visualType": "diagram" | "flowchart" | "equation" | "mindmap" | "table"
   - "visualIllustration": High-clarity visual ASCII blackboard art or structured diagram (framed with border box) illustrating the concept, ray diagram, circuit, reaction mechanism, or step-by-step math proof!
   - "explanation": Step-by-step solution explained with warmth, crystal-clear logic, and simple analogies.
   - "keyFormulas": Array of 2-4 crucial formulas or rules used.
   - "examTip": Pro tip to avoid common student traps.
6. "blackboardNotes": A neat blackboard summary with formulas, key rules, and an encouraging anime teacher greeting for Bhavik!

Return strictly valid JSON matching this schema:
{
  "subject": string,
  "sourceTitle": string,
  "overviewSummary": string,
  "syllabusBreakdown": [{"topic": string, "weightage": string, "importantTips": string}],
  "questions": [{
    "questionNumber": number,
    "question": string,
    "marks": number,
    "difficulty": "easy" | "medium" | "hard",
    "topic": string,
    "visualType": string,
    "visualIllustration": string,
    "explanation": string,
    "keyFormulas": [string],
    "examTip": string
  }],
  "blackboardNotes": string
}`;

  let contents: any[] = [];
  if (input.base64 && input.mimeType) {
    contents = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: input.mimeType,
              data: input.base64
            }
          },
          { text: prompt }
        ]
      }
    ];
  } else {
    contents = [
      {
        role: "user",
        parts: [
          { text: `DOCUMENT CONTENT:\n${input.text || "Sample paper uploaded"}\n\n${prompt}` }
        ]
      }
    ];
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents,
    config: {
      responseMimeType: "application/json",
      temperature: 0.3
    }
  });

  const responseText = response.text?.trim() || "{}";
  const parsed = JSON.parse(responseText);

  const newStudyBox: StudyBoxState = {
    subject: parsed.subject || input.name || "Exam Question Paper",
    sourceTitle: parsed.sourceTitle || input.name,
    sourceType: input.mimeType?.includes("pdf") ? "uploaded_pdf" : (input.mimeType?.includes("image") ? "uploaded_image" : "uploaded_paper"),
    difficultyLevel: input.level,
    overviewSummary: parsed.overviewSummary || "Analysis of your paper with structured questions and visual blackboard diagrams.",
    syllabusBreakdown: parsed.syllabusBreakdown || [],
    questions: (parsed.questions || []).map((q: any, idx: number) => ({
      ...q,
      id: `q-${Date.now()}-${idx + 1}`,
      questionNumber: idx + 1,
      isMastered: false
    })),
    currentQuestionIndex: 0,
    blackboardNotes: parsed.blackboardNotes || `=== AOI SENSEI'S VISUAL BLACKBOARD ===\n* Welcome Bhavik-kun! 🌸\n* Paper Loaded: ${input.name}\n* Let's conquer each question visually!`,
    studyChat: [
      {
        id: `chat-init-${Date.now()}`,
        sender: "sensei",
        text: `Konnichiwa Bhavik-kun! 🌸 I've thoroughly analyzed "${parsed.sourceTitle || input.name}"! We have ${parsed.questions?.length || 0} exam questions calibrated for ${input.level.toUpperCase()} difficulty. Check our visual blackboard—ready to solve Question 1? Ganbatte!`,
        timestamp: Date.now()
      }
    ],
    lastUpdated: new Date().toISOString()
  };

  saveStudyBox(newStudyBox);
  return newStudyBox;
}

// Search internet for question papers, textbooks, and syllabus
export async function searchAndFetchStudyMaterialOnline(
  searchQuery: string,
  level: StudyDifficulty = "medium"
): Promise<StudyBoxState> {
  const ai = getGeminiClient();
  if (!ai) throw new Error("Gemini API key is not configured.");

  const searchPrompt = `You are Aoi Sensei, an enthusiastic visual anime teacher.
Search the web for real exam question papers, sample question papers, syllabus benchmarks, and textbook practice questions for:
"${searchQuery}".
Target Level: ${level.toUpperCase()} (Difficulty: ${level}).

Synthesize an authentic, high-quality exam question set and visual blackboard lessons for Bhavik.
Return valid JSON with:
{
  "subject": string,
  "sourceTitle": string,
  "overviewSummary": string,
  "syllabusBreakdown": [{"topic": string, "weightage": string, "importantTips": string}],
  "questions": [{
    "questionNumber": number,
    "question": string,
    "marks": number,
    "difficulty": "easy" | "medium" | "hard",
    "topic": string,
    "visualType": "diagram" | "flowchart" | "equation" | "mindmap" | "table",
    "visualIllustration": string, // High-clarity ASCII visual blackboard art/diagram framed neatly
    "explanation": string, // Clear step-by-step breakdown with simple intuitive analogies
    "keyFormulas": [string],
    "examTip": string
  }],
  "blackboardNotes": string
}`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: [{ parts: [{ text: searchPrompt }] }],
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  let raw = response.text || "";
  // Extract JSON block if wrapped in markdown
  const jsonMatch = raw.match(/```json([\s\S]*?)```/i) || raw.match(/\{[\s\S]*\}/);
  let parsed: any = {};
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch (e) {
      console.warn("Could not parse JSON from search, fallback", e);
    }
  }

  const newStudyBox: StudyBoxState = {
    subject: parsed.subject || searchQuery,
    sourceTitle: parsed.sourceTitle || `${searchQuery} (Online Exam Bank)`,
    sourceType: "online_search",
    difficultyLevel: level,
    overviewSummary: parsed.overviewSummary || `Online curated question paper and syllabus for ${searchQuery}.`,
    syllabusBreakdown: parsed.syllabusBreakdown || [
      { topic: "Core Fundamentals", weightage: "40%", importantTips: "Master the definitions and formulas first." },
      { topic: "Application & Numericals", weightage: "40%", importantTips: "Practice step-by-step problem solving." },
      { topic: "High-Yield Exam Questions", weightage: "20%", importantTips: "Look out for recurring board exam patterns." }
    ],
    questions: (parsed.questions && parsed.questions.length > 0 ? parsed.questions : DEFAULT_SAMPLE_STUDY_BOX.questions).map((q: any, idx: number) => ({
      ...q,
      id: `q-online-${Date.now()}-${idx + 1}`,
      questionNumber: idx + 1,
      isMastered: false
    })),
    currentQuestionIndex: 0,
    blackboardNotes: parsed.blackboardNotes || `=== AOI SENSEI'S ONLINE STUDY DESK ===\n* Subject: ${searchQuery}\n* Source: Online Curated Exam Bank\n* Ganbatte, Bhavik-kun! Let's master this topic together! 🌸`,
    studyChat: [
      {
        id: `chat-online-${Date.now()}`,
        sender: "sensei",
        text: `Konnichiwa, Bhavik-kun! 🌸 I searched the web and retrieved an authentic question bank for "${searchQuery}" at ${level.toUpperCase()} difficulty! I've loaded our visual blackboard. Let's start with Question 1—tell me your thoughts!`,
        timestamp: Date.now()
      }
    ],
    lastUpdated: new Date().toISOString()
  };

  saveStudyBox(newStudyBox);
  return newStudyBox;
}

// Visual explanation if student does not understand
export async function explainVisuallyWithSensei(
  question: StudyQuestion,
  confusionNote: string = "I don't understand, please explain visually!"
): Promise<{
  voiceScript: string;
  visualIllustration: string;
  newExplanation: string;
  blackboardUpdate: string;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      voiceScript: "Hai Bhavik-kun! 🌸 Look closely at the visual board. Let's break this down into simple pieces!",
      visualIllustration: question.visualIllustration,
      newExplanation: question.explanation,
      blackboardUpdate: "Focus on the step-by-step formula."
    };
  }

  const prompt = `You are Aoi Sensei, a super cute, warm, and brilliant anime teacher.
Bhavik says he does NOT understand this question:
Question: "${question.question}"
Topic: "${question.topic}"
Student confusion / note: "${confusionNote}"

Explain it to him completely VISUALLY!
1. "voiceScript": 2-3 enthusiastic spoken sentences in your cute anime teacher voice (address him warmly as "Bhavik-kun", use cheerful anime teacher enthusiasm like "Hai! Look right here at our visual diagram 🌸", "Imagine it like this...", "Sugoi! See how it connects?").
2. "visualIllustration": A brand new, ultra-clear ASCII visual blackboard diagram, step-by-step flowchart, or visual metaphor framed neatly in a box that makes the concept instantly click.
3. "newExplanation": A fresh, intuitive explanation using a simple real-world anime analogy.
4. "blackboardUpdate": 2-3 bullet points to write on the blackboard chalk.

Return strictly valid JSON:
{
  "voiceScript": string,
  "visualIllustration": string,
  "newExplanation": string,
  "blackboardUpdate": string
}`;

  try {
    const res = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.4
      }
    });

    const parsed = JSON.parse(res.text?.trim() || "{}");
    return {
      voiceScript: parsed.voiceScript || "Hai Bhavik-kun! 🌸 Let's look at this diagram together!",
      visualIllustration: parsed.visualIllustration || question.visualIllustration,
      newExplanation: parsed.newExplanation || question.explanation,
      blackboardUpdate: parsed.blackboardUpdate || "Key rule: break down into steps!"
    };
  } catch (err) {
    console.error("Failed visual explanation:", err);
    return {
      voiceScript: "Hai Bhavik-kun! 🌸 Don't worry, Sensei is here! Let's examine the blackboard together step by step.",
      visualIllustration: question.visualIllustration,
      newExplanation: question.explanation,
      blackboardUpdate: "Step 1: Identify given variables. Step 2: Apply formula."
    };
  }
}
