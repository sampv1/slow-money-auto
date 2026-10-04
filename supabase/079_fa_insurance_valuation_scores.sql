-- Migration 079: the Holding valuation layer — P/B against each company's OWN
-- 20-quarter median, worth 12 points.
--
-- BA `FINAL_BA_SPEC_HOLDING_VALUATION_HOLDING_UI_TOAN_NGANH_UI_2026-10-04.md`
-- Phần I, §6.
--
-- WHY ITS OWN TABLE ---------------------------------------------------------
-- §6 lists thirteen fields the row must persist, and most of them are the
-- WORKING rather than the result: `current_pb`, `median_pb_20q`, `n_valid`,
-- `as_of_date`, the window the median was taken over. `fa_insurance_tab_scores`
-- stores the assembled blocks and has nowhere for them; folding them into its
-- `criteria` jsonb would make them unqueryable, and the one question this layer
-- will actually be asked — "why did BVH's valuation score move this quarter?" —
-- is answered by comparing the median and the current price, not the points.
--
-- TWENTY OBSERVATIONS IS A HARD FLOOR, NOT A TARGET (§3.3) -------------------
-- BA forbids falling back to 8, 12 or 16 quarters, interpolating, or
-- zero-filling. `n_valid` is therefore stored on every row INCLUDING the
-- unscored ones, so "this company has seventeen quarters" is a fact in the
-- table rather than something a reader has to re-derive. The check constraint
-- below makes the rule unwritable rather than merely documented: a score may
-- exist only on a row that reached twenty.
--
-- NOT_SCORED IS NOT ZERO, AND THE TWO ABSENCES ARE DIFFERENT ----------------
-- `NOT_SCORED` means too little history; `NOT_SCORED_PENDING_REVIEW` means the
-- P/B series itself is broken (§3.4 — a non-positive current or median). Both
-- carry NO score, because 0/12 is a real verdict meaning "expensive against its
-- own history" and must never stand in for an absence.

create table if not exists fa_insurance_valuation_scores (
  symbol text not null,
  period text not null,                        -- calendar quarter 'YYYY-Qn'

  -- --- the working (§6) ---------------------------------------------------
  -- The snapshot date the current P/B was read at. SEPARATE from `period`
  -- because a quarter is a label and a snapshot is a moment; conflating them is
  -- what makes a look-ahead invisible.
  as_of_date date,
  current_pb      numeric(12,6),
  median_pb_20q   numeric(12,6),
  relative_pb     numeric(12,6),
  n_valid         integer not null default 0,
  -- The window the median was taken over, so the arithmetic is auditable from
  -- the row alone without re-reading the P/B series.
  window_first    text,
  window_last     text,

  -- --- the result ---------------------------------------------------------
  valuation_score  numeric(6,2) check (valuation_score between 0 and 12),
  valuation_weight smallint not null default 12 check (valuation_weight = 12),
  band_label text,

  data_status text not null
    check (data_status in ('OK', 'NOT_SCORED', 'NOT_SCORED_PENDING_REVIEW')),

  -- --- versions (§6) ------------------------------------------------------
  formula_version   text not null,
  threshold_version text not null,
  mapping_version   text not null,
  calculated_at timestamptz not null default now(),

  -- A score exists exactly when the row is OK. A constraint rather than a
  -- convention, because a convention is what let a partial securities score
  -- reach the composite once already.
  constraint insurance_valuation_score_only_when_ok
    check ((data_status = 'OK') = (valuation_score is not null)),
  -- §3.3 — twenty observations or no score. No 8/12/16-quarter fallback.
  constraint insurance_valuation_needs_twenty_quarters
    check (valuation_score is null or n_valid = 20),
  -- The stored relative must equal the two figures it claims to divide.
  constraint insurance_valuation_relative_reconciles
    check (relative_pb is null or median_pb_20q is null or current_pb is null
           or abs(relative_pb - current_pb / median_pb_20q) < 0.000001),

  primary key (symbol, period, formula_version, threshold_version)
);

comment on table fa_insurance_valuation_scores is
  'Valuation /12 from P/B against the symbol''s OWN 20-quarter median. '
  'Self-relative by design (BA §1): an absolute P/B cannot rank two insurers '
  'with different business models against each other.';
comment on column fa_insurance_valuation_scores.n_valid is
  'Usable quarterly P/B snapshots at or before `period`. Production requires '
  'exactly 20 (BA §3.3); fewer is NOT_SCORED, never a reduced window.';
comment on column fa_insurance_valuation_scores.as_of_date is
  'The snapshot the current P/B was read at. Separate from `period` so a '
  'look-ahead is visible rather than hidden behind a quarter label (§3.1).';

alter table fa_insurance_valuation_scores enable row level security;
drop policy if exists "fa_insurance_valuation_scores read" on fa_insurance_valuation_scores;
create policy "fa_insurance_valuation_scores read" on fa_insurance_valuation_scores
  for select using (true);

create index if not exists fa_insurance_valuation_period_idx
  on fa_insurance_valuation_scores (period, symbol);

-- ---------------------------------------------------------------------------
-- VERIFY
--
-- 1. Every scored row reached twenty observations. Expect ZERO rows:
--
--   select symbol, period, n_valid, valuation_score
--     from fa_insurance_valuation_scores
--    where valuation_score is not null and n_valid <> 20;
--
-- 2. The relative reconciles against its two inputs. Expect ZERO rows:
--
--   select symbol, period, current_pb, median_pb_20q, relative_pb
--     from fa_insurance_valuation_scores
--    where relative_pb is not null
--      and abs(relative_pb - current_pb / median_pb_20q) >= 0.000001;
--
-- 3. The score matches BA's §4 table, re-derived in SQL. Expect ZERO rows:
--
--   select symbol, period, relative_pb, valuation_score from fa_insurance_valuation_scores
--    where valuation_score is not null and valuation_score <> case
--      when relative_pb <= 0.70 then 12 when relative_pb <= 0.85 then 10
--      when relative_pb <= 1.00 then  8 when relative_pb <= 1.15 then  6
--      when relative_pb <= 1.30 then  3 else 0 end;
--
-- 4. No absence became a zero. Expect ZERO rows:
--
--   select * from fa_insurance_valuation_scores
--    where data_status <> 'OK' and valuation_score is not null;
--
-- 5. The window never reaches past its own period — the look-ahead test.
--    Expect ZERO rows:
--
--   select symbol, period, window_last from fa_insurance_valuation_scores
--    where window_last > period;
