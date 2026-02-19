import { promises as fs } from "node:fs";
import path from "node:path";

export type MemoryDoc = { id: string; path: string; title: string; content: string };

async function safeRead(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

export async function listMemoryDocs(query = ""): Promise<MemoryDoc[]> {
  const q = query.toLowerCase().trim();
  const root = process.cwd();
  const workspaceRoot = path.join(root, "..");
  const memoryDir = path.join(workspaceRoot, "memory");
  const files = [path.join(workspaceRoot, "MEMORY.md")];

  try {
    const entries = await fs.readdir(memoryDir);
    for (const entry of entries) {
      if (entry.endsWith(".md")) files.push(path.join(memoryDir, entry));
    }
  } catch {
    // ignore
  }

  const docs: MemoryDoc[] = [];
  for (const file of files) {
    const content = await safeRead(file);
    if (!content) continue;
    const rel = path.relative(workspaceRoot, file);
    docs.push({ id: rel, path: rel, title: rel, content });
  }

  return !q ? docs : docs.filter((d) => `${d.title}\n${d.content}`.toLowerCase().includes(q));
}
