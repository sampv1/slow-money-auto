"""9-criterion graduated scoring rubric for the FA Scanner.

Each criterion awards tiered points (typically 0 / 4 / 8 / 12; the debt
criterion can award -4). Max total = 108. See FA_FEATURE_PLAN.md for the
authoritative rubric.

Boundary convention: tiers are interpreted as [low, high) — i.e. a value equal
to a tier's lower bound falls into that tier. E.g. EPS growth of exactly 30%
scores in the "30-60%" tier (8 pts).

Growth metrics are QoQ in v1 (4-period data cap). C9 valuation compares the
current P/E to a 4-quarter median P/E.
"""

from dataclasses import dataclass, field

# Rating bands on the 0..108 total (debt can push slightly negative).
RATING_A_MIN = 60
RATING_B_MIN = 30

C9_NEUTRAL_PTS = 8  # awarded when the 4-quarter median P/E can't be computed


@dataclass
class ScoreResult:
    criteria: dict = field(default_factory=dict)  # cN -> {"value": x, "pts": y}
    total_score: int = 0
    rating: str = "UNRATED"
    notes: list = field(default_factory=list)

    def pts(self, key: str) -> int:
        return self.criteria.get(key, {}).get("pts", 0)


def _tiered(value, tiers, default_pts):
    """Pick points for `value` from ascending (upper_bound, pts) tiers.

    Each tier (ub, pts) matches when value < ub. The final tier should use
    float('inf'). Returns default_pts if value is None.
    """
    if value is None:
        return default_pts
    for upper, pts in tiers:
        if value < upper:
            return pts
    return default_pts


# Per-criterion tier tables (upper_bound, points), ascending.
_C1 = [(20, 0), (30, 4), (60, 8), (float("inf"), 12)]
_C2 = [(25, 0), (35, 4), (45, 8), (float("inf"), 12)]
_C4 = [(10, 0), (15, 4), (20, 8), (float("inf"), 12)]
_C5 = [(-5, 0), (0, 4), (10, 8), (float("inf"), 12)]   # pp change
_C6 = [(-5, 0), (0, 4), (10, 8), (float("inf"), 12)]   # pp change
_C7 = [(15, 0), (17, 4), (20, 8), (float("inf"), 12)]  # ROE %

_C3_MAP = {0: 0, 1: 4, 2: 8, 3: 12}


def _score_c3(count):
    if count is None:
        return 0
    return _C3_MAP.get(min(count, 3), 12)


def _score_c8(de):
    """Debt/Equity: >1.5 -> -4, [0.8,1.5] -> 6, <0.8 -> 12."""
    if de is None:
        return 0
    if de > 1.5:
        return -4
    if de >= 0.8:
        return 6
    return 12


def _score_c9(current_pe, pe_median, notes):
    """P/E vs 4-quarter median: <=0.8x -> 12, >=1.2x -> 4, else 8."""
    if current_pe is None or pe_median is None or pe_median <= 0:
        notes.append("C9: 4Q median P/E unavailable — neutral 8")
        return C9_NEUTRAL_PTS
    if current_pe <= 0.8 * pe_median:
        return 12
    if current_pe >= 1.2 * pe_median:
        return 4
    return 8


def compute_score(metrics: dict, n_quarters: int) -> ScoreResult:
    """Compute the graduated 9-criterion score from a metrics dict.

    `n_quarters` is how many quarterly statements were available — used to
    flag UNRATED when there's too little data to score meaningfully.
    """
    res = ScoreResult()

    insufficient = n_quarters < 4
    if insufficient:
        res.notes.append(f"Insufficient quarterly history (n={n_quarters})")
        # Still record whatever metrics we have, with their points, for transparency.

    def record(key, value, pts):
        res.criteria[key] = {"value": value, "pts": pts}

    record("c1", metrics.get("c1_eps_qoq"), _tiered(metrics.get("c1_eps_qoq"), _C1, 0))
    record("c2", metrics.get("c2_eps_3q_avg"), _tiered(metrics.get("c2_eps_3q_avg"), _C2, 0))
    record("c3", metrics.get("c3_eps_pos_count"), _score_c3(metrics.get("c3_eps_pos_count")))
    record("c4", metrics.get("c4_rev_qoq"), _tiered(metrics.get("c4_rev_qoq"), _C4, 0))
    record("c5", metrics.get("c5_gross_margin_delta"), _tiered(metrics.get("c5_gross_margin_delta"), _C5, 0))
    record("c6", metrics.get("c6_net_margin_delta"), _tiered(metrics.get("c6_net_margin_delta"), _C6, 0))
    record("c7", metrics.get("c7_roe"), _tiered(metrics.get("c7_roe"), _C7, 0))
    record("c8", metrics.get("c8_debt_to_equity"), _score_c8(metrics.get("c8_debt_to_equity")))
    record("c9", metrics.get("current_pe"), _score_c9(metrics.get("current_pe"), metrics.get("pe_4q_median"), res.notes))

    res.total_score = sum(c["pts"] for c in res.criteria.values())

    # If none of the growth/quality metrics could be computed, the statement
    # format is unsupported (banks/insurers use different line items than the
    # "Net sales"/"Gross Profit" layout we parse). Don't pass off a misleading
    # C-grade — mark UNRATED. (c3 is a count that defaults to 0, so exclude it.)
    core_vals = [metrics.get(k) for k in (
        "c1_eps_qoq", "c2_eps_3q_avg", "c4_rev_qoq",
        "c5_gross_margin_delta", "c6_net_margin_delta", "c7_roe", "c8_debt_to_equity",
    )]
    no_usable_fundamentals = all(v is None for v in core_vals)

    if insufficient:
        res.rating = "UNRATED"
    elif no_usable_fundamentals:
        res.rating = "UNRATED"
        res.notes.append("No usable fundamentals (e.g. bank/financial statement format)")
    elif res.total_score >= RATING_A_MIN:
        res.rating = "A"
    elif res.total_score >= RATING_B_MIN:
        res.rating = "B"
    else:
        res.rating = "C"

    return res
