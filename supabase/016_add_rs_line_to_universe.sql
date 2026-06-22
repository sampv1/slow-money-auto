-- ============================================================
-- Migration: RS Line (Relative Strength Line) per symbol.
--
-- RS Line = stock close ÷ VN-Index close, plotted over the trailing ~1 year.
-- A rising line = the stock is outperforming the index (uptrend), falling =
-- underperforming, flat = moving with the market.
--
-- Stored as a downsampled ratio series (JSONB array of ~48 numbers, oldest →
-- newest) so the dashboard can draw a sparkline without re-querying OHLCV.
-- rs_line_date = the latest trading date the line was computed through.
-- Refreshed daily by the RS pass (scripts/ta/rs_rating.py, run in
-- update_ta_daily.py). Run this in the Supabase SQL Editor.
-- ============================================================

alter table ta_universe
  add column if not exists rs_line      jsonb,
  add column if not exists rs_line_date date;
