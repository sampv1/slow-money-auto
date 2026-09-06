"""Market-wide daily series: trading value, ADTV momentum, breadth.

Feeds the securities rubric's Cycle block — C16 (ADTV momentum, 8 pts) and C17
(breadth, 5 pts) — and is useful on its own as a market dashboard. FCI, the
third Cycle input, is written by `refresh_macro.py`; these two are computed here
because they derive from `ta_ohlcv`, which the daily TA pass has just written.

WHY THESE 13 POINTS ARE NOT OPTIONAL. The securities validity gate publishes a
symbol only at >= 70% data coverage. With market share (C4+C5, 7) pending, the
ATTC ratio absent from the provider (C9, 4) and C18 N/A until its backtest
locks, the ceiling without these two is 69% — one point short, sector-wide. No
broker would publish at all. Measured 2026-09-05.

THE BREADTH CONVENTION IS THE WHOLE DESIGN (BREADTH_V7_20OBS).
MA20 is the mean of a symbol's own last 20 VALID closes, not a 20-row window on
the market calendar. The difference is not cosmetic: a market-calendar window is
voided by a single NaN, so every symbol that skipped one session drops out
entirely, and the denominator collapses from 1,180 to 539 — it silently measures
only the most liquid half of the market and calls it "breadth".

A per-symbol window alone would then keep a dormant UPCOM line in the
denominator forever on a price from months ago, so a symbol is dropped once it
has not traded for more than MAX_STALE_SESSIONS market sessions.

Every exclusion is COUNTED, and the counts must sum back to the universe. That
reconciliation is the test that the denominator means what it says: measured on
2026-09-04, 937 traded + 243 fresh-but-idle + 135 too-short + 116 stale + 0
invalid = 1,431 = the active universe, denominator 1,180, breadth 40.1%.

A CARRY-FORWARD BAR IS NOT A TRADE, and the two paths that write `ta_ohlcv`
disagree about it. The daily `price_board` snapshot only returns symbols that
actually traded — on 2026-09-04 all 961 rows carried volume > 0. The
`history()` backfill fills every session, repeating the last price at volume 0,
and 49.4% of the bars in a 180-day window are those. So "has a close" is not
"traded": staleness is measured from the last bar with VOLUME > 0, while the
mean still averages valid closes, because a carried price is genuinely the
symbol's price even on a day nobody traded it.

INVALID_PRICE exists because `ta_ohlcv` is a MIXTURE, not an adjusted series.
The deep backfill re-states history from back-adjusted `history()`, but the
nightly append is raw and Step 1b repairs only what a detector flags — so an
unrepaired corporate action leaves a step change that would snap a 20-bar mean.
The test runs between CONSECUTIVE TRADED bars only. Comparing across a
carry-forward stretch measures the gap, not a move: it flagged 119 symbols
(8.3%), overwhelmingly thin UPCOM lines printing an unchanged price for weeks
and then trading once.
"""

from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

from ta.common import paged_select, safe_execute

MODEL_VERSION = "BREADTH_V7_20OBS"

# Sheet 21 parameters. Both are versioned WITH the convention: changing either
# changes what "breadth" means, so C17's bands must be recalibrated, never
# carried over. That is why they are named here rather than inlined.
MA_OBS = 20
MAX_STALE_SESSIONS = 5

# Daily price limits by exchange, plus a buffer. A move beyond this is not a
# trade — it is an unadjusted corporate action, or a listing/resumption print.
# UPCOM is the default because an unknown exchange should be the loosest test:
# the tighter the band, the more real moves get called invalid.
EXCHANGE_BAND = {"HOSE": 0.07, "HNX": 0.10, "UPCOM": 0.15}
DEFAULT_BAND = 0.15
BAND_BUFFER = 0.03

METRIC_TRADING_VALUE = "market_trading_value"
METRIC_ADTV_5 = "market_adtv_5"
METRIC_ADTV_20 = "market_adtv_20"
METRIC_ADTV_MOMENTUM = "market_adtv_momentum"
METRIC_BREADTH = "market_breadth_ma20"
METRIC_BREADTH_CHG_5D = "breadth_change_5d"
METRIC_BREADTH_CHG_10D = "breadth_change_10d"

# Sessions of history to load. 20 valid observations per symbol is the binding
# requirement, and a thinly traded symbol needs far more calendar days than
# sessions to reach it.
#
# THE DAILY AND BACKFILL PATHS MUST LOAD THE SAME WINDOW. They did not at first
# — 180 days daily against 400 in the backfill — and the same session came out
# with two different denominators (1,107 against 1,132 for 2026-09-04), because
# a shorter window leaves thin symbols short of 20 observations. Breadth would
# then depend on WHICH JOB last wrote it, and C17's bands are calibrated against
# the denominator. One constant, used by both.
LOAD_DAYS = 400


def _band_for(exchange: str | None) -> float:
    return EXCHANGE_BAND.get(exchange or "", DEFAULT_BAND) + BAND_BUFFER


def load_prices(client, symbols: list[str], start: dt.date) -> pd.DataFrame:
    """Close + volume for `symbols` from `start`, as a long DataFrame.

    Ordered on (symbol, date) — the primary key — because an unordered paged
    read has no stable page boundary and returns duplicate rows, which then
    makes `pivot` raise on a duplicate index rather than fail quietly.
    """
    rows = paged_select(
        lambda off, lim: (
            client.table("ta_ohlcv")
            .select("symbol,date,close,volume")
            .gte("date", start.isoformat())
            .order("symbol").order("date")
            .range(off, off + lim - 1)
        ),
        label="market series ohlcv",
    )
    keep = set(symbols)
    df = pd.DataFrame([r for r in rows if r["symbol"] in keep])
    if df.empty:
        return df
    df = df.drop_duplicates(["symbol", "date"])
    df["date"] = pd.to_datetime(df["date"])
    return df


def compute(df: pd.DataFrame, universe: list[str], exchanges: dict[str, str],
            target: "pd.Timestamp | None" = None) -> dict:
    """Compute every series for `target` (default: the newest session in `df`).

    Returns {"as_of": date, "trading_value", "adtv_5", "adtv_20", "momentum",
             "breadth", "breadth_change_5d", "breadth_change_10d", "audit": {...}}
    with any value None when its inputs are short — never 0, which would read as
    a real measurement of an absent thing.
    """
    if df.empty:
        return {}

    close = df.pivot(index="date", columns="symbol", values="close")
    volume = df.pivot(index="date", columns="symbol", values="volume").fillna(0)
    sessions = list(close.index)
    if len(sessions) < 2:
        return {}

    # --- ADTV. Traded value is close x volume summed over whatever traded that
    # session; a symbol that did not trade contributes nothing, which is correct
    # and needs no eligibility rule of its own.
    traded_value = (close * volume).sum(axis=1, min_count=1)
    adtv5 = traded_value.rolling(5).mean()
    adtv20 = traded_value.rolling(20).mean()

    # --- Breadth, per session, symbol by symbol.
    breadth = {}
    audit_by_date = {}
    session_no = {d: i for i, d in enumerate(sessions)}
    # Precompute each symbol's valid closes once; the per-date loop then slices.
    valid = {}
    for sym in universe:
        if sym not in close.columns:
            continue
        s = close[sym]
        s = s[s.notna() & (s > 0)]
        if s.empty:
            continue
        traded = s.index[volume[sym].reindex(s.index).fillna(0) > 0]
        valid[sym] = (s, traded, _band_for(exchanges.get(sym)))

    # Only the sessions the output actually needs: T, and the T-5 / T-10 the
    # change series are measured against. Breadth costs a pass over the whole
    # universe per date, so evaluating all 123 loaded sessions would spend ~40x
    # the work to produce three numbers.
    t_index = len(sessions) - 1 if target is None else session_no.get(target)
    if t_index is None:
        return {}
    wanted = [sessions[i] for i in
              dict.fromkeys(i for i in (t_index, t_index - 5, t_index - 10) if i >= 0)]
    for target in wanted:
        t_no = session_no[target]
        counts = dict(universe_count=len(universe), symbols_with_close_today=0,
                      no_trade_today_but_eligible=0, insufficient_history_count=0,
                      stale_excluded_count=0, invalid_price_count=0)
        num = den = 0
        for sym in universe:
            entry = valid.get(sym)
            if entry is None:
                counts["insufficient_history_count"] += 1
                continue
            s, traded, band = entry
            s = s[s.index <= target]
            traded_upto = traded[traded <= target]
            if s.empty or len(traded_upto) == 0 or len(s) < MA_OBS:
                counts["insufficient_history_count"] += 1
                continue
            # Sessions since the symbol last actually TRADED, not since it last
            # carried a price forward.
            if t_no - session_no[traded_upto[-1]] > MAX_STALE_SESSIONS:
                counts["stale_excluded_count"] += 1
                continue

            window = s.iloc[-MA_OBS:]
            # The break only matters if it is INSIDE the bars being averaged.
            # An older unrepaired action does not touch this mean, and excluding
            # for it knocked out 113 symbols (8%) — mostly thin UPCOM lines whose
            # last discontinuity was 20+ sessions back. Repairing history is
            # Step 1b's job (`ta/adjustments.py`); this only refuses to average
            # across a step change that is demonstrably in the window.
            wt = window.index[window.index.isin(traded_upto)]
            if len(wt) >= 2 and (window.loc[wt].pct_change().abs() > band).any():
                counts["invalid_price_count"] += 1
                continue

            den += 1
            stale0 = session_no[traded_upto[-1]] == t_no
            counts["symbols_with_close_today" if stale0 else "no_trade_today_but_eligible"] += 1
            if window.iloc[-1] > window.mean():
                num += 1
        counts["numerator"] = num
        counts["denominator"] = den
        breadth[target] = (num / den) if den else None
        audit_by_date[target] = counts

    t = sessions[t_index]

    def _chg(lag: int):
        i = t_index - lag
        if i < 0:
            return None
        prior = breadth.get(sessions[i])
        if prior is None or breadth.get(t) is None:
            return None
        return breadth[t] - prior

    def _f(x):
        return None if x is None or (isinstance(x, float) and np.isnan(x)) else float(x)

    mom = None
    if _f(adtv20.loc[t]) and adtv20.loc[t] > 0:
        mom = float(adtv5.loc[t] / adtv20.loc[t] - 1)
    # `sessions_loaded` reports the frame, not the window, so a backfill row can
    # be told apart from a short live run when auditing later.

    return {
        "as_of": t.date(),
        "trading_value": _f(traded_value.loc[t]),
        "adtv_5": _f(adtv5.loc[t]),
        "adtv_20": _f(adtv20.loc[t]),
        "momentum": mom,
        "breadth": _f(breadth[t]),
        "breadth_change_5d": _f(_chg(5)),
        "breadth_change_10d": _f(_chg(10)),
        "audit": audit_by_date[t],
        "sessions_loaded": len(sessions),
    }


def build_rows(result: dict) -> list[dict]:
    """Shape one session's result into macro_series rows.

    The audit counts ride on EVERY breadth row, not just a summary somewhere,
    because the denominator is what C17's bands are calibrated against — a score
    read back later without knowing the denominator that produced it cannot be
    audited or replayed.
    """
    if not result:
        return []
    d = result["as_of"].isoformat()
    a = result["audit"]
    common = {"date": d, "source": "ta_ohlcv"}
    base_meta = {"universe_code": "eligible_equity", "convention": MODEL_VERSION}
    breadth_meta = {**base_meta, **a, "ma_obs": MA_OBS, "max_stale_sessions": MAX_STALE_SESSIONS}
    rows = [
        {**common, "metric": METRIC_TRADING_VALUE, "value": result["trading_value"],
         "unit": "VND", "meta": {**base_meta, "eligible_count": a["denominator"]}},
        {**common, "metric": METRIC_ADTV_5, "value": result["adtv_5"],
         "unit": "VND", "meta": {**base_meta, "window_count": 5}},
        {**common, "metric": METRIC_ADTV_20, "value": result["adtv_20"],
         "unit": "VND", "meta": {**base_meta, "window_count": 20}},
        {**common, "metric": METRIC_ADTV_MOMENTUM, "value": result["momentum"],
         "unit": "ratio", "meta": {**base_meta, "adtv5": result["adtv_5"], "adtv20": result["adtv_20"]}},
        {**common, "metric": METRIC_BREADTH, "value": result["breadth"],
         "unit": "ratio", "meta": breadth_meta},
        {**common, "metric": METRIC_BREADTH_CHG_5D, "value": result["breadth_change_5d"],
         "unit": "ratio", "meta": base_meta},
        {**common, "metric": METRIC_BREADTH_CHG_10D, "value": result["breadth_change_10d"],
         "unit": "ratio", "meta": base_meta},
    ]
    # A missing value is left OUT rather than written as null: macro readers
    # treat a stored row as an observation, and "we could not measure it" is not
    # an observation of zero breadth.
    return [r for r in rows if r["value"] is not None]


def reconciles(audit: dict) -> bool:
    """Do the exclusion groups account for every symbol in the universe?

    The one check that proves the denominator means what it claims. If a symbol
    can vanish without being counted somewhere, breadth is measured over an
    unknown population and its bands are meaningless.
    """
    parts = ("symbols_with_close_today", "no_trade_today_but_eligible",
             "insufficient_history_count", "stale_excluded_count", "invalid_price_count")
    return sum(audit[k] for k in parts) == audit["universe_count"]


def refresh(client, status=None) -> dict:
    """Compute and store the market-wide series for the latest stored session.

    BEST-EFFORT by design, like Step 1c. A missing breadth reading costs the
    securities rubric 13 of its 100 points through the normal N/A path — the
    coverage gate is what decides whether that is publishable — so it must never
    take down the TA run that produced the bars it reads.

    The reconciliation check is the gate that matters: if the exclusion groups
    do not account for every symbol, the denominator is measured over an unknown
    population and the rows are NOT written. A wrong breadth is worse than none,
    because C17's bands are calibrated against this exact denominator.
    """
    from ta.universe import get_active_symbols

    universe = sorted(get_active_symbols(client))
    if not universe:
        if status:
            status.warn("Market series", "ta_universe has no active symbols")
        return {}

    exchanges = {
        r["symbol"]: r.get("exchange")
        for r in paged_select(
            lambda off, lim: client.table("symbol_profile").select("symbol,exchange").range(off, off + lim - 1),
            label="market series exchanges",
        )
    }
    start = dt.date.today() - dt.timedelta(days=LOAD_DAYS)
    df = load_prices(client, universe, start)
    result = compute(df, universe, exchanges)
    if not result:
        if status:
            status.warn("Market series", f"no usable OHLCV since {start}")
        return {}

    audit = result["audit"]
    if not reconciles(audit):
        parts = sum(audit[k] for k in ("symbols_with_close_today", "no_trade_today_but_eligible",
                                       "insufficient_history_count", "stale_excluded_count",
                                       "invalid_price_count"))
        if status:
            status.fail("Market series",
                        f"exclusion groups sum to {parts} but the universe holds "
                        f"{audit['universe_count']} — a symbol left the denominator "
                        f"uncounted, so breadth is over an unknown population. Nothing written.")
        return result

    rows = build_rows(result)
    for j in range(0, len(rows), 500):
        safe_execute(
            client.table("macro_series").upsert(rows[j:j + 500], on_conflict="metric,date"),
            label=f"macro_series market rows [{j // 500}]",
        )

    print(f"Market series {result['as_of']}: trading value "
          f"{(result['trading_value'] or 0) / 1e9:,.0f} tỷ, ADTV momentum "
          f"{(result['momentum'] or 0) * 100:+.1f}%, breadth "
          f"{(result['breadth'] or 0) * 100:.1f}% "
          f"({audit['numerator']}/{audit['denominator']}); excluded "
          f"{audit['insufficient_history_count']} short, {audit['stale_excluded_count']} stale, "
          f"{audit['invalid_price_count']} invalid-price.")

    if status:
        # Breadth over a collapsed denominator is the failure this convention
        # exists to prevent, so the floor is on the DENOMINATOR, not the row
        # count: seven rows write happily from a denominator of 12.
        status.expect("Market series breadth", audit["denominator"], minimum=int(len(universe) * 0.5),
                      unit="symbols", detail=f"eligible of {len(universe)} tracked, "
                                             f"breadth {(result['breadth'] or 0) * 100:.1f}%")
    return result


def backfill(client, days: int = LOAD_DAYS, min_sessions: int = 30, status=None) -> int:
    """Recompute and store every session available in one loaded price frame.

    C17 reads breadth CHANGES over 5 and 10 sessions, and the securities score is
    written per day for a forward-return backtest — neither works from a single
    stored point, so history has to exist before the rubric means anything.

    Loading once and walking the frame is the whole point: the read is ~127k
    rows and 35 s, while the per-session compute is ~2 s, so a year of history
    costs one load rather than 250 of them.
    """
    from ta.universe import get_active_symbols

    universe = sorted(get_active_symbols(client))
    exchanges = {
        r["symbol"]: r.get("exchange")
        for r in paged_select(
            lambda off, lim: client.table("symbol_profile").select("symbol,exchange").range(off, off + lim - 1),
            label="backfill exchanges",
        )
    }
    start = dt.date.today() - dt.timedelta(days=days)
    df = load_prices(client, universe, start)
    if df.empty:
        if status:
            status.warn("Market series backfill", f"no OHLCV since {start}")
        return 0

    sessions = sorted(df["date"].unique())
    # The first MA_OBS sessions cannot carry a 20-observation mean for anyone,
    # and the next 10 have no comparable to change against. Writing them would
    # store a breadth measured over a denominator that is still filling up.
    usable = sessions[MA_OBS + 10:]
    print(f"Backfilling {len(usable)} sessions of {len(sessions)} loaded "
          f"({str(usable[0])[:10]} .. {str(usable[-1])[:10]}) over {len(universe)} symbols")

    rows: list[dict] = []
    skipped = 0
    for i, target in enumerate(usable, 1):
        result = compute(df, universe, exchanges, target=target)
        if not result or not reconciles(result["audit"]):
            skipped += 1
            continue
        rows.extend(build_rows(result))
        if i % 25 == 0 or i == len(usable):
            print(f"  [{i}/{len(usable)}] {str(target)[:10]} "
                  f"breadth {(result['breadth'] or 0) * 100:5.1f}% "
                  f"({result['audit']['numerator']}/{result['audit']['denominator']})")

    for j in range(0, len(rows), 500):
        safe_execute(
            client.table("macro_series").upsert(rows[j:j + 500], on_conflict="metric,date"),
            label=f"macro_series backfill [{j // 500}]",
        )
    print(f"Wrote {len(rows):,} rows for {len(usable) - skipped} sessions "
          f"({skipped} skipped on reconciliation).")
    if status:
        status.require("Market series backfill", len(usable) - skipped,
                       minimum=max(1, min_sessions), unit="sessions")
    return len(rows)
