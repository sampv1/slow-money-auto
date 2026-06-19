-- ============================================================
-- Migration 014: FA Scanner — Excel-import revision
-- Supersedes the data shape from migration 013.
-- See FA_FEATURE_PLAN.md. Run this in the Supabase SQL Editor.
--
-- Changes vs 013:
--   * fa_quarterly: single-quarter financials from Data_FiinPro.xlsx
--     (EPS, gross/net margin single-quarter; ROE TTM; revenue; ST/LT
--      financial debt; TOTAL equity — not charter capital).
--   * fa_scores: now keyed (symbol, as_of_period) to keep full history.
--   * NEW fa_annual_pe (annual P/E from PE.xlsx) for the 5-yr median.
--   * NEW fa_scoring_config (graduated tiers + rating bands), seeded below;
--     edit this row directly in the DB to change the rubric going forward.
--   * fa_runs is left as-is (created in 013).
-- ============================================================

drop table if exists fa_quarterly;
drop table if exists fa_scores;

-- 1. Quarterly financials (single-quarter, from Data_FiinPro.xlsx).
create table fa_quarterly (
  symbol text not null,
  period text not null,                 -- 'YYYY-Qn', e.g. '2026-Q1'
  year int not null,
  quarter int not null check (quarter between 1 and 4),
  eps numeric,                          -- single-quarter basic EPS (VND)
  gross_margin numeric,                 -- single-quarter, fraction (0.34 = 34%)
  net_margin numeric,                   -- single-quarter, fraction
  roe_ttm numeric,                      -- TTM, fraction
  revenue numeric,                      -- single-quarter net revenue (VND)
  st_debt numeric,                      -- short-term financial borrowings (VND)
  lt_debt numeric,                      -- long-term financial borrowings (VND)
  total_equity numeric,                 -- II. VỐN CHỦ SỞ HỮU (VND)
  imported_at timestamptz not null default now(),
  primary key (symbol, period)
);
create index idx_fa_quarterly_symbol_year on fa_quarterly(symbol, year desc, quarter desc);

-- 2. Annual P/E (from PE.xlsx) — basis for the 5-year median.
create table fa_annual_pe (
  symbol text not null,
  year int not null,
  pe numeric,                           -- annual P/E (Lần); may be negative
  imported_at timestamptz not null default now(),
  primary key (symbol, year)
);

-- 3. Scoring config (graduated tiers + rating bands). One active row.
--    Edit `config` directly in the DB to change the rubric; changes apply to
--    forward scoring runs only.
create table fa_scoring_config (
  id bigint primary key default 1,
  config jsonb not null,
  updated_at timestamptz not null default now(),
  constraint fa_scoring_config_singleton check (id = 1)
);

insert into fa_scoring_config (id, config) values (1, '{
  "criteria": {
    "c1": {"type": "tier_lt", "bounds": [20, 30, 60], "points": [0, 4, 8, 12]},
    "c2": {"type": "tier_lt", "bounds": [25, 35, 45], "points": [0, 4, 8, 12]},
    "c3": {"type": "count_map", "map": {"0": 0, "1": 4, "2": 8, "3": 12}},
    "c4": {"type": "tier_lt", "bounds": [10, 15, 20], "points": [0, 4, 8, 12]},
    "c5": {"type": "tier_lt", "bounds": [-3, 0, 3], "points": [0, 4, 8, 12]},
    "c6": {"type": "tier_lt", "bounds": [-2, 0, 2], "points": [0, 4, 8, 12]},
    "c7": {"type": "tier_lt", "bounds": [15, 17, 20], "points": [0, 4, 8, 12]},
    "c9": {"type": "debt_equity", "high": 1.5, "low": 0.8, "points_high": -4, "points_mid": 6, "points_low": 12},
    "c14": {"type": "pe_median", "low_mult": 0.8, "high_mult": 1.2, "points_cheap": 12, "points_neutral": 8, "points_expensive": 4}
  },
  "rating": {"A_min": 60, "B_min": 30}
}'::jsonb);

-- 4. Score snapshots — one row per (symbol, quarter) = full FA-scanner history.
create table fa_scores (
  symbol text not null,
  as_of_period text not null,           -- the quarter this snapshot is for, 'YYYY-Qn'
  -- per-criterion raw value + awarded points
  c1_eps_yoy numeric,            c1_pts int not null,
  c2_eps_3q_avg_yoy numeric,     c2_pts int not null,
  c3_eps_pos_count int,          c3_pts int not null,
  c4_rev_yoy numeric,            c4_pts int not null,
  c5_gross_margin_delta numeric, c5_pts int not null,
  c6_net_margin_delta numeric,   c6_pts int not null,
  c7_roe numeric,                c7_pts int not null,
  c8_debt_to_equity numeric,     c8_pts int not null,   -- debt / total equity
  c9_current_pe numeric,         c9_pts int not null,   -- valuation criterion
  total_score int not null,
  rating text not null check (rating in ('A', 'B', 'C', 'UNRATED')),
  -- valuation display fields
  current_eps_ttm numeric,              -- sum of 4 single-quarter EPS
  current_pe numeric,
  pe_5y_median numeric,
  current_price numeric,
  current_price_date date,
  notes text,
  computed_at timestamptz not null default now(),
  primary key (symbol, as_of_period)
);
create index idx_fa_scores_as_of on fa_scores(as_of_period);
create index idx_fa_scores_as_of_rating on fa_scores(as_of_period, rating);
create index idx_fa_scores_as_of_score on fa_scores(as_of_period, total_score desc);

-- ============================================================
-- Row Level Security (anon all — matches existing convention)
-- ============================================================
alter table fa_quarterly enable row level security;
alter table fa_annual_pe enable row level security;
alter table fa_scoring_config enable row level security;
alter table fa_scores enable row level security;

drop policy if exists "Allow all for anon" on fa_quarterly;
drop policy if exists "Allow all for anon" on fa_annual_pe;
drop policy if exists "Allow all for anon" on fa_scoring_config;
drop policy if exists "Allow all for anon" on fa_scores;

create policy "Allow all for anon" on fa_quarterly for all using (true) with check (true);
create policy "Allow all for anon" on fa_annual_pe for all using (true) with check (true);
create policy "Allow all for anon" on fa_scoring_config for all using (true) with check (true);
create policy "Allow all for anon" on fa_scores for all using (true) with check (true);
