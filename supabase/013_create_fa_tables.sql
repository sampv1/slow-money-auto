-- ============================================================
-- Migration: Fundamental Analysis scanner tables
-- See FA_FEATURE_PLAN.md for the full feature design.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- 1. Raw quarterly fundamentals — append-only history per (symbol, period).
--    Storing raw values means we can recompute scores or add new criteria
--    later (e.g. switch QoQ -> YoY once we accumulate >=5 quarters) without
--    re-fetching from vnstock.
create table if not exists fa_quarterly (
  symbol text not null,
  period text not null,                 -- e.g. '2025-Q3'
  year int not null,
  quarter int not null check (quarter between 1 and 4),
  -- Income statement
  revenue numeric,
  gross_profit numeric,
  net_income numeric,
  eps numeric,                          -- diluted if available, else basic
  -- Balance sheet
  total_equity numeric,
  total_debt numeric,
  -- Derived / ratios
  gross_margin numeric,                 -- gross_profit / revenue
  net_margin numeric,                   -- net_income / revenue
  -- Price snapshot at end of quarter (used for the 4-quarter median P/E)
  close_at_qend numeric,
  pe_at_qend numeric,                   -- close_at_qend / (eps * 4)  (annualized)
  fetched_at timestamptz not null default now(),
  primary key (symbol, period)
);

create index if not exists idx_fa_quarterly_symbol_year on fa_quarterly(symbol, year desc, quarter desc);

-- 2. Latest score + valuation snapshot per symbol.
--    Overwritten each refresh run; one row per symbol.
--    Graduated scoring: each criterion awards 0/4/8/12 points (C8 can be -4).
--    Max total = 108 (9 x 12). See rubric in FA_FEATURE_PLAN.md.
create table if not exists fa_scores (
  symbol text primary key,
  as_of_period text not null,           -- latest quarter used (e.g. '2025-Q3')
  -- Per-criterion raw value + awarded points
  c1_eps_qoq numeric,            c1_pts int not null,   -- C1: latest Q EPS growth QoQ
  c2_eps_3q_avg numeric,         c2_pts int not null,   -- C2: avg of last 3 QoQ EPS growth
  c3_eps_pos_count int,          c3_pts int not null,   -- C3: # of 3 QoQ comparisons with growth
  c4_rev_qoq numeric,            c4_pts int not null,   -- C4: revenue growth QoQ
  c5_gross_margin_delta numeric, c5_pts int not null,   -- C5: gross margin pp change QoQ
  c6_net_margin_delta numeric,   c6_pts int not null,   -- C6: net margin pp change QoQ
  c7_roe numeric,                c7_pts int not null,   -- C7: trailing ROE
  c8_debt_to_equity numeric,     c8_pts int not null,   -- C8: D/E  (can be -4)
  c9_current_pe numeric,         c9_pts int not null,   -- C9: P/E vs 4-quarter median
  total_score int not null,                              -- -4..108
  rating text not null check (rating in ('A', 'B', 'C', 'UNRATED')),
  -- Valuation display fields
  current_eps_ttm numeric,              -- sum of 4 quarterly EPS
  current_pe numeric,                   -- current_price / current_eps_ttm
  pe_4q_median numeric,                 -- median of the 4 annualized quarter-end P/Es
  current_price numeric,
  current_price_date date,
  -- Diagnostics
  notes text,                           -- e.g. "Insufficient quarterly history (n=3)"
  computed_at timestamptz not null default now()
);

create index if not exists idx_fa_scores_rating on fa_scores(rating);
create index if not exists idx_fa_scores_total_score on fa_scores(total_score desc);

-- 3. Run log (mirrors ta_runs)
create table if not exists fa_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  as_of_period text,
  symbols_processed int,
  symbols_skipped int,
  status text not null check (status in ('running', 'success', 'failed')),
  error_message text
);

create index if not exists idx_fa_runs_started_at on fa_runs(started_at desc);

-- ============================================================
-- Row Level Security (matches existing project convention)
-- ============================================================

alter table fa_quarterly enable row level security;
alter table fa_scores enable row level security;
alter table fa_runs enable row level security;

drop policy if exists "Allow all for anon" on fa_quarterly;
drop policy if exists "Allow all for anon" on fa_scores;
drop policy if exists "Allow all for anon" on fa_runs;

create policy "Allow all for anon" on fa_quarterly for all using (true) with check (true);
create policy "Allow all for anon" on fa_scores for all using (true) with check (true);
create policy "Allow all for anon" on fa_runs for all using (true) with check (true);
