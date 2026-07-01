-- ============================================================
-- Migration: implied_risk — daily implied carry/basis of VN30 futures.
--
-- One row per trading day. We store the RAW signed log basis
--   ir = ln(future / spot)           (un-annualized; defined every session)
-- plus its inputs, so the dashboard can render -ir (the default "risk"
-- view, up = more fear), |ir|, or raw without re-backfilling.
--
--   spot     VN30 index close
--   future   VN30F1M (front-month future) close
--   expiry   the front-month contract's last trading day (informational)
--   r_days   calendar days from `date` to `expiry` (informational)
--   t        r_days / 365 (informational; no longer used in ir)
--   ir       ln(future/spot) — defined on every day, including expiry
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

-- RLS: same convention as the other pipeline tables (ta_ohlcv, fa_scores, …) —
-- a single permissive anon policy. Writes come from the anon-key refresh script;
-- there is no service-role key in this project.
alter table implied_risk enable row level security;

drop policy if exists "Allow all reads" on implied_risk;
drop policy if exists "Allow all for anon" on implied_risk;
create policy "Allow all for anon" on implied_risk for all using (true) with check (true);
