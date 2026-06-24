-- ============================================================
-- Migration: RS Line Score (0-100) + grade, plus its scoring config.
--
-- Scores the quality of a symbol's RS Line (price ÷ VN-Index) from four
-- components, per initial_fa_data/rs_line_scoring.txt:
--   Trend (40)  — net % change of the RS Line over the last 20 sessions.
--   vs MA20 (20)— RS Line vs its own 20-session moving average.
--   52w high(20)— distance from the trailing 52-week RS-Line high.
--   Divergence(20)— price trend vs RS trend over the last 20 sessions.
-- Grades: A+ 90-100, A 80-89, B 70-79, C 60-69, D <60.
-- Computed daily by the RS pass and stored on ta_universe.
-- Run this in the Supabase SQL Editor.
-- ============================================================

alter table ta_universe
  add column if not exists rs_line_score integer,
  add column if not exists rs_line_grade text;

-- DB-tunable config (deep-merged over RS_LINE_SCORE_DEFAULTS in code).
-- trend bands: net % change over `window` sessions — strong_up≥0.10, mild_up≥0.03,
--   side, mild_down≤-0.03, strong_down≤-0.10. divergence.matrix keys are
--   "<priceTrend>_<rsTrend>" (up/flat/down); unlisted-in-spec combos use
--   RS-leadership logic (bullish divergence down_up=20, bearish up_down=0).
insert into scoring_config (key, config) values ('rs_line_score', '{
  "trend": {
    "window": 20,
    "strong_up": 0.10, "mild_up": 0.03, "mild_down": -0.03, "strong_down": -0.10,
    "points": {"strong_up": 40, "mild_up": 30, "side": 20, "mild_down": 10, "strong_down": 0}
  },
  "ma20": {
    "window": 20, "above_far": 0.05, "near": 0.01, "below_far": 0.05,
    "points": {"above_far": 20, "above": 15, "near": 10, "below": 5, "below_far": 0}
  },
  "high52w": {
    "tiers": [[0.05, 15], [0.10, 10], [0.20, 5]],
    "new_high_eps": 0.001, "new_high_points": 20, "below_points": 0
  },
  "divergence": {
    "window": 20, "deadband": 0.03,
    "matrix": {
      "flat_up": 20, "up_up": 15, "up_flat": 10, "flat_down": 5, "down_down": 0,
      "down_up": 20, "up_down": 0, "down_flat": 10, "flat_flat": 10
    }
  },
  "grades": [[90, "A+"], [80, "A"], [70, "B"], [60, "C"], [0, "D"]]
}'::jsonb)
on conflict (key) do update set config = excluded.config, updated_at = now();
