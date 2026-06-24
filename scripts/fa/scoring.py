"""Config-driven 9-criterion scoring for the FA Scanner.

Tiers + rating bands come from `fa_scoring_config` (a JSON blob), so the rubric
can be changed in the DB without code edits. See migration 014 for the shape.

Boundary convention for `tier_lt`: points[i] if value < bounds[i] (ascending),
else points[-1]. So a value equal to a bound falls into the upper tier
(e.g. EPS growth of exactly 30% → the 30–60% tier).
"""

from dataclasses import dataclass, field


@dataclass
class ScoreResult:
    criteria: dict = field(default_factory=dict)   # cN -> {"value", "pts"}
    total_score: int = 0
    normalized_score: float = 0.0   # total_score rescaled to a 0-100 display scale
    rating: str = "UNRATED"
    notes: list = field(default_factory=list)

    def pts(self, key: str) -> int:
        return self.criteria.get(key, {}).get("pts", 0)


def _tier_lt(value, spec) -> int:
    bounds, points = spec["bounds"], spec["points"]
    if value is None:
        return 0
    for b, p in zip(bounds, points):
        if value < b:
            return p
    return points[-1]


def _count_map(value, spec) -> int:
    if value is None:
        return 0
    m = spec["map"]
    key = str(min(int(value), max(int(k) for k in m)))   # clamp to highest defined tier
    return m.get(key, 0)


def _debt_equity(value, spec) -> int:
    if value is None:
        return 0
    if value > spec["high"]:
        return spec["points_high"]
    if value >= spec["low"]:
        return spec["points_mid"]
    return spec["points_low"]


def _pe_median(current_pe, median, spec, notes) -> int:
    if current_pe is None or median is None or median <= 0 or current_pe <= 0:
        notes.append("C14: P/E or 5-yr median unavailable — neutral")
        return spec["points_neutral"]
    if current_pe < spec["low_mult"] * median:
        return spec["points_cheap"]
    if current_pe > spec["high_mult"] * median:
        return spec["points_expensive"]
    return spec["points_neutral"]


def compute_score(metrics: dict, config: dict, fully_scorable: bool) -> ScoreResult:
    """Score one snapshot from a metrics dict + the active config."""
    res = ScoreResult()
    crit = config["criteria"]

    def rec(key, value, pts):
        res.criteria[key] = {"value": value, "pts": pts}

    rec("c1", metrics.get("c1_eps_yoy"), _tier_lt(metrics.get("c1_eps_yoy"), crit["c1"]))
    rec("c2", metrics.get("c2_eps_3q_avg_yoy"), _tier_lt(metrics.get("c2_eps_3q_avg_yoy"), crit["c2"]))
    rec("c3", metrics.get("c3_eps_pos_count"), _count_map(metrics.get("c3_eps_pos_count"), crit["c3"]))
    rec("c4", metrics.get("c4_rev_yoy"), _tier_lt(metrics.get("c4_rev_yoy"), crit["c4"]))
    rec("c5", metrics.get("c5_gross_margin_delta"), _tier_lt(metrics.get("c5_gross_margin_delta"), crit["c5"]))
    rec("c6", metrics.get("c6_net_margin_delta"), _tier_lt(metrics.get("c6_net_margin_delta"), crit["c6"]))
    rec("c7", metrics.get("c7_roe"), _tier_lt(metrics.get("c7_roe"), crit["c7"]))
    rec("c8", metrics.get("c8_debt_to_equity"), _debt_equity(metrics.get("c8_debt_to_equity"), crit["c9"]))
    rec("c9", metrics.get("current_pe"), _pe_median(metrics.get("current_pe"), metrics.get("pe_5y_median"), crit["c14"], res.notes))

    res.total_score = sum(c["pts"] for c in res.criteria.values())

    # Normalized display score (0-100). Divisor lives in config so it's tunable.
    norm = config.get("normalize", {"raw_max": 108, "target": 100})
    raw_max = norm.get("raw_max") or 108
    target = norm.get("target", 100)
    res.normalized_score = round(res.total_score / raw_max * target, 2)

    # UNRATED rules: too little history, or no operating data (banks/insurers
    # lack revenue & margins → the rubric's revenue/margin thresholds mislead).
    revenue_metrics = [metrics.get(k) for k in ("c4_rev_yoy", "c5_gross_margin_delta", "c6_net_margin_delta")]
    if not fully_scorable:
        res.rating = "UNRATED"
        res.notes.append("Insufficient quarterly history")
    elif all(v is None for v in revenue_metrics):
        res.rating = "UNRATED"
        res.notes.append("No usable fundamentals (e.g. bank/financial statement format)")
    else:
        # Rating bands apply to the NORMALIZED (0-100) score, not the raw total.
        bands = config["rating"]
        res.rating = "A" if res.normalized_score >= bands["A_min"] else ("B" if res.normalized_score >= bands["B_min"] else "C")

    return res
