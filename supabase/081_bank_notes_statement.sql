-- ============================================================
-- Migration 081: admit 'note' as a statement kind
--
-- WHY
--   The ten bank charts (BANK_CHARTS_DESIGN.md) need figures that live in the
--   THUYẾT MINH, not in the four primary statements: nợ nhóm 2/3/4/5 (chart 3),
--   the short/medium/long-term loan split (chart 2's Proxy SML) and the
--   investment-book corporate bond line (chart 4).
--
--   We first concluded this data was unobtainable. That was wrong, and the
--   reason is worth recording: vnstock's `Finance` class maps only four
--   sections (`_IQ_FINANCE_REPORT` in explorer/vci/const.py), so the notes look
--   absent through that lens. The PROVIDER serves them —
--       GET /v1/company/{symbol}/financial-statement?section=NOTE
--   returns `nob1..nob219` for 29/29 banks over 18-34 quarters. The limit was
--   the client library, not the source.
--
-- WHY NOT A NEW TABLE
--   `fa_vnstock_statements` is already keyed (symbol, period, period_type,
--   statement) with a jsonb `items`, which is exactly this shape. The chart
--   layer's `buildFrames` buckets by `statement`, so admitting one more kind
--   costs one branch instead of a parallel loader, a parallel cache tag and a
--   second way for a period to go missing. Same reasoning as 055 itself: adding
--   a metric must not need a migration.
--
-- WHAT IS STORED
--   STABLE SEMANTIC IDS, never `nobN`. The nob index is a positional handle
--   into one payload and it is NOT uniformly meaningful across banks -- `nob4`
--   matched TCB's CAR on 34/34 periods purely by coinciding zeros and is in
--   fact a money amount, and nob66/nob67 disagree with RT_BANK_CASA on 7 of 27
--   banks. Only fields that passed an INDEPENDENT reconciliation are written,
--   under the provider's own NT_* names:
--     NT_BS_LOANS_AND_ADVANCES_BY_GRADING  == BS_LOANS_TO_CUSTOMERS_GROSS, 0.0% on 28/28
--     NT_BS_SPECIAL_MENTIONED / _SUBSTANDARD / _DOUBTFUL / _BAD
--                                          -> NPL reproduces RT_BANK_NPL on 27/27
--     NT_BS_SHORT_TERM_LOANS / _MEDIUM_TERM_LOANS / _LONG_TERM_LOANS
--                                          -> sums to the graded total, 0.0% on 28/28
--     NT_BS_INVESTMENT_SECURITIES_SECURITIES_ISSUED_BY_LOCAL_ECONOMIC_ENTITIES
--                                          -> bounded by BS_INVESTMENT_SECURITIES at ingest
--
--   CASA and CAR are deliberately NOT taken from the notes: `RT_BANK_CASA` and
--   `RT_BANK_CAR` are already loaded, already populated, and are the provider's
--   own computation of the same thing.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

alter table fa_vnstock_statements
  drop constraint if exists fa_vnstock_statements_statement_check;

alter table fa_vnstock_statements
  add constraint fa_vnstock_statements_statement_check
  check (statement in ('income', 'balance', 'cashflow', 'ratio', 'note'));

comment on column fa_vnstock_statements.statement is
  'income | balance | cashflow | ratio from the four primary statements; '
  'note from the thuyết minh (VCI section=NOTE), written only for banks and '
  'only for fields that passed an independent reconciliation -- see 081.';

-- VERIFY (expect: the four existing kinds unchanged, and a 'note' insert accepted)
--   select statement, count(*) from fa_vnstock_statements group by 1 order by 1;
