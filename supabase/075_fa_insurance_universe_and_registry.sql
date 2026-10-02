-- Migration 075: insurance scoring eligibility (IFA exclusion) + the Master Registry.
--
-- BA `BA_CHOT_TRIEN_KHAI_TAB_BAO_HIEM...2026-10-02.md` §3.2 (Bước 1) and §5 (Bước 2).
--
-- WHY TWO THINGS IN ONE MIGRATION -------------------------------------------
-- They answer the same question from opposite ends: "which symbols are in, and
-- why is one out" and "which metric exists, in which version, implemented
-- where". BA's §2 names the single root cause of the delay — work that existed
-- but was not registered anywhere, so "not wired into the scorer" was read as
-- "BA never designed it". Both tables are that register.
--
-- PART 1 — SCORING ELIGIBILITY IS SEPARATE FROM CLASSIFICATION ---------------
-- IFA is an insurance company and is classified `Phi nhân thọ`; it is simply
-- not a scoreable stock. Those are two different facts and BA §3.2 keeps them
-- apart deliberately: the universe is 14 RECOGNISED companies of which 13 are
-- SCORED, and the completeness check only passes when the 14th carries an
-- approved reason. Measured before writing this: IFA has `exchange = 'OTC'`,
-- zero rows in `fa_vnstock_statements`, zero bars in `ta_ohlcv`, and is absent
-- from `ta_universe` (which syncs from the three exchanges' stock rosters).
-- So the exclusion is a property of the LISTING, not a data gap we could close.
--
-- §3.2 also forbids three things this column is what makes checkable: IFA must
-- not appear in the scanner, must not sit in the denominator of coverage, and
-- must not join the quarterly "awaiting filings" list.

alter table fa_insurance_classification
  add column if not exists scoring_eligibility text not null default 'ELIGIBLE'
    check (scoring_eligibility in ('ELIGIBLE', 'EXCLUDED')),
  add column if not exists exclusion_reason text
    check (exclusion_reason is null or exclusion_reason in (
      'OTC_NO_LISTED_DATA',      -- not listed on HOSE/HNX/UPCOM; no price, no filings
      'DELISTED',
      'INSUFFICIENT_HISTORY',
      'BA_DECISION')),
  add column if not exists exclusion_approved_by text,
  add column if not exists exclusion_approved_at date;

-- An exclusion without a reason is the state BA forbids: `approved_exclusions = 0`
-- while the completeness check still claims PASS.
alter table fa_insurance_classification
  drop constraint if exists insurance_exclusion_needs_reason;
alter table fa_insurance_classification
  add constraint insurance_exclusion_needs_reason
  check (scoring_eligibility = 'ELIGIBLE' or exclusion_reason is not null);

comment on column fa_insurance_classification.scoring_eligibility is
  'EXCLUDED means recognised as an insurer but not a scoreable stock. The '
  'symbol stays classified so the universe is 14 recognised = 13 scored + 1 '
  'explained; it must not appear in the scanner or in a coverage denominator.';

-- PART 2 — THE MASTER REGISTRY ----------------------------------------------
-- One effective row per metric (§5: "Mỗi metric chỉ có một bản ghi hiệu lực
-- tại một thời điểm"), carrying BOTH the business definition and where it
-- lives in the code. `code_module` and `source_document` are the two fields
-- that would have prevented this round's mistake: the non-life P1-P5 bands
-- were frozen in `fa/nonlife_bands.py` and nobody could see that from a
-- status table, so they were reported as non-existent.
--
-- `implementation_status` is per METRIC, never per tab (§5.1). A tab-level
-- status is exactly how a missing module hides behind a finished one.

create table if not exists insurance_scoring_master_registry (
  insurance_type_code text not null
    check (insurance_type_code in ('LIFE', 'NON_LIFE', 'REINSURANCE',
                                   'HOLDING_MIXED', 'COMMON')),
  metric_code text not null,
  effective_from date not null default current_date,
  effective_to   date,

  -- --- business definition (BA owns) --------------------------------------
  metric_name_vi text not null,
  metric_group text not null
    check (metric_group in ('COMMON_50', 'INTERNAL_38', 'VALUATION_12')),
  weight numeric(5,2) not null check (weight >= 0),
  economic_meaning text,
  formula_text text,
  formula_machine text,
  source_statement text,
  source_fields text,
  period_basis text,
  -- How many periods the FORMULA reads, vs how many it needs before it may
  -- score. BA §10.1 forbids a blanket 12-quarter gate across the whole /38:
  -- the number lives per metric, here, and nowhere else.
  lookback_requirement text,
  minimum_history_required integer,
  zero_denominator_rule text,
  negative_value_rule text,
  missing_data_rule text,
  one_off_rule text,

  -- --- versions and provenance (IT owns) ----------------------------------
  formula_version text,
  band_version text,
  source_document text,
  source_document_version text,
  code_module text,
  owner text,

  implementation_status text not null default 'DRAFT'
    check (implementation_status in ('DRAFT', 'DATA_VERIFIED', 'FORMULA_FROZEN',
                                     'BAND_FROZEN', 'IMPLEMENTED', 'TESTED',
                                     'PRODUCTION_READY')),
  data_verification_status text,
  acceptance_status text,
  note text,
  updated_at timestamptz not null default now(),

  primary key (insurance_type_code, metric_code, effective_from)
);

comment on table insurance_scoring_master_registry is
  'One effective row per metric: what it means, which version, and WHICH CODE '
  'MODULE implements it. BA 02/10 §5 — the single register that stops "already '
  'built but not wired" being reported as "not designed".';
comment on column insurance_scoring_master_registry.minimum_history_required is
  'Per-metric only. A blanket history gate across a whole score block is '
  'forbidden (BA §10.1).';

create unique index if not exists insurance_registry_one_effective_idx
  on insurance_scoring_master_registry (insurance_type_code, metric_code)
  where effective_to is null;

alter table insurance_scoring_master_registry enable row level security;
drop policy if exists "insurance_registry read" on insurance_scoring_master_registry;
create policy "insurance_registry read" on insurance_scoring_master_registry
  for select using (true);

-- ---------------------------------------------------------------------------
-- VERIFY
--
-- 1. Exactly one excluded symbol, and it carries a reason. Expect IFA only:
--
--   select symbol, insurance_type, scoring_eligibility, exclusion_reason
--     from fa_insurance_classification
--    where insurance_type_effective_to is null and scoring_eligibility = 'EXCLUDED';
--
-- 2. No exclusion without a reason. Expect ZERO rows:
--
--   select * from fa_insurance_classification
--    where scoring_eligibility = 'EXCLUDED' and exclusion_reason is null;
--
-- 3. Scoring universe is 13. Expect 13:
--
--   select count(*) from fa_insurance_classification
--    where insurance_type_effective_to is null and scoring_eligibility = 'ELIGIBLE';
--
-- 4. One effective registry row per metric (enforced by the partial unique
--    index). Expect ZERO rows:
--
--   select insurance_type_code, metric_code, count(*)
--     from insurance_scoring_master_registry where effective_to is null
--    group by 1, 2 having count(*) > 1;
--
-- 5. Weights per block reconcile. Expect 50 / 38 / 12 per type that is built:
--
--   select insurance_type_code, metric_group, sum(weight)
--     from insurance_scoring_master_registry where effective_to is null
--    group by 1, 2 order by 1, 2;
