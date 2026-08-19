"""Trend Score — structural trend scoring on the daily and weekly charts.

Replaces the BQS price-base module. Spec:
`data/He_thong_cham_diem_Xu_huong_TA_Pro_Bo_sung.xlsx` (sheets Tổng quan / Trend ngày /
Trend tuần / Logic IT).

    TrendScore = DailyTrendScore·60% + WeeklyTrendScore·40%

Both halves score the same structure, read off a ZigZag over ~1.5 years:

    O    the last lower-high before the bottom
    K    the bottom of the decline
    A    the close that takes O back out — the downtrend break
    D1   the first pullback low after A, valid only inside a band
    A1   a close back above A — the uptrend structure is complete
    D2/A2  later pullbacks and highs inside that uptrend

**Weekly is the same machine one leg behind.** Its A1 is daily's A (the first
peak after the break) and its A2 is daily's A1, which is exactly why weekly needs
one more leg to reach 100 (daily 15+15+30+10+30, weekly 15+15+40+10+20).

Two things about the scoring that are easy to get wrong:

  - **The state table beats the arithmetic.** On the daily chart D1 stays at 60,
    the same as A — the spec says twice not to add its 10 points into a 70. Those
    10 points only land at A1, where the five criteria do sum to 100.
  - **A failing base condition caps everything.** TC1 (within −25% of the 52-week
    high) and TC2 (close above the daily MA200) are worth 15 each, and if either
    fails the score falls back to what those two earn on their own no matter how
    complete the structure looks. On the weekly chart TC2 is harder still: below
    the daily MA200 the score is 0, full stop, ahead of every other rule.

A consequence of the spec worth knowing before reading the numbers: TC1 and TC2
are the SAME test on both timeframes, because the in-progress week's close is the
latest daily close. The two halves differ only in the structure — weekly bars
versus daily bars — never in the base conditions.

Stored per symbol on ta_universe as the latest snapshot (trend_score /
trend_score_daily / trend_score_weekly / trend_state_daily / trend_state_weekly /
trend_dir_daily / trend_dir_weekly / trend_status / trend_action / trend_detail /
trend_chart / trend_date). The `dir_*` and status/action columns are what the
Signal Pro row renders; the states and the 0-100 halves are what it sorts and
explains itself with.
"""

from datetime import date as _date, timedelta

from .common import safe_execute, today_vn
from .universe import get_active_symbols
from .zigzag import PIVOT_HIGH, PIVOT_LOW, zigzag, _argmax

# --- DB-overridable defaults (scoring_config key 'trend_score') --------------
TREND_DEFAULTS = {
    # ~1.5 years of calendar days, per the spec's "Xét lịch sử 1,5 năm". Also
    # comfortably covers the 200 sessions MA200 needs at the last bar — the base
    # conditions are only ever evaluated there, never walked through history.
    "window_days": 560,
    # MA200 must exist, or TC2 cannot be evaluated and the weekly hard rule has
    # nothing to gate on. Below this a symbol gets NO trend score rather than a 0:
    # absence of data is not a failed test.
    "min_bars": 200,
    "ma_period": 200,
    "high_52w_bars": 252,
    "dist_52w_min": -0.25,
    # ZigZag sensitivity, per timeframe. The weekly chart is deliberately NOT the
    # daily settings: 10 weekly candles is a 10-week minimum between pivots in a
    # window that holds ~78 of them, which left 40% of the universe with exactly
    # one weekly pivot and 3 symbols of 1,158 able to complete a weekly uptrend.
    # 7% / 6 candles asks for a bigger move over a shorter span, which is the
    # right trade on a chart where one bar is a week.
    "daily": {"deviation": 0.05, "depth": 10},
    "weekly": {"deviation": 0.07, "depth": 6},
    "weights": {"daily": 0.60, "weekly": 0.40},
    # Score → direction, for the two timeframe columns. Descending; the first
    # threshold at or below the score wins. The bands are the state table's own
    # score levels, so a direction can never disagree with the state it came from:
    # 100 is a complete uptrend, 60-80 a confirmed break, 30 both base conditions
    # and no break, 15 one base condition, 0 neither.
    "direction_bands": [[100, "strong_up"], [60, "up"], [30, "flat"], [15, "down"], [0, "strong_down"]],
    # Criterion points. Daily TC4 (d1) is deliberately absent from the D1 state's
    # score — see _state_scores().
    "points": {
        "daily": {"tc1": 15, "tc2": 15, "a": 30, "d1": 10, "final": 30},
        "weekly": {"tc1": 15, "tc2": 15, "a": 40, "d1": 10, "final": 20},
    },
    # BỔ SUNG 01 — re-seat O/K when the ZigZag is noisy sideways around MA200.
    #
    # A stock that chops across its MA200 prints several ZigZag lows below it, and
    # the base rule ("K is the LOWEST trough of the decline") anchors K on whichever
    # of them happens to be cheapest — often months stale. The structure then
    # describes a decline the stock has already left behind.
    #
    # The supplement re-seats O/K on the MOST RECENT low below MA200 instead, but
    # only once price has climbed back above MA200 and only when the chop is real
    # (>= min_lows such lows in the lookback). It changes NOTHING else: not a
    # score, not a state, not the weekly chart. Daily only, exactly as specified.
    "sideway_reset": {
        "enabled": True,
        # "Ngưỡng kích hoạt reset: N >= 3" — fewer lows is an ordinary decline,
        # not chop, and the base rule already handles it correctly.
        "min_lows": 3,
        # "trong 52 tuần gần nhất" — same window as the 52-week high.
        "lookback_bars": 252,
    },
    "grades": [[90, "A+"], [80, "A"], [70, "B"], [60, "C"], [0, "D"]],
    # How many bars a just-invalidated structure keeps the spec's own name for the
    # break (BREAK_D1 / BACK_BELOW_O) before it reads as an ordinary "no structure
    # yet". Without this the "Xét lại" signal disappears the moment it appears.
    "invalidated_bars": 10,
}

# Structural stages, timeframe-neutral. The spec's per-timeframe state names come
# out of _score_timeframe().
STAGE_NONE = "none"          # no O–K
STAGE_BASE = "base"          # O and K known, close has not taken O out
STAGE_BROKE = "broke"        # a close above O
STAGE_PULLBACK = "pullback"  # a valid D1 has confirmed
STAGE_COMPLETE = "complete"  # a close back above A — structure complete


def _grade(score: float, grades) -> str:
    for thr, g in grades:
        if score >= thr:
            return g
    return "D"


def _state_scores(pts: dict, weekly: bool) -> dict:
    """The four structural score levels, built from the criterion points."""
    base = pts["tc1"] + pts["tc2"]
    if weekly:
        return {
            "base": base,
            "a": base + pts["a"],                                  # 70
            "d1": base + pts["a"] + pts["d1"],                     # 80
            "complete": base + pts["a"] + pts["d1"] + pts["final"],  # 100
        }
    # Daily: D1 does NOT collect its 10 points. "Không cộng máy móc thành 70" —
    # the state table pins D1 at the same 60 as A, and the 10 only lands at A1,
    # where 15+15+30+10+30 = 100.
    return {
        "base": base,
        "a": base + pts["a"],                                      # 60
        "d1": base + pts["a"],                                     # 60, not 70
        "complete": base + pts["a"] + pts["d1"] + pts["final"],    # 100
    }


# --- weekly bars ------------------------------------------------------------

def _to_weekly(dates, o, h, l, c, v):
    """Aggregate daily bars into ISO weeks (open=first, close=last, high/low the
    extremes, volume summed).

    The final week is usually IN PROGRESS and is kept: its close is the latest
    close, which is what every rule in the spec compares against. It cannot be
    mistaken for a pivot either — confirming one needs `depth` bars of hindsight,
    so the newest bar is never eligible. Each week's reported date is its last
    traded day, so a level's date points at a session that existed.
    """
    wd, wo, wh, wl, wc, wv = [], [], [], [], [], []
    key = None
    for i, ds in enumerate(dates):
        y, wk, _ = _date.fromisoformat(ds).isocalendar()
        k = (y, wk)
        if k != key:
            key = k
            wd.append(ds)
            wo.append(o[i]); wh.append(h[i]); wl.append(l[i]); wc.append(c[i]); wv.append(v[i])
        else:
            wd[-1] = ds
            wh[-1] = max(wh[-1], h[i])
            wl[-1] = min(wl[-1], l[i])
            wc[-1] = c[i]
            wv[-1] += v[i]
    return wd, wo, wh, wl, wc, wv


# --- the structure walk -----------------------------------------------------

def _reset(st: dict, i: int, kind: str) -> None:
    """Kill the structure and start looking for a new O–K from bar `i`.

    `prev_peak` deliberately SURVIVES. The peak that tops out a failing structure
    is a real peak on the chart and is normally the O of the decline that follows;
    clearing it would demand a whole new up-and-down cycle before any O could
    exist, and the symbol would sit at "no structure" through the entire drop.
    `since` is applied to troughs only, so K must still be a NEW low.
    """
    st.update(
        stage=STAGE_NONE, O=None, K=None, A=None, D1=None,
        broke_idx=None, complete_idx=None, trough_since_complete=False,
        reset_idx=i, reset_kind=kind, since=i,
    )


def _ma_series(values, period: int) -> list[float | None]:
    """Trailing moving average at EVERY bar, None until `period` bars exist.

    The supplement compares each swing low against the MA200 *of its own day*
    ("Low_i < DailyMA200_i"), not against today's MA200 — a low from eight months
    ago has to be judged by where the average sat then. One scalar cannot answer
    that, so this walks the series.
    """
    out: list[float | None] = []
    run = 0.0
    for i, v in enumerate(values):
        run += v
        if i >= period:
            run -= values[i - period]
        out.append(run / period if i >= period - 1 else None)
    return out


def _sideway_reset_seed(closes, pivots, ma200s, cfg):
    """BỔ SUNG 01: the (O, K, activate_idx) to re-seat the daily structure on.

    Returns None when the rule does not fire, in which case the caller keeps the
    existing O/K logic untouched — which is the spec's own default in both of its
    ELSE branches.

    Order of the three gates matters and is the spec's:
      1. price is back above MA200 today (else the rule does not apply at all);
      2. count ZigZag swing lows that sat below the MA200 *of their own day*
         inside the lookback;
      3. only at >= min_lows is the chop real enough to re-seat on.

    K is then the LATEST such low by date — explicitly not the cheapest
    ("chọn ĐÁY DƯỚI MA200 CUỐI CÙNG theo thời gian, KHÔNG chọn đáy có giá thấp
    nhất 52W") — and O the nearest confirmed swing high before it.
    """
    conf = cfg.get("sideway_reset") or {}
    if not conf.get("enabled", True):
        return None
    n = len(closes)
    if not n or ma200s[-1] is None or closes[-1] <= ma200s[-1]:
        return None  # gate 1: not back above MA200 — leave the structure alone

    start = max(0, n - int(conf.get("lookback_bars", 252)))
    below = [p for p in pivots
             if p[2] == PIVOT_LOW and p[0] >= start
             and ma200s[p[0]] is not None and p[1] < ma200s[p[0]]]
    if len(below) < int(conf.get("min_lows", 3)):
        return None  # gate 3: an ordinary decline, not chop

    k = max(below, key=lambda p: p[0])
    # O = the nearest confirmed swing high before K, i.e. the top of the leg that
    # fell into it. Without one there is no O–K pair to seat, so the rule yields.
    highs = [p for p in pivots if p[2] == PIVOT_HIGH and p[0] < k[0]]
    if not highs:
        return None
    o = max(highs, key=lambda p: p[0])
    # Activated on K's CONFIRMATION bar, never on K's own bar: the walk must not
    # know about a pivot before the market proved it, which is the same rule the
    # rest of this module lives by.
    return (o[0], o[1]), (k[0], k[1]), k[3]


def _walk_structure(closes, pivots, floor_key: str, seed=None) -> dict:
    """Walk bars forward, maintaining the O–K–A–D1 structure; return it as of the
    last bar.

    `floor_key` is the level a pullback must hold — "K" on the daily chart,
    "O" on the weekly one. The spec's TC4 differs between them (daily
    `K < D1 < A`, weekly `O < D1 < A1`), and the same level doubles as the
    pre-completion invalidation floor.

    Bars, not pivots, drive the walk: every scoring rule in the spec is about a
    CLOSE crossing a level, and pivots only supply the levels. Pivots are ingested
    on their confirmation bar, never their extreme's bar, so the machine cannot
    act on a swing before the market had proved it.
    """
    n = len(closes)
    by_confirm: dict[int, list] = {}
    for p in pivots:
        by_confirm.setdefault(p[3], []).append(p)

    st = {
        "stage": STAGE_NONE, "O": None, "K": None, "A": None, "D1": None,
        "broke_idx": None, "complete_idx": None, "trough_since_complete": False,
        "reset_idx": None, "reset_kind": None, "since": 0, "prev_peak": None,
    }

    seed_o, seed_k, seed_at = seed if seed else (None, None, None)

    for i in range(n):
        close = closes[i]

        # BỔ SUNG 01 lands here, on K's confirmation bar — not at bar 0. Seeding
        # up front would let the machine compare closes against an O that had not
        # formed yet and mark a break months before the market made one.
        #
        # `since` buries every trough older than the new K, which is the spec's
        # "IGNORE older BelowMA200Lows for current cycle": those stale lows are
        # exactly the noise the rule exists to discard. Newer troughs still apply
        # normally — the lock is against going BACK to old bottoms, not against
        # the market making a genuine new one.
        if seed_at is not None and i == seed_at:
            st.update({
                "stage": STAGE_BASE, "O": seed_o, "K": seed_k,
                "A": None, "D1": None, "broke_idx": None, "complete_idx": None,
                "trough_since_complete": False, "reset_idx": None,
                "reset_kind": None, "since": seed_k[0],
            })

        for (idx, val, kind, _ci) in by_confirm.get(i, ()):
            if kind == PIVOT_HIGH:
                # Always tracked: the candidate O for whatever K comes next.
                st["prev_peak"] = (idx, val)
                continue
            if idx < st["since"]:
                continue  # a trough belonging to a structure we already buried
            stage = st["stage"]
            if stage in (STAGE_NONE, STAGE_BASE):
                # K is the LOWEST trough of the decline and O the peak immediately
                # before it, so a new lower low moves both together.
                #
                # A trough with NO peak before it is not a K candidate at all —
                # it is skipped rather than recorded. It is almost always the
                # window's own left edge: a ZigZag seeds its first leg at bar 0,
                # so any symbol whose 1.5 years open below their later lows starts
                # with a bar-0 "trough" that no peak can precede. Recording it
                # would pin K at the cheapest price in the window forever, and
                # every genuine O–K pair that formed later would be rejected for
                # being higher — the symbol reads "no structure" for good.
                if st["prev_peak"] is None or st["prev_peak"][0] >= idx:
                    continue
                if st["K"] is None or val < st["K"][1]:
                    st["O"], st["K"] = st["prev_peak"], (idx, val)
                    st["stage"] = STAGE_BASE
            elif stage == STAGE_BROKE:
                floor = st[floor_key]
                if floor is not None and idx > st["broke_idx"]:
                    a_idx = _argmax(closes, st["broke_idx"], idx)
                    a_val = closes[a_idx]
                    if floor[1] < val < a_val:
                        st["A"] = (a_idx, a_val)
                        st["D1"] = (idx, val)
                        st["stage"] = STAGE_PULLBACK
            elif stage == STAGE_COMPLETE:
                st["trough_since_complete"] = True

        stage = st["stage"]
        if stage == STAGE_BASE:
            if close > st["O"][1]:
                st["stage"] = STAGE_BROKE
                st["broke_idx"] = i
        elif stage in (STAGE_BROKE, STAGE_PULLBACK):
            if stage == STAGE_PULLBACK and close > st["A"][1]:
                st["stage"] = STAGE_COMPLETE
                st["complete_idx"] = i
                st["trough_since_complete"] = False
            elif close < st[floor_key][1]:
                # The downtrend break has failed. Weekly's BACK_BELOW_O is in the
                # spec; the daily equivalent against K is NOT — the daily sheet
                # only writes a reset rule for after A1, which would otherwise
                # hold a stock at 60 through an unlimited collapse.
                _reset(st, i, "back_below_o" if floor_key == "O" else "back_below_k")
        elif stage == STAGE_COMPLETE:
            if close < st["D1"][1]:
                _reset(st, i, "break_d1")  # "Mốc reset là D1"

    # A is only frozen when D1 confirms; before that, report the running high of
    # the leg that broke O so the breakdown has a level to show.
    if st["stage"] == STAGE_BROKE and st["broke_idx"] is not None:
        a_idx = _argmax(closes, st["broke_idx"], n - 1)
        st["A"] = (a_idx, closes[a_idx])
    return st


# --- scoring ----------------------------------------------------------------

def _score_timeframe(st, close, tc1, tc2, pts, weekly, invalidated_bars, n) -> tuple[str, int]:
    """(state, score) for one timeframe, per the spec's state/priority table."""
    scores = _state_scores(pts, weekly)
    base = (pts["tc1"] if tc1 else 0) + (pts["tc2"] if tc2 else 0)

    # Weekly hard rule, ahead of every structural consideration ("KHÔNG NGOẠI LỆ").
    if weekly and not tc2:
        return "below_ma200", 0

    if st["stage"] == STAGE_NONE:
        broken_recently = (
            st["reset_kind"] is not None
            and st["reset_idx"] is not None
            and n - 1 - st["reset_idx"] <= invalidated_bars
        )
        if broken_recently:
            # "Reset phần cấu trúc, không reset 2 điều kiện nền nếu còn đạt."
            return st["reset_kind"], base
        # "Không có O và K thì mọi trường hợp = 0."
        return "no_ok", 0

    if base < scores["base"]:
        # The special rule: a failed base condition caps the score at what the
        # base conditions earn on their own, however complete the structure is.
        if base == 0:
            return "ok_base_fail", 0
        return ("ok_below_52w" if not tc1 else "ok_below_ma200"), base

    if st["stage"] == STAGE_BASE:
        return ("base_only" if weekly else "base"), scores["base"]
    if st["stage"] == STAGE_BROKE:
        return "a_confirmed", scores["a"]
    if st["stage"] == STAGE_PULLBACK:
        return "d1", scores["d1"]

    # STAGE_COMPLETE.
    if weekly:
        if close > st["A"][1]:
            return ("d2_above_a1" if st["trough_since_complete"] else "a2_full_uptrend"), scores["complete"]
        # Below A1 but still above D1: TC5's 20 points come off (Trend tuần row 11).
        return "d2_between", scores["d1"]
    return ("post_a1_above_d1" if st["trough_since_complete"] else "a1_uptrend"), scores["complete"]


def direction(score: int | None, state: str | None, cfg) -> str | None:
    """Score → one of the five trend arrows (Tăng mạnh … Giảm mạnh), or None.

    `no_ok` gets NO arrow, and that is the whole reason this takes the state as
    well as the score. A zero has two unrelated causes: failing the base
    conditions, which is genuine weakness, and finding no O–K pair at all, which
    is an unidentifiable structure. Banding on the number alone labelled the
    second "Giảm mạnh" — exactly backwards, because a symbol whose base
    conditions PASS while no O–K exists is one that has climbed for 18 months
    without a qualifying decline to measure. It was visible on the page: DRI read
    daily "Đi ngang" (30, so above its MA200) next to weekly "Giảm mạnh" (0),
    two conclusions that cannot both hold when TC2 is the same test on both
    timeframes.
    """
    if score is None or state == "no_ok":
        return None
    for thr, name in cfg["direction_bands"]:
        if score >= thr:
            return name
    return "strong_down"


# --- status / action --------------------------------------------------------
#
# The customer's UI prototype, and the whole policy lives in these two maps.
#
# Status is a FOUR-value vocabulary carried over from the retired BQS module but
# redefined by the prototype's legend, and it is read off the DAILY chart: the
# prototype pairs a "Sẵn sàng mua" with a falling weekly column, so the weekly
# read is context in its own column rather than a veto here.
#
#   Tạo đáy       Tích lũy / tạo nền        — O–K formed, O not yet taken out
#   Sẵn sàng mua  Bứt phá / breakout        — a close has just taken out a level
#   Chờ mua       Điều chỉnh lành mạnh      — pulled back and holding
#   Tiếp diễn     Trong xu hướng tăng       — uptrend intact but no fresh break
#
# The weekly chart still constrains this, just not directly: the four statuses
# only exist for daily states that already passed BOTH base conditions, so
# nothing below the daily MA200 or more than 25% off its 52-week high can reach
# a buy status at all.
#
# Action is a pure function of status, exactly as the prototype's rows show. Note
# what that encodes: a stock already deep in an uptrend reads "Theo dõi", not a
# buy — you enter on a breakout or after a healthy correction, not mid-trend.
_STATUS_FROM_DAILY = {
    "base": "tao_day",
    "a_confirmed": "san_sang_mua",
    "a1_uptrend": "san_sang_mua",
    "d1": "cho_mua",
    "post_a1_above_d1": "tiep_dien",
}
_ACTION_FROM_STATUS = {
    "tao_day": "theo_doi",
    "tiep_dien": "theo_doi",
    "cho_mua": "cho_mua",
    "san_sang_mua": "san_sang_mua",
}


def _verdict(daily_state: str) -> tuple[str | None, str]:
    """(status, action) from the daily state alone — the weekly read is shown in
    its own column, not folded in here (see the note above).

    A daily state with no readable structure — below the MA200, too far off the
    high, or a structure just invalidated — yields NO status and the conservative
    "Theo dõi", which is the prototype's own default ("Quan sát, chưa hành động").
    """
    status = _STATUS_FROM_DAILY.get(daily_state)
    return status, _ACTION_FROM_STATUS.get(status or "", "theo_doi")


# --- per-symbol scoring -----------------------------------------------------

def _criteria_rows(pts, tc1, tc2, dist52w_pct, close, ma200, state, scores) -> list[dict]:
    """Breakdown rows for the modal: the two base criteria, then the structural
    points the state actually earned (not the ones addition would suggest)."""
    structural = max(0, scores.get(state, 0) - (pts["tc1"] + pts["tc2"])) if state in scores else 0
    return [
        {"key": "tc1", "label_en": "Distance to 52W high", "label_vi": "Khoảng cách đỉnh 52W",
         "value": dist52w_pct, "points": pts["tc1"] if tc1 else 0, "max": pts["tc1"]},
        {"key": "tc2", "label_en": "Close vs MA200 (daily)", "label_vi": "Giá vs MA200 ngày",
         "value": round(close / ma200 * 100 - 100, 1) if ma200 else None,
         "points": pts["tc2"] if tc2 else 0, "max": pts["tc2"]},
        {"key": "structure", "label_en": "Trend structure", "label_vi": "Cấu trúc xu hướng",
         "value": state, "points": structural,
         "max": pts["a"] + pts["d1"] + pts["final"]},
    ]


def _levels(st, dates) -> dict:
    out = {}
    for k in ("O", "K", "A", "D1"):
        p = st.get(k)
        if p is not None:
            idx = min(max(p[0], 0), len(dates) - 1)
            out[k] = {"date": dates[idx], "value": round(p[1])}
    return out


def score_timeframe(dates, c, cfg, key: str, tc1: bool, tc2: bool,
                    ma200: float, dist52w: float) -> dict:
    """Score one timeframe end to end. `key` is 'daily' or 'weekly'.

    Only closes are needed: the ZigZag runs on closes so that every structural
    level is a close, and every rule in the spec compares a close against one
    ("A = điểm giá đóng cửa vượt đỉnh O", "Close_A > Close_O"). Highs and lows
    reach the score exactly once, through the 52-week high.
    """
    weekly = key == "weekly"
    zz = cfg[key]
    pts = cfg["points"][key]
    pivots = zigzag(c, zz["deviation"], zz["depth"])
    # Daily only. The supplement says so explicitly ("Chỉ áp dụng cho Trend
    # ngày"), and the weekly chart has no MA200 of its own to chop around — its
    # base conditions read the DAILY MA200, so the same test there would be a
    # different question wearing the same name.
    seed = None
    if not weekly:
        seed = _sideway_reset_seed(c, pivots, _ma_series(c, cfg["ma_period"]), cfg)
    st = _walk_structure(c, pivots, floor_key="O" if weekly else "K", seed=seed)
    state, score = _score_timeframe(
        st, c[-1], tc1, tc2, pts, weekly, cfg["invalidated_bars"], len(c),
    )
    scores = _state_scores(pts, weekly)
    state_scores = {
        "base_only" if weekly else "base": scores["base"],
        "a_confirmed": scores["a"], "d1": scores["d1"], "d2_between": scores["d1"],
        "a1_uptrend": scores["complete"], "post_a1_above_d1": scores["complete"],
        "a2_full_uptrend": scores["complete"], "d2_above_a1": scores["complete"],
    }
    return {
        "state": state,
        "score": int(score),
        "stage": st["stage"],
        "pivots": len(pivots),
        "levels": _levels(st, dates),
        "breakdown": _criteria_rows(pts, tc1, tc2, round(dist52w * 100, 1), c[-1],
                                    ma200, state, state_scores),
        "_st": st,
    }


def score_symbol(dates, o, h, l, c, v, cfg) -> dict | None:
    """Daily + weekly + blended trend score for one symbol's daily OHLCV.

    Returns None when MA200 cannot be computed — the base conditions are then
    unevaluable and the weekly hard rule has nothing to gate on, which is absence
    of data rather than a failed test.
    """
    n = len(c)
    ma_n = cfg["ma_period"]
    if n < max(cfg["min_bars"], ma_n):
        return None
    ma200 = sum(c[-ma_n:]) / ma_n
    hi_n = min(cfg["high_52w_bars"], n)
    high52w = max(h[-hi_n:])
    if high52w <= 0 or ma200 <= 0:
        return None
    close = c[-1]
    dist52w = close / high52w - 1
    tc1 = dist52w >= cfg["dist_52w_min"]
    tc2 = close > ma200

    daily = score_timeframe(dates, c, cfg, "daily", tc1, tc2, ma200, dist52w)
    wd, _wo, _wh, _wl, wc, _wv = _to_weekly(dates, o, h, l, c, v)
    weekly = score_timeframe(wd, wc, cfg, "weekly", tc1, tc2, ma200, dist52w)

    w = cfg["weights"]
    blended = daily["score"] * w["daily"] + weekly["score"] * w["weekly"]
    status, action = _verdict(daily["state"])
    return {
        "score": int(round(blended)),
        "daily": daily,
        "weekly": weekly,
        "dir_daily": direction(daily["score"], daily["state"], cfg),
        "dir_weekly": direction(weekly["score"], weekly["state"], cfg),
        "status": status,
        "action": action,
        "grade": _grade(blended, cfg["grades"]),
        "close": round(close),
        "ma200": round(ma200, 1),
        "high52w": round(high52w),
        "dist52w_pct": round(dist52w * 100, 1),
        "date": dates[-1],
    }


# --- chart payload ----------------------------------------------------------

_CHART_CANDLES = 60


def _build_trend_chart(o, h, l, c, st_daily) -> dict | None:
    """Compact OHLC candles + structural markers for the in-cell chart.

    The window starts a little before O (or the last ~130 bars when there is no
    structure) so the whole O→K→A→D1 sequence is visible in 110 pixels. Marker
    indices are remapped onto the aggregated buckets, so a label still sits under
    the candle that produced it.
    """
    n = len(c)
    if n < 5:
        return None
    anchor = None
    for k in ("O", "K"):
        p = st_daily.get(k)
        if p is not None:
            anchor = p[0] if anchor is None else min(anchor, p[0])
    w0 = max(0, (anchor - 15) if anchor is not None else n - 130)
    span = n - w0
    if span < 5:
        w0 = max(0, n - 130)
        span = n - w0

    target = min(_CHART_CANDLES, span)
    oo, hh, ll, cc = [], [], [], []
    for k in range(target):
        a = w0 + k * span // target
        b = max(a + 1, w0 + (k + 1) * span // target)
        oo.append(round(o[a])); hh.append(round(max(h[a:b])))
        ll.append(round(min(l[a:b]))); cc.append(round(c[b - 1]))

    marks = []
    for k in ("O", "K", "A", "D1"):
        p = st_daily.get(k)
        if p is None or p[0] < w0:
            continue
        bucket = min(target - 1, (p[0] - w0) * target // span)
        marks.append({"i": bucket, "k": k, "v": round(p[1])})
    return {"o": oo, "h": hh, "l": ll, "c": cc, "marks": marks}


# --- orchestration / persistence -------------------------------------------

TREND_FIELDS = (
    "trend_score", "trend_score_daily", "trend_score_weekly", "trend_grade",
    "trend_state_daily", "trend_state_weekly", "trend_dir_daily", "trend_dir_weekly",
    "trend_status", "trend_action", "trend_detail", "trend_chart", "trend_date",
)


def _load_ohlcv(client, symbols, cutoff_iso):
    """Paged OHLCV read, keyed by symbol. Deliberately a local copy rather than a
    shared helper: the only other one lives in price_base, which this module
    retires."""
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
                label="trend ohlcv",
            ).data
            for r in rows:
                b = out[r["symbol"]]
                b["d"].append(r["date"])
                b["o"].append(float(r["open"])); b["h"].append(float(r["high"]))
                b["l"].append(float(r["low"])); b["c"].append(float(r["close"]))
                b["v"].append(float(r["volume"] or 0))
            if len(rows) < 1000:
                break
            offset += 1000
    return out


def _payload_for(sym: str, res: dict, chart: dict | None) -> dict:
    d, w = res["daily"], res["weekly"]
    detail = {
        "close": res["close"], "ma200": res["ma200"], "high52w": res["high52w"],
        "dist52w_pct": res["dist52w_pct"],
        "weights": {"daily": 0.60, "weekly": 0.40},
        "daily": {k: d[k] for k in ("state", "score", "stage", "pivots", "levels", "breakdown")},
        "weekly": {k: w[k] for k in ("state", "score", "stage", "pivots", "levels", "breakdown")},
    }
    return {
        "symbol": sym,
        "trend_score": res["score"],
        "trend_score_daily": d["score"],
        "trend_score_weekly": w["score"],
        "trend_grade": res["grade"],
        "trend_state_daily": d["state"],
        "trend_state_weekly": w["state"],
        "trend_dir_daily": res["dir_daily"],
        "trend_dir_weekly": res["dir_weekly"],
        "trend_status": res["status"],
        "trend_action": res["action"],
        "trend_detail": detail,
        "trend_chart": chart,
        "trend_date": res["date"],
    }


def compute_trend_scores(client, dry_run: bool = False, symbols: list[str] | None = None) -> dict:
    """Score the current trend structure for every active symbol. Returns stats."""
    from .common import load_scoring_config
    cfg = load_scoring_config(client, "trend_score", TREND_DEFAULTS)

    active = get_active_symbols(client)
    if symbols:
        want = {s.upper() for s in symbols}
        active = [s for s in active if s in want]
    stats = {
        "active": len(active), "scored": 0, "as_of": None,
        "by_state_daily": {}, "by_state_weekly": {}, "by_grade": {},
        "by_status": {}, "by_action": {}, "skipped_short": 0, "skipped_no_o": 0,
    }
    if not active:
        return stats

    cutoff = (today_vn() - timedelta(days=cfg["window_days"])).isoformat()
    ohlcv = _load_ohlcv(client, active, cutoff)

    payload, as_of = [], None
    for sym in active:
        b = ohlcv.get(sym)
        if not b or len(b["c"]) < cfg["min_bars"]:
            stats["skipped_short"] += 1
            continue
        res = score_symbol(b["d"], b["o"], b["h"], b["l"], b["c"], b["v"], cfg)
        if res is None:
            stats["skipped_short"] += 1
            continue
        if res["daily"]["_st"]["O"] is None and res["daily"]["_st"]["K"] is not None:
            stats["skipped_no_o"] += 1
        chart = _build_trend_chart(b["o"], b["h"], b["l"], b["c"], res["daily"]["_st"])
        payload.append(_payload_for(sym, res, chart))
        d = res["date"]
        as_of = d if as_of is None or d > as_of else as_of
        for k, bucket in (("by_state_daily", res["daily"]["state"]),
                          ("by_state_weekly", res["weekly"]["state"]),
                          ("by_grade", res["grade"]), ("by_action", res["action"]),
                          ("by_status", res["status"] or "—")):
            stats[k][bucket] = stats[k].get(bucket, 0) + 1

    stats["scored"] = len(payload)
    stats["as_of"] = as_of
    if dry_run:
        return stats

    # Zero scores almost always means the OHLCV read failed, not that every
    # symbol simultaneously lost its structure. Bail WITHOUT clearing, so a bad
    # run can never blank the previous snapshot.
    if not payload:
        print("  trend scores: 0 computed — skipping write to preserve prior snapshot.")
        return stats

    # exchange is NOT NULL, and the upsert may have to INSERT.
    exch, off = {}, 0
    while True:
        rows = safe_execute(
            client.table("ta_universe").select("symbol,exchange").range(off, off + 999),
            label="trend exch",
        ).data
        for r in rows:
            exch[r["symbol"]] = r.get("exchange") or "HOSE"
        if len(rows) < 1000:
            break
        off += 1000
    for p in payload:
        p["exchange"] = exch.get(p["symbol"], "HOSE")

    # Write the fresh snapshot FIRST, clear stale rows after. On a mid-run
    # failure safe_execute raises before anything is cleared, so the prior
    # snapshot survives instead of every trend column being left NULL.
    for i in range(0, len(payload), 300):
        safe_execute(
            client.table("ta_universe").upsert(payload[i:i + 300], on_conflict="symbol"),
            label="trend upsert",
        )

    scored = {p["symbol"] for p in payload}
    stale = [s for s in active if s not in scored]
    blank = {f: None for f in TREND_FIELDS}
    for i in range(0, len(stale), 200):
        safe_execute(
            client.table("ta_universe").update(blank).in_("symbol", stale[i:i + 200]),
            label="trend clear",
        )
    return stats


def explain(client, symbol: str) -> dict | None:
    """One symbol's full trend read, for --inspect. Same code path as the batch."""
    from .common import load_scoring_config
    cfg = load_scoring_config(client, "trend_score", TREND_DEFAULTS)
    cutoff = (today_vn() - timedelta(days=cfg["window_days"])).isoformat()
    b = _load_ohlcv(client, [symbol.upper()], cutoff).get(symbol.upper())
    if not b or len(b["c"]) < cfg["min_bars"]:
        return None
    res = score_symbol(b["d"], b["o"], b["h"], b["l"], b["c"], b["v"], cfg)
    if res is None:
        return None
    res["bars"] = len(b["c"])
    res["weeks"] = len(_to_weekly(b["d"], b["o"], b["h"], b["l"], b["c"], b["v"])[0])
    return res
