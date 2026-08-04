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
-- `kind` is NOT inferred from price, because it is not inferrable from price.
-- Three rules were tried and all three failed on AIG, whose answer is known from
-- its AGM (5% cash dividend ex 07-31 + 15% bonus ex 08-04): rational-matching
-- split near-identical ratios into different classes; a 15%-drop cutoff put the
-- 15% bonus on the wrong side (it shows as a 13.03% drop); and a round-number
-- test fired BOTH ways at once (1/0.8693 = 1.1504 ~ 1.15, and 52,100 x 0.1307 =
-- 6,809 ~ 6,800 VND). So `kind` stays 'unknown' until a corporate announcement
-- fills it in, and `share_multiplier` is just 1/ratio — the equivalent share
-- multiplier, a restatement of the fact rather than a claim about the cause.
--
-- The residual ambiguity is real and unfixable from price: a large special cash
-- dividend can clear the cutoff, and a small bonus can fall under it.
--
-- DO NOT try to settle it with the share count. Charter capital and listed_share
-- update when the new shares are LISTED, which is weeks after the ex-date, so
-- during the entire window that matters they still show the pre-action figure.
-- AIG proved this the hard way: its 15% bonus went ex 2026-08-04 while
-- capital_history still read 2018-11-22 and listed_share still read 170,601,298.
-- Treating "share count unchanged" as "no stock action" gives a confident wrong
-- answer. `listed_share` is stored as a historical record only.
--
-- Only the corporate announcement gives the type. AIG's 2026 AGM approved a 5%
-- cash dividend AND a 15% bonus, which show up here as two separate events
-- (ex 07-31 factor 0.99045, ex 08-04 factor 0.86930).
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
