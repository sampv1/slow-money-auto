-- 041: fix the RS-history write timeout from 040 — stop duplicating the shared
-- date grid on every symbol row.
--
-- compute_rs_history (ta/rs_rating.py) computes RS3M/RS6M/RS52W percentile
-- history over one GLOBAL grid of trading dates (the union of all rated
-- symbols' recent dates) — every symbol's "dates" array is byte-for-byte
-- identical. Storing it on all ~1,568 ta_universe rows (040's rs_hist_dates
-- column) multiplied the write payload ~1568x for no reason and blew the
-- Supabase statement timeout on the first real run (57014). 040 was applied
-- but rs_hist_dates was never actually populated (that run failed before any
-- write), so dropping it loses no data.
--
-- Fix: store the shared grid ONCE in a singleton table; ta_universe keeps only
-- the three per-symbol percentile arrays (040's rs_3m_hist/rs_6m_hist/
-- rs_12m_hist, unchanged).

drop table if exists ta_rs_hist_meta;
create table ta_rs_hist_meta (
  id         smallint primary key default 1,
  dates      jsonb not null,
  updated_at timestamptz not null default now(),
  constraint ta_rs_hist_meta_singleton check (id = 1)
);

alter table ta_rs_hist_meta enable row level security;
drop policy if exists "Allow all for anon" on ta_rs_hist_meta;
create policy "Allow all for anon" on ta_rs_hist_meta for all using (true) with check (true);

alter table ta_universe drop column if exists rs_hist_dates;
