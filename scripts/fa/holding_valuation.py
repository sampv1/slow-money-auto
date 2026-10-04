"""Holding valuation /12 — P/B against the company's OWN 20-quarter median.

BA `FINAL_BA_SPEC_HOLDING_VALUATION_HOLDING_UI_TOAN_NGANH_UI_2026-10-04.md`
Phần I.

THE QUESTION IT ANSWERS IS SELF-RELATIVE, NOT CROSS-SECTIONAL (§1). BVH and PVI
run different businesses, so an absolute P/B cannot rank one against the other.
Each is measured against its own five-year typical level:

    RELATIVE_PB = CURRENT_PB / MEDIAN_PB_20Q

TWENTY OBSERVATIONS, EXACTLY — NOT "UP TO TWENTY" (§3.3). This is where this
module differs from `insurance_deep.pb_relative_asof`, which R5 and P5 use with
a floor of 8 and a ceiling of 20. BA sets production at `N_VALID_PB = 20` and
forbids falling back to 8, 12 or 16 quarters, interpolating or zero-filling. A
company short of twenty is `NOT_SCORED` — which is not a low valuation score, it
is the absence of one.

THE BAND TABLE IS TRANSCRIBED, NOT IMPORTED, ALTHOUGH IT IS IDENTICAL TO R5'S
TODAY. BA issues it with its own version string
(`HOLDING_PB_RELATIVE_20Q_THRESHOLD_V1`), so the two are separately versioned
and may legitimately diverge; importing `reinsurance_bands.R5_BANDS` would mean
a future reinsurance threshold change silently moved every Holding score. The
duplication is the point, and `audit_bands()` pins this copy against BA's own
§5 test table so it cannot drift from the spec by accident.

UPPER-CLOSED, AND THE SPEC TESTS BOTH SIDES OF EVERY EDGE. Cheap scores high, so
each bound reads `<=`: 0,70 exactly takes 12 and 0,700001 takes 10. That is the
opposite closure from B1-B4/P1-P4 and from R1/R2/R4, and it is the single
easiest thing to get backwards.
"""

from __future__ import annotations

import statistics

FORMULA_VERSION = "HOLDING_PB_RELATIVE_20Q_FORMULA_V1"
THRESHOLD_VERSION = "HOLDING_PB_RELATIVE_20Q_THRESHOLD_V1"
#: The provider field and reading convention behind every P/B used here.
MAPPING_VERSION = "HOLDING_PB_RT_VALUE_PB_QUARTER_SNAPSHOT_V1"

VALUATION_WEIGHT = 12

#: §3.3 — production requires exactly this many usable quarterly snapshots.
N_REQUIRED = 20

STATUS_OK = "OK"
STATUS_NOT_SCORED = "NOT_SCORED"
STATUS_PENDING_REVIEW = "NOT_SCORED_PENDING_REVIEW"

#: §4, as (ceiling, points) ascending. The first ceiling the value does not
#: exceed wins.
BANDS = ((0.70, 12), (0.85, 10), (1.00, 8), (1.15, 6), (1.30, 3))

#: §4's right-hand column, stored on the row so the UI never invents a verdict.
BAND_LABEL = {12: "Rất rẻ so với lịch sử", 10: "Rẻ",
              8: "Hấp dẫn / dưới trung vị", 6: "Quanh vùng hợp lý",
              3: "Khá đắt", 0: "Đắt rõ rệt so với lịch sử"}


def score(relative: float | None) -> int | None:
    """§4's table. `None` in means `None` out — never 0, which is a real score
    meaning "expensive against its own history"."""
    if relative is None:
        return None
    for ceiling, points in BANDS:
        if relative <= ceiling:
            return points
    return 0


def relative_pb(pb_by_period: dict[str, float], period: str) -> dict:
    """One symbol-quarter, point-in-time.

    ONLY OBSERVATIONS THAT EXISTED BY `period` ARE USED (§3.1). Taking today's
    twenty quarters and computing a median backwards for a past quarter is the
    look-ahead the spec forbids by name, and it is the easiest failure to ship
    because the result looks entirely reasonable. The current observation sits
    inside its own median set, which BA allows explicitly and which the already
    approved R5/P5 engine also does.

    A non-positive current P/B or median is a DATA fault, not a verdict (§3.4):
    it means the series or the mapping is broken, so the row is held for review
    rather than scored 0.
    """
    usable = sorted(p for p, v in pb_by_period.items()
                    if p <= period and v is not None and v > 0)
    window = usable[-N_REQUIRED:]
    current = pb_by_period.get(period)

    out = {"current_pb": current, "median_pb_20q": None, "relative_pb": None,
           "n_valid": len(window), "score": None, "band": None,
           "window_first": window[0] if window else None,
           "window_last": window[-1] if window else None,
           "status": STATUS_NOT_SCORED}

    # §3.3 — fewer than twenty is an absence, not a weak score.
    if len(window) < N_REQUIRED:
        return out

    median = statistics.median(pb_by_period[p] for p in window)
    out["median_pb_20q"] = median

    # §3.4 — a broken series is held for review, never scored 0.
    if current is None or current <= 0 or median <= 0:
        out["status"] = STATUS_PENDING_REVIEW
        return out

    rel = current / median
    pts = score(rel)
    out.update(relative_pb=rel, score=pts, band=BAND_LABEL[pts],
               status=STATUS_OK)
    return out


#: §7 — the tooltip's threshold list, built from `BANDS` so it cannot describe a
#: table the scorer does not run.
def band_text() -> list[str]:
    n = lambda v: f"{v:.2f}".replace(".", ",")
    out, prev = [], None
    for ceiling, pts in BANDS:
        lo = "" if prev is None else f">{n(prev)}–"
        out.append(f"{lo}<={n(ceiling)} lần: {pts} điểm")
        prev = ceiling
    out.append(f">{n(prev)} lần: 0 điểm")
    return out


FORMULA_TEXT = ("P/B hiện tại / Trung vị P/B 20 quý gần nhất "
                "của chính doanh nghiệp")
UNIT_TEXT = "lần"


def audit_bands() -> list[str]:
    """BA's §5 test table, verbatim — every edge AND the value just past it.

    A band table is almost never wrong in the middle of a range; it is wrong
    about which side a boundary closes on, and only the pair either side of an
    edge can tell those apart. §5 publishes both, so both are asserted.
    """
    cases = [
        (0.699999, 12), (0.700000, 12), (0.700001, 10),
        (0.850000, 10), (0.850001, 8),
        (1.000000, 8), (1.000001, 6),
        (1.150000, 6), (1.150001, 3),
        (1.300000, 3), (1.300001, 0),
    ]
    issues = []
    for rel, want in cases:
        got = score(rel)
        if got != want:
            issues.append(f"relative {rel} -> {got}, want {want}")
    # The printed thresholds must describe the table the scorer runs.
    lines = band_text()
    if len(lines) != len(BANDS) + 1:
        issues.append(f"band_text has {len(lines)} lines for {len(BANDS)} bands")
    for (ceiling, pts), line in zip(BANDS, lines):
        if f": {pts} điểm" not in line:
            issues.append(f"band_text line {line!r} != {pts} points")
        if score(ceiling) != pts:
            issues.append(f"band_text claims {pts} at {ceiling}, "
                          f"scorer gives {score(ceiling)}")
    if sum(w for _, w in BANDS[:1]) != VALUATION_WEIGHT:
        issues.append(f"top band {BANDS[0][1]} != weight {VALUATION_WEIGHT}")
    return issues
