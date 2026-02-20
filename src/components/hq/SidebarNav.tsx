"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/tasks", label: "Tasks" },
  { href: "/content", label: "Content" },
  { href: "/approvals", label: "Approvals" },
  { href: "/calendar", label: "Calendar" },
  { href: "/memory", label: "Memory" },
  { href: "/office", label: "Office" },
  { href: "/team", label: "Team" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b border-zinc-800 bg-zinc-900/80 p-4 md:sticky md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Mission Control</p>
        <h1 className="mt-1 text-lg font-semibold text-zinc-100">HQ Console</h1>
      </div>
      <nav className="grid grid-cols-2 gap-2 md:grid-cols-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                active
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
