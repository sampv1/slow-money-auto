-- ============================================================
-- Migration 084: the Big4 12M deposit benchmark for insurance chart 3
--
-- WHY
--   BĐ3 (Chi phí vốn Float) compares an insurer's cost of float against the
--   rate it would pay a bank. BA settled the definition after three rounds
--   (reply lần 5 §1, lần 6 §1): the POSTED 12-month term-deposit rate averaged
--   over the four state-owned commercial banks -- VCB, BID, CTG, AGB -- taken
--   at the LAST TRADING SESSION of the quarter.
--
-- WHY A SEED TABLE AND NOT A COMPUTED SERIES
--   The rate cannot be backfilled. The provider payload behind
--   `bank_deposit_12m_avg` is a dateless snapshot -- its `time` field is the
--   TENOR (0T..24T), not a date -- and `refresh_macro.py` collapsed it to one
--   all-bank average before storing, so no per-bank figure exists for any past
--   day. BA therefore supplied the 18 historical quarters once (lần 6 §1), and
--   `bank_deposit_board` below starts accumulating per-bank rows from
--   2026-10-09 so that 2026-Q4 onward is computed rather than typed.
--
--   Two earlier attempts at this are recorded because each produced a wrong
--   series: splicing the all-bank average onto BA's Big4 history left a 0.68pp
--   step (all-bank runs ~0.08pp above Big4, so the subset was never the cause);
--   and a 50/50 blend at the handover halved the step into two 0.275pp steps
--   while putting a rate nobody could earn on a chart whose whole purpose is
--   comparison against a real alternative.
--
-- WHY THE DATES ARE NOT QUARTER-ENDS
--   Three quarter-ends fall on a weekend (31/12/2022, 30/09/2023, 31/12/2023).
--   Each is recorded at the preceding session, verified against the stored
--   VN-Index session calendar: all 18 dates are real sessions AND the last
--   session of their quarter.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- 1. The benchmark the chart reads -------------------------------------------

create table if not exists ref_deposit_rate_12m (
  period       text primary key,          -- '2026-Q3'
  session_date date not null,             -- the quarter's last TRADING session
  rate_pct     numeric(6, 3) not null check (rate_pct > 0 and rate_pct < 50),
  source       text not null,             -- 'BA_SEED_V7_1' | 'BIG4_BOARD'
  bank_count   smallint,                  -- banks averaged; null for a seeded row
  note         text,
  updated_at   timestamptz not null default now()
);

comment on table ref_deposit_rate_12m is
  'Posted 12-month term-deposit rate, average of VCB/BID/CTG/AGB, at the last '
  'trading session of each quarter. Benchmark line of insurance chart 3. '
  'Rows to 2026-Q3 are BA''s seed (source=BA_SEED_V7_1, not reproducible from '
  'any stored data -- see 084); 2026-Q4 onward is computed from '
  'bank_deposit_board (source=BIG4_BOARD).';

comment on column ref_deposit_rate_12m.session_date is
  'The quarter''s last TRADING session, not its calendar end. Verified against '
  'the stored VN-Index sessions: 18/18 are real sessions and are their '
  'quarter''s last.';

-- 2. The per-bank board, so future quarters need no manual entry -------------

create table if not exists bank_deposit_board (
  as_of     date not null,                -- the FETCH date; the feed carries none
  bank      text not null,                -- the feed's ticker: VCB, BID, CTG, AGB...
  tenor     text not null,                -- '12T'; every tenor the board serves
  rate_pct  numeric(6, 3) not null,
  primary key (as_of, bank, tenor)
);

create index if not exists idx_bank_deposit_board_tenor
  on bank_deposit_board (tenor, as_of);

comment on table bank_deposit_board is
  'Daily snapshot of every bank''s posted term-deposit board (CafeF). Keyed on '
  'the FETCH date because the payload contains no date of its own, so this is a '
  'step series that accumulates forward and CANNOT be backfilled. Exists so '
  'ref_deposit_rate_12m can be computed from 2026-Q4 onward rather than typed.';

-- 3. RLS. An enabled table with NO policy returns 200 and zero rows to anon --
--    (the 083 lesson). The dashboard reads the benchmark; it never reads the
--    board, which is an input to the quarterly figure.

alter table ref_deposit_rate_12m enable row level security;
alter table bank_deposit_board   enable row level security;

drop policy if exists ref_deposit_rate_12m_anon_read on ref_deposit_rate_12m;
create policy ref_deposit_rate_12m_anon_read
  on ref_deposit_rate_12m for select to anon, authenticated using (true);

-- bank_deposit_board gets NO anon policy on purpose: nothing client-side reads
-- it, and the service-role key bypasses RLS for the loader.

-- 4. BA's seed, reply lần 6 §1 (v7.1) ---------------------------------------

insert into ref_deposit_rate_12m (period, session_date, rate_pct, source, note) values
  ('2022-Q2', '2022-06-30', 5.600, 'BA_SEED_V7_1', null),
  ('2022-Q3', '2022-09-30', 5.800, 'BA_SEED_V7_1', null),
  ('2022-Q4', '2022-12-30', 7.400, 'BA_SEED_V7_1', 'quarter end 31/12 was a Saturday'),
  ('2023-Q1', '2023-03-31', 7.200, 'BA_SEED_V7_1', null),
  ('2023-Q2', '2023-06-30', 6.800, 'BA_SEED_V7_1', null),
  ('2023-Q3', '2023-09-29', 5.800, 'BA_SEED_V7_1', 'quarter end 30/09 was a Saturday'),
  ('2023-Q4', '2023-12-29', 5.300, 'BA_SEED_V7_1', 'quarter end 31/12 was a Sunday'),
  ('2024-Q1', '2024-03-29', 4.800, 'BA_SEED_V7_1', null),
  ('2024-Q2', '2024-06-28', 4.700, 'BA_SEED_V7_1', null),
  ('2024-Q3', '2024-09-30', 4.700, 'BA_SEED_V7_1', null),
  ('2024-Q4', '2024-12-31', 4.800, 'BA_SEED_V7_1', null),
  ('2025-Q1', '2025-03-31', 4.800, 'BA_SEED_V7_1', null),
  ('2025-Q2', '2025-06-30', 4.900, 'BA_SEED_V7_1', null),
  ('2025-Q3', '2025-09-30', 5.200, 'BA_SEED_V7_1', null),
  ('2025-Q4', '2025-12-31', 5.500, 'BA_SEED_V7_1', null),
  ('2026-Q1', '2026-03-31', 5.600, 'BA_SEED_V7_1', null),
  ('2026-Q2', '2026-06-30', 5.800, 'BA_SEED_V7_1', null),
  ('2026-Q3', '2026-09-30', 5.900, 'BA_SEED_V7_1', 'last seeded quarter; 2026-Q4 onward is computed')
on conflict (period) do update
  set session_date = excluded.session_date,
      rate_pct     = excluded.rate_pct,
      source       = excluded.source,
      note         = excluded.note,
      updated_at   = now();

-- VERIFY
--   select count(*), min(period), max(period) from ref_deposit_rate_12m;
--     expect 18, 2022-Q2, 2026-Q3
--   -- every session_date is a real VN-Index session and its quarter's last:
--   select r.period, r.session_date
--     from ref_deposit_rate_12m r
--    where not exists (select 1 from macro_series m
--                       where m.metric = 'vnindex' and m.date = r.session_date);
--     expect 0 rows
