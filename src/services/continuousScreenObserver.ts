import { ScreenObservationFrame, ScreenWebsiteAnalysisReport } from "../types";

const MAX_OBSERVATION_FRAMES = 24;

class ContinuousScreenObserver {
  private frames: ScreenObservationFrame[] = [];
  private sessionStartedAt: string | null = null;
  private captureTimer: any = null;
  private streamRef: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private fullCanvas: HTMLCanvasElement | null = null;
  private diffCanvas: HTMLCanvasElement | null = null;
  private lastSamplePixels: Uint8ClampedArray | null = null;
  private lastCaptureMs = 0;
  private listeners = new Set<() => void>();

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {}
    }
  }

  public startObserving(stream: MediaStream) {
    this.stopObserving(false);
    this.streamRef = stream;
    this.frames = [];
    this.sessionStartedAt = new Date().toISOString();
    this.lastSamplePixels = null;
    this.lastCaptureMs = 0;

    if (typeof document === "undefined") return;
    this.fullCanvas = document.createElement("canvas");
    this.diffCanvas = document.createElement("canvas");
    this.diffCanvas.width = 32;
    this.diffCanvas.height = 18;

    this.videoEl = document.createElement("video");
    this.videoEl.srcObject = stream;
    this.videoEl.muted = true;
    this.videoEl.playsInline = true;
    this.videoEl.play().catch(() => {});

    this.captureTimer = setInterval(() => {
      this.sampleTick();
    }, 1800);
    this.notify();
  }

  public stopObserving(clearFrames: boolean = false) {
    if (this.captureTimer) {
      clearInterval(this.captureTimer);
      this.captureTimer = null;
    }
    if (this.videoEl) {
      try {
        this.videoEl.pause();
        this.videoEl.srcObject = null;
      } catch {}
      this.videoEl = null;
    }
    this.streamRef = null;
    if (clearFrames) {
      this.frames = [];
      this.sessionStartedAt = null;
    }
    this.notify();
  }

  public isObserving(): boolean {
    return Boolean(this.streamRef && this.captureTimer);
  }

  public getSessionMeta() {
    return {
      isObserving: this.isObserving(),
      sessionStartedAt: this.sessionStartedAt,
      frameCount: this.frames.length,
      frames: this.frames,
    };
  }

  private computeFrameChangeScore(): number {
    if (!this.videoEl || !this.diffCanvas || this.videoEl.readyState < 2) return 0;
    const ctx = this.diffCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0;
    ctx.drawImage(this.videoEl, 0, 0, 32, 18);
    const data = ctx.getImageData(0, 0, 32, 18).data;
    if (!this.lastSamplePixels) {
      this.lastSamplePixels = new Uint8ClampedArray(data);
      return 1.0; // Initial frame always captured
    }
    let diffSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      diffSum +=
        Math.abs(data[i] - this.lastSamplePixels[i]) +
        Math.abs(data[i + 1] - this.lastSamplePixels[i + 1]) +
        Math.abs(data[i + 2] - this.lastSamplePixels[i + 2]);
    }
    const maxDiff = 32 * 18 * 3 * 255;
    const score = diffSum / maxDiff;
    if (score >= 0.04) {
      this.lastSamplePixels = new Uint8ClampedArray(data);
    }
    return score;
  }

  public captureManualSnapshot(label?: string): ScreenObservationFrame | null {
    return this.captureFrame(label || "Manual Section Snapshot", 1.0);
  }

  private sampleTick() {
    const score = this.computeFrameChangeScore();
    const elapsed = Date.now() - this.lastCaptureMs;
    if (score >= 0.045 || (this.frames.length === 0 && elapsed > 800)) {
      const sectionGuess =
        this.frames.length === 0
          ? "Initial Viewport / Above the Fold"
          : `Scroll / View Transition #${this.frames.length + 1}`;
      this.captureFrame(sectionGuess, score);
    }
  }

  private captureFrame(label: string, changeScore: number): ScreenObservationFrame | null {
    if (!this.videoEl || !this.fullCanvas || this.videoEl.readyState < 2) return null;
    const w = this.videoEl.videoWidth || 1280;
    const h = this.videoEl.videoHeight || 720;
    const maxW = 1120;
    const targetW = w > maxW ? maxW : w;
    const targetH = w > maxW ? Math.round((h / w) * maxW) : h;

    this.fullCanvas.width = targetW;
    this.fullCanvas.height = targetH;
    const ctx = this.fullCanvas.getContext("2d", { alpha: false });
    if (!ctx) return null;
    ctx.drawImage(this.videoEl, 0, 0, targetW, targetH);

    const imageDataUrl = this.fullCanvas.toDataURL("image/jpeg", 0.8);
    const frame: ScreenObservationFrame = {
      index: this.frames.length + 1,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      label,
      imageDataUrl,
      changeScore: Number(changeScore.toFixed(3)),
    };

    this.frames.push(frame);
    if (this.frames.length > MAX_OBSERVATION_FRAMES) {
      // Preserve first frame (hero/header) + latest sequential trail
      this.frames = [this.frames[0], ...this.frames.slice(-(MAX_OBSERVATION_FRAMES - 1))];
    }
    this.lastCaptureMs = Date.now();
    this.notify();
    return frame;
  }

  public async analyzeObservedWebsite(userFocus?: string): Promise<ScreenWebsiteAnalysisReport> {
    if (this.frames.length === 0 && this.videoEl) {
      this.captureFrame("Current Active Viewport", 1.0);
    }
    if (this.frames.length === 0) {
      throw new Error(
        "No screen-share frames have been captured yet. Start Share Screen first so I can genuinely observe the visible website sections."
      );
    }

    const resp = await fetch("/api/vision/analyze-website", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        frames: this.frames,
        sessionStartedAt: this.sessionStartedAt,
        sessionEndedAt: new Date().toISOString(),
        userFocus,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `Screen audit failed (${resp.status})`);
    }
    const data = await resp.json();
    return data.report as ScreenWebsiteAnalysisReport;
  }
}

export const continuousScreenObserver = new ContinuousScreenObserver();
