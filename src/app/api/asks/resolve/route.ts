import { NextRequest, NextResponse } from "next/server";
import { appendEvent } from "@/lib/services/eventService";

type ResolveAskBody = {
  askId?: string;
  askType?: "approval" | "blocker" | "wrench";
  action?: string;
  note?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ResolveAskBody;
    if (!body.askId || !body.askType || !body.action) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    appendEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agent: "Operator",
      pipeline: "D",
      type: "decision",
      summary: `Ask resolved (${body.askType}): ${body.action}${body.note ? ` - ${body.note}` : ""}`,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to resolve ask" }, { status: 500 });
  }
}
