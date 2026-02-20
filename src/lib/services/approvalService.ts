import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDb, withTransaction } from "@/lib/db";
import { ensureAgent } from "@/lib/services/agentService";
import { appendEvent } from "@/lib/services/eventService";

export type ApprovalLevel = "High" | "Medium";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ApprovalItem = {
  id: string;
  item: string;
  reason: string;
  level: ApprovalLevel;
  status: ApprovalStatus;
  version: number;
  createdAt: string;
  agentId?: string | null;
};

type ResolveResult =
  | { kind: "ok"; approval: ApprovalItem }
  | { kind: "not_found" }
  | { kind: "version_conflict"; approval: ApprovalItem };

type ApprovalRow = {
  id: string;
  item: string;
  reason: string;
  level: ApprovalLevel;
  status: ApprovalStatus;
  version: number;
  created_at: string;
  agent_id: string | null;
};

type ResolveMeta = {
  decidedBy?: string;
  requestId?: string;
  traceId?: string;
};

let seeded = false;

const fallbackSeed: Omit<ApprovalItem, "version">[] = [
  {
    id: "appr-001",
    item: "Deploy production config change",
    reason: "Gateway-level behavior adjustment requested",
    level: "High",
    status: "pending",
    createdAt: new Date().toISOString(),
  },
  {
    id: "appr-002",
    item: "Send outbound stakeholder update",
    reason: "Outbound messaging requires explicit approval",
    level: "High",
    status: "pending",
    createdAt: new Date().toISOString(),
  },
];

function toApprovalItem(row: ApprovalRow): ApprovalItem {
  return {
    id: row.id,
    item: row.item,
    reason: row.reason,
    level: row.level,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    agentId: row.agent_id,
  };
}

function loadLegacySeed(): Omit<ApprovalItem, "version">[] {
  const legacyPath = path.join(process.cwd(), "data", "approvals.json");
  if (!existsSync(legacyPath)) return fallbackSeed;

  try {
    const raw = readFileSync(legacyPath, "utf8");
    const parsed = JSON.parse(raw) as Array<{
      id: string;
      item: string;
      reason: string;
      level: ApprovalLevel;
      status: ApprovalStatus;
      createdAt: string;
    }>;
    if (!Array.isArray(parsed) || parsed.length === 0) return fallbackSeed;
    return parsed;
  } catch {
    return fallbackSeed;
  }
}

function ensureSeeded(): void {
  if (seeded) return;

  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS count FROM approvals").get() as { count: number };
  if (row.count === 0) {
    const insert = db.prepare(
      `INSERT INTO approvals (id, item, reason, level, status, version, created_at, agent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const approval of loadLegacySeed()) {
      insert.run(
        approval.id,
        approval.item,
        approval.reason,
        approval.level,
        approval.status,
        1,
        approval.createdAt,
        ensureAgent("Operator", "system"),
      );
    }
  }

  seeded = true;
}

export function listApprovals(): ApprovalItem[] {
  ensureSeeded();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, item, reason, level, status, version, created_at, agent_id
       FROM approvals
       ORDER BY datetime(created_at) DESC`
    )
    .all() as ApprovalRow[];

  return rows.map(toApprovalItem);
}

export function getApprovalById(id: string): ApprovalItem | null {
  ensureSeeded();
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, item, reason, level, status, version, created_at, agent_id
       FROM approvals
       WHERE id = ?`
    )
    .get(id) as ApprovalRow | undefined;

  return row ? toApprovalItem(row) : null;
}

export function resolveApproval(
  id: string,
  status: "approved" | "rejected",
  expectedVersion?: number,
  meta?: ResolveMeta,
): ResolveResult {
  ensureSeeded();

  const decidedAt = new Date().toISOString();

  const result = withTransaction(() => {
    const db = getDb();
    const current = db
      .prepare(
        `SELECT id, item, reason, level, status, version, created_at, agent_id
         FROM approvals
         WHERE id = ?`
      )
      .get(id) as ApprovalRow | undefined;

    if (!current) return { kind: "not_found" } as const;

    if (typeof expectedVersion === "number" && current.version !== expectedVersion) {
      return { kind: "version_conflict", approval: toApprovalItem(current) } as const;
    }

    const updateResult = db
      .prepare(
        `UPDATE approvals
         SET status = ?,
             version = version + 1,
             resolved_at = CASE WHEN ? = 'pending' THEN NULL ELSE ? END
         WHERE id = ? AND version = ?`
      )
      .run(status, status, decidedAt, id, current.version);

    if (updateResult.changes === 0) {
      const latest = db
        .prepare(
          `SELECT id, item, reason, level, status, version, created_at, agent_id
           FROM approvals
           WHERE id = ?`
        )
        .get(id) as ApprovalRow;
      return { kind: "version_conflict", approval: toApprovalItem(latest) } as const;
    }

    const updated = db
      .prepare(
        `SELECT id, item, reason, level, status, version, created_at, agent_id
         FROM approvals
         WHERE id = ?`
      )
      .get(id) as ApprovalRow;

    return {
      kind: "ok",
      approval: toApprovalItem(updated),
      previousStatus: current.status,
    } as const;
  });

  if (result.kind === "ok") {
    appendEvent({
      id: `evt-${Date.now()}`,
      agent: meta?.decidedBy ?? "system",
      pipeline: "D",
      type: "approval_decided",
      summary: `${result.previousStatus.toUpperCase()} → ${result.approval.status.toUpperCase()}: ${result.approval.item}`,
      timestamp: decidedAt,
      approvalId: result.approval.id,
      previousStatus: result.previousStatus,
      newStatus: result.approval.status,
      decidedBy: meta?.decidedBy ?? "system",
      decidedAt,
      requestId: meta?.requestId ?? null,
      traceId: meta?.traceId ?? null,
    });

    return { kind: "ok", approval: result.approval };
  }

  return result;
}
