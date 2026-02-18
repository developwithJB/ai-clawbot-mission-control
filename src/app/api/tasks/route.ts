import { NextResponse } from "next/server";
import { rankTasks, readTasks } from "@/lib/tasks";

export async function GET() {
  const tasks = await readTasks();
  return NextResponse.json({ tasks, ranked: rankTasks(tasks) });
}
