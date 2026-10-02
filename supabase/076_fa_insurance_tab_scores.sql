-- Migration 076: the insurance tab's assembled score — Common/50 + Internal/38
-- + Valuation/12 = Total/100, one row per symbol-quarter.
--
-- BA `BA_CHOT_TRIEN_KHAI...2026-10-02.md` §4, §6 Bước 3/6, §8 and §20 of the
-- business spec.
--
-- ONE TABLE FOR ALL FOUR TYPES, NOT FOUR TABLES ------------------------------
-- The arithmetic is identical for life, non-life, reinsurance and holding — BA
-- §4 defines it once — and only the RUBRIC behind `internal_change_score`
-- differs. Four near-identical tables would mean the Toàn ngành tab (§17) had
-- to union them and keep four schemas in step; `insurance_type_code` on one row
-- does the same job and makes "every symbol used exactly its own rubric" a
-- query rather than a convention.
--
-- THE COMPONENT RUBRIC SCORES LIVE IN THEIR OWN TABLES. This table stores the
-- ASSEMBLY, plus the per-criterion detail as jsonb so a reader can see which
-- criteria produced the block without a second lookup. The detail is a record,
-- never the source of truth: `internal_change_score` is what the engine summed.
--
-- WHY `score_status` IS NOT DERIVED FROM NULLS -------------------------------
-- BA §7.1 separates three things a NULL cannot: ELIGIBLE-and-zero (a real worst
-- case), BLOCKED, and PENDING. `0` must stay a legal score — §15.7 forbids
-- banning it — so the status column carries the distinction and the check
-- constraint below ties them together: a score may exist only when the row is
-- complete, and a complete row must carry one.

create table if not exists fa_insurance_tab_scores (
  symbol text not null,
  period text not null,                       -- calendar quarter 'YYYY-Qn'
  insurance_type_code text not null
    check (insurance_type_code in ('LIFE', 'NON_LIFE', 'REINSURANCE', 'HOLDING_MIXED')),

  -- --- the three blocks (§4) ----------------------------------------------
  common_score         numeric(6,2) check (common_score         between 0 and 50),
  internal_change_score numeric(6,2) check (internal_change_score between 0 and 38),
  valuation_score      numeric(6,2) check (valuation_score      between 0 and 12),
  fa_score             numeric(6,2) check (fa_score             between 0 and 88),
  total_score          numeric(6,2) check (total_score          between 0 and 100),

  -- Per-criterion detail: {"P1": {"value": .., "band": "..", "score": ..}, ...}
  criteria jsonb not null default '{}'::jsonb,

  -- --- ΔFA (§8.2) — on FA/88 only, never including valuation ---------------
  previous_period text,
  previous_fa_score numeric(6,2),
  fa_change_pct numeric(10,4),
  fa_change_status text not null default 'NOT_APPLICABLE'
    check (fa_change_status in ('CALCULATED', 'ZERO_BASE',
                                'NO_COMPARABLE_PREVIOUS_FA',
                                'CURRENT_FA_INCOMPLETE', 'NOT_APPLICABLE')),

  -- --- status (§7.1, §21 of the business spec) -----------------------------
  score_status text not null
    check (score_status in ('SCORING_COMPLETE', 'PARTIAL_NOT_RATED',
                            'BLOCKED', 'PENDING')),
  blocked_reason text,
  blocked_metrics text,

  -- --- versions (§8.1) -----------------------------------------------------
  common_score_version text,
  formula_version text not null,
  band_version text not null,
  taxonomy_version text,
  source_run_id text,
  calculated_at timestamptz not null default now(),

  -- A total exists only when the row is complete, and a complete row has one.
  -- This is the constraint that stops a partial rubric reaching the Toàn ngành
  -- sort, which BA §21.2 forbids ("Không đưa vào sort Tổng điểm").
  constraint insurance_total_only_when_complete
    check ((score_status = 'SCORING_COMPLETE') = (total_score is not null)),
  -- Total must equal its parts to the cent whenever it exists.
  constraint insurance_total_equals_parts
    check (total_score is null
           or abs(total_score - (coalesce(common_score, 0)
                                 + coalesce(internal_change_score, 0)
                                 + coalesce(valuation_score, 0))) < 0.005),
  constraint insurance_fa_equals_common_plus_internal
    check (fa_score is null
           or abs(fa_score - (coalesce(common_score, 0)
                              + coalesce(internal_change_score, 0))) < 0.005),
  -- A non-complete row carries a reason; "unexplained blank" is what §6 Bước 5
  -- forbids ("Không để ô trống không giải thích").
  constraint insurance_incomplete_needs_reason
    check (score_status = 'SCORING_COMPLETE' or blocked_reason is not null),

  primary key (symbol, period, formula_version, band_version)
);

comment on table fa_insurance_tab_scores is
  'Assembled insurance score per symbol-quarter: Common/50 + Internal/38 + '
  'Valuation/12 = Total/100. One row per quarter SNAPSHOT — never overwritten '
  'by a later quarter and never carried forward (BA §8.1, §8.3).';
comment on column fa_insurance_tab_scores.fa_change_pct is
  'ΔFA on FA/88 ONLY. Valuation/12 never enters it (BA §4).';
comment on column fa_insurance_tab_scores.criteria is
  'Per-criterion record for display. The summed blocks above are the source of '
  'truth; this is never re-added by a reader.';

alter table fa_insurance_tab_scores enable row level security;
drop policy if exists "fa_insurance_tab_scores read" on fa_insurance_tab_scores;
create policy "fa_insurance_tab_scores read" on fa_insurance_tab_scores
  for select using (true);

create index if not exists fa_insurance_tab_scores_period_idx
  on fa_insurance_tab_scores (period, insurance_type_code, symbol);

-- ---------------------------------------------------------------------------
-- VERIFY
--
-- 1. Total = Common + Internal + Valuation (enforced). Expect ZERO rows:
--
--   select symbol, period, total_score, common_score, internal_change_score,
--          valuation_score from fa_insurance_tab_scores
--    where total_score is not null
--      and abs(total_score - (common_score + internal_change_score
--                             + valuation_score)) >= 0.005;
--
-- 2. FA = Common + Internal. Expect ZERO rows:
--
--   select * from fa_insurance_tab_scores where fa_score is not null
--     and abs(fa_score - (common_score + internal_change_score)) >= 0.005;
--
-- 3. No incomplete row carries a total. Expect ZERO rows:
--
--   select * from fa_insurance_tab_scores
--    where score_status <> 'SCORING_COMPLETE' and total_score is not null;
--
-- 4. Every symbol used its own rubric — join against the classification and
--    expect ZERO rows:
--
--   select s.symbol, s.insurance_type_code, c.insurance_type
--     from fa_insurance_tab_scores s
--     join fa_insurance_classification c
--       on c.symbol = s.symbol and c.insurance_type_effective_to is null
--    where (c.insurance_type = 'Phi nhân thọ'     and s.insurance_type_code <> 'NON_LIFE')
--       or (c.insurance_type = 'Tái bảo hiểm'     and s.insurance_type_code <> 'REINSURANCE')
--       or (c.insurance_type = 'Holding/Hỗn hợp'  and s.insurance_type_code <> 'HOLDING_MIXED');
--
-- 5. No excluded symbol was scored. Expect ZERO rows:
--
--   select s.* from fa_insurance_tab_scores s
--     join fa_insurance_classification c
--       on c.symbol = s.symbol and c.insurance_type_effective_to is null
--    where c.scoring_eligibility = 'EXCLUDED';
