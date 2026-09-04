#!/usr/bin/env python3
"""Pin BỔ SUNG 01 — the O/K re-seat for sideways chop around MA200 (2026-08-19).

Runnable directly (`python3 scripts/tests/test_trend_sideway_reset.py`) or under
pytest, matching the convention in test_bqs_v8.py.

The rule
--------
Spec: `data/ta/trend-score/He_thong_cham_diem_Xu_huong_TA_Pro_Bo_sung.xlsx`, sheets "Trend
ngày" and "Logic IT". A stock that chops across its MA200 prints several ZigZag
lows below it, and the base rule ("K is the LOWEST trough of the decline")
anchors K on whichever is cheapest — often months stale. Measured on the live
universe: BIO and CSM were both still anchored on a K from 2025-04-22, sixteen
months old, while price had long since recovered above MA200.

So when price is back above MA200 AND at least three ZigZag lows sat below the
MA200 *of their own day* within 52 weeks, O/K re-seat on the MOST RECENT such
low. The spec is emphatic that this is by DATE, not by price: "chọn ĐÁY DƯỚI
MA200 CUỐI CÙNG theo thời gian, KHÔNG chọn đáy có giá thấp nhất 52W".

What must not regress
---------------------
1. Both gates. Below MA200 today, or fewer than three such lows, and the rule
   must not fire at all — the spec's own ELSE branches say "GIỮ NGUYÊN logic O/K
   hiện có".
2. K is the LATEST low below MA200, never the cheapest.
3. It changes no score, no state table, and never touches the weekly chart
   ("Chỉ áp dụng cho Trend ngày"; "Không sửa bất kỳ thang điểm hoặc trạng thái
   nào của file gốc").
4. No lookahead: the re-seat lands on K's CONFIRMATION bar, so the walk cannot
   compare closes against an O that had not formed yet.
"""

import copy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ta.trend_score import (  # noqa: E402
    TREND_DEFAULTS, _ma_series, _sideway_reset_seed, score_timeframe,
)
from ta.zigzag import zigzag  # noqa: E402

CFG = TREND_DEFAULTS
DEV, DEPTH = CFG["daily"]["deviation"], CFG["daily"]["depth"]


def _ramp(waypoints):
    out = [float(waypoints[0][1])]
    for n, tgt in waypoints[1:]:
        a = out[-1]
        for k in range(1, n + 1):
            out.append(a + (tgt - a) * k / n)
    return out


def _chop_series():
    """A long base, then three dips below a falling MA200, then a recovery.

    Built long enough for MA200 to exist and for the dips to sit inside the
    252-bar lookback. The dips get progressively HIGHER so that "latest" and
    "cheapest" disagree — which is the whole point of the test.
    """
    return _ramp([
        (0, 100), (260, 100),          # flat base so MA200 settles near 100
        (20, 78), (20, 96),            # dip 1  — cheapest
        (20, 82), (20, 97),            # dip 2
        (20, 86), (25, 99),            # dip 3  — latest
        (25, 125),                     # recovery well above MA200
    ])


def _seed_for(closes, cfg=CFG):
    piv = zigzag(closes, closes, deviation=DEV, depth=DEPTH)
    return _sideway_reset_seed(closes, piv, _ma_series(closes, cfg["ma_period"]), cfg)


def test_fires_on_chop_and_reseats_on_the_LATEST_low():
    c = _chop_series()
    seed = _seed_for(c)
    assert seed is not None, "three dips below MA200 plus a recovery must fire the rule"
    (o_idx, o_val), (k_idx, k_val), activate = seed

    ma = _ma_series(c, CFG["ma_period"])
    lows = [p for p in zigzag(c, c, deviation=DEV, depth=DEPTH)
            if p[2] == -1 and ma[p[0]] is not None and p[1] < ma[p[0]]]
    assert len(lows) >= 3

    # THE distinction the spec calls out twice: latest by date, not lowest price.
    assert k_idx == max(p[0] for p in lows), "K must be the most RECENT low below MA200"
    cheapest = min(lows, key=lambda p: p[1])
    assert k_val > cheapest[1], "fixture is void if latest and cheapest coincide"
    assert k_idx != cheapest[0], "K must NOT be the cheapest low"

    assert o_idx < k_idx, "O must precede K"
    assert o_val > k_val, "O is the high the leg fell from"
    assert activate >= k_idx, "activation cannot precede the pivot it acts on"


def test_gate_one_price_still_below_ma200_does_not_fire():
    """The spec's outer ELSE: below MA200, keep the existing O/K logic."""
    c = _chop_series()
    c = c[:-25] + [c[-25] * 0.55] * 25          # end the series far below MA200
    ma = _ma_series(c, CFG["ma_period"])
    assert c[-1] < ma[-1], "fixture must end below MA200"
    assert _seed_for(c) is None


def test_gate_two_fewer_than_three_lows_does_not_fire():
    """The spec's inner ELSE: N < 3 is an ordinary decline, not chop."""
    c = _ramp([(0, 100), (260, 100), (20, 78), (30, 99), (25, 125)])  # one dip only
    ma = _ma_series(c, CFG["ma_period"])
    lows = [p for p in zigzag(c, c, deviation=DEV, depth=DEPTH)
            if p[2] == -1 and ma[p[0]] is not None and p[1] < ma[p[0]]]
    assert len(lows) < 3, "fixture must have fewer than the threshold"
    assert _seed_for(c) is None


def test_threshold_is_configurable_and_respected():
    c = _chop_series()
    strict = copy.deepcopy(CFG)
    strict["sideway_reset"]["min_lows"] = 99
    assert _seed_for(c, strict) is None

    off = copy.deepcopy(CFG)
    off["sideway_reset"]["enabled"] = False
    assert _seed_for(c, off) is None, "the switch must actually disable the rule"


def test_reseat_uses_each_low_s_own_ma200_not_todays():
    """"Low_i < DailyMA200_i" — a low is judged against the average of ITS day.

    Using today's MA200 for every low is the obvious shortcut and it is wrong in
    both directions: under a falling average it hides lows that really were below
    the line, and under a rising one it invents lows that never were.

    Driven with explicit pivots and an explicit MA200 series rather than a price
    ramp: the distinction is about which average each low is compared against, and
    a synthetic price series that happens to separate the two readings is far
    harder to read than simply stating them.
    """
    # A DECLINING MA200: 140 early, 100 today. Lows at 120 and 110 sat below the
    # average of their own day but sit ABOVE today's, so the two readings differ.
    n = 300
    ma = [None] * 200 + [140.0] * 40 + [120.0] * 30 + [100.0] * 30
    closes = [130.0] * n
    closes[-1] = 130.0                       # above today's MA200 of 100 → gate 1 open
    PIV_LOW, PIV_HIGH = -1, 1
    pivots = [
        (205, 150.0, PIV_HIGH, 215),
        (210, 120.0, PIV_LOW, 220),          # 120 < 140 (own)  but > 100 (today)
        (245, 155.0, PIV_HIGH, 255),
        (250, 110.0, PIV_LOW, 260),          # 110 < 120 (own)  but > 100 (today)
        (270, 145.0, PIV_HIGH, 275),
        (280, 95.0, PIV_LOW, 290),           # 95  <  100 (own and today)
    ]
    seed = _sideway_reset_seed(closes, pivots, ma, CFG)
    assert seed is not None, "three lows below their own MA200 must fire the rule"

    by_own = {p[0] for p in pivots if p[2] == PIV_LOW and p[1] < ma[p[0]]}
    by_today = {p[0] for p in pivots if p[2] == PIV_LOW and p[1] < ma[-1]}
    assert by_own == {210, 250, 280} and by_today == {280}, \
        "the two readings must genuinely disagree for this test to mean anything"

    (o_idx, _o), (k_idx, _k), _at = seed
    assert k_idx == 280, "K is the latest low that was below the average of ITS day"
    assert o_idx == 270, "O is the nearest confirmed swing high before K"
    # Had the code compared against today's MA200 it would have counted ONE low,
    # fallen under the threshold of three, and never fired at all.
    assert len(by_today) < CFG["sideway_reset"]["min_lows"]


def test_weekly_timeframe_is_untouched():
    """"Chỉ áp dụng cho Trend ngày." The weekly chart must score identically."""
    c = _chop_series()
    dates = [f"2024-01-{i % 28 + 1:02d}" for i in range(len(c))]
    on, off = copy.deepcopy(CFG), copy.deepcopy(CFG)
    off["sideway_reset"]["enabled"] = False
    a = score_timeframe(dates, c, off, "weekly", True, True, 100.0, -0.1)
    b = score_timeframe(dates, c, on, "weekly", True, True, 100.0, -0.1)
    assert a["state"] == b["state"] and a["score"] == b["score"]


def test_no_lookahead_activation_is_the_confirmation_bar():
    """The re-seat lands when the market PROVED K, not when K printed.

    Seeding at bar 0 instead would let the walk compare early closes against an O
    that had not formed yet and record a break months before one happened.
    """
    c = _chop_series()
    (_o, (k_idx, _kv), activate) = _seed_for(c)
    piv = [p for p in zigzag(c, c, deviation=DEV, depth=DEPTH) if p[0] == k_idx and p[2] == -1]
    assert piv, "K must be a real ZigZag pivot"
    assert activate == piv[0][3], "activation must be the pivot's own confirmation bar"
    assert activate > k_idx, "confirmation always trails the extreme"


def test_scoring_scale_is_unchanged():
    """The supplement re-seats O/K only — every score still comes from the same
    state table ("Không sửa bất kỳ thang điểm hoặc trạng thái nào của file gốc")."""
    c = _chop_series()
    dates = [f"2024-01-{i % 28 + 1:02d}" for i in range(len(c))]
    on, off = copy.deepcopy(CFG), copy.deepcopy(CFG)
    off["sideway_reset"]["enabled"] = False
    a = score_timeframe(dates, c, off, "daily", True, True, 100.0, -0.1)
    b = score_timeframe(dates, c, on, "daily", True, True, 100.0, -0.1)
    valid = set(_valid_daily_scores())
    assert a["score"] in valid and b["score"] in valid, \
        "both readings must land on a score the state table actually defines"


def _valid_daily_scores():
    from ta.trend_score import _state_scores
    s = _state_scores(CFG["points"]["daily"], weekly=False)
    return set(s.values()) | {0, 15, 30}


if __name__ == "__main__":
    fails = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  ok   {name}")
            except AssertionError as e:
                fails += 1
                print(f"  FAIL {name}: {e}")
    print("PASS" if not fails else f"{fails} FAILED")
    sys.exit(1 if fails else 0)
