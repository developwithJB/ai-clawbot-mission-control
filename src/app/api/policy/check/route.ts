import { NextRequest, NextResponse } from "next/server";
import { evaluatePolicy, type SensitiveAction } from "@/lib/policy";
import { appendEvent } from "@/lib/services/eventService";
import {
  detectWrenchTriggersForStrategicDecision,
  responseEnvelope,
  type Impact,
  type Risk,
  type Tier,
} from "@/lib/unit-governance";

type StrategicDecisionPayload = {
  title?: string;
  tier?: Tier;
  impact?: Impact;
  risk?: Risk;
  hasTier1Backlog?: boolean;
  measurableOutcome?: boolean;
  touchesSensitiveSurface?: boolean;
  parallelEpics?: number;
  requestedBy?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    action?: SensitiveAction;
    approvedByHuman?: boolean;
    strategicDecision?: StrategicDecisionPayload;
  };

  if (!body?.action && !body?.strategicDecision) {
    return NextResponse.json({ error: "Missing action or strategicDecision" }, { status: 400 });
  }

  const decision = body.action ? evaluatePolicy(body.action, !!body.approvedByHuman) : null;

  let wrench = { triggered: false as boolean, triggers: [] as Array<{ reason: string; lane: string }>, objection: null as string | null };

  if (body.strategicDecision?.title) {
    const sd = body.strategicDecision;
    const triggers = detectWrenchTriggersForStrategicDecision({
      title: sd.title,
      tier: sd.tier ?? 1,
      risk: sd.risk ?? "Medium",
      hasTier1Backlog: sd.hasTier1Backlog ?? false,
      measurableOutcome: sd.measurableOutcome ?? false,
      touchesSensitiveSurface: sd.touchesSensitiveSurface ?? false,
      parallelEpics: sd.parallelEpics ?? 1,
    });

    if (triggers.length > 0) {
      const objection = responseEnvelope(
        "CONTRA-1",
        `Pause proposed strategic decision: ${sd.title}`,
        triggers.map((t) => t.reason).join("; "),
        `Tier ${sd.tier ?? 1} / Risk ${sd.risk ?? "Medium"} may cause drift or governance exposure.",
        "Document Tier proof + measurable outcome, then rerun policy check.",
      );

      appendEvent({
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        agent: "Wrench",
        pipeline: "D",
        type: "decision",
        summary: `WRENCH_TRIGGER strategic decision: ${sd.title}`,
        timestamp: new Date().toISOString(),
      });

      wrench = { triggered: true, triggers, objection };
    }
  }

  return NextResponse.json({ decision, wrench });
}
