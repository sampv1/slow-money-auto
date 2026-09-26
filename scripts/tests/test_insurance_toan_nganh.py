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
    UI_COLUMNS_12, acceptance_stats, c1_display_state, c1_sign_override,
    c2_flag, c5_points, profit_history_context, resolve_quarters, shift,
    yoy_pct,
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


def test_every_set_carries_its_status_onto_the_row():
    """The status string travels onto every output row, so a number can always
    say which bands produced it. BA has since LOCKED ba_v2 for operation (A1),
    which is what `test_A1_the_band_set_is_locked_for_operation` pins; the
    Production set stays only so the comparison remains reproducible."""
    assert THRESHOLDS["ba_v2"]["status"] == "DA_KHOA_V1_DE_VAN_HANH"
    assert THRESHOLDS["production"]["status"] == "BAN_DAU_THEO_BANG_SAN_XUAT"
    assert all("status" in spec for spec in THRESHOLDS.values())


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


def test_T14_under_nine_quarters_is_INSUFFICIENT_HISTORY():
    out = profit_history_context("X", "2026-Q2", _np([100.0] * 7))
    assert out["profit_history_status"] == "INSUFFICIENT_HISTORY"
    assert out["profit_history_ratio_pct"] is None
    assert out["np_ttm_current"] == 400.0, "TTM hiện tại vẫn tính được"


def test_A6_the_floor_is_nine_quarters_not_eight():
    """IT reported that §7.4's "from 8 quarters" and §7.8's five-historical-TTM
    floor disagree — 8 quarters build 5 TTMs and, once the current one is
    excluded, leave 4. BA locked NINE (§4.4), which is the first depth where the
    two agree: 9 quarters build 6 TTMs and leave exactly 5."""
    assert PH_MIN_QUARTERS == 9
    eight = profit_history_context("X", "2026-Q2", _np([100.0] * 8))
    assert eight["profit_history_status"] == "INSUFFICIENT_HISTORY"
    assert eight["profit_history_ratio_pct"] is None
    assert eight["np_ttm_current"] == 400.0, "TTM hiện tại vẫn tính được"
    nine = profit_history_context("X", "2026-Q2", _np([100.0] * 9))
    assert nine["historical_ttm_count"] == PH_MIN_HISTORICAL_TTM == 5
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
                 [-50.0] * 4 + [100.0] * 20, [100.0] * 7, [100.0] * 8,
                 [100.0] * 9):
        out = profit_history_context("X", "2026-Q2", _np(vals))
        assert out["profit_history_status"] is not None
        if out["profit_history_ratio_pct"] is None:
            assert out["profit_history_status"] in (
                "TURNAROUND", "CURRENT_LOSS", "PERSISTENT_LOSS",
                "INSUFFICIENT_HISTORY", "ERROR_CURRENT_TTM")
        else:
            assert out["median_np_ttm_history"] > 0 and out["np_ttm_current"] > 0


# --- BA's final acceptance checklist A1-A12 ---------------------------------

def test_A1_the_band_set_is_locked_for_operation():
    """§4.1 — locked for USE, explicitly not declared optimal: the sample is 13
    symbols over three quarters and BA re-evaluates after 4-6 quarters."""
    assert THRESHOLDS["ba_v2"]["status"] == "DA_KHOA_V1_DE_VAN_HANH"


def test_A2_the_quarter_range_is_derived_from_the_eps_history():
    """A stale constant is how a quarter silently drops out of a rebase, so the
    range is a property of the data. C2 needs 7 contiguous quarters, so an EPS
    set starting 2024-Q2 makes 2025-Q4 the earliest scoreable quarter."""
    eps = {"X": {f"{y}-Q{q}": {"eps": 1.0}
                 for y, q in [(2024, 2), (2024, 3), (2024, 4), (2025, 1), (2025, 2),
                              (2025, 3), (2025, 4), (2026, 1), (2026, 2)]}}
    assert resolve_quarters(eps) == ["2025-Q4", "2026-Q1", "2026-Q2"]
    # one quarter short of seven yields nothing at all, rather than a short window
    short = {"X": {f"2025-Q{q}": {"eps": 1.0} for q in (1, 2, 3, 4)}}
    assert resolve_quarters(short) == []
    assert resolve_quarters({}) == []


def test_A2_a_hole_breaks_the_contiguity_requirement():
    """Seven quarters that are not CONSECUTIVE cannot score C2 — the comparison
    quarters t-4..t-6 have to exist."""
    eps = {"X": {p: {"eps": 1.0} for p in
                 ("2024-Q2", "2024-Q3", "2024-Q4", "2025-Q2", "2025-Q3",
                  "2025-Q4", "2026-Q1", "2026-Q2")}}
    assert "2025-Q4" not in resolve_quarters(eps)


def test_A5_score_50_equals_the_sum_of_the_five():
    """Asserted inside `score_one` too, so a row that breaks it cannot be
    written. Here on the statistics, which is what a report quotes."""
    rows = [{"symbol": "X", "period": "2026-Q2", "score_50": 27,
             "c1_points": 10, "c2_points": 7, "c3_points": 7, "c4_points": 3,
             "c5_points": 0, "missing_criteria": None, "threshold_set": "ba_v2",
             "delta_fa_points": 2, "capital_gate_status": "Đạt",
             "applied_cap_current": None, "profit_history_status": "NORMAL_RANGE",
             "low_eps_base_flag": False, "one_off_profit_status": "NOT_EVALUATED"}]
    st = acceptance_stats(rows, ["2026-Q2"])
    assert st["score_50_khop_tong_5_tieu_chi"] is True
    rows[0]["score_50"] = 28
    assert acceptance_stats(rows, ["2026-Q2"])["score_50_khop_tong_5_tieu_chi"] is False


def test_A7_the_applied_cap_is_empty_in_a_fifty_point_scale():
    """§4.5 — `future_cap_100` may hold 79 or 59, but `applied_cap_current` must
    be blank, or a UI reads a stored cap as one already in force. The single
    exception that DOES apply now is equity <= 0."""
    def caps(equity, d_buffer, equity_yoy, two_q):
        status, future = gate(equity, d_buffer, equity_yoy, two_q)
        applied = "loại khỏi xếp hạng" if (equity is not None and equity <= 0) else None
        return status, future, applied
    assert caps(1e12, -15.0, 2.0, False) == ("Cảnh báo", 79, None)
    assert caps(1e12, -25.0, -4.0, False) == ("Rủi ro cao", 59, None)
    assert caps(1e12, 5.0, 3.0, False) == ("Đạt", None, None)
    # the one cap that bites today
    assert caps(0.0, 5.0, 3.0, False)[2] == "loại khỏi xếp hạng"
    assert caps(-1.0, 5.0, 3.0, False)[2] == "loại khỏi xếp hạng"


def test_A8_an_unevaluated_one_off_is_not_false():
    """A8 — `False` reads as "checked, none found". Nothing identifies a one-off,
    so the honest value is a status that says it was never evaluated."""
    rows = [{"symbol": "X", "period": "2026-Q2", "score_50": 0, "missing_criteria": None,
             "threshold_set": "ba_v2", "delta_fa_points": None,
             "capital_gate_status": "Đạt", "applied_cap_current": None,
             "profit_history_status": "NORMAL_RANGE", "low_eps_base_flag": False,
             "one_off_profit_status": "NOT_EVALUATED",
             **{f"c{i}_points": 0 for i in range(1, 6)}}]
    st = acceptance_stats(rows, ["2026-Q2"])
    assert st["one_off_status"] == {"NOT_EVALUATED": 1}
    assert False not in st["one_off_status"]


def test_A10_statistics_come_from_the_dataset():
    """The failure this prevents: a Markdown report quoted C1 3,13 / C2 5,13 from
    an earlier run while the workbook held 3,56 / 5,05 from the final one. The
    averages are computed here, from the rows, so a report cannot drift."""
    rows = []
    for i, pts in enumerate([(10, 10, 10, 10, 10), (0, 0, 0, 0, 0)]):
        rows.append({"symbol": f"S{i}", "period": "2026-Q2", "score_50": sum(pts),
                     "missing_criteria": None, "threshold_set": "ba_v2",
                     "delta_fa_points": None, "capital_gate_status": "Đạt",
                     "applied_cap_current": None, "low_eps_base_flag": False,
                     "profit_history_status": "NORMAL_RANGE",
                     "one_off_profit_status": "NOT_EVALUATED",
                     **{f"c{n}_points": pts[n - 1] for n in range(1, 6)}})
    st = acceptance_stats(rows, ["2026-Q2"])
    assert st["tieu_chi"]["C1"]["trung_binh"] == 5.0
    assert st["tieu_chi"]["C1"]["pts_10"] == 1 and st["tieu_chi"]["C1"]["pts_0"] == 1
    assert st["tong_diem_quy_moi_nhat"] == {"min": 0, "trung_vi": 25.0, "max": 50}


def test_A11_the_layout_is_twelve_columns_in_BAs_order():
    """§7 — the 14-column layout is superseded; it still carried "Hiệu quả bảo
    hiểm /30" and "Định giá /20", neither of which exists."""
    assert len(UI_COLUMNS_12) == 12
    names = [c[0] for c in UI_COLUMNS_12]
    assert names[0] == "Ngày công bố BCTC"
    assert names[2] == "Tổng điểm Toàn ngành"
    assert names[-1] == "Cảnh báo dữ liệu"
    assert not any("30" in n or "20" in n for n in names), "cột của bố cục cũ còn sót"
    # every column carries a tooltip with a real explanation
    assert all(len(tip) > 30 for _, _, tip in UI_COLUMNS_12)


def test_A11_the_total_column_never_claims_to_be_a_final_score():
    """§3 — "Tổng điểm 50 là điểm FA chung, không phải điểm cuối cùng". The
    tooltip has to say so, because a column headed "Tổng điểm" invites the
    opposite reading."""
    tip = dict((c[1], c[2]) for c in UI_COLUMNS_12)["score_50"]
    assert "không phải điểm cuối cùng" in tip.lower() or "KHÔNG phải điểm cuối cùng" in tip

if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"{len(tests)} passed")
