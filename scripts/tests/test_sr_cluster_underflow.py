#!/usr/bin/env python3
"""S/R cluster prices must survive the recency decay at depth.

`_cluster_pivots` weights each pivot by RECENCY_DECAY ** days_ago (0.95 ** d),
which is 4.3e-14 by 600 bars and 1.5e-18 by 800. The weighted mean divided by
the raw sum of those weights, guarded as `max(den, 1e-9)` against a
divide-by-zero — but for a cluster whose pivots are ALL older than ~404 bars
that sum falls below the floor legitimately, and the guard then divided a tiny
numerator by a far larger constant, rescaling the price by orders of magnitude.

It was live, not theoretical: 713 impossible levels across 419 symbols (28% of
the universe) on 2026-09-02 — DIG carrying a "support" at 0.0166 on a series
whose low is 2.32, PVH four levels between 4.8 and 122 against a 500-3100 range.
Those prices are drawn on the chart and feed near_support / rejects_at_resistance
/ wyckoff_spring.

The fix shifts the decay exponent by the cluster's own newest pivot, which
cancels out of the ratio. So the two properties pinned here are: the price is
the TRUE weighted mean (unchanged definition), and cluster STRENGTH still ranks
on the absolute recency scale (unchanged ordering).

Runnable directly or under pytest.
"""

import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402

from ta.sr import RECENCY_DECAY, _cluster_pivots  # noqa: E402

FAILURES: list[str] = []


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


def true_weighted_mean(prices, idxs, today_idx):
    """The definition, computed in a way that cannot underflow (exact ratio)."""
    from fractions import Fraction
    num = den = Fraction(0)
    for i in idxs:
        w = Fraction(95, 100) ** (today_idx - i)
        num += Fraction(prices[i]).limit_denominator(10**9) * w
        den += w
    return float(num / den)


def run_case(n_bars, pivot_positions, price_map, tol=1.0):
    prices = pd.Series([price_map.get(i, 999.0) for i in range(n_bars)], dtype=float)
    dates = [date(2020, 1, 1) + timedelta(days=i) for i in range(n_bars)]
    return _cluster_pivots(sorted(pivot_positions), prices, dates, n_bars - 1, tol)


def main():
    print("S/R cluster price under deep recency decay")

    # --- 1. the regression: a cluster whose pivots are ALL ancient -----
    # Three pivots ~800 bars back. Raw weight sum ~1.5e-18, far under the old
    # 1e-9 floor, which is exactly the case that produced a price near zero.
    n = 1200
    pos = [400, 405, 410]
    pmap = {400: 50.0, 405: 50.5, 410: 51.0}
    cl = run_case(n, pos, pmap)
    check(len(cl) == 1, f"one cluster formed (got {len(cl)})")
    price = cl[0]["price"]
    check(50.0 <= price <= 51.0,
          f"ancient cluster prices inside its own pivot range: {price:.6f} in [50.0, 51.0]")

    # --- 2. it is the TRUE weighted mean, not merely 'in range' -------
    expect = true_weighted_mean(prices=pmap, idxs=pos, today_idx=n - 1)
    check(abs(price - expect) < 1e-9,
          f"price equals the exact weighted mean ({price:.9f} vs {expect:.9f})")
    # The oldest pivot is weighted least, so the mean sits nearest the newest.
    check(price > 50.5, f"weighting favours the most recent pivot ({price:.4f} > 50.5)")

    # --- 3. a RECENT cluster is untouched --------------------------------
    n2 = 1200
    pos2 = [1195, 1197, 1199]
    pmap2 = {1195: 50.0, 1197: 50.5, 1199: 51.0}
    cl2 = run_case(n2, pos2, pmap2)
    exp2 = true_weighted_mean(prices=pmap2, idxs=pos2, today_idx=n2 - 1)
    check(abs(cl2[0]["price"] - exp2) < 1e-9,
          f"recent cluster unchanged ({cl2[0]['price']:.6f})")

    # --- 4. strength still ranks on the ABSOLUTE recency scale ----------
    # A recent cluster must outrank an ancient one of identical shape.
    check(cl2[0]["strength"] > cl[0]["strength"],
          f"recent cluster outranks ancient ({cl2[0]['strength']:.3e} > {cl[0]['strength']:.3e})")
    # And that strength is the old formula's value: sum(0.95**d) * touches.
    exp_strength = sum(RECENCY_DECAY ** (n2 - 1 - i) for i in pos2) * len(pos2)
    check(abs(cl2[0]["strength"] - exp_strength) < 1e-12,
          f"strength matches the absolute-scale formula ({cl2[0]['strength']:.6f})")

    # --- 5. an ancient cluster's strength collapses toward zero, and that
    #        is fine — it only orders, and the PRICE must still be sane.
    #        (0.95**3980 is 1.6e-88: tiny, but still a real float64. The old
    #        code's bug was never that strength got small — it was that the
    #        PRICE was computed by dividing by a floor instead of this sum.)
    n3 = 4000
    pos3 = [10, 15, 20]
    cl3 = run_case(n3, pos3, {10: 80.0, 15: 80.5, 20: 81.0})
    check(cl3[0]["strength"] < 1e-50,
          f"a ~4000-bar-old cluster ranks last on strength (got {cl3[0]['strength']:.3e})")
    check(80.0 <= cl3[0]["price"] <= 81.0,
          f"...but its price is still real: {cl3[0]['price']:.4f} in [80.0, 81.0]")

    print(f"\n{'FAILED' if FAILURES else 'PASSED'}: {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


def test_sr_cluster_underflow():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
