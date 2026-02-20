import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDb, withTransaction } from "@/lib/db";
import { ensureAgent } from "@/lib/services/agentService";
import type { TaskStatus, Tier } from "@/lib/state-types";

export type TaskItem = {
  id: string;
  title: string;
  tier: Tier;
  status: TaskStatus;
  owner: string;
  deadline?: string;
  blocker?: string;
  nextAction?: string;
  updatedAt?: string;
  agentId?: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  tier: Tier;
  status: TaskStatus;
  owner: string;
  deadline: string | null;
  blocker: string | null;
  next_action: string | null;
  updated_at: string;
  agent_id: string | null;
};

let seeded = false;

const fallbackSeed: TaskItem[] = [
  {
    id: "task-seed",
    title: "Ship Tier-1 Mission Control surfaces",
    tier: "Tier 1",
    status: "doing",
    owner: "Operator",
    deadline: new Date(Date.now() + 86400000).toISOString(),
    blocker: "",
    nextAction: "Implement task board + memory + team + calendar reliability",
    updatedAt: new Date().toISOString(),
  },
];

function toTaskItem(row: TaskRow): TaskItem {
  return {
    id: row.id,
    title: row.title,
    tier: row.tier,
    status: row.status,
    owner: row.owner,
    deadline: row.deadline ?? "",
    blocker: row.blocker ?? "",
    nextAction: row.next_action ?? "",
    updatedAt: row.updated_at,
    agentId: row.agent_id,
  };
}

function loadLegacySeed(): TaskItem[] {
  const legacyPath = path.join(process.cwd(), "data", "tasks.json");
  if (!existsSync(legacyPath)) return fallbackSeed;

  try {
    const raw = readFileSync(legacyPath, "utf8");
    const parsed = JSON.parse(raw) as TaskItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) return fallbackSeed;
    return parsed;
  } catch {
    return fallbackSeed;
  }
}

function ensureSeeded(): void {
  if (seeded) return;

  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS count FROM tasks").get() as { count: number };
  if (row.count === 0) {
    const seed = loadLegacySeed();
    const insert = db.prepare(
      `INSERT INTO tasks (id, title, tier, status, owner, deadline, blocker, next_action, updated_at, agent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const task of seed) {
      const agentId = ensureAgent(task.owner, "system");
      insert.run(
        task.id,
        task.title,
        task.tier,
        task.status,
        task.owner,
        task.deadline ?? null,
        task.blocker ?? null,
        task.nextAction ?? null,
        task.updatedAt ?? new Date().toISOString(),
        agentId,
      );
    }
  }

  seeded = true;
}

export function listTasks(): TaskItem[] {
  ensureSeeded();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, title, tier, status, owner, deadline, blocker, next_action, updated_at, agent_id
       FROM tasks
       ORDER BY datetime(updated_at) DESC`
    )
    .all() as TaskRow[];

  return rows.map(toTaskItem);
}

export function replaceTasks(tasks: TaskItem[]): TaskItem[] {
  ensureSeeded();

  withTransaction(() => {
    const db = getDb();
    const seen = new Set(tasks.map((task) => task.id));

    const upsert = db.prepare(
      `INSERT INTO tasks (id, title, tier, status, owner, deadline, blocker, next_action, updated_at, agent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         tier = excluded.tier,
         status = excluded.status,
         owner = excluded.owner,
         deadline = excluded.deadline,
         blocker = excluded.blocker,
         next_action = excluded.next_action,
         updated_at = excluded.updated_at,
         agent_id = excluded.agent_id`
    );

    for (const task of tasks) {
      const agentId = task.agentId ?? ensureAgent(task.owner, "system");
      upsert.run(
        task.id,
        task.title,
        task.tier,
        task.status,
        task.owner,
        task.deadline ?? null,
        task.blocker ?? null,
        task.nextAction ?? null,
        task.updatedAt ?? new Date().toISOString(),
        agentId,
      );
    }

    const allIds = db.prepare("SELECT id FROM tasks").all() as Array<{ id: string }>;
    const remove = db.prepare("DELETE FROM tasks WHERE id = ?");
    for (const row of allIds) {
      if (!seen.has(row.id)) remove.run(row.id);
    }
  });

  return listTasks();
}
