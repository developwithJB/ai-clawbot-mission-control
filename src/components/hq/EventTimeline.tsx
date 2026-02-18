type EventItem = {
  id: string;
  agent: string;
  pipeline: "A" | "B" | "C" | "D";
  type: "decision" | "delivery" | "integration" | "approval";
  summary: string;
  timestamp: string;
};

function typeClass(type: EventItem["type"]) {
  if (type === "delivery") return "text-emerald-300";
  if (type === "decision") return "text-sky-300";
  if (type === "approval") return "text-amber-300";
  return "text-zinc-300";
}

export function EventTimeline({ events }: { events: EventItem[] }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">Event Timeline</h2>
      <ul className="mt-4 space-y-3 text-sm">
        {events.map((event) => (
          <li key={event.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-zinc-100">{event.agent} · Pipeline {event.pipeline}</p>
              <span className={`text-xs uppercase ${typeClass(event.type)}`}>{event.type}</span>
            </div>
            <p className="mt-1 text-zinc-300">{event.summary}</p>
            <p className="mt-1 text-xs text-zinc-500">{new Date(event.timestamp).toLocaleString("en-US", { timeZone: "America/Chicago" })}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
