import { NextResponse } from "next/server";
import { listApprovals } from "@/lib/services/approvalService";

export async function GET() {
  try {
    const approvals = listApprovals();
    return NextResponse.json({ approvals });
  } catch {
    return NextResponse.json({ approvals: [], error: "Failed to read approvals queue" }, { status: 500 });
  }
}
