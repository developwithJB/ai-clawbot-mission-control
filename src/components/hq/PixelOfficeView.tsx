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
const SPRITE_FPS = 6;
const AGENT_SCALE = 1.2;
const EMOJI_BASE_FONT_PX = 14;
const EMOJI_OVERVIEW_MULTIPLIER = 4.25;
const DEFAULT_ZOOM = 1.18;
const WALK_SPEED_FACTOR = 0.6;
const MAX_PARTICLES_PER_ACTOR = 2;
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
  basketball: { x: 8 * TILE, y: 28 * TILE, w: 12 * TILE, h: 11 * TILE, label: "Basketball" },
  cards: { x: 23 * TILE, y: 28 * TILE, w: 14 * TILE, h: 10 * TILE, label: "Cards" },
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
  const particlesRef = useRef<Array<{ owner: string; x: number; y: number; vx: number; vy: number; life: number; color: string }>>([]);
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
    g.fillStyle = "#0b1220";
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Shared shell + coherent office interior planes.
    const room = { x: 2 * TILE, y: 2 * TILE, w: 68 * TILE, h: 40 * TILE };
    const wallBand = { x: 4 * TILE, y: 5 * TILE, w: 63 * TILE, h: 4 * TILE };
    const floor = { x: 4 * TILE, y: 9 * TILE, w: 63 * TILE, h: 32 * TILE };
    const walkwayH = { x: 5 * TILE, y: 14 * TILE, w: 62 * TILE, h: 5 * TILE };
    const walkwayV = { x: 34 * TILE, y: 10 * TILE, w: 4 * TILE, h: 29 * TILE };

    g.fillStyle = "#0f172a";
    g.fillRect(room.x, room.y, room.w, room.h);
    g.fillStyle = "#1f2937";
    g.fillRect(wallBand.x, wallBand.y, wallBand.w, wallBand.h);

    // Window strip and warm accent sconces on one shared wall plane.
    for (let i = 0; i < 7; i += 1) {
      const wx = (6 + i * 9) * TILE;
      g.fillStyle = "#0ea5e9";
      g.fillRect(wx, 3 * TILE, 5 * TILE, TILE);
      g.fillStyle = "#7dd3fc";
      g.fillRect(wx + 1, 3 * TILE, 3 * TILE, 1);
      g.fillStyle = "#1e293b";
      g.fillRect(wx, 4 * TILE, 5 * TILE, 1);
    }
    for (let i = 0; i < 5; i += 1) {
      g.fillStyle = "rgba(251,191,36,0.3)";
      g.fillRect(9 * TILE + i * 12 * TILE, 6 * TILE, 2, 2);
    }

    // Main floor plane + subtle depth shading.
    g.fillStyle = "#dce5ef";
    g.fillRect(floor.x, floor.y, floor.w, floor.h);
    g.fillStyle = "rgba(226,232,240,0.36)";
    g.fillRect(floor.x, floor.y, floor.w, 6 * TILE);
    g.fillStyle = "rgba(100,116,139,0.14)";
    g.fillRect(floor.x, 31 * TILE, floor.w, 10 * TILE);

    // Coherent walkway planes aligned with the room perspective.
    g.fillStyle = "#c4d0dd";
    g.fillRect(walkwayH.x, walkwayH.y, walkwayH.w, walkwayH.h);
    g.fillRect(walkwayV.x, walkwayV.y, walkwayV.w, walkwayV.h);
    g.fillStyle = "rgba(15,23,42,0.18)";
    g.fillRect(walkwayH.x, walkwayH.y + walkwayH.h, walkwayH.w, 1);
    g.fillRect(walkwayV.x + walkwayV.w, walkwayV.y, 1, walkwayV.h);

    // Perspective-consistent floor seams.
    g.strokeStyle = "rgba(100,116,139,0.15)";
    g.lineWidth = 1;
    const seamRows = [10, 12, 14, 16, 18, 21, 24, 27, 30, 34, 38, 41];
    seamRows.forEach((r) => {
      g.beginPath();
      g.moveTo(floor.x, r * TILE);
      g.lineTo(floor.x + floor.w, r * TILE);
      g.stroke();
    });
    for (let x = floor.x + 4 * TILE; x < floor.x + floor.w; x += 8 * TILE) {
      g.beginPath();
      g.moveTo(x, floor.y);
      g.lineTo(x, floor.y + floor.h);
      g.stroke();
    }

    // Zone floor mats aligned to shared desk anchor band.
    Object.entries(ZONES).forEach(([code, z], idx) => {
      const deskAnchorY = z.y + z.h - 6;
      const matY = deskAnchorY - 9;
      const matH = 11;
      const matX = z.x + 3;
      const matW = z.w - 6;
      const matPalette = code === "GOV-1"
        ? { base: "#d8bd97", seam: "rgba(146,64,14,0.23)" }
        : idx % 2 === 0
          ? { base: "#c7d5e3", seam: "rgba(71,85,105,0.22)" }
          : { base: "#c1cfde", seam: "rgba(51,65,85,0.22)" };
      g.fillStyle = matPalette.base;
      g.fillRect(matX, matY, matW, matH);
      g.strokeStyle = matPalette.seam;
      g.strokeRect(matX, matY, matW, matH);
      g.fillStyle = "rgba(15,23,42,0.14)";
      g.fillRect(matX + 1, deskAnchorY, matW - 2, 1);
    });

    // Shared office shell border and side walls.
    g.fillStyle = "#111827";
    g.fillRect(room.x, room.y, room.w, 3);
    g.fillStyle = "#0f172a";
    g.fillRect(room.x, room.y + 3, 3, room.h - 3);
    g.fillRect(room.x + room.w - 3, room.y + 3, 3, room.h - 3);
    g.strokeStyle = "#64748b";
    g.lineWidth = 2;
    g.strokeRect(room.x, room.y, room.w, room.h);

    // Lounge surfaces (single consistent accent family).
    g.fillStyle = "rgba(56,189,248,0.11)";
    g.fillRect(8 * TILE, 28 * TILE, 12 * TILE, 11 * TILE);
    g.fillRect(23 * TILE, 28 * TILE, 14 * TILE, 10 * TILE);
    g.fillRect(40 * TILE, 28 * TILE, 10 * TILE, 10 * TILE);
    g.fillRect(53 * TILE, 27 * TILE, 14 * TILE, 12 * TILE);

    // JB's office on shared floor with glass accent.
    g.fillStyle = "rgba(2,6,23,0.35)";
    g.fillRect(JB_OFFICE.x + 2, JB_OFFICE.y + JB_OFFICE.h, JB_OFFICE.w - 2, 2);
    g.fillStyle = "#0f172a";
    g.fillRect(JB_OFFICE.x, JB_OFFICE.y, JB_OFFICE.w, JB_OFFICE.h);
    g.strokeStyle = "#38bdf8";
    g.strokeRect(JB_OFFICE.x + 1, JB_OFFICE.y + 1, JB_OFFICE.w - 2, JB_OFFICE.h - 2);
    g.fillStyle = "#334155";
    g.fillRect(JB_OFFICE.x + 10, JB_OFFICE.y + 10, JB_OFFICE.w - 20, 8);
    g.fillStyle = "#93c5fd";
    g.fillRect(JB_OFFICE.x + 14, JB_OFFICE.y + 12, JB_OFFICE.w - 28, 4);
    g.fillStyle = "#38bdf8";
    for (let i = 0; i < 5; i += 1) g.fillRect(JB_OFFICE.x - 22 + i * 10, JB_OFFICE.y + JB_OFFICE.h - 10, 6, 2);

    Object.values(ZONES).forEach((z, idx) => {
      const zy = z.y;
      const zh = z.h;
      const zx = z.x;
      const deskTopY = zy + zh - 14;
      const deskFrontY = zy + zh - 9;
      const floorTouchY = zy + zh - 2;

      // Desk block anchored to one floor contact line.
      g.fillStyle = "rgba(15,23,42,0.22)";
      g.fillRect(zx + 4, floorTouchY, z.w - 8, 2);
      g.fillStyle = idx % 2 === 0 ? "#4b5d73" : "#52657d";
      g.fillRect(zx + 4, deskTopY, z.w - 8, 5);
      g.fillStyle = "#334155";
      g.fillRect(zx + 4, deskFrontY, z.w - 8, 7);

      // Desk legs physically touching floor seam.
      g.fillStyle = "#1e293b";
      g.fillRect(zx + 6, deskFrontY + 6, 2, floorTouchY - (deskFrontY + 6));
      g.fillRect(zx + z.w - 8, deskFrontY + 6, 2, floorTouchY - (deskFrontY + 6));

      // Chairs with direct contact shadows on the same floor line.
      const chairs = Math.max(2, Math.floor(z.w / 24));
      for (let i = 0; i < chairs; i += 1) {
        const cx = zx + 7 + i * 22;
        g.fillStyle = "rgba(2,6,23,0.36)";
        g.fillRect(cx + 1, floorTouchY, 5, 1);
        g.fillStyle = "#1e293b";
        g.fillRect(cx, floorTouchY - 4, 6, 4);
        g.fillStyle = "#64748b";
        g.fillRect(cx + 1, floorTouchY - 6, 4, 2);
      }

      // Monitors with stand-to-desk contact + tiny shadow for grounding.
      const stations = Math.max(2, Math.floor(z.w / 28));
      for (let i = 0; i < stations; i += 1) {
        const mx = zx + 8 + i * 24;
        g.fillStyle = "#020617";
        g.fillRect(mx, deskTopY - 6, 10, 6);
        g.fillStyle = "#22d3ee";
        g.fillRect(mx + 1, deskTopY - 5, 8, 4);
        g.fillStyle = "#0f172a";
        g.fillRect(mx + 4, deskTopY, 2, 3);
        g.fillStyle = "rgba(2,6,23,0.35)";
        g.fillRect(mx + 3, deskTopY + 3, 4, 1);
      }

      // Plant + side console on same perspective plane.
      g.fillStyle = "rgba(15,23,42,0.25)";
      g.fillRect(zx + z.w - 11, zy + 8, 8, 1);
      g.fillStyle = "#14532d";
      g.fillRect(zx + z.w - 10, zy + 4, 5, 5);
      g.fillStyle = "#4ade80";
      g.fillRect(zx + z.w - 11, zy + 1, 7, 4);
      g.fillStyle = "#475569";
      g.fillRect(zx + 4, zy + 3, 8, 6);
      g.fillStyle = "#93c5fd";
      g.fillRect(zx + 5, zy + 4, 6, 4);
    });

    // Idle / lounge zones with modern props
    const b = IDLE_ZONES.basketball;
    g.fillStyle = "rgba(2,6,23,0.28)";
    g.fillRect(b.x + 1, b.y + b.h, b.w - 2, 2);
    g.fillStyle = "#1e293b";
    g.fillRect(b.x, b.y, b.w, b.h);
    g.strokeStyle = "#38bdf8";
    g.strokeRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    g.fillStyle = "#f97316";
    g.fillRect(b.x + b.w - 18, b.y + 10, 10, 10);

    const c = IDLE_ZONES.cards;
    g.fillStyle = "rgba(2,6,23,0.28)";
    g.fillRect(c.x + 1, c.y + c.h, c.w - 2, 2);
    g.fillStyle = "#1f2937";
    g.fillRect(c.x, c.y, c.w, c.h);
    g.fillStyle = "#475569";
    g.fillRect(c.x + 16, c.y + 14, 36, 20);
    g.fillStyle = "#f8fafc";
    g.fillRect(c.x + 22, c.y + 18, 4, 6);
    g.fillRect(c.x + 42, c.y + 22, 4, 6);

    const w = IDLE_ZONES.watercooler;
    g.fillStyle = "rgba(2,6,23,0.28)";
    g.fillRect(w.x + 1, w.y + w.h, w.w - 2, 2);
    g.fillStyle = "#1f2937";
    g.fillRect(w.x, w.y, w.w, w.h);
    g.fillStyle = "#94a3b8";
    g.fillRect(w.x + 26, w.y + 12, 12, 24);
    g.fillStyle = "#38bdf8";
    g.fillRect(w.x + 28, w.y + 14, 8, 6);

    const l = IDLE_ZONES.window;
    g.fillStyle = "rgba(2,6,23,0.28)";
    g.fillRect(l.x + 1, l.y + l.h, l.w - 2, 2);
    g.fillStyle = "#1f2937";
    g.fillRect(l.x, l.y, l.w, l.h);
    g.fillStyle = "#475569";
    g.fillRect(l.x + 10, l.y + 24, l.w - 20, 12);
    g.fillStyle = "#7dd3fc";
    g.fillRect(l.x + 6, l.y + 6, l.w - 12, 8);

    // Persistent section labels, legible in overview
    const allLabels = [
      ...Object.values(ZONES),
      JB_OFFICE,
      ...Object.values(IDLE_ZONES),
    ];
    g.font = "bold 10px ui-sans-serif, system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    allLabels.forEach((z) => {
      const lx = Math.floor(z.x + z.w / 2);
      const ly = Math.floor(z.y + 10);
      const textW = Math.ceil(g.measureText(z.label).width);
      g.fillStyle = "rgba(2,6,23,0.82)";
      g.fillRect(lx - Math.floor(textW / 2) - 6, ly - 6, textW + 12, 12);
      g.strokeStyle = "rgba(125,211,252,0.9)";
      g.strokeRect(lx - Math.floor(textW / 2) - 6, ly - 6, textW + 12, 12);
      g.fillStyle = "#e2e8f0";
      g.fillText(z.label, lx, ly + 1);
    });
    g.textAlign = "start";
    g.textBaseline = "alphabetic";

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
          const loop = Math.floor(now / 4200) % 4;
          tx = idleZone.x + 14 + ((idx + loop) % 4) * 9;
          ty = idleZone.y + idleZone.h / 2 + ((idx + loop) % 3) * 4 - 7;
        } else if (u.status === "Working") {
          const sway = (Math.floor(now / 1800) + idx) % 3;
          tx = zone.x + 12 + (idx % 3) * 15;
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
        const speedBase = u.status === "Working" ? 56 : 42;
        const speed = speedBase * WALK_SPEED_FACTOR;

        if (dist > 1) {
          actor.vx = (dx / dist) * speed;
          actor.vy = (dy / dist) * speed;
          actor.x += actor.vx * dt;
          actor.y += actor.vy * dt;
          if (u.status === "Working" && Math.random() < 0.45) {
            actor.trail.push({ x: actor.x, y: actor.y, life: 0.2 });
            if (actor.trail.length > 3) actor.trail.shift();
          }
        } else {
          actor.x += (actor.tx - actor.x) * 0.18;
          actor.y += (actor.ty - actor.y) * 0.18;
          actor.vx *= 0.72;
          actor.vy *= 0.72;
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

        if (u.status === "Working") {
          const actorParticleCount = particlesRef.current.filter((p) => p.owner === u.code).length;
          if (actorParticleCount < MAX_PARTICLES_PER_ACTOR && Math.random() < 0.04) {
            particlesRef.current.push({
              owner: u.code,
              x: Math.floor(actor.x + (Math.random() * 6 - 3)),
              y: Math.floor(actor.y - 7 + (Math.random() * 4 - 2)),
              vx: (Math.random() - 0.5) * 10,
              vy: -5 - Math.random() * 8,
              life: 0.35,
              color: "#f59e0b",
            });
          }
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

      const pulse = (Math.sin(now / 1700) + 1) * 0.5;
      Object.entries(ZONES).forEach(([code, z]) => {
        ctx.fillStyle = code === "GOV-1" ? `rgba(217,119,6,${0.08 + pulse * 0.04})` : `rgba(245,158,11,${0.04 + pulse * 0.025})`;
        ctx.fillRect(Math.floor(z.x + 2), Math.floor(z.y + z.h - 18), Math.floor(z.w - 4), 14);
      });
      ctx.fillStyle = `rgba(251,146,60,${0.09 + pulse * 0.06})`;
      ctx.fillRect(JB_OFFICE.x - 20, JB_OFFICE.y + 3, JB_OFFICE.w + 24, JB_OFFICE.h - 6);
      Object.values(IDLE_ZONES).forEach((z) => {
        ctx.fillStyle = `rgba(56,189,248,${0.035 + pulse * 0.02})`;
        ctx.fillRect(Math.floor(z.x + 2), Math.floor(z.y + 2), Math.floor(z.w - 4), Math.floor(z.h - 4));
      });

      units.forEach((u) => {
        const actor = actorsRef.current.get(u.code);
        if (!actor) return;

        actor.trail.forEach((t) => {
          ctx.fillStyle = `rgba(251,191,36,${Math.max(0, t.life * 0.8)})`;
          ctx.fillRect(Math.floor(t.x), Math.floor(t.y), 1, 1);
        });

        const px = Math.floor(actor.x);
        const py = Math.floor(actor.y);

        const q = (n: number) => Math.round(n * AGENT_SCALE);
        const isBlocked = u.status === "Blocked";

        // Emoji-first actor marker with gentle, distinct status motion.
        const breathe = u.status === "Idle" ? 1 + Math.sin(now / 750 + px) * 0.04 : 1;
        const bounce = u.status === "Working" ? Math.abs(Math.sin(now / 420 + px)) * 4 : 0;
        const pulse = u.status === "Waiting approval" ? 1 + Math.sin(now / 700 + px) * 0.06 : 1;
        const assistNudgeY = u.status === "Needs JB" ? Math.sin(now / 620 + px) * 1.6 : 0;
        const shakeX = isBlocked ? Math.sin(now / 180 + px) * 0.9 : 0;
        const emojiScale = EMOJI_OVERVIEW_MULTIPLIER * breathe * pulse;
        const sy = Math.floor(py - bounce + assistNudgeY);

        ctx.fillStyle = "rgba(2,6,23,0.4)";
        ctx.fillRect(px - q(10), sy + q(8), q(20), q(3));

        // Subtle tier ring + status badge that supports the emoji (doesn't compete with it).
        ctx.strokeStyle = `${tierColor(u.tier)}88`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, sy - q(3), q(10), 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = statusColor(u.status);
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(px + q(8), sy - q(12), q(2.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.save();
        ctx.translate(px + shakeX, sy - q(3));
        ctx.scale(emojiScale, emojiScale);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${EMOJI_BASE_FONT_PX}px sans-serif`;
        ctx.fillText(u.icon, 0, 0);
        ctx.restore();

        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "rgba(2,6,23,0.9)";
        ctx.fillRect(px - q(24), sy + q(12), q(48), q(10));
        ctx.fillStyle = "#e2e8f0";
        ctx.font = `${q(6)}px monospace`;
        ctx.fillText(u.codename.slice(0, 10), px - q(21), sy + q(20));
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
