#!/usr/bin/env python3
"""BQS V8 scoring validation against the 5 rows of the spec's `Test_Cases` sheet
(data/ta/price-base-bqs/BQS_V8_BoSung_V7_DacTa_IT_HoanThien.xlsx).

The Test_Cases sheet gives the aggregate metrics (duration, depth, TightRange,
VolDryRatio, Range_1/2/3, spring, breakout) and an expected outcome. This test
feeds those metrics through the real scoring functions in ta.price_base and
pins the resulting component points, total (== BQS, no normalization), grade,
and 4-state status.

Run standalone:  python3 scripts/tests/test_bqs_v8.py
Or via pytest:   pytest scripts/tests/test_bqs_v8.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ta.price_base import (  # noqa: E402
    BASE_DEFAULTS as CFG,
    _base_status,
    _contraction,
    _grade,
    _max_pts,
    _tier,
)

T = CFG["tiers"]


def _dur_pts(base_type, weeks):
    return _tier(weeks, T["len1"] if base_type == "bottoming" else T["len2"])


def _depth_pts(base_type, depth):
    return _tier(depth, T["depth1"] if base_type == "bottoming" else T["depth2"])


def _contraction_pts(r1, r2, r3):
    """Exercise the real _contraction over a synthetic 24-bar base whose three
    zones have ranges r1/r2 (% from OHLCV) and r3 (% from the Tight Area)."""
    n = 24  # 3 zones × 8 bars; start=0, last=23, third=8
    lows = [100.0] * n
    highs = [100.0] * n
    highs[3] = 100.0 * (1 + r1 / 100.0)   # zone 1 (bars 0-7)
    highs[11] = 100.0 * (1 + r2 / 100.0)  # zone 2 (bars 8-15)
    a = {
        "_highs": highs, "_lows": lows, "_start": 0, "_last": n - 1,
        "_m": {"tight": {"range_pct": r3}},
    }
    return _contraction(a, CFG)["points"]


def _spring_pts(has_spring):
    # Test_Cases only records Có/Không; treat a present spring as a clean spring.
    return CFG["spring"]["points"]["clean"] if has_spring else CFG["spring"]["points"]["none"]


def _status(tight_range, vol_ratio, tight_valid, scenario):
    """Exercise the real _base_status. scenario: in_base | breakout | fail.

    Pivot = max high of the base EXCLUDING the last fail_lookback(5) bars. Build a
    10-bar base whose first 5 bars set the pivot at 108, then place recent closes
    per scenario."""
    lb = CFG["status"]["fail_lookback"]  # 5
    highs = [108.0] * 5 + [106.0] * 5   # pivot (bars 0-4) = 108
    lows = [100.0] * 10
    if scenario == "breakout":
        closes = [105.0] * 9 + [112.0]      # today closes above pivot
        close = 112.0
    elif scenario == "fail":
        closes = [105.0] * 7 + [112.0, 109.0, 105.0]  # broke out at bar 7, fell back
        close = 105.0
    else:  # in_base — never exceeds pivot
        closes = [105.0] * 10
        close = 105.0
    a = {
        "close": close, "base_high": 108.0, "_highs": highs, "_closes": closes,
        "_lows": lows, "_start": 0, "_last": 9,
        "_m": {"tight": {"high": 108.0, "low": 102.0, "range_pct": tight_range,
                         "vol_ratio_pct": vol_ratio, "valid": tight_valid}},
    }
    assert lb == 5  # helper geometry assumes fail_lookback == 5
    return _base_status(a, CFG)


# (case, type, dur_w, depth, tightR, volDry, r1, r2, r3, spring, scenario,
#  expected: length, depth, tight, voldry, contraction, spring, total, grade, status)
CASES = [
    ("1", "continuation", 8, 12, 6, 55, 18, 11, 6, False, "in_base",
     15, 15, 18, 15, 15, 0, 78, "B", "wait_buy"),
    ("2", "bottoming", 18, 28, 10, 60, 25, 16, 10, True, "in_base",
     15, 15, 14, 15, 15, 10, 84, "A", "wait_buy"),
    ("3", "continuation", 5, 18, 14, 110, 15, 16, 14, False, "in_base",
     10, 15, 8, 5, 5, 0, 43, "D", "watch"),
    ("4", "continuation", 10, 10, 5, 45, 20, 12, 5, False, "breakout",
     15, 15, 18, 20, 15, 0, 83, "A", "ready_buy"),
    ("5", "continuation", 10, 10, 5, 45, 20, 12, 5, False, "fail",
     15, 15, 18, 20, 15, 0, 83, "A", "breakout_fail"),
]


def check():
    # Component maxima sum to exactly 100 (raw == BQS, no normalization).
    total_max = (
        _max_pts(T["len2"]) + _max_pts(T["depth2"]) + _max_pts(T["tight"]) + _max_pts(T["voldry"])
        + _max_pts([[0, v] for v in CFG["contraction"]["points"].values()])
        + _max_pts([[0, v] for v in CFG["spring"]["points"].values()])
    )
    assert total_max == 100, f"component maxima sum to {total_max}, expected 100"

    failures = []
    for (cid, bt, dw, dp, tr, vd, r1, r2, r3, spr, scen,
         e_len, e_dep, e_tig, e_vol, e_con, e_spr, e_tot, e_grade, e_status) in CASES:
        length = _dur_pts(bt, dw)
        depth = _depth_pts(bt, dp)
        tight = _tier(tr, T["tight"])
        voldry = _tier(vd, T["voldry"])
        contraction = _contraction_pts(r1, r2, r3)
        spring = _spring_pts(spr)
        total = length + depth + tight + voldry + contraction + spring
        grade = _grade(total, CFG["grades"])
        status = _status(tr, vd, tr <= 12, scen)

        got = (length, depth, tight, voldry, contraction, spring, total, grade, status)
        exp = (e_len, e_dep, e_tig, e_vol, e_con, e_spr, e_tot, e_grade, e_status)
        ok = got == exp
        print(f"  case {cid} [{bt:>12}] total={total:>3} grade={grade:<2} status={status:<13} "
              f"{'OK' if ok else 'FAIL'}")
        if not ok:
            failures.append(f"case {cid}: got {got} != expected {exp}")

    if failures:
        print("\nFAILURES:")
        for f in failures:
            print("  -", f)
        return False
    print("\nAll 5 Test_Cases pass (components + total + grade + status).")
    return True


def test_bqs_v8_test_cases():
    assert check()


if __name__ == "__main__":
    sys.exit(0 if check() else 1)
