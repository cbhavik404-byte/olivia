export class FlashlightService {
  private static activeStream: MediaStream | null = null;

  /**
   * Toggles the device flashlight on or off.
   */
  public static async setFlashlight(enabled: boolean): Promise<boolean> {
    try {
      if (enabled) {
        // If already running, do nothing
        if (this.activeStream) return true;

        // Request back camera specifically, which has the physical flash
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });

        const track = stream.getVideoTracks()[0];
        if (!track) {
          throw new Error("No video track found for back camera.");
        }

        // Apply torch constraint
        const capabilities = (track as any).getCapabilities?.() || {};
        if ('torch' in capabilities) {
          await track.applyConstraints({
            advanced: [{ torch: true } as any]
          });
          this.activeStream = stream;
          console.log("[Nexa Flashlight] Flashlight turned ON");
          return true;
        } else {
          // If no physical torch exists/unsupported, clean up stream
          stream.getTracks().forEach(t => t.stop());
          console.warn("[Nexa Flashlight] Device does not support torch constraint.");
          return false;
        }
      } else {
        // Turn off and release resources
        if (this.activeStream) {
          this.activeStream.getTracks().forEach(t => t.stop());
          this.activeStream = null;
          console.log("[Nexa Flashlight] Flashlight turned OFF");
        }
        return true;
      }
    } catch (e) {
      console.error("[Nexa Flashlight] Failed to toggle flashlight:", e);
      if (this.activeStream) {
        this.activeStream.getTracks().forEach(t => t.stop());
        this.activeStream = null;
      }
      return false;
    }
  }

  /**
   * Helper to check if flashlight is currently active.
   */
  public static isFlashlightOn(): boolean {
    return this.activeStream !== null;
  }
}
