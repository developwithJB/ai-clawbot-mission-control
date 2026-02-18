type Item = { number: number; title: string; url: string };

export function GitHubLivePanel({ openIssues, openPrs }: { openIssues: Item[]; openPrs: Item[] }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">GitHub Live</h2>
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
