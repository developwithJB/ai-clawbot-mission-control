type Unit = {
  code: string;
  codename: string;
  icon: string;
  status: "Idle" | "Working" | "Blocked" | "Needs JB" | "Waiting approval";
  objective: string;
  tier: 1 | 2 | 3;
  nextOwner: string;
};

const roleGuide: Record<string, string> = {
  "PROD-1": "Product strategy + priority integrity",
  "OPS-1": "Execution planning + sequencing",
  "ARCH-1": "Architecture & boundaries",
  "ENG-1": "Implementation + delivery",
  "GOV-1": "Approvals + policy compliance",
  "REV-1": "Revenue conversion systems",
  "GTM-1": "Distribution + growth",
  "CONTRA-1": "Contrarian QA (wrench)",
};

export function TeamStructureScreen({ units }: { units: Unit[] }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">Team Structure</h2>
      <p className="mt-1 text-sm text-zinc-400">Operator + recurring agent roles with responsibilities and current status.</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {units.map((unit) => (
          <article key={unit.code} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-zinc-100">{unit.icon} {unit.code} · {unit.codename}</p>
              <span className="text-xs text-zinc-400">{unit.status}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">Tier {unit.tier} · {roleGuide[unit.code] ?? "General operations"}</p>
            <p className="mt-2 text-sm text-zinc-300">{unit.objective}</p>
            <p className="mt-2 text-xs text-zinc-500">Next owner: {unit.nextOwner}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
