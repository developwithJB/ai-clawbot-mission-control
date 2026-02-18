type PRReadiness = {
  number: number;
  title: string;
  url: string;
  risk: "Low" | "Medium" | "High";
  reason: string;
};

function riskClass(risk: PRReadiness["risk"]) {
  if (risk === "High") return "text-rose-300";
  if (risk === "Medium") return "text-amber-300";
  return "text-emerald-300";
}

export function PRReadinessBoard({ prs }: { prs: PRReadiness[] }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">PR Risk + Readiness</h2>
      <ul className="mt-3 space-y-2 text-sm text-zinc-300">
        {prs.slice(0, 6).map((pr) => (
          <li key={pr.number} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <a className="font-medium text-zinc-100 hover:underline" href={pr.url} target="_blank" rel="noreferrer">#{pr.number} {pr.title}</a>
              <span className={`text-xs ${riskClass(pr.risk)}`}>{pr.risk}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">{pr.reason}</p>
          </li>
        ))}
        {prs.length === 0 ? <li className="text-zinc-500">No open PRs to score.</li> : null}
      </ul>
    </section>
  );
}
