#!/usr/bin/env python3
"""Compute insurance chart 3's benchmark quarter from the stored deposit board.

    python3 refresh_deposit_benchmark.py                  # every completed quarter we can compute
    python3 refresh_deposit_benchmark.py --period 2026-Q4
    python3 refresh_deposit_benchmark.py --dry-run
    python3 refresh_deposit_benchmark.py --audit          # show the stored series

Needs migration 084.

WHAT THIS DOES AND DOES NOT DO
    BA's benchmark is the POSTED 12-month deposit rate averaged over VCB, BID,
    CTG and AGB at the quarter's LAST TRADING SESSION (reply lần 5 §1). Rows to
    2026-Q3 are BA's seed and this script NEVER overwrites them: per-bank
    history does not exist before `bank_deposit_board` started accumulating, so
    there is nothing to recompute them from. It writes 2026-Q4 onward only.

    The cron fallback BA approved (lần 5 §1.3): if no board snapshot exists on
    the quarter's last session, take the LATEST SNAPSHOT AT OR BEFORE it and
    record which date was actually used. A quarter with no snapshot at all is
    skipped, not guessed.
"""

from __future__ import annotations

import argparse
import datetime as dt
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])

from ta.common import get_supabase_client, paged_select, safe_execute, today_vn  # noqa: E402
from macro.bank_rates import BIG4, DEPOSIT_TENOR  # noqa: E402

#: Quarters at or before this are BA's hand-supplied seed (migration 084) and
#: are never recomputed -- see the module docstring.
SEED_THROUGH = "2026-Q3"
SOURCE = "BIG4_BOARD"


def quarter_of(d: dt.date) -> str:
    return f"{d.year}-Q{(d.month - 1) // 3 + 1}"


def quarter_bounds(period: str) -> tuple[dt.date, dt.date]:
    y, q = period.split("-Q")
    y, q = int(y), int(q)
    start = dt.date(y, (q - 1) * 3 + 1, 1)
    end = dt.date(y + (q == 4), 1 if q == 4 else q * 3 + 1, 1) - dt.timedelta(days=1)
    return start, end


def trading_sessions(client, start: dt.date, end: dt.date) -> list[dt.date]:
    """The real session calendar, from stored VN-Index dates.

    Never Mon-Fri arithmetic: three of BA's own seed quarters end on a weekend,
    and Vietnamese public holidays would make a weekday rule wrong several times
    a year. This is the same calendar `interbank_interior_gaps` and
    `count_sessions_held` already trust.
    """
    rows = paged_select(
        lambda lo, hi: client.table("macro_series").select("date")
        .eq("metric", "vnindex").gte("date", start.isoformat())
        .lte("date", end.isoformat()).order("date").range(lo, lo + hi - 1),
        label="vnindex sessions",
    )
    return [dt.date.fromisoformat(r["date"]) for r in rows]


def board_on_or_before(client, day: dt.date, floor: dt.date) -> tuple[dt.date, dict] | None:
    """The newest board snapshot at or before `day`, not earlier than `floor`."""
    rows = paged_select(
        lambda lo, hi: client.table("bank_deposit_board")
        .select("as_of,bank,rate_pct").eq("tenor", DEPOSIT_TENOR)
        .gte("as_of", floor.isoformat()).lte("as_of", day.isoformat())
        .order("as_of").order("bank").range(lo, lo + hi - 1),
        label=f"deposit board <= {day}",
    )
    if not rows:
        return None
    newest = max(r["as_of"] for r in rows)
    per = {r["bank"]: float(r["rate_pct"]) for r in rows if r["as_of"] == newest}
    return dt.date.fromisoformat(newest), per


def compute(client, period: str) -> dict | None:
    start, cal_end = quarter_bounds(period)
    sessions = trading_sessions(client, start, cal_end)
    if not sessions:
        print(f"  {period}: no trading sessions stored — skipped")
        return None
    last = sessions[-1]
    got = board_on_or_before(client, last, start)
    if got is None:
        print(f"  {period}: no board snapshot in the quarter — skipped "
              f"(per-bank history starts when migration 084 was applied)")
        return None
    used, per = got
    missing = [b for b in BIG4 if b not in per]
    if missing:
        print(f"  ::warning:: {period}: Big4 incomplete on {used}, missing {missing} — skipped")
        return None
    rate = sum(per[b] for b in BIG4) / len(BIG4)
    note = None if used == last else f"board of {used}; quarter's last session was {last}"
    print(f"  {period}: {rate:.3f}% from {used}"
          + (f" (fallback: last session {last} had no snapshot)" if note else "")
          + "  [" + ", ".join(f"{b} {per[b]:.2f}" for b in BIG4) + "]")
    return {
        "period": period,
        "session_date": last.isoformat(),
        "rate_pct": round(rate, 3),
        "source": SOURCE,
        "bank_count": len(BIG4),
        "note": note,
    }


def completed_quarters(client) -> list[str]:
    """Quarters after the seed that have ended, newest last."""
    today = today_vn()
    out: list[str] = []
    y, q = 2026, 4
    while True:
        p = f"{y}-Q{q}"
        _, end = quarter_bounds(p)
        if end >= today:
            break
        if p > SEED_THROUGH:
            out.append(p)
        q += 1
        if q == 5:
            y, q = y + 1, 1
    return out


def audit(client) -> int:
    rows = paged_select(
        lambda lo, hi: client.table("ref_deposit_rate_12m")
        .select("period,session_date,rate_pct,source,bank_count,note")
        .order("period").range(lo, lo + hi - 1),
        label="ref_deposit_rate_12m",
    )
    print(f"{len(rows)} row(s):")
    prev = None
    for r in rows:
        step = f"{r['rate_pct'] - prev:+.2f}" if prev is not None else "    —"
        print(f"  {r['period']:9} {r['session_date']}  {r['rate_pct']:6.3f}%  {step:>6}  "
              f"{r['source']:14}{(' ' + r['note']) if r.get('note') else ''}")
        prev = r["rate_pct"]
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--period", help="one quarter, e.g. 2026-Q4")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--audit", action="store_true")
    args = ap.parse_args()

    client = get_supabase_client()
    if args.audit:
        return audit(client)

    if args.period:
        if args.period <= SEED_THROUGH:
            print(f"::error:: {args.period} is at or before the seed boundary "
                  f"{SEED_THROUGH}; BA's values are not recomputable (migration 084)")
            return 1
        periods = [args.period]
    else:
        periods = completed_quarters(client)

    if not periods:
        print(f"no completed quarter after {SEED_THROUGH} yet — nothing to compute")
        return 0

    print(f"deposit benchmark: {len(periods)} quarter(s) to compute")
    rows = [r for r in (compute(client, p) for p in periods) if r]
    if rows and not args.dry_run:
        safe_execute(
            client.table("ref_deposit_rate_12m").upsert(rows, on_conflict="period"),
            label="upsert ref_deposit_rate_12m",
        )
        print(f"wrote {len(rows)} row(s)")
    elif args.dry_run:
        print(f"(dry run) would write {len(rows)} row(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
