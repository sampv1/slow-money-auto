"""Quarterly business results for the insurance overview — BA Phần II.

BA `FINAL_BA_FIX_HOLDING_INTEGRATION_ADD_QUARTERLY_KQKD_2026-10-05.md` §7, §13.

FOUR FIGURES, NO SCORE. Revenue for the quarter, its YoY, parent net profit for
the quarter, its YoY. Nothing here feeds a rubric: §0 is explicit that this
round does not reopen scoring.

THE SOURCE IS ALREADY SINGLE-QUARTER, AND THAT WAS VERIFIED RATHER THAN
ASSUMED. §7.1 requires a single-quarter figure and gives the YTD subtraction to
use if the provider reports cumulatively. Measured over the 13 insurers: of 97
symbol-years holding four quarters and an annual, 89 reconcile within 0.5% and
the largest difference is 3.3%. A cumulative series would sum to roughly 2.5x
its annual, so these are annual-audit restatements — a different and already
known thing — and the basis is DIRECT. `revenue_basis` records that on the row
so a future provider change is visible instead of silent.

THE SCOPE MATCHES WHAT THE RUBRIC ALREADY USES (§7.3). Net profit is
`IS_PROFIT_AFTER_TAX_FOR_SHAREHOLDERS_OF_PARENT_COMPANY` — the parent scope C4
takes its TTM numerator from and the one behind EPS, which is the field §7.3
names as the preference. Revenue is the same net insurance revenue C3 scores,
so the new "DT YoY" column and C3's own raw figure can never disagree; using a
broader revenue line would put two different "revenue growth" numbers on one
row.

A YoY AGAINST A NON-POSITIVE BASE IS NOT A PERCENTAGE (§7.4). Dividing by a
loss produces a number that is arithmetically true and reads as the opposite of
what happened, so those cases get a STATE instead. This is the same ruling the
common layer's C1 already runs under.
"""

from __future__ import annotations

REVENUE_FIELD = "IS_TOTAL_NET_REVENUE_FROM_INSURANCE_BUSINESS"
PROFIT_FIELD = "IS_PROFIT_AFTER_TAX_FOR_SHAREHOLDERS_OF_PARENT_COMPANY"

MAPPING_VERSION = "INS_KQKD_QUY_DIRECT_PARENT_V1"
#: §7.1 — the provider reports each quarter standalone, verified against the
#: annual. `DERIVED_FROM_YTD` exists for the day that stops being true.
BASIS_DIRECT = "DIRECT_QUARTER"
BASIS_DERIVED = "DERIVED_FROM_YTD"

CALCULATED = "CALCULATED"
LOSS_TO_PROFIT = "LOSS_TO_PROFIT"
PROFIT_TO_LOSS = "PROFIT_TO_LOSS"
NOT_MEANINGFUL = "NOT_MEANINGFUL"
NO_PRIOR = "NO_PRIOR_PERIOD"
NO_CURRENT = "NO_CURRENT_PERIOD"


def shift(period: str, back: int) -> str:
    y, q = int(period[:4]), int(period[-1])
    t = y * 4 + (q - 1) - back
    return f"{t // 4}-Q{t % 4 + 1}"


def yoy(current: float | None, base: float | None) -> tuple[float | None, str]:
    """Year-on-year change, or the STATE where a percentage would mislead.

    §7.4: "Nếu kỳ trước <= 0, không tạo % tăng trưởng vô nghĩa." A loss base
    inverts the sign of an ordinary growth ratio — a company going from −100 to
    +50 computes as −150%, which reads as a collapse. So the sign cases return a
    state and no number, and only a positive base reaches the arithmetic.

    Revenue cannot be negative in practice, but the same function serves both
    columns because the rule is about the BASE, not about which line it came
    from, and a second near-identical function is how the two drift apart.
    """
    if current is None:
        return None, NO_CURRENT
    if base is None:
        return None, NO_PRIOR
    if base > 0:
        if current < 0:
            return None, PROFIT_TO_LOSS
        return (current / base - 1.0) * 100.0, CALCULATED
    if base < 0:
        # A narrowing or widening loss, or a turnaround. Only the turnaround is
        # unambiguous enough to name; the rest is "not meaningful".
        return (None, LOSS_TO_PROFIT) if current > 0 else (None, NOT_MEANINGFUL)
    # base == 0 — a ratio against it is undefined, never an infinity.
    return None, NOT_MEANINGFUL


def quarter_result(income: dict[str, dict], symbol: str, period: str) -> dict:
    """One symbol-quarter's four figures plus the provenance §13 asks for."""
    base_period = shift(period, 4)
    cur = income.get((symbol, period), {})
    prev = income.get((symbol, base_period), {})

    rev, rev_prev = cur.get(REVENUE_FIELD), prev.get(REVENUE_FIELD)
    npat, npat_prev = cur.get(PROFIT_FIELD), prev.get(PROFIT_FIELD)

    rev_yoy, rev_status = yoy(rev, rev_prev)
    npat_yoy, npat_status = yoy(npat, npat_prev)

    return {
        "symbol": symbol, "period": period,
        "quarter_revenue": rev,
        "quarter_revenue_prev": rev_prev,
        "quarter_revenue_yoy": rev_yoy,
        "quarter_revenue_status": rev_status,
        "quarter_net_profit": npat,
        "quarter_net_profit_prev": npat_prev,
        "quarter_net_profit_yoy": npat_yoy,
        "quarter_net_profit_status": npat_status,
        "kqkd_source_period": base_period,
        "revenue_basis": BASIS_DIRECT,
        "profit_scope": "PARENT_SHAREHOLDERS",
        "kqkd_mapping_version": MAPPING_VERSION,
    }
