import { NextRequest, NextResponse } from "next/server";
import { getApprovalById, resolveApproval } from "@/lib/services/approvalService";
import { getActorIdentity } from "@/lib/authz";

type ApprovalPatchBody = {
  status?: "approved" | "rejected";
  version?: number;
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const approval = getApprovalById(id);
    if (!approval) {
      return NextResponse.json({ error: "Approval item not found" }, { status: 404 });
    }
    return NextResponse.json({ approval });
  } catch {
    return NextResponse.json({ error: "Failed to load approval" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = (await req.json()) as ApprovalPatchBody;

    if (!body?.status || !["approved", "rejected"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    if (body.version !== undefined && !Number.isInteger(body.version)) {
      return NextResponse.json({ error: "Invalid version" }, { status: 400 });
    }

    const { id } = await params;
    const result = resolveApproval(id, body.status, body.version, {
      decidedBy: getActorIdentity(req),
      requestId: req.headers.get("x-request-id") ?? req.headers.get("x-correlation-id") ?? undefined,
      traceId: req.headers.get("x-trace-id") ?? undefined,
    });

    if (result.kind === "not_found") {
      return NextResponse.json({ error: "Approval item not found" }, { status: 404 });
    }

    if (result.kind === "version_conflict") {
      return NextResponse.json(
        { error: "Version conflict", approval: result.approval },
        { status: 409 },
      );
    }

    return NextResponse.json({ approval: result.approval });
  } catch {
    return NextResponse.json({ error: "Failed to update approval" }, { status: 500 });
  }
}
