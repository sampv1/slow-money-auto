-- ============================================================
-- Migration: add the USD/VND regime thresholds to scoring_config['macro'].
--
-- The /macro exchange-rate chart classifies each day into a 2×2 regime from two
-- signals — pressure (pct_to_ceiling) × policy velocity (central Δ5 sessions):
--
--                    Δ5 ≤ chg5d_fast        Δ5 > chg5d_fast
--   pct ≥ near_ceiling   Ổn định (stable)      Đi trước (leading, SBV early)
--   pct <  near_ceiling  Nén áp lực (held)     Nhả áp lực (at ceiling & releasing)
--
-- Thresholds (validated on 901 real joined days, 2022-10-17 → 2026-07):
--   pct_near_ceiling 0.15 — pct_to_ceiling SATURATES at 0 (VCB pins to the
--       ceiling ~41% of days), so "near ceiling" is set at the saturation point,
--       not the looser 0.7% mockup value.
--   chg5d_fast 25 — ≈ P80 of the Δ5 distribution; ~23% of days flag "fast".
--   hysteresis_min_days 3 — a regime run shorter than this is absorbed into the
--       prior run, so the ribbon doesn't flicker at the Nén↔Nhả boundary
--       (raw 113 transitions → 54 with a 3-day floor).
--
-- Merges into the existing 'macro' row (keeps usdvnd_band). Depends on 035.
-- Run in the Supabase SQL Editor.
-- ============================================================

update scoring_config
set config = config || '{
  "regime": {
    "pct_near_ceiling": 0.15,
    "chg5d_fast": 25,
    "hysteresis_min_days": 3
  }
}'::jsonb,
    updated_at = now()
where key = 'macro';
