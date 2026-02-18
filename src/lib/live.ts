import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readEvents } from "@/lib/events";

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
  openIssues: GitHubItem[];
  openPrs: GitHubItem[];
  approvals: { item: string; reason: string; level: "High" | "Medium" }[];
  shippedToday: { who: string; summary: string; when: string }[];
  top3: { title: string; tier: "Tier 1" | "Tier 2" | "Tier 3"; why: string }[];
  events: EventItem[];
};

async function ghJson<T>(args: string[]): Promise<T | null> {
  try {
    const { stdout } = await execFileAsync("gh", args, { timeout: 7000 });
    return JSON.parse(stdout) as T;
  } catch {
    return null;
  }
}

export async function getLiveOpsSnapshot(): Promise<LiveOpsSnapshot> {
  const [openIssues, openPrs, events] = await Promise.all([
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

  return {
    openIssues: openIssues ?? [],
    openPrs: openPrs ?? [],
    approvals: [
      { item: "Deployments", reason: "Explicit JB approval required", level: "High" },
      { item: "Outbound Messages", reason: "Explicit JB approval required", level: "High" },
      { item: "Purchases", reason: "Explicit JB approval required", level: "High" },
    ],
    shippedToday: [
      { who: "Bug Engineer", summary: "Initialized label taxonomy + seeded issues", when: "Today" },
      { who: "Operator", summary: "Created 3-day sprint + decision audit log", when: "Today" },
      { who: "Ops", summary: "Migrated morning brief delivery to Telegram", when: "Today" },
    ],
    top3: seededTop3,
    events,
  };
}
