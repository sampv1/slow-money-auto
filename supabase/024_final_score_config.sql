-- ============================================================
-- Migration: Final Score weights.
--
--   Final score = 0.59 · TA score + 0.41 · FA score   (both 0-100)
--
-- The Signal Pro page computes the Final score per displayed row from the
-- selected quarter's normalized FA score and the latest TA score, reading these
-- weights. A row shows a Final score only when BOTH components exist (a missing
-- TA score leaves the cell blank).
-- Run this in the Supabase SQL Editor.
-- ============================================================

insert into scoring_config (key, config) values ('final_score', '{
  "weights": {"ta": 0.59, "fa": 0.41}
}'::jsonb)
on conflict (key) do update set config = excluded.config, updated_at = now();
