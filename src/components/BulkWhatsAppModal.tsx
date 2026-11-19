import React, { useState } from "react";
import { MessageSquare, Send, X, AlertTriangle, CheckCircle, Smartphone, Users } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { recordAuditLog } from "../services/auditClientService";

interface BulkWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialNumbers?: string[];
  initialMessage?: string;
}

export default function BulkWhatsAppModal({
  isOpen,
  onClose,
  initialNumbers = [],
  initialMessage = ""
}: BulkWhatsAppModalProps) {
  const [numbersText, setNumbersText] = useState(initialNumbers.join("\n"));
  const [messageText, setMessageText] = useState(initialMessage);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [sendingIndex, setSendingIndex] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const getParsedNumbers = (): string[] => {
    return numbersText
      .split(/[\n,;]+/)
      .map(n => n.trim().replace(/[^\d+]/g, ""))
      .filter(n => n.length >= 8);
  };

  const [inputError, setInputError] = useState<string | null>(null);

  const phoneNumbers = getParsedNumbers();

  const handleSendBulk = async () => {
    setInputError(null);
    if (phoneNumbers.length === 0) {
      setInputError("Please provide at least one valid phone number.");
      return;
    }
    if (!messageText.trim()) {
      setInputError("Please provide a message to send.");
      return;
    }

    setLogs([]);
    for (let i = 0; i < phoneNumbers.length; i++) {
      setSendingIndex(i);
      const phone = phoneNumbers[i];
      const encodedMsg = encodeURIComponent(messageText);
      const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodedMsg}`;
      
      // Open link in new tab or web window safely
      try {
        window.open(url, "_blank");
      } catch (err) {
        console.warn("Could not open window:", err);
      }
      
      setLogs(prev => [...prev, `[${i + 1}/${phoneNumbers.length}] Opened WhatsApp chat for ${phone}`]);
      
      // Small pause between browser tab opens
      await new Promise(r => setTimeout(r, 1200));
    }
    await recordAuditLog({
      actionType: "bulk_whatsapp_dispatch",
      target: `${phoneNumbers.length} recipient(s)`,
      status: "executed",
      confirmedByUser: isConfirmed,
      details: `Dispatched WhatsApp Web links to ${phoneNumbers.length} numbers.`,
    });
    setSendingIndex(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="bulk-whatsapp-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            key="bulk-whatsapp-dialog"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-emerald-500/30 text-white shadow-2xl p-6 space-y-5"
          >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-emerald-300">Bulk WhatsApp Sender</h3>
                <p className="text-xs text-white/60">Requires explicit user confirmation to prevent accidental spamming</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Warning Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <strong>Confirmation Required:</strong> WhatsApp Web will open direct chat links for each recipient. Make sure your WhatsApp Web is logged in.
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-white/80 font-semibold mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Target Phone Numbers (Comma or line separated):
                </span>
                <span className="text-emerald-400 font-mono text-[11px] font-bold">
                  {phoneNumbers.length} Valid Recipient{phoneNumbers.length === 1 ? "" : "s"}
                </span>
              </label>
              <textarea
                value={numbersText}
                onChange={e => setNumbersText(e.target.value)}
                placeholder="+919876543210&#10;+919812345678"
                rows={3}
                className="w-full rounded-xl bg-black/40 border border-white/15 p-3 text-white font-mono focus:border-emerald-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-white/80 font-semibold mb-1.5 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                WhatsApp Message Content:
              </label>
              <textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder="Type the message to send to all recipients..."
                rows={4}
                className="w-full rounded-xl bg-black/40 border border-white/15 p-3 text-white focus:border-emerald-500 focus:outline-none transition"
              />
            </div>

            {/* Checkbox confirmation */}
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={e => setIsConfirmed(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-white/90 text-xs font-medium">
                I confirm I want to dispatch this bulk message to {phoneNumbers.length} contacts.
              </span>
            </label>
          </div>

          {/* Input Error Message */}
          {inputError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium">
              {inputError}
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div className="p-3 rounded-xl bg-black/60 border border-white/10 max-h-28 overflow-y-auto font-mono text-[11px] text-emerald-400 space-y-1">
              {logs.map((log, idx) => (
                <div key={`bulk-log-${idx}-${log.slice(0, 10)}`} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>{log}</span>
                </div>
              ))}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSendBulk}
              disabled={!isConfirmed || phoneNumbers.length === 0 || !messageText.trim() || sendingIndex !== null}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg ${
                isConfirmed && phoneNumbers.length > 0 && messageText.trim()
                  ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20"
                  : "bg-white/10 text-white/40 cursor-not-allowed"
              }`}
            >
              <Send className="w-4 h-4" />
              {sendingIndex !== null ? `Sending (${sendingIndex + 1}/${phoneNumbers.length})...` : "Confirm & Send Bulk WhatsApp"}
            </button>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}
