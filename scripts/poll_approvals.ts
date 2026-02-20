#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

type IssueMap = Record<string, number>;

function sh(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: "utf8" }).trim();
}

function parseDecision(text: string): "approved" | "rejected" | null {
  for (const line of text.split(/\r?\n/).map((s) => s.trim())) {
    if (/^approve$/i.test(line)) return "approved";
    if (/^reject$/i.test(line)) return "rejected";
  }
  return null;
}

function readMap(file: string): IssueMap {
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, "utf8")) as IssueMap;
}

function writeMap(file: string, map: IssueMap) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(map, null, 2)}\n`);
}

function logLocal(root: string, message: string) {
  const file = path.join(root, "data", "local-events.log");
  writeFileSync(file, `${new Date().toISOString()}\t${message}\n`, { flag: "a" });
}

function main() {
  const repo = process.env.APPROVAL_REPO;
  const actors = (process.env.APPROVAL_ACTORS || "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
  if (!repo) throw new Error("APPROVAL_REPO is required");
  if (actors.length === 0) throw new Error("APPROVAL_ACTORS is required");

  const root = process.cwd();
  const db = new DatabaseSync(path.join(root, "db", "mission-control.sqlite"));
  const schemaPath = path.join(root, "db", "schema.sql");
  if (existsSync(schemaPath)) db.exec(readFileSync(schemaPath, "utf8"));
  const mapFile = path.join(root, "data", "approval-issues.json");
  const issueMap = readMap(mapFile);

  const pending = db.prepare("SELECT id, item, reason, level FROM approvals WHERE status = 'pending' ORDER BY datetime(created_at) ASC").all() as Array<{ id: string; item: string; reason: string; level: "High" | "Medium" }>;

  for (const a of pending) {
    if (!issueMap[a.id]) {
      const created = JSON.parse(
        sh("gh", [
          "issue", "create", "--repo", repo,
          "--title", `[APPROVAL] ${a.item}`,
          "--body", `Approval ID: ${a.id}\nLevel: ${a.level}\n\nReason: ${a.reason}\n\nAuthorized approvers: ${actors.join(", ")}\n\nReply with exactly one line:\napprove\nor\nreject`,
          "--json", "number",
        ])
      ) as { number: number };
      issueMap[a.id] = created.number;
      logLocal(root, `approval_issue_opened:${a.id}:#${created.number}`);
    }

    const issueNo = String(issueMap[a.id]);
    const comments = JSON.parse(sh("gh", ["api", `repos/${repo}/issues/${issueNo}/comments`])) as Array<{ body?: string; user?: { login?: string } }>;

    let decision: "approved" | "rejected" | null = null;
    let decidedBy = "";
    for (const c of comments) {
      const author = (c.user?.login || "").toLowerCase();
      if (!actors.includes(author)) continue;
      const d = parseDecision(c.body || "");
      if (d) {
        decision = d;
        decidedBy = author;
      }
    }

    if (decision) {
      const now = new Date().toISOString();
      const result = db.prepare("UPDATE approvals SET status = ?, version = version + 1, resolved_at = ? WHERE id = ? AND status = 'pending'").run(decision, now, a.id);
      if (result.changes > 0) {
        db.prepare("INSERT INTO events (id, agent, pipeline, type, summary, timestamp, approval_id, previous_status, new_status, decided_by, decided_at) VALUES (?, ?, 'D', 'approval_decided', ?, ?, ?, 'pending', ?, ?, ?)")
          .run(`evt-${Date.now()}-${a.id}`, `github:${decidedBy}`, `PENDING -> ${decision.toUpperCase()}: ${a.item}`, now, a.id, decision, decidedBy, now);
        sh("gh", ["issue", "close", issueNo, "--repo", repo, "--comment", `Decision recorded: ${decision}`]);
        writeFileSync(path.join(root, "data", "approval-unblocked.jsonl"), `${JSON.stringify({ approval_id: a.id, decision, decided_by: decidedBy, decided_at: now })}\n`, { flag: "a" });
        logLocal(root, `approval_decided:${a.id}:${decision}:by:${decidedBy}`);
      }
    }
  }

  writeMap(mapFile, issueMap);
}

main();
