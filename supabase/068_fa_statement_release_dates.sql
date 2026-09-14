-- ============================================================
-- Migration 068: fa_statement_release_dates — when each quarter's financial
-- statements were PUBLISHED, per symbol.
--
-- WHY
--   The FA Scanner shows a quarter's results with no indication of when the
--   market could first see them. Nothing stored carries that: FiinProX exports
--   only an extraction date ("Ngày trích xuất"), and the securities scorer's
--   `quality_effective_date` is a rule (quarter end + a fixed filing lag), not
--   an observed date.
--
-- SOURCE — KBS statement header, field `DatePubDepartment`
--   Each KBS income-statement response carries a `Head` per period with three
--   dates. Checked on 2026-09-14 before choosing:
--     * DatePubDepartment matched the filing date in VCI's company news on all
--       four quarters tested for AAA (Q3/2025 29/10, Q4/2025 28/01, Q1/2026
--       29/04, Q2/2026 30/07).
--     * ReportDate is the date printed on the statement and is NOT a release
--       date: it equals the quarter end for SCL (2025-12-31) and TOT
--       (2026-06-30), and reads 2026-04-20 for HIO's Q2/2026 — before the
--       quarter closed. It is deliberately not stored, so nothing can read it
--       as one.
--     * CreatedDate is KBS's own ingestion time.
--   One call returns the latest four quarters; KBS does not page further back.
--
-- WRITER: scripts/refresh_fa_release_dates.py (upsert on symbol, period).
-- A date on or before the quarter end, or in the future, is rejected by the
-- writer rather than stored.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

create table if not exists fa_statement_release_dates (
  symbol        text        not null,
  period        text        not null,              -- 'YYYY-Qn'
  release_date  date        not null,              -- KBS DatePubDepartment
  audit_status  text,                              -- KBS AuditedStatus code, as sent
  report_scope  text,                              -- KBS United code (e.g. HN, ĐL), as sent
  source        text        not null default 'KBS',
  fetched_at    timestamptz not null default now(),
  primary key (symbol, period),
  constraint fa_statement_release_dates_period_check
    check (period ~ '^[0-9]{4}-Q[1-4]$')
);

-- The scanner reads one quarter at a time.
create index if not exists idx_fa_release_dates_period
  on fa_statement_release_dates (period, symbol);

-- Anon is read-only (migration 045); the writer uses the service-role key.
alter table fa_statement_release_dates enable row level security;
drop policy if exists "Public read" on fa_statement_release_dates;
create policy "Public read" on fa_statement_release_dates for select using (true);

comment on table fa_statement_release_dates is
  'Publication date of each quarter''s financial statements, per symbol, from '
  'the KBS statement header (DatePubDepartment). Display data for the FA '
  'Scanner; no score reads it.';
comment on column fa_statement_release_dates.release_date is
  'The day the statements were published (KBS DatePubDepartment). NOT the '
  'date printed on the statement (KBS ReportDate), which is sometimes the '
  'quarter end and is not stored.';
