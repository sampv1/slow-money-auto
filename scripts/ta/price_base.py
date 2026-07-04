"""Price Base detection + BQS V8 scoring (cross-symbol, current base only).

A price base is a sideways consolidation after a prior move. We detect the
stock's CURRENT base (ending at the latest bar), classify it (Bottoming /
Continuation), and score its quality 0-100 per the BQS V8 rubric
(data/BQS_V8_BoSung_V7_DacTa_IT_HoanThien.xlsx).

BQS V8 measures BASE QUALITY only. It has six scored components that sum to a
raw 0-100 (no normalization) — the score IS the raw total:

    Duration + Depth + Tightness + VolumeDry + Contraction + Spring
       15       15        20          20           15         15   = 100

Everything RS/TA-flavoured (distance-to-52W, MA trend filter, RS Line) is gone,
and Breakout no longer scores — it only drives the 4-state BaseStatus
(Theo dõi / Chờ mua / Sẵn sàng mua / Breakout thất bại), shown separately.

Two preprocessing steps feed the end-of-base criteria:
  - Tight Area: the tightest 5-12 bar window ending at BaseEnd. Tightness,
    Volume-dry, Contraction (Range_3) and Spring all reference it.
  - Contraction (Tightness Improvement): Range_3/Range_1 across three base zones.

Computed daily after the RS pass. Stored as the latest snapshot on ta_universe
(base_score / base_grade / base_type / base_status / base_detail / base_chart /
base_date).
"""

from datetime import timedelta

from .common import safe_execute, today_vn
from .universe import get_active_symbols

# --- DB-overridable defaults (see scoring_config key 'price_base') ----------
# Tiers are [threshold, points] (ascending; pick the highest threshold ≤ value).
# The six component maxima sum to 100 (15+15+20+20+15+15), so raw == BQS.
BASE_DEFAULTS = {
    "detection": {
        "window_days": 500, "min_bars": 70, "min_base_bars": 20, "max_base_bars": 260,
        "window_step": 2, "depth_sanity_cap": 0.50, "prior_bars": 130,
    },
    "classification": {
        "bottoming_drawdown_min": 0.25, "bottoming_min_weeks": 6,
        "continuation_runup_min": 0.20, "continuation_runup_max": 0.60,
        # Run-up reference window (bars before the base) for continuation. Kept
        # SHORTER than prior_bars so a recent base isn't disqualified by a rally
        # that began months earlier. Bottoming's drawdown uses full prior_bars.
        "continuation_runup_lookback": 45, "continuation_min_weeks": 4,
        # Tie-break when a window qualifies as BOTH types: prefer continuation,
        # the fewer-candle base pattern (min 4w vs bottoming's 6w). Per customer
        # (BQS_V8_open_questions Q2): "prefer the one with shorter duration".
    },
    # Tight Area: tightest 5-12 bar window ending at BaseEnd (Tight_Area sheet).
    "tight_area": {
        "min_len": 5, "max_len": 12, "default_len": 8, "valid_max_range_pct": 12.0,
    },
    "tiers": {
        # Duration (weeks) — max 15 each.
        "len1": [[0, 0], [6, 10], [10, 15], [30, 12], [52, 8]],
        "len2": [[0, 0], [4, 10], [6, 15], [12, 12], [20, 8]],
        # Depth (%) — max 15 each (V8: 20→15).
        "depth1": [[0, 8], [10, 15], [20, 15], [30, 10], [40, 0]],
        "depth2": [[0, 12], [5, 15], [15, 15], [25, 8], [35, 0]],
        # Tightness of the Tight Area (%) — max 20 (V8: 25→20).
        "tight": [[0, 20], [5, 18], [8, 14], [12, 8], [15, 0]],
        # Volume dry-up: AvgVol(TightArea)/MA50Vol (%) — max 20.
        "voldry": [[0, 20], [50, 15], [70, 10], [90, 5], [120, 0]],
    },
    # Contraction / Tightness Improvement — Range_3/Range_1 (max 15).
    "contraction": {
        "strong_ratio": 0.50, "good_ratio": 0.65, "ok_ratio": 0.80,
        "points": {"strong": 15, "good": 12, "ok": 9, "weak": 5, "none": 0},
    },
    # Spring / Shakeout — both types, 4 levels (max 15).
    "spring": {
        "pen_min_pct": 1.0, "pen_max_pct": 5.0, "recover_bars": 5, "fast_bars": 2,
        "points": {"none": 0, "weak": 5, "clean": 10, "clean_fast": 15},
    },
    # BaseStatus (Trang_thai_nen sheet). Not scored — display only.
    "status": {
        "tight_max_range_pct": 12.0, "dry_max_ratio_pct": 90.0,
        "breakout_vol_mult": 1.5, "fail_lookback": 5,
    },
    # Grades gain A+ (Scoring_Rules): A+ 90-100 / A 80-89 / B 70-79 / C 60-69 / D <60.
    "grades": [[90, "A+"], [80, "A"], [70, "B"], [60, "C"], [0, "D"]],
}


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


def _range_pct(highs, lows, a: int, b: int) -> float | None:
    """(maxHigh - minLow) / minLow over bars [a, b], as a fraction (not %)."""
    if b < a:
        return None
    hi, lo = max(highs[a:b + 1]), min(lows[a:b + 1])
    return (hi - lo) / lo if lo > 0 else None


# --- Tight Area (preprocessing, shared per symbol) --------------------------

def _detect_tight_area(highs, lows, closes, vols, n, cfg) -> dict:
    """Scan back from BaseEnd (the latest bar) for the tightest L∈[min,max]-bar
    window. Pick lowest TightRange, then lowest VolDryRatio, then close nearest
    the window's top. Valid when TightRange ≤ valid_max_range_pct; otherwise fall
    back to `default_len` bars with tight_valid=False (Tight_Area sheet)."""
    ta = cfg["tight_area"]
    last = n - 1
    ma50v = _ma(vols, 50, last)
    lo_len = min(ta["min_len"], last)
    candidates = []
    for L in range(ta["min_len"], ta["max_len"] + 1):
        start = last - L + 1
        if start < 0:
            break
        rng = _range_pct(highs, lows, start, last)
        if rng is None:
            continue
        avg_vol = sum(vols[start:last + 1]) / L
        vol_ratio = (avg_vol / ma50v) if ma50v else None
        t_hi, t_lo = max(highs[start:last + 1]), min(lows[start:last + 1])
        near_top = (closes[last] - t_lo) / (t_hi - t_lo) if t_hi > t_lo else 0.0
        candidates.append({
            "start": start, "len": L, "range": rng, "vol_ratio": vol_ratio,
            "near_top": near_top, "hi": t_hi, "lo": t_lo,
        })

    valid_max = ta["valid_max_range_pct"] / 100.0
    best = None
    if candidates:
        # Priority: lowest range, then lowest vol ratio, then highest near_top.
        best = min(candidates, key=lambda x: (x["range"], x["vol_ratio"] if x["vol_ratio"] is not None else 9e9,
                                              -x["near_top"]))
    if best is None or best["range"] > valid_max:
        # Fallback: default_len bars, marked invalid (status forced to Theo dõi).
        L = min(ta["default_len"], last + 1) or lo_len or 1
        start = max(0, last - L + 1)
        rng = _range_pct(highs, lows, start, last) or 0.0
        avg_vol = sum(vols[start:last + 1]) / (last - start + 1)
        vol_ratio = (avg_vol / ma50v) if ma50v else None
        best = {"start": start, "len": last - start + 1, "range": rng,
                "vol_ratio": vol_ratio, "hi": max(highs[start:last + 1]),
                "lo": min(lows[start:last + 1]), "near_top": 0.0}
        valid = False
    else:
        valid = True

    return {
        "start": best["start"], "end": last, "len": best["len"],
        "range_pct": round(best["range"] * 100, 1),
        "vol_ratio_pct": round(best["vol_ratio"] * 100, 1) if best["vol_ratio"] is not None else None,
        "high": best["hi"], "low": best["lo"], "valid": valid,
        "ma50v": ma50v,
    }


# --- detection --------------------------------------------------------------

def _current_metrics(highs, lows, closes, vols, n, cfg) -> dict:
    """Metrics evaluated at the latest bar — independent of the base window, so
    computed once per symbol and shared across all candidate windows. Includes
    the Tight Area (anchored at BaseEnd = the latest bar)."""
    last = n - 1
    ma20v = _ma(vols, 20, last)
    tight = _detect_tight_area(highs, lows, closes, vols, n, cfg)
    return {
        "close": closes[last], "ma20vol": ma20v, "last_vol": vols[last],
        "tight": tight,
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
    # months-old accumulation low doesn't inflate it.
    runup_lb = cl.get("continuation_runup_lookback") or det["prior_bars"]
    ru0 = max(0, start - runup_lb)
    run_low = min(lows[ru0:start])
    runup_pre = (base_high - run_low) / run_low if run_low > 0 else 0.0

    # Type classification (Module 1). When a window qualifies as BOTH, prefer
    # continuation — the fewer-candle base pattern (customer Q2 tie-break).
    is_bottoming = drawdown_pre >= cl["bottoming_drawdown_min"] and dur_weeks >= cl["bottoming_min_weeks"]
    is_continuation = (cl["continuation_runup_min"] <= runup_pre <= cl["continuation_runup_max"]
                       and dur_weeks >= cl["continuation_min_weeks"])
    if is_continuation:
        base_type = "continuation"
    elif is_bottoming:
        base_type = "bottoming"
    else:
        return None

    return {
        "base_start": dates[start], "base_end": dates[last],
        "duration_weeks": round(dur_weeks, 1), "duration_bars": dur_bars,
        "base_high": base_high, "base_low": base_low,
        "depth_pct": round(base_depth * 100, 1),
        "drawdown_pre_pct": round(drawdown_pre * 100, 1),
        "runup_pre_pct": round(runup_pre * 100, 1),
        "base_type": base_type, "close": m["close"],
        "_highs": highs, "_lows": lows, "_closes": closes,
        "_start": start, "_last": last, "_m": m,
    }


def detect_base(highs, lows, closes, vols, dates, cfg) -> tuple[dict, dict] | None:
    """Multi-window search: evaluate every candidate base window ending at the
    latest bar and keep the highest-BQS valid base. Returns (attrs, result) or
    None. Shorter windows are tried first, so ties favor the tighter/most-recent
    base."""
    det = cfg["detection"]
    n = len(closes)
    if n < det["min_bars"]:
        return None
    last = n - 1
    m = _current_metrics(highs, lows, closes, vols, n, cfg)

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
        res = score_base(attrs, cfg)
        if best is None or res["score"] > best[1]["score"]:
            best = (attrs, res)
    return best


# --- scoring (BQS V8) -------------------------------------------------------

def _contraction(a, cfg) -> dict:
    """Tightness Improvement (max 15). Split the base into thirds; Range_1 = first
    third, Range_2 = middle third, Range_3 = the Tight Area range. Score on
    ContractionRatio = Range_3/Range_1 plus the monotonic-contraction bonus."""
    highs, lows, start, last = a["_highs"], a["_lows"], a["_start"], a["_last"]
    third = max(1, (last - start + 1) // 3)
    r1 = _range_pct(highs, lows, start, start + third - 1)
    r2 = _range_pct(highs, lows, start + third, start + 2 * third - 1)
    tight = a["_m"]["tight"]
    r3 = tight["range_pct"] / 100.0
    cc = cfg["contraction"]
    pts = cc["points"]
    if r1 is None or r1 <= 0 or r3 is None:
        return {"points": pts["none"], "ratio": None, "r1": r1, "r2": r2, "r3": r3}
    ratio = r3 / r1
    if r2 is not None and r1 > r2 > r3 and ratio <= cc["strong_ratio"]:
        p = pts["strong"]
    elif r1 > r3 and ratio <= cc["good_ratio"]:
        p = pts["good"]
    elif ratio <= cc["ok_ratio"]:
        p = pts["ok"]
    elif ratio <= 1.0:
        p = pts["weak"]
    else:
        p = pts["none"]
    return {"points": p, "ratio": ratio, "r1": r1, "r2": r2, "r3": r3}


def _spring_points(a, cfg) -> int:
    """Spring / Shakeout (max 15, both types). A dip pen_min..pen_max % below the
    base shelf that closes back above it within recover_bars = clean; a fast
    recovery (≤ fast_bars) or a high-volume shakeout = clean_fast; a weak close-
    back = weak; none otherwise (Module 10)."""
    lows, closes, start, last = a["_lows"], a["_closes"], a["_start"], a["_last"]
    base_low, base_high = a["base_low"], a["base_high"]
    sp = cfg["spring"]
    pts = sp["points"]
    win_lows = lows[start:last + 1]
    shelf = sorted(win_lows)[max(1, len(win_lows) // 10)]  # ~10th-percentile low = shelf
    if shelf <= 0:
        return pts["none"]
    mid = (base_high + base_low) / 2
    best = pts["none"]
    for i in range(start, last + 1):
        pen = (shelf - lows[i]) / shelf
        if sp["pen_min_pct"] / 100.0 <= pen <= sp["pen_max_pct"] / 100.0:  # dipped below shelf
            for j in range(i + 1, min(i + 1 + sp["recover_bars"], last + 1)):
                if closes[j] > shelf:
                    if closes[j] <= mid:
                        best = max(best, pts["weak"])
                    elif (j - i) <= sp["fast_bars"]:
                        best = max(best, pts["clean_fast"])
                    else:
                        best = max(best, pts["clean"])
                    break
    return best


def _base_status(a, cfg) -> str:
    """4-state BaseStatus (Trang_thai_nen). Not scored — display only.
      breakout_fail : a close broke above the pivot in the last N bars but today
                      closed back below it.
      ready_buy     : today's close > pivot (broke out of the consolidation).
      wait_buy      : Tight Area tight & dry (range ≤ max, vol ratio ≤ max).
      watch         : otherwise (incl. an invalid Tight Area).

    Pivot = the consolidation ceiling BEFORE the recent breakout window (the
    highest high of the base EXCLUDING the last `fail_lookback` bars). It must
    exclude those bars: the Tight Area ends at the latest bar, so a resistance
    that includes today can never be exceeded by today's close."""
    st = cfg["status"]
    tight = a["_m"]["tight"]
    close = a["close"]
    highs, closes, start, last = a["_highs"], a["_closes"], a["_start"], a["_last"]
    lb = st["fail_lookback"]

    res_end = last - lb
    pivot = max(highs[start:res_end + 1]) if res_end >= start else a["base_high"]
    broke_recent = max(closes[max(start, last - lb + 1):last + 1]) > pivot

    if broke_recent and close < pivot:  # broke out then fell back below the pivot
        return "breakout_fail"
    if close > pivot:                    # today closed above the pivot
        return "ready_buy"
    dry_ok = tight["vol_ratio_pct"] is not None and tight["vol_ratio_pct"] <= st["dry_max_ratio_pct"]
    if tight["valid"] and tight["range_pct"] <= st["tight_max_range_pct"] and dry_ok:
        return "wait_buy"
    return "watch"


def score_base(a: dict, cfg) -> dict:
    """Score a detected base per BQS V8. Six components sum to a raw 0-100 (no
    normalization). Returns score/grade/status + breakdown."""
    t = a["base_type"]
    tiers = cfg["tiers"]
    m = a["_m"]
    tight = m["tight"]
    b = []  # breakdown rows

    def add(key, en, vi, value, pts, mx):
        b.append({"key": key, "label_en": en, "label_vi": vi, "value": value, "points": pts, "max": mx})

    len_t = tiers["len1"] if t == "bottoming" else tiers["len2"]
    depth_t = tiers["depth1"] if t == "bottoming" else tiers["depth2"]

    add("length", "Base length (weeks)", "Độ dài nền (tuần)", a["duration_weeks"],
        _tier(a["duration_weeks"], len_t), _max_pts(len_t))
    add("depth", "Base depth %", "Độ sâu nền %", a["depth_pct"],
        _tier(a["depth_pct"], depth_t), _max_pts(depth_t))
    add("tightness", "Tightness (Tight Area)", "Độ chặt cuối nền", tight["range_pct"],
        _tier(tight["range_pct"], tiers["tight"]), _max_pts(tiers["tight"]))

    vdr = tight["vol_ratio_pct"]
    add("vol_dry", "Volume dry-up", "Khối lượng khô cạn", vdr,
        _tier(vdr, tiers["voldry"]) if vdr is not None else 0, _max_pts(tiers["voldry"]))

    con = _contraction(a, cfg)
    con_val = round(con["ratio"], 2) if con["ratio"] is not None else None
    add("contraction", "Tightness improvement", "Mức co hẹp dần", con_val,
        con["points"], _max_pts([[0, v] for v in cfg["contraction"]["points"].values()]))

    add("spring", "Spring / Shakeout", "Spring/Shakeout", None,
        _spring_points(a, cfg), _max_pts([[0, v] for v in cfg["spring"]["points"].values()]))

    raw = sum(r["points"] for r in b)
    mx = sum(r["max"] for r in b)  # == 100 by construction
    bqs = round(raw)  # raw IS the 0-100 score (no normalization in V8)
    status = _base_status(a, cfg)
    return {
        "score": bqs, "grade": _grade(bqs, cfg["grades"]), "type": t, "status": status,
        "raw": raw, "max": mx, "breakdown": b,
        "tight_area": {
            "start_idx": tight["start"], "len": tight["len"], "range_pct": tight["range_pct"],
            "vol_ratio_pct": tight["vol_ratio_pct"], "valid": tight["valid"],
        },
        "contraction": {"ratio": con_val, "r1_pct": round(con["r1"] * 100, 1) if con["r1"] else None,
                        "r2_pct": round(con["r2"] * 100, 1) if con["r2"] else None,
                        "r3_pct": round(con["r3"] * 100, 1) if con["r3"] is not None else None},
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

    payload = []
    as_of = None
    for sym in active:
        o = ohlcv.get(sym)
        if not o or len(o["c"]) < min_bars:
            continue
        found = detect_base(o["h"], o["l"], o["c"], o["v"], o["d"], cfg)
        if not found:
            continue
        attrs, res = found
        d = o["d"][-1]
        as_of = d if as_of is None or d > as_of else as_of
        detail = {k: v for k, v in attrs.items() if not k.startswith("_")}
        detail["breakdown"] = res["breakdown"]
        detail["raw"] = res["raw"]
        detail["max"] = res["max"]
        detail["tight_area"] = res["tight_area"]
        detail["contraction"] = res["contraction"]
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
