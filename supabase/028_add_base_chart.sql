-- ============================================================
-- Migration: compact price-base chart series for the Signal Pro thumbnail.
--
-- base_chart holds a small downsampled close series + the base rectangle bounds
-- for the in-cell sparkline:
--   { "p": [close…], "lo": base_low, "hi": base_high, "s": base_start_fraction }
-- (s = where the base region begins within the series, 0..1; the base always
-- ends at the latest bar). The enlarged detail chart fetches the full window
-- from ta_ohlcv on demand. Populated by the daily price-base pass.
-- Run this in the Supabase SQL Editor, then recompute bases
-- (python refresh_base.py) to fill it.
-- ============================================================

alter table ta_universe
  add column if not exists base_chart jsonb;
