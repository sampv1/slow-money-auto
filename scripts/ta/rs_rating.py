"""RS Rating (Relative Strength) — cross-sectional price-performance percentiles.

For each stock we compute the trailing return over 3/6/9/12 months, then
percentile-rank each return across the *liquid* universe into 1..99 (rs_3m …
rs_12m). The composite is the weighted blend

    blend = 0.4*rs_3m + 0.2*rs_6m + 0.2*rs_9m + 0.2*rs_12m

re-ranked into a fresh 1..99 percentile (rs_composite).

Unlike the per-symbol TA indicators, RS is cross-sectional: a symbol's rating
depends on every other symbol's return, so it is computed in one market-wide
pass and stored as the latest snapshot on ta_universe (like avg_volume_20d).

Ranking universe = active symbols whose 20-session avg volume ≥ the RS
liquidity floor — a SEPARATE, configurable parameter ("Min 20-session avg
volume for RS"), distinct from the scanner's display volume filter. Default 0,
i.e. rank across ALL symbols in the market that have enough history. A symbol
needs full ~12-month history to be rated; those without it are left null.
"""

from datetime import timedelta

from datetime import date as _date_cls

from .common import safe_execute, today_vn
from .universe import get_active_symbols

# Trailing windows as CALENDAR days (3/6/9/12 months). RS is "trailing N
# months" by date, so we anchor the lookback to the calendar — not to a fixed
# number of trading bars — which gives the correct period and also rates thinly
# traded stocks (a bar count would exclude any stock that trades with gaps).
PERIOD_DAYS = {"3m": 91, "6m": 182, "9m": 273, "12m": 365}
WEIGHTS = {"3m": 0.4, "6m": 0.2, "9m": 0.2, "12m": 0.2}
# A stock is rated for a period if it has a bar within this many calendar days
# of the target date (handles holidays/weekends and sparse trading).
_TOLERANCE_DAYS = 25

# "Min 20-session avg volume for RS" — the configurable liquidity floor for the
# RS ranking universe. 0 = rank across every symbol in the market (no floor).
DEFAULT_RS_LIQUIDITY_FLOOR = 0

# Calendar days of history to pull: ≥ 12-month window + tolerance + buffer.
_WINDOW_DAYS = 430


def _liquid_symbols(client, active: list[str], floor: int) -> list[str]:
    """Active symbols whose avg_volume_20d ≥ floor (paged read of ta_universe)."""
    vol: dict[str, int | None] = {}
    offset, page = 0, 1000
    while True:
        rows = safe_execute(
            client.table("ta_universe").select("symbol,avg_volume_20d").range(offset, offset + page - 1),
            label="rs avg_vol",
        ).data
        for r in rows:
            vol[r["symbol"]] = r.get("avg_volume_20d")
        if len(rows) < page:
            break
        offset += page
    active_set = set(active)
    return [s for s in active if s in active_set and (vol.get(s) or 0) >= floor]


def _exchange_map(client) -> dict[str, str]:
    """symbol → exchange for all ta_universe rows. Needed because the RS upsert
    is INSERT…ON CONFLICT, whose INSERT path requires the NOT NULL `exchange`
    column even though every symbol already exists (always hits DO UPDATE)."""
    out: dict[str, str] = {}
    offset, page = 0, 1000
    while True:
        rows = safe_execute(
            client.table("ta_universe").select("symbol,exchange").range(offset, offset + page - 1),
            label="rs exchange",
        ).data
        for r in rows:
            out[r["symbol"]] = r.get("exchange") or "HOSE"
        if len(rows) < page:
            break
        offset += page
    return out


def _load_closes(client, symbols: list[str], cutoff_iso: str) -> dict[str, list[tuple[str, float]]]:
    """Per-symbol ascending [(date, close)] within [cutoff, today], chunked by
    symbol and paged within each chunk."""
    out: dict[str, list[tuple[str, float]]] = {s: [] for s in symbols}
    CH = 150
    for i in range(0, len(symbols), CH):
        chunk = symbols[i:i + CH]
        offset = 0
        while True:
            rows = safe_execute(
                client.table("ta_ohlcv")
                .select("symbol,date,close")
                .in_("symbol", chunk)
                .gte("date", cutoff_iso)
                .order("symbol")
                .order("date")
                .range(offset, offset + 999),
                label="rs ohlcv",
            ).data
            for r in rows:
                c = r.get("close")
                if c is not None:
                    out[r["symbol"]].append((r["date"], float(c)))
            if len(rows) < 1000:
                break
            offset += 1000
    return out


def _trailing_returns(closes: list[tuple[str, float]]) -> dict[str, float] | None:
    """Return {period: pct_return}, where each period's prior price is the bar
    nearest (by date) to `last_date − N months`. A period is skipped (whole
    symbol returned None) if no bar lies within _TOLERANCE_DAYS of its target,
    so a symbol must have ≥ ~12 months of listing to be fully rated."""
    if not closes:
        return None
    parsed = [(_date_cls.fromisoformat(d), c) for d, c in closes if c and c > 0]
    if not parsed:
        return None
    last_date, last = parsed[-1]
    rets: dict[str, float] = {}
    for key, days in PERIOD_DAYS.items():
        target = last_date.toordinal() - days
        best = None
        best_diff = None
        for d, c in parsed:
            diff = abs(d.toordinal() - target)
            if best_diff is None or diff < best_diff:
                best_diff, best = diff, c
        if best is None or best_diff > _TOLERANCE_DAYS:
            return None
        rets[key] = last / best - 1.0
    return rets


# RS Line = stock close ÷ VN-Index close over the trailing ~1 year. The full
# daily series feeds the detail chart; a downsampled copy (≈ weekly) feeds the
# compact in-cell sparkline.
RS_LINE_WINDOW_DAYS = 365
RS_LINE_SPARK_POINTS = 48  # downsample target for the in-cell sparkline
_RS_LINE_MIN_POINTS = 20   # need a reasonable span to draw a meaningful line


def _build_rs_line(closes: list[tuple[str, float]], vnindex: dict) -> tuple[list[float], list[str]] | None:
    """Build the FULL daily RS-Line for one symbol: stock close ÷ VN-Index close
    over the trailing ~1 year. Returns (ratios, dates) parallel arrays for every
    trading day in the window (oldest→newest), or None if too few points."""
    if not closes:
        return None
    last_ord = _date_cls.fromisoformat(closes[-1][0]).toordinal()
    start_ord = last_ord - RS_LINE_WINDOW_DAYS
    ratios: list[float] = []
    dates: list[str] = []
    for d_str, c in closes:
        d = _date_cls.fromisoformat(d_str)
        if d.toordinal() < start_ord:
            continue
        v = vnindex.get(d)
        if v and v > 0 and c and c > 0:
            ratios.append(round(c / v, 6))
            dates.append(d_str)
    if len(ratios) < _RS_LINE_MIN_POINTS:
        return None
    return ratios, dates


def _downsample(values: list[float], target: int) -> list[float]:
    """Evenly sample `values` down to at most `target` points (for the sparkline)."""
    if len(values) <= target:
        return values
    step = len(values) / target
    return [values[min(int(i * step), len(values) - 1)] for i in range(target)]


def compute_rs_ratings(client, liquidity_floor: int = DEFAULT_RS_LIQUIDITY_FLOOR,
                       dry_run: bool = False) -> dict:
    """Compute + persist RS ratings for the liquid universe. Returns a stats dict
    with keys: liquid, scored, rs_date."""
    import pandas as pd

    active = get_active_symbols(client)
    liquid = _liquid_symbols(client, active, liquidity_floor)
    stats = {"liquid": len(liquid), "scored": 0, "rs_date": None, "rs_lines": 0}
    if not liquid:
        return stats

    cutoff = (today_vn() - timedelta(days=_WINDOW_DAYS)).isoformat()
    closes_by_sym = _load_closes(client, liquid, cutoff)

    rets: dict[str, dict[str, float]] = {}
    rs_date = None
    for sym in liquid:
        series = closes_by_sym.get(sym) or []
        r = _trailing_returns(series)
        if r is None:
            continue
        rets[sym] = r
        d = series[-1][0]
        if rs_date is None or d > rs_date:
            rs_date = d

    if not rets:
        return stats

    df = pd.DataFrame.from_dict(rets, orient="index")  # cols: 3m,6m,9m,12m

    def pct(s: "pd.Series") -> "pd.Series":
        # Percentile rank → 1..99 (lowest→~1, highest→99). Average ties.
        return (s.rank(method="average", pct=True) * 99).round().clip(1, 99).astype(int)

    for k in PERIOD_DAYS:
        df[f"rs_{k}"] = pct(df[k])
    blend = sum(WEIGHTS[k] * df[f"rs_{k}"] for k in PERIOD_DAYS)
    df["rs_composite"] = pct(blend)

    stats["scored"] = len(df)
    stats["rs_date"] = rs_date

    # RS Line (stock ÷ VN-Index) sparkline series for each rated symbol.
    from .benchmark import fetch_vnindex_closes
    vn_series = fetch_vnindex_closes()
    vnindex = {d: float(v) for d, v in vn_series.items()} if vn_series is not None else {}
    rs_lines: dict[str, tuple[list[float], list[str]]] = {}
    if vnindex:
        for sym in df.index:
            line = _build_rs_line(closes_by_sym.get(sym) or [], vnindex)
            if line:
                rs_lines[sym] = line
    stats["rs_lines"] = len(rs_lines)

    if dry_run:
        return stats

    # Clear stale RS on all active rows, then write the fresh snapshot. Keeps RS
    # null for symbols that dropped out of the liquid set or lost history.
    safe_execute(
        client.table("ta_universe")
        .update({"rs_3m": None, "rs_6m": None, "rs_9m": None, "rs_12m": None,
                 "rs_composite": None, "rs_date": None,
                 "rs_line": None, "rs_line_full": None, "rs_line_date": None,
                 "rs_line_dates": None})
        .eq("is_active", True),
        label="rs clear",
    )

    exch = _exchange_map(client)
    payload = [
        {
            "symbol": sym,
            "exchange": exch.get(sym, "HOSE"),
            "rs_3m": int(row["rs_3m"]),
            "rs_6m": int(row["rs_6m"]),
            "rs_9m": int(row["rs_9m"]),
            "rs_12m": int(row["rs_12m"]),
            "rs_composite": int(row["rs_composite"]),
            "rs_date": rs_date,
            "rs_line": _downsample(rs_lines[sym][0], RS_LINE_SPARK_POINTS) if sym in rs_lines else None,
            "rs_line_full": rs_lines[sym][0] if sym in rs_lines else None,
            "rs_line_dates": rs_lines[sym][1] if sym in rs_lines else None,
            "rs_line_date": rs_date if sym in rs_lines else None,
        }
        for sym, row in df.iterrows()
    ]
    for i in range(0, len(payload), 500):
        safe_execute(
            client.table("ta_universe").upsert(payload[i:i + 500], on_conflict="symbol"),
            label="rs upsert",
        )

    return stats
