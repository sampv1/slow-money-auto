"""The V11v6 DISPLAY contract — everything the two tabs render, computed once.

WHY THIS IS A SEPARATE MODULE, AND WHY IT ONLY READS.

V11v6 is a UI release. BA says so in three places and the engine sheets prove
it: the C1-C20 weights, the three-group mapping and the four gate constants in
`securities.py` are byte-identical to what V11v5 already ran, so not one score
moves. The risk in a release shaped like this is not that the arithmetic is
hard — it is that "while I am in here" turns a presentation change into a
scoring change nobody asked for.

So this module takes the ALREADY-SCORED output as input and returns display
structures. It imports constants from `securities.py` and never writes back.
It cannot move a score, because it is not on the path that computes one.

WHAT IT EXISTS TO PREVENT, concretely: sheet 04 (API-03/API-04) requires the
BACKEND to supply the group totals, the three subgroups, the gate reasons and
the coverage the UI prints — "frontend không tính lại nghiệp vụ". That rule is
not stylistic. V11v3 shipped the headline-score rule in two files that
disagreed, and V11v4 shipped the group sums the same way; both times the two
tabs printed different numbers for one symbol. A second implementation of the
tier rules is the bug. This module is the first and only one.

THE ONE THING HERE THAT IS NOT A RESTATEMENT is the narrative block (§6). BA
bans the empty dash and bans "Chưa cập nhật", and also bans inventing an
opinion from the total score. Those are only compatible one way: every sentence
must be a FACT already in the row, carried with the criterion, period and source
that produced it, and the absence of a fact must be said in words that name the
reason. So `narratives()` derives nothing it cannot cite — it selects among
candidates in BA's stated priority order and otherwise returns a reason code.
"""

from __future__ import annotations

from .securities import (
    ALWAYS_PROVISIONAL,
    CRITERION_POINTS,
    CYCLE_CRITERIA,
    GATE_MIN_FINAL_AVAILABLE,
    GATE_MIN_QUALITY,
    GATE_MIN_VALUATION,
    GATE_REQUIRED_CYCLE,
    QUALITY_CRITERIA,
    SECTOR_CYCLE_CRITERIA,
    TIER_LOCKED,
    VALUATION_CRITERIA,
)

# Stamped on every row so a screenshot can be traced to the spec that dictated
# it. DELIBERATELY NOT a model_version bump: `model_version` selects which
# scoring engine produced a number, and pinning the dashboard to a new one here
# would orphan every V11v5 row in the same table (SEC_ACTIVE_MODEL reads it).
UI_VERSION = "CTCK_UI_FINAL_20260909"

# Level bands for the three quality groups (sheet 04, UI-02).
#
# THESE MOVED IN V6 AND THE MOVE IS DELIBERATE: V11v5 sheet 52 specified
# 0.85 / 0.65 / 0.40, V6 specifies 0.80 / 0.65 / 0.50. Only the LABEL moves —
# the ratio it labels is the same earned_CT/available_CT it always was, and no
# score, gate or group total depends on which word is printed beside it.
#
# The wording changed with the numbers, and that half matters more. These are
# "Mức điểm ..." — score-LEVEL labels — because BA's objection was that "Tài
# sản an toàn" reads as an independent verdict on the company's risk when the
# denominator may be missing half its criteria. A level names where the ratio
# sits; it does not certify anything.
LEVEL_BANDS = ((0.80, "GOOD"), (0.65, "FAIR"), (0.50, "MID"))
LEVEL_NONE = "NO_DATA"          # available == 0 → "Chưa đủ dữ liệu", never "thấp"
LEVEL_LOW = "LOW"


def level_for(earned: float | None, available: float | None) -> str:
    """Band an official group ratio. available == 0 is ABSENCE, not a low score.

    The distinction is the same one normalization exists to keep: 0/8 is a
    measured worst case, N/A is nothing measured, and calling the second one
    "Mức điểm thấp" would put a verdict on a company we did not assess.
    """
    if not available:
        return LEVEL_NONE
    ratio = (earned or 0.0) / available
    for cut, name in LEVEL_BANDS:
        if ratio >= cut:
            return name
    return LEVEL_LOW


def _tier_of(criteria: dict, key: str) -> str | None:
    c = criteria.get(key)
    if c is None:
        return None
    earned = c.get("earned") if isinstance(c, dict) else c.points
    if earned is None:
        return None
    if isinstance(c, dict):
        return c.get("tier")
    return c.effective_tier(key)


def _pair(criteria: dict, keys) -> dict:
    """Both tiers over one set of criteria, in one pass.

    `final_*` counts LOCKED only; `combined_*` counts locked + provisional.
    An N/A criterion enters NEITHER numerator nor denominator on either side —
    sheet 03: "N/A không vào tử và mẫu của cả hai lớp".
    """
    fe = fa = ce = ca = 0.0
    for k in keys:
        c = criteria.get(k)
        if c is None:
            continue
        earned = c.get("earned") if isinstance(c, dict) else c.points
        if earned is None:
            continue
        pts = CRITERION_POINTS[k]
        ce += earned
        ca += pts
        if _tier_of(criteria, k) == TIER_LOCKED:
            fe += earned
            fa += pts
    return {
        "final_earned": round(fe, 2), "final_available": round(fa, 2),
        "combined_earned": round(ce, 2), "combined_available": round(ca, 2),
        "design_max": sum(CRITERION_POINTS[k] for k in keys),
        # Sheet 04, DT-03: a group whose provisional layer adds nothing must not
        # repeat itself as a second line. This is what the UI tests, so the
        # backend decides it — the UI comparing two floats is how the two tabs
        # would start disagreeing again.
        "has_provisional": round(ca, 2) > round(fa, 2),
    }


BLOCKS = (("quality", QUALITY_CRITERIA),
          ("cycle", CYCLE_CRITERIA),
          ("valuation", VALUATION_CRITERIA))

SUBGROUPS = (("asset", ["c3", "c12", "c13"]),
             ("operation", ["c1", "c2", "c4", "c5", "c6", "c7", "c8"]),
             ("capital", ["c9", "c10", "c11", "c14"]))


def block_totals(criteria: dict) -> dict:
    """The three group totals the detail tab prints in its group headers.

    NOT the same as `securities.assemble`'s `*_score` / `*_available_max`,
    which carry the COMBINED tier only — the detail tab needs both layers side
    by side (QA_A quality reads "CT 27/46" over "Gồm tạm tính 30/50*").
    """
    return {name: _pair(criteria, keys) for name, keys in BLOCKS}


def subgroups(criteria: dict) -> dict:
    """The three quality subgroups Tab 1 prints, each with its level label.

    Their official halves must sum to the quality block's official half —
    asserted in the fixture test, because the mapping partitions C1-C14 exactly
    once and a partition that stops adding up is a mapping bug, not a rounding
    one.
    """
    out = {}
    for name, keys in SUBGROUPS:
        d = _pair(criteria, keys)
        d["criteria"] = keys
        d["level"] = level_for(d["final_earned"], d["final_available"])
        # Which of this group's criteria are the provisional ones, so the cell
        # can name them ("C9: 3/4* · tạm tính") instead of leaving the reader to
        # diff two fractions.
        d["provisional_criteria"] = [
            k for k in keys
            if _tier_of(criteria, k) is not None
            and _tier_of(criteria, k) != TIER_LOCKED
        ]
        out[name] = d
    return out


# --- Publish gate, with the numbers that failed --------------------------------

GATE_CONDITIONS = (
    ("total", GATE_MIN_FINAL_AVAILABLE, ">="),
    ("quality", GATE_MIN_QUALITY, ">="),
    ("sector_cycle", GATE_REQUIRED_CYCLE, "=="),
    ("valuation", GATE_MIN_VALUATION, ">="),
)


def gate_detail(criteria: dict) -> dict:
    """`pass` plus every condition with its ACTUAL and REQUIRED availability.

    Sheet 04, API-05 asks for `failed_conditions:[{id, actual_available,
    required_available}]` so the tooltip can say which one failed rather than
    "not published". Every condition tests AVAILABILITY — how much of the rubric
    could be scored — never earned points; a broker that scores badly on a fully
    measured rubric publishes a bad score, which is the correct outcome and the
    thing sheet 07 V6-07 tests ("kiểm tra available không earned").
    """
    def avail(keys):
        return round(sum(CRITERION_POINTS[k] for k in keys
                         if _tier_of(criteria, k) == TIER_LOCKED), 2)

    actual = {
        "total": avail(list(CRITERION_POINTS)),
        "quality": avail(QUALITY_CRITERIA),
        "sector_cycle": avail(SECTOR_CYCLE_CRITERIA),
        "valuation": avail(VALUATION_CRITERIA),
    }
    conditions = []
    for cid, required, op in GATE_CONDITIONS:
        got = actual[cid]
        ok = (got == required) if op == "==" else (got >= required)
        conditions.append({"id": cid, "actual_available": got,
                           "required_available": required, "op": op, "pass": ok})
    failed = [c for c in conditions if not c["pass"]]
    return {"pass": not failed, "conditions": conditions,
            "failed_conditions": failed}


# --- §6 narratives: a fact with a citation, or a named absence -----------------
#
# Every branch below returns a reason CODE, never a Vietnamese sentence. The
# same lesson as `fa/real_estate.py`, which stored the scorer's reasoning as
# English prose and shipped "cash burn scores 0 regardless of debt" onto the
# Vietnamese page: anything a Python script writes that reaches the DOM has to
# be a key the renderer translates.

# Balance-sheet composition decides the business model, because that is the
# "cơ cấu hoạt động" BA names — a filed, auditable structure. Margin growth
# alone is explicitly forbidden as the basis ("không lấy tăng trưởng margin đơn
# lẻ để gán mô hình"): one quarter of lending growth says nothing about what a
# firm IS.
MODEL_MARGIN_LED = "MODEL_BROKERAGE_MARGIN"
MODEL_PROP_LED = "MODEL_PROPRIETARY"
MODEL_BALANCED = "MODEL_BALANCED"
MODEL_UNKNOWN = "MODEL_INSUFFICIENT"
MODEL_LED_SHARE = 0.50


def business_model(ctx: dict) -> dict:
    """Classify from earning-asset composition, or say we cannot.

    All three figures come from the SAME balance sheet — the close quarter of
    the quality period — rather than mixing a period average against a spot
    balance. A composition is a ratio of parts to a whole, and the whole has to
    be the same whole; averaging one side and not the other would make the
    shares fail to sum on a broker whose book moved during the quarter.
    """
    ea = ctx.get("bs_earning_assets")
    margin = ctx.get("bs_margin")
    prop = ctx.get("bs_prop_assets")
    if not ea or margin is None or prop is None:
        return {"code": MODEL_UNKNOWN, "evidence": None}
    m_share, p_share = margin / ea, prop / ea
    code = (MODEL_MARGIN_LED if m_share >= MODEL_LED_SHARE
            else MODEL_PROP_LED if p_share >= MODEL_LED_SHARE
            else MODEL_BALANCED)
    return {"code": code, "evidence": {
        "criterion_id": None, "source": "BS_LOANS / BS_FVTPL+AFS / earning assets",
        "period": ctx.get("quality_period"),
        "margin_share": round(m_share, 4), "prop_share": round(p_share, 4)}}


DRIVER_NONE_WITH_DATA = "DRIVER_NONE_QUALIFIED"
DRIVER_NO_DATA = "DRIVER_INSUFFICIENT"
MAX_DRIVERS = 2


def drivers(ctx: dict) -> dict:
    """Up to two quarter drivers, in BA's stated priority order.

    Priority is not a ranking of importance — it is a ranking of EVIDENCE. Core
    profit growth on a valid comparison base is a measured earnings fact;
    margin-book growth is a balance-sheet fact; market-share change is a
    third-party fact that also has to match on exchange scope. The order runs
    from the one we can most defend to the one we can least.

    "Cannot be computed" is never reported as "did not grow" — sheet 03 says so
    twice, and it is the same absence-vs-zero rule the whole rubric runs on. A
    broker with no year-ago base has an unknown growth rate, not a flat one.
    """
    found, missing = [], False

    core_yoy = ctx.get("core_profit_growth_yoy")
    if core_yoy is None:
        missing = True
    elif core_yoy > 0:
        found.append({"code": "DRIVER_CORE_PROFIT", "value": round(core_yoy, 4),
                      "criterion_id": "c2", "period": ctx.get("quality_period"),
                      "source": "core_npat_ttm YoY"})

    mg_yoy = ctx.get("margin_loan_growth_yoy_pct")
    if mg_yoy is None:
        missing = True
    elif mg_yoy > 0:
        found.append({"code": "DRIVER_MARGIN_BOOK", "value": round(mg_yoy, 4),
                      "criterion_id": "c7", "period": ctx.get("quality_period"),
                      "source": "BS_LOANS YoY"})

    # Market share only counts as a driver when the SAME exchange scope is being
    # compared across the two quarters — BA: "thị phần YoY tăng cùng phạm vi
    # sàn". A HOSE share against a HNX share is not a change in anything.
    share_yoy = ctx.get("market_share_yoy_pp")
    same_scope = ctx.get("market_share_scope_matches")
    if share_yoy is not None and same_scope and share_yoy > 0:
        found.append({"code": "DRIVER_MARKET_SHARE", "value": round(share_yoy, 4),
                      "criterion_id": "c5", "period": ctx.get("market_share_period"),
                      "source": ctx.get("market_share_exchange")})

    if found:
        return {"items": found[:MAX_DRIVERS]}
    return {"items": [], "code": DRIVER_NO_DATA if missing else DRIVER_NONE_WITH_DATA}


RISK_NO_DATA = "RISK_INSUFFICIENT"
RISK_NONE_CONCLUSIVE = "RISK_NOT_CONCLUSIVE"
MAX_RISKS = 2

# Severity per criterion for the risk column's ordering. Higher sorts first;
# ties break on criterion number ASCENDING (sheet 03). These rank how load-
# bearing a criterion is for solvency, NOT how bad a given broker is — the
# score already says that.
RISK_SEVERITY = {
    "c9": 5,    # capital adequacy proxy
    "c10": 5,   # leverage
    "c3": 4,    # earnings quality
    "c12": 4,   # proprietary-book risk
    "c13": 4,   # asset quality / provisions
    "c11": 3,   # cost of funding
    "c1": 3, "c2": 3, "c6": 2, "c7": 2, "c8": 2, "c14": 2, "c4": 1, "c5": 1,
}


def risks(criteria: dict) -> dict:
    """At most two risk flags, taken from what the scorer already recorded.

    THIS READS BACKWARDS FROM THE SCORE AND ADDS NOTHING. A criterion that
    scored zero on real data is a risk finding the engine already made; the
    column reports it with the reason code the engine attached. What it must
    never do is reason forward — BA singles out "C9 = 0 ⇒ mất an toàn vốn",
    because C9 is a proxy capped at 3/4 and a zero on it means the proxy ranked
    the broker last among peers, not that its capital is impaired.
    """
    flagged, any_input = [], False
    for key in QUALITY_CRITERIA + VALUATION_CRITERIA:
        c = criteria.get(key)
        if c is None:
            continue
        earned = c.get("earned") if isinstance(c, dict) else c.points
        if earned is None:
            continue
        any_input = True
        if earned > 0:
            continue
        code = (c.get("reason_code") if isinstance(c, dict) else c.code) or "ZERO_NO_REASON"
        flagged.append({"criterion_id": key, "code": code,
                        "severity": RISK_SEVERITY.get(key, 1),
                        "earned": earned,
                        "available_max": CRITERION_POINTS[key],
                        # A risk read off a PROVISIONAL criterion has to say so.
                        # C9, C18 and C20 are the ones this fires on, and BA's
                        # objection is precisely that a proxy's bottom-quintile
                        # ranking must not read as a settled finding — the `*`
                        # is the same mark their scores carry.
                        "provisional": _tier_of(criteria, key) != TIER_LOCKED})
    if not any_input:
        return {"items": [], "code": RISK_NO_DATA}
    if not flagged:
        # Data present and nothing scored zero. That is NOT "no risk" — BA bans
        # the phrase outright — it is the absence of a conclusion this column is
        # entitled to draw from the criteria it can see.
        return {"items": [], "code": RISK_NONE_CONCLUSIVE}
    flagged.sort(key=lambda f: (-f["severity"], int(f["criterion_id"][1:])))
    return {"items": flagged[:MAX_RISKS]}


def narratives(ctx: dict, criteria: dict) -> dict:
    return {"business_model": business_model(ctx),
            "drivers": drivers(ctx),
            "risks": risks(criteria)}


# --- the whole contract -------------------------------------------------------

def ui_contract(totals: dict, ctx: dict | None = None) -> dict:
    """Everything the two tabs render, from one scored row.

    `totals` is `securities.assemble(...)`'s return value. Both tabs read this
    object and neither recomputes any of it (sheet 04, API-01/03/04).
    """
    criteria = totals["criteria"]
    ctx = ctx or {}
    blocks = block_totals(criteria)
    gate = gate_detail(criteria)
    combined_available = sum(b["combined_available"] for b in blocks.values())
    final_available = sum(b["final_available"] for b in blocks.values())
    final_earned = sum(b["final_earned"] for b in blocks.values())
    design_max = sum(CRITERION_POINTS.values())
    score = (final_earned / final_available * 100) if final_available else None
    return {
        "ui_version": UI_VERSION,
        "blocks": blocks,
        "subgroups": subgroups(criteria),
        "publish_gate": gate,
        # Sheet 04, API-06: the status column's percentage is the COMBINED
        # layer over the design maximum — how much of the rubric we could
        # measure at all, provisional included. It is deliberately not the
        # official coverage, and deliberately not a count of populated cells.
        "coverage_display": round(combined_available / design_max, 4),
        "coverage_final": round(final_available / design_max, 4),
        "final_earned": round(final_earned, 2),
        "final_available": round(final_available, 2),
        # NULL WHEN THE GATE FAILS, at the source. The UI prints "—" because
        # there is no number here, not because it decided to hide one.
        "final_composite_score": (round(score, 2)
                                  if (gate["pass"] and score is not None) else None),
        "narratives": narratives(ctx, criteria),
        "provisional_criteria": sorted(
            (k for k in CRITERION_POINTS
             if _tier_of(criteria, k) is not None
             and _tier_of(criteria, k) != TIER_LOCKED),
            key=lambda k: int(k[1:])),
        "always_provisional": sorted(ALWAYS_PROVISIONAL, key=lambda k: int(k[1:])),
    }
