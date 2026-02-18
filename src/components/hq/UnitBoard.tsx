type UnitStatus = "Idle" | "Working" | "Blocked" | "Needs JB" | "Waiting approval";

type UnitCard = {
  code: string;
  codename: string;
  icon: string;
  status: UnitStatus;
  objective: string;
  tier: 1 | 2 | 3;
  lastUpdate: string;
  nextOwner: string;
};

type WrenchChip = {
  reason: string;
  lane: string;
};

type TelegramItem = {
  id: string;
  type: string;
  status: "queued" | "sent" | "failed";
  message: string;
  createdAt: string;
};

const lanes = [
  "Compass 🧭 (PROD) -> Flow 🌊 (OPS)",
  "Flow 🌊 (OPS) -> Spine 🧬 (ARCH)",
  "Spine 🧬 (ARCH) -> Builder 🔨 (ENG)",
  "Builder 🔨 (ENG) -> Gatekeeper 🛡 (GOV)",
  "Gatekeeper 🛡 (GOV) -> Monetizer 💰 (REV)",
  "Monetizer 💰 (REV) -> Amplifier 📣 (GTM)",
];

function statusClass(status: UnitStatus) {
  if (status === "Working") return "text-emerald-300 border-emerald-700/40";
  if (status === "Blocked") return "text-rose-300 border-rose-700/40";
  if (status === "Needs JB") return "text-amber-300 border-amber-700/40";
  if (status === "Waiting approval") return "text-sky-300 border-sky-700/40";
  return "text-zinc-300 border-zinc-700/40";
}

function notifBadge(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("approval")) return "Approval requested";
  if (normalized.includes("conflict")) return "Conflict";
  if (normalized.includes("wrench")) return "Alert";
  if (normalized.includes("daily")) return "Daily pulse";
  return "Decision";
}

export function UnitBoard({ units, wrenchChips, telegramFeed }: { units: UnitCard[]; wrenchChips: WrenchChip[]; telegramFeed: TelegramItem[] }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">Visual Unit Board</h2>
      <p className="mt-1 text-xs text-zinc-400">Scannable in under 15 seconds · Telegram is output-only</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {units.map((unit) => (
          <article key={unit.code} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{unit.codename} {unit.icon}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusClass(unit.status)}`}>{unit.status}</span>
            </div>
            <p className="text-xs text-zinc-500">{unit.code}</p>
            <p className="mt-2 text-sm text-zinc-300">{unit.objective}</p>
            <p className="mt-2 text-xs text-zinc-500">Tier {unit.tier} · Next: {unit.nextOwner}</p>
            <p className="text-[11px] text-zinc-600">Updated: {new Date(unit.lastUpdate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 md:col-span-2">
          <p className="text-sm font-medium">Handshake lanes</p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {lanes.map((lane) => (
              <li key={lane} className="rounded border border-zinc-800 px-3 py-2">{lane}</li>
            ))}
          </ul>

          <div className="mt-4 rounded-lg border border-amber-700/40 bg-amber-950/20 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-300">Wrench review required</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-200">
              {wrenchChips.length === 0 ? <li>No active objections.</li> : wrenchChips.map((chip, idx) => <li key={`${chip.reason}-${idx}`}>• {chip.reason} ({chip.lane})</li>)}
            </ul>
          </div>
        </article>

        <article className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="text-sm font-medium">Telegram feed preview</p>
          <ul className="mt-3 space-y-2 text-xs text-zinc-300">
            {telegramFeed.slice(0, 10).map((n) => (
              <li key={n.id} className="rounded border border-zinc-800 p-2">
                <p className="text-zinc-100">{notifBadge(n.type)} · {n.status}</p>
                <p className="line-clamp-2 text-zinc-400">{n.message}</p>
              </li>
            ))}
            {telegramFeed.length === 0 ? <li className="text-zinc-500">No notifications yet.</li> : null}
          </ul>
        </article>
      </div>
    </section>
  );
}
