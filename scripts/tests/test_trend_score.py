#!/usr/bin/env python3
"""Pin the Trend Score state tables (2026-08-17).

Runnable directly (`python3 scripts/tests/test_trend_score.py`) or under pytest,
matching the convention in test_bqs_v8.py.

Why this exists
---------------
The trend spec (`data/He_thong_cham_diem_Xu_huong_TA_Pro.xlsx`) says three times,
in three different sheets, that its STATE TABLE beats mechanical addition. The
temptation to just sum the five criteria is exactly what it is warning against,
and the two places it bites are:

  1. **Daily D1 scores 60, not 70.** TC4's 10 points do not land when the
     pullback forms; they land at A1, where 15+15+30+10+30 = 100. Summing gives a
     D1 of 70 that appears nowhere in the spec.
  2. **A failed base condition caps everything.** TC1 (within 25% of the 52-week
     high) and TC2 (above the daily MA200) gate the structural score entirely —
     a complete uptrend below its MA200 scores 15 on the daily chart and 0 on the
     weekly one, not 100.

Also pinned: the ZigZag's window-edge behaviour. A ZigZag seeds its first leg at
bar 0, so any symbol whose window opens below its later lows produces a bar-0
"trough" that no peak can precede. Recording that as K pins it at the cheapest
price in the window forever and every genuine O–K pair formed later is rejected
for being higher — the symbol reads "no structure" for good. Measured on the live
universe: 124 symbols hit this, 117 of them with the trough inside the first ten
bars.
"""

import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ta.trend_score import (  # noqa: E402
    TREND_DEFAULTS, _state_scores, _to_weekly, _verdict, direction,
    score_symbol, score_timeframe,
)
from ta.zigzag import zigzag  # noqa: E402

CFG = TREND_DEFAULTS

# Weekly fixtures, in WEEKLY bars, sized for the weekly ZigZag (7% deviation,
# 6-candle depth). The structure is deliberately wide — O 110 / A1 140 — because a
# valid weekly D1 has to fall at least 7% from A1 AND stay above O, and a narrow
# O–A1 band leaves no room at all for one to exist.
WK_OK = [(0, 100), (12, 100), (8, 110), (8, 90)]        # O = 110, K = 90
WK_A = WK_OK + [(10, 140)]                              # close takes out O
WK_D1 = WK_A + [(8, 125), (8, 135)]                     # trough 125, inside (110, 140)
WK_A2 = WK_D1 + [(8, 145)]                              # close takes out A1 = 140
WK_D2_ABOVE = WK_A2 + [(8, 165), (8, 150), (8, 162)]    # trough 150, still above A1
WK_D2_BETWEEN = WK_A2 + [(8, 130)]                      # D1 < close < A1
WK_BREAK_D1 = WK_A2 + [(8, 118)]                        # close under D1
WK_BACK_O = WK_A + [(8, 105)]                           # close back under O


def _ramp(waypoints):
    """Piecewise-linear series through [(bars, target)]; starts at the first target."""
    out = [float(waypoints[0][1])]
    for n, tgt in waypoints[1:]:
        a = out[-1]
        for k in range(1, n + 1):
            out.append(a + (tgt - a) * k / n)
    return out


def _sessions(n, start="2024-01-01"):
    d, out = date.fromisoformat(start), []
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def _weeks(n, start="2024-01-05"):
    d = date.fromisoformat(start)
    return [(d + timedelta(days=7 * i)).isoformat() for i in range(n)]


def _daily(waypoints):
    """score_symbol() over a synthetic daily series built from waypoints."""
    c = _ramp(waypoints)
    h = [x * 1.005 for x in c]
    lo = [x * 0.995 for x in c]
    res = score_symbol(_sessions(len(c)), c[:], h, lo, c[:], [1e6] * len(c), CFG)
    assert res is not None, "synthetic series should be long enough to score"
    return res


def _weekly(waypoints, tc1=True, tc2=True):
    """score_timeframe() over a synthetic WEEKLY series.

    Driven directly rather than through daily bars: one weekly pivot needs ~30
    sessions of daily data per leg, so a daily series long enough to exercise every
    weekly state would be thousands of bars of scaffolding.
    """
    c = _ramp(waypoints)
    return score_timeframe(_weeks(len(c)), c, CFG, "weekly", tc1, tc2, 95.0, -0.03)


# --- the two rules the spec repeats -----------------------------------------

def test_daily_d1_holds_at_60_and_does_not_sum_to_70():
    r = _daily([(0, 100), (200, 100), (60, 120), (40, 90), (40, 130),
                (14, 121), (14, 128)])["daily"]
    assert r["state"] == "d1", r["state"]
    assert r["score"] == 60, f"D1 must stay at 60, got {r['score']} (70 = summed TC4)"
    pts = CFG["points"]["daily"]
    assert _state_scores(pts, weekly=False)["d1"] == _state_scores(pts, weekly=False)["a"], \
        "daily D1 and A must score the same"
    assert _state_scores(pts, weekly=False)["complete"] == 100, "A1 is where TC4's 10 land"


def test_weekly_d1_does_add_its_ten():
    """Weekly is the opposite: TC4 lands at D1, for 15+15+40+10 = 80."""
    r = _weekly(WK_D1)
    assert r["state"] == "d1", r["state"]
    assert r["score"] == 80, r["score"]


def test_failed_base_condition_caps_a_complete_structure():
    """A finished uptrend below its MA200: 15 on the daily chart, 0 on the weekly."""
    complete = [(0, 100), (200, 100), (60, 120), (40, 90), (40, 130), (14, 121),
                (14, 128), (12, 140)]
    assert _daily(complete)["daily"]["score"] == 100, "sanity: the structure is complete"

    # Same structure, but TC2 fails. Driven through score_timeframe so the base
    # conditions can be set independently of the synthetic prices.
    c = _ramp(complete)
    d = _sessions(len(c))
    below = score_timeframe(d, c, CFG, "daily", tc1=True, tc2=False, ma200=999.0, dist52w=-0.03)
    assert below["stage"] == "complete", below["stage"]
    assert below["state"] == "ok_below_ma200" and below["score"] == 15, (below["state"], below["score"])

    wk = _weekly(WK_A2, tc2=False)
    assert wk["stage"] == "complete", wk["stage"]
    assert wk["state"] == "below_ma200" and wk["score"] == 0, (wk["state"], wk["score"])


def test_both_base_conditions_failing_scores_zero():
    c = _ramp([(0, 100), (200, 100), (60, 120), (40, 90), (30, 110)])
    r = score_timeframe(_sessions(len(c)), c, CFG, "daily", tc1=False, tc2=False,
                        ma200=999.0, dist52w=-0.40)
    assert r["state"] == "ok_base_fail" and r["score"] == 0, (r["state"], r["score"])


# --- the daily state table --------------------------------------------------

def test_daily_state_table():
    cases = [
        ("no_ok", 0, [(0, 100), (400, 180)]),                                    # never a pivot pair
        ("base", 30, [(0, 100), (200, 100), (60, 120), (40, 90), (30, 110)]),
        ("a_confirmed", 60, [(0, 100), (200, 100), (60, 120), (40, 90), (40, 130)]),
        ("d1", 60, [(0, 100), (200, 100), (60, 120), (40, 90), (40, 130), (14, 121), (14, 128)]),
        ("a1_uptrend", 100, [(0, 100), (200, 100), (60, 120), (40, 90), (40, 130),
                             (14, 121), (14, 128), (12, 140)]),
    ]
    for state, score, wp in cases:
        r = _daily(wp)["daily"]
        assert r["state"] == state, f"expected {state}, got {r['state']}"
        assert r["score"] == score, f"{state}: expected {score}, got {r['score']}"


def test_daily_reset_below_d1_after_a1():
    """"Mốc reset là D1" — and the base conditions survive the reset."""
    r = _daily([(0, 100), (200, 100), (60, 120), (40, 90), (40, 130), (14, 121),
                (14, 128), (12, 140), (12, 115)])["daily"]
    assert r["state"] == "break_d1", r["state"]
    assert r["score"] == 30, f"reset keeps TC1+TC2, got {r['score']}"
    assert r["stage"] == "none" and not r["levels"], "the structure must be buried"


def test_daily_reset_below_k_before_a1():
    """NOT in the spec, added deliberately: the daily sheet writes a reset rule only
    for after A1, which would hold a broken-out stock at 60 through any collapse."""
    r = _daily([(0, 100), (200, 100), (60, 120), (40, 90), (40, 130), (30, 85)])["daily"]
    assert r["state"] == "back_below_k", r["state"]
    assert r["stage"] == "none"


# --- the weekly state table -------------------------------------------------

def test_weekly_state_table():
    cases = [
        ("base_only", 30, WK_OK + [(8, 105)]),
        ("a_confirmed", 70, WK_A),
        ("d1", 80, WK_D1),
        ("a2_full_uptrend", 100, WK_A2),
        ("d2_above_a1", 100, WK_D2_ABOVE),
        ("d2_between", 80, WK_D2_BETWEEN),
        ("break_d1", 30, WK_BREAK_D1),
        ("back_below_o", 30, WK_BACK_O),
    ]
    for state, score, wp in cases:
        r = _weekly(wp)
        assert r["state"] == state, f"expected {state}, got {r['state']}"
        assert r["score"] == score, f"{state}: expected {score}, got {r['score']}"


def test_weekly_criteria_sum_to_100():
    p = CFG["points"]["weekly"]
    assert p["tc1"] + p["tc2"] + p["a"] + p["d1"] + p["final"] == 100
    assert _state_scores(p, weekly=True)["complete"] == 100


def test_weekly_hard_rule_precedes_everything():
    """Below the daily MA200 the weekly score is 0 whatever the structure — this is
    the one rule the spec marks KHÔNG NGOẠI LỆ."""
    for wp in (WK_OK + [(8, 105)], WK_A, WK_D1, WK_A2):
        r = _weekly(wp, tc2=False)
        assert r["score"] == 0 and r["state"] == "below_ma200", (r["state"], r["score"])


# --- blend ------------------------------------------------------------------

def test_blend_is_60_40():
    assert CFG["weights"] == {"daily": 0.60, "weekly": 0.40}
    # The spec's own worked examples (Tổng quan F12:I14).
    for d, w, expected in ((100, 100, 100), (100, 80, 92), (60, 100, 76)):
        assert round(d * 0.6 + w * 0.4) == expected, (d, w)


# --- ZigZag -----------------------------------------------------------------

def test_zigzag_respects_deviation_and_depth():
    c = _ramp([(0, 100), (40, 130), (40, 95), (40, 125), (40, 100)])
    piv = zigzag(c, 0.05, 10)
    assert len(piv) >= 3, piv
    kinds = [p[2] for p in piv]
    assert all(a != b for a, b in zip(kinds, kinds[1:])), "pivots must alternate"
    idxs = [p[0] for p in piv]
    assert all(b - a >= 10 for a, b in zip(idxs, idxs[1:])), "depth must separate pivots"
    for idx, _v, _k, ci in piv:
        assert ci >= idx + 10, "a pivot cannot be confirmed before depth bars have passed"


def test_zigzag_ignores_moves_under_the_deviation():
    """A 3% wobble is not a pivot at a 5% deviation."""
    c = _ramp([(0, 100), (30, 103), (30, 100), (30, 103), (30, 100)])
    assert zigzag(c, 0.05, 10) == []


def test_zigzag_leaves_the_last_depth_bars_unconfirmed():
    c = _ramp([(0, 100), (40, 130), (40, 95)])
    piv = zigzag(c, 0.05, 10)
    assert all(p[0] <= len(c) - 1 - 10 for p in piv), \
        "confirmation needs depth bars of hindsight, so the leg in progress has no pivot"


def test_window_edge_trough_cannot_pin_k():
    """A bar-0 trough must be skipped, not recorded — see the module docstring."""
    # Opens at its lowest price, rises, then forms a genuine O–K pair higher up.
    r = _daily([(0, 100), (200, 100), (60, 200), (40, 130), (20, 140)])["daily"]
    lv = r["levels"]
    assert "O" in lv and "K" in lv, f"a later O–K pair must still be found: {lv}"
    assert lv["O"]["value"] == 200 and lv["K"]["value"] == 130, lv
    assert r["state"] == "ok_below_52w" and r["score"] == 15, (r["state"], r["score"])


# --- weekly aggregation -----------------------------------------------------

def test_to_weekly_aggregates_iso_weeks():
    dates = ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-17"]
    o = [10, 11, 12, 13, 14, 15]
    h = [10.5, 11.5, 12.5, 13.5, 20.0, 15.5]
    lo = [9.0, 10.5, 11.5, 12.5, 13.5, 14.5]
    c = [10.2, 11.2, 12.2, 13.2, 14.2, 15.2]
    wd, wo, wh, wl, wc, wv = _to_weekly(dates, o, h, lo, c, [1, 2, 3, 4, 5, 6])
    assert wd == ["2026-08-14", "2026-08-17"], "each week is dated by its last session"
    assert wo == [10, 15], "open is the week's first"
    assert wc == [14.2, 15.2], "close is the week's last"
    assert wh == [20.0, 15.5] and wl == [9.0, 14.5]
    assert wv == [15, 6], "volume sums"


def test_partial_final_week_is_kept():
    """Mid-week, the last weekly bar's close must be the latest daily close — every
    rule in the spec compares against it."""
    dates = ["2026-08-10", "2026-08-11", "2026-08-12"]
    c = [10.0, 11.0, 12.0]
    _wd, _wo, _wh, _wl, wc, _wv = _to_weekly(dates, c, c, c, c, [1, 1, 1])
    assert wc[-1] == 12.0


# --- status / action --------------------------------------------------------

def test_status_and_action_match_the_prototype():
    """The customer's four-pill vocabulary, and the action it implies."""
    cases = [
        ("base", "tao_day", "theo_doi"),
        ("a_confirmed", "san_sang_mua", "san_sang_mua"),
        ("a1_uptrend", "san_sang_mua", "san_sang_mua"),
        ("d1", "cho_mua", "cho_mua"),
        ("post_a1_above_d1", "tiep_dien", "theo_doi"),
    ]
    for state, status, action in cases:
        assert _verdict(state) == (status, action), (state, _verdict(state))


def test_unreadable_daily_states_get_no_status_and_watch():
    """Nothing below the MA200 or off a broken structure may show a buy. The base
    conditions already gate this — ok_below_ma200 IS the state a complete structure
    collapses to when TC2 fails — so a missing status here is what keeps two thirds
    of the market off the buy list."""
    for state in ("no_ok", "ok_below_ma200", "ok_below_52w", "ok_base_fail",
                  "break_d1", "back_below_k"):
        status, action = _verdict(state)
        assert status is None, (state, status)
        assert action == "theo_doi", (state, action)


def test_direction_bands_follow_the_state_scores():
    """The five arrows are banded from each half's own score, so an arrow can never
    contradict the state that produced it."""
    assert direction(100, "a1_uptrend", CFG) == "strong_up"
    assert direction(80, "d1", CFG) == "up", "weekly D1"
    assert direction(70, "a_confirmed", CFG) == "up", "weekly A"
    assert direction(60, "d1", CFG) == "up", "daily A / D1"
    assert direction(30, "base", CFG) == "flat", "both base conditions, no break"
    assert direction(15, "ok_below_ma200", CFG) == "down", "one base condition"
    assert direction(0, "ok_base_fail", CFG) == "strong_down"
    assert direction(0, "below_ma200", CFG) == "strong_down"
    assert direction(None, "base", CFG) is None, "no score is not a direction"


def test_no_structure_has_no_direction():
    """`no_ok` scores 0 but must NOT read as "Giảm mạnh".

    A zero has two unrelated causes. Failing the base conditions is weakness;
    finding no O–K pair is an unidentifiable structure, and when the base
    conditions PASS it means a symbol that has climbed for 18 months without a
    qualifying decline — the opposite of falling hard. Banding on the number alone
    put DRI's daily "Đi ngang" (30, hence above its MA200) next to a weekly
    "Giảm mạnh" (0), two readings that cannot both hold when TC2 is the same test
    on both timeframes.
    """
    assert direction(0, "no_ok", CFG) is None
    assert direction(30, "no_ok", CFG) is None, "the state decides, not the score"


def test_zigzag_settings_are_per_timeframe():
    """Daily 5%/10, weekly 7%/6 — the weekly chart is not the daily one rescaled."""
    assert CFG["daily"] == {"deviation": 0.05, "depth": 10}
    assert CFG["weekly"] == {"deviation": 0.07, "depth": 6}


def test_min_bars_returns_none_not_zero():
    """Too little history is absence of data, not a failed test — MA200 does not
    exist, so neither TC2 nor the weekly hard rule can be evaluated."""
    c = _ramp([(0, 100), (150, 120)])
    assert score_symbol(_sessions(len(c)), c[:], c[:], c[:], c[:], [1e6] * len(c), CFG) is None


if __name__ == "__main__":
    fails = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  PASS {name}")
            except AssertionError as e:
                fails += 1
                print(f"  FAIL {name}: {e}")
    print("OK" if not fails else f"{fails} failure(s)")
    sys.exit(1 if fails else 0)
