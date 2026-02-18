import { NextRequest, NextResponse } from "next/server";
import { enqueueAndSendTelegram, type TelegramType } from "@/lib/services/telegramService";

type NotifyBody = {
  type?: TelegramType;
  message?: string;
  meta?: Record<string, unknown>;
};

const allowedTypes: TelegramType[] = [
  "alert",
  "approval_requested",
  "approval_decided",
  "conflict",
  "daily_pulse",
  "wrench_alert",
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NotifyBody;
    if (!body.message || !body.type || !allowedTypes.includes(body.type)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const outbox = await enqueueAndSendTelegram({
      type: body.type,
      message: body.message,
      meta: body.meta,
    });

    return NextResponse.json({ outbox });
  } catch {
    return NextResponse.json({ error: "Failed to send Telegram notification" }, { status: 500 });
  }
}
