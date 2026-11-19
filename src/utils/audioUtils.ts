// Global registry to stop playing audio instantly if needed
if (typeof window !== "undefined") {
  (window as any)._activeAudioSources = (window as any)._activeAudioSources || [];
}

// Global Volume Multiplier for all NEXA Elite Minds: 1.5 (+50% increase)
export const GLOBAL_VOLUME_MULTIPLIER = 1.5;

export function triggerHapticFeedback(intensity?: number): void {
  try {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      let ms = intensity;
      if (ms === undefined) {
        const stored = parseFloat(localStorage.getItem("nexa_touch_feedback") || "25");
        ms = !isNaN(stored) ? stored : 25;
      }
      if (ms > 0) {
        navigator.vibrate(ms);
      }
    }
  } catch (e) {
    // Silently ignore on unsupported platforms
  }
}

export function stopAllPCM(): void {
  try {
    stopSingingAccompaniment();
    if (typeof window !== "undefined" && (window as any)._activeAudioSources) {
      const sources = (window as any)._activeAudioSources;
      while (sources.length > 0) {
        const source = sources.pop();
        if (source) {
          try { source.stop(); } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.error("Error stopping PCM audio:", err);
  }
}

export function decodeBase64AudioToAudioBuffer(
  audioCtx: AudioContext,
  base64Data: string
): AudioBuffer {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  let sampleRate = 24000;
  let pcmStart = 0;
  let pcmLength = len;

  // Detect RIFF/WAVE header returned by unary Gemini 3.8 TTS models
  const isRiffWav =
    len >= 44 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45;

  if (isRiffWav) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 12;
    while (offset + 8 <= len) {
      const chunkId =
        String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
      const chunkSize = view.getUint32(offset + 4, true);
      if (chunkId === "fmt " && offset + 24 <= len) {
        sampleRate = view.getUint32(offset + 12, true) || 24000;
      } else if (chunkId === "data") {
        pcmStart = offset + 8;
        pcmLength = Math.min(chunkSize, len - pcmStart);
        break;
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    if (pcmStart === 0) {
      pcmStart = 44;
      pcmLength = len - 44;
    }
  }

  const alignedSamples = Math.floor(pcmLength / 2);
  const alignedBytes = bytes.slice(pcmStart, pcmStart + alignedSamples * 2);
  const pcm16 = new Int16Array(alignedBytes.buffer);
  const audioBuffer = audioCtx.createBuffer(1, pcm16.length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < pcm16.length; i++) {
    channelData[i] = pcm16[i] / 32768.0;
  }
  return audioBuffer;
}

export async function playPCM(
  base64Data: string, 
  volumeMultiplier: number = GLOBAL_VOLUME_MULTIPLIER,
  pitch: number = 1.0,
  playbackSpeed?: number
): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("AudioContext not supported");
      return;
    }
    const audioCtx = new AudioContextClass({ sampleRate: 24000 });
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    const audioBuffer = decodeBase64AudioToAudioBuffer(audioCtx, base64Data);
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    
    // Determine effective speed from argument or persisted state
    let speed = playbackSpeed;
    if (speed === undefined && typeof window !== "undefined") {
      const savedSpeed = parseFloat(localStorage.getItem("nexa_voice_speed") || "1.0");
      speed = !isNaN(savedSpeed) ? savedSpeed : 1.0;
    }
    const effectiveRate = (pitch || 1.0) * (speed || 1.0);
    source.playbackRate.value = Math.max(0.5, Math.min(3.0, effectiveRate));
    
    // Global volume boost gain node with persisted preference fallback
    const gainNode = audioCtx.createGain();
    let targetGain = volumeMultiplier;
    if (volumeMultiplier === GLOBAL_VOLUME_MULTIPLIER && typeof window !== "undefined") {
      const savedVol = parseFloat(localStorage.getItem("nexa_voice_volume") || "1.5");
      if (!isNaN(savedVol)) targetGain = savedVol;
    }
    gainNode.gain.setValueAtTime(targetGain, audioCtx.currentTime);

    // Dynamics Compressor to protect speech clarity and prevent clipping/distortion at +50% volume
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-12, audioCtx.currentTime);
    compressor.knee.setValueAtTime(10, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

    source.connect(gainNode);
    gainNode.connect(compressor);
    compressor.connect(audioCtx.destination);
    
    // Register the source for global cancellation
    if (typeof window !== "undefined") {
      (window as any)._activeAudioSources.push(source);
    }
    
    source.start();
    
    return new Promise<void>(resolve => {
      source.onended = () => {
        if (typeof window !== "undefined") {
          const idx = (window as any)._activeAudioSources.indexOf(source);
          if (idx > -1) {
            (window as any)._activeAudioSources.splice(idx, 1);
          }
        }
        resolve();
      };
    });
  } catch (error) {
    console.error("Error playing audio:", error);
  }
}

export async function playBirthdayMelody(): Promise<void> {
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return;
    const audioCtx = new AudioCtxClass();
    const now = audioCtx.currentTime;
    
    const tempo = 135; // BPM
    const beatDuration = 60 / tempo; // duration per beat
    
    const melody = [
      { note: 'C4', freq: 261.63, duration: 0.75, delay: 0 },
      { note: 'C4', freq: 261.63, duration: 0.25, delay: 0.75 },
      { note: 'D4', freq: 293.66, duration: 1, delay: 1 },
      { note: 'C4', freq: 261.63, duration: 1, delay: 2 },
      { note: 'F4', freq: 349.23, duration: 1, delay: 3 },
      { note: 'E4', freq: 329.63, duration: 2, delay: 4 },
      
      { note: 'C4', freq: 261.63, duration: 0.75, delay: 6.5 },
      { note: 'C4', freq: 261.63, duration: 0.25, delay: 7.25 },
      { note: 'D4', freq: 293.66, duration: 1, delay: 7.5 },
      { note: 'C4', freq: 261.63, duration: 1, delay: 8.5 },
      { note: 'G4', freq: 392.00, duration: 1, delay: 9.5 },
      { note: 'F4', freq: 349.23, duration: 2, delay: 10.5 },
      
      { note: 'C4', freq: 261.63, duration: 0.75, delay: 13 },
      { note: 'C4', freq: 261.63, duration: 0.25, delay: 13.75 },
      { note: 'C5', freq: 523.25, duration: 1, delay: 14 },
      { note: 'A4', freq: 440.00, duration: 1, delay: 15 },
      { note: 'F4', freq: 349.23, duration: 1, delay: 16 },
      { note: 'E4', freq: 329.63, duration: 1, delay: 17 },
      { note: 'D4', freq: 293.66, duration: 2, delay: 18 },
      
      { note: 'Bb4', freq: 466.16, duration: 0.75, delay: 20.5 },
      { note: 'Bb4', freq: 466.16, duration: 0.25, delay: 21.25 },
      { note: 'A4', freq: 440.00, duration: 1, delay: 21.5 },
      { note: 'F4', freq: 349.23, duration: 1, delay: 22.5 },
      { note: 'G4', freq: 392.00, duration: 1, delay: 23.5 },
      { note: 'F4', freq: 349.23, duration: 2, delay: 24.5 }
    ];
    
    melody.forEach((item) => {
      const startTime = now + item.delay * beatDuration;
      const duration = item.duration * beatDuration;
      
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'triangle'; // Sweet chime/music-box tone
      osc.frequency.setValueAtTime(item.freq, startTime);
      
      // Warm, beautiful vibrato (pitch variation)
      const lfo = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();
      lfo.frequency.value = 6.0; // vibrato frequency
      lfoGain.gain.value = item.freq * 0.01; // subtle pitch drift
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      
      // Decaying volume envelope
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.02); // rapid attack
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // smooth decay
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      lfo.start(startTime);
      osc.start(startTime);
      
      lfo.stop(startTime + duration);
      osc.stop(startTime + duration);
    });
  } catch (err) {
    console.error("Birthday melody synthesis failed:", err);
  }
}

// ----------------------------------------------------
// REAL-TIME SINGING MUSICAL ACCOMPANIMENT SYNTHESIZER
// ----------------------------------------------------
let activeAccompanimentCtx: AudioContext | null = null;
let activeAccompanimentStopFns: (() => void)[] = [];
let isAccompanimentActive = false;

export function isSingingAccompanimentPlaying(): boolean {
  return isAccompanimentActive;
}

export function stopSingingAccompaniment(): void {
  try {
    isAccompanimentActive = false;
    activeAccompanimentStopFns.forEach((fn) => {
      try { fn(); } catch (_) {}
    });
    activeAccompanimentStopFns = [];
    if (activeAccompanimentCtx && activeAccompanimentCtx.state !== "closed") {
      try {
        activeAccompanimentCtx.close();
      } catch (_) {}
      activeAccompanimentCtx = null;
    }
  } catch (err) {
    console.error("Error stopping singing accompaniment:", err);
  }
}

export async function playSingingAccompaniment(
  genre: string = "pop",
  durationSec: number = 30
): Promise<void> {
  try {
    stopSingingAccompaniment();

    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return;

    const audioCtx = new AudioCtxClass();
    activeAccompanimentCtx = audioCtx;
    isAccompanimentActive = true;

    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 1.2); // Smooth fade in

    // Low-pass filter for acoustic warmth, keeping high-frequency room for vocals
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2800, audioCtx.currentTime);
    filter.Q.setValueAtTime(1.2, audioCtx.currentTime);

    masterGain.connect(filter);
    filter.connect(audioCtx.destination);

    activeAccompanimentStopFns.push(() => {
      try {
        const now = audioCtx.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.linearRampToValueAtTime(0.001, now + 0.4);
      } catch (_) {}
    });

    const genreLower = genre.toLowerCase();

    // Define harmonic progressions based on genre
    interface ChordNote {
      freq: number;
      type: OscillatorType;
    }

    let bpm = 100;
    let chordProgression: number[][] = []; // frequencies in Hz
    let arpeggioPattern: number[] = []; // relative scale degrees

    if (genreLower.includes("birthday")) {
      bpm = 115;
      chordProgression = [
        [261.63, 329.63, 392.00], // C Maj
        [196.00, 246.94, 293.66], // G Maj
        [196.00, 246.94, 293.66, 349.23], // G7
        [261.63, 329.63, 392.00], // C Maj
        [174.61, 220.00, 261.63, 349.23], // F Maj
        [261.63, 329.63, 392.00], // C Maj
        [196.00, 246.94, 293.66], // G Maj
        [261.63, 329.63, 392.00, 523.25], // C Maj
      ];
    } else if (genreLower.includes("bollywood") || genreLower.includes("hindi") || genreLower.includes("romantic")) {
      bpm = 88;
      // Soulful, emotional modal progression (C#m - A - B - G#m)
      chordProgression = [
        [138.59, 277.18, 329.63, 415.30], // C#m (Sa - Ga - Pa)
        [110.00, 220.00, 277.18, 329.63], // A Maj (Dha - Sa - Ga)
        [123.47, 246.94, 293.66, 369.99], // B Maj (Ni - Re - Ma)
        [103.83, 207.65, 246.94, 311.13], // G#m (Komal Dha / Pa)
      ];
    } else if (genreLower.includes("lullaby")) {
      bpm = 70;
      // Gentle night arpeggio (C - Em - F - C)
      chordProgression = [
        [261.63, 329.63, 392.00, 523.25], // C Maj
        [164.81, 329.63, 392.00, 493.88], // Em
        [174.61, 261.63, 349.23, 440.00], // F Maj
        [196.00, 246.94, 293.66, 392.00], // G Maj
      ];
    } else if (genreLower.includes("acoustic") || genreLower.includes("lofi")) {
      bpm = 84;
      // Dreamy Am - Fmaj7 - C - G
      chordProgression = [
        [110.00, 220.00, 261.63, 329.63], // Am
        [87.31, 174.61, 261.63, 329.63],  // Fmaj7
        [130.81, 261.63, 329.63, 392.00], // C Maj
        [98.00, 196.00, 246.94, 293.66],  // G Maj
      ];
    } else {
      // Catchy uplifting pop chord progression (C - G - Am - F)
      bpm = 108;
      chordProgression = [
        [130.81, 261.63, 329.63, 392.00], // C Maj
        [98.00, 196.00, 246.94, 293.66],  // G Maj
        [110.00, 220.00, 261.63, 329.63], // Am
        [87.31, 174.61, 261.63, 349.23],  // F Maj
      ];
    }

    const secondsPerBeat = 60 / bpm;
    const beatsPerChord = 4;
    const chordDuration = secondsPerBeat * beatsPerChord;

    const totalLoops = Math.ceil(durationSec / (chordProgression.length * chordDuration));
    let chordIndex = 0;

    for (let loop = 0; loop < totalLoops; loop++) {
      for (let i = 0; i < chordProgression.length; i++) {
        const chordStartTime = audioCtx.currentTime + chordIndex * chordDuration;
        const notes = chordProgression[i];

        // 1. Warm sustained chord pad (warm triangle waves with gentle chorus vibrato)
        notes.forEach((freq, noteIdx) => {
          const padOsc = audioCtx.createOscillator();
          const padGain = audioCtx.createGain();

          padOsc.type = noteIdx === 0 ? "sine" : "triangle";
          padOsc.frequency.setValueAtTime(freq, chordStartTime);

          // Subtle natural chorus / detune
          if (noteIdx > 0) {
            padOsc.detune.setValueAtTime((noteIdx % 2 === 0 ? 5 : -5), chordStartTime);
          }

          // Chord envelope
          padGain.gain.setValueAtTime(0, chordStartTime);
          padGain.gain.linearRampToValueAtTime(0.06 / notes.length, chordStartTime + 0.3);
          padGain.gain.setValueAtTime(0.06 / notes.length, chordStartTime + chordDuration - 0.2);
          padGain.gain.linearRampToValueAtTime(0.001, chordStartTime + chordDuration);

          padOsc.connect(padGain);
          padGain.connect(masterGain);

          padOsc.start(chordStartTime);
          padOsc.stop(chordStartTime + chordDuration);
        });

        // 2. Sparkle arpeggios (delicate bell/chime plucks playing through the chord)
        const arpeggioSteps = 4;
        const stepTime = chordDuration / arpeggioSteps;

        for (let s = 0; s < arpeggioSteps; s++) {
          const noteTime = chordStartTime + s * stepTime;
          const arpNoteFreq = notes[(s + 1) % notes.length] * 2; // one octave up

          const arpOsc = audioCtx.createOscillator();
          const arpGain = audioCtx.createGain();

          arpOsc.type = "sine";
          arpOsc.frequency.setValueAtTime(arpNoteFreq, noteTime);

          // Pluck envelope
          arpGain.gain.setValueAtTime(0, noteTime);
          arpGain.gain.linearRampToValueAtTime(0.04, noteTime + 0.02);
          arpGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + stepTime * 1.5);

          arpOsc.connect(arpGain);
          arpGain.connect(masterGain);

          arpOsc.start(noteTime);
          arpOsc.stop(noteTime + stepTime * 1.5);
        }

        chordIndex++;
      }
    }

    // Schedule auto stop after duration
    setTimeout(() => {
      stopSingingAccompaniment();
    }, durationSec * 1000);

  } catch (err) {
    console.error("Error playing singing accompaniment:", err);
  }
}

