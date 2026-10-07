"""Chart 10 — the bank peer valuation matrix (BANK_CHARTS_DESIGN.md §5.10).

WHY THIS IS PYTHON AND NOT A ChartSpec
    Charts 1-9 are time series for ONE symbol, which `ChartSpec` expresses. This
    one is CROSS-SECTIONAL: every bank placed on one scatter at a single date,
    with a sector median and a benchmark diagonal drawn across the whole set.

    Computing it in the dashboard would mean the Analysis page — which today
    loads one symbol's rows — pulling 29 banks' statements, notes and two years
    of bars on every view, and repeating the identical peer computation 29 times
    over. It would also be a SECOND implementation of peer math that closely
    resembles the securities C20 residual model, and this codebase has twice
    shipped one rule in two places that then disagreed.

    So the arithmetic lives here and is stored; the dashboard reads coordinates
    and resolves only which points carry a LABEL (a display rule, not a number).

WHAT IS DELIBERATELY NOT COMPUTED
    `Target P/B_i` needs `g_i = ROE_sustainable × (1 − cash dividend payout)`,
    and the payout has no source: `RT_VALUE_DIVIDEND_YIELD` is **0 on all 27
    banks that carry a ratio row**. So `target_pb` is NULL with a reason code,
    never a number built on an invented payout.

    The chart does not depend on it. The quadrant dividers use SECTOR constants
    (`KE_SECTOR` / `G_SECTOR`), so the diagonal, the median and all four
    quadrants — which is what BA's three stated purposes need — are unaffected.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field

#: BA round 3 — the VN30 table was dropped in favour of a fixed anchor list.
ANCHORS = ("VCB", "BID", "CTG", "TCB", "MBB", "VPB", "ACB", "STB")
#: Used when the target is OUTSIDE the anchors (BA round 3).
TIER2_ANCHORS = ("VCB", "TCB", "MBB", "CTG", "BID")
NEAREST_PEERS = 6
MAX_LABELLED = 12

#: BA round 5 fixed the risk-free rate; there is still no VN government bond
#: series (`BOND_YIELD_DESIGN.md` is unbuilt), so this is a dated constant
#: rather than an observation, and `RF_SOURCE` says so on every row.
RF = 0.035
RF_SOURCE = "BA_FIXED_20261005"
#: BA round 3: "lấy trung bình 7.5%" over the spec's 7-8% range.
ERP = 0.075
#: Sector constants for the benchmark diagonal (v6 §5.10). NOT per-bank.
KE_SECTOR = 0.12
G_SECTOR = 0.07
#: Bloomberg's Blume adjustment, BA round 4.
BLUME_RAW, BLUME_MARKET = 0.67, 0.33
#: Weekly returns over two years (BA round 4: "2 năm, hàng tuần").
BETA_WEEKS = 104
MIN_BETA_WEEKS = 52


@dataclass
class BankPoint:
    """One bank's position on the matrix, plus why anything is absent."""

    symbol: str
    total_assets: float | None = None
    price: float | None = None
    price_date: str | None = None
    shares: float | None = None
    parent_equity: float | None = None
    bvps: float | None = None
    adjusted_bvps: float | None = None
    adjusted_pb: float | None = None
    roe_ttm: float | None = None
    sustainable_roe: float | None = None
    hidden_npl_unprovisioned: float | None = None
    accrued_overdue: float | None = None
    beta_raw: float | None = None
    beta_blume: float | None = None
    ke: float | None = None
    target_pb: float | None = None
    reasons: dict[str, str] = field(default_factory=dict)

    @property
    def plottable(self) -> bool:
        """A point is drawn only with BOTH coordinates and a positive book.

        A negative adjusted book is not a cheap bank — it is a bank whose
        adjusted equity has been wiped out, and dividing a price by it produces
        a NEGATIVE P/B that would plot below the axis as though it were the best
        value on the chart.
        """
        return (
            self.adjusted_pb is not None
            and self.sustainable_roe is not None
            and self.adjusted_bvps is not None
            and self.adjusted_bvps > 0
            and self.adjusted_pb > 0
        )


def weekly_closes(bars: list[tuple[str, float]]) -> list[tuple[str, float]]:
    """Daily (date, close) -> the LAST close of each ISO week.

    Resampling by week rather than taking every 5th bar: a market holiday
    shortens a week, and a fixed stride would silently slide the sampling
    phase against the benchmark, which is what beta compares.
    """
    import datetime as _dt

    last: dict[tuple[int, int], tuple[str, float]] = {}
    for d, c in bars:
        if c is None or c <= 0:
            continue
        y, w, _ = _dt.date.fromisoformat(d).isocalendar()
        prev = last.get((y, w))
        if prev is None or d > prev[0]:
            last[(y, w)] = (d, c)
    return [last[k] for k in sorted(last)]


def _returns(series: list[tuple[str, float]]) -> dict[str, float]:
    out: dict[str, float] = {}
    for (_, p0), (d1, p1) in zip(series, series[1:]):
        if p0 > 0:
            out[d1] = p1 / p0 - 1.0
    return out


def beta(
    symbol_bars: list[tuple[str, float]],
    index_bars: list[tuple[str, float]],
) -> tuple[float | None, float | None, str]:
    """Raw and Blume-adjusted beta from weekly returns.

    Returns are paired BY WEEK-END DATE, never by position: the two series are
    not guaranteed to hold the same weeks (a bank can be suspended for a week
    the index trades), and zipping them would compare a bank's week to the
    index's following week for every week after the gap.
    """
    s = _returns(weekly_closes(symbol_bars))
    i = _returns(weekly_closes(index_bars))
    common = sorted(set(s) & set(i))[-BETA_WEEKS:]
    if len(common) < MIN_BETA_WEEKS:
        return None, None, f"INSUFFICIENT_WEEKS:{len(common)}"
    rs = [s[d] for d in common]
    ri = [i[d] for d in common]
    var = statistics.pvariance(ri)
    # NEAR-zero, not just zero. A benchmark whose weekly returns barely vary has
    # no dispersion for a covariance to be measured against, and cov/var then
    # amplifies float noise without bound -- a constant-return fixture produced
    # a "beta" of -5.8e12. Real weekly VN-Index variance is ~4e-4, four orders
    # above this floor, so it cannot fire on live data.
    if not math.isfinite(var) or var < 1e-12:
        return None, None, "DEGENERATE_BENCHMARK"
    mi, ms = statistics.fmean(ri), statistics.fmean(rs)
    cov = sum((a - ms) * (b - mi) for a, b in zip(rs, ri)) / len(common)
    raw = cov / var
    if not math.isfinite(raw):
        return None, None, "NOT_FINITE"
    return raw, BLUME_RAW * raw + BLUME_MARKET * 1.0, f"OK:{len(common)}"


def hidden_npl_unprovisioned(groups_2_to_5: float | None, provisions: float | None) -> float | None:
    """Exposure the balance sheet has NOT already provisioned against.

    `BS_PROVISION_LOANS_TO_CUSTOMERS` is stored negative, so its magnitude is
    taken. The floor at zero matters: a bank provisioned ABOVE its classified
    debt (VCB holds 29,985 tỷ against 15,188 tỷ) has no unprovisioned exposure,
    and a negative here would ADD to book value — turning prudence into a
    valuation bonus, which is the opposite of what this adjustment is for.
    """
    if groups_2_to_5 is None or provisions is None:
        return None
    return max(0.0, groups_2_to_5 - abs(provisions))


def accrued_overdue(accrued: float | None, group2: float | None,
                    npl: float | None, book: float | None) -> float | None:
    """BA round 3's rule: accrued interest scaled by the bank's own stress.

    "Tỷ lệ trích lập lãi dự thu quá hạn được tỷ lệ thuận với mức độ căng thẳng
    nợ xấu thực tế của chính ngân hàng đó" — the alternatives BA rejected were
    zero (ignores the risk) and 100% (assumes every đồng of accrued interest is
    uncollectable).
    """
    if None in (accrued, group2, npl, book) or not book:
        return None
    return accrued * min(1.0, (group2 + npl) / book)


def extra_provision_charge(shortfall_now: float | None,
                           shortfall_year_ago: float | None) -> float | None:
    """The additional provisioning CHARGE for the period, not the accumulated gap.

    BA's term is "chi phí trích lập bổ sung nợ ẩn" — an EXPENSE, which is a
    flow. The unprovisioned shortfall is a STOCK, and subtracting a stock from
    an annual return mixes units: measured on the first implementation, HDB —
    the sector's highest reported ROE at 25.8% — came out at **-29.5%**, and
    the sector's median "sustainable" ROE was -5.3%, i.e. the model asserting
    that the typical Vietnamese bank destroys value.

    It is also wrong on its own terms. "Sustainable" means the RECURRING level,
    and a one-off catch-up provision is by definition not recurring; the stock
    is already carried on the other side, where `adjusted_bvps` subtracts it
    from book value. What belongs in a return is the year's own movement.

    Floored at zero: a bank that provisioned FASTER than its classified debt
    grew has no additional charge, and a negative here would hand it a bonus to
    its sustainable ROE for having been prudent.
    """
    if shortfall_now is None or shortfall_year_ago is None:
        return None
    return max(0.0, shortfall_now - shortfall_year_ago)


def sustainable_roe(roe_ttm: float | None, non_recurring_ttm: float | None,
                    extra_provision: float | None, avg_equity: float | None) -> float | None:
    """ROE with one-offs and the period's additional provisioning charge removed.

    `extra_provision` is a FLOW (see `extra_provision_charge`), never the
    accumulated shortfall.
    """
    if roe_ttm is None or avg_equity is None or not avg_equity:
        return None
    adj = roe_ttm
    if non_recurring_ttm is not None:
        adj -= non_recurring_ttm / avg_equity
    if extra_provision is not None:
        adj -= extra_provision / avg_equity
    return adj


def adjusted_bvps(parent_equity: float | None, shares: float | None,
                  hidden: float | None, overdue: float | None,
                  eff_tax: float) -> tuple[float | None, float | None]:
    """(BVPS as reported, BVPS after the hidden-loss haircut).

    PARENT equity, not total: measured against the provider's own `RT_VALUE_PB`
    with its market cap (so the price date cannot confound it), parent equity
    lands within 2% on 23 of 27 banks while total equity misses every bank
    carrying material minority interest — VPB 0.96 against a published 1.24.
    """
    if parent_equity is None or not shares:
        return None, None
    bv = parent_equity / shares
    loss = (hidden or 0.0) + (overdue or 0.0)
    return bv, bv - (1.0 - eff_tax) * loss / shares


def target_pb_sector(x: float) -> float:
    """The benchmark diagonal: (x − g) / (Ke − g), sector constants."""
    return (x - G_SECTOR) / (KE_SECTOR - G_SECTOR)


def sector_view(points: list[BankPoint]) -> dict:
    """Median adjusted P/B and the diagonal's endpoints.

    `S_valid` is v6's: adjusted BVPS > 0 AND adjusted P/B > 0. A bank whose
    adjusted book went negative is excluded from the MEDIAN rather than pulling
    it, which is the same reason it is not plotted.
    """
    valid = [p for p in points if p.plottable]
    med = statistics.median([p.adjusted_pb for p in valid]) if valid else None
    roes = [p.sustainable_roe for p in valid if p.sustainable_roe is not None]
    x_max = max(roes) if roes else None
    return {
        "n_valid": len(valid),
        "median_adjusted_pb": med,
        "ke_sector": KE_SECTOR,
        "g_sector": G_SECTOR,
        "rf": RF,
        "rf_source": RF_SOURCE,
        "erp": ERP,
        # A -> C, the segment v6 names. C is the sector's own widest ROE, so the
        # line spans the data rather than an arbitrary right edge.
        "diagonal": None if x_max is None else {
            "x0": G_SECTOR, "y0": 0.0,
            "x1": x_max, "y1": target_pb_sector(x_max),
        },
    }


def peer_group(target: str, points: list[BankPoint]) -> list[str]:
    """BA round 3's Top-8 fallback. A DISPLAY rule: who carries a label.

    Everyone still plots; this picks the <= 12 that are named, because 29
    labels on one scatter is unreadable.
    """
    known = {p.symbol for p in points}
    if target in ANCHORS:
        picked = [s for s in ANCHORS if s in known]
    else:
        picked = [target] + [s for s in TIER2_ANCHORS if s in known and s != target]
        sized = [p for p in points
                 if p.total_assets and p.symbol not in picked and p.symbol != target]
        tgt = next((p for p in points if p.symbol == target), None)
        if tgt and tgt.total_assets:
            sized.sort(key=lambda p: abs(math.log(p.total_assets / tgt.total_assets)))
            picked += [p.symbol for p in sized[:NEAREST_PEERS]]
    out: list[str] = []
    for s in picked:
        if s not in out:
            out.append(s)
    return out[:MAX_LABELLED]
