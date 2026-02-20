import { NextResponse } from "next/server";
import { rankTasks, readTasks, writeTasks } from "@/lib/tasks";
import type { TaskStatus, Tier } from "@/lib/state-types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as {
    title?: string;
    tier?: Tier;
    status?: TaskStatus;
    owner?: string;
    deadline?: string;
    blocker?: string;
    nextAction?: string;
  };

  const tasks = await readTasks();
  const index = tasks.findIndex((t) => t.id === id);
  if (index < 0) return NextResponse.json({ error: "task not found" }, { status: 404 });

  tasks[index] = {
    ...tasks[index],
    ...body,
    updatedAt: new Date().toISOString(),
  };

  await writeTasks(tasks);
  return NextResponse.json({ task: tasks[index], tasks, ranked: rankTasks(tasks) });
}
