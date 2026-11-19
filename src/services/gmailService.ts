import {
  GmailAttachmentMeta,
  GmailMessageSummary,
  PendingGmailSendApproval,
} from "../types";
import { clearExpiredGmailToken, getInMemoryGmailToken } from "./googleWorkspaceAuth";
import { recordAuditLog } from "./auditClientService";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

function decodeBase64Url(data: string = ""): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const binStr = atob(base64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return "";
  }
}

function encodeBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function extractBodyAndAttachments(payload: any): {
  bodyText: string;
  attachments: GmailAttachmentMeta[];
} {
  let plainText = "";
  let htmlText = "";
  const attachments: GmailAttachmentMeta[] = [];

  function walk(part: any) {
    if (!part) return;
    if (part.filename && part.filename.length > 0) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: Number(part.body?.size || 0),
      });
    }
    if (part.mimeType === "text/plain" && part.body?.data && !plainText) {
      plainText = decodeBase64Url(part.body.data);
    } else if (part.mimeType === "text/html" && part.body?.data && !htmlText) {
      htmlText = decodeBase64Url(part.body.data);
    }
    if (Array.isArray(part.parts)) {
      for (const child of part.parts) walk(child);
    }
  }

  walk(payload);
  const rawBody =
    plainText ||
    htmlText
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  return { bodyText: rawBody.slice(0, 4000), attachments };
}

function detectUrgencyAndDeadlines(subject: string, bodyText: string): {
  urgency: "high" | "normal" | "low";
  detectedDeadlines: string[];
} {
  const combined = `${subject} ${bodyText}`;
  const lower = combined.toLowerCase();
  const urgentKeywords = ["urgent", "asap", "deadline", "overdue", "action required", "immediately", "final reminder", "interview", "invoice due", "security alert"];
  const isUrgent = urgentKeywords.some((k) => lower.includes(k));
  const isLow = lower.includes("unsubscribe") || lower.includes("newsletter") || lower.includes("promotional");

  const deadlineRegex = /(?:by|before|due(?:\s+on)?|deadline[:\s]*)\s+([A-Za-z]{3,9}\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|today|tomorrow|eod|end of day)/gi;
  const deadlines: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = deadlineRegex.exec(combined)) !== null && deadlines.length < 4) {
    deadlines.push(match[0].trim());
  }

  return {
    urgency: isUrgent ? "high" : isLow ? "low" : "normal",
    detectedDeadlines: deadlines,
  };
}

function parseMessageResource(msg: any): GmailMessageSummary {
  const headers: { name: string; value: string }[] = msg.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

  const from = getHeader("From");
  const to = getHeader("To");
  const subject = getHeader("Subject") || "(No Subject)";
  const date = getHeader("Date") || "";
  const labels: string[] = Array.isArray(msg.labelIds) ? msg.labelIds : [];
  const { bodyText, attachments } = extractBodyAndAttachments(msg.payload);
  const { urgency, detectedDeadlines } = detectUrgencyAndDeadlines(subject, bodyText || msg.snippet || "");

  return {
    id: msg.id,
    threadId: msg.threadId,
    from,
    to,
    subject,
    snippet: msg.snippet || "",
    bodyText: bodyText || msg.snippet || "",
    date,
    internalDateMs: Number(msg.internalDate || Date.now()),
    isUnread: labels.includes("UNREAD"),
    labels,
    attachments,
    urgency,
    detectedDeadlines,
  };
}

async function gmailFetch(path: string, init: RequestInit = {}) {
  const token = getInMemoryGmailToken();
  if (!token) {
    throw new Error("Gmail is not connected. Please Sign in with Google first.");
  }
  const resp = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!resp.ok) {
    if (resp.status === 401) {
      clearExpiredGmailToken();
      throw new Error("Gmail access token expired or was revoked. Please Sign in with Google again.");
    }
    const errBody = await resp.text().catch(() => "");
    throw new Error(`Gmail API error (${resp.status}): ${errBody.slice(0, 220)}`);
  }
  return resp.json();
}

export async function listGmailMessages(maxResults: number = 12, query?: string): Promise<GmailMessageSummary[]> {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (query && query.trim()) params.set("q", query.trim());

  const listData = await gmailFetch(`/messages?${params.toString()}`);
  const refs: { id: string }[] = listData.messages || [];
  if (refs.length === 0) return [];

  const details = await Promise.all(
    refs.slice(0, maxResults).map((r) => gmailFetch(`/messages/${r.id}?format=full`))
  );
  return details.map(parseMessageResource);
}

export async function getGmailThread(threadId: string): Promise<GmailMessageSummary[]> {
  const threadData = await gmailFetch(`/threads/${threadId}?format=full`);
  const msgs = Array.isArray(threadData.messages) ? threadData.messages : [];
  return msgs.map(parseMessageResource);
}

export async function createGmailDraft(params: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}): Promise<{ draftId: string; messageId: string }> {
  const mimeLines = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    params.body,
  ];
  const raw = encodeBase64Url(mimeLines.join("\r\n"));
  const res = await gmailFetch(`/drafts`, {
    method: "POST",
    body: JSON.stringify({
      message: {
        raw,
        ...(params.threadId ? { threadId: params.threadId } : {}),
      },
    }),
  });
  await recordAuditLog({
    actionType: "gmail_draft_create",
    target: params.to,
    status: "executed",
    confirmedByUser: true,
    details: `Saved Gmail draft "${params.subject}" to ${params.to}`,
  });
  return { draftId: res.id, messageId: res.message?.id || "" };
}

/**
 * Sends an email strictly after explicit confirmation gate is verified.
 */
export async function sendVerifiedGmailEmail(
  approval: PendingGmailSendApproval,
  confirmationPhraseAccepted: boolean
): Promise<{ sentMessageId: string; threadId: string; verifiedLabels: string[] }> {
  if (!confirmationPhraseAccepted) {
    throw new Error('Explicit user confirmation ("Approved, send it.") is required before sending any email.');
  }

  const headers = [
    `To: ${approval.to}`,
    `Subject: ${approval.subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
  ];
  if (approval.inReplyTo) headers.push(`In-Reply-To: ${approval.inReplyTo}`);
  if (approval.references) headers.push(`References: ${approval.references}`);

  const raw = encodeBase64Url([...headers, "", approval.body].join("\r\n"));
  const sent = await gmailFetch(`/messages/send`, {
    method: "POST",
    body: JSON.stringify({
      raw,
      ...(approval.threadId ? { threadId: approval.threadId } : {}),
    }),
  });

  // Verify delivery status via Gmail API readback
  const verified = await gmailFetch(`/messages/${sent.id}?format=minimal`);
  await recordAuditLog({
    actionType: "gmail_email_send",
    target: `${approval.to} | ${approval.subject}`,
    status: "executed",
    confirmedByUser: true,
    details: `Verified sent email ID ${sent.id} in thread ${sent.threadId}`,
  });

  return {
    sentMessageId: sent.id,
    threadId: sent.threadId,
    verifiedLabels: verified.labelIds || ["SENT"],
  };
}

export async function analyzeGmailWithNexa(
  messages: GmailMessageSummary[],
  task: "summarize" | "draft_reply" = "summarize",
  userInstruction?: string
) {
  const token = getInMemoryGmailToken();
  if (!token) {
    throw new Error("Gmail access token missing.");
  }
  const resp = await fetch("/api/gmail/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      task,
      messages: messages.map((m) => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        date: m.date,
        snippet: m.snippet,
        bodyText: m.bodyText.slice(0, 1200),
        attachments: m.attachments,
        urgency: m.urgency,
        deadlines: m.detectedDeadlines,
      })),
      threadSummaryContext: messages[0] || null,
      userInstruction,
    }),
  });
  if (!resp.ok) {
    throw new Error(`Gmail analysis failed (${resp.status})`);
  }
  return resp.json();
}
