import { CapabilityGapEntry, ImprovementBacklogItem, ImprovementStatus } from "../types";

export interface ImprovementDashboardData {
  backlog: ImprovementBacklogItem[];
  capabilityGaps: CapabilityGapEntry[];
  telemetrySummary: any;
  integrationStatus: {
    geminiConfigured: boolean;
    chromeExtensionConnected: boolean;
    extensionlessBrowserReady?: boolean;
    gmailOAuthConfigured: boolean;
    gmailPubSubConfigured: boolean;
  };
}

export async function fetchImprovementDashboard(): Promise<ImprovementDashboardData> {
  const resp = await fetch("/api/improvements", { signal: AbortSignal.timeout(4000) });
  if (!resp.ok) {
    throw new Error(`Failed to fetch improvement dashboard (${resp.status})`);
  }
  return resp.json();
}

export async function runSelfImprovementDiagnostic(): Promise<{
  recommendations: ImprovementBacklogItem[];
  backlog: ImprovementBacklogItem[];
  diagnostics: any;
}> {
  const resp = await fetch("/api/improvements/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!resp.ok) {
    throw new Error(`Diagnostic failed (${resp.status})`);
  }
  return resp.json();
}

export async function updateImprovementItemStatus(
  id: string,
  status: ImprovementStatus
): Promise<ImprovementBacklogItem[]> {
  const resp = await fetch(`/api/improvements/backlog/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!resp.ok) {
    throw new Error(`Failed to update backlog status (${resp.status})`);
  }
  const data = await resp.json();
  return data.backlog || [];
}

export async function addCustomImprovementItem(item: {
  proposedFeature: string;
  whyNeeded: string;
  expectedBenefit: string;
  difficulty: "Low" | "Medium" | "High";
  dependencies: string[];
  priority: "Critical" | "High" | "Medium" | "Low";
}): Promise<ImprovementBacklogItem[]> {
  const resp = await fetch("/api/improvements/backlog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...item, sourceType: "user_request", status: "Proposed" }),
  });
  if (!resp.ok) {
    throw new Error(`Failed to add improvement item (${resp.status})`);
  }
  const data = await resp.json();
  return data.backlog || [];
}

export async function reportCapabilityGap(gap: {
  commandText: string;
  intent?: string;
  reason: string;
  category?: string;
}): Promise<void> {
  try {
    await fetch("/api/improvements/gaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gap),
    });
  } catch {}
}

export function formatSelfImprovementBriefing(
  recommendations: ImprovementBacklogItem[],
  diagnostics: any
): string {
  const top = recommendations.filter((r) => r.status !== "Rejected" && r.status !== "Completed").slice(0, 4);
  if (top.length === 0) {
    return "All diagnosed upgrades are currently completed or resolved! Telemetry and integrations look healthy.";
  }

  const lines = [
    `Based on live telemetry (${diagnostics?.telemetry?.totalCalls || 0} calls, ${diagnostics?.recentErrorCount || 0} recent errors) and ${diagnostics?.gapCount || 0} logged capability gap(s), here is what I need to level up next:`,
  ];

  top.forEach((item, idx) => {
    lines.push(
      `\n${idx + 1}. Proposed feature: ${item.proposedFeature}\n   Why needed: ${item.whyNeeded}\n   Expected benefit: ${item.expectedBenefit}\n   Difficulty: ${item.difficulty} | Priority: ${item.priority} | Status: ${item.status}\n   Dependencies: ${item.dependencies.join(", ") || "None"}`
    );
  });

  lines.push(`\nOpen the Self-Improvement Backlog panel to Approve, Reject, or Track these upgrades.`);
  return lines.join("\n");
}
