#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

type Task = { id: string; title: string; tier: "Tier 1" | "Tier 2" | "Tier 3"; status: "inbox" | "planned" | "doing" | "blocked" | "review" | "done"; owner: string };
type Snapshot = {
  last_published_at: string;
  office: { units: Array<{ code: string; codename: string; status: string; tier: number; objective: string; health: "green" | "yellow" | "red" }>; health_states: { overall: "green" | "yellow" | "red"; tier1_open: number; blocked_tasks: number; pending_approvals: number } };
  tasks: { counts: Record<string, number>; by_tier: Record<string, number>; sample_titles: string[] };
  approvals: { counts: Record<string, number>; pending: Array<{ id: string; item: string; level: "High" | "Medium"; created_at: string }> };
  events: { recent: Array<{ type: string; summary: string; timestamp: string }> };
};

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

type DbLike = { exec: (sql: string) => void; prepare: (sql: string) => { all: () => unknown[] } };

function createDb(dbPath: string): DbLike {
  const require = createRequire(import.meta.url);
  try {
    const sqliteModule = require("node:sqlite") as { DatabaseSync?: new (path: string) => DbLike };
    if (sqliteModule.DatabaseSync) return new sqliteModule.DatabaseSync(dbPath);
  } catch {
    // Ignore, fallback below.
  }

  const betterSqlite = require("better-sqlite3") as ((path: string) => DbLike) | { default?: (path: string) => DbLike };
  const ctor = typeof betterSqlite === "function" ? betterSqlite : betterSqlite.default;
  if (!ctor) throw new Error("No SQLite driver available");
  return ctor(dbPath);
}

function ensureSafeMode() {
  if (process.env.SAFE_MODE !== "true") throw new Error("SAFE_MODE must be exactly true");
}

function loadTasks(filePath: string): Task[] {
  if (!existsSync(filePath)) return [];
  const tasks = JSON.parse(readFileSync(filePath, "utf8")) as Task[];
  return tasks.slice().sort((a, b) => a.id.localeCompare(b.id));
}

function scanForbidden(value: Json, cursor = "") {
  const forbiddenKeys = [/token/i, /api[_-]?key/i, /secret/i, /password/i, /file[_-]?path/i, /stack/i, /trace/i, /private[_-]?note/i, /error[_-]?blob/i];
  const forbiddenValues = [/ghp_[A-Za-z0-9]{20,}/, /\/Users\//, /Traceback \(most recent call last\)/, /Error:\s+.*\n\s+at\s+/];

  if (Array.isArray(value)) return value.forEach((v, i) => scanForbidden(v, `${cursor}[${i}]`));
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (forbiddenKeys.some((r) => r.test(k))) throw new Error(`Forbidden key in snapshot: ${cursor ? `${cursor}.` : ""}${k}`);
      scanForbidden(v as Json, cursor ? `${cursor}.${k}` : k);
    }
    return;
  }
  if (typeof value === "string" && forbiddenValues.some((r) => r.test(value))) throw new Error(`Forbidden value in snapshot at ${cursor}`);
}

function main() {
  ensureSafeMode();
  const root = process.cwd();
  const db = createDb(path.join(root, "db", "mission-control.sqlite"));
  const schemaPath = path.join(root, "db", "schema.sql");
  if (existsSync(schemaPath)) db.exec(readFileSync(schemaPath, "utf8"));
  const tasks = loadTasks(path.join(root, "data", "tasks.json"));

  let approvals = db.prepare("SELECT id, item, status, level, created_at FROM approvals ORDER BY datetime(created_at) DESC, id ASC").all() as Array<{ id: string; item: string; status: "pending" | "approved" | "rejected"; level: "High" | "Medium"; created_at: string }>;
  let events = db.prepare("SELECT type, summary, timestamp FROM events ORDER BY datetime(timestamp) DESC, id ASC LIMIT 20").all() as Array<{ type: string; summary: string; timestamp: string }>;

  if (approvals.length === 0 && existsSync(path.join(root, "data", "approvals.json"))) {
    const legacy = JSON.parse(readFileSync(path.join(root, "data", "approvals.json"), "utf8")) as Array<{ id: string; item: string; status: "pending" | "approved" | "rejected"; level: "High" | "Medium"; createdAt: string }>;
    approvals = legacy.map((a) => ({ id: a.id, item: a.item, status: a.status, level: a.level, created_at: a.createdAt }));
  }
  if (events.length === 0 && existsSync(path.join(root, "data", "events.json"))) {
    const legacy = JSON.parse(readFileSync(path.join(root, "data", "events.json"), "utf8")) as Array<{ type: string; summary: string; timestamp: string }>;
    events = legacy.slice(0, 20);
  }

  const taskCounts: Record<string, number> = { inbox: 0, planned: 0, doing: 0, blocked: 0, review: 0, done: 0, total: 0 };
  const byTier: Record<string, number> = { "Tier 1": 0, "Tier 2": 0, "Tier 3": 0 };
  for (const t of tasks) {
    taskCounts[t.status] = (taskCounts[t.status] ?? 0) + 1;
    byTier[t.tier] = (byTier[t.tier] ?? 0) + 1;
    taskCounts.total += 1;
  }

  const approvalCounts: Record<string, number> = { pending: 0, approved: 0, rejected: 0, total: approvals.length };
  for (const a of approvals) approvalCounts[a.status] = (approvalCounts[a.status] ?? 0) + 1;

  const tier1Open = tasks.filter((t) => t.tier === "Tier 1" && t.status !== "done").length;
  const blocked = taskCounts.blocked ?? 0;
  const pending = approvalCounts.pending ?? 0;
  const overall: "green" | "yellow" | "red" = blocked > 0 || pending > 3 ? "red" : tier1Open > 5 ? "yellow" : "green";

  const snapshot: Snapshot = {
    last_published_at: new Date().toISOString(),
    office: {
      units: [
        { code: "PROD-1", codename: "Compass", status: tier1Open > 0 ? "Working" : "Idle", tier: 1, objective: "Protect Tier 1 roadmap", health: overall },
        { code: "OPS-1", codename: "Flow", status: blocked > 0 ? "Blocked" : "Working", tier: 1, objective: "Move tasks through lanes", health: blocked > 0 ? "red" : "green" },
        { code: "GOV-1", codename: "Gatekeeper", status: pending > 0 ? "Waiting approval" : "Idle", tier: 1, objective: "Enforce approvals", health: pending > 0 ? "yellow" : "green" },
      ],
      health_states: { overall, tier1_open: tier1Open, blocked_tasks: blocked, pending_approvals: pending },
    },
    tasks: { counts: taskCounts, by_tier: byTier, sample_titles: tasks.slice(0, 8).map((t) => t.title) },
    approvals: { counts: approvalCounts, pending: approvals.filter((a) => a.status === "pending").slice(0, 20).map((a) => ({ id: a.id, item: a.item, level: a.level, created_at: a.created_at })) },
    events: { recent: events },
  };

  if (!snapshot.last_published_at || Number.isNaN(Date.parse(snapshot.last_published_at))) throw new Error("Invalid snapshot schema: last_published_at");
  scanForbidden(snapshot as unknown as Json);

  const outPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "data", "snapshot.generated.json");
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Snapshot generated: ${outPath}`);
}

main();
