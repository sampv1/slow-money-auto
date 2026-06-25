-- ============================================================
-- Migration: store the Final score PER QUARTER on fa_scores.
--
-- Final score = 0.59 · TA score + 0.41 · FA score. Previously a single
-- latest-snapshot value on ta_universe. We now store it on each fa_scores row
-- (symbol + as_of_period) so historical quarters keep a FROZEN Final score:
-- the daily pipeline only rewrites the LATEST period's rows; older quarters
-- retain whatever they last had (no daily/TA updates for old quarters).
--
-- Weights + grade bands stay in scoring_config 'final_score' (migrations 024/026).
-- Run this in the Supabase SQL Editor.
-- ============================================================

alter table fa_scores
  add column if not exists final_score integer,
  add column if not exists final_grade text;

-- The latest-snapshot columns on ta_universe are superseded by the per-quarter
-- columns above.
alter table ta_universe
  drop column if exists final_score,
  drop column if exists final_grade;

-- Backfill the LATEST FA period from the current ta_score + that period's
-- normalized FA, using the configured weights. Older periods stay null (no
-- historical TA to reconstruct them); they populate going forward as each
-- quarter rolls over and freezes.
with w as (
  select (config->'weights'->>'ta')::numeric as ta,
         (config->'weights'->>'fa')::numeric as fa
  from scoring_config where key = 'final_score'
),
latest as (select max(as_of_period) as p from fa_scores)
update fa_scores f
set final_score = round(u.ta_score * w.ta + f.normalized_score * w.fa)::int,
    final_grade = case
      when round(u.ta_score * w.ta + f.normalized_score * w.fa) >= 90 then 'A+'
      when round(u.ta_score * w.ta + f.normalized_score * w.fa) >= 80 then 'A'
      when round(u.ta_score * w.ta + f.normalized_score * w.fa) >= 70 then 'B'
      when round(u.ta_score * w.ta + f.normalized_score * w.fa) >= 60 then 'C'
      else 'D' end
from ta_universe u, latest, w
where f.symbol = u.symbol
  and f.as_of_period = latest.p
  and u.ta_score is not null
  and f.normalized_score is not null;
