"""vnstock Finance wrappers — the only module that touches vnstock for FA.

vnstock 4.0.3 quirks handled here (verified empirically June 2026):

  1. Importing `vnstock` eagerly pulls in `vnstock.common.viz`, which raises
     "No charting library available" because the bundled `vnstock_ezchart`
     install is broken. We inject a minimal `sys.modules` stub BEFORE importing
     vnstock to satisfy that gate. (The TA scripts dodge this differently, by
     retrying past the first-call error in ta/ohlcv.py.)

  2. The free community edition caps financial statements at the 4 MOST RECENT
     periods. Banner: "Phiên bản cộng đồng: Báo cáo tài chính được giới hạn tối
     đa 4 kỳ". This is why the FA scorer uses QoQ (not YoY) and a 4-quarter
     median P/E — see FA_FEATURE_PLAN.md.

  3. The `ratio()` endpoint returns a stale fixed window (2018 for FPT), so we
     do NOT use it. ROE / margins / D/E are computed manually from the income
     statement + balance sheet.

The Finance statements come back in a "tall" layout: rows are line items
(with `item`, `item_en`, `item_id` columns) and the remaining columns are
period labels like "2026-Q1", "2025-Q4". We pivot the rows we care about into
a per-quarter normalized list.
"""

import sys
import time
import types

# --- vnstock_ezchart stub (must run before `import vnstock`) -----------------
for _name, _attr in (("vnstock_ezchart", "Chart"), ("vnstock_ezchart.mplot", "MPlot")):
    if _name not in sys.modules:
        _mod = types.ModuleType(_name)
        setattr(_mod, _attr, type("_Stub", (), {}))
        sys.modules[_name] = _mod

from ta.common import REQUEST_DELAY, VNSTOCK_SOURCE  # noqa: E402

# Per-symbol retry schedule for transient vnstock failures (mirrors ta/ohlcv.py).
RETRY_DELAYS_SECONDS = (5.0, 20.0, 60.0)

# Income-statement line items (English labels from VCI).
_INC_REVENUE = "Net sales"
_INC_GROSS_PROFIT = "Gross Profit"
_INC_NET_INCOME = "Net profit/(loss) after tax"
_INC_EPS_DILUTED = "EPS diluted (VND)"
_INC_EPS_BASIC = "EPS basic (VND)"

# Balance-sheet line items.
_BS_EQUITY = "Owner's Equity"
_BS_ST_BORROW = "Short-term borrowings"
_BS_LT_BORROW = "Long-term borrowings"


def _meta_cols(df) -> list[str]:
    return [c for c in ("item", "item_en", "item_id") if c in df.columns]


def _period_cols(df) -> list[str]:
    return [c for c in df.columns if c not in _meta_cols(df)]


def _row_by_item_en(df, label: str) -> dict | None:
    """Return {period: value} for the first row whose item_en == label."""
    if df is None or "item_en" not in df.columns:
        return None
    matches = df[df["item_en"] == label]
    if matches.empty:
        return None
    row = matches.iloc[0]
    return {p: row[p] for p in _period_cols(df)}


def _parse_period(period: str) -> tuple[int, int] | None:
    """'2026-Q1' -> (2026, 1). Returns None if unparseable."""
    try:
        year_str, q_str = period.split("-Q")
        return int(year_str), int(q_str)
    except (ValueError, AttributeError):
        return None


def _num(value):
    """Coerce to float, returning None for NaN / blanks."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if f != f:  # NaN
        return None
    return f


def _fetch_statement(method_name: str, symbol: str):
    """Call a Finance statement method with retry. Returns DataFrame or None."""
    from vnstock import Vnstock

    retries_used = 0
    while True:
        try:
            stock = Vnstock().stock(symbol=symbol, source=VNSTOCK_SOURCE)
            fn = getattr(stock.finance, method_name)
            df = fn(period="quarter", lang="en", dropna=True)
            return df
        except Exception as e:  # noqa: BLE001
            err = str(e)
            if "Dữ liệu trống" in err or "empty" in err.lower():
                return None
            if retries_used < len(RETRY_DELAYS_SECONDS):
                wait = RETRY_DELAYS_SECONDS[retries_used]
                retries_used += 1
                print(f"  {symbol}: {method_name} {err[:70]} — retry in {wait:.0f}s "
                      f"({retries_used}/{len(RETRY_DELAYS_SECONDS)})")
                time.sleep(wait)
                continue
            print(f"  {symbol}: {method_name} failed after retries — {err[:90]}")
            return None


def fetch_income_statement(symbol: str):
    """Raw quarterly income statement DataFrame (or None)."""
    return _fetch_statement("income_statement", symbol)


def fetch_balance_sheet(symbol: str):
    """Raw quarterly balance sheet DataFrame (or None)."""
    return _fetch_statement("balance_sheet", symbol)


def fetch_quarters(symbol: str) -> list[dict]:
    """Fetch + normalize quarterly fundamentals for a symbol.

    Returns a list of per-quarter dicts sorted LATEST FIRST. Each dict:
        period, year, quarter, revenue, gross_profit, net_income, eps,
        total_equity, total_debt, gross_margin, net_margin

    Returns [] when the income statement is unavailable. Sleeps REQUEST_DELAY
    between the two vnstock calls to respect the rate limit.
    """
    inc = fetch_income_statement(symbol)
    if inc is None or "item_en" not in inc.columns:
        return []
    time.sleep(REQUEST_DELAY)
    bs = fetch_balance_sheet(symbol)

    revenue = _row_by_item_en(inc, _INC_REVENUE) or {}
    gross = _row_by_item_en(inc, _INC_GROSS_PROFIT) or {}
    net = _row_by_item_en(inc, _INC_NET_INCOME) or {}
    eps = _row_by_item_en(inc, _INC_EPS_DILUTED) or _row_by_item_en(inc, _INC_EPS_BASIC) or {}

    equity = _row_by_item_en(bs, _BS_EQUITY) or {}
    st_borrow = _row_by_item_en(bs, _BS_ST_BORROW) or {}
    lt_borrow = _row_by_item_en(bs, _BS_LT_BORROW) or {}

    quarters: list[dict] = []
    for period in _period_cols(inc):
        parsed = _parse_period(period)
        if parsed is None:
            continue
        year, quarter = parsed
        rev = _num(revenue.get(period))
        gp = _num(gross.get(period))
        ni = _num(net.get(period))
        eq = _num(equity.get(period))
        stb = _num(st_borrow.get(period)) or 0.0
        ltb = _num(lt_borrow.get(period)) or 0.0
        total_debt = stb + ltb if (st_borrow or lt_borrow) else None

        quarters.append({
            "period": period,
            "year": year,
            "quarter": quarter,
            "revenue": rev,
            "gross_profit": gp,
            "net_income": ni,
            "eps": _num(eps.get(period)),
            "total_equity": eq,
            "total_debt": total_debt,
            "gross_margin": (gp / rev) if (gp is not None and rev) else None,
            "net_margin": (ni / rev) if (ni is not None and rev) else None,
        })

    quarters.sort(key=lambda q: (q["year"], q["quarter"]), reverse=True)
    return quarters
