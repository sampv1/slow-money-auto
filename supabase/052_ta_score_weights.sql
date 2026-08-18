-- 052: TA Score — shift 5 points from RS Composite to Trend.
--
--   before   RS3M 20% + RS Composite 25% + RS Line 20% + Trend 35%
--   after    RS3M 20% + RS Composite 20% + RS Line 20% + Trend 40%
--
-- Both halves still sum to 1.00, so the score stays on its 0-100 scale and no
-- grade band moves; what changes is the balance between the two things the
-- score measures. RS Composite already enters twice in spirit — rs_3m is one of
-- the four periods blended into it — so trimming the composite while leaving
-- rs_3m alone reduces that overlap rather than de-weighting relative strength
-- as a whole. Trend structure gains the difference.
--
-- This UPDATE is REQUIRED, not cosmetic: load_scoring_config deep-merges the
-- stored row OVER the code defaults, so a stored row still holding
-- "rs_composite": 0.25 and "trend": 0.35 wins over any edit to
-- TA_SCORE_DEFAULTS in scripts/ta/ta_score.py. Deploying the code without
-- applying this leaves the old weights in force, silently.
--
-- Rerun after applying, in this order — Final Score is 0.59·TA + 0.41·FA:
--   python3 refresh_ta_score.py
--   python3 refresh_final_score.py
-- ------------------------------------------------------------
insert into scoring_config (key, config) values ('ta_score', '{
  "weights": {"rs_3m": 0.20, "rs_composite": 0.20, "rs_line": 0.20, "trend": 0.40}
}'::jsonb)
on conflict (key) do update set config = excluded.config, updated_at = now();
