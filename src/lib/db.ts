import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

let dbInstance: DatabaseSync | null = null;

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
