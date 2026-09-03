-- ============================================================
-- Migration: Business Analysis — MANY reports per symbol, each with a header
--
-- WHAT CHANGES
--   Migration 053 made `symbol` the primary key, so a symbol held exactly one
--   note and a save overwrote it. A company gets a new report every quarter,
--   and the previous one does not stop being true — it becomes the record of
--   what the desk thought last quarter, which is the thing a reader compares
--   this quarter against. Overwriting it threw that away with no history to
--   recover from.
--
--   So: `id` becomes the key, `symbol` becomes an ordinary indexed column, and
--   a symbol may carry as many reports as have been written. The Analysis page
--   opens the newest and lists the rest collapsed beneath it.
--
-- WHY A SEPARATE `title` COLUMN
--   The collapsed list has to say what each old report IS, and the only thing
--   that can say it is the report's own headline. Today that headline is the
--   first line of `content` — an `# H1` in every one of the 57 stored rows —
--   so a list would have to parse markdown to build a table of contents, and
--   would silently produce a blank row the day someone opens with a paragraph.
--   Splitting it out makes the header a field the editor asks for, which is
--   the whole point of the Input page's new two-box layout.
--
--   The backfill below LIFTS that H1 out of `content` rather than copying it.
--   Copying would render the headline twice on every existing report.
--
-- WHY `created_at` ORDERS THE LIST, NOT `updated_at`
--   `updated_at` moves on every edit, so fixing a typo in the Q1 report would
--   promote it above Q2 — the list would reorder itself as a side effect of
--   proof-reading. `created_at` is stamped once and never moves, so the order
--   the reader sees is publication order, which is the order they mean when
--   they say "the latest one". `updated_at` keeps its own job: how stale the
--   text is.
--
--   The cost, stated plainly: a report BACKFILLED long after the period it
--   covers sorts by when it was typed, not by what it is about. There is no
--   third field to disambiguate that, deliberately — the editor asks for a
--   header and a body, and a date picker on top of those would be a field to
--   get wrong on every ordinary save to serve the rare one.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The new columns. Added nullable / backfilled / then constrained, because
--    57 rows already exist and none of them can answer for a NOT NULL column
--    at the moment it appears.
-- ------------------------------------------------------------
alter table business_analysis
  add column if not exists id         uuid not null default gen_random_uuid(),
  add column if not exists title      text,
  add column if not exists created_at timestamptz;

-- An existing row was written once and never republished, so the moment it was
-- last saved is the best available stand-in for when it was published.
update business_analysis set created_at = updated_at where created_at is null;

alter table business_analysis alter column created_at set default now();
alter table business_analysis alter column created_at set not null;

-- ------------------------------------------------------------
-- 2. Lift the leading `# Heading` out of content into title.
--
--    Verified against the live table before writing this: all 57 rows begin
--    with `# `, and the heading is the report's full headline (73-152 chars),
--    which is exactly what the collapsed list needs to show. The `~` guard
--    means a row shaped any other way is left for the fallback below rather
--    than having its first line mangled into a title.
-- ------------------------------------------------------------
update business_analysis
   set title   = btrim(regexp_replace(substring(content from '^[[:space:]]*#[^\n]*'),
                                      '^[[:space:]]*#+[[:space:]]*', ''),
                       E' \t\r\n'),
       content = btrim(regexp_replace(content, '^[[:space:]]*#[^\n]*(\n|$)', ''), E' \t\r\n')
 where title is null
   and content ~ '^[[:space:]]*#[[:space:]]';

-- Anything with no heading to lift still needs a header, and the two things
-- known about it are which company it is about and when it was written.
update business_analysis
   set title = symbol || ' — ' || to_char(created_at, 'DD/MM/YYYY')
 where title is null;

alter table business_analysis alter column title set not null;

-- A whitespace-only header would pass NOT NULL and render as a blank row in
-- the collapsed list — an entry the reader cannot identify and cannot avoid
-- clicking. The API rejects it too; this is the backstop.
alter table business_analysis drop constraint if exists business_analysis_title_not_blank;
alter table business_analysis add constraint business_analysis_title_not_blank
  check (btrim(title) <> '');

-- ------------------------------------------------------------
-- 3. Re-key. Dropping by name and recreating is what makes this re-runnable
--    (same shape as migration 054's CHECK constraint).
-- ------------------------------------------------------------
alter table business_analysis drop constraint if exists business_analysis_pkey;
alter table business_analysis add constraint business_analysis_pkey primary key (id);

-- The only query shape there is: every report for one symbol, newest first.
-- `id` is in the sort key so two reports saved in the same clock tick still
-- come back in a fixed order — a list that changes order between two renders
-- of the same data is a page that looks broken.
create index if not exists business_analysis_symbol_created_idx
  on business_analysis (symbol, created_at desc, id desc);

-- ------------------------------------------------------------
-- 4. Re-comment. The 053 comments say "one row per symbol — a save replaces",
--    which is now the opposite of the truth.
-- ------------------------------------------------------------
comment on table business_analysis is
  'Hand-written markdown reports, shown on the Analysis page. Never an input to '
  'any score. MANY rows per symbol (migration 058): the newest opens, the rest '
  'collapse beneath it under their own headers.';

comment on column business_analysis.title is
  'The report''s headline, shown as its heading when open and as its only '
  'identifier when collapsed. Plain text, not markdown — it is rendered as a '
  'heading element, so a `#` here would print literally.';

comment on column business_analysis.content is
  'Markdown, WITHOUT the headline (that is `title`). Rendered with '
  'react-markdown + remark-gfm, the same pipeline as daily_logs.full_response. '
  'Stored verbatim, never sanitised at write time — the renderer is what '
  'escapes HTML, so nothing here is trusted markup.';

comment on column business_analysis.created_at is
  'When the report was published. Never moves — this is what orders the list, '
  'so that editing an old report does not promote it above a newer one.';

comment on column business_analysis.updated_at is
  'When the text was last revised. Provenance for the reader, not an ordering '
  'key.';

-- ------------------------------------------------------------
-- RLS is unchanged and still correct: anon/authenticated SELECT, no write
-- policy for anyone. Writes go through the service-role key in
-- /api/business-analysis, gated on the caller's admin/analyst role.
-- ------------------------------------------------------------

-- Verify — expect 57 rows, every title non-empty, no content still starting
-- with a heading, and one distinct id per row:
--   select count(*) as rows,
--          count(distinct id) as ids,
--          count(*) filter (where btrim(title) = '') as blank_titles,
--          count(*) filter (where content ~ '^[[:space:]]*#[[:space:]]') as unlifted
--     from business_analysis;
