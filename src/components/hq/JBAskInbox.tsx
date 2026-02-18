"use client";

import { useMemo, useState } from "react";

type AskItem = {
  id: string;
  type: "approval" | "blocker" | "wrench";
  title: string;
  detail: string;
  impact: "Revenue" | "Stability" | "Growth" | "Governance";
  requiredBy: string;
  approvalId?: string;
  blockerTaskId?: string;
  objection?: string;
};

function impactClass(impact: AskItem["impact"]) {
  if (impact === "Governance") return "text-rose-200 border-rose-700/40";
  if (impact === "Stability") return "text-amber-200 border-amber-700/40";
  if (impact === "Revenue") return "text-emerald-200 border-emerald-700/40";
  return "text-sky-200 border-sky-700/40";
}

export function JBAskInbox({ asks, overflow }: { asks: AskItem[]; overflow: number }) {
  const [items, setItems] = useState(asks);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const activeCount = useMemo(() => items.length, [items]);

  const removeAsk = (id: string) => setItems((prev) => prev.filter((a) => a.id !== id));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const resolveApproval = async (ask: AskItem, status: "approved" | "rejected") => {
    if (!ask.approvalId) return;
    setBusyId(ask.id);
    try {
      const listRes = await fetch("/api/approvals", { cache: "no-store" });
      const list = (await listRes.json()) as { approvals?: Array<{ id: string; version: number }> };
      const current = list.approvals?.find((a) => a.id === ask.approvalId);
      const version = current?.version;

      const res = await fetch(`/api/approvals/${ask.approvalId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-mc-role": "operator",
          "x-mc-actor": "JB",
        },
        body: JSON.stringify({ status, version }),
      });

      if (!res.ok) throw new Error("Approval update failed");
      removeAsk(ask.id);
      showToast(`Marked ${status}.`);
    } catch {
      showToast("Could not resolve approval right now.");
    } finally {
      setBusyId(null);
    }
  };

  const resolveGeneric = async (ask: AskItem, action: string) => {
    setBusyId(ask.id);
    try {
      const res = await fetch("/api/asks/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ askId: ask.id, askType: ask.type, action }),
      });
      if (!res.ok) throw new Error("Ask resolve failed");
      removeAsk(ask.id);
      showToast("Ask resolved.");
    } catch {
      showToast("Could not resolve ask right now.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Asks for JB (Today)</h2>
        <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-300">{activeCount} active{overflow > 0 ? ` · +${overflow} deferred` : ""}</span>
      </div>

      {toast ? <p className="mt-2 text-xs text-emerald-300">{toast}</p> : null}

      <ul className="mt-3 space-y-2 text-sm">
        {items.length === 0 ? <li className="text-zinc-400">No immediate asks. Team executing.</li> : null}
        {items.map((ask) => (
          <li key={ask.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-zinc-100">{ask.title}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] ${impactClass(ask.impact)}`}>{ask.impact}</span>
            </div>
            <p className="mt-1 text-zinc-400">{ask.detail}</p>
            <p className="mt-1 text-xs text-zinc-500">Required by: {new Date(ask.requiredBy).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              {ask.type === "approval" ? (
                <>
                  <button disabled={busyId === ask.id} onClick={() => resolveApproval(ask, "approved")} className="rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-300">Approve</button>
                  <button disabled={busyId === ask.id} onClick={() => resolveApproval(ask, "rejected")} className="rounded border border-rose-700 px-2 py-1 text-xs text-rose-300">Reject</button>
                </>
              ) : (
                <button disabled={busyId === ask.id} onClick={() => resolveGeneric(ask, "acknowledged")} className="rounded border border-sky-700 px-2 py-1 text-xs text-sky-300">Resolve</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
