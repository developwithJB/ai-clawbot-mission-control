# Haushavn Onboarding Kit (PR #15)

Use this checklist when the private Haushavn repo is shared.

## 1) Access + Safety
- Confirm repo access for Operator workflows
- Confirm branch strategy (main/develop/trunk)
- Enable mandatory PR flow (manual if plan-limited)
- Confirm approval gates remain active for deploy/message/purchase

## 2) Label & Workflow Bootstrap
- Apply Pipeline A labels:
  - bug, needs-repro, blocked
  - severity:P1..P4
  - area:frontend/backend/infra/security/product
- Apply sprint labels:
  - sprint:3day
  - needs-review

## 3) MVP Mapping
Map current codebase to Tier 1 milestones:
- transaction state engine
- RBAC
- secure docs
- event/audit layer
- demo readiness

## 4) First 72h Sprint Template
Day 1: Risk/gap scan + architecture checkpoints
Day 2: Deterministic state flow + test harness focus
Day 3: Security and audit readiness hardening

## 5) Deliverables
- Prioritized backlog with acceptance criteria
- Risk register top 5
- CEO-ready Monday briefing packet
