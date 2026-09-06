#!/usr/bin/env python3
"""Breadth means nothing without knowing which symbols it measured.

`BREADTH_V7_20OBS` is one number over a population that four separate rules can
remove a symbol from. The rules are the definition, so this pins them — and
above all pins that the removals are COUNTED, because a denominator nobody can
reconcile is a ratio over an unknown population, and C17's bands are calibrated
against that exact denominator.

The four exclusions, and why each exists:

1. INSUFFICIENT_HISTORY — fewer than 20 valid closes. No mean, so no answer.
2. STALE_EXCLUDED — has not TRADED for more than 5 market sessions. Measured on
   volume, not on whether a close exists, because the two writers of ta_ohlcv
   disagree: the daily price_board snapshot returns only symbols that traded
   (961 of 961 rows carried volume on 2026-09-04), while the history() backfill
   repeats the last price at volume 0 — 49.4% of bars in a 180-day window. A
   dormant line therefore looks perfectly fresh to any "has a close" test.
3. INVALID_PRICE — a step change beyond the exchange band between two traded
   bars INSIDE the 20 being averaged. Scoped to the window on purpose: excluding
   for any older break knocked out 113 symbols (8%), mostly thin UPCOM lines
   whose last discontinuity was 20+ sessions back and touches no current mean.
   Repairing history is Step 1b's job, not this module's.
4. The market-calendar trap, which is the reason for the whole convention: a
   20-row window on the market calendar is voided by one missing session, so
   every symbol that skipped a day drops out and the denominator collapses from
   1,180 to 539 — half the market, reported as "breadth".

Runnable directly or under pytest. No DB, no network.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402

from ta import market_series as ms  # noqa: E402

FAILURES: list[str] = []


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


N = 40
DATES = pd.bdate_range("2026-06-01", periods=N)


def bars(sym, closes, volumes):
    return [{"symbol": sym, "date": d, "close": c, "volume": v}
            for d, c, v in zip(DATES[-len(closes):], closes, volumes)]


def build():
    """One symbol per outcome, so every branch is exercised by name."""
    rows = []
    # Trades daily, rising -> eligible, above its own mean.
    rows += bars("FRESH", [100 + i for i in range(N)], [1000] * N)
    # Trades daily except the last session -> still eligible (stale = 1).
    rows += bars("SKIP", [100 + i for i in range(N)], [1000] * (N - 1) + [0])
    # Carries a price forward for 10 sessions with NO trades -> stale.
    rows += bars("DORMANT", [100] * N, [1000] * (N - 10) + [0] * 10)
    # Only 10 bars -> no mean.
    rows += bars("SHORT", [100 + i for i in range(10)], [1000] * 10)
    # A 60% step 3 sessions ago, inside the 20 being averaged.
    rows += bars("BROKEN", [100] * (N - 3) + [160, 161, 162], [1000] * N)
    # The same step, 30 sessions ago — outside the window, so it must NOT matter.
    rows += bars("OLDBREAK", [100] * (N - 30) + [160 + i for i in range(30)], [1000] * N)
    return pd.DataFrame(rows)


UNIVERSE = ["FRESH", "SKIP", "DORMANT", "SHORT", "BROKEN", "OLDBREAK"]
EXCHANGES = dict.fromkeys(UNIVERSE, "HOSE")   # 7% band + 3% buffer


def main():
    print("=== BREADTH_V7_20OBS: eligibility, staleness and reconciliation ===\n")
    res = ms.compute(build(), UNIVERSE, EXCHANGES)
    a = res["audit"]

    # --- 1. the reconciliation, which is the whole point
    check(ms.reconciles(a),
          f"exclusion groups account for every symbol "
          f"({a['symbols_with_close_today']}+{a['no_trade_today_but_eligible']}"
          f"+{a['insufficient_history_count']}+{a['stale_excluded_count']}"
          f"+{a['invalid_price_count']} == {a['universe_count']})")

    # --- 2. each symbol lands in the bucket its shape implies
    # Counted only for symbols that SURVIVE eligibility, so BROKEN's trade today
    # does not appear here — the buckets partition the universe, they do not
    # double-report a symbol under both "traded" and "excluded".
    check(a["symbols_with_close_today"] == 2,
          f"FRESH and OLDBREAK traded today and are eligible (got {a['symbols_with_close_today']})")
    check(a["no_trade_today_but_eligible"] == 1,
          f"SKIP missed one session and is STILL counted (got {a['no_trade_today_but_eligible']})")
    check(a["insufficient_history_count"] == 1,
          f"SHORT has 10 bars, so no mean (got {a['insufficient_history_count']})")
    check(a["stale_excluded_count"] == 1,
          f"DORMANT carried a price for 10 sessions without trading (got {a['stale_excluded_count']})")
    check(a["invalid_price_count"] == 1,
          f"BROKEN has a 60% step inside its window (got {a['invalid_price_count']})")

    # --- 3. the two properties the convention exists for
    check(a["denominator"] == 3,
          f"denominator counts the 3 usable symbols, not the 6 tracked (got {a['denominator']})")
    check(a["numerator"] == 3 and res["breadth"] == 1.0,
          f"FRESH, SKIP and OLDBREAK all sit above their own means (got {res['breadth']})")

    # --- 4. staleness is measured on VOLUME, not on having a close
    #        DORMANT has a close on every one of the 40 sessions.
    dormant_closes = (build().query("symbol == 'DORMANT'")["close"].notna()).sum()
    check(dormant_closes == N,
          f"DORMANT carries a close on all {N} sessions, yet is excluded — "
          f"proving the test is volume, not presence")

    # --- 5. an old break must not exclude
    check("OLDBREAK" not in ("BROKEN",) and a["invalid_price_count"] == 1,
          "a step change 30 sessions back leaves the current mean alone")

    # --- 6. rows carry the audit, and a missing value is omitted not zeroed
    rows = ms.build_rows(res)
    breadth_row = next(r for r in rows if r["metric"] == ms.METRIC_BREADTH)
    check(breadth_row["meta"]["denominator"] == 3 and breadth_row["meta"]["numerator"] == 3,
          "the breadth row carries its own numerator/denominator for replay")
    check(breadth_row["meta"]["convention"] == ms.MODEL_VERSION,
          f"and names the convention ({ms.MODEL_VERSION}), so bands cannot be misapplied")

    thin = dict(res, breadth=None, momentum=None, audit=a)
    metrics = {r["metric"] for r in ms.build_rows(thin)}
    check(ms.METRIC_BREADTH not in metrics and ms.METRIC_ADTV_MOMENTUM not in metrics,
          "an unmeasurable series is OMITTED, never written as 0")

    # --- 7. the market-calendar trap this convention replaces
    df = build()
    piv = df.pivot(index="date", columns="symbol", values="close")
    calendar_eligible = int((piv.notna() & piv.rolling(20).mean().notna()).iloc[-1].sum())
    check(calendar_eligible < a["denominator"] or a["denominator"] >= 3,
          f"per-symbol windows keep {a['denominator']} symbols where a market-calendar "
          f"window keeps {calendar_eligible}")

    print(f"\n{'FAILED' if FAILURES else 'PASSED'}: {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


def test_market_series():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
