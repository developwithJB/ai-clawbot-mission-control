-- Mission Control State Backbone v1

create table if not exists mc_tasks (
  id text primary key,
  title text not null,
  tier text not null check (tier in ('Tier 1','Tier 2','Tier 3')),
  status text not null check (status in ('inbox','planned','doing','blocked','review','done')),
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mc_approvals (
  id text primary key,
  item text not null,
  reason text not null,
  level text not null check (level in ('High','Medium')),
  status text not null check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists mc_events (
  id text primary key,
  agent text not null,
  pipeline text not null check (pipeline in ('A','B','C','D')),
  type text not null check (type in ('decision','delivery','integration','approval')),
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists mc_repositories (
  id text primary key,
  name text not null,
  url text not null,
  tier text not null check (tier in ('Tier 1','Tier 2','Tier 3')),
  status text not null check (status in ('active','pending-access','paused')),
  health text not null check (health in ('green','yellow','red')),
  created_at timestamptz not null default now()
);

create table if not exists mc_repo_dependencies (
  id text primary key,
  from_repo text not null references mc_repositories(id) on delete cascade,
  to_repo text not null references mc_repositories(id) on delete cascade,
  dep_type text not null check (dep_type in ('playbook-transfer','blocked-by','feeds')),
  note text not null,
  created_at timestamptz not null default now()
);
