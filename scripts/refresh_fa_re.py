#!/usr/bin/env python3
"""Real-estate (BĐS) FA pipeline — import raw inputs, then score them.

    python3 refresh_fa_re.py import --file "../data/File BDS quy 2-2026 ngày 13-08.xlsx"
    python3 refresh_fa_re.py score
    python3 refresh_fa_re.py score --period 2026-Q2 --symbols HDC,DXG

TWO STEPS ON PURPOSE. `import` parses the FiinProX export into `fa_re_metrics`
(raw inputs) and `fa_industry` (which rubric each symbol belongs to). `score`
reads those metrics back out and writes `fa_re_scores`. So a rubric edit is a
`score` re-run — no re-export, no spreadsheet. The rubric changed four times in
two days, which is what makes that split worth the extra table.

Writes need SUPABASE_SERVICE_ROLE_KEY (migration 045 made anon read-only). A
denied PostgREST write returns 204 with zero rows, not an error, so a missing
key looks like success — `resolve_supabase_key()` warns loudly on the fallback.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fa.real_estate import (  # noqa: E402
    AS_OF_PERIOD,
    RE_MIN_SCORABLE,
    load_rubric,
    parse_workbook,
    score_metrics,
)
from ta.common import get_supabase_client, safe_execute  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_WORKBOOK = os.path.join(HERE, "..", "data", "File BDS quy 2-2026 ngày 13-08.xlsx")
DEFAULT_RUBRIC = os.path.join(HERE, "..", "data", "tieu_chi_cham_diem_bds.xlsx")
CHUNK = 500


def _chunked_upsert(client, table, rows, on_conflict, dry_run):
    if not rows:
        return 0
    if dry_run:
        return len(rows)
    for i in range(0, len(rows), CHUNK):
        safe_execute(
            client.table(table).upsert(rows[i:i + CHUNK], on_conflict=on_conflict),
            label=f"upsert {table} chunk[{i // CHUNK}]",
        )
    return len(rows)


def _fetch_all(client, table, columns, period=None):
    """PostgREST silently truncates at 1000 rows — page explicitly."""
    out, size, start = [], 1000, 0
    while True:
        q = client.table(table).select(columns)
        if period:
            q = q.eq("as_of_period", period)
        res = safe_execute(q.order("symbol").range(start, start + size - 1),
                           label=f"read {table}[{start}]")
        batch = res.data or []
        out.extend(batch)
        if len(batch) < size:
            return out
        start += size


# ---------------------------------------------------------------------------
def cmd_import(args):
    print(f"Reading {args.file}")
    industry, metrics = parse_workbook(args.file)
    groups: dict[str, int] = {}
    for r in industry:
        groups[r["industry_group"]] = groups.get(r["industry_group"], 0) + 1

    print(f"  classification : {len(industry)} symbols  {groups}")
    print(f"  real-estate    : {len(metrics)} symbols with raw metrics")
    if not metrics:
        print("  nothing to import — is this the BĐS export?")
        return 1

    src = os.path.basename(args.file)
    metric_rows = [{"symbol": m["symbol"], "as_of_period": m["as_of_period"],
                    "metrics": m["metrics"], "source_file": src} for m in metrics]

    if args.dry_run:
        print("\n[dry-run] would upsert:")
        print(f"  fa_industry    {len(industry)} rows")
        print(f"  fa_re_metrics  {len(metric_rows)} rows @ {metrics[0]['as_of_period']}")
        sample = metrics[0]
        print(f"  sample {sample['symbol']}: {len(sample['metrics'])} metric keys")
        return 0

    client = get_supabase_client()
    n1 = _chunked_upsert(client, "fa_industry", industry, "symbol", False)
    n2 = _chunked_upsert(client, "fa_re_metrics", metric_rows, "symbol,as_of_period", False)
    print(f"\nUpserted fa_industry={n1}  fa_re_metrics={n2}")
    return 0


def cmd_score(args):
    rubric = load_rubric(args.rubric)
    print(f"Rubric: {len(rubric)} criteria, weights sum "
          f"{sum(c.weight for c in rubric.values()):.0f}")

    client = get_supabase_client()
    period = args.period or AS_OF_PERIOD
    rows = _fetch_all(client, "fa_re_metrics", "symbol,as_of_period,metrics", period)
    if args.symbols:
        want = {s.strip().upper() for s in args.symbols.split(",")}
        rows = [r for r in rows if r["symbol"] in want]
    print(f"Loaded {len(rows)} metric rows @ {period}")
    if not rows:
        print("  nothing to score — run `import` first")
        return 1

    # Company name / exchange live on fa_industry's source export, not on the
    # metrics blob; carry them onto the score row so the scanner needs one read.
    names = {r["symbol"]: r for r in _fetch_all(client, "fa_industry", "symbol,icb_industry")}

    out, skipped = [], 0
    for r in rows:
        try:
            s = score_metrics(r["symbol"], r["metrics"], rubric)
        except (KeyError, TypeError) as e:
            print(f"  !! {r['symbol']}: {type(e).__name__} {e} — skipped")
            skipped += 1
            continue
        out.append({
            "symbol": r["symbol"],
            "as_of_period": r["as_of_period"],
            "total_score": s.total,
            "scorable_weight": s.scorable,
            "n_scored": s.n_scored,
            "normalized_score": s.normalized,
            "breakdown": s.breakdown,
        })

    full = sum(1 for r in out if r["n_scored"] == 13)
    rated = sum(1 for r in out if r["normalized_score"] is not None)
    print(f"  scored {len(out)}  (all 13: {full}, above the {RE_MIN_SCORABLE:.0f}-weight "
          f"floor: {rated}, skipped: {skipped})")
    top = sorted(out, key=lambda r: -r["total_score"])[:5]
    print("  top: " + ", ".join(f"{r['symbol']} {r['total_score']:g}" for r in top))
    for sym in ("HDC", "DXG"):
        hit = next((r for r in out if r["symbol"] == sym), None)
        if hit:
            print(f"  {sym}: {hit['total_score']:g}/{hit['scorable_weight']:g}")

    if args.dry_run:
        print(f"\n[dry-run] would upsert fa_re_scores {len(out)} rows")
        return 0
    n = _chunked_upsert(client, "fa_re_scores", out, "symbol,as_of_period", False)
    print(f"\nUpserted fa_re_scores={n}")
    return 0


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    pi = sub.add_parser("import", help="FiinProX export -> fa_industry + fa_re_metrics")
    pi.add_argument("--file", default=DEFAULT_WORKBOOK)
    pi.add_argument("--dry-run", action="store_true")
    pi.set_defaults(func=cmd_import)

    ps = sub.add_parser("score", help="fa_re_metrics -> fa_re_scores")
    ps.add_argument("--rubric", default=DEFAULT_RUBRIC)
    ps.add_argument("--period", help=f"default {AS_OF_PERIOD}")
    ps.add_argument("--symbols", help="comma-separated subset")
    ps.add_argument("--dry-run", action="store_true")
    ps.set_defaults(func=cmd_score)

    args = p.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
