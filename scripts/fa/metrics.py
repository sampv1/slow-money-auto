"""Pure metric computations for the FA scorer.

Input is the normalized quarter list from `fetcher.fetch_quarters` (latest
first), plus price inputs sourced from ta_ohlcv by the caller (so this module
stays pure / DB-free and unit-testable).

Growth metrics are QoQ (quarter-over-quarter) because vnstock free caps
statements at 4 periods — see FA_FEATURE_PLAN.md. Margin "growth" is expressed
as a percentage-POINT change (pp), not a relative % change.

All functions return None when the inputs needed are missing, so scoring can
award 0 (or the neutral tier) and note it rather than crashing.
"""

from statistics import median


def _pct_growth(curr, prev):
    """Relative growth (curr - prev) / |prev|, as a percent. None if unusable."""
    if curr is None or prev is None or prev == 0:
        return None
    return (curr - prev) / abs(prev) * 100.0


def eps_qoq_series(quarters: list[dict]) -> list[float]:
    """QoQ EPS growth (%) for each consecutive pair, latest pair first.

    With 4 quarters this yields up to 3 values:
    {Q0 vs Q1, Q1 vs Q2, Q2 vs Q3}.
    """
    out = []
    for i in range(len(quarters) - 1):
        g = _pct_growth(quarters[i]["eps"], quarters[i + 1]["eps"])
        if g is not None:
            out.append(g)
    return out


def latest_eps_qoq(quarters: list[dict]):
    series = eps_qoq_series(quarters)
    return series[0] if series else None


def avg_eps_growth_3q(quarters: list[dict]):
    """Mean of the (up to 3) QoQ EPS growth comparisons."""
    series = eps_qoq_series(quarters)[:3]
    if not series:
        return None
    return sum(series) / len(series)


def eps_positive_count(quarters: list[dict]) -> int:
    """How many of the (up to 3) QoQ comparisons show positive EPS growth."""
    return sum(1 for g in eps_qoq_series(quarters)[:3] if g > 0)


def revenue_qoq(quarters: list[dict]):
    if len(quarters) < 2:
        return None
    return _pct_growth(quarters[0]["revenue"], quarters[1]["revenue"])


def _margin_delta_pp(quarters: list[dict], key: str):
    """Percentage-point change in a margin between the latest two quarters."""
    if len(quarters) < 2:
        return None
    m0, m1 = quarters[0][key], quarters[1][key]
    if m0 is None or m1 is None:
        return None
    return (m0 - m1) * 100.0


def gross_margin_delta(quarters: list[dict]):
    return _margin_delta_pp(quarters, "gross_margin")


def net_margin_delta(quarters: list[dict]):
    return _margin_delta_pp(quarters, "net_margin")


def trailing_ttm_eps(quarters: list[dict]):
    """Sum of EPS over the available quarters (up to 4 = TTM)."""
    vals = [q["eps"] for q in quarters[:4] if q["eps"] is not None]
    if not vals:
        return None
    return sum(vals)


def trailing_roe(quarters: list[dict]):
    """TTM net income / average equity over the available quarters, as %."""
    nets = [q["net_income"] for q in quarters[:4] if q["net_income"] is not None]
    eqs = [q["total_equity"] for q in quarters[:4] if q["total_equity"] is not None]
    if not nets or not eqs:
        return None
    ttm_net = sum(nets)
    avg_eq = sum(eqs) / len(eqs)
    if avg_eq == 0:
        return None
    return ttm_net / avg_eq * 100.0


def debt_to_equity(quarters: list[dict]):
    """Latest-quarter financial debt / equity ratio."""
    if not quarters:
        return None
    q = quarters[0]
    debt, eq = q["total_debt"], q["total_equity"]
    if debt is None or eq is None or eq == 0:
        return None
    return debt / eq


def current_pe(ttm_eps, current_price):
    """Current price / TTM EPS. None if TTM EPS is non-positive."""
    if ttm_eps is None or ttm_eps <= 0 or current_price is None:
        return None
    return current_price / ttm_eps


def pe_4q_median(quarters: list[dict], qend_closes: dict):
    """Median of annualized quarter-end P/Es.

    For each quarter with eps > 0 and a known quarter-end close:
        pe_q = close_at_qend / (eps_q * 4)   (annualize the single quarter)
    Returns the median, or None if no quarter qualifies.

    Note: this annualizes each single quarter, while `current_pe` uses true
    TTM EPS. Both are annual-equivalent and thus comparable; the slight method
    difference is acceptable for a v1 valuation baseline (see FA_FEATURE_PLAN.md).
    """
    pes = []
    for q in quarters[:4]:
        eps = q["eps"]
        close = qend_closes.get(q["period"])
        if eps is not None and eps > 0 and close is not None and close > 0:
            pes.append(close / (eps * 4.0))
    if not pes:
        return None
    return median(pes)


def compute_metrics(quarters: list[dict], qend_closes: dict, current_price) -> dict:
    """Bundle every raw metric the scorer needs into one dict."""
    ttm_eps = trailing_ttm_eps(quarters)
    return {
        "c1_eps_qoq": latest_eps_qoq(quarters),
        "c2_eps_3q_avg": avg_eps_growth_3q(quarters),
        "c3_eps_pos_count": eps_positive_count(quarters),
        "c4_rev_qoq": revenue_qoq(quarters),
        "c5_gross_margin_delta": gross_margin_delta(quarters),
        "c6_net_margin_delta": net_margin_delta(quarters),
        "c7_roe": trailing_roe(quarters),
        "c8_debt_to_equity": debt_to_equity(quarters),
        "current_eps_ttm": ttm_eps,
        "current_price": current_price,
        "current_pe": current_pe(ttm_eps, current_price),
        "pe_4q_median": pe_4q_median(quarters, qend_closes),
    }
