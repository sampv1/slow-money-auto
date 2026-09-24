"""Pure metric computations for the FA scorer (single-quarter YoY).

Input is a symbol's quarterly series as {period: row_dict} (row_dict has the
fa_quarterly fields: eps, gross_margin, net_margin, roe_ttm, revenue, st_debt,
lt_debt, total_equity), plus a price and the symbol's annual-P/E list.

All growth is YoY = quarter vs the same quarter one year earlier (Qn vs Qn-4).
Margins are stored as fractions; deltas are returned in percentage points.

C1/C2/C3 COMPARE EPS ON ONE SHARE BASIS (IAS 33 / VAS 30, BA 2026-09-23). A stock
dividend or bonus issue raises the share count without raising the capital
behind it, so the as-filed per-share figures either side of one are not
comparable: FPT's 15% bonus made its Q2/2026 EPS read -1.7% against the year
before, where the same earnings restated read +13.7%. The year-ago quarter is
therefore divided by the TECHNICAL factor K between the two quarters, taken from
`fa_share_adjustments` (migration 069). Placements, rights issues, ESOP and
mergers are NOT restated — that dilution is real and must show.

THE Q0 ANCHOR CANCELS OUT OF A GROWTH RATIO, which is why this needs only the
factor BETWEEN the two compared quarters and not BA's K(Q_i -> Q_0). Since
K(Q-4 -> Q0) = K(Q-4 -> Q) * K(Q -> Q0), the later leg divides out. Two
consequences worth keeping: a historical score is FINAL — a bonus issue next
year cannot rewrite it — and chart 11, whose absolute bars must sit on today's
basis, legitimately uses the same factors differently.

C9 IS DELIBERATELY UNCHANGED. Its TTM EPS pairs with a back-adjusted price, and
BA confirmed the current logic is correct (2026-09-24). Restating it would also
make it depend on today's basis, so it would go stale on every new bonus issue
where C1/C2/C3 do not.
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


def _eps_yoy_adjusted(series, period, adjustments):
    """EPS YoY with the year-ago quarter restated onto `period`'s share basis.

    Returns `(value, basis)` where basis is:
      "adjusted"   a technical factor was found and applied (K > 1)
      "unchanged"  reconciled, but nothing technical happened (K = 1)
      "raw"        the window could not be reconciled, so the as-filed figure
                   stands and the caller is told

    THE FALLBACK IS RAW, NEVER NULL, and that is the whole reason it exists.
    `_tier_lt(None)` returns 0 — the BOTTOM tier — so nulling an unreconcilable
    window would not withhold a score, it would assert the worst one. That is
    the RS Line failure exactly (a missing component scored as zero marked down
    the entire universe), and here it would strip points ~43 symbols already
    hold. An unreconciled window keeps today's answer and says so.
    """
    a = _get(series, period, "eps")
    b = _get(series, shift(period, 4), "eps")
    if a is None or b is None or b == 0:
        return None, "raw"
    raw = (a - b) / abs(b) * 100.0
    if not adjustments:
        return raw, "raw"

    from fa.share_events import window_factor
    wf = window_factor(adjustments, shift(period, 4), period)
    if not wf.reconciled:
        return raw, "raw"
    if wf.k == 1.0:
        return raw, "unchanged"
    # Restate the BASE, not the ratio: dividing (1 + raw) by K is only equal to
    # this while `b` is positive, and a year-ago loss is a real state here — the
    # rubric's own `abs(b)` denominator exists for it.
    restated = b / wf.k
    return (a - restated) / abs(restated) * 100.0, "adjusted"


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


def compute_metrics(series, period: str, price, annual_pe: list[tuple[int, float]],
                    adjustments: dict | None = None) -> dict:
    """Raw metric values for one snapshot quarter `period`.

    `adjustments` is this symbol's `fa_share_adjustments` rows keyed by period,
    as `fa.share_events.compute_adjustments` returns them. Omitted, C1/C2/C3
    fall back to the as-filed EPS — which is what every caller did before the
    IAS 33 restatement and what an unreconcilable window still gets.
    """
    # C1 / C2 / C3 — single-quarter EPS YoY over the last 3 quarters, each on
    # one share basis (see the module docstring).
    g3 = []
    bases = []
    for q in (period, shift(period, 1), shift(period, 2)):
        g, basis = _eps_yoy_adjusted(series, q, adjustments)
        bases.append(basis)
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

    c1, c1_basis = _eps_yoy_adjusted(series, period, adjustments)
    return {
        "c1_eps_yoy": c1,
        # Which basis each of the three quarters used, so a stored row can say
        # whether it was restated without re-deriving the factor.
        "eps_basis": c1_basis,
        "eps_basis_3q": bases,
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
