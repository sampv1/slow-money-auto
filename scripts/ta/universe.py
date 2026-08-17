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


# ── Delisting / dormancy ─────────────────────────────────────────────────────
# `is_active` is supposed to mean "listed and trading". It did not: the universe
# was aligned to the FA set (align_universe_to_fa), so `is_active` really meant
# "someone imported this company's financials from a FiinProX spreadsheet".
# Nothing ever retired a symbol that stopped trading, which left names like GE2
# (last bar 2022-12-28) and a cluster of UPCOM tickers frozen at 2024-07-25
# marked active.
#
# That is not merely untidy — it corrupts RS. `_trailing_returns` anchors on the
# SYMBOL'S OWN last bar, so a symbol frozen in 2024 gets a percentile computed
# from 2024 price action and then ranked in the same 1..99 cross-section as
# symbols measured to today. Fifteen symbols more than a year stale were carrying
# a live rs_3m that way.

STALE_DAYS_DEFAULT = 90  # a full quarter with no trade at all


def _last_bar_by_symbol(client, symbols: list[str], recent_from: str) -> dict[str, str]:
    """symbol -> most recent ta_ohlcv date.

    Two passes, because PostgREST has no GROUP BY and per-symbol probes for the
    whole universe would be ~1,500 round trips: one paged scan of the recent
    window resolves the actively-trading majority, then only the leftovers are
    probed individually.
    """
    last: dict[str, str] = {}
    offset = 0
    while True:
        rows = safe_execute(
            client.table("ta_ohlcv").select("symbol,date")
            .gte("date", recent_from).order("date").range(offset, offset + 999),
            label="stale scan",
        ).data
        for r in rows:
            s = r["symbol"]
            if r["date"] > last.get(s, ""):
                last[s] = r["date"]
        if len(rows) < 1000:
            break
        offset += 1000
    for s in symbols:
        if s in last:
            continue
        rows = safe_execute(
            client.table("ta_ohlcv").select("date").eq("symbol", s)
            .order("date", desc=True).limit(1),
            label=f"stale probe {s}",
        ).data
        if rows:
            last[s] = rows[0]["date"]
    return last


def deactivate_stale_symbols(client, stale_days: int = STALE_DAYS_DEFAULT,
                             recent_days: int = 120, dry_run: bool = False) -> dict:
    """Deactivate active symbols with no bar in the last `stale_days` days.

    Staleness is measured against the MARKET's latest bar, not wall-clock today,
    so a holiday or a late pipeline run can never mass-retire the universe.

    Symbols with NO bars at all are reported but NOT deactivated: that shape is
    ambiguous — it is equally a symbol just added and awaiting backfill — and
    `added_at` cannot disambiguate it (align_universe_to_fa's upsert rewrites the
    column). Retiring them needs a human look, so they come back in `no_bars`.

    Returns a stats dict; with dry_run=True nothing is written.
    """
    from datetime import date as _d, timedelta as _td

    active = get_active_symbols(client)
    recent_from = (_d.today() - _td(days=recent_days)).isoformat()
    last = _last_bar_by_symbol(client, active, recent_from)
    if not last:
        return {"active": len(active), "market_last": None, "stale": 0,
                "no_bars": 0, "deactivated": 0, "symbols": []}

    market_last = max(last.values())
    cutoff = (_d.fromisoformat(market_last) - _td(days=stale_days)).isoformat()

    stale = sorted(s for s in active if s in last and last[s] < cutoff)
    no_bars = sorted(s for s in active if s not in last)

    stats = {"active": len(active), "market_last": market_last, "cutoff": cutoff,
             "stale": len(stale), "no_bars": len(no_bars), "deactivated": 0,
             "symbols": [(s, last[s]) for s in stale]}
    if dry_run or not stale:
        return stats

    _retire(client, stale, "universe retire stale")
    stats["deactivated"] = len(stale)
    return stats


# Deactivating must also clear the derived snapshot. Only two dashboard reads
# filter on is_active (the TA scanner and getUniverseLiquidity), so a row left
# holding rs_3m/ta_score stays reachable everywhere else — and for a retired
# symbol those values were computed from a window ending at its OWN last bar,
# months or years ago. Same field list the RS retire step uses, plus ta_score,
# which is derived from exactly the RS being cleared.
RETIRED_FIELDS = {
    "is_active": False,
    "rs_3m": None, "rs_6m": None, "rs_9m": None, "rs_12m": None,
    "rs_composite": None, "rs_1m": None, "rs_date": None,
    "rs_line": None, "rs_line_full": None, "rs_line_date": None,
    "rs_line_dates": None, "rs_line_score": None, "rs_line_grade": None,
    "ta_score": None,
    # The trend read goes too, for the same reason as the RS columns: a retired
    # row keeps rendering wherever a page does not filter on is_active, and a
    # structure score is the last thing that should outlive the symbol's trading.
    "trend_score": None, "trend_score_daily": None, "trend_score_weekly": None,
    "trend_grade": None, "trend_state_daily": None, "trend_state_weekly": None,
    "trend_status": None, "trend_action": None, "trend_detail": None,
    "trend_chart": None, "trend_date": None,
}


def _retire(client, symbols: list[str], label: str) -> None:
    """Deactivate `symbols` and blank every derived read on them."""
    for i in range(0, len(symbols), 200):
        safe_execute(
            client.table("ta_universe").update(RETIRED_FIELDS)
            .in_("symbol", symbols[i:i + 200]),
            label=label,
        )


def sync_universe_to_listing(client, stale_days: int = STALE_DAYS_DEFAULT,
                             recent_days: int = 120, dry_run: bool = False) -> dict:
    """Make ta_universe.is_active equal ONE predicate:

        is_active  ⟺  listed as a stock  AND  traded within `stale_days`

    Both halves are needed and neither alone is right. Listing membership alone
    resurrects companies that are technically listed but have not printed a
    trade in years; a liveness check alone keeps ETFs and delisted tickers whose
    last bars merely happen to be recent. Crucially they must be ONE operation —
    two commands each owning half of the same flag will each undo the other
    (membership reactivates what liveness just retired), and the intermediate
    state is wrong no matter which order you pick.

    This is the canonical universe source. It replaces align_universe_to_fa,
    which derived the TA universe from `fa_scores` and so made a symbol's
    TECHNICAL coverage depend on whether someone had imported its financials
    from a FiinProX spreadsheet. TA needs only OHLCV — already fetched for the
    whole board nightly — so that dependency was accidental, and it silently
    capped TA at FA's reach.

    The listing is also the only source that can answer two questions `fa_scores`
    never could:
      * instrument type — it filters to type='stock', which excludes the ETFs and
        closed-end funds (E1VFVN30, the FUE* family) that were being percentile-
        ranked against ordinary shares despite being index baskets by construction;
      * delisting — a symbol absent from the listing is gone, which resolves the
        "no bars ever" cohort that `added_at` cannot disambiguate (an upsert
        rewrites it, so a delisted symbol and a brand-new one look identical).

    FA keeps its own universe. Final Score is already an inner join — it is
    written per (symbol, as_of_period) onto fa_scores — so a TA-only symbol
    simply never receives one, and an FA-only symbol keeps its FA score with no
    technical read. Neither side constrains the other any more.

    Returns a stats dict; with dry_run=True nothing is written.
    """
    from datetime import date as _d, timedelta as _td

    listed = fetch_all_listed_stocks()
    if not listed:
        # Never fall through to "deactivate everything" on a failed fetch: one
        # flaky external call would retire the entire universe.
        return {"listed": 0, "error": "listing fetch failed", "added": 0,
                "activated": 0, "retired": 0,
                "symbols": {"added": [], "activated": [], "retired": []}}

    by_symbol: dict[str, str] = {}
    for sym, exch in listed:
        s = str(sym).upper()
        by_symbol[s] = _EXCHANGE_NORM.get(str(exch), str(exch))

    existing: dict[str, bool] = {}
    offset, page = 0, 1000
    while True:
        rows = safe_execute(
            client.table("ta_universe").select("symbol,is_active")
            .order("symbol").range(offset, offset + page - 1),
            label="universe read",
        ).data
        for r in rows:
            existing[str(r["symbol"]).upper()] = bool(r.get("is_active"))
        if len(rows) < page:
            break
        offset += page

    # Liveness, over the union of listed and already-known symbols.
    recent_from = (_d.today() - _td(days=recent_days)).isoformat()
    last = _last_bar_by_symbol(client, sorted(set(by_symbol) | set(existing)), recent_from)
    market_last = max(last.values()) if last else None
    cutoff = ((_d.fromisoformat(market_last) - _td(days=stale_days)).isoformat()
              if market_last else None)

    # LIVENESS IS ONLY DECIDABLE FOR SYMBOLS WE WERE ACTUALLY COLLECTING.
    # Both the daily OHLCV pass and the backfill iterate get_active_symbols, so an
    # INACTIVE symbol's last bar records the day we stopped collecting, not the day
    # it stopped trading — the 18 symbols this sync reactivates all stop dead on one
    # of two dates (2026-05-19/20 and 2026-06-18/19), which are FA-alignment runs,
    # not delistings. Judging them on that data is a self-fulfilling loop: excluded
    # ⇒ no data ⇒ looks dormant ⇒ stays excluded. Precisely the coupling being
    # removed here, so it must not be re-created in the replacement.
    #
    # Hence: only a currently-ACTIVE symbol can be retired for dormancy. Anything
    # listed but untracked is admitted, collected for a cycle, and judged next run.
    def trading(s: str) -> bool:
        if cutoff is None:
            return True
        if not existing.get(s, False):
            return True          # new or untracked — no evidence either way
        return s in last and last[s] >= cutoff

    target = {s for s in by_symbol if trading(s)}

    added = sorted(s for s in by_symbol if s not in existing)
    activated = sorted(s for s in target if not existing.get(s, False))
    retired = sorted(s for s, act in existing.items() if act and s not in target)

    stats = {"listed": len(by_symbol), "market_last": market_last, "cutoff": cutoff,
             "active_target": len(target), "added": len(added),
             "activated": len(activated), "retired": len(retired),
             "unlisted_retired": len([s for s in retired if s not in by_symbol]),
             "dormant_retired": len([s for s in retired if s in by_symbol]),
             "symbols": {"added": added, "activated": activated, "retired": retired}}
    if dry_run:
        return stats

    # is_active is set per symbol here (not blanket-true like
    # upsert_symbols_with_exchanges), so one pass expresses the whole predicate.
    payload = [{"symbol": s, "exchange": by_symbol[s], "is_active": s in target}
               for s in sorted(by_symbol)]
    for i in range(0, len(payload), 500):
        safe_execute(
            client.table("ta_universe").upsert(payload[i:i + 500], on_conflict="symbol"),
            label="universe listing upsert",
        )
    # Blank the derived reads on everything leaving the active set — including
    # rows the upsert above already flipped, which only touched is_active.
    _retire(client, retired, "universe retire")
    return stats


def get_universe_symbols(client) -> list[str]:
    """Every symbol in ta_universe, ACTIVE OR NOT, sorted alphabetically.

    Price COLLECTION is deliberately wider than scoring. The daily OHLCV pass is
    one bulk price_board snapshot whose cost barely moves with symbol count, so
    collecting the full membership is close to free — while collecting only the
    active set creates a trap: liveness becomes unobservable for anything
    excluded, so `excluded ⇒ no data ⇒ looks dormant ⇒ stays excluded` closes
    into a loop no amount of re-syncing can open. (Seen for real: 14 listed,
    tradeable stocks whose bars stop dead on two dates that are FA-alignment runs
    rather than delistings.)

    `is_active` therefore governs SCORING AND DISPLAY only — RS, TA Score, the
    scanners. Everything that ranks or shows symbols keeps using
    get_active_symbols; only the price fetch uses this.
    """
    out: list[str] = []
    offset, page = 0, 1000
    while True:
        rows = safe_execute(
            client.table("ta_universe").select("symbol").order("symbol")
            .range(offset, offset + page - 1),
            label="universe read all",
        ).data
        out.extend(str(r["symbol"]).upper() for r in rows)
        if len(rows) < page:
            break
        offset += page
    return sorted(set(out))
