-- ============================================================
-- Migration: BQS V8 — Base Quality Score rewrite.
--
-- Source spec: data/ta/price-base-bqs/BQS_V8_BoSung_V7_DacTa_IT_HoanThien.xlsx.
--
-- What changes vs V7:
--   * Score is now a raw 0-100 (NO normalization). Six components sum to 100:
--       Duration 15 + Depth 15 + Tightness 20 + VolumeDry 20 + Contraction 15
--       + Spring 15 = 100.
--   * Removed from BQS (RS/TA overlap): distance-to-52W, MA trend filter,
--     RS Line. Breakout NO LONGER scores — it only drives the base status.
--   * Tightness / Volume-dry / Contraction(Range_3) / Spring now reference the
--     Tight Area (tightest 5-12 bar window at BaseEnd), not a fixed 20 bars.
--   * New Contraction (Tightness Improvement) component: Range_3/Range_1.
--   * Spring is now scored for BOTH base types, 4 levels (max 15).
--   * base_status becomes a 4-state machine with NEW values:
--       'watch' (Theo dõi) / 'wait_buy' (Chờ mua) /
--       'ready_buy' (Sẵn sàng mua) / 'breakout_fail' (Breakout thất bại).
--     (V7 used 'watchlist' / 'breakout' / 'fail'.)
--   * base_grade gains 'A+': A+ 90-100 / A 80-89 / B 70-79 / C 60-69 / D <60.
--
-- No column changes: base_score (smallint 0-100), base_grade/base_type/
-- base_status (text), base_detail/base_chart (jsonb) from migrations 019 + 028
-- all still fit. base_detail's JSON shape changes (drops dist52w/trend/rs; adds
-- tight_area + contraction) but it's schemaless.
--
-- IMPORTANT: this REPLACES the whole 'price_base' config (not a merge). The V7
-- config's tiers + grades would otherwise deep-merge OVER the V8 code defaults
-- and silently keep the old scale. Run this in the Supabase SQL Editor, then
-- recompute: python scripts/refresh_base.py.
-- ============================================================

insert into scoring_config (key, config) values ('price_base', '{
  "detection": {
    "window_days": 500, "min_bars": 70, "min_base_bars": 20, "max_base_bars": 260,
    "window_step": 2, "depth_sanity_cap": 0.5, "prior_bars": 130
  },
  "classification": {
    "bottoming_drawdown_min": 0.25, "bottoming_min_weeks": 6,
    "continuation_runup_min": 0.2, "continuation_runup_max": 0.6,
    "continuation_runup_lookback": 45, "continuation_min_weeks": 4
  },
  "tight_area": {
    "min_len": 5, "max_len": 12, "default_len": 8, "valid_max_range_pct": 12.0
  },
  "tiers": {
    "len1":   [[0, 0], [6, 10], [10, 15], [30, 12], [52, 8]],
    "len2":   [[0, 0], [4, 10], [6, 15], [12, 12], [20, 8]],
    "depth1": [[0, 8], [10, 15], [20, 15], [30, 10], [40, 0]],
    "depth2": [[0, 12], [5, 15], [15, 15], [25, 8], [35, 0]],
    "tight":  [[0, 20], [5, 18], [8, 14], [12, 8], [15, 0]],
    "voldry": [[0, 20], [50, 15], [70, 10], [90, 5], [120, 0]]
  },
  "contraction": {
    "strong_ratio": 0.5, "good_ratio": 0.65, "ok_ratio": 0.8,
    "points": {"strong": 15, "good": 12, "ok": 9, "weak": 5, "none": 0}
  },
  "spring": {
    "pen_min_pct": 1.0, "pen_max_pct": 5.0, "recover_bars": 5, "fast_bars": 2,
    "points": {"none": 0, "weak": 5, "clean": 10, "clean_fast": 15}
  },
  "status": {
    "tight_max_range_pct": 12.0, "dry_max_ratio_pct": 90.0,
    "breakout_vol_mult": 1.5, "fail_lookback": 5
  },
  "grades": [[90, "A+"], [80, "A"], [70, "B"], [60, "C"], [0, "D"]]
}'::jsonb)
on conflict (key) do update set config = excluded.config, updated_at = now();
