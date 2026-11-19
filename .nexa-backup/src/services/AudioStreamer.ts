/**
 * AudioStreamer.ts
 * High-performance Web Audio API streaming player specifically engineered
 * for real-time 24kHz PCM audio playback with MAX VOLUME optimization
 * for public speaker playback and instant interruption handling.
 */

export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private nextPlayTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private isPlayingAudio: boolean = false;
  private sampleRate: number = 24000;
  private maxVolumeBoost: number = 1.45; // Balanced volume for clear speaker playback without echo blowout
  private playbackEndTimer: any = null;

  constructor(sampleRate: number = 24000) {
    this.sampleRate = sampleRate;
  }

  public isPlaying(): boolean {
    return this.isPlayingAudio;
  }

  private initContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === "closed") {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtxClass({ sampleRate: this.sampleRate });

      // Clean Audio Output Chain:
      // Source -> GainNode -> DynamicsCompressor (Clarity & Anti-Clipping) -> Analyser -> Destination
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.setValueAtTime(this.maxVolumeBoost, this.audioContext.currentTime);

      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-6, this.audioContext.currentTime);
      this.compressor.knee.setValueAtTime(10, this.audioContext.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.audioContext.currentTime);
      this.compressor.attack.setValueAtTime(0.002, this.audioContext.currentTime);
      this.compressor.release.setValueAtTime(0.15, this.audioContext.currentTime);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      this.gainNode.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      this.nextPlayTime = this.audioContext.currentTime;
    }

    if (this.audioContext.state === "suspended") {
      try {
        this.audioContext.resume()?.catch?.(() => {});
      } catch {
        // ignore resume errors
      }
    }

    return this.audioContext;
  }

  /**
   * Schedules a 24kHz PCM16 audio chunk for playback seamlessly
   * @param base64Pcm Base64-encoded PCM16 audio (24kHz mono)
   */
  public addPCM16Chunk(base64Pcm: string): void {
    try {
      if (this.playbackEndTimer) {
        clearTimeout(this.playbackEndTimer);
        this.playbackEndTimer = null;
      }

      const ctx = this.initContext();
      const binaryString = atob(base64Pcm);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const audioBuffer = ctx.createBuffer(1, pcm16.length, this.sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      // Convert Int16 to Float32 with soft saturation protection
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      if (this.gainNode) {
        source.connect(this.gainNode);
      } else {
        source.connect(ctx.destination);
      }

      const currentTime = ctx.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }

      source.start(this.nextPlayTime);
      this.isPlayingAudio = true;
      this.activeSources.push(source);

      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }
        if (this.activeSources.length === 0) {
          if (this.playbackEndTimer) clearTimeout(this.playbackEndTimer);
          this.playbackEndTimer = setTimeout(() => {
            if (this.activeSources.length === 0) {
              this.isPlayingAudio = false;
            }
          }, 250);
        }
      };

      this.nextPlayTime += audioBuffer.duration;
    } catch (err) {
      console.error("[AudioStreamer] Error playing PCM chunk:", err);
    }
  }

  /**
   * Instantly stops playback and clears all scheduled buffers (for handling interruptions)
   */
  public stop(): void {
    if (this.playbackEndTimer) {
      clearTimeout(this.playbackEndTimer);
      this.playbackEndTimer = null;
    }

    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch (_) {}
    }
    this.activeSources = [];
    this.isPlayingAudio = false;

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.nextPlayTime = this.audioContext.currentTime;
    }
  }

  /**
   * Closes the entire audio context and releases hardware resources
   */
  public destroy(): void {
    this.stop();
    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        this.audioContext.close();
      } catch (_) {}
      this.audioContext = null;
    }
  }

  /**
   * Returns current speaker audio energy (0 to 1) for UI waveforms and glow animations
   */
  public getEnergy(): number {
    if (!this.analyser || !this.isPlayingAudio) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    return Math.min(1, avg / 128);
  }

  /**
   * Returns raw frequency spectrum array for detailed visualizers
   */
  public getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  public setVolumeBoost(multiplier: number): void {
    this.maxVolumeBoost = Math.max(1, Math.min(4, multiplier));
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(this.maxVolumeBoost, this.audioContext.currentTime);
    }
  }
}
