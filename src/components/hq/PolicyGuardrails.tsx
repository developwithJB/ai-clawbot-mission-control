import { evaluatePolicy, type SensitiveAction } from "@/lib/policy";

const actions: SensitiveAction[] = ["deployment", "outbound-message", "purchase"];

export function PolicyGuardrails() {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">Policy Guardrails</h2>
      <ul className="mt-3 space-y-2 text-sm text-zinc-300">
        {actions.map((action) => {
          const d = evaluatePolicy(action, false);
          return (
            <li key={action} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="font-medium text-zinc-100">{action}</p>
              <p className="text-xs text-amber-300">{d.reason}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
