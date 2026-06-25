-- ============================================================
-- Migration: decouple the continuation run-up look-back from the bottoming
-- drawdown window in the price-base detector.
--
-- Adds classification.continuation_runup_lookback (bars) to the 'price_base'
-- config. The run-up that classifies a Continuation base is now measured over
-- this shorter window (default 45 bars ≈ 9 weeks) instead of the full
-- prior_bars (130) window — so a recent flat base near 52-week highs isn't
-- disqualified by a rally that started off a months-old accumulation low.
-- Bottoming's drawdown still uses prior_bars. Code deep-merges the default, so
-- this row update just makes the knob visible/tunable in the DB.
-- Run this in the Supabase SQL Editor, then recompute (python refresh_base.py).
-- ============================================================

update scoring_config
set config = jsonb_set(config, '{classification,continuation_runup_lookback}', '45'::jsonb, true),
    updated_at = now()
where key = 'price_base';
