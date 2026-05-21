-- ============================================================
-- Migration: Trendlines for the TA scanner
-- Phase 2b per TA_FEATURE_PLAN.md.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Active trendlines per symbol. Rewritten nightly by the daily TA cron;
-- only the current state is kept (no history).
create table if not exists ta_trendlines (
  id bigserial primary key,
  symbol text not null,
  trend_type text not null check (trend_type in ('uptrend', 'downtrend')),
  start_date date not null,
  start_price numeric not null,
  end_date date not null,
  end_price numeric not null,
  slope numeric not null,
  touches int not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_ta_trendlines_symbol on ta_trendlines(symbol);

-- ============================================================
-- RLS (matches the rest of the TA tables)
-- ============================================================

alter table ta_trendlines enable row level security;

drop policy if exists "Allow all for anon" on ta_trendlines;

create policy "Allow all for anon" on ta_trendlines for all using (true) with check (true);
