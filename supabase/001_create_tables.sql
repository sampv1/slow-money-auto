-- ============================================================
-- Slow Money — Supabase Schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- 1. Daily analysis logs (one row per day, including "stand aside" days)
create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  analysis_date date not null,
  trading_date date not null,
  conclusion text not null check (conclusion in ('KB1', 'KB2', 'KB3')),
  regime integer not null check (regime between 1 and 4),
  regime_label text not null,
  auction_state text not null,
  strategy text not null,
  vn_index_close numeric,
  vn_index_change_pct numeric,
  vn_index_session_date date,
  sp500_change_pct numeric,
  dxy numeric,
  us10y numeric,
  vix numeric,
  oil_wti numeric,
  international_environment text,
  confidence integer check (confidence between 1 and 10),
  stand_aside_reason text,
  scenario_bullish_pct integer,
  scenario_bullish_desc text,
  scenario_neutral_pct integer,
  scenario_neutral_desc text,
  scenario_bearish_pct integer,
  scenario_bearish_desc text,
  kill_zone_vn_index numeric,
  avg_sharpe numeric,
  avg_expectancy numeric,
  num_recommendations integer not null default 0,

  -- v5 fields (nullable for backward compat with v4)
  macro_score integer,
  css numeric,
  top_sectors jsonb,
  avoid_sectors jsonb,
  funnel_candidates_story integer,
  funnel_candidates_risk integer,
  funnel_candidates_technical integer,
  funnel_near_miss jsonb,

  created_at timestamptz not null default now(),

  constraint uq_daily_logs_trading_date unique (trading_date)
);

-- 2. Individual stock recommendations
create table recommendations (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null references daily_logs(id) on delete cascade,
  trading_date date not null,

  -- Identity
  rank integer not null,
  symbol text not null,
  exchange text not null check (exchange in ('HOSE', 'HNX', 'UPCOM')),
  company_name text,
  sector text,
  action text not null check (action in ('BUY', 'SELL')),

  -- Setup
  setup text not null,
  setup_confidence text not null check (setup_confidence in ('HIGH', 'MEDIUM', 'LOW')),
  rating text not null check (rating in ('EXCELLENT', 'GOOD', 'FAIR')),

  -- Prices
  entry_price numeric not null,
  entry_range_low numeric,
  entry_range_high numeric,
  stop_loss numeric not null,
  tp1 numeric not null,
  tp2 numeric,
  trailing_stop_method text,
  last_close numeric not null,
  last_close_date date not null,

  -- Statistics
  stop_loss_pct numeric not null,
  tp1_pct numeric not null,
  tp2_pct numeric,
  r_multiple numeric not null,
  sharpe numeric not null,
  win_rate_est numeric not null,
  expectancy numeric not null,
  hit_probability text not null check (hit_probability in ('HIGH', 'MEDIUM', 'LOW')),

  -- Holding
  holding_period_sessions integer,
  holding_period_label text,

  -- Position sizing
  sizing_method text,
  size_pct numeric,
  kelly_raw_pct numeric,
  quarter_kelly_pct numeric,

  -- Timing
  entry_timing text,
  entry_method text,

  -- Reasoning
  reasoning_summary text,

  -- v5 story fields (nullable for backward compat with v4)
  story_type integer,
  story_type_label text,
  story_summary text,
  story_first_news_date date,
  story_priced_in_level text check (story_priced_in_level in ('A', 'B', 'C', 'D', 'E')),
  story_priced_in_pct numeric,
  story_remaining_trigger text,

  -- === Tracking fields (updated by update_prices.py) ===
  status text not null default 'OPEN' check (status in ('OPEN', 'TP1_HIT', 'TP2_HIT', 'STOPPED', 'EXPIRED', 'CLOSED_MANUAL')),
  current_price numeric,
  current_price_date date,
  unrealized_pnl_pct numeric,
  max_drawdown_pct numeric,
  actual_exit_price numeric,
  actual_pnl_pct numeric,
  closed_at date,
  days_held integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. daily_prices table removed — price evaluation fetches directly from vnstock

-- ============================================================
-- Indexes
-- ============================================================

create index idx_recommendations_status on recommendations(status);
create index idx_recommendations_symbol on recommendations(symbol);
create index idx_recommendations_trading_date on recommendations(trading_date);
-- daily_prices index removed
create index idx_daily_logs_trading_date on daily_logs(trading_date);

-- ============================================================
-- Auto-update updated_at on recommendations
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_recommendations_updated_at
  before update on recommendations
  for each row execute function update_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
-- For a personal project, we use the anon key with RLS disabled.
-- If you share the dashboard publicly, enable RLS and add policies.

alter table daily_logs enable row level security;
alter table recommendations enable row level security;
-- Allow full access via anon key (personal use)
create policy "Allow all for anon" on daily_logs
  for all using (true) with check (true);

create policy "Allow all for anon" on recommendations
  for all using (true) with check (true);

-- daily_prices policy removed
