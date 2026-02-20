"use client";

import { useMemo, useState } from "react";
import type { TaskItem } from "@/lib/tasks";

type Unit = {
  code: string;
  codename: string;
  icon: string;
  status: "Idle" | "Working" | "Blocked" | "Needs JB" | "Waiting approval";
  objective: string;
  tier: 1 | 2 | 3;
};

type Activity = {
  id: string;
  summary: string;
  agent: string;
  timestamp: string;
};

const unitAliases: Record<string, string[]> = {
  "PROD-1": ["prod", "product", "compass", "pm"],
  "OPS-1": ["ops", "operator", "flow"],
  "ARCH-1": ["arch", "architecture", "spine"],
  "ENG-1": ["eng", "engineer", "builder"],
  "GOV-1": ["gov", "governance", "gatekeeper", "approval"],
  "REV-1": ["rev", "revenue", "monetizer"],
  "GTM-1": ["gtm", "marketing", "growth", "amplifier"],
  "CONTRA-1": ["contra", "wrench", "contrarian"],
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function statusClass(status: Unit["status"]) {
  if (status === "Working") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "Blocked" || status === "Needs JB") return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  if (status === "Waiting approval") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
}

function avatarAnimationClass(status: Unit["status"]) {
  if (status === "Working") return "office-anim-working";
  if (status === "Idle") return "office-anim-idle";
  return "office-anim-attention";
}

function attentionChip(status: Unit["status"]) {
  if (status === "Blocked") return "Blocked";
  if (status === "Needs JB") return "Needs JB";
  if (status === "Waiting approval") return "Waiting approval";
  return null;
}

function formatDeadline(deadline?: string) {
  if (!deadline) return "—";
  const date = new Date(deadline);
  if (Number.isNaN(date.valueOf())) return deadline;
  return date.toLocaleString();
}

function getMatchingTasks(unit: Unit, tasks: TaskItem[]) {
  const baseTokens = [
    normalize(unit.code),
    normalize(unit.code.replace("-", "")),
    normalize(unit.code.split("-")[0]),
    normalize(unit.codename),
    ...(unitAliases[unit.code] ?? []).map(normalize),
  ].filter(Boolean);

  return tasks
    .filter((task) => task.status !== "done")
    .filter((task) => {
      const haystack = normalize(`${task.owner} ${task.title} ${task.id}`);
      return baseTokens.some((token) => token && haystack.includes(token));
    });
}

export function OfficeScene({ units, recentActivity, tasks }: { units: Unit[]; recentActivity: Activity[]; tasks: TaskItem[] }) {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const selectedUnit = useMemo(() => units.find((unit) => unit.code === selectedCode) ?? null, [selectedCode, units]);
  const selectedTasks = useMemo(() => (selectedUnit ? getMatchingTasks(selectedUnit, tasks) : []), [selectedUnit, tasks]);

  const statusCounts = units.reduce<Record<Unit["status"], number>>(
    (acc, unit) => {
      acc[unit.status] += 1;
      return acc;
    },
    { Idle: 0, Working: 0, Blocked: 0, "Needs JB": 0, "Waiting approval": 0 },
  );

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Office v2 Floor</h2>
            <span className="text-xs text-zinc-500">Live desk occupancy · click an employee for task stack</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {units.map((unit) => {
              const chip = attentionChip(unit.status);
              const isSelected = selectedCode === unit.code;

              return (
                <button
                  key={unit.code}
                  type="button"
                  onClick={() => setSelectedCode(unit.code)}
                  className={`rounded-xl border bg-zinc-950/50 p-3 text-left transition hover:border-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    isSelected ? "border-sky-500/60" : "border-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`relative flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-lg ${avatarAnimationClass(unit.status)}`}>
                      {unit.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{unit.codename}</p>
                      <p className="text-xs text-zinc-500">{unit.code} · Tier {unit.tier}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">{unit.objective}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className={`inline-block rounded-full border px-2 py-1 text-xs ${statusClass(unit.status)}`}>{unit.status}</span>
                    {chip ? (
                      <span className="office-attention-chip rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-1 text-xs text-rose-200">
                        {chip}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <div className="space-y-4">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">Status Legend</h3>
            <div className="mt-3 space-y-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
                  <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(status as Unit["status"])}`}>{status}</span>
                  <span className="text-sm text-zinc-300">{count}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">Recent Activity</h3>
            <div className="mt-3 space-y-2">
              {recentActivity.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                  <p className="text-sm text-zinc-200">{item.summary}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {item.agent} · {new Date(item.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      {selectedUnit ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50">
          <button type="button" className="h-full flex-1 cursor-default" onClick={() => setSelectedCode(null)} aria-label="Close task panel" />
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Current Task Stack</p>
                <h3 className="mt-2 text-xl font-semibold text-zinc-100">
                  {selectedUnit.icon} {selectedUnit.codename}
                </h3>
                <p className="mt-1 text-sm text-zinc-400">{selectedUnit.code} · {selectedUnit.status}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCode(null)}
                className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300 transition hover:border-zinc-500"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {selectedTasks.length ? (
                selectedTasks.map((task) => (
                  <article key={task.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <h4 className="text-sm font-semibold text-zinc-100">{task.title}</h4>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-zinc-300 sm:grid-cols-2">
                      <div>
                        <dt className="text-zinc-500">Status</dt>
                        <dd>{task.status}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Tier</dt>
                        <dd>{task.tier}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Blocker</dt>
                        <dd>{task.blocker?.trim() ? task.blocker : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Deadline</dt>
                        <dd>{formatDeadline(task.deadline)}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-zinc-500">Next action</dt>
                        <dd>{task.nextAction?.trim() ? task.nextAction : "—"}</dd>
                      </div>
                    </dl>
                  </article>
                ))
              ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">
                  No active tasks are mapped to {selectedUnit.codename} ({selectedUnit.code}) right now.
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes office-working-pulse {
          0%,
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.35);
          }
          50% {
            transform: scale(1.03);
            box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
          }
        }

        @keyframes office-idle-breathe {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.92;
          }
          50% {
            transform: scale(1.02);
            opacity: 1;
          }
        }

        @keyframes office-attention-nudge {
          0%,
          100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-1px);
          }
          60% {
            transform: translateY(1px);
          }
        }

        @keyframes office-chip-flash {
          0%,
          100% {
            opacity: 0.85;
          }
          50% {
            opacity: 1;
          }
        }

        .office-anim-working {
          animation: office-working-pulse 2.1s ease-in-out infinite;
        }

        .office-anim-idle {
          animation: office-idle-breathe 3.6s ease-in-out infinite;
        }

        .office-anim-attention {
          animation: office-attention-nudge 1s ease-in-out infinite;
        }

        .office-attention-chip {
          animation: office-chip-flash 1.2s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
