import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

type CronJob = {
  id: string;
  name?: string;
  enabled?: boolean;
  schedule?: { kind?: string; expr?: string; tz?: string; at?: string; everyMs?: number };
  state?: { nextRunAtMs?: number; lastStatus?: string; consecutiveErrors?: number; lastError?: string; lastRunAtMs?: number };
};

function getStorePath() {
  const home = process.env.HOME;
  if (!home) return null;
  return path.join(home, ".openclaw", "cron", "jobs.json");
}

export async function GET() {
  const storePath = getStorePath();
  if (!storePath) return NextResponse.json({ jobs: [] });

  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as { jobs?: CronJob[] };
    const jobs = (parsed.jobs ?? []).map((job) => ({
      id: job.id,
      name: job.name ?? "Unnamed job",
      enabled: Boolean(job.enabled),
      schedule: job.schedule ?? {},
      nextRunAtMs: job.state?.nextRunAtMs ?? null,
      lastStatus: job.state?.lastStatus ?? null,
      consecutiveErrors: job.state?.consecutiveErrors ?? 0,
      lastError: job.state?.lastError ?? null,
      lastRunAtMs: job.state?.lastRunAtMs ?? null,
    }));
    return NextResponse.json({ jobs });
  } catch {
    return NextResponse.json({ jobs: [] });
  }
}
