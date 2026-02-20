PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'system',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  item TEXT NOT NULL,
  reason TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('High', 'Medium')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  agent_id TEXT REFERENCES agents(id)
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
  trace_id TEXT,
  agent_id TEXT REFERENCES agents(id)
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

CREATE TABLE IF NOT EXISTS telegram_outbox (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('alert', 'approval_requested', 'approval_decided', 'conflict', 'daily_pulse', 'wrench_alert')),
  message TEXT NOT NULL,
  meta_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')) DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('Tier 1', 'Tier 2', 'Tier 3')),
  status TEXT NOT NULL CHECK (status IN ('inbox', 'planned', 'doing', 'blocked', 'review', 'done')),
  owner TEXT NOT NULL,
  deadline TEXT,
  blocker TEXT,
  next_action TEXT,
  updated_at TEXT NOT NULL,
  agent_id TEXT REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS units (
  code TEXT PRIMARY KEY,
  codename TEXT NOT NULL,
  icon TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
  reports_to TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS live_snapshots (
  id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resource_ledger (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('tokens', 'cron', 'failure', 'retry', 'baseline')),
  label TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  usage_estimate_usd REAL NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_approval_id ON events(approval_id);
CREATE INDEX IF NOT EXISTS idx_repo_deps_from ON repository_dependencies(from_repo);
CREATE INDEX IF NOT EXISTS idx_repo_deps_to ON repository_dependencies(to_repo);
CREATE INDEX IF NOT EXISTS idx_outbox_created_at ON telegram_outbox(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON telegram_outbox(status);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_snapshots_generated_at ON live_snapshots(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_ledger_created_at ON resource_ledger(created_at DESC);
