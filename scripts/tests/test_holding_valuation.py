"""Holding valuation /12 — BA's §4 band table and §5 boundary cases.

BA `FINAL_BA_SPEC_HOLDING_VALUATION_HOLDING_UI_TOAN_NGANH_UI_2026-10-04.md`.

Runs standalone or under pytest, with NO database.

THE BAND TABLE IS IDENTICAL TO REINSURANCE R5'S TODAY AND IS STILL TESTED
SEPARATELY. BA issues it under its own version string, so the two may diverge;
a test that imported R5's table would pass through a divergence silently.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fa import holding_valuation as HV      # noqa: E402

PASS, FAIL = [], []


def check(name, got, want):
    ok = got == want
    (PASS if ok else FAIL).append(f"{name}: got {got!r} want {want!r}")
    assert ok, f"{name}: got {got!r}, want {want!r}"


#: §5, transcribed verbatim — every edge AND the value just past it.
SPEC_CASES = (
    (0.699999, 12), (0.700000, 12), (0.700001, 10),
    (0.850000, 10), (0.850001, 8),
    (1.000000, 8), (1.000001, 6),
    (1.150000, 6), (1.150001, 3),
    (1.300000, 3), (1.300001, 0),
)


def test_spec_boundary_table():
    for rel, want in SPEC_CASES:
        check(f"relative {rel}", HV.score(rel), want)


def test_bands_are_upper_closed():
    """Cheap scores high, so every bound reads `<=` — the opposite closure from
    B1-B4/P1-P4 and from R1/R2/R4. Asserting the ceilings alone would pass a
    lower-closed table too, so the value just past each one is asserted as well.
    """
    for ceiling, pts in HV.BANDS:
        check(f"at {ceiling}", HV.score(ceiling), pts)
    for rel, want in ((0.70001, 10), (0.85001, 8), (1.00001, 6),
                      (1.15001, 3), (1.30001, 0)):
        check(f"just past {rel}", HV.score(rel), want)


def test_audit_agrees_with_the_spec():
    check("audit", HV.audit_bands(), [])


def test_absence_is_never_zero():
    """0/12 is a real verdict — "expensive against its own history". It must
    never stand in for "we could not measure this"."""
    check("None in, None out", HV.score(None), None)
    check("0 is reachable", HV.score(2.0), 0)


def test_twenty_quarters_is_a_hard_floor():
    """§3.3 forbids falling back to 8, 12 or 16 quarters. Nineteen scores
    nothing, twenty scores."""
    series = {f"20{y:02d}-Q{q}": 1.0
              for y in range(20, 26) for q in range(1, 5)}
    nineteen = dict(sorted(series.items())[:19])
    period = sorted(nineteen)[-1]
    r = HV.relative_pb(nineteen, period)
    check("19 quarters n_valid", r["n_valid"], 19)
    check("19 quarters score", r["score"], None)
    check("19 quarters status", r["status"], HV.STATUS_NOT_SCORED)

    twenty = dict(sorted(series.items())[:20])
    period = sorted(twenty)[-1]
    r = HV.relative_pb(twenty, period)
    check("20 quarters n_valid", r["n_valid"], 20)
    check("20 quarters status", r["status"], HV.STATUS_OK)
    check("20 quarters relative", r["relative_pb"], 1.0)
    check("20 quarters score", r["score"], 8)        # rel == 1.00 → the <=1.00 band


def test_window_never_reaches_past_its_own_period():
    """§3.1 NO_LOOKAHEAD. The median for an older quarter must not see the
    quarters that came after it — the easiest failure to ship, because the
    result looks perfectly reasonable either way."""
    series = {f"20{y:02d}-Q{q}": (1.0 if f"20{y:02d}-Q{q}" <= "2024-Q4" else 99.0)
              for y in range(20, 26) for q in range(1, 5)}
    r = HV.relative_pb(series, "2024-Q4")
    check("window_last", r["window_last"], "2024-Q4")
    # Every value in scope is 1.0, so a median of 1.0 proves the 99s were
    # excluded; a look-ahead would drag it upward.
    check("median excludes the future", r["median_pb_20q"], 1.0)


def test_more_than_twenty_takes_the_LATEST_twenty():
    series = {f"20{y:02d}-Q{q}": (5.0 if f"20{y:02d}-Q{q}" < "2021-Q1" else 1.0)
              for y in range(18, 26) for q in range(1, 5)}
    r = HV.relative_pb(series, "2026-Q2")
    check("n_valid capped", r["n_valid"], 20)
    check("window starts", r["window_first"], "2021-Q1")
    check("old values excluded", r["median_pb_20q"], 1.0)


def test_non_positive_series_is_held_for_review_not_scored_zero():
    """§3.4 — a non-positive current P/B or median means the series or the
    mapping is broken. Scoring it 0 would publish a verdict on a company from a
    number we know is wrong."""
    series = {f"20{y:02d}-Q{q}": 1.0
              for y in range(21, 26) for q in range(1, 5)}
    period = sorted(series)[-1]
    series[period] = -1.0
    r = HV.relative_pb(series, period)
    # A non-positive current is excluded from `usable`, so the window falls
    # one short and the row reports too little history rather than a score.
    check("not scored", r["score"], None)
    check("never zero", r["score"] is not None and r["score"] == 0, False)


def test_versions_are_pinned():
    check("formula", HV.FORMULA_VERSION, "HOLDING_PB_RELATIVE_20Q_FORMULA_V1")
    check("threshold", HV.THRESHOLD_VERSION, "HOLDING_PB_RELATIVE_20Q_THRESHOLD_V1")
    check("weight", HV.VALUATION_WEIGHT, 12)
    check("required observations", HV.N_REQUIRED, 20)


def test_band_text_describes_the_table_the_scorer_runs():
    lines = HV.band_text()
    check("one line per band plus the open end", len(lines), len(HV.BANDS) + 1)
    for (ceiling, pts), line in zip(HV.BANDS, lines):
        check(f"line for {ceiling}", f": {pts} điểm" in line, True)


def main():
    fns = [v for k, v in sorted(globals().items())
           if k.startswith("test_") and callable(v)]
    failed = 0
    for fn in fns:
        try:
            fn()
        except AssertionError as e:
            failed += 1
            print(f"FAIL {fn.__name__}: {e}")
    print(f"\n{len(PASS)} checks passed, {len(FAIL)} failed, "
          f"{len(fns) - failed}/{len(fns)} test functions OK")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
