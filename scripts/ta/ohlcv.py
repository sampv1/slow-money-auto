"""Fetch and cache OHLCV data via vnstock for the TA scanner.

Prices are stored in raw VND (vnstock returns thousands, multiplied by 1000),
matching the convention used elsewhere in this repo (see update_prices.py).
"""

import time
from datetime import date, datetime, time as clock_time, timedelta

from .chart_only import price_scale
from .common import REQUEST_DELAY, VNSTOCK_SOURCE, safe_execute, today_vn


# Earliest date any backfill asks for. The provider decides what it will
# actually serve (see warm_up_provider); this is simply "everything you have".
FULL_HISTORY_START = date(2000, 1, 1)


# Per-symbol retry schedule for transient vnstock failures (timeouts, rate
# limits, brief upstream errors). Total worst-case wait: ~85s before giving
# up — acceptable for a midnight cron where reliability > latency.
RETRY_DELAYS_SECONDS = (5.0, 20.0, 60.0)


def _valid_bar(o: float, h: float, l: float, c: float) -> bool:
    """Would these four numbers draw a real candle?

    A bar with a zero or negative price is not a cheap stock, it is a hole in
    the provider's response, and it is worse than a missing bar: a missing bar
    leaves a gap on the chart, while a zero close draws a spike to the floor,
    re-seats the y-axis for the whole series, and feeds a fabricated return
    into anything that reads the row. `high < low` is the same kind of
    impossibility from the other direction.

    Both are cheap to test and neither is recoverable, so the bar is dropped
    rather than repaired — and the drop is COUNTED, because silently returning
    fewer bars than the provider sent is how a partial response gets mistaken
    for a short listing history.
    """
    if not all(v is not None and v > 0 for v in (o, h, l, c)):
        return False
    return h >= l


# Phrases the provider uses to say "this symbol has no data", in the two
# wordings seen in the wild. NEITHER is reachable through str(RetryError) —
# see _root_message.
NO_DATA_PHRASES = ("dữ liệu trống", "không tìm thấy dữ liệu", "empty")


def _root_message(exc: BaseException) -> str:
    """The innermost exception's message, through tenacity's RetryError.

    `str(RetryError)` renders as `RetryError[<Future at 0x… raised ValueError>]`
    — the ValueError's own message is nowhere in it. So a permanent-failure
    check written against the provider's wording silently never fires, and every
    genuinely-absent symbol burns the full retry schedule instead of returning
    at once.

    Measured 2026-09-03: 36 symbols that the provider answers with "Không tìm
    thấy dữ liệu" were retried three times each, twice — 74 minutes of a 74
    minute run, spent re-asking for data that does not exist. The same repr is
    what hid the UnboundLocalError during the 2026-08-18 outage; this is the
    second incident it has caused, so the unwrapping is now shared.
    """
    seen = set()
    cur: BaseException | None = exc
    while cur is not None and id(cur) not in seen:
        seen.add(id(cur))
        nxt = None
        attempt = getattr(cur, "last_attempt", None)
        if attempt is not None:
            try:
                nxt = attempt.exception()
            except Exception:  # noqa: BLE001
                nxt = None
        if nxt is None:
            nxt = cur.__cause__ or cur.__context__
        if nxt is None:
            return str(cur)
        cur = nxt
    return str(exc)


def warm_up_provider() -> bool:
    """Spend the free tier's uncapped FIRST call on a throwaway request.

    Measured on vnstock 4.0.4 (2026-09-02): the first `Quote.history()` call in
    a process is served in full — FPT came back with 4,912 bars to 2006 — while
    every call after it is truncated to the community tier's documented 8 years
    (1,997 bars, from 2018-08-30). vnai's metering patch evidently lands after
    the first request rather than before it. Verified deliberately: with VNM
    first it took the 5,138-bar series and FPT, second, got 1,997.

    That makes depth an accident of ORDERING, which is exactly the trap the S/R
    warm-up window already had to fix — one symbol in the run would carry twenty
    years of chart while its neighbours carry eight, and which one it was would
    change every time the work-list was re-sorted. Burning the uncapped call on
    a throwaway makes every symbol in the run get the same treatment.

    Returns True if the warm-up call completed (its data is discarded either
    way; a failure only means the next call inherits the uncapped slot, which
    costs uniformity, not correctness).
    """
    from vnstock import Quote

    end = today_vn()
    for _ in range(2):  # the 4.0.x "no charting library" first-call bug
        try:
            Quote(symbol="FPT", source=VNSTOCK_SOURCE).history(
                start=(end - timedelta(days=7)).isoformat(),
                end=end.isoformat(), interval="1D")
            return True
        except Exception:  # noqa: BLE001
            continue
    return False


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
            root = _root_message(e)

            # PERMANENT: the provider says it has nothing for this symbol.
            # Matched against the ROOT message, not str(e): tenacity wraps the
            # ValueError in a RetryError whose repr carries no message at all,
            # so this branch was unreachable and every absent symbol paid the
            # full 85s retry schedule to be told the same thing three times.
            low = root.lower()
            if any(p in low for p in NO_DATA_PHRASES):
                print(f"  {symbol}: no data at provider — {root[:90]}")
                return None

            # One-shot workaround for the vnstock 4.0.x first-call bug.
            if "charting library" in err.lower() and not used_charting_retry:
                used_charting_retry = True
                continue

            # Real error — back off and retry.
            if retries_used < len(RETRY_DELAYS_SECONDS):
                wait = RETRY_DELAYS_SECONDS[retries_used]
                retries_used += 1
                print(f"  {symbol}: {root[:80]} — retry in {wait:.0f}s ({retries_used}/{len(RETRY_DELAYS_SECONDS)})")
                time.sleep(wait)
                continue

            print(f"  {symbol}: failed after {retries_used} retries — {root[:160]}")
            return None

    if df is None or df.empty:
        print(f"  {symbol}: no data returned")
        return None

    rows = []
    dropped = 0
    # Stocks come back in thousands of VND; an index or futures contract is
    # already in points. See ta/chart_only.price_scale — looked up per SYMBOL so
    # no caller can forget it and store an index at 1,000x.
    scale = price_scale(symbol)
    for _, r in df.iterrows():
        try:
            o = float(r["open"]) * scale
            h = float(r["high"]) * scale
            l = float(r["low"]) * scale
            c = float(r["close"]) * scale
        except (TypeError, ValueError):
            dropped += 1
            continue
        if not _valid_bar(o, h, l, c):
            dropped += 1
            continue
        rows.append(
            {
                "symbol": symbol,
                "date": str(r["time"])[:10],
                "open": o,
                "high": h,
                "low": l,
                "close": c,
                "volume": int(r["volume"] or 0),
            }
        )
    if dropped:
        print(f"  {symbol}: dropped {dropped} malformed bar(s) of {len(df)}")
    return rows


# --- Bulk latest-session snapshot via price_board ---------------------------
#
# After the ATC auction, vnstock's Trading.price_board returns a complete daily
# OHLCV snapshot (open/high/low/last/volume) for an arbitrary list of symbols in
# a SINGLE request — ~600 symbols in <1s. Verified byte-for-byte identical to
# history() for the same trading day. Unlike history(), price_board values are
# already in raw VND (no x1000) and it only ever returns each symbol's LATEST
# bar, so it is used exclusively for the daily incremental path; history()
# remains the backfill / gap-fill path.

PRICE_BOARD_CHUNK = 500

# The VN cash market closes at 15:00 ICT. The settling margin covers the gap
# between the bell and the provider publishing a final ATC print.
MARKET_CLOSE_VN = clock_time(15, 0)
SESSION_SETTLE = timedelta(minutes=15)


def is_session_final(session: date, now: datetime) -> bool:
    """Is `session` a COMPLETED trading day as of `now` (VN time)?

    This is the question the daily path actually needs answered, and it is a
    question about the clock, not about date equality:

      * a session older than today is complete by definition, whatever time it
        is now — this is the case a delayed cron lands in;
      * today's session is complete only once the 15:00 ICT close plus a
        settling margin has passed;
      * a session dated in the FUTURE means the provider's clock disagrees with
        ours, which is not something to guess about — refuse it.
    """
    today = now.date()
    if session < today:
        return True
    if session > today:
        return False
    close = datetime.combine(today, MARKET_CLOSE_VN, tzinfo=now.tzinfo) + SESSION_SETTLE
    return now >= close


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


def fetch_latest_session(symbols: list[str],
                         chunk_size: int = PRICE_BOARD_CHUNK) -> tuple[list[dict], dict]:
    """Fetch the market's LATEST SESSION for many symbols via bulk price_board.

    Returns (rows, stats). Each row has keys symbol, date, open, high, low,
    close, volume — prices in raw VND.

    THE TARGET IS THE MARKET'S LATEST SESSION, NOT THE WALL-CLOCK DATE.
    price_board reports each symbol's OWN last trading_date, so one snapshot
    legitimately carries dozens of dates: the actively-traded names share the
    newest session while dormant UPCOM lines still show whenever they last
    printed. The session is therefore the MAXIMUM of those dates. Rows at any
    older date belong to symbols that did not trade in it and are skipped —
    they are not stale data, they are other symbols' last trades.

    Asking instead for `trading_date == today_vn()` cost two whole sessions on
    2026-08-27 and 2026-08-28. GitHub delayed the 09:23 UTC cron by ~10 hours,
    so the run began at 02:52 VN on the FOLLOWING day; the snapshot correctly
    carried the previous session, every row was rejected as "stale", and the
    holiday branch reported "a non-trading day ... Nothing written, by design"
    and exited 0 — which in turn let the backup cron's precheck skip, because a
    successful run already existed for the day. Nothing was wrong with the data;
    the run was asking the wrong question.

    Deciding whether that session may be WRITTEN is the caller's job, via
    `is_session_final` — this function reports what it saw and writes nothing.

    stats keys: requested, returned, written, session_date (a `date` or None),
    other_dates (dates seen that are not the session), skipped_older,
    skipped_no_price, skipped_undated, chunks, failed_chunks.

    `failed_chunks` is what separates the two ways this returns nothing, and the
    caller MUST branch on it: a holiday returns a session the caller already has
    (failed_chunks == 0), whereas a provider outage returns nothing at all
    (failed_chunks == chunks). Both wrote "0 rows" on 2026-08-18 and, with no
    way to tell them apart, the run reported success.
    """
    stats = {
        "requested": len(symbols),
        "returned": 0,
        "written": 0,
        "session_date": None,
        "other_dates": set(),
        "skipped_older": 0,
        "skipped_no_price": 0,
        "skipped_undated": 0,
        "chunks": 0,
        "failed_chunks": 0,
    }
    # (bar_date, row) for every priced symbol; the session is picked afterwards,
    # because it cannot be known until every chunk has been seen.
    dated: list[tuple[date, dict]] = []
    trading = _make_trading()

    for start in range(0, len(symbols), chunk_size):
        chunk = symbols[start:start + chunk_size]
        stats["chunks"] += 1
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
                stats["failed_chunks"] += 1
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
            try:
                bar_date = date.fromisoformat(str(listing["trading_date"].iloc[i])[:10])
            except (TypeError, ValueError):
                # 'None' / 'nan' — a symbol the provider has never printed.
                stats["skipped_undated"] += 1
                continue
            close = _coerce_num(match["match_price"].iloc[i])
            if close is None or close <= 0:
                stats["skipped_no_price"] += 1
                continue
            o = _coerce_num(match["open_price"].iloc[i])
            h = _coerce_num(match["highest"].iloc[i])
            l = _coerce_num(match["lowest"].iloc[i])
            vol = _coerce_num(match["accumulated_volume"].iloc[i])
            dated.append((bar_date, {
                "symbol": sym,
                "date": bar_date.isoformat(),
                # price_board is already raw VND (no x1000). Fall back to close
                # for any missing OHLC field so the bar is always well-formed.
                "open": o if o and o > 0 else close,
                "high": h if h and h > 0 else close,
                "low": l if l and l > 0 else close,
                "close": close,
                "volume": int(vol) if vol is not None else 0,
            }))

    if not dated:
        return [], stats

    session = max(d for d, _ in dated)
    stats["session_date"] = session
    rows = [r for d, r in dated if d == session]
    stats["other_dates"] = {d for d, _ in dated if d != session}
    stats["skipped_older"] = len(dated) - len(rows)
    stats["written"] = len(rows)
    return rows, stats


def stored_bar_count(client, session_iso: str) -> int:
    """How many ta_ohlcv bars we already hold for one date.

    Separates "the market produced a new session" from "we are looking at a
    session we already collected", which is what a holiday, a same-day re-run
    and a delayed cron all look like from inside the snapshot alone.
    """
    res = safe_execute(
        client.table("ta_ohlcv").select("symbol", count="exact").eq("date", session_iso).limit(1),
        label=f"stored bars {session_iso}",
    )
    return res.count or 0


def upsert_ohlcv(client, rows: list[dict]) -> int:
    """Upsert OHLCV rows into ta_ohlcv. Returns number of rows written."""
    if not rows:
        return 0
    safe_execute(client.table("ta_ohlcv").upsert(rows, on_conflict="symbol,date"),
                 label="ohlcv upsert")
    return len(rows)


def earliest_stored_bars(client, symbols: list[str]) -> dict[str, str]:
    """{symbol: its OLDEST stored ta_ohlcv date} for the symbols given.

    The resume key for a deep backfill, and it is deliberately the oldest bar
    rather than "does this symbol have any rows at all". Every symbol has rows —
    the daily pass appends one a night — so a presence test would skip the
    entire universe and resume nothing. Depth is the thing being filled, so
    depth is the thing to compare.

    (The FA importer learned the same lesson from the other side: its `--resume`
    skips any symbol with ANY rows and therefore cannot repair a partial symbol.
    Here a partial symbol is the normal case, so the check has to be finer.)

    One request per symbol, ordered ascending with limit 1 — the index on
    (symbol, date) makes each a single-row lookup rather than a scan.
    """
    out: dict[str, str] = {}
    for sym in symbols:
        rows = safe_execute(
            client.table("ta_ohlcv").select("date").eq("symbol", sym)
            .order("date").limit(1),
            label=f"earliest bar {sym}",
        ).data or []
        if rows:
            out[sym] = rows[0]["date"]
    return out


def backfill_symbol(client, symbol: str, days: int = 90,
                    start: date | None = None) -> int:
    """Backfill OHLCV for a symbol.

    `start` overrides the `days` window outright — pass FULL_HISTORY_START to
    ask for everything the provider will serve.

    Returns the number of rows written.
    """
    end = today_vn()
    begin = start if start is not None else end - timedelta(days=days)
    rows = fetch_ohlcv(symbol, begin, end)
    if not rows:
        return 0
    return upsert_ohlcv(client, rows)


def backfill_symbols(client, symbols: list[str], days: int = 90,
                     delay: float = REQUEST_DELAY,
                     start: date | None = None,
                     on_done=None) -> dict[str, int]:
    """Backfill OHLCV for a list of symbols. Returns {symbol: rows_written}.

    `on_done(i, symbol, rows)` is called after each symbol, so a long run can
    report progress and persist a resume point without this function needing to
    know how either is done.
    """
    results: dict[str, int] = {}
    total = len(symbols)
    for i, symbol in enumerate(symbols, 1):
        print(f"[{i}/{total}] {symbol}", end=" ", flush=True)
        n = backfill_symbol(client, symbol, days=days, start=start)
        results[symbol] = n
        print(f"\u2192 {n} rows")
        if on_done is not None:
            on_done(i, symbol, n)
        if i < total:
            time.sleep(delay)
    return results
