type EventItem = { type: "decision" | "delivery" | "integration" | "approval" };
type ApprovalItem = { status: "pending" | "approved" | "rejected" };

export function OpsPulse({ events, approvals }: { events: EventItem[]; approvals: ApprovalItem[] }) {
  const shipped = events.filter((e) => e.type === "delivery").length;
  const approvalsPending = approvals.filter((a) => a.status === "pending").length;
  const decisions = events.filter((e) => e.type === "decision").length;

  return (
    <section className="grid gap-3 md:grid-cols-3">
      <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-xs uppercase text-zinc-400">Shipped Events</p>
        <p className="mt-1 text-2xl font-semibold text-emerald-300">{shipped}</p>
      </article>
      <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-xs uppercase text-zinc-400">Pending Approvals</p>
        <p className="mt-1 text-2xl font-semibold text-amber-300">{approvalsPending}</p>
      </article>
      <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-xs uppercase text-zinc-400">Decisions Logged</p>
        <p className="mt-1 text-2xl font-semibold text-sky-300">{decisions}</p>
      </article>
    </section>
  );
}
