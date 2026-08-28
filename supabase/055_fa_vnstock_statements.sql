-- ============================================================
-- Migration 055: financial statements from vnstock_data (sponsor API)
--
-- WHY A SEPARATE SET OF TABLES
--   `fa_quarterly` / `fa_annual_pe` are FiinProX-authoritative: they are the
--   INPUTS to the 9-criterion rubric, imported by hand from a spreadsheet, and
--   the whole FA Score depends on them. This data comes from a different
--   provider on a different cadence and is DISPLAY-ONLY — it feeds charts on
--   /analysis/<symbol>, nothing scores off it.
--
--   Writing it into the same tables would make one column mean two things
--   depending on which importer ran last, and a provider disagreement would
--   silently move A/B/C bands. Measured before choosing: the two sources agree
--   to 0.00% on revenue, gross profit, equity and short-term debt -- but EPS
--   diverges materially (HPG and SSI return literal 0.0; PNJ is off by exactly
--   -33.3%, a point-in-time share count applied to a past quarter's profit).
--   EPS drives 4 of the 9 criteria. That is the reason these stay apart.
--
-- WHY jsonb RATHER THAN ONE ROW PER METRIC
--   The API returns tidy/long. At ~1,750 symbols x 34 periods x ~100 metrics
--   that is ~5.4M rows. Bucketing by statement gives ~240k instead, and a chart
--   read is ONE row rather than a hundred. It also follows `fa_re_scores`:
--   adding or renaming a metric needs no migration.
--
-- WHY THE UNIVERSE IS NOT CONSTRAINED TO ta_universe / fa_scores
--   Deliberately loose. The importer takes whatever `Reference.equity.list()`
--   returns (1,751 symbols today, wider than the 1,431 active TA universe), so
--   this table never becomes a reason another feature's membership cannot
--   change. Nothing here is an input to anything else.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- One row per (symbol, period, period_type, statement).
create table if not exists fa_vnstock_statements (
  symbol       text not null,
  period       text not null,                       -- '2026-Q2' (quarter) | '2026' (year)
  period_type  text not null check (period_type in ('quarter', 'year')),
  statement    text not null check (statement in ('income', 'balance', 'cashflow', 'ratio')),

  -- {metric_id: value}, e.g. {"IS_NET_REVENUE": 1.37885e13, "IS_GROSS_PROFIT": 4.2797e12}
  -- Keys are the provider's STABLE semantic ids, not display names: the names
  -- are Vietnamese prose that changes wording between releases, the ids do not.
  -- Values are numeric or null; a metric the provider did not report is ABSENT
  -- rather than 0, because 0 is a real accounting value and absence is not.
  items        jsonb not null,

  updated_at   timestamptz not null default now(),
  primary key (symbol, period, period_type, statement)
);

-- The chart reads one symbol's whole history at once, hence symbol-leading.
create index if not exists idx_fa_vnstock_stmt_symbol
  on fa_vnstock_statements(symbol, statement, period_type, period);

-- Label dictionary, keyed on the same semantic ids. Bilingual like icb_sectors:
-- without this the chart would hard-code Vietnamese strings lifted from a vendor
-- payload, and the English locale would show them untranslated.
create table if not exists fa_vnstock_metrics (
  metric_id     text primary key,                   -- 'IS_NET_REVENUE'
  statement     text not null,
  name_vi       text,
  name_en       text,
  unit          text,                               -- 'VNĐ', '%', 'lần', ...
  display_order integer,                            -- provider's own ordering
  level         integer,                            -- indent depth in the statement
  updated_at    timestamptz not null default now()
);

create index if not exists idx_fa_vnstock_metrics_stmt
  on fa_vnstock_metrics(statement, display_order);

comment on table fa_vnstock_statements is
  'Financial statements from vnstock_data (sponsor API). DISPLAY ONLY - not an input to any score. FiinProX remains authoritative for the FA rubric (fa_quarterly).';
comment on column fa_vnstock_statements.items is
  'jsonb {metric_id: value}. A metric the provider did not report is ABSENT, never 0.';
comment on table fa_vnstock_metrics is
  'Bilingual label dictionary for fa_vnstock_statements.items keys.';

-- RLS: anon is READ-ONLY everywhere since migration 045; writes use the
-- service-role key, which bypasses RLS.
alter table fa_vnstock_statements enable row level security;
alter table fa_vnstock_metrics    enable row level security;

drop policy if exists "Public read" on fa_vnstock_statements;
drop policy if exists "Public read" on fa_vnstock_metrics;
create policy "Public read" on fa_vnstock_statements for select using (true);
create policy "Public read" on fa_vnstock_metrics    for select using (true);
