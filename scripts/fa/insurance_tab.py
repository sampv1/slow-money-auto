"""Assemble the insurance tab score: Common/50 + Internal/38 + Valuation/12.

BA `BA_CHOT_TRIEN_KHAI_TAB_BAO_HIEM...2026-10-02.md` §4, §7, §8.

THIS MODULE COMPUTES NO RUBRIC. It takes block scores that the per-type
engines already produced and does only the arithmetic BA locked once for all
four types. Keeping it separate is the point of the round that created it: the
non-life bands were frozen in `fa/nonlife_bands.py` for weeks while the tab had
no score, because nothing joined them to the common layer. The join is a named,
tested step now rather than something each type re-invents.

THE SPLIT IS A REGROUPING, NOT A RESCORE. The non-life engine reports a "deep
score /50" that is P1..P5 summed. BA's architecture puts P1-P4 in Internal/38
and P5 in Valuation/12 — the same five numbers, partitioned differently, and
`Total` is unchanged by it. Verified on all 36 live symbol-quarters: zero
mismatches against the engine's own `deep_score_50` and `fa_raw_100`.

WHAT ABSENCE MEANS HERE, because three different absences look alike:

    BLOCKED   -- a required input could not be obtained; score is NULL
    PENDING   -- the block exists for this type but has not been built yet
    ELIGIBLE and ZERO -- a real, measured worst case; 0 is a LEGAL score

BA §7.1 forbids collapsing them, and §15.7 forbids banning 0. So a missing
block never becomes 0 and a 0 never becomes "missing".
"""

from __future__ import annotations

from dataclasses import dataclass, field

COMMON_MAX, INTERNAL_MAX, VALUATION_MAX = 50.0, 38.0, 12.0
FA_MAX = COMMON_MAX + INTERNAL_MAX          # 88
TOTAL_MAX = FA_MAX + VALUATION_MAX          # 100

#: Which criteria of each type's rubric form which block. The non-life split is
#: BA §6 Bước 6: Internal = P1+P2+P3+P4, Valuation = P5.
INTERNAL_CRITERIA = {
    "NON_LIFE": ("P1", "P2", "P3", "P4"),
    "REINSURANCE": ("R1", "R2", "R3", "R4"),
    "HOLDING_MIXED": ("B1", "B2", "B3", "B4"),      # PVI uses P1..P4 of its own engine
    "LIFE": ("LIFE-1", "LIFE-2", "LIFE-3", "LIFE-4"),
}
VALUATION_CRITERIA = {
    "NON_LIFE": ("P5",),
    "REINSURANCE": ("R5",),
    "HOLDING_MIXED": (),        # not yet locked by BA
    "LIFE": (),                 # P/EV, future
}

STATUS_COMPLETE = "SCORING_COMPLETE"
STATUS_PARTIAL = "PARTIAL_NOT_RATED"
STATUS_BLOCKED = "BLOCKED"
STATUS_PENDING = "PENDING"

CHANGE_CALCULATED = "CALCULATED"
CHANGE_ZERO_BASE = "ZERO_BASE"
CHANGE_NO_PREV = "NO_COMPARABLE_PREVIOUS_FA"
CHANGE_CURRENT_INCOMPLETE = "CURRENT_FA_INCOMPLETE"
CHANGE_NA = "NOT_APPLICABLE"

#: Which figure ΔFA differences. `TOTAL_BASIS` is what the interface shows
#: (§2.10); `FA_BASIS` survives only to keep migration 077's audit column
#: populated, and must never reach the frontend.
TOTAL_BASIS = "TOTAL_100"
FA_BASIS = "FA_88"


@dataclass
class TabScore:
    symbol: str
    period: str
    insurance_type_code: str
    common_score: float | None = None
    internal_change_score: float | None = None
    valuation_score: float | None = None
    fa_score: float | None = None
    total_score: float | None = None
    criteria: dict = field(default_factory=dict)
    score_status: str = STATUS_PARTIAL
    blocked_reason: str | None = None
    blocked_metrics: str | None = None


def assemble(symbol: str, period: str, type_code: str,
             common: float | None, criteria: dict[str, dict],
             pending_blocks: tuple[str, ...] = ()) -> TabScore:
    """One symbol-quarter.

    `criteria` maps criterion code -> {"value", "band", "score"}; a criterion
    whose `score` is None is UNSCORED and blocks its block. `pending_blocks`
    names blocks this TYPE has not had built yet (e.g. Holding valuation), so
    "we have not built it" is reported differently from "this company's data
    failed".
    """
    s = TabScore(symbol, period, type_code, criteria=criteria)
    missing: list[str] = []

    def block(codes: tuple[str, ...], name: str) -> float | None:
        if name in pending_blocks:
            missing.append(f"{name}:NOT_IMPLEMENTED")
            return None
        if not codes:
            missing.append(f"{name}:NO_CRITERIA_DEFINED")
            return None
        absent = [c for c in codes
                  if c not in criteria or criteria[c].get("score") is None]
        if absent:
            missing.append(f"{name}:{'+'.join(absent)}")
            return None
        # Sum UNROUNDED; rounding happens at display only.
        return float(sum(criteria[c]["score"] for c in codes))

    s.internal_change_score = block(INTERNAL_CRITERIA.get(type_code, ()), "internal")
    s.valuation_score = block(VALUATION_CRITERIA.get(type_code, ()), "valuation")
    s.common_score = None if common is None else float(common)
    if s.common_score is None:
        missing.append("common:NOT_SCORED")

    if s.common_score is not None and s.internal_change_score is not None:
        s.fa_score = s.common_score + s.internal_change_score
    if s.fa_score is not None and s.valuation_score is not None:
        s.total_score = s.fa_score + s.valuation_score

    if s.total_score is not None:
        s.score_status = STATUS_COMPLETE
    else:
        # A block that was never built is PENDING; data that failed is BLOCKED.
        s.score_status = (STATUS_PENDING
                          if any("NOT_IMPLEMENTED" in m or "NO_CRITERIA_DEFINED" in m
                                 for m in missing)
                          else STATUS_PARTIAL)
        s.blocked_reason = "; ".join(missing)
        s.blocked_metrics = ",".join(
            sorted({c for m in missing for c in m.split(":")[1].split("+")
                    if c not in ("NOT_SCORED", "NOT_IMPLEMENTED", "NO_CRITERIA_DEFINED")}))
    return s


def fa_change(current: TabScore, previous: TabScore | None,
              basis: str = TOTAL_BASIS) -> tuple[float | None, str]:
    """ΔFA between two quarters, on the basis BA's current spec displays.

    THE BASIS MOVED, AND THE TWO ANSWERS GENUINELY DIFFER. BA
    `YEU_CAU_IT_CHOT_R4_V2...2026-10-04.md` §2.2 collapses the displayed score
    to one figure, `Tổng điểm FA /100`, and §2.10 requires ΔFA to be the change
    in THAT ("Không tính Δ trên subtotal /88"). FA/88 needs Common and Internal;
    Total/100 additionally needs Valuation — so a symbol with no valuation block
    has a /88 delta and no /100 delta. Holding is that case right now. Returning
    the /88 number because it happens to exist would answer a question nobody
    asked.

    `basis` is kept so the /88 figure stays computable for the audit column
    migration 077 preserves; the default is what the interface shows.

    FOUR OUTCOMES, AND THEY ARE NOT INTERCHANGEABLE: a percentage, a zero base,
    no comparable previous quarter, and an incomplete current one. Collapsing
    any pair of them is what makes a reader think a company got worse when the
    truth is that we could not compare.
    """
    pick = (lambda s: s.total_score) if basis == TOTAL_BASIS \
        else (lambda s: s.fa_score)
    now = pick(current)
    if now is None:
        return None, CHANGE_CURRENT_INCOMPLETE
    if previous is None:
        return None, CHANGE_NO_PREV
    before = pick(previous)
    if before is None:
        return None, CHANGE_NO_PREV
    if before == 0:
        # Never divide by zero and never print an infinity.
        return None, CHANGE_ZERO_BASE
    pct = (now - before) / abs(before) * 100.0
    return pct, CHANGE_CALCULATED
