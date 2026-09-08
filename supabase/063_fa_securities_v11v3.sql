-- 063 — CTCK V11v3: the publish gate, and C18's provisional record.
--
-- V11v2 gated publication on `final_coverage >= 70%`. That number was exactly
-- the locked ceiling — C1-C3,C6-C8,C10-C14 (39) + C15-C17 (23) + C19 (8) = 70
-- — so every publishable broker sat precisely on the line: measured
-- 2026-09-07, all 23 had final_available_max = 70 and not one was above it.
-- A single locked criterion losing its source would have dropped the entire
-- sector's official scores in the same run.
--
-- V11v3 replaces it with FOUR conditions evaluated together (sheet 44):
--
--     final_available_max        >= 65
--     quality_locked_available   >= 34
--     sector_cycle_available      = 23
--     valuation_locked_available >= 8
--
-- The total falls to 65 so a broker can lose up to 5 quality points and keep
-- publishing, while the per-block floors stop that slack being spent on the
-- valuation half — which is the part V10 established must never be traded
-- away. Verified: the same 23 brokers pass, zero symbols change, and a broker
-- losing C13 (2 pts) or C11 (3 pts) now survives where it previously did not.
--
-- The block columns are stored rather than recomputed because the gate has to
-- be auditable after the fact: "why did this symbol stop publishing" is a
-- question about a past session, and `criteria` alone would require replaying
-- the tier rules to answer it.
--
-- C18 also becomes scoreable in this release, by two methods routed on how
-- much comparable history a broker has (>=12 quarterly pairs regress; 8-11
-- fall to an exposure proxy; below 8 is N/A). It stays PROVISIONAL until
-- C18-G2 passes, so its points reach `provisional_fa_score` and never
-- `final_fa_score`. Migration 059's `cycle_sensitivity_no_score_before_locked`
-- is deliberately NOT touched (AT13) — that constraint governs the separate
-- `cycle_sensitivity` table's production score, and nothing here writes it.

alter table fa_securities_scores
  add column if not exists publish_gate               text,
  add column if not exists publish_gate_reason        text,
  add column if not exists quality_locked_available   numeric,
  add column if not exists sector_cycle_available     numeric,
  add column if not exists valuation_locked_available numeric,
  add column if not exists c18_provisional_score      numeric,
  add column if not exists c18_method                 text,
  add column if not exists c18_confidence             text;

alter table fa_securities_scores
  drop constraint if exists fa_securities_scores_publish_gate_check;
alter table fa_securities_scores
  add constraint fa_securities_scores_publish_gate_check
  check (publish_gate is null or publish_gate in ('PASS', 'FAIL'));

-- An official score exists only where the gate passed. Like 062's constraint
-- this is NOT VALID: rows written before V11v3 have no `publish_gate` at all,
-- and back-filling one would mean asserting a V11v3 verdict over a session
-- scored under different rules. It enforces on every write from here on.
alter table fa_securities_scores
  drop constraint if exists fa_securities_scores_final_needs_gate;
alter table fa_securities_scores
  add constraint fa_securities_scores_final_needs_gate
  check (final_fa_score is null or publish_gate = 'PASS')
  not valid;

comment on column fa_securities_scores.publish_gate is
  'PASS only when all four V11v3 conditions hold together: final_available_max '
  '>= 65, quality_locked_available >= 34, sector_cycle_available = 23, '
  'valuation_locked_available >= 8. The frontend renders this and never '
  'recomputes it (sheet 52).';
comment on column fa_securities_scores.sector_cycle_available is
  'C15-C17 available to this symbol. Tested for EQUALITY with 23, not a floor: '
  'these are market-wide, so every broker carries the same value on the same '
  'session and anything else means the market series failed to compute — a '
  'sector-wide stop, not a per-symbol one.';
comment on column fa_securities_scores.valuation_locked_available is
  'LOCKED valuation availability, i.e. C19 today. Deliberately not '
  '"C19 or C20": C20 carries provisional points from V11v2 onward, so a test '
  'that accepted it would let a broker with no core P/E clear the valuation '
  'condition on a method that has not passed its own gate.';
comment on column fa_securities_scores.c18_provisional_score is
  'C18 points, always provisional until C18-G2 passes. Recorded separately '
  'from the criteria grid so AT13 can assert that nothing promoted it into '
  'final_fa_score. Migration 059 is untouched.';
comment on column fa_securities_scores.c18_method is
  'HISTORICAL_SENSITIVITY (>= 12 quarterly pairs) or EXPOSURE_PROXY (8-11). '
  'Both are ranked in ONE sector pool — splitting it would make a percentile '
  'mean something different from its neighbour in the same column — so the '
  'method is recorded in confidence, not in the ranking.';

-- Verification (expect: no official score without a passing gate; the cycle
-- block identical across every symbol in a session).
--   select publish_gate, count(*), min(final_available_max), max(final_available_max)
--     from fa_securities_scores
--    where model_version = 'CTCK_V11v3'
--      and as_of_date = (select max(as_of_date) from fa_securities_scores
--                         where model_version = 'CTCK_V11v3')
--    group by 1;
--
--   select count(*) from fa_securities_scores
--    where final_fa_score is not null and publish_gate <> 'PASS';   -- expect 0
--
--   select as_of_date, count(distinct sector_cycle_available)
--     from fa_securities_scores where model_version = 'CTCK_V11v3'
--    group by 1 having count(distinct sector_cycle_available) > 1;  -- expect 0 rows
