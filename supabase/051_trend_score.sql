-- ============================================================
-- Migration: Trend Score — replaces the BQS price-base module.
--
--   TrendScore = DailyTrendScore·60% + WeeklyTrendScore·40%
--
-- Both halves score the O → K → A → D1 → A1 → D2/A2 structure read off a ZigZag
-- over ~1.5 years, one on daily bars and one on weekly. Spec:
-- data/He_thong_cham_diem_Xu_huong_TA_Pro.xlsx. Written nightly by
-- scripts/ta/trend_score.py (update_ta_daily.py Step 4), which replaces
-- scripts/ta/price_base.py in that slot.
--
--   trend_score         blended 0-100 — the column that replaces base_score
--   trend_score_daily   0-100 off daily bars
--   trend_score_weekly  0-100 off weekly bars (0 whenever close < daily MA200)
--   trend_grade         A+ 90-100 / A 80-89 / B 70-79 / C 60-69 / D <60
--   trend_state_daily   no_ok | ok_below_52w | ok_below_ma200 | ok_base_fail |
--                       base | a_confirmed | d1 | a1_uptrend |
--                       post_a1_above_d1 | back_below_k | break_d1
--   trend_state_weekly  below_ma200 | no_ok | ok_below_52w | ok_base_fail |
--                       base_only | a_confirmed | d1 | a2_full_uptrend |
--                       d2_above_a1 | d2_between | back_below_o | break_d1
--   trend_dir_daily     strong_up | up | flat | down | strong_down — the arrow
--   trend_dir_weekly    the row shows, banded from that half's own score
--   trend_status        tao_day | tiep_dien | cho_mua | san_sang_mua, or NULL when
--                       the daily chart has no readable structure
--   trend_action        theo_doi | cho_mua | san_sang_mua (a function of status)
--   trend_detail        JSONB: per-criterion breakdown + the O/K/A/D1 levels
--                       with their dates. Fetched on demand, not in the list.
--   trend_chart         JSONB: compact OHLC candles + structural markers for the
--                       in-cell chart. Fetched via /api/sparklines, never inline.
--   trend_date          trading date the structure was evaluated through.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

alter table ta_universe
  add column if not exists trend_score        smallint,
  add column if not exists trend_score_daily  smallint,
  add column if not exists trend_score_weekly smallint,
  add column if not exists trend_grade        text,
  add column if not exists trend_state_daily  text,
  add column if not exists trend_state_weekly text,
  add column if not exists trend_dir_daily    text,
  add column if not exists trend_dir_weekly   text,
  add column if not exists trend_status       text,
  add column if not exists trend_action       text,
  add column if not exists trend_detail       jsonb,
  add column if not exists trend_chart        jsonb,
  add column if not exists trend_date         date;

create index if not exists idx_ta_universe_trend_score
  on ta_universe(trend_score)
  where is_active = true;

-- ------------------------------------------------------------
-- TA Score: swap BQS out for the trend score at the same 35%.
--
-- This UPDATE is not cosmetic, it is REQUIRED. load_scoring_config deep-merges
-- the stored row over the code defaults, so a row still carrying "bqs": 0.35
-- would keep that key alongside the new "trend": 0.35 and the weights would sum
-- to 1.35 — every TA Score, and thence every Final Score and grade, inflated by
-- a third of a stale price base. The code drops unknown weight keys with a loud
-- warning so the night this ships is merely wrong-by-warning rather than
-- silently wrong, but the fix belongs here.
-- ------------------------------------------------------------
insert into scoring_config (key, config) values ('ta_score', '{
  "weights": {"rs_3m": 0.20, "rs_composite": 0.25, "rs_line": 0.20, "trend": 0.35}
}'::jsonb)
on conflict (key) do update set config = excluded.config, updated_at = now();

-- Seed the trend scoring parameters so they are tunable without a deploy. These
-- mirror TREND_DEFAULTS in scripts/ta/trend_score.py; anything omitted here
-- falls back to the code default via the deep merge.
--
-- ZigZag sensitivity, per the customer: daily 5% / 10 candles, weekly 7% / 6.
-- The weekly settings are deliberately not the daily ones. 10 WEEKLY candles is a
-- 10-week minimum between pivots in a window that holds only ~78 weekly bars,
-- which measured over the live universe left 40% of symbols with exactly ONE
-- weekly pivot and 3 of 1,158 able to complete a weekly uptrend — the parameter,
-- not the market, was what stopped them.
insert into scoring_config (key, config) values ('trend_score', '{
  "window_days": 560,
  "min_bars": 200,
  "dist_52w_min": -0.25,
  "daily":  {"deviation": 0.05, "depth": 10},
  "weekly": {"deviation": 0.07, "depth": 6},
  "weights": {"daily": 0.60, "weekly": 0.40},
  "points": {
    "daily":  {"tc1": 15, "tc2": 15, "a": 30, "d1": 10, "final": 30},
    "weekly": {"tc1": 15, "tc2": 15, "a": 40, "d1": 10, "final": 20}
  }
}'::jsonb)
on conflict (key) do update set config = excluded.config, updated_at = now();

-- ------------------------------------------------------------
-- BQS is retired. The columns are NOT dropped: migrations here are append-only,
-- and dropping them would destroy the only record of what the previous rubric
-- said. Nothing writes them from this migration onward, so what they hold is a
-- snapshot frozen on the day of the swap — which is exactly the trap a future
-- reader would fall into, hence the comments.
-- ------------------------------------------------------------
comment on column ta_universe.base_score is
  'RETIRED 2026-08-17 — BQS price-base module replaced by trend_score (migration 051). No writer. Frozen snapshot, not a current reading.';
comment on column ta_universe.base_grade is
  'RETIRED 2026-08-17 — see ta_universe.base_score. Use trend_grade.';
comment on column ta_universe.base_type is
  'RETIRED 2026-08-17 — see ta_universe.base_score. Use trend_state_weekly / trend_status.';
comment on column ta_universe.base_status is
  'RETIRED 2026-08-17 — see ta_universe.base_score. Use trend_status / trend_action.';
comment on column ta_universe.base_detail is
  'RETIRED 2026-08-17 — see ta_universe.base_score. Use trend_detail.';
comment on column ta_universe.base_chart is
  'RETIRED 2026-08-17 — see ta_universe.base_score. Use trend_chart.';
comment on column ta_universe.base_date is
  'RETIRED 2026-08-17 — see ta_universe.base_score. Use trend_date.';
