-- ============================================================
-- Migration: store rolling 20-session average volume per symbol
-- so the scanner can apply a "min liquidity" filter without
-- re-aggregating ta_ohlcv on every page render.
-- Updated nightly by compute_ta_signals.py / update_ta_daily.py.
-- Run this in Supabase SQL Editor.
-- ============================================================

alter table ta_universe
  add column if not exists avg_volume_20d bigint;

create index if not exists idx_ta_universe_avg_volume_20d
  on ta_universe(avg_volume_20d)
  where is_active = true;
