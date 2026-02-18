type Activity = { who: string; summary: string; when: string };

type Top3 = { title: string; tier: "Tier 1" | "Tier 2" | "Tier 3"; why: string };

export function ActivityFeed({ shippedToday, top3 }: { shippedToday: Activity[]; top3: Top3[] }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">Agent Activity + Today&apos;s Top 3</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-medium">What shipped today</p>
          <ul className="mt-2 space-y-2 text-sm text-zinc-300">
            {shippedToday.map((a, idx) => (
              <li key={`${a.who}-${idx}`} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <p className="font-medium">{a.who}</p>
                <p>{a.summary}</p>
                <p className="text-xs text-zinc-500">{a.when}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium">Auto-prioritized Top 3</p>
          <ul className="mt-2 space-y-2 text-sm text-zinc-300">
            {top3.map((t) => (
              <li key={t.title} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <p className="font-medium">{t.title}</p>
                <p className="text-xs text-sky-300">{t.tier}</p>
                <p className="text-zinc-400">{t.why}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
