import { NextRequest, NextResponse } from "next/server";
import { resolveApproval } from "@/lib/approvals";
import { appendEvent } from "@/lib/events";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = (await req.json()) as { status?: "approved" | "rejected" };
    if (!body?.status || !["approved", "rejected"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { id } = await params;
    const updated = await resolveApproval(id, body.status);
    if (!updated) {
      return NextResponse.json({ error: "Approval item not found" }, { status: 404 });
    }

    const eventId = `evt-${Date.now()}`;
    await appendEvent({
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
