# Release Notes — 2026-02-19

## Sprint: Mission Control Operator Surfaces (Tier-1 aligned)

### Shipped
- **Tasks Board hardening**
  - Added owner/tier/status/deadline/blocker/next-action support
  - Added task create/update APIs (`POST /api/tasks`, `PATCH /api/tasks/:id`)
  - Enabled live status control in dashboard

- **Memory screen + search**
  - Added memory API over `MEMORY.md` and `memory/*.md`
  - Added searchable memory UI for historical context review

- **Team structure screen**
  - Added unit/agent role view with status, objective, tier, and next owner

- **Mission Calendar reliability layer**
  - Added cron visibility with next run + last status
  - Added reliability signals: consecutive errors + last error snippet

- **Global Search + HQ wiring**
  - Added global search across events, approvals, tasks, repos, and Telegram ops
  - Integrated all new surfaces into the main Mission Control HQ page

### Operational reliability actions
- Diagnosed and corrected missed morning brief path (timeout-driven non-delivery)
- Hardened morning brief cron with faster model + tighter timeout profile

### GitHub status
- Synced to `developwithJB/ai-clawbot-mission-control` on `main`
- Post-push ahead/behind: `0 / 0`

### Next focus
1. Green full production build in local env (`node:sqlite` type/runtime compatibility)
2. Add token/cost anomaly guardrail panel (timeouts, retries, noisy automations)
3. Expand team execution lanes with stronger ownership KPIs
