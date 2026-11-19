import { AuditLogEntry, ApiTelemetryEntry, ApiTelemetrySummary } from "../types";

export async function recordAuditLog(entry: {
  actionType: string;
  target: string;
  status: "confirmed" | "executed" | "rejected" | "failed";
  confirmedByUser: boolean;
  details: string;
}): Promise<void> {
  try {
    await fetch("/api/audit-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
  } catch (_) {}
}

export async function fetchAuditLogs(limit: number = 40): Promise<AuditLogEntry[]> {
  try {
    const res = await fetch(`/api/audit-logs?limit=${limit}`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data?.logs) ? data.logs : [];
    }
  } catch (_) {}
  return [];
}

export async function fetchApiTelemetry(limit: number = 50): Promise<{
  summary: ApiTelemetrySummary;
  recent: ApiTelemetryEntry[];
}> {
  const emptySummary: ApiTelemetrySummary = {
    totalCalls: 0,
    successCalls: 0,
    quotaLimitedCalls: 0,
    errorCalls: 0,
    fallbackCalls: 0,
    avgLatencyMs: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    knownCostUsd: null,
  };

  try {
    const res = await fetch(`/api/telemetry?limit=${limit}`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      return {
        summary: data?.summary || emptySummary,
        recent: Array.isArray(data?.recent) ? data.recent : [],
      };
    }
  } catch (_) {}
  return { summary: emptySummary, recent: [] };
}

export async function clearApiTelemetry(): Promise<boolean> {
  try {
    const res = await fetch("/api/telemetry", {
      method: "DELETE",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}
