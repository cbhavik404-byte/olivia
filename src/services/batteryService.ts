/**
 * batteryService.ts
 * Real-time Battery Status API integration & device health monitor for NEXA.
 * Enables live telemetry in top header and context awareness for Oliviya & Nexa.
 */

export interface BatteryStatus {
  supported: boolean;
  level: number; // 0 to 100
  charging: boolean;
  chargingTime: number; // seconds until fully charged, or Infinity
  dischargingTime: number; // seconds until discharged, or Infinity
  statusText: string;
  health: "optimal" | "good" | "low" | "critical";
  temperatureGrade: "cool" | "normal" | "warm";
  isSimulated?: boolean;
  lastUpdated: number;
}

export interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  onchargingchange: ((this: BatteryManager, ev: Event) => any) | null;
  onchargingtimechange: ((this: BatteryManager, ev: Event) => any) | null;
  ondischargingtimechange: ((this: BatteryManager, ev: Event) => any) | null;
  onlevelchange: ((this: BatteryManager, ev: Event) => any) | null;
}

type BatteryListener = (status: BatteryStatus) => void;

class BatteryService {
  private currentStatus: BatteryStatus = {
    supported: false,
    level: 82,
    charging: false,
    chargingTime: Infinity,
    dischargingTime: Infinity,
    statusText: "Battery Normal",
    health: "good",
    temperatureGrade: "normal",
    isSimulated: false,
    lastUpdated: Date.now(),
  };

  private listeners: Set<BatteryListener> = new Set();
  private batteryManager: BatteryManager | null = null;
  private isInitialized = false;
  private manualOverride: Partial<BatteryStatus> | null = null;

  constructor() {
    this.loadPersistedStatus();
  }

  private loadPersistedStatus() {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("nexa_device_battery_status");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.level === "number") {
          this.currentStatus = {
            ...this.currentStatus,
            ...parsed,
            lastUpdated: Date.now(),
          };
        }
      }
    } catch (_) {}
  }

  private persistStatus() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("nexa_device_battery_status", JSON.stringify(this.currentStatus));
    } catch (_) {}
  }

  private computeHealth(level: number, charging: boolean): "optimal" | "good" | "low" | "critical" {
    if (level <= 15 && !charging) return "critical";
    if (level <= 25 && !charging) return "low";
    if (level >= 80 || charging) return "optimal";
    return "good";
  }

  private computeStatusText(level: number, charging: boolean): string {
    if (charging) {
      if (level >= 99) return "Fully Charged";
      return `Charging (${level}%)`;
    }
    if (level <= 15) return `Critical Low (${level}%)`;
    if (level <= 25) return `Battery Low (${level}%)`;
    return `On Battery (${level}%)`;
  }

  public async init(): Promise<BatteryStatus> {
    if (this.isInitialized && this.batteryManager) {
      return this.currentStatus;
    }

    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return this.currentStatus;
    }

    const nav = navigator as any;

    if (typeof nav.getBattery === "function") {
      try {
        const battery: BatteryManager = await nav.getBattery();
        this.batteryManager = battery;
        this.currentStatus.supported = true;
        this.currentStatus.isSimulated = false;

        const updateFromBatteryManager = () => {
          if (this.manualOverride) {
            this.applyOverride();
            return;
          }

          const rawLevel = typeof battery.level === "number" ? Math.round(battery.level * 100) : 80;
          const charging = Boolean(battery.charging);
          const chargingTime = battery.chargingTime ?? Infinity;
          const dischargingTime = battery.dischargingTime ?? Infinity;

          this.currentStatus = {
            supported: true,
            level: rawLevel,
            charging,
            chargingTime,
            dischargingTime,
            health: this.computeHealth(rawLevel, charging),
            statusText: this.computeStatusText(rawLevel, charging),
            temperatureGrade: charging ? (rawLevel > 85 ? "warm" : "normal") : "cool",
            isSimulated: false,
            lastUpdated: Date.now(),
          };

          this.persistStatus();
          this.notifyListeners();
        };

        // Initial populate
        updateFromBatteryManager();

        // Attach event listeners for real-time changes
        battery.addEventListener("levelchange", updateFromBatteryManager);
        battery.addEventListener("chargingchange", updateFromBatteryManager);
        battery.addEventListener("chargingtimechange", updateFromBatteryManager);
        battery.addEventListener("dischargingtimechange", updateFromBatteryManager);

        this.isInitialized = true;
        return this.currentStatus;
      } catch (err) {
        console.warn("[BatteryService] navigator.getBattery call failed or was blocked by policy:", err);
      }
    }

    // Fallback if Battery Status API is unsupported in current browser/frame
    this.currentStatus.supported = false;
    this.currentStatus.isSimulated = true;
    if (!this.manualOverride) {
      this.currentStatus.statusText = `${this.currentStatus.charging ? "Charging" : "On Battery"} (${this.currentStatus.level}%) [Simulated]`;
    } else {
      this.applyOverride();
    }
    this.persistStatus();
    this.notifyListeners();
    this.isInitialized = true;
    return this.currentStatus;
  }

  private applyOverride() {
    if (!this.manualOverride) return;
    const level = this.manualOverride.level ?? this.currentStatus.level;
    const charging = this.manualOverride.charging ?? this.currentStatus.charging;
    this.currentStatus = {
      ...this.currentStatus,
      ...this.manualOverride,
      level,
      charging,
      health: this.computeHealth(level, charging),
      statusText: this.computeStatusText(level, charging),
      isSimulated: true,
      lastUpdated: Date.now(),
    };
    this.persistStatus();
    this.notifyListeners();
  }

  public setSimulation(override: { level?: number; charging?: boolean } | null) {
    if (!override) {
      this.manualOverride = null;
      this.isInitialized = false;
      this.init();
      return;
    }
    this.manualOverride = override;
    this.applyOverride();
  }

  public getStatus(): BatteryStatus {
    return { ...this.currentStatus };
  }

  public subscribe(listener: BatteryListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const status = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (e) {
        console.error("[BatteryService] Error notifying listener:", e);
      }
    });
  }

  /**
   * Builds high-priority context string for Gemini prompt injection.
   * STRICT MANDATE: Never focus on batteries continuously. Only surface battery in 2 exact conditions:
   * 1. Battery is low and needs charging (level <= 20%) -> "Your battery is low, you should charge."
   * 2. Battery is 100% full -> "Battery is 100% and I have not discharged. Battery is full, you can discharge the charger."
   * Otherwise: 100% complete silence.
   */
  public getPromptContext(): string {
    const s = this.getStatus();
    
    // Condition 1: Battery low & discharging
    if (!s.charging && s.level <= 20) {
      return `
[DEVICE TELEMETRY ALERT - STRICT PROTOCOL]:
- Battery is low (${s.level}%) and heavily draining.
- MANDATE: If bringing up battery, you may ONLY say: "Your battery is low, you should charge."
- DO NOT say anything else or blabber intermediate statistics.`;
    }

    // Condition 2: Battery 100% full
    if (s.charging && s.level >= 100) {
      return `
[DEVICE TELEMETRY ALERT - STRICT PROTOCOL]:
- Battery is 100% full and charger is connected.
- MANDATE: If bringing up battery, you may ONLY say: "Battery is 100% and I have not discharged. Battery is full, you can discharge the charger."
- DO NOT say anything else.`;
    }

    // In all other cases: STRICT SILENCE. DO NOT MENTION BATTERY.
    return `
[STRICT BATTERY DISCIPLINE]:
- Battery level is normal. DO NOT FOCUS ON BATTERIES!
- Continuously telling "Yes, your battery is charged" or "Your battery level is this" is strictly prohibited and unprofessional.
- REMAIN 100% SILENT about battery, charging, and device power during all conversations, tasks, stories, and builds.`;
  }

  /**
   * Generates strict commentary suited to current device health according to user's 2 exact rules.
   */
  public getComment(): string {
    const s = this.getStatus();
    if (!s.charging && s.level <= 20) {
      return "Your battery is low, you should charge.";
    }
    if (s.charging && s.level >= 100) {
      return "Battery is 100% and I have not discharged. Battery is full, you can discharge the charger.";
    }
    return "";
  }
}

export const batteryService = new BatteryService();
