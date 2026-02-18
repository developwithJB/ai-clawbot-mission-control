import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readEvents } from "@/lib/events";
import { readRepoGraph } from "@/lib/repositories";
import { readApprovals } from "@/lib/approvals";
import { rankTasks, readTasks } from "@/lib/tasks";
import { scorePrReadiness } from "@/lib/pr-risk";
import { detectWrenchTriggers } from "@/lib/unit-governance";
import { listRecentTelegramOutbox } from "@/lib/services/telegramService";

type EventItem = {
  id: string;
  agent: string;
  pipeline: "A" | "B" | "C" | "D";
  type: "decision" | "delivery" | "integration" | "approval" | "approval_decided";
  summary: string;
  timestamp: string;
  approvalId?: string | null;
  previousStatus?: "pending" | "approved" | "rejected" | null;
  newStatus?: "pending" | "approved" | "rejected" | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  requestId?: string | null;
  traceId?: string | null;
};

const execFileAsync = promisify(execFile);

type GitHubItem = { number: number; title: string; url: string; labels?: { name: string }[] };

type AskImpact = "Revenue" | "Stability" | "Growth" | "Governance";
type AskType = "approval" | "blocker" | "wrench";

export type LiveOpsSnapshot = {
  github: {
    openIssues: GitHubItem[];
    openPrs: GitHubItem[];
    status: "ok" | "degraded";
    error?: string;
  };
  approvals: { id: string; item: string; reason: string; level: "High" | "Medium"; status: "pending" | "approved" | "rejected"; version: number; createdAt: string }[];
  shippedToday: { who: string; summary: string; when: string }[];
  top3: { title: string; tier: "Tier 1" | "Tier 2" | "Tier 3"; why: string }[];
  events: EventItem[];
  rankedTasks: { id: string; title: string; tier: "Tier 1" | "Tier 2" | "Tier 3"; status: "inbox" | "planned" | "doing" | "blocked" | "review" | "done"; owner: string; createdAt?: string; updatedAt?: string }[];
  prReadiness: { number: number; title: string; url: string; risk: "Low" | "Medium" | "High"; reason: string }[];
  repoGraph: {
    repositories: {
      id: string;
      name: string;
      url: string;
      tier: "Tier 1" | "Tier 2" | "Tier 3";
      status: "active" | "pending-access" | "paused";
      health: "green" | "yellow" | "red";
    }[];
    dependencies: {
      from: string;
      to: string;
      type: "playbook-transfer" | "blocked-by" | "feeds";
      note: string;
    }[];
  };
  unitBoard: {
    units: {
      code: string;
      codename: string;
      icon: string;
      status: "Idle" | "Working" | "Blocked" | "Needs JB" | "Waiting approval";
      objective: string;
      tier: 1 | 2 | 3;
      lastUpdate: string;
      nextOwner: string;
    }[];
    wrenchChips: { reason: string; lane: string }[];
    telegramFeed: { id: string; type: string; status: "queued" | "sent" | "failed"; message: string; createdAt: string }[];
  };
  asks: {
    cap: number;
    total: number;
    overflow: number;
    items: {
      id: string;
      type: AskType;
      title: string;
      detail: string;
      impact: AskImpact;
      requiredBy: string;
      approvalId?: string;
      blockerTaskId?: string;
      objection?: string;
    }[];
  };
  sla: {
    approvals: { oldestHours: number; status: "ok" | "warn" | "breach" };
    blockers: { oldestHours: number; status: "ok" | "warn" | "breach" };
  };
};

async function ghJson<T>(args: string[]): Promise<{ data: T | null; error?: string }> {
  try {
    const { stdout } = await execFileAsync("gh", args, { timeout: 7000 });
    return { data: JSON.parse(stdout) as T };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Unknown GitHub error" };
  }
}

function hoursSince(iso?: string): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
}

function toSlaStatus(hours: number, warnAt: number, breachAt: number): "ok" | "warn" | "breach" {
  if (hours >= breachAt) return "breach";
  if (hours >= warnAt) return "warn";
  return "ok";
}

export async function getLiveOpsSnapshot(): Promise<LiveOpsSnapshot> {
  const [issueRes, prRes, events, repoGraph, approvals, tasks] = await Promise.all([
    ghJson<GitHubItem[]>([
      "issue", "list", "--repo", "developwithJB/thecontrollables", "--state", "open", "--limit", "10", "--json", "number,title,url,labels",
    ]),
    ghJson<GitHubItem[]>([
      "pr", "list", "--repo", "developwithJB/thecontrollables", "--state", "open", "--limit", "10", "--json", "number,title,url,labels",
    ]),
    readEvents(),
    readRepoGraph(),
    readApprovals(),
    readTasks(),
  ]);

  const rankedTasks = rankTasks(tasks);
  const seededTop3: LiveOpsSnapshot["top3"] = [
    { title: "Finalize Haushavn repo handoff checklist", tier: "Tier 1", why: "Removes blocker for core MVP execution next week." },
    { title: "Close Pipeline A governance issues (#11/#12/#13)", tier: "Tier 2", why: "Creates repeatable engineering operating system." },
    { title: "Define speaking/workshop outreach list", tier: "Tier 3", why: "Supports weekly win criteria and revenue-adjacent growth." },
  ];

  const hasTier1Backlog = rankedTasks.some((t) => t.tier === "Tier 1" && t.status !== "done");
  const proposesTier3 = rankedTasks.some((t) => t.tier === "Tier 3" && ["inbox", "planned", "doing"].includes(t.status));
  const parallelEpics = rankedTasks.filter((t) => t.status === "doing").length;
  const touchesSensitiveSurface = rankedTasks.some((t) => /auth|permission|payment|deploy/i.test(t.title));
  const hasUnmeasurableFeature = rankedTasks.some((t) => /feature/i.test(t.title) && !/\b(kpi|metric|outcome|target)\b/i.test(t.title));

  const wrenchChips = detectWrenchTriggers({
    hasTier1Backlog,
    proposesTier3,
    touchesSensitiveSurface,
    parallelEpics,
    hasUnmeasurableFeature,
  });

  const telegramFeed = listRecentTelegramOutbox(10).map((n) => ({
    id: n.id,
    type: n.type,
    status: n.status,
    message: n.message,
    createdAt: n.createdAt,
  }));

  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const oldestApprovalHours = pendingApprovals.length
    ? Math.max(...pendingApprovals.map((a) => hoursSince(a.createdAt)))
    : 0;

  const blockedTasks = rankedTasks.filter((t) => t.status === "blocked");
  const oldestBlockerHours = blockedTasks.length
    ? Math.max(...blockedTasks.map((t) => hoursSince(t.updatedAt ?? t.createdAt)))
    : 0;

  const rawAsks: LiveOpsSnapshot["asks"]["items"] = [
    ...pendingApprovals.map((a) => ({
      id: `ask-approval-${a.id}`,
      type: "approval" as const,
      title: `Decision needed: ${a.item}`,
      detail: `${a.reason} · risk ${a.level}`,
      impact: "Governance" as const,
      requiredBy: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      approvalId: a.id,
    })),
    ...blockedTasks.map((t) => ({
      id: `ask-blocker-${t.id}`,
      type: "blocker" as const,
      title: `Unblock: ${t.title}`,
      detail: `Owner: ${t.owner} · ${t.tier}`,
      impact: "Stability" as const,
      requiredBy: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      blockerTaskId: t.id,
    })),
    ...wrenchChips.map((w, idx) => ({
      id: `ask-wrench-${idx}`,
      type: "wrench" as const,
      title: "Wrench objection requires answer",
      detail: w.reason,
      impact: "Governance" as const,
      requiredBy: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      objection: w.reason,
    })),
  ];

  const askCap = 3;
  const asks = {
    cap: askCap,
    total: rawAsks.length,
    overflow: Math.max(0, rawAsks.length - askCap),
    items: rawAsks.slice(0, askCap),
  };

  const githubError = issueRes.error ?? prRes.error;
  const prReadiness = scorePrReadiness(prRes.data ?? []);

  return {
    github: {
      openIssues: issueRes.data ?? [],
      openPrs: prRes.data ?? [],
      status: githubError ? "degraded" : "ok",
      error: githubError,
    },
    approvals,
    shippedToday: [
      { who: "Bug Engineer", summary: "Initialized label taxonomy + seeded issues", when: "Today" },
      { who: "Operator", summary: "Created 3-day sprint + decision audit log", when: "Today" },
      { who: "Ops", summary: "Migrated morning brief delivery to Telegram", when: "Today" },
    ],
    top3: seededTop3,
    events,
    rankedTasks,
    prReadiness,
    repoGraph,
    unitBoard: {
      units: [
        { code: "PROD-1", codename: "Compass", icon: "🧭", status: "Working", objective: "Protect Tier 1 roadmap integrity", tier: 1, lastUpdate: new Date().toISOString(), nextOwner: "OPS-1" },
        { code: "OPS-1", codename: "Flow", icon: "🌊", status: "Working", objective: "Sequence sprint against Tier ladder", tier: 1, lastUpdate: new Date().toISOString(), nextOwner: "ARCH-1" },
        { code: "ARCH-1", codename: "Spine", icon: "🧬", status: "Waiting approval", objective: "Validate service boundaries", tier: 1, lastUpdate: new Date().toISOString(), nextOwner: "ENG-1" },
        { code: "ENG-1", codename: "Builder", icon: "🔨", status: "Working", objective: "Ship stable increments", tier: 1, lastUpdate: new Date().toISOString(), nextOwner: "GOV-1" },
        { code: "GOV-1", codename: "Gatekeeper", icon: "🛡", status: "Idle", objective: "Enforce sensitive action approvals", tier: 1, lastUpdate: new Date().toISOString(), nextOwner: "JB" },
        { code: "REV-1", codename: "Monetizer", icon: "💰", status: "Idle", objective: "Model monetization on shipped value", tier: 2, lastUpdate: new Date().toISOString(), nextOwner: "GTM-1" },
        { code: "GTM-1", codename: "Amplifier", icon: "📣", status: "Idle", objective: "Distribute validated outcomes", tier: 2, lastUpdate: new Date().toISOString(), nextOwner: "REV-1" },
        { code: "CONTRA-1", codename: "Wrench", icon: "🧨", status: wrenchChips.length ? "Working" : "Idle", objective: "Stress-test plan quality and tier proof", tier: 1, lastUpdate: new Date().toISOString(), nextOwner: wrenchChips.length ? "PROD-1" : "OPS-1" },
      ],
      wrenchChips,
      telegramFeed,
    },
    asks,
    sla: {
      approvals: { oldestHours: oldestApprovalHours, status: toSlaStatus(oldestApprovalHours, 8, 24) },
      blockers: { oldestHours: oldestBlockerHours, status: toSlaStatus(oldestBlockerHours, 6, 18) },
    },
  };
}
