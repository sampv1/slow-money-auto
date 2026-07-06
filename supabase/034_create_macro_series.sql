-- ============================================================
-- Migration: macro_series — generic time-series store for Vietnam macro charts.
--
-- One table backs all three planned charts (interest rates, exchange rate,
-- inflation). Each row is one (metric, date) observation. `metric` encodes the
-- specific series so new indicators need no schema change:
--   'interbank_overnight', 'interbank_1w', 'interbank_2w', 'interbank_1m', …
--   (later) 'fx_usdvnd', 'inflation_cpi_yoy', …
--
-- Source: Vietstock macro endpoint (mirrors State Bank of Vietnam). Populated by
-- scripts/macro/*.py via scripts/refresh_macro.py. Run in the Supabase SQL Editor.
-- ============================================================

create table if not exists macro_series (
  id         bigint generated always as identity primary key,
  metric     text        not null,   -- series key, e.g. 'interbank_overnight'
  date       date        not null,   -- observation date
  value      numeric,                -- the value (e.g. % per annum)
  unit       text,                   -- e.g. '%/yr' (nullable)
  source     text        not null default 'vietstock',
  meta       jsonb,                  -- extras: turnover/volume, tenor label, raw
  updated_at timestamptz not null default now(),
  unique (metric, date)
);

create index if not exists idx_macro_series_metric_date on macro_series(metric, date);

alter table macro_series enable row level security;
drop policy if exists "Allow all for anon" on macro_series;
create policy "Allow all for anon" on macro_series for all using (true) with check (true);
