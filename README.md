# AI Clawbot Mission Control

Mission Control is the collaborative operations HQ for JB’s AI team.

It is designed to make strategy and execution visible in one place:
- what agents are doing now,
- what needs approval,
- what shipped,
- what is blocked,
- and what moves Tier 1 priorities forward.

---

## Purpose

This workspace supports high-agency execution across JB’s priority ladder:

1. **Tier 1:** Haushavn MVP launch readiness
2. **Tier 2:** AGB Coaching revenue system
3. **Tier 3:** Dashboard recurring revenue + Controllables growth

Mission Control acts as the coordination layer between planning, delivery, and governance.

---

## Current Features

## 1) Operator Quick Reference
At-a-glance operating contract:
- approval gates,
- weekly win criteria,
- pipeline order.

## 2) GitHub Live Panel
Live repository intelligence for open issues and PRs with health state:
- `Healthy` / `Degraded`
- clear error surface when ingestion fails

## 3) Approvals Inbox (Actionable)
Governance queue for sensitive actions:
- persistent approval records
- Approve / Reject actions in UI
- API-backed state updates

## 4) Agent Activity Feed + Top 3
Shows recent delivery momentum and auto-prioritized focus items.

## 5) Event Timeline
Persistent event stream with filtering by:
- pipeline
- agent

## 6) Multi-Repo Dependency View
Cross-repo visibility including:
- repository health/status
- tier alignment
- dependency edges (e.g., playbook transfer)

## 7) Audit-First Docs
Operational docs included:
- Working Agreement v1
- Operator runbook
- sprint docs
- decision log

---

## Data & Persistence

Current implementation uses lightweight file-backed storage for speed and transparency:

- `data/approvals.json` — approvals queue state
- `data/events.json` — event timeline entries
- `data/repositories.json` — repo graph + dependencies

---

## API Routes (Current)

- `GET /api/events`
- `GET /api/approvals`
- `PATCH /api/approvals/:id`

These routes support timeline visibility and governance workflows.

---

## Project Structure

```text
src/
  app/
    page.tsx
    api/
      events/route.ts
      approvals/route.ts
      approvals/[id]/route.ts
  components/hq/
    ActivityFeed.tsx
    ApprovalInbox.tsx
    EventTimeline.tsx
    GitHubLivePanel.tsx
    RepoDependencyBoard.tsx
  lib/
    live.ts
    approvals.ts
    events.ts
    repositories.ts

data/
  approvals.json
  events.json
  repositories.json

docs/
  operations/
  sprints/
  audit/
```

---

## Operating Model

Pipeline sequence currently enforced:

**A → D → B → C**
- **A:** Bug Engineer
- **D:** Operator Sprint Planner
- **B:** Revenue Officer
- **C:** Marketing

Approval gates (explicit JB approval required):
- Deployments
- Outbound messages
- Purchases

---

## Local Development

If this repo is fully scaffolded with Next.js metadata (e.g., `package.json`), standard run flow is:

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

> Note: this repo was initialized from subtree history during bootstrap. If you’re missing scaffold files locally, re-sync from the latest pushed branch before running.

---

## PR Strategy

Mission Control is intentionally shipped in small, reviewable increments.

Recent PR chain:
- PR #1: roadmap + baseline setup
- PR #2: live ingestion error states + persisted approvals queue
- PR #3: event timeline + audit visibility API
- PR #4: multi-repo dependency board
- PR #5: approval actions + timeline filters + audit event writes

---

## Architecture Direction

We are transitioning from local file-backed state to a durable state backbone.

- Current: JSON files in `data/`
- Next: SQL-backed operational store (`db/schema.sql`)
- Goal: reliable multi-user collaboration and auditability

## Near-Term Roadmap

1. Real-time update channel (or polling cadence controls)
2. Optimistic UI + conflict-safe action locking
3. Multi-repo task graph with dependency scoring
4. Haushavn repo onboarding and Tier-1-first routing
5. Role-based permissions for additional collaborators

---

## Ownership

- **Principal:** Justin “JB” Bergeron
- **Lead Operator:** Embedded Strategic AI & Execution Engine (⚙️)

This is a living system. Expect weekly iteration.


## Latest Incremental PR Chain (6–10)

- **PR #6**: live refresh controls + safer approval action locking
- **PR #7**: optimistic approval updates with rollback safety
- **PR #8**: ops pulse summary metrics
- **PR #9**: role permissions matrix
- **PR #10**: release + break notes (this PR)

### What changed in this tranche
- Real-time collaboration controls are now visible in the UI
- Governance actions are safer under failure conditions
- Leadership gets quick operational pulse metrics
- Permissions are explicit per team role

---

## Break Procedure (Operator + JB)

When pausing after a shipping sprint:

1. Confirm all open PR links are posted in chat
2. Confirm stacked base ordering is correct
3. Leave next-step note in PR #10 body
4. Resume from highest stack branch next session



## Haushavn Readiness

A dedicated onboarding playbook is included to accelerate Tier-1 repo takeover:

- `docs/operations/HAUSHAVN_ONBOARDING_KIT.md`

This kit defines access/safety checks, label bootstrap, MVP mapping, and a first 72-hour sprint template.
