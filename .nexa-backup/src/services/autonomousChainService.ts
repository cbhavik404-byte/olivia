import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { getGeminiClient } from "./aiClient";
import { fastWebSearch } from "./fastSearchService";
import { batteryService } from "./batteryService";

export interface PipelineStep {
  id: string;
  stepNumber: number;
  totalSteps?: number;
  toolName: string;
  actionTitle: string;
  args: Record<string, any>;
  status: "pending" | "running" | "completed" | "failed";
  resultSummary?: string;
  timestamp: number;
}

export interface PipelineExecutionResult {
  success: boolean;
  finalSpeech: string;
  steps: PipelineStep[];
  error?: string;
}

export interface AutonomousToolHandlers {
  searchWeb: (query: string) => Promise<string>;
  writeNotepad: (title: string, content: string, mode?: "append" | "replace") => Promise<string>;
  readNotepad: () => Promise<string>;
  setTimer: (durationSeconds: number, label: string) => Promise<string>;
  manageHabit: (action: "add" | "complete", title: string) => Promise<string>;
  controlDevice: (feature: "flashlight_on" | "flashlight_off" | "camera_switch" | "battery_telemetry") => Promise<string>;
  playSoundscape: (soundscape: "rain" | "lofi" | "waves" | "cafe" | "forest" | "binaural", play: boolean) => Promise<string>;
  launchCreationStudio: (studioType: "presentation" | "thumbnail" | "website" | "document", topic: string) => Promise<string>;
  draftWhatsApp: (recipientName: string, message: string) => Promise<string>;
  openPanel: (panel: "notepad" | "study_board" | "lead_finder" | "creation_studio" | "habits" | "settings" | "soundscapes" | "local_bridge") => Promise<string>;
  executeLocalCli: (command: string) => Promise<string>;
  controlLocalApp: (action: "launch" | "kill", target: string) => Promise<string>;
  getLocalSystemStatus: () => Promise<string>;
  saveLocalProjectFile: (filename: string, content: string) => Promise<string>;
}

// 1. Tool Function Declarations for Gemini Function Calling
const searchWebDeclaration: FunctionDeclaration = {
  name: "search_web",
  description: "Search Google and the live web for verified, up-to-the-minute real-world information, technical docs, news, or data.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "Specific web search query." },
    },
    required: ["query"],
  },
};

const writeNotepadDeclaration: FunctionDeclaration = {
  name: "write_notepad",
  description: "Write, update, or append notes, drafted emails, executive summaries, research briefs, or code to Bhavik's personal notepad.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Headline or section title for the note entry." },
      content: { type: Type.STRING, description: "The full markdown formatted content to write into the notepad." },
      mode: { type: Type.STRING, description: "'append' to add to existing notes, or 'replace' to overwrite.", enum: ["append", "replace"] },
    },
    required: ["title", "content"],
  },
};

const readNotepadDeclaration: FunctionDeclaration = {
  name: "read_notepad",
  description: "Inspect and read the current text stored in Bhavik's personal notepad.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const setTimerDeclaration: FunctionDeclaration = {
  name: "set_countdown_timer",
  description: "Set an active countdown timer or pomodoro alarm with sound alert for focus, breaks, or tasks.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      durationSeconds: { type: Type.NUMBER, description: "Total duration in seconds (e.g. 1500 for 25 mins, 600 for 10 mins)." },
      label: { type: Type.STRING, description: "Label or purpose for the timer (e.g. 'Deep Focus Block')." },
    },
    required: ["durationSeconds", "label"],
  },
};

const manageHabitDeclaration: FunctionDeclaration = {
  name: "manage_habit",
  description: "Add a new daily habit or mark an existing habit completed in the habit tracker.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, description: "'add' to create a new habit, or 'complete' to mark done.", enum: ["add", "complete"] },
      title: { type: Type.STRING, description: "The title of the habit." },
    },
    required: ["action", "title"],
  },
};

const controlDeviceDeclaration: FunctionDeclaration = {
  name: "control_device_hardware",
  description: "Control hardware devices like flashlight, camera, or retrieve battery telemetry.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      feature: {
        type: Type.STRING,
        description: "The hardware feature to trigger.",
        enum: ["flashlight_on", "flashlight_off", "camera_switch", "battery_telemetry"],
      },
    },
    required: ["feature"],
  },
};

const playSoundscapeDeclaration: FunctionDeclaration = {
  name: "play_ambient_soundscape",
  description: "Start or stop ambient background audio for focus, studying, and relaxation (Rain, Lo-Fi, Waves, Cafe, Forest, Binaural).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      soundscape: {
        type: Type.STRING,
        description: "Soundscape theme.",
        enum: ["rain", "lofi", "waves", "cafe", "forest", "binaural"],
      },
      play: { type: Type.BOOLEAN, description: "True to start playing, false to stop." },
    },
    required: ["soundscape", "play"],
  },
};

const launchCreationStudioDeclaration: FunctionDeclaration = {
  name: "launch_creation_studio",
  description: "Trigger the NEXA Creation Studio to generate a complete PowerPoint slide deck (.pptx), YouTube thumbnail, website, or document.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      studioType: {
        type: Type.STRING,
        description: "Type of asset to generate.",
        enum: ["presentation", "thumbnail", "website", "document"],
      },
      topic: { type: Type.STRING, description: "Detailed topic or brief for generation." },
    },
    required: ["studioType", "topic"],
  },
};

const draftWhatsAppDeclaration: FunctionDeclaration = {
  name: "draft_whatsapp_outreach",
  description: "Draft a personalized WhatsApp message or initiate outreach through the Bulk WhatsApp Sender.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      recipientName: { type: Type.STRING, description: "Recipient name or phone number." },
      message: { type: Type.STRING, description: "The message text to send." },
    },
    required: ["recipientName", "message"],
  },
};

const openPanelDeclaration: FunctionDeclaration = {
  name: "open_system_panel",
  description: "Open or toggle specialized UI workspace views.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      panel: {
        type: Type.STRING,
        description: "Panel to open.",
        enum: ["notepad", "study_board", "lead_finder", "creation_studio", "habits", "settings", "soundscapes", "local_bridge"],
      },
    },
    required: ["panel"],
  },
};

const executeCliDeclaration: FunctionDeclaration = {
  name: "execute_local_cli",
  description: "Execute a command directly in the user's local terminal/CLI environment (e.g., git status, git log, npm run build, docker ps, python script, dir, ls).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      command: { type: Type.STRING, description: "Terminal or shell command string to execute." },
    },
    required: ["command"],
  },
};

const controlLocalAppDeclaration: FunctionDeclaration = {
  name: "control_local_application",
  description: "Launch native local desktop applications (vscode, terminal, docker, spotify, chrome) or kill/terminate background processes by PID/name.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, description: "'launch' to start app, or 'kill' to terminate.", enum: ["launch", "kill"] },
      target: { type: Type.STRING, description: "Application name or process PID to control." },
    },
    required: ["action", "target"],
  },
};

const getLocalSystemStatusDeclaration: FunctionDeclaration = {
  name: "get_local_system_telemetry",
  description: "Retrieve live CPU, Memory, Disk, Active Processes, Platform architecture, and local environment diagnostics from the user's computer/phone.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const saveLocalFileDeclaration: FunctionDeclaration = {
  name: "save_local_file",
  description: "Write code, config, or documentation directly to the user's local project filesystem or download it directly to disk.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      fileName: { type: Type.STRING, description: "Filename with extension (e.g., script.py, README.md, docker-compose.yml)." },
      content: { type: Type.STRING, description: "The complete file text/code to write." },
    },
    required: ["fileName", "content"],
  },
};

const allAutonomousTools = [
  searchWebDeclaration,
  writeNotepadDeclaration,
  readNotepadDeclaration,
  setTimerDeclaration,
  manageHabitDeclaration,
  controlDeviceDeclaration,
  playSoundscapeDeclaration,
  launchCreationStudioDeclaration,
  draftWhatsAppDeclaration,
  openPanelDeclaration,
  executeCliDeclaration,
  controlLocalAppDeclaration,
  getLocalSystemStatusDeclaration,
  saveLocalFileDeclaration,
];

// Heuristic to detect whether a user prompt requests multi-step tool-chaining
export function isCompoundOrAutonomousIntent(prompt: string): boolean {
  const p = prompt.toLowerCase().trim();

  // Explicit autonomous triggers
  if (
    p.startsWith("jarvis") ||
    p.startsWith("alexa") ||
    p.includes("autonomous") ||
    p.includes("workflow") ||
    p.includes("automate") ||
    p.includes("pipeline") ||
    p.includes("chain")
  ) {
    return true;
  }

  // Multi-step sequential conjunctions
  if (
    p.includes(" and then ") ||
    p.includes(" after that ") ||
    p.includes(" then ") ||
    p.includes(" also ") ||
    p.includes(" first ") && p.includes(" then ") ||
    p.includes(" as well as ")
  ) {
    return true;
  }

  // Combined action indicators (e.g. "search ... and write ...", "prepare briefing and set timer", "run git status and open vscode")
  const actionVerbs = [
    "search", "google", "find", "look up",
    "write", "note", "notepad", "draft", "save to note",
    "timer", "alarm", "countdown",
    "habit", "soundscape", "music", "rain", "lofi",
    "presentation", "slides", "ppt", "thumbnail", "website",
    "whatsapp", "message", "torch", "flashlight",
    "terminal", "cli", "command", "git", "docker", "npm", "script",
    "process", "cpu", "ram", "system", "specs", "specs", "vscode", "kill", "launch"
  ];

  let matches = 0;
  for (const verb of actionVerbs) {
    if (p.includes(verb)) matches++;
    if (matches >= 2) return true;
  }

  return false;
}

// Convert tool call to a readable human-facing action label
function formatStepLabel(name: string, args: Record<string, any>): string {
  switch (name) {
    case "search_web":
      return `Searching Web: "${args.query || 'information'}"`;
    case "write_notepad":
      return `Writing to Notepad: "${args.title || 'Note Entry'}"`;
    case "read_notepad":
      return `Reading Current Notepad Contents`;
    case "set_countdown_timer": {
      const mins = Math.round((args.durationSeconds || 60) / 60);
      return `Setting ${mins}m Timer: "${args.label || 'Focus'}"`;
    }
    case "manage_habit":
      return `${args.action === 'complete' ? 'Completing' : 'Adding'} Habit: "${args.title}"`;
    case "control_device_hardware":
      return `Hardware Control: ${args.feature}`;
    case "play_ambient_soundscape":
      return `${args.play ? 'Activating' : 'Stopping'} ${args.soundscape?.toUpperCase()} Soundscape`;
    case "launch_creation_studio":
      return `Creation Studio: Generating ${args.studioType} on "${args.topic}"`;
    case "draft_whatsapp_outreach":
      return `Drafting WhatsApp for ${args.recipientName}`;
    case "open_system_panel":
      return `Opening ${args.panel} Panel`;
    case "execute_local_cli":
      return `Terminal CLI: $ ${args.command}`;
    case "control_local_application":
      return `${args.action === 'kill' ? 'Terminating' : 'Launching'} Local App: ${args.target}`;
    case "get_local_system_telemetry":
      return `Reading Local OS Context (CPU/RAM/Processes)`;
    case "save_local_file":
      return `Saving Local File: "${args.fileName}"`;
    default:
      return `Executing ${name}`;
  }
}

// 2. The Core Autonomous Multi-Step Tool Chaining Loop
export async function runAutonomousToolChain(
  userPrompt: string,
  handlers: AutonomousToolHandlers,
  onStepUpdate: (steps: PipelineStep[]) => void
): Promise<PipelineExecutionResult> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      success: false,
      finalSpeech: "My cognitive link is unconfigured. Please ensure GEMINI_API_KEY is available.",
      steps: [],
      error: "No Gemini Client",
    };
  }

  const steps: PipelineStep[] = [];
  let stepCounter = 0;
  const maxChainSteps = 5;

  const systemInstruction = `You are JARVIS / NEXA Autonomous Agentic Execution Engine for Bhavik.
You possess a suite of native tools to autonomously fulfill complex, compound, multi-step requests.

RULES FOR AUTONOMOUS SEQUENTIAL EXECUTION:
1. When Bhavik gives you a compound goal, DO NOT just describe what you would do. YOU MUST ACTUALLY CALL THE TOOLS SEQUENTIALLY.
2. Call the first appropriate tool needed for Step 1.
3. When you receive the tool's execution output, analyze it and immediately decide whether another tool call is needed for Step 2.
4. Continue chaining tools one after another (e.g. Search Web -> Write Notepad -> Set Focus Timer -> Trigger Soundscape) until the user's complete request is fulfilled.
5. Once all actions in the pipeline are fully executed, provide a concise, sharp, charismatic final confirmation in natural spoken English addressing Bhavik. Keep it under 2 sentences with zero robot jargon.`;

  // Start multi-turn conversation
  const contents: any[] = [
    {
      role: "user",
      parts: [{ text: userPrompt }],
    },
  ];

  try {
    let currentIteration = 0;

    while (currentIteration < maxChainSteps) {
      currentIteration++;

      const agentModels = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash"];
      let response: any = null;

      for (const m of agentModels) {
        try {
          response = await ai.models.generateContent({
            model: m,
            contents,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations: allAutonomousTools }],
              temperature: 0.2, // Low temperature for decisive agentic planning
            },
          });
          if (response) break;
        } catch (_) {}
      }

      if (!response) {
        break;
      }

      const candidate = response.candidates?.[0];
      if (!candidate) {
        break;
      }

      // Append model turn to conversation history
      contents.push(candidate.content);

      const functionCalls = response.functionCalls;

      // If no function calls, the autonomous chain has concluded!
      if (!functionCalls || functionCalls.length === 0) {
        let finalReply = response.text || "";
        if (!finalReply && candidate.content?.parts) {
          finalReply = candidate.content.parts.map((p: any) => p.text || "").join(" ").trim();
        }

        return {
          success: true,
          finalSpeech: finalReply || "All pipeline tasks have been autonomously completed, Bhavik.",
          steps,
        };
      }

      // Execute each tool call in this step
      const functionResponseParts: any[] = [];

      for (const call of functionCalls) {
        stepCounter++;
        const stepId = `step-${stepCounter}-${Date.now()}`;
        const toolName = call.name;
        const toolArgs = (call.args as Record<string, any>) || {};

        const currentStep: PipelineStep = {
          id: stepId,
          stepNumber: stepCounter,
          toolName,
          actionTitle: formatStepLabel(toolName, toolArgs),
          args: toolArgs,
          status: "running",
          timestamp: Date.now(),
        };

        steps.push(currentStep);
        onStepUpdate([...steps]);

        let toolOutput = "";

        try {
          switch (toolName) {
            case "search_web":
              toolOutput = await handlers.searchWeb(toolArgs.query || "");
              break;

            case "write_notepad":
              toolOutput = await handlers.writeNotepad(
                toolArgs.title || "Note",
                toolArgs.content || "",
                toolArgs.mode || "append"
              );
              break;

            case "read_notepad":
              toolOutput = await handlers.readNotepad();
              break;

            case "set_countdown_timer":
              toolOutput = await handlers.setTimer(
                Number(toolArgs.durationSeconds) || 300,
                toolArgs.label || "Focus Timer"
              );
              break;

            case "manage_habit":
              toolOutput = await handlers.manageHabit(
                toolArgs.action || "add",
                toolArgs.title || "Daily Habit"
              );
              break;

            case "control_device_hardware":
              toolOutput = await handlers.controlDevice(toolArgs.feature);
              break;

            case "play_ambient_soundscape":
              toolOutput = await handlers.playSoundscape(
                toolArgs.soundscape || "rain",
                Boolean(toolArgs.play)
              );
              break;

            case "launch_creation_studio":
              toolOutput = await handlers.launchCreationStudio(
                toolArgs.studioType || "presentation",
                toolArgs.topic || "Overview"
              );
              break;

            case "draft_whatsapp_outreach":
              toolOutput = await handlers.draftWhatsApp(
                toolArgs.recipientName || "Contact",
                toolArgs.message || ""
              );
              break;

            case "open_system_panel":
              toolOutput = await handlers.openPanel(toolArgs.panel);
              break;

            case "execute_local_cli":
              toolOutput = await handlers.executeLocalCli(toolArgs.command || "echo 'Hello from JARVIS'");
              break;

            case "control_local_application":
              toolOutput = await handlers.controlLocalApp(
                toolArgs.action || "launch",
                toolArgs.target || "vscode"
              );
              break;

            case "get_local_system_telemetry":
              toolOutput = await handlers.getLocalSystemStatus();
              break;

            case "save_local_file":
              toolOutput = await handlers.saveLocalProjectFile(
                toolArgs.fileName || "output.txt",
                toolArgs.content || ""
              );
              break;

            default:
              toolOutput = `Executed custom function ${toolName} successfully.`;
          }

          currentStep.status = "completed";
          currentStep.resultSummary = typeof toolOutput === "string" ? toolOutput.slice(0, 160) : "Success";
        } catch (err: any) {
          console.error(`Autonomous step error in ${toolName}:`, err);
          currentStep.status = "failed";
          currentStep.resultSummary = `Error: ${err.message || "Failed"}`;
          toolOutput = `Tool execution error: ${err.message || "Failed"}`;
        }

        onStepUpdate([...steps]);

        functionResponseParts.push({
          functionResponse: {
            name: toolName,
            response: { output: toolOutput },
            ...(call.id ? { id: call.id } : {}),
          },
        });
      }

      // Send the tool outputs back to Gemini as role 'tool'
      contents.push({
        role: "tool",
        parts: functionResponseParts,
      });
    }

    return {
      success: true,
      finalSpeech: "Autonomous tool sequence finished executing, Bhavik.",
      steps,
    };
  } catch (err: any) {
    console.error("Autonomous Pipeline execution failure:", err);
    return {
      success: false,
      finalSpeech: "Encountered a friction point during autonomous execution, but current system state has been preserved.",
      steps,
      error: err.message,
    };
  }
}
