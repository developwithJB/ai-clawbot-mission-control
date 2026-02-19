"use client";

import { useState } from "react";

type MemoryDoc = { id: string; path: string; title: string; content: string };

export function MemoryScreen({ initialDocs }: { initialDocs: MemoryDoc[] }) {
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<MemoryDoc[]>(initialDocs);

  async function load(q = "") {
    const res = await fetch(`/api/memory?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const data = (await res.json()) as { docs: MemoryDoc[] };
    setDocs(data.docs ?? []);
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">Memory</h2>
      <p className="mt-1 text-sm text-zinc-400">Search and review MEMORY.md + daily memory files.</p>
      <div className="mt-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search memory..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <button className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 text-sm text-sky-300" onClick={() => load(query)}>
          Search
        </button>
      </div>

      <ul className="mt-3 max-h-96 space-y-2 overflow-auto text-sm">
        {docs.map((doc) => (
          <li key={doc.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <p className="text-xs uppercase text-zinc-500">{doc.path}</p>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-300">{doc.content.slice(0, 700)}{doc.content.length > 700 ? "…" : ""}</pre>
          </li>
        ))}
        {docs.length === 0 ? <li className="text-zinc-500">No memory documents found.</li> : null}
      </ul>
    </section>
  );
}
