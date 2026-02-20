import { ActivityFeed } from "@/components/hq/ActivityFeed";
import { MemoryScreen } from "@/components/hq/MemoryScreen";
import { getLiveOpsSnapshot } from "@/lib/live";
import { listMemoryDocs } from "@/lib/memory";

export default async function MemoryPage() {
  const [live, initialDocs] = await Promise.all([getLiveOpsSnapshot(), listMemoryDocs()]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Mission Control</p>
        <h1 className="mt-2 text-3xl font-semibold">Memory</h1>
      </section>
      <MemoryScreen initialDocs={initialDocs} />
      <ActivityFeed shippedToday={live.shippedToday} top3={live.top3} />
    </div>
  );
}
