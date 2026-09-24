#!/usr/bin/env python3
"""
compare_fa_exports.py — diff two `export_fa_scanner.py` workbooks.

Built for one question: what did applying the IAS 33 restatement to C1/C2/C3
actually change? So it reports per-criterion movement, and it CHECKS THE THINGS
THAT MUST NOT HAVE MOVED — C9, C4–C8, and the other two rubrics — rather than
only listing what did. A change set that is right about its target and silently
wrong elsewhere is the failure worth catching.

Two guards on the comparison itself:

  * A symbol present on one side and not the other is reported, never silently
    dropped from the denominator.
  * Floats are compared with a tolerance, because a stored numeric round-trips
    through Excel; an exact `!=` would report every row as changed.

Usage:
  python3 compare_fa_exports.py --before ../data/exports/fa_scanner_before.xlsx \
                                --after  ../data/exports/fa_scanner_after.xlsx \
                                --out    ../data/exports/fa_scanner_comparison.xlsx
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

TOL = 1e-6

#: Criteria the change is ALLOWED to move.
EPS_FIELDS = ["c1_eps_yoy", "c1_pts", "c2_eps_3q_avg_yoy", "c2_pts",
              "c3_eps_pos_count", "c3_pts"]
#: Criteria and valuation inputs that MUST be identical. C9 is the one BA
#: confirmed is already correct (2026-09-24), and its inputs are listed too —
#: an unchanged C9 built on a changed TTM EPS would be luck, not correctness.
FROZEN_FIELDS = ["c4_rev_yoy", "c4_pts", "c5_gross_margin_delta", "c5_pts",
                 "c6_net_margin_delta", "c6_pts", "c7_roe", "c7_pts",
                 "c8_debt_to_equity", "c8_pts", "c9_current_pe", "c9_pts",
                 "current_eps_ttm", "current_pe", "pe_5y_median"]
#: Derived from the above, so these move only as a consequence.
DERIVED_FIELDS = ["total_score", "normalized_score", "rating",
                  "final_score", "final_grade"]


def read_sheet(path: Path, name: str) -> dict[str, dict]:
    from openpyxl import load_workbook
    wb = load_workbook(path, read_only=True, data_only=True)
    if name not in wb.sheetnames:
        return {}
    ws = wb[name]
    rows = ws.iter_rows(values_only=True)
    headers = list(next(rows))
    out = {}
    for r in rows:
        rec = dict(zip(headers, r))
        key = rec.get("symbol")
        if key:
            out[str(key)] = rec
    wb.close()
    return out


def same(a, b) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(float(a) - float(b)) <= TOL
    return str(a) == str(b)


def fmt(v, digits=2):
    if v is None:
        return "—"
    if isinstance(v, float):
        return f"{v:.{digits}f}"
    return str(v)


def main() -> int:
    ap = argparse.ArgumentParser(description="Diff two FA Scanner exports")
    ap.add_argument("--before", required=True)
    ap.add_argument("--after", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    before_p, after_p = Path(args.before), Path(args.after)
    b = read_sheet(before_p, "manufacturing")
    a = read_sheet(after_p, "manufacturing")
    print(f"manufacturing rows: before {len(b):,} · after {len(a):,}")

    only_b = sorted(set(b) - set(a))
    only_a = sorted(set(a) - set(b))
    if only_b or only_a:
        print(f"  membership changed: {len(only_b)} dropped, {len(only_a)} added")

    shared = sorted(set(b) & set(a))
    changed_rows = []
    counters = {f: 0 for f in EPS_FIELDS + FROZEN_FIELDS + DERIVED_FIELDS}
    rating_moves = {}
    improved = worsened = 0

    for s in shared:
        bb, aa = b[s], a[s]
        diffs = [f for f in counters if not same(bb.get(f), aa.get(f))]
        for f in diffs:
            counters[f] += 1
        if not diffs:
            continue
        d_total = None
        if isinstance(bb.get("total_score"), (int, float)) and isinstance(aa.get("total_score"), (int, float)):
            d_total = aa["total_score"] - bb["total_score"]
            improved += d_total > 0
            worsened += d_total < 0
        if not same(bb.get("rating"), aa.get("rating")):
            rating_moves[f"{bb.get('rating')}->{aa.get('rating')}"] = \
                rating_moves.get(f"{bb.get('rating')}->{aa.get('rating')}", 0) + 1
        row = {"symbol": s, "name": aa.get("name")}
        for f in EPS_FIELDS + DERIVED_FIELDS:
            row[f"{f}_before"] = bb.get(f)
            row[f"{f}_after"] = aa.get(f)
        row["total_delta"] = d_total
        row["changed_fields"] = ", ".join(diffs)
        changed_rows.append(row)

    frozen_breaks = [f for f in FROZEN_FIELDS if counters[f]]
    print(f"\nrows with any change: {len(changed_rows):,} of {len(shared):,}")
    print("  criteria the change may move:")
    for f in EPS_FIELDS:
        print(f"    {f:<24} {counters[f]:>5}")
    print("  criteria that MUST NOT move:")
    for f in FROZEN_FIELDS:
        flag = "  <-- BROKEN" if counters[f] else ""
        print(f"    {f:<24} {counters[f]:>5}{flag}")
    print("  derived:")
    for f in DERIVED_FIELDS:
        print(f"    {f:<24} {counters[f]:>5}")
    print(f"\n  total_score improved {improved}, worsened {worsened}")
    print(f"  rating moves: {rating_moves or 'none'}")

    # The other two rubrics have no C1/C2/C3 and must be byte-identical.
    for sheet in ("real_estate", "securities"):
        sb, sa = read_sheet(before_p, sheet), read_sheet(after_p, sheet)
        keys = sorted(set(sb) | set(sa))
        moved = [k for k in keys
                 if k not in sb or k not in sa
                 or any(not same(sb[k].get(c), sa[k].get(c)) for c in sb[k])]
        print(f"  {sheet}: {len(keys)} symbols, {len(moved)} changed"
              f"{'  <-- UNEXPECTED' if moved else ''}")

    from export_fa_scanner import write_xlsx
    summary = [
        {"metric": "manufacturing rows compared", "value": len(shared)},
        {"metric": "rows changed", "value": len(changed_rows)},
        *[{"metric": f"{f} changed", "value": counters[f]} for f in EPS_FIELDS],
        *[{"metric": f"{f} changed (must be 0)", "value": counters[f]} for f in FROZEN_FIELDS],
        *[{"metric": f"{f} changed", "value": counters[f]} for f in DERIVED_FIELDS],
        {"metric": "total_score improved", "value": improved},
        {"metric": "total_score worsened", "value": worsened},
        *[{"metric": f"rating {k}", "value": v} for k, v in sorted(rating_moves.items())],
        {"metric": "frozen fields broken", "value": ", ".join(frozen_breaks) or "none"},
    ]
    write_xlsx(Path(args.out), {
        "summary": summary,
        "changed": sorted(changed_rows, key=lambda r: -(r["total_delta"] or 0)),
    })
    print(f"\nWrote {args.out}")
    return 1 if frozen_breaks else 0


if __name__ == "__main__":
    sys.exit(main())
