-- F10 — rollback for the insurance release (migrations 070 + 071).
--
-- Run ONLY if a check in §15's sequence fails. Each block is independent and
-- idempotent, so a partial release can be unwound to exactly the step reached.
--
-- WHAT IS AND IS NOT REVERSIBLE ----------------------------------------------
-- Reversible here: the group reclassification (070) and the scored rows (071).
-- NOT undone by this file, deliberately:
--   * the share-event dedup and the EPS rebase — those are corrections, and the
--     before/after evidence is in data/exports/dedup_truoc_sau.xlsx. Reverting
--     them would restore a factor known to be wrong.
--   * the tables themselves. Dropping fa_insurance_scores would discard the
--     version history the key exists to keep; step 2 empties one version.
--
-- Step 3 is the one that matters most: after moving symbols back to
-- manufacturing, `refresh_final_score.py` MUST run, or they sit with a null
-- Final Score that neither rubric explains.

-- --- 1. put the insurers back on the manufacturing rubric -------------------
-- Only rows this release moved: source 'vnstock' and group 'insurance'. A row
-- hand-corrected to something else since is left alone.
update fa_industry
   set industry_group = 'manufacturing',
       updated_at     = now()
 where industry_group = 'insurance';

-- --- 2. remove the scored rows for ONE version -----------------------------
-- Scoped to the version triple. Other versions — and any later re-score — are
-- untouched, which is the point of keeping the version in the key.
delete from fa_insurance_scores
 where score_version    = 'INS_TOAN_NGANH_50_V1'
   and eps_norm_version = 'EPS_STD_IAS33_DEDUP_V2'
   and threshold_set    = 'ba_v2';

-- --- 3. THEN re-run, in this order -----------------------------------------
--   python3 scripts/refresh_fa.py score
--   python3 scripts/refresh_final_score.py
--   curl -X POST -H "x-revalidate-secret: $REVALIDATE_SECRET" \
--        "https://www.loctinhieu.com/api/revalidate?tags=fa-data"
--
-- Skipping the Final Score step leaves the 13 symbols with a null final_score:
-- `_sector_blocked` no longer lists them, but nothing has recomputed the blend.

-- --- VERIFY the rollback ---------------------------------------------------
--   select count(*) from fa_industry where industry_group = 'insurance';        -- 0
--   select count(*) from fa_insurance_scores
--    where score_version = 'INS_TOAN_NGANH_50_V1';                             -- 0
--   select count(*) from fa_scores s join symbol_profile p using (symbol)
--    where p.com_type_code = 'BH' and s.as_of_period = '2026-Q2'
--      and s.final_score is not null;                                          -- 13
