"""Pure metric computations for the FA scorer (single-quarter YoY).

Input is a symbol's quarterly series as {period: row_dict} (row_dict has the
fa_quarterly fields: eps, gross_margin, net_margin, roe_ttm, revenue, st_debt,
lt_debt, total_equity), plus a price and the symbol's annual-P/E list.

All growth is YoY = quarter vs the same quarter one year earlier (Qn vs Qn-4).
Margins are stored as fractions; deltas are returned in percentage points.
"""

from statistics import median


def period_to_index(period: str) -> int:
    """'2026-Q1' -> integer quarter index (year*4 + quarter-1)."""
    year, q = period.split("-Q")
    return int(year) * 4 + (int(q) - 1)


def index_to_period(idx: int) -> str:
    return f"{idx // 4}-Q{idx % 4 + 1}"


def shift(period: str, k: int) -> str:
    """Period k quarters earlier."""
    return index_to_period(period_to_index(period) - k)


def period_year(period: str) -> int:
    return int(period.split("-Q")[0])


def _get(series, period, field):
    row = series.get(period)
    return row.get(field) if row else None


def _yoy_pct(series, field, period):
    """(value[period] - value[period-4]) / |value[period-4]| * 100, or None."""
    a = _get(series, period, field)
    b = _get(series, shift(period, 4), field)
    if a is None or b is None or b == 0:
        return None
    return (a - b) / abs(b) * 100.0


def _margin_delta_pp(series, field, period):
    """(margin[period] - margin[period-4]) * 100  → percentage points, or None."""
    a = _get(series, period, field)
    b = _get(series, shift(period, 4), field)
    if a is None or b is None:
        return None
    return (a - b) * 100.0


def is_fully_scorable(series, period: str) -> bool:
    """True if EPS exists for the 3 recent quarters AND their year-ago quarters
    (so C2/C3's three YoY comparisons can all be formed)."""
    needed = [period, shift(period, 1), shift(period, 2),
              shift(period, 4), shift(period, 5), shift(period, 6)]
    return all(_get(series, p, "eps") is not None for p in needed)


def eligible_periods(series) -> list[str]:
    """Sorted (ascending) list of periods that are fully scorable."""
    return sorted((p for p in series if is_fully_scorable(series, p)), key=period_to_index)


def trailing_ttm_eps(series, period):
    """Sum of single-quarter EPS over {period .. period-3}; None if any missing."""
    vals = [_get(series, shift(period, k), "eps") for k in range(4)]
    if any(v is None for v in vals):
        return None
    return sum(vals)


def pe_5y_median(annual_pe: list[tuple[int, float]], up_to_year: int):
    """Median of annual P/E for years <= up_to_year (negatives included)."""
    vals = [pe for (y, pe) in annual_pe if y <= up_to_year and pe is not None]
    return median(vals) if vals else None


def compute_metrics(series, period: str, price, annual_pe: list[tuple[int, float]]) -> dict:
    """Raw metric values for one snapshot quarter `period`."""
    # C1 / C2 / C3 — single-quarter EPS YoY over the last 3 quarters
    g3 = []
    for q in (period, shift(period, 1), shift(period, 2)):
        g = _yoy_pct(series, "eps", q)
        if g is not None:
            g3.append(g)
    c2 = (sum(g3) / len(g3)) if g3 else None

    st = _get(series, period, "st_debt")
    lt = _get(series, period, "lt_debt")
    eq = _get(series, period, "total_equity")
    debt = None
    if st is not None or lt is not None:
        debt = (st or 0.0) + (lt or 0.0)
    de = (debt / eq) if (debt is not None and eq not in (None, 0)) else None

    roe = _get(series, period, "roe_ttm")
    ttm_eps = trailing_ttm_eps(series, period)
    current_pe = (price / ttm_eps) if (ttm_eps and ttm_eps > 0 and price) else None
    med = pe_5y_median(annual_pe, period_year(period))

    return {
        "c1_eps_yoy": _yoy_pct(series, "eps", period),
        "c2_eps_3q_avg_yoy": c2,
        "c3_eps_pos_count": sum(1 for g in g3 if g > 0),
        "c4_rev_yoy": _yoy_pct(series, "revenue", period),
        "c5_gross_margin_delta": _margin_delta_pp(series, "gross_margin", period),
        "c6_net_margin_delta": _margin_delta_pp(series, "net_margin", period),
        "c7_roe": (roe * 100.0) if roe is not None else None,
        "c8_debt_to_equity": de,
        "current_eps_ttm": ttm_eps,
        "current_pe": current_pe,
        "pe_5y_median": med,
        "current_price": price,
    }
