"use client";

import { useMemo, useState } from "react";

type Approval = {
  id: string;
  item: string;
  reason: string;
  level: "High" | "Medium";
  status: "pending" | "approved" | "rejected";
};

export function ApprovalInbox({ approvals }: { approvals: Approval[] }) {
  const [items, setItems] = useState(approvals);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingCount = useMemo(() => items.filter((i) => i.status === "pending").length, [items]);

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return;
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
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
