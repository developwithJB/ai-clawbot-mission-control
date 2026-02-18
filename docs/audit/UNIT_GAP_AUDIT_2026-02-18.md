# Unit Governance Gap Audit — 2026-02-18

## Scope
Post-initialization audit for Mission Control Unit System v1.

## Structural Weaknesses

1. **Identity trust is header-based (MVP only)**
   - Current actor/role attribution depends on request headers.
   - Risk: spoofing without real auth session binding.
   - Severity: High

2. **Veto/escalation log taxonomy is not yet explicit**
   - `approval_decided` events exist, but veto and escalation event types are not yet first-class.
   - Risk: governance history can be incomplete.
   - Severity: Medium

3. **Tier lock is helper-level, not globally enforced**
   - Tier-3 blocking exists as policy helper but is not mandatory across all task intake routes.
   - Risk: drift under rapid execution.
   - Severity: Medium

4. **Role overlap detection is policy-level, not runtime-enforced**
   - Unit boundaries are codified but there is no hard runtime check to prevent assignment overlap.
   - Risk: blurred accountability.
   - Severity: Medium

## Tier Alignment Score

- **Tier 1 Focus Integrity:** 8.5 / 10
- **Governance Integrity:** 7.5 / 10
- **Execution Clarity:** 8.0 / 10
- **Human Relatability / Identity Layer:** 9.0 / 10

**Composite Score:** **8.25 / 10**

## First 3 Actions (Governance Model)

1. **Bind actor identity to authenticated session claims**
   - Owner: GOV-1 + ARCH-1
   - Tier: 1
   - Impact: Governance
   - Risk: High

2. **Add explicit event types for veto + escalation**
   - Owner: ARCH-1 + OPS-1
   - Tier: 1
   - Impact: Stability/Governance
   - Risk: Medium

3. **Enforce Tier lock at write routes (`/api/tasks`, orchestration routes)**
   - Owner: OPS-1 + PROD-1
   - Tier: 1
   - Impact: Stability
   - Risk: Medium

## Decision
Unit Governance v1 is viable and active, with immediate follow-through required on identity hardening and governance event completeness.
