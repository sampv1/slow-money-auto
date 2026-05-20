"""Manage the TA scanner universe — which symbols are scanned each day.

The universe is stored in the ta_universe table. This module provides:
- fetching candidate lists (VN100 via vnstock, or a built-in default)
- applying a liquidity filter using cached OHLCV data
- reading the active universe back from the DB
"""

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

    Returns the number of rows upserted.
    """
    if not symbols:
        return 0
    rows = [
        {"symbol": s.upper(), "exchange": exchange, "is_active": True}
        for s in symbols
    ]
    client.table("ta_universe").upsert(rows, on_conflict="symbol").execute()
    return len(rows)


def get_active_symbols(client) -> list[str]:
    """Return the list of symbols where is_active = true, sorted alphabetically."""
    result = (
        client.table("ta_universe")
        .select("symbol")
        .eq("is_active", True)
        .order("symbol")
        .execute()
    )
    return [r["symbol"] for r in result.data]


def apply_liquidity_filter(
    client,
    min_avg_volume: int = 100_000,
    min_close_vnd: int = 5_000,
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
        result = (
            client.table("ta_ohlcv")
            .select("close,volume,date")
            .eq("symbol", symbol)
            .order("date", desc=True)
            .limit(lookback_days)
            .execute()
        )
        rows = result.data
        if not rows:
            # No price data → deactivate (we can't evaluate the filter)
            client.table("ta_universe").update({"is_active": False}).eq("symbol", symbol).execute()
            deactivated += 1
            continue

        avg_vol = sum(int(r["volume"]) for r in rows) / len(rows)
        latest_close = float(rows[0]["close"])
        passes = avg_vol >= min_avg_volume and latest_close >= min_close_vnd

        if passes:
            kept += 1
        else:
            client.table("ta_universe").update({"is_active": False}).eq("symbol", symbol).execute()
            deactivated += 1

    return kept, deactivated
