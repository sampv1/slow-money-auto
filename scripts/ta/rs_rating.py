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

from .common import safe_execute, today_vn
from .universe import get_active_symbols

# Trailing windows in trading days (≈21 sessions/month).
PERIODS = {"3m": 63, "6m": 126, "9m": 189, "12m": 252}
WEIGHTS = {"3m": 0.4, "6m": 0.2, "9m": 0.2, "12m": 0.2}
MAX_LOOKBACK = max(PERIODS.values())  # 252 — need this many prior bars + 1

# "Min 20-session avg volume for RS" — the configurable liquidity floor for the
# RS ranking universe. 0 = rank across every symbol in the market (no floor).
DEFAULT_RS_LIQUIDITY_FLOOR = 0

# Calendar days of history to pull so we reliably have ≥ MAX_LOOKBACK+1 bars.
_WINDOW_DAYS = 400


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
    """Return {period: pct_return} using the last bar vs the bar `lookback` ago.
    Requires full history for every period (so all four are comparable)."""
    n = len(closes)
    if n < MAX_LOOKBACK + 1:
        return None
    last = closes[-1][1]
    if not last or last <= 0:
        return None
    rets: dict[str, float] = {}
    for key, lb in PERIODS.items():
        past = closes[-1 - lb][1]
        if not past or past <= 0:
            return None
        rets[key] = last / past - 1.0
    return rets


def compute_rs_ratings(client, liquidity_floor: int = DEFAULT_RS_LIQUIDITY_FLOOR,
                       dry_run: bool = False) -> dict:
    """Compute + persist RS ratings for the liquid universe. Returns a stats dict
    with keys: liquid, scored, rs_date."""
    import pandas as pd

    active = get_active_symbols(client)
    liquid = _liquid_symbols(client, active, liquidity_floor)
    stats = {"liquid": len(liquid), "scored": 0, "rs_date": None}
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

    for k in PERIODS:
        df[f"rs_{k}"] = pct(df[k])
    blend = sum(WEIGHTS[k] * df[f"rs_{k}"] for k in PERIODS)
    df["rs_composite"] = pct(blend)

    stats["scored"] = len(df)
    stats["rs_date"] = rs_date

    if dry_run:
        return stats

    # Clear stale RS on all active rows, then write the fresh snapshot. Keeps RS
    # null for symbols that dropped out of the liquid set or lost history.
    safe_execute(
        client.table("ta_universe")
        .update({"rs_3m": None, "rs_6m": None, "rs_9m": None, "rs_12m": None,
                 "rs_composite": None, "rs_date": None})
        .eq("is_active", True),
        label="rs clear",
    )

    payload = [
        {
            "symbol": sym,
            "rs_3m": int(row["rs_3m"]),
            "rs_6m": int(row["rs_6m"]),
            "rs_9m": int(row["rs_9m"]),
            "rs_12m": int(row["rs_12m"]),
            "rs_composite": int(row["rs_composite"]),
            "rs_date": rs_date,
        }
        for sym, row in df.iterrows()
    ]
    for i in range(0, len(payload), 500):
        safe_execute(
            client.table("ta_universe").upsert(payload[i:i + 500], on_conflict="symbol"),
            label="rs upsert",
        )

    return stats
