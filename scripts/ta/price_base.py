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

from datetime import timedelta

from .common import safe_execute, today_vn
from .universe import get_active_symbols

# --- DB-overridable defaults (see scoring_config key 'price_base') ----------
# Tiers are [threshold, points] (ascending; pick highest threshold ≤ value).
# max-per-type is derived from the tiers → Bottoming 130, Continuation 120.
BASE_DEFAULTS = {
    "detection": {
        "window_days": 500, "min_bars": 70, "min_base_bars": 20, "max_base_bars": 260,
        "window_step": 2, "depth_sanity_cap": 0.50, "prior_bars": 130, "bars_52w": 250,
        "near_top": 0.95, "breakout_vol_mult": 1.5,
    },
    "classification": {
        "bottoming_drawdown_min": 0.25, "bottoming_min_weeks": 6,
        "continuation_runup_min": 0.20, "continuation_runup_max": 0.60,
        # Run-up reference window (bars before the base) for continuation. Kept
        # SHORTER than prior_bars so a recent base isn't disqualified by a rally
        # that began months earlier (the deep accumulation low). Bottoming's
        # drawdown still uses the full prior_bars window.
        "continuation_runup_lookback": 45,
        "continuation_min_weeks": 4, "continuation_max_dist52w": 0.25,
        "both_pick_continuation_dist52w": 0.15,
    },
    "tiers": {
        "len1": [[0, 0], [6, 10], [10, 15], [30, 12], [52, 8]],
        "len2": [[0, 0], [4, 10], [6, 15], [12, 12], [20, 8]],
        "depth1": [[0, 8], [10, 15], [20, 20], [30, 10], [40, 0]],
        "depth2": [[0, 12], [5, 20], [15, 15], [25, 8], [35, 0]],
        "tight": [[0, 25], [5, 20], [8, 15], [12, 8], [15, 0]],
        "voldry": [[0, 20], [50, 15], [70, 10], [90, 5], [120, 0]],
        "dist1": [[0, 10], [20, 7], [40, 4], [60, 2]],
        "dist2": [[0, 10], [10, 7], [20, 4], [30, 0]],
    },
    "categorical": {
        "trend_bottoming": {"cross_up": 10, "above_ma50": 8, "above_ma20": 5, "below": 0},
        "trend_continuation": {"stacked": 10, "ma20_gt_ma50": 8, "above_ma50": 5, "below": 0},
        "spring": {"strong": 10, "weak": 5, "none": 0},
        "breakout": {"strong": 10, "weak": 5, "near_top": 8, "mid": 4, "fail": 0},
        "rs": {"new_high": 10, "rising": 8, "flat": 5, "falling": 0},
    },
    "grades": [[80, "A"], [65, "B"], [50, "C"], [0, "D"]],
}

# Bar count for the 52-week high; safe to keep as a constant (not user-facing).
BARS_52W = 250


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


def _grade(bqs: float, grades) -> str:
    for thr, g in grades:
        if bqs >= thr:
            return g
    return "D"


def _aggregate_ohlc(o, h, l, c, target: int):
    """Aggregate OHLC bars into `target` contiguous candles (open=first,
    close=last, high=max, low=min per bucket). Returns parallel o/h/l/c lists."""
    n = len(c)
    if n <= target:
        return list(o), list(h), list(l), list(c)
    oo, hh, ll, cc = [], [], [], []
    for k in range(target):
        a = k * n // target
        b = max(a + 1, (k + 1) * n // target)
        oo.append(o[a]); hh.append(max(h[a:b])); ll.append(min(l[a:b])); cc.append(c[b - 1])
    return oo, hh, ll, cc


def _build_base_chart(opens, highs, lows, closes, start, last, base_low, base_high) -> dict | None:
    """Compact OHLC candle series + base-rectangle bounds for the in-cell chart.
    The window is the base plus ~half its length of prior context; `s` is the
    fraction of the window at which the base begins (it ends at the last bar)."""
    pad = max(20, (last - start) // 2)
    w0 = max(0, start - pad)
    sl = slice(w0, last + 1)
    o, h, l, c = opens[sl], highs[sl], lows[sl], closes[sl]
    if len(c) < 2:
        return None
    o, h, l, c = _aggregate_ohlc(o, h, l, c, 30)
    s_frac = (start - w0) / (last - w0) if last > w0 else 0.0
    return {
        "o": [round(x) for x in o], "h": [round(x) for x in h],
        "l": [round(x) for x in l], "c": [round(x) for x in c],
        "lo": round(base_low), "hi": round(base_high), "s": round(s_frac, 3),
    }


def _ma(vals: list[float], n: int, idx: int) -> float | None:
    if idx + 1 < n:
        return None
    seg = vals[idx + 1 - n: idx + 1]
    return sum(seg) / n


# --- detection --------------------------------------------------------------

def _current_metrics(highs, lows, closes, vols, n) -> dict:
    """Metrics evaluated at the latest bar — independent of the base window, so
    computed once per symbol and shared across all candidate windows."""
    last = n - 1
    seg = slice(max(0, last - 19), last + 1)
    t_hi, t_lo = max(highs[seg]), min(lows[seg])
    tightness20 = (t_hi - t_lo) / t_lo if t_lo > 0 else 1.0

    ma20v, ma50v = _ma(vols, 20, last), _ma(vols, 50, last)
    vol_dry = (ma20v / ma50v) if (ma20v and ma50v) else None

    ma20 = _ma(closes, 20, last)
    ma50 = _ma(closes, 50, last)
    ma200 = _ma(closes, 200, last)
    ma20_prev = _ma(closes, 20, last - 20) if last >= 40 else None
    ma50_prev = _ma(closes, 50, last - 20) if last >= 70 else None

    high_52w = max(highs[max(0, n - BARS_52W):])
    close = closes[last]
    dist_52w = (high_52w - close) / high_52w if high_52w > 0 else 1.0
    return {
        "close": close, "tightness20": tightness20, "vol_dry": vol_dry,
        "ma20": ma20, "ma50": ma50, "ma200": ma200,
        "ma20_slope_up": (ma20 is not None and ma20_prev is not None and ma20 >= ma20_prev),
        "ma20_cross_up": (ma20 is not None and ma50 is not None and ma50_prev is not None
                          and ma20_prev is not None and ma20 > ma50 and ma20_prev <= ma50_prev),
        "ma20vol": ma20v, "last_vol": vols[last], "dist_52w": dist_52w,
    }


def _build_attrs(highs, lows, closes, dates, start, last, base_high, base_low, m, cfg) -> dict | None:
    """Build the attributes for one candidate window [start, last], or None if it
    doesn't classify as a base."""
    det, cl = cfg["detection"], cfg["classification"]
    if base_high <= 0:
        return None
    base_depth = (base_high - base_low) / base_high
    if base_depth > det["depth_sanity_cap"]:
        return None  # too wide to be a base
    dur_bars = last - start + 1
    dur_weeks = dur_bars / 5.0

    pre0 = max(0, start - det["prior_bars"])
    if start <= pre0:
        return None  # need prior-move context
    pre_peak = max(highs[pre0:start])
    drawdown_pre = (pre_peak - base_low) / pre_peak if pre_peak > 0 else 0.0
    # Run-up from a SHORTER window (the advance leading into the base), so a
    # months-old accumulation low doesn't inflate it. Falls back to prior_bars
    # if the knob is absent.
    runup_lb = cl.get("continuation_runup_lookback") or det["prior_bars"]
    ru0 = max(0, start - runup_lb)
    run_low = min(lows[ru0:start])
    runup_pre = (base_high - run_low) / run_low if run_low > 0 else 0.0

    # Type classification (Module 1).
    is_bottoming = drawdown_pre >= cl["bottoming_drawdown_min"] and dur_weeks >= cl["bottoming_min_weeks"]
    is_continuation = (cl["continuation_runup_min"] <= runup_pre <= cl["continuation_runup_max"]
                       and dur_weeks >= cl["continuation_min_weeks"]
                       and m["dist_52w"] <= cl["continuation_max_dist52w"])
    if is_bottoming and is_continuation:
        base_type = "continuation" if m["dist_52w"] <= cl["both_pick_continuation_dist52w"] else "bottoming"
    elif is_bottoming:
        base_type = "bottoming"
    elif is_continuation:
        base_type = "continuation"
    else:
        return None

    return {
        "base_start": dates[start], "base_end": dates[last],
        "duration_weeks": round(dur_weeks, 1), "duration_bars": dur_bars,
        "base_high": base_high, "base_low": base_low,
        "depth_pct": round(base_depth * 100, 1),
        "drawdown_pre_pct": round(drawdown_pre * 100, 1),
        "runup_pre_pct": round(runup_pre * 100, 1),
        "dist52w_pct": round(m["dist_52w"] * 100, 1),
        "tightness20_pct": round(m["tightness20"] * 100, 1),
        "vol_dry_ratio_pct": round(m["vol_dry"] * 100, 1) if m["vol_dry"] is not None else None,
        "base_type": base_type, "close": m["close"],
        "_ma20": m["ma20"], "_ma50": m["ma50"], "_ma200": m["ma200"],
        "_ma20_slope_up": m["ma20_slope_up"], "_ma20_cross_up": m["ma20_cross_up"],
        "_ma20vol": m["ma20vol"], "_last_vol": m["last_vol"],
        "_highs": highs, "_lows": lows, "_closes": closes, "_start": start, "_last": last,
    }


def detect_base(highs, lows, closes, vols, dates, rs_line, cfg) -> tuple[dict, dict] | None:
    """Multi-window search: evaluate every candidate base window ending at the
    latest bar and keep the highest-BQS valid base. Returns (attrs, result) or
    None. Shorter windows are tried first, so ties favor the tighter/most-recent
    base."""
    det = cfg["detection"]
    n = len(closes)
    if n < det["min_bars"]:
        return None
    last = n - 1
    m = _current_metrics(highs, lows, closes, vols, n)

    min_base, step = det["min_base_bars"], det["window_step"]
    hi, lo = highs[last], lows[last]
    best = None
    limit = max(0, last - det["max_base_bars"])
    for start in range(last, limit - 1, -1):
        if highs[start] > hi:
            hi = highs[start]
        if lows[start] < lo:
            lo = lows[start]
        dur_bars = last - start + 1
        if dur_bars < min_base or (dur_bars - min_base) % step != 0:
            continue
        attrs = _build_attrs(highs, lows, closes, dates, start, last, hi, lo, m, cfg)
        if not attrs:
            continue
        res = score_base(attrs, rs_line, cfg)
        if best is None or res["score"] > best[1]["score"]:
            best = (attrs, res)
    return best


# --- scoring (BQS V3) -------------------------------------------------------

def _spring_points(a, cat) -> int:
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
                    return cat["strong"] if closes[j] > mid else cat["weak"]
    return cat["none"]


def _breakout(a, det, cat):
    """Module 13: returns (points, status)."""
    close, bh, bl = a["close"], a["base_high"], a["base_low"]
    vol, ma20v = a["_last_vol"], a["_ma20vol"]
    if close < bl:
        return cat["fail"], "fail"
    if close > bh:
        if ma20v and vol >= det["breakout_vol_mult"] * ma20v:
            return cat["strong"], "breakout"
        return cat["weak"], "breakout"
    if close >= bh * det["near_top"]:
        return cat["near_top"], "watchlist"
    return cat["mid"], "watchlist"  # in-base, not near top (sheet enumerates 4 states)


def _rs_points(a, rs_line: list[float] | None, cat) -> int:
    """Module 14: RS Line trend during the base (reuses the RS module)."""
    if not rs_line or len(rs_line) < 20:
        return cat["falling"]
    cur, prev = rs_line[-1], rs_line[-20]
    rs_at_high = cur >= max(rs_line) * 0.999
    price_at_high = a["close"] >= a["base_high"] * 0.999
    if rs_at_high and not price_at_high:
        return cat["new_high"]
    if prev > 0:
        chg = cur / prev - 1
        if chg > 0.01:
            return cat["rising"]
        if chg >= -0.01:
            return cat["flat"]
    return cat["falling"]


def _trend_points(a, cat_bot, cat_con) -> int:
    close, ma20, ma50, ma200 = a["close"], a["_ma20"], a["_ma50"], a["_ma200"]
    if a["base_type"] == "bottoming":
        if a["_ma20_cross_up"]:
            return cat_bot["cross_up"]
        if ma50 is not None and close > ma50:
            return cat_bot["above_ma50"]
        if ma20 is not None and close > ma20:
            return cat_bot["above_ma20"]
        return cat_bot["below"]
    # continuation
    if ma20 and ma50 and ma200 and ma20 > ma50 > ma200:
        return cat_con["stacked"]
    if ma20 and ma50 and ma20 > ma50 and close > ma50:
        return cat_con["ma20_gt_ma50"]
    if ma50 and close > ma50:
        return cat_con["above_ma50"]
    return cat_con["below"]


def score_base(a: dict, rs_line: list[float] | None, cfg) -> dict:
    """Score a detected base. Returns score/grade/status + breakdown."""
    t = a["base_type"]
    tiers, cat = cfg["tiers"], cfg["categorical"]
    b = []  # breakdown rows

    def add(key, en, vi, value, pts, mx):
        b.append({"key": key, "label_en": en, "label_vi": vi, "value": value, "points": pts, "max": mx})

    len_t = tiers["len1"] if t == "bottoming" else tiers["len2"]
    depth_t = tiers["depth1"] if t == "bottoming" else tiers["depth2"]
    dist_t = tiers["dist1"] if t == "bottoming" else tiers["dist2"]

    add("length", "Base length (weeks)", "Độ dài nền (tuần)", a["duration_weeks"],
        _tier(a["duration_weeks"], len_t), _max_pts(len_t))
    add("depth", "Base depth %", "Độ sâu nền %", a["depth_pct"],
        _tier(a["depth_pct"], depth_t), _max_pts(depth_t))
    add("tightness", "Tightness (last 20)", "Độ chặt 20 phiên", a["tightness20_pct"],
        _tier(a["tightness20_pct"], tiers["tight"]), _max_pts(tiers["tight"]))

    vdr = a["vol_dry_ratio_pct"]
    add("vol_dry", "Volume dry-up", "Khối lượng khô cạn", vdr,
        _tier(vdr, tiers["voldry"]) if vdr is not None else 0, _max_pts(tiers["voldry"]))
    add("dist52w", "Distance to 52W high %", "Vị trí so với đỉnh 52W", a["dist52w_pct"],
        _tier(a["dist52w_pct"], dist_t), _max_pts(dist_t))

    cat_bot, cat_con = cat["trend_bottoming"], cat["trend_continuation"]
    add("trend", "MA / Trend filter", "Bộ lọc MA/Xu hướng", None,
        _trend_points(a, cat_bot, cat_con), max((cat_bot if t == "bottoming" else cat_con).values()))

    if t == "bottoming":
        add("spring", "Spring / Shakeout", "Spring/Shakeout", None,
            _spring_points(a, cat["spring"]), max(cat["spring"].values()))

    bo_pts, status = _breakout(a, cfg["detection"], cat["breakout"])
    add("breakout", "Breakout / SOS", "Breakout/SOS", status, bo_pts, max(cat["breakout"].values()))
    add("rs", "RS confirmation", "RS xác nhận", None,
        _rs_points(a, rs_line, cat["rs"]), max(cat["rs"].values()))

    raw = sum(r["points"] for r in b)
    mx = sum(r["max"] for r in b)
    bqs = round(raw / mx * 100) if mx else 0
    return {
        "score": bqs, "grade": _grade(bqs, cfg["grades"]), "type": t, "status": status,
        "raw": raw, "max": mx, "breakdown": b,
    }


# --- orchestration / persistence -------------------------------------------

def _load_ohlcv(client, symbols, cutoff_iso):
    out = {s: {"d": [], "o": [], "h": [], "l": [], "c": [], "v": []} for s in symbols}
    CH = 120
    for i in range(0, len(symbols), CH):
        chunk = symbols[i:i + CH]
        offset = 0
        while True:
            rows = safe_execute(
                client.table("ta_ohlcv").select("symbol,date,open,high,low,close,volume")
                .in_("symbol", chunk).gte("date", cutoff_iso)
                .order("symbol").order("date").range(offset, offset + 999),
                label="base ohlcv",
            ).data
            for r in rows:
                o = out[r["symbol"]]
                o["d"].append(r["date"]); o["o"].append(float(r["open"]))
                o["h"].append(float(r["high"]))
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
    """Detect + score the current base for every active symbol. Returns stats.
    Tiers/weights/thresholds come from scoring_config 'price_base' (deep-merged
    over BASE_DEFAULTS)."""
    from .common import load_scoring_config
    cfg = load_scoring_config(client, "price_base", BASE_DEFAULTS)
    min_bars = cfg["detection"]["min_bars"]

    active = get_active_symbols(client)
    stats = {"active": len(active), "based": 0, "by_grade": {}, "as_of": None}
    if not active:
        return stats

    cutoff = (today_vn() - timedelta(days=cfg["detection"]["window_days"])).isoformat()
    ohlcv = _load_ohlcv(client, active, cutoff)
    rs_lines = _load_rs_lines(client, active)

    payload = []
    as_of = None
    for sym in active:
        o = ohlcv.get(sym)
        if not o or len(o["c"]) < min_bars:
            continue
        found = detect_base(o["h"], o["l"], o["c"], o["v"], o["d"], rs_lines.get(sym), cfg)
        if not found:
            continue
        attrs, res = found
        d = o["d"][-1]
        as_of = d if as_of is None or d > as_of else as_of
        detail = {k: v for k, v in attrs.items() if not k.startswith("_")}
        detail["breakdown"] = res["breakdown"]
        detail["raw"] = res["raw"]
        detail["max"] = res["max"]
        chart = _build_base_chart(o["o"], o["h"], o["l"], o["c"], attrs["_start"], attrs["_last"],
                                  attrs["base_low"], attrs["base_high"])
        payload.append({
            "symbol": sym,
            "base_score": res["score"],
            "base_grade": res["grade"],
            "base_type": res["type"],
            "base_status": res["status"],
            "base_detail": detail,
            "base_chart": chart,
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
            "base_status": None, "base_detail": None, "base_chart": None, "base_date": None,
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
