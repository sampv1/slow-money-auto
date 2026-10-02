"""Data-mapping guard for the Holding deep layer (BA FINAL SPEC 2026-10-01 §18).

WHY THIS IS A SEPARATE MODULE: `holding.py` is FROZEN. The guard adds no
formula and changes no score; it decides whether a score may be PUBLISHED at
all. Keeping it out of the frozen file means an auditor can see at a glance
that the arithmetic was not touched.

WHAT IT PROTECTS AGAINST, concretely. `BS_INSURANCE_RESERVES` is a NORMALIZED
provider field, and we already know it can change meaning without warning: on
BVH it moved from "a residual left after most of the reserve was filed under
long-term liabilities" to the real line between 2021-Q4 and 2022-Q1, a
+45,729% step. Nothing in the pipeline noticed at the time -- the number was
present, positive and plausible-looking, so every gate stayed green and the
metric would have scored happily off a series with a cliff in it. The guard
exists so the NEXT such break stops the score instead of colouring it.

THE ANSWER TO A BREAK IS ABSENCE, NEVER A ZERO. `score = 0` asserts "measured,
worst case"; a mapping break is "not measurable". BA states the four hard rules
as NO_ZERO_FILL / NO_PROXY / NO_SILENT_FALLBACK / NO_MANUAL_SCORE_OVERRIDE, and
they are the same rule the RS Line and the CTCK rubric already follow.

SCOPE IS BY DEPENDENCY, NOT BY TICKER. Only the metrics that READ the reserve
field are blocked (B3, B4, P4). Blocking P1 -- an underwriting margin that
never touches the balance sheet -- because a balance-sheet field went null
would withhold a measurement that is perfectly good. This mirrors the CTCK
funding-cost rule, where a missing input propagates to its nine dependents and
no further.

MEASURED BEFORE SHIPPING, over all 68 live symbol-quarters: exactly ONE
|QoQ| > 50% event exists (BVH 2021-Q4 -> 2022-Q1, +45,728.85%) and it sits
OUTSIDE the valid window, so the guard blocks nothing that is scored today and
would have caught the one real break. A guard that fires on healthy data gets
switched off, so this was checked rather than assumed.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

from . import holding as H
from . import insurance_deep as D

#: BA §18.2. A move larger than this in either direction is a REVIEW GATE, not
#: a verdict on the raw data -- a real economic jump clears it (§18.2), a
#: mapping break stays blocked.
QOQ_ALERT_PCT = 50.0

STATUS_OK = "OK"
STATUS_PENDING = "NOT_SCORED_PENDING_REVIEW"

#: Metrics whose formula reads `BS_INSURANCE_RESERVES`. Everything else is
#: unaffected by a reserve-field break and must keep scoring.
RESERVE_DEPENDENT = ("B3", "B4", "P4")

REASON_MISSING = "RESERVE_MISSING"
REASON_NON_POSITIVE = "RESERVE_NON_POSITIVE"
REASON_QOQ_JUMP = "RESERVE_QOQ_JUMP"
REASON_LINEAGE = "MAPPING_LINEAGE_CHANGED"
#: Declared, NOT an alert: the previous quarter sits before `valid_from`, so a
#: QoQ comparison would straddle the very break the cutoff exists to exclude.
#: Recorded explicitly so "no alert" can be told apart from "never checked".
REASON_QOQ_NOT_COMPARABLE = "QOQ_NOT_COMPARABLE_ACROSS_CUTOFF"

#: BA §18.2: a review may clear an alert it has confirmed as a real economic
#: move. Entries are `(symbol, period, reason)` and must be added by a human
#: with the review recorded; an empty set means nothing has been cleared.
#: This is the ONLY sanctioned way to resume scoring after an alert, and it
#: never edits a score -- it re-enables the normal computation.
ALERT_CLEARED: set[tuple[str, str, str]] = set()


def mapping_fingerprint() -> str:
    """A stable hash of WHICH fields the deep layer reads and under which
    mapping version. BA §18.3 asks for an alert when the field code, the source
    mapping or the lineage changes materially; a fingerprint is how that
    becomes checkable instead of aspirational -- it is stored on every row, so
    a later run compares against what actually produced the stored history.
    """
    parts = [H.HOLDING_MAPPING_VERSION, D.MAPPING_VERSION,
             "|".join(sorted(H.INVESTABLE_WHITELIST)),
             "|".join(f"{k}->{v}" for k, v in sorted(H.INVESTABLE_BLACKLIST.items())),
             D.INSURANCE_RESERVES, D.EQUITY]
    return hashlib.sha256("~".join(parts).encode()).hexdigest()[:16]


@dataclass
class Guard:
    """One symbol-quarter's verdict on the reserve field."""
    alert: bool = False
    status: str = STATUS_OK
    reason: str | None = None
    qoq_pct: float | None = None
    reserve: float | None = None
    prev_reserve: float | None = None
    prev_period: str | None = None
    fingerprint: str = ""
    notes: list[str] = field(default_factory=list)

    @property
    def blocks(self) -> bool:
        return self.status == STATUS_PENDING

    def applies_to(self, metric_code: str) -> bool:
        """A block reaches only the metrics that read the reserve field."""
        return self.blocks and metric_code in RESERVE_DEPENDENT


def reserve_guard(reserves: dict[str, float | None], period: str, symbol: str,
                  valid_from: str | None = None,
                  stored_fingerprint: str | None = None) -> Guard:
    """Evaluate §18.1-§18.3 for one symbol-quarter.

    `reserves` maps period -> raw `BS_INSURANCE_RESERVES` (None where absent).
    `stored_fingerprint` is what the previously persisted rows were computed
    with; None on a first run, which is not a lineage change.
    """
    fp = mapping_fingerprint()
    g = Guard(fingerprint=fp, reserve=reserves.get(period))

    # §18.3 -- lineage first: if WHAT we read changed, nothing downstream is
    # comparable with the stored history, whatever the values look like.
    if stored_fingerprint is not None and stored_fingerprint != fp:
        g.alert, g.status, g.reason = True, STATUS_PENDING, REASON_LINEAGE
        g.notes.append(f"fingerprint {stored_fingerprint} -> {fp}")
        return g

    # §18.1 -- hard failure.
    if g.reserve is None:
        g.alert, g.status, g.reason = True, STATUS_PENDING, REASON_MISSING
        return g
    if g.reserve <= 0:
        g.alert, g.status, g.reason = True, STATUS_PENDING, REASON_NON_POSITIVE
        return g

    # §18.2 -- structural jump, measured only where a comparison is meaningful.
    prev = D.shift(period, 1)
    g.prev_period, g.prev_reserve = prev, reserves.get(prev)
    if g.prev_reserve is None or g.prev_reserve <= 0:
        g.notes.append(f"{REASON_QOQ_NOT_COMPARABLE}: no usable {prev}")
        return g
    if valid_from and prev < valid_from:
        g.notes.append(f"{REASON_QOQ_NOT_COMPARABLE}: {prev} < valid_from {valid_from}")
        return g

    g.qoq_pct = (g.reserve / g.prev_reserve - 1.0) * 100.0
    if abs(g.qoq_pct) > QOQ_ALERT_PCT:
        if (symbol, period, REASON_QOQ_JUMP) in ALERT_CLEARED:
            g.notes.append("ALERT_CLEAR=TRUE (reviewed: real economic move)")
            return g
        g.alert, g.status, g.reason = True, STATUS_PENDING, REASON_QOQ_JUMP
    return g
