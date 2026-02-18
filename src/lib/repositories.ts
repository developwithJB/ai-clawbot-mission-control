import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type RepoHealth = "green" | "yellow" | "red";
export type RepoStatus = "active" | "pending-access" | "paused";

export type RepoNode = {
  id: string;
  name: string;
  url: string;
  tier: "Tier 1" | "Tier 2" | "Tier 3";
  status: RepoStatus;
  health: RepoHealth;
};

export type RepoDependency = {
  from: string;
  to: string;
  type: "playbook-transfer" | "blocked-by" | "feeds";
  note: string;
};

export type RepoGraph = {
  repositories: RepoNode[];
  dependencies: RepoDependency[];
};

const filePath = path.join(process.cwd(), "data", "repositories.json");

const seedGraph: RepoGraph = {
  repositories: [
    {
      id: "dashboard",
      name: "The Dashboard / The Controllables",
      url: "https://github.com/developwithJB/thecontrollables",
      tier: "Tier 3",
      status: "active",
      health: "green",
    },
  ],
  dependencies: [],
};

export async function readRepoGraph(): Promise<RepoGraph> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as RepoGraph;
  } catch {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(seedGraph, null, 2));
    return seedGraph;
  }
}
