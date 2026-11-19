import React, { useState, useEffect, useCallback } from "react";
import {
  Mail,
  X,
  RefreshCw,
  Search,
  Send,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Paperclip,
  Clock,
  ShieldCheck,
  Sparkles,
  LogOut,
  Loader2,
} from "lucide-react";
import {
  authorizeGmailComposeAndSend,
  getAuthSnapshot,
  initWorkspaceAuth,
  isEmbeddedInIframe,
  signInWithGmail,
  signInWithGmailDirectOAuth,
  signOutWorkspace,
  WorkspaceAuthState,
} from "../services/googleWorkspaceAuth";
import {
  analyzeGmailWithNexa,
  createGmailDraft,
  getGmailThread,
  listGmailMessages,
  sendVerifiedGmailEmail,
} from "../services/gmailService";
import { GmailMessageSummary, PendingGmailSendApproval } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNewEmailAlert?: (summaryText: string) => void;
}

export default function GmailAssistantModal({ isOpen, onClose, onNewEmailAlert }: Props) {
  const [authState, setAuthState] = useState<WorkspaceAuthState>(getAuthSnapshot());
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<GmailMessageSummary | null>(null);
  const [threadMessages, setThreadMessages] = useState<GmailMessageSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiBriefing, setAiBriefing] = useState<string | null>(null);

  // Compose / Reply State
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [draftInstruction, setDraftInstruction] = useState("");
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [pubSubStatus, setPubSubStatus] = useState<{ pubSubTopicConfigured: boolean }>({
    pubSubTopicConfigured: false,
  });

  // Strict Send Approval State
  const [pendingSend, setPendingSend] = useState<PendingGmailSendApproval | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const inIframe = isEmbeddedInIframe();

  useEffect(() => {
    const unsub = initWorkspaceAuth((st) => setAuthState(st));
    fetch("/api/gmail/push-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setPubSubStatus({ pubSubTopicConfigured: Boolean(d.pubSubTopicConfigured) });
      })
      .catch(() => {});
    return () => unsub();
  }, []);

  const loadInbox = useCallback(
    async (queryOverride?: string) => {
      if (!authState.hasReadAccess) return;
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const list = await listGmailMessages(12, queryOverride ?? searchQuery);
        setMessages(list);

        // Detect newly arrived unread emails
        const newUnread = list.filter((m) => m.isUnread && !seenIds.has(m.id));
        if (seenIds.size > 0 && newUnread.length > 0 && onNewEmailAlert) {
          const newest = newUnread[0];
          onNewEmailAlert(
            `Boss, you received a new email from ${newest.from} regarding "${newest.subject}". ${newest.urgency === "high" ? "[Marked Urgent]" : ""}`
          );
        }
        setSeenIds(new Set(list.map((m) => m.id)));
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to load Gmail inbox.");
      } finally {
        setIsLoading(false);
      }
    },
    [authState.hasReadAccess, searchQuery, seenIds, onNewEmailAlert]
  );

  // Automatic periodic polling fallback when connected
  useEffect(() => {
    if (!authState.hasReadAccess) return;
    loadInbox();
    const timer = setInterval(() => {
      loadInbox();
    }, 60000);
    return () => clearInterval(timer);
  }, [authState.hasReadAccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectMessage = async (msg: GmailMessageSummary) => {
    setSelectedMsg(msg);
    setReplyTo(msg.from);
    setReplySubject(msg.subject.startsWith("Re:") ? msg.subject : `Re: ${msg.subject}`);
    setReplyBody("");
    try {
      const thread = await getGmailThread(msg.threadId);
      setThreadMessages(thread);
    } catch {
      setThreadMessages([msg]);
    }
  };

  const handleSummarizeInbox = async () => {
    if (messages.length === 0) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await analyzeGmailWithNexa(messages.slice(0, 6), "summarize");
      const r = res.result;
      setAiBriefing(r?.executiveSummary || r?.rawText || "Inbox analyzed.");
    } catch (err: any) {
      setErrorMsg(err?.message || "AI summarization failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiDraftReply = async () => {
    if (!selectedMsg) return;
    setIsLoading(true);
    try {
      const res = await analyzeGmailWithNexa(
        threadMessages.length > 0 ? threadMessages : [selectedMsg],
        "draft_reply",
        draftInstruction || "Write a clear, helpful professional reply."
      );
      if (res.result?.body) {
        setReplyBody(res.result.body);
      }
      if (res.result?.subject) {
        setReplySubject(res.result.subject);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to draft reply.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!replyTo || !replyBody.trim()) return;
    if (!authState.hasComposeSendAccess) {
      setErrorMsg("Drafting/Sending requires Draft & Send permission. Click 'Authorize Draft & Send' above.");
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const created = await createGmailDraft({
        to: replyTo,
        subject: replySubject,
        body: replyBody,
        threadId: selectedMsg?.threadId,
      });
      setStatusBanner(`Draft saved safely to Gmail (Draft ID: ${created.draftId}). Nothing was sent.`);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to create Gmail draft.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitiateSend = () => {
    if (!replyTo.trim() || !replyBody.trim()) {
      setErrorMsg("Recipient and message body are required.");
      return;
    }
    if (!authState.hasComposeSendAccess) {
      setErrorMsg("Sending requires separate Draft & Send authorization. Click 'Authorize Draft & Send' first.");
      return;
    }
    setConfirmPhrase("");
    setPendingSend({
      id: `send-${Date.now()}`,
      mode: selectedMsg ? "reply" : "new",
      to: replyTo.trim(),
      subject: replySubject.trim() || "(No Subject)",
      body: replyBody.trim(),
      threadId: selectedMsg?.threadId,
      requiresPhraseConfirmation: true,
    });
  };

  const handleExecuteVerifiedSend = async () => {
    if (!pendingSend) return;
    const ok = confirmPhrase.trim().toLowerCase() === "approved, send it." || confirmPhrase.trim().toLowerCase() === "approved, send it";
    if (!ok) return;
    setIsSending(true);
    setErrorMsg(null);
    try {
      const sent = await sendVerifiedGmailEmail(pendingSend, true);
      setStatusBanner(`Email sent & verified via Gmail API (Message ID: ${sent.sentMessageId}).`);
      setPendingSend(null);
      setReplyBody("");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to send email.");
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6">
      <div className="w-full max-w-5xl h-[88vh] max-h-[840px] rounded-3xl bg-[#090d16] border border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.2)] flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-white/10 bg-[#0d1424]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400">
              <Mail size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wide flex items-center gap-2">
                Gmail AI Assistant
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${authState.hasReadAccess ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-white/10 text-white/60"}`}>
                  {authState.hasReadAccess ? `CONNECTED: ${authState.email || "Gmail"}` : "DISCONNECTED"}
                </span>
              </h2>
              <p className="text-[11px] font-mono text-white/50">
                Sync: {pubSubStatus.pubSubTopicConfigured ? "Pub/Sub Push + Polling" : "60s Polling Sync (Pub/Sub Topic Optional)"} • Read Scope: {authState.hasReadAccess ? "Active" : "None"} • Send Scope: {authState.hasComposeSendAccess ? "Authorized" : "Locked"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {authState.hasReadAccess && !authState.hasComposeSendAccess && (
              <button
                onClick={async () => {
                  try {
                    const next = await authorizeGmailComposeAndSend();
                    setAuthState(next);
                  } catch (e: any) {
                    setErrorMsg(e?.message || "Authorization cancelled");
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-xs font-mono text-amber-300 cursor-pointer"
              >
                Authorize Draft & Send
              </button>
            )}
            {authState.hasReadAccess && (
              <button
                onClick={() => signOutWorkspace().then(() => setAuthState(getAuthSnapshot()))}
                className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/60 hover:text-rose-300 cursor-pointer"
                title="Disconnect Gmail"
              >
                <LogOut size={16} />
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        {!authState.hasReadAccess ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck size={32} />
            </div>
            <div className="max-w-md space-y-2">
              <h3 className="text-xl font-bold">Connect Your Gmail Safely</h3>
              <p className="text-sm text-white/65">
                Start with Read-Only inbox monitoring, summaries, and thread search—or authorize Draft & Send separately when ready. NEXA never sends an email without your explicit verification.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Official Google Sign-In Button Styling */}
              <button
                disabled={isAuthLoading}
                onClick={async () => {
                  setErrorMsg(null);
                  setIsAuthLoading(true);
                  try {
                    const st = await signInWithGmail(false);
                    setAuthState(st);
                  } catch (e: any) {
                    setErrorMsg(e?.message || "Google sign-in failed.");
                  } finally {
                    setIsAuthLoading(false);
                  }
                }}
                className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-white text-[#1f1f1f] font-medium text-sm shadow-lg hover:bg-gray-100 disabled:opacity-60 transition-all cursor-pointer"
              >
                {isAuthLoading ? (
                  <Loader2 size={18} className="animate-spin text-amber-600" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                )}
                <span>{isAuthLoading ? "Signing in..." : "Sign in with Google (Read Inbox)"}</span>
              </button>

              <button
                disabled={isAuthLoading}
                onClick={async () => {
                  setErrorMsg(null);
                  setIsAuthLoading(true);
                  try {
                    const st = await signInWithGmail(true);
                    setAuthState(st);
                  } catch (e: any) {
                    setErrorMsg(e?.message || "Google sign-in failed.");
                  } finally {
                    setIsAuthLoading(false);
                  }
                }}
                className="px-4 py-2.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-60 border border-amber-400/40 text-amber-300 text-xs font-mono cursor-pointer"
              >
                Sign in with Read + Draft/Send
              </button>
            </div>

            {(inIframe || errorMsg) && (
              <div className="max-w-lg w-full rounded-2xl bg-white/[0.03] border border-white/10 p-3.5 space-y-2.5 text-left">
                <p className="text-[11px] text-white/65 leading-relaxed">
                  {inIframe
                    ? "Running inside AI Studio preview iframe: if Chrome blocks the Firebase Auth popup, use Direct Google OAuth or open NEXA in a full tab."
                    : "Having trouble signing in? Use Direct Google OAuth below."}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    disabled={isAuthLoading}
                    onClick={async () => {
                      setErrorMsg(null);
                      setIsAuthLoading(true);
                      try {
                        const st = await signInWithGmailDirectOAuth(false);
                        setAuthState(st);
                      } catch (e: any) {
                        setErrorMsg(e?.message || "Direct Google OAuth failed.");
                      } finally {
                        setIsAuthLoading(false);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-mono cursor-pointer"
                  >
                    Direct Google OAuth (Read Inbox)
                  </button>
                  <button
                    disabled={isAuthLoading}
                    onClick={async () => {
                      setErrorMsg(null);
                      setIsAuthLoading(true);
                      try {
                        const st = await signInWithGmailDirectOAuth(true);
                        setAuthState(st);
                      } catch (e: any) {
                        setErrorMsg(e?.message || "Direct Google OAuth failed.");
                      } finally {
                        setIsAuthLoading(false);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 text-xs font-mono cursor-pointer"
                  >
                    Direct OAuth (Read + Send)
                  </button>
                  {inIframe && typeof window !== "undefined" && (
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-mono"
                    >
                      Open App in New Tab ↗
                    </a>
                  )}
                </div>
              </div>
            )}

            {errorMsg && <p className="max-w-lg text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 rounded-xl leading-relaxed">{errorMsg}</p>}
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-white/10 bg-[#0b111e]">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadInbox(searchQuery);
                }}
                className="flex-1 min-w-[220px] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/50 border border-white/10"
              >
                <Search size={14} className="text-white/40" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Gmail (e.g. from:boss is:unread has:attachment)"
                  className="flex-1 bg-transparent text-xs outline-none text-white"
                />
                <button type="submit" className="text-xs font-mono text-amber-400 hover:text-amber-300 cursor-pointer">
                  Search
                </button>
              </form>

              <button
                onClick={() => loadInbox()}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono cursor-pointer"
              >
                <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
                Sync
              </button>

              <button
                onClick={handleSummarizeInbox}
                disabled={isLoading || messages.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-xs font-mono text-amber-300 cursor-pointer"
              >
                <Sparkles size={13} />
                Summarize Inbox
              </button>
            </div>

            {errorMsg && (
              <div className="mx-6 mt-3 px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle size={14} /> {errorMsg}
              </div>
            )}
            {statusBanner && (
              <div className="mx-6 mt-3 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 size={14} /> {statusBanner}
              </div>
            )}
            {aiBriefing && (
              <div className="mx-6 mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 text-xs text-amber-100 leading-relaxed">
                <strong className="text-amber-300 font-mono">AI INBOX BRIEFING:</strong> {aiBriefing}
              </div>
            )}

            {/* Main Split View */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
              {/* Message List */}
              <div className="md:col-span-5 border-r border-white/10 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {messages.length === 0 ? (
                  <p className="text-xs text-white/40 text-center py-8">
                    {isLoading ? "Loading emails..." : "No emails matched your filter."}
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleSelectMessage(m)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                        selectedMsg?.id === m.id
                          ? "bg-amber-500/15 border-amber-400/60"
                          : "bg-white/[0.02] border-white/10 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`text-xs truncate ${m.isUnread ? "font-bold text-white" : "text-white/70"}`}>
                          {m.from}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                            m.urgency === "high"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : "bg-white/10 text-white/50"
                          }`}
                        >
                          {m.urgency}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-amber-200 truncate">{m.subject}</div>
                      <p className="text-[11px] text-white/50 line-clamp-2 mt-1">{m.snippet}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-mono text-white/40">
                        {m.attachments.length > 0 && (
                          <span className="flex items-center gap-1 text-cyan-300">
                            <Paperclip size={10} /> {m.attachments.length} file(s)
                          </span>
                        )}
                        {m.detectedDeadlines.length > 0 && (
                          <span className="flex items-center gap-1 text-amber-300">
                            <Clock size={10} /> {m.detectedDeadlines[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Thread Detail + Draft & Verified Send */}
              <div className="md:col-span-7 overflow-y-auto p-5 flex flex-col gap-4 custom-scrollbar">
                {selectedMsg ? (
                  <>
                    <div className="space-y-1 border-b border-white/10 pb-3">
                      <h3 className="text-sm font-bold text-white">{selectedMsg.subject}</h3>
                      <p className="text-xs text-white/60">From: {selectedMsg.from} • Thread: {selectedMsg.threadId}</p>
                      {selectedMsg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {selectedMsg.attachments.map((att, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-mono text-cyan-200">
                              📎 {att.filename} ({Math.round(att.size / 1024)} KB)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {(threadMessages.length > 0 ? threadMessages : [selectedMsg]).map((tm) => (
                        <div key={tm.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/80 whitespace-pre-wrap">
                          <div className="text-[10px] font-mono text-white/40 mb-1">
                            {tm.from} • {tm.date}
                          </div>
                          {tm.bodyText}
                        </div>
                      ))}
                    </div>

                    {/* Draft & Reply Composer */}
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-amber-300">REPLY / DRAFT COMPOSER</span>
                        <div className="flex items-center gap-2">
                          <input
                            value={draftInstruction}
                            onChange={(e) => setDraftInstruction(e.target.value)}
                            placeholder="Reply tone/goal..."
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white w-44 outline-none"
                          />
                          <button
                            onClick={handleAiDraftReply}
                            disabled={isLoading}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-mono cursor-pointer"
                          >
                            AI Draft
                          </button>
                        </div>
                      </div>

                      <input
                        value={replyTo}
                        onChange={(e) => setReplyTo(e.target.value)}
                        placeholder="Recipient (To)"
                        className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none"
                      />
                      <input
                        value={replySubject}
                        onChange={(e) => setReplySubject(e.target.value)}
                        placeholder="Subject"
                        className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none"
                      />
                      <textarea
                        rows={4}
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Compose reply or click AI Draft..."
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none resize-none"
                      />

                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={handleSaveDraft}
                          disabled={isLoading || !replyBody.trim()}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-mono text-white cursor-pointer"
                        >
                          <FileText size={13} /> Save Draft
                        </button>
                        <button
                          onClick={handleInitiateSend}
                          disabled={isLoading || !replyBody.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold cursor-pointer"
                        >
                          <Send size={13} /> Review & Send
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-white/40">
                    Select an email thread on the left to inspect context, attachments, deadlines, or draft a reply.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Explicit Send Confirmation Modal */}
      {pendingSend && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#111624] border border-rose-500/40 p-6 space-y-4 text-white shadow-2xl">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
              <ShieldCheck size={18} /> Final Email Send Verification
            </div>
            <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-xs space-y-1.5">
              <div><strong className="text-white/60">Recipient:</strong> {pendingSend.to}</div>
              <div><strong className="text-white/60">Thread ID:</strong> {pendingSend.threadId || "New Thread"}</div>
              <div><strong className="text-white/60">Subject:</strong> {pendingSend.subject}</div>
              <div className="pt-2 border-t border-white/10 whitespace-pre-wrap text-white/90 max-h-40 overflow-y-auto">
                {pendingSend.body}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-amber-300 font-mono">
                Type exact confirmation phrase: <strong>Approved, send it.</strong>
              </label>
              <input
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="Approved, send it."
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-amber-400/40 text-xs text-white outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingSend(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-mono cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteVerifiedSend}
                disabled={
                  isSending ||
                  (confirmPhrase.trim().toLowerCase() !== "approved, send it." &&
                    confirmPhrase.trim().toLowerCase() !== "approved, send it")
                }
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 text-black font-bold text-xs cursor-pointer"
              >
                {isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Confirm & Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
