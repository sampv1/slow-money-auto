"""Holding tab regression suite R1-R8 (BA final-verification spec, 2026-10-01).

Runs standalone or under pytest, with NO database — every case here is either a
mock series or a hand-computed expectation, so a failure means the engine
changed, not that a provider did. The live formula reproduction against real
filings is `scripts/verify_holding_live.py`; this file pins the behaviour that
must hold whatever the data says.

The suite exists because BA refused "we spot-checked it and it looked right".
Each test states an expected value and compares.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fa import holding as H          # noqa: E402
from fa import insurance_deep as D   # noqa: E402

TOL = 1e-9          # exact arithmetic; no loose tolerance hides a wrong formula
PASS, FAIL = [], []


def check(name, got, want, tol=TOL):
    ok = (got is None and want is None) or (
        got is not None and want is not None and abs(got - want) <= tol)
    (PASS if ok else FAIL).append(f"{name}: got {got!r} want {want!r}")
    assert ok, f"{name}: got {got!r}, want {want!r}"


def check_eq(name, got, want):
    ok = got == want
    (PASS if ok else FAIL).append(f"{name}: got {got!r} want {want!r}")
    assert ok, f"{name}: got {got!r}, want {want!r}"


# --------------------------------------------------------------------------
# R2 — TTM continuity
# --------------------------------------------------------------------------

def _inc(pairs):
    return {p: {D.FIN_NET: v} for p, v in pairs}


def test_R2_ttm_four_consecutive_quarters():
    inc = _inc([("2025-Q3", 1.0), ("2025-Q4", 2.0), ("2026-Q1", 3.0), ("2026-Q2", 4.0)])
    check("R2-A full window", H._ttm(inc, "2026-Q2", D.FIN_NET), 10.0)


def test_R2_missing_middle_quarter_is_invalid():
    inc = _inc([("2025-Q3", 1.0), ("2026-Q1", 3.0), ("2026-Q2", 4.0)])
    check("R2-B missing middle", H._ttm(inc, "2026-Q2", D.FIN_NET), None)


def test_R2_missing_first_quarter_is_invalid():
    inc = _inc([("2025-Q4", 2.0), ("2026-Q1", 3.0), ("2026-Q2", 4.0)])
    check("R2-C missing oldest", H._ttm(inc, "2026-Q2", D.FIN_NET), None)


def test_R2_null_value_inside_window_is_invalid():
    inc = _inc([("2025-Q3", 1.0), ("2025-Q4", None), ("2026-Q1", 3.0), ("2026-Q2", 4.0)])
    check("R2-D null inside window", H._ttm(inc, "2026-Q2", D.FIN_NET), None)


def test_R2_never_annualises_three_quarters():
    """The failure mode this rules out: 3 quarters x 4/3 looks plausible."""
    inc = _inc([("2025-Q4", 2.0), ("2026-Q1", 3.0), ("2026-Q2", 4.0)])
    got = H._ttm(inc, "2026-Q2", D.FIN_NET)
    check("R2-E no annualisation", got, None)
    assert got != (2.0 + 3.0 + 4.0) * 4 / 3


# --------------------------------------------------------------------------
# R3 — YoY alignment
# --------------------------------------------------------------------------

def test_R3_yoy_uses_t_minus_4_exactly():
    s = {"2025-Q1": 10.0, "2025-Q2": 11.0, "2025-Q3": 12.0,
         "2025-Q4": 13.0, "2026-Q1": 14.0, "2026-Q2": 20.0}
    check("R3-A delta t-4", H.yoy_delta(s, "2026-Q2"), 20.0 - 11.0)


def test_R3_yoy_refuses_nearest_available():
    """t-4 absent must yield None, never fall back to t-3 or t-5."""
    s = {"2025-Q1": 10.0, "2025-Q3": 12.0, "2026-Q2": 20.0}
    got = H.yoy_delta(s, "2026-Q2")
    check("R3-B no nearest fallback", got, None)
    assert got not in (20.0 - 10.0, 20.0 - 12.0)


def test_R3_year_boundary_alignment():
    check_eq("R3-C shift across year", D.shift("2026-Q1", 4), "2025-Q1")
    check_eq("R3-D shift back one", D.shift("2026-Q1", 1), "2025-Q4")


# --------------------------------------------------------------------------
# R4 — percentile engine
# --------------------------------------------------------------------------

HIST12 = [float(i) for i in range(1, 13)]      # 1..12, N=12 so the gate passes


def test_R4_A_minimum_scores_zero():
    s = H.percentile_score(HIST12, 1.0, 10)
    check("R4-A percentile at min", s.percentile, 0.0)
    check("R4-A score at min", s.score, 0.0)


def test_R4_B_maximum_scores_full_weight():
    s = H.percentile_score(HIST12, 12.0, 10)
    check("R4-B percentile at max", s.percentile, 1.0)
    check("R4-B score at max", s.score, 10.0)


def test_R4_C_median_is_centre():
    s = H.percentile_score(HIST12, 6.5, 10)   # 6.5 sits between ranks 6 and 7
    check("R4-C midpoint percentile", s.percentile, 0.5)


def test_R4_D_ties_use_average_rank():
    hist = [1.0, 2.0, 2.0, 4.0] * 3          # N=12, four distinct values
    # 2.0 appears 6 times; 3 values are below it, so average rank = 3 + (6+1)/2
    s = H.percentile_score(hist, 2.0, 10)
    check("R4-D average rank", s.rank, 3 + (6 + 1) / 2)
    check("R4-D tie percentile", s.percentile, (s.rank - 1) / (len(hist) - 1))


def test_R4_E_rank_method_is_average_not_min_or_max():
    hist = [1.0, 2.0, 2.0, 4.0] * 3
    r = H.average_rank(hist, 2.0)
    assert r != 4.0, "min-rank would give 4"
    assert r != 9.0, "max-rank would give 9"
    check("R4-E average rank value", r, 6.5)


def test_R4_F_weight_scales_linearly():
    s8 = H.percentile_score(HIST12, 12.0, 8)
    check("R4-F weight 8 at max", s8.score, 8.0)
    s8b = H.percentile_score(HIST12, 1.0, 8)
    check("R4-F weight 8 at min", s8b.score, 0.0)


def test_R4_G_short_history_is_not_scored():
    s = H.percentile_score([1.0, 2.0, 3.0], 3.0, 10)
    check_eq("R4-G short history status", s.status, "SELF_HISTORY_INSUFFICIENT")
    check("R4-G short history score", s.score, None)


# --------------------------------------------------------------------------
# R5 — missing current observation
# --------------------------------------------------------------------------

def test_R5_missing_current_is_not_scored():
    s = H.percentile_score(HIST12, None, 10)
    check_eq("R5-A status", s.status, "NOT_SCORED_CURRENT_INVALID")
    check("R5-B no silent zero", s.score, None)
    assert s.score != 0.0, "a missing current must not become a measured zero"


def test_R5_total_refuses_to_reweight():
    """Three good metrics plus one missing must NOT produce a total out of the
    remaining weights -- that would quietly rescale the tab to 38."""
    good = [H.percentile_score(HIST12, 12.0, 10) for _ in range(3)]
    missing = H.percentile_score(HIST12, None, 8)
    check("R5-C total withheld", H.deep_total(good + [missing]), None)


# --------------------------------------------------------------------------
# R6 — denominator safety
# --------------------------------------------------------------------------

def _bal(cash=100.0, st=200.0, lt=300.0, eq=50.0, res=400.0):
    return {"p": {D.CASH_TOTAL: cash, D.ST_INV: st, D.LT_INV: lt,
                  D.EQUITY: eq, D.INSURANCE_RESERVES: res}}


def test_R6_zero_denominator_is_invalid():
    check("R6-A buffer res=0", H.capital_buffer_level(_bal(res=0.0), "p"), None)
    check("R6-B coverage res=0", H.investment_coverage(_bal(res=0.0), "p"), None)


def test_R6_null_denominator_is_invalid():
    check("R6-C buffer res=None", H.capital_buffer_level(_bal(res=None), "p"), None)


def test_R6_negative_denominator_is_invalid():
    """A negative reserve is a mapping fault, not a company with negative
    obligations -- it must not flip the ratio's sign and score."""
    check("R6-D buffer res<0", H.capital_buffer_level(_bal(res=-400.0), "p"), None)
    check("R6-E coverage res<0", H.investment_coverage(_bal(res=-400.0), "p"), None)


def test_R6_missing_whitelist_component_is_invalid():
    """A partial sum would shrink the denominator and inflate B1/P3."""
    check("R6-F partial investable", H.investable_assets(
        {D.CASH_TOTAL: 100.0, D.ST_INV: None, D.LT_INV: 300.0}), None)


def test_R6_no_infinity_or_nan_reaches_scoring():
    for v in (H.capital_buffer_level(_bal(res=0.0), "p"),
              H.investment_coverage(_bal(res=0.0), "p")):
        assert v is None or (v == v and abs(v) != float("inf"))
    PASS.append("R6-G no inf/nan: ok")


# --------------------------------------------------------------------------
# R7 — taxonomy cutoff
# --------------------------------------------------------------------------

def test_R7_cutoff_declared_for_bvh_reserve_metrics():
    check_eq("R7-A BVH B3 valid_from", H.VALID_FROM[("BVH", "B3")], "2022-Q1")
    check_eq("R7-B BVH B4 valid_from", H.VALID_FROM[("BVH", "B4")], "2022-Q1")
    assert ("PVI", "P4") not in H.VALID_FROM, "PVI needs no reserve cutoff"
    PASS.append("R7-C PVI has no cutoff: ok")


def test_R7_reference_set_excludes_pre_cutoff():
    periods = ["2021-Q3", "2021-Q4", "2022-Q1", "2022-Q2"]
    cut = H.VALID_FROM[("BVH", "B4")]
    kept = [p for p in periods if p >= cut]
    check_eq("R7-D kept periods", kept, ["2022-Q1", "2022-Q2"])
    assert "2021-Q4" not in kept, "the quarter before the break must be excluded"
    assert "2022-Q1" in kept, "the break quarter itself is the first valid one"


# --------------------------------------------------------------------------
# R8 — unrounded aggregation
# --------------------------------------------------------------------------

def test_R8_total_sums_unrounded_components():
    """Three components each at 1/3 of their weight: summing DISPLAY values
    (rounded to 1dp) drifts from the true total."""
    hist = [float(i) for i in range(1, 13)]
    comps = [H.percentile_score(hist, 5.0, 10),     # percentile 4/11
             H.percentile_score(hist, 5.0, 10),
             H.percentile_score(hist, 5.0, 8)]
    exact = sum(c.score for c in comps)
    check("R8-A total is unrounded sum", H.deep_total(comps), exact)
    rounded_sum = sum(round(c.score, 1) for c in comps)
    assert abs(exact - rounded_sum) > 0, "this fixture must actually drift"
    assert abs(H.deep_total(comps) - rounded_sum) > 0
    PASS.append("R8-B display sum differs from unrounded: ok")


def test_R8_weights_total_38_per_engine():
    for tic, codes in H.METRICS_BY_TICKER.items():
        check_eq(f"R8-C {tic} weights sum",
                 sum(H.WEIGHTS[c] for c in codes), 38)


# --------------------------------------------------------------------------
# Engine routing (§18 of the two-engine spec)
# --------------------------------------------------------------------------

def test_engine_routing_has_no_fallback():
    check_eq("ROUTE-A BVH", H.MODEL_BY_TICKER["BVH"], "LIFE_LED_HOLDING")
    check_eq("ROUTE-B PVI", H.MODEL_BY_TICKER["PVI"], "NONLIFE_REINSURANCE_HOLDING")
    assert "BIC" not in H.MODEL_BY_TICKER, "universe is BVH/PVI only"
    PASS.append("ROUTE-C no third ticker: ok")


def test_investable_mapping_blacklist_is_explicit():
    """Every excluded child names the total that already contains it, so a
    later reader cannot re-add it 'because it looks missing'."""
    for child, parent in H.INVESTABLE_BLACKLIST.items():
        assert parent, f"{child} has no declared parent"
    assert set(H.INVESTABLE_WHITELIST).isdisjoint(H.INVESTABLE_BLACKLIST)
    check_eq("MAP-A whitelist size", len(H.INVESTABLE_WHITELIST), 3)
    check_eq("MAP-B blacklist size", len(H.INVESTABLE_BLACKLIST), 4)


# --------------------------------------------------------------------------
# R9 -- METRIC DEFINITIONS, asserted once against BA's final lock
# (PHAN_HOI_IT_FINAL_KHOA_TOAN_BO_HOLDING_BVH_PVI_2026-10-01.md sec.12)
#
# BA caught a DOCUMENTATION error of mine: I wrote "B4 is the YoY change of
# B3". It is not. B3 and B4 are two different LEVELS over the same denominator,
# and the YoY direction of the capital buffer is C5, in the industry layer.
# These tests exist so the sentence cannot be written again without a failure.
# --------------------------------------------------------------------------

def test_R9_B3_is_investable_assets_over_reserves():
    bal = {"2026-Q2": {D.CASH_TOTAL: 30.0, D.ST_INV: 50.0, D.LT_INV: 20.0,
                       D.INSURANCE_RESERVES: 200.0, D.EQUITY: 40.0}}
    check("R9-B3 = investable / reserves", H.investment_coverage(bal, "2026-Q2"),
          (30.0 + 50.0 + 20.0) / 200.0 * 100.0)


def test_R9_B4_is_equity_over_reserves():
    bal = {"2026-Q2": {D.CASH_TOTAL: 30.0, D.ST_INV: 50.0, D.LT_INV: 20.0,
                       D.INSURANCE_RESERVES: 200.0, D.EQUITY: 40.0}}
    check("R9-B4 = equity / reserves", H.capital_buffer_level(bal, "2026-Q2"),
          40.0 / 200.0 * 100.0)


def test_R9_B4_is_NOT_the_yoy_change_of_B3():
    """The two answer different questions off the same denominator. Equity is
    moved alone here: B4 must move, B3 must not."""
    base = {D.CASH_TOTAL: 30.0, D.ST_INV: 50.0, D.LT_INV: 20.0,
            D.INSURANCE_RESERVES: 200.0, D.EQUITY: 40.0}
    bumped = dict(base, **{D.EQUITY: 80.0})
    bal = {"2025-Q2": base, "2026-Q2": bumped}
    b3_now, b3_then = (H.investment_coverage(bal, "2026-Q2"),
                       H.investment_coverage(bal, "2025-Q2"))
    b4_now, b4_then = (H.capital_buffer_level(bal, "2026-Q2"),
                       H.capital_buffer_level(bal, "2025-Q2"))
    check_eq("R9-B3 unchanged by equity", b3_now, b3_then)
    assert b4_now != b4_then, "B4 must respond to equity"
    # and B4 is not any YoY transform of B3, which did not move at all
    assert H.yoy_delta({"2025-Q2": b3_then, "2026-Q2": b3_now}, "2026-Q2") == 0.0
    check("R9-B4 level", b4_now, 40.0)


def test_R9_C5_is_the_yoy_change_of_the_capital_buffer():
    """C5 is the DIRECTION of B4's series: C5_t = B4_t / B4_(t-4) - 1."""
    import export_insurance_toan_nganh as T
    bal = {("X", "2026-Q2"): {T.EQUITY: 80.0, T.RESERVE: 200.0, T.MINORITY: 0.0},
           ("X", "2025-Q2"): {T.EQUITY: 40.0, T.RESERVE: 200.0, T.MINORITY: 0.0}}
    data = {"inc": {}, "bal": bal, "eps": {}, "adj": {}}
    row = T.score_one("X", "2026-Q2", data, T.THRESHOLDS["production"])
    check("R9-C5 buffer now", row["capital_buffer_q"], 80.0 / 200.0)
    check("R9-C5 buffer t-4", row["capital_buffer_q_4"], 40.0 / 200.0)
    check("R9-C5 = YoY of buffer", row["c5_buffer_trend_pct"], 100.0)


# --------------------------------------------------------------------------
# R10 -- BVH 2022-Q1 is DIRECTLY source-verified, which is what locks VALID_FROM
#
# EY-reviewed interim consolidated statements, 31/03/2022, B01a-DN/HN, printed
# page 8 (PDF page 10). Supplied by BA. Earlier I reported this period as
# "not published by the issuer" -- I had proved only that it was absent from
# baoviet.com.vn, which is a different claim.
# --------------------------------------------------------------------------

#: (code 344 reserve, code 337 other long-term payables, provider field)
BVH_2022Q1_SOURCE = (130_530_411_024_527, 274_306_411_494, 130_804_717_436_021)
BVH_2022Q1_RESERVE_SUBCOMPONENTS = (
    115_827_702_876_955,    # 344.1 toan hoc
    4_921_956_156_872,      # 344.2 phi chua duoc huong
    2_431_372_425_870,      # 344.3 boi thuong
    2_210_108_210_559,      # 344.4 chia lai
    4_838_320_390_237,      # 344.5 lai cam ket dau tu toi thieu
    230_805_584_043,        # 344.6 dam bao can doi
    70_145_379_991,         # 344.7 dao dong lon
)


def test_R10_bvh_2022q1_reconciles_to_the_provider_field_exactly():
    reserve, other_lt, provider = BVH_2022Q1_SOURCE
    check_eq("R10 residual is zero", reserve + other_lt, provider)


def test_R10_bvh_2022q1_reserve_subcomponents_sum_to_the_line():
    reserve = BVH_2022Q1_SOURCE[0]
    check_eq("R10 344.1-344.7 sum", sum(BVH_2022Q1_RESERVE_SUBCOMPONENTS), reserve)


def test_R10_valid_from_is_the_source_verified_quarter():
    for metric in ("B3", "B4"):
        check_eq(f"R10 VALID_FROM {metric}", H.VALID_FROM[("BVH", metric)], "2022-Q1")


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
