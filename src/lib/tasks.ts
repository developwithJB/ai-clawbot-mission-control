import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TaskStatus, Tier } from "@/lib/state-types";

export type TaskItem = {
  id: string;
  title: string;
  tier: Tier;
  status: TaskStatus;
  owner: string;
  deadline?: string;
  blocker?: string;
  nextAction?: string;
  updatedAt?: string;
};

const filePath = path.join(process.cwd(), "data", "tasks.json");

const seed: TaskItem[] = [
  {
    id: "task-seed",
    title: "Ship Tier-1 Mission Control surfaces",
    tier: "Tier 1",
    status: "doing",
    owner: "Operator",
    deadline: new Date(Date.now() + 86400000).toISOString(),
    blocker: "",
    nextAction: "Implement task board + memory + team + calendar reliability",
    updatedAt: new Date().toISOString(),
  },
];

export async function readTasks(): Promise<TaskItem[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as TaskItem[];
  } catch {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(seed, null, 2));
    return seed;
  }
}

export async function writeTasks(tasks: TaskItem[]): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(tasks, null, 2));
}

export function rankTasks(tasks: TaskItem[]): TaskItem[] {
  const tierScore: Record<Tier, number> = { "Tier 1": 3, "Tier 2": 2, "Tier 3": 1 };
  const statusWeight: Record<TaskStatus, number> = {
    inbox: 0,
    planned: 1,
    doing: 2,
    blocked: 3,
    review: 1,
    done: -1,
  };
  return [...tasks]
    .filter((t) => t.status !== "done")
    .sort((a, b) => tierScore[b.tier] + statusWeight[b.status] - (tierScore[a.tier] + statusWeight[a.status]));
}
