import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";

type AgentKind = "system" | "unit" | "human";

export type Agent = {
  id: string;
  name: string;
  kind: AgentKind;
  active: boolean;
  createdAt: string;
};

function agentIdForName(name: string): string {
  const key = name.trim().toLowerCase();
  return `agt-${createHash("sha1").update(key).digest("hex").slice(0, 12)}`;
}

export function ensureAgent(name: string, kind: AgentKind = "system"): string {
  const normalizedName = name.trim();
  const id = agentIdForName(normalizedName);
  const now = new Date().toISOString();
  const db = getDb();

  db.prepare(
    `INSERT OR IGNORE INTO agents (id, name, kind, active, created_at)
     VALUES (?, ?, ?, 1, ?)`
  ).run(id, normalizedName, kind, now);

  return id;
}

export function listAgents(): Agent[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, kind, active, created_at AS createdAt
       FROM agents
       ORDER BY datetime(created_at) ASC`
    )
    .all() as Array<{ id: string; name: string; kind: AgentKind; active: number; createdAt: string }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    active: Boolean(row.active),
    createdAt: row.createdAt,
  }));
}
