import { UNIT_REGISTRY, APPROVAL_REQUIRED_ACTIONS, type UnitCode } from "@/lib/unit-governance";

const unitOrder: UnitCode[] = ["PROD-1", "OPS-1", "ARCH-1", "ENG-1", "GOV-1", "REV-1", "GTM-1"];

export function UnitSystemCard() {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Mission Control Unit System v1</h2>
        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-300">Identity Layer Active</span>
      </div>

      <p className="mt-2 text-sm text-zinc-300">
        Standard flow enforced: <strong>Compass → Flow → Spine → Builder → Gatekeeper → Monetizer/Amplifier</strong>
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {unitOrder.map((code) => {
          const unit = UNIT_REGISTRY[code];
          return (
            <article key={unit.code} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <p className="text-xs text-zinc-400">{unit.code}</p>
              <h3 className="mt-1 font-semibold">{unit.codename} {unit.emoji}</h3>
              <p className="mt-2 text-xs text-zinc-400">{unit.personality}</p>
              <p className="mt-2 text-sm text-zinc-300">{unit.mission}</p>
              <p className="mt-2 text-xs text-zinc-500">Reports to: {unit.reportsTo}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-rose-900/50 bg-rose-950/20 p-3">
        <p className="text-xs uppercase tracking-[0.2em] text-rose-300">Mandatory Review Gates</p>
        <p className="mt-2 text-sm text-zinc-200">{APPROVAL_REQUIRED_ACTIONS.join(" • ")}</p>
      </div>
    </section>
  );
}
