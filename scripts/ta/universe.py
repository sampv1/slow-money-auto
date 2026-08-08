"""Manage the TA scanner universe — which symbols are scanned each day.

The universe is stored in the ta_universe table. This module provides:
- fetching candidate lists (all HOSE+HNX+UPCOM, VN100 only, or a built-in default)
- applying a liquidity filter using cached OHLCV data
- reading the active universe back from the DB
"""

from .common import safe_execute

TARGET_EXCHANGES = {"HOSE", "HNX", "UPCOM"}

# Curated fallback list of major HOSE tickers (VN30 + popular mid-caps).
# Used when vnstock's listing API is unavailable. Edit ta_universe directly
# in the DB to adjust the live universe.
DEFAULT_HOSE_SYMBOLS = [
    # VN30 core
    "ACB", "BCM", "BID", "BVH", "CTG", "FPT", "GAS", "GVR", "HDB", "HPG",
    "MBB", "MSN", "MWG", "PLX", "POW", "SAB", "SHB", "SSB", "SSI", "STB",
    "TCB", "TPB", "VCB", "VHM", "VIB", "VIC", "VJC", "VNM", "VPB", "VRE",
    # Common mid-caps and large brokers / financials
    "DGC", "DXG", "DGW", "EIB", "GMD", "HCM", "HSG", "KBC", "KDH", "NLG",
    "NVL", "PDR", "PNJ", "REE", "SBT", "VCI", "VHC", "VND", "VPI", "VSC",
    # Energy, materials, industrials
    "BSR", "CTD", "DCM", "DPM", "HAH", "HDG", "HT1", "LCG", "PC1", "PHR",
    "PVD", "PVT", "TLG", "VGC", "VSH",
    # Retail, consumer, real estate
    "BWE", "CRE", "DBC", "DHC", "DPG", "FRT", "HBC", "HHV", "ITA", "KSB",
    "PAN", "QNS", "TCH", "VTP",
]


def fetch_all_listed_stocks() -> list[tuple[str, str]] | None:
    """Fetch every listed stock from HOSE + HNX + UPCOM via vnstock.

    Returns a list of (symbol, exchange) tuples, or None on failure.
    Filters to type='stock' (excludes bonds, ETFs, warrants, special funds).
    """
    try:
        from vnstock import Listing

        df = Listing().symbols_by_exchange()
    except Exception as e:
        print(f"  vnstock symbols_by_exchange failed: {e}")
        return None

    if df is None or (hasattr(df, "empty") and df.empty):
        return None

    df = df[df["exchange"].isin(TARGET_EXCHANGES)]
    if "type" in df.columns:
        df = df[df["type"] == "stock"]

    return [(str(r.symbol).upper(), str(r.exchange)) for r in df.itertuples()]


def fetch_vn100_from_vnstock() -> list[str] | None:
    """Fetch the VN100 symbol list via vnstock. Returns None on failure."""
    try:
        from vnstock import Listing

        listing = Listing()
        # vnstock 3.x: symbols_by_group(group=...)
        try:
            df = listing.symbols_by_group(group="VN100")
        except TypeError:
            df = listing.symbols_by_group("VN100")
    except Exception as e:
        print(f"  vnstock VN100 fetch failed: {e}")
        return None

    if df is None or (hasattr(df, "empty") and df.empty):
        return None

    # vnstock may return a DataFrame with a 'symbol'/'ticker' column or a Series.
    if hasattr(df, "columns"):
        for col in ("symbol", "ticker", "Symbol", "Ticker"):
            if col in df.columns:
                return [str(s).upper() for s in df[col].tolist()]
        # Fallback: use the first column
        return [str(s).upper() for s in df.iloc[:, 0].tolist()]
    return [str(s).upper() for s in df.tolist()]


def upsert_symbols(client, symbols: list[str], exchange: str = "HOSE") -> int:
    """Upsert a list of symbols into ta_universe with is_active=true.

    All symbols are tagged with the same `exchange`. For multi-exchange
    rosters, use `upsert_symbols_with_exchanges` instead.

    Returns the number of rows upserted.
    """
    if not symbols:
        return 0
    rows = [
        {"symbol": s.upper(), "exchange": exchange, "is_active": True}
        for s in symbols
    ]
    safe_execute(client.table("ta_universe").upsert(rows, on_conflict="symbol"),
                 label="universe upsert")
    return len(rows)


def upsert_symbols_with_exchanges(client, items: list[tuple[str, str]]) -> int:
    """Upsert (symbol, exchange) tuples into ta_universe with is_active=true.

    Used when seeding from `fetch_all_listed_stocks()` where each symbol has
    its own exchange. Chunks the upsert to avoid 1k+-row payloads.

    Returns the number of rows upserted.
    """
    if not items:
        return 0
    rows = [
        {"symbol": sym.upper(), "exchange": exch, "is_active": True}
        for sym, exch in items
    ]
    chunk = 500
    for i in range(0, len(rows), chunk):
        safe_execute(client.table("ta_universe").upsert(rows[i:i + chunk], on_conflict="symbol"),
                     label="universe upsert")
    return len(rows)


# Normalize vnstock exchange codes to the labels stored in ta_universe.
_EXCHANGE_NORM = {"HSX": "HOSE", "HOSE": "HOSE", "HNX": "HNX", "UPCOM": "UPCOM", "UPCo M": "UPCOM"}


def _paged_symbols(client, table: str, column: str = "symbol",
                   order_by: tuple[str, ...] = ("symbol",)) -> set[str]:
    """Return the distinct set of values of `column` from `table`, paging past
    the PostgREST 1000-row cap.

    `order_by` MUST be a total order (the primary key, or enough columns to be
    unique). Offset paging with no ORDER BY — or a partial one — relies on
    Postgres heap order, which shifts as rows are rewritten, so page boundaries
    silently skip or duplicate rows. A skip here is not cosmetic: the caller
    feeds `align_universe_to_fa`, which deactivates every ta_universe symbol
    absent from this set, so one dropped symbol falls out of the whole TA
    pipeline. fa_scores is rewritten daily by refresh_final_score, which is
    exactly the churn that makes heap order move.
    """
    out: set[str] = set()
    offset = 0
    page = 1000
    while True:
        q = client.table(table).select(",".join(dict.fromkeys((column, *order_by))))
        for col in order_by:
            q = q.order(col)
        rows = safe_execute(
            q.range(offset, offset + page - 1),
            label="universe read",
        ).data
        for r in rows:
            v = r.get(column)
            if v:
                out.add(str(v).upper())
        if len(rows) < page:
            break
        offset += page
    return out


def fetch_fa_symbols(client) -> set[str]:
    """The symbol set the FA scanner covers (distinct symbols in fa_scores)."""
    # (symbol, as_of_period) is fa_scores' primary key — a total order, which
    # offset paging requires. See _paged_symbols.
    return _paged_symbols(client, "fa_scores", "symbol", ("symbol", "as_of_period"))


def _resolve_exchanges(symbols: list[str]) -> dict[str, str]:
    """Look up the exchange for each symbol via a bulk price_board snapshot.
    Returns {symbol: exchange}; symbols not resolved are simply omitted."""
    if not symbols:
        return {}
    from .ohlcv import _make_trading, PRICE_BOARD_CHUNK

    trading = _make_trading()
    out: dict[str, str] = {}
    for start in range(0, len(symbols), PRICE_BOARD_CHUNK):
        chunk = symbols[start:start + PRICE_BOARD_CHUNK]
        try:
            df = trading.price_board(chunk)
        except Exception as e:
            print(f"  exchange lookup chunk failed: {str(e)[:120]}")
            continue
        if df is None or df.empty:
            continue
        listing = df["listing"]
        for i in range(len(df)):
            sym = str(listing["symbol"].iloc[i]).upper()
            exch = str(listing["exchange"].iloc[i])
            out[sym] = _EXCHANGE_NORM.get(exch, exch)
    return out


def align_universe_to_fa(client) -> dict:
    """Make the active ta_universe equal the FA-scanner universe.

    - Every FA symbol is upserted with is_active=true (reactivating any that the
      liquidity filter previously deactivated). New symbols get their exchange
      resolved via price_board.
    - Symbols in ta_universe that are NOT in the FA set are deactivated, so the
      two scanners cover exactly the same names.

    Returns a stats dict.
    """
    fa_syms = fetch_fa_symbols(client)
    if not fa_syms:
        return {"fa_symbols": 0, "activated": 0, "deactivated": 0, "new": 0}

    # Existing rows: symbol -> exchange.
    existing: dict[str, str] = {}
    offset, page = 0, 1000
    while True:
        rows = safe_execute(
            client.table("ta_universe")
            .select("symbol,exchange")
            .range(offset, offset + page - 1),
            label="universe read",
        ).data
        for r in rows:
            existing[str(r["symbol"]).upper()] = r.get("exchange") or "HOSE"
        if len(rows) < page:
            break
        offset += page

    new_syms = sorted(fa_syms - set(existing))
    resolved = _resolve_exchanges(new_syms) if new_syms else {}

    # Upsert all FA symbols as active.
    rows = [
        {
            "symbol": s,
            "exchange": existing.get(s) or resolved.get(s) or "HOSE",
            "is_active": True,
        }
        for s in sorted(fa_syms)
    ]
    chunk = 500
    for i in range(0, len(rows), chunk):
        safe_execute(client.table("ta_universe").upsert(rows[i:i + chunk], on_conflict="symbol"),
                     label="universe upsert")

    # Deactivate everything not in the FA set.
    to_deactivate = sorted(set(existing) - fa_syms)
    for i in range(0, len(to_deactivate), chunk):
        batch = to_deactivate[i:i + chunk]
        safe_execute(client.table("ta_universe").update({"is_active": False}).in_("symbol", batch),
                     label="universe deactivate")

    return {
        "fa_symbols": len(fa_syms),
        "activated": len(rows),
        "deactivated": len(to_deactivate),
        "new": len(new_syms),
    }


def get_active_symbols(client) -> list[str]:
    """Return the list of symbols where is_active = true, sorted alphabetically.

    Pages past the PostgREST 1000-row cap — the active universe is now ~1,568,
    so an un-paged query would silently process only the first 1,000 symbols.
    """
    out: list[str] = []
    offset, page = 0, 1000
    while True:
        rows = safe_execute(
            client.table("ta_universe")
            .select("symbol")
            .eq("is_active", True)
            .order("symbol")
            .range(offset, offset + page - 1),
            label="universe read",
        ).data
        out.extend(r["symbol"] for r in rows)
        if len(rows) < page:
            break
        offset += page
    return out


def apply_liquidity_filter(
    client,
    min_avg_volume: int = 300_000,
    min_close_vnd: int = 10_000,
    lookback_days: int = 20,
) -> tuple[int, int]:
    """Deactivate universe entries that fail the liquidity filter.

    Filter: avg(volume) over the last `lookback_days` trading days >= min_avg_volume
    AND latest close >= min_close_vnd.

    Returns (kept_active, deactivated).
    """
    universe = get_active_symbols(client)
    kept = 0
    deactivated = 0
    for symbol in universe:
        result = safe_execute(
            client.table("ta_ohlcv")
            .select("close,volume,date")
            .eq("symbol", symbol)
            .order("date", desc=True)
            .limit(lookback_days),
            label=f"ohlcv liquidity {symbol}",
        )
        rows = result.data
        if not rows:
            # No price data → deactivate (we can't evaluate the filter)
            safe_execute(client.table("ta_universe").update({"is_active": False}).eq("symbol", symbol),
                         label="universe deactivate")
            deactivated += 1
            continue

        avg_vol = sum(int(r["volume"]) for r in rows) / len(rows)
        latest_close = float(rows[0]["close"])
        passes = avg_vol >= min_avg_volume and latest_close >= min_close_vnd

        if passes:
            kept += 1
        else:
            safe_execute(client.table("ta_universe").update({"is_active": False}).eq("symbol", symbol),
                         label="universe deactivate")
            deactivated += 1

    return kept, deactivated
