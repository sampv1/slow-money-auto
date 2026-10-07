-- ============================================================
-- Migration 082: chart 10, the bank peer valuation matrix
--
-- WHY A TABLE RATHER THAN A DASHBOARD COMPUTATION
--   Charts 1-9 are one symbol's time series and are computed in the page from
--   `fa_vnstock_statements`. Chart 10 is CROSS-SECTIONAL: all 29 banks on one
--   scatter at a single date, with a sector median and a benchmark diagonal
--   drawn across the whole set.
--
--   Computing that in the page would have it load 29 banks' statements, notes
--   and two years of bars on every view, and repeat the identical peer
--   computation once per bank. It would also be a second implementation of peer
--   math that closely resembles the securities C20 residual model -- and this
--   schema already records two occasions where one rule in two places drifted.
--
-- WHAT A ROW IS
--   One bank's coordinates on one date, plus the sector aggregates it was
--   measured against. The dashboard reads every row for the newest date (29
--   rows) and resolves only WHICH points carry a label -- a display rule, not
--   arithmetic.
--
-- target_pb IS NULL ON PURPOSE AND THE COLUMN SAYS WHY
--   It needs g = ROE_sustainable x (1 - cash dividend payout), and the payout
--   has no source: RT_VALUE_DIVIDEND_YIELD is 0 on all 27 banks carrying a
--   ratio row. `target_pb_reason` records that rather than letting an invented
--   payout produce a number. The chart does not depend on it -- the quadrant
--   dividers use the SECTOR constants in `sector`.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

create table if not exists fa_bank_valuation (
  symbol       text not null,
  as_of_date   date not null,

  -- Inputs, kept so a stored row can be audited without re-deriving it.
  price                     numeric,
  price_date                date,
  shares                    numeric,
  parent_equity             numeric,   -- BS_EQUITY - BS_MINORITY_INTEREST
  total_assets              numeric,   -- peer selection only

  -- The two coordinates.
  sustainable_roe           numeric,   -- x
  adjusted_pb               numeric,   -- y

  -- The working behind them.
  bvps                      numeric,
  adjusted_bvps             numeric,
  roe_ttm                   numeric,
  hidden_npl_unprovisioned  numeric,
  accrued_overdue           numeric,

  -- Cost of equity. `ke` is per-bank; the DIAGONAL uses the sector constant.
  beta_raw                  numeric,
  beta_blume                numeric,
  beta_status               text,
  ke                        numeric,

  target_pb                 numeric,
  target_pb_reason          text not null default 'NO_DIVIDEND_PAYOUT_SOURCE',

  -- Drawn only with both coordinates and a POSITIVE adjusted book: a negative
  -- adjusted book is a bank whose equity is wiped out, and price over it is a
  -- negative P/B that would plot below the axis as the best value on the chart.
  plottable                 boolean not null default false,

  -- Median, diagonal endpoints and the constants this row was measured against,
  -- so a stored point can never be read against a different sector view.
  sector                    jsonb not null,
  reasons                   jsonb not null default '{}'::jsonb,

  computed_at  timestamptz not null default now(),
  primary key (symbol, as_of_date)
);

create index if not exists idx_fa_bank_valuation_date
  on fa_bank_valuation(as_of_date, symbol);

comment on column fa_bank_valuation.target_pb is
  'Per-bank justified P/B. NULL while no dividend-payout source exists; see '
  'target_pb_reason. The chart''s quadrant dividers use sector constants and '
  'do not depend on this.';
comment on column fa_bank_valuation.parent_equity is
  'BS_EQUITY - BS_MINORITY_INTEREST. Parent, not total: measured against the '
  'provider''s own RT_VALUE_PB using its market cap (so the price date cannot '
  'confound it), parent lands within 2% on 23 of 27 banks while total misses '
  'every bank with material minority interest (VPB 0.96 vs a published 1.24).';

-- VERIFY
--   select as_of_date, count(*), count(*) filter (where plottable) as drawn,
--          count(target_pb) as with_target
--   from fa_bank_valuation group by 1 order by 1 desc limit 3;
