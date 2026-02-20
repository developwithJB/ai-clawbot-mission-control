"use client";

import { useMemo, useState } from "react";

type SearchItem = { id: string; label: string; context: string; type: string };

export function GlobalSearch({ items }: { items: SearchItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items.filter((item) => `${item.label} ${item.context} ${item.type}`.toLowerCase().includes(q)).slice(0, 12);
  }, [items, query]);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">Global Search</h2>
      <p className="mt-1 text-sm text-zinc-400">Search events, approvals, tasks, repos, and telegram ops in one place.</p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search Mission Control..."
        className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500"
      />
      <ul className="mt-3 space-y-2 text-sm">
        {filtered.map((item) => (
          <li key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-zinc-100">{item.label}</p>
              <span className="text-xs uppercase text-zinc-400">{item.type}</span>
            </div>
            <p className="mt-1 text-zinc-300">{item.context}</p>
          </li>
        ))}
        {filtered.length === 0 ? <li className="text-zinc-500">No matches.</li> : null}
      </ul>
    </section>
  );
}
