"""VN-Index benchmark loader used by the Relative Strength indicators.

Fetched once per pipeline run via vnstock — same source/credentials as
ta.ohlcv. The orchestrator calls this once before the per-symbol loop.

Returns a date-indexed Series of closes (or None on error). The caller decides
whether to skip RS indicators when the series is None.

TWO ENTRY POINTS, and consumers want the second one:

  fetch_vnindex_closes()      live vnstock only. Used by refresh_macro.py, which
                              is what WRITES the DB copy — it must never read
                              back the series it is there to populate.
  get_vnindex_closes(client)  live, falling back to macro_series.vnindex in our
                              own database. Everything in the TA pipeline.

The fallback exists because on 2026-08-18 the live fetch raised
`RetryError[UnboundLocalError]` from inside vnstock, twice, 84 minutes apart —
long enough that a retry loop would not have rescued it. RS Line was skipped for
the whole universe and the `rs_line*` columns were then overwritten with nulls,
which cost every symbol the 20% RS-Line component of its TA Score. macro_series
already holds 5,600+ daily VN-Index closes maintained by macro-daily.yml, so the
data to survive that outage was sitting in our own database the whole time.
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


def load_vnindex_from_db(client, lookback_days: int = DEFAULT_LOOKBACK_DAYS) -> pd.Series | None:
    """VN-Index closes from macro_series (metric 'vnindex'), same shape as above.

    Written daily by refresh_macro.py, so it trails the live feed by at most a
    session — immaterial to an RS Line, which is a ratio series a year long.
    """
    from .common import safe_execute

    start = (date.today() - timedelta(days=lookback_days)).isoformat()
    try:
        res = safe_execute(
            client.table("macro_series").select("date,value")
            .eq("metric", "vnindex").gte("date", start).order("date"),
            label="vnindex fallback",
        )
    except Exception as e:  # noqa: BLE001
        print(f"  VNINDEX DB fallback failed: {str(e)[:120]}")
        return None

    rows = [r for r in (res.data or []) if r.get("value")]
    if not rows:
        return None
    out = pd.Series([float(r["value"]) for r in rows], name="vnindex_close")
    out.index = pd.to_datetime([r["date"] for r in rows]).date
    out.index.name = "date"
    return out.sort_index()


def get_vnindex_closes(client, start: date | None = None,
                       end: date | None = None) -> pd.Series | None:
    """The benchmark, live if possible and from our own DB if not.

    Returns None only when BOTH sources fail, which is the signal callers must
    treat as "no benchmark" — never as "the benchmark is flat" or "no symbol has
    an RS Line".
    """
    live = fetch_vnindex_closes(start, end)
    if live is not None and not live.empty:
        return live
    if client is None:
        return None
    db = load_vnindex_from_db(client)
    if db is not None and not db.empty:
        print(f"  VNINDEX: live fetch unavailable — using macro_series copy "
              f"({len(db)} sessions through {db.index[-1]}).")
        return db
    return None
