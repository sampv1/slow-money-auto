-- ============================================================
-- Migration 056: drop untriggered rows from ta_signals
--
-- WHAT AN UNTRIGGERED ROW IS
--   Each indicator writes one row per symbol per day recording two things:
--   whether its condition fired (`triggered`) and the number it measured
--   (`value`). `rsi_oversold` asks "is RSI below 30?" -- on a calm day it
--   stores triggered=false, value=54. That "no" answer is an untriggered row.
--
-- WHY THEY GO
--   Nothing reads them. All three readers filter `triggered = true`:
--     dashboard/src/app/scanner/page.tsx        (which symbols fired today)
--     dashboard/src/app/api/scanner/route.ts    (same, for a picked date)
--     dashboard/src/lib/chart-payload.ts        (where to draw chart markers)
--   Swept the repo for views, functions and other consumers -- there are none.
--   Measured on 2026-08-28: 46,711 rows for the session, 8,597 triggered. The
--   82% answering "no" cost ~1.4 GB a year to store and were never queried.
--
--   What is given up: answering "what was FPT's ADX on 2025-03-14" by SELECT.
--   The value stays recomputable from ta_ohlcv, which is the source of record.
--   Not quite everything: ta_signals reaches back to 2022-12-28 while most
--   symbols hold ~604 OHLCV bars (from ~2024-03), so rows older than that are
--   unrecoverable. That is ~1,200 rows in total -- the volume is all recent.
--
-- ORDER MATTERS: DEPLOY THE CODE FIRST
--   scripts/compute_ta_signals.py must already be writing triggered-only
--   (`write_signals`) before this runs, or the nightly pass simply refills what
--   this deletes. That change is also what makes the deletion SAFE: it replaced
--   the plain upsert with delete-then-insert. The upsert used to keep history
--   honest by OVERWRITING a stale `triggered = true` with the `false` that a
--   recomputation produced; with false rows no longer written, only the delete
--   stops a re-run leaving a signal the scanner still lists for a bar that no
--   longer produces it. Pinned by scripts/tests/test_signal_write.py.
--
-- HOW TO ACTUALLY RUN THIS
--   The Supabase SQL editor executes a script INSIDE a transaction block (the
--   same reason `vacuum` fails there), and a procedure cannot COMMIT inside
--   one — so `call prune_untriggered_signals();` below will error there with
--   "invalid transaction termination". Two working paths:
--
--     1. scripts/prune_untriggered_signals.py  (recommended — needs only
--        scripts/.env, is resumable, and has a --dry-run). This is the tested
--        path; it deletes one date per request through PostgREST.
--     2. psql on the direct connection string, where CALL works as written.
--
--   The procedure is still created below so path 2 exists and so the logic is
--   recorded next to the reasoning. Creating it is harmless if never called.
--
-- WHY A PROCEDURE AND NOT ONE DELETE
--   One statement over ~6M rows exceeds the statement timeout -- a plain
--   `select count(*)` on this table already does. The loop commits per date, so
--   a timeout mid-run loses nothing: re-run `call prune_untriggered_signals();`
--   and it continues from where it stopped. Chunking by date (rather than by
--   ctid or a bare LIMIT) lets each delete use the primary key, whose leading
--   column is `date`; `triggered` itself is unindexed for false, so a
--   LIMIT-based batch would seq-scan the table once per batch.
-- ============================================================

create or replace procedure prune_untriggered_signals()
language plpgsql
as $$
declare
  d      date;
  n      bigint;
  total  bigint := 0;
begin
  for d in
    select distinct date from ta_signals order by date
  loop
    delete from ta_signals where date = d and triggered = false;
    get diagnostics n = row_count;
    total := total + n;
    -- Each date is its own transaction, which is what makes this resumable.
    commit;
    if n > 0 then
      raise notice 'pruned % untriggered rows for % (running total %)', n, d, total;
    end if;
  end loop;
  raise notice 'done: % untriggered rows pruned', total;
end;
$$;

-- Run this via psql, NOT the Supabase SQL editor (see above):
--   call prune_untriggered_signals();

-- Refresh planner stats; the row count changes by ~82%.
analyze ta_signals;

-- ------------------------------------------------------------
-- AFTERWARDS, BY HAND (neither can run inside a transaction)
--
--   DELETE alone does not return space to the filesystem -- Postgres marks it
--   reusable, so the table stops growing but the dashboard figure stays put.
--   That is fine if you only care about growth. To actually shrink it:
--
--     vacuum full analyze ta_signals;
--
--   VACUUM FULL takes an ACCESS EXCLUSIVE lock and rewrites the table, so it
--   needs free space for a second copy and blocks readers while it runs. Do it
--   outside market hours. `vacuum ta_signals;` is the non-blocking alternative
--   that reclaims for reuse without shrinking.
-- ------------------------------------------------------------

-- Optional, NOT applied: make the invariant enforceable at the DB level.
--
--     alter table ta_signals add constraint ta_signals_triggered_only
--       check (triggered);
--
-- Left off deliberately. It would turn a future writer that forgets the filter
-- into a failed chunk -- loud, which this project generally prefers -- but the
-- blast radius is the whole nightly pass failing over rows that are merely
-- redundant. The Python write path is the single writer and is pinned by test.
