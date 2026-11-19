import { capabilityRegistry } from "./capabilityRegistry";
import { memoryManager } from "./memoryManager";
import { conversationState } from "./conversationState";
import { AvatarVocalEmotion, OliviaVoiceStyle, PersonalityMode } from "../types";

export interface CommandResult {
  action: string;
  url?: string;
  isBrowserAction: boolean;
  emotion?: AvatarVocalEmotion;
  oliviaStyle?: OliviaVoiceStyle;
  deviceAction?: {
    type: 'launch_app' | 'flashlight' | 'clipboard_write' | 'clipboard_read' | 'notification' | 'switch_camera' | 'set_timer' | 'open_notepad' | 'open_study_board' | 'play_birthday_melody' | 'sing_song' | 'transcribe_and_sing' | 'add_habit' | 'update_habit' | 'open_settings' | 'change_voice' | 'switch_personality' | 'toggle_kiss' | 'trigger_shy' | 'close_current_panel' | 'open_panel' | 'close_panel' | 'boost_volume' | 'save_memory' | 'forget_memory' | 'stop_avatar_animations_and_overlays' | 'local_cli' | 'local_app_control';
    param?: any;
  };
}

export function processCommand(command: string, personalityMode: PersonalityMode = "default"): CommandResult {
  let lowerCmd = command.toLowerCase().trim();

  // Strip wake words & greetings ("nexus,", "hey nexus", "nexa,", "hey nexa", "alexa,", "hey alexa", "ok nexus", "hi nexus", "hello nexus")
  lowerCmd = lowerCmd.replace(/^(?:hey|hi|hello|ok|okay)?\s*(?:nexus|nexa|alexa|oliviya|olivia|coco|zoya|sensa|assistant)\s*[,:\s]*/i, "").trim();

  // Record interaction in conversation state (Section 8)
  conversationState.recordInteraction();

  // A. Complete Self-Description from Structured Capability Registry (Section 32 & 33)
  if (
    lowerCmd === "what are you" ||
    lowerCmd === "who are you" ||
    lowerCmd === "what can you do" ||
    lowerCmd === "tell me what you can do" ||
    lowerCmd === "tell me your features" ||
    lowerCmd === "what are your features" ||
    lowerCmd === "list your capabilities" ||
    lowerCmd.includes("tell me every feature") ||
    lowerCmd.includes("every feature you have") ||
    lowerCmd.includes("what exactly are you")
  ) {
    return {
      action: capabilityRegistry.generateSelfDescription({ brief: false }),
      isBrowserAction: false,
    };
  }

  // B. Adaptive Volume Control (Section 35)
  if (
    lowerCmd.includes("can't hear you") || 
    lowerCmd.includes("cant hear you") || 
    lowerCmd.includes("speak louder") || 
    lowerCmd.includes("increase volume") || 
    lowerCmd.includes("too quiet") ||
    lowerCmd.includes("turn volume up") ||
    lowerCmd.includes("volume up")
  ) {
    return {
      action: "I hear you! Boosting my volume and vocal clarity right now. Can you hear me loud and clear now, Bhavik?",
      isBrowserAction: false,
      deviceAction: {
        type: 'boost_volume',
        param: { level: 1.0, boost: true }
      }
    };
  }

  // C-1. Forgetting Directives ("Forget this...", "Forgot it...", "Delete memory of...", "I am fine now, forget...")
  const forgetMatch = 
    lowerCmd.match(/^(?:(?:can you\s+|please\s+|just\s+)?(?:forget|forgot|erase|delete|remove|clear)\s+(?:this|that|it|everything|all|memory(?:\s+of)?)\b|(?:bhool ja|bhool jao)\b)\s*[:,\s]*(.*)$/i) ||
    lowerCmd.match(/^(?:forget this|forgot this|forget that|forgot that|forget it|forgot it|forget about|delete memory(?: of)?|remove memory(?: of)?|clear memory(?: of)?|forget my|bhool ja|bhool jao)\s*[:,\s]*(.*)$/i) ||
    (lowerCmd.includes("forgot it") || lowerCmd.includes("forget it") || lowerCmd.includes("forget this") || lowerCmd.includes("forgot this") || lowerCmd.includes("forget that") || lowerCmd.includes("fine now, forget") || lowerCmd.includes("better now, forget") || lowerCmd.includes("headache is gone") || lowerCmd.includes("headache is fine") || lowerCmd.includes("forget the headache") || lowerCmd.includes("forget my headache") || lowerCmd.includes("forget the ugc ad") || lowerCmd.includes("forget about the ugc ad") ? [lowerCmd, ""] : null);

  if (forgetMatch) {
    let topicToForget = (forgetMatch[1] || "").trim();
    if (!topicToForget || topicToForget === "it" || topicToForget === "this" || topicToForget === "that") {
      if (lowerCmd.includes("headache") || lowerCmd.includes("pain") || lowerCmd.includes("brain")) {
        topicToForget = "headache";
      } else if (lowerCmd.includes("ugc") || lowerCmd.includes("ad")) {
        topicToForget = "ugc ad";
      } else {
        topicToForget = "it";
      }
    }

    const { removedItems } = memoryManager.forgetMatching(topicToForget);
    conversationState.forgetTopic(topicToForget);

    const message = topicToForget && topicToForget !== "it" && topicToForget !== "transient"
      ? `Done! I have completely erased and forgotten "${topicToForget}" from my memory bank. I will never bring it up or ask about it again, Bhavik!`
      : `Done! I have completely erased and forgotten that from my memory bank. I will never bring it up or ask about it again, Bhavik!`;

    return {
      action: message,
      isBrowserAction: false,
      deviceAction: {
        type: 'forget_memory',
        param: topicToForget
      }
    };
  }

  // C-2. Persistent Memory Directives ("Remember this...", "Save this...", Section 9)
  const memoryMatch = lowerCmd.match(/^(?:(?:can you\s+|please\s+)?(?:remember this|save this|keep this for next time|keep this in mind|store this|remember that|yaad rakhna|yaad rakho))\s*[:,\s]+(.+)$/i);
  if (memoryMatch) {
    const factToSave = memoryMatch[1].trim();
    memoryManager.addDurableFact("instruction", factToSave);
    return {
      action: `Locked in! I've saved that into my persistent durable memory bank: "${factToSave}". I'll remember this across all our sessions, Bhavik.`,
      isBrowserAction: false,
      deviceAction: {
        type: 'save_memory',
        param: factToSave
      }
    };
  }

  // D. Screen-Aware Open / Close UI Control & Stop Avatar Animation / Overlays (Section 27 & 28)
  const isStopAnimationOrOverlay = 
    lowerCmd.includes("stop any ongoing avatar video animations") ||
    lowerCmd.includes("remove the current visual overlay") ||
    lowerCmd.includes("stop avatar video animation") ||
    lowerCmd.includes("stop avatar video animations") ||
    lowerCmd.includes("stop avatar animation") ||
    lowerCmd.includes("stop avatar animations") ||
    lowerCmd.includes("stop video animation") ||
    lowerCmd.includes("stop video animations") ||
    lowerCmd.includes("stop ongoing avatar") ||
    lowerCmd.includes("stop ongoing video") ||
    lowerCmd.includes("stop dancing") ||
    lowerCmd.includes("stop dance") ||
    lowerCmd.includes("stop meme") ||
    lowerCmd.includes("stop meme video") ||
    lowerCmd.includes("remove visual overlay") ||
    lowerCmd.includes("remove current visual overlay") ||
    lowerCmd.includes("remove overlay") ||
    lowerCmd.includes("dismiss overlay") ||
    lowerCmd.includes("clear overlay") ||
    lowerCmd.includes("hide overlay") ||
    lowerCmd.includes("stop animation") ||
    lowerCmd.includes("stop animations") ||
    lowerCmd.includes("stop singing") ||
    lowerCmd.includes("stop singing song") ||
    lowerCmd.includes("stop song") ||
    lowerCmd.includes("stop music") ||
    lowerCmd === "stop" ||
    lowerCmd === "stop all";

  if (isStopAnimationOrOverlay) {
    return {
      action: "Stopping all ongoing avatar video animations and removing visual overlays from the screen right away, Bhavik.",
      isBrowserAction: false,
      deviceAction: {
        type: 'stop_avatar_animations_and_overlays',
        param: {}
      }
    };
  }

  if (
    lowerCmd === "close it" || 
    lowerCmd === "close that" || 
    lowerCmd === "close this" || 
    lowerCmd === "close window" || 
    lowerCmd === "close panel" ||
    lowerCmd === "dismiss that" ||
    lowerCmd === "hide it"
  ) {
    const active = conversationState.getActivePanel();
    return {
      action: active 
        ? `Closing the ${active.replace(/_/g, ' ')} right now.` 
        : "Closing the active overlay right now.",
      isBrowserAction: false,
      deviceAction: {
        type: 'close_current_panel',
        param: { target: active }
      }
    };
  }

  // Specific panel close commands
  if (lowerCmd.match(/^(?:close|hide|dismiss)\s+(?:the\s+)?(notepad|study\s+board|habits|habit\s+tracker|settings|lead\s+finder|leads|creation\s+studio|whatsapp|soundscapes|local\s+bridge|system\s+bridge|terminal|gmail\s+assistant|inbox\s+assistant|news\s+hub|live\s+news|news\s+center|self\s+improvement|improvement\s+backlog|upgrade\s+advisor|screen\s+audit|website\s+audit|screen\s+report|browser\s+operator|chrome\s+extension|tab\s+manager)$/i)) {
    const target = lowerCmd.replace(/^(?:close|hide|dismiss)\s+(?:the\s+)?/i, "").trim().toLowerCase();
    const panelKey = target.includes("study") ? "study_board" 
      : target.includes("note") ? "notepad" 
      : target.includes("habit") ? "habits"
      : target.includes("setting") ? "settings"
      : target.includes("lead") ? "lead_finder"
      : target.includes("creation") ? "creation_studio"
      : target.includes("whatsapp") ? "whatsapp"
      : target.includes("soundscape") ? "soundscapes"
      : (target.includes("bridge") || target.includes("terminal") || target.includes("browser") || target.includes("chrome") || target.includes("tab manager")) ? "local_bridge"
      : (target.includes("gmail") || target.includes("inbox")) ? "gmail_assistant"
      : target.includes("news") ? "news_hub"
      : (target.includes("improvement") || target.includes("upgrade")) ? "self_improvement"
      : (target.includes("screen") || target.includes("audit")) ? "screen_audit"
      : target;
    return {
      action: `Closing ${target} now.`,
      isBrowserAction: false,
      deviceAction: {
        type: 'close_panel',
        param: { panel: panelKey }
      }
    };
  }

  // Specific panel open commands
  if (lowerCmd.match(/^(?:open|show)\s+(?:the\s+)?(study\s+board|habits|habit\s+tracker|lead\s+finder|leads|creation\s+studio|whatsapp|soundscapes|local\s+bridge|system\s+bridge|terminal|gmail\s+assistant|inbox\s+assistant|news\s+hub|live\s+news|news\s+center|self\s+improvement|improvement\s+backlog|upgrade\s+advisor|screen\s+audit|website\s+audit|screen\s+report|browser\s+operator|chrome\s+extension|tab\s+manager)$/i)) {
    const target = lowerCmd.replace(/^(?:open|show)\s+(?:the\s+)?/i, "").trim().toLowerCase();
    const panelKey = target.includes("study") ? "study_board" 
      : target.includes("habit") ? "habits"
      : target.includes("lead") ? "lead_finder"
      : target.includes("creation") ? "creation_studio"
      : target.includes("whatsapp") ? "whatsapp"
      : target.includes("soundscape") ? "soundscapes"
      : (target.includes("browser") || target.includes("chrome") || target.includes("tab manager")) ? "browser_operator"
      : (target.includes("bridge") || target.includes("terminal")) ? "local_bridge"
      : (target.includes("gmail") || target.includes("inbox")) ? "gmail_assistant"
      : target.includes("news") ? "news_hub"
      : (target.includes("improvement") || target.includes("upgrade")) ? "self_improvement"
      : (target.includes("screen") || target.includes("audit")) ? "screen_audit"
      : target;
    return {
      action: `Opening ${target} for you now.`,
      isBrowserAction: false,
      deviceAction: {
        type: 'open_panel',
        param: { panel: panelKey }
      }
    };
  }

  // Direct CLI command trigger ("run git status", "execute docker ps", "terminal: npm test")
  const cliDirectMatch = lowerCmd.match(/^(?:run\s+command|run\s+cli|run\s+terminal\s+command|execute\s+command|execute|terminal)\s*[:\s]+(.+)$/i);
  if (cliDirectMatch) {
    const cmdToRun = cliDirectMatch[1].trim();
    return {
      action: `Executing "${cmdToRun}" through the Local System Automation Bridge, Bhavik.`,
      isBrowserAction: false,
      deviceAction: {
        type: 'local_cli',
        param: { command: cmdToRun }
      }
    };
  }

  // 1. Switch Camera Command
  const switchCameraMatch = lowerCmd.match(/^(?:switch|change)\s+(?:to\s+)?(?:the\s+)?(front|back|rear)\s+camera$/i) || 
                           lowerCmd.match(/^(?:use|select)\s+(?:the\s+)?(front|back|rear)\s+camera$/i);
  if (switchCameraMatch) {
    const target = switchCameraMatch[1].trim().toLowerCase();
    const facing = (target === 'front') ? 'user' : 'environment';
    const cameraName = target === 'front' ? 'front' : 'rear';
    return {
      action: `Switching to your ${cameraName} camera, Bhavik!`,
      isBrowserAction: false,
      emotion: "happy",
      oliviaStyle: "playful",
      deviceAction: {
        type: 'switch_camera',
        param: facing
      }
    };
  }

  // 2. Flashlight Toggles
  if (lowerCmd.match(/^(?:turn\s+on\s+flashlight|flashlight\s+on|enable\s+flashlight)$/i)) {
    return {
      action: "Shauk se, Bhavik! Turning on your flashlight right now.",
      isBrowserAction: false,
      emotion: "happy",
      oliviaStyle: "playful",
      deviceAction: {
        type: 'flashlight',
        param: true
      }
    };
  }
  if (lowerCmd.match(/^(?:turn\s+off\s+flashlight|flashlight\s+off|disable\s+flashlight)$/i)) {
    return {
      action: "Done, Bhavik! Flashlight is turned off.",
      isBrowserAction: false,
      emotion: "happy",
      oliviaStyle: "playful",
      deviceAction: {
        type: 'flashlight',
        param: false
      }
    };
  }

  // 3. Clipboard Commands
  const copyMatch = lowerCmd.match(/^(?:copy\s+to\s+clipboard|copy)\s+(.+)$/i);
  if (copyMatch) {
    const textToCopy = copyMatch[1].trim();
    return {
      action: `Copied "${textToCopy}" to your clipboard, Bhavik! Ready to paste.`,
      isBrowserAction: false,
      emotion: "happy",
      deviceAction: {
        type: 'clipboard_write',
        param: textToCopy
      }
    };
  }

  if (lowerCmd.match(/^(?:read\s+clipboard|get\s+clipboard|show\s+clipboard|whats\s+on\s+my\s+clipboard)$/i)) {
    return {
      action: "Let me fetch what's on your clipboard right now, Bhavik.",
      isBrowserAction: false,
      emotion: "happy",
      deviceAction: {
        type: 'clipboard_read'
      }
    };
  }

  // 4. Notifications
  const notifyMatch = lowerCmd.match(/^(?:trigger|show|send|push)\s+notification\s+(.+)$/i) ||
                      lowerCmd.match(/^(?:notify|alert)\s+(.+)$/i);
  if (notifyMatch) {
    const bodyText = notifyMatch[1].trim();
    return {
      action: "Sending that notification straight to your screen now, Bhavik!",
      isBrowserAction: false,
      emotion: "happy",
      deviceAction: {
        type: 'notification',
        param: { title: "Nexa AI Assistant", body: bodyText }
      }
    };
  }

  // 4b. Personal Notepad Actions
  if (lowerCmd.match(/^(?:open|show|launch|go\s+to|view)\s+(?:my\s+|nexa's\s+|personal\s+)?notepad$/i) ||
      lowerCmd.match(/^(?:notepad|open\s+notepad\.js\.org|notepad\.js)$/i)) {
    return {
      action: "Absolutely, Bhavik! Opening your personal notepad right now.",
      isBrowserAction: false,
      emotion: "happy",
      deviceAction: {
        type: 'open_notepad'
      }
    };
  }

  // 4b-2. Visual Study Board & Study Box Actions
  if (
    lowerCmd.includes("study board") ||
    lowerCmd.includes("study box") ||
    lowerCmd.includes("visual teacher") ||
    lowerCmd.includes("see the study box") ||
    lowerCmd.includes("start teaching") ||
    lowerCmd.includes("teach me") ||
    lowerCmd.includes("check study box") ||
    lowerCmd.match(/^(?:open|show|launch|view)\s+(?:the\s+|my\s+)?study\s+(?:board|box)$/i)
  ) {
    return {
      action: "Opening your Visual Study Board with Aoi Sensei right now, Bhavik! Let's conquer your exam paper and master the blackboard.",
      isBrowserAction: false,
      emotion: "happy",
      oliviaStyle: "serious",
      deviceAction: {
        type: 'open_study_board'
      }
    };
  }

  // 4c. Open Gmail Assistant (or explicit Gmail web tab)
  if (lowerCmd === "open gmail tab" || lowerCmd === "open mail.google.com") {
    return {
      action: "Opening your Gmail web tab right away, Bhavik!",
      url: "https://mail.google.com/mail/u/0/#inbox",
      isBrowserAction: true,
      emotion: "happy",
    };
  }
  if (lowerCmd.match(/^(?:open|launch|check|go\s+to)\s+(?:my\s+)?(?:gmail|mail|email|google\s+mail|inbox)$/i) || lowerCmd === 'gmail' || lowerCmd === 'open gmail') {
    return {
      action: "Opening NEXA's Official OAuth Gmail AI Assistant for you, Bhavik.",
      isBrowserAction: false,
      emotion: "happy",
      deviceAction: {
        type: 'open_panel',
        param: { panel: 'gmail_assistant' }
      }
    };
  }

  // 4c-2. Personality / Vocal Persona Shift (e.g., "shift to Alexa", "switch to Coco", "shift to Oliviya", "switch to Nexa", "shift personality to...")
  const personalityShiftMatch = lowerCmd.match(/^(?:(?:can\s+(?:we|you)\s+)?(?:shift|switch|change|turn|go)\s*(?:over\s+)?(?:her|nexa|oliviya|olivia|coco|zoya|alexa|the\s+voice|personality|persona|mode)?\s*(?:over\s+)?to\s+(?:the\s+)?([a-z\s-]+))$/i) ||
                                lowerCmd.match(/^(?:shift|switch|change)\s+(?:personality|persona|mode)\s+to\s+([a-z\s-]+)$/i) ||
                                lowerCmd.match(/^(?:talk|speak)\s+(?:to\s+me\s+)?as\s+(?:the\s+)?([a-z\s-]+)$/i) ||
                                lowerCmd.match(/^(?:become|be)\s+(?:the\s+)?([a-z\s-]+)$/i);

  if (personalityShiftMatch) {
    const targetRaw = (personalityShiftMatch[1] || "").toLowerCase().trim();
    let targetMode = "default";
    if (targetRaw.includes("alexa") || targetRaw.includes("nexa") || targetRaw.includes("default") || targetRaw.includes("core")) {
      targetMode = "default";
    } else if (targetRaw.includes("zoya") || targetRaw.includes("nakhrewali")) {
      targetMode = "zoya";
    } else if (targetRaw.includes("oliviya") || targetRaw.includes("olivia") || targetRaw.includes("wife")) {
      targetMode = "oliviya";
    } else if (targetRaw.includes("coco") || targetRaw.includes("c-o-c-o")) {
      targetMode = "coco";
    } else if (targetRaw.includes("sensei") || targetRaw.includes("sensa") || targetRaw.includes("aoi") || targetRaw.includes("teacher")) {
      targetMode = "sensei";
    } else if (targetRaw.includes("elon") || targetRaw.includes("musk")) {
      targetMode = "elon";
    } else if (targetRaw.includes("jobs") || targetRaw.includes("steve")) {
      targetMode = "jobs";
    } else if (targetRaw.includes("altman") || targetRaw.includes("sam")) {
      targetMode = "altman";
    } else if (targetRaw.includes("hormozi") || targetRaw.includes("alex")) {
      targetMode = "hormozi";
    } else if (targetRaw.includes("mrbeast") || targetRaw.includes("beast") || targetRaw.includes("jimmy")) {
      targetMode = "mrbeast";
    } else if (targetRaw.includes("naval")) {
      targetMode = "naval";
    } else if (targetRaw.includes("buffett") || targetRaw.includes("warren")) {
      targetMode = "buffett";
    } else if (targetRaw.includes("goggins") || targetRaw.includes("david")) {
      targetMode = "goggins";
    } else if (targetRaw.includes("communication") || targetRaw.includes("persuasion")) {
      targetMode = "communication";
    } else if (targetRaw.includes("kahneman") || targetRaw.includes("daniel")) {
      targetMode = "kahneman";
    } else if (targetRaw.includes("feynman") || targetRaw.includes("richard")) {
      targetMode = "feynman";
    } else if (targetRaw.includes("tesla") || targetRaw.includes("nikola")) {
      targetMode = "tesla";
    } else if (targetRaw.includes("munger") || targetRaw.includes("charlie")) {
      targetMode = "munger";
    } else if (targetRaw.includes("vinci") || targetRaw.includes("leonardo")) {
      targetMode = "davinci";
    } else if (targetRaw.includes("lincoln") || targetRaw.includes("abraham")) {
      targetMode = "lincoln";
    } else if (targetRaw.includes("aurelius") || targetRaw.includes("marcus")) {
      targetMode = "aurelius";
    } else if (targetRaw.includes("turing") || targetRaw.includes("alan")) {
      targetMode = "turing";
    }

    const reply = targetMode === "default"
      ? `Shifted over to NEXA Core! I'm right here Bhavik, keeping our conversation rolling seamlessly. What are we building next?`
      : targetMode === "oliviya"
      ? `Hehe~! Onii-chan! You called me? *gives a cheeky little smile* Ehehe, I was waiting for you! Don't tell me you missed your Ollie Baby? Hmph! ...Just kidding! 💕`
      : targetMode === "coco"
      ? `Hmm... aa gaye tum? Sach bataun... thodi si wait hi kar rahi thi. Agli achhi khabar sab se pehle mujhe sunana... batao, aaj kya chal raha hai?`
      : targetMode === "zoya"
      ? `Zoya here! Nakhre full power par hain Bhavik, batao kya chal raha hai?`
      : targetMode === "sensei"
      ? `Hai Bhavik-kun! Aoi Sensei is ready at the blackboard. Let's learn and conquer!`
      : `Shifted over to ${targetRaw}! Continuing our conversation seamlessly, Bhavik.`;

    return {
      action: reply,
      isBrowserAction: false,
      emotion: targetMode === "oliviya" || targetMode === "zoya" ? "playful" : targetMode === "coco" ? "intimate" : "happy",
      oliviaStyle: targetMode === "oliviya" ? "playful" : undefined,
      deviceAction: {
        type: 'switch_personality',
        param: targetMode
      }
    };
  }

  // 4d. Voice Change / Voice Settings
  const voiceChangeMatch = lowerCmd.match(/^(?:(?:can\s+(?:we|i)\s+)?(?:change|switch|set)|how\s+to\s+change|i\s+want\s+to\s+change)\s+(?:her\s+|nexa'?s?\s+|the\s+|my\s+)?voice(?:\s+to\s+([a-z]+))?$/i) ||
                           lowerCmd.match(/^(?:change|switch|set)\s+voice\s+to\s+([a-z]+)$/i) ||
                           lowerCmd.match(/^(?:voice\s+settings|change\s+voice|change\s+her\s+voice|change\s+nexa'?s?\s+voice|switch\s+voice|custom\s+voice)$/i) ||
                           (lowerCmd.includes("change") && lowerCmd.includes("voice"));
  if (voiceChangeMatch) {
    const requestedVoice = (voiceChangeMatch[1] || "").toLowerCase();
    const voiceMap: Record<string, string> = {
      aoede: "Aoede",
      kore: "Kore",
      zephyr: "Zephyr",
      autonoe: "Autonoe",
      laomedeia: "Laomedeia",
      puck: "Puck",
      charon: "Charon",
      fenrir: "Fenrir",
      orus: "Orus",
      umbriel: "Umbriel"
    };

    if (requestedVoice && voiceMap[requestedVoice]) {
      const newVoiceName = voiceMap[requestedVoice];
      return {
        action: `Voice updated to ${newVoiceName}, Bhavik! How do I sound now?`,
        isBrowserAction: false,
        emotion: "happy",
        oliviaStyle: "playful",
        deviceAction: {
          type: 'change_voice',
          param: newVoiceName
        }
      };
    } else {
      return {
        action: "Opening Nexa's Voice & Audio Settings for you, Bhavik! Pick whichever voice suits the mood.",
        isBrowserAction: false,
        emotion: "happy",
        deviceAction: {
          type: 'open_settings'
        }
      };
    }
  }

  // 4e. Platform-Specific Search & Video Transcript Routing (STRICT PLATFORM PRIORITY)
  // Check explicit instructions first: "Search on YouTube" vs "Search on Google"

  // 4e-1. Standalone Platform Search Commands
  if (lowerCmd === "search on youtube" || lowerCmd === "youtube search" || lowerCmd === "open youtube search") {
    return {
      action: "Opening YouTube for you, Bhavik!",
      url: "https://www.youtube.com",
      isBrowserAction: true,
      emotion: "happy",
    };
  }

  if (lowerCmd === "search on google" || lowerCmd === "google search" || lowerCmd === "open google") {
    return {
      action: "Opening Google Search for you, Bhavik!",
      url: "https://www.google.com",
      isBrowserAction: true,
      emotion: "happy",
    };
  }

  // 4e-2. Explicit YouTube Search Patterns (Highest Priority for YouTube)
  const isQuestionAboutMedia = /^(?:what|how|why|who|when|where|explain|tell me|is there|which)\b/i.test(lowerCmd) || lowerCmd.endsWith('?');
  const isExplicitYouTubeSearch = !isQuestionAboutMedia && (
    lowerCmd.startsWith("search on youtube") ||
    lowerCmd.startsWith("search youtube") ||
    lowerCmd.startsWith("youtube search") ||
    lowerCmd.startsWith("youtube play") ||
    lowerCmd.startsWith("play on youtube") ||
    lowerCmd.match(/^(?:play|search|find)\s+.+\s+(?:on|in|at)\s+youtube$/i) ||
    lowerCmd.match(/^(?:open|launch|go\s+to)\s+youtube\s+(?:and\s+|to\s+)?(?:search|play|find|look\s+up)/i)
  );

  if (isExplicitYouTubeSearch) {
    let rawQuery = lowerCmd
      .replace(/^(?:open|launch|go\s+to)\s+youtube\s+(?:and\s+|to\s+)?(?:search|play|find|look\s+up|search\s+for)\s*/i, "")
      .replace(/^(?:search|find|look\s+up|play|show|open)\s+(?:on\s+)?youtube\s+(?:for\s+)?/i, "")
      .replace(/^(?:youtube\s+search\s+for|youtube\s+search|youtube\s+play|youtube)\s+/i, "")
      .replace(/^(?:search|find|look\s+up|play|show|open)\s+/i, "")
      .replace(/\s+(?:on|in|at)\s+youtube$/i, "")
      .replace(/^(?:for|about)\s+/i, "")
      .trim();

    if (rawQuery && rawQuery !== "youtube" && rawQuery !== "app") {
      return {
        action: `Searching "${rawQuery}" on YouTube for you, Bhavik!`,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(rawQuery)}`,
        isBrowserAction: true,
        emotion: "happy",
      };
    } else {
      return {
        action: "Opening YouTube for you, Bhavik!",
        url: "https://www.youtube.com",
        isBrowserAction: true,
        emotion: "happy",
      };
    }
  }

  // 4e-3. Explicit Google Search Patterns (Highest Priority for Google)
  const isExplicitGoogleSearch = !isQuestionAboutMedia && (
    lowerCmd.startsWith("search on google") ||
    lowerCmd.startsWith("search google") ||
    lowerCmd.startsWith("google search") ||
    lowerCmd.match(/^(?:search|find|look\s+up)\s+.+\s+(?:on|in|at)\s+google$/i) ||
    lowerCmd.match(/^(?:open|launch|go\s+to)\s+google\s+(?:and\s+|to\s+)?(?:search|find|look\s+up)/i)
  );

  if (isExplicitGoogleSearch) {
    let rawQuery = lowerCmd
      .replace(/^(?:open|launch|go\s+to)\s+google\s+(?:and\s+|to\s+)?(?:search|find|look\s+up|search\s+for)\s*/i, "")
      .replace(/^(?:search|find|look\s+up|show|open)\s+(?:on\s+)?google\s+(?:for\s+)?/i, "")
      .replace(/^(?:google\s+search\s+for|google\s+search|google)\s+/i, "")
      .replace(/^(?:search|find|look\s+up|show|open)\s+/i, "")
      .replace(/\s+(?:on|in|at)\s+google$/i, "")
      .replace(/^(?:for|about)\s+/i, "")
      .trim();

    if (rawQuery && rawQuery !== "google") {
      return {
        action: `Searching "${rawQuery}" on Google, Bhavik. Link is opening!`,
        url: `https://www.google.com/search?q=${encodeURIComponent(rawQuery)}`,
        isBrowserAction: true,
        emotion: "happy",
      };
    } else {
      return {
        action: "Opening Google Search for you, Bhavik. Link is opening!",
        url: "https://www.google.com",
        isBrowserAction: true,
        emotion: "happy",
      };
    }
  }

  // 4e-4. Transcript & Video Content Search (Implicit Video Intent -> Defaults to YouTube)
  // When Bhavik asks to find a transcript (e.g., "find a transcript", "find transcript of podcast"),
  // prioritize YouTube as video transcripts natively reside on YouTube.
  const isTranscriptRequest = 
    lowerCmd.includes("transcript") || 
    lowerCmd.match(/^(?:find|get|search|show|look\s+up)\s+(?:a\s+|the\s+)?transcript/i);

  if (isTranscriptRequest && !lowerCmd.includes("google")) {
    let topicQuery = lowerCmd
      .replace(/^(?:find|get|search\s+for|search|show|look\s+up|open)\s+(?:a\s+|the\s+)?transcript\s+(?:of|for|from|about)?\s*/i, "")
      .replace(/^(?:transcript\s+(?:of|for|from|about)?)\s*/i, "")
      .trim();

    const cleanTopic = topicQuery.replace(/^(?:a|the)\s+/i, "").trim();
    const finalSearch = cleanTopic ? `${cleanTopic} transcript` : "transcript";

    return {
      action: cleanTopic 
        ? `Searching for the transcript of "${cleanTopic}" on YouTube for you, Bhavik.`
        : `Searching for video transcripts on YouTube for you, Bhavik.`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(finalSearch)}`,
      isBrowserAction: true,
      emotion: "happy",
    };
  }

  // 4e-5. Other Media Video/Song search patterns (without explicit "google")
  const ytMediaPatterns = [
    /^play\s+(.+?)\s+(?:on\s+youtube|song|video|music|track)$/i,
    /^search\s+(.+?)\s+(?:song|video|music|track|channel)$/i,
    /^(?:search|find|open)\s+(.+?)\s+(?:channel|video)$/i
  ];

  for (const pattern of ytMediaPatterns) {
    const match = lowerCmd.match(pattern);
    if (match && match[1]) {
      let rawQuery = match[1].trim()
        .replace(/^(?:for|about|search\s+for|play|find)\s+/i, "")
        .replace(/\s*(?:on|in|at)\s+youtube$/i, "")
        .trim();

      if (rawQuery && rawQuery.toLowerCase() !== "youtube") {
        return {
          action: `Searching "${rawQuery}" on YouTube for you, Bhavik!`,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(rawQuery)}`,
          isBrowserAction: true,
          emotion: "happy",
        };
      }
    }
  }

  // 5. Open/Launch Applications (In web browser, open YouTube/WhatsApp/Maps in Chrome; on Android native, use AppLauncher)
  if (lowerCmd === "open youtube" || lowerCmd === "launch youtube") {
    return {
      action: "Opening YouTube for you, Bhavik!",
      url: "https://www.youtube.com/",
      isBrowserAction: true,
      emotion: "happy",
    };
  }

  const nativeAppLaunchMatch = lowerCmd.match(/^(?:open|launch)\s+(whatsapp|camera|settings|gallery|photos|calculator|gmail|chrome|maps|google\s+maps|phone|dialer|messages|sms|files)$/i);
  if (nativeAppLaunchMatch) {
    let appKey = nativeAppLaunchMatch[1].trim().toLowerCase();
    if (appKey === 'google maps') appKey = 'maps';
    if (appKey === 'photos') appKey = 'gallery';
    if (appKey === 'dialer') appKey = 'phone';
    if (appKey === 'sms') appKey = 'messages';
    
    return {
      action: `Launching ${appKey} for you right now, Bhavik.`,
      isBrowserAction: false,
      emotion: "happy",
      deviceAction: {
        type: 'launch_app',
        param: appKey
      }
    };
  }

  // Extra launch alias for "take a photo"
  if (lowerCmd.match(/^(?:take\s+a\s+photo|take\s+photo|snap\s+photo)$/i)) {
    return {
      action: "Opening your camera now, Bhavik! Strike a pose.",
      isBrowserAction: false,
      emotion: "happy",
      deviceAction: {
        type: 'launch_app',
        param: 'camera'
      }
    };
  }

  // 6. Generic Web Search (Google fallback for non-YouTube queries)
  const searchOnGoogleMatch = lowerCmd.match(/^search\s+(.+?)\s+on\s+google$/i);
  if (searchOnGoogleMatch) {
    const query = searchOnGoogleMatch[1].trim();
    return {
      action: `Searching "${query}" on Google, Bhavik. Link is opening!`,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      isBrowserAction: true
    };
  }

  // 7. General Web Search Fallback ("search for [query]")
  if (!lowerCmd.includes("youtube") && !lowerCmd.includes("transcript")) {
    const searchGooglePrefixMatch = lowerCmd.match(/^(?:search\s+(?:this\s+)?on\s+google|search\s+google\s+for|google\s+search|search\s+for|search\s+the\s+web\s+for|google)\s+(.+)/i);
    if (searchGooglePrefixMatch) {
      const query = searchGooglePrefixMatch[1].trim();
      return {
        action: `Searching "${query}" on Google, Bhavik. Link is opening!`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        isBrowserAction: true
      };
    }
  }

  // 8. General Website Browsing
  const openMatch = lowerCmd.match(/^open\s+(.+)$/);
  if (
    openMatch &&
    !lowerCmd.includes("youtube") &&
    !lowerCmd.includes("spotify")
  ) {
    let website = openMatch[1].trim().replace(/\s+/g, "");
    if (!website.includes(".")) {
      website += ".com";
    }
    return {
      action: `Opening ${openMatch[1]} for you, ugh.`,
      url: `https://www.${website}`,
      isBrowserAction: true,
    };
  }

  // 9. Media Search: YouTube
  const ytMatch = lowerCmd.match(/^play\s+(.+?)\s+on\s+youtube$/);
  if (ytMatch) {
    const query = encodeURIComponent(ytMatch[1].trim());
    return {
      action: `Playing ${ytMatch[1]} on YouTube. Don't judge my music taste.`,
      url: `https://www.youtube.com/results?search_query=${query}`,
      isBrowserAction: true,
    };
  }

  // 10. Media Search: Spotify
  const spotifyMatch = lowerCmd.match(/^search\s+(.+?)\s+on\s+spotify$/);
  if (spotifyMatch) {
    const query = encodeURIComponent(spotifyMatch[1].trim());
    return {
      action: `Searching ${spotifyMatch[1]} on Spotify. Hope it's a banger.`,
      url: `https://open.spotify.com/search/${query}`,
      isBrowserAction: true,
    };
  }

  // 11. WhatsApp Logic
  if (lowerCmd.includes("whatsapp") || lowerCmd.includes("message") || lowerCmd.includes("send")) {
    const numberMatch = lowerCmd.match(/(?:(?:this\s+)?(?:number\s+)?(\+?[\d\s-]{8,15}))/i) || lowerCmd.match(/(\+?[\d\s-]{10,15})/);
    let message = "";
    let number = "";

    if (numberMatch) {
      number = numberMatch[1].replace(/[\s-]/g, "");
    }

    const msgRegexes = [
      /saying\s+(.+)$/i,
      /message\s+(.+)$/i,
      /that\s+(.+)$/i,
      /to\s+\+?[\d\s-]+\s+(.+)$/i,
      /:\s*(.+)$/i
    ];

    for (const regex of msgRegexes) {
      const match = lowerCmd.match(regex);
      if (match) {
        message = match[1].trim();
        break;
      }
    }

    if (!message && numberMatch) {
      const index = lowerCmd.indexOf(numberMatch[0]);
      if (index !== -1) {
        const afterNumber = lowerCmd.substring(index + numberMatch[0].length).trim();
        message = afterNumber.replace(/^(?:saying|message|that|to|say)\s+/i, "").trim();
      }
    }

    if (!number) {
      if (lowerCmd.includes("suyog") || lowerCmd.includes("me") || lowerCmd.includes("my number")) {
        number = "7039107938";
      } else if (lowerCmd.includes("nexa group") || lowerCmd.includes("group")) {
        return {
          action: "Opening WhatsApp Web for your Nexa Group, Bhavik!",
          url: "https://web.whatsapp.com/",
          isBrowserAction: true,
          emotion: "happy",
        };
      }
    }

    if (number) {
      const displayTarget = number === "7039107938" ? "Suyog" : number;
      const actionText = `Opening WhatsApp Web to send a message to ${displayTarget}, Bhavik.`;
      return {
        action: actionText,
        url: `https://api.whatsapp.com/send?phone=${number}${message ? `&text=${encodeURIComponent(message)}` : ""}`,
        isBrowserAction: true,
        emotion: "happy",
      };
    }
  }

  // 12. Habit Tracker logic
  const habitMatch = lowerCmd.match(/(?:add|track)\s+habit\s+(.+)/i);
  if (habitMatch) {
    const habitTitle = habitMatch[1].trim();
    return {
      action: `Locked in! New habit '${habitTitle}' has been added to your Habit Tracker, Bhavik.`,
      isBrowserAction: false,
      emotion: "happy",
      deviceAction: {
        type: 'add_habit',
        param: habitTitle
      }
    };
  }

  const completeHabitMatch = lowerCmd.match(/(?:complete|check\s+off|finish|done\s+with)\s+habit\s+(.+)/i);
  if (completeHabitMatch) {
    const habitTitle = completeHabitMatch[1].trim();
    return {
      action: `Nice work, Bhavik! I've marked your habit '${habitTitle}' as completed for today.`,
      isBrowserAction: false,
      emotion: "happy",
      oliviaStyle: "excited",
      deviceAction: {
        type: 'update_habit',
        param: { habitTitle, completed: true }
      }
    };
  }

  // 14. Flying Kiss & Affection Overlay Commands (STRICTLY ISOLATED TO OLIVIYA)
  const rawLower = command.toLowerCase().trim();
  const isKissDismiss = 
    rawLower.includes("stop kiss") || 
    rawLower.includes("turn off kiss") || 
    rawLower.includes("hide kiss") || 
    rawLower.includes("close kiss") || 
    rawLower.includes("dismiss kiss") || 
    rawLower.includes("remove kiss") || 
    rawLower.includes("disable kiss") ||
    rawLower.includes("stop flying kiss") ||
    rawLower.includes("turn off flying kiss") ||
    lowerCmd.includes("stop kiss") || 
    lowerCmd.includes("turn off kiss") || 
    lowerCmd.includes("hide kiss") || 
    lowerCmd.includes("close kiss") || 
    lowerCmd.includes("dismiss kiss");

  const isKissTrigger = 
    !isKissDismiss && (
      rawLower.includes("kiss") ||
      rawLower.includes("give me a kiss") || 
      rawLower.includes("give me kiss") || 
      rawLower.includes("give kiss") || 
      rawLower.includes("kiss me") || 
      rawLower.includes("flying kiss") || 
      rawLower.includes("give me a flying kiss") || 
      rawLower.includes("give a flying kiss") || 
      rawLower.includes("ek kiss do") || 
      rawLower.includes("ek flying kiss") || 
      rawLower.includes("muah") || 
      rawLower.includes("mwah") || 
      rawLower.includes("toggle kiss") || 
      rawLower.includes("toggle flying kiss") || 
      rawLower.includes("kiss overlay") || 
      rawLower.includes("show kiss") ||
      lowerCmd.includes("kiss") ||
      lowerCmd.includes("give me a kiss") || 
      lowerCmd.includes("give me kiss") || 
      lowerCmd.includes("give kiss") || 
      lowerCmd.includes("kiss me") || 
      lowerCmd.includes("flying kiss") || 
      lowerCmd.includes("give me a flying kiss") || 
      lowerCmd.includes("toggle kiss")
    );

  if (isKissDismiss) {
    return {
      action: "Flying kiss overlay dismissed, Bhavik.",
      isBrowserAction: false,
      emotion: "neutral",
      deviceAction: {
        type: 'toggle_kiss',
        param: { active: false, action: 'off' }
      }
    };
  }

  if (isKissTrigger) {
    // STRICT ROMANCE ISOLATION: Romantic kiss animations belong exclusively to Oliviya mode
    if (personalityMode !== "oliviya") {
      return {
        action: "Oye hero, romantic flying kisses toh sirf Oliviya mode ke liye reserved hain! Switch to Oliviya if you want romance — main tumhara focus partner hoon.",
        isBrowserAction: false,
        emotion: "playful",
      };
    }

    const isExplicitToggle = rawLower.includes("toggle") || lowerCmd.includes("toggle");

    let animationType: 'heart_burst' | 'floating_lips' | 'love_letter_swarm' | undefined = undefined;
    if (
      rawLower.includes("heart burst") || 
      rawLower.includes("heart kiss") || 
      rawLower.includes("small heart") || 
      rawLower.includes("hearts") ||
      rawLower.includes("dil wala kiss")
    ) {
      animationType = "heart_burst";
    } else if (
      rawLower.includes("letter") || 
      rawLower.includes("letters") || 
      rawLower.includes("love letter") || 
      rawLower.includes("swarm") || 
      rawLower.includes("envelope") ||
      rawLower.includes("khat")
    ) {
      animationType = "love_letter_swarm";
    } else if (
      rawLower.includes("lip") || 
      rawLower.includes("lips") || 
      rawLower.includes("floating lips")
    ) {
      animationType = "floating_lips";
    }

    let responseAction = "Mwah! 💋 Bas ek hi flying kiss mil rahi hai abhi, ab focus wapas lao!";
    if (animationType === "heart_burst") {
      responseAction = "Mwah! 💖 Ek single heart burst kiss meri taraf se — ab chalo wapas focus par!";
    } else if (animationType === "love_letter_swarm") {
      responseAction = "Mwah! 💌 Yeh lo ek sweet love-letter kiss, Bhavik!";
    } else if (animationType === "floating_lips") {
      responseAction = "Mwah! 💋 Floating kiss delivered — ab zyada bhaav mat khao!";
    }

    return {
      action: responseAction,
      isBrowserAction: false,
      emotion: "intimate",
      oliviaStyle: "romantic",
      deviceAction: {
        type: 'toggle_kiss',
        param: { active: isExplicitToggle ? 'toggle' : true, action: isExplicitToggle ? 'toggle' : 'on', animationType }
      }
    };
  }

  // 14B. Explicit Shy Video Trigger ("shy video", "play shy", "show shy", "make her shy")
  // Note: Conversational compliments like "you are so cute" should flow to the AI model so Olivia reacts dynamically!
  const isShyCommand =
    rawLower.includes("make her shy") ||
    rawLower.includes("make you shy") ||
    rawLower.includes("shy video") ||
    rawLower.includes("play shy") ||
    rawLower.includes("show shy");

  if (isShyCommand) {
    return {
      action: "Hehe~! Really?! *blushes and looks away* You're making me shy nowww! 💗",
      isBrowserAction: false,
      emotion: "shy",
      oliviaStyle: "shy",
      deviceAction: {
        type: 'trigger_shy',
        param: { duration: 8000 }
      }
    };
  }

  // 15. Singing & Musical Performance Commands (Strict Single-Voice Singer Mode)
  if (
    lowerCmd.includes("sing happy birthday") || 
    lowerCmd.includes("play happy birthday") || 
    lowerCmd.includes("sing birthday song") ||
    lowerCmd.includes("play birthday music") || 
    lowerCmd.includes("birthday tune") || 
    lowerCmd.includes("birthday song")
  ) {
    return {
      action: "♪ Happy birthday to you... happy birthday to you... Happy birthday dear Bhavik... happy birthday to you! May all your dreams come true, joy and brilliance all year through! 🎂✨ ♫",
      isBrowserAction: false,
      deviceAction: {
        type: 'sing_song',
        param: {
          songTitle: "Happy Birthday Bhavik",
          genre: "birthday",
          lyrics: "Happy birthday to you, happy birthday to you, happy birthday dear Bhavik, happy birthday to you! May all your dreams come true!"
        }
      }
    };
  }

  if (
    lowerCmd.includes("sing tum hi ho") || 
    lowerCmd === "sing bollywood" || 
    lowerCmd === "sing bollywood song"
  ) {
    return {
      action: "♪ Hum tere bin ab reh nahi sakte... tere bina kya wajood mera... ♫ Tujh se juda gar ho jaayenge... toh khud se hi ho jaayenge judaa... ♪ Kyunki tum hi ho... ab tum hi ho... zindagi ab tum hi ho... Chain bhi... mera dard bhi... meri aashiqui ab tum hi ho! ♫",
      isBrowserAction: false,
      deviceAction: {
        type: 'sing_song',
        param: {
          songTitle: "Tum Hi Ho (Soulful Melody)",
          genre: "bollywood",
          lyrics: "Hum tere bin ab reh nahi sakte, tere bina kya wajood mera. Tujh se juda gar ho jaayenge, toh khud se hi ho jaayenge judaa. Kyunki tum hi ho, ab tum hi ho, zindagi ab tum hi ho! Chain bhi, mera dard bhi, meri aashiqui ab tum hi ho!"
        }
      }
    };
  }

  if (
    lowerCmd.includes("sing a lullaby") || 
    lowerCmd.includes("sing lullaby") || 
    lowerCmd.includes("sing me to sleep") || 
    lowerCmd.includes("sleep song")
  ) {
    return {
      action: "♫ Twinkle, twinkle, little star... how I wonder what you are... Up above the world so high, like a diamond in the sky... Rest your mind, Bhavik, drift into peaceful dreams tonight... ♫ 🌙",
      isBrowserAction: false,
      deviceAction: {
        type: 'sing_song',
        param: {
          songTitle: "Soothing Night Lullaby",
          genre: "lullaby",
          lyrics: "Twinkle, twinkle, little star, how I wonder what you are. Up above the world so high, like a diamond in the sky. Rest your mind, Bhavik, drift into peaceful dreams tonight."
        }
      }
    };
  }

  // YouTube / Google Music Full Song Transcription and Direct Singing
  const isQuestionAboutSong = /^(?:what|how|why|who|explain|tell me|where)\b/i.test(lowerCmd) || lowerCmd.endsWith('?');
  const isSingingCommand = 
    !isQuestionAboutSong && (
      lowerCmd.startsWith("transcribe and sing") ||
      (lowerCmd.startsWith("sing ") && lowerCmd.length > 5) ||
      lowerCmd === "sing a song" ||
      lowerCmd.startsWith("sing a song") ||
      lowerCmd.startsWith("sing me a song") ||
      lowerCmd === "sing something" ||
      lowerCmd === "sing" ||
      lowerCmd === "start singing" ||
      lowerCmd.startsWith("sing for me")
    );

  if (isSingingCommand) {
    // Extract song target query
    let songTarget = command;
    return {
      action: "♪ Transcribing and striking harmonized chords... ♫",
      isBrowserAction: false,
      deviceAction: {
        type: 'transcribe_and_sing',
        param: {
          query: songTarget
        }
      }
    };
  }

  // 12B. Avatar Video Manager (Upload or manage newly created videos)
  if (
    lowerCmd.includes("avatar video") ||
    lowerCmd.includes("avatar videos") ||
    lowerCmd.includes("upload video") ||
    lowerCmd.includes("upload videos") ||
    lowerCmd.includes("upload new video") ||
    lowerCmd.includes("upload new videos") ||
    lowerCmd.includes("manage video") ||
    lowerCmd.includes("manage videos") ||
    lowerCmd.includes("manage avatar videos")
  ) {
    return {
      action: "Opening your Avatar Video Manager, Bhavik. You can upload or manage custom clips from here.",
      isBrowserAction: false,
      emotion: "happy",
      deviceAction: {
        type: 'open_panel',
        param: 'video_manager'
      }
    };
  }

  // 13. Timer Logic (Requires explicit imperative intent: set timer, start timer, or timer for X)
  const isExplicitTimerCommand = 
    /^(?:set\s+(?:a\s+)?|start\s+(?:a\s+)?|create\s+(?:a\s+)?|put\s+(?:a\s+)?)?timer\s+(?:of|for|to)\s+(.+)/i.test(lowerCmd) ||
    /^(?:set\s+(?:a\s+)?|start\s+(?:a\s+)?|create\s+(?:a\s+)?|put\s+(?:a\s+)?)timer\s+(.+)/i.test(lowerCmd) ||
    /^(?:set\s+(?:a\s+)?|start\s+(?:a\s+)?)timer$/i.test(lowerCmd) ||
    /^timer\s+\d+/i.test(lowerCmd);

  const isQuestionAboutTimer = /^(?:what|how|why|who|explain|tell me)\b/i.test(lowerCmd) || lowerCmd.endsWith('?');

  if (isExplicitTimerCommand && !isQuestionAboutTimer) {
    let timerCmdText = lowerCmd;
    if (timerCmdText.startsWith("nexa")) {
      timerCmdText = timerCmdText.substring(4).trim();
    }
    if (timerCmdText.startsWith("hey nexa")) {
      timerCmdText = timerCmdText.substring(8).trim();
    }

    const timerMatch = timerCmdText.match(/(?:set\s+(?:a\s+)?)?timer\s+(?:of|for|to)?\s*(.+)/i) ||
                       timerCmdText.match(/(?:set\s+(?:a\s+)?)?(?:for\s+)?(.+?)\s+timer/i);

    if (timerMatch) {
      const durationText = timerMatch[1].trim();
      const durationSeconds = parseDuration(durationText);
      if (durationSeconds !== null && durationSeconds > 0) {
        let displayDuration = durationText;
        if (/^\d+$/.test(durationText)) {
          displayDuration = `${durationText} minutes`;
        }
        let actionResponse = `Got it, Bhavik! Setting a timer for ${displayDuration} right now. I'll notify you as soon as time is up.`;
        if (durationSeconds === 3600 || durationSeconds === 600 || durationSeconds === 1200) {
          actionResponse = `Timer set for ${displayDuration}, Bhavik.`;
        }
        return {
          action: actionResponse,
          isBrowserAction: false,
          emotion: "happy",
          deviceAction: {
            type: 'set_timer',
            param: {
              duration: durationSeconds,
              label: displayDuration
            }
          }
        };
      }
    }
  }

  return { action: "", isBrowserAction: false };
}

function parseDuration(text: string): number | null {
  const clean = text.toLowerCase().trim();
  
  if (clean.includes("half an hour") || clean.includes("half hour")) {
    return 1800; // 30 mins
  }
  if (clean.includes("an hour") || clean.includes("one hour")) {
    return 3600; // 1 hour
  }
  if (clean.includes("two hours") || clean.includes("2 hours")) {
    return 7200; // 2 hours
  }
  if (clean.includes("three hours") || clean.includes("3 hours")) {
    return 10800; // 3 hours
  }
  
  let totalSeconds = 0;
  let matched = false;

  const wordsToNumbers: { [key: string]: number } = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30,
    forty: 40, fifty: 50, sixty: 60
  };

  let normalizedText = clean;
  Object.keys(wordsToNumbers).forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    normalizedText = normalizedText.replace(regex, wordsToNumbers[word].toString());
  });

  const hourRegex = /(\d+(?:\.\d+)?)\s*(?:hour|hr|hrs|hours)/g;
  const minuteRegex = /(\d+(?:\.\d+)?)\s*(?:minute|min|mins|minutes)/g;
  const secondRegex = /(\d+(?:\.\d+)?)\s*(?:second|sec|secs|seconds)/g;

  let match;
  while ((match = hourRegex.exec(normalizedText)) !== null) {
    totalSeconds += parseFloat(match[1]) * 3600;
    matched = true;
  }
  while ((match = minuteRegex.exec(normalizedText)) !== null) {
    totalSeconds += parseFloat(match[1]) * 60;
    matched = true;
  }
  while ((match = secondRegex.exec(normalizedText)) !== null) {
    totalSeconds += parseFloat(match[1]);
    matched = true;
  }

  if (!matched) {
    const plainNumberRegex = /(\d+)/;
    const plainMatch = normalizedText.match(plainNumberRegex);
    if (plainMatch) {
      return parseInt(plainMatch[1], 10) * 60; // default to minutes
    }
  }

  return matched ? totalSeconds : null;
}
