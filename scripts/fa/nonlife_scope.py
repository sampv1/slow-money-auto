#!/usr/bin/env python3
"""
nonlife_scope.py — report-scope selection per symbol-quarter (BA §2 of
PHAN_HOI_CHOT_CUOI_GUI_IT_PHI_NHAN_THO, 27/09/2026).

WHAT THIS REPLACED, AND WHY IT MATTERS
--------------------------------------
The previous rule asked "does a consolidated report EXIST for this company?"
That needed a manual, company-level disclosure nobody had, so six of nine
insurers sat at PENDING and only three could be scored. §2 asks a question the
data can answer instead:

    DID THE REPORTING BASIS CHANGE?

A comparison, not an existence proof. §4.7 of the prior round is explicit that
the six may not stay blocked for want of the old confirmation.

THE EVIDENCE ASYMMETRY, WHICH IS THE WHOLE DESIGN
-------------------------------------------------
`BS_MINORITY_INTEREST > 0` POSITIVELY identifies a consolidated record: the
balance sheet is consolidating a partly-owned subsidiary. Checked against the
filing header on every symbol-period where both exist — 36 of 36 agree.

A ZERO minority interest proves NOTHING, because a consolidated report of a
wholly-owned parent also reads zero. BA §2.3 is emphatic about this, and it is
the overstatement they corrected me on: I had recorded the six standalone filers
as "verified standalone for 24 quarters" when only the four quarters the header
labels can carry that claim. So:

  * zero minority interest NEVER produces PARENT_VERIFIED;
  * periods outside the labelled window are SCOPE_AS_PROVIDED_CONTINUOUS, which
    states an operational continuity rather than a verification.

The header reaches exactly four quarters — measured, not assumed: KBS returns
four distinct quarters whatever `page_size` is requested.
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

#: §2.4 — the six statuses, which record HOW STRONG THE EVIDENCE IS. A separate
#: axis from what the provider recorded and from what we selected.
CONSOLIDATED_VERIFIED = "CONSOLIDATED_VERIFIED"
PARENT_VERIFIED = "PARENT_VERIFIED"
SCOPE_AS_PROVIDED_BASELINE = "SCOPE_AS_PROVIDED_BASELINE"
SCOPE_AS_PROVIDED_CONTINUOUS = "SCOPE_AS_PROVIDED_CONTINUOUS"
WAITING_CONSOLIDATED = "WAITING_CONSOLIDATED"
SCOPE_CHANGE_VERIFIED = "SCOPE_CHANGE_VERIFIED"

#: What the provider recorded (§2.4 / §4.1 of the prior round).
PROV_CONSOLIDATED = "CONSOLIDATED"
PROV_STANDALONE = "STANDALONE"
PROV_CONSOLIDATED_BY_MI = "CONSOLIDATED_BY_MINORITY_INTEREST"
PROV_UNDETERMINED = "UNDETERMINED"

#: What the system selected.
SEL_CONSOLIDATED = "CONSOLIDATED"
SEL_STANDALONE = "STANDALONE"
SEL_WAITING = "NONE_WAITING_CONSOLIDATED"

USED = "USED"
WAITING_FOR_CONSOLIDATED = "WAITING_FOR_CONSOLIDATED"

#: Statuses whose selected basis is consolidated — used to decide §2.1 item 4,
#: "current period is standalone but the last completed one was consolidated".
CONSOLIDATED_STATUSES = frozenset({CONSOLIDATED_VERIFIED})

SCOPE_ENGINE_VERSION = "NONLIFE_SCOPE_V2_BA_20260927"


def quarter_start(period: str) -> dt.date:
    """First calendar day of a 'YYYY-Qn' quarter — §2.6 routes a control event on
    whether it took effect BEFORE the quarter began."""
    y, q = int(period[:4]), int(period[-1])
    return dt.date(y, {1: 1, 2: 4, 3: 7, 4: 10}[q], 1)


def quarter_end(period: str) -> dt.date:
    y, q = int(period[:4]), int(period[-1])
    m, d = {1: (3, 31), 2: (6, 30), 3: (9, 30), 4: (12, 31)}[q]
    return dt.date(y, m, d)


@dataclass
class ControlEvent:
    """A verified loss-of-control event (§2.6). Only a COMPLETED transaction
    counts — BA rules out a plan or a resolution explicitly, so an incomplete
    one can never license a basis change."""
    effective_date: dt.date
    transaction_completed: bool
    has_remaining_subsidiaries: bool | None
    evidence_type: str
    evidence_source: str


@dataclass
class ScopeInput:
    symbol: str
    period: str
    #: 'HN' / 'ĐL' from the filing header's `United`, or None outside the window.
    header_scope: str | None
    #: BS_MINORITY_INTEREST, in đồng. None when no balance sheet was served.
    minority_interest: float | None
    #: Resolved status of the most recent COMPLETED prior period, or None when
    #: this is the first period of the series (§2.5).
    prior_status: str | None = None
    prior_period: str | None = None
    #: The basis actually carried by that prior period, so a continuous series
    #: carries its basis forward rather than re-deriving it.
    prior_selected: str | None = None
    control_event: ControlEvent | None = None


def _event_permits_switch(ev: ControlEvent | None, period: str) -> tuple[bool, str]:
    """§2.6's table, as a function. Returns (permitted, reason)."""
    if ev is None:
        return False, "không có sự kiện mất quyền kiểm soát đã xác minh"
    if not ev.transaction_completed:
        return False, "giao dịch chưa hoàn tất — chỉ kế hoạch/nghị quyết (§2.6)"
    if ev.has_remaining_subsidiaries is not False:
        # NULL is treated as "still consolidating", which is the safe reading:
        # §2.6's last row keeps a company consolidated when it divested one
        # subsidiary but retains others, and an unestablished answer must not be
        # more permissive than a known one.
        return False, ("vẫn còn công ty con phải hợp nhất, hoặc chưa xác định "
                       "được — tiếp tục dùng hợp nhất (§2.6)")
    if ev.effective_date >= quarter_start(period):
        # In-quarter or later: the report must reflect the period before control
        # was lost, and §2.6 forbids stitching the two halves together.
        return False, (f"mất quyền kiểm soát {ev.effective_date} không trước "
                       f"ngày đầu quý {quarter_start(period)} — chờ báo cáo (§2.6)")
    return True, (f"mất quyền kiểm soát {ev.effective_date} trước ngày đầu quý, "
                  f"giao dịch hoàn tất, không còn công ty con phải hợp nhất "
                  f"({ev.evidence_type}: {ev.evidence_source})")


def resolve(si: ScopeInput) -> dict:
    """§2.1's flow. Periods must be resolved OLDEST FIRST, because case 4 reads
    the prior period's resolved status."""
    today = dt.date.today().isoformat()
    base = {
        "symbol": si.symbol, "period": si.period,
        "prior_period": si.prior_period,
        "prior_period_scope": si.prior_status,
        "checked_date": today,
        "loss_of_control_event": (None if si.control_event is None
                                  else si.control_event.transaction_completed),
        "event_effective_date": (None if si.control_event is None
                                 else si.control_event.effective_date.isoformat()),
        "has_remaining_subsidiaries": (None if si.control_event is None
                                       else si.control_event.has_remaining_subsidiaries),
    }

    # ---- §2.2 / §2.1 item 2: the header says consolidated ----
    if si.header_scope == "HN":
        return {**base,
                "provider_report_type": PROV_CONSOLIDATED,
                "selected_report_type": SEL_CONSOLIDATED,
                "scope_status": CONSOLIDATED_VERIFIED,
                "usage_status": USED,
                "scope_verification_method": "STATEMENT_HEADER",
                "scope_decision_rule": "§2.1.2 nguồn ghi hợp nhất — dùng hợp nhất",
                "scope_verification_source": "Header BCTC do nguồn phục vụ (KBS)",
                "consolidated_report_available": True,
                "standalone_report_available": None}

    # ---- Positive evidence from the balance sheet, for periods the header does
    # ---- not reach. Admissible in THIS direction only (§2.3).
    if si.minority_interest is not None and si.minority_interest > 0:
        return {**base,
                "provider_report_type": PROV_CONSOLIDATED_BY_MI,
                "selected_report_type": SEL_CONSOLIDATED,
                "scope_status": CONSOLIDATED_VERIFIED,
                "usage_status": USED,
                "scope_verification_method": "BALANCE_SHEET_MINORITY_INTEREST",
                "scope_decision_rule": ("§2.3 lợi ích cổ đông không kiểm soát > 0 "
                                        "— bằng chứng DƯƠNG cho hợp nhất"),
                "scope_verification_source": (
                    "Bảng CĐKT: lợi ích cổ đông không kiểm soát "
                    f"{si.minority_interest / 1e9:,.1f} tỷ > 0 "
                    "(khớp header 36/36 ở các kỳ có cả hai)"),
                "consolidated_report_available": True,
                "standalone_report_available": None}

    # ---- §2.1 items 3-5: the header says standalone ----
    if si.header_scope == "ĐL":
        prior_was_consolidated = si.prior_status in CONSOLIDATED_STATUSES
        if prior_was_consolidated:
            permitted, why = _event_permits_switch(si.control_event, si.period)
            if permitted:
                return {**base,
                        "provider_report_type": PROV_STANDALONE,
                        "selected_report_type": SEL_STANDALONE,
                        "scope_status": SCOPE_CHANGE_VERIFIED,
                        "usage_status": USED,
                        "scope_verification_method": "VERIFIED_CONTROL_EVENT",
                        "scope_decision_rule": "§2.1.5 / §2.6 " + why,
                        "scope_verification_source": si.control_event.evidence_source,
                        "consolidated_report_available": None,
                        "standalone_report_available": True}
            # §2.1 item 4 — the standalone report was probably just published
            # first. Hold the last completed consolidated score and wait. NOT the
            # same as copying the prior period's figures into this one.
            return {**base,
                    "provider_report_type": PROV_STANDALONE,
                    "selected_report_type": SEL_WAITING,
                    "scope_status": WAITING_CONSOLIDATED,
                    "usage_status": WAITING_FOR_CONSOLIDATED,
                    "scope_verification_method": "STATEMENT_HEADER",
                    "scope_decision_rule": (
                        "§2.1.4 kỳ hiện tại riêng lẻ nhưng kỳ trước hợp nhất — "
                        "giữ điểm kỳ hoàn thành gần nhất, chờ BCTC hợp nhất; "
                        + why),
                    "scope_verification_source": "Header BCTC do nguồn phục vụ (KBS)",
                    "consolidated_report_available": None,
                    "standalone_report_available": True}
        # §2.1 item 3 + §2.4 — a DIRECT source label is what earns
        # PARENT_VERIFIED, and it is the only thing that does.
        return {**base,
                "provider_report_type": PROV_STANDALONE,
                "selected_report_type": SEL_STANDALONE,
                "scope_status": PARENT_VERIFIED,
                "usage_status": USED,
                "scope_verification_method": "STATEMENT_HEADER",
                "scope_decision_rule": ("§2.1.3 nguồn ghi riêng lẻ và chuỗi kỳ "
                                        "trước cũng riêng lẻ — dùng chuỗi riêng lẻ"),
                "scope_verification_source": "Header BCTC do nguồn phục vụ (KBS)",
                "consolidated_report_available": None,
                "standalone_report_available": True}

    # ---- No direct label, and no positive consolidation evidence ----
    # This is where BA's correction bites. The basis is CARRIED, not concluded.
    carried = si.prior_selected or SEL_STANDALONE
    first_of_series = si.prior_status is None
    return {**base,
            "provider_report_type": PROV_UNDETERMINED,
            "selected_report_type": carried,
            "scope_status": (SCOPE_AS_PROVIDED_BASELINE if first_of_series
                             else SCOPE_AS_PROVIDED_CONTINUOUS),
            # §2.5 item 3 — never block a calculation just for having no prior.
            "usage_status": USED,
            "scope_verification_method": "NO_DIRECT_LABEL_SERIES_CARRIED",
            "scope_decision_rule": (
                "§2.5 kỳ đầu chuỗi, dùng báo cáo nguồn đang phục vụ làm mốc, "
                "không suy diễn thêm" if first_of_series else
                "§2.3 ngoài vùng nguồn có nhãn — dùng chuỗi nguồn đang phục vụ, "
                "chưa phát hiện tín hiệu thay đổi phạm vi"),
            "scope_verification_source": (
                "Không có nhãn loại báo cáo (nguồn chỉ phục vụ 4 quý gần nhất); "
                "lợi ích cổ đông không kiểm soát = 0 KHÔNG được dùng để kết luận "
                "riêng lẻ (§2.3)"),
            # Still unknown, and NULL says so. False would claim a verification.
            "consolidated_report_available": None,
            "standalone_report_available": None}


def resolve_series(symbol: str, periods: list[str], header: dict[str, str | None],
                   minority: dict[str, float | None],
                   events: list[ControlEvent] | None = None) -> dict[str, dict]:
    """Resolve a whole symbol's series, oldest first.

    `periods` ascending. The prior period's RESOLVED status feeds the next one,
    which is why this cannot be done per period independently — §2.1 item 4 is a
    comparison against what the previous period turned out to be.
    """
    events = sorted(events or [], key=lambda e: e.effective_date)
    out: dict[str, dict] = {}
    prev_status = prev_period = prev_selected = None
    for p in sorted(periods):
        # The event that applies is the latest one effective before this quarter
        # starts; a later event cannot justify a change in an earlier quarter.
        applicable = [e for e in events if e.effective_date < quarter_start(p)]
        r = resolve(ScopeInput(
            symbol=symbol, period=p, header_scope=header.get(p),
            minority_interest=minority.get(p), prior_status=prev_status,
            prior_period=prev_period, prior_selected=prev_selected,
            control_event=applicable[-1] if applicable else None))
        out[p] = r
        # A WAITING period does not become the basis for the next comparison —
        # it was never completed, so the last COMPLETED period stays the anchor
        # (§2.1 item 4 says "kỳ hoàn thành gần nhất", not "kỳ trước").
        if r["usage_status"] == USED:
            prev_status, prev_period = r["scope_status"], p
            prev_selected = r["selected_report_type"]
    return out
