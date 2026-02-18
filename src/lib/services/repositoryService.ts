import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDb, withTransaction } from "@/lib/db";

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

let seeded = false;

const fallbackSeed: RepoGraph = {
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

function loadLegacySeed(): RepoGraph {
  const legacyPath = path.join(process.cwd(), "data", "repositories.json");
  if (!existsSync(legacyPath)) return fallbackSeed;

  try {
    const raw = readFileSync(legacyPath, "utf8");
    const parsed = JSON.parse(raw) as RepoGraph;
    if (!parsed?.repositories || !Array.isArray(parsed.repositories)) return fallbackSeed;
    return {
      repositories: parsed.repositories,
      dependencies: Array.isArray(parsed.dependencies) ? parsed.dependencies : [],
    };
  } catch {
    return fallbackSeed;
  }
}

function ensureSeeded(): void {
  if (seeded) return;

  const db = getDb();
  const repoCount = db.prepare("SELECT COUNT(*) AS count FROM repositories").get() as { count: number };
  if (repoCount.count === 0) {
    const seed = loadLegacySeed();

    withTransaction(() => {
      const insertRepo = db.prepare(
        `INSERT INTO repositories (id, name, url, tier, status, health)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      const insertDep = db.prepare(
        `INSERT INTO repository_dependencies (id, from_repo, to_repo, type, note)
         VALUES (?, ?, ?, ?, ?)`
      );

      for (const repo of seed.repositories) {
        insertRepo.run(repo.id, repo.name, repo.url, repo.tier, repo.status, repo.health);
      }

      for (const [index, dep] of seed.dependencies.entries()) {
        insertDep.run(`dep-${index + 1}`, dep.from, dep.to, dep.type, dep.note);
      }
    });
  }

  seeded = true;
}

export function readRepoGraph(): RepoGraph {
  ensureSeeded();
  const db = getDb();

  const repositories = db
    .prepare(
      `SELECT id, name, url, tier, status, health
       FROM repositories
       ORDER BY name ASC`
    )
    .all() as RepoNode[];

  const dependencies = db
    .prepare(
      `SELECT from_repo AS "from", to_repo AS "to", type, note
       FROM repository_dependencies`
    )
    .all() as RepoDependency[];

  return { repositories, dependencies };
}
