-- 066 — CTCK V11v5: separate a share figure's PUBLICATION date from the date it
-- becomes usable, and record what kind of source it came from.
--
-- 1. `effective_from` IS NOT THE SAME DATE AS `source_date`, AND V11v5 IS THE
--    CASE THAT PROVES IT.
--
--    065 keyed the point-in-time rule on `source_date` because publication is
--    what makes a figure knowable, and for a filing released during a session
--    the two dates coincide. BA's Q2/2026 release does not: the HOSE numbers
--    were published at 16:30 on 06/07/2026 — AFTER the close — so the first
--    session that could have traded on them is 07/07/2026. Sheet 53 pins
--    exactly that boundary (TC-C4-PIT-01: VCI as-of 06/07 is N/A; TC-C4-PIT-02:
--    as-of 07/07 scores 3/4).
--
--    Collapsing them by storing 07/07 in `source_date` would score correctly
--    and lie in the audit trail: the column whose entire job is preventing
--    look-ahead would hold a date the source was not published on, and BA's
--    rule ("published after the close ⇒ usable next session") would exist
--    nowhere a reader could check it. So the publication timestamp stays put
--    and the usable-from date becomes its own column. The scorer reads
--    `effective_from`; `source_date` is the evidence it was derived from.
--
--    It is NOT NULL with a default of `source_date`, which is the correct
--    answer for any figure published while the market was open — the existing
--    behaviour, now stated rather than assumed.
--
-- 2. `source_type` records that the Q2/2026 figures reach us through a press
--    article quoting HOSE, not through a HOSE filing.
--
--    065's table comment said a press article is reference and never the
--    stored source. BA overrides that deliberately and with conditions: the
--    figures are BA-verified, typed SECONDARY_QUOTING_HOSE, and sheet 45 says
--    to swap in the official HOSE URL when it appears WITHOUT re-scoring if the
--    number is unchanged. That is a reasonable call, but it must not be
--    invisible — a secondary source silently filed as `source = 'HOSE'` would
--    read as a primary filing forever. The type travels with the row, so
--    "which of these came from an article?" is a query and not an
--    archaeological dig.

alter table fa_broker_market_share
  add column if not exists effective_from date,
  add column if not exists source_type    text;

-- Existing rows (there are none in production yet, but the backfill must be
-- correct if any were loaded) inherit publication date = effective date.
update fa_broker_market_share
   set effective_from = source_date
 where effective_from is null;

alter table fa_broker_market_share
  alter column effective_from set not null;

alter table fa_broker_market_share
  drop constraint if exists fa_broker_market_share_effective_after_source;
alter table fa_broker_market_share
  add constraint fa_broker_market_share_effective_after_source
  check (effective_from >= source_date);

alter table fa_broker_market_share
  drop constraint if exists fa_broker_market_share_source_type_check;
alter table fa_broker_market_share
  add constraint fa_broker_market_share_source_type_check
  check (source_type is null
         or source_type in ('PRIMARY_EXCHANGE',
                            'SECONDARY_QUOTING_HOSE',
                            'SECONDARY_QUOTING_HNX',
                            'BA_VERIFIED'));

comment on column fa_broker_market_share.effective_from is
  'The first session that may use this figure. Defaults to source_date and is '
  'LATER when the source was published after the close — the Q2/2026 release '
  'went out at 16:30 on 06/07/2026, so effective_from is 07/07/2026 (V11v5 '
  'sheet 53, TC-C4-PIT-01/02). The scorer filters on THIS column.';
comment on column fa_broker_market_share.source_date is
  'PUBLICATION date of the source, kept as evidence. It no longer gates the '
  'scorer — effective_from does — because a figure published after the close '
  'is not usable in that session.';
comment on column fa_broker_market_share.source_type is
  'Where the number physically came from. SECONDARY_QUOTING_HOSE is a press '
  'article quoting the exchange: sanctioned by V11v5 sheet 45 when BA has '
  'verified it, replaceable by the official URL later with no re-scoring if '
  'the figure is unchanged. Recorded so a secondary source can never pass as '
  'a primary filing.';
comment on table fa_broker_market_share is
  'Quarterly broker market share, the only source C4 may score OFFICIAL from '
  '(V11v5 sheet 45). A press article quoting the exchange is admissible when '
  'BA has verified it and `source_type` says so.';

-- Verification
--   select symbol, market_share_pct, source_date, effective_from, source_type
--     from fa_broker_market_share order by market_share_pct desc;
--   -- expect 7 rows, source_date 2026-07-06, effective_from 2026-07-07
--
--   -- no score may predate the date its figure became usable
--   select count(*) from fa_securities_scores s
--     join fa_broker_market_share m on m.symbol = s.symbol
--    where s.c4_score is not null and s.as_of_date < m.effective_from;  -- 0
