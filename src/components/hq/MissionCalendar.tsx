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
};

function scheduleText(job: CalendarJob) {
  if (job.schedule.kind === "cron") return `${job.schedule.expr ?? "cron"} (${job.schedule.tz ?? "local"})`;
  if (job.schedule.kind === "at") return `at ${job.schedule.at ?? "unknown"}`;
  if (job.schedule.kind === "every") return `every ${Math.round((job.schedule.everyMs ?? 0) / 60000)}m`;
  return "unknown";
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
            <p className="mt-1 text-xs text-zinc-500">
              Next run:{" "}
              {job.nextRunAtMs ? new Date(job.nextRunAtMs).toLocaleString("en-US", { timeZone: "America/Chicago" }) : "n/a"}
            </p>
            {job.consecutiveErrors ? (
              <p className="mt-1 text-xs text-rose-300">Alert: {job.consecutiveErrors} consecutive failures</p>
            ) : null}
            {job.lastError ? <p className="mt-1 text-xs text-zinc-500">Last error: {job.lastError.slice(0, 120)}</p> : null}
          </li>
        ))}
        {upcoming.length === 0 ? <li className="text-zinc-500">No active cron jobs found.</li> : null}
      </ul>
    </section>
  );
}
