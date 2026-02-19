"use client";

import { useEffect, useMemo, useState } from "react";

type CalendarJob = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: { kind?: string; expr?: string; tz?: string; at?: string; everyMs?: number };
  nextRunAtMs: number | null;
  lastStatus: string | null;
  consecutiveErrors?: number;
  lastError?: string | null;
  lastRunAtMs?: number | null;
  anomalies?: {
    consecutiveFailures?: boolean;
    staleLastRun?: boolean;
    imminentNextRun?: boolean;
  };
};

function scheduleText(job: CalendarJob) {
  if (job.schedule.kind === "cron") return `${job.schedule.expr ?? "cron"} (${job.schedule.tz ?? "local"})`;
  if (job.schedule.kind === "at") return `at ${job.schedule.at ?? "unknown"}`;
  if (job.schedule.kind === "every") return `every ${Math.round((job.schedule.everyMs ?? 0) / 60000)}m`;
  return "unknown";
}

function timestampText(ms: number | null | undefined) {
  if (!ms) return "n/a";
  return new Date(ms).toLocaleString("en-US", { timeZone: "America/Chicago" });
}

export function MissionCalendar() {
  const [jobs, setJobs] = useState<CalendarJob[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/cron/jobs", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { jobs?: CalendarJob[] }) => {
        if (!active) return;
        setJobs((data.jobs ?? []).filter((j) => j.enabled));
      })
      .catch(() => {
        if (!active) return;
        setJobs([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const upcoming = useMemo(
    () => [...jobs].sort((a, b) => (a.nextRunAtMs ?? Number.MAX_SAFE_INTEGER) - (b.nextRunAtMs ?? Number.MAX_SAFE_INTEGER)).slice(0, 8),
    [jobs],
  );

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">Mission Calendar</h2>
      <p className="mt-1 text-sm text-zinc-400">Upcoming scheduled automations (Alex Finn-style reliability view).</p>
      <ul className="mt-4 space-y-2 text-sm">
        {upcoming.map((job) => (
          <li key={job.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-zinc-100">{job.name}</p>
              <span className={`text-xs ${job.lastStatus === "error" ? "text-rose-300" : "text-zinc-400"}`}>{job.lastStatus ?? "unknown"}</span>
            </div>
            <p className="mt-1 text-zinc-300">{scheduleText(job)}</p>
            <p className="mt-1 text-xs text-zinc-500">Next run: {timestampText(job.nextRunAtMs)}</p>
            <p className="mt-1 text-xs text-zinc-500">Last run: {timestampText(job.lastRunAtMs)}</p>

            <div className="mt-2 flex flex-wrap gap-2">
              {job.anomalies?.consecutiveFailures ? (
                <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300">
                  Consecutive failures ({job.consecutiveErrors ?? 0})
                </span>
              ) : null}
              {job.anomalies?.staleLastRun ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
                  Stale last run
                </span>
              ) : null}
              {job.anomalies?.imminentNextRun ? (
                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-300">
                  Imminent next run (&lt;15m)
                </span>
              ) : null}
            </div>

            {job.lastError ? <p className="mt-1 text-xs text-zinc-500">Last error: {job.lastError.slice(0, 120)}</p> : null}
          </li>
        ))}
        {upcoming.length === 0 ? <li className="text-zinc-500">No active cron jobs found.</li> : null}
      </ul>
    </section>
  );
}
