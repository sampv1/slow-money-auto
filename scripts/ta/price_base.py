"""Price Base detection + BQS V3 scoring (cross-symbol, current base only).

A price base is a sideways consolidation after a prior move. We detect the
stock's CURRENT base (ending at the latest bar), classify it (Bottoming /
Continuation), and score its quality 0-100 per the BQS V3 rubric
(initial_fa_data/price_base_scoring.xlsx, sheet "BQS V3").

Timeframe: daily bars, with weekly-smoothed structure where the rubric is
expressed in weeks. Scoring is config-driven from the tier tables below
(faithful to the "Thang điểm" column; max per type derived from the tiers →
Bottoming 130, Continuation 120; BQS = raw / max * 100).

Computed daily after the RS pass (Module 14 reuses the RS Line). Stored as the
latest snapshot on ta_universe (base_score / base_grade / base_type /
base_status / base_detail / base_date).
"""

from datetime import date as _date_cls, timedelta

from .common import safe_execute, today_vn
from .universe import get_active_symbols

# --- tunable parameters -----------------------------------------------------
WINDOW_DAYS = 500          # calendar days of history to load
MIN_BARS = 70              # need enough history for context + a base
MIN_BASE_BARS = 20         # 4 weeks — shorter is a Pause/Tight Area, not a base
MAX_BASE_BARS = 52 * 5     # cap base length at ~52 weeks
DEPTH_CAP = 0.40           # extend the base window while range stays ≤ 40%
PRIOR_BARS = 130           # ~26 weeks of pre-base context for the prior move
BARS_52W = 250
NEAR_TOP = 0.95            # within 5% of base high = "near top"
BREAKOUT_VOL_MULT = 1.5    # vol ≥ 1.5× MA20 vol = strong breakout

# --- BQS V3 tier tables (ascending threshold → points; pick highest ≤ value) -
LEN1 = [(0, 0), (6, 10), (10, 15), (30, 12), (52, 8)]          # weeks
LEN2 = [(0, 0), (4, 10), (6, 15), (12, 12), (20, 8)]
DEPTH1 = [(0, 8), (10, 15), (20, 20), (30, 10), (40, 0)]        # percent
DEPTH2 = [(0, 12), (5, 20), (15, 15), (25, 8), (35, 0)]
TIGHT = [(0, 25), (5, 20), (8, 15), (12, 8), (15, 0)]          # percent
VOLDRY = [(0, 20), (50, 15), (70, 10), (90, 5), (120, 0)]      # ratio percent
DIST1 = [(0, 10), (20, 7), (40, 4), (60, 2)]                   # percent
DIST2 = [(0, 10), (10, 7), (20, 4), (30, 0)]
GRADES = [(80, "A"), (65, "B"), (50, "C"), (0, "D")]


def _tier(value: float, table) -> int:
    pts = table[0][1]
    for thr, p in table:
        if value >= thr:
            pts = p
        else:
            break
    return pts


def _max_pts(table) -> int:
    return max(p for _, p in table)


def _grade(bqs: float) -> str:
    for thr, g in GRADES:
        if bqs >= thr:
            return g
    return "D"


def _ma(vals: list[float], n: int, idx: int) -> float | None:
    if idx + 1 < n:
        return None
    seg = vals[idx + 1 - n: idx + 1]
    return sum(seg) / n


# --- detection --------------------------------------------------------------

def detect_base(highs, lows, closes, vols, dates) -> dict | None:
    """Find the current base (ending at the last bar). Returns an attributes
    dict or None if no qualifying base."""
    n = len(closes)
    if n < MIN_BARS:
        return None
    last = n - 1

    # Extend the window backward while the high-low range stays ≤ DEPTH_CAP.
    hi, lo, start = highs[last], lows[last], last
    limit = max(0, last - MAX_BASE_BARS)
    for i in range(last - 1, limit - 1, -1):
        nhi, nlo = max(hi, highs[i]), min(lo, lows[i])
        if nhi <= 0 or (nhi - nlo) / nhi > DEPTH_CAP:
            break
        hi, lo, start = nhi, nlo, i

    dur_bars = last - start + 1
    if dur_bars < MIN_BASE_BARS:
        return None  # 4–8 sessions etc. = Pause/Tight Area, not a base

    base_high, base_low = hi, lo
    base_depth = (base_high - base_low) / base_high if base_high else 1.0
    dur_weeks = dur_bars / 5.0
    close = closes[last]

    # Prior-move context (the PRIOR_BARS before the base started).
    pre0 = max(0, start - PRIOR_BARS)
    if start > pre0:
        pre_peak = max(highs[pre0:start])
        pre_run_low = min(lows[pre0:start])
    else:
        pre_peak, pre_run_low = base_high, base_low
    drawdown_pre = (pre_peak - base_low) / pre_peak if pre_peak > 0 else 0.0
    runup_pre = (base_high - pre_run_low) / pre_run_low if pre_run_low > 0 else 0.0

    high_52w = max(highs[max(0, n - BARS_52W):])
    dist_52w = (high_52w - close) / high_52w if high_52w > 0 else 1.0

    # Type classification (Module 1).
    is_bottoming = drawdown_pre >= 0.25 and dur_weeks >= 6
    is_continuation = 0.20 <= runup_pre <= 0.60 and dur_weeks >= 4 and dist_52w <= 0.25
    if is_bottoming and is_continuation:
        base_type = "continuation" if dist_52w <= 0.15 else "bottoming"
    elif is_bottoming:
        base_type = "bottoming"
    elif is_continuation:
        base_type = "continuation"
    else:
        return None  # no clear prior-move context → not a valid base

    # Tightness of the last 20 sessions (Module 6).
    seg = slice(max(0, last - 19), last + 1)
    t_hi, t_lo = max(highs[seg]), min(lows[seg])
    tightness20 = (t_hi - t_lo) / t_lo if t_lo > 0 else 1.0

    # Volume dry-up: MA20 vol / MA50 vol (Module 7).
    ma20v, ma50v = _ma(vols, 20, last), _ma(vols, 50, last)
    vol_dry = (ma20v / ma50v) if (ma20v and ma50v) else None

    # Moving averages for the trend filter (Modules 10/11).
    ma20 = _ma(closes, 20, last)
    ma50 = _ma(closes, 50, last)
    ma200 = _ma(closes, 200, last)
    ma20_prev = _ma(closes, 20, last - 20) if last >= 40 else None
    ma50_prev = _ma(closes, 50, last - 20) if last >= 70 else None
    ma20_slope_up = (ma20 is not None and ma20_prev is not None and ma20 >= ma20_prev)
    ma20_cross_up = (ma20 is not None and ma50 is not None and ma50_prev is not None
                     and ma20_prev is not None and ma20 > ma50 and ma20_prev <= ma50_prev)

    ma20vol = ma20v
    return {
        "base_start": dates[start], "base_end": dates[last],
        "duration_weeks": round(dur_weeks, 1), "duration_bars": dur_bars,
        "base_high": base_high, "base_low": base_low,
        "depth_pct": round(base_depth * 100, 1),
        "drawdown_pre_pct": round(drawdown_pre * 100, 1),
        "runup_pre_pct": round(runup_pre * 100, 1),
        "dist52w_pct": round(dist_52w * 100, 1),
        "tightness20_pct": round(tightness20 * 100, 1),
        "vol_dry_ratio_pct": round(vol_dry * 100, 1) if vol_dry is not None else None,
        "base_type": base_type,
        "close": close,
        # raw helpers for scoring
        "_ma20": ma20, "_ma50": ma50, "_ma200": ma200,
        "_ma20_slope_up": ma20_slope_up, "_ma20_cross_up": ma20_cross_up,
        "_ma20vol": ma20vol, "_last_vol": vols[last],
        "_highs": highs, "_lows": lows, "_closes": closes, "_start": start, "_last": last,
    }


# --- scoring (BQS V3) -------------------------------------------------------

def _spring_points(a) -> int:
    """Module 12 (Bottoming only): a dip 1–8% below the base shelf that closes
    back above it within ≤5 sessions = shakeout/spring."""
    lows, closes, start, last = a["_lows"], a["_closes"], a["_start"], a["_last"]
    base_low, base_high = a["base_low"], a["base_high"]
    win_lows = lows[start:last + 1]
    shelf = sorted(win_lows)[max(1, len(win_lows) // 10)]  # ~10th-percentile low = shelf
    mid = (base_high + base_low) / 2
    for i in range(start, last + 1):
        if 0.01 <= (shelf - lows[i]) / shelf <= 0.08:  # dipped below shelf
            for j in range(i + 1, min(i + 6, last + 1)):
                if closes[j] > shelf:
                    return 10 if closes[j] > mid else 5
    return 0


def _breakout(a):
    """Module 13: returns (points, status)."""
    close, bh, bl = a["close"], a["base_high"], a["base_low"]
    vol, ma20v = a["_last_vol"], a["_ma20vol"]
    if close < bl:
        return 0, "fail"
    if close > bh:
        if ma20v and vol >= BREAKOUT_VOL_MULT * ma20v:
            return 10, "breakout"
        return 5, "breakout"
    if close >= bh * NEAR_TOP:
        return 8, "watchlist"
    return 4, "watchlist"  # in-base, not near top (interpolated; sheet enumerates 4 states)


def _rs_points(a, rs_line: list[float] | None) -> int:
    """Module 14: RS Line trend during the base (reuses the RS module)."""
    if not rs_line or len(rs_line) < 20:
        return 0
    cur, prev = rs_line[-1], rs_line[-20]
    rs_at_high = cur >= max(rs_line) * 0.999
    price_at_high = a["close"] >= a["base_high"] * 0.999
    if rs_at_high and not price_at_high:
        return 10
    if prev > 0:
        chg = cur / prev - 1
        if chg > 0.01:
            return 8
        if chg >= -0.01:
            return 5
    return 0


def _trend_points(a) -> int:
    close, ma20, ma50, ma200 = a["close"], a["_ma20"], a["_ma50"], a["_ma200"]
    if a["base_type"] == "bottoming":
        if a["_ma20_cross_up"]:
            return 10
        if ma50 is not None and close > ma50:
            return 8
        if ma20 is not None and close > ma20:
            return 5
        return 0
    # continuation
    if ma20 and ma50 and ma200 and ma20 > ma50 > ma200:
        return 10
    if ma20 and ma50 and ma20 > ma50 and close > ma50:
        return 8
    if ma50 and close > ma50:
        return 5
    return 0


def score_base(a: dict, rs_line: list[float] | None) -> dict:
    """Score a detected base. Returns score/grade/status + breakdown."""
    t = a["base_type"]
    b = []  # breakdown rows

    def add(key, en, vi, value, pts, mx):
        b.append({"key": key, "label_en": en, "label_vi": vi, "value": value, "points": pts, "max": mx})

    if t == "bottoming":
        add("length", "Base length (weeks)", "Độ dài nền (tuần)", a["duration_weeks"],
            _tier(a["duration_weeks"], LEN1), _max_pts(LEN1))
        add("depth", "Base depth %", "Độ sâu nền %", a["depth_pct"],
            _tier(a["depth_pct"], DEPTH1), _max_pts(DEPTH1))
    else:
        add("length", "Base length (weeks)", "Độ dài nền (tuần)", a["duration_weeks"],
            _tier(a["duration_weeks"], LEN2), _max_pts(LEN2))
        add("depth", "Base depth %", "Độ sâu nền %", a["depth_pct"],
            _tier(a["depth_pct"], DEPTH2), _max_pts(DEPTH2))

    add("tightness", "Tightness (last 20)", "Độ chặt 20 phiên", a["tightness20_pct"],
        _tier(a["tightness20_pct"], TIGHT), _max_pts(TIGHT))

    vdr = a["vol_dry_ratio_pct"]
    add("vol_dry", "Volume dry-up", "Khối lượng khô cạn", vdr,
        _tier(vdr, VOLDRY) if vdr is not None else 0, _max_pts(VOLDRY))

    if t == "bottoming":
        add("dist52w", "Distance to 52W high %", "Vị trí so với đỉnh 52W", a["dist52w_pct"],
            _tier(a["dist52w_pct"], DIST1), _max_pts(DIST1))
    else:
        add("dist52w", "Distance to 52W high %", "Vị trí so với đỉnh 52W", a["dist52w_pct"],
            _tier(a["dist52w_pct"], DIST2), _max_pts(DIST2))

    add("trend", "MA / Trend filter", "Bộ lọc MA/Xu hướng", None, _trend_points(a), 10)

    if t == "bottoming":
        add("spring", "Spring / Shakeout", "Spring/Shakeout", None, _spring_points(a), 10)

    bo_pts, status = _breakout(a)
    add("breakout", "Breakout / SOS", "Breakout/SOS", status, bo_pts, 10)
    add("rs", "RS confirmation", "RS xác nhận", None, _rs_points(a, rs_line), 10)

    raw = sum(r["points"] for r in b)
    mx = sum(r["max"] for r in b)
    bqs = round(raw / mx * 100) if mx else 0
    return {
        "score": bqs, "grade": _grade(bqs), "type": t, "status": status,
        "raw": raw, "max": mx, "breakdown": b,
    }


# --- orchestration / persistence -------------------------------------------

def _load_ohlcv(client, symbols, cutoff_iso):
    out = {s: {"d": [], "h": [], "l": [], "c": [], "v": []} for s in symbols}
    CH = 120
    for i in range(0, len(symbols), CH):
        chunk = symbols[i:i + CH]
        offset = 0
        while True:
            rows = safe_execute(
                client.table("ta_ohlcv").select("symbol,date,high,low,close,volume")
                .in_("symbol", chunk).gte("date", cutoff_iso)
                .order("symbol").order("date").range(offset, offset + 999),
                label="base ohlcv",
            ).data
            for r in rows:
                o = out[r["symbol"]]
                o["d"].append(r["date"]); o["h"].append(float(r["high"]))
                o["l"].append(float(r["low"])); o["c"].append(float(r["close"]))
                o["v"].append(float(r["volume"] or 0))
            if len(rows) < 1000:
                break
            offset += 1000
    return out


def _load_rs_lines(client, symbols):
    out = {}
    CH = 200
    for i in range(0, len(symbols), CH):
        chunk = symbols[i:i + CH]
        rows = safe_execute(
            client.table("ta_universe").select("symbol,rs_line_full").in_("symbol", chunk),
            label="base rs",
        ).data
        for r in rows:
            out[r["symbol"]] = r.get("rs_line_full")
    return out


def compute_price_bases(client, dry_run: bool = False) -> dict:
    """Detect + score the current base for every active symbol. Returns stats."""
    active = get_active_symbols(client)
    stats = {"active": len(active), "based": 0, "by_grade": {}, "as_of": None}
    if not active:
        return stats

    cutoff = (today_vn() - timedelta(days=WINDOW_DAYS)).isoformat()
    ohlcv = _load_ohlcv(client, active, cutoff)
    rs_lines = _load_rs_lines(client, active)

    payload = []
    as_of = None
    for sym in active:
        o = ohlcv.get(sym)
        if not o or len(o["c"]) < MIN_BARS:
            continue
        attrs = detect_base(o["h"], o["l"], o["c"], o["v"], o["d"])
        if not attrs:
            continue
        res = score_base(attrs, rs_lines.get(sym))
        d = o["d"][-1]
        as_of = d if as_of is None or d > as_of else as_of
        detail = {k: v for k, v in attrs.items() if not k.startswith("_")}
        detail["breakdown"] = res["breakdown"]
        detail["raw"] = res["raw"]
        detail["max"] = res["max"]
        payload.append({
            "symbol": sym,
            "base_score": res["score"],
            "base_grade": res["grade"],
            "base_type": res["type"],
            "base_status": res["status"],
            "base_detail": detail,
            "base_date": d,
        })
        stats["by_grade"][res["grade"]] = stats["by_grade"].get(res["grade"], 0) + 1

    stats["based"] = len(payload)
    stats["as_of"] = as_of
    if dry_run:
        return stats

    # Clear stale, then write the fresh snapshot.
    safe_execute(
        client.table("ta_universe").update({
            "base_score": None, "base_grade": None, "base_type": None,
            "base_status": None, "base_detail": None, "base_date": None,
        }).eq("is_active", True),
        label="base clear",
    )
    # Need exchange for the upsert INSERT path (NOT NULL).
    exch = {}
    off = 0
    while True:
        rows = safe_execute(client.table("ta_universe").select("symbol,exchange").range(off, off + 999), label="base exch").data
        for r in rows:
            exch[r["symbol"]] = r.get("exchange") or "HOSE"
        if len(rows) < 1000:
            break
        off += 1000
    for p in payload:
        p["exchange"] = exch.get(p["symbol"], "HOSE")
    for i in range(0, len(payload), 300):
        safe_execute(client.table("ta_universe").upsert(payload[i:i + 300], on_conflict="symbol"), label="base upsert")

    return stats
