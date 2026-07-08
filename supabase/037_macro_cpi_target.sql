-- ============================================================
-- Migration: add the annual CPI target to scoring_config['macro'].
--
-- The /macro CPI chart tracks headline inflation as the "inflation budget"
-- remaining against the National Assembly's full-year target (the target is on
-- the AVERAGE of the year's monthly YoY, not the Dec YoY):
--
--   headroom(t) = (target×12 − Σ YoY[Jan..t of the year]) / months_remaining − YoY(t)
--
--   headroom ≥ 0 → the year's average can still land ≤ target → SBV keeps easing room.
--   headroom <  0 → target budget blown → policy constraint tightens.
--
-- `cpi_target` is an effective-dated list (as-of / step lookup by the row's date),
-- so a target change only affects that year forward — a prior year is never
-- recalculated. Same forward-only pattern as usdvnd_band (035).
--
-- Seed values are the binding upper bound of each era's target (the Assembly sets
-- it yearly, historically ~4–5%); edit here when a new year's target is announced:
--   2015–2016 ≈ 5.0% · 2017–2022 ≈ 4.0% · 2023–2026 ≈ 4.5%
--
-- Merges into the existing 'macro' row (keeps usdvnd_band + regime). Depends on 035.
-- Run in the Supabase SQL Editor.
-- ============================================================

update scoring_config
set config = config || jsonb_build_object(
      'cpi_target', jsonb_build_array(
        jsonb_build_object('from', '2015-01-01', 'value', 5.0),
        jsonb_build_object('from', '2017-01-01', 'value', 4.0),
        jsonb_build_object('from', '2023-01-01', 'value', 4.5)
      )
    ),
    updated_at = now()
where key = 'macro';
