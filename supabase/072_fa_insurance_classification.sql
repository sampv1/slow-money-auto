-- Migration 072: insurance classification and report-scope governance.
--
-- WHY -----------------------------------------------------------------------
-- Two decisions have been living in Python constants, and both are business
-- decisions rather than code:
--
--   1. PVI and BVH are Holding/Hỗn hợp. ICB L4 files PVI under 8536, the same
--      code as the nine non-life insurers, so no provider field separates them
--      — the distinction exists only because BA ruled on it. A ruling with no
--      effective date and no history cannot be audited, and the next
--      reclassification would silently overwrite it.
--   2. Which report scope the pipeline used, and whether that choice was
--      verified. The first non-life run hard-coded "Hợp nhất" for every row;
--      the filing header says six of nine file SEPARATE statements. Reading the
--      header fixed the value, but it did not establish whether a consolidated
--      report EXISTS for those six and is merely unserved — and that is the
--      question that decides whether their P1-P4 are comparable with the other
--      three.
--
-- Both tables are HISTORICAL, keyed with an effective date, because "what was
-- this symbol classified as when that quarter was scored" is a question a
-- backtest has to answer. An overwrite would make the old scores unexplainable.

-- ---------------------------------------------------------------------------
-- 1. Classification, with history
-- ---------------------------------------------------------------------------
create table if not exists fa_insurance_classification (
  symbol text not null,
  insurance_type text not null
    check (insurance_type in ('Phi nhân thọ', 'Tái bảo hiểm',
                              'Holding/Hỗn hợp', 'Nhân thọ')),
  -- Where the classification came from. A provider code and a BA ruling are
  -- different kinds of fact and must not be stored identically: one can be
  -- refreshed from the source, the other cannot.
  insurance_type_source text not null
    check (insurance_type_source in ('ICB', 'BA_DECISION', 'PROVIDER_TYPE')),
  insurance_type_effective_from date not null,
  -- NULL means "still in force". A superseded row keeps its end date rather
  -- than being deleted, so a historical score stays explainable.
  insurance_type_effective_to date,
  insurance_type_review_status text not null default 'PENDING'
    check (insurance_type_review_status in ('VERIFIED', 'PENDING', 'CONFLICT')),
  classification_note text,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'pipeline',

  primary key (symbol, insurance_type_effective_from)
);

comment on table fa_insurance_classification is
  'Which insurance model a symbol is scored as, with effective dates. Read by '
  'the scoring scripts; never hard-coded. A reclassification CLOSES the old row '
  'with an effective_to and inserts a new one, so a historical score can always '
  'be explained by the classification in force when it was computed.';

alter table fa_insurance_classification enable row level security;
drop policy if exists "fa_insurance_classification read" on fa_insurance_classification;
create policy "fa_insurance_classification read" on fa_insurance_classification
  for select using (true);

create index if not exists fa_insurance_classification_active_idx
  on fa_insurance_classification (symbol, insurance_type_effective_to);

-- Seed from ICB L4 for every insurer, then apply BA's two rulings on top.
-- 8536 non-life · 8538 reinsurance · anything else full-line/holding.
insert into fa_insurance_classification
  (symbol, insurance_type, insurance_type_source, insurance_type_effective_from,
   insurance_type_review_status, classification_note, updated_by)
select p.symbol,
       case p.icb_l4
         when '8536' then 'Phi nhân thọ'
         when '8538' then 'Tái bảo hiểm'
         else 'Holding/Hỗn hợp'
       end,
       'ICB', date '2026-09-26', 'PENDING',
       'Seeded from symbol_profile.icb_l4 = ' || coalesce(p.icb_l4, 'NULL'),
       'migration_072'
  from symbol_profile p
 where p.com_type_code = 'BH'
on conflict (symbol, insurance_type_effective_from) do nothing;

-- BA's rulings. PVI carries 8536 and BVH 8575; both file as holdings, which no
-- provider field expresses. VERIFIED because a named decision exists.
update fa_insurance_classification
   set insurance_type = 'Holding/Hỗn hợp',
       insurance_type_source = 'BA_DECISION',
       insurance_type_review_status = 'VERIFIED',
       classification_note = 'BA ruling: files as a holding; ICB L4 does not '
                             'separate it from the non-life insurers',
       updated_at = now(), updated_by = 'migration_072'
 where symbol in ('PVI', 'BVH')
   and insurance_type_effective_to is null;

-- ---------------------------------------------------------------------------
-- 2. Report-scope verification, per symbol-period
-- ---------------------------------------------------------------------------
create table if not exists fa_insurance_report_scope (
  symbol text not null,
  period text not null,                       -- 'YYYY-Qn'

  -- NULL is a real and common state here: it means "we do not know whether one
  -- exists", which is different from False ("verified that none exists"). The
  -- distinction is the whole point of the table — a boolean alone would force a
  -- guess, and a guess is what BA rejected.
  consolidated_report_available boolean,
  standalone_report_available boolean,

  selected_report_scope text not null
    check (selected_report_scope in ('CONSOLIDATED', 'STANDALONE')),
  scope_selection_reason text not null
    check (scope_selection_reason in (
      'CONSOLIDATED_AVAILABLE_AND_SELECTED',
      'NO_CONSOLIDATED_REPORT_STANDALONE_SELECTED',
      'CONSOLIDATED_MISSING_FROM_PROVIDER',
      'SCOPE_CONFLICT_REQUIRES_REVIEW',
      'NOT_YET_VERIFIED')),
  scope_verification_source text,
  scope_verified_date date,
  scope_review_status text not null default 'PENDING'
    check (scope_review_status in ('VERIFIED', 'PENDING', 'CONFLICT')),
  scope_note text,
  updated_at timestamptz not null default now(),

  primary key (symbol, period)
);

comment on table fa_insurance_report_scope is
  'Which report scope the pipeline used for a symbol-quarter and whether that '
  'choice was verified. `consolidated_report_available` is NULLABLE on purpose: '
  'NULL means unknown, FALSE means verified absent, and collapsing the two '
  'would turn an open question into a claim.';

comment on column fa_insurance_report_scope.scope_review_status is
  'VERIFIED only when the existence of the consolidated report was actually '
  'checked. A zero minority interest is consistent with a standalone filing but '
  'does not prove one, so it may not be used as the sole evidence.';

alter table fa_insurance_report_scope enable row level security;
drop policy if exists "fa_insurance_report_scope read" on fa_insurance_report_scope;
create policy "fa_insurance_report_scope read" on fa_insurance_report_scope
  for select using (true);

-- ---------------------------------------------------------------------------
-- VERIFY
--
--   select insurance_type, count(*) from fa_insurance_classification
--    where insurance_type_effective_to is null group by 1;
--   -- expect: Phi nhân thọ 10 (incl. IFA), Tái bảo hiểm 2, Holding/Hỗn hợp 2
--
--   select symbol, insurance_type, insurance_type_source
--     from fa_insurance_classification
--    where insurance_type_source = 'BA_DECISION';
--   -- expect exactly PVI and BVH
--
--   select scope_review_status, count(*) from fa_insurance_report_scope group by 1;
