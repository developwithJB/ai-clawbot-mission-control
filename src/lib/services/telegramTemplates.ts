export type TelegramTemplateType = "approval_requested" | "approval_decided" | "daily_pulse" | "wrench_alert";

export type ApprovalRequestedPayload = {
  approvalId: string;
  title: string;
  riskLevel: "Low" | "Medium" | "High";
  tier: 1 | 2 | 3;
  requestedBy: string;
  deepLink: string;
};

export type ApprovalDecidedPayload = {
  approvalId: string;
  status: "approved" | "rejected";
  decidedBy: string;
  decidedAt: string;
  summary: string;
  deepLink?: string;
};

export type DailyPulsePayload = {
  tier1Progress: string;
  blockers: string;
  approvalsPending: number;
  repoHealthSummary: string;
  deepLink?: string;
};

export type WrenchAlertPayload = {
  objection: string;
  requiredAnswer: string;
  deepLink: string;
};

export type TelegramTemplatePayloadMap = {
  approval_requested: ApprovalRequestedPayload;
  approval_decided: ApprovalDecidedPayload;
  daily_pulse: DailyPulsePayload;
  wrench_alert: WrenchAlertPayload;
};

export function renderTelegramTemplate<T extends TelegramTemplateType>(
  type: T,
  payload: TelegramTemplatePayloadMap[T],
): string {
  switch (type) {
    case "approval_requested": {
      const p = payload as ApprovalRequestedPayload;
      return [
        "🚨 Approval requested",
        `ID: ${p.approvalId}`,
        `Title: ${p.title}`,
        `Risk: ${p.riskLevel} · Tier ${p.tier}`,
        `Requested by: ${p.requestedBy}`,
        `Open: ${p.deepLink}`,
      ].join("\n");
    }
    case "approval_decided": {
      const p = payload as ApprovalDecidedPayload;
      return [
        "✅ Approval decided",
        `ID: ${p.approvalId}`,
        `Status: ${p.status.toUpperCase()}`,
        `Decided by: ${p.decidedBy}`,
        `At: ${p.decidedAt}`,
        `Summary: ${p.summary}`,
        p.deepLink ? `Open: ${p.deepLink}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "daily_pulse": {
      const p = payload as DailyPulsePayload;
      return [
        "📊 Daily Ops Pulse",
        `Tier 1 progress: ${p.tier1Progress}`,
        `Blockers: ${p.blockers}`,
        `Approvals pending: ${p.approvalsPending}`,
        `Repo health: ${p.repoHealthSummary}`,
        p.deepLink ? `Open: ${p.deepLink}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "wrench_alert": {
      const p = payload as WrenchAlertPayload;
      return [
        "🧨 Wrench alert: Groupthink risk detected",
        `Objection: ${p.objection}`,
        `Required answer: ${p.requiredAnswer}`,
        `Review: ${p.deepLink}`,
      ].join("\n");
    }
    default:
      return "";
  }
}
