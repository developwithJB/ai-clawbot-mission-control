-- Mission Control durable SQL backbone (Phase 1+)
-- SQLite-first, Postgres-upgradeable (portable SQL types + constraints)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  item TEXT NOT NULL,
  reason TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('High', 'Medium')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  pipeline TEXT NOT NULL CHECK (pipeline IN ('A', 'B', 'C', 'D')),
  type TEXT NOT NULL CHECK (type IN ('decision', 'delivery', 'integration', 'approval', 'approval_decided')),
  summary TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  approval_id TEXT,
  previous_status TEXT CHECK (previous_status IN ('pending', 'approved', 'rejected')),
  new_status TEXT CHECK (new_status IN ('pending', 'approved', 'rejected')),
  decided_by TEXT,
  decided_at TEXT,
  request_id TEXT,
  trace_id TEXT
);

CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('Tier 1', 'Tier 2', 'Tier 3')),
  status TEXT NOT NULL CHECK (status IN ('active', 'pending-access', 'paused')),
  health TEXT NOT NULL CHECK (health IN ('green', 'yellow', 'red'))
);

CREATE TABLE IF NOT EXISTS repository_dependencies (
  id TEXT PRIMARY KEY,
  from_repo TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  to_repo TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('playbook-transfer', 'blocked-by', 'feeds')),
  note TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_approval_id ON events(approval_id);
CREATE INDEX IF NOT EXISTS idx_repo_deps_from ON repository_dependencies(from_repo);
CREATE INDEX IF NOT EXISTS idx_repo_deps_to ON repository_dependencies(to_repo);
