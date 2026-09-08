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

import math

from dataclasses import dataclass, field

# V9. A NEW STRING, not an edit of V8: C20 changes from a scored criterion to an
# excluded one, which moves every broker's denominator, so V8 rows must stay
# readable as what they were. Governance rule G6 — lock by issuing a version,
# never by rewriting history.
MODEL_VERSION = "CTCK_V11v3"

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
# C13 asset quality. Provisions against financial assets and doubtful debts are
# what a broker books when its receivables or bond holdings sour, so the charge
# scaled by the assets it protects is the observable proxy the rubric asks for.
# The overdue-receivable detail it also names lives only in the notes, which the
# provider does not carry — so this is the provision half, and the criterion is
# labelled for what it measures.
PROVISION_EXPENSE = "IS_PROVISION_EXPENSES_FOR_FINANCIAL_ASSETS_AND_DOUBTFUL_DEBTS"
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
# Both are 2-point criteria, so three bands rather than five — a finer scale
# than the evidence supports would be false precision.
C13_ASSET_QUALITY = [(.33, 2), (.67, 1), (1.0, 0)]
C14_STABILITY = [(.33, 2), (.67, 1), (1.0, 0)]
C20_PB = [(.75, 12), (.90, 9), (1.10, 6), (1.25, 3)]

# Criteria with no data source at all today. Both are N/A for every broker, and
# both are honest gaps rather than bugs:
#   C4/C5 broker market share — HOSE/HNX publish a quarterly top-10 press
#         release; it is not in the provider and the rubric defers it.
#   C9 ATTC (tỷ lệ an toàn tài chính) — a separate UBCK filing. Checked all 45
#         ratio ids a broker carries: nothing matching capital adequacy.
# Together with C18 (N/A until its mapping is backtested) they cap coverage at
# 82%, which is why the publish gate sits at 70 and not higher.
# V11v2 sheet 45: C4 is OFFICIAL-or-nothing. The V11 draft allowed a
# "minimum active broker" proxy worth 1/4, and BA withdrew it after we showed
# what it does arithmetically — every active broker scores the same 1/4, which
# adds 1 to every numerator and 4 to every denominator and so drags the whole
# sector toward 25% while separating nobody. A criterion that cannot rank is
# not a weak measurement, it is no measurement.
UNSOURCED_CRITERIA = {
    "c4": "broker market share not published by the provider",
}

# --- C9 (V11v3 sheet 46) — capital safety ----------------------------------
# The OFFICIAL measure is the ATTC ratio (tỷ lệ an toàn tài chính), a separate
# UBCK filing: all 45 ratio ids a broker carries were checked and none is it.
# So only the proxy runs, and it is PROVISIONAL for that reason — not because
# the brokers are unsafe.
#
# THE PROXY'S SCOPE IS DECLARED, NOT IMPLIED. Sheet 46 defines RiskAssets as
# margin loans + FVTPL + FVOCI + corporate bonds held + risky receivables, and
# BA confirmed in writing that only the first three are mappable: bonds HELD
# are not a separate line (BS_SHORT_TERM_BONDS / BS_LONG_TERM_BONDS are
# LIABILITIES — the broker's own issuance, already inside BS_DEBT), and there
# is no principled subset of the ~20 receivable lines that means "risky". The
# tooltip must therefore never claim this proxy covers them.
C9_RISK_ASSETS = [BS_MARGIN, "BS_FVTPL_FINANCIAL_ASSETS",
                  "BS_AVAILABLE_FOR_SALE_FINANCIAL_ASSETS_AFS"]

# Safety percentile bands. HIGHER percentile = SAFER = lower RiskAssets/Equity.
# The proxy is capped at 3 of 4: a full mark is reserved for the official CAR,
# because a broker that merely ranks well among peers on three balance-sheet
# lines has not demonstrated regulatory capital adequacy.
C9_PROXY_BANDS = [(80, 3), (50, 2), (20, 1)]
C9_PROXY_CODES = {3: "C9_PROXY_TOP20", 2: "C9_PROXY_50_80",
                  1: "C9_PROXY_20_50", 0: "C9_PROXY_BOTTOM20"}
C9_MIN_SAMPLE = 20


def risk_assets_ratio(balance_q: dict, equity: float | None) -> float | None:
    """RiskAssets / Equity for one quarter, or None if it cannot be formed.

    A MISSING component is not a zero. Sheet 46 is explicit: if any required
    field is absent, or equity is non-positive, C9 is N/A with available_max 0
    — because coalescing a missing line to 0 would make an under-reporting
    broker look like the safest in the sector, which is the exact inversion the
    criterion is supposed to catch.
    """
    if not equity or equity <= 0:
        return None
    total = 0.0
    for key in C9_RISK_ASSETS:
        v = balance_q.get(key)
        if v is None:
            return None
        total += float(v)
    return total / equity


def score_c9_proxy(percentile: float | None, sample_n: int) -> Criterion:
    """C9 from the safety percentile. `percentile` is 0-100, higher = safer."""
    if sample_n < C9_MIN_SAMPLE:
        return Criterion(None, None, "N_A",
                         "no sector distribution — fewer than 20 brokers with "
                         "a complete risk-asset proxy",
                         code="C9_INSUFFICIENT_SAMPLE")
    if percentile is None:
        return Criterion(None, None, "N_A",
                         "risk-asset proxy unavailable — a required balance "
                         "sheet line is missing, or equity is not positive",
                         code="C9_INSUFFICIENT_DATA")
    pts = _bands_desc(percentile, C9_PROXY_BANDS)
    return Criterion(pts, round(percentile, 2), "OK",
                     f"safety percentile {percentile:.0f} on the risk-asset "
                     f"proxy; capped at 3/4 without an official CAR",
                     tier=TIER_PROVISIONAL, method="RISK_ASSET_PROXY",
                     confidence="MEDIUM", code=C9_PROXY_CODES[int(pts)])

# C5 PROXY (sheet 45): brokerage gross-profit growth against the market's own
# trading-value growth. The question C5 asks is whether the broker is winning
# or losing share, and the honest reading without a share filing is whether its
# brokerage line grew FASTER than the market it operates in — a broker whose GP
# rose 18% in a market that rose 10% took share from somebody.
#
# Bands are on the SPREAD in percentage points, and it is provisional: the
# proxy answers a neighbouring question, not the same one.
C5_PROXY_BANDS = [(0.10, 3), (0.0, 2), (-0.10, 1)]
C5_PROXY_CODES = {3: "C5_PROXY_STRONG", 2: "C5_PROXY_STABLE",
                  1: "C5_PROXY_SOFT", 0: "C5_PROXY_WEAK"}

# C5 OFFICIAL (sheet 45): the change in market share itself, in PERCENTAGE
# POINTS, between two comparable quarters — same exchange scope, same legal
# entity. Nothing feeds this until BA's quarterly upload lands; it is written
# now so the upload is the only thing missing when it does, and so the proxy
# above can never outrank a real filing.
C5_OFFICIAL_BANDS = [(0.5, 3), (0.0, 2), (-0.5, 1)]
C5_OFFICIAL_CODES = {3: "C5_OFFICIAL_STRONG", 2: "C5_OFFICIAL_STABLE",
                     1: "C5_OFFICIAL_SOFT", 0: "C5_OFFICIAL_WEAK"}


def score_c5_proxy(gp_yoy: float | None, adtv_yoy: float | None) -> Criterion:
    """C5 from the brokerage-GP / market-ADTV growth spread.

    Missing EITHER input is N/A, never 0 (sheet 45: "Missing một input => N/A").
    A broker whose market context we cannot measure has not lost share.
    """
    if gp_yoy is None or adtv_yoy is None:
        return Criterion(None, None, "N_A",
                         "no market share filing and no usable growth proxy")
    spread = gp_yoy - adtv_yoy
    pts = _bands_desc(spread, C5_PROXY_BANDS)
    return Criterion(pts, spread, "OK",
                     f"brokerage GP growth {spread:+.1%} vs market ADTV",
                     tier=TIER_PROVISIONAL, method="PROXY", confidence="MEDIUM",
                     code=C5_PROXY_CODES[int(pts)])


# ---------------------------------------------------------------------------
# C20 (V11v2 sheet 48) — P/B against normalized WHOLE-FIRM ROE, cross-section.
#
# V9 withdrew C20 because the V8 formula (justified P/B = Core_ROE / CoE at
# g = 0) scored 0 for all 30 brokers that could be read at all: it compared a
# CORE-only ROE against a whole-firm cost of equity while the market prices the
# prop desk too, and it assumed zero growth for a cyclical sector. V9 then
# deliberately did NOT build the peer-residual replacement, because a regression
# without minimum-sample, stability and no-look-ahead rules repeats the mistake
# it replaces. V11v2 sheet 48 supplies all three, so it is built here.
#
# Both sides now describe the same entity: whole-firm P/B against whole-firm
# normalized ROE. The model is refit for EVERY as_of_date — brokers reprice
# daily, and a coefficient carried over from another session would rank today's
# prices against yesterday's relationship.
C20_V11_BANDS = [(80, 12), (60, 9), (40, 6), (20, 3)]
C20_V11_CODES = {12: "C20_CHEAP_TOP20", 9: "C20_CHEAP_60_80", 6: "C20_MID",
                 3: "C20_EXPENSIVE_20_40", 0: "C20_EXPENSIVE_BOTTOM20"}
C20_MIN_SAMPLE = 20
C20_WINSOR = 0.05
C20_MIN_BUCKET = 5


def _winsorize(values: list[float], frac: float) -> list[float]:
    """Clip the top and bottom `frac` of the distribution to its own quantiles.

    Symmetric by construction: the same COUNT is clipped at each end, so the
    trim cannot shift the mean on its own. A sample too small to spare a point
    at each end is returned untouched rather than collapsed.
    """
    if not values:
        return []
    s = sorted(values)
    lo_i = int(len(s) * frac)
    hi_i = len(s) - 1 - lo_i
    if hi_i <= lo_i:
        return list(values)
    lo, hi = s[lo_i], s[hi_i]
    return [min(max(v, lo), hi) for v in values]


def _avg_rank_percentile(values: dict[str, float], ascending: bool) -> dict[str, float]:
    """0-100 percentile with AVERAGE rank for ties (sheet 48 tie rule)."""
    if not values:
        return {}
    items = sorted(values.items(), key=lambda kv: kv[1], reverse=not ascending)
    n = len(items)
    out: dict[str, float] = {}
    i = 0
    while i < n:
        j = i
        while j + 1 < n and items[j + 1][1] == items[i][1]:
            j += 1
        rank = (i + j) / 2.0
        pct = 100.0 * rank / (n - 1) if n > 1 else 50.0
        for k in range(i, j + 1):
            out[items[k][0]] = pct
        i = j + 1
    return out


def c20_cross_section(observations: dict[str, tuple[float, float]],
                      min_sample: int = C20_MIN_SAMPLE) -> dict:
    """Fit ln(P/B) ~ normalized total ROE across the peer group; score residuals.

    `observations` is {symbol: (current_pb, normalized_total_roe)}; a symbol
    reaches it only with P/B > 0 and at least 6 of 8 valid ROE quarters, both
    enforced by the caller.

    Returns {"model": {...}, "scores": {symbol: Criterion}}. Below `min_sample`
    NOTHING is scored — that is sheet 48's rule and it is the difference
    between "this broker is expensive" and "we could not price the sector".

    THE FIT IS WINSORIZED BUT THE RESIDUAL IS NOT. Trimming the tails stops one
    outlier from tilting the line, which is what winsorizing is for; measuring
    a symbol's residual against a trimmed version of its OWN price would then
    hide exactly the extreme cheapness or dearness the criterion exists to find.
    """
    valid = {s: (pb, roe) for s, (pb, roe) in observations.items()
             if pb is not None and roe is not None and pb > 0}
    n = len(valid)
    if n < min_sample:
        return {"model": {"n": n, "status": "INSUFFICIENT_SAMPLE"}, "scores": {}}

    syms = sorted(valid)
    y = [math.log(valid[s][0]) for s in syms]
    x = [valid[s][1] for s in syms]
    xw, yw = _winsorize(x, C20_WINSOR), _winsorize(y, C20_WINSOR)

    mx = sum(xw) / n
    my = sum(yw) / n
    sxx = sum((v - mx) ** 2 for v in xw)
    if sxx <= 0:
        # Degenerate, not merely weak: every broker has the same ROE, so the
        # line has no slope to estimate. A LOW R-squared is NOT this case — a
        # weak relation is a real finding and still ranks. Falls through to the
        # ROE-bucket fallback below.
        return _c20_bucket_fallback(valid, syms)
    b = sum((xv - mx) * (yv - my) for xv, yv in zip(xw, yw)) / sxx
    a = my - b * mx
    syy = sum((v - my) ** 2 for v in yw)
    ss_res = sum((yv - (a + b * xv)) ** 2 for xv, yv in zip(xw, yw))
    r2 = (1 - ss_res / syy) if syy > 0 else None

    residual = {s: y[i] - (a + b * x[i]) for i, s in enumerate(syms)}
    # Cheapest = most NEGATIVE residual = trading below what its ROE justifies,
    # so cheapness percentile ranks residuals DESCENDING.
    cheapness = _avg_rank_percentile(residual, ascending=False)

    scores = {}
    for s in syms:
        pct = cheapness[s]
        pts = _bands_desc(pct, C20_V11_BANDS)
        scores[s] = Criterion(
            pts, round(pct, 2), "OK",
            f"cheapness percentile {pct:.0f} against peer P/B-ROE fit",
            tier=TIER_PROVISIONAL, method="PB_ROE_CROSS_SECTION",
            confidence="MEDIUM", code=C20_V11_CODES[int(pts)])
    return {"model": {"a": a, "b": b, "r2": r2, "n": n,
                      "status": "CROSS_SECTION",
                      "residual": {s: round(residual[s], 6) for s in syms},
                      "cheapness": {s: round(cheapness[s], 2) for s in syms}},
            "scores": scores}


def _c20_bucket_fallback(valid: dict, syms: list[str]) -> dict:
    """Sheet 48 fallback: compare P/B to the median P/B of its own ROE bucket.

    Used only when the regression is DEGENERATE. Buckets are quartiles of ROE;
    a bucket under C20_MIN_BUCKET members scores nobody.
    """
    roes = sorted(valid[s][1] for s in syms)
    q = [roes[int(len(roes) * f)] for f in (0.25, 0.50, 0.75)]

    def bucket(roe: float) -> int:
        return sum(1 for t in q if roe >= t)

    groups: dict[int, list[str]] = {}
    for s in syms:
        groups.setdefault(bucket(valid[s][1]), []).append(s)

    scores = {}
    for members in groups.values():
        if len(members) < C20_MIN_BUCKET:
            continue
        pbs = sorted(valid[s][0] for s in members)
        med = pbs[len(pbs) // 2]
        if med <= 0:
            continue
        rel = {s: valid[s][0] / med - 1 for s in members}
        cheapness = _avg_rank_percentile(rel, ascending=False)
        for s in members:
            pts = _bands_desc(cheapness[s], C20_V11_BANDS)
            scores[s] = Criterion(
                pts, round(cheapness[s], 2), "OK",
                f"cheapness percentile {cheapness[s]:.0f} within its ROE bucket",
                tier=TIER_PROVISIONAL, method="PB_ROE_BUCKET_MEDIAN",
                confidence="LOW", code=C20_V11_CODES[int(pts)])
    return {"model": {"n": len(syms), "status": "BUCKET_FALLBACK",
                      "buckets": {k: len(v) for k, v in groups.items()}},
            "scores": scores}


# Machine-readable reasons, so a UI can group and a query can filter. The free
# text stays for humans; the code is what tooling reads.
REASON_CODES = [
    ("no eligible funding cost", "FUNDING_MISSING"),
    ("downstream of an unusable", "FUNDING_MISSING"),
    ("market share not published", "NO_SOURCE_MARKET_SHARE"),
    ("ATTC", "NO_SOURCE_ATTC"),
    ("mapping not LOCKED", "C18_UNLOCKED"),
    ("formula withdrawn", "C20_WITHDRAWN_V9"),
    ("no core P/E history", "C19_INSUFFICIENT_HISTORY"),
    ("no positive core", "C19_NO_POSITIVE_CORE"),
    ("no market cap", "C19_NO_MARKET_CAP"),
    ("no sector distribution", "NO_PEER_DISTRIBUTION"),
    ("needs 8+ quarters", "SHORT_CORE_HISTORY"),
    ("no provision or earning-asset", "NO_PROVISION_DATA"),
    ("reported NPAT <= 0", "SPECIAL_CASE_NEG_NPAT"),
    ("no average equity", "NO_EQUITY"),
    ("no positive prior-year core", "NO_PRIOR_CORE"),
]


def reason_code(reason: str | None) -> str | None:
    if not reason:
        return None
    for needle, code in REASON_CODES:
        if needle.lower() in reason.lower():
            return code
    return "OTHER"


# V11v2 (sheet 44): the OFFICIAL score is built from LOCKED criteria only, and
# a PROVISIONAL one leaves BOTH the numerator and the denominator — it is not a
# low score, it is a measurement whose method has not passed its gate yet.
#
# The tier is a property of the METHOD, not of the criterion: C5 scored from a
# verified market-share filing is locked, the same C5 derived from the
# brokerage-GP/ADTV spread is provisional. So it travels on the Criterion, set
# by whichever scorer produced it, rather than living in a static list here.
# Ties out against the sheet-53 fixture: with C4/C5/C9 unavailable the locked
# quality block is C1,C2,C3,C6,C7,C8,C10..C14 = 39, which is QA_B exactly.
TIER_LOCKED = "LOCKED"
TIER_PROVISIONAL = "PROVISIONAL"

# The two criteria that stay provisional REGARDLESS of method, because what
# gates them is a model validation (G2) rather than a data source. Everything
# else takes its tier from how it was measured — C9 is provisional in practice
# only because the official CAR filing is absent from the provider, so it is
# NOT listed here: the sheet-53 fixture's QA_A carries an official CAR and
# expects those 4 points inside the locked maximum of 50.
ALWAYS_PROVISIONAL = frozenset({"c18", "c20"})


@dataclass
class Criterion:
    points: float | None = None
    value: float | None = None
    status: str = "OK"          # OK|N_A|SPECIAL_CASE|PROVISIONAL_INVALID
    reason: str = ""
    tier: str = TIER_LOCKED     # LOCKED | PROVISIONAL
    method: str | None = None   # OFFICIAL | PROXY | DERIVED | SYSTEM
    confidence: str | None = None   # HIGH | MEDIUM | LOW | NONE
    # An EXPLICIT reason code, where the scorer already knows which band it hit.
    # `reason_code()` infers one by matching substrings of free text, which is
    # right for the older criteria whose reasons are prose but wrong for a band
    # table that has a code per row — inference would return OTHER for all of
    # them.
    code: str | None = None

    def contract(self, key: str) -> dict:
        """The per-criterion shape the API and the table both read.

        `available_max` is 0 when the criterion is N/A — that is what takes it
        out of the denominator, and what lets the UI print a real fraction
        instead of the rubric's static maximum.
        """
        scored = self.points is not None
        tier = TIER_PROVISIONAL if key in ALWAYS_PROVISIONAL else self.tier
        return {
            "earned": self.points,
            "available_max": CRITERION_POINTS[key] if scored else 0,
            "static_max": CRITERION_POINTS[key],
            "status": "VALID" if scored else (
                "SHADOW" if self.status == "PROVISIONAL_INVALID" else "N_A"),
            "tier": tier if scored else None,
            "method": self.method,
            "confidence": self.confidence or ("NONE" if not scored else None),
            "reason_code": self.code or reason_code(self.reason),
            "value": self.value,
        }

    def effective_tier(self, key: str) -> str:
        return TIER_PROVISIONAL if key in ALWAYS_PROVISIONAL else self.tier


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

    # C9 capital safety — injected by the caller from the peer cross-section,
    # since a percentile cannot be computed from one symbol's own numbers.
    out["c9"] = ctx.get("c9_criterion") or Criterion(
        None, None, "N_A",
        "no sector distribution — the risk-asset proxy could not be ranked",
        code="C9_INSUFFICIENT_SAMPLE")

    # C5 share growth. OFFICIAL (a verified market-share filing, two comparable
    # quarters) outranks the proxy absolutely; the proxy only runs when there is
    # no filing, and is provisional when it does. Neither available => N/A.
    if ctx.get("share_delta_pp") is not None:
        d = ctx["share_delta_pp"]
        pts = _bands_desc(d, C5_OFFICIAL_BANDS)
        out["c5"] = Criterion(pts, d, "OK",
                              f"market share {d:+.2f} điểm % year on year",
                              method="OFFICIAL", confidence="HIGH",
                              code=C5_OFFICIAL_CODES[int(pts)])
    else:
        out["c5"] = score_c5_proxy(ctx.get("brokerage_gp_yoy"),
                                   ctx.get("market_adtv_yoy"))

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

    # C13 asset quality — provision charge against the assets it covers, ranked.
    out["c13"] = Criterion(_pctile_bands(ctx.get("p_asset_risk"), C13_ASSET_QUALITY),
                           ctx.get("asset_risk"))
    if out["c13"].points is None:
        na("c13", "no provision or earning-asset figure")

    # C14 durability — how steady the core return has been, not how high.
    # Needs a real history: eight quarters is the floor, below which the
    # dispersion of three or four readings is noise rather than a character.
    if blocked or ctx.get("core_history_n", 0) < C14_MIN_QUARTERS:
        na("c14", f"needs {C14_MIN_QUARTERS}+ quarters of core history")
    else:
        out["c14"] = Criterion(_pctile_bands(ctx.get("p_stability"), C14_STABILITY),
                               ctx.get("stability"))
        if out["c14"].points is None:
            na("c14", "no sector distribution")
    return out


C14_MIN_QUARTERS = 8


def core_roe_volatility(core_roes: list[float]) -> float | None:
    """Dispersion of core ROE, penalised for loss quarters.

    Coefficient of variation on the absolute mean, so a broker whose core return
    swings between +12% and -2% is not flattered by the two cancelling out. The
    loss frequency is added rather than averaged in: a quarter of core LOSSES is
    a different fact from a quarter of merely low returns, and the rubric asks
    for downside resilience, not just variance.
    """
    vals = [v for v in core_roes if v is not None]
    if len(vals) < C14_MIN_QUARTERS:
        return None
    mean = sum(vals) / len(vals)
    if mean == 0:
        return None
    var = sum((v - mean) ** 2 for v in vals) / len(vals)
    cv = (var ** 0.5) / abs(mean)
    return cv + sum(1 for v in vals if v < 0) / len(vals)


def score_valuation(core: CoreResult, ctx: dict) -> dict[str, Criterion]:
    """C19 core P/E and C20 P/B against a ROE-justified P/B."""
    out: dict[str, Criterion] = {}
    if core.blocked:
        for k, why in (("c19", "needs normalized core earnings"), ("c20", "needs core ROE")):
            out[k] = Criterion(None, None, "N_A", why)
        return out

    # Three separate failures, reported separately (V10 sheet 37): a broker with
    # negative core earnings, one with no market cap, and one with too short a
    # history are three different problems, and collapsing them into one message
    # is what made the regression look like missing data rather than a bug.
    p = ctx.get("p_core_pe")
    pts = _pctile_bands(p, C19_CORE_PE)
    if pts is not None:
        out["c19"] = Criterion(pts, ctx.get("core_pe"))
    elif not ctx.get("has_market_cap", True):
        out["c19"] = Criterion(None, None, "N_A", "no market cap")
    elif ctx.get("core_pe") is None:
        out["c19"] = Criterion(None, None, "N_A", "no positive core earnings")
    else:
        out["c19"] = Criterion(None, None, "N_A", "no core P/E history")

    # C20 is now scored by the CROSS-SECTIONAL model (V11v2 sheet 48), computed
    # once for the whole peer group and injected here by the caller — a per
    # symbol formula cannot rank a symbol against its peers.
    #
    # It stays PROVISIONAL until C20-G2 passes, so its 12 points reach
    # `provisional_score` and never `final_fa_score`. That is a statement about
    # the METHOD's maturity, not about any broker.
    #
    # The history matters for reading the code: V8's justified P/B (Core_ROE /
    # CoE at g = 0) scored 0 for ALL 30 readable brokers — not a criterion
    # finding everyone expensive, a criterion that could not discriminate — so
    # V9 withdrew it rather than retune bands over a scope mismatch (core-only
    # ROE against a whole-firm cost of equity). V11v2 fixes the scope: whole
    # firm on both sides, ranked against peers instead of an absolute threshold.
    #
    # Absent an injected score the criterion is N/A with its 12 points OUT of
    # the denominator — never 0. 0 says "measured, worst case"; N/A says "no
    # valid measurement exists", and below the 20-symbol minimum it is the
    # second.
    injected = ctx.get("c20_criterion")
    out["c20"] = injected if injected is not None else Criterion(
        None, ctx.get("current_pb"), "N_A",
        "no sector distribution — fewer than 20 comparable brokers, "
        "or no usable P/B and normalized ROE",
        code="C20_INSUFFICIENT")
    return out


# --- C18 (V11v3 sheet 47) — how much THIS broker benefits from the cycle ----
#
# Not a price beta. Price beta measures how the SHARE moves with the market,
# which is a different question and one the TA half of the platform already
# answers; C18 asks how the broker's own OPERATIONS respond when market
# activity rises. Two brokers with identical price betas can have completely
# different exposure to trading volume.
#
# Two methods, routed on how much comparable history the broker has. Both end
# in a sector percentile, because "benefits strongly" is only meaningful
# relative to peers measured on the same quarters.
C18_ROUTE_HISTORICAL = 12     # quarterly pairs required for the regression
C18_ROUTE_PROXY = 8           # below this, nothing is scored
C18_MIN_SAMPLE = 15           # peers needed before a percentile means anything
C18_WINSOR = 0.05
C18_BANDS = [(80, 7), (60, 5), (40, 3), (20, 2)]
C18_CODES = {7: "C18_BENEFIT_VERY_STRONG", 5: "C18_BENEFIT_STRONG",
             3: "C18_BENEFIT_MEDIUM", 2: "C18_BENEFIT_LOW",
             0: "C18_BENEFIT_MINIMAL"}
C18_WEIGHTS = {"brokerage": 0.30, "margin": 0.30, "prop": 0.15, "oplev": 0.25}
# Operating leverage only reads quarters where the market actually moved: a
# ratio of two near-zero changes is noise amplified, not sensitivity.
C18_OPLEV_MIN_MARKET_MOVE = 0.05
C18_OPLEV_CAP = 5.0


def ols_slope(xs: list[float], ys: list[float],
              winsor: float = C18_WINSOR) -> float | None:
    """Winsorized OLS slope of y on x, or None when x has no variance.

    Winsorized because a single blowout quarter — a market that doubled, a
    broker that swung from loss to profit — otherwise sets the slope for the
    whole window.
    """
    if len(xs) != len(ys) or len(xs) < 3:
        return None
    xw, yw = _winsorize(xs, winsor), _winsorize(ys, winsor)
    n = len(xw)
    mx, my = sum(xw) / n, sum(yw) / n
    sxx = sum((v - mx) ** 2 for v in xw)
    if sxx <= 0:
        return None
    return sum((a - mx) * (b - my) for a, b in zip(xw, yw)) / sxx


def median_response(pairs: list[tuple[float, float]]) -> float | None:
    """Median of firm-change / market-change, over quarters the market moved.

    Deliberately a median of RATIOS rather than a regression: operating
    leverage is a multiplier, and one quarter where the market barely moved
    would produce an enormous ratio that a mean or a slope would carry.
    """
    vals = []
    for firm, market in pairs:
        if market is None or firm is None or abs(market) < C18_OPLEV_MIN_MARKET_MOVE:
            continue
        r = firm / market
        vals.append(max(-C18_OPLEV_CAP, min(C18_OPLEV_CAP, r)))
    if not vals:
        return None
    vals.sort()
    m = len(vals) // 2
    return vals[m] if len(vals) % 2 else (vals[m - 1] + vals[m]) / 2


def c18_components(history: list[dict], market_yoy: dict[str, float],
                   index_return: dict[str, float]) -> dict:
    """The four historical sensitivities for one broker.

    `history` is newest-first TTM windows (from core_history); `market_yoy` and
    `index_return` are keyed by quarter label. Each component returns a raw
    sensitivity or None — None means "not measurable", never 0.
    """
    def series(field):
        out = []
        for h in history:
            q = h.get("quarter")
            v = h.get(field)
            if q is None or v is None:
                continue
            out.append((q, v))
        return out

    def paired(field, driver):
        xs, ys = [], []
        for q, v in series(field):
            d = driver.get(q)
            if d is None:
                continue
            xs.append(d)
            ys.append(v)
        return xs, ys

    xs, ys = paired("brokerage_gp_yoy", market_yoy)
    brokerage = ols_slope(xs, ys)
    xs, ys = paired("margin_net_yoy", market_yoy)
    margin = ols_slope(xs, ys)
    xs, ys = paired("prop_return_on_equity", index_return)
    prop = ols_slope(xs, ys)
    oplev = median_response(
        [(v, market_yoy.get(q)) for q, v in series("core_npat_yoy")])
    obs = max(len(paired("brokerage_gp_yoy", market_yoy)[0]),
              len(paired("margin_net_yoy", market_yoy)[0]))
    return {"brokerage": brokerage, "margin": margin, "prop": prop,
            "oplev": oplev, "obs": obs}


def c18_exposure(history: list[dict]) -> dict:
    """Fallback: how much of the profit pool each cyclical line already is.

    Used when there is not enough history to regress. It answers a WEAKER
    question — "how exposed is this broker" rather than "how has it actually
    responded" — which is why it is LOW/MEDIUM confidence and why the router
    prefers the historical method whenever it can run.

    A LOSS-MAKING prop desk is not negative exposure to a good market; it is
    an unmeasurable one, so only positive contributions enter the pool.
    """
    if not history:
        return {"brokerage": None, "margin": None, "prop": None,
                "oplev": None, "obs": 0}
    cur = history[0]
    pool = 0.0
    for f in ("brokerage_gp", "margin_net", "prop_pnl"):
        v = cur.get(f)
        if v is not None and v > 0:
            pool += v
    if pool <= 0:
        return {"brokerage": None, "margin": None, "prop": None,
                "oplev": None, "obs": len(history)}

    def share(f):
        v = cur.get(f)
        return (max(v, 0.0) / pool) if v is not None else None

    eq = cur.get("avg_equity")
    core_op = cur.get("core_pbt")
    return {
        "brokerage": share("brokerage_gp"),
        "margin": share("margin_net"),
        "prop": share("prop_pnl"),
        "oplev": (core_op / eq) if (core_op is not None and eq) else None,
        "obs": len(history),
    }


def c18_composite(per_symbol: dict[str, dict], min_sample: int = C18_MIN_SAMPLE
                  ) -> dict[str, float]:
    """Weighted composite of each component's SECTOR percentile.

    Percentiles per component rather than raw values, because the four are on
    incompatible scales — a regression slope against a profit share against a
    return on equity. A symbol missing a component is dropped from THAT
    component's ranking only, and its composite re-weights over what remains,
    so one absent input does not silently score it as least cyclical.
    """
    pct_by_component: dict[str, dict[str, float]] = {}
    for comp in C18_WEIGHTS:
        vals = {s: d[comp] for s, d in per_symbol.items() if d.get(comp) is not None}
        if len(vals) < min_sample:
            continue
        pct_by_component[comp] = _avg_rank_percentile(vals, ascending=True)

    out = {}
    for sym in per_symbol:
        num = den = 0.0
        for comp, w in C18_WEIGHTS.items():
            p = pct_by_component.get(comp, {}).get(sym)
            if p is None:
                continue
            num += w * p
            den += w
        if den > 0:
            out[sym] = num / den
    return out


def score_c18(percentile: float | None, method: str, obs: int) -> Criterion:
    """Map the composite percentile to points, or explain why it cannot be."""
    if obs < C18_ROUTE_PROXY:
        return Criterion(None, None, "N_A",
                         f"only {obs} comparable quarters; C18 needs at least "
                         f"{C18_ROUTE_PROXY}",
                         code="C18_INSUFFICIENT_HISTORY")
    if percentile is None:
        return Criterion(None, None, "N_A",
                         "no sector distribution — too few peers carry the same "
                         "components on this session",
                         code="C18_INSUFFICIENT_HISTORY")
    pts = _bands_desc(percentile, C18_BANDS)
    conf = "MEDIUM" if method == "HISTORICAL_SENSITIVITY" else "LOW"
    return Criterion(pts, round(percentile, 2), "OK",
                     f"cycle-benefit percentile {percentile:.0f} ({method})",
                     tier=TIER_PROVISIONAL, method=method, confidence=conf,
                     code=C18_CODES[int(pts)])


# --- C20 shadow: raw values only, never a score ----------------------------
# Two candidate replacements are computed and stored so a backtest has
# something to work on, and NEITHER can reach a score: the lock gate requires
# discrimination, monotonicity, out-of-sample and regime checks first. Storing
# raw is what makes it possible to choose a method on evidence rather than on
# which one produced a nicer distribution.

G_SENSITIVITY = (0.0, 0.02, 0.035, 0.05)


def justified_pb(roe: float | None, coe: float | None, g: float) -> float | None:
    """Gordon justified P/B = (ROE - g) / (CoE - g).

    Fails CLOSED on both degenerate cases rather than returning a number:
    `CoE <= g` makes the denominator zero or negative (a company growing at or
    above its cost of equity is worth infinity, which is a modelling artefact,
    not a valuation), and `ROE <= g` cannot be financed out of its own returns.
    """
    if roe is None or coe is None:
        return None
    if coe <= g or roe <= g:
        return None
    return (roe - g) / (coe - g)


def c20_shadow_a(current_pb: float | None, normalized_total_roe: float | None,
                 coe: float | None) -> dict:
    """Absolute justified P/B across a range of growth assumptions.

    Uses NORMALIZED TOTAL ROE — core plus a normalized non-core contribution —
    because the numerator being priced is the whole firm. That is the scope
    mismatch the V8 formula had, and it is the reason it read every broker as
    expensive rather than only some of them.

    `g` is deliberately a RANGE, not a choice. Picking the growth rate that
    makes the distribution look best is fitting the assumption to the answer.
    """
    out = {"current_pb": current_pb, "normalized_total_roe": normalized_total_roe,
           "cost_of_equity": coe, "by_g": {}}
    for g in G_SENSITIVITY:
        jpb = justified_pb(normalized_total_roe, coe, g)
        out["by_g"][f"{g:.3f}"] = {
            "justified_pb": jpb,
            "pb_ratio": (current_pb / jpb) if (jpb and current_pb) else None,
            "valid": jpb is not None,
        }
    return out


def normalize_noncore(series: list[float], winsor: float = 0.10) -> dict:
    """Normalized non-core earnings, BOTH candidate methods plus the downside.

    Median and winsorized mean are stored side by side because neither is
    chosen yet, and the downside statistics are mandatory: a method that
    discards loss quarters would make a prop-heavy broker look like a steady one,
    which is precisely the risk C12 exists to catch.
    """
    vals = sorted(v for v in series if v is not None)
    n = len(vals)
    if n == 0:
        return {"n": 0, "median": None, "winsor_mean": None, "p10": None,
                "min": None, "loss_frequency": None}
    mid = n // 2
    median = vals[mid] if n % 2 else (vals[mid - 1] + vals[mid]) / 2
    k = int(n * winsor)
    clipped = vals[k:n - k] if n - 2 * k > 0 else vals
    lo, hi = clipped[0], clipped[-1]
    winsor_mean = sum(min(max(v, lo), hi) for v in vals) / n
    p10 = vals[max(0, int(n * 0.10) - 1)]
    return {"n": n, "median": median, "winsor_mean": winsor_mean, "p10": p10,
            "min": vals[0], "loss_frequency": sum(1 for v in vals if v < 0) / n}


def c20_shadow_b(current_pb: float | None, pb_history: list[float]) -> dict:
    """Relative P/B against the company's OWN history.

    Only the own-history half of C20-B. The peer-residual model
    (`ln(P/B) = a + b·ROE + cluster fixed effects`) is NOT built: it carries its
    own minimum-sample, coefficient-stability and no-look-ahead requirements,
    and a regression shipped without them would be the same mistake as the
    formula it replaces — a number that looks like a measurement.
    """
    hist = [v for v in pb_history if v is not None and v > 0]
    if current_pb is None or len(hist) < 8:
        return {"pb_hist_percentile": None, "n": len(hist)}
    return {"pb_hist_percentile": sum(1 for v in hist if v < current_pb) / len(hist),
            "n": len(hist), "median_pb": sorted(hist)[len(hist) // 2]}


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


# Percentile bands, best first. The percentile alone decides the BASE; the sign
# of the change then caps it.
C15_SPEED_BANDS = [(.10, 4), (.25, 3), (.50, 2), (.75, 1)]


def c15_speed(delta5: float | None, percentile: float | None, history_obs: int | None):
    """FCI improvement speed /4 — percentile base, then a direction cap (V9).

    Returns (points, confidence).

    WHY THIS WAS REBUILT. V8 scored the percentile only when the change was
    already negative, and gave 1 for "negative but worse than median". Measured
    over 190 live sessions that band NEVER FIRED: ΔFCI's median sits at -0.007,
    so the window was roughly (-0.007, 0). The score went 0 -> 2 with nothing
    between, and a five-level criterion was really a four-level one.

    V9 separates the two questions the criterion was conflating. The percentile
    answers "how does this rate of change compare with history", which is
    meaningful in both directions. The SIGN then answers "is it improving at
    all", and caps the score at 1 when it is not — so a worsening FCI can never
    collect 2-4 points for worsening less than usual, which is what dropping the
    sign entirely would have allowed. Band 1 is now reachable from three
    different states, which is what makes it a real band.

    Below 250 observations this is N/A, never 0: a percentile from too little
    history is not a weak reading, it is not a reading.
    """
    if history_obs is None or history_obs < FCI_MIN_HISTORY:
        return None, "LOW"
    conf = "HIGH" if history_obs >= FCI_FULL_HISTORY else "MEDIUM"
    if delta5 is None or percentile is None:
        return None, conf

    base = 0
    for hi, pts in C15_SPEED_BANDS:
        if percentile <= hi:
            base = pts
            break

    if delta5 < 0:
        return base, conf       # improving — the percentile stands
    if delta5 == 0:
        return 1, conf          # unchanged is neither rewarded nor punished
    return min(base, 1), conf   # worsening — capped, however good the percentile


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


def score_cycle(market: dict, fci: dict, c18_locked_score: float | None = None,
                c18_criterion: "Criterion | None" = None):
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

    # C18 is per-SYMBOL, unlike C15-C17 — it is the one cycle criterion that
    # differs between brokers, so the caller injects it from the peer
    # cross-section. It is PROVISIONAL until C18-G2 passes, which means its 7
    # points reach `provisional_score` and never `final_fa_score`.
    #
    # `c18_locked_score` remains the ONLY route to a locked C18 and is still
    # gated by migration 059's check constraint, which V11v3 AT13 keeps in
    # place: a hand-assigned production score is exactly what the spec forbids.
    if c18_locked_score is not None:
        out["c18"] = Criterion(c18_locked_score, None)
    elif c18_criterion is not None:
        out["c18"] = c18_criterion
    else:
        out["c18"] = Criterion(None, None, "N_A",
                               "cycle-sensitivity not measured for this symbol",
                               code="C18_INSUFFICIENT_HISTORY")
    return out


PUBLISH_THRESHOLD = 0.70
PROVISIONAL_THRESHOLD = 0.50

# V11v3 publish gate. Four conditions, evaluated together, all on LOCKED
# availability — a provisional method can never buy a symbol past the gate.
#
# The numbers are not arbitrary: today's locked ceiling is 39 + 23 + 8 = 70, so
# 65 leaves exactly 5 points of quality slack (a broker can lose C13, or C10 or
# C11, and still publish; losing C1's 6 points still fails at 64). The cycle
# floor is an EQUALITY because C15-C17 are market-wide — every broker has the
# same 23 on the same session, so anything else means the market series failed
# to compute and the whole sector should stop, not one symbol.
GATE_MIN_FINAL_AVAILABLE = 65
GATE_MIN_QUALITY = 34
GATE_REQUIRED_CYCLE = 23
GATE_MIN_VALUATION = 8

SECTOR_CYCLE_CRITERIA = ["c15", "c16", "c17"]


def _locked_available(criteria: dict, keys) -> float:
    """Sum of available_max over the LOCKED, scored criteria in `keys`."""
    total = 0.0
    for k in keys:
        c = criteria.get(k)
        if c is None or c.points is None:
            continue
        if c.effective_tier(k) != TIER_LOCKED:
            continue
        total += CRITERION_POINTS[k]
    return total


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
    final_earned = 0.0
    final_available = 0.0
    per_block = {"quality": 0.0, "cycle": 0.0, "valuation": 0.0}
    for key, pts in CRITERION_POINTS.items():
        c = criteria.get(key)
        if c is None or c.points is None:
            continue
        earned += c.points
        available += pts
        # V11v2: the official score sees LOCKED criteria only. A provisional one
        # is dropped from the numerator AND the denominator together — dropping
        # it from the numerator alone would score it as a measured zero, which
        # is the exact confusion normalization exists to prevent.
        if c.effective_tier(key) == TIER_LOCKED:
            final_earned += c.points
            final_available += pts
        block = ("quality" if key in QUALITY_CRITERIA
                 else "cycle" if key in CYCLE_CRITERIA else "valuation")
        per_block[block] += c.points

    # Per-block earned AND available. The available figure is what the UI must
    # divide by: cycle reads 8/23 because C18's 7 points are N/A, not 8/30.
    blocks = {}
    for name, keys in (("quality", QUALITY_CRITERIA), ("cycle", CYCLE_CRITERIA),
                       ("valuation", VALUATION_CRITERIA)):
        scored_keys = [k for k in keys
                       if criteria.get(k) and criteria[k].points is not None]
        blocks[f"{name}_score"] = round(sum(criteria[k].points for k in scored_keys), 2)
        blocks[f"{name}_available_max"] = sum(CRITERION_POINTS[k] for k in scored_keys)

    design_max = sum(CRITERION_POINTS.values())
    coverage = available / design_max if available else 0.0
    normalized = (earned / available * 100) if available else None
    # Both coverages divide by the DESIGN maximum (100), never by each other:
    # final_coverage answers "how much of the rubric backs the official score",
    # so its denominator has to be the whole rubric.
    final_coverage = final_available / design_max if final_available else 0.0
    final_normalized = ((final_earned / final_available * 100)
                        if final_available else None)

    core_usable = any(criteria.get(k) and criteria[k].points is not None
                      for k in ("c1", "c2", "c3"))
    valuation_usable = any(criteria.get(k) and criteria[k].points is not None
                           for k in VALUATION_CRITERIA)

    # A/B/C, and the order of the tests is the definition (V10 sheet 38).
    #
    # THIS IS A STATEMENT ABOUT THE MEASUREMENT, NOT ABOUT THE BROKER. A symbol
    # in C is not a bad company; it is one we cannot yet score honestly.
    #
    # C is reserved for "we could not measure it at all" — under 50% coverage,
    # or no usable core earnings. A symbol with good coverage but no valuation
    # is B, not C: the earnings half was measured, and burying it in the worst
    # bucket would treat a partial measurement as a failed one.
    if coverage < PROVISIONAL_THRESHOLD or not core_usable:
        group = "C"
    elif coverage >= PUBLISH_THRESHOLD and valuation_usable:
        group = "A"
    else:
        group = "B"

    status = {"A": "PUBLISHABLE", "B": "PROVISIONAL", "C": "INSUFFICIENT_COVERAGE"}[group]

    # --- PUBLISH GATE (V11v3 sheet 44) -------------------------------------
    # FOUR conditions, all on LOCKED availability, all required together.
    #
    # V11v2 gated on `final_coverage >= 70`, which was exactly the locked
    # ceiling — 39 (C1-C3,C6-C8,C10-C14) + 23 (C15-C17) + 8 (C19) = 70 — so
    # every publishable broker sat on the line with no margin and one missing
    # criterion would have dropped the whole sector at once. V11v3 lowers the
    # total to 65 and adds per-BLOCK floors, which buys a buffer without
    # lowering the valuation bar: a broker may now lose up to 5 quality points
    # and still publish, but losing its valuation cannot be traded away against
    # a healthy quality block.
    #
    # The valuation floor also REPLACES the `group == "A"` test this used to
    # carry, and is strictly better than it. `valuation_usable` is satisfied by
    # C19 *or* C20, and since V11v2 gives C20 provisional points it can now be
    # true for a broker with no C19 at all — the criterion the official score
    # actually needs. Counting LOCKED valuation availability says what was
    # meant, without depending on a provisional method.
    quality_locked_available = _locked_available(criteria, QUALITY_CRITERIA)
    sector_cycle_available = _locked_available(criteria, SECTOR_CYCLE_CRITERIA)
    valuation_locked_available = _locked_available(criteria, VALUATION_CRITERIA)
    gate_checks = {
        "final_available_max": final_available >= GATE_MIN_FINAL_AVAILABLE,
        "quality_available": quality_locked_available >= GATE_MIN_QUALITY,
        "cycle_available": sector_cycle_available == GATE_REQUIRED_CYCLE,
        "valuation_available": valuation_locked_available >= GATE_MIN_VALUATION,
        "score_computable": final_normalized is not None,
    }
    publishable = all(gate_checks.values())

    return {
        "earned_score": round(earned, 2),
        "available_max": round(available, 2),
        "coverage": round(coverage, 4),
        "data_group": group,
        # --- V11v2 official tier (locked criteria only) ---
        "final_earned": round(final_earned, 2),
        "final_available_max": round(final_available, 2),
        "final_coverage": round(final_coverage, 4),
        # --- V11v2 provisional tier (locked + provisional), always populated ---
        "provisional_earned": round(earned, 2),
        "provisional_available_max": round(available, 2),
        "provisional_coverage": round(coverage, 4),
        "provisional_fa_score": round(normalized, 2) if normalized is not None else None,
        "model_status": "READY" if publishable else "SECTOR_MODEL_PENDING",
        # The frontend renders this and never recomputes it (V11v3 sheet 52).
        "publish_gate": "PASS" if publishable else "FAIL",
        "publish_gate_reason": ("PUBLISH_GATE_PASS" if publishable
                                else "PUBLISH_GATE_FAIL"),
        "publish_gate_checks": gate_checks,
        "quality_locked_available": quality_locked_available,
        "sector_cycle_available": sector_cycle_available,
        "valuation_locked_available": valuation_locked_available,
        # SPLIT DELIBERATELY. `provisional_score` always carries the arithmetic,
        # so a B row can be inspected and a backtest has something to work on.
        # `final_fa_score` exists ONLY for group A, because it is what the Pro
        # composite consumes — and a score built on half a rubric must not be
        # able to reach it just because the column had a number in it.
        "provisional_score": round(normalized, 2) if normalized is not None else None,
        # V11v2 REDEFINES THIS COLUMN: it is now the LOCKED-only score, not the
        # group-A full score. Under V10 a broker's C9/C18/C20 could not reach it
        # because they were N/A anyway; now that they are scored-but-provisional,
        # only the tier split keeps them out.
        "final_fa_score": (round(final_normalized, 2) if publishable else None),
        "normalized_fa_score": round(normalized, 2) if normalized is not None else None,
        **blocks,
        "criteria": {k: c.contract(k) for k, c in criteria.items() if k in CRITERION_POINTS},
        "fa_status": status,
        "core_usable": core_usable,
        "valuation_usable": valuation_usable,
        "dependency_flags": {k: {"status": c.status, "reason": c.reason}
                             for k, c in criteria.items()
                             if c.points is None},
    }
