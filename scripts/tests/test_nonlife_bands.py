#!/usr/bin/env python3
"""BA `CHOT_BAND_DIEM_P1_P5...` §12 — every boundary value, verbatim.

§12 lists eight values per criterion: each boundary and the point immediately
either side of it. They are transcribed here as DATA rather than rewritten as
assertions, so a reader can diff this table against BA's document line by line.

The reason BA listed them is P5: it closes on the opposite side from P1-P4, so
0.70 scores 12 (not 9) and 1.00 scores 6 (not 3). A single transcription
pattern applied to all five criteria fails exactly those four rows.

Runs standalone or under pytest.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fa.nonlife_bands import (  # noqa: E402
    CRITERION_MAX, DEEP_MAX, DELTA_CALCULATED, DELTA_NO_CHANGE_FROM_ZERO,
    DELTA_NO_PRIOR, DELTA_PREVIOUS_PENDING, DELTA_RECOVERY_FROM_ZERO,
    SCORE_BANDS_VERSION, audit_bands, deep_score, fa_delta, fa_final, fa_raw,
    score_one)

_fail = []


def check(name, cond, detail=""):
    print(f"{'ok  ' if cond else 'FAIL'} {name}" + (f" — {detail}" if detail else ""))
    if not cond:
        _fail.append(name)


#: §12.1 - §12.5, copied from BA's tables.
BOUNDARIES = {
    "P1": [(-0.0001, 0), (0.0000, 3), (4.9999, 3), (5.0000, 6),
           (11.9999, 6), (12.0000, 9), (19.9999, 9), (20.0000, 12)],
    "P2": [(-5.0000, 0), (-4.9999, 3), (-0.0001, 3), (0.0000, 6),
           (1.9999, 6), (2.0000, 8), (4.9999, 8), (5.0000, 10)],
    "P3": [(1.9999, 0), (2.0000, 2), (2.9999, 2), (3.0000, 4),
           (3.9999, 4), (4.0000, 6), (4.9999, 6), (5.0000, 8)],
    "P4": [(0.9999, 0), (1.0000, 2), (1.0999, 2), (1.1000, 4),
           (1.2499, 4), (1.2500, 6), (1.4999, 6), (1.5000, 8)],
    "P5": [(0.7000, 12), (0.7001, 9), (0.8500, 9), (0.8501, 6),
           (1.0000, 6), (1.0001, 3), (1.1500, 3), (1.1501, 0)],
}


def test_every_boundary_value_in_BA_section_12():
    for code, cases in BOUNDARIES.items():
        for value, expected in cases:
            got, label = score_one(code, value)
            check(f"§12 {code} {value} -> {expected}", got == expected,
                  f"được {got} ({label})")


def test_P5_closes_on_the_other_side_from_P1_to_P4():
    """The asymmetry itself, stated as a property rather than as eight rows.

    P1-P4 are lower-closed: the boundary belongs to the band ABOVE it. P5 is
    upper-closed: the boundary belongs to the band BELOW it — i.e. to the
    better score, because low P5 is cheap. Getting this backwards is silent:
    every non-boundary value still scores correctly."""
    for code, bound, better, worse in (("P1", 12.0, 9, 6), ("P3", 3.0, 4, 2),
                                       ("P4", 1.25, 6, 4)):
        check(f"{code} boundary {bound} belongs to the band above",
              score_one(code, bound)[0] == better)
        check(f"{code} just below {bound} stays below",
              score_one(code, bound - 1e-9)[0] == worse)
    # P5: the boundary belongs to the CHEAPER (higher-scoring) band.
    check("P5 0.85 keeps the better score (9, not 6)",
          score_one("P5", 0.85)[0] == 9)
    check("P5 just above 0.85 drops to 6",
          score_one("P5", 0.85 + 1e-9)[0] == 6)
    check("P5 1.15 still scores 3, not 0", score_one("P5", 1.15)[0] == 3)


def test_the_value_is_banded_unrounded():
    """§3.2's own example: 11,99994% is a 6. Rounding to 12,00% first would
    score 9, which is the mistake the rule is written against."""
    check("11.99994 -> 6 (not 9)", score_one("P1", 11.99994)[0] == 6)
    check("4.99999 -> 3 (not 6)", score_one("P1", 4.99999)[0] == 3)
    check("1.99999 -> 0 on P3", score_one("P3", 1.99999)[0] == 0)


def test_bands_are_closed_and_do_not_overlap():
    """§3.3, checked on the interval definitions, not by sampling."""
    problems = audit_bands()
    check("no gap, no overlap, correct maxima", not problems, str(problems))
    check("maxima are 12/10/8/8/12",
          CRITERION_MAX == {"P1": 12, "P2": 10, "P3": 8, "P4": 8, "P5": 12})
    check("deep max is 50", DEEP_MAX == 50)


def test_a_missing_criterion_scores_nothing_not_zero():
    """§15.2 — 0 is the measured worst case. Standing it in for absent data
    makes "we could not measure this" identical to "this is as bad as it gets"."""
    pts, label = score_one("P1", None)
    check("missing value -> no points", pts is None and label is None)
    d = deep_score({"P1": 10.0, "P2": 1.0, "P3": 3.0, "P4": 1.2, "P5": None})
    check("one missing -> NO deep score", d["deep_score_50"] is None)
    check("and names which", d["deep_missing"] == "P5")
    check("but keeps the four it could score", d["p1_score"] == 6)
    # Never a partial sum and never a rescale (§15.2).
    check("no partial total is emitted",
          all(k not in d for k in ("deep_score_partial", "deep_score_scaled")))


def test_deep_score_sums_all_five():
    d = deep_score({"P1": 20.0, "P2": 5.0, "P3": 5.0, "P4": 1.5, "P5": 0.70})
    check("all maxima -> 50", d["deep_score_50"] == 50, str(d["deep_score_50"]))
    z = deep_score({"P1": -1.0, "P2": -5.0, "P3": 0.0, "P4": 0.0, "P5": 2.0})
    check("all minima -> 0", z["deep_score_50"] == 0)
    check("version is stamped on the row",
          d["scoring_version"] == SCORE_BANDS_VERSION)


def test_fa_raw_and_final():
    """§10.2 and §10.3, including BA's worked example."""
    check("raw needs both halves", fa_raw(None, 41) is None
          and fa_raw(42, None) is None)
    check("BA's example: 42 + 41 = 83", fa_raw(42, 41) == 83)
    check("BA's example: 83 + (-9) = 74", fa_final(83, -9) == 74)
    check("no adjustment leaves it alone", fa_final(83, None) == 83)
    check("floored at 0", fa_final(5, -9) == 0)
    check("no raw -> no final", fa_final(None, -9) is None)


def test_a_positive_adjustment_is_refused_not_flipped():
    """§10.3 warns that `raw - adjustment` RAISES the score when the adjustment
    is already negative. The mirror of that bug is adding a positive one, so a
    positive value is refused: it means whatever wrote it used the wrong sign,
    and silently negating it would hide the defect."""
    try:
        fa_final(83, 9)
        check("positive adjustment refused", False, "no error raised")
    except ValueError as e:
        check("positive adjustment refused", "dương" in str(e))


if __name__ == "__main__":
    for fn in [v for k, v in sorted(globals().items()) if k.startswith("test_")]:
        print(f"\n-- {fn.__name__}")
        fn()
    print(f"\n{'FAILED: ' + ', '.join(_fail) if _fail else 'all checks passed'}")
    sys.exit(1 if _fail else 0)


# ---------------------------------------------------------------------------
# BA `YEU_CAU_HOAN_TAT...` §3 — Δ points vs ΔFA percent
# ---------------------------------------------------------------------------
#: §3.6, copied from BA's table. These are the eight symbols that had two
#: completed quarters when BA wrote it.
DELTA_CASES = [
    ("ABI", 82, 79, 3.80), ("AIC", 36, 39, -7.69), ("BIC", 57, 51, 11.76),
    ("BLI", 67, 37, 81.08), ("BMI", 72, 47, 53.19), ("MIG", 63, 58, 8.62),
    ("PGI", 52, 66, -21.21), ("PTI", 53, 46, 15.22),
]


def test_BA_section_3_6_expected_percentages():
    for sym, cur, prev, want in DELTA_CASES:
        r = fa_delta(cur, prev)
        check(f"§3.6 {sym} {prev}->{cur} = {want:+.2f}%",
              round(r["fa_delta_pct_value"], 2) == want,
              f"được {r['fa_delta_pct_value']:.4f}")


def test_points_and_percent_are_different_fields():
    """BA's objection in one case: BLI moved 37 -> 67. That is +30 POINTS and
    +81.08 PERCENT, and a single field labelled ΔFA carrying 30 reads as 30%."""
    r = fa_delta(67, 37)
    check("points is the score difference", r["fa_delta_points"] == 30)
    check("percent is the rate", round(r["fa_delta_pct_value"], 2) == 81.08)
    check("they are not the same number",
          r["fa_delta_points"] != round(r["fa_delta_pct_value"], 2))


def test_full_precision_is_stored_and_only_display_is_rounded():
    """§3.4 — store the computed value, round for display only."""
    r = fa_delta(53, 46)
    check("stored value is not pre-rounded",
          abs(r["fa_delta_pct_value"] - (7 / 46 * 100)) < 1e-12,
          str(r["fa_delta_pct_value"]))
    check("display carries two decimals and a comma",
          r["fa_delta_display"] == "▲ 15,22%", r["fa_delta_display"])


def test_the_four_special_cases_never_divide_by_zero():
    """§3.5 — each of BA's states, and none of them fabricates a number."""
    r = fa_delta(10, 0)
    check("0 -> positive is RECOVERY_FROM_ZERO",
          r["fa_delta_status"] == DELTA_RECOVERY_FROM_ZERO)
    check("and states no percentage", r["fa_delta_pct_value"] is None)
    check("and says so", r["fa_delta_display"] == "Phục hồi từ 0")

    r = fa_delta(0, 0)
    check("0 -> 0 is NO_CHANGE_FROM_ZERO",
          r["fa_delta_status"] == DELTA_NO_CHANGE_FROM_ZERO)
    check("and displays 0,00%", r["fa_delta_display"] == "0,00%")

    r = fa_delta(50, None)
    check("no prior quarter is NO_PRIOR_COMPLETED_FA",
          r["fa_delta_status"] == DELTA_NO_PRIOR)
    check("and invents no delta", r["fa_delta_points"] is None
          and r["fa_delta_pct_value"] is None)

    r = fa_delta(46, None, previous_pending=True)
    check("prior quarter mid-review is PREVIOUS_QUARTER_PENDING",
          r["fa_delta_status"] == DELTA_PREVIOUS_PENDING)
    # The distinction BA draws: "no prior quarter" waits for data, "prior
    # quarter pending" waits for a review. Merging them loses the action.
    check("which is NOT the same status as having no prior quarter",
          r["fa_delta_status"] != DELTA_NO_PRIOR)


def test_a_missing_delta_is_never_reported_as_zero():
    """§3.5's ban list: no `0` standing in for an uncomputed delta."""
    for r in (fa_delta(50, None), fa_delta(46, None, previous_pending=True),
              fa_delta(None, 50)):
        check(f"{r['fa_delta_status']} carries no 0",
              r["fa_delta_points"] != 0 and r["fa_delta_pct_value"] != 0)


def test_sign_drives_the_arrow():
    check("increase is up", fa_delta(82, 79)["fa_delta_display"].startswith("▲"))
    check("decrease is down", fa_delta(36, 39)["fa_delta_display"].startswith("▼"))
    flat = fa_delta(50, 50)
    check("no change has no arrow", flat["fa_delta_display"] == "0,00%")
    check("and is still CALCULATED", flat["fa_delta_status"] == DELTA_CALCULATED)
