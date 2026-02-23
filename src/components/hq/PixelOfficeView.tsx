"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type UnitStatus = "Idle" | "Working" | "Blocked" | "Needs JB" | "Waiting approval";

type PixelTask = {
  id: string;
  title: string;
  description?: string;
  tier: "Tier 1" | "Tier 2" | "Tier 3";
  status: string;
  owner: string;
  nextOwner?: string;
  updatedAt?: string;
};

type PixelUnit = {
  code: string;
  codename: string;
  icon: string;
  tier: 1 | 2 | 3;
  status: UnitStatus;
  objective: string;
  nextOwner: string;
  updatedAt: string;
  currentTask?: PixelTask;
};

type OfficeEvent = { id: string; summary: string; agent: string; timestamp: string };
type OfficeApproval = { id: string; item: string; reason: string; status: "pending" | "approved" | "rejected"; level: "High" | "Medium"; createdAt: string };

type Props = {
  units: PixelUnit[];
  recentActivity: OfficeEvent[];
  approvals: OfficeApproval[];
};

type Actor = {
  code: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  frame: number;
  frameAcc: number;
  trail: Array<{ x: number; y: number; life: number }>;
};

const TILE = 16;
const WORLD_W = 72 * TILE;
const WORLD_H = 44 * TILE;
const SPRITE_FPS = 7;
const GOV_POS = { x: 17 * TILE, y: 20 * TILE };

const ZONES: Record<string, { x: number; y: number; w: number; h: number; label: string }> = {
  "ARCH-1": { x: 6 * TILE, y: 6 * TILE, w: 9 * TILE, h: 6 * TILE, label: "Architecture Desk" },
  "ENG-1": { x: 20 * TILE, y: 6 * TILE, w: 10 * TILE, h: 7 * TILE, label: "Builder Workbench" },
  "CONTRA-1": { x: 34 * TILE, y: 6 * TILE, w: 10 * TILE, h: 6 * TILE, label: "QA Test Bench" },
  "PROD-1": { x: 48 * TILE, y: 6 * TILE, w: 12 * TILE, h: 6 * TILE, label: "Strategy Table" },
  "GOV-1": { x: 6 * TILE, y: 17 * TILE, w: 13 * TILE, h: 8 * TILE, label: "Approval Gate" },
  "OPS-1": { x: 25 * TILE, y: 17 * TILE, w: 12 * TILE, h: 8 * TILE, label: "Flow Board" },
  "GTM-1": { x: 41 * TILE, y: 17 * TILE, w: 10 * TILE, h: 8 * TILE, label: "Broadcast Desk" },
  "REV-1": { x: 55 * TILE, y: 17 * TILE, w: 11 * TILE, h: 8 * TILE, label: "Money Terminal" },
};

function tierColor(tier: 1 | 2 | 3) {
  if (tier === 1) return "#38bdf8";
  if (tier === 2) return "#34d399";
  return "#a78bfa";
}

function statusColor(status: UnitStatus) {
  if (status === "Working") return "#10b981";
  if (status === "Blocked") return "#fb7185";
  if (status === "Needs JB") return "#facc15";
  if (status === "Waiting approval") return "#f59e0b";
  return "#94a3b8";
}

function containsToken(text: string, token: string) {
  return text.toLowerCase().includes(token.toLowerCase());
}

function mapUnitEvents(unit: PixelUnit, events: OfficeEvent[]) {
  const t = `${unit.code} ${unit.codename}`.toLowerCase();
  return events.filter((e) => containsToken(`${e.agent} ${e.summary}`.toLowerCase(), unit.code.toLowerCase()) || containsToken(`${e.agent} ${e.summary}`.toLowerCase(), unit.codename.toLowerCase()) || containsToken(`${e.agent} ${e.summary}`.toLowerCase(), t)).slice(0, 5);
}

function mapUnitApprovals(unit: PixelUnit, approvals: OfficeApproval[]) {
  return approvals.filter((a) => containsToken(`${a.item} ${a.reason} ${a.id}`.toLowerCase(), unit.code.toLowerCase()) || containsToken(`${a.item} ${a.reason}`.toLowerCase(), unit.codename.toLowerCase()) || (unit.code === "GOV-1" && a.status === "pending")).slice(0, 5);
}


export function PixelOfficeView({ units, recentActivity, approvals }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const actorsRef = useRef<Map<string, Actor>>(new Map());
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }>>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [debug, setDebug] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search);
    return q.get("pixelDebug") === "1" || window.localStorage.getItem("mc_pixel_debug") === "1";
  });

  const selectedUnit = useMemo(() => units.find((u) => u.code === selectedCode) ?? null, [units, selectedCode]);
  const selectedEvents = useMemo(() => (selectedUnit ? mapUnitEvents(selectedUnit, recentActivity) : []), [selectedUnit, recentActivity]);
  const selectedApprovals = useMemo(() => (selectedUnit ? mapUnitApprovals(selectedUnit, approvals) : []), [selectedUnit, approvals]);

  useEffect(() => {
    const bg = document.createElement("canvas");
    bg.width = WORLD_W;
    bg.height = WORLD_H;
    const g = bg.getContext("2d");
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#030712";
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Isometric-feel parquet floor with subtle depth bands
    for (let y = 0; y < WORLD_H; y += TILE) {
      for (let x = 0; x < WORLD_W; x += TILE) {
        const row = Math.floor(y / TILE);
        const col = Math.floor(x / TILE);
        const diag = (col - row + 80) % 4;
        const tone = diag === 0 ? "#1f2937" : diag === 1 ? "#172030" : diag === 2 ? "#111827" : "#0b1220";
        g.fillStyle = tone;
        g.fillRect(x, y, TILE, TILE);
        g.fillStyle = "rgba(148,163,184,0.06)";
        g.fillRect(x, y, TILE, 1);
      }
    }

    // Room shell with top and side walls to fake isometric framing
    g.fillStyle = "#0f172a";
    g.fillRect(2 * TILE, 2 * TILE, 68 * TILE, 3 * TILE);
    g.fillStyle = "#111827";
    g.fillRect(67 * TILE, 5 * TILE, 3 * TILE, 37 * TILE);
    g.fillStyle = "#111827";
    g.fillRect(2 * TILE, 5 * TILE, 3 * TILE, 37 * TILE);

    g.strokeStyle = "#334155";
    g.lineWidth = 2;
    g.strokeRect(2 * TILE, 2 * TILE, 68 * TILE, 40 * TILE);

    // Hall runners and central transit lane
    g.fillStyle = "#3f2b4a";
    g.fillRect(4 * TILE, 14 * TILE, 64 * TILE, 4 * TILE);
    g.fillStyle = "#4c1d95";
    for (let x = 5 * TILE; x < 66 * TILE; x += 3 * TILE) g.fillRect(x, 16 * TILE, TILE, 1);

    g.fillStyle = "#1e293b";
    g.fillRect(20 * TILE, 4 * TILE, 2 * TILE, 34 * TILE);

    // Windows + blinds + sill highlights
    for (let i = 0; i < 7; i += 1) {
      const wx = (6 + i * 9) * TILE;
      g.fillStyle = "#0ea5e9";
      g.fillRect(wx, 3 * TILE, 5 * TILE, TILE);
      g.fillStyle = "#67e8f9";
      g.fillRect(wx + 1, 3 * TILE, 3 * TILE, 1);
      g.fillStyle = "#64748b";
      g.fillRect(wx, 4 * TILE, 5 * TILE, 1);
    }

    Object.values(ZONES).forEach((z, idx) => {
      const zy = z.y;
      const zh = z.h;
      const zx = z.x;

      // platform / rug for each team area
      g.fillStyle = idx % 2 === 0 ? "#0b1220" : "#111827";
      g.fillRect(zx - 2, zy - 2, z.w + 4, zh + 4);
      g.strokeStyle = "#334155";
      g.strokeRect(zx - 2, zy - 2, z.w + 4, zh + 4);

      // desk bank (back edge lighter, front edge darker)
      g.fillStyle = "#64748b";
      g.fillRect(zx + 4, zy + zh - 14, z.w - 8, 5);
      g.fillStyle = "#334155";
      g.fillRect(zx + 4, zy + zh - 9, z.w - 8, 7);

      // monitors
      const stations = Math.max(2, Math.floor(z.w / 28));
      for (let i = 0; i < stations; i += 1) {
        const mx = zx + 8 + i * 24;
        g.fillStyle = "#0f172a";
        g.fillRect(mx, zy + zh - 20, 10, 6);
        g.fillStyle = "#22d3ee";
        g.fillRect(mx + 1, zy + zh - 19, 8, 4);
      }

      // decor: potted plant + wall frame
      g.fillStyle = "#14532d";
      g.fillRect(zx + z.w - 10, zy + 4, 5, 5);
      g.fillStyle = "#22c55e";
      g.fillRect(zx + z.w - 11, zy + 1, 7, 4);

      g.fillStyle = "#1e293b";
      g.fillRect(zx + 4, zy + 3, 8, 6);
      g.fillStyle = "#7dd3fc";
      g.fillRect(zx + 5, zy + 4, 6, 4);
    });

    bgRef.current = bg;
  }, []);

  useEffect(() => {
    const existing = actorsRef.current;
    units.forEach((u, index) => {
      if (!existing.has(u.code)) {
        const z = ZONES[u.code] ?? ZONES["OPS-1"];
        existing.set(u.code, {
          code: u.code,
          x: z.x + 16 + (index % 4) * 10,
          y: z.y + 16 + (index % 3) * 10,
          tx: z.x + z.w / 2,
          ty: z.y + z.h / 2,
          vx: 0,
          vy: 0,
          frame: 0,
          frameAcc: 0,
          trail: [],
        });
      }
    });

    Array.from(existing.keys()).forEach((k) => {
      if (!units.find((u) => u.code === k)) existing.delete(k);
    });
  }, [units]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let camX = WORLD_W / 2;
    let camY = WORLD_H / 2;
    let camZoom = 1;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = 520;
      canvas.style.height = "520px";
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const selected = units.find((u) => u.code === selectedCode);
      if (selected) {
        const z = ZONES[selected.code] ?? ZONES["OPS-1"];
        camX += (z.x + z.w / 2 - camX) * 0.08;
        camY += (z.y + z.h / 2 - camY) * 0.08;
        camZoom += (1.65 - camZoom) * 0.08;
      } else {
        camX += (WORLD_W / 2 - camX) * 0.08;
        camY += (WORLD_H / 2 - camY) * 0.08;
        camZoom += (1 - camZoom) * 0.08;
      }

      units.forEach((u, idx) => {
        const actor = actorsRef.current.get(u.code);
        if (!actor) return;

        const zone = ZONES[u.code] ?? ZONES["OPS-1"];
        let tx = zone.x + zone.w / 2;
        let ty = zone.y + zone.h / 2;

        if (u.status === "Needs JB") {
          tx = GOV_POS.x + 14;
          ty = GOV_POS.y + ((idx % 3) - 1) * 10;
        } else if (u.status === "Waiting approval") {
          tx = GOV_POS.x + 28 + (idx % 2) * 8;
          ty = GOV_POS.y + 8 + (idx % 3) * 6;
        } else if (u.status === "Idle") {
          tx = zone.x + 12 + (idx % 3) * 10;
          ty = zone.y + zone.h - 14;
        }

        actor.tx = Math.floor(tx);
        actor.ty = Math.floor(ty);

        const dx = actor.tx - actor.x;
        const dy = actor.ty - actor.y;
        const dist = Math.hypot(dx, dy);
        const speed = u.status === "Working" ? 56 : 42;

        if (dist > 1) {
          actor.vx = (dx / dist) * speed;
          actor.vy = (dy / dist) * speed;
          actor.x += actor.vx * dt;
          actor.y += actor.vy * dt;
          actor.trail.push({ x: actor.x, y: actor.y, life: 0.3 });
          if (actor.trail.length > 8) actor.trail.shift();
        } else {
          actor.x += (actor.tx - actor.x) * 0.25;
          actor.y += (actor.ty - actor.y) * 0.25;
          actor.vx *= 0.65;
          actor.vy *= 0.65;
        }

        actor.frameAcc += dt;
        if (actor.frameAcc >= 1 / SPRITE_FPS) {
          actor.frameAcc = 0;
          actor.frame = (actor.frame + 1) % 4;
        }

        actor.trail.forEach((t) => {
          t.life -= dt;
        });
        actor.trail = actor.trail.filter((t) => t.life > 0);

        if (u.status === "Working" && Math.random() < 0.11) {
          particlesRef.current.push({
            x: Math.floor(actor.x + (Math.random() * 8 - 4)),
            y: Math.floor(actor.y - 8 + (Math.random() * 5 - 2)),
            vx: (Math.random() - 0.5) * 18,
            vy: -8 - Math.random() * 14,
            life: 0.5,
            color: "#22d3ee",
          });
        }
      });

      particlesRef.current.forEach((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      });
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(camZoom, camZoom);
      ctx.translate(-Math.floor(camX), -Math.floor(camY));

      if (bgRef.current) ctx.drawImage(bgRef.current, 0, 0);

      const pulse = (Math.sin(now / 1000) + 1) * 0.5;
      Object.entries(ZONES).forEach(([code, z]) => {
        ctx.fillStyle = code === "GOV-1" ? `rgba(245,158,11,${0.06 + pulse * 0.06})` : `rgba(56,189,248,${0.03 + pulse * 0.04})`;
        ctx.fillRect(Math.floor(z.x + 2), Math.floor(z.y + 2), Math.floor(z.w - 4), Math.floor(z.h - 4));
      });

      units.forEach((u) => {
        const actor = actorsRef.current.get(u.code);
        if (!actor) return;

        actor.trail.forEach((t) => {
          ctx.fillStyle = `rgba(125,211,252,${Math.max(0, t.life * 1.4)})`;
          ctx.fillRect(Math.floor(t.x), Math.floor(t.y), 2, 2);
        });

        const px = Math.floor(actor.x);
        const py = Math.floor(actor.y);

        const bob = u.status === "Idle" ? Math.sin(now / 520 + px) * 0.8 : 0;
        const blink = u.status === "Blocked" ? (Math.floor(now / 240) % 2 === 0 ? 1 : 0.4) : 1;
        const frameNudge = actor.frame % 2 === 0 ? 0 : 1;
        const sy = Math.floor(py + bob);

        // shadow + tile anchor
        ctx.fillStyle = "rgba(2,6,23,0.65)";
        ctx.fillRect(px - 6, sy + 2, 12, 4);
        ctx.fillStyle = "rgba(30,41,59,0.8)";
        ctx.fillRect(px - 7, sy + 1, 14, 1);

        // tier ring + body with more pixel detail
        ctx.strokeStyle = tierColor(u.tier);
        ctx.lineWidth = 1;
        ctx.strokeRect(px - 8, sy - 15, 16, 16);
        ctx.globalAlpha = blink;

        ctx.fillStyle = "#111827";
        ctx.fillRect(px - 5, sy - 10, 10, 9);
        ctx.fillStyle = statusColor(u.status);
        ctx.fillRect(px - 4 + frameNudge, sy - 9, 8, 7);
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(px - 1 + frameNudge, sy - 8, 2, 2);

        // head
        ctx.fillStyle = "#f8d6b8";
        ctx.fillRect(px - 3, sy - 14, 6, 5);
        ctx.fillStyle = "#7c2d12";
        ctx.fillRect(px - 3, sy - 14, 6, 1);

        // tiny desk-facing hint when idle/working
        if (u.status === "Working" || u.status === "Idle") {
          ctx.fillStyle = "#475569";
          ctx.fillRect(px - 6, sy - 1, 12, 2);
          ctx.fillStyle = "#22d3ee";
          ctx.fillRect(px - 3, sy - 2, 6, 1);
        }

        // Employee identity is their associated emoji (required)
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(u.icon, px, sy - 19);
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
        ctx.globalAlpha = 1;

        const statusBubble = u.status === "Needs JB" ? "!" : u.status === "Waiting approval" ? "…" : u.status === "Blocked" ? "x" : u.status === "Working" ? "*" : "-";
        ctx.fillStyle = "#111827";
        ctx.fillRect(px - 6, sy - 30, 12, 10);
        ctx.strokeStyle = statusColor(u.status);
        ctx.strokeRect(px - 6, sy - 30, 12, 10);
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "8px monospace";
        ctx.fillText(statusBubble, px - 2, sy - 22);

        ctx.fillStyle = "rgba(2,6,23,0.9)";
        ctx.fillRect(px - 22, sy + 5, 44, 10);
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "8px monospace";
        ctx.fillText(u.codename.slice(0, 10), px - 20, sy + 13);
      });

      particlesRef.current.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life * 1.8);
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 2);
      });
      ctx.globalAlpha = 1;

      if (debug) {
        ctx.strokeStyle = "rgba(148,163,184,0.25)";
        ctx.lineWidth = 1;
        for (let x = 0; x < WORLD_W; x += TILE) ctx.strokeRect(x, 0, 1, WORLD_H);
        for (let y = 0; y < WORLD_H; y += TILE) ctx.strokeRect(0, y, WORLD_W, 1);
      }

      ctx.restore();
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);

    const onClick = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;

      const wx = (cx - canvas.width / 2) / camZoom + camX;
      const wy = (cy - canvas.height / 2) / camZoom + camY;

      let picked: string | null = null;
      units.forEach((u) => {
        const a = actorsRef.current.get(u.code);
        if (!a) return;
        if (Math.abs(wx - a.x) <= 12 && Math.abs(wy - a.y) <= 12) picked = u.code;
      });
      setSelectedCode(picked);
    };

    canvas.addEventListener("click", onClick);

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setSelectedCode(null);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [units, selectedCode, debug]);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Operations Floor (Pixel View)</h2>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>Overview {selectedUnit ? "- Focus active" : "- Full floor"}</span>
          <button
            type="button"
            onClick={() => {
              const next = !debug;
              setDebug(next);
              if (typeof window !== "undefined") window.localStorage.setItem("mc_pixel_debug", next ? "1" : "0");
            }}
            className="rounded border border-zinc-700 px-2 py-1 hover:border-zinc-500"
          >
            {debug ? "Debug ON" : "Debug OFF"}
          </button>
        </div>
      </div>

      <div ref={wrapRef} className="relative overflow-hidden rounded-xl border border-zinc-800 bg-[#020617]">
        <canvas
          ref={canvasRef}
          aria-label="Pixel Operations Floor canvas showing live unit status and movement"
          className="block w-full [image-rendering:pixelated]"
        />
      </div>

      {selectedUnit ? (
        <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-950/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Focus Mode</p>
              <h3 className="text-lg font-semibold text-zinc-100">
                {selectedUnit.icon} {selectedUnit.codename} ({selectedUnit.code})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCode(null)}
              className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500"
            >
              Back to Overview
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
              <p className="text-xs uppercase text-zinc-500">Task</p>
              <p className="mt-1 font-medium text-zinc-100">{selectedUnit.currentTask?.title ?? "N/A"}</p>
              <p className="mt-1 text-zinc-400">{selectedUnit.currentTask?.description ?? selectedUnit.objective ?? "N/A"}</p>
              <div className="mt-2 space-y-1 text-xs text-zinc-300">
                <p>Tier: {selectedUnit.currentTask?.tier ?? `Tier ${selectedUnit.tier}`}</p>
                <p>Next owner: {selectedUnit.nextOwner || selectedUnit.currentTask?.nextOwner || "N/A"}</p>
                <p>Last update: {selectedUnit.updatedAt ? new Date(selectedUnit.updatedAt).toLocaleString() : "N/A"}</p>
              </div>
            </article>

            <article className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
              <p className="text-xs uppercase text-zinc-500">Recent Events</p>
              <ul className="mt-2 space-y-2">
                {selectedEvents.length ? (
                  selectedEvents.map((event) => (
                    <li key={event.id} className="rounded border border-zinc-800 bg-zinc-950/50 p-2">
                      <p className="text-zinc-200">{event.summary}</p>
                      <p className="text-xs text-zinc-500">{event.agent} - {new Date(event.timestamp).toLocaleTimeString()}</p>
                    </li>
                  ))
                ) : (
                  <li className="text-zinc-500">No recent events mapped to this unit.</li>
                )}
              </ul>
            </article>

            <article className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
              <p className="text-xs uppercase text-zinc-500">Approvals</p>
              <ul className="mt-2 space-y-2">
                {selectedApprovals.length ? (
                  selectedApprovals.map((approval) => (
                    <li key={approval.id} className="rounded border border-zinc-800 bg-zinc-950/50 p-2">
                      <p className="text-zinc-200">{approval.item}</p>
                      <p className="text-xs text-zinc-500">{approval.status} - {approval.level}</p>
                    </li>
                  ))
                ) : (
                  <li className="text-zinc-500">No approvals confidently linked to this unit.</li>
                )}
              </ul>
            </article>
          </div>
        </div>
      ) : null}
    </section>
  );
}
