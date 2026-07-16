-- 040: RS-rating history arrays on ta_universe (for the Analysis-page RS chart).
--
-- The RS ratings (rs_3m / rs_6m / rs_12m) are cross-sectional percentiles: a
-- symbol's value depends on the whole market's trailing returns that day, so
-- only the latest snapshot lives in the rs_3m/… columns. To draw RS3M/RS6M/
-- RS52W as *lines* over time, we recompute the market-wide percentiles for every
-- past trading day in the loaded window (compute_rs_history in ta/rs_rating.py)
-- and store the per-symbol series here — the same jsonb-array pattern as
-- rs_line_full (018).
--
--   rs_3m_hist / rs_6m_hist / rs_12m_hist — percentile (1..99) per trading day,
--       oldest → newest, null on days the lookback isn't available yet. RS52W
--       (rs_12m) needs a 12-month lookback, so its history is the shallowest —
--       bounded by ta_ohlcv depth.
--   rs_hist_dates — the parallel trading dates (same length as the arrays).
--
-- Written by compute_rs_ratings on each daily RS pass (anon upsert, like the
-- other RS columns). Apply this in the Supabase SQL editor before that pass
-- populates them.

alter table ta_universe
  add column if not exists rs_3m_hist    jsonb,
  add column if not exists rs_6m_hist    jsonb,
  add column if not exists rs_12m_hist   jsonb,
  add column if not exists rs_hist_dates jsonb;
