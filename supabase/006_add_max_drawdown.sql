-- ============================================================
-- Migration: Track maximum drawdown from entry per recommendation
-- Run this in Supabase SQL Editor
-- ============================================================
-- max_drawdown_pct: most negative (current_price - entry_price) / entry_price * 100
-- observed since the recommendation was made. Updated daily by update_prices.py
-- whenever a new low is reached. Always negative (or null if never below entry).

alter table recommendations
  add column if not exists max_drawdown_pct numeric;
