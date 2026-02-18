# JB’s Personal AI Team Mission Control ⚙️

Welcome to the operating system behind JB’s AI team.

This repo is a practical example of how to run a **multi-agent personal mission control** with:
- clear priorities,
- explicit governance,
- fast execution loops,
- human decision checkpoints,
- and a dashboard that stays useful on busy days.

If you’re building your own AI command center, you can either:
1. **Clone and run this directly**, or
2. **Borrow patterns** (unit governance, ask inbox, approval gates, audit trails, Telegram outbox).

---

## Why this exists

Most AI stacks fail because they optimize for output, not control.

Mission Control is designed to answer, at a glance:
- What matters right now?
- What does JB need to decide?
- What was completed?
- What’s next?
- Are we drifting from Tier 1?

---

## The Team (Units, Codenames, Roles)

These are the active units in the system:

- **PROD-1 · Compass 🧭**
  - Product strategy and priority defense
  - Protects Tier 1 focus

- **OPS-1 · Flow 🌊**
  - Sprint sequencing and orchestration
  - Enforces execution order

- **ARCH-1 · Spine 🧬**
  - Architecture authority
  - Guards schema boundaries, service boundaries, long-term integrity

- **ENG-1 · Builder 🔨**
  - Delivery and stability
  - Builds, fixes, refactors, ships safely

- **GOV-1 · Gatekeeper 🛡**
  - Governance and risk enforcement
  - Blocks unsafe actions and enforces approvals

- **REV-1 · Monetizer 💰**
  - Revenue strategy and monetization alignment

- **GTM-1 · Amplifier 📣**
  - Marketing and growth distribution

- **CONTRA-1 · Wrench 🧨**
  - Contrarian stress-test unit
  - Prevents groupthink and Tier drift before work enters sprint

---

## Core principles

1. **Tier 1 first**
   - Tier 3 work is blocked if Tier 1 backlog exists.

2. **Ask-first landing page**
   - Dashboard defaults to what JB must decide now.

3. **No silent risk**
   - Sensitive actions require explicit approval.

4. **Append-only governance trail**
   - Decision events are logged and queryable.

5. **Telegram as output bus**
   - Notifications are delivered from an outbox queue (no dropped sends on transient failure).

---

## What’s in the UI

### Landing (Overview)
Built for a 15-second scan:
- active Tier 1 posture
- approvals pending
- Wrench objections
- JB ask inbox (with action buttons)
- done recently / next up
- unit board + Telegram preview

### Tabs
- **Decisions**: approvals + event timeline
- **Execution**: task orchestration + pulse + readiness
- **Governance**: unit rules + guardrails + permissions
- **Intel**: GitHub signal + dependency map

---

## Architecture snapshot

- Next.js dashboard + API routes
- Durable SQL backbone (SQLite local-first, Postgres-upgradeable)
- Service-layer persistence (thin route handlers)
- Optimistic concurrency on approvals (`version` + `409` conflicts)
- Approval race harness for conflict/recovery testing

---

## API highlights

- `GET /api/events`
- `GET /api/approvals`
- `GET /api/approvals/:id`
- `PATCH /api/approvals/:id`
- `POST /api/asks/resolve`
- `POST /api/telegram/notify`
- `GET /api/telegram/feed`

Telegram notify supports:
- raw payloads, and
- typed templates (`approval_requested`, `approval_decided`, `daily_pulse`, `wrench_alert`)

---

## Local development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Educational paths (if you’re exploring ideas)

If you’re just learning, start here:
1. `src/lib/unit-governance.ts` → how roles/checks are encoded
2. `src/lib/services/approvalService.ts` → concurrency-safe approvals + audit events
3. `src/lib/services/telegramService.ts` → outbox + delivery eventing
4. `src/app/page.tsx` → ask-first dashboard composition
5. `scripts/approval-race-harness.mjs` → conflict simulation end-to-end

---

## Docs

- `docs/operations/MISSION_CONTROL_UNIT_SYSTEM_v1.md`
- `docs/audit/UNIT_GAP_AUDIT_2026-02-18.md`
- `docs/operations/WORKING_AGREEMENT_v1.md`
- `docs/operations/operator-runbook.md`

---

## Ownership

- **Principal:** Justin “JB” Bergeron
- **System:** Personal AI Team Mission Control

This is a living execution system. Clone it, remix it, improve it, and build your own version of disciplined AI operations.
