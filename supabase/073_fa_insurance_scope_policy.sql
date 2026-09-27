-- Migration 073: report-scope selection per symbol-quarter (BA §4), the
-- loss-of-control events it depends on, and explicit classification semantics.
--
-- SUPERSEDES THE FIRST DRAFT OF THIS FILE, which was never applied — the
-- `fa_insurance_scope_policy` table it created does not exist in any database,
-- so this is a revision rather than an edit to applied history. BA's
-- PHAN_HOI_CUOI §9.2 item 1 asks for exactly this ("sửa logic phạm vi trong
-- migration/chương trình theo Mục 4").
--
-- WHAT CHANGED, AND WHY IT MATTERS -------------------------------------------
-- The draft was built around a question BA has now withdrawn: "does a
-- consolidated report EXIST for this company?" That question needed a manual,
-- company-level disclosure nobody had, so six of nine insurers were blocked and
-- only 3/9 could be scored.
--
-- §4 replaces it with a question the data can answer, per symbol-quarter:
-- DID THE REPORTING BASIS CHANGE? That is a comparison, not an existence
-- proof, and §4.7 is explicit that the six may not stay blocked for want of the
-- old confirmation. The flow:
--
--   provider says Hợp nhất            -> use it, no further check        (§4.2)
--   provider says Riêng lẻ, prior also Riêng lẻ
--                                     -> use it; this is the company's
--                                        continuous basis            (§4.3 A)
--   provider says Riêng lẻ, prior was Hợp nhất
--                                     -> do NOT score the new quarter; hold the
--                                        last completed consolidated score and
--                                        wait, UNLESS a verified loss of control
--                                        before the quarter start with no
--                                        remaining subsidiaries      (§4.3 B, §4.5)
--
-- So the columns change from "is there a consolidated report" to "what did the
-- provider record, what did we select, what was the prior basis, and did a
-- control event justify a change".

-- ---------------------------------------------------------------------------
-- 1. Report scope, per symbol-quarter — the §4.6 field set
-- ---------------------------------------------------------------------------
-- CLEAR THE OLD ROWS FIRST, and this is not housekeeping — it is what makes the
-- rest of this file apply at all.
--
-- The table holds 36 rows written under the scope model BA has replaced. Adding
-- `scope_decision_rule` leaves them NULL, and the NOT-NULL check below is then
-- violated by every one of them, so the statement fails and the SQL editor's
-- transaction rolls the WHOLE migration back. That is exactly what happened on
-- the first attempt: PostgREST's schema cache still reported 072's 11 columns
-- afterwards, with nothing from this file applied.
--
-- Deleting them is also what BA asked for independently (§8): "Số lượng bản ghi
-- phạm vi phải được tính lại sau khi áp dụng quy tắc mới. Không giữ nguyên các
-- trạng thái cũ chỉ vì chúng đã xuất hiện trong file kiểm tra trước." The rows
-- carry `scope_review_status = PENDING` from the withdrawn "does a consolidated
-- report exist" question, so keeping them would preserve verdicts the new rule
-- does not produce. The scorer rewrites every row it needs.
delete from fa_insurance_report_scope;

alter table fa_insurance_report_scope
  -- What the provider RECORDS for this period (§4.1). Never skipped, and never
  -- inferred: 'CONSOLIDATED' / 'STANDALONE' come from the filing header's
  -- `United` field, 'CONSOLIDATED_BY_MINORITY_INTEREST' from the balance sheet
  -- (see the note on evidence below), 'UNDETERMINED' when neither speaks.
  add column if not exists provider_report_type text,
  -- What the system SELECTED, which is not always what the provider recorded —
  -- §4.3 case B selects nothing and waits.
  add column if not exists selected_report_type text,
  -- The basis of the most recent COMPLETED period, which is what case A and
  -- case B are distinguished by.
  add column if not exists prior_period_scope text,
  add column if not exists prior_period text,
  -- §4.4 / §4.5. NULL means "not examined", FALSE means "examined, none found".
  -- The distinction is the same one `consolidated_report_available` carries and
  -- for the same reason: a guess is what BA rejected.
  add column if not exists loss_of_control_event boolean,
  add column if not exists event_effective_date date,
  add column if not exists has_remaining_subsidiaries boolean,
  -- §4.6: how the decision was reached, so it can be re-examined without being
  -- re-derived.
  add column if not exists scope_decision_rule text,
  add column if not exists scope_verification_method text,
  add column if not exists checked_date date,
  -- USED vs WAITING_FOR_CONSOLIDATED — §4.3 case B's outcome has to be a stored
  -- state, because the dashboard must show which period a held score came from.
  add column if not exists usage_status text,
  -- Which criteria read this symbol-period. A source period is in this table
  -- BECAUSE a formula reads it; recording which makes "every source period was
  -- checked" auditable instead of asserted.
  add column if not exists used_by_metrics text;

alter table fa_insurance_report_scope
  drop constraint if exists fa_ins_scope_provider_type_check;
alter table fa_insurance_report_scope
  add constraint fa_ins_scope_provider_type_check
  check (provider_report_type is null or provider_report_type in (
    'CONSOLIDATED',                      -- filing header: United = 'HN'
    'STANDALONE',                        -- filing header: United = 'ĐL'
    'CONSOLIDATED_BY_MINORITY_INTEREST', -- see the evidence note below
    'UNDETERMINED'));

alter table fa_insurance_report_scope
  drop constraint if exists fa_ins_scope_selected_type_check;
alter table fa_insurance_report_scope
  add constraint fa_ins_scope_selected_type_check
  check (selected_report_type is null or selected_report_type in (
    'CONSOLIDATED', 'STANDALONE', 'NONE_WAITING_CONSOLIDATED'));

alter table fa_insurance_report_scope
  drop constraint if exists fa_ins_scope_usage_status_check;
alter table fa_insurance_report_scope
  add constraint fa_ins_scope_usage_status_check
  check (usage_status is null or usage_status in (
    'USED', 'WAITING_FOR_CONSOLIDATED', 'BLOCKED_UNDETERMINED'));

-- A selected scope of NONE_WAITING_CONSOLIDATED and a usage_status of USED are
-- contradictory. Enforced rather than left to the writer, because the writer is
-- what got this wrong the first time.
alter table fa_insurance_report_scope
  drop constraint if exists fa_ins_scope_waiting_is_not_used;
alter table fa_insurance_report_scope
  add constraint fa_ins_scope_waiting_is_not_used
  check (not (selected_report_type = 'NONE_WAITING_CONSOLIDATED'
              and usage_status = 'USED'));

-- BA §2.4's status vocabulary. A THIRD axis, deliberately separate from
-- provider_report_type (what the source recorded) and selected_report_type
-- (what we chose): this one records HOW STRONG THE EVIDENCE IS, and BA's §2.3
-- is emphatic that the two must not be conflated. `PARENT_VERIFIED` requires a
-- DIRECT source label and may never be assigned because the minority interest
-- happens to be zero — a consolidated report of a wholly-owned parent reads zero
-- too. Periods outside the 4 quarters the header labels are
-- SCOPE_AS_PROVIDED_CONTINUOUS: an operational state, not a verified one.
alter table fa_insurance_report_scope
  add column if not exists scope_status text;

alter table fa_insurance_report_scope
  drop constraint if exists fa_ins_scope_status_check;
alter table fa_insurance_report_scope
  add constraint fa_ins_scope_status_check
  check (scope_status in (
    'CONSOLIDATED_VERIFIED',        -- source label, or minority interest > 0
    'PARENT_VERIFIED',              -- DIRECT source label only
    'SCOPE_AS_PROVIDED_BASELINE',   -- first period of the series (§2.5)
    'SCOPE_AS_PROVIDED_CONTINUOUS', -- used continuously, no change signal (§2.3)
    'WAITING_CONSOLIDATED',         -- current standalone, prior consolidated
    'SCOPE_CHANGE_VERIFIED'));      -- verified loss of control (§2.6)

comment on column fa_insurance_report_scope.scope_status is
  'BA §2.4 — the EVIDENCE GRADE of the scope decision, not the decision itself. '
  'PARENT_VERIFIED needs a direct source label; BS_MINORITY_INTEREST = 0 must '
  'never produce it (§2.3), because a consolidated report of a wholly-owned '
  'parent also reads zero. Older periods the header does not label are '
  'SCOPE_AS_PROVIDED_CONTINUOUS, which states an operational continuity rather '
  'than a verification.';

-- Every written row names the rule that decided it. §4.6 asks for the decision
-- to be stored, and a decision with no rule attached cannot be reviewed. Safe
-- to require now: the delete above left the table empty, so there is no
-- pre-existing row to violate it — which is the mistake that rolled this
-- migration back the first time.
alter table fa_insurance_report_scope
  drop constraint if exists fa_ins_scope_decision_rule_required;
alter table fa_insurance_report_scope
  add constraint fa_ins_scope_decision_rule_required
  check (scope_decision_rule is not null);

alter table fa_insurance_report_scope
  drop constraint if exists fa_ins_scope_status_required;
alter table fa_insurance_report_scope
  add constraint fa_ins_scope_status_required
  check (scope_status is not null);

comment on column fa_insurance_report_scope.provider_report_type is
  'What the PROVIDER records for this period (§4.1), never inferred. The filing '
  'header (`United`) is authoritative but reaches only the latest 4 quarters — '
  'measured: KBS returns 4 distinct quarters whatever page_size is asked for. '
  'Beyond that the one admissible signal is BS_MINORITY_INTEREST > 0, which '
  'POSITIVELY identifies a consolidated record (the balance sheet consolidates a '
  'partly-owned subsidiary) and agrees with the header on 36 of 36 periods where '
  'both exist. A ZERO minority interest is consistent with BOTH scopes and is '
  'never used — that asymmetry is why one direction is evidence and the other '
  'is not.';

comment on column fa_insurance_report_scope.usage_status is
  'WAITING_FOR_CONSOLIDATED is §4.3 case B: the provider has served a standalone '
  'report where the prior period was consolidated, which usually means the '
  'standalone was simply published first. The new quarter is NOT scored and the '
  'last completed consolidated score is held — holding a score is not the same '
  'as copying its figures into the new period (§4.3).';

-- ---------------------------------------------------------------------------
-- 2. Loss-of-control events (§4.4, §4.5)
-- ---------------------------------------------------------------------------
-- The ONLY thing that licenses switching from consolidated to standalone. Its
-- evidence is external by nature — statement notes, a completed-transaction
-- disclosure, a transfer date, the subsidiary list — so this table is populated
-- by hand and is EMPTY until such a disclosure is read. Empty is correct: with
-- no event on file, §4.3 case B holds the previous score and waits, which is
-- the conservative branch.
create table if not exists fa_insurance_control_events (
  symbol text not null,
  -- The date control was actually lost, which §4.5 routes on. NOT the
  -- announcement date and NOT the resolution date: BA is explicit that a plan
  -- or a resolution with the transaction incomplete keeps the company on the
  -- consolidated basis.
  effective_date date not null,
  event_type text not null
    check (event_type in ('SUBSIDIARY_DIVESTED', 'CONTROL_LOST_OTHER')),
  -- FALSE is what allows the switch; TRUE keeps the company consolidated even
  -- after a divestment (§4.5, last row). NULL means not established, which is
  -- treated as "still consolidating" because that is the safe reading.
  has_remaining_subsidiaries boolean,
  -- Required. §4.4 ranks the acceptable evidence and rules out a mere plan;
  -- a row without a source cannot be audited against that ranking.
  evidence_type text not null
    check (evidence_type in ('STATEMENT_NOTES', 'COMPLETION_DISCLOSURE',
                             'TRANSFER_EFFECTIVE_DATE', 'SUBSIDIARY_LIST',
                             'OWNERSHIP_AFTER_TRANSACTION')),
  evidence_source text not null,
  transaction_completed boolean not null default false,
  verified_by text not null,
  verified_date date not null,
  note text,
  updated_at timestamptz not null default now(),

  primary key (symbol, effective_date)
);

comment on table fa_insurance_control_events is
  'Verified loss-of-control events, the only basis for moving a symbol from the '
  'consolidated to the standalone report (§4.4/§4.5). Populated by hand from an '
  'issuer disclosure; EMPTY is the correct initial state, and with no row the '
  'scope resolver takes §4.3 case B and waits for the consolidated report rather '
  'than accepting a standalone one.';

comment on column fa_insurance_control_events.transaction_completed is
  'FALSE for a plan or a resolution. §4.5 keeps such a symbol on the '
  'consolidated basis, so an incomplete transaction must never read as an event '
  'that licenses the switch.';

alter table fa_insurance_control_events enable row level security;
drop policy if exists "fa_insurance_control_events read" on fa_insurance_control_events;
create policy "fa_insurance_control_events read" on fa_insurance_control_events
  for select using (true);

-- ---------------------------------------------------------------------------
-- 3. Classification: PENDING must mean ONE thing (BA §8.2 of the prior round)
-- ---------------------------------------------------------------------------
-- Ten non-life symbols carried insurance_type_review_status = 'PENDING' while
-- being scored, and PVI/BVH carried 'VERIFIED' while being excluded — so
-- PENDING appeared both to block and not to block. Two questions, two columns,
-- and neither is `eligible_for_scoring`, which is about the DATA.
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

comment on column fa_insurance_classification.classification_usage_status is
  'Whether this type may route a symbol to a tab and be scored. An unambiguous '
  'provider code is ACTIVE without manual review — waiting for a human to '
  'confirm what the source already states unambiguously blocks nothing and costs '
  'coverage. Only an unresolved or contested type is BLOCKED. SEPARATE from '
  'eligible_for_scoring, which asks whether the DATA suffices: IFA is ACTIVE as '
  'a non-life insurer and still unscorable.';

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
-- 4. Company-level eligibility gate (§7)
-- ---------------------------------------------------------------------------
-- A criterion can be computable on its own, but a company earns a TOTAL only
-- with all five. §7.3 forbids the alternatives explicitly: no summing P1+P4 and
-- leaving the rest blank, no scoring an incomplete criterion 0, and no
-- normalising four criteria up to 50 points.
create table if not exists fa_insurance_nonlife_eligibility (
  symbol text not null,
  period text not null,
  p1_valid boolean not null,
  p2_valid boolean not null,
  p3_valid boolean not null,
  p4_valid boolean not null,
  p5_valid boolean not null,
  -- The gate. Stored rather than derived at read time so the dashboard and the
  -- scorer cannot disagree about it — two implementations of one rule is what
  -- made the securities tabs contradict each other twice.
  eligible_for_total boolean not null,
  -- Which criteria are missing, by name. §7.4 and §12.3 both forbid a generic
  -- reason; a reader has to be able to act on this without re-running anything.
  blocking_criteria text,
  blocking_reason text,
  run_id text,
  computed_at timestamptz not null default now(),

  primary key (symbol, period)
);

comment on table fa_insurance_nonlife_eligibility is
  'BA §7: a non-life insurer receives a 50-point total only when P1-P5 are ALL '
  'valid for the SAME period. eligible_for_total = false withholds the total; it '
  'never means zero, and the symbol simply does not appear in that period''s '
  'official ranking (§3.2) while keeping its last completed score for Signal Pro.';

alter table fa_insurance_nonlife_eligibility enable row level security;
drop policy if exists "fa_insurance_nonlife_eligibility read" on fa_insurance_nonlife_eligibility;
create policy "fa_insurance_nonlife_eligibility read" on fa_insurance_nonlife_eligibility
  for select using (true);

-- ---------------------------------------------------------------------------
-- VERIFY
--
--   select provider_report_type, selected_report_type, usage_status, count(*)
--     from fa_insurance_report_scope group by 1,2,3 order by 1,2,3;
--   -- after the rerun: no row both NONE_WAITING_CONSOLIDATED and USED
--   -- (the check constraint forbids it), and every row carries a decision rule
--
--   select count(*) from fa_insurance_control_events;
--   -- expect 0. No issuer disclosure has been read, and with no event §4.3
--   -- case B correctly waits rather than switching basis.
--
--   select eligible_for_total, count(*) from fa_insurance_nonlife_eligibility
--    group by 1;
--   -- BA §7.4 targets 9/9 eligible for the latest period
--
--   select classification_source_status, classification_usage_status, count(*)
--     from fa_insurance_classification
--    where insurance_type_effective_to is null group by 1,2;
--   -- expect BA_VERIFIED/ACTIVE 2 (PVI, BVH) and PROVIDER/ACTIVE 12
