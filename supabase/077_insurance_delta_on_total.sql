-- Migration 077: ΔFA moves onto Total /100, and gets its OWN columns.
--
-- BA `YEU_CAU_IT_CHOT_R4_V2_VA_CHUAN_HOA_GIAO_DIEN_BAO_HIEM_2026-10-04.md`
-- §2.2, §2.10 and §2.20.1.
--
-- WHAT CHANGED IN THE SPEC --------------------------------------------------
-- Until now the displayed total was `FA /88 = Common/50 + Internal/38`, with
-- Valuation/12 shown beside it and `Total /100` as the sum. §2.2 collapses
-- that: on the user interface there is ONE score, `Tổng điểm FA /100`, and the
-- string "FA /88" is forbidden outright (§2.20.1). §2.10 follows it through —
-- ΔFA must be the change in that /100 figure, "Không tính Δ trên subtotal /88".
--
-- WHY NEW COLUMNS AND NOT A REDEFINITION OF THE OLD ONES ---------------------
-- `fa_change_pct` carries a COMMENT reading 'ΔFA on FA/88 ONLY. Valuation/12
-- never enters it', and 076 shipped with that comment because at the time it
-- was the rule. Writing a /100 delta into it would leave the audit trail
-- describing a basis the column no longer holds — the same fault as storing an
-- effective date in a column named for a publication date (migration 066). So
-- the /100 delta gets its own three columns and the /88 ones keep their meaning
-- and stop being read by the frontend. §2.2 explicitly permits that: "Backend
-- có thể giữ subtotal nội bộ nếu cần audit, nhưng frontend không hiển thị".
--
-- THE TWO BASES ARE NOT INTERCHANGEABLE, AND THE DIFFERENCE IS NOT COSMETIC.
-- FA/88 needs Common and Internal; Total/100 additionally needs Valuation. So
-- a symbol whose valuation block is absent HAS a ΔFA on /88 and has NONE on
-- /100 — Holding is exactly that case today, since BA has not locked its
-- valuation bands. Under §2.10 that reads `CURRENT_FA_INCOMPLETE`, which is the
-- correct answer and not a regression: there is no /100 score to difference.

alter table fa_insurance_tab_scores
  add column if not exists previous_total_score numeric(6,2),
  add column if not exists total_change_pct numeric(10,4),
  add column if not exists total_change_status text not null default 'NOT_APPLICABLE';

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'insurance_total_change_status_values') then
    alter table fa_insurance_tab_scores
      add constraint insurance_total_change_status_values
      check (total_change_status in ('CALCULATED', 'ZERO_BASE',
                                     'NO_COMPARABLE_PREVIOUS_FA',
                                     'CURRENT_FA_INCOMPLETE', 'NOT_APPLICABLE'));
  end if;
end $$;

-- A percentage exists only where it was CALCULATED, and a CALCULATED row must
-- carry one. Without this, "0% change" and "could not be compared" are both a
-- NULL with a status nobody checks — the distinction §2.10's four outcomes
-- exist to keep.
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'insurance_total_change_pct_matches_status') then
    alter table fa_insurance_tab_scores
      add constraint insurance_total_change_pct_matches_status
      check ((total_change_status = 'CALCULATED') = (total_change_pct is not null));
  end if;
end $$;

comment on column fa_insurance_tab_scores.total_change_pct is
  'ΔFA as the user interface shows it: the change in Total /100 versus the '
  'previous quarter (BA §2.10). NULL unless total_change_status = CALCULATED.';
comment on column fa_insurance_tab_scores.previous_total_score is
  'The previous quarter''s Total /100 that total_change_pct was measured '
  'against, so the arithmetic is auditable from the row alone.';
comment on column fa_insurance_tab_scores.fa_score is
  'INTERNAL AUDIT SUBTOTAL ONLY (Common/50 + Internal/38). BA §2.20.1 forbids '
  'displaying "FA /88" anywhere on the user interface; the displayed score is '
  'total_score /100.';
comment on column fa_insurance_tab_scores.fa_change_pct is
  'SUPERSEDED for display by total_change_pct. Retained as the /88-basis delta '
  'for audit; never rendered (BA §2.10).';

-- ---------------------------------------------------------------------------
-- VERIFY
--
-- 1. The new delta reconciles against the two totals it claims to compare.
--    Expect ZERO rows:
--
--   select symbol, period, total_score, previous_total_score, total_change_pct
--     from fa_insurance_tab_scores
--    where total_change_status = 'CALCULATED'
--      and abs(total_change_pct
--              - (total_score - previous_total_score)
--                / abs(previous_total_score) * 100) > 0.0001;
--
-- 2. No row claims a change it could not compute. Expect ZERO rows:
--
--   select * from fa_insurance_tab_scores
--    where (total_change_pct is not null) <> (total_change_status = 'CALCULATED');
--
-- 3. A row with no Total cannot carry a Total-based change. Expect ZERO rows:
--
--   select * from fa_insurance_tab_scores
--    where total_score is null and total_change_status = 'CALCULATED';
--
-- 4. How many rows gained or lost a comparable delta when the basis moved —
--    informational, run it to see the §2.10 consequence on live data:
--
--   select fa_change_status, total_change_status, count(*)
--     from fa_insurance_tab_scores group by 1, 2 order by 3 desc;
