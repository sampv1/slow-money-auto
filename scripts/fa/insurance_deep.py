"""Shared metric engine for the two DEEP insurance tabs: Tái bảo hiểm (R1-R5)
and Holding/Hỗn hợp (H1-H5).

WHY ONE MODULE FOR TWO TABS. R4 and H3 are the same economic question asked of
different companies -- net investment income over average investment assets --
and R3/R1 read the same premium lines that H1 reads. BA specified them in two
documents written a day apart, which is exactly how one phrase ends up with two
implementations: the securities tabs shipped a headline score twice, computed in
two files, and the two disagreed. The rule that came out of that is a single
owner per number, so both tabs import from here and neither re-derives.

Nothing in this module assigns a BAND or a SCORE. Phase A is data and formulas
only; BA locks the bands afterwards, and with two symbols per tab a percentile
would manufacture a ranking out of a coin flip (BA: "Không percentile chéo 2
mã"). The module therefore returns raw values plus a status, never points.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# --------------------------------------------------------------------------
# Line items. Every name here was verified present on the live statements for
# all four symbols before being written down -- see the mapping evidence in
# data/fa/rubrics/insurance/IT_BAO_CAO_NGOAI_QUY_TAC_R4_DONG_TIEN_2026-09-29.md
# --------------------------------------------------------------------------

# Premium lines (R1, R3, H1)
ASSUMED = "IS_REINSURANCE_PREMIUM_ASSUMED"
CEDED = "IS_REINSURANCE_CEDED_PREMIUMS"
NET_PREMIUM = "IS_NET_INSURANCE_PREMIUM"
EARNED_ASSUMED = "IS_INSURANCE_PREMIUM"
UPR_GROSS = "IS_INCREASE_DECREASE_IN_UNEARNED_PREMIUM_RESERVE"
UPR_CEDED = "IS_INCREASE_DECREASE_IN_CEDED_UNEARNED_PREMIUM_RESERVE"

# Insurance operating lines (R1, H1)
NET_INSURANCE_REVENUE = "IS_TOTAL_NET_REVENUE_FROM_INSURANCE_BUSINESS"
GROSS_INSURANCE_PROFIT = "IS_GROSS_INSURANCE_OPERATING_PROFIT"

# Investment income (R4, H3)
FIN_INCOME = "IS_FINANCIAL_INCOME"
FIN_EXPENSE = "IS_FINANCIAL_EXPENSES"
FIN_NET = "IS_PROFIT_FORM_FINANCIAL_ACTIVITIES"

# Investment assets (R4, H3) and capital buffer (H4)
CASH_TOTAL = "BS_CASH_AND_PRECIOUS_METALS"
CASH = "BS_CASH"
CASH_EQUIV = "BS_CASH_EQUIVALENTS"
ST_INV = "BS_SHORT_TERM_INVESTMENTS"
LT_INV = "BS_LONG_TERM_INVESTMENTS"
HTM = "BS_HELD_TO_MATURITY_SECURITIES"
OTHER_LT_INV = "BS_OTHER_LONG_TERM_INVESTMENTS"
EQUITY = "BS_EQUITY"
INSURANCE_RESERVES = "BS_INSURANCE_RESERVES"
TOTAL_ASSETS = "BS_TOTAL_ASSETS"

INCOME_KEYS = (ASSUMED, CEDED, NET_PREMIUM, EARNED_ASSUMED, UPR_GROSS,
               UPR_CEDED, NET_INSURANCE_REVENUE, GROSS_INSURANCE_PROFIT,
               FIN_INCOME, FIN_EXPENSE, FIN_NET)
BALANCE_KEYS = (CASH_TOTAL, CASH, CASH_EQUIV, ST_INV, LT_INV, HTM,
                OTHER_LT_INV, EQUITY, INSURANCE_RESERVES, TOTAL_ASSETS)

# --------------------------------------------------------------------------
# Versions and statuses
# --------------------------------------------------------------------------

MAPPING_VERSION = "R4_TAI_BAO_HIEM_V2_CASH_TOTAL"
ENGINE_VERSION = "INS_DEEP_PHASE_A_V1"

# The R3 accounting basis. BA locked the WRITTEN basis for scoring and keeps the
# EARNED basis as a reconciliation column only. Both are computed on every row so
# a future decision costs a parameter, not a re-run.
BASIS_WRITTEN = "GHI_NHAN"
BASIS_EARNED = "DUOC_HUONG"
OFFICIAL_R3_BASIS = BASIS_WRITTEN

# The investment-income variant.
#
# THE OFFICIAL CHOICE IS PER TAB, NOT GLOBAL, and that is BA's instruction
# rather than a convenience. Sharing a function at the technical layer does not
# make two tabs the same business rule ("dùng chung một field kỹ thuật không
# đồng nghĩa hai tab có cùng nghiệp vụ"), so a single module-level switch would
# silently propagate a Holding decision onto the reinsurance tab.
#
# Holding H3 is LOCKED to A1 (`IS_PROFIT_FORM_FINANCIAL_ACTIVITIES`), decided on
# the evidence that it is the only one of the three variants that reconciles to
# the annual report. Reinsurance R4 is still OPEN: BA locked A1 in a document
# scoped to BVH/PVI only, and in the same round renamed H3 to "Hiệu quả hoạt
# động tài chính TTM" -- which is the rename their earlier §18 required before
# the two tabs are allowed to diverge. So R4 stays PENDING_RULE until a
# reinsurance-scoped decision says otherwise.
NII_A1 = "A1_NET_CONG_BO"          # IS_PROFIT_FORM_FINANCIAL_ACTIVITIES
NII_A2 = "A2_TAI_LAP_TU_CAU_PHAN"  # income + expenses, QA only
NII_B = "B_GROSS_THU_NHAP"         # IS_FINANCIAL_INCOME, diagnostic only

# Back-compatible aliases (A1 is the published net line, B the gross line).
NII_NET = NII_A1
NII_GROSS = NII_B

OFFICIAL_NII_BY_TAB: dict[str, str | None] = {
    "holding": NII_A1,      # LOCKED
    "reinsurance": None,    # OPEN -> R4 reports PENDING_RULE
}

# H3's display name must not overstate the field. It is the result of financial
# ACTIVITY over average investment assets, not a net investment yield -- no
# taxonomy separates investment income from investment-related expense here.
H3_LABEL_VI = "Hiệu quả hoạt động tài chính TTM"

OK = "OK"
MISSING_INPUT = "MISSING_INPUT"
PENDING_RULE = "PENDING_RULE"
HISTORY_INSUFFICIENT = "HISTORY_INSUFFICIENT"
MAPPING_CHANGED = "MAPPING_CHANGED"

ROUNDING_TOLERANCE_VND = 1_000.0


# --------------------------------------------------------------------------
# Period helpers
# --------------------------------------------------------------------------

def shift(period: str, back: int) -> str:
    """'2026-Q2' shifted back N quarters. Label arithmetic, never positional --
    a quarter missing from the store must not let 'four rows back' silently mean
    a different year, the lesson ta/market_history.py already records."""
    year, q = int(period[:4]), int(period[-1])
    idx = year * 4 + (q - 1) - back
    return f"{idx // 4:04d}-Q{idx % 4 + 1}"


def contiguous_back(period: str, available: set[str], limit: int) -> list[str]:
    """The newest `limit` quarters ending at `period`, walking back only while
    each one exists. A hole TRUNCATES rather than leaving a gap, so a TTM can
    never span a quarter we do not hold."""
    out = []
    for i in range(limit):
        p = shift(period, i)
        if p not in available:
            break
        out.append(p)
    return out


# --------------------------------------------------------------------------
# Investment assets -- the R4/H3 denominator
# --------------------------------------------------------------------------

@dataclass
class Mapping:
    """One period's investment-asset build, with the lineage BA requires: every
    line that carries data but was NOT added must say which total contains it."""
    value: float | None
    status: str
    included: list[tuple[str, float]] = field(default_factory=list)
    excluded: list[tuple[str, float, str, str]] = field(default_factory=list)
    fallback_used: bool = False

    def as_rows(self, symbol: str, period: str) -> list[dict]:
        rows = []
        for code, val in self.included:
            rows.append({"symbol": symbol, "period": period, "metric": "R4/H3",
                         "source_field": code, "source_value": val,
                         "include_flag": True, "parent_component": None,
                         "exclusion_reason": None,
                         "lineage_validation_status": "VERIFIED",
                         "mapping_version": MAPPING_VERSION})
        for code, val, parent, reason in self.excluded:
            rows.append({"symbol": symbol, "period": period, "metric": "R4/H3",
                         "source_field": code, "source_value": val,
                         "include_flag": False, "parent_component": parent,
                         "exclusion_reason": reason,
                         "lineage_validation_status": "VERIFIED",
                         "mapping_version": MAPPING_VERSION})
        return rows


def investment_assets(items: dict) -> Mapping:
    """Cash total + short-term investments + long-term investments.

    THE CASH LINE IS THE TOTAL, NOT `BS_CASH`, and that direction was measured
    rather than assumed: `BS_CASH + BS_CASH_EQUIVALENTS = BS_CASH_AND_PRECIOUS_
    METALS` holds on 60/60 reinsurance symbol-quarters with zero exceptions, and
    the total is larger in all 20 quarters where they differ. The 40 quarters
    where the two lines are EQUAL are quarters with no cash equivalents at all --
    equality there is a consequence of a zero component, not evidence that the
    lines duplicate, which is the trap BA warned about pointing the other way.
    Taking `BS_CASH` would have dropped up to 642.4 tỷ (PRE 2023-Q2).

    HTM and other long-term investments are detail lines inside the two
    investment totals and are never added on top: doing so inflated the
    denominator on 60/60 quarters, median +99.0% (PRE) and +68.0% (VNR).
    """
    cash = items.get(CASH_TOTAL)
    st = items.get(ST_INV)
    lt = items.get(LT_INV)

    if cash is None or st is None or lt is None:
        # BA §8.6/§5.4: the substitution branch may exist for a future period
        # but must never fire silently. On the current 60 symbol-quarters every
        # total is present, so this path is unreached and says so if it ever is.
        return Mapping(None, MISSING_INPUT, fallback_used=True)

    excluded = []
    for code, parent, reason in (
        (CASH, CASH_TOTAL, "Cấu phần tiền đã nằm trong dòng tổng"),
        (CASH_EQUIV, CASH_TOTAL,
         "Cấu phần tương đương tiền đã nằm trong dòng tổng"),
        (HTM, f"{ST_INV}/{LT_INV}",
         "Dòng chi tiết đã được bao phủ bởi tổng đầu tư ngắn hạn và dài hạn"),
        (OTHER_LT_INV, LT_INV,
         "Dòng chi tiết đã nằm trong tổng đầu tư dài hạn"),
    ):
        val = items.get(code)
        if val is not None:
            excluded.append((code, val, parent, reason))

    return Mapping(
        value=cash + st + lt,
        status=OK,
        included=[(CASH_TOTAL, cash), (ST_INV, st), (LT_INV, lt)],
        excluded=excluded,
    )


def htm_covered_by_totals(items: dict) -> bool | None:
    """BA's CHECK_R4_HTM_COVERED_BY_TOTALS. VNR has 10 quarters where HTM
    EXCEEDS short-term investments alone, which looks like the detail escaping
    its total -- but in every one of them HTM still fits inside short + long,
    so the excess sits in the long-term total and preferring the totals loses
    nothing. Returns None when a line is absent rather than guessing."""
    htm, st, lt = items.get(HTM), items.get(ST_INV), items.get(LT_INV)
    if htm is None or st is None or lt is None:
        return None
    return htm <= st + lt + ROUNDING_TOLERANCE_VND


def cash_component_reconciles(items: dict) -> bool | None:
    """BA's CHECK_R4_CASH_COMPONENT_RECONCILIATION: total - cash - equivalents
    must be zero. This is what establishes the parent/child direction, so it is
    a gate rather than a note -- if it ever fails, the mapping's premise is gone
    and the run must stop rather than quietly pick a line."""
    tot, cash, eq = items.get(CASH_TOTAL), items.get(CASH), items.get(CASH_EQUIV)
    if tot is None or cash is None:
        return None
    return abs(tot - cash - (eq or 0.0)) <= ROUNDING_TOLERANCE_VND


# --------------------------------------------------------------------------
# Net investment income -- the R4/H3 numerator
# --------------------------------------------------------------------------

def official_variant(tab: str) -> str | None:
    """Which numerator counts as official for this tab. Raises on an unknown
    tab rather than defaulting -- a silent default is how a locked Holding
    decision would leak onto the reinsurance tab."""
    if tab not in OFFICIAL_NII_BY_TAB:
        raise ValueError(f"unknown tab {tab!r}; expected one of "
                         f"{sorted(OFFICIAL_NII_BY_TAB)}")
    return OFFICIAL_NII_BY_TAB[tab]


def net_investment_income(items: dict, variant: str) -> float | None:
    """One quarter's net investment income, on whichever basis is asked for.

    BOTH VARIANTS ARE COMPUTED ON EVERY ROW because the choice is BA's and is
    open: the spec says not to deduct financial expense that is unrelated to
    investing, and these filings carry no interest-expense line to separate
    related from unrelated. Only two readings are computable -- deduct all, or
    deduct none -- and they differ by a median 12.9%-41% across the four
    symbols, with one VNR quarter where financial expense exceeds financial
    income and the sign flips. That is far too large to pick by taste.

    AND THE PUBLISHED NET LINE IS NOT ALWAYS ITS OWN COMPONENTS. On 4 of 128
    symbol-quarters `IS_PROFIT_FORM_FINANCIAL_ACTIVITIES` exceeds
    `income + expenses` by 8.7 to 155.5 tỷ (VNR 2020-Q2 and 2026-Q1, PVI
    2020-Q2 and 2020-Q4), so the net line carries something the two components
    do not explain. This branch returns the PUBLISHED line and leaves
    `financial_lines_reconcile` to flag those quarters, rather than silently
    substituting the components -- absence of an explanation is not licence to
    pick whichever number is more convenient.
    """
    if variant == NII_GROSS:
        return items.get(FIN_INCOME)
    if variant == NII_NET:
        net = items.get(FIN_NET)
        if net is not None:
            return net
        inc, exp = items.get(FIN_INCOME), items.get(FIN_EXPENSE)
        return None if inc is None or exp is None else inc + exp
    raise ValueError(f"unknown investment-income variant: {variant!r}")


def financial_lines_reconcile(items: dict) -> bool | None:
    """`income + expenses = net` -- verified 0 mismatches on PRE's 26 quarters.
    Where it fails the provider's net line is not the sum of its own parts, so
    the variant choice would not mean what it says."""
    inc, exp, net = items.get(FIN_INCOME), items.get(FIN_EXPENSE), items.get(FIN_NET)
    if inc is None or exp is None or net is None:
        return None
    return abs(inc + exp - net) <= 1_000_000.0


# --------------------------------------------------------------------------
# Premiums -- R1, R3 and their reconciliation
# --------------------------------------------------------------------------

@dataclass
class Retention:
    r3_written: float | None
    r3_earned: float | None
    assumed: float | None
    ceded_signed: float | None
    ceded_abs: float | None
    retained_written: float | None
    status: str


def retention(items: dict) -> Retention:
    """R3 on both accounting bases.

    THE CEDED PREMIUM IS STORED NEGATIVE and must be normalised with ABS before
    subtracting. Writing the formula the way it reads in prose -- `assumed -
    ceded` -- ADDS the ceded premium back and produces a retention above 100%.
    The arithmetic happened to be right in the first analysis because it used
    absolute values, but BA made the rule explicit in the engine precisely
    because the written formula is a trap.

    The two bases are not interchangeable: they differ by up to 12.35pp (PRE
    2024-Q4) and -10.49pp (VNR 2025-Q3) even though their medians nearly agree.
    """
    assumed = items.get(ASSUMED)
    ceded_signed = items.get(CEDED)
    if assumed is None or ceded_signed is None:
        return Retention(None, None, assumed, ceded_signed, None, None,
                         MISSING_INPUT)
    if assumed <= 0:
        # BA §7.9: no division, no zero, no guess -- it becomes a data issue.
        return Retention(None, None, assumed, ceded_signed, abs(ceded_signed),
                         None, MISSING_INPUT)

    ceded_abs = abs(ceded_signed)
    retained = assumed - ceded_abs

    earned_assumed = items.get(EARNED_ASSUMED)
    net_earned = items.get(NET_PREMIUM)
    r3_earned = (net_earned / earned_assumed * 100.0
                 if earned_assumed and net_earned is not None else None)

    return Retention(
        r3_written=retained / assumed * 100.0,
        r3_earned=r3_earned,
        assumed=assumed,
        ceded_signed=ceded_signed,
        ceded_abs=ceded_abs,
        retained_written=retained,
        status=OK,
    )


def premium_identities(items: dict) -> dict:
    """BA §7.7's two reconciliations, which together prove the two bases are
    what we claim. Verified 0/60 mismatches before the engine existed:

        assumed + ceded_signed + UPR_gross + UPR_ceded = net premium (earned)
        assumed + UPR_gross                            = assumed earned

    The 8.541 tỷ gap between written retention and the reported net line is
    EXACTLY the net unearned-premium-reserve movement, to the đồng -- which is
    what makes "the two lines are on different accounting bases" a measurement
    rather than an opinion.
    """
    def ok(lhs, rhs):
        if lhs is None or rhs is None:
            return None
        return abs(lhs - rhs) <= ROUNDING_TOLERANCE_VND

    a, c = items.get(ASSUMED), items.get(CEDED)
    ug, uc = items.get(UPR_GROSS), items.get(UPR_CEDED)
    net, ea = items.get(NET_PREMIUM), items.get(EARNED_ASSUMED)

    net_lhs = None if None in (a, c, ug, uc) else a + c + ug + uc
    ea_lhs = None if None in (a, ug) else a + ug
    return {
        "net_premium_identity": ok(net_lhs, net),
        "earned_assumed_identity": ok(ea_lhs, ea),
        "unearned_reserve_movement": None if None in (ug, uc) else ug + uc,
    }


def insurance_margin(items: dict) -> float | None:
    """R1 and H1 are the same ratio: gross insurance operating profit over net
    insurance revenue. BA renamed it for the reinsurance tab (*Biên lợi nhuận
    gộp nghiệp vụ tái bảo hiểm*) without touching the formula, and forbids
    calling it a Combined ratio -- it is before administrative expenses."""
    rev = items.get(NET_INSURANCE_REVENUE)
    gp = items.get(GROSS_INSURANCE_PROFIT)
    if not rev or gp is None:
        return None
    return gp / rev * 100.0


def capital_buffer(items: dict) -> float | None:
    """H4 = equity / insurance reserves. NOT a regulatory solvency ratio, and
    the tooltip must not imply that a buffer of 15% means 15% of obligations
    are covered by shareholder capital."""
    eq, res = items.get(EQUITY), items.get(INSURANCE_RESERVES)
    if eq is None or not res:
        return None
    return eq / res * 100.0


# --------------------------------------------------------------------------
# TTM and averaging
# --------------------------------------------------------------------------

def ttm(values: list[float | None]) -> float | None:
    """Sum of four STANDALONE quarters. Never today's quarter x4, never 6M x2,
    never an annualised 9M -- and a single missing quarter voids the window
    rather than shrinking it, because a three-quarter 'TTM' is a different
    measure wearing the same name."""
    if len(values) != 4 or any(v is None for v in values):
        return None
    return sum(values)


def average_endpoints(begin: float | None, end: float | None) -> float | None:
    """(assets at t-4 + assets at t) / 2, per BA. An average runs on all its
    points or none."""
    if begin is None or end is None:
        return None
    return (begin + end) / 2.0


def investment_yield(nii_ttm: float | None,
                     avg_assets: float | None) -> float | None:
    """R4 / H3. No x4: the numerator is already twelve months."""
    if nii_ttm is None or not avg_assets:
        return None
    return nii_ttm / avg_assets * 100.0


# --------------------------------------------------------------------------
# Valuation -- R5 / H5
# --------------------------------------------------------------------------

MIN_PB_OBS = 8
MAX_PB_OBS = 20


def pb_relative_asof(pb_by_period: dict[str, float], period: str) -> dict:
    """Current P/B over the median of its own history, point-in-time.

    ONLY OBSERVATIONS THAT EXISTED BY `period` ARE USED. Taking today's twenty
    quarters and computing a median backwards for a past quarter is the
    look-ahead both specs forbid by name, and it is the failure that is easiest
    to ship because the result looks perfectly reasonable. The current
    observation is deliberately inside its own median set -- BA allows that
    explicitly.
    """
    usable = sorted(p for p, v in pb_by_period.items()
                    if p <= period and v is not None and v > 0)
    usable = usable[-MAX_PB_OBS:]
    if len(usable) < MIN_PB_OBS:
        return {"status": HISTORY_INSUFFICIENT, "relative": None,
                "current": pb_by_period.get(period), "median": None,
                "observations": len(usable)}

    vals = sorted(pb_by_period[p] for p in usable)
    n = len(vals)
    median = vals[n // 2] if n % 2 else (vals[n // 2 - 1] + vals[n // 2]) / 2.0
    current = pb_by_period.get(period)
    if current is None or not median:
        return {"status": MISSING_INPUT, "relative": None, "current": current,
                "median": median, "observations": n}
    return {"status": OK, "relative": current / median, "current": current,
            "median": median, "observations": n}
