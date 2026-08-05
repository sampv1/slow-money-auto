"""Fetch and cache OHLCV data via vnstock for the TA scanner.

Prices are stored in raw VND (vnstock returns thousands, multiplied by 1000),
matching the convention used elsewhere in this repo (see update_prices.py).
"""

import time
from datetime import date, timedelta

from .common import REQUEST_DELAY, VNSTOCK_SOURCE, safe_execute, today_vn


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


# --- Bulk daily snapshot via price_board -----------------------------------
#
# After the ATC auction, vnstock's Trading.price_board returns a complete daily
# OHLCV snapshot (open/high/low/last/volume) for an arbitrary list of symbols in
# a SINGLE request — ~600 symbols in <1s. Verified byte-for-byte identical to
# history() for the same trading day. Unlike history(), price_board values are
# already in raw VND (no ×1000) and it only ever returns the latest session, so
# it is used exclusively for the daily incremental path; history() remains the
# backfill / gap-fill path.

PRICE_BOARD_CHUNK = 500


def _make_trading():
    """Construct a vnstock Trading client, working around the 4.0.x lazy
    charting-library import bug (first construction can raise ImportError;
    the second succeeds)."""
    from vnstock import Trading

    try:
        return Trading(source=VNSTOCK_SOURCE)
    except ImportError:
        return Trading(source=VNSTOCK_SOURCE)


def _coerce_num(v):
    try:
        if v is None:
            return None
        f = float(v)
        return f
    except (TypeError, ValueError):
        return None


def fetch_today_snapshot(symbols: list[str], expected_date: str | None = None,
                         chunk_size: int = PRICE_BOARD_CHUNK) -> tuple[list[dict], dict]:
    """Fetch today's OHLCV bar for many symbols via bulk price_board calls.

    Returns (rows, stats). Each row has keys symbol, date, open, high, low,
    close, volume — prices in raw VND. Rows whose snapshot trading_date does not
    equal `expected_date` (when given) are skipped, so a stale snapshot (run on a
    holiday, or before today's close is published) never gets written as a new
    bar. Symbols with no match price (halted / untraded today) are also skipped.

    stats keys: requested, returned, written, skipped_stale, skipped_no_price,
    stale_dates (set of distinct off-dates seen).
    """
    stats = {
        "requested": len(symbols),
        "returned": 0,
        "written": 0,
        "skipped_stale": 0,
        "skipped_no_price": 0,
        "stale_dates": set(),
    }
    rows: list[dict] = []
    trading = _make_trading()

    for start in range(0, len(symbols), chunk_size):
        chunk = symbols[start:start + chunk_size]
        retries_used = 0
        df = None
        while True:
            try:
                df = trading.price_board(chunk)
                break
            except Exception as e:
                err = str(e)
                if "charting library" in err.lower() and trading is not None and retries_used == 0:
                    # Re-make the client once (lazy-init bug) and retry free.
                    trading = _make_trading()
                    retries_used += 1
                    continue
                if retries_used < len(RETRY_DELAYS_SECONDS):
                    wait = RETRY_DELAYS_SECONDS[retries_used]
                    retries_used += 1
                    print(f"  price_board chunk [{start}:{start + len(chunk)}]: {err[:80]} — retry in {wait:.0f}s")
                    time.sleep(wait)
                    continue
                print(f"  price_board chunk [{start}:{start + len(chunk)}]: failed — {err[:160]}")
                df = None
                break

        if df is None or df.empty:
            continue

        listing = df["listing"]
        match = df["match"]
        n = len(df)
        stats["returned"] += n
        for i in range(n):
            sym = listing["symbol"].iloc[i]
            bar_date = str(listing["trading_date"].iloc[i])[:10]
            if expected_date is not None and bar_date != expected_date:
                stats["skipped_stale"] += 1
                stats["stale_dates"].add(bar_date)
                continue
            close = _coerce_num(match["match_price"].iloc[i])
            if close is None or close <= 0:
                stats["skipped_no_price"] += 1
                continue
            o = _coerce_num(match["open_price"].iloc[i])
            h = _coerce_num(match["highest"].iloc[i])
            l = _coerce_num(match["lowest"].iloc[i])
            vol = _coerce_num(match["accumulated_volume"].iloc[i])
            rows.append({
                "symbol": sym,
                "date": bar_date,
                # price_board is already raw VND (no ×1000). Fall back to close
                # for any missing OHLC field so the bar is always well-formed.
                "open": o if o and o > 0 else close,
                "high": h if h and h > 0 else close,
                "low": l if l and l > 0 else close,
                "close": close,
                "volume": int(vol) if vol is not None else 0,
            })

    stats["written"] = len(rows)
    return rows, stats


def upsert_ohlcv(client, rows: list[dict]) -> int:
    """Upsert OHLCV rows into ta_ohlcv. Returns number of rows written."""
    if not rows:
        return 0
    safe_execute(client.table("ta_ohlcv").upsert(rows, on_conflict="symbol,date"),
                 label="ohlcv upsert")
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
