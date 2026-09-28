-- Run this once in the dedicated Supabase project for nifty-intraday-analyzer.
-- The app uses only the server-side Supabase secret key; no browser client is granted access.
create table if not exists public.paper_trades (
  id bigint generated always as identity primary key,
  index_id text not null,
  index_name text not null,
  strategy_id text not null,
  strategy text not null,
  regime text,
  direction text not null check (direction in ('UP','DOWN')),
  signal_time timestamptz not null,
  entry_time timestamptz not null,
  entry_price double precision not null,
  trigger_price double precision,
  stop_price double precision not null,
  target_price double precision not null,
  exit_time timestamptz,
  exit_price double precision,
  exit_reason text,
  r_multiple double precision,
  last_price double precision,
  evidence_score double precision,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists paper_trades_index_status_idx on public.paper_trades(index_id,status);
create index if not exists paper_trades_strategy_exit_idx on public.paper_trades(strategy_id,status,exit_time desc);
create index if not exists paper_trades_entry_time_idx on public.paper_trades(entry_time desc);

alter table public.paper_trades enable row level security;
revoke all on table public.paper_trades from anon, authenticated;
grant all on table public.paper_trades to service_role;
