import React, { useState, useEffect, useRef } from "react";
import { 
  Battery, 
  BatteryCharging, 
  BatteryFull, 
  BatteryLow, 
  BatteryMedium, 
  BatteryWarning, 
  Zap, 
  HeartPulse, 
  Activity, 
  Sparkles, 
  RefreshCw, 
  Sliders, 
  X,
  Volume2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { batteryService, BatteryStatus } from "../services/batteryService";

interface DeviceBatteryIndicatorProps {
  onAskComment?: (comment: string) => void;
}

export const DeviceBatteryIndicator: React.FC<DeviceBatteryIndicatorProps> = ({
  onAskComment,
}) => {
  const [status, setStatus] = useState<BatteryStatus>(batteryService.getStatus());
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"status" | "simulate">("status");
  const [showLowAlert, setShowLowAlert] = useState(false);
  const [lastAlertedLevel, setLastAlertedLevel] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    batteryService.init().then((st) => setStatus(st));
    const unsubscribe = batteryService.subscribe((newStatus) => {
      setStatus(newStatus);

      // Low battery proactive warning check
      if (!newStatus.charging && newStatus.level <= 18) {
        if (lastAlertedLevel === null || Math.abs(lastAlertedLevel - newStatus.level) >= 5) {
          setShowLowAlert(true);
          setLastAlertedLevel(newStatus.level);
        }
      } else if (newStatus.charging) {
        setShowLowAlert(false);
      }
    });

    return () => unsubscribe();
  }, [lastAlertedLevel]);

  // Click outside to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleAskComment = () => {
    const comment = batteryService.getComment() || `Device is at ${status.level}% battery. Everything is working normally.`;
    if (onAskComment) {
      onAskComment(comment);
    }
    setIsOpen(false);
  };

  const getBatteryIcon = () => {
    if (status.charging) {
      return <BatteryCharging className="w-4 h-4 text-emerald-400 animate-pulse" />;
    }
    if (status.level <= 15) {
      return <BatteryWarning className="w-4 h-4 text-rose-400 animate-bounce" />;
    }
    if (status.level <= 25) {
      return <BatteryLow className="w-4 h-4 text-amber-400" />;
    }
    if (status.level <= 70) {
      return <BatteryMedium className="w-4 h-4 text-cyan-300" />;
    }
    return <BatteryFull className="w-4 h-4 text-emerald-400" />;
  };

  const getThemeClasses = () => {
    if (status.charging) {
      return "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.3)]";
    }
    if (status.level <= 15) {
      return "bg-rose-500/15 border-rose-500/50 text-rose-300 hover:bg-rose-500/25 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse";
    }
    if (status.level <= 25) {
      return "bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20";
    }
    return "bg-white/5 border-white/15 text-slate-200 hover:bg-white/10";
  };

  const getProgressBarColor = () => {
    if (status.charging) return "from-emerald-500 to-teal-400";
    if (status.level <= 15) return "from-rose-600 to-red-500";
    if (status.level <= 25) return "from-amber-500 to-orange-400";
    if (status.level <= 60) return "from-cyan-500 to-blue-400";
    return "from-emerald-500 to-teal-300";
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Top Header Pill Button */}
      <button
        id="device-battery-indicator-btn"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all text-xs font-mono font-bold tracking-wider cursor-pointer select-none group ${getThemeClasses()}`}
        title={`Device Battery: ${status.level}% • ${status.charging ? "Charging" : "On Battery"} (Click for Health & Voice Commentary)`}
      >
        <div className="flex items-center justify-center">
          {getBatteryIcon()}
        </div>
        <span className="font-semibold text-[11px]">
          {status.level}%
        </span>
        {status.charging && (
          <Zap size={10} className="text-emerald-400 fill-emerald-400 animate-pulse" />
        )}
      </button>

      {/* Proactive Low Battery Warning Pill / Floating Toast */}
      <AnimatePresence>
        {showLowAlert && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute top-11 right-0 z-50 w-72 p-3 bg-gradient-to-r from-rose-950/95 to-[#1a0812]/95 border border-rose-500/60 rounded-xl shadow-[0_10px_30px_rgba(244,63,94,0.35)] backdrop-blur-xl pointer-events-auto"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 font-bold text-xs">
                  N
                </div>
                <div>
                  <div className="text-xs font-bold text-rose-300 flex items-center gap-1">
                    <span>NEXA BATTERY ALERT</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-rose-500/30 rounded text-rose-200">
                      {status.level}%
                    </span>
                  </div>
                  <div className="text-[11px] text-white/80 leading-tight mt-0.5">
                    "Arey Bhavik! Phone sirf {status.level}% bacha hai, fatfat charger lagao!"
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowLowAlert(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={handleAskComment}
                className="flex-1 py-1 px-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-black font-bold text-[10px] tracking-wider transition-colors flex items-center justify-center gap-1"
              >
                <Volume2 size={12} />
                <span>Hear Nexa's Reaction</span>
              </button>
              <button
                onClick={() => setShowLowAlert(false)}
                className="py-1 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-[10px] transition-colors"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Popover Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute top-12 right-0 z-50 w-80 sm:w-88 p-4 bg-[#0a0f18]/95 border border-white/15 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_25px_rgba(16,185,129,0.15)] backdrop-blur-2xl text-white"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold tracking-wider uppercase text-white">
                    Device Battery Health
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/50 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>{status.supported ? "Battery Status API Live" : "Hardware Telemetry Engine"}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Mode Switch Tabs */}
            <div className="flex p-1 bg-white/5 rounded-xl border border-white/10 my-3">
              <button
                onClick={() => setActiveTab("status")}
                className={`flex-1 py-1 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "status"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                <HeartPulse size={12} />
                <span>Health & Status</span>
              </button>
              <button
                onClick={() => setActiveTab("simulate")}
                className={`flex-1 py-1 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "simulate"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                <Sliders size={12} />
                <span>Simulate / Test</span>
              </button>
            </div>

            {activeTab === "status" ? (
              <>
                {/* Main Gauge & Percentage */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 mb-3">
                  <div className="flex items-end justify-between mb-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-mono font-extrabold tracking-tight text-white">
                        {status.level}%
                      </span>
                      <span className="text-xs text-white/50 font-mono">
                        {status.charging ? "CHARGING" : "CAPACITY"}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                        status.charging
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : status.level <= 15
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          : status.level <= 25
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                      }`}
                    >
                      {status.statusText}
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden p-0.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, status.level))}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className={`h-full rounded-full bg-gradient-to-r ${getProgressBarColor()}`}
                    />
                  </div>

                  {/* Metrics Subgrid */}
                  <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] font-mono">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                      <div className="text-white/40 text-[9px] uppercase tracking-wider">Power State</div>
                      <div className="font-semibold text-white/90 truncate flex items-center gap-1 mt-0.5">
                        {status.charging ? (
                          <>
                            <Zap size={12} className="text-emerald-400" />
                            <span>AC Connected</span>
                          </>
                        ) : (
                          <>
                            <Battery size={12} className="text-cyan-400" />
                            <span>On Battery</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                      <div className="text-white/40 text-[9px] uppercase tracking-wider">Health Grade</div>
                      <div className="font-semibold text-emerald-400 capitalize mt-0.5">
                        {status.health === "optimal" ? "Optimal (98%)" : status.health === "good" ? "Normal (94%)" : "Needs Power"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Device Health Quote Preview */}
                <div className="p-3 rounded-xl bg-gradient-to-tr from-purple-950/40 to-pink-950/20 border border-purple-500/30 mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                      O
                    </div>
                    <span className="text-[11px] font-bold text-pink-300">
                      Oliviya's Live Device Feedback:
                    </span>
                  </div>
                  <p className="text-xs text-white/80 leading-relaxed italic">
                    "{batteryService.getComment() || (status.charging ? `Device is charging normally (${status.level}%).` : `Battery is normal (${status.level}%). Nexa is focused on your work.`)}"
                  </p>
                </div>

                {/* Direct Action Button */}
                <button
                  id="ask-battery-comment-btn"
                  onClick={handleAskComment}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.4)] cursor-pointer hover:scale-[1.02]"
                >
                  <Sparkles size={14} className="text-amber-300" />
                  <span>Ask Oliviya to Comment on Battery</span>
                </button>
              </>
            ) : (
              /* Simulation & Test Scenarios Tab */
              <div className="space-y-2">
                <div className="text-[11px] text-white/60 mb-2 leading-relaxed">
                  Test different battery levels to experience Oliviya's instant Hinglish roasts and advice:
                </div>

                <button
                  onClick={() => {
                    batteryService.setSimulation({ level: 12, charging: false });
                    setActiveTab("status");
                  }}
                  className="w-full p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-left transition-all group flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                      <BatteryWarning size={14} />
                      <span>12% Critical Low Battery</span>
                    </div>
                    <div className="text-[10px] text-white/50 mt-0.5">
                      Oliviya scolds Bhavik to find the charger immediately!
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-rose-500/20 rounded font-mono text-rose-200">
                    Test
                  </span>
                </button>

                <button
                  onClick={() => {
                    batteryService.setSimulation({ level: 55, charging: true });
                    setActiveTab("status");
                  }}
                  className="w-full p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-left transition-all group flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <BatteryCharging size={14} />
                      <span>55% Fast Charging</span>
                    </div>
                    <div className="text-[10px] text-white/50 mt-0.5">
                      Oliviya gives witty approval for plugging in the phone.
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 rounded font-mono text-emerald-200">
                    Test
                  </span>
                </button>

                <button
                  onClick={() => {
                    batteryService.setSimulation({ level: 100, charging: true });
                    setActiveTab("status");
                  }}
                  className="w-full p-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-left transition-all group flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Zap size={14} />
                      <span>100% Fully Charged</span>
                    </div>
                    <div className="text-[10px] text-white/50 mt-0.5">
                      Oliviya tells Bhavik to unplug before the phone explodes.
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-cyan-500/20 rounded font-mono text-cyan-200">
                    Test
                  </span>
                </button>

                <button
                  onClick={() => {
                    batteryService.setSimulation(null);
                    setActiveTab("status");
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 font-mono text-xs transition-all flex items-center justify-center gap-1.5 mt-3"
                >
                  <RefreshCw size={12} />
                  <span>Reset to Live Hardware Battery</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DeviceBatteryIndicator;
