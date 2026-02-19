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

type JobSchedule = { kind?: string; expr?: string; tz?: string; at?: string; everyMs?: number };

function getStorePath() {
  const home = process.env.HOME;
  if (!home) return null;
  return path.join(home, ".openclaw", "cron", "jobs.json");
}

function staleWindowMs(schedule: JobSchedule) {
  if (schedule.kind === "every" && schedule.everyMs && schedule.everyMs > 0) {
    return Math.max(schedule.everyMs * 2, 30 * 60 * 1000);
  }

  // Fallback for cron/at jobs where cadence isn't trivial to parse from expression.
  return 24 * 60 * 60 * 1000;
}

export async function GET() {
  const storePath = getStorePath();
  if (!storePath) return NextResponse.json({ jobs: [] });

  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as { jobs?: CronJob[] };
    const now = Date.now();

    const jobs = (parsed.jobs ?? []).map((job) => {
      const schedule = job.schedule ?? {};
      const nextRunAtMs = job.state?.nextRunAtMs ?? null;
      const lastRunAtMs = job.state?.lastRunAtMs ?? null;
      const consecutiveErrors = job.state?.consecutiveErrors ?? 0;
      const staleThreshold = staleWindowMs(schedule);
      const staleLastRun = lastRunAtMs ? now - lastRunAtMs > staleThreshold : false;
      const imminentNextRun = nextRunAtMs ? nextRunAtMs > now && nextRunAtMs - now <= 15 * 60 * 1000 : false;

      return {
        id: job.id,
        name: job.name ?? "Unnamed job",
        enabled: Boolean(job.enabled),
        schedule,
        nextRunAtMs,
        lastStatus: job.state?.lastStatus ?? null,
        consecutiveErrors,
        lastError: job.state?.lastError ?? null,
        lastRunAtMs,
        anomalies: {
          consecutiveFailures: consecutiveErrors >= 2,
          staleLastRun,
          imminentNextRun,
        },
      };
    });

    return NextResponse.json({ jobs, nowMs: now });
  } catch {
    return NextResponse.json({ jobs: [] });
  }
}
