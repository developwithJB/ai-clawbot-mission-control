import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getDb, withTransaction } from "@/lib/db";
import { readEvents } from "@/lib/events";
import { readRepoGraph } from "@/lib/repositories";
import { readApprovals } from "@/lib/approvals";
import { rankTasks, readTasks } from "@/lib/tasks";
import { scorePrReadiness } from "@/lib/pr-risk";
import { detectWrenchTriggers, UNIT_REGISTRY } from "@/lib/unit-governance";
import { listRecentTelegramOutbox } from "@/lib/services/telegramService";
import { listUnits } from "@/lib/services/unitService";
import { getResourceLedgerSummary, type ResourceLedgerSummary } from "@/lib/services/resourceLedgerService";

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
  agentId?: string | null;
};

const execFileAsync = promisify(execFile);

type GitHubItem = { number: number; title: string; url: string; labels?: { name: string }[] };

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
  rankedTasks: { id: string; title: string; tier: "Tier 1" | "Tier 2" | "Tier 3"; status: "inbox" | "planned" | "doing" | "blocked" | "review" | "done"; owner: string }[];
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
  resourceLedger: ResourceLedgerSummary;
};

async function ghJson<T>(args: string[]): Promise<{ data: T | null; error?: string }> {
  try {
    const { stdout } = await execFileAsync("gh", args, { timeout: 7000 });
    return { data: JSON.parse(stdout) as T };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Unknown GitHub error" };
  }
}

function buildUnitBoard(wrenchChips: { reason: string; lane: string }[]) {
  const statusOverrides: Record<string, "Idle" | "Working" | "Blocked" | "Needs JB" | "Waiting approval"> = {
    "PROD-1": "Working",
    "OPS-1": "Working",
    "ARCH-1": "Working",
    "ENG-1": "Working",
    "GOV-1": "Idle",
    "REV-1": "Idle",
    "GTM-1": "Idle",
    "CONTRA-1": wrenchChips.length ? "Working" : "Idle",
  };

  const objectiveOverrides: Record<string, string> = {
    "PROD-1": "Protect Tier 1 roadmap integrity",
    "OPS-1": "Sequence sprint against Tier ladder",
    "ARCH-1": "Validate service boundaries (approved with conditions)",
    "ENG-1": "Ship stable increments",
    "GOV-1": "Enforce sensitive action approvals",
    "REV-1": "Model monetization on shipped value",
    "GTM-1": "Distribute validated outcomes",
    "CONTRA-1": "Stress-test plan quality and tier proof",
  };

  const nextOwnerOverrides: Record<string, string> = {
    "PROD-1": "OPS-1",
    "OPS-1": "ARCH-1",
    "ARCH-1": "ENG-1",
    "ENG-1": "GOV-1",
    "GOV-1": "JB",
    "REV-1": "GTM-1",
    "GTM-1": "REV-1",
    "CONTRA-1": wrenchChips.length ? "PROD-1" : "OPS-1",
  };

  return listUnits().map((unit) => {
    if (!UNIT_REGISTRY[unit.code]) {
      throw new Error(`Unit consistency check failed: ${unit.code} missing from UNIT_REGISTRY`);
    }

    return {
      code: unit.code,
      codename: unit.codename,
      icon: unit.icon,
      status: statusOverrides[unit.code] ?? "Idle",
      objective: objectiveOverrides[unit.code] ?? UNIT_REGISTRY[unit.code].mission,
      tier: unit.tier,
      lastUpdate: new Date().toISOString(),
      nextOwner: nextOwnerOverrides[unit.code] ?? "OPS-1",
    };
  });
}

async function generateLiveOpsSnapshot(): Promise<LiveOpsSnapshot> {
  const [issueRes, prRes, events, repoGraph, approvals, tasks, resourceLedger] = await Promise.all([
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
    getResourceLedgerSummary(),
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

  const githubError = issueRes.error ?? prRes.error;
  const prReadiness = scorePrReadiness(prRes.data ?? []);
  const units = buildUnitBoard(wrenchChips);

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
      units,
      wrenchChips,
      telegramFeed,
    },
    resourceLedger,
  };
}

const SNAPSHOT_TTL_MS = 30000;

function readCachedSnapshot(nowIso: string): LiveOpsSnapshot | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT payload_json, generated_at
       FROM live_snapshots
       ORDER BY datetime(generated_at) DESC
       LIMIT 1`
    )
    .get() as { payload_json: string; generated_at: string } | undefined;

  if (!row) return null;

  const ageMs = new Date(nowIso).valueOf() - new Date(row.generated_at).valueOf();
  if (ageMs > SNAPSHOT_TTL_MS) return null;

  try {
    return JSON.parse(row.payload_json) as LiveOpsSnapshot;
  } catch {
    return null;
  }
}

function persistSnapshot(snapshot: LiveOpsSnapshot): void {
  withTransaction(() => {
    const db = getDb();
    db.prepare(
      `INSERT INTO live_snapshots (id, generated_at, payload_json)
       VALUES (?, ?, ?)`
    ).run(randomUUID(), new Date().toISOString(), JSON.stringify(snapshot));

    const staleIds = db
      .prepare(
        `SELECT id
         FROM live_snapshots
         ORDER BY datetime(generated_at) DESC
         LIMIT -1 OFFSET 50`
      )
      .all() as Array<{ id: string }>;

    if (staleIds.length > 0) {
      const remove = db.prepare("DELETE FROM live_snapshots WHERE id = ?");
      for (const row of staleIds) remove.run(row.id);
    }
  });
}

export async function getLiveOpsSnapshot(): Promise<LiveOpsSnapshot> {
  const nowIso = new Date().toISOString();
  const cached = readCachedSnapshot(nowIso);
  if (cached) return cached;

  const snapshot = await generateLiveOpsSnapshot();
  persistSnapshot(snapshot);
  return snapshot;
}
