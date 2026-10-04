"""Reinsurance R1-R5 threshold tests — BA §9 boundaries plus §10 status rules.

Runs standalone or under pytest, with NO database.

BA PUBLISHES THE EXPECTED SCORE AT EVERY EDGE, so the edges are asserted
directly rather than sampled. Each one is also tested just BELOW it: a band
table is almost never wrong in the middle of a range, it is wrong about which
side a boundary closes on, and only the pair of cases either side of the edge
can tell those apart.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fa import reinsurance_bands as RB      # noqa: E402

PASS, FAIL = [], []


def check(name, got, want):
    ok = got == want
    (PASS if ok else FAIL).append(f"{name}: got {got!r} want {want!r}")
    assert ok, f"{name}: got {got!r}, want {want!r}"


EPS = 0.0001


# --- §9, asserted by the module's own audit ---------------------------------

def test_every_boundary_in_the_spec():
    check("audit_bands", RB.audit_bands(), [])


# --- R1: lower-closed, 0% is the economic boundary --------------------------

def test_R1_edges_close_downward():
    for raw, want in ((15.0, 12), (10.0, 10), (5.0, 8), (0.0, 5)):
        check(f"R1 {raw}", RB.score_r1(raw)[0], want)
    # Just BELOW each floor must drop a band — this is the direction test.
    for raw, want in ((15 - EPS, 10), (10 - EPS, 8), (5 - EPS, 5), (-EPS, 0)):
        check(f"R1 {raw}", RB.score_r1(raw)[0], want)


def test_R1_negative_margin_is_a_real_zero_not_an_absence():
    score, status = RB.score_r1(-3.2)
    check("R1 loss score", score, 0)
    check("R1 loss status", status, RB.STATUS_OK)      # §10's worked example


def test_R1_missing_is_not_zero():
    check("R1 None", RB.score_r1(None), (None, RB.STATUS_NOT_SCORED))


# --- R2: percentage POINTS, symmetric floors --------------------------------

def test_R2_edges():
    for raw, want in ((5.0, 10), (2.0, 8), (0.0, 6), (-2.0, 4), (-5.0, 2)):
        check(f"R2 {raw}", RB.score_r2(raw)[0], want)
    for raw, want in ((5 - EPS, 8), (2 - EPS, 6), (-EPS, 4),
                      (-2 - EPS, 2), (-5 - EPS, 0)):
        check(f"R2 {raw}", RB.score_r2(raw)[0], want)


def test_R2_missing_comparison_quarter_is_not_zero():
    check("R2 None", RB.score_r2(None), (None, RB.STATUS_NOT_SCORED))


# --- R3: a zone around a middle, NOT a ranking ------------------------------

def test_R3_full_mark_is_a_band_not_a_ceiling():
    for raw in (60.0, 65.0, 70.0, 80.0):
        check(f"R3 {raw}", RB.score_r3(raw)[0], 8)


def test_R3_falls_away_on_BOTH_sides():
    # The low side and the high side must mirror each other.
    for low, high, want in ((55.0, 82.0, 6), (45.0, 88.0, 4),
                            (35.0, 93.0, 2), (20.0, 97.0, 0)):
        check(f"R3 low {low}", RB.score_r3(low)[0], want)
        check(f"R3 high {high}", RB.score_r3(high)[0], want)


def test_R3_high_retention_is_NOT_better():
    """BA: 'không phải càng cao càng tốt'. 96% must score worse than 70%."""
    assert RB.score_r3(96.0)[0] < RB.score_r3(70.0)[0]
    check("R3 96% equals R3 29%", RB.score_r3(96.0)[0], RB.score_r3(29.0)[0])


def test_R3_impossible_values_are_refused_not_scored_zero():
    """Below 0% or above 100% means a sign/scope/mapping fault upstream, so a
    zero would publish a verdict built on a number we know is broken."""
    for raw in (-0.1, -12.0, 100.1, 180.0):
        score, status = RB.score_r3(raw)
        check(f"R3 {raw} score", score, None)
        check(f"R3 {raw} status", status, RB.STATUS_REVIEW)
    # 100% exactly is possible — a reinsurer may cede nothing.
    check("R3 100%", RB.score_r3(100.0), (0, RB.STATUS_OK))


def test_R3_boundaries_at_each_zone_edge():
    for raw, want in ((50.0, 6), (85.0, 6), (40.0, 4), (90.0, 4),
                      (30.0, 2), (95.0, 2)):
        check(f"R3 {raw}", RB.score_r3(raw)[0], want)
    for raw, want in ((50 - EPS, 4), (85 + EPS, 4), (40 - EPS, 2),
                      (90 + EPS, 2), (30 - EPS, 0), (95 + EPS, 0)):
        check(f"R3 {raw}", RB.score_r3(raw)[0], want)


# --- R4 ---------------------------------------------------------------------

def test_R4_edges():
    for raw, want in ((5.0, 8), (4.0, 7), (3.0, 5), (2.0, 3), (0.0, 1)):
        check(f"R4 {raw}", RB.score_r4(raw)[0], want)
    for raw, want in ((5 - EPS, 7), (4 - EPS, 5), (3 - EPS, 3),
                      (2 - EPS, 1), (-EPS, 0)):
        check(f"R4 {raw}", RB.score_r4(raw)[0], want)


# --- R5: closes on the OPPOSITE side from R1/R2/R4 --------------------------

def test_R5_edges_close_upward():
    for raw, want in ((0.70, 12), (0.85, 10), (1.00, 8), (1.15, 6), (1.30, 3)):
        check(f"R5 {raw}", RB.score_r5(raw)[0], want)
    # Just ABOVE each ceiling must drop a band — the mirror of R1's test.
    for raw, want in ((0.70 + EPS, 10), (0.85 + EPS, 8), (1.00 + EPS, 6),
                      (1.15 + EPS, 3), (1.30 + EPS, 0)):
        check(f"R5 {raw}", RB.score_r5(raw)[0], want)


def test_R5_cheap_scores_high():
    assert RB.score_r5(0.5)[0] > RB.score_r5(1.5)[0]


# --- Totals -----------------------------------------------------------------

def test_weights_are_the_locked_12_10_8_8_12():
    check("weights", RB.CRITERION_MAX,
          {"R1": 12, "R2": 10, "R3": 8, "R4": 8, "R5": 12})
    check("Internal max", RB.INTERNAL_MAX, 38)
    check("Valuation max", RB.VALUATION_MAX, 12)
    check("deep layer", RB.INTERNAL_MAX + RB.VALUATION_MAX, 50)


def test_no_score_can_exceed_its_weight():
    for code, mx in RB.CRITERION_MAX.items():
        for raw in (-99.0, -5.0, 0.0, 0.7, 1.0, 12.0, 60.0, 75.0, 99.0):
            score, _ = RB.score_one(code, raw)
            if score is not None:
                assert 0 <= score <= mx, f"{code}({raw}) = {score} > {mx}"
    PASS.append("range: every score within its weight")


def test_versions_are_pinned():
    check("formula", RB.FORMULA_VERSION, "REINSURANCE_R1_R5_FORMULA_V1")
    check("threshold", RB.THRESHOLD_VERSION, "REINSURANCE_R1_R5_THRESHOLD_V1")


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
