"""VN-Index benchmark loader used by the Relative Strength indicators.

Fetched once per pipeline run via vnstock — same source/credentials as
ta.ohlcv. We don't cache to Supabase: only ~250 rows/year, and the orchestrator
calls this once before the per-symbol loop.

Returns a date-indexed Series of closes (or None on error). The caller decides
whether to skip RS indicators when the series is None.
"""

from datetime import date, timedelta

import pandas as pd

from .common import VNSTOCK_SOURCE


VN_INDEX_SYMBOL = "VNINDEX"
DEFAULT_LOOKBACK_DAYS = 400  # ~80 weeks — enough for 60-bar RS + 60-bar RS-high window


def fetch_vnindex_closes(start: date | None = None, end: date | None = None) -> pd.Series | None:
    """Return VN-Index closing prices as a date-indexed Series, ascending.

    Quote() in vnstock 4.0.x throws a "charting library" error on first call due
    to a lazy banner-init bug; retrying once is the documented workaround used
    in scripts/ta/ohlcv.py.
    """
    from vnstock import Quote

    if end is None:
        end = date.today()
    if start is None:
        start = end - timedelta(days=DEFAULT_LOOKBACK_DAYS)

    df = None
    for attempt in range(2):
        try:
            q = Quote(symbol=VN_INDEX_SYMBOL, source=VNSTOCK_SOURCE)
            df = q.history(start=start.isoformat(), end=end.isoformat(), interval="1D")
            break
        except Exception as e:
            if "charting library" in str(e).lower() and attempt == 0:
                continue
            print(f"  VNINDEX benchmark fetch failed: {str(e)[:120]}")
            return None

    if df is None or df.empty:
        return None

    out = pd.Series(df["close"].astype(float).values, name="vnindex_close")
    out.index = pd.to_datetime(df["time"]).dt.date
    out.index.name = "date"
    return out.sort_index()
