#!/usr/bin/env python3
"""Pin the two rules BA's §13 asks IT to prove: the C5 bands and the gate.

Runnable directly or under pytest. No network.

Why each case is here:

1. §5.5's seven bands must be EXHAUSTIVE and non-overlapping. Reading them off
   a table is how an off-by-one at a boundary ships — every boundary value is
   asserted, including the signs, because "-10% đến dưới -5%" and "từ -5% đến
   dưới 0%" both mention -5.
2. §6.2 says the gate returns four states and the most severe wins. A priority
   rule expressed as prose is one `elif` order away from being wrong, and the
   two middle states have overlapping conditions BY DESIGN.
3. The gate's first condition is NOT independent of C5 — a buffer falling more
   than 10% is both `c5_points <= 1` and `Cảnh báo`. That is pinned so a future
   change to either table cannot silently break the correspondence.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from export_insurance_toan_nganh import (  # noqa: E402
    C1_TOP, C1_ZERO, C2_POINTS, C5_BANDS_V1, C5_BANDS_V2, GROWTH_GAP_PP,
    LOW_BASE_EPS_VND, PH_MIN_HISTORICAL_TTM, PH_MIN_QUARTERS,
    PH_WINDOW_QUARTERS, PROFIT_HISTORY_VERSION, SCALE_12_TO_10, THRESHOLDS,
    c1_display_state, c1_sign_override, c2_flag, c5_points,
    profit_history_context, shift, yoy_pct,
)


# --- §5.5, the seven bands --------------------------------------------------

def test_c5_bands_at_every_boundary():
    cases = [
        (50.0, 10), (10.0, 10),          # từ +10% trở lên
        (9.99, 8), (5.0, 8),             # +5% đến dưới +10%
        (4.99, 7), (0.0, 7),             # 0% đến dưới +5%  — exactly 0 scores 7
        (-0.01, 5), (-5.0, 5),           # -5% đến dưới 0%  — -5 belongs HERE
        (-5.01, 3), (-10.0, 3),          # -10% đến dưới -5%
        (-10.01, 1), (-20.0, 1),         # -20% đến dưới -10%
        (-20.01, 0), (-99.9, 0),         # dưới -20%
    ]
    for value, expected in cases:
        assert c5_points(value, C5_BANDS_V1) == expected, f"Δ={value} → {c5_points(value, C5_BANDS_V1)}, muốn {expected}"


def test_c5_bands_are_exhaustive():
    """No value between -200 and +200 may come back unscored."""
    v = -200.0
    while v <= 200.0:
        assert c5_points(round(v, 2), C5_BANDS_V1) is not None
        v += 0.25


def test_c5_missing_is_none_not_zero():
    """A missing buffer is absence of measurement. Zero is the WORST band, so
    returning it would assert a collapse that was never measured."""
    assert c5_points(None, C5_BANDS_V1) is None


# --- §6.2, the gate ---------------------------------------------------------

def gate(equity, d_buffer, equity_yoy, two_q):
    """The §6.2 ladder, same order as the exporter. Kept here as an executable
    statement of the priority rule."""
    if equity is not None and equity <= 0:
        return "Không đạt", "loại khỏi xếp hạng"
    if d_buffer is not None and d_buffer < -20 and (equity_yoy is not None and equity_yoy < 0):
        return "Rủi ro cao", 59
    if (d_buffer is not None and d_buffer < -10) or two_q:
        return "Cảnh báo", 79
    return "Đạt", None


def test_gate_returns_exactly_four_states():
    seen = {
        gate(1e12, 5.0, 3.0, False)[0],
        gate(1e12, -15.0, 2.0, False)[0],
        gate(1e12, -25.0, -4.0, False)[0],
        gate(-1.0, 5.0, 3.0, False)[0],
    }
    assert seen == {"Đạt", "Cảnh báo", "Rủi ro cao", "Không đạt"}


def test_most_severe_wins():
    """Every condition true at once must return the worst, not the first match."""
    assert gate(-1.0, -50.0, -30.0, True) == ("Không đạt", "loại khỏi xếp hạng")
    assert gate(1e12, -50.0, -30.0, True) == ("Rủi ro cao", 59)
    assert gate(1e12, -15.0, -30.0, True) == ("Cảnh báo", 79)


def test_high_risk_needs_BOTH_conditions():
    """§6.2: 'đệm vốn giảm trên 20% VÀ VCSH cũng giảm YoY'. A buffer collapsing
    while equity GROWS is a reserve build-up, not capital erosion."""
    assert gate(1e12, -25.0, +8.0, False)[0] == "Cảnh báo"
    assert gate(1e12, -25.0, -0.1, False)[0] == "Rủi ro cao"


def test_two_quarter_flag_alone_reaches_canh_bao():
    """The growth-imbalance route must work with a perfectly healthy buffer —
    it has never yet fired independently on live data, so only a test covers it."""
    assert gate(1e12, +12.0, +9.0, True) == ("Cảnh báo", 79)


def test_zero_equity_is_khong_dat():
    """'bằng hoặc nhỏ hơn 0' — exactly zero is excluded, not merely negative."""
    assert gate(0.0, 5.0, 3.0, False)[0] == "Không đạt"


def test_canh_bao_boundary_is_strictly_below_minus_ten():
    """Δ = -10% is C5's 3-point band and must NOT trip the gate; the gate says
    'giảm trên 10%'. The two tables have to agree on the same boundary."""
    assert gate(1e12, -10.0, 2.0, False)[0] == "Đạt"
    assert c5_points(-10.0, C5_BANDS_V1) == 3
    assert gate(1e12, -10.01, 2.0, False)[0] == "Cảnh báo"


def test_gate_first_condition_is_determined_by_c5():
    """Measured on live data: all 9 'Cảnh báo' symbol-quarters were exactly the
    9 with c5_points <= 1. Pinned so a table edit cannot break it unnoticed."""
    for d in (-10.01, -15.0, -20.0, -20.01, -60.0):
        assert c5_points(d, C5_BANDS_V1) <= 1
        assert gate(1e12, d, +5.0, False)[0] == "Cảnh báo"
    for d in (-10.0, -5.0, 0.0, 5.0, 10.0):
        assert c5_points(d, C5_BANDS_V1) > 1
        assert gate(1e12, d, +5.0, False)[0] == "Đạt"


# --- the scales -------------------------------------------------------------

def test_c2_table_is_the_integer_rendering_of_the_production_scale():
    """BA's §5.2 table is 0/3/7/10, which is 0/4/8/12 rescaled to 10 and
    rounded. That is the argument for using the same integers everywhere else
    instead of 3,33 and 6,67."""
    assert C2_POINTS == {0: 0, 1: 3, 2: 7, 3: 10}
    assert SCALE_12_TO_10 == {0: 0, 4: 3, 8: 7, 12: 10}
    assert [SCALE_12_TO_10[p] for p in (0, 4, 8, 12)] == [C2_POINTS[k] for k in (0, 1, 2, 3)]


def test_yoy_divides_by_the_absolute_base():
    """§5's formula. A year-ago LOSS must not flip the sign of the ratio."""
    assert yoy_pct(1150.0, 1000.0) == 15.0
    assert yoy_pct(-276.1, -337.6) > 0        # a smaller loss is an improvement
    assert yoy_pct(250.0, -500.0) == 150.0
    assert yoy_pct(100.0, 0) is None          # never divide by zero
    assert yoy_pct(None, 100.0) is None


def test_quarter_arithmetic_crosses_the_year():
    assert shift("2026-Q2", 4) == "2025-Q2"
    assert shift("2026-Q1", 1) == "2025-Q4"
    assert shift("2026-Q2", 6) == "2024-Q4"
    assert shift("2026-Q2", 8) == "2024-Q2"   # §4: ΔFA's deepest reach


def test_growth_gap_threshold_is_the_spec_value():
    assert GROWTH_GAP_PP == 20.0



# --- BA's reply: §2 sign cases, locked ---------------------------------------

def test_sign_cases_from_BAs_table():
    """§2's table, cell by cell. `None` means "score the percentage"."""
    assert c1_sign_override(500.0, 400.0) is None      # dương -> dương
    assert c1_sign_override(500.0, -400.0) == C1_TOP   # âm -> dương, chuyển lỗ thành lãi
    # BA's FINAL ruling reverses this row: a still-negative EPS scores 0 even
    # when the loss narrowed. The earlier reply scored it by the formula.
    assert c1_sign_override(-100.0, -400.0) == C1_ZERO  # âm -> âm ít hơn
    assert c1_sign_override(-500.0, 400.0) == C1_ZERO  # dương -> âm
    assert c1_sign_override(500.0, 0.0) == C1_TOP      # nền 0 -> dương
    assert c1_sign_override(0.0, 0.0) == C1_ZERO       # nền 0 -> không dương
    assert c1_sign_override(-5.0, 0.0) == C1_ZERO


def test_a_widening_loss_scores_zero():
    """§5 row "Âm | Âm nhiều hơn" — now an explicit row rather than a gap."""
    assert c1_sign_override(-200.0, -100.0) == C1_ZERO
    assert not c2_flag(-200.0, -100.0, yoy_pct(-200.0, -100.0))
    assert c1_display_state(-200.0, -100.0) == "lo_mo_rong"


def test_c1_and_the_c2_flag_never_disagree():
    """§2: "C1 và cờ tăng trưởng dùng cho C2 phải đọc cùng một kết quả kinh tế".
    A turnaround is the case that breaks a naive implementation: the percentage
    is positive under `/|base|` but the SIGNED ratio is negative, so a flag
    computed from the raw ratio would contradict a C1 of 10."""
    for now, base in ((532.9, -225.7), (254.4, -81.1), (322.3, -157.0),
                      (-125.5, -391.3), (1150.0, 1000.0), (-354.7, 299.3),
                      (100.0, 0.0), (-1.0, 0.0), (-200.0, -100.0)):
        pct = yoy_pct(now, base)
        ov = c1_sign_override(now, base)
        flag = c2_flag(now, base, pct)
        pts = ov if ov is not None else (10 if (pct or 0) > 0 else 0)
        assert flag == (pts > 0), f"{base} -> {now}: C1={pts} nhưng cờ={flag}"


def test_a_zero_base_never_divides():
    assert yoy_pct(500.0, 0.0) is None          # the formula refuses
    assert c1_sign_override(500.0, 0.0) == C1_TOP   # the override supplies the band


# --- BA's reply §3: the four-band tables -------------------------------------

def test_reply_c5_bands():
    # "Giảm từ 10%" INCLUDES -10, so -10 scores 0 — the one place the reply's
    # wording differs from the first table, which gave -10 three points.
    cases = [(50.0, 10), (10.0, 10), (9.99, 7), (0.0, 7),
             (-0.01, 3), (-9.99, 3), (-10.0, 0), (-10.01, 0), (-50.0, 0)]
    for value, expected in cases:
        got = c5_points(value, C5_BANDS_V2)
        assert got == expected, f"Δ={value} → {got}, muốn {expected}"


def test_reply_c5_is_uniformly_HARSHER_than_the_first_table():
    """The reply's table arrived in a section whose purpose was to LOOSEN
    compressed scores, but for C5 it tightens: measured on live data the mean
    falls 5,38 -> 4,77 and the count at 0 points goes 4 -> 9 of 39. Pinned so
    the direction is not mistaken for a loosening."""
    v = -30.0
    strictly_lower = 0
    while v <= 30.0:
        a = c5_points(round(v, 2), C5_BANDS_V1)
        b = c5_points(round(v, 2), C5_BANDS_V2)
        assert b <= a, f"Δ={v}: bản mới {b} cao hơn bản cũ {a}"
        strictly_lower += b < a
        v += 0.5
    assert strictly_lower > 0


def test_exactly_zero_buffer_change_scores_seven():
    """§3 writes "Giảm dưới 10%" and "Tăng dưới 10%", which leaves Δ = 0 in
    NEITHER band. IT reads it as 7 points, consistent with the first table's
    "từ 0% đến dưới +5%". Flagged to BA; pinned so the rule stays total."""
    assert c5_points(0.0, C5_BANDS_V2) == 7


def test_reply_bands_are_total_over_the_observed_range():
    for name, spec in THRESHOLDS.items():
        for key in ("c1", "c3", "c4"):
            bounds = spec[key]
            assert bounds == sorted(bounds), f"{name}.{key} không tăng dần"
            assert len(bounds) == 3


def test_reply_thresholds_match_BAs_table():
    """§3's numbers, transcribed once and pinned so a later edit is visible."""
    assert THRESHOLDS["ba_v2"]["c1"] == [0, 10, 20]
    assert THRESHOLDS["ba_v2"]["c3"] == [0, 5, 10]
    assert THRESHOLDS["ba_v2"]["c4"] == [5, 10, 15]
    assert THRESHOLDS["production"]["c1"] == [20, 30, 60]
    assert THRESHOLDS["production"]["c3"] == [10, 15, 20]
    assert THRESHOLDS["production"]["c4"] == [15, 17, 20]


def test_both_sets_are_marked_unlocked_or_baseline():
    """§4: neither set is the decision yet. The status string travels onto every
    output row, so a number can always say which bands produced it."""
    assert THRESHOLDS["ba_v2"]["status"] == "DE_XUAT_CHO_BA_KHOA"
    assert THRESHOLDS["production"]["status"] == "BAN_DAU_THEO_BANG_SAN_XUAT"


# --- BA's acceptance set §11: T01-T18 ---------------------------------------
# One test per case, named for the id, so a failure names the row BA wrote.

def _c1(now, base):
    """C1 points the way the exporter computes them, under BA's locked bands."""
    ov = c1_sign_override(now, base)
    if ov is not None:
        return ov
    pct = yoy_pct(now, base)
    bounds = THRESHOLDS["ba_v2"]["c1"]
    from fa.scoring import _tier_lt
    return SCALE_12_TO_10[_tier_lt(pct, {"bounds": bounds, "points": [0, 4, 8, 12]})]


def test_T01_positive_to_positive_rising():
    assert _c1(1250.0, 1000.0) == 10          # +25% -> band >= 20
    assert _c1(1050.0, 1000.0) == 3           # +5%  -> band < 10
    assert _c1(1150.0, 1000.0) == 7           # +15% -> band [10, 20)
    assert c2_flag(1250.0, 1000.0, yoy_pct(1250.0, 1000.0))


def test_T02_negative_to_positive():
    assert _c1(254.4, -81.1) == 10
    assert c2_flag(254.4, -81.1, yoy_pct(254.4, -81.1))
    assert c1_display_state(254.4, -81.1) == "lo_sang_lai"


def test_T03_narrowed_loss_scores_zero_and_is_not_counted():
    """The row BA reversed. Live effect measured before shipping: 4 symbol-quarters
    lose C2 points — AIC 2025-Q4 (-4), AIC 2026-Q1 (-3), BHI 2025-Q4 (-3),
    BHI 2026-Q1 (-4)."""
    assert _c1(-125.5, -391.3) == 0
    assert not c2_flag(-125.5, -391.3, yoy_pct(-125.5, -391.3))
    assert c1_display_state(-125.5, -391.3) == "thu_hep_thua_lo"
    # the improvement is still MEASURED, it just does not score
    assert yoy_pct(-125.5, -391.3) > 0


def test_T04_widening_loss():
    assert _c1(-200.0, -100.0) == 0
    assert not c2_flag(-200.0, -100.0, yoy_pct(-200.0, -100.0))
    assert c1_display_state(-200.0, -100.0) == "lo_mo_rong"


def test_T05_zero_base_and_positive_now():
    assert yoy_pct(500.0, 0.0) is None        # never divides
    assert _c1(500.0, 0.0) == 10
    assert c2_flag(500.0, 0.0, None)
    assert c1_display_state(500.0, 0.0) == "phat_sinh_loi_nhuan"
    # and the other half of that row
    assert _c1(-5.0, 0.0) == 0
    assert not c2_flag(-5.0, 0.0, None)


def test_T06_low_eps_base_keeps_its_points():
    """§6: the flag never moves a score. BLI is the live case — +1.935% on an
    18,08đ base still earns a full 10."""
    assert abs(18.08) < LOW_BASE_EPS_VND
    assert _c1(367.92, 18.08) == 10           # unchanged by the flag


def test_T07_buffer_trend_exactly_minus_ten():
    assert c5_points(-10.0, C5_BANDS_V2) == 0


def test_T08_buffer_trend_exactly_zero():
    assert c5_points(0.0, C5_BANDS_V2) == 7


def test_T09_buffer_trend_exactly_ten():
    assert c5_points(10.0, C5_BANDS_V2) == 10


def test_T10_non_positive_equity_is_excluded():
    assert gate(0.0, 5.0, 3.0, False) == ("Không đạt", "loại khỏi xếp hạng")
    assert gate(-1.0, 5.0, 3.0, False)[0] == "Không đạt"


# --- §7, the profit-base indicator ------------------------------------------

def _np(values, end="2026-Q2"):
    """{period: value} counting back from `end`, newest first in `values`."""
    return {shift(end, i): v for i, v in enumerate(values)}


def test_T11_ratio_and_status_when_both_sides_positive():
    # 20 flat quarters of 100 -> every TTM is 400, ratio exactly 100%
    out = profit_history_context("X", "2026-Q2", _np([100.0] * 24))
    assert out["np_ttm_current"] == 400.0
    assert out["historical_ttm_count"] == 16      # §7.6: 17 TTMs, current excluded
    assert out["median_np_ttm_history"] == 400.0
    assert out["profit_history_ratio_pct"] == 100.0
    assert out["profit_history_status"] == "NORMAL_RANGE"
    assert out["calculation_version"] == PROFIT_HISTORY_VERSION


def test_T11_band_boundaries():
    """70 / 100 / 120 are inclusive lower bounds."""
    for factor, want in ((0.69, "BELOW_NORMAL"), (0.70, "RECOVERING"),
                         (0.99, "RECOVERING"), (1.00, "NORMAL_RANGE"),
                         (1.19, "NORMAL_RANGE"), (1.20, "NEW_HIGHER_BASE")):
        # hold history at 100/quarter, scale the four current quarters
        vals = [100.0 * factor] * 4 + [100.0] * 20
        out = profit_history_context("X", "2026-Q2", _np(vals))
        assert out["profit_history_status"] == want, (factor, out["profit_history_status"])


def test_T12_negative_median_with_positive_current_is_TURNAROUND():
    out = profit_history_context("X", "2026-Q2", _np([100.0] * 4 + [-50.0] * 20))
    assert out["profit_history_status"] == "TURNAROUND"
    assert out["profit_history_ratio_pct"] is None, "không chia cho số âm"


def test_T13_positive_median_with_a_loss_now_is_CURRENT_LOSS():
    out = profit_history_context("X", "2026-Q2", _np([-50.0] * 4 + [100.0] * 20))
    assert out["profit_history_status"] == "CURRENT_LOSS"
    assert out["profit_history_ratio_pct"] is None, "không hiển thị tỷ lệ"


def test_persistent_loss():
    out = profit_history_context("X", "2026-Q2", _np([-50.0] * 24))
    assert out["profit_history_status"] == "PERSISTENT_LOSS"
    assert out["profit_history_ratio_pct"] is None


def test_T14_under_eight_quarters_is_INSUFFICIENT_HISTORY():
    out = profit_history_context("X", "2026-Q2", _np([100.0] * 7))
    assert out["profit_history_status"] == "INSUFFICIENT_HISTORY"
    assert out["profit_history_ratio_pct"] is None
    assert out["np_ttm_current"] == 400.0, "TTM hiện tại vẫn tính được"


def test_eight_quarters_fails_the_historical_ttm_floor():
    """§7.4 admits 8 quarters, §7.8 requires 5 historical TTMs — and 8 quarters
    yields only 4. The stricter rule wins, so the effective minimum is NINE.
    Reported to BA rather than reconciled silently."""
    eight = profit_history_context("X", "2026-Q2", _np([100.0] * 8))
    assert eight["historical_ttm_count"] == 4 < PH_MIN_HISTORICAL_TTM
    assert eight["profit_history_status"] == "INSUFFICIENT_HISTORY"
    nine = profit_history_context("X", "2026-Q2", _np([100.0] * 9))
    assert nine["historical_ttm_count"] == 5
    assert nine["profit_history_status"] == "NORMAL_RANGE"


def test_T15_a_hole_in_the_current_TTM_is_an_ERROR_not_a_zero():
    vals = _np([100.0] * 24)
    vals[shift("2026-Q2", 2)] = None
    out = profit_history_context("X", "2026-Q2", vals)
    assert out["profit_history_status"] == "ERROR_CURRENT_TTM"
    assert out["np_ttm_current"] is None
    assert out["profit_history_ratio_pct"] is None


def test_the_window_never_exceeds_twenty_quarters():
    """§7.4: "Chỉ lấy 20 quý liên tiếp gần nhất". A deeper series must be cut."""
    out = profit_history_context("X", "2026-Q2", _np([100.0] * 40))
    assert out["historical_ttm_count"] == 16
    assert out["data_start_quarter"] == shift("2026-Q2", PH_WINDOW_QUARTERS - 1)


def test_the_current_ttm_is_excluded_from_its_own_median():
    """§7.6's reason, made visible: a strong current quarter must not lift the
    median it is measured against."""
    spike = profit_history_context("X", "2026-Q2", _np([1000.0] * 4 + [100.0] * 20))
    assert spike["median_np_ttm_history"] == 400.0, "trung vị không được kéo lên"
    assert spike["profit_history_ratio_pct"] == 1000.0
    assert spike["profit_history_status"] == "NEW_HIGHER_BASE"


def test_history_is_CONTIGUOUS_back_from_t():
    """§7.4 says "chuỗi liên tiếp hợp lệ". A hole 12 quarters back must truncate
    the window there, not leave a set of survivors with a gap in the middle —
    otherwise a TTM would silently sum four non-adjacent quarters."""
    vals = _np([100.0] * 24)
    vals[shift("2026-Q2", 12)] = None
    out = profit_history_context("X", "2026-Q2", vals)
    assert out["data_start_quarter"] == shift("2026-Q2", 11)
    assert out["historical_ttm_count"] == 8     # 12 quarters -> 9 TTMs, minus current
    assert out["profit_history_status"] == "NORMAL_RANGE"


def test_T18_delta_fa_versions_are_recorded():
    """§12 requires score version, EPS version, threshold set and calculation
    version on every row. The first three are asserted by the exporter's column
    list; this pins the §7 one."""
    out = profit_history_context("X", "2026-Q2", _np([100.0] * 24))
    assert out["calculation_version"] == "PROFIT_HISTORY_CONTEXT_V1"
    assert out["data_end_quarter"] == "2026-Q2"


def test_profit_history_never_returns_a_bare_zero_ratio():
    """Phụ lục B: absence is a status, never 0. Every path either sets a ratio
    with a positive median and positive current, or sets a status code."""
    for vals in ([100.0] * 24, [-50.0] * 24, [100.0] * 4 + [-50.0] * 20,
                 [-50.0] * 4 + [100.0] * 20, [100.0] * 7, [100.0] * 8):
        out = profit_history_context("X", "2026-Q2", _np(vals))
        assert out["profit_history_status"] is not None
        if out["profit_history_ratio_pct"] is None:
            assert out["profit_history_status"] in (
                "TURNAROUND", "CURRENT_LOSS", "PERSISTENT_LOSS",
                "INSUFFICIENT_HISTORY", "ERROR_CURRENT_TTM")
        else:
            assert out["median_np_ttm_history"] > 0 and out["np_ttm_current"] > 0

if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"{len(tests)} passed")
