import { NextRequest, NextResponse } from "next/server";
import { evaluatePolicy, type SensitiveAction } from "@/lib/policy";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { action?: SensitiveAction; approvedByHuman?: boolean };
  if (!body?.action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

  const decision = evaluatePolicy(body.action, !!body.approvedByHuman);
  return NextResponse.json({ decision });
}
