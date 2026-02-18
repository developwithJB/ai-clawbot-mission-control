type Approval = { item: string; reason: string; level: "High" | "Medium" };

export function ApprovalInbox({ approvals }: { approvals: Approval[] }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">Approvals Inbox</h2>
      <ul className="mt-3 space-y-2 text-sm text-zinc-300">
        {approvals.map((a) => (
          <li key={a.item} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{a.item}</span>
              <span className="text-xs text-rose-300">{a.level}</span>
            </div>
            <p className="mt-1 text-zinc-400">{a.reason}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}
