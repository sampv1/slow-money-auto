-- ============================================================
-- Migration: Final-score rating grade.
--
-- The Signal Pro "Rating" column is graded off the Final score:
--   A+ 90-100, A 80-89, B 70-79, C 60-69, D < 60
--
-- Bands are stored in scoring_config 'final_score' (alongside the weights) so
-- they're tunable without code; the pipeline writes final_grade onto
-- ta_universe. Like final_score, it's a latest-snapshot value shown only for the
-- latest quarter on Signal Pro.
-- Run this in the Supabase SQL Editor.
-- ============================================================

alter table ta_universe
  add column if not exists final_grade text;

-- Add the grade bands to the existing final_score config (descending [min, grade]).
update scoring_config
set config = config || '{"grades": [[90, "A+"], [80, "A"], [70, "B"], [60, "C"], [0, "D"]]}'::jsonb,
    updated_at = now()
where key = 'final_score';

-- Backfill final_grade from final_score (mirrors the config bands above).
update ta_universe
set final_grade = case
  when final_score is null then null
  when final_score >= 90 then 'A+'
  when final_score >= 80 then 'A'
  when final_score >= 70 then 'B'
  when final_score >= 60 then 'C'
  else 'D'
end;
