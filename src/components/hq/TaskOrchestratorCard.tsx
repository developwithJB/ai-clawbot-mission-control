type TaskItem = {
  id: string;
  title: string;
  tier: "Tier 1" | "Tier 2" | "Tier 3";
  status: "inbox" | "planned" | "doing" | "blocked" | "review" | "done";
  owner: string;
};

export function TaskOrchestratorCard({ ranked }: { ranked: TaskItem[] }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">Task Orchestrator (v1)</h2>
      <ul className="mt-3 space-y-2 text-sm text-zinc-300">
        {ranked.slice(0, 5).map((task) => (
          <li key={task.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <p className="font-medium text-zinc-100">{task.title}</p>
            <p className="text-xs text-sky-300">{task.tier} · {task.status}</p>
            <p className="text-xs text-zinc-500">Owner: {task.owner}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
