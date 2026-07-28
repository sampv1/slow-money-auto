"""VN-Index excluding the Vingroup family — a market gauge VIC can't dominate.

WHY THIS EXISTS
    VN-Index is a full market-cap (Paasche) index over every HOSE listing, so a
    single issuer can swamp it. The Vingroup family went from 7.8% of HOSE cap
    (2024-04) to 30.5% (2026-07) — VIC alone 21% — so the headline index now
    substantially reports "how is Vingroup doing", not "how is the market
    doing". This module reconstructs the index with that family removed.

METHOD — decompose the official index, don't rebuild it
    HOSE:  Index(t) = M(t)/D(t) x 100,  M(t) = SUM_i P_i(t)*Q_i(t)
    with D restated on listings/rights/bonus so those don't move the index.

    Over one session D is constant, so the index return is the cap-weighted
    mean of member returns at PREVIOUS-CLOSE weights w_i(t-1) (which sum to 1):

        r_vni(t) = SUM_i w_i(t-1) * r_i(t),   w_i(t-1) = P_i(t-1)*Q_i / M(t-1)

    Split into family F and rest R, with W = SUM_{i in F} w_i and family
    contribution C_F(t) = SUM_{i in F} w_i(t-1)*r_i(t). Re-normalising R to sum
    to 1 gives the ex-family return:

        r_ex(t) = ( r_vni(t) - C_F(t) ) / ( 1 - W(t-1) )

    chained into a level anchored to the index at the first date:

        L(t0) = Index(t0),   L(t) = L(t-1) * (1 + r_ex(t))

    This is deliberately NOT a bottom-up rebuild of SUM P*Q. Taking r_vni from
    the official series inherits HOSE's own divisor handling (new listings,
    delistings, rights, bonus) for free, and our own imperfect data is used
    only to estimate a WEIGHT — the least error-sensitive input. A bottom-up
    rebuild would push every share-count and coverage error straight into the
    level. Note only the family weights are needed individually; every other
    stock enters solely through the denominator M(t-1).

THE ONE CASE THAT BREAKS IT
    Cash dividends are fine (reference price drops, index drops, raw returns
    agree). Bonus/rights are NOT: VIC ex-bonus 1:1 halves the price, doubles Q,
    HOSE restates D, index unchanged -- but a raw -50% against a constant Q
    yields r_ex = (0 - 0.30*(-0.50))/0.70 = +21%, entirely fictitious.
    MAX_DAILY_MOVE below is that guard: a move beyond the HOSE daily limit is
    mechanically impossible in a normal session, so it is treated as an
    unadjusted corporate action and the day is skipped rather than believed.
    (ta_ohlcv is raw/unadjusted; ta/adjustments.py re-backfills detected
    actions, and the four family symbols scanned clean when this was written.)

ACCURACY
    price_board only exposes TODAY's share counts, so a backfill necessarily
    prices past weights with current shares — the backfilled tail is an
    ESTIMATE, not a reconstruction, and the dashboard labels it so. The daily
    path then appends ONLY the newest point using that day's live share counts
    and never rewrites history, so weights are exact point-in-time from launch
    onward with no methodology seam: one formula throughout.

    Other residual error: ~390 of 458 HOSE symbols return a usable price+share
    pair on a given day, so M is slightly understated. It appears in numerator
    and denominator of every weight, so the effect on w largely cancels.

DELIBERATELY SELF-CONTAINED / EASY TO REMOVE
    This panel is provisional. Everything it needs lives in this file plus one
    chart component; it writes only its own two NEW metrics, touches no
    existing table, column or migration, makes its own Supabase client, and is
    NOT an FCI input (the FCI design is frozen and its holdout consumed —
    BUNDLE_METRICS in macro/composite.py is an explicit tuple and must stay
    untouched). Its collector is wrapped in try/except, so even a total failure
    here cannot block another metric.

    To switch it OFF without a code change: set env `MACRO_EXVIC=0` for the
    pipeline (stops writing) and `NEXT_PUBLIC_EXVIC=0` for the dashboard (hides
    the panel). To delete it outright: remove this file, the one import block
    and the five `exvic_rows` references in refresh_macro.py, the chart
    component, its block in macro/page.tsx and its i18n keys. Nothing else
    depends on it; stored rows can be left in place or deleted at leisure.
"""

import datetime as dt
import os

from ta.common import safe_execute

# Kill switch — see "DELIBERATELY SELF-CONTAINED" above.
ENABLED = os.getenv("MACRO_EXVIC", "1") != "0"

METRIC_EX = "vnindex_ex_vic"
METRIC_WEIGHT = "vic_family_weight"
METRIC_VNINDEX = "vnindex"

# ta_ohlcv history starts here; VPL only lists 2025-05-13 and correctly carries
# zero weight before that.
EX_HISTORY_START = dt.date(2024, 3, 28)

# Overridable from scoring_config key 'vnindex_ex' -> {"family": [...]}.
DEFAULT_FAMILY = ["VIC", "VHM", "VRE", "VPL"]

# HOSE daily price limit (+ buffer). Beyond this in one session = corporate
# action, not a price move. See "THE ONE CASE THAT BREAKS IT" above.
MAX_DAILY_MOVE = 0.10

# Sanity ceiling on the produced series: a legitimate ex-family index move can
# exceed the single-stock limit (breadth), but not by much.
MAX_EX_MOVE = 0.15


def load_family(client) -> list[str]:
    """Family symbols from scoring_config, falling back to DEFAULT_FAMILY."""
    try:
        res = safe_execute(
            client.table("scoring_config").select("config").eq("key", "vnindex_ex").limit(1),
            label="vnindex_ex config",
        ).data
    except Exception:  # noqa: BLE001 — config is optional, never block on it
        return list(DEFAULT_FAMILY)
    if res:
        fam = (res[0].get("config") or {}).get("family")
        if isinstance(fam, list) and fam:
            return [str(s).upper() for s in fam]
    return list(DEFAULT_FAMILY)


def hose_symbols(client) -> list[str]:
    """Every HOSE symbol in the tracked universe (VN-Index is HOSE-only)."""
    out: list[str] = []
    offset = 0
    while True:
        rows = safe_execute(
            client.table("ta_universe").select("symbol")
            .eq("exchange", "HOSE").order("symbol").range(offset, offset + 999),
            label="ex-vic universe",
        ).data
        out += [r["symbol"] for r in rows]
        if len(rows) < 1000:
            break
        offset += 1000
    return out


def fetch_listed_shares(symbols: list[str]) -> dict[str, float]:
    """{symbol: listed_share} from the bulk price_board `listing` group.

    Same call the daily OHLCV path already makes; chunked like ta/adjustments.
    Symbols that don't come back (halted, no board entry) are simply absent —
    they then drop out of M for that run.
    """
    import time

    from ta.common import REQUEST_DELAY
    from ta.ohlcv import PRICE_BOARD_CHUNK, _make_trading

    trading = _make_trading()
    out: dict[str, float] = {}
    for i in range(0, len(symbols), PRICE_BOARD_CHUNK):
        chunk = symbols[i:i + PRICE_BOARD_CHUNK]
        try:
            df = trading.price_board(chunk)
        except Exception as e:  # noqa: BLE001 — a bad chunk must not kill the run
            print(f"    price_board chunk failed ({chunk[0]}..): {str(e)[:60]}")
            continue
        for _, row in df.iterrows():
            try:
                sym = row[("listing", "symbol")]
                shares = row[("listing", "listed_share")]
            except KeyError:
                continue
            if sym and shares:
                try:
                    val = float(shares)
                except (TypeError, ValueError):
                    continue
                if val > 0:
                    out[str(sym)] = val
        time.sleep(REQUEST_DELAY)
    return out


def _load_closes(client, symbols: list[str], start: dt.date, end: dt.date) -> dict[str, dict[str, float]]:
    """{date: {symbol: close}} over [start, end], chunked by symbol + paged.

    Mirrors ta/rs_rating.py::_load_closes but keys by date, which is the axis
    the index walks.
    """
    by_date: dict[str, dict[str, float]] = {}
    chunk_size = 150
    for i in range(0, len(symbols), chunk_size):
        chunk = symbols[i:i + chunk_size]
        offset = 0
        while True:
            rows = safe_execute(
                client.table("ta_ohlcv").select("symbol,date,close")
                .in_("symbol", chunk)
                .gte("date", start.isoformat()).lte("date", end.isoformat())
                .order("symbol").order("date")
                .range(offset, offset + 999),
                label="ex-vic ohlcv",
            ).data
            for r in rows:
                close = r.get("close")
                if close is None:
                    continue
                by_date.setdefault(r["date"], {})[r["symbol"]] = float(close)
            if len(rows) < 1000:
                break
            offset += 1000
    return by_date


def _load_vnindex(client, start: dt.date, end: dt.date) -> dict[str, float]:
    """{date: VN-Index close} from macro_series."""
    out: dict[str, float] = {}
    offset = 0
    while True:
        rows = safe_execute(
            client.table("macro_series").select("date,value")
            .eq("metric", METRIC_VNINDEX)
            .gte("date", start.isoformat()).lte("date", end.isoformat())
            .order("date").range(offset, offset + 999),
            label="ex-vic vnindex",
        ).data
        for r in rows:
            out[r["date"]] = float(r["value"])
        if len(rows) < 1000:
            break
        offset += 1000
    return out


def latest_stored(client) -> tuple[str, float] | None:
    """(date, level) of the newest stored ex-index point, or None if unseeded."""
    rows = safe_execute(
        client.table("macro_series").select("date,value")
        .eq("metric", METRIC_EX).order("date", desc=True).limit(1),
        label="ex-vic latest",
    ).data
    return (rows[0]["date"], float(rows[0]["value"])) if rows else None


def compute_ex_series(
    client, shares: dict[str, float], family: list[str],
    start: dt.date, end: dt.date,
    anchor: tuple[str, float] | None = None,
) -> tuple[list[tuple[dt.date, float]], list[tuple[dt.date, float]], dict]:
    """(ex-index levels, family weight %, stats) over [start, end].

    Walks the dates on which BOTH a VN-Index close and HOSE bars exist.

    `anchor` is the (date, level) to continue an existing series from — the
    daily path passes the newest stored point so only NEW dates are emitted and
    history is never rewritten (see ACCURACY above). Without it the first usable
    date anchors to VN-Index itself, so the two lines start together on the
    chart (backfill / self-seeding path).
    """
    universe = [s for s in hose_symbols(client) if s in shares]
    closes = _load_closes(client, universe, start, end)
    vni = _load_vnindex(client, start, end)

    dates = sorted(d for d in closes if d in vni)
    if len(dates) < 2:
        return [], [], {"dates": len(dates), "skipped": 0}

    fam = [s for s in family if s in shares]
    levels: list[tuple[dt.date, float]] = []
    weights: list[tuple[dt.date, float]] = []
    skipped: list[str] = []

    if anchor is not None:
        # Continue an existing series: the anchor date must be one of ours, and
        # nothing on or before it is re-emitted.
        anchor_date, level = anchor
        if anchor_date not in dates:
            return [], [], {"dates": len(dates), "skipped": 0,
                            "error": f"anchor {anchor_date} not a usable date"}
        start_i = dates.index(anchor_date)
    else:
        # Fresh series: anchor to VN-Index so both lines start together.
        start_i = 0
        level = vni[dates[0]]
        levels.append((dt.date.fromisoformat(dates[0]), round(level, 2)))

    prev = dates[start_i]
    prev_px = closes[prev]
    w_prev = _weights(prev_px, shares, fam)
    weights.append((dt.date.fromisoformat(prev), round(sum(w_prev.values()) * 100, 4)))

    for today in dates[start_i + 1:]:
        px = closes[today]
        r_vni = vni[today] / vni[prev] - 1.0

        # Family contribution at PREVIOUS-close weights (w(t-1), never w(t) —
        # same-day weights would leak the day's move into its own weight).
        contrib = 0.0
        artifact = False
        for sym, w in w_prev.items():
            p0, p1 = prev_px.get(sym), px.get(sym)
            if p0 is None or p1 is None or p0 <= 0:
                continue  # not trading / not yet listed → no contribution
            r_i = p1 / p0 - 1.0
            if abs(r_i) > MAX_DAILY_MOVE:
                artifact = True  # unadjusted corporate action, not a price move
                break
            contrib += w * r_i

        w_total = sum(w_prev.values())
        if artifact or w_total >= 0.999:
            skipped.append(today)
        else:
            r_ex = (r_vni - contrib) / (1.0 - w_total)
            if abs(r_ex) > MAX_EX_MOVE:
                skipped.append(today)
            else:
                level *= 1.0 + r_ex
                levels.append((dt.date.fromisoformat(today), round(level, 2)))

        prev, prev_px = today, px
        w_prev = _weights(px, shares, fam)
        weights.append((dt.date.fromisoformat(today), round(sum(w_prev.values()) * 100, 4)))

    return levels, weights, {
        "dates": len(dates), "universe": len(universe),
        "skipped": len(skipped), "skipped_dates": skipped[:5],
    }


def _weights(px: dict[str, float], shares: dict[str, float], family: list[str]) -> dict[str, float]:
    """{family symbol: weight of total HOSE cap} on one date."""
    total = 0.0
    for sym, price in px.items():
        q = shares.get(sym)
        if q:
            total += price * q
    if total <= 0:
        return {s: 0.0 for s in family}
    return {
        s: (px[s] * shares[s] / total) if (s in px and s in shares) else 0.0
        for s in family
    }
