import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

type RunResult = {
  changes: number;
  lastInsertRowid?: number | bigint;
};

type Statement = {
  run: (...params: unknown[]) => RunResult;
  get: <T = unknown>(...params: unknown[]) => T | undefined;
  all: <T = unknown>(...params: unknown[]) => T[];
};

type DatabaseSync = {
  prepare: (sql: string) => Statement;
  exec: (sql: string) => void;
};

type DatabaseSyncConstructor = new (path: string) => DatabaseSync;

const require = createRequire(import.meta.url);

let dbInstance: DatabaseSync | null = null;

function getDatabaseSyncConstructor(): DatabaseSyncConstructor {
  try {
    const sqliteModule = require("node:sqlite") as { DatabaseSync?: DatabaseSyncConstructor };
    if (sqliteModule.DatabaseSync) {
      return sqliteModule.DatabaseSync;
    }
  } catch {
    // Ignore and try better-sqlite3 fallback.
  }

  try {
    const betterSqlite3Module = require("better-sqlite3") as
      | DatabaseSyncConstructor
      | { default?: DatabaseSyncConstructor };
    const constructor =
      typeof betterSqlite3Module === "function" ? betterSqlite3Module : betterSqlite3Module.default;
    if (constructor) {
      return constructor;
    }
  } catch {
    // Fall through to throw a friendlier error.
  }

  throw new Error(
    `No compatible SQLite driver is available in this Node.js runtime (${process.version}). ` +
      "Enable node:sqlite or install better-sqlite3.",
  );
}

function hasColumn(db: DatabaseSync, tableName: string, columnName: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function addColumnIfMissing(db: DatabaseSync, tableName: string, sqlFragment: string, columnName: string): void {
  if (hasColumn(db, tableName, columnName)) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${sqlFragment}`);
}

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
        trace_id TEXT,
        agent_id TEXT
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

function migratePhase2(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL DEFAULT 'system',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      tier TEXT NOT NULL CHECK (tier IN ('Tier 1', 'Tier 2', 'Tier 3')),
      status TEXT NOT NULL CHECK (status IN ('inbox', 'planned', 'doing', 'blocked', 'review', 'done')),
      owner TEXT NOT NULL,
      deadline TEXT,
      blocker TEXT,
      next_action TEXT,
      updated_at TEXT NOT NULL,
      agent_id TEXT REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS units (
      code TEXT PRIMARY KEY,
      codename TEXT NOT NULL,
      icon TEXT NOT NULL,
      tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
      reports_to TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS live_snapshots (
      id TEXT PRIMARY KEY,
      generated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resource_ledger (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL CHECK (category IN ('tokens', 'cron', 'failure', 'retry', 'baseline')),
      label TEXT NOT NULL,
      tokens_in INTEGER NOT NULL DEFAULT 0,
      tokens_out INTEGER NOT NULL DEFAULT 0,
      usage_estimate_usd REAL NOT NULL DEFAULT 0,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_live_snapshots_generated_at ON live_snapshots(generated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_resource_ledger_created_at ON resource_ledger(created_at DESC);
  `);

  addColumnIfMissing(db, "approvals", "agent_id TEXT REFERENCES agents(id)", "agent_id");
  addColumnIfMissing(db, "events", "agent_id TEXT REFERENCES agents(id)", "agent_id");
}

function initDb(): DatabaseSync {
  const dbDir = path.join(process.cwd(), "db");
  const dbPath = path.join(dbDir, "mission-control.sqlite");
  const schemaPath = path.join(dbDir, "schema.sql");

  mkdirSync(dbDir, { recursive: true });
  const DatabaseSyncImpl = getDatabaseSyncConstructor();
  const db = new DatabaseSyncImpl(dbPath);

  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file missing at ${schemaPath}`);
  }

  const schemaSql = readFileSync(schemaPath, "utf8");
  db.exec(schemaSql);
  migrateEventsTable(db);
  migratePhase2(db);

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
