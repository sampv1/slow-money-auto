-- ============================================================
-- Migration 057: provenance on fa_quarterly (+ fa_re_metrics)
--
-- WHY
--   fa_quarterly is keyed (symbol, period) and upsert_quarterly writes with
--   on_conflict="symbol,period". There is no record of WHERE a row came from,
--   so pointing an automated vnstock importer at that table would silently
--   overwrite rows imported by hand from a FiinProX spreadsheet.
--
--   The requirement is the opposite: the Excel importer must remain the
--   OVERRIDE, so that re-importing a file is how you correct anything the
--   automation gets wrong. That needs the writer to be able to tell the two
--   apart, which needs this column.
--
-- PRECEDENCE (enforced in scripts/refresh_fa_auto.py, not by a constraint —
-- a constraint cannot express "skip", only "reject")
--   no row          -> INSERT source='vnstock'
--   source='vnstock'-> UPDATE
--   source='fiinpro'-> skip, never touched
--
-- THE SECOND GUARD IS A PERIOD BOUNDARY, and it is the one that protects
-- history: 2026-Q2 and everything before it is frozen, vnstock writes 2026-Q3
-- onward. Two independent guards because a bug in either one alone would be
-- silent. See FA_AUTO_IMPORT_DESIGN.md §7.
--
-- Existing rows are all FiinProX by definition — nothing else has ever written
-- these tables — so the backfill below is a statement of fact, not a guess.
-- ============================================================

alter table fa_quarterly
  add column if not exists source text not null default 'fiinpro';

alter table fa_quarterly
  drop constraint if exists fa_quarterly_source_check;
alter table fa_quarterly
  add constraint fa_quarterly_source_check check (source in ('fiinpro', 'vnstock'));

comment on column fa_quarterly.source is
  'Which importer wrote this row. fiinpro = manual Excel import (wins on '
  'conflict, and is the override path); vnstock = automated, 2026-Q3 onward.';

-- Same shape for the real-estate raw inputs, so the RE rubric can follow the
-- same route later without a second migration pattern to remember.
alter table fa_re_metrics
  add column if not exists source text not null default 'fiinpro';

alter table fa_re_metrics
  drop constraint if exists fa_re_metrics_source_check;
alter table fa_re_metrics
  add constraint fa_re_metrics_source_check check (source in ('fiinpro', 'vnstock'));

-- The importer's hot query is "symbols whose newest period is behind the
-- expected one", which reads (symbol, period) newest-first.
create index if not exists idx_fa_quarterly_symbol_period_desc
  on fa_quarterly (symbol, period desc);

analyze fa_quarterly;
