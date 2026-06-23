-- ============================================================
-- Migration: Price Base (BQS V3) per symbol.
--
-- Detects the stock's CURRENT base (sideways consolidation) and scores its
-- quality 0-100 (BQS = raw / max-for-type * 100), per the BQS V3 rubric.
--   base_score  — BQS 0-100 (nullable: only set when a valid base is detected)
--   base_grade  — A (80-100) / B (65-79) / C (50-64) / D (<50)
--   base_type   — 'bottoming' | 'continuation'
--   base_status — 'watchlist' | 'breakout' | 'fail'
--   base_detail — JSONB: per-module breakdown + attributes (duration, depth,
--                 tightness, vol-dry, dist52w, pivot, base_start/end, …) for the
--                 click-to-expand breakdown. Fetched on demand (not in the list).
--   base_date   — trading date the base was evaluated through.
--
-- Refreshed daily by the price-base pass (scripts/ta/price_base.py, run in
-- update_ta_daily.py after the RS step). Run this in the Supabase SQL Editor.
-- ============================================================

alter table ta_universe
  add column if not exists base_score  smallint,
  add column if not exists base_grade  text,
  add column if not exists base_type   text,
  add column if not exists base_status text,
  add column if not exists base_detail jsonb,
  add column if not exists base_date   date;

create index if not exists idx_ta_universe_base_score
  on ta_universe(base_score)
  where is_active = true;
