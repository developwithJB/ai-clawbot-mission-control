import { NextResponse } from "next/server";
import { listEvents } from "@/lib/services/eventService";

export async function GET() {
  try {
    const events = listEvents();
    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [], error: "Failed to load event timeline" }, { status: 500 });
  }
}
