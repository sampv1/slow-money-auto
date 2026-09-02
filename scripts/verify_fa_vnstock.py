#!/usr/bin/env python3
"""Verify the vnstock FA importer against a quarter both sources cover.

READ-ONLY. There is no write path in this file — not guarded, absent. It exists
to answer "would the automated importer have produced what we have?" without
touching what we have.

WHY 2026-Q2
  It is the last quarter FiinProX and vnstock both cover, which makes it the
  natural fixture. The cutover freezes everything at or before it and lets
  vnstock write 2026-Q3 onward (FA_AUTO_IMPORT_DESIGN.md §7), so Q2 stays a
  stable regression set: re-run this after any provider or mapping change and a
  drift shows up immediately, instead of a quarter later on live data.

WHAT IT MEASURES, AND WHY THE SECOND ONE MATTERS MORE
  1. FIELD fidelity — derived value vs the stored fa_quarterly row.
  2. SCORE effect, in the shape the cutover actually has. Scoring a quarter
     READS the three before it (`is_fully_scorable` needs EPS at period, -1, -2
     and their year-ago quarters; `trailing_ttm_eps` sums four). So the realistic
     test is ONE vnstock quarter substituted into an otherwise-FiinProX series —
     not a symbol scored entirely from vnstock, which is not what will happen.

  The score comparison is against the STORED fa_scores row where one exists, so
  it also catches a scorer or config drift, not only a data difference.

Usage:
  python3 verify_fa_vnstock.py --limit 60
  python3 verify_fa_vnstock.py --symbols FPT VNM HTT
  python3 verify_fa_vnstock.py --period 2026-Q2 --limit 40 --show-worst 15
"""

from __future__ import annotations

import argparse
import random
import statistics as st
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa import metrics as fa_metrics  # noqa: E402
from fa import persist as fa_persist  # noqa: E402
from fa import vnstock_quarterly as vq  # noqa: E402
from fa.scoring import compute_score  # noqa: E402
from ta.common import get_supabase_client, paged_select, safe_execute  # noqa: E402

import refresh_fa as rf  # noqa: E402

CLOSE = 0.01  # "agrees" threshold, relative


def rel(a: float, b: float) -> float:
    return abs(a - b) / max(abs(a), abs(b), 1e-9)


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify vnstock FA against stored FiinProX data + scores")
    ap.add_argument("--period", default="2026-Q2", help="Quarter to verify (default 2026-Q2)")
    ap.add_argument("--symbols", nargs="+", help="Explicit symbols (default: random sample)")
    ap.add_argument("--limit", type=int, default=60, help="Sample size when --symbols is absent")
    ap.add_argument("--seed", type=int, default=4, help="Sample seed, so a run is reproducible")
    ap.add_argument("--show-worst", type=int, default=10, help="How many biggest score deltas to list")
    args = ap.parse_args()
    period = args.period

    client = get_supabase_client()
    print(f"Verifying {period} — vnstock derivation vs stored FiinProX data and scores")
    print("READ-ONLY: this script has no write path.\n")

    series_all = rf._load_quarterly(client, None)
    pe_all = rf._load_annual_pe(client, None)
    config = fa_persist.load_scoring_config(client)

    have = sorted(s for s, ser in series_all.items() if period in ser)
    if args.symbols:
        targets = [s.upper() for s in args.symbols]
    else:
        random.seed(args.seed)
        targets = sorted(random.sample(have, min(args.limit, len(have))))
    print(f"{len(have):,} symbols have a stored {period} row; verifying {len(targets)}\n")

    # Stored scores for the same quarter, to compare against rather than
    # recomputing the FiinProX side and hoping it matches what is live.
    stored: dict[str, dict] = {}
    for ch in [targets[i:i + 100] for i in range(0, len(targets), 100)]:
        for r in paged_select(
            lambda o, l, x=ch: client.table("fa_scores")
            .select("symbol,total_score,rating")
            .in_("symbol", x).eq("as_of_period", period)
            .order("symbol").range(o, o + l - 1),
            label="fa_scores",
        ):
            stored[r["symbol"]] = r

    field_stats = {f: {"n": 0, "ok": 0, "rel": [], "missing": 0} for f in vq.FIELDS}
    same = diff = fetch_fail = not_scorable = unsupported = 0
    moves: Counter[str] = Counter()
    deltas: list[float] = []
    worst: list[tuple] = []
    vs_stored_same = vs_stored_diff = 0

    for i, sym in enumerate(targets, 1):
        try:
            derived, missing = vq.rows_and_format(sym)
            if missing:
                # Banks / securities file a different chart of accounts. The
                # importer refuses these whole, so verifying them would measure
                # a case that will never be written.
                unsupported += 1
                print(f"  [{i}/{len(targets)}] {sym}: unsupported format "
                      f"(missing {', '.join(missing[:2])}) — skipped, as the importer would")
                continue
        except Exception as e:  # noqa: BLE001
            fetch_fail += 1
            print(f"  [{i}/{len(targets)}] {sym}: FETCH FAILED — {str(e)[:80]}")
            continue

        vrow = derived.get(period)
        fser = series_all.get(sym) or {}
        frow = fser.get(period)
        if not vrow or not frow:
            not_scorable += 1
            continue

        # --- 1. field fidelity -------------------------------------------
        for f in vq.FIELDS:
            a, b = frow.get(f), vrow.get(f)
            if a is None:
                continue
            s = field_stats[f]
            if b is None:
                s["missing"] += 1
                continue
            s["n"] += 1
            r = rel(float(a), float(b))
            s["rel"].append(r)
            if r <= CLOSE:
                s["ok"] += 1

        # --- 2. score, with ONE vnstock quarter on FiinProX history -------
        if period not in fa_metrics.eligible_periods(fser):
            not_scorable += 1
            continue
        mixed = dict(fser)
        mixed[period] = {f: vrow.get(f) for f in vq.FIELDS}
        price = (rf._load_prices(client, sym, latest_only=True) or [(None, None)])[-1][1]

        ra = compute_score(fa_metrics.compute_metrics(fser, period, price, pe_all.get(sym, [])),
                           config, fully_scorable=True)
        rb = compute_score(fa_metrics.compute_metrics(mixed, period, price, pe_all.get(sym, [])),
                           config, fully_scorable=True)
        d = abs(ra.total_score - rb.total_score)
        deltas.append(d)
        if ra.rating == rb.rating:
            same += 1
        else:
            diff += 1
            moves[f"{ra.rating}->{rb.rating}"] += 1
        worst.append((d, sym, ra.rating, rb.rating, ra.total_score, rb.total_score))

        # --- 3. sanity: does our FiinProX-side recompute match what is live?
        srow = stored.get(sym)
        if srow and srow.get("rating"):
            if srow["rating"] == ra.rating:
                vs_stored_same += 1
            else:
                vs_stored_diff += 1

        if i % 20 == 0:
            print(f"  ...{i}/{len(targets)}")

    n = same + diff
    print(f"\n{'=' * 66}\nFIELD FIDELITY vs stored fa_quarterly ({period})")
    print(f"{'field':14s} {'n':>5s} {'<=1%':>6s} {'median rel':>11s} {'p90':>9s} {'missing':>8s}")
    for f in vq.FIELDS:
        s = field_stats[f]
        if not s["n"]:
            print(f"{f:14s} {'-- no overlap --'}")
            continue
        r = sorted(s["rel"])
        print(f"{f:14s} {s['n']:>5} {100 * s['ok'] / s['n']:>5.0f}% "
              f"{st.median(r):>11.4f} {r[int(len(r) * 0.9)]:>9.4f} {s['missing']:>8}")

    print(f"\nSCORE EFFECT — one vnstock quarter on FiinProX history ({n} scored)")
    if n:
        deltas.sort()
        print(f"  same A/B/C band : {same} ({100 * same / n:.0f}%)")
        print(f"  band CHANGED    : {diff} ({100 * diff / n:.0f}%)  {dict(moves) or ''}")
        print(f"  |score delta|   : median {st.median(deltas):.1f}  "
              f"p90 {deltas[int(len(deltas) * 0.9)]:.1f}  max {deltas[-1]:.1f} (of 108)")
        print(f"\n  biggest movers (delta, symbol, FiinProX -> vnstock):")
        for d, sym, a, b, ta, tb in sorted(worst, reverse=True)[:args.show_worst]:
            if d == 0:
                break
            print(f"    {sym:6s} {a:>2s}->{b:<2s}  {ta:>3.0f} -> {tb:<3.0f}  (delta {d:.0f})")

    print(f"\nSANITY — our FiinProX-side recompute vs the STORED fa_scores rating")
    print(f"  agree: {vs_stored_same}   disagree: {vs_stored_diff}"
          f"   (disagreement means scorer/config drift, not a source difference)")
    print(f"\nskipped: {fetch_fail} fetch failures, {not_scorable} not scorable at {period}, "
          f"{unsupported} unsupported format (banks/securities — the importer refuses these)")
    print("No data was written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
