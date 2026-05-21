-- ============================================================
-- Migration: Support / Resistance levels for the TA scanner
-- Phase 2a per TA_FEATURE_PLAN.md.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Active S/R levels per symbol. Rewritten nightly by the daily TA cron;
-- only the current state is kept (no history).
create table if not exists ta_sr_levels (
  symbol text not null,
  price numeric not null,
  level_type text not null check (level_type in ('support', 'resistance')),
  touches int not null,
  strength numeric not null,
  first_touch_date date not null,
  last_touch_date date not null,
  updated_at timestamptz not null default now(),
  primary key (symbol, price, level_type)
);

create index if not exists idx_ta_sr_levels_symbol on ta_sr_levels(symbol);

-- ============================================================
-- RLS (matches the rest of the TA tables)
-- ============================================================

alter table ta_sr_levels enable row level security;

drop policy if exists "Allow all for anon" on ta_sr_levels;

create policy "Allow all for anon" on ta_sr_levels for all using (true) with check (true);
