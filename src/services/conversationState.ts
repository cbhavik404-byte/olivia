// src/services/conversationState.ts
// Explicit Conversation State, Emotional Engine, and Task Context Tracker (Sections 7, 8, 11, 12, 13-18, 27, 28)

export type NexaEmotionalState = 
  | "calm"
  | "neutral"
  | "focused"
  | "curious"
  | "happy"
  | "excited"
  | "playful"
  | "amused"
  | "concerned"
  | "disappointed"
  | "mildly_annoyed"
  | "angry"
  | "apologetic"
  | "serious"
  | "supportive"
  | "empathetic"
  | "confident"
  | "cautious";

export interface TaskState {
  currentGoal: string;
  objective: string;
  completedSteps: string[];
  pendingSteps: string[];
  status: "idle" | "planning" | "executing" | "verifying" | "completed" | "blocked";
  lastAction?: string;
  targetPanel?: string | null;
  retryCount: number;
}

export interface ImportantTopicMemory {
  title: string;
  keyInformation: string[];
  decisions: string[];
  currentProgress: string;
  unresolvedIssues: string[];
  updatedAt: string;
}

export class ConversationStateManager {
  private currentTopic: string = "General Interaction";
  private currentSubtopic: string = "";
  private emotionalState: NexaEmotionalState = "calm";
  private emotionalIntensity: number = 0.5; // 0.0 to 1.0
  private angerRecoveryStep: "none" | "anger" | "realization" | "explanation" | "calm" = "none";
  private activePanel: string | null = null;
  private taskState: TaskState = {
    currentGoal: "",
    objective: "",
    completedSteps: [],
    pendingSteps: [],
    status: "idle",
    retryCount: 0
  };
  private recentDecisions: string[] = [];
  private unresolvedQuestions: string[] = [];
  private userPreferences: Record<string, string> = {};
  private importantTopics: Record<string, ImportantTopicMemory> = {};
  private lastInteractionTimestamp: number = Date.now();
  private sessionStartTime: number = Date.now();

  constructor() {
    this.loadState();
  }

  private isTransient(text: string): boolean {
    if (!text) return false;
    const t = text.toLowerCase();
    return t.includes("headache") || t.includes("pain") || t.includes("ugc ad") || t.includes("ad creation");
  }

  private loadState() {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("nexa_conversation_state");
      if (stored) {
        const parsed = JSON.parse(stored);
        this.currentTopic = this.isTransient(parsed.currentTopic) ? "General Interaction" : (parsed.currentTopic || "General Interaction");
        this.currentSubtopic = this.isTransient(parsed.currentSubtopic) ? "" : (parsed.currentSubtopic || "");
        this.emotionalState = parsed.emotionalState || "calm";
        this.recentDecisions = (parsed.recentDecisions || []).filter((d: string) => !this.isTransient(d));
        this.unresolvedQuestions = (parsed.unresolvedQuestions || []).filter((q: string) => !this.isTransient(q));
        this.userPreferences = parsed.userPreferences || {};
        this.importantTopics = parsed.importantTopics || {};
        this.lastInteractionTimestamp = parsed.lastInteractionTimestamp || Date.now();
      }
    } catch (e) {
      console.warn("Failed to load ConversationState from storage:", e);
    }
  }

  private saveState() {
    if (typeof window === "undefined") return;
    try {
      const payload = {
        currentTopic: this.currentTopic,
        currentSubtopic: this.currentSubtopic,
        emotionalState: this.emotionalState,
        recentDecisions: this.recentDecisions.slice(-10),
        unresolvedQuestions: this.unresolvedQuestions.slice(-5),
        userPreferences: this.userPreferences,
        importantTopics: this.importantTopics,
        lastInteractionTimestamp: this.lastInteractionTimestamp,
      };
      localStorage.setItem("nexa_conversation_state", JSON.stringify(payload));
    } catch (e) {
      console.warn("Failed to save ConversationState:", e);
    }
  }

  public recordInteraction() {
    this.lastInteractionTimestamp = Date.now();
    this.saveState();
  }

  public getTimeSinceLastInteractionSeconds(): number {
    return Math.floor((Date.now() - this.lastInteractionTimestamp) / 1000);
  }

  /**
   * Generates a context-aware human-like greeting based on real elapsed time (Sections 11 & 12).
   */
  public getNaturalGreeting(): string {
    const elapsedMinutes = Math.floor(this.getTimeSinceLastInteractionSeconds() / 60);
    const elapsedHours = Math.floor(elapsedMinutes / 60);

    if (elapsedMinutes < 5) {
      return "Yeah, I'm right here. What are we working on next?";
    } else if (elapsedMinutes < 45) {
      return "Hey, welcome back. Ready to continue where we left off?";
    } else if (elapsedHours < 6) {
      return "Hey Bhavik! Good to have you back. Let's pick back up.";
    } else if (elapsedHours < 24) {
      return "Hey! Ready to dive back in today?";
    } else {
      return "Hey Bhavik! Great to see you. What's on your agenda today?";
    }
  }

  public getTopic(): string {
    return this.currentTopic;
  }

  public setTopic(topic: string, subtopic: string = "") {
    this.currentTopic = topic;
    this.currentSubtopic = subtopic;
    this.saveState();
  }

  public getEmotionalState(): { state: NexaEmotionalState; intensity: number } {
    return { state: this.emotionalState, intensity: this.emotionalIntensity };
  }

  public setEmotionalState(state: NexaEmotionalState, intensity: number = 0.5) {
    this.emotionalState = state;
    this.emotionalIntensity = Math.min(1.0, Math.max(0.1, intensity));
    
    // Controlled anger state recovery progression (Section 15)
    if (state === "angry" || state === "mildly_annoyed") {
      this.angerRecoveryStep = "anger";
    } else {
      this.angerRecoveryStep = "calm";
    }
    this.saveState();
  }

  public advanceAngerRecovery(): NexaEmotionalState {
    if (this.angerRecoveryStep === "anger") {
      this.angerRecoveryStep = "realization";
      this.emotionalState = "curious";
    } else if (this.angerRecoveryStep === "realization") {
      this.angerRecoveryStep = "explanation";
      this.emotionalState = "serious";
    } else {
      this.angerRecoveryStep = "calm";
      this.emotionalState = "calm";
    }
    this.saveState();
    return this.emotionalState;
  }

  public getActivePanel(): string | null {
    return this.activePanel;
  }

  public setActivePanel(panel: string | null) {
    this.activePanel = panel;
  }

  public getTaskState(): TaskState {
    return { ...this.taskState };
  }

  public startTask(goal: string, objective: string, pendingSteps: string[] = [], targetPanel: string | null = null) {
    this.taskState = {
      currentGoal: goal,
      objective,
      completedSteps: [],
      pendingSteps,
      status: "planning",
      targetPanel,
      retryCount: 0
    };
  }

  public recordCompletedStep(step: string) {
    this.taskState.completedSteps.push(step);
    this.taskState.pendingSteps = this.taskState.pendingSteps.filter(s => s !== step);
    this.taskState.status = this.taskState.pendingSteps.length === 0 ? "completed" : "executing";
  }

  public failStep(reason: string): boolean {
    this.taskState.retryCount++;
    if (this.taskState.retryCount > 3) {
      this.taskState.status = "blocked";
      return false; // Blocker reached (Section 25)
    }
    return true; // Can retry with alternative
  }

  public completeTask() {
    this.taskState.status = "completed";
  }

  public addDecision(decision: string) {
    this.recentDecisions.push(decision);
    if (this.recentDecisions.length > 10) this.recentDecisions.shift();
    this.saveState();
  }

  public saveImportantTopic(title: string, keyInfo: string[]) {
    this.importantTopics[title.toLowerCase()] = {
      title,
      keyInformation: keyInfo,
      decisions: [...this.recentDecisions],
      currentProgress: this.taskState.status === "completed" ? "Done" : "In Progress",
      unresolvedIssues: [...this.unresolvedQuestions],
      updatedAt: new Date().toISOString()
    };
    this.saveState();
  }

  public getImportantTopic(title: string): ImportantTopicMemory | null {
    return this.importantTopics[title.toLowerCase()] || null;
  }

  public forgetTopic(query: string) {
    const qLower = (query || "").toLowerCase();
    if (!qLower || this.currentTopic.toLowerCase().includes(qLower) || this.isTransient(this.currentTopic)) {
      this.currentTopic = "General Interaction";
      this.currentSubtopic = "";
    }
    if (this.taskState.currentGoal && (!qLower || this.taskState.currentGoal.toLowerCase().includes(qLower) || this.isTransient(this.taskState.currentGoal))) {
      this.taskState = {
        currentGoal: "",
        objective: "",
        completedSteps: [],
        pendingSteps: [],
        status: "idle",
        retryCount: 0
      };
    }
    this.recentDecisions = this.recentDecisions.filter(d => !qLower || !d.toLowerCase().includes(qLower));
    this.saveState();
  }

  public getActiveConversationContextSummary(): string {
    const activeTaskSummary = this.taskState.currentGoal 
      ? `\nActive Task: "${this.taskState.currentGoal}" | Status: ${this.taskState.status} | Steps Done: [${this.taskState.completedSteps.join(", ")}]` 
      : "";
    const panelSummary = this.activePanel ? `\nCurrently Visible/Open Screen Panel: [${this.activePanel}]` : "\nCurrently Visible Screen Panel: [Main Visualizer & Chat]";
    const emotionSummary = `Current Emotional Tone: ${this.emotionalState} (Intensity: ${this.emotionalIntensity})`;

    return `==================================================
CURRENT CONVERSATION STATE & SCREEN CONTINUITY:
Current Topic: ${this.currentTopic}
${emotionSummary}${panelSummary}${activeTaskSummary}
Recent Decisions: ${this.recentDecisions.length > 0 ? this.recentDecisions.join("; ") : "None yet"}
==================================================`;
  }
}

export const conversationState = new ConversationStateManager();
