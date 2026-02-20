import { EventTimeline } from "@/components/hq/EventTimeline";
import { MissionCalendar } from "@/components/hq/MissionCalendar";
import { getLiveOpsSnapshot } from "@/lib/live";

export default async function CalendarPage() {
  const live = await getLiveOpsSnapshot();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Mission Control</p>
        <h1 className="mt-2 text-3xl font-semibold">Calendar</h1>
      </section>
      <MissionCalendar />
      <EventTimeline events={live.events} />
    </div>
  );
}
