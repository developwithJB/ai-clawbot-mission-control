type Item = { number: number; title: string; url: string };

export function GitHubLivePanel({
  openIssues,
  openPrs,
  status,
  error,
}: {
  openIssues: Item[];
  openPrs: Item[];
  status: "ok" | "degraded";
  error?: string;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">GitHub Live</h2>
        <span className={`rounded-full border px-2 py-1 text-xs ${status === "ok" ? "border-emerald-600 text-emerald-300" : "border-amber-600 text-amber-300"}`}>
          {status === "ok" ? "Healthy" : "Degraded"}
        </span>
      </div>
      {status === "degraded" ? (
        <p className="mt-2 rounded border border-amber-700/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
          Live ingestion issue: {error ?? "Unable to fetch GitHub data"}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="text-sm font-medium">Open Issues ({openIssues.length})</p>
          <ul className="mt-2 space-y-2 text-sm text-zinc-300">
            {openIssues.slice(0, 5).map((i) => (
              <li key={i.number}>
                <a className="hover:underline" href={i.url} target="_blank" rel="noreferrer">
                  #{i.number} {i.title}
                </a>
              </li>
            ))}
            {openIssues.length === 0 ? <li className="text-zinc-500">No open issues.</li> : null}
          </ul>
        </article>

        <article className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="text-sm font-medium">Open PRs ({openPrs.length})</p>
          <ul className="mt-2 space-y-2 text-sm text-zinc-300">
            {openPrs.slice(0, 5).map((p) => (
              <li key={p.number}>
                <a className="hover:underline" href={p.url} target="_blank" rel="noreferrer">
                  #{p.number} {p.title}
                </a>
              </li>
            ))}
            {openPrs.length === 0 ? <li className="text-zinc-500">No open PRs yet.</li> : null}
          </ul>
        </article>
      </div>
    </section>
  );
}
