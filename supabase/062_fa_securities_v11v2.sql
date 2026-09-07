-- 062 — CTCK V11v2: the official / provisional tier split.
--
-- V11v2 (sheet 44) redefines what the OFFICIAL score is made of. Until now
-- `final_fa_score` was the whole normalized score of a group-A broker, which
-- worked only because the criteria whose methods were not yet validated —
-- C9, C18, C20 — happened to be N/A anyway and so could not reach it.
--
-- V11v2 scores them. C9 gets a risk-asset proxy, C18 a sensitivity model and
-- C20 a cross-sectional P/B~ROE fit, and each is deliberately PROVISIONAL:
-- measured, but on a method that has not passed its G2 validation. So the
-- thing that used to keep them out of the Pro composite (absence) is gone, and
-- something explicit has to replace it.
--
-- THE RULE: a provisional criterion leaves BOTH the numerator and the
-- denominator of the official score. Dropping it from the numerator alone
-- would score it as a measured zero, which is precisely the confusion
-- normalization exists to prevent — a broker whose capital adequacy we cannot
-- yet validate has not scored 0 on capital adequacy.
--
-- Two parallel sets of totals therefore exist per row:
--   final_*        — locked criteria only. Feeds nothing yet (the sector gate
--                    is still closed) but is what will feed the Pro composite.
--   provisional_*  — locked + provisional. Always populated, always displayed
--                    with a `*`, never sent to Pro.
--
-- Migration 061's constraint (`final_fa_score is null or data_group = 'A'`) is
-- kept and still holds: the scorer requires group A *and* final coverage >= 70%.
-- Migration 059's `cycle_sensitivity_no_score_before_locked` is deliberately
-- NOT touched (V11v2 AT13) — C18 writes provisional fields, so the constraint
-- that keeps an unlocked mapping out of production scores stays exactly as it
-- was.

alter table fa_securities_scores
  add column if not exists final_earned              numeric,
  add column if not exists final_available_max       numeric,
  add column if not exists final_coverage            numeric,
  add column if not exists provisional_earned        numeric,
  add column if not exists provisional_available_max numeric,
  add column if not exists provisional_coverage      numeric,
  add column if not exists provisional_fa_score      numeric,
  add column if not exists model_status              text
    default 'SECTOR_MODEL_PENDING';

-- SECTOR_MODEL_PENDING blocks the Pro composite; READY is set only once a row
-- clears group A and the 70% locked-coverage gate. The sector as a whole still
-- needs C18-G2 and C20-G2 to pass before any READY row is consumed.
--
-- ADD COLUMN ... DEFAULT fills every existing row, so all 30,240 historical
-- rows read SECTOR_MODEL_PENDING and satisfy the check below — which is also
-- correct on the merits: nothing is READY until the sector gate opens. The
-- UPDATE only matters if the column already exists carrying nulls (a partially
-- applied earlier attempt); writing a null to its own documented default is
-- not an edit to any score.
update fa_securities_scores
   set model_status = 'SECTOR_MODEL_PENDING'
 where model_status is null;

alter table fa_securities_scores
  drop constraint if exists fa_securities_scores_model_status_check;
alter table fa_securities_scores
  add constraint fa_securities_scores_model_status_check
  check (model_status in ('SECTOR_MODEL_PENDING', 'READY'));

-- An official score must never exist without the locked totals that produced
-- it. This is the V11v2 analogue of 061's constraint: there, a number could not
-- exist without group A; here, it cannot exist without an auditable numerator
-- and denominator. A convention is what let the first version through.
--
-- NOT VALID, AND THAT IS THE POINT — it is not a way of dodging a failure.
-- The tier split does not exist before V11v2: under V8/V9/V10 every scored
-- criterion was, by construction, part of the published score, so the totals
-- behind an official number were `earned_score` / `available_max` and the
-- invariant genuinely held under those versions' own definitions. The columns
-- simply did not exist to record it. **5,337 CTCK_V10 rows carry a
-- final_fa_score** (V8 and V9 carry none), and a plain CHECK rejects all of
-- them at creation time.
--
-- The alternative was back-filling those 5,337 rows with
-- final_earned = earned_score. That would be arithmetically TRUE — verified
-- 2026-09-08, the V11v2 locked-only score reproduces V10's final_fa_score
-- exactly on all 42 brokers, VCK 65.71 both ways — but it would edit stored
-- history, and this table's whole purpose is that every model_version is kept
-- verbatim so a backtest can be replayed. "V8 and V9 rows are preserved
-- untouched" has to keep meaning that.
--
-- NOT VALID enforces the invariant on every INSERT and UPDATE from here on,
-- which is where it is needed, and leaves the historical rows exactly as the
-- version that wrote them left them. Do NOT run VALIDATE CONSTRAINT on this
-- unless those rows have been deliberately migrated first.
alter table fa_securities_scores
  drop constraint if exists fa_securities_scores_final_needs_locked;
alter table fa_securities_scores
  add constraint fa_securities_scores_final_needs_locked
  check (final_fa_score is null
         or (final_earned is not null and final_available_max > 0))
  not valid;

comment on column fa_securities_scores.final_earned is
  'Points earned on LOCKED criteria only (V11v2 sheet 44). Provisional '
  'criteria are excluded from both this and final_available_max.';
comment on column fa_securities_scores.final_available_max is
  'Denominator of the official score: the design weight of the locked '
  'criteria that were actually measurable for this symbol on this date.';
comment on column fa_securities_scores.final_coverage is
  'final_available_max / 100. Gated at >= 0.70 for final_fa_score to exist. '
  'With C4/C5/C9 unavailable the locked set is C1-C3,C6-C8,C10-C14 (39) + '
  'C15-C17 (23) + C19 (8) = exactly 70, so the gate currently passes with ZERO '
  'margin: measured 2026-09-07, all 23 publishable brokers sit at exactly 70 '
  'and none above. BA''s quarterly market-share upload (C4, 4 points) is the '
  'only input that creates any margin.';
comment on column fa_securities_scores.provisional_fa_score is
  'Normalized over locked + provisional criteria. ALWAYS displayed with a "*" '
  'and never sent to the Pro composite.';
comment on column fa_securities_scores.model_status is
  'SECTOR_MODEL_PENDING until this row clears group A and the 70% locked-'
  'coverage gate. Also the flag that keeps CTCK out of Tín hiệu Pro while '
  'C18-G2 and C20-G2 are still open (V11v2 sheet 52).';

-- Verification (expect: every row has both tiers; no official score without
-- its locked totals; nothing READY while the sector gate is closed).
--   select model_version, model_status, count(*),
--          min(final_available_max), max(final_available_max)
--     from fa_securities_scores
--    where as_of_date = (select max(as_of_date) from fa_securities_scores)
--    group by 1, 2 order by 1, 2;
--
--   select count(*) from fa_securities_scores
--    where final_fa_score is not null
--      and (final_earned is null or final_available_max is null);   -- expect 0
