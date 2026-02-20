"use client";

import { useState } from "react";

type TaskItem = {
  id: string;
  title: string;
  tier: "Tier 1" | "Tier 2" | "Tier 3";
  status: "inbox" | "planned" | "doing" | "blocked" | "review" | "done";
  owner: string;
  deadline?: string;
  blocker?: string;
  nextAction?: string;
};

const statuses: TaskItem["status"][] = ["inbox", "planned", "doing", "blocked", "review", "done"];

export function TaskOrchestratorCard({ initialTasks }: { initialTasks: TaskItem[] }) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);

  async function patchTask(id: string, patch: Partial<TaskItem>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as { tasks?: TaskItem[] };
    if (data.tasks) setTasks(data.tasks);
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">Tasks Board</h2>
      <p className="mt-1 text-sm text-zinc-400">Track status, ownership, deadlines, blockers, and next actions in real time.</p>
      <ul className="mt-3 space-y-2 text-sm text-zinc-300">
        {tasks.map((task) => (
          <li key={task.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <p className="font-medium text-zinc-100">{task.title}</p>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <label className="text-xs">
                <span className="mb-1 block text-zinc-500">Status</span>
                <select
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
                  value={task.status}
                  onChange={(e) => patchTask(task.id, { status: e.target.value as TaskItem["status"] })}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <div className="text-xs text-zinc-400">{task.tier} · Owner: {task.owner}</div>
              <div className="text-xs text-zinc-400">
                Deadline: {task.deadline ? new Date(task.deadline).toLocaleDateString("en-US", { timeZone: "America/Chicago" }) : "n/a"}
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-400">Blocker: {task.blocker || "None"}</p>
            <p className="mt-1 text-xs text-zinc-400">Next action: {task.nextAction || "Not set"}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
