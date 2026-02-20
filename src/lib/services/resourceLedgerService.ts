import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";

type CronJob = {
  id: string;
  state?: { consecutiveErrors?: number; lastStatus?: string; lastRunAtMs?: number };
};

export type ResourceLedgerSummary = {
  tokenEstimate: { input: number; output: number; total: number; usageEstimateUsd: number };
  cron: { totalJobs: number; failures: number; retries: number };
  transport: { failures: number; retries: number };
  entries: {
    id: string;
    category: "tokens" | "cron" | "failure" | "retry" | "baseline";
    label: string;
    tokensIn: number;
    tokensOut: number;
    usageEstimateUsd: number;
    createdAt: string;
  }[];
};

async function readCronJobs(): Promise<CronJob[]> {
  const home = process.env.HOME;
  if (!home) return [];

  const storePath = path.join(home, ".openclaw", "cron", "jobs.json");
  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as { jobs?: CronJob[] };
    return parsed.jobs ?? [];
  } catch {
    return [];
  }
}

let seeded = false;

function ensureLedgerSeeded() {
  if (seeded) return;
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS count FROM resource_ledger").get() as { count: number };
  if (row.count === 0) {
    db.prepare(
      `INSERT INTO resource_ledger (id, category, label, tokens_in, tokens_out, usage_estimate_usd, metadata_json, created_at)
       VALUES (?, 'baseline', ?, 0, 0, 0, ?, ?)`
    ).run(
      randomUUID(),
      "Baseline assumptions: zero-cost model and no secret leakage",
      JSON.stringify({ policy: "zero-cost" }),
      new Date().toISOString(),
    );
  }

  seeded = true;
}

export async function getResourceLedgerSummary(): Promise<ResourceLedgerSummary> {
  ensureLedgerSeeded();
  const db = getDb();

  const entries = db
    .prepare(
      `SELECT id, category, label, tokens_in, tokens_out, usage_estimate_usd, created_at
       FROM resource_ledger
       ORDER BY datetime(created_at) DESC
       LIMIT 20`
    )
    .all() as Array<{
    id: string;
    category: "tokens" | "cron" | "failure" | "retry" | "baseline";
    label: string;
    tokens_in: number;
    tokens_out: number;
    usage_estimate_usd: number;
    created_at: string;
  }>;

  const tokenAgg = db
    .prepare(
      `SELECT
         COALESCE(SUM(tokens_in), 0) AS input,
         COALESCE(SUM(tokens_out), 0) AS output,
         COALESCE(SUM(usage_estimate_usd), 0) AS usage
       FROM resource_ledger`
    )
    .get() as { input: number; output: number; usage: number };

  const outboxAgg = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failures,
         COALESCE(SUM(CASE WHEN attempts > 1 THEN attempts - 1 ELSE 0 END), 0) AS retries
       FROM telegram_outbox`
    )
    .get() as { failures: number; retries: number };

  const cronJobs = await readCronJobs();
  const cronFailures = cronJobs.filter((job) => (job.state?.consecutiveErrors ?? 0) > 0).length;
  const cronRetries = cronJobs.reduce((sum, job) => sum + Math.max((job.state?.consecutiveErrors ?? 0) - 1, 0), 0);

  return {
    tokenEstimate: {
      input: tokenAgg.input,
      output: tokenAgg.output,
      total: tokenAgg.input + tokenAgg.output,
      usageEstimateUsd: 0,
    },
    cron: {
      totalJobs: cronJobs.length,
      failures: cronFailures,
      retries: cronRetries,
    },
    transport: {
      failures: outboxAgg.failures,
      retries: outboxAgg.retries,
    },
    entries: entries.map((entry) => ({
      id: entry.id,
      category: entry.category,
      label: entry.label,
      tokensIn: entry.tokens_in,
      tokensOut: entry.tokens_out,
      usageEstimateUsd: 0,
      createdAt: entry.created_at,
    })),
  };
}
