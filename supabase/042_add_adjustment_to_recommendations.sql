-- ============================================================
-- Migration: record corporate-action adjustments on recommendations
--
-- update_prices.py already computes, on EVERY evaluation,
--     k = adjusted_close(last_close_date) / last_close
-- and divides the fetched (back-adjusted) OHLC by k to restate it in the
-- recommendation's original NOMINAL basis, so a dividend/bonus ex-date drop
-- cannot false-trigger a stop. That factor was then thrown away.
--
-- Keeping it makes the adjustment auditable and lets the Portfolio page explain
-- itself: after a 1:1 bonus the row legitimately shows entry 50,000 / current
-- 52,000 while the market trades at ~26,000, and without this there is nothing
-- on the page that accounts for the gap.
--
-- Deliberately NOT changing any stored P&L. The rebase already makes P&L a
-- total-return measure on the original share count (a cash dividend's price drop
-- is added back; a bonus is offset by the implied extra shares). These columns
-- are presentation + audit only.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

alter table recommendations
  add column if not exists adj_factor numeric,
  add column if not exists adj_detected_at date;

comment on column recommendations.adj_factor is
  'Corporate-action factor k = adjusted_close(last_close_date)/last_close, written '
  'by update_prices.py when |k-1| > 1%. k<1 means the price series was adjusted '
  'downward (cash dividend, bonus or split) since the recommendation was made. '
  'Market-basis price = stored nominal price * k. NULL = no material adjustment.';

comment on column recommendations.adj_detected_at is
  'Evaluation date on which a material adj_factor was first observed. Not the '
  'exchange ex-date — nothing in this system records ex-dates — so treat it as '
  '"detected on or before".';

-- Partial index: only a handful of rows ever carry an adjustment, and the
-- Portfolio page filters on "is this one adjusted?".
create index if not exists idx_recommendations_adj_factor
  on recommendations(adj_factor)
  where adj_factor is not null;
