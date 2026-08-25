-- ============================================================
-- Migration: Business Analysis — one hand-written note per symbol
--
-- WHY THIS EXISTS
--   Everything the Analysis page shows about a company is COMPUTED: the FA
--   rubric turns a balance sheet into 0-100, the TA pipeline turns bars into a
--   grade. None of it can say what the company actually does, why this quarter
--   looked the way it did, or what the analyst is waiting to see next. That
--   judgement exists — it is just written down somewhere the site cannot read.
--
--   This is where it lives. One row per symbol, markdown, written by an admin
--   on /input and rendered on /analysis/<symbol>. Deliberately NOT part of any
--   score: it is context beside the numbers, never an input to them.
--
-- WHY MARKDOWN, AND WHY ONE COLUMN
--   The note is prose with the occasional heading, list or table — the same
--   shape as `daily_logs.full_response`, which the app already renders with
--   react-markdown. Structuring it into fields would force every note into one
--   template, and the whole point is that what matters about a bank is not what
--   matters about a property developer.
--
-- HISTORY IS NOT KEPT.
--   `symbol` is the primary key and a save overwrites. This is a current view
--   of a business, not a dated record of a call — that is what the trading
--   journal (migration 049) is for, and conflating the two would invite exactly
--   the hindsight-rewriting that migration went out of its way to prevent.
--   `updated_at` says when the view was last revised, which is the one piece of
--   provenance a reader needs to judge how stale it is.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

create table if not exists business_analysis (
  symbol      text primary key,
  content     text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

comment on table business_analysis is
  'Hand-written markdown commentary per symbol, shown on the Analysis page. '
  'Never an input to any score. One row per symbol — a save replaces, no history.';

comment on column business_analysis.content is
  'Markdown. Rendered with react-markdown + remark-gfm, the same pipeline as '
  'daily_logs.full_response. Stored verbatim, never sanitised at write time — '
  'the renderer is what escapes HTML, so nothing here is trusted markup.';

comment on column business_analysis.updated_by is
  'The admin who last saved. ON DELETE SET NULL so removing a user leaves the '
  'note itself intact — the content is the asset, the authorship is metadata.';

-- No index beyond the primary key: reads are always a single-symbol lookup by
-- exact key, and the whole table is one row per tracked company.

-- ------------------------------------------------------------
-- RLS — the shape migration 045 established: anon READS, nobody writes.
--
-- The anon key ships inside the client bundle, so a write policy for anon is a
-- write policy for the public internet. Saving goes through the service-role
-- key in /api/business-analysis, which bypasses RLS entirely and is gated on
-- the caller's admin role in the route.
-- ------------------------------------------------------------
alter table business_analysis enable row level security;

drop policy if exists "business_analysis anon read" on business_analysis;
create policy "business_analysis anon read"
  on business_analysis for select
  to anon, authenticated
  using (true);

-- Deliberately no insert/update/delete policy. With RLS on and no policy, both
-- roles are refused; the service role never consults policies at all.
