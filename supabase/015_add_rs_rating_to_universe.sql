-- ============================================================
-- Migration: RS Rating (Relative Strength) per symbol.
--
-- RS Rating scores a stock's trailing price performance against
-- all other (liquid) stocks, as a percentile 1..99:
--   rs_3m / rs_6m / rs_9m / rs_12m  — percentile rank of the trailing
--       3 / 6 / 9 / 12-month return, across the liquid universe.
--   rs_composite — percentile rank of the weighted blend
--       0.4*rs_3m + 0.2*rs_6m + 0.2*rs_9m + 0.2*rs_12m
--       (blend is re-ranked into a fresh 1..99).
-- rs_date = the trading date the ratings were computed for.
--
-- Cross-sectional metric: computed market-wide (not per-symbol), so
-- it is refreshed by a dedicated pass (scripts/refresh_rs.py, also run
-- inside update_ta_daily.py) rather than the per-symbol indicator loop.
-- Stored as the latest snapshot on ta_universe, like avg_volume_20d.
-- Run this in the Supabase SQL Editor.
-- ============================================================

alter table ta_universe
  add column if not exists rs_3m        smallint,
  add column if not exists rs_6m        smallint,
  add column if not exists rs_9m        smallint,
  add column if not exists rs_12m       smallint,
  add column if not exists rs_composite smallint,
  add column if not exists rs_date      date;

create index if not exists idx_ta_universe_rs_composite
  on ta_universe(rs_composite)
  where is_active = true;
