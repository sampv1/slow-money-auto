-- ============================================================
-- Migration: scoring_config — DB-driven config for the RS rating and
-- Price-Base (BQS V3) engines, so their tiers/weights/thresholds are tunable
-- without code (parity with fa_scoring_config). The engines deep-merge these
-- over hardcoded defaults, so editing a value here changes scoring on the next
-- daily run; missing keys fall back to defaults.
-- Run this in the Supabase SQL Editor.
-- ============================================================

create table if not exists scoring_config (
  key        text primary key,
  config     jsonb not null,
  updated_at timestamptz not null default now()
);

alter table scoring_config enable row level security;
drop policy if exists "Allow all for anon" on scoring_config;
create policy "Allow all for anon" on scoring_config for all using (true) with check (true);

-- RS rating (RS3M/6M/9M/12M + Composite). Periods are calendar days
-- (trailing N months, nearest bar within tolerance); composite = weighted
-- blend of the four percentiles, re-ranked into 1..99. liquidity_floor 0 =
-- rank across the whole market.
insert into scoring_config (key, config) values ('rs_rating', '{
  "periods": {"3m": 91, "6m": 182, "9m": 273, "12m": 365},
  "weights": {"3m": 0.4, "6m": 0.2, "9m": 0.2, "12m": 0.2},
  "tolerance_days": 25,
  "liquidity_floor": 0,
  "window_days": 430,
  "rs_line": {"window_days": 365, "spark_points": 48, "min_points": 20}
}'::jsonb)
on conflict (key) do update set config = excluded.config, updated_at = now();

-- Price Base (BQS V3). Tiers are [threshold, points] (ascending; pick highest
-- threshold <= value). max-per-type is derived from the tiers (Bottoming 130,
-- Continuation 120); BQS = raw / max * 100.
insert into scoring_config (key, config) values ('price_base', '{
  "detection": {
    "window_days": 500, "min_bars": 70, "min_base_bars": 20, "max_base_bars": 260,
    "window_step": 2, "depth_sanity_cap": 0.50, "prior_bars": 130, "bars_52w": 250,
    "near_top": 0.95, "breakout_vol_mult": 1.5
  },
  "classification": {
    "bottoming_drawdown_min": 0.25, "bottoming_min_weeks": 6,
    "continuation_runup_min": 0.20, "continuation_runup_max": 0.60,
    "continuation_min_weeks": 4, "continuation_max_dist52w": 0.25,
    "both_pick_continuation_dist52w": 0.15
  },
  "tiers": {
    "len1": [[0,0],[6,10],[10,15],[30,12],[52,8]],
    "len2": [[0,0],[4,10],[6,15],[12,12],[20,8]],
    "depth1": [[0,8],[10,15],[20,20],[30,10],[40,0]],
    "depth2": [[0,12],[5,20],[15,15],[25,8],[35,0]],
    "tight": [[0,25],[5,20],[8,15],[12,8],[15,0]],
    "voldry": [[0,20],[50,15],[70,10],[90,5],[120,0]],
    "dist1": [[0,10],[20,7],[40,4],[60,2]],
    "dist2": [[0,10],[10,7],[20,4],[30,0]]
  },
  "categorical": {
    "trend_bottoming": {"cross_up": 10, "above_ma50": 8, "above_ma20": 5, "below": 0},
    "trend_continuation": {"stacked": 10, "ma20_gt_ma50": 8, "above_ma50": 5, "below": 0},
    "spring": {"strong": 10, "weak": 5, "none": 0},
    "breakout": {"strong": 10, "weak": 5, "near_top": 8, "mid": 4, "fail": 0},
    "rs": {"new_high": 10, "rising": 8, "flat": 5, "falling": 0}
  },
  "grades": [[80,"A"],[65,"B"],[50,"C"],[0,"D"]]
}'::jsonb)
on conflict (key) do update set config = excluded.config, updated_at = now();
