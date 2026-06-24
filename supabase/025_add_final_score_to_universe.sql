-- ============================================================
-- Migration: store the Final score on ta_universe.
--
--   Final score = 0.59 · TA score + 0.41 · FA score   (both 0-100)
--
-- This is a single LATEST-snapshot value: latest TA score (ta_universe.ta_score)
-- blended with the latest FA period's normalized score. It is null unless BOTH
-- components exist. Computed daily by the TA pipeline (after ta_score) and
-- stored here. Weights come from scoring_config 'final_score' (migration 024).
--
-- The Signal Pro page shows this only when the LATEST quarter is selected; for
-- older quarters it shows FA only (per-quarter Final scores are a later task).
-- Run this in the Supabase SQL Editor.
-- ============================================================

alter table ta_universe
  add column if not exists final_score integer;

-- Backfill from the latest FA period + current ta_score, using the configured
-- weights, so the page works immediately before the next pipeline run.
with w as (
  select (config->'weights'->>'ta')::numeric as ta,
         (config->'weights'->>'fa')::numeric as fa
  from scoring_config where key = 'final_score'
),
latest as (select max(as_of_period) as p from fa_scores)
update ta_universe u
set final_score = round(u.ta_score * w.ta + f.normalized_score * w.fa)
from fa_scores f, latest, w
where f.symbol = u.symbol
  and f.as_of_period = latest.p
  and u.ta_score is not null
  and f.normalized_score is not null;
