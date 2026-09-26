-- Migration 070: classify insurers into their own rubric group.
--
-- WHY -----------------------------------------------------------------------
-- This is migration 060's defect, repeated for a third sector. All 14 insurance
-- symbols are `industry_group = 'manufacturing'`, so today:
--
--   1. They appear on the FA Scanner's MANUFACTURING tab, scored on criteria
--      that do not describe an insurer's income statement. Measured before this
--      migration at 2026-Q2: BVH rated A on 66.7, ABI B on 60 (final 43),
--      BLI A on 63 — numbers built from gross margin and net margin deltas that
--      an insurance P&L does not report in the manufacturing sense.
--   2. `ta/final_score.py` routes on this column, so each of them blends that
--      score into a Final Score. Securities were silently doing the same for two
--      years until 2026-09-07; the fix there was to make ABSENCE the outcome
--      rather than a wrong number, and the same applies here.
--
-- BA's acceptance doc requires it (A9, §4.7): "tránh một doanh nghiệp có hai
-- điểm FA chính thức theo hai bộ tiêu chí khác nhau". The 50-point Toàn ngành
-- layer is not persisted yet, so an insurer ends up with NO FA score after this
-- — which is the correct state, exactly as for a securities firm whose sector
-- model is still pending.
--
-- 'insurance' is deliberately NOT folded into 'financial', for the same reason
-- 060 kept 'securities' out of it: a group value shared by two rubrics cannot
-- route either of them.

alter table fa_industry drop constraint if exists fa_industry_industry_group_check;
alter table fa_industry add constraint fa_industry_industry_group_check
  check (industry_group in ('manufacturing', 'real_estate', 'financial',
                            'construction', 'securities', 'banks', 'insurance'));

-- Reclassify from `symbol_profile.com_type_code = 'BH'`, not from an ICB code.
-- Verified on the live data: the 14 symbols carrying an insurance ICB L4
-- (8532/8534/8536/8538/8575/8577) are EXACTLY the 14 typed 'BH', so the two
-- tests agree and neither leaks a name the other keeps. `com_type_code` is used
-- because it is the same field `refresh_fa_vnstock` and the Final Score already
-- consult for a financial filer, and because it survives an ICB relabel.
--
-- Idempotent, and it only ever moves rows OUT of manufacturing: a symbol that
-- has been hand-corrected to something else is left alone.
insert into fa_industry (symbol, industry_group, icb_industry, source, updated_at)
select p.symbol, 'insurance', 'Bảo hiểm', 'vnstock', now()
  from symbol_profile p
 where p.com_type_code = 'BH'
on conflict (symbol) do update
   set industry_group = 'insurance',
       icb_industry   = excluded.icb_industry,
       updated_at     = now()
 where fa_industry.industry_group = 'manufacturing';

-- ---------------------------------------------------------------------------
-- VERIFY
--
-- Expect 14 rows: the 13 in BA's working universe plus IFA, which is classified
-- here but excluded from the tab's universe because it has no statements and no
-- EPS. Classifying it is deliberate — it must not fall back to manufacturing.
--
--   select industry_group, count(*) from fa_industry
--    where industry_group = 'insurance' group by 1;
--
-- And no insurer may keep a manufacturing Final Score. After this migration,
-- `refresh_final_score.py` must be re-run so the reset path nulls them:
--
--   select s.symbol, s.as_of_period, s.total_score, s.final_score
--     from fa_scores s join fa_industry i using (symbol)
--    where i.industry_group = 'insurance'
--      and s.final_score is not null;
--
-- Expect zero rows once `ta/final_score.py` blocks the group.
