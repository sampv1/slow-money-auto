#!/usr/bin/env python3
"""The automated FA importer must not be able to touch scored history.

Two independent guards stand between vnstock and the FiinProX data:

  1. A PERIOD BOUNDARY. 2026-Q2 and everything before it is scored history and
     is frozen; only 2026-Q3 onward may be written. This is the guard that
     protects the past, and it is one comparison rather than a per-row rule.
  2. SOURCE PRECEDENCE. A row the FiinProX Excel importer wrote is never
     touched, whatever its period — which is what keeps that importer usable as
     the override for anything the automation gets wrong.

They are deliberately redundant. Either alone would be enough on a good day;
together, a bug in one is caught by the other instead of silently rewriting
financials. `writable_rows` is a pure function precisely so both can be pinned
here without a database.

Also pinned: the derivation traps. Each was found by measuring against FiinProX
and each is silently wrong rather than an error if reverted —

  * margins from raw line items, not the ratio table (which is TTM: 4% / 1%)
  * net margin over TOTAL net profit, not parent-attributable (59% if wrong)
  * EPS derived, not read as filed (43%, and 0 in 130 of 525 quarters)

Runnable directly or under pytest.
"""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402

import refresh_fa_auto as auto  # noqa: E402
from fa import vnstock_quarterly as vq  # noqa: E402

FAILURES: list[str] = []


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


def frame(rows: dict[str, dict[str, float]]):
    """Statement frame in the free package's shape: item_en + period columns."""
    periods = sorted({p for v in rows.values() for p in v})
    data = [{"item": k, "item_en": k, "item_id": i,
             **{p: v.get(p) for p in periods}}
            for i, (k, v) in enumerate(rows.items())]
    return pd.DataFrame(data)


def derived_for(periods):
    """A synthetic symbol with the given periods, all fields populated."""
    inc = frame({
        "Net sales": {p: 1000.0 for p in periods},
        "Gross Profit": {p: 400.0 for p in periods},
        "Net profit/(loss) after tax": {p: 100.0 for p in periods},
        "Attributable to parent company": {p: 90.0 for p in periods},
    })
    bal = frame({
        "Short-term borrowings": {p: 50.0 for p in periods},
        "Long-term borrowings": {p: 20.0 for p in periods},
        "Owner's Equity": {p: 5000.0 for p in periods},
        "Paid-in capital": {p: 1_000_000.0 for p in periods},
    })
    return vq.derive_rows("TEST", inc, bal)


def main():
    print("FA auto-import guards")

    PERIODS = ["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]
    derived = derived_for(PERIODS)
    check(len(derived) == len(PERIODS), f"derived {len(derived)} periods")

    # --- GUARD 1: the period boundary ---------------------------------
    rows, tally = auto.writable_rows(derived, {}, "2026-Q3")
    kept = sorted(r["period"] for r in rows)
    check(kept == ["2026-Q3", "2026-Q4"],
          f"only periods after the boundary are writable (got {kept})")
    check(tally["frozen"] == 4, f"4 frozen periods refused (got {tally['frozen']})")
    check(all(auto.period_index(p) >= auto.period_index("2026-Q3") for p in kept),
          "nothing at or before the boundary survives")

    # The boundary must hold even when NO row exists — "it's missing, so fill
    # it" is exactly the reasoning that would rewrite scored history.
    rows2, _ = auto.writable_rows(derived, {}, "2027-Q1")
    check(rows2 == [], "an all-frozen series writes nothing, even with no existing rows")

    # --- GUARD 2: source precedence -----------------------------------
    sources = {"2026-Q3": "fiinpro", "2026-Q4": "vnstock"}
    rows3, tally3 = auto.writable_rows(derived, sources, "2026-Q3")
    kept3 = sorted(r["period"] for r in rows3)
    check(kept3 == ["2026-Q4"], f"a FiinProX row is never touched (got {kept3})")
    check(tally3["fiinpro"] == 1, "the refusal is counted, not silent")

    # A vnstock-owned row IS refreshable — restatements must propagate.
    check(any(r["period"] == "2026-Q4" for r in rows3),
          "a vnstock-owned row is still updatable")

    # --- every written row carries its provenance ---------------------
    check(all(r["source"] == "vnstock" for r in rows),
          "every written row is stamped source='vnstock'")

    # --- a row with no usable numbers is not written ------------------
    empty = {"2026-Q3": {"symbol": "X", "period": "2026-Q3", "year": 2026,
                         "quarter": 3, "eps": None, "revenue": None}}
    rows4, tally4 = auto.writable_rows(empty, {}, "2026-Q3")
    check(rows4 == [] and tally4["empty"] == 1,
          "a row with neither EPS nor revenue is refused, not written as nulls")

    # --- GUARD 3: an unsupported statement format is refused WHOLE -----
    # Banks and securities firms file a different chart of accounts. The bank
    # case is self-limiting (no revenue, no EPS -> already refused), but a
    # securities firm derives revenue and EPS fine and loses only the MARGINS —
    # a row that looks complete enough to write, whose C5/C6 then score as lost
    # points rather than absent data. Measured: that is what moved SSI A->B and
    # VCI B->C in the 70-symbol verification.
    rows5, tally5 = auto.writable_rows(
        derived, {}, "2026-Q3", missing=["Gross Profit", "Net profit/(loss) after tax"])
    check(rows5 == [], "a symbol with missing line items writes NOTHING")
    check(tally5["format"] == len(derived),
          f"the whole symbol is refused, not row by row (got {tally5['format']})")

    # ...and a recognised format is unaffected by the same argument being empty
    rows6, tally6 = auto.writable_rows(derived, {}, "2026-Q3", missing=[])
    check(len(rows6) == 2 and tally6["format"] == 0,
          "an empty missing-list changes nothing")

    # the detector itself, on frames shaped like each filer type
    inc_ok = frame({v: {"2026-Q3": 1.0} for v in vq.INCOME.values()})
    bal_ok = frame({v: {"2026-Q3": 1.0} for v in vq.BALANCE.values()})
    check(vq.missing_labels(inc_ok, bal_ok) == [],
          "an industrial filer reports no missing labels")
    inc_sec = frame({v: {"2026-Q3": 1.0} for v in vq.INCOME.values()
                     if v not in ("Gross Profit", "Net profit/(loss) after tax")})
    check(sorted(vq.missing_labels(inc_sec, bal_ok)) ==
          ["Gross Profit", "Net profit/(loss) after tax"],
          "a securities filer is detected by its two absent income lines")

    # --- DERIVATION: the three traps ----------------------------------
    r = derived["2026-Q3"]
    check(abs(r["gross_margin"] - 0.4) < 1e-9,
          f"gross margin = Gross Profit / Net sales (got {r['gross_margin']})")
    check(abs(r["net_margin"] - 0.1) < 1e-9,
          f"net margin uses TOTAL net profit, not parent (got {r['net_margin']}, "
          f"parent-based would be 0.09)")
    check(abs(r["eps"] - 0.9) < 1e-9,
          f"EPS = parent / (paid-in capital / 10,000) (got {r['eps']})")
    check(abs(r["roe_ttm"] - (360.0 / 5000.0)) < 1e-9,
          f"ROE = TTM parent profit / avg equity (got {r['roe_ttm']})")

    # ROE needs four quarters; a short series must yield None, not a partial sum
    short = derived_for(["2026-Q3", "2026-Q4"])
    check(short["2026-Q3"]["roe_ttm"] is None,
          "ROE is None without four quarters of profit, never a 2-quarter sum")

    # --- period arithmetic --------------------------------------------
    check(vq._shift("2026-Q1", 1) == "2025-Q4", "quarter shift crosses the year")
    check(vq._shift("2026-Q2", 4) == "2025-Q2", "shift of 4 is the year-ago quarter")
    check(auto.period_index("2026-Q3") > auto.period_index("2026-Q2"),
          "period ordering is numeric, not lexicographic")

    # --- expected_period: the work-list depends on this ---------------
    # 20 days after quarter end, so early October still expects Q2, not Q3.
    check(auto.expected_period(date(2026, 10, 5)) == "2026-Q2",
          f"5 Oct expects Q2 (got {auto.expected_period(date(2026, 10, 5))})")
    check(auto.expected_period(date(2026, 10, 25)) == "2026-Q3",
          f"25 Oct expects Q3 (got {auto.expected_period(date(2026, 10, 25))})")
    check(auto.expected_period(date(2026, 1, 25)) == "2025-Q4",
          f"late Jan expects the prior Q4 (got {auto.expected_period(date(2026, 1, 25))})")

    print(f"\n{'FAILED' if FAILURES else 'PASSED'}: {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


def test_fa_auto_import():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
