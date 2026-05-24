"""Fetch and cache OHLCV data via vnstock for the TA scanner.

Prices are stored in raw VND (vnstock returns thousands, multiplied by 1000),
matching the convention used elsewhere in this repo (see update_prices.py).
"""

import time
from datetime import date, timedelta

from .common import REQUEST_DELAY, VNSTOCK_SOURCE, today_vn


# Per-symbol retry schedule for transient vnstock failures (timeouts, rate
# limits, brief upstream errors). Total worst-case wait: ~85s before giving
# up — acceptable for a midnight cron where reliability > latency.
RETRY_DELAYS_SECONDS = (5.0, 20.0, 60.0)


def fetch_ohlcv(symbol: str, start: date, end: date) -> list[dict] | None:
    """Fetch daily OHLCV bars for a symbol over [start, end].

    Returns a list of dicts with keys: symbol, date, open, high, low, close, volume.
    Returns None when the symbol genuinely has no data in range, or when all
    retry attempts have been exhausted.
    """
    # vnstock 4.0.x quirk: the very first Quote().history() call in a process
    # raises "No charting library available" due to a lazy banner-init bug;
    # the second call works. We treat that as a free workaround retry — it
    # does NOT consume one of the regular retry slots.
    from vnstock import Quote

    used_charting_retry = False
    retries_used = 0
    df = None

    while True:
        try:
            quote = Quote(symbol=symbol, source=VNSTOCK_SOURCE)
            df = quote.history(start=start.isoformat(), end=end.isoformat(), interval="1D")
            break
        except Exception as e:
            err = str(e)

            # Permanent: symbol has no data in this date range.
            if "Dữ liệu trống" in err or "empty" in err.lower():
                print(f"  {symbol}: no data in range")
                return None

            # One-shot workaround for the vnstock 4.0.x first-call bug.
            if "charting library" in err.lower() and not used_charting_retry:
                used_charting_retry = True
                continue

            # Real error — back off and retry.
            if retries_used < len(RETRY_DELAYS_SECONDS):
                wait = RETRY_DELAYS_SECONDS[retries_used]
                retries_used += 1
                print(f"  {symbol}: {err[:80]} — retry in {wait:.0f}s ({retries_used}/{len(RETRY_DELAYS_SECONDS)})")
                time.sleep(wait)
                continue

            print(f"  {symbol}: failed after {retries_used} retries — {err[:160]}")
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
