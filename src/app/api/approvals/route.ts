import { NextResponse } from "next/server";
import { readApprovals } from "@/lib/approvals";

export async function GET() {
  try {
    const approvals = await readApprovals();
    return NextResponse.json({ approvals });
  } catch {
    return NextResponse.json({ approvals: [], error: "Failed to read approvals queue" }, { status: 500 });
  }
}
