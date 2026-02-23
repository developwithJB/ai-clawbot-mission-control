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

type IdleActivity = "basketball" | "cards" | "watercooler" | "window";

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
  idleActivity: IdleActivity;
};

const TILE = 16;
const WORLD_W = 72 * TILE;
const WORLD_H = 44 * TILE;
const SPRITE_FPS = 7;
const AGENT_SCALE = 1.35;
const DEFAULT_ZOOM = 1.18;
const JB_OFFICE = { x: 50 * TILE, y: 17 * TILE, w: 16 * TILE, h: 9 * TILE, label: "JB's Office" };

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

const IDLE_ZONES: Record<IdleActivity, { x: number; y: number; w: number; h: number; label: string }> = {
  basketball: { x: 8 * TILE, y: 28 * TILE, w: 12 * TILE, h: 11 * TILE, label: "Basketball Mini Court" },
  cards: { x: 23 * TILE, y: 28 * TILE, w: 14 * TILE, h: 10 * TILE, label: "Card Table" },
  watercooler: { x: 40 * TILE, y: 28 * TILE, w: 10 * TILE, h: 10 * TILE, label: "Water Cooler" },
  window: { x: 53 * TILE, y: 27 * TILE, w: 14 * TILE, h: 12 * TILE, label: "Window Lounge" },
};

const IDLE_ACTIVITIES: IdleActivity[] = ["basketball", "cards", "watercooler", "window"];

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
    g.fillStyle = "#1a130d";
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Warm shared wood floor (single open room, no checkerboard pods)
    for (let y = 0; y < WORLD_H; y += TILE) {
      for (let x = 0; x < WORLD_W; x += TILE) {
        const row = Math.floor(y / TILE);
        const col = Math.floor(x / TILE);
        const grain = (row + col * 2) % 5;
        const tone = grain === 0 ? "#3a2a1f" : grain === 1 ? "#342519" : grain === 2 ? "#402f22" : grain === 3 ? "#2f2117" : "#473426";
        g.fillStyle = tone;
        g.fillRect(x, y, TILE, TILE);
        g.fillStyle = "rgba(255,237,213,0.08)";
        g.fillRect(x, y, TILE, 1);
      }
    }

    // Shared office shell
    g.fillStyle = "#5b4331";
    g.fillRect(2 * TILE, 2 * TILE, 68 * TILE, 3 * TILE);
    g.fillStyle = "#4a3526";
    g.fillRect(67 * TILE, 5 * TILE, 3 * TILE, 37 * TILE);
    g.fillStyle = "#4a3526";
    g.fillRect(2 * TILE, 5 * TILE, 3 * TILE, 37 * TILE);

    g.strokeStyle = "#8b6b4f";
    g.lineWidth = 2;
    g.strokeRect(2 * TILE, 2 * TILE, 68 * TILE, 40 * TILE);

    // Main shared circulation rug and cross aisle
    g.fillStyle = "#6b3f2a";
    g.fillRect(5 * TILE, 14 * TILE, 62 * TILE, 4 * TILE);
    g.fillStyle = "#d9a066";
    for (let x = 6 * TILE; x < 66 * TILE; x += 3 * TILE) g.fillRect(x, 16 * TILE, TILE, 1);
    g.fillStyle = "#7a4a2f";
    g.fillRect(35 * TILE, 6 * TILE, 2 * TILE, 30 * TILE);

    // Windows with warm daylight
    for (let i = 0; i < 7; i += 1) {
      const wx = (6 + i * 9) * TILE;
      g.fillStyle = "#e6d5b0";
      g.fillRect(wx, 3 * TILE, 5 * TILE, TILE);
      g.fillStyle = "#fef3c7";
      g.fillRect(wx + 1, 3 * TILE, 3 * TILE, 1);
      g.fillStyle = "#8b735f";
      g.fillRect(wx, 4 * TILE, 5 * TILE, 1);
    }

    // JB's Office in shared floor (for blocked / approvals queue)
    g.fillStyle = "#2b1d15";
    g.fillRect(JB_OFFICE.x, JB_OFFICE.y, JB_OFFICE.w, JB_OFFICE.h);
    g.strokeStyle = "#f59e0b";
    g.strokeRect(JB_OFFICE.x + 1, JB_OFFICE.y + 1, JB_OFFICE.w - 2, JB_OFFICE.h - 2);
    g.fillStyle = "#7c2d12";
    g.fillRect(JB_OFFICE.x + 10, JB_OFFICE.y + 10, JB_OFFICE.w - 20, 8);
    g.fillStyle = "#fef3c7";
    g.fillRect(JB_OFFICE.x + 14, JB_OFFICE.y + 12, JB_OFFICE.w - 28, 4);
    // queue lane markers
    g.fillStyle = "#fbbf24";
    for (let i = 0; i < 5; i += 1) {
      g.fillRect(JB_OFFICE.x - 22 + i * 10, JB_OFFICE.y + JB_OFFICE.h - 10, 6, 2);
    }

    Object.values(ZONES).forEach((z, idx) => {
      const zy = z.y;
      const zh = z.h;
      const zx = z.x;

      // Desk islands in one shared room (no boxed per-team rooms)
      g.fillStyle = idx % 2 === 0 ? "#6a4b35" : "#5b3f2b";
      g.fillRect(zx + 4, zy + zh - 14, z.w - 8, 5);
      g.fillStyle = "#4b3324";
      g.fillRect(zx + 4, zy + zh - 9, z.w - 8, 7);

      // Chairs
      const chairs = Math.max(2, Math.floor(z.w / 24));
      for (let i = 0; i < chairs; i += 1) {
        const cx = zx + 7 + i * 22;
        g.fillStyle = "#7c5a43";
        g.fillRect(cx, zy + zh - 5, 6, 4);
      }

      // Monitors
      const stations = Math.max(2, Math.floor(z.w / 28));
      for (let i = 0; i < stations; i += 1) {
        const mx = zx + 8 + i * 24;
        g.fillStyle = "#241a13";
        g.fillRect(mx, zy + zh - 20, 10, 6);
        g.fillStyle = "#f5c97a";
        g.fillRect(mx + 1, zy + zh - 19, 8, 4);
      }

      // Decor: plant + wall art
      g.fillStyle = "#2f5d3a";
      g.fillRect(zx + z.w - 10, zy + 4, 5, 5);
      g.fillStyle = "#58a46d";
      g.fillRect(zx + z.w - 11, zy + 1, 7, 4);

      g.fillStyle = "#6d4c36";
      g.fillRect(zx + 4, zy + 3, 8, 6);
      g.fillStyle = "#fcd9a3";
      g.fillRect(zx + 5, zy + 4, 6, 4);
    });

    // Explicit idle / leisure zones on shared south floor
    const b = IDLE_ZONES.basketball;
    g.fillStyle = "#5a321e";
    g.fillRect(b.x, b.y, b.w, b.h);
    g.strokeStyle = "#f59e0b";
    g.strokeRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    g.fillStyle = "#f97316";
    g.fillRect(b.x + b.w - 18, b.y + 10, 10, 10);

    const c = IDLE_ZONES.cards;
    g.fillStyle = "#3f2a1d";
    g.fillRect(c.x, c.y, c.w, c.h);
    g.fillStyle = "#65412b";
    g.fillRect(c.x + 16, c.y + 14, 36, 20);
    g.fillStyle = "#e2e8f0";
    g.fillRect(c.x + 22, c.y + 18, 4, 6);
    g.fillRect(c.x + 42, c.y + 22, 4, 6);

    const w = IDLE_ZONES.watercooler;
    g.fillStyle = "#3e2e24";
    g.fillRect(w.x, w.y, w.w, w.h);
    g.fillStyle = "#94a3b8";
    g.fillRect(w.x + 26, w.y + 12, 12, 24);
    g.fillStyle = "#38bdf8";
    g.fillRect(w.x + 28, w.y + 14, 8, 6);

    const l = IDLE_ZONES.window;
    g.fillStyle = "#33261d";
    g.fillRect(l.x, l.y, l.w, l.h);
    g.fillStyle = "#7c5a43";
    g.fillRect(l.x + 10, l.y + 24, l.w - 20, 12);
    g.fillStyle = "#fde68a";
    g.fillRect(l.x + 6, l.y + 6, l.w - 12, 8);

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
          idleActivity: IDLE_ACTIVITIES[index % IDLE_ACTIVITIES.length],
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
    let camZoom = DEFAULT_ZOOM;

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
        const isJbQueue = selected.status === "Blocked" || selected.status === "Needs JB" || selected.status === "Waiting approval";
        const z = ZONES[selected.code] ?? ZONES["OPS-1"];
        const focusX = isJbQueue ? JB_OFFICE.x + JB_OFFICE.w / 2 : z.x + z.w / 2;
        const focusY = isJbQueue ? JB_OFFICE.y + JB_OFFICE.h / 2 : z.y + z.h / 2;
        camX += (focusX - camX) * 0.08;
        camY += (focusY - camY) * 0.08;
        camZoom += (1.65 - camZoom) * 0.08;
      } else {
        camX += (WORLD_W / 2 - camX) * 0.08;
        camY += (WORLD_H / 2 - camY) * 0.08;
        camZoom += (DEFAULT_ZOOM - camZoom) * 0.08;
      }

      units.forEach((u, idx) => {
        const actor = actorsRef.current.get(u.code);
        if (!actor) return;

        const zone = ZONES[u.code] ?? ZONES["OPS-1"];
        let tx = zone.x + zone.w / 2;
        let ty = zone.y + zone.h - 13;

        if (u.status === "Needs JB") {
          tx = JB_OFFICE.x - 12 - (idx % 3) * 8;
          ty = JB_OFFICE.y + JB_OFFICE.h - 8 - (idx % 2) * 6;
        } else if (u.status === "Waiting approval") {
          tx = JB_OFFICE.x + 10 + (idx % 4) * 9;
          ty = JB_OFFICE.y + JB_OFFICE.h - 10;
        } else if (u.status === "Idle") {
          actor.idleActivity = IDLE_ACTIVITIES[idx % IDLE_ACTIVITIES.length];
          const idleZone = IDLE_ZONES[actor.idleActivity];
          const loop = Math.floor(now / 1500) % 4;
          tx = idleZone.x + 12 + ((idx + loop) % 4) * 10;
          ty = idleZone.y + idleZone.h / 2 + ((idx + loop) % 3) * 5 - 8;
        } else if (u.status === "Working") {
          const sway = (Math.floor(now / 700) + idx) % 3;
          tx = zone.x + 12 + (idx % 3) * 16;
          ty = zone.y + zone.h - 15 + sway;
        } else if (u.status === "Blocked") {
          tx = JB_OFFICE.x - 16 - (idx % 3) * 9;
          ty = JB_OFFICE.y + 8 + (idx % 3) * 5;
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
            color: "#f59e0b",
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
        ctx.fillStyle = code === "GOV-1" ? `rgba(217,119,6,${0.1 + pulse * 0.08})` : `rgba(245,158,11,${0.06 + pulse * 0.05})`;
        ctx.fillRect(Math.floor(z.x + 2), Math.floor(z.y + z.h - 18), Math.floor(z.w - 4), 14);
      });
      ctx.fillStyle = `rgba(251,146,60,${0.14 + pulse * 0.12})`;
      ctx.fillRect(JB_OFFICE.x - 20, JB_OFFICE.y + 3, JB_OFFICE.w + 24, JB_OFFICE.h - 6);
      Object.values(IDLE_ZONES).forEach((z) => {
        ctx.fillStyle = `rgba(56,189,248,${0.06 + pulse * 0.05})`;
        ctx.fillRect(Math.floor(z.x + 2), Math.floor(z.y + 2), Math.floor(z.w - 4), Math.floor(z.h - 4));
      });

      units.forEach((u) => {
        const actor = actorsRef.current.get(u.code);
        if (!actor) return;

        actor.trail.forEach((t) => {
          ctx.fillStyle = `rgba(251,191,36,${Math.max(0, t.life * 1.4)})`;
          ctx.fillRect(Math.floor(t.x), Math.floor(t.y), 2, 2);
        });

        const px = Math.floor(actor.x);
        const py = Math.floor(actor.y);

        const bob = u.status === "Idle" ? Math.sin(now / 520 + px) * 0.8 : 0;
        const blink = u.status === "Blocked" ? (Math.floor(now / 240) % 2 === 0 ? 1 : 0.4) : 1;
        const frameNudge = actor.frame % 2 === 0 ? 0 : 1;
        const sy = Math.floor(py + bob);
        const q = (n: number) => Math.round(n * AGENT_SCALE);

        // shadow + tile anchor
        ctx.fillStyle = "rgba(2,6,23,0.65)";
        ctx.fillRect(px - q(6), sy + q(2), q(12), q(4));
        ctx.fillStyle = "rgba(30,41,59,0.8)";
        ctx.fillRect(px - q(7), sy + q(1), q(14), q(1));

        // tier ring + body with more pixel detail
        ctx.strokeStyle = tierColor(u.tier);
        ctx.lineWidth = 1;
        ctx.strokeRect(px - q(8), sy - q(15), q(16), q(16));
        ctx.globalAlpha = blink;

        ctx.fillStyle = "#111827";
        ctx.fillRect(px - q(5), sy - q(10), q(10), q(9));
        ctx.fillStyle = statusColor(u.status);
        ctx.fillRect(px - q(4) + frameNudge, sy - q(9), q(8), q(7));
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(px - q(1) + frameNudge, sy - q(8), q(2), q(2));

        // head
        ctx.fillStyle = "#f8d6b8";
        ctx.fillRect(px - q(3), sy - q(14), q(6), q(5));
        ctx.fillStyle = "#7c2d12";
        ctx.fillRect(px - q(3), sy - q(14), q(6), q(1));

        if (u.status === "Working") {
          ctx.fillStyle = "#475569";
          ctx.fillRect(px - q(7), sy - q(1), q(14), q(2));
          ctx.fillStyle = "#f59e0b";
          ctx.fillRect(px - q(3), sy - q(2), q(6), q(1));
        }

        if (u.status === "Idle") {
          const idleGlyph = actor.idleActivity === "basketball" ? "o" : actor.idleActivity === "cards" ? "#" : actor.idleActivity === "watercooler" ? "~" : "^";
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(px + q(6), sy - q(10), q(7), q(7));
          ctx.fillStyle = "#e2e8f0";
          ctx.font = `${q(6)}px monospace`;
          ctx.fillText(idleGlyph, px + q(8), sy - q(4));
        }

        ctx.fillStyle = "rgba(17,24,39,0.9)";
        ctx.fillRect(px - q(10), sy - q(36), q(20), q(12));
        ctx.strokeStyle = "#fbbf24";
        ctx.strokeRect(px - q(10), sy - q(36), q(20), q(12));
        ctx.font = `${q(11)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(u.icon, px, sy - q(30));
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
        ctx.globalAlpha = 1;

        const statusBubble = u.status === "Needs JB" ? "!" : u.status === "Waiting approval" ? "…" : u.status === "Blocked" ? "x" : u.status === "Working" ? "*" : "-";
        ctx.fillStyle = "#111827";
        ctx.fillRect(px - q(6), sy - q(48), q(12), q(10));
        ctx.strokeStyle = statusColor(u.status);
        ctx.strokeRect(px - q(6), sy - q(48), q(12), q(10));
        ctx.fillStyle = "#e5e7eb";
        ctx.font = `${q(6)}px monospace`;
        ctx.fillText(statusBubble, px - q(2), sy - q(40));

        // JB-office queue stance markers
        if (u.status === "Needs JB" || u.status === "Waiting approval" || u.status === "Blocked") {
          ctx.fillStyle = u.status === "Blocked" ? "#ef4444" : u.status === "Needs JB" ? "#facc15" : "#fb923c";
          ctx.fillRect(px - q(9), sy + q(6), q(18), q(2));
        }

        ctx.fillStyle = "rgba(2,6,23,0.9)";
        ctx.fillRect(px - q(22), sy + q(5), q(44), q(10));
        ctx.fillStyle = "#e2e8f0";
        ctx.font = `${q(6)}px monospace`;
        ctx.fillText(u.codename.slice(0, 10), px - q(20), sy + q(13));
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
