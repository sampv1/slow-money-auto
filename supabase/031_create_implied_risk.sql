-- ============================================================
-- Migration: implied_risk — daily implied carry/basis of VN30 futures.
--
-- One row per trading day. We store the RAW signed implied rate
--   ir = ln(future / spot) / t        (t = r_days / 365, annualized)
-- plus its inputs, so the dashboard can render -ir (the default "risk"
-- view, up = more fear), |ir|, or raw without re-backfilling.
--
--   spot     VN30 index close
--   future   VN30F1M (front-month future) close
--   expiry   the front-month contract's last trading day
--   r_days   calendar days from `date` to `expiry`
--   t        r_days / 365 (years to expiry)
--   ir       ln(future/spot) / t  — null on the expiry day (t = 0)
--
-- Populated by scripts/refresh_implied_risk.py. Run this in the
-- Supabase SQL Editor, then backfill (python3 refresh_implied_risk.py --backfill).
-- ============================================================

create table if not exists implied_risk (
  date       date primary key,
  spot       numeric not null,
  future     numeric not null,
  expiry     date    not null,
  r_days     integer not null,
  t          numeric not null,
  ir         numeric,
  created_at timestamptz not null default now()
);

-- RLS: public read (read-only market data), no anon writes.
alter table implied_risk enable row level security;

drop policy if exists "Allow all reads" on implied_risk;
create policy "Allow all reads" on implied_risk
  for select using (true);
