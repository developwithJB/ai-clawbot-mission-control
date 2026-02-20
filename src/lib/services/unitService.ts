import { getDb } from "@/lib/db";
import { UNIT_REGISTRY, type UnitCode } from "@/lib/unit-governance";

type UnitRow = {
  code: UnitCode;
  codename: string;
  icon: string;
  tier: 1 | 2 | 3;
};

let seeded = false;

function inferTier(code: UnitCode): 1 | 2 | 3 {
  if (["REV-1", "GTM-1"].includes(code)) return 2;
  return 1;
}

export function ensureUnitsSeeded(): void {
  if (seeded) return;
  const db = getDb();

  const upsert = db.prepare(
    `INSERT INTO units (code, codename, icon, tier, reports_to, active, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(code) DO UPDATE SET
       codename = excluded.codename,
       icon = excluded.icon,
       tier = excluded.tier,
       reports_to = excluded.reports_to,
       updated_at = excluded.updated_at`
  );

  const now = new Date().toISOString();
  for (const unit of Object.values(UNIT_REGISTRY)) {
    upsert.run(unit.code, unit.codename, unit.emoji, inferTier(unit.code), unit.reportsTo, now);
  }

  seeded = true;
}

export function listUnits(): UnitRow[] {
  ensureUnitsSeeded();
  const db = getDb();
  return db
    .prepare(`SELECT code, codename, icon, tier FROM units WHERE active = 1 ORDER BY tier ASC, code ASC`)
    .all() as UnitRow[];
}
