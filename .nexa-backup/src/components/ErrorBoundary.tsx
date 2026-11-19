import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Nexa ErrorBoundary] Uncaught UI error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCacheAndReload = () => {
    try {
      localStorage.removeItem("nexa_chat_history");
      localStorage.removeItem("nexa_dialogue_history");
      sessionStorage.clear();
    } catch (_) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#070a10] text-white flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full bg-white/[0.04] border border-amber-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-inner">
              <AlertTriangle size={28} />
            </div>

            <h2 className="text-lg font-bold text-white tracking-wide">
              Nexa System Recovery
            </h2>
            <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
              An unexpected glitch occurred in the visual runtime. Your memory and data are safe.
            </p>

            {this.state.error?.message && (
              <div className="w-full mt-4 p-3 rounded-xl bg-black/60 border border-white/10 text-left font-mono text-[11px] text-amber-300/90 max-h-32 overflow-y-auto break-words">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 w-full mt-6">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-all shadow-md active:scale-95"
              >
                <RefreshCw size={14} />
                <span>Resume Nexa</span>
              </button>
              <button
                type="button"
                onClick={this.handleResetCacheAndReload}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs border border-white/10 transition-all"
                title="Clears temporary dialogue cache and restarts cleanly"
              >
                <Trash2 size={13} />
                <span>Clean Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
