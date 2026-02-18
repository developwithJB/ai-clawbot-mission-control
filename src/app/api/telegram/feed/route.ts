import { NextResponse } from "next/server";
import { listRecentTelegramOutbox } from "@/lib/services/telegramService";

export async function GET() {
  try {
    return NextResponse.json({ notifications: listRecentTelegramOutbox(10) });
  } catch {
    return NextResponse.json({ notifications: [], error: "Failed to load Telegram feed" }, { status: 500 });
  }
}
