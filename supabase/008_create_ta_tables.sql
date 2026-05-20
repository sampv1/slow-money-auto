-- ============================================================
-- Migration: Technical Analysis scanner tables
-- See TA_FEATURE_PLAN.md for the full feature design.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- 1. Universe — controlled list of tickers the scanner covers
create table if not exists ta_universe (
  symbol text primary key,
  exchange text not null check (exchange in ('HOSE', 'HNX', 'UPCOM')),
  is_active boolean not null default true,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ta_universe_active on ta_universe(is_active) where is_active = true;

-- 2. OHLCV cache — price history per symbol, used to recompute indicators
create table if not exists ta_ohlcv (
  symbol text not null,
  date date not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume bigint not null,
  primary key (symbol, date)
);

create index if not exists idx_ta_ohlcv_date on ta_ohlcv(date);

-- 3. Computed signals — one row per indicator per symbol per day
create table if not exists ta_signals (
  date date not null,
  symbol text not null,
  indicator text not null,         -- e.g. 'rsi_oversold', 'macd_bearish_cross'
  triggered boolean not null,
  value numeric,                   -- raw underlying value (RSI=25.3, etc.)
  metadata jsonb,
  primary key (date, symbol, indicator)
);

create index if not exists idx_ta_signals_date_indicator on ta_signals(date, indicator) where triggered = true;
create index if not exists idx_ta_signals_symbol_date on ta_signals(symbol, date);

-- 4. Run log
create table if not exists ta_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  trading_date date not null,
  symbols_processed int,
  signals_written int,
  status text not null check (status in ('running', 'success', 'failed')),
  error_message text
);

create index if not exists idx_ta_runs_trading_date on ta_runs(trading_date desc);

-- ============================================================
-- Auto-update updated_at on ta_universe
-- ============================================================

create trigger trg_ta_universe_updated_at
  before update on ta_universe
  for each row execute function update_updated_at();

-- ============================================================
-- Row Level Security (matches existing project convention)
-- ============================================================

alter table ta_universe enable row level security;
alter table ta_ohlcv enable row level security;
alter table ta_signals enable row level security;
alter table ta_runs enable row level security;

drop policy if exists "Allow all for anon" on ta_universe;
drop policy if exists "Allow all for anon" on ta_ohlcv;
drop policy if exists "Allow all for anon" on ta_signals;
drop policy if exists "Allow all for anon" on ta_runs;

create policy "Allow all for anon" on ta_universe for all using (true) with check (true);
create policy "Allow all for anon" on ta_ohlcv for all using (true) with check (true);
create policy "Allow all for anon" on ta_signals for all using (true) with check (true);
create policy "Allow all for anon" on ta_runs for all using (true) with check (true);
