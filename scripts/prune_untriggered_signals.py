#!/usr/bin/env python3
"""Delete untriggered rows from ta_signals, one date at a time.

WHY A SCRIPT AND NOT JUST THE MIGRATION
  supabase/056 carries the same logic as a plpgsql procedure that COMMITs per
  date. That is the right shape, but the Supabase SQL editor runs a script
  inside a transaction block — the same reason VACUUM fails there — and a
  procedure cannot COMMIT inside one. So the migration is the record of the
  decision and the path for anyone on psql with a direct connection; this is
  the path that works from a laptop with nothing but scripts/.env.

WHAT IT DELETES
  Rows where triggered = false: an indicator that ran and answered "no". No
  reader has ever asked for them — the TA Scanner's two reads and the Analysis
  chart's markers all filter `triggered = true`. See CLAUDE.md.

SAFETY
  - Idempotent and resumable. Re-running finds nothing; a crash costs the date
    in flight, which the next run picks up.
  - One date per request, so nothing approaches the statement timeout that a
    bare count(*) on this table already hits.
  - --dry-run counts without deleting. Run it first.
  - Deploy the triggered-only write path FIRST (scripts/compute_ta_signals.py
    write_signals) or the nightly pass refills what this removes.

  Note this does NOT shrink the database on disk — Postgres marks the space
  reusable, so the table stops growing but the dashboard figure holds. Run
  `vacuum full analyze ta_signals;` by hand afterwards to reclaim it.

Usage:
  python3 prune_untriggered_signals.py --dry-run
  python3 prune_untriggered_signals.py
  python3 prune_untriggered_signals.py --since 2025-01-01
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import date, timedelta

from postgrest.exceptions import APIError

from ta.common import get_supabase_client, paged_select, safe_execute

# Postgres "canceling statement due to statement timeout". PostgREST caps a
# statement well below what deleting a whole recent date needs (~46k rows), and
# `safe_execute` deliberately does NOT treat it as transient — it means the
# query was too big, not that the network blipped, so retrying it unchanged
# just fails again more slowly. The answer is a smaller bite, not a retry.
STATEMENT_TIMEOUT = "57014"


def date_bounds(client) -> tuple[date, date] | None:
    """Oldest and newest date present in ta_signals."""
    lo = safe_execute(client.table("ta_signals").select("date").order("date").limit(1),
                      label="oldest signal date").data
    hi = safe_execute(client.table("ta_signals").select("date").order("date", desc=True).limit(1),
                      label="newest signal date").data
    if not lo or not hi:
        return None
    return date.fromisoformat(lo[0]["date"]), date.fromisoformat(hi[0]["date"])


def count_untriggered(client, d: str) -> int:
    return safe_execute(
        client.table("ta_signals").select("*", count="exact", head=True)
        .eq("date", d).eq("triggered", False),
        label=f"count {d}",
    ).count or 0


def _is_timeout(exc: BaseException) -> bool:
    return isinstance(exc, APIError) and getattr(exc, "code", None) == STATEMENT_TIMEOUT


def _delete_symbols(client, iso: str, group: list[str]) -> int:
    """Delete one date's untriggered rows for `group`, halving on a timeout.

    Returns the number of requests it took. A group that still times out at one
    symbol would be ~56 rows, which cannot happen — so the recursion terminates
    on data, not on a depth limit.
    """
    try:
        safe_execute(
            client.table("ta_signals").delete()
            .eq("date", iso).eq("triggered", False).in_("symbol", group),
            label=f"prune {iso} [{len(group)} symbols]",
        )
        return 1
    except APIError as e:
        if not _is_timeout(e) or len(group) == 1:
            raise
        mid = len(group) // 2
        return (_delete_symbols(client, iso, group[:mid])
                + _delete_symbols(client, iso, group[mid:]))


def delete_date(client, iso: str, symbols: list[str], chunk: int) -> int:
    """Delete a date's untriggered rows. Returns the number of requests used.

    Optimistic: one unbounded delete first, because most dates are small (early
    2023 dates hold ~1,000 untriggered rows and go in a single request). Only a
    date that actually exceeds the timeout pays for chunking — recent sessions
    carry ~38,000 untriggered rows and need it.

    The fallback chunks by SYMBOL because ta_signals' primary key is
    (date, symbol, indicator), so `date = X and symbol in (...)` stays on the
    index. After the chunks, anything left belongs to a symbol that is not in
    ta_universe; that remainder is deleted unbounded, which is safe precisely
    because it is now tiny.
    """
    try:
        safe_execute(
            client.table("ta_signals").delete().eq("date", iso).eq("triggered", False),
            label=f"prune {iso}",
        )
        return 1
    except APIError as e:
        if not _is_timeout(e):
            raise

    reqs = 0
    for i in range(0, len(symbols), chunk):
        reqs += _delete_symbols(client, iso, symbols[i : i + chunk])

    leftover = count_untriggered(client, iso)
    if leftover:
        safe_execute(
            client.table("ta_signals").delete().eq("date", iso).eq("triggered", False),
            label=f"prune {iso} remainder",
        )
        reqs += 1
        print(f"       {leftover:,} rows for symbols outside ta_universe, removed separately")
    return reqs


def main() -> int:
    ap = argparse.ArgumentParser(description="Prune untriggered rows from ta_signals")
    ap.add_argument("--dry-run", action="store_true", help="Count what would go, delete nothing")
    ap.add_argument("--since", help="Start from this date (YYYY-MM-DD) instead of the oldest")
    ap.add_argument("--until", help="Stop after this date (YYYY-MM-DD)")
    ap.add_argument("--chunk", type=int, default=100,
                    help="Symbols per delete when a whole-date delete times out (default 100)")
    args = ap.parse_args()

    client = get_supabase_client()
    bounds = date_bounds(client)
    if bounds is None:
        print("ta_signals is empty — nothing to do.")
        return 0
    lo, hi = bounds
    if args.since:
        lo = max(lo, date.fromisoformat(args.since))
    if args.until:
        hi = min(hi, date.fromisoformat(args.until))

    symbols = [r["symbol"] for r in paged_select(
        lambda o, l: client.table("ta_universe").select("symbol").order("symbol").range(o, o + l - 1),
        label="universe symbols",
    )]

    span = (hi - lo).days + 1
    action = "Would delete" if args.dry_run else "Deleting"
    print(f"{action} untriggered ta_signals rows over {lo} .. {hi} ({span} calendar days)")

    total = 0
    touched = 0
    start = time.time()
    d = lo
    while d <= hi:
        iso = d.isoformat()
        n = count_untriggered(client, iso)
        if n:
            reqs = 1
            if not args.dry_run:
                reqs = delete_date(client, iso, symbols, args.chunk)
            total += n
            touched += 1
            verb = "would prune" if args.dry_run else "pruned"
            extra = f"  [{reqs} chunks]" if reqs > 1 else ""
            print(f"  {iso}  {verb} {n:>7,}   (running total {total:,}){extra}")
        d += timedelta(days=1)

    elapsed = time.time() - start
    done = "would be removed" if args.dry_run else "removed"
    print(f"\n{total:,} untriggered rows {done} across {touched} dates in {elapsed:.0f}s.")
    if not args.dry_run and total:
        print("Disk is NOT reclaimed yet — run in the SQL editor:  vacuum full analyze ta_signals;")
    return 0


if __name__ == "__main__":
    sys.exit(main())
