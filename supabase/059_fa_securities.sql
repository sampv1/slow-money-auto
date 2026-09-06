-- Migration 059: securities (CTCK) fundamental scoring — rubric #3.
--
-- WHY -----------------------------------------------------------------------
-- Brokers score UNRATED today: the manufacturing rubric's margin criteria do
-- not apply to a broker's income statement, so `fa/scoring.py` refuses to band
-- them rather than invent a number. This adds the 20-criterion CTCK rubric
-- (Bo_loc_CTCK_V8_Cho_IT.xlsx) as a third, self-contained rubric — the
-- manufacturing and real-estate pipelines are UNTOUCHED.
--
-- THE ONE THING THAT IS GENUINELY NEW: A DAILY GRAIN.
-- `fa_scores` is keyed (symbol, as_of_period) — one row per QUARTER. It is in
-- fact recomputed every weekday (C9 reads the latest price), so today's run
-- OVERWRITES yesterday's and the daily variation is discarded. That has been
-- survivable only because it barely moves: C9 is a 3-step function whose dead
-- band spans a 50% price range, and just 2.9% of symbols sit within 1% of a
-- boundary, so ~97% of rows are numerically identical to yesterday's.
--
-- The CTCK rubric cannot live with that. Cycle (30) + Valuation (20) = HALF the
-- score, and C15–C17 read FCI, ADTV momentum and breadth — market-wide series
-- that move every day for every broker. And the rubric's own spec mandates a
-- 5D/10D/20D/60D forward-return backtest, which is impossible against a table
-- that overwrites its history. Hence (symbol, as_of_date, model_version).
--
-- POINT-IN-TIME IS THE OTHER HALF. `fa_scores` has no effective_date, so when a
-- quarter's row appears it appears retroactively for the whole quarter. Q2
-- filed on 25/07 must not be visible to a score dated 24/07, or every backtest
-- reads the future. `fa_quality_snapshots.effective_date` is what forbids that.
--
-- Three tables:
--   fa_quality_snapshots  — the quarterly /50 block, versioned, with the date
--                           it became usable
--   fa_securities_scores  — one row per symbol per DAY per model_version
--   cycle_sensitivity     — C18's per-symbol betas (NOT market-wide, and NOT
--                           scored until its mapping is backtested and LOCKED)

-- ---------------------------------------------------------------------------
-- 1. Quality /50 — a quarterly snapshot, not a daily one
-- ---------------------------------------------------------------------------
create table if not exists fa_quality_snapshots (
  id bigint generated always as identity primary key,
  symbol text not null,
  report_period text not null,                  -- 'YYYY-Qn', the filing's quarter
  -- A restatement gets a NEW version rather than overwriting the old one, so a
  -- backtest can still read what was knowable at the time (V6 rule P2).
  snapshot_version int not null default 1,
  -- THE LOOK-AHEAD GUARD. The date this filing became usable — publication, not
  -- period end. A score dated before this must use the previous snapshot.
  effective_date date not null,
  criteria jsonb not null,                      -- {"c1": {"value":…, "pts":…}, …}
  earned_score numeric,                         -- points actually earned /50
  available_max numeric,                        -- the /50 denominator after N/A
  -- Per-field provenance required by the spec's A1: value, source_field,
  -- source_type (DIRECT | MANUAL_VERIFIED | CASHFLOW_DERIVED), status, period,
  -- unit, confidence. This is what makes a score traceable back to a provider
  -- field, and what records that HCM's funding cost came from the cash-flow
  -- statement rather than the income statement.
  field_metadata jsonb not null default '{}'::jsonb,
  -- Which criteria inherited N/A, and why. Never converted to 0.
  dependency_flags jsonb not null default '{}'::jsonb,
  model_version text not null,
  data_cutoff_at timestamptz,                   -- for replay: what data existed
  computed_at timestamptz not null default now(),
  unique (symbol, report_period, snapshot_version, model_version)
);
create index if not exists idx_fa_quality_symbol_eff
  on fa_quality_snapshots(symbol, effective_date desc);

-- ---------------------------------------------------------------------------
-- 2. The daily score
-- ---------------------------------------------------------------------------
create table if not exists fa_securities_scores (
  symbol text not null,
  as_of_date date not null,                     -- a TRADING date, not a calendar one
  model_version text not null,                  -- 'CTCK_V8'; history is never rewritten

  -- Which Quality snapshot this score used. Stored, not derived from
  -- as_of_date, because the mapping from date to usable filing is exactly what
  -- a replay must not have to guess.
  quality_period text,
  quality_effective_date date,
  quality_snapshot_id bigint references fa_quality_snapshots(id),

  -- The 20 criteria as columns as well as jsonb: ranking and scanner queries
  -- filter and sort on these, and a jsonb-only design makes every such query a
  -- table scan. NULL means N/A — never 0, which would read as "scored zero".
  c1_score numeric, c2_score numeric, c3_score numeric, c4_score numeric,
  c5_score numeric, c6_score numeric, c7_score numeric, c8_score numeric,
  c9_score numeric, c10_score numeric, c11_score numeric, c12_score numeric,
  c13_score numeric, c14_score numeric, c15_score numeric, c16_score numeric,
  c17_score numeric, c18_score numeric, c19_score numeric, c20_score numeric,

  quality_score numeric,                        -- /50
  cycle_score numeric,                          -- /30
  valuation_score numeric,                      -- /20

  earned_score numeric not null,                -- raw points earned
  available_max numeric not null,               -- max reachable WITH data present
  coverage numeric,                             -- available_max / 100
  normalized_fa_score numeric,                  -- earned / available_max * 100

  -- The publication gate. INSUFFICIENT_COVERAGE is a real outcome, not an
  -- error: a broker scored on 38% of the rubric gets a number for internal use
  -- and never reaches a ranking.
  fa_status text not null
    check (fa_status in ('PUBLISHABLE', 'PROVISIONAL', 'INSUFFICIENT_COVERAGE',
                         'INVALID_CRITICAL', 'BLOCKED')),
  -- Whether the day's inputs were all present. A score built on yesterday's FCI
  -- is PRELIMINARY and must never be ranked or published as day T.
  score_status text not null default 'OFFICIAL'
    check (score_status in ('OFFICIAL', 'PRELIMINARY_FCI_T_MINUS_1',
                            'BLOCKED_MISSING_FCI_T', 'STALE_LAST_OFFICIAL',
                            'INVALID_FA_GATE')),
  fci_as_of_date date,                          -- which FCI date was actually read
  input_lag_days int,                           -- as_of_date - fci_as_of_date
  breadth_convention text,                      -- 'BREADTH_V7_20OBS'
  breadth_denominator int,                      -- the population C17 was measured over

  field_metadata jsonb not null default '{}'::jsonb,
  dependency_flags jsonb not null default '{}'::jsonb,
  data_cutoff_at timestamptz,
  calculated_at timestamptz not null default now(),
  primary key (symbol, as_of_date, model_version)
);
create index if not exists idx_fa_sec_scores_date on fa_securities_scores(as_of_date desc);
create index if not exists idx_fa_sec_scores_rank
  on fa_securities_scores(as_of_date desc, normalized_fa_score desc)
  where fa_status = 'PUBLISHABLE' and score_status = 'OFFICIAL';

-- ---------------------------------------------------------------------------
-- 3. C18 cycle sensitivity — per SYMBOL, deliberately not in macro_series
-- ---------------------------------------------------------------------------
-- Every other Cycle input is one number for the whole market. C18 is not: it
-- asks how hard THIS broker is levered to the cycle, so SSI and VIX must get
-- different values. Storing it market-wide would silently hand every broker the
-- same amplifier.
create table if not exists cycle_sensitivity (
  symbol text not null,
  as_of_period text not null,                   -- the last quarter in the window
  model_version text not null,
  brokerage_sensitivity numeric,
  margin_sensitivity numeric,
  prop_trading_sensitivity numeric,
  operating_leverage numeric,
  r2_brokerage numeric, r2_margin numeric, r2_prop numeric,
  n_quarters int,
  cycle_beta_raw numeric,
  -- Until this reads LOCKED, `production_score` MUST stay null and C18's 7
  -- points come out of available_max. A hand-assigned score here is exactly
  -- what the spec forbids.
  mapping_status text not null default 'RAW'
    check (mapping_status in ('RAW', 'LOCKED')),
  production_score numeric,
  computed_at timestamptz not null default now(),
  primary key (symbol, as_of_period, model_version),
  -- Enforced, not merely documented: no score may exist while the mapping is
  -- unlocked. This is the constraint that stops C18 leaking into production.
  constraint cycle_sensitivity_no_score_before_locked
    check (mapping_status = 'LOCKED' or production_score is null)
);

-- ---------------------------------------------------------------------------
-- RLS — anon reads, writes need the service role (migration 045)
-- ---------------------------------------------------------------------------
alter table fa_quality_snapshots enable row level security;
alter table fa_securities_scores enable row level security;
alter table cycle_sensitivity    enable row level security;

drop policy if exists "Public read" on fa_quality_snapshots;
drop policy if exists "Public read" on fa_securities_scores;
drop policy if exists "Public read" on cycle_sensitivity;

create policy "Public read" on fa_quality_snapshots for select using (true);
create policy "Public read" on fa_securities_scores for select using (true);
create policy "Public read" on cycle_sensitivity    for select using (true);

comment on table fa_securities_scores is
  'CTCK rubric, one row per symbol per TRADING DAY per model_version. Daily '
  'because Cycle (30) + Valuation (20) move every day; point-in-time because '
  'the rubric mandates a forward-return backtest. Never overwrite a '
  'model_version — lock a new threshold set by issuing a new one.';
comment on column fa_quality_snapshots.effective_date is
  'The date this filing became USABLE (publication), not period end. A score '
  'dated earlier must read the previous snapshot, or the backtest sees the future.';
comment on column cycle_sensitivity.production_score is
  'Null until mapping_status = LOCKED, enforced by a check constraint. Before '
  'that C18 is N/A and its 7 points leave available_max.';

-- ---------------------------------------------------------------------------
-- VERIFY (after scripts/refresh_fa_securities.py)
--   select count(*) from fa_securities_scores where as_of_date = current_date;
--   select fa_status, count(*), round(avg(coverage)*100,1) as avg_cov
--     from fa_securities_scores where as_of_date = (select max(as_of_date)
--     from fa_securities_scores) group by 1 order by 2 desc;
--   -- expect ~82% coverage for a healthy broker (C4/C5 market share pending,
--   -- C9 ATTC absent from the provider, C18 N/A until LOCKED), and FTS to land
--   -- in INSUFFICIENT_COVERAGE — it reports no funding cost anywhere.
--   select symbol, coverage, fa_status from fa_securities_scores
--     where symbol in ('HCM','FTS') order by as_of_date desc limit 4;
--   -- HCM must be PUBLISHABLE via the cash-flow funding-cost fallback:
--   select symbol, field_metadata->'eligible_funding_cost'->>'source_type'
--     from fa_securities_scores where symbol = 'HCM' order by as_of_date desc limit 1;
--   -- C18 must not be scored while unlocked (expect 0 rows):
--   select * from cycle_sensitivity where production_score is not null
--     and mapping_status <> 'LOCKED';
--   -- anon must NOT write (expect an RLS error, not a 204):
--   --   set role anon; insert into fa_securities_scores(symbol,as_of_date,
--   --     model_version,earned_score,available_max,fa_status)
--   --     values ('ZZZ',current_date,'CTCK_V8',1,1,'PUBLISHABLE');
-- ---------------------------------------------------------------------------
