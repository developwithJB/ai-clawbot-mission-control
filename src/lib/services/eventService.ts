import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDb, withTransaction } from "@/lib/db";
import { ensureAgent } from "@/lib/services/agentService";

export type EventItem = {
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

type EventRow = {
  id: string;
  agent: string;
  pipeline: "A" | "B" | "C" | "D";
  type: "decision" | "delivery" | "integration" | "approval" | "approval_decided";
  summary: string;
  timestamp: string;
  approval_id: string | null;
  previous_status: "pending" | "approved" | "rejected" | null;
  new_status: "pending" | "approved" | "rejected" | null;
  decided_by: string | null;
  decided_at: string | null;
  request_id: string | null;
  trace_id: string | null;
  agent_id: string | null;
};

let seeded = false;

const fallbackSeed: EventItem[] = [
  {
    id: "evt-seed",
    agent: "Operator",
    pipeline: "D",
    type: "decision",
    summary: "Event timeline initialized",
    timestamp: new Date().toISOString(),
  },
];

function toEventItem(row: EventRow): EventItem {
  return {
    id: row.id,
    agent: row.agent,
    pipeline: row.pipeline,
    type: row.type,
    summary: row.summary,
    timestamp: row.timestamp,
    approvalId: row.approval_id,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    requestId: row.request_id,
    traceId: row.trace_id,
    agentId: row.agent_id,
  };
}

function loadLegacySeed(): EventItem[] {
  const legacyPath = path.join(process.cwd(), "data", "events.json");
  if (!existsSync(legacyPath)) return fallbackSeed;

  try {
    const raw = readFileSync(legacyPath, "utf8");
    const parsed = JSON.parse(raw) as EventItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) return fallbackSeed;
    return parsed;
  } catch {
    return fallbackSeed;
  }
}

function ensureSeeded(): void {
  if (seeded) return;

  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS count FROM events").get() as { count: number };
  if (row.count === 0) {
    const insert = db.prepare(
      `INSERT INTO events (id, agent, pipeline, type, summary, timestamp, agent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    for (const event of loadLegacySeed()) {
      insert.run(
        event.id,
        event.agent,
        event.pipeline,
        event.type,
        event.summary,
        event.timestamp,
        ensureAgent(event.agent, "system"),
      );
    }
  }

  seeded = true;
}

export function listEvents(limit = 200): EventItem[] {
  ensureSeeded();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, agent, pipeline, type, summary, timestamp,
              approval_id, previous_status, new_status, decided_by, decided_at, request_id, trace_id, agent_id
       FROM events
       ORDER BY datetime(timestamp) DESC
       LIMIT ?`
    )
    .all(limit) as EventRow[];

  return rows.map(toEventItem);
}

export function appendEvent(event: EventItem): void {
  ensureSeeded();

  withTransaction(() => {
    const db = getDb();
    db.prepare(
      `INSERT INTO events (
          id, agent, pipeline, type, summary, timestamp,
          approval_id, previous_status, new_status, decided_by, decided_at, request_id, trace_id, agent_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      event.id,
      event.agent,
      event.pipeline,
      event.type,
      event.summary,
      event.timestamp,
      event.approvalId ?? null,
      event.previousStatus ?? null,
      event.newStatus ?? null,
      event.decidedBy ?? null,
      event.decidedAt ?? null,
      event.requestId ?? null,
      event.traceId ?? null,
      event.agentId ?? ensureAgent(event.agent, "system"),
    );

    const staleIds = db
      .prepare(
        `SELECT id
         FROM events
         ORDER BY datetime(timestamp) DESC
         LIMIT -1 OFFSET 200`
      )
      .all() as Array<{ id: string }>;

    if (staleIds.length > 0) {
      const remove = db.prepare("DELETE FROM events WHERE id = ?");
      for (const row of staleIds) remove.run(row.id);
    }
  });
}
