import { OfficeScene } from "@/components/hq/OfficeScene";
import { getLiveOpsSnapshot } from "@/lib/live";
import { readTasks } from "@/lib/tasks";

export default async function OfficePage() {
  const [live, tasks] = await Promise.all([getLiveOpsSnapshot(), readTasks()]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Mission Control</p>
        <h1 className="mt-2 text-3xl font-semibold">Office</h1>
        <p className="mt-3 text-zinc-400">Live visual map of desks, status mix, and latest team activity.</p>
      </section>

      <OfficeScene
        units={live.unitBoard.units}
        recentActivity={live.events.slice(0, 6).map((event) => ({
          id: event.id,
          summary: event.summary,
          agent: event.agent,
          timestamp: event.timestamp,
        }))}
        tasks={tasks}
      />
    </div>
  );
}
