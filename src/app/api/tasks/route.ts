import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { rankTasks, readTasks, writeTasks } from "@/lib/tasks";
import type { TaskStatus, Tier } from "@/lib/state-types";

export async function GET() {
  const tasks = await readTasks();
  return NextResponse.json({ tasks, ranked: rankTasks(tasks) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    tier?: Tier;
    status?: TaskStatus;
    owner?: string;
    deadline?: string;
    blocker?: string;
    nextAction?: string;
  };

  if (!body.title || !body.owner || !body.tier || !body.status) {
    return NextResponse.json({ error: "title, owner, tier, status required" }, { status: 400 });
  }

  const tasks = await readTasks();
  const task = {
    id: randomUUID(),
    title: body.title,
    owner: body.owner,
    tier: body.tier,
    status: body.status,
    deadline: body.deadline ?? "",
    blocker: body.blocker ?? "",
    nextAction: body.nextAction ?? "",
    updatedAt: new Date().toISOString(),
  };
  tasks.push(task);
  await writeTasks(tasks);
  return NextResponse.json({ task, tasks, ranked: rankTasks(tasks) }, { status: 201 });
}
