import type { TaskStatus, Tier } from "@/lib/state-types";
import { listTasks, replaceTasks, type TaskItem } from "@/lib/services/taskService";

export type { TaskItem };

export async function readTasks(): Promise<TaskItem[]> {
  return listTasks();
}

export async function writeTasks(tasks: TaskItem[]): Promise<void> {
  replaceTasks(tasks);
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
