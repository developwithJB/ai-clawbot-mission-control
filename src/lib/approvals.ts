import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ApprovalLevel = "High" | "Medium";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ApprovalItem = {
  id: string;
  item: string;
  reason: string;
  level: ApprovalLevel;
  status: ApprovalStatus;
  createdAt: string;
};

const dataPath = path.join(process.cwd(), "data", "approvals.json");

const seeded: ApprovalItem[] = [
  {
    id: "appr-001",
    item: "Deploy production config change",
    reason: "Gateway-level behavior adjustment requested",
    level: "High",
    status: "pending",
    createdAt: new Date().toISOString(),
  },
];

export async function readApprovals(): Promise<ApprovalItem[]> {
  try {
    const raw = await readFile(dataPath, "utf8");
    return JSON.parse(raw) as ApprovalItem[];
  } catch {
    await mkdir(path.dirname(dataPath), { recursive: true });
    await writeFile(dataPath, JSON.stringify(seeded, null, 2));
    return seeded;
  }
}

export async function writeApprovals(items: ApprovalItem[]): Promise<void> {
  await mkdir(path.dirname(dataPath), { recursive: true });
  await writeFile(dataPath, JSON.stringify(items, null, 2));
}

export async function resolveApproval(id: string, status: "approved" | "rejected"): Promise<ApprovalItem | null> {
  const items = await readApprovals();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], status };
  await writeApprovals(items);
  return items[idx];
}
