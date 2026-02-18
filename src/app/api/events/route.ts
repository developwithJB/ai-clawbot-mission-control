import { NextResponse } from "next/server";
import { readEvents } from "@/lib/events";

export async function GET() {
  try {
    const events = await readEvents();
    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [], error: "Failed to load event timeline" }, { status: 500 });
  }
}
