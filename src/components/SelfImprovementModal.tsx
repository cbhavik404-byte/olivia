import React, { useState, useEffect } from "react";
import { Sparkles, X, RefreshCw, CheckCircle2, XCircle, Play, Plus, AlertTriangle } from "lucide-react";
import {
  addCustomImprovementItem,
  fetchImprovementDashboard,
  ImprovementDashboardData,
  runSelfImprovementDiagnostic,
  updateImprovementItemStatus,
} from "../services/selfImprovementAdvisor";
import { ImprovementStatus } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SelfImprovementModal({ isOpen, onClose }: Props) {
  const [data, setData] = useState<ImprovementDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newWhy, setNewWhy] = useState("");
  const [newBenefit, setNewBenefit] = useState("");

  const load = async () => {
    setIsLoading(true);
    try {
      const d = await fetchImprovementDashboard();
      setData(d);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen]);

  const handleDiagnose = async () => {
    setIsLoading(true);
    try {
      await runSelfImprovementDiagnostic();
      await load();
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: ImprovementStatus) => {
    const updated = await updateImprovementItemStatus(id, status);
    setData((prev) => (prev ? { ...prev, backlog: updated } : prev));
  };

  const handleAddProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newWhy.trim()) return;
    const updated = await addCustomImprovementItem({
      proposedFeature: newTitle.trim(),
      whyNeeded: newWhy.trim(),
      expectedBenefit: newBenefit.trim() || "Improves NEXA reliability and capability coverage.",
      difficulty: "Medium",
      dependencies: ["user_approval"],
      priority: "Medium",
    });
    setNewTitle("");
    setNewWhy("");
    setNewBenefit("");
    setData((prev) => (prev ? { ...prev, backlog: updated } : prev));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6">
      <div className="w-full max-w-5xl h-[88vh] max-h-[840px] rounded-3xl bg-[#090d16] border border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.2)] flex flex-col overflow-hidden text-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0d1424]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/15 border border-purple-500/40 text-purple-300">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wide">Proactive Self-Improvement Advisor & Backlog</h2>
              <p className="text-[11px] font-mono text-white/50">
                Telemetry-Grounded Diagnostics • Capability Gap Ledger • Approval-Gated Upgrades
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiagnose}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 text-xs font-mono text-purple-200 cursor-pointer"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} /> Run Diagnostics
            </button>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Integration Readiness Badges */}
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Gemini AI Engine", ok: data.integrationStatus.geminiConfigured },
                { label: "Browser Engine", ok: data.integrationStatus.extensionlessBrowserReady ?? true },
                { label: "Gmail OAuth Config", ok: data.integrationStatus.gmailOAuthConfigured },
                { label: "Gmail Pub/Sub Topic", ok: data.integrationStatus.gmailPubSubConfigured },
              ].map((st) => (
                <div key={st.label} className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                  <span className="text-xs font-mono text-white/75">{st.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${st.ok ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                    {st.ok ? "READY" : "SETUP NEEDED"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Capability Gaps */}
          {data && data.capabilityGaps.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono font-bold text-amber-300 uppercase flex items-center gap-1.5">
                <AlertTriangle size={13} /> Logged Failed / Unsupported Commands ({data.capabilityGaps.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {data.capabilityGaps.slice(0, 6).map((gap) => (
                  <div key={gap.id} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white truncate">"{gap.commandText}"</span>
                      <span className="text-[10px] font-mono text-amber-300">x{gap.occurrenceCount}</span>
                    </div>
                    <p className="text-[11px] text-white/60">{gap.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Backlog */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold text-purple-300 uppercase">
              Improvement Backlog ({data?.backlog.length || 0})
            </h3>
            <div className="space-y-3">
              {data?.backlog.map((item) => (
                <div key={item.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        item.priority === "Critical" || item.priority === "High"
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-cyan-500/20 text-cyan-300"
                      }`}>
                        {item.priority}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono text-white/70">
                        Difficulty: {item.difficulty}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        item.status === "Approved" || item.status === "Completed"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : item.status === "Rejected"
                            ? "bg-rose-500/20 text-rose-300"
                            : "bg-purple-500/20 text-purple-300"
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleStatusChange(item.id, "Approved")}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 size={11} /> Approve
                      </button>
                      <button
                        onClick={() => handleStatusChange(item.id, "In Progress")}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <Play size={11} /> Start
                      </button>
                      <button
                        onClick={() => handleStatusChange(item.id, "Completed")}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-mono cursor-pointer"
                      >
                        Done
                      </button>
                      <button
                        onClick={() => handleStatusChange(item.id, "Rejected")}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle size={11} /> Reject
                      </button>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-white">{item.proposedFeature}</h4>
                  <p className="text-xs text-white/70"><strong>Why needed:</strong> {item.whyNeeded}</p>
                  <p className="text-xs text-emerald-200/80"><strong>Expected benefit:</strong> {item.expectedBenefit}</p>
                  {item.dependencies.length > 0 && (
                    <p className="text-[11px] font-mono text-white/45">
                      Dependencies: {item.dependencies.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add Custom Improvement Proposal */}
          <form onSubmit={handleAddProposal} className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
            <span className="text-xs font-mono font-bold text-purple-300 flex items-center gap-1.5">
              <Plus size={13} /> Propose New Upgrade Manually
            </span>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Proposed feature name..."
              className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none"
            />
            <input
              value={newWhy}
              onChange={(e) => setNewWhy(e.target.value)}
              placeholder="Why it is needed..."
              className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none"
            />
            <div className="flex gap-2">
              <input
                value={newBenefit}
                onChange={(e) => setNewBenefit(e.target.value)}
                placeholder="Expected benefit..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none"
              />
              <button type="submit" className="px-4 py-1.5 rounded-xl bg-purple-500 text-white font-bold text-xs cursor-pointer">
                Add to Backlog
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
