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

# Providers to try, in order, before giving up on the live feed.
#
# One VN-Index fetch broke TWO pipelines on 2026-08-18: the TA run's RS
# indicators, and macro-daily — which froze the FCI, because the FCI's date grid
# IS the VN-Index date index, so a missing close means a missing FCI day. A
# series that load-bearing should not have a single point of failure.
#
# All three are vnstock providers, so they share a library but NOT an endpoint or
# an operator: VCI is Vietcap (and blocks some cloud IP ranges), KBS is KB
# Securities, MSN is Microsoft's market data. Verified 2026-08-19 to return the
# same close for the same session (1,732.02 on 2026-08-18). TCBS is deliberately
# absent — vnstock 4.x rejects it for Quote ("chỉ nhận ... kbs, vci, msn, dnse,
# bina"), so listing it would just burn an attempt on a ValueError.
BENCHMARK_SOURCES = (VNSTOCK_SOURCE, "KBS", "MSN")


def _unique_dates(series: pd.Series, source: str) -> pd.Series:
    """Collapse duplicate dates, keeping the last value for each.

    KBS returns the LATEST session twice — verified 2026-09-02, where
    2026-08-28 appeared as two rows both reading 1832.12. VCI and MSN do not.

    This matters far out of proportion to a repeated row, because the only
    thing the RS indicators do with this series is
    `benchmark.reindex(df.index)` (ta/indicators/relative_strength.py), and
    pandas REQUIRES a unique index to reindex from. One duplicated date raises
    "cannot reindex on an axis with duplicate labels" for EVERY symbol, so
    rs_vs_vnindex_strong / rs_vs_vnindex_weak / rs_new_high silently produce
    nothing universe-wide — each exception is caught and printed per symbol in
    compute_signals_for_symbol, so the run still exits 0.

    Worse, it only fires on the FALLBACK path: VCI is clean, so this is
    invisible until VCI is down, which is precisely when BENCHMARK_SOURCES is
    supposed to save the run. The chain was added after a VN-Index outage cost
    the universe its RS Line; without this it would have traded that failure
    for a quieter one.

    Normalising here rather than in the indicator keeps it at the provider
    boundary, next to the KBS timestamp fix that has the same shape.
    """
    if not series.index.has_duplicates:
        return series
    n = int(series.index.duplicated().sum())
    series = series[~series.index.duplicated(keep="last")]
    print(f"  VNINDEX via {source}: dropped {n} duplicate date(s); "
          f"{len(series)} unique sessions.")
    return series


def _history_from(source: str, start: date, end: date) -> pd.Series | None:
    """One provider's VN-Index closes, or None if it fails or returns nothing."""
    from vnstock import Quote

    df = None
    for attempt in range(2):
        try:
            q = Quote(symbol=VN_INDEX_SYMBOL, source=source)
            df = q.history(start=start.isoformat(), end=end.isoformat(), interval="1D")
            break
        except Exception as e:  # noqa: BLE001
            # The "charting library" error is vnstock 4.0.x's lazy banner-init
            # bug on first call; retrying once is the documented workaround (same
            # as scripts/ta/ohlcv.py).
            if "charting library" in str(e).lower() and attempt == 0:
                continue
            print(f"  VNINDEX via {source}: {type(e).__name__}: {str(e)[:110]}")
            return None

    if df is None or df.empty:
        print(f"  VNINDEX via {source}: no rows returned.")
        return None

    out = pd.Series(df["close"].astype(float).values, name="vnindex_close")
    # KBS timestamps carry a time component (07:00:00); .dt.date normalises every
    # provider onto the plain date the rest of the pipeline joins on.
    out.index = pd.to_datetime(df["time"]).dt.date
    out.index.name = "date"
    return _unique_dates(out.sort_index(), source)


def fetch_vnindex_closes(start: date | None = None, end: date | None = None,
                         sources: tuple[str, ...] = BENCHMARK_SOURCES) -> pd.Series | None:
    """VN-Index closes as a date-indexed Series, ascending — first source that works.

    Returns None only when EVERY provider failed, which callers must treat as
    "no benchmark", never as "the benchmark is flat".
    """
    if end is None:
        end = date.today()
    if start is None:
        start = end - timedelta(days=DEFAULT_LOOKBACK_DAYS)

    for i, source in enumerate(sources):
        series = _history_from(source, start, end)
        if series is not None and not series.empty:
            if i > 0:
                print(f"  VNINDEX: {sources[0]} unavailable — served by fallback "
                      f"{source} ({len(series)} sessions through {series.index[-1]}).")
            return series
    print(f"  VNINDEX: all {len(sources)} providers failed ({', '.join(sources)}).")
    return None


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
    # macro_series is keyed (metric, date) so this should already be unique —
    # applied anyway so EVERY path out of this module carries the guarantee the
    # RS indicators depend on, rather than only the two that were caught being
    # wrong.
    return _unique_dates(out.sort_index(), "macro_series")


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
