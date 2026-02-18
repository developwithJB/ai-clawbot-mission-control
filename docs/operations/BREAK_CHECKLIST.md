# Break Checklist (Post-PR Sprint)

Use this checklist when pausing after a multi-PR shipping run.

## Before break
- [ ] Confirm all PR URLs are shared with JB
- [ ] Confirm stack order is correct (base/head chain)
- [ ] Confirm current top branch name
- [ ] Confirm no uncommitted changes in working tree
- [ ] Leave clear next action for restart

## Current PR stack
- PR #6: live refresh controls + action lock
- PR #7: optimistic rollback safety
- PR #8: ops pulse metrics
- PR #9: role permissions matrix
- PR #10: docs/release notes + break readiness

## Resume command
```bash
git checkout feat/pr-10-readme-release-and-break-notes
```

## Next suggested build block (after break)
- Wire permissions matrix to real auth/roles source
- Add conflict-safe server-side action idempotency keys
- Add timeline search + date range filters
