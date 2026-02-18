# State Backbone Plan (PR #11)

## Objective
Move Mission Control from file-backed prototype state toward durable, queryable operational storage.

## Included in this PR
- SQL schema for core entities (`db/schema.sql`)
- Shared TypeScript state types (`src/lib/state-types.ts`)

## Next migration steps
1. Add DB client integration
2. Add migration runner + seed scripts
3. Replace file-backed reads/writes incrementally:
   - approvals
   - events
   - repositories
   - tasks

## Safety
File-backed JSON remains source of runtime truth until DB integration PR lands.
