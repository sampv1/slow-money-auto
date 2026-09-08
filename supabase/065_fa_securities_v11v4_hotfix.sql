-- 065 — CTCK V11v4 UI hotfix: broker market share, margin growth, narratives.
--
-- Three things the summary tab could not say honestly, from BA's V11v4 review.
--
-- 1. BROKER MARKET SHARE (C4) gets a real table rather than a constant in code.
--    C4 has been N/A for the whole sector since V8 because the HOSE/HNX
--    quarterly release is not in our data provider. BA now supplies it, and it
--    is a RECURRING quarterly input, so it needs somewhere the pipeline can
--    re-read each quarter — sheet 45's upload schema, which is what this table
--    is.
--
--    `source_date` IS NOT OPTIONAL, and that is the whole point. The scorer
--    replays 242 past sessions; applying a Q2/2026 figure to a session in 2025
--    would be look-ahead, which AT18 forbids outright. The publication date is
--    what makes a share figure usable from a specific session onward, so a row
--    without one cannot be scored point-in-time and the column is NOT NULL.
--    `exchange_scope` is equally required: sheet 45's C45-01 voids C5 when two
--    periods are compared across different scopes, and a share of HOSE is not
--    a share of the whole market.
--
-- 2. MARGIN BOOK GROWTH is stored as its two components. C7 scores a 70/30
--    blend of YoY and QoQ, and the tab was showing C7's SCORE ("3/3") under a
--    column headed "margin book growth". The blend is not a growth rate anyone
--    reads; the components are the fact, the score is our opinion of it.
--
-- 3. NARRATIVE FIELDS are qualitative and Research-owned. They were rendered as
--    "chưa có dữ liệu" repeated down three columns, which reads as a broken
--    page rather than as content nobody has written yet. They are stored, never
--    derived: a business model inferred from C1-C20 would be the system
--    inventing an opinion and presenting it as research.

create table if not exists fa_broker_market_share (
  symbol          text        not null,
  period          text        not null,          -- 'YYYY-Qn'
  exchange_scope  text        not null,          -- HOSE | HNX | UPCOM | ALL
  market_share_pct numeric    not null check (market_share_pct >= 0
                                              and market_share_pct <= 100),
  rank            integer,
  source          text        not null default 'HOSE',
  source_url      text,
  -- The publication date, NOT the period end. A point-in-time score may only
  -- use this row from a session on or after it.
  source_date     date        not null,
  verified_by     text,
  uploaded_at     timestamptz not null default now(),
  version         text        not null default 'C4_OFFICIAL_V1',
  primary key (symbol, period, exchange_scope)
);

alter table fa_broker_market_share enable row level security;
drop policy if exists "Public read" on fa_broker_market_share;
create policy "Public read" on fa_broker_market_share for select using (true);

comment on table fa_broker_market_share is
  'Quarterly broker market share from the exchange release (V11v4 sheet 45). '
  'The ONLY source C4 may score OFFICIAL from — a press article is reference, '
  'never the stored source.';
comment on column fa_broker_market_share.source_date is
  'PUBLICATION date, not period end. The scorer may use a row only from a '
  'session on or after this date; without it a backfilled session would be '
  'scored on a figure that did not exist yet (AT18 look-ahead).';
comment on column fa_broker_market_share.exchange_scope is
  'Whose market the share is OF. C5 compares two periods and sheet 45 C45-01 '
  'voids it across differing scopes, so this travels with every figure.';

alter table fa_securities_scores
  add column if not exists margin_loan_growth_yoy_pct numeric,
  add column if not exists margin_loan_growth_qoq_pct numeric,
  add column if not exists business_model_summary     text,
  add column if not exists key_driver_summary         text,
  add column if not exists key_risk_summary           text,
  add column if not exists narrative_as_of_date       date,
  add column if not exists narrative_source           text,
  add column if not exists narrative_status           text;

alter table fa_securities_scores
  drop constraint if exists fa_securities_scores_narrative_status_check;
alter table fa_securities_scores
  add constraint fa_securities_scores_narrative_status_check
  check (narrative_status is null
         or narrative_status in ('PENDING', 'PUBLISHED', 'STALE'));

comment on column fa_securities_scores.margin_loan_growth_yoy_pct is
  'Margin book growth year on year, as a ratio. Displayed as a percentage; '
  'C7''s score is a sub-line beneath it, never a substitute for it.';
comment on column fa_securities_scores.narrative_status is
  'PENDING until Research writes one. The UI renders "Chưa cập nhật" — never '
  'a summary derived from C1-C20, which would present a computed opinion as '
  'analyst copy.';

-- Verification
--   select symbol, period, exchange_scope, market_share_pct, source, source_date
--     from fa_broker_market_share order by market_share_pct desc;
--
--   -- a share figure must never be used before it was published
--   select count(*) from fa_securities_scores s
--     join fa_broker_market_share m on m.symbol = s.symbol
--    where s.c4_score is not null and s.as_of_date < m.source_date;   -- expect 0
