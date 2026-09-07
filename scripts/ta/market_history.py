"""Deep, POINT-IN-TIME market trading value and quarterly ADTV, from 2019.

Built for C18 (securities rubric, V11v2 sheet 47 §A). C18's priority method
regresses each broker's own quarterly metrics against YoY MARKET ADTV GROWTH
over a 12-20 quarter window, so it needs ~16-24 quarters of market ADTV plus a
year of YoY base. `ta/market_series.py` only carries 240 sessions (~4 quarters,
from 2025-09-17): it was built with a 400-day window for C16/C17, which read
5/10/20-session changes and never needed years. Every broker would therefore
fall to C18's 8-quarter exposure proxy and the "priority" method would not run
once.

WHY THIS IS A SEPARATE MODULE AND NOT A DEEPER `market_series.backfill`.
Two reasons, and the second is the load-bearing one:

1. `market_series` computes BREADTH, which costs a pass over the whole universe
   per session. Seven years of that is hours of work to produce a number C18
   does not read.

2. `market_series.refresh/backfill` take their universe from
   `get_active_symbols(client)` — TODAY's active list. Applied to 2019 that is a
   backcast: it silently deletes from history every company that has since
   delisted, which is the textbook survivorship bias and exactly what V11v2's
   AT11 forbids ("Không dùng current universe cho quá khứ"). Changing that
   function's basis is also blocked by AT20, which freezes C16/C17. So the deep
   series is computed here, under its own definition, and the C16/C17 series are
   left untouched.

POINT-IN-TIME MEMBERSHIP COMES FROM THE RECORDS, NOT FROM A LIST.
A symbol is in the market on date T if and only if `ta_ohlcv` holds a bar for it
at T. That is inherently as-of-T — there is no list to be stale, and a company
that delisted in 2021 keeps contributing to every session up to its last trade
and none after. Verified on the live table: of 1,308 symbols trading
2019-01-03, 91 have since been retired and all of them still carry their full
history (ART 2017-08-02..2024-07-25, BCG 2017-10-10..2025-10-08).

WHAT IS EXCLUDED, AND WHY IT IS A TYPE FILTER RATHER THAN A DATE FILTER.
Sheet 47 §A step 1 scopes the series to ordinary shares: no ETFs, funds,
covered warrants or bonds. `ta_universe` cannot supply that — it still holds the
ETF and fund rows admitted by the deprecated `--source fa` era (E1VFVN30,
the FUE*/FUC* families), retired but present. `symbol_profile.com_type_code`
can: QU = quỹ (fund/ETF), against CT/CK/NH/BH for ordinary companies, brokers,
banks and insurers. Measured over the whole window, EVERY symbol carrying a bar
has a non-null com_type_code and the 34 null rows are all index pseudo-symbols,
so the filter has no silent fall-through. Funds present rise 3 (2019) -> 14
(2023) -> 13 (2026).

Using today's `symbol_profile` for that filter is not look-ahead: it answers
"is this ticker a fund", a property of the instrument that does not change with
the as-of date, not "did this ticker exist in 2019", which is answered by the
records. Chart-only pseudo-symbols (VNINDEX, VN30F1M...) are excluded the same
way and for the same reason.

A CARRY-FORWARD BAR CONTRIBUTES NOTHING BY CONSTRUCTION. The `history()`
backfill repeats the last close at volume 0 (49.4% of bars in a 180-day window),
and value is close x volume, so a non-trading day adds 0 without needing the
staleness rule `market_series` has to apply for breadth.

THE RESIDUAL THIS CANNOT CLOSE. A company delisted before `ta_universe` was
first populated has no bars at all, and nothing here can enumerate what the
table never held. So the series is survivorship-free for every name we hold and
silently short by whatever we do not — measured at the boundary: 7 symbols
carried bars on 2019-01-03 that are absent from today's universe. This is
reported by `audit()` rather than asserted away, because AT11's evidence is a
delisted-sample test plus a stated residual, not a completeness claim we have no
data to make.
"""

from __future__ import annotations

import datetime as dt

import pandas as pd

from ta.chart_only import CHART_ONLY_SYMBOLS
from ta.common import paged_select, safe_execute

MODEL_VERSION = "ADTV_BACKFILL_V1"

# 2019 is where the table's breadth begins: 1,301 eligible stocks carry a bar on
# 2019-01-03 against 51 in 2018, because the deep OHLCV backfill reaches ~1,997
# bars for most members and further for a few. Starting in 2018 would splice a
# 51-symbol market onto a 1,300-symbol one and read as a collapse in ADTV.
HISTORY_START = dt.date(2019, 1, 1)

# A Vietnamese quarter holds ~60-63 sessions. 40 tolerates Tet and a short first
# or last quarter while rejecting a partial quarter that would understate ADTV —
# the mean is over sessions, so a half-quarter is not biased, but a quarter with
# a handful of sessions is too thin to regress against.
MIN_SESSIONS_PER_QUARTER = 40

# Ordinary shares, brokers, banks, insurers. QU (quỹ — funds and ETFs) is the
# one code excluded; a symbol with no profile row at all is excluded too, since
# every symbol that carries a bar has one.
STOCK_TYPE_CODES = frozenset({"CT", "CK", "NH", "BH"})

METRIC_VALUE_PIT = "market_trading_value_pit"
METRIC_ADTV_Q = "market_adtv_q"
METRIC_ADTV_Q_YOY = "market_adtv_q_yoy"


def excluded_symbols(client) -> list[str]:
    """Symbols that must not enter the market total: funds/ETFs and indices.

    Returned as an explicit list so the read can filter SERVER-side — the
    alternative is transferring ~2.7M rows and dropping them here.
    """
    funds = {
        r["symbol"]
        for r in paged_select(
            lambda off, lim: client.table("symbol_profile")
            .select("symbol,com_type_code")
            .not_.in_("com_type_code", sorted(STOCK_TYPE_CODES))
            .order("symbol").range(off, off + lim - 1),
            label="market history non-stock",
        )
    }
    return sorted(funds | set(CHART_ONLY_SYMBOLS))


def _month_starts(start: dt.date, end: dt.date):
    """Inclusive month boundaries spanning [start, end]."""
    cur = start.replace(day=1)
    while cur <= end:
        nxt = (cur.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
        yield max(cur, start), min(nxt - dt.timedelta(days=1), end)
        cur = nxt


def load_daily_value(client, start: dt.date, end: dt.date,
                     excluded: list[str], progress: bool = True) -> pd.Series:
    """Total traded value per session: sum(close x volume) over eligible stocks.

    THE READ IS CHUNKED BY MONTH, AND THAT IS NOT A TIDINESS CHOICE.
    PostgREST's `range()` is `OFFSET n LIMIT 1000`, and Postgres reaches offset
    n by scanning and discarding n rows — so a single paged read over this
    window degrades quadratically. Measured on the live table over one year:
    0.25 s at offset 0, 0.32 s at 50k, 0.55 s at 150k, **2.43 s at 300k**, still
    climbing. Over the ~2.7M rows of the full window the tail pages dominate
    everything and the read never finishes in reasonable time — a first attempt
    was killed after 15 minutes having not completed a single YEAR.

    Chunking by month keeps every offset under ~30k, where paging is flat, and
    turns the same work into a linear ~13 minutes. Each month is aggregated
    before the next is fetched, so peak memory is one month, not the window.

    The symbol column is deliberately NOT selected. Eligibility is applied by
    the server through `excluded`, and once a row is known eligible its ticker
    adds nothing to a sum — dropping the column is a third of the payload.

    Ordered (date, symbol) — a total order, as `paged_select` requires; an
    unordered paged read has no stable page boundary and would duplicate rows
    into the sum.
    """
    chunks = list(_month_starts(start, end))
    totals: list[pd.Series] = []
    for i, (lo, hi) in enumerate(chunks, 1):
        rows = paged_select(
            lambda off, lim, lo=lo, hi=hi: (
                client.table("ta_ohlcv").select("date,close,volume")
                .gte("date", lo.isoformat()).lte("date", hi.isoformat())
                .not_.in_("symbol", excluded)
                .order("date").order("symbol")
                .range(off, off + lim - 1)
            ),
            label=f"market history ohlcv {lo:%Y-%m}",
        )
        if rows:
            df = pd.DataFrame(rows)
            df["date"] = pd.to_datetime(df["date"])
            df["value"] = (df["close"].astype("float64")
                           * df["volume"].astype("float64"))
            totals.append(df.groupby("date")["value"].sum())
        if progress and (i % 12 == 0 or i == len(chunks)):
            print(f"  [{i}/{len(chunks)}] loaded through {hi}", flush=True)
    if not totals:
        return pd.Series(dtype="float64")
    return pd.concat(totals).sort_index()


def to_quarterly(daily: pd.Series,
                 min_sessions: int = MIN_SESSIONS_PER_QUARTER) -> pd.DataFrame:
    """Quarterly ADTV = mean daily traded value, plus its YoY growth.

    Indexed by quarter label ('2019-Q1'), carrying `adtv`, `sessions`,
    `last_session` and `yoy`. A quarter under `min_sessions` is kept in the
    frame but its adtv is None, so the caller can SEE that the quarter was
    rejected rather than find it silently absent.

    YoY is against q-4 BY LABEL, never by position: positional lag would pair
    a quarter with whatever sat four rows back, which after a rejected quarter
    is the wrong year. Both sides must be present and the base positive.
    """
    if daily.empty:
        return pd.DataFrame()
    idx = pd.DatetimeIndex(daily.index)
    labels = [f"{d.year}-Q{(d.month - 1) // 3 + 1}" for d in idx]
    g = pd.DataFrame({"value": daily.to_numpy(), "quarter": labels}, index=idx)
    out = g.groupby("quarter").agg(
        adtv=("value", "mean"),
        sessions=("value", "size"),
    )
    out["last_session"] = g.groupby("quarter").apply(
        lambda x: x.index.max(), include_groups=False)
    out.loc[out["sessions"] < min_sessions, "adtv"] = None

    # THE CURRENT, UNFINISHED QUARTER IS NOT A QUARTER, and writing it makes the
    # series depend on when the job happened to run. Observed on the first full
    # backfill: a smoke test on 2026-09-04 stored 2026-Q3 at 45 sessions, the
    # full run on 2026-09-07 stored it again at 46, and macro_series is keyed
    # (metric, date) — so the same logical quarter sat in the series twice, at
    # whichever dates a human had invoked the tool. A reproducible series cannot
    # be a function of that.
    #
    # It was also comparing like with unlike: a part-quarter mean against a full
    # year-ago quarter read -57.9% for 2026-Q3, where the last COMPLETE quarter
    # reads +0.1%. The mean is per-session so a partial quarter is not biased in
    # principle, but it is far noisier, and C5 applies this one number to every
    # broker at once. The last completed quarter is the honest observable.
    last = idx.max()
    open_quarter = f"{last.year}-Q{(last.month - 1) // 3 + 1}"
    out = out.drop(index=open_quarter, errors="ignore")
    out = out.sort_index()

    def _prev(label: str) -> str:
        y, q = int(label[:4]), int(label[-1])
        return f"{y - 1}-Q{q}"

    yoy = {}
    for label, row in out.iterrows():
        base = out["adtv"].get(_prev(label))
        cur = row["adtv"]
        yoy[label] = (
            float(cur / base - 1)
            if cur is not None and base is not None and base > 0 and pd.notna(base)
            and pd.notna(cur) else None
        )
    out["yoy"] = pd.Series(yoy)
    return out


def build_rows(daily: pd.Series, quarterly: pd.DataFrame) -> list[dict]:
    """macro_series rows for the daily PIT series and the quarterly aggregates.

    A quarterly point is dated at the quarter's LAST TRADED SESSION, not at the
    calendar quarter end, so the date is one the market actually had and no row
    is stamped on a holiday.
    """
    # The column is `meta`, not `metadata`, and macro_series rows also carry
    # `source` and `unit` — matched to what ta/market_series.py writes so the
    # deep series and the C16/C17 series read back the same shape.
    meta = {"model_version": MODEL_VERSION, "universe_code": "eligible_equity",
            "point_in_time": True}
    common = {"source": "ta_ohlcv"}
    rows = [
        {**common, "metric": METRIC_VALUE_PIT, "date": d.date().isoformat(),
         "value": float(v), "unit": "VND", "meta": meta}
        for d, v in daily.items()
    ]
    for label, r in quarterly.iterrows():
        if r["adtv"] is None or pd.isna(r["adtv"]):
            continue
        date = pd.Timestamp(r["last_session"]).date().isoformat()
        qmeta = {**meta, "quarter": label, "sessions": int(r["sessions"])}
        rows.append({**common, "metric": METRIC_ADTV_Q, "date": date,
                     "value": float(r["adtv"]), "unit": "VND", "meta": qmeta})
        if r["yoy"] is not None and pd.notna(r["yoy"]):
            rows.append({**common, "metric": METRIC_ADTV_Q_YOY, "date": date,
                         "value": float(r["yoy"]), "unit": "ratio", "meta": qmeta})
    return rows


def audit(client, daily: pd.Series, excluded: list[str]) -> dict:
    """Evidence for AT10/AT11 — scope, span, and the survivorship residual.

    `orphan_2019` is the count of tickers that traded on the first session of
    the window but are absent from today's `ta_universe`: the visible edge of
    the names the table may not hold at all. It is REPORTED, never corrected —
    see the module docstring.
    """
    if daily.empty:
        return {"sessions": 0}
    first = daily.index.min()
    universe = {
        r["symbol"] for r in paged_select(
            lambda off, lim: client.table("ta_universe").select("symbol")
            .order("symbol").range(off, off + lim - 1),
            label="market history universe")
    }
    day1 = {
        r["symbol"] for r in paged_select(
            lambda off, lim: client.table("ta_ohlcv").select("symbol")
            .eq("date", first.date().isoformat())
            .not_.in_("symbol", excluded)
            .order("symbol").range(off, off + lim - 1),
            label="market history day1")
    }
    return {
        "sessions": int(len(daily)),
        "first": first.date().isoformat(),
        "last": daily.index.max().date().isoformat(),
        "excluded_symbols": len(excluded),
        "stocks_first_session": len(day1),
        "orphan_first_session": len(day1 - universe),
    }


def backfill(client, start: dt.date = HISTORY_START,
             end: dt.date | None = None, min_quarters: int = 20,
             dry_run: bool = False, status=None) -> dict:
    """Compute and store the deep PIT series. Returns stats for the caller."""
    end = end or dt.date.today()
    excluded = excluded_symbols(client)
    print(f"Excluding {len(excluded)} non-stock symbols (funds/ETFs + indices)")
    daily = load_daily_value(client, start, end, excluded)
    if daily.empty:
        if status:
            status.fail("Market ADTV backfill", f"no OHLCV in {start}..{end}")
        return {"sessions": 0, "quarters": 0, "rows": 0}

    quarterly = to_quarterly(daily)
    scored = quarterly[quarterly["adtv"].notna()]
    with_yoy = quarterly[quarterly["yoy"].notna()]
    info = audit(client, daily, excluded)
    rows = build_rows(daily, quarterly)

    print(f"Sessions {info['sessions']:,} ({info['first']} .. {info['last']}); "
          f"{len(scored)} quarters with ADTV, {len(with_yoy)} with YoY")
    print(f"  first session carried {info['stocks_first_session']:,} eligible "
          f"stocks; {info['orphan_first_session']} absent from ta_universe "
          f"(survivorship residual, reported not corrected)")
    thin = quarterly[quarterly["adtv"].isna()]
    if len(thin):
        print(f"  {len(thin)} quarter(s) below {MIN_SESSIONS_PER_QUARTER} "
              f"sessions, not stored: {list(thin.index)}")

    if dry_run:
        return {"sessions": info["sessions"], "quarters": len(scored),
                "yoy_quarters": len(with_yoy), "rows": len(rows), "audit": info}

    for j in range(0, len(rows), 500):
        safe_execute(
            client.table("macro_series").upsert(rows[j:j + 500],
                                                on_conflict="metric,date"),
            label=f"market history write [{j // 500}]",
        )
    print(f"Wrote {len(rows):,} macro_series rows.")
    if status:
        status.require("Market ADTV quarters", len(with_yoy),
                       minimum=min_quarters, unit="quarters",
                       detail="with a YoY base, needed by C18")
    return {"sessions": info["sessions"], "quarters": len(scored),
            "yoy_quarters": len(with_yoy), "rows": len(rows), "audit": info}
