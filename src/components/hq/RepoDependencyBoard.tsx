type RepoNode = {
  id: string;
  name: string;
  url: string;
  tier: "Tier 1" | "Tier 2" | "Tier 3";
  status: "active" | "pending-access" | "paused";
  health: "green" | "yellow" | "red";
};

type RepoDependency = {
  from: string;
  to: string;
  type: "playbook-transfer" | "blocked-by" | "feeds";
  note: string;
};

function healthClass(health: RepoNode["health"]) {
  if (health === "green") return "text-emerald-300 border-emerald-700/40";
  if (health === "yellow") return "text-amber-300 border-amber-700/40";
  return "text-rose-300 border-rose-700/40";
}

export function RepoDependencyBoard({ repositories, dependencies }: { repositories: RepoNode[]; dependencies: RepoDependency[] }) {
  const nameById = Object.fromEntries(repositories.map((r) => [r.id, r.name]));

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">Multi-Repo Dependency View</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="text-sm font-medium">Repositories</p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {repositories.map((repo) => (
              <li key={repo.id} className="rounded-lg border border-zinc-800 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-zinc-100">{repo.name}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${healthClass(repo.health)}`}>{repo.health}</span>
                </div>
                <p className="text-xs text-zinc-400">{repo.tier} · {repo.status}</p>
                <p className="mt-1 text-xs text-zinc-500">{repo.url}</p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="text-sm font-medium">Dependencies</p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {dependencies.map((dep, idx) => (
              <li key={`${dep.from}-${dep.to}-${idx}`} className="rounded-lg border border-zinc-800 p-3">
                <p className="font-medium">{nameById[dep.from] ?? dep.from} → {nameById[dep.to] ?? dep.to}</p>
                <p className="text-xs text-sky-300">{dep.type}</p>
                <p className="text-xs text-zinc-400">{dep.note}</p>
              </li>
            ))}
            {dependencies.length === 0 ? <li className="text-zinc-500">No cross-repo dependencies defined yet.</li> : null}
          </ul>
        </article>
      </div>
    </section>
  );
}
