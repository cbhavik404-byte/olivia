import React, { useState, useEffect } from "react";
import { Monitor, X, Camera, Sparkles, Loader2, Trash2, Eye } from "lucide-react";
import { continuousScreenObserver } from "../services/continuousScreenObserver";
import { ScreenWebsiteAnalysisReport } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isScreenShareActive: boolean;
  onStartScreenShare: () => void;
}

export default function ScreenAuditModal({ isOpen, onClose, isScreenShareActive, onStartScreenShare }: Props) {
  const [meta, setMeta] = useState(continuousScreenObserver.getSessionMeta());
  const [userFocus, setUserFocus] = useState("");
  const [report, setReport] = useState<ScreenWebsiteAnalysisReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = continuousScreenObserver.subscribe(() => {
      setMeta({ ...continuousScreenObserver.getSessionMeta() });
    });
    return () => unsub();
  }, []);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const res = await continuousScreenObserver.analyzeObservedWebsite(userFocus.trim() || undefined);
      setReport(res);
    } catch (err: any) {
      setErrorMsg(err?.message || "Website analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6">
      <div className="w-full max-w-5xl h-[88vh] max-h-[840px] rounded-3xl bg-[#090d16] border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.2)] flex flex-col overflow-hidden text-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0d1424]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
              <Eye size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wide flex items-center gap-2">
                Continuous Screen & Website Observer
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${isScreenShareActive ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse" : "bg-white/10 text-white/50"}`}>
                  {isScreenShareActive ? "LIVE CAPTURING SCROLLS" : "SCREEN SHARE OFF"}
                </span>
              </h2>
              <p className="text-[11px] font-mono text-white/50">
                {meta.frameCount} ordered section snapshot(s) retained • Strictly reports only observed sections
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-white/10 bg-[#0b111e] flex flex-wrap items-center gap-2">
          {!isScreenShareActive ? (
            <button
              onClick={onStartScreenShare}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 text-black font-bold text-xs cursor-pointer"
            >
              <Monitor size={13} /> Start Share Screen
            </button>
          ) : (
            <button
              onClick={() => continuousScreenObserver.captureManualSnapshot("User Bookmarked Section")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-mono cursor-pointer"
            >
              <Camera size={13} /> Bookmark Current View
            </button>
          )}
          <input
            value={userFocus}
            onChange={(e) => setUserFocus(e.target.value)}
            placeholder="Optional audit focus (e.g. hero copy, pricing UX, contrast bugs)..."
            className="flex-1 min-w-[200px] px-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white outline-none"
          />
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || meta.frameCount === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/30 text-black font-bold text-xs cursor-pointer"
          >
            {isAnalyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Analyze Observed Website
          </button>
          {meta.frameCount > 0 && (
            <button
              onClick={() => {
                continuousScreenObserver.stopObserving(true);
                setReport(null);
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/60 hover:text-rose-300 cursor-pointer"
              title="Clear session trail"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mx-6 mt-3 px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Captured Frame Trail */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold text-emerald-300 uppercase">
              Ordered Section Capture Trail ({meta.frameCount})
            </h3>
            {meta.frames.length === 0 ? (
              <p className="text-xs text-white/40 py-4">
                Start Share Screen and scroll naturally through a website or Chrome tab — NEXA automatically snapshots every section transition in sequence.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {meta.frames.map((f) => (
                  <div key={`${f.index}-${f.timestamp}`} className="rounded-xl overflow-hidden bg-black/60 border border-white/10">
                    <img src={f.imageDataUrl} alt={f.label} className="w-full h-24 object-cover" />
                    <div className="p-2 text-[10px] font-mono">
                      <div className="text-emerald-300 font-bold truncate">#{f.index} • {f.timestamp}</div>
                      <div className="text-white/50 truncate">{f.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Consolidated Report */}
          {report && (
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-emerald-500/30 space-y-4">
              <div className="text-xs font-mono text-emerald-300 font-bold">
                CONSOLIDATED WEBSITE AUDIT ({report.totalFramesCaptured} FRAMES OBSERVED)
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                <strong>Coverage Truthfulness Note:</strong> {report.coverageDisclaimer}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <strong className="text-white">Observed Sections:</strong>
                  <ul className="list-disc pl-4 text-white/75 mt-1 space-y-0.5">
                    {report.observedSections.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div>
                  <strong className="text-white">Missing / Uncaptured Sections:</strong>
                  <ul className="list-disc pl-4 text-white/75 mt-1 space-y-0.5">
                    {report.missingSections.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div>
                  <strong className="text-white">Structure & Hierarchy:</strong>
                  <p className="text-white/75 mt-1">{report.structureAndHierarchy}</p>
                </div>
                <div>
                  <strong className="text-white">Navigation & UX:</strong>
                  <p className="text-white/75 mt-1">{report.navigationAndUx}</p>
                </div>
                <div>
                  <strong className="text-white">Design Consistency:</strong>
                  <p className="text-white/75 mt-1">{report.designConsistency}</p>
                </div>
                <div>
                  <strong className="text-white">Content & Clarity:</strong>
                  <p className="text-white/75 mt-1">{report.contentAndClarity}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2 border-t border-white/10">
                <div>
                  <strong className="text-rose-300">Visible Bugs / Usability Issues:</strong>
                  <ul className="list-disc pl-4 text-white/75 mt-1 space-y-0.5">
                    {report.bugsOrIssues.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
                <div>
                  <strong className="text-emerald-300">Prioritized Improvements:</strong>
                  <ul className="list-disc pl-4 text-white/75 mt-1 space-y-0.5">
                    {report.prioritizedImprovements.map((imp, i) => <li key={i}>{imp}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
