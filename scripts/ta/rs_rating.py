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

# RS uses CALENDAR-day trailing windows (3/6/9/12 months) by date, not a fixed
# number of trading bars, which gives the correct period and also rates thinly
# traded stocks. All tunables live in scoring_config 'rs_rating' (RS_DEFAULTS
# below is the fallback; see compute_rs_ratings).


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


# DB-overridable defaults (see scoring_config key 'rs_rating').
# window_days sizes the close-load window: it must cover the longest rating
# lookback (12m ≈ 365d) PLUS however far back we want RS *history* to reach,
# since compute_rs_history percentile-ranks as-of each past date over this same
# loaded window. 780 ≈ 26 months → ~13.5 months of RS52W history (rs_12m needs a
# 365d lookback) and ~18 months of RS3M/RS6M. Requires ta_ohlcv backfilled that
# deep (backfill_ta_ohlcv.py --days 800); shallower OHLCV just yields a shorter
# history, never an error.
RS_DEFAULTS = {
    "periods": {"3m": 91, "6m": 182, "9m": 273, "12m": 365},
    "weights": {"3m": 0.4, "6m": 0.2, "9m": 0.2, "12m": 0.2},
    "tolerance_days": 25,
    "liquidity_floor": 0,
    "window_days": 780,
    "rs_line": {"window_days": 365, "spark_points": 48, "min_points": 20},
}


def _trailing_returns(closes: list[tuple[str, float]], periods: dict, tol_days: int) -> dict[str, float] | None:
    """Return {period: pct_return}, where each period's prior price is the bar
    nearest (by date) to `last_date − N months`. A period is skipped (whole
    symbol returned None) if no bar lies within `tol_days` of its target, so a
    symbol must have ≥ ~12 months of listing to be fully rated."""
    if not closes:
        return None
    parsed = [(_date_cls.fromisoformat(d), c) for d, c in closes if c and c > 0]
    if not parsed:
        return None
    last_date, last = parsed[-1]
    rets: dict[str, float] = {}
    for key, days in periods.items():
        target = last_date.toordinal() - days
        best = None
        best_diff = None
        for d, c in parsed:
            diff = abs(d.toordinal() - target)
            if best_diff is None or diff < best_diff:
                best_diff, best = diff, c
        if best is None or best_diff > tol_days:
            return None
        rets[key] = last / best - 1.0
    return rets


# RS Line = stock close ÷ VN-Index close over the trailing ~1 year. The full
# daily series feeds the detail chart; a downsampled copy (≈ weekly) feeds the
# compact in-cell sparkline. (Params come from RS_DEFAULTS / scoring_config.)


def _build_rs_line(closes: list[tuple[str, float]], vnindex: dict,
                   window_days: int, min_points: int) -> tuple[list[float], list[str]] | None:
    """Build the FULL daily RS-Line for one symbol: stock close ÷ VN-Index close
    over the trailing ~1 year. Returns (ratios, dates) parallel arrays for every
    trading day in the window (oldest→newest), or None if too few points."""
    if not closes:
        return None
    last_ord = _date_cls.fromisoformat(closes[-1][0]).toordinal()
    start_ord = last_ord - window_days
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
    if len(ratios) < min_points:
        return None
    return ratios, dates


def _downsample(values: list[float], target: int) -> list[float]:
    """Evenly sample `values` down to at most `target` points (for the sparkline)."""
    if len(values) <= target:
        return values
    step = len(values) / target
    return [values[min(int(i * step), len(values) - 1)] for i in range(target)]


# ── RS Line Score (0-100) ────────────────────────────────────────────────────
# Quality score for a symbol's RS Line, per data/rs_line_scoring.txt:
# Trend (40) + vs MA20 (20) + 52-week high (20) + price/RS divergence (20).
# All tunables live in scoring_config 'rs_line_score' (deep-merged over the
# defaults below).
RS_LINE_SCORE_DEFAULTS = {
    "trend": {
        "window": 20,
        "strong_up": 0.10, "mild_up": 0.03, "mild_down": -0.03, "strong_down": -0.10,
        "points": {"strong_up": 40, "mild_up": 30, "side": 20, "mild_down": 10, "strong_down": 0},
    },
    "ma20": {
        "window": 20, "above_far": 0.05, "near": 0.01, "below_far": 0.05,
        "points": {"above_far": 20, "above": 15, "near": 10, "below": 5, "below_far": 0},
    },
    "high52w": {
        "tiers": [[0.05, 15], [0.10, 10], [0.20, 5]],
        "new_high_eps": 0.001, "new_high_points": 20, "below_points": 0,
    },
    "divergence": {
        "window": 20, "deadband": 0.03,
        "matrix": {
            "flat_up": 20, "up_up": 15, "up_flat": 10, "flat_down": 5, "down_down": 0,
            "down_up": 20, "up_down": 0, "down_flat": 10, "flat_flat": 10,
        },
    },
    "grades": [[90, "A+"], [80, "A"], [70, "B"], [60, "C"], [0, "D"]],
}


def _net_change(series: list[float], window: int) -> float | None:
    """Net % change over the last `window` points (first→last of the tail)."""
    if not series or len(series) < 2:
        return None
    tail = series[-window:] if len(series) >= window else series
    if tail[0] == 0:
        return None
    return tail[-1] / tail[0] - 1.0


def _trend3(chg: float | None, deadband: float) -> str:
    """3-way trend (up / flat / down) with a symmetric deadband."""
    if chg is None:
        return "flat"
    if chg > deadband:
        return "up"
    if chg < -deadband:
        return "down"
    return "flat"


def _rs_score_trend(rs: list[float], cfg: dict) -> int:
    c = cfg["trend"]
    p = c["points"]
    chg = _net_change(rs, c["window"])
    if chg is None:
        return p["side"]
    if chg >= c["strong_up"]:
        return p["strong_up"]
    if chg >= c["mild_up"]:
        return p["mild_up"]
    if chg > c["mild_down"]:
        return p["side"]
    if chg > c["strong_down"]:
        return p["mild_down"]
    return p["strong_down"]


def _rs_score_ma20(rs: list[float], cfg: dict) -> int:
    c = cfg["ma20"]
    p = c["points"]
    w = c["window"]
    if len(rs) < w:
        return p["near"]
    ma = sum(rs[-w:]) / w
    if ma == 0:
        return p["near"]
    d = rs[-1] / ma - 1.0
    if d > c["above_far"]:
        return p["above_far"]
    if d > c["near"]:
        return p["above"]
    if d >= -c["near"]:
        return p["near"]
    if d >= -c["below_far"]:
        return p["below"]
    return p["below_far"]


def _rs_score_high52w(rs: list[float], cfg: dict) -> int:
    c = cfg["high52w"]
    if not rs:
        return c["below_points"]
    mx = max(rs)
    cur = rs[-1]
    if mx <= 0:
        return c["below_points"]
    if cur >= mx * (1 - c["new_high_eps"]):
        return c["new_high_points"]
    dist = (mx - cur) / mx
    for thr, pts in c["tiers"]:  # ascending thresholds
        if dist <= thr:
            return pts
    return c["below_points"]


def _rs_score_divergence(rs: list[float], price: list[float], cfg: dict) -> int:
    c = cfg["divergence"]
    db = c["deadband"]
    w = c["window"]
    price_t = _trend3(_net_change(price, w), db)
    rs_t = _trend3(_net_change(rs, w), db)
    return c["matrix"].get(f"{price_t}_{rs_t}", 10)


def _rs_grade(score: int, grades: list) -> str:
    for thr, g in grades:  # descending thresholds
        if score >= thr:
            return g
    return grades[-1][1]


def score_rs_line(rs_line: list[float], price: list[float], cfg: dict) -> tuple[int, str] | tuple[None, None]:
    """RS Line Score (0-100) + grade from the RS-Line series and the symbol's
    own price series (both oldest→newest). Returns (None, None) if too short."""
    if not rs_line or len(rs_line) < 2:
        return None, None
    total = (
        _rs_score_trend(rs_line, cfg)
        + _rs_score_ma20(rs_line, cfg)
        + _rs_score_high52w(rs_line, cfg)
        + _rs_score_divergence(rs_line, price or [], cfg)
    )
    total = int(round(total))
    return total, _rs_grade(total, cfg["grades"])


# History periods charted on the Analysis page (RS3M / RS6M / RS52W). RS52W is
# rs_12m (12 months ≈ 52 weeks). 9m is intentionally excluded — not charted.
RS_HIST_PERIODS = ("3m", "6m", "12m")
RS_HIST_MAX_POINTS = 400  # cap the stored series length (~18 months of trading days)


def _nearest_close(ords: list[int], vals: list[float], target: int, tol: int) -> float | None:
    """Close of the bar nearest `target` (an ordinal), or None if the nearest is
    more than `tol` days away. Mirrors _trailing_returns' selection rule, but via
    bisect so the history sweep over many dates stays cheap."""
    import bisect
    i = bisect.bisect_left(ords, target)
    best = None
    best_diff = None
    for j in (i - 1, i):
        if 0 <= j < len(ords):
            diff = abs(ords[j] - target)
            if best_diff is None or diff < best_diff:
                best_diff, best = diff, vals[j]
    return best if (best is not None and best_diff is not None and best_diff <= tol) else None


def compute_rs_history(closes_by_sym: dict, periods: dict, tol: int,
                       max_points: int = RS_HIST_MAX_POINTS) -> tuple[list[str], dict]:
    """RS-rating *history* over the loaded close window.

    For each trading date D (last `max_points` in the window) and each period,
    compute every symbol's trailing return AS-OF D (same nearest-bar-within-tol
    rule as the daily snapshot), percentile-rank across the symbols that have a
    return that day → 1..99, and assemble parallel per-symbol arrays.

    Returns (dates, hist) where `dates` is the ONE shared trading-date grid
    (identical for every symbol — it's a market-wide sweep, not per-symbol) and
    hist = {symbol: {"3m": [...], "6m": [...], "12m": [...]}}, each array
    parallel to `dates`, with None where that period's lookback isn't available
    yet. Storing `dates` once (not duplicated per symbol) matters: duplicating
    a ~300-element date array across ~1,500 symbol rows is what blew the
    Supabase statement timeout on the first version of this write (see
    migration 041) — the caller must persist `dates` separately (ta_rs_hist_meta)
    and each symbol's three arrays on ta_universe.

    Reuses the closes already loaded by compute_rs_ratings, so it costs compute
    only — no extra DB reads.
    """
    import pandas as pd

    sym_ords: dict[str, list[int]] = {}
    sym_vals: dict[str, list[float]] = {}
    all_ords: set[int] = set()
    for sym, series in closes_by_sym.items():
        parsed = sorted(
            (_date_cls.fromisoformat(d).toordinal(), c) for d, c in series if c and c > 0
        )
        if len(parsed) < 2:
            continue
        sym_ords[sym] = [o for o, _ in parsed]
        sym_vals[sym] = [v for _, v in parsed]
        all_ords.update(sym_ords[sym])
    if not all_ords:
        return [], {}

    target_ords = sorted(all_ords)[-max_points:]
    hist_periods = {k: periods[k] for k in RS_HIST_PERIODS if k in periods}

    # returns[period][ordinal] = {symbol: pct_return}
    returns: dict[str, dict[int, dict[str, float]]] = {k: {} for k in hist_periods}
    for key, days in hist_periods.items():
        for d_ord in target_ords:
            d_ret: dict[str, float] = {}
            for sym in sym_ords:
                ords, vals = sym_ords[sym], sym_vals[sym]
                last = _nearest_close(ords, vals, d_ord, tol)
                if last is None:
                    continue
                prior = _nearest_close(ords, vals, d_ord - days, tol)
                if prior is None or prior <= 0:
                    continue
                d_ret[sym] = last / prior - 1.0
            returns[key][d_ord] = d_ret

    dates = [_date_cls.fromordinal(o).isoformat() for o in target_ords]
    hist: dict[str, dict] = {sym: {k: [] for k in RS_HIST_PERIODS} for sym in sym_ords}
    for d_ord in target_ords:
        ranked: dict[str, dict[str, int]] = {}
        for key in hist_periods:
            d_ret = returns[key].get(d_ord, {})
            if d_ret:
                s = pd.Series(d_ret)
                pct = (s.rank(method="average", pct=True) * 99).round().clip(1, 99).astype(int)
                ranked[key] = pct.to_dict()
            else:
                ranked[key] = {}
        for sym in sym_ords:
            for key in RS_HIST_PERIODS:
                v = ranked.get(key, {}).get(sym)
                hist[sym][key].append(int(v) if v is not None else None)
    return dates, hist


def compute_rs_ratings(client, liquidity_floor: int | None = None,
                       dry_run: bool = False) -> dict:
    """Compute + persist RS ratings for the liquid universe. Returns a stats dict
    with keys: liquid, scored, rs_date. Tiers/weights/periods come from the
    scoring_config 'rs_rating' row (deep-merged over RS_DEFAULTS)."""
    import pandas as pd
    from .common import load_scoring_config

    cfg = load_scoring_config(client, "rs_rating", RS_DEFAULTS)
    periods = cfg["periods"]
    weights = cfg["weights"]
    tol = cfg["tolerance_days"]
    floor = liquidity_floor if liquidity_floor is not None else cfg["liquidity_floor"]
    rl = cfg["rs_line"]

    active = get_active_symbols(client)
    liquid = _liquid_symbols(client, active, floor)
    stats = {"liquid": len(liquid), "scored": 0, "rs_date": None, "rs_lines": 0, "rs_scored": 0}
    if not liquid:
        return stats

    cutoff = (today_vn() - timedelta(days=cfg["window_days"])).isoformat()
    closes_by_sym = _load_closes(client, liquid, cutoff)

    rets: dict[str, dict[str, float]] = {}
    rs_date = None
    for sym in liquid:
        series = closes_by_sym.get(sym) or []
        r = _trailing_returns(series, periods, tol)
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

    for k in periods:
        df[f"rs_{k}"] = pct(df[k])
    blend = sum(weights[k] * df[f"rs_{k}"] for k in periods)
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
            line = _build_rs_line(closes_by_sym.get(sym) or [], vnindex, rl["window_days"], rl["min_points"])
            if line:
                rs_lines[sym] = line
    stats["rs_lines"] = len(rs_lines)

    # RS Line Score (0-100) + grade for every symbol that has an RS Line.
    score_cfg = load_scoring_config(client, "rs_line_score", RS_LINE_SCORE_DEFAULTS)
    rs_scores: dict[str, tuple[int, str]] = {}
    for sym, (line_vals, _dates) in rs_lines.items():
        price = [c for _d, c in (closes_by_sym.get(sym) or [])]
        s, g = score_rs_line(line_vals, price, score_cfg)
        if s is not None:
            rs_scores[sym] = (s, g)
    stats["rs_scored"] = len(rs_scores)

    # RS-rating history (RS3M/RS6M/RS52W lines on the Analysis chart). Reuses the
    # loaded closes; failure-tolerant so it never blocks the main RS snapshot.
    rs_hist_dates: list[str] = []
    rs_hist: dict = {}
    try:
        rs_hist_dates, rs_hist = compute_rs_history(closes_by_sym, periods, tol)
    except Exception as e:  # noqa: BLE001
        print(f"  RS history skipped ({str(e)[:100]})")
    stats["rs_hist"] = sum(1 for s in rs_hist if s in set(df.index))

    if dry_run:
        return stats

    # Clear stale RS on all active rows, then write the fresh snapshot. Keeps RS
    # null for symbols that dropped out of the liquid set or lost history.
    safe_execute(
        client.table("ta_universe")
        .update({"rs_3m": None, "rs_6m": None, "rs_9m": None, "rs_12m": None,
                 "rs_composite": None, "rs_date": None,
                 "rs_line": None, "rs_line_full": None, "rs_line_date": None,
                 "rs_line_dates": None, "rs_line_score": None, "rs_line_grade": None})
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
            "rs_line": _downsample(rs_lines[sym][0], rl["spark_points"]) if sym in rs_lines else None,
            "rs_line_full": rs_lines[sym][0] if sym in rs_lines else None,
            "rs_line_dates": rs_lines[sym][1] if sym in rs_lines else None,
            "rs_line_date": rs_date if sym in rs_lines else None,
            "rs_line_score": rs_scores[sym][0] if sym in rs_scores else None,
            "rs_line_grade": rs_scores[sym][1] if sym in rs_scores else None,
        }
        for sym, row in df.iterrows()
    ]
    for i in range(0, len(payload), 500):
        safe_execute(
            client.table("ta_universe").upsert(payload[i:i + 500], on_conflict="symbol"),
            label="rs upsert",
        )

    # RS-rating history arrays (Analysis-page RS3M/6M/52W lines) — written in a
    # SEPARATE, guarded pass so a missing migration 040/041 can never break the
    # main RS snapshot above. The date grid is identical for every symbol (one
    # market-wide sweep — see compute_rs_history), so it is written ONCE to the
    # ta_rs_hist_meta singleton row rather than duplicated onto ~1,500 ta_universe
    # rows; that duplication is what blew the Supabase statement timeout on the
    # first version of this write (migration 041 fixes the schema). No pre-clear
    # here (unlike the main snapshot above): a symbol that drops out of the rated
    # set simply keeps its last history until it's rated again — acceptable
    # staleness for a secondary chart, and it avoids a second full-table UPDATE
    # on top of the one the main snapshot just did.
    if rs_hist:
        try:
            import datetime as _dt
            safe_execute(
                client.table("ta_rs_hist_meta").upsert(
                    {"id": 1, "dates": rs_hist_dates,
                     "updated_at": _dt.datetime.now(_dt.timezone.utc).isoformat()}
                ),
                label="rs_hist_meta upsert",
            )
            hist_payload = [
                {
                    "symbol": sym, "exchange": exch.get(sym, "HOSE"),
                    "rs_3m_hist": rs_hist[sym]["3m"], "rs_6m_hist": rs_hist[sym]["6m"],
                    "rs_12m_hist": rs_hist[sym]["12m"],
                }
                for sym in df.index if sym in rs_hist
            ]
            # Smaller batch than the main RS upsert above (500): each row here
            # still carries 3 arrays of ~300 ints (~4-5 KB/row even with the
            # shared dates removed), and the original all-in-one write already
            # hit a Supabase statement timeout once (see migration 041) — 150
            # keeps each statement comfortably under a few hundred KB.
            HIST_BATCH = 150
            for i in range(0, len(hist_payload), HIST_BATCH):
                safe_execute(
                    client.table("ta_universe").upsert(hist_payload[i:i + HIST_BATCH],
                                                       on_conflict="symbol"),
                    label="rs history upsert",
                )
            print(f"  RS history: wrote {len(hist_payload)} symbols ({len(rs_hist_dates)} dates).")
        except Exception as e:  # noqa: BLE001 — most likely migration 040/041 not applied
            print(f"  RS history NOT written — apply migrations 040+041? ({str(e)[:120]})")

    return stats
