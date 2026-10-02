"""Holding/Hỗn hợp deep-score engine — BVH and PVI only.

FROZEN BY BA 2026-10-01. Eight metrics, two engines, one tab. The design phase
is over: this module implements it and must not grow a ninth metric, a fallback,
or an absolute band. Changes are allowed only for a production bug, an
accounting/taxonomy change, or a BA-approved redesign.

THE THREE LAYERS ANSWER THREE DIFFERENT QUESTIONS, and conflating them is the
mistake this file exists to prevent:

    50 industry points  INDUSTRY_CALIBRATED_ABSOLUTE_BAND -- one yardstick for
                        all 13 insurers; thresholds calibrated on the sector.
    38 deep points      SELF_RELATIVE -- where a company sits inside its OWN
                        history. NOT comparable between BVH and PVI.
    12 valuation points SELF_RELATIVE_VALUATION -- own P/B history.

So a deep total of 20.45 for BVH against 10.29 for PVI does NOT say BVH is the
better company; it says BVH is nearer its own historical best. Any UI that
prints the number without that sentence fails QA.
"""

from __future__ import annotations

from dataclasses import dataclass

from . import insurance_deep as D

HOLDING_FORMULA_VERSION = "HOLDING_FORMULA_1.0"
HOLDING_MAPPING_VERSION = "HOLDING_V1"          # investable-asset mapping
HOLDING_SCORING_VERSION = "HOLDING_SCORING_1.0"

# THE UI VERSION IS SPLIT IN TWO, because a spec can be frozen while nothing is
# built. Declaring one "HOLDING_UI_1.0" while the dashboard does not exist would
# record an implementation freeze that never happened.
HOLDING_UI_SPEC_VERSION = "HOLDING_UI_SPEC_1.0"
# Set on 2026-10-02, when the tab actually existed and its QA passed: zero page
# overflow and zero clipped cells in both locales at 1920/1440/1280/768/390, and
# 50 frontend/backend reproduction checks read out of the rendered DOM. Until
# then this was None on purpose -- declaring an implementation freeze while the
# dashboard had no such page would have recorded something that never happened.
HOLDING_UI_IMPLEMENTATION_VERSION = "HOLDING_UI_IMPL_1.0"

UNIVERSE = ("BVH", "PVI")

# PUBLIC TAXONOMY IS ONE CATEGORY; the engine profile is internal only. Two
# scoring engines must not become two menu entries -- the tab exists so the two
# companies stay comparable in one place.
PUBLIC_CATEGORY = "HOLDING_MIXED"

MODEL_BY_TICKER = {
    "BVH": "LIFE_LED_HOLDING",
    "PVI": "NONLIFE_REINSURANCE_HOLDING",
}

# --------------------------------------------------------------------------
# Investable assets -- the denominator of B1/P3 and the numerator of B3.
#
# WHITELIST / BLACKLIST ARE EXPLICIT SO A LATER DEVELOPER CANNOT RE-ADD A CHILD
# LINE. `BS_CASH + BS_CASH_EQUIVALENTS = BS_CASH_AND_PRECIOUS_METALS` was
# verified on 60/60 symbol-quarters, so adding either component on top of the
# total double-counts it. The same holds for HTM inside the two investment
# totals -- adding them inflated the denominator on 60/60 quarters, median +99%.
# --------------------------------------------------------------------------

INVESTABLE_WHITELIST = (
    D.CASH_TOTAL,      # BS_CASH_AND_PRECIOUS_METALS
    D.ST_INV,
    D.LT_INV,
)

INVESTABLE_BLACKLIST = {
    D.CASH: D.CASH_TOTAL,
    D.CASH_EQUIV: D.CASH_TOTAL,
    D.HTM: f"{D.ST_INV}/{D.LT_INV}",
    D.OTHER_LT_INV: D.LT_INV,
}

# BVH's technical-reserve line changes meaning at 2022-Q1: before it, the
# provider folded the reserve into long-term liabilities (285 tỷ against the
# 130,805 tỷ that follows). Any metric whose reference set reads
# BS_INSURANCE_RESERVES must start after the break for BVH.
VALID_FROM = {
    ("BVH", "B3"): "2022-Q1",
    ("BVH", "B4"): "2022-Q1",
}

WEIGHTS = {"B1": 10, "B2": 10, "B3": 10, "B4": 8,
           "P1": 10, "P2": 10, "P3": 10, "P4": 8}

METRICS_BY_TICKER = {"BVH": ("B1", "B2", "B3", "B4"),
                     "PVI": ("P1", "P2", "P3", "P4")}

# Gate 2. `EFFECTIVE_HISTORY_WINDOWS` is deliberately NOT called "independent
# windows": BA renamed it because N//4 is a conservative annual-spacing proxy,
# not a statistical independence count -- TTM observations overlap, and a
# quarter-end level has no four-quarter horizon at all.
MIN_N_VALID = 12
MIN_EFFECTIVE_WINDOWS = 3
HORIZON_QUARTERS = 4


def effective_history_windows(n_valid: int) -> int:
    return n_valid // HORIZON_QUARTERS


# --------------------------------------------------------------------------
# Raw metric construction
# --------------------------------------------------------------------------

def investable_assets(items: dict) -> float | None:
    """Sum of the three whitelisted totals. Returns None if any is absent --
    never a partial sum, which would silently shrink the denominator."""
    vals = [items.get(k) for k in INVESTABLE_WHITELIST]
    if any(v is None for v in vals):
        return None
    return sum(vals)


def _ttm(inc: dict, period: str, key: str) -> float | None:
    """Exactly four consecutive standalone quarters, or nothing. A missing
    quarter inside the window makes the observation INVALID -- it is never
    annualised from three, forward-filled, or patched with an annual figure."""
    quarters = [D.shift(period, i) for i in range(4)]
    if not all(q in inc for q in quarters):
        return None
    vals = [inc[q].get(key) for q in quarters]
    if any(v is None for v in vals):
        return None
    return sum(vals)


def financial_efficiency(inc: dict, bal: dict, period: str) -> float | None:
    """B1 / P3 -- TTM financial activity result over average investable assets.

    Average is the TTM endpoints (t-4 and t), per BA. Both endpoints must exist
    or the observation is invalid.
    """
    num = _ttm(inc, period, D.FIN_NET)
    start = D.shift(period, 4)
    if num is None or start not in bal or period not in bal:
        return None
    a, b = investable_assets(bal[start]), investable_assets(bal[period])
    if a is None or b is None:
        return None
    avg = (a + b) / 2.0
    return None if not avg else num / avg * 100.0


def insurance_margin_ttm(inc: dict, period: str) -> float | None:
    """P1 -- TTM gross insurance operating profit over TTM net insurance
    revenue. Not used for BVH: its life-led mix makes underwriting margin a
    measure of business model rather than quality (BA §1)."""
    gp = _ttm(inc, period, D.GROSS_INSURANCE_PROFIT)
    rev = _ttm(inc, period, D.NET_INSURANCE_REVENUE)
    if gp is None or not rev:
        return None
    return gp / rev * 100.0


def investment_coverage(bal: dict, period: str) -> float | None:
    """B3 -- investable assets over insurance reserves, a quarter-end LEVEL.

    NOT a solvency ratio. The tooltip may not call it one: it compares the
    mapped investment book with the reserve line as filed, and carries no
    regulatory meaning.
    """
    if period not in bal:
        return None
    assets = investable_assets(bal[period])
    res = bal[period].get(D.INSURANCE_RESERVES)
    if assets is None or not res or res <= 0:
        return None
    return assets / res * 100.0


def capital_buffer_level(bal: dict, period: str) -> float | None:
    """B4 / P4 -- equity over insurance reserves, a quarter-end LEVEL.

    LEVEL-DIRECTION PAIR WITH C5, AND THE DEPENDENCY IS HIGH, not incidental.
    Given the B4 SERIES, C5 follows exactly: `C5_t = B4_t / B4_(t-4) - 1`. An
    earlier audit of mine called the two "not a deterministic transform", which
    was wrong -- it compared one observation instead of the series, and a single
    `buf_t` indeed does not yield `buf_(t-4)` while the series does. BA caught
    it. Correct classification:

        EXACT_DUPLICATE       = NO
        STRUCTURAL_DEPENDENCY = HIGH
        RELATIONSHIP_TYPE     = LEVEL_DIRECTION_PAIR

    Both are kept deliberately, the same way B1/B2 and P1/P2 pair a level with
    its change: the industry layer scores the direction, the deep layer scores
    where the level sits in the company's own history. Keeping them is a design
    choice, not an oversight, and neither may be dropped for correlation alone.
    """
    if period not in bal:
        return None
    eq = bal[period].get(D.EQUITY)
    res = bal[period].get(D.INSURANCE_RESERVES)
    if eq is None or not res or res <= 0:
        return None
    return eq / res * 100.0


def yoy_delta(series: dict[str, float], period: str) -> float | None:
    """B2 / P2 -- the SAME metric four quarters back, by label.

    Never `t-3`, never `t-5`, never "nearest available": a nearest-match would
    quietly compare different quarters of the year, which is the alignment bug
    R3 exists to catch. Unit is a percentage-POINT difference, not a growth
    rate.
    """
    before = D.shift(period, 4)
    if period not in series or before not in series:
        return None
    return series[period] - series[before]


# --------------------------------------------------------------------------
# Self-relative scoring
# --------------------------------------------------------------------------

@dataclass
class Score:
    metric: str
    current: float | None
    rank: float | None
    n_valid: int
    percentile: float | None
    weight: int
    score: float | None
    status: str


def average_rank(values: list[float], current: float) -> float:
    """1-based average rank, ties sharing the mean of their positions. BA
    requires `rank_method = average` explicitly, because tie handling is where
    two implementations silently disagree."""
    less = sum(1 for v in values if v < current)
    equal = sum(1 for v in values if v == current)
    return less + (equal + 1) / 2.0


def percentile_score(values: list[float], current: float | None,
                     weight: int, metric: str = "") -> Score:
    """`percentile = (average_rank - 1) / (N - 1)`, `score = weight x percentile`.

    A current value equal to the historical minimum scores EXACTLY zero, and the
    maximum scores the full weight. That is the engine behaving correctly, not a
    defect: BA forbids a score floor, a minimum of 1/10, winsorising, or any
    absolute band bolted on to soften it.
    """
    if current is None:
        return Score(metric, None, None, len(values), None, weight, None,
                     "NOT_SCORED_CURRENT_INVALID")
    n = len(values)
    if n < MIN_N_VALID or effective_history_windows(n) < MIN_EFFECTIVE_WINDOWS:
        return Score(metric, current, None, n, None, weight, None,
                     "SELF_HISTORY_INSUFFICIENT")
    if n < 2:
        return Score(metric, current, None, n, None, weight, None,
                     "SELF_HISTORY_INSUFFICIENT")
    r = average_rank(values, current)
    pct = (r - 1) / (n - 1)
    return Score(metric, current, r, n, pct, weight, weight * pct, "OK")


def deep_total(scores: list[Score]) -> float | None:
    """Sum of UNROUNDED component scores. Rounding happens only at display --
    summing displayed values would drift the total, which is what R8 pins."""
    if any(s.score is None for s in scores):
        return None
    return sum(s.score for s in scores)
