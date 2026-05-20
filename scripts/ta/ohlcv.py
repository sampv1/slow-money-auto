"""Fetch and cache OHLCV data via vnstock for the TA scanner.

Prices are stored in raw VND (vnstock returns thousands, multiplied by 1000),
matching the convention used elsewhere in this repo (see update_prices.py).
"""

import time
from datetime import date, timedelta

from .common import REQUEST_DELAY, VNSTOCK_SOURCE, today_vn


def fetch_ohlcv(symbol: str, start: date, end: date) -> list[dict] | None:
    """Fetch daily OHLCV bars for a symbol over [start, end].

    Returns a list of dicts with keys: symbol, date, open, high, low, close, volume.
    Returns None on error or no data.
    """
    # Use the direct Quote class — the Vnstock().stock() wrapper in vnstock 4.0.x
    # eagerly imports a charting library, which isn't installed.
    # The very first Quote().history() call in a process also raises the same
    # "No charting library" error due to a lazy banner-init bug in 4.0.x; the
    # second call works. We retry once silently.
    from vnstock import Quote

    df = None
    last_error = None
    for attempt in range(2):
        try:
            quote = Quote(symbol=symbol, source=VNSTOCK_SOURCE)
            df = quote.history(start=start.isoformat(), end=end.isoformat(), interval="1D")
            break
        except Exception as e:
            last_error = str(e)
            if "Dữ liệu trống" in last_error or "empty" in last_error.lower():
                print(f"  {symbol}: no data in range")
                return None
            if "charting library" in last_error.lower() and attempt == 0:
                continue
            print(f"  {symbol}: error fetching — {last_error}")
            return None

    if df is None:
        print(f"  {symbol}: error fetching — {last_error}")
        return None

    if df is None or df.empty:
        print(f"  {symbol}: no data returned")
        return None

    rows = []
    for _, r in df.iterrows():
        rows.append(
            {
                "symbol": symbol,
                "date": str(r["time"])[:10],
                "open": float(r["open"]) * 1000,
                "high": float(r["high"]) * 1000,
                "low": float(r["low"]) * 1000,
                "close": float(r["close"]) * 1000,
                "volume": int(r["volume"]),
            }
        )
    return rows


def upsert_ohlcv(client, rows: list[dict]) -> int:
    """Upsert OHLCV rows into ta_ohlcv. Returns number of rows written."""
    if not rows:
        return 0
    client.table("ta_ohlcv").upsert(rows, on_conflict="symbol,date").execute()
    return len(rows)


def backfill_symbol(client, symbol: str, days: int = 90) -> int:
    """Backfill the last `days` calendar days of OHLCV for a symbol.

    Returns the number of rows written.
    """
    end = today_vn()
    start = end - timedelta(days=days)
    rows = fetch_ohlcv(symbol, start, end)
    if not rows:
        return 0
    return upsert_ohlcv(client, rows)


def backfill_symbols(client, symbols: list[str], days: int = 90, delay: float = REQUEST_DELAY) -> dict[str, int]:
    """Backfill OHLCV for a list of symbols. Returns {symbol: rows_written}."""
    results: dict[str, int] = {}
    total = len(symbols)
    for i, symbol in enumerate(symbols, 1):
        print(f"[{i}/{total}] {symbol}", end=" ", flush=True)
        n = backfill_symbol(client, symbol, days=days)
        results[symbol] = n
        print(f"→ {n} rows")
        if i < total:
            time.sleep(delay)
    return results
