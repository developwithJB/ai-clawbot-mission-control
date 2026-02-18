import { NextRequest, NextResponse } from "next/server";
import { enqueueAndSendTelegram, type TelegramType } from "@/lib/services/telegramService";
import {
  renderTelegramTemplate,
  type TelegramTemplatePayloadMap,
  type TelegramTemplateType,
} from "@/lib/services/telegramTemplates";

type NotifyBody =
  | {
      type?: TelegramType;
      message?: string;
      meta?: Record<string, unknown>;
    }
  | {
      templateType?: TelegramTemplateType;
      payload?: TelegramTemplatePayloadMap[TelegramTemplateType];
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

const templatedTypes: TelegramTemplateType[] = [
  "approval_requested",
  "approval_decided",
  "daily_pulse",
  "wrench_alert",
];

function isTemplatedRequest(body: NotifyBody): body is { templateType: TelegramTemplateType; payload: TelegramTemplatePayloadMap[TelegramTemplateType]; meta?: Record<string, unknown> } {
  return Boolean((body as { templateType?: string }).templateType);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NotifyBody;

    if (isTemplatedRequest(body)) {
      if (!body.templateType || !templatedTypes.includes(body.templateType) || !body.payload) {
        return NextResponse.json({ error: "Invalid templated payload" }, { status: 400 });
      }

      const message = renderTelegramTemplate(body.templateType, body.payload as never);
      const outbox = await enqueueAndSendTelegram({
        type: body.templateType,
        message,
        meta: {
          ...(body.meta ?? {}),
          templateType: body.templateType,
          payload: body.payload,
        },
      });

      return NextResponse.json({ outbox });
    }

    if (!("message" in body) || !body.message || !("type" in body) || !body.type || !allowedTypes.includes(body.type)) {
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
