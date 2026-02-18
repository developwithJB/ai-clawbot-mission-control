import { getDb, withTransaction } from "@/lib/db";
import { appendEvent } from "@/lib/services/eventService";

export type TelegramType = "alert" | "approval_requested" | "approval_decided" | "conflict" | "daily_pulse" | "wrench_alert";

export type TelegramMessageInput = {
  type: TelegramType;
  message: string;
  meta?: Record<string, unknown>;
};

export type TelegramOutboxItem = {
  id: string;
  type: TelegramType;
  message: string;
  metaJson: string | null;
  status: "queued" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function toRow(row: Record<string, unknown>): TelegramOutboxItem {
  return {
    id: String(row.id),
    type: row.type as TelegramType,
    message: String(row.message),
    metaJson: (row.meta_json as string | null) ?? null,
    status: row.status as "queued" | "sent" | "failed",
    attempts: Number(row.attempts ?? 0),
    lastError: (row.last_error as string | null) ?? null,
    createdAt: String(row.created_at),
    sentAt: (row.sent_at as string | null) ?? null,
  };
}

function formatTelegramText(input: TelegramMessageInput): string {
  return input.message;
}

async function sendViaBotApi(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram send failed (${res.status}): ${body}`);
  }
}

export async function enqueueAndSendTelegram(input: TelegramMessageInput): Promise<TelegramOutboxItem> {
  const id = `tg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = nowIso();
  const metaJson = input.meta ? JSON.stringify(input.meta) : null;

  withTransaction(() => {
    const db = getDb();
    db.prepare(
      `INSERT INTO telegram_outbox (id, type, message, meta_json, status, attempts, created_at)
       VALUES (?, ?, ?, ?, 'queued', 0, ?)`
    ).run(id, input.type, input.message, metaJson, createdAt);
  });

  let status: "sent" | "failed" = "sent";
  let lastError: string | null = null;
  let sentAt: string | null = null;
  const rendered = formatTelegramText(input);

  try {
    await sendViaBotApi(rendered);
    sentAt = nowIso();
  } catch (error) {
    status = "failed";
    lastError = error instanceof Error ? error.message : "Unknown Telegram send error";
  }

  withTransaction(() => {
    const db = getDb();
    db.prepare(
      `UPDATE telegram_outbox
       SET status = ?, attempts = attempts + 1, last_error = ?, sent_at = ?
       WHERE id = ?`
    ).run(status, lastError, sentAt, id);
  });

  appendEvent({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    agent: "Gatekeeper",
    pipeline: "D",
    type: "delivery",
    summary: `Telegram ${input.type} ${status === "sent" ? "sent" : "failed"}: ${input.message.slice(0, 120)}`,
    timestamp: nowIso(),
  });

  const db = getDb();
  const row = db.prepare(`SELECT * FROM telegram_outbox WHERE id = ?`).get(id) as Record<string, unknown>;
  return toRow(row);
}

export function listRecentTelegramOutbox(limit = 10): TelegramOutboxItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM telegram_outbox
       ORDER BY datetime(created_at) DESC
       LIMIT ?`
    )
    .all(limit) as Record<string, unknown>[];

  return rows.map(toRow);
}
