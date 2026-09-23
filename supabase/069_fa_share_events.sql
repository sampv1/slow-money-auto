-- ============================================================
-- Migration: fa_share_events + fa_share_adjustments
--
-- Chart 11 (CANSLIM EPS Diagnostic) needs EPS restated per IAS 33 / VAS 30:
-- a stock dividend or bonus issue must be applied BACKWARDS to every earlier
-- quarter, while a placement, rights issue or ESOP must NOT be — the whole
-- point of the chart is that real dilution pulls the current quarter's EPS down
-- and raises a warning. BA's spec calls these Nhóm 1 and Nhóm 2.
--
-- NOTHING IN THE SYSTEM COULD TELL THEM APART. `fa_vnstock_statements` says the
-- share count changed (charter capital / 10,000 par) but not why, and
-- `corporate_actions` — the only existing event log — is populated by DETECTING
-- price gaps, so its `kind` column reads 'unknown' on all 615 rows. Migration
-- 043 says as much in its own header: "Only the corporate announcement gives
-- the type." This is that announcement feed.
--
-- TWO TABLES, because they answer two different questions:
--
--   fa_share_events       what was ANNOUNCED. One row per provider event. The
--                         durable record; re-classifying never needs a refetch.
--   fa_share_adjustments  per (symbol, quarter): the filed share change, and the
--                         technical factor the announcements justify for THAT
--                         quarter.
--
-- EVERY STORED NUMBER IS LOCAL TO ITS OWN QUARTER, AND THE RECONCILIATION IS
-- DELIBERATELY NOT STORED. BA's formula is K(Q_i -> Q_0), relative to the newest
-- quarter; stored that way every row would go stale the moment a new quarter
-- landed. Worse, a per-quarter reconciliation is simply WRONG, because the
-- ex-right date and the listing date fall in different quarters — measured on
-- BIG, whose 6% stock dividend went ex on 26/06/2025 (Q2) while charter capital
-- moved 15.08m -> 15.99m in Q3. Reconciling Q2 alone would reject a real bonus
-- (factor 1.06 against a filed 1.00) and then read Q3's +6% as dilution:
-- both quarters wrong, from a lag BA explicitly anticipated ("trường hợp bị trễ
-- thì ghi chú"). So the consumer takes the product over its own window and
-- reconciles CUMULATIVELY, where a lag inside the window self-corrects.
--
-- WHY RECONCILING AT ALL. Measured on the live feed: of 12 symbols whose share
-- count grew, 8 were explained exactly by their announcements and 4 were not —
-- ABW announced a 200% rights issue on 31/12/2025 that never reached the share
-- count (announced, never executed; blind use overstates by 2x), BMS's 175.8%
-- placement looks part subscribed (events imply 2.91x, filed 2.58x), KSF's
-- stock-for-stock merger carries ratio 0, and BIG's events imply 2.14x against a
-- filed 2.27x. The announcement is the LABEL, the balance sheet is the TOTAL,
-- and where the two disagree the chart draws unadjusted and says so.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ---------------------------------------------------------------- events ----
create table if not exists fa_share_events (
  symbol text not null,
  -- The provider's own event id. Stable across refetches, which is what makes
  -- this an upsert rather than a delete-and-reload: a reload would drop any
  -- event the feed has since aged out of its 50-row-per-symbol cap.
  event_id text not null,
  -- 'ISS' (Phát hành cổ phiếu) or 'AIS' (Niêm yết thêm). AIS carries the share
  -- COUNT in its title and no ratio, so it is kept for the audit trail and for
  -- explaining a listing lag, never for computing a factor.
  event_code text not null,
  title_en text,
  title_vi text,
  -- 1 = non-dilutive / technical (cổ tức bằng cổ phiếu, cổ phiếu thưởng, chia
  --     tách) -> restate earlier quarters.
  -- 2 = real dilution (phát hành riêng lẻ, quyền mua có thu tiền, ESOP, chào
  --     bán ra công chúng, hoán đổi sáp nhập) -> never restate.
  -- NULL = the title matched no known kind. DELIBERATELY NOT DEFAULTED: a new
  --     provider wording must make the quarter unusable and visible, not land
  --     silently in whichever group happens to be safer.
  event_group smallint check (event_group in (1, 2)),
  -- Shares issued per existing share, as the provider quotes it: 0.17 for
  -- "Stock dividend ratio 17.0%". NULL or 0 where the title carries no ratio
  -- (a merger, an undated placement) — which is why a Group 1 event with no
  -- usable ratio has to fail closed rather than contribute 1.0.
  ratio numeric,
  -- BA's chosen anchor for Nhóm 1 (reply lần 2): the exchange adjusts the
  -- reference price on the ex-date, so the event is certain from that session.
  -- Often NULL on a Nhóm 2 event, which has no ex-date until the issue result
  -- is published — hence Nhóm 2 being taken as the residual, never announced.
  exright_date date,
  public_date date,
  record_date date,
  -- When the new shares were admitted to trading. This is when charter capital
  -- moves, one to two quarters AFTER exright_date (VHM: ex-right 06/08/2026,
  -- listed 09/09/2026), and is why reconciliation must be cumulative.
  listing_date date,
  fetched_at timestamptz not null default now(),
  primary key (symbol, event_id)
);

comment on table fa_share_events is
  'Corporate share-issue announcements from the provider event feed, classified '
  'into BA''s Nhóm 1 (technical) / Nhóm 2 (dilutive). Source of the IAS 33 '
  'restatement factor for chart 11. event_group NULL means the title was not '
  'recognised, and every window containing it must fail closed.';

create index if not exists fa_share_events_symbol_ex_idx
  on fa_share_events (symbol, exright_date);

-- ----------------------------------------------------------- adjustments ----
create table if not exists fa_share_adjustments (
  symbol text not null,
  -- Calendar quarter, 'YYYY-Qn', matching fa_quarterly and the statement store.
  period text not null,
  -- Issued shares at the quarter's balance-sheet date: BS_CHARTER_CAPITAL /
  -- 10,000 par. BA confirmed issued rather than outstanding (reply lần 1 Q7):
  -- treasury stock is carried only as a VND cost, so an outstanding count
  -- cannot be derived from it. 100% coverage, against 3% for the provider's own
  -- outstanding-share field.
  shares numeric,
  shares_prev numeric,
  -- shares / shares_prev: what the FILED balance sheet says happened. The fact
  -- the announcements are checked against.
  total_ratio numeric,
  -- The IAS 33 factor this quarter's ANNOUNCEMENTS justify: the product, over
  -- distinct ex-dates falling in this quarter, of (1 + that date's summed
  -- Nhóm 1 ratios). 1.0 when nothing technical went ex in the quarter.
  --
  -- ADDITIVE WITHIN AN EX-DATE, MULTIPLICATIVE ACROSS THEM, and that is
  -- measured rather than assumed: GIC ran a 100% rights issue and a 10% stock
  -- dividend on the SAME ex-date (02/03/2026) and its share count went to
  -- exactly 2.10x, not 2.20x — ratios on one date are quoted against the same
  -- pre-event base. CDC's two events fell in different quarters and compounded
  -- to exactly 2.40x.
  k_technical numeric not null default 1,
  -- The same product over ALL groups, for the audit trail: it is what the
  -- announcements predict the filed change should be, so `announced_ratio`
  -- against `total_ratio` is the reconciliation a human can read off the row.
  announced_ratio numeric,
  -- Per-ROW data quality, never a verdict on the window. False when the share
  -- count is missing, a title was unrecognised, or a Nhóm 1 event in the
  -- quarter carries no usable ratio. A window containing any false row is
  -- drawn unadjusted.
  data_ok boolean not null default true,
  -- Machine-readable reason so the UI can say WHICH problem it was rather than
  -- printing one generic sentence. See fa/share_events.py REASONS.
  reason text not null,
  computed_at timestamptz not null default now(),
  primary key (symbol, period)
);

comment on table fa_share_adjustments is
  'Per-quarter IAS 33 inputs for chart 11 and the EPS_adj rubric. Every column '
  'is LOCAL to its own quarter: a consumer takes the product of k_technical '
  'over later quarters to get BA''s K(Q_i -> Q_0), and reconciles CUMULATIVELY '
  'over its window — a per-quarter check is wrong, because ex-right and listing '
  'fall in different quarters (see the migration header on BIG).';

create index if not exists fa_share_adjustments_symbol_idx
  on fa_share_adjustments (symbol, period);

-- RLS: anon is READ-ONLY everywhere (migration 045); writes use the service key.
alter table fa_share_events enable row level security;
alter table fa_share_adjustments enable row level security;

drop policy if exists "fa_share_events anon read" on fa_share_events;
create policy "fa_share_events anon read" on fa_share_events for select using (true);

drop policy if exists "fa_share_adjustments anon read" on fa_share_adjustments;
create policy "fa_share_adjustments anon read" on fa_share_adjustments for select using (true);
