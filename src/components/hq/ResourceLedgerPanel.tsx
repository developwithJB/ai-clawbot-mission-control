type ResourceLedger = {
  tokenEstimate: { input: number; output: number; total: number; usageEstimateUsd: number };
  cron: { totalJobs: number; failures: number; retries: number };
  transport: { failures: number; retries: number };
  entries: {
    id: string;
    category: "tokens" | "cron" | "failure" | "retry" | "baseline";
    label: string;
    tokensIn: number;
    tokensOut: number;
    usageEstimateUsd: number;
    createdAt: string;
  }[];
};

export function ResourceLedgerPanel({ ledger }: { ledger: ResourceLedger }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">Resource Ledger</h2>
      <p className="mt-1 text-xs text-zinc-400">Real-time usage telemetry with zero-cost assumptions.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <article className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
          <p className="text-xs uppercase text-zinc-500">Estimated Tokens</p>
          <p className="mt-1 text-xl font-semibold text-sky-300">{ledger.tokenEstimate.total}</p>
        </article>
        <article className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
          <p className="text-xs uppercase text-zinc-500">Estimated Cost</p>
          <p className="mt-1 text-xl font-semibold text-emerald-300">$0.00</p>
        </article>
        <article className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
          <p className="text-xs uppercase text-zinc-500">Cron Runs (tracked)</p>
          <p className="mt-1 text-xl font-semibold text-zinc-100">{ledger.cron.totalJobs}</p>
          <p className="text-xs text-zinc-500">Failures: {ledger.cron.failures} · Retries: {ledger.cron.retries}</p>
        </article>
        <article className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
          <p className="text-xs uppercase text-zinc-500">Transport Health</p>
          <p className="mt-1 text-xl font-semibold text-amber-300">{ledger.transport.failures}</p>
          <p className="text-xs text-zinc-500">Failures · Retries: {ledger.transport.retries}</p>
        </article>
      </div>

      <ul className="mt-4 space-y-2 text-xs text-zinc-300">
        {ledger.entries.map((entry) => (
          <li key={entry.id} className="rounded border border-zinc-800 bg-zinc-950/50 p-3">
            <p className="font-medium text-zinc-100">{entry.label}</p>
            <p className="text-zinc-500">
              {entry.category} · in: {entry.tokensIn} · out: {entry.tokensOut} · cost: $0.00 · {new Date(entry.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
