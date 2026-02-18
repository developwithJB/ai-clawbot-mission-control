import { appendEvent as appendToDb, listEvents, type EventItem } from "@/lib/services/eventService";

export type { EventItem };

export async function readEvents(): Promise<EventItem[]> {
  return listEvents();
}

export async function appendEvent(event: EventItem): Promise<void> {
  appendToDb(event);
}
