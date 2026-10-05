-- Migration 080: quarterly business results for the insurance overview tab.
--
-- BA `FINAL_BA_FIX_HOLDING_INTEGRATION_ADD_QUARTERLY_KQKD_2026-10-05.md` §13.
--
-- FOUR FIGURES, NO SCORE. Revenue for the quarter, its YoY, parent net profit
-- for the quarter, its YoY. Nothing here reaches a rubric — §0 and §17 are
-- explicit that this round does not reopen scoring — which is also why it is a
-- table of its own rather than more columns on a score table: a reader of
-- `fa_insurance_scores` should not have to ask which of its columns are scored.
--
-- WHY THE PRIOR-PERIOD FIGURES ARE STORED TOO ------------------------------
-- §13 lists the four results and their statuses; the two base figures are
-- added because a YoY nobody can re-derive is a number you have to trust. With
-- `quarter_revenue_prev` on the row, the percentage is checkable from the row
-- alone, and `kqkd_source_period` names the quarter it was taken from.
--
-- A YoY AGAINST A NON-POSITIVE BASE IS A STATE, NOT A PERCENTAGE (§7.4) -----
-- Dividing by a loss inverts the sign: a company going from −100 to +50
-- computes as −150%, which reads as a collapse. So those rows carry a status
-- and NO number, and the check constraint ties the two together — a percentage
-- may exist only where the status says it was calculated.
--
-- `revenue_basis` RECORDS WHETHER THE SOURCE WAS ALREADY PER-QUARTER --------
-- §7.1 gives a YTD subtraction to use if the provider reports cumulatively.
-- Measured over the 13 insurers, 89 of 97 symbol-years reconcile to their
-- annual within 0.5% and the worst is 3.3% — audit restatements, not
-- accumulation, since a cumulative series would sum to roughly 2.5x its annual.
-- The basis travels on the row so a provider change is visible, not silent.

create table if not exists fa_insurance_quarter_results (
  symbol text not null,
  period text not null,                        -- calendar quarter 'YYYY-Qn'

  -- --- the four figures (§6) ----------------------------------------------
  -- Stored in đồng, as the provider reports them. The UI divides by 1e9 for
  -- its "tỷ" column; storing the rounded billions would make the YoY
  -- unverifiable against the source.
  quarter_revenue        numeric(20,2),
  quarter_revenue_prev   numeric(20,2),
  quarter_revenue_yoy    numeric(12,4),
  quarter_revenue_status text not null,

  quarter_net_profit        numeric(20,2),
  quarter_net_profit_prev   numeric(20,2),
  quarter_net_profit_yoy    numeric(12,4),
  quarter_net_profit_status text not null,

  -- --- provenance (§13) ---------------------------------------------------
  kqkd_source_period text,                     -- the year-ago quarter compared
  revenue_basis text not null,                 -- DIRECT_QUARTER | DERIVED_FROM_YTD
  profit_scope  text not null,                 -- PARENT_SHAREHOLDERS
  kqkd_mapping_version text not null,
  calculated_at timestamptz not null default now(),

  constraint insurance_kqkd_revenue_status_values
    check (quarter_revenue_status in ('CALCULATED', 'LOSS_TO_PROFIT',
                                      'PROFIT_TO_LOSS', 'NOT_MEANINGFUL',
                                      'NO_PRIOR_PERIOD', 'NO_CURRENT_PERIOD')),
  constraint insurance_kqkd_profit_status_values
    check (quarter_net_profit_status in ('CALCULATED', 'LOSS_TO_PROFIT',
                                         'PROFIT_TO_LOSS', 'NOT_MEANINGFUL',
                                         'NO_PRIOR_PERIOD', 'NO_CURRENT_PERIOD')),
  constraint insurance_kqkd_basis_values
    check (revenue_basis in ('DIRECT_QUARTER', 'DERIVED_FROM_YTD')),

  -- A percentage exists exactly where it was calculated. Without this, "0%
  -- growth" and "could not be compared" are both a NULL with a status nobody
  -- reads — the distinction §7.4's states exist to keep.
  constraint insurance_kqkd_revenue_pct_matches_status
    check ((quarter_revenue_status = 'CALCULATED') = (quarter_revenue_yoy is not null)),
  constraint insurance_kqkd_profit_pct_matches_status
    check ((quarter_net_profit_status = 'CALCULATED') = (quarter_net_profit_yoy is not null)),

  primary key (symbol, period, kqkd_mapping_version)
);

comment on table fa_insurance_quarter_results is
  'Quarterly revenue and parent net profit with their YoY, for the insurance '
  'overview tab. DISPLAY ONLY — no rubric reads it (BA §0, §17).';
comment on column fa_insurance_quarter_results.quarter_revenue is
  'Net insurance revenue for the SINGLE quarter, in đồng. The same line C3 '
  'scores, so the displayed DT YoY and C3''s own figure cannot disagree.';
comment on column fa_insurance_quarter_results.profit_scope is
  'Which profit line was taken. PARENT_SHAREHOLDERS matches the scope behind '
  'EPS and C4, as BA §7.3 prefers.';

alter table fa_insurance_quarter_results enable row level security;
drop policy if exists "fa_insurance_quarter_results read" on fa_insurance_quarter_results;
create policy "fa_insurance_quarter_results read" on fa_insurance_quarter_results
  for select using (true);

create index if not exists fa_insurance_quarter_results_period_idx
  on fa_insurance_quarter_results (period, symbol);

-- ---------------------------------------------------------------------------
-- VERIFY
--
-- 1. Every calculated YoY reconciles against the two figures it compares.
--    Expect ZERO rows:
--
--   select symbol, period, quarter_revenue, quarter_revenue_prev, quarter_revenue_yoy
--     from fa_insurance_quarter_results
--    where quarter_revenue_status = 'CALCULATED'
--      and abs(quarter_revenue_yoy
--              - ((quarter_revenue / quarter_revenue_prev) - 1) * 100) > 0.0001;
--
-- 2. Same for profit. Expect ZERO rows:
--
--   select symbol, period from fa_insurance_quarter_results
--    where quarter_net_profit_status = 'CALCULATED'
--      and abs(quarter_net_profit_yoy
--              - ((quarter_net_profit / quarter_net_profit_prev) - 1) * 100) > 0.0001;
--
-- 3. No percentage was produced against a non-positive base. Expect ZERO rows:
--
--   select symbol, period, quarter_net_profit_prev, quarter_net_profit_yoy
--     from fa_insurance_quarter_results
--    where quarter_net_profit_yoy is not null and quarter_net_profit_prev <= 0;
--
-- 4. The compared quarter is exactly four quarters back. Expect ZERO rows:
--
--   select symbol, period, kqkd_source_period from fa_insurance_quarter_results
--    where kqkd_source_period is not null
--      and kqkd_source_period <> (left(period, 4)::int - 1) || substr(period, 5);
--
-- 5. The overview universe is covered for the latest quarter. Expect 13:
--
--   select count(*) from fa_insurance_quarter_results where period = '2026-Q2';
