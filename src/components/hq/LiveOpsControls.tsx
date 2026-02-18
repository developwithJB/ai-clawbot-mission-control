"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LiveOpsControls() {
  const router = useRouter();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshNow = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      router.refresh();
    }, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, router]);

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        onClick={refreshNow}
        className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-300 hover:border-zinc-500"
      >
        {isRefreshing ? "Refreshing…" : "Refresh now"}
      </button>

      <button
        onClick={() => setAutoRefresh((v) => !v)}
        className={`rounded border px-2 py-1 ${autoRefresh ? "border-emerald-700 text-emerald-300" : "border-zinc-700 text-zinc-300"}`}
      >
        Auto-refresh: {autoRefresh ? "On" : "Off"}
      </button>
    </div>
  );
}
