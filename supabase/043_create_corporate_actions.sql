-- ============================================================
-- Migration: corporate_actions — an event log for price adjustments
--
-- ta/adjustments.py already DETECTS every dividend / bonus / split (it has to:
-- ta_ohlcv stores RAW UNADJUSTED prices, so an unrepaired action corrupts
-- trailing returns and RS). It then repairs the prices and discards what it
-- found. This table keeps the event so the rest of the system can explain
-- itself — the Portfolio badge can say "shares x2 on 2026-07-15" instead of a
-- bare factor, and the Analysis chart can mark ex-dates.
--
-- `ratio` is the FACT: post/pre close price factor. < 1 = downward adjustment
-- (cash dividend, bonus, split); > 1 = upward (reverse split / consolidation).
--
-- Only DOWNWARD moves (ratio < 1) are recorded. Every dividend, bonus and split
-- lowers the price, so an upward gap is a genuine move, a halt resumption or a
-- rare consolidation; attributing it to a corporate action would publish a
-- confident falsehood. Such symbols are still repaired — repair_symbols verifies
-- and skips, so a false flag is harmless there, unlike a false log entry.
--
-- `kind` and `share_multiplier` are INFERRED FROM PRICE ALONE and are not
-- authoritative. The rule is deliberately coarse: a drop >= 15% is too large for
-- a VN cash dividend, so it reads as 'stock'; below that, 'cash'. An earlier
-- version matched 1/ratio against simple rationals and looked far more precise,
-- but on real data it classified near-identical ratios differently (0.7667 vs
-- 0.7713) and produced confident nonsense on upward moves — precision that was
-- an artifact of tolerance, not evidence.
--
-- The residual ambiguity is real and unfixable from price: a large special cash
-- dividend can clear the cutoff, and a small bonus can fall under it. Settling
-- it needs the share count, which is why `listed_share` is stored — comparing it
-- across two events for the same symbol resolves the case definitively.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

create table if not exists corporate_actions (
  symbol text not null,
  -- The session on which the adjusted price first appears. NOT confirmed against
  -- an exchange calendar (nothing here ingests one), so it is "effective on or
  -- about". For the ref-price signal this is exact; for the gap signal it is the
  -- first session showing the gap.
  ex_date date not null,
  ratio numeric not null check (ratio > 0),
  kind text not null check (kind in ('stock', 'cash', 'unknown')),
  share_multiplier numeric,          -- inferred 1/ratio when kind = 'stock'
  label text,                        -- compact display form: 'x2', '-5.0%'
  detected_at date not null,
  -- Which signal fired: 'gap' (day-over-day move beyond the exchange limit),
  -- 'ref' (exchange reference price != stored prior close), or 'gap+ref'.
  source text not null,
  exchange text,
  prev_close numeric,
  new_close numeric,
  listed_share numeric,              -- share count at detection, for later disambiguation
  created_at timestamptz not null default now(),
  primary key (symbol, ex_date)
);

create index if not exists idx_corporate_actions_ex_date
  on corporate_actions(ex_date desc);
create index if not exists idx_corporate_actions_symbol
  on corporate_actions(symbol, ex_date desc);

-- RLS: anon-readable like the other pipeline tables (project convention).
alter table corporate_actions enable row level security;

drop policy if exists "Allow all for anon" on corporate_actions;
create policy "Allow all for anon" on corporate_actions
  for all using (true) with check (true);
