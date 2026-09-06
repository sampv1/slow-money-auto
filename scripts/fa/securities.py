"""Securities (CTCK) fundamental scoring — 20 criteria, max 100.

Rubric #3, after manufacturing and real estate. It exists because a broker's
income statement has no gross margin to band: `fa/scoring.py` correctly refuses
to score one, so all 45 brokers sit UNRATED today. The rubric is
`data/fa/rubrics/securities/Bo_loc_CTCK_V8_Cho_IT.xlsx`.

THREE BLOCKS, TWO CLOCKS:
    Quality   /50  quarterly — moves only when a filing lands
    Cycle     /30  daily     — FCI, ADTV momentum, breadth, C18
    Valuation /20  daily     — price against core earnings and book

FOUR LAYERS, and the order is the design (V5 sheet 13): raw -> candidate
mapping -> canonical -> QC -> score. Nothing is scored off a raw provider field;
every number reaching the scorer carries where it came from and how much it is
trusted, because two brokers can file the same economics under different lines.

THE BUG THIS RUBRIC WAS REWRITTEN TO FIX. V2 defined margin profit as
`margin interest income - TOTAL financial expenses`, charging the whole balance
sheet's funding to the margin book while excluding all the prop income that same
funding supports. VND's core ratio came out at 0.8% — scoring 0 on earnings
quality for a broker that is not distressed. Funding cost is now allocated by
share of AVERAGE EARNING ASSETS: VND 0.8% -> 45.7%. Allocating by share of debt
instead was measured and rejected — VIX funds its margin book largely from
equity (margin/debt = 306%), so a debt-share split hands it NEGATIVE margin
profit.

MISSING IS NOT ZERO, AND IT PROPAGATES. HCM and FTS report no interest expense
on the income statement at all despite 26,093 and 9,918 tỷ of debt. Inventing a
number from operating expenses or a peer median is forbidden; instead the
funding cost is MISSING and every metric downstream of it inherits N/A, which
removes those points from the denominator rather than scoring them 0. HCM is
then rescued honestly: `CF_INTEREST_EXPENSE` carries 1,893.6 tỷ, and across the
32 brokers reporting both, that field matches the income statement within 1% on
28 — so it is a sanctioned FALLBACK, never an override.
"""

from __future__ import annotations

from dataclasses import dataclass, field

MODEL_VERSION = "CTCK_V8"

# Points per criterion (sheet 1). Sums to 100 — asserted at import.
CRITERION_POINTS = {
    "c1": 6, "c2": 5, "c3": 5, "c4": 4, "c5": 3, "c6": 4, "c7": 3, "c8": 3,
    "c9": 4, "c10": 3, "c11": 3, "c12": 3, "c13": 2, "c14": 2,
    "c15": 10, "c16": 8, "c17": 5, "c18": 7,
    "c19": 8, "c20": 12,
}
assert sum(CRITERION_POINTS.values()) == 100, sum(CRITERION_POINTS.values())

QUALITY_CRITERIA = [f"c{i}" for i in range(1, 15)]
CYCLE_CRITERIA = ["c15", "c16", "c17", "c18"]
VALUATION_CRITERIA = ["c19", "c20"]

# Everything downstream of funding cost (V4 sheet 12). NOT hard-coded to
# C3/C6/C11: Core_NPAT feeds ROE, growth, CIR, durability and both valuation
# criteria, so all nine inherit N/A together or the score silently mixes a
# rubric that priced funding with one that did not.
FUNDING_DEPENDENT = ["c1", "c2", "c3", "c6", "c8", "c11", "c14", "c19", "c20"]

# --- provider field ids -----------------------------------------------------
BROKERAGE_REVENUE = [
    "IS_REVENUE_FROM_BROKERAGE_SERVICES",
    "IS_REVENUE_FROM_SHARE_ISSUE_GUARANTEE_AND_AGENCY_ACTIVITIES",
    "IS_REVENUE_FROM_SECURITIES_INVESTMENT_ADVISORY_SERVICES",
    "IS_REVENUE_FROM_SECURITIES_CUSTODY_SERVICES",
    "IS_REVENUE_FROM_INVESTMENT_ADVISORY_SERVICES",
]
# Stored NEGATIVE by the provider, so these are ADDED to revenue, never
# subtracted. The rubric's mapping sheet lists only the brokerage line; the
# other four exist under these ids and omitting them overstates segment profit.
BROKERAGE_EXPENSE = [
    "IS_SECURITIES_BROKERAGE_EXPENSES",
    "IS_UNDERWRITING_AND_ISSUANCE_AGENCY_EXPENSES",
    "IS_SECURITIES_INVESTMENT_ADVISORY_EXPENSES",
    "IS_SECURITIES_CUSTODY_EXPENSES",
    "IS_FINANCIAL_ADVISORY_EXPENSES",
]
MARGIN_INCOME = "IS_INTEREST_INCOME_FROM_LOANS_AND_RECEIVABLES"
# Eligible funding cost is INTEREST expense, not total financial expense: the
# gap is non-funding (FX losses and similar) and reaches 13.1% for TCX, 11.3%
# VCI, 6.5% SSI. Charging it to earning assets would overstate cost of funds.
INTEREST_EXPENSE = "IS_INTEREST_EXPENSES"
CF_INTEREST_EXPENSE = "CF_INTEREST_EXPENSE"
TREASURY_INCOME = [
    "IS_GAINS_FROM_HELD_TO_MATURITY_INVESTMENTS",
    "IS_DIVIDENDS_INTEREST_INCOME_FROM_DEMAND_DEPOSITS",
]
# Dividends and interest arrive fused in one FVTPL line for 35 of 41 brokers.
# It cannot be split, so it stays OUT of core and only lowers confidence — the
# spec's Mapping_Uncertain case, which is the norm here rather than an edge.
FUSED_DIVIDEND_INTEREST = "IS_C_DIVIDENDS_AND_INTEREST_INCOME_FROM_FVTPL_FINANCIAL_ASSETS"
MANAGEMENT_OPEX = "IS_GENERAL_AND_ADMINISTRATIVE_EXPENSES"
PROFIT_BEFORE_TAX = "IS_PROFIT_BEFORE_TAX"
TAX_LINES = ["IS_CURRENT_CORPORATE_INCOME_TAX_EXPENSES", "IS_DEFERRED_INCOME_TAX_EXPENSES"]
NPAT_PARENT = "IS_PROFIT_AFTER_TAX_FOR_SHAREHOLDERS_OF_PARENT_COMPANY"

BS_MARGIN = "BS_LOANS"
BS_EQUITY = "BS_EQUITY"
BS_TOTAL_ASSETS = "BS_TOTAL_ASSETS"
BS_SHARES = "BS_OFF_OUTSTANDING_SHARES"
BS_TREASURY_ASSETS = ["BS_HELD_TO_MATURITY_SECURITIES"]
# Earning assets: margin + HTM + FVTPL + AFS. Deliberately NOT total assets and
# NOT plain cash — the spec excludes non-interest-bearing cash, fixed assets and
# non-earning receivables, because the ratio decides how funding is split.
BS_EARNING_ASSETS = [
    BS_MARGIN, "BS_HELD_TO_MATURITY_SECURITIES", "BS_FVTPL_FINANCIAL_ASSETS",
    "BS_AVAILABLE_FOR_SALE_FINANCIAL_ASSETS_AFS",
]
BS_DEBT = ["BS_SHORT_TERM_BORROWINGS", "BS_SHORT_TERM_BONDS",
           "BS_LONG_TERM_BORROWINGS", "BS_LONG_TERM_BONDS", "BS_CONVERTIBLE_BONDS"]


@dataclass
class Canonical:
    """One canonical variable plus everything needed to audit or replay it.

    `value is None` and `status != "OK"` always travel together: a caller must
    never be able to read a number without also seeing that it was derived,
    doubted or absent. Required by the spec's acceptance criterion A1.
    """
    value: float | None = None
    source_field: str | None = None
    source_type: str = "DIRECT"       # DIRECT|MANUAL_VERIFIED|CASHFLOW_DERIVED|DERIVED
    status: str = "OK"                # OK|MISSING|FAIL|MAPPING_UNCERTAIN|ZERO_DEFAULT
    confidence: str = "HIGH"          # HIGH|MEDIUM|LOW
    unit: str = "VND"
    period: str | None = None
    note: str = ""

    @property
    def usable(self) -> bool:
        return self.value is not None and self.status in ("OK", "MANUAL_VERIFIED")

    def as_meta(self) -> dict:
        return {"value": self.value, "source_field": self.source_field,
                "source_type": self.source_type, "status": self.status,
                "confidence": self.confidence, "unit": self.unit,
                "period": self.period, "note": self.note or None}


MISSING = Canonical(status="MISSING", source_type="DERIVED", confidence="LOW")


def _sum(items: dict, keys) -> float:
    return sum((items.get(k) or 0) for k in (keys if isinstance(keys, (list, tuple)) else [keys]))


def ttm(statements: dict, statement: str, keys, quarters: list[str]) -> float:
    """Sum `keys` across four quarters of one statement."""
    return sum(_sum(statements.get(statement, {}).get(q, {}), keys) for q in quarters)


def average_balance(statements: dict, keys, open_q: str, close_q: str) -> float | None:
    """Mean of opening and closing balance.

    A balance-sheet stock must not be summed across quarters, and using the
    closing balance alone misprices any book that grew or shrank during the
    window — which is the whole point of an allocation ratio.
    """
    bal = statements.get("balance", {})
    if open_q not in bal or close_q not in bal:
        return None
    return (_sum(bal[open_q], keys) + _sum(bal[close_q], keys)) / 2


def eligible_funding_cost(statements: dict, quarters: list[str], avg_debt: float | None,
                          manual: float | None = None) -> Canonical:
    """Cost of funding for the TTM window, by the sanctioned source hierarchy.

    DIRECT -> MANUAL_VERIFIED -> CASHFLOW_DERIVED -> MISSING/FAIL, and a lower
    source is never ADDED to a higher one — it replaces it or nothing.

    The four-way outcome matters because two of them look identical in the data
    and mean opposite things. `debt > 0` with a blank field is MISSING; `debt >
    0` with a real zero is FAIL, because no broker funds 26,093 tỷ for free and
    treating that zero as a cost of funds would hand HCM a perfect score on cost
    of funding. `debt == 0` with zero cost is simply OK.
    """
    inc = statements.get("income", {})
    have_key = any(INTEREST_EXPENSE in inc.get(q, {}) for q in quarters)
    direct = abs(ttm(statements, "income", INTEREST_EXPENSE, quarters))

    if direct > 0:
        return Canonical(direct, INTEREST_EXPENSE, "DIRECT", "OK", "HIGH",
                         period="TTM")
    if manual:
        return Canonical(abs(manual), "manual", "MANUAL_VERIFIED", "OK", "MEDIUM",
                         period="TTM", note="entered from the filing's notes")

    if not avg_debt:
        # No debt and no interest cost is not a gap — it is a broker funding its
        # book from equity.
        return Canonical(0.0, INTEREST_EXPENSE, "DIRECT", "OK", "HIGH", period="TTM",
                         note="no interest-bearing debt")

    cf = abs(ttm(statements, "cashflow", CF_INTEREST_EXPENSE, quarters))
    if cf > 0:
        return Canonical(cf, CF_INTEREST_EXPENSE, "CASHFLOW_DERIVED", "OK", "MEDIUM",
                         period="TTM",
                         note="income statement reports no interest expense; taken "
                              "from the cash-flow statement, which matches it within "
                              "1% on 28 of the 32 brokers reporting both")

    return Canonical(None, INTEREST_EXPENSE if have_key else None, "DERIVED",
                     "FAIL" if have_key else "MISSING", "LOW", period="TTM",
                     note=f"debt of {avg_debt:,.0f} carries no funding cost in any statement")


@dataclass
class CoreResult:
    """Core_NPAT and every intermediate, each with its own status."""
    fields: dict = field(default_factory=dict)      # name -> Canonical
    checks: dict = field(default_factory=dict)      # V3 sheet 10 QC results
    blocked: bool = False                           # funding cost unusable

    def val(self, name):
        c = self.fields.get(name)
        return c.value if c and c.usable else None


def compute_core(statements: dict, quarters: list[str], open_q: str, close_q: str,
                 prior_quarters: list[str] | None = None,
                 manual_funding: float | None = None) -> CoreResult:
    """Core_NPAT V3 for one broker's TTM window.

    Core is brokerage/IB + margin + stable treasury, net of the funding those
    assets consumed and of common overhead — with ALL trading and
    mark-to-market excluded. Prop trading is still judged, but through the
    earnings-quality and risk criteria, never inside Core.
    """
    res = CoreResult()
    F = res.fields

    avg_margin = average_balance(statements, BS_MARGIN, open_q, close_q)
    avg_ea = average_balance(statements, BS_EARNING_ASSETS, open_q, close_q)
    avg_treasury = average_balance(statements, BS_TREASURY_ASSETS, open_q, close_q)
    avg_equity = average_balance(statements, BS_EQUITY, open_q, close_q)
    avg_debt = average_balance(statements, BS_DEBT, open_q, close_q)

    F["avg_margin"] = Canonical(avg_margin, BS_MARGIN, "DERIVED",
                                "OK" if avg_margin is not None else "MISSING")
    F["avg_earning_assets"] = Canonical(avg_ea, "+".join(BS_EARNING_ASSETS), "DERIVED",
                                        "OK" if avg_ea else "MISSING")
    F["avg_equity"] = Canonical(avg_equity, BS_EQUITY, "DERIVED",
                                "OK" if avg_equity else "MISSING")

    efc = eligible_funding_cost(statements, quarters, avg_debt, manual_funding)
    F["eligible_funding_cost"] = efc

    # Segment profit needs no funding split — its costs are direct and reported.
    bro = ttm(statements, "income", BROKERAGE_REVENUE, quarters) + \
        ttm(statements, "income", BROKERAGE_EXPENSE, quarters)
    F["brokerage_ib_gross_profit"] = Canonical(bro, "+".join(BROKERAGE_REVENUE), "DERIVED",
                                               "OK", "MEDIUM", period="TTM")

    # Whatever the provider fused, we do not unfuse. It stays out of Core and
    # only lowers confidence.
    fused = ttm(statements, "income", FUSED_DIVIDEND_INTEREST, quarters)
    if fused:
        F["fused_dividend_interest"] = Canonical(
            fused, FUSED_DIVIDEND_INTEREST, "DERIVED", "MAPPING_UNCERTAIN", "LOW",
            period="TTM", note="dividends and interest reported as one line; excluded from Core")

    # Other stable core profit is 0 by default and whitelist-only. It must never
    # become a residual: a balancing item would absorb exactly the trading
    # profit this rubric exists to exclude.
    F["other_stable_core_profit"] = Canonical(0.0, None, "DERIVED", "ZERO_DEFAULT", "HIGH",
                                              period="TTM", note="whitelist only; none defined")

    opex = ttm(statements, "income", MANAGEMENT_OPEX, quarters)      # negative
    F["management_common_opex"] = Canonical(opex, MANAGEMENT_OPEX, "DIRECT", "OK",
                                            period="TTM")

    pbt = ttm(statements, "income", PROFIT_BEFORE_TAX, quarters)
    tax = abs(ttm(statements, "income", TAX_LINES, quarters))
    eff_tax = (tax / pbt) if pbt > 0 else None
    tax_ok = eff_tax is not None and 0 <= eff_tax <= 0.35
    F["effective_tax_rate"] = Canonical(eff_tax, "+".join(TAX_LINES), "DERIVED",
                                        "OK" if tax_ok else "MAPPING_UNCERTAIN",
                                        "HIGH" if tax_ok else "LOW", unit="ratio", period="TTM")

    reported = ttm(statements, "income", NPAT_PARENT, quarters)
    F["reported_npat_ttm"] = Canonical(reported, NPAT_PARENT, "DIRECT", "OK", period="TTM")

    # --- allocation. Without a funding cost every core number below is N/A;
    # the ratios are still recorded so the QC sheet can show WHY.
    alloc_m = (avg_margin / avg_ea) if (avg_margin is not None and avg_ea) else None
    alloc_t = (avg_treasury / avg_ea) if (avg_treasury is not None and avg_ea) else None
    res.checks = {
        "margin_allocation_ratio": _check_ratio(alloc_m),
        "treasury_allocation_ratio": _check_ratio(alloc_t),
        "core_allocation_total": _check_ratio(
            (alloc_m or 0) + (alloc_t or 0) if alloc_m is not None else None, cap=1.0),
        "effective_tax_rate": "OK" if tax_ok else ("MISSING" if eff_tax is None else "FAIL"),
        "funding_cost": efc.status if efc.status != "OK" else "OK",
    }

    if not efc.usable or alloc_m is None:
        res.blocked = True
        for name in ("margin_net", "core_treasury_net", "core_pbt", "core_npat_ttm",
                     "core_ratio_ttm"):
            F[name] = Canonical(None, None, "DERIVED", "MISSING", "LOW",
                                note="downstream of an unusable eligible_funding_cost")
        return res

    margin_net = ttm(statements, "income", MARGIN_INCOME, quarters) - efc.value * alloc_m
    treasury_net = ttm(statements, "income", TREASURY_INCOME, quarters) - efc.value * (alloc_t or 0)
    F["margin_net"] = Canonical(margin_net, MARGIN_INCOME, "DERIVED", "OK",
                                efc.confidence, period="TTM",
                                note=f"funding allocated at {alloc_m:.1%} of earning assets")
    F["core_treasury_net"] = Canonical(treasury_net, "+".join(TREASURY_INCOME), "DERIVED",
                                       "OK", "MEDIUM", period="TTM")

    core_pbt = bro + margin_net + treasury_net + 0.0 + opex
    core_npat = core_pbt * (1 - eff_tax) if eff_tax is not None else None
    F["core_pbt"] = Canonical(core_pbt, None, "DERIVED", "OK", period="TTM")
    F["core_npat_ttm"] = Canonical(core_npat, None, "DERIVED",
                                   "OK" if core_npat is not None else "MISSING",
                                   efc.confidence, period="TTM")

    # Reported <= 0 is the SPECIAL_CASE — a ratio against a negative denominator
    # is not a small number, it is a meaningless one. A ratio above 100% is NOT
    # special: it means the non-core segments lost money, which is real.
    if core_npat is not None and reported > 0:
        F["core_ratio_ttm"] = Canonical(core_npat / reported, None, "DERIVED", "OK",
                                        unit="ratio", period="TTM")
    else:
        F["core_ratio_ttm"] = Canonical(None, None, "DERIVED", "SPECIAL_CASE", "LOW",
                                        unit="ratio", period="TTM",
                                        note="reported NPAT is zero or negative")
    return res


def _check_ratio(v, cap: float = 1.0) -> str:
    if v is None:
        return "MISSING"
    return "OK" if 0 <= v <= cap else "FAIL"


def load_statements(client, symbol: str, period_type: str = "quarter") -> dict:
    """{statement: {period: items}} for one symbol, from fa_vnstock_statements."""
    from ta.common import safe_execute

    rows = safe_execute(
        client.table("fa_vnstock_statements")
        .select("statement,period,items")
        .eq("symbol", symbol).eq("period_type", period_type),
        label=f"statements {symbol}",
    ).data or []
    out: dict[str, dict] = {}
    for r in rows:
        out.setdefault(r["statement"], {})[r["period"]] = r["items"] or {}
    return out


def ttm_window(latest: str, back: int = 0) -> tuple[list[str], str, str]:
    """The four quarters ending `back` years before `latest`, plus its endpoints.

    Returns (quarters, opening_balance_quarter, closing_balance_quarter). The
    opening balance is the quarter BEFORE the window, because an average balance
    over a TTM window spans five quarter-ends, not four.
    """
    y, q = int(latest[:4]), int(latest[-1])
    def step(n):
        yy, qq = y, q - n
        while qq <= 0:
            qq += 4; yy -= 1
        return f"{yy}-Q{qq}"
    offset = back * 4
    quarters = [step(offset + i) for i in (3, 2, 1, 0)]
    return quarters, step(offset + 4), step(offset)


# --- band tables (sheet 1). Each is (threshold, points), tested in order. -----
def _bands_desc(value, table, default=0):
    """Descending bands: the first threshold the value meets or exceeds wins."""
    if value is None:
        return None
    for lo, pts in table:
        if value >= lo:
            return pts
    return default


def _pctile_bands(p, table):
    """Ascending percentile bands. `p` is 0 = best in class."""
    if p is None:
        return None
    for hi, pts in table:
        if p <= hi:
            return pts
    return table[-1][1]


C1_ROE = [(.20, 6), (.17, 5), (.14, 4), (.11, 3), (.08, 2), (.05, 1)]
C2_GROWTH = [(.30, 5), (.20, 4), (.10, 3), (0, 2), (-.10, 1)]
C3_RATIO = [(.85, 5), (.70, 4), (.55, 3), (.40, 2), (.25, 1)]
C7_MARGIN_GROWTH = [(.30, 3), (.10, 2), (0, 1)]
# "Top 20% of the industry" — lower percentile is better for cost-like metrics,
# so these are read against the ASCENDING rank of the metric.
C6_SPREAD = [(.20, 4), (.40, 3), (.60, 2), (.80, 1), (1.0, 0)]
C8_CIR = [(.20, 3), (.50, 2), (.80, 1), (1.0, 0)]
C10_LEVERAGE = [(.20, 3), (.50, 2), (.80, 1), (1.0, 0)]
C11_FUNDING = [(.20, 3), (.50, 2), (.80, 1), (1.0, 0)]
C19_CORE_PE = [(.20, 8), (.40, 6), (.60, 4), (.80, 2), (1.0, 0)]
C20_PB = [(.75, 12), (.90, 9), (1.10, 6), (1.25, 3)]

# Criteria with no data source at all today. Both are N/A for every broker, and
# both are honest gaps rather than bugs:
#   C4/C5 broker market share — HOSE/HNX publish a quarterly top-10 press
#         release; it is not in the provider and the rubric defers it.
#   C9 ATTC (tỷ lệ an toàn tài chính) — a separate UBCK filing. Checked all 45
#         ratio ids a broker carries: nothing matching capital adequacy.
# Together with C18 (N/A until its mapping is backtested) they cap coverage at
# 82%, which is why the publish gate sits at 70 and not higher.
UNSOURCED_CRITERIA = {
    "c4": "broker market share not published by the provider",
    "c5": "broker market share not published by the provider",
    "c9": "ATTC capital-adequacy ratio is a UBCK filing, absent from the provider",
}


@dataclass
class Criterion:
    points: float | None = None
    value: float | None = None
    status: str = "OK"          # OK|N_A|SPECIAL_CASE
    reason: str = ""


def score_quality(core: CoreResult, ctx: dict) -> dict[str, Criterion]:
    """C1-C14. `ctx` carries cross-sectional percentiles and prior-period core.

    Every criterion that reads Core_NPAT goes N/A together when funding cost is
    unusable — by DEPENDENCY, not by a hard-coded list of three. That is the
    difference between a broker scored on 45% of the rubric and one silently
    scored as if its funding were free.
    """
    out: dict[str, Criterion] = {}
    blocked = core.blocked

    def na(key, reason):
        out[key] = Criterion(None, None, "N_A", reason)

    core_npat = core.val("core_npat_ttm")
    equity = core.val("avg_equity")

    # C1 core ROE
    if blocked or core_npat is None or not equity:
        na("c1", "core_npat unavailable" if blocked else "no average equity")
    else:
        roe = core_npat / equity
        out["c1"] = Criterion(_bands_desc(roe, C1_ROE), roe)

    # C2 core profit growth, year on year
    prior = ctx.get("core_npat_prior")
    if blocked or core_npat is None or not prior or prior <= 0:
        na("c2", "core_npat unavailable" if blocked else "no positive prior-year core")
    else:
        g = core_npat / prior - 1
        out["c2"] = Criterion(_bands_desc(g, C2_GROWTH), g)

    # C3 earnings quality. Scored on TTM; the quarterly ratio is diagnostic only.
    ratio_field = core.fields.get("core_ratio_ttm")
    if blocked:
        na("c3", "core_npat unavailable")
    elif ratio_field is None or ratio_field.status == "SPECIAL_CASE":
        out["c3"] = Criterion(None, None, "SPECIAL_CASE", "reported NPAT <= 0")
    else:
        # A ratio above 100% is real, not an error — it caps at the maximum
        # rather than being treated as a fault.
        out["c3"] = Criterion(_bands_desc(ratio_field.value, C3_RATIO), ratio_field.value)

    for key, reason in UNSOURCED_CRITERIA.items():
        na(key, reason)

    # C6 net interest spread on the margin book, ranked across the sector
    if blocked:
        na("c6", "needs funding cost")
    else:
        out["c6"] = Criterion(_pctile_bands(ctx.get("p_spread"), C6_SPREAD), ctx.get("spread"))
        if out["c6"].points is None:
            na("c6", "no sector distribution")

    # C7 margin book growth: 70% YoY + 30% QoQ
    g = ctx.get("margin_growth")
    if g is None:
        na("c7", "margin balance history unavailable")
    else:
        out["c7"] = Criterion(_bands_desc(g, C7_MARGIN_GROWTH), g)

    # C8 core cost-to-income
    if blocked:
        na("c8", "core profit stream unavailable")
    else:
        out["c8"] = Criterion(_pctile_bands(ctx.get("p_cir"), C8_CIR), ctx.get("cir"))
        if out["c8"].points is None:
            na("c8", "no sector distribution")

    # C10 leverage, C11 cost of funds — both ranked, both cost-like
    out["c10"] = Criterion(_pctile_bands(ctx.get("p_leverage"), C10_LEVERAGE), ctx.get("leverage"))
    if out["c10"].points is None:
        na("c10", "no sector distribution")
    if blocked:
        na("c11", "needs funding cost")
    else:
        out["c11"] = Criterion(_pctile_bands(ctx.get("p_cof"), C11_FUNDING), ctx.get("cof"))
        if out["c11"].points is None:
            na("c11", "no sector distribution")

    # C12 proprietary risk: trading book against equity. Deliberately NOT a
    # holdings-level test — the rubric asks for exposure and volatility, not
    # which shares the broker owns.
    out["c12"] = Criterion(_pctile_bands(ctx.get("p_prop_risk"), C10_LEVERAGE),
                           ctx.get("prop_risk"))
    if out["c12"].points is None:
        na("c12", "no sector distribution")

    # C13 asset quality and C14 durability need provision detail and a long core
    # history respectively; both are left N/A until those series are built,
    # rather than scored 0 from absent data.
    na("c13", "provision / overdue-receivable detail not yet mapped")
    if blocked or ctx.get("core_history_n", 0) < 8:
        na("c14", "needs 8+ quarters of core history")
    else:
        out["c14"] = Criterion(_pctile_bands(ctx.get("p_stability"), C10_LEVERAGE),
                               ctx.get("stability"))
    return out


def score_valuation(core: CoreResult, ctx: dict) -> dict[str, Criterion]:
    """C19 core P/E and C20 P/B against a ROE-justified P/B."""
    out: dict[str, Criterion] = {}
    if core.blocked:
        for k, why in (("c19", "needs normalized core earnings"), ("c20", "needs core ROE")):
            out[k] = Criterion(None, None, "N_A", why)
        return out

    p = ctx.get("p_core_pe")
    out["c19"] = Criterion(_pctile_bands(p, C19_CORE_PE), ctx.get("core_pe"))
    if out["c19"].points is None:
        out["c19"] = Criterion(None, None, "N_A", "no core P/E history")

    ratio = ctx.get("pb_ratio")     # current P/B over justified P/B
    if ratio is None:
        out["c20"] = Criterion(None, None, "N_A", "no justified P/B")
    else:
        pts = 0
        for hi, p_ in C20_PB:
            if ratio <= hi:
                pts = p_
                break
        out["c20"] = Criterion(pts, ratio)
    return out


# ---------------------------------------------------------------------------
# Cycle /30 — C15 FCI, C16 ADTV momentum, C17 breadth, C18 sensitivity
# ---------------------------------------------------------------------------
# These are the daily half of the score. All three market inputs are read for
# the SCORE'S OWN DATE: a score built on yesterday's FCI is PRELIMINARY and must
# never be ranked, because the FCI job runs four hours after the TA job that
# produces breadth and ADTV.
C15_LEVEL = [(-1.0, 3), (-0.5, 2.5), (0.0, 1.75), (0.5, 0.75)]
C16_BASE = [(-.20, 0), (-.10, 1), (0, 2), (.10, 3), (.20, 5), (.30, 6)]

FCI_MIN_HISTORY = 250          # below this C15 speed is N/A, never 0
FCI_FULL_HISTORY = 500         # above this the percentile is HIGH confidence
REVERSAL_EXPIRY_SESSIONS = 10


def c15_level(fci: float | None) -> float | None:
    """FCI level /3. Convention: MORE NEGATIVE IS BETTER — a falling FCI is
    easing financial conditions, which is the tailwind a broker levers."""
    if fci is None:
        return None
    for hi, pts in C15_LEVEL:
        if fci <= hi:
            return pts
    return 0.0


def c15_speed(delta5: float | None, percentile: float | None, history_obs: int | None):
    """FCI improvement speed /4, as a point-in-time percentile of its own history.

    Returns (points, confidence). Below 250 observations this is N/A rather than
    0: a percentile computed from too little history is not a weak reading, it
    is not a reading.
    """
    if history_obs is None or history_obs < FCI_MIN_HISTORY:
        return None, "LOW"
    conf = "HIGH" if history_obs >= FCI_FULL_HISTORY else "MEDIUM"
    if delta5 is None or percentile is None:
        return None, conf
    if delta5 > 0:
        return 0, conf          # conditions worsening is never rewarded
    if delta5 == 0:
        return 1, conf
    if percentile <= .10:
        return 4, conf
    if percentile <= .25:
        return 3, conf
    if percentile <= .50:
        return 2, conf
    return 1, conf


def c15_reversal(event_valid: bool, prior_positive: int | None, negative_streak: int,
                 delta10: float | None, days_since: int | None):
    """FCI turn /3 — a CONFIRMED change of state, not a single flip.

    Magnitude belongs to speed; this scores persistence only, so the two cannot
    reward the same move twice. An event expires after 10 sessions, otherwise a
    turn last month keeps paying out during a deteriorating one.
    """
    if not event_valid or prior_positive is None or prior_positive < 3:
        return 0
    if days_since is None or days_since > REVERSAL_EXPIRY_SESSIONS:
        return 0
    if negative_streak >= 3 and delta10 is not None and delta10 < 0:
        return 3
    if negative_streak >= 2:
        return 2
    if negative_streak >= 1:
        return 1
    return 0


def c16_adtv(momentum: float | None, breadth: float | None,
             breadth_change_5d: float | None, breadth_valid: bool):
    """Liquidity momentum /8 = base /7 plus a breadth-confirmed bonus /1.

    The bonus is the whole reason C16 and C17 are not the same criterion. Volume
    rising while participation narrows is money concentrating into fewer names,
    which is not the broad liquidity a broker earns from — so the bonus
    withholds. Breadth can contribute at most 1 point here; carrying more of
    C17 across would double-count it.
    """
    if momentum is None:
        return None, 0
    base = 7
    for hi, pts in C16_BASE:
        if momentum < hi:
            base = pts
            break
    bonus = 0
    if momentum > 0 and breadth_valid and breadth is not None and breadth_change_5d is not None:
        if breadth_change_5d >= .02 or (breadth >= .50 and breadth_change_5d > 0):
            bonus = 1
    return min(8, base + bonus), bonus


def c17_breadth(breadth: float | None, d5: float | None, d10: float | None):
    """Market breadth /5 — first match wins, evaluated 5 down to 0.

    The design rewards early recovery over an already-extended market: rising
    fast off a low base scores 5, while high-but-weakening scores 2. Returns
    (points, matched_rule) so a score can be explained after the fact.
    """
    if None in (breadth, d5, d10):
        return None, None
    B = breadth
    if (B >= .60 and d5 >= 0 and d10 >= 0) or (B >= .35 and d5 >= .05 and d10 >= .10):
        return 5, "P1"
    if (B >= .50 and d5 >= 0) or (B < .35 and d5 >= .05 and d10 >= .10) or \
       (B >= .30 and d5 >= .03 and d10 >= .05):
        return 4, "P2"
    if (B >= .40 and d5 >= 0) or (B >= .50 and d5 > -.03):
        return 3, "P3"
    if (B >= .30 and d5 >= 0) or (B >= .40 and d5 > -.05) or (B >= .60 and d5 <= -.03):
        return 2, "P4"
    if (B < .30 and (d5 >= 0 or d10 >= 0)) or (B >= .30 and d5 <= -.05):
        return 1, "P5"
    return 0, "P6"


def score_cycle(market: dict, fci: dict, c18_locked_score: float | None = None):
    """C15-C18 from the day's market context."""
    out: dict[str, Criterion] = {}

    level = c15_level(fci.get("value"))
    speed, conf = c15_speed(fci.get("delta5"), fci.get("percentile"), fci.get("history_obs"))
    rev = c15_reversal(fci.get("event_valid", False), fci.get("prior_positive"),
                       fci.get("negative_streak", 0), fci.get("delta10"),
                       fci.get("days_since_reversal"))
    if level is None:
        out["c15"] = Criterion(None, None, "N_A", "no FCI for this date")
    else:
        # Speed alone can be N/A on short history; the level and reversal parts
        # still stand, so the criterion is partial rather than lost.
        total = level + (speed or 0) + rev
        out["c15"] = Criterion(total, fci.get("value"),
                               reason=f"level {level} + speed {speed} + reversal {rev} ({conf})")

    pts, bonus = c16_adtv(market.get("momentum"), market.get("breadth"),
                          market.get("breadth_change_5d"), market.get("breadth_valid", False))
    out["c16"] = Criterion(pts, market.get("momentum"),
                           "OK" if pts is not None else "N_A",
                           f"healthy bonus {bonus}" if pts is not None else "no ADTV momentum")

    pts, rule = c17_breadth(market.get("breadth"), market.get("breadth_change_5d"),
                            market.get("breadth_change_10d"))
    out["c17"] = Criterion(pts, market.get("breadth"),
                           "OK" if pts is not None else "N_A", rule or "breadth unavailable")

    # C18 stays N/A until its mapping is backtested and LOCKED. Its 7 points
    # leave the denominator; a hand-assigned value here is exactly what the
    # spec forbids, and the DB check constraint refuses to store one.
    if c18_locked_score is None:
        out["c18"] = Criterion(None, None, "N_A", "cycle-sensitivity mapping not LOCKED")
    else:
        out["c18"] = Criterion(c18_locked_score, None)
    return out


PUBLISH_THRESHOLD = 0.70
PROVISIONAL_THRESHOLD = 0.50


def assemble(criteria: dict[str, Criterion]) -> dict:
    """Totals, coverage and the publication gate.

    NORMALIZATION IS THE POINT: `earned / available_max`, where an N/A criterion
    leaves the DENOMINATOR rather than scoring zero. A broker whose filings do
    not disclose something is not a broker that scored badly at it, and the two
    must not be rendered as the same number. Coverage travels beside the score
    so a reader always knows how much of the rubric it rests on.

    COVERAGE IS NECESSARY, NOT SUFFICIENT. A symbol at 80% coverage with no
    valuation at all still fails: half the rubric's job is telling you what you
    are paying, and a score that silently drops it is not the same score. Core
    earnings likewise — every quality criterion worth having depends on it.
    """
    earned = 0.0
    available = 0.0
    per_block = {"quality": 0.0, "cycle": 0.0, "valuation": 0.0}
    for key, pts in CRITERION_POINTS.items():
        c = criteria.get(key)
        if c is None or c.points is None:
            continue
        earned += c.points
        available += pts
        block = ("quality" if key in QUALITY_CRITERIA
                 else "cycle" if key in CYCLE_CRITERIA else "valuation")
        per_block[block] += c.points

    coverage = available / sum(CRITERION_POINTS.values()) if available else 0.0
    normalized = (earned / available * 100) if available else None

    core_usable = any(criteria.get(k) and criteria[k].points is not None
                      for k in ("c1", "c2", "c3"))
    valuation_usable = any(criteria.get(k) and criteria[k].points is not None
                           for k in VALUATION_CRITERIA)

    if not core_usable or not valuation_usable:
        status = "INVALID_CRITICAL"
    elif coverage < PROVISIONAL_THRESHOLD:
        status = "INSUFFICIENT_COVERAGE"
    elif coverage < PUBLISH_THRESHOLD:
        status = "PROVISIONAL"
    else:
        status = "PUBLISHABLE"

    return {
        "earned_score": round(earned, 2),
        "available_max": round(available, 2),
        "coverage": round(coverage, 4),
        "normalized_fa_score": round(normalized, 2) if normalized is not None else None,
        "quality_score": round(per_block["quality"], 2),
        "cycle_score": round(per_block["cycle"], 2),
        "valuation_score": round(per_block["valuation"], 2),
        "fa_status": status,
        "core_usable": core_usable,
        "valuation_usable": valuation_usable,
        "dependency_flags": {k: {"status": c.status, "reason": c.reason}
                             for k, c in criteria.items()
                             if c.points is None},
    }
