-- ============================================================
-- Migration: ta_universe.rs_1m — 1-month Relative Strength (DISPLAY ONLY)
--
-- A cross-sectional 1..99 percentile of each symbol's trailing ~1-month return,
-- for the FA Scanner's "Market (daily)" block. Same shape as rs_3m/6m/9m/12m.
--
-- CRITICAL — rs_1m is computed OUTSIDE the composite blend, and must stay there.
-- It is NOT a member of scoring_config['rs_rating'].periods, and it has NO entry
-- in .weights. Do not "tidy" it into either one:
--
--   * rs_rating.py builds the composite as
--         blend = sum(weights[k] * df[f"rs_{k}"] for k in periods)
--     so a "1m" key in `periods` with no matching weight raises KeyError and the
--     nightly RS pass writes nothing at all.
--   * ta/common.py::_deep_merge merges NESTED dicts, so a "1m" added to the code
--     default RS_DEFAULTS["periods"] SURVIVES the scoring_config row that pins
--     periods to 3m/6m/9m/12m. The DB row does not protect you. (Verified
--     against the live config on 2026-08-08.)
--   * Giving it a non-zero weight instead would move rs_composite, which is 25%
--     of TA Score, which is 59% of Final Score — i.e. it would silently re-grade
--     every symbol on the platform. That is explicitly not wanted.
--
-- Also note _trailing_returns() returns None for the WHOLE symbol when any
-- requested period has no bar within tolerance_days. That is why rs_1m is
-- derived in a second pass over the already-rated set rather than added to the
-- main call: folding it in could drop symbols out of `rets` entirely and thereby
-- shift every other symbol's cross-sectional rank.
--
-- Nullable and unindexed on purpose: it is a snapshot column, rewritten whole on
-- every RS pass (and nulled by the same `active - rated` retire step as the other
-- RS columns), and nothing filters or sorts on it in SQL — the scanner sorts in
-- memory.
--
-- Run this in the Supabase SQL Editor BEFORE deploying the rs_rating.py change:
-- the main RS upsert is not wrapped in try/except, so an unknown column makes
-- PostgREST reject every chunk and turns ta-daily.yml red with zero RS written.
-- ============================================================

alter table ta_universe add column if not exists rs_1m smallint;

comment on column ta_universe.rs_1m is
  '1-month RS percentile (1..99), display only. Computed outside the composite '
  'blend — never add "1m" to scoring_config[''rs_rating''].periods/.weights.';
