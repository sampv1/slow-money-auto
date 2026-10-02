-- Migration 074: persist the Holding/Hỗn hợp deep score (/38) for BVH and PVI.
--
-- WHY -----------------------------------------------------------------------
-- BA FINAL SPEC 2026-10-01 §21-§23. The engine (`scripts/fa/holding.py`) has
-- been frozen since Track A closed, but nothing stored its output, so the tab
-- had no data to render and no history to replay. This is that store.
--
-- ONE ROW PER METRIC, NOT PER SYMBOL-QUARTER (§22) ---------------------------
-- BA is explicit: "Phải có khả năng tái lập: component scores + deep total /38.
-- Không lưu chỉ total." A single row carrying four scores would make the total
-- the primary fact and the components an afterthought; keyed per metric, every
-- component carries its own current value, percentile, weight, N and status, so
-- the UI requirement in §24/§25 (name · value · percentile · score · weight ·
-- tooltip) is answerable from the row rather than recomputed in the frontend.
-- That is the same rule `securities_ui` learned the hard way: a second
-- implementation of a display rule is what made two tabs disagree twice.
--
-- `deep_total` is repeated on all four rows of a symbol-quarter deliberately.
-- It is the UNROUNDED sum (summing rounded components drifts; measured at
-- 20.4544 vs 20.5000 on BVH), and repeating it means a reader never has to
-- re-add components that the engine already summed.
--
-- THE KEY CARRIES THE VERSION, as in 071 and fa_securities_scores -----------
-- `(symbol, period, metric_code, scoring_version)`. A re-score under a new
-- version inserts BESIDE the old rows instead of overwriting them, which is
-- what makes a replay possible, and makes "no quarter mixes versions" a query
-- rather than a promise the writer makes about itself.
--
-- THE DEEP SCORE IS NOT COMPARABLE BETWEEN THE TWO TICKERS (§1.2) -----------
-- `engine_profile` is stored so the constraint is visible in the data: BVH is
-- scored on LIFE_LED_HOLDING, PVI on NONLIFE_REINSURANCE_HOLDING, and
-- `DEEP_SCORE_CROSS_TICKER_COMPARISON = NOT_ALLOWED`. A query that ranks the
-- two tickers by `deep_total` is wrong however reasonable it looks.

create table if not exists fa_insurance_deep_scores (
  symbol text not null check (symbol in ('BVH', 'PVI')),
  -- Calendar quarter, 'YYYY-Qn', matching fa_vnstock_statements.
  period text not null,

  -- --- identity -----------------------------------------------------------
  -- Public taxonomy is ONE category; the engine profile is internal and must
  -- never become a second menu entry (§2).
  public_category text not null default 'HOLDING_MIXED',
  engine_profile  text not null
    check (engine_profile in ('LIFE_LED_HOLDING', 'NONLIFE_REINSURANCE_HOLDING')),

  -- --- the metric ---------------------------------------------------------
  metric_code text not null check (metric_code in ('B1','B2','B3','B4',
                                                   'P1','P2','P3','P4')),
  metric_name text not null,
  -- '%' for a ratio metric, 'ppt' for a YoY difference. Stored rather than
  -- inferred: B2/P2 are percentage-POINT differences, not growth rates, and a
  -- UI that prints '%' on them states something false (§30).
  unit text not null check (unit in ('%', 'ppt')),

  current_value     double precision,
  history_percentile double precision check (history_percentile between 0 and 1),
  score             double precision,
  weight            smallint not null check (weight in (8, 10)),

  -- Reproduction inputs (§29). `n_valid` and `rank` are what turn a percentile
  -- back into arithmetic a reviewer can redo by hand.
  n_valid         integer not null default 0,
  average_rank    double precision,
  history_first   text,
  history_last    text,
  valid_from      text,

  -- Sum of the four UNROUNDED component scores; NULL when any component is
  -- unscored, because a partial total would read as a low score (§28 vs §18).
  deep_total      double precision check (deep_total between 0 and 38),

  -- --- status (§18) -------------------------------------------------------
  -- 'OK'                        -- scored
  -- 'NOT_SCORED_PENDING_REVIEW' -- data-mapping guard blocked it; NEVER 0
  -- 'NOT_SCORED_CURRENT_INVALID'-- the current observation could not be formed
  -- 'SELF_HISTORY_INSUFFICIENT' -- fewer than MIN_N_VALID usable observations
  data_status text not null
    check (data_status in ('OK', 'NOT_SCORED_PENDING_REVIEW',
                           'NOT_SCORED_CURRENT_INVALID',
                           'SELF_HISTORY_INSUFFICIENT')),
  data_mapping_alert boolean not null default false,
  guard_reason text,
  guard_qoq_pct double precision,
  -- Hash of WHICH fields the deep layer reads, under which mapping version.
  -- §18.3's lineage alert compares this against what produced the stored rows.
  mapping_fingerprint text not null,

  -- A score may exist ONLY when the row is OK. This is a constraint rather
  -- than a convention because a convention is what let a partial CTCK score
  -- reach the composite once already.
  constraint deep_score_only_when_ok
    check ((data_status = 'OK') = (score is not null)),
  -- NO_ZERO_FILL (§18.4): a blocked row carries no score at all, so it can
  -- never be read as a measured zero.
  constraint deep_blocked_rows_carry_no_score
    check (not data_mapping_alert or score is null),

  -- --- versions -----------------------------------------------------------
  scoring_version text not null,   -- HOLDING_SCORING_1.0
  formula_version text not null,   -- HOLDING_FORMULA_1.0
  mapping_version text not null,   -- HOLDING_V1
  ui_spec_version text,            -- HOLDING_UI_SPEC_1.0

  calculated_at timestamptz not null default now(),

  primary key (symbol, period, metric_code, scoring_version)
);

comment on table fa_insurance_deep_scores is
  'Holding/Hỗn hợp deep score /38, one row per metric. SELF-RELATIVE: each '
  'metric is a percentile of the SAME ticker''s own history. BVH and PVI use '
  'different engines — DEEP_SCORE_CROSS_TICKER_COMPARISON = NOT_ALLOWED.';
comment on column fa_insurance_deep_scores.deep_total is
  'UNROUNDED sum of the four component scores; summing rounded components drifts.';
comment on column fa_insurance_deep_scores.data_status is
  'NOT_SCORED_PENDING_REVIEW means the data-mapping guard blocked it. It is '
  'NOT a zero and must never be rendered as one (BA §18.4, §30).';
comment on column fa_insurance_deep_scores.unit is
  'ppt for B2/P2 — a percentage-POINT difference, not a growth rate.';

alter table fa_insurance_deep_scores enable row level security;

drop policy if exists "fa_insurance_deep_scores read" on fa_insurance_deep_scores;
create policy "fa_insurance_deep_scores read" on fa_insurance_deep_scores
  for select using (true);
-- Writes go through the service-role key, which bypasses RLS (migration 045).

create index if not exists fa_insurance_deep_scores_period_idx
  on fa_insurance_deep_scores (period, symbol);
create index if not exists fa_insurance_deep_scores_version_idx
  on fa_insurance_deep_scores (scoring_version, period);

-- ---------------------------------------------------------------------------
-- VERIFY
--
-- 1. Four metrics per symbol-quarter, no more and no fewer:
--
--   select symbol, period, count(*) from fa_insurance_deep_scores
--    group by symbol, period having count(*) <> 4;
--
-- 2. No quarter mixes scoring versions. Expect ZERO rows:
--
--   select symbol, period, count(distinct scoring_version)
--     from fa_insurance_deep_scores group by symbol, period
--    having count(distinct scoring_version) > 1;
--
-- 3. The total equals its parts (unrounded, 1e-9). Expect ZERO rows:
--
--   select symbol, period, max(deep_total) as stored, sum(score) as parts
--     from fa_insurance_deep_scores where data_status = 'OK'
--    group by symbol, period
--   having count(*) = 4 and abs(max(deep_total) - sum(score)) > 1e-9;
--
-- 4. Weights sum to 38 per symbol-quarter. Expect ZERO rows:
--
--   select symbol, period, sum(weight) from fa_insurance_deep_scores
--    group by symbol, period having sum(weight) <> 38;
--
-- 5. BVH reserve metrics never precede the source-verified cutoff.
--    Expect ZERO rows:
--
--   select * from fa_insurance_deep_scores
--    where symbol = 'BVH' and metric_code in ('B3','B4') and period < '2022-Q1';
--
-- 6. No blocked row carries a score (NO_ZERO_FILL). Expect ZERO rows:
--
--   select * from fa_insurance_deep_scores
--    where data_status <> 'OK' and score is not null;
