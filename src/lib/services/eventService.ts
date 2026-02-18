import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDb, withTransaction } from "@/lib/db";

export type EventItem = {
  id: string;
  agent: string;
  pipeline: "A" | "B" | "C" | "D";
  type: "decision" | "delivery" | "integration" | "approval";
  summary: string;
  timestamp: string;
};

type EventRow = EventItem;

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
      `INSERT INTO events (id, agent, pipeline, type, summary, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    for (const event of loadLegacySeed()) {
      insert.run(event.id, event.agent, event.pipeline, event.type, event.summary, event.timestamp);
    }
  }

  seeded = true;
}

export function listEvents(limit = 200): EventItem[] {
  ensureSeeded();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, agent, pipeline, type, summary, timestamp
       FROM events
       ORDER BY datetime(timestamp) DESC
       LIMIT ?`
    )
    .all(limit) as EventRow[];

  return rows;
}

export function appendEvent(event: EventItem): void {
  ensureSeeded();

  withTransaction(() => {
    const db = getDb();
    db.prepare(
      `INSERT INTO events (id, agent, pipeline, type, summary, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(event.id, event.agent, event.pipeline, event.type, event.summary, event.timestamp);

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
