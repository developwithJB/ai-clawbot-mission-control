import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readEvents } from "@/lib/events";
import { readRepoGraph } from "@/lib/repositories";
import { readApprovals } from "@/lib/approvals";
import { rankTasks, readTasks } from "@/lib/tasks";

type EventItem = {
  id: string;
  agent: string;
  pipeline: "A" | "B" | "C" | "D";
  type: "decision" | "delivery" | "integration" | "approval";
  summary: string;
  timestamp: string;
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
  approvals: { id: string; item: string; reason: string; level: "High" | "Medium"; status: "pending" | "approved" | "rejected" }[];
  shippedToday: { who: string; summary: string; when: string }[];
  top3: { title: string; tier: "Tier 1" | "Tier 2" | "Tier 3"; why: string }[];
  events: EventItem[];
  rankedTasks: { id: string; title: string; tier: "Tier 1" | "Tier 2" | "Tier 3"; status: "inbox" | "planned" | "doing" | "blocked" | "review" | "done"; owner: string }[];
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
};

async function ghJson<T>(args: string[]): Promise<{ data: T | null; error?: string }> {
  try {
    const { stdout } = await execFileAsync("gh", args, { timeout: 7000 });
    return { data: JSON.parse(stdout) as T };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Unknown GitHub error" };
  }
}

export async function getLiveOpsSnapshot(): Promise<LiveOpsSnapshot> {
  const [issueRes, prRes, events, repoGraph, approvals, tasks] = await Promise.all([
    ghJson<GitHubItem[]>([
      "issue",
      "list",
      "--repo",
      "developwithJB/thecontrollables",
      "--state",
      "open",
      "--limit",
      "10",
      "--json",
      "number,title,url,labels",
    ]),
    ghJson<GitHubItem[]>([
      "pr",
      "list",
      "--repo",
      "developwithJB/thecontrollables",
      "--state",
      "open",
      "--limit",
      "10",
      "--json",
      "number,title,url,labels",
    ]),
    readEvents(),
    readRepoGraph(),
    readApprovals(),
    readTasks(),
  ]);

  const seededTop3: LiveOpsSnapshot["top3"] = [
    {
      title: "Finalize Haushavn repo handoff checklist",
      tier: "Tier 1",
      why: "Removes blocker for core MVP execution next week.",
    },
    {
      title: "Close Pipeline A governance issues (#11/#12/#13)",
      tier: "Tier 2",
      why: "Creates repeatable engineering operating system.",
    },
    {
      title: "Define speaking/workshop outreach list",
      tier: "Tier 3",
      why: "Supports weekly win criteria and revenue-adjacent growth.",
    },
  ];

  const githubError = issueRes.error ?? prRes.error;

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
    rankedTasks: rankTasks(tasks),
    repoGraph,
  };
}
