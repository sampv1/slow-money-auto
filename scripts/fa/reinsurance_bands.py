"""BA `DAC_TA_CHOT_NGUONG_CHAM_DIEM_TAB_TAI_BAO_HIEM_V1_2026-10-04.md` — the
reinsurance scoring thresholds.

R1 12 · R2 10 · R3 8 · R4 8 = Internal /38, and R5 12 = Valuation /12.

THREE BOUNDARY SHAPES, NOT ONE, and transcribing a single pattern across all
five is how a band table ships wrong:

  * R1, R2 and R4 are "higher is better" and lower-closed: a value sitting
    exactly ON a floor takes the HIGHER band (R1 = 15.00% scores 12, not 10).
  * R5 is "cheaper is better" and upper-closed, so every bound reads `<=`
    (R5 = 0.70x scores 12). It closes on the opposite side from the rest —
    the same trap `nonlife_bands.py` records for P5.
  * R3 is a BAND AROUND A MIDDLE, not a ranking. 60-80% is the full mark and
    the score falls away on BOTH sides, so "higher is better" is actively
    wrong here: 96% retention scores zero, exactly like 29%.

R3 ALSO HAS A REFUSAL, NOT JUST A ZERO. A retention below 0% or above 100% is
arithmetically impossible for a ratio of retained to assumed premium, so it
means a sign, gross/net or period error upstream — §5.3 says return
REVIEW_TRIGGERED rather than score it. A zero there would publish a verdict on
a company from a number we know is broken.

THE SAME DISTINCTION RUNS THROUGH THE WHOLE FILE (§10): `0` is a real score a
weak company earns, and `None` means not measurable. They are never
interchangeable, so every function here returns a (score, status) pair instead
of leaning on a nullable number to carry both.
"""

from __future__ import annotations

FORMULA_VERSION = "REINSURANCE_R1_R5_FORMULA_V1"
THRESHOLD_VERSION = "REINSURANCE_R1_R5_THRESHOLD_V1"

CRITERION_MAX = {"R1": 12, "R2": 10, "R3": 8, "R4": 8, "R5": 12}
INTERNAL_MAX = CRITERION_MAX["R1"] + CRITERION_MAX["R2"] \
             + CRITERION_MAX["R3"] + CRITERION_MAX["R4"]      # 38
VALUATION_MAX = CRITERION_MAX["R5"]                            # 12

STATUS_OK = "OK"
STATUS_NOT_SCORED = "NOT_SCORED"
STATUS_REVIEW = "REVIEW_TRIGGERED"

#: Labels carried onto the row so the UI never re-derives a band name.
R3_LABEL = {8: "Cân bằng (60–80%)", 6: "Lệch nhẹ", 4: "Lệch rõ",
            2: "Lệch mạnh", 0: "Ngoài vùng hợp lý"}


def _descending(value: float, table: tuple[tuple[float, int], ...]) -> int:
    """Lower-closed bands, highest floor first: `value >= floor` wins."""
    for floor, points in table:
        if value >= floor:
            return points
    return table[-1][1]


#: §3.3 — R1, insurance operating margin (%). 0% is the economic boundary:
#: positive means the underwriting book earns, negative means it loses.
R1_BANDS = ((15.0, 12), (10.0, 10), (5.0, 8), (0.0, 5))

#: §4.3 — R2, the YoY change in R1 in PERCENTAGE POINTS. Not a growth rate.
R2_BANDS = ((5.0, 10), (2.0, 8), (0.0, 6), (-2.0, 4), (-5.0, 2))

#: §6.4 — R4, investment yield on a TTM numerator (%).
R4_BANDS = ((5.0, 8), (4.0, 7), (3.0, 5), (2.0, 3), (0.0, 1))

#: §7.3 — R5, current P/B over its own historical median (times). Upper-closed
#: and DESCENDING: cheap scores high.
R5_BANDS = ((0.70, 12), (0.85, 10), (1.00, 8), (1.15, 6), (1.30, 3))


def score_r1(raw: float | None) -> tuple[int | None, str]:
    if raw is None:
        return None, STATUS_NOT_SCORED
    if raw < 0:
        return 0, STATUS_OK
    return _descending(raw, R1_BANDS), STATUS_OK


def score_r2(raw: float | None) -> tuple[int | None, str]:
    if raw is None:
        return None, STATUS_NOT_SCORED
    if raw < -5.0:
        return 0, STATUS_OK
    return _descending(raw, R2_BANDS), STATUS_OK


def score_r3(raw: float | None) -> tuple[int | None, str]:
    """§5.3 — scored by ZONE, symmetric around 60-80%.

    Written as explicit intervals rather than a sorted table because the shape
    is two-sided: a `>=` cascade cannot express "8 points between 60 and 80 and
    6 on either side of it" without reading as a ranking, which is the reading
    BA forbids in as many words ("không phải càng cao càng tốt").
    """
    if raw is None:
        return None, STATUS_NOT_SCORED
    # Impossible for a retained/assumed ratio: a mapping fault, not a result.
    if raw < 0.0 or raw > 100.0:
        return None, STATUS_REVIEW
    if 60.0 <= raw <= 80.0:
        return 8, STATUS_OK
    if 50.0 <= raw < 60.0 or 80.0 < raw <= 85.0:
        return 6, STATUS_OK
    if 40.0 <= raw < 50.0 or 85.0 < raw <= 90.0:
        return 4, STATUS_OK
    if 30.0 <= raw < 40.0 or 90.0 < raw <= 95.0:
        return 2, STATUS_OK
    return 0, STATUS_OK          # < 30% or > 95%


def score_r4(raw: float | None) -> tuple[int | None, str]:
    if raw is None:
        return None, STATUS_NOT_SCORED
    if raw < 0:
        return 0, STATUS_OK
    return _descending(raw, R4_BANDS), STATUS_OK


def score_r5(relative: float | None) -> tuple[int | None, str]:
    """§7.3 — ASCENDING bounds, upper-closed: the first band whose ceiling the
    value does not exceed wins. The opposite closure from R1/R2/R4."""
    if relative is None:
        return None, STATUS_NOT_SCORED
    for ceiling, points in R5_BANDS:
        if relative <= ceiling:
            return points, STATUS_OK
    return 0, STATUS_OK


SCORERS = {"R1": score_r1, "R2": score_r2, "R3": score_r3,
           "R4": score_r4, "R5": score_r5}


def score_one(code: str, raw: float | None) -> tuple[int | None, str]:
    return SCORERS[code](raw)


def audit_bands() -> list[str]:
    """Every boundary §9 lists, checked against the tables above.

    BA publishes the expected score at each edge, so the table and the spec can
    be compared mechanically instead of by reading — which is what caught the
    non-life P5 closure direction.
    """
    cases = [
        ("R1", 15.0, 12), ("R1", 10.0, 10), ("R1", 5.0, 8), ("R1", 0.0, 5),
        ("R2", 5.0, 10), ("R2", 2.0, 8), ("R2", 0.0, 6),
        ("R2", -2.0, 4), ("R2", -5.0, 2),
        ("R3", 60.0, 8), ("R3", 80.0, 8), ("R3", 50.0, 6), ("R3", 85.0, 6),
        ("R3", 40.0, 4), ("R3", 90.0, 4), ("R3", 30.0, 2), ("R3", 95.0, 2),
        ("R4", 5.0, 8), ("R4", 4.0, 7), ("R4", 3.0, 5),
        ("R4", 2.0, 3), ("R4", 0.0, 1),
        ("R5", 0.70, 12), ("R5", 0.85, 10), ("R5", 1.00, 8),
        ("R5", 1.15, 6), ("R5", 1.30, 3),
    ]
    issues = []
    for code, raw, want in cases:
        got, status = score_one(code, raw)
        if got != want or status != STATUS_OK:
            issues.append(f"{code}({raw}) -> {got}/{status}, want {want}/OK")
    if INTERNAL_MAX != 38:
        issues.append(f"INTERNAL_MAX {INTERNAL_MAX} != 38")
    if VALUATION_MAX != 12:
        issues.append(f"VALUATION_MAX {VALUATION_MAX} != 12")
    return issues
