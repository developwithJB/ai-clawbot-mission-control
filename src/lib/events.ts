import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type EventItem = {
  id: string;
  agent: string;
  pipeline: "A" | "B" | "C" | "D";
  type: "decision" | "delivery" | "integration" | "approval";
  summary: string;
  timestamp: string;
};

const filePath = path.join(process.cwd(), "data", "events.json");

const seedEvents: EventItem[] = [
  {
    id: "evt-seed",
    agent: "Operator",
    pipeline: "D",
    type: "decision",
    summary: "Event timeline initialized",
    timestamp: new Date().toISOString(),
  },
];

export async function readEvents(): Promise<EventItem[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as EventItem[];
  } catch {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(seedEvents, null, 2));
    return seedEvents;
  }
}

export async function appendEvent(event: EventItem): Promise<void> {
  const current = await readEvents();
  const next = [event, ...current].slice(0, 200);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(next, null, 2));
}
