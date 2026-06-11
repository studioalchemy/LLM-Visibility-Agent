-- Agent 4 — LLM Share of Voice & Ad Visibility Agent
-- Single-tenant internal tool. RLS disabled by default; see README §10.

create extension if not exists "pgcrypto";

create table if not exists agent_config (
  id uuid primary key default gen_random_uuid(),
  is_active boolean not null default true,
  frequency_days int not null default 7,
  our_brand text not null default '',
  category text default '',
  last_activated_at timestamptz default now(),
  next_run_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists prompts (
  id uuid primary key default gen_random_uuid(),
  prompt_text text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists email_recipients (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz default now()
);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  triggered_by text not null check (triggered_by in ('manual','scheduled')),
  status text not null default 'running' check (status in ('running','completed','failed')),
  started_at timestamptz default now(),
  completed_at timestamptz,
  our_brand_sov numeric,
  prev_our_brand_sov numeric,
  summary jsonb,
  error text
);

create table if not exists llm_responses (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete cascade,
  prompt_id uuid references prompts(id) on delete set null,
  prompt_text text,
  provider text not null,
  raw_response text,
  error text,
  created_at timestamptz default now()
);

create table if not exists brand_mentions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete cascade,
  response_id uuid references llm_responses(id) on delete cascade,
  prompt_id uuid references prompts(id) on delete set null,
  provider text,
  brand_name text not null,
  brand_name_normalized text,
  position int,
  sentiment text check (sentiment in ('positive','neutral','negative')),
  is_our_brand boolean default false,
  context_snippet text,
  created_at timestamptz default now()
);

create index if not exists idx_brand_mentions_run on brand_mentions(run_id);
create index if not exists idx_brand_mentions_norm on brand_mentions(brand_name_normalized);
create index if not exists idx_llm_responses_run on llm_responses(run_id);
create index if not exists idx_runs_started on runs(started_at desc);

-- Seed one config row only if none exists
insert into agent_config (our_brand, category, frequency_days)
select '', '', 7
where not exists (select 1 from agent_config);
