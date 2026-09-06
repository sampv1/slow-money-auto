-- Migration 061: V10 storage contract for the securities rubric.
--
-- WHY -----------------------------------------------------------------------
-- Three gaps that V10 turns into hard requirements:
--
-- 1. `normalized_fa_score` was doing two jobs. A symbol scored on half the
--    rubric still produced a number, and nothing stopped that number reaching
--    the Pro composite. V10 splits them: `provisional_score` always carries the
--    arithmetic so a partial row can be inspected, while `final_fa_score` is
--    NULL unless the symbol is group A. The composite reads only the latter, so
--    "not enough data to rank this" is expressed by absence rather than by a
--    convention every consumer has to remember.
--
-- 2. `data_group` (A/B/C/RISK_GATE) had no column, so the gate's outcome could
--    only be re-derived by whoever read the row — and re-derived differently by
--    each reader. It is a statement about the MEASUREMENT, not about the
--    broker: C means we could not score it honestly, not that it is bad.
--
-- 3. Per-block available maxima were not stored, only the totals. The UI was
--    therefore printing `earned / STATIC rubric max` — cycle as 8/30 when 7 of
--    those 30 points are N/A, and valuation as 0/20 when its available max is
--    zero. The second is the worse: it asserts a measured zero where there was
--    no measurement, which is the exact distinction the rubric exists to keep.
--
-- Additive only. Existing CTCK_V8 / CTCK_V9_DRAFT rows keep their values and
-- simply carry NULL in the new columns — they are never rewritten.

alter table fa_securities_scores
  add column if not exists provisional_score numeric,
  add column if not exists final_fa_score numeric,
  add column if not exists data_group text,
  add column if not exists quality_available_max numeric,
  add column if not exists cycle_available_max numeric,
  add column if not exists valuation_available_max numeric,
  -- Full per-criterion contract: {c1: {earned, available_max, status,
  -- reason_code, source_type, confidence}, …}. jsonb rather than 120 columns —
  -- a criterion added or withdrawn is a rubric change, not a migration, which
  -- is the same reason fa_re_scores keeps its breakdown this way.
  add column if not exists criteria jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'fa_securities_scores_data_group_check') then
    alter table fa_securities_scores
      add constraint fa_securities_scores_data_group_check
      check (data_group is null or data_group in ('A', 'B', 'C', 'RISK_GATE'));
  end if;
end $$;

-- THE RULE THAT MATTERS, ENFORCED RATHER THAN DOCUMENTED: only group A may
-- carry a final score. Without this the split is a convention, and a convention
-- is what let a provisional number reach the composite in the first place.
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'fa_securities_scores_final_only_group_a') then
    alter table fa_securities_scores
      add constraint fa_securities_scores_final_only_group_a
      check (final_fa_score is null or data_group = 'A');
  end if;
end $$;

-- Ranking reads final_fa_score now, not normalized_fa_score.
create index if not exists idx_fa_sec_scores_final
  on fa_securities_scores(as_of_date desc, final_fa_score desc)
  where final_fa_score is not null and score_status = 'OFFICIAL';

comment on column fa_securities_scores.final_fa_score is
  'Only group A. NULL means the symbol was not scored on enough of the rubric '
  'to be comparable — the Pro composite reads this column precisely so that '
  'absence, not a low number, is what excludes it.';
comment on column fa_securities_scores.provisional_score is
  'earned / available_max x 100, always populated. Inspect a B row with this; '
  'never feed it to the composite.';
comment on column fa_securities_scores.data_group is
  'A: coverage >= 70% with usable core AND valuation. B: 50-70%, or good '
  'coverage without a usable valuation. C: under 50%, or no usable core. '
  'A judgement about the measurement, not about the company.';

-- ---------------------------------------------------------------------------
-- VERIFY (after scripts/refresh_fa_securities.py)
--   select data_group, count(*), round(avg(coverage)*100,1) avg_cov,
--          count(final_fa_score) with_final
--     from fa_securities_scores
--    where model_version = 'CTCK_V10' and as_of_date = '2026-09-04'
--    group by 1 order by 1;
--   -- expect A ~24 all with a final score, B/C with none
--   -- the constraint must make this impossible (expect an error):
--   --   update fa_securities_scores set final_fa_score = 50
--   --    where data_group = 'C' and model_version = 'CTCK_V10';
--   -- V10 acceptance AT02/AT03/AT09/AT10:
--   select symbol, c19_score, quality_available_max, cycle_available_max,
--          valuation_available_max, available_max, round(final_fa_score,2)
--     from fa_securities_scores
--    where model_version='CTCK_V10' and as_of_date='2026-09-04'
--      and symbol in ('VCK','SSI','VND','HCM','VIG','APS','HBS')
--    order by symbol;
--   -- expect VCK 8 / 39 / 23 / 8 / 70 / 65.71 and SSI … / 54.29
-- ---------------------------------------------------------------------------
