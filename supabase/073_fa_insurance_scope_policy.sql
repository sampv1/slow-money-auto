-- Migration 073: report-scope determination, a scope POLICY with effective
-- dates, and explicit classification semantics.
--
-- WHY -----------------------------------------------------------------------
-- 072 recorded which scope the pipeline used and whether that choice had been
-- verified. Three gaps showed up the moment the non-life checks were tightened:
--
--   1. THE TABLE COULD NOT SAY "UNDETERMINED". `selected_report_scope` admits
--      only CONSOLIDATED and STANDALONE, so a period whose scope nothing
--      establishes had to be filed as one of the two. That is the same
--      collapse 072 avoided for `consolidated_report_available`, reappearing
--      one column to the left. P2 reads the year-ago quarter and P3 reads five
--      quarters, and the filing-header source serves only the latest four — so
--      "undetermined" is the majority state for the source periods, not an edge
--      case.
--
--   2. TWO DIFFERENT FACTS WERE SHARING ONE COLUMN. "Which scope is the record
--      we read" and "does a consolidated report exist for this company" are
--      separate questions with separate evidence, and the scope checks need the
--      first while the acceptance gate needs the second. A period can have a
--      perfectly determined record scope (the header names it) while the
--      existence question stays open. `record_report_scope` now carries the
--      first; `consolidated_report_available` keeps the second.
--
--   3. VERIFYING THE SAME COMPANY EVERY QUARTER IS NOT A PLAN. A company's
--      group structure changes rarely, so the answer belongs to a DATE RANGE,
--      not to a quarter. `fa_insurance_scope_policy` holds it that way, and the
--      resolver reads it BEFORE falling back to per-period evidence — so when
--      the issuer disclosure arrives it is one INSERT per company and every
--      quarter in range becomes verified, with no code change and nothing
--      hard-coded per symbol.
--
-- A SECOND, VERIFIABLE SOURCE OF RECORD SCOPE ---------------------------------
-- `BS_MINORITY_INTEREST > 0` proves the record consolidates a partly-owned
-- subsidiary, i.e. that record IS a consolidated statement. It is a POSITIVE
-- identification, which is why it is admissible where a zero minority interest
-- is not: zero is consistent with a standalone filing AND with a consolidation
-- of wholly-owned subsidiaries, so it proves nothing and must never be used.
-- Checked against the filing header on every symbol-period where both exist:
-- 36 of 36 agree, 0 disagree. It reaches as deep as the balance sheet does,
-- which closed the older source periods for BIC and PTI (24 quarters each) and
-- for BHI from 2023-Q2 — BHI reads zero at 2023-Q1 and has no balance sheet
-- before it, so BHI is the case that proves the method does not simply mirror
-- whatever the recent quarters said.

-- ---------------------------------------------------------------------------
-- 1. Report scope: admit UNDETERMINED, and separate record scope from existence
-- ---------------------------------------------------------------------------
alter table fa_insurance_report_scope
  add column if not exists record_report_scope text not null default 'UNDETERMINED',
  -- How the record scope was established, so a verdict can be re-examined
  -- without re-deriving it. Never blank on a written row.
  add column if not exists scope_verification_method text,
  -- Which P-criteria read this symbol-period. A source period exists in this
  -- table BECAUSE a formula reads it; recording which one is what makes
  -- "extend the verification to every source period" auditable rather than
  -- asserted.
  add column if not exists used_by_metrics text,
  add column if not exists scope_policy_applied text;

alter table fa_insurance_report_scope
  drop constraint if exists fa_insurance_report_scope_record_report_scope_check;
alter table fa_insurance_report_scope
  add constraint fa_insurance_report_scope_record_report_scope_check
  check (record_report_scope in ('CONSOLIDATED', 'STANDALONE', 'UNDETERMINED'));

comment on column fa_insurance_report_scope.record_report_scope is
  'The scope of the statement record this pipeline actually read. UNDETERMINED '
  'is a real value, not a placeholder: it means no source establishes it. '
  'Distinct from consolidated_report_available, which answers whether a '
  'consolidated report EXISTS — a period can have a known record scope and an '
  'open existence question at the same time.';

comment on column fa_insurance_report_scope.scope_verification_method is
  'STATEMENT_HEADER · BALANCE_SHEET_MINORITY_INTEREST · VERIFIED_SCOPE_POLICY · '
  'NOT_DETERMINABLE_FROM_SOURCE. A zero minority interest is NOT a method: it '
  'is consistent with both scopes and proves neither.';

-- `selected_report_scope` must be able to say "neither" for the same reason.
alter table fa_insurance_report_scope
  drop constraint if exists fa_insurance_report_scope_selected_report_scope_check;
alter table fa_insurance_report_scope
  add constraint fa_insurance_report_scope_selected_report_scope_check
  check (selected_report_scope in ('CONSOLIDATED', 'STANDALONE', 'UNDETERMINED'));

alter table fa_insurance_report_scope
  drop constraint if exists fa_insurance_report_scope_scope_selection_reason_check;
alter table fa_insurance_report_scope
  add constraint fa_insurance_report_scope_scope_selection_reason_check
  check (scope_selection_reason in (
    'CONSOLIDATED_AVAILABLE_AND_SELECTED',
    'NO_CONSOLIDATED_REPORT_STANDALONE_SELECTED',
    'CONSOLIDATED_MISSING_FROM_PROVIDER',
    'SCOPE_CONFLICT_REQUIRES_REVIEW',
    -- New: the record's scope is identified but the existence question is open.
    'CONSOLIDATED_IDENTIFIED_BY_MINORITY_INTEREST',
    'STANDALONE_RECORD_EXISTENCE_UNVERIFIED',
    -- New: nothing establishes even the record's scope.
    'SCOPE_NOT_DETERMINABLE_FROM_SOURCE',
    'NOT_YET_VERIFIED'));

-- A written row must say how it was decided. Enforced rather than conventional:
-- the first non-life run filled this kind of field by assumption.
alter table fa_insurance_report_scope
  drop constraint if exists fa_insurance_report_scope_method_required;
alter table fa_insurance_report_scope
  add constraint fa_insurance_report_scope_method_required
  check (scope_verification_method is not null);

-- An UNDETERMINED record scope can never be VERIFIED, and a VERIFIED row can
-- never be UNDETERMINED. Without this the two columns can drift into a state
-- that reads as "we checked, and the answer is that we do not know".
alter table fa_insurance_report_scope
  drop constraint if exists fa_insurance_report_scope_undetermined_not_verified;
alter table fa_insurance_report_scope
  add constraint fa_insurance_report_scope_undetermined_not_verified
  check (not (record_report_scope = 'UNDETERMINED'
             and scope_review_status = 'VERIFIED'));

-- ---------------------------------------------------------------------------
-- 2. Scope policy, with effective dates (BA §4.6)
-- ---------------------------------------------------------------------------
create table if not exists fa_insurance_scope_policy (
  symbol text not null,

  -- The verified fact about the company's reporting, not about one quarter.
  --   NO_CONSOLIDATED_PREPARED  — verified that the company prepares none, so
  --                               the standalone statement is the only one and
  --                               is the correct basis.
  --   CONSOLIDATED_PREPARED     — it prepares one. Whether the provider serves
  --                               it is a separate matter and does NOT license
  --                               falling back to standalone silently.
  scope_policy text not null
    check (scope_policy in ('NO_CONSOLIDATED_PREPARED', 'CONSOLIDATED_PREPARED')),

  effective_from date not null,
  -- NULL = still in force. A group restructuring CLOSES this row and inserts a
  -- new one, exactly as fa_insurance_classification does, so a past quarter
  -- keeps the policy that was true when it was scored.
  effective_to date,

  -- Required, and deliberately so: a policy row is the thing that flips periods
  -- to VERIFIED, so it may not exist without naming what verified it. This is
  -- the column that must carry an issuer or exchange disclosure — the pipeline
  -- cannot write one from provider data.
  verification_source text not null,
  verified_date date not null,
  verified_by text not null,
  note text,
  updated_at timestamptz not null default now(),

  primary key (symbol, effective_from)
);

comment on table fa_insurance_scope_policy is
  'Verified reporting policy per company over a date range, so the report-scope '
  'question is answered once rather than re-verified every quarter. Read by the '
  'scope resolver BEFORE any per-period evidence. Empty is the correct initial '
  'state: nothing in the provider data can populate it, and populating it from '
  'provider data would be the guess this table exists to replace.';

comment on column fa_insurance_scope_policy.scope_policy is
  'NO_CONSOLIDATED_PREPARED is a VERIFIED negative — it is what licenses a '
  'standalone basis. It must never be inferred from a zero minority interest, '
  'from the absence of goodwill, or from the provider serving one report.';

alter table fa_insurance_scope_policy enable row level security;
drop policy if exists "fa_insurance_scope_policy read" on fa_insurance_scope_policy;
create policy "fa_insurance_scope_policy read" on fa_insurance_scope_policy
  for select using (true);

create index if not exists fa_insurance_scope_policy_active_idx
  on fa_insurance_scope_policy (symbol, effective_to);

-- WORKED EXAMPLE — the whole of the next round, once BA supplies the answer.
-- Nothing is inserted here, because no disclosure has been read:
--
--   insert into fa_insurance_scope_policy
--     (symbol, scope_policy, effective_from, verification_source,
--      verified_date, verified_by, note)
--   values
--     ('ABI', 'NO_CONSOLIDATED_PREPARED', date '2020-01-01',
--      'Công bố thông tin HNX/website DN — <đường dẫn cụ thể>',
--      date '2026-09-27', 'BA',
--      'DN không lập BCTC hợp nhất quý trong khoảng hiệu lực');
--
-- One row per company turns every source period in range from UNDETERMINED or
-- PENDING into VERIFIED, and CHECK_SCOPE_02/03/04/05 follow without a code
-- change.

-- ---------------------------------------------------------------------------
-- 3. Classification: PENDING must mean ONE thing (BA §8.2)
-- ---------------------------------------------------------------------------
-- The problem being fixed is not a missing value but an ambiguous one. Ten
-- non-life symbols carried insurance_type_review_status = 'PENDING' while being
-- scored, and PVI/BVH carried 'VERIFIED' while being excluded — so PENDING
-- appeared both to block and not to block. The two questions are separated:
--
--   classification_source_status — how good is the evidence for the TYPE
--   classification_usage_status  — may that type be used to route and score
--
-- and neither is the same as `eligible_for_scoring`, which is about the DATA.
alter table fa_insurance_classification
  add column if not exists classification_source_status text,
  add column if not exists classification_usage_status text;

alter table fa_insurance_classification
  drop constraint if exists fa_insurance_classification_source_status_check;
alter table fa_insurance_classification
  add constraint fa_insurance_classification_source_status_check
  check (classification_source_status is null
         or classification_source_status in ('PROVIDER', 'BA_VERIFIED',
                                             'PENDING_REVIEW'));

alter table fa_insurance_classification
  drop constraint if exists fa_insurance_classification_usage_status_check;
alter table fa_insurance_classification
  add constraint fa_insurance_classification_usage_status_check
  check (classification_usage_status is null
         or classification_usage_status in ('ACTIVE', 'BLOCKED'));

comment on column fa_insurance_classification.classification_source_status is
  'Quality of the evidence for the type. PROVIDER = an unambiguous ICB code '
  'with no competing ruling. BA_VERIFIED = a named BA decision. PENDING_REVIEW '
  '= the type is unresolved or contested.';

comment on column fa_insurance_classification.classification_usage_status is
  'Whether this type may route a symbol to a tab and be scored. An unambiguous '
  'provider code is ACTIVE without manual review — waiting for a human to '
  'confirm what the source already states unambiguously blocks nothing and '
  'costs coverage. Only an unresolved or contested type is BLOCKED. This is '
  'SEPARATE from eligible_for_scoring, which asks whether the DATA is '
  'sufficient: IFA is ACTIVE as a non-life insurer and still unscorable.';

-- Backfill by that rule. A BA ruling is BA_VERIFIED/ACTIVE; an unambiguous ICB
-- seed is PROVIDER/ACTIVE; a CONFLICT is PENDING_REVIEW/BLOCKED.
update fa_insurance_classification
   set classification_source_status =
         case when insurance_type_source = 'BA_DECISION' then 'BA_VERIFIED'
              when insurance_type_review_status = 'CONFLICT' then 'PENDING_REVIEW'
              else 'PROVIDER' end,
       classification_usage_status =
         case when insurance_type_review_status = 'CONFLICT' then 'BLOCKED'
              else 'ACTIVE' end,
       updated_at = now(), updated_by = 'migration_073'
 where classification_usage_status is null;

-- ---------------------------------------------------------------------------
-- VERIFY
--
--   select record_report_scope, scope_review_status, count(*)
--     from fa_insurance_report_scope group by 1, 2 order by 1, 2;
--   -- after the rerun with --persist-scope, expect no row that is both
--   -- UNDETERMINED and VERIFIED (the check constraint forbids it)
--
--   select count(*) from fa_insurance_scope_policy;
--   -- expect 0 until BA supplies a disclosure. Zero is correct, not missing.
--
--   select classification_source_status, classification_usage_status, count(*)
--     from fa_insurance_classification
--    where insurance_type_effective_to is null group by 1, 2;
--   -- expect BA_VERIFIED/ACTIVE 2 (PVI, BVH) and PROVIDER/ACTIVE 12
--
--   select symbol, insurance_type, classification_usage_status
--     from fa_insurance_classification
--    where classification_usage_status = 'BLOCKED';
--   -- expect 0 rows: no insurer's type is contested today
