"use client";

import { useMemo, useState } from "react";

type Approval = {
  id: string;
  item: string;
  reason: string;
  level: "High" | "Medium";
  status: "pending" | "approved" | "rejected";
  version: number;
};

type ApprovalByIdResponse = {
  approval: Approval;
};

type PatchResponse = {
  approval: Approval;
};

export function ApprovalInbox({ approvals }: { approvals: Approval[] }) {
  const [items, setItems] = useState(approvals);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const pendingCount = useMemo(() => items.filter((i) => i.status === "pending").length, [items]);

  const refetchApprovalById = async (id: string) => {
    const res = await fetch(`/api/approvals/${id}`, { method: "GET", cache: "no-store" });
    if (!res.ok) throw new Error("Failed to refetch approval");
    const data = (await res.json()) as ApprovalByIdResponse;
    if (!data?.approval) return;

    setItems((prev) => prev.map((item) => (item.id === id ? data.approval : item)));
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, 3500);
  };

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    const current = items.find((item) => item.id === id);
    if (!current) return;

    setBusyId(id);
    setError(null);

    const previous = items;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));

    try {
      const res = await fetch(`/api/approvals/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          // Phase 4 MVP placeholder identity; replace with real auth/session wiring.
          "x-mc-role": "operator",
          "x-mc-actor": "Operator",
        },
        body: JSON.stringify({ status, version: current.version }),
      });

      if (res.status === 409) {
        await refetchApprovalById(id);
        showToast("Approval changed elsewhere. Updated this card to latest.");
        return;
      }

      if (!res.ok) throw new Error("Failed to persist approval action");

      const data = (await res.json()) as PatchResponse;
      if (data?.approval) {
        setItems((prev) => prev.map((item) => (item.id === data.approval.id ? data.approval : item)));
      }
    } catch {
      setItems(previous);
      setError("Could not save approval action. State rolled back.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Approvals Inbox</h2>
        <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-300">Pending {pendingCount}</span>
      </div>

      {toast ? (
        <p className="mt-2 rounded border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">{toast}</p>
      ) : null}
      {error ? <p className="mt-2 rounded border border-rose-700/50 bg-rose-950/20 px-3 py-2 text-xs text-rose-300">{error}</p> : null}
      <ul className="mt-3 space-y-2 text-sm text-zinc-300">
        {items.map((a) => (
          <li key={a.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{a.item}</span>
              <span className="text-xs text-rose-300">{a.level}</span>
            </div>
            <p className="mt-1 text-zinc-400">{a.reason}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Status: {a.status}</span>
              {a.status === "pending" ? (
                <>
                  <button
                    className="rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-300"
                    onClick={() => updateStatus(a.id, "approved")}
                    disabled={busyId === a.id}
                  >
                    Approve
                  </button>
                  <button
                    className="rounded border border-rose-700 px-2 py-1 text-xs text-rose-300"
                    onClick={() => updateStatus(a.id, "rejected")}
                    disabled={busyId === a.id}
                  >
                    Reject
                  </button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
