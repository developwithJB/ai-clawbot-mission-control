"use client";

import { useMemo, useState } from "react";

type EventItem = {
  id: string;
  agent: string;
  pipeline: "A" | "B" | "C" | "D";
  type: "decision" | "delivery" | "integration" | "approval" | "approval_decided" | "web_search";
  summary: string;
  timestamp: string;
};

function typeClass(type: EventItem["type"]) {
  if (type === "delivery") return "text-emerald-300";
  if (type === "decision") return "text-sky-300";
  if (type === "approval" || type === "approval_decided") return "text-amber-300";
  if (type === "web_search") return "text-sky-300";
  return "text-zinc-300";
}

export function EventTimeline({ events }: { events: EventItem[] }) {
  const [pipeline, setPipeline] = useState<"all" | "A" | "B" | "C" | "D">("all");
  const [agent, setAgent] = useState<string>("all");

  const agents = useMemo(() => ["all", ...Array.from(new Set(events.map((e) => e.agent)))], [events]);

  const visible = useMemo(
    () =>
      events.filter((event) => {
        const pipelineMatch = pipeline === "all" || event.pipeline === pipeline;
        const agentMatch = agent === "all" || event.agent === agent;
        return pipelineMatch && agentMatch;
      }),
    [events, pipeline, agent],
  );

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Event Timeline</h2>
        <div className="flex items-center gap-2 text-xs">
          <select
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-300"
            value={pipeline}
            onChange={(e) => setPipeline(e.target.value as "all" | "A" | "B" | "C" | "D")}
          >
            <option value="all">All Pipelines</option>
            <option value="A">Pipeline A</option>
            <option value="D">Pipeline D</option>
            <option value="B">Pipeline B</option>
            <option value="C">Pipeline C</option>
          </select>

          <select
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-300"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
          >
            {agents.map((name) => (
              <option key={name} value={name}>
                {name === "all" ? "All Agents" : name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ul className="mt-4 space-y-3 text-sm">
        {visible.map((event) => (
          <li key={event.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-zinc-100">{event.agent} · Pipeline {event.pipeline}</p>
              <span className={`text-xs uppercase ${typeClass(event.type)}`}>{event.type}</span>
            </div>
            <p className="mt-1 text-zinc-300">{event.summary}</p>
            <p className="mt-1 text-xs text-zinc-500">{new Date(event.timestamp).toLocaleString("en-US", { timeZone: "America/Chicago" })}</p>
          </li>
        ))}
        {visible.length === 0 ? <li className="text-sm text-zinc-500">No events for this filter.</li> : null}
      </ul>
    </section>
  );
}
