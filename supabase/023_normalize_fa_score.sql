-- ============================================================
-- Migration: normalized FA Score (0-100).
--
-- The FA rubric sums to a raw max of 108. We add a normalized score on a
-- 0-100 scale for display on the FA Scanner / Signal Pro / Analysis pages:
--
--     normalized_score = total_score / raw_max * target   (raw_max=108, target=100)
--
-- total_score stays RAW (the criteria breakdown still sums to it), but the A/B/C
-- rating bands (A_min=60, B_min=30 in fa_scoring_config) now apply to the
-- NORMALIZED score — i.e. A ≥ 60/100, B ≥ 30/100 (stricter than the old raw
-- 60/108, 30/108, so some symbols are downgraded). The divisor lives in
-- fa_scoring_config so it is tunable without code.
-- Run this in the Supabase SQL Editor.
-- ============================================================

alter table fa_scores
  add column if not exists normalized_score numeric(5,2);

-- Store the normalization in the FA config (single source of truth for the pipeline).
update fa_scoring_config
set config = jsonb_set(config, '{normalize}', '{"raw_max": 108, "target": 100}'::jsonb, true)
where id = 1;

-- Backfill existing rows so the pages show normalized scores immediately,
-- before the next pipeline run.
update fa_scores
set normalized_score = round(total_score::numeric / 108 * 100, 2);

-- Recompute A/B/C ratings on the normalized scale using the config bands
-- (UNRATED rows are left untouched). The next pipeline run does the same.
update fa_scores s
set rating = case
  when s.normalized_score >= (c.config->'rating'->>'A_min')::numeric then 'A'
  when s.normalized_score >= (c.config->'rating'->>'B_min')::numeric then 'B'
  else 'C'
end
from fa_scoring_config c
where c.id = 1 and s.rating <> 'UNRATED';
