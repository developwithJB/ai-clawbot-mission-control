import { NextRequest, NextResponse } from "next/server";
import { resolveApproval } from "@/lib/services/approvalService";
import { appendEvent } from "@/lib/services/eventService";

type ApprovalPatchBody = {
  status?: "approved" | "rejected";
  version?: number;
};

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
    const result = resolveApproval(id, body.status, body.version);

    if (result.kind === "not_found") {
      return NextResponse.json({ error: "Approval item not found" }, { status: 404 });
    }

    if (result.kind === "version_conflict") {
      return NextResponse.json(
        { error: "Version conflict", approval: result.approval },
        { status: 409 },
      );
    }

    const updated = result.approval;
    const eventId = `evt-${Date.now()}`;

    appendEvent({
      id: eventId,
      agent: "Operator",
      pipeline: "D",
      type: "approval",
      summary: `${body.status.toUpperCase()}: ${updated.item}`,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ approval: updated, eventId });
  } catch {
    return NextResponse.json({ error: "Failed to update approval" }, { status: 500 });
  }
}
