#!/usr/bin/env python3
"""
ta_state_snapshot.py — post-run diagnostics for the TA pipeline.

Read-only. Prints the coverage counts of everything update_ta_daily.py writes,
plus the GitHub Actions job summary, so a bad run leaves evidence behind.

It exists because of the 2026-08-07 RS incident: the paged upsert reported
success for every chunk, only 500 of 1,384 rows persisted, and the run finished
GREEN with a plausible-looking TA Score (VNM 24 = a 68 price-base x 0.35, all three RS
terms silently counted as 0). Nothing in the log recorded the shortfall, and by
the time it was noticed the next run had moved the state on. The counts below
would have shown it immediately.

Wired into .github/workflows/ta-daily.yml with `if: always()` so it also runs
when the update step fails — the state right AFTER a failure is the state worth
capturing.

Usage:
  python3 ta_state_snapshot.py            # print snapshot
  python3 ta_state_snapshot.py --missing  # also list every symbol lacking RS
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client, safe_execute, today_vn  # noqa: E402

# A run that leaves fewer than this share of the active universe with RS is
# reporting a partial write, not a quiet market. Deliberately loose: ~12% of the
# universe is legitimately unrated (too little history) on a normal day.
MIN_RS_COVERAGE = 0.70


def _count(client, table: str, **filters) -> int:
    q = client.table(table).select("symbol", count="exact")
    for k, v in filters.items():
        if k.endswith("__notnull"):
            q = q.not_.is_(k[:-9], "null")
        elif k.endswith("__null"):
            q = q.is_(k[:-6], "null")
        else:
            q = q.eq(k, v)
    return safe_execute(q.limit(1), label=f"snapshot {table}").count or 0


def _summary(text: str) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    try:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(text)
    except Exception as e:  # noqa: BLE001 — diagnostics must never fail the job
        print(f"  (job summary write failed: {e})")


def main() -> int:
    ap = argparse.ArgumentParser(description="Post-run TA state snapshot (read-only)")
    ap.add_argument("--missing", action="store_true",
                    help="List every active symbol with no RS (not just the count)")
    args = ap.parse_args()

    client = get_supabase_client()
    today = today_vn().isoformat()

    active = _count(client, "ta_universe", is_active=True)
    rs = _count(client, "ta_universe", is_active=True, rs_date__notnull=None)
    trend = _count(client, "ta_universe", is_active=True, trend_date__notnull=None)
    ta = _count(client, "ta_universe", is_active=True, ta_score__notnull=None)
    rs_today = _count(client, "ta_universe", is_active=True, rs_date=today)
    trend_today = _count(client, "ta_universe", is_active=True, trend_date=today)
    ohlcv_today = _count(client, "ta_ohlcv", date=today)

    cov = (rs / active) if active else 0.0
    lines = [
        "=== TA state snapshot ===",
        f"  active universe        {active}",
        f"  with RS (any date)     {rs}   ({cov:.1%} of active)",
        f"  with RS dated today    {rs_today}   [{today}]",
        f"  with trend (any date)  {trend}",
        f"  with trend dated today {trend_today}",
        f"  with ta_score          {ta}",
        f"  ta_ohlcv rows today    {ohlcv_today}",
    ]
    print("\n".join(lines), flush=True)

    ok = cov >= MIN_RS_COVERAGE
    if not ok:
        print(f"::warning::RS coverage {cov:.1%} is below {MIN_RS_COVERAGE:.0%} "
              f"({rs}/{active}). This is the signature of a partial RS write — "
              f"check the 'chunk N: sent .. reported ..' lines in the update step.",
              flush=True)

    if args.missing or not ok:
        syms, offset = [], 0
        while True:
            rows = safe_execute(
                client.table("ta_universe").select("symbol")
                .eq("is_active", True).is_("rs_date", "null")
                .order("symbol").range(offset, offset + 999),
                label="snapshot missing",
            ).data
            syms += [r["symbol"] for r in rows]
            if len(rows) < 1000:
                break
            offset += 1000
        print(f"  symbols with no RS ({len(syms)}): {', '.join(syms[:80])}"
              + (" ..." if len(syms) > 80 else ""), flush=True)

    _summary(
        f"\n### TA state snapshot\n\n"
        f"| metric | count |\n|---|---|\n"
        f"| active universe | {active} |\n"
        f"| with RS (any date) | {rs} ({cov:.1%}) |\n"
        f"| with RS dated {today} | {rs_today} |\n"
        f"| with trend dated {today} | {trend_today} |\n"
        f"| with ta_score | {ta} |\n"
        f"| ta_ohlcv rows today | {ohlcv_today} |\n\n"
        + ("" if ok else f"> ⚠️ RS coverage {cov:.1%} below {MIN_RS_COVERAGE:.0%} — "
                         "suspect a partial write.\n")
    )
    # Always exit 0: this is a report, and the workflow step is continue-on-error
    # anyway. The ::warning:: above is what surfaces a problem.
    return 0


if __name__ == "__main__":
    sys.exit(main())
