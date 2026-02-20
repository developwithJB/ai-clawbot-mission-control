import {
  listApprovals,
  resolveApproval as resolveApprovalInDb,
  type ApprovalItem,
  type ApprovalLevel,
  type ApprovalStatus,
} from "@/lib/services/approvalService";

export type { ApprovalItem, ApprovalLevel, ApprovalStatus };

export async function readApprovals(): Promise<ApprovalItem[]> {
  return listApprovals();
}

export async function writeApprovals(): Promise<void> {
  // Phase 1: JSON writes removed. State is persisted in SQL.
}

export async function resolveApproval(
  id: string,
  status: "approved" | "rejected",
  expectedVersion?: number,
): Promise<
  | { kind: "ok"; approval: ApprovalItem }
  | { kind: "not_found" }
  | { kind: "version_conflict"; approval: ApprovalItem }
> {
  return resolveApprovalInDb(id, status, expectedVersion);
}
