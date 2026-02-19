import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

let dbInstance: DatabaseSync | null = null;

function migrateEventsTable(db: DatabaseSync) {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'events'")
    .get() as { sql?: string } | undefined;

  const createSql = row?.sql ?? "";
  if (createSql.includes("approval_decided") && createSql.includes("request_id") && createSql.includes("trace_id")) {
    return;
  }

  db.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS events_v2 (
        id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        pipeline TEXT NOT NULL CHECK (pipeline IN ('A', 'B', 'C', 'D')),
        type TEXT NOT NULL CHECK (type IN ('decision', 'delivery', 'integration', 'approval', 'approval_decided')),
        summary TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        approval_id TEXT,
        previous_status TEXT CHECK (previous_status IN ('pending', 'approved', 'rejected')),
        new_status TEXT CHECK (new_status IN ('pending', 'approved', 'rejected')),
        decided_by TEXT,
        decided_at TEXT,
        request_id TEXT,
        trace_id TEXT
      );

      INSERT INTO events_v2 (id, agent, pipeline, type, summary, timestamp)
      SELECT id, agent, pipeline, type, summary, timestamp FROM events;

      DROP TABLE events;
      ALTER TABLE events_v2 RENAME TO events;
    `);

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function initDb(): DatabaseSync {
  const dbDir = path.join(process.cwd(), "db");
  const dbPath = path.join(dbDir, "mission-control.sqlite");
  const schemaPath = path.join(dbDir, "schema.sql");

  mkdirSync(dbDir, { recursive: true });
  const db = new DatabaseSync(dbPath);

  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file missing at ${schemaPath}`);
  }

  const schemaSql = readFileSync(schemaPath, "utf8");
  db.exec(schemaSql);
  migrateEventsTable(db);

  return db;
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = initDb();
  }
  return dbInstance;
}

export function withTransaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
