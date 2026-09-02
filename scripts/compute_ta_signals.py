#!/usr/bin/env python3
"""
compute_ta_signals.py — Compute TA signals for symbols in the universe.

Reads OHLCV from ta_ohlcv, runs each indicator over the full history,
and upserts rows into ta_signals.

Usage:
  # Compute signals for the latest available date, for the full universe:
  python3 compute_ta_signals.py

  # Compute signals for ALL dates we have OHLCV for (backfill):
  python3 compute_ta_signals.py --all-dates

  # Compute signals from a specific date onward:
  python3 compute_ta_signals.py --since 2026-04-01

  # Limit to specific symbols:
  python3 compute_ta_signals.py --symbols FPT HPG VCB --all-dates

  # Dry run — compute and report counts but don't write:
  python3 compute_ta_signals.py --dry-run

  # Show signals for a single symbol+date (debugging):
  python3 compute_ta_signals.py --inspect FPT 2026-05-20
"""

import argparse
import inspect
import math
import sys
import time
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd

from ta.benchmark import get_vnindex_closes
from ta.common import PAGE_SIZE, get_supabase_client, paged_select, safe_execute, today_vn
from ta.registry import INDICATOR_SPECS, all_keys
from ta.sr import detect_levels, upsert_levels
from ta.trendlines import detect_trendlines, upsert_trendlines
from ta.universe import get_active_symbols

UPSERT_CHUNK_SIZE = 500


def _compute_kwargs_for(fn, *, levels, trendlines, benchmark) -> dict:
    """Build the kwargs an indicator wants. Avoids touching the indicators
    whose compute(df) signature doesn't take extra args."""
    try:
        params = inspect.signature(fn).parameters
    except (TypeError, ValueError):
        return {}
    extra = {}
    if "levels" in params:
        extra["levels"] = levels
    if "trendlines" in params:
        extra["trendlines"] = trendlines
    if "benchmark" in params:
        extra["benchmark"] = benchmark
    return extra


# Bars the daily pass loads per symbol. It writes ONLY the newest date's
# signals, so everything before that is warmup — the depth the indicators need
# to be correct today, nothing more.
#
# The deepest requirement is 252 bars (YEAR_WINDOW, the 52-week breakouts) plus
# MA200_SLOPE_LOOKBACK = 21 on a 200-bar average, so ~253. 600 is ~2.2x that.
#
# It matters because `detect_levels` has NO window of its own — it clusters
# whatever series it is handed — so this bound, not the table's depth, is what
# decides how far back S/R looks. Today that decision is made by accident:
# ta_ohlcv holds a median of 595 bars per symbol but a maximum of 907, so
# symbols currently get materially different amounts of S/R history for no
# reason other than when their backfill ran. A fixed window makes it uniform.
#
# 600 is NOT a no-op — 672 of 1,564 symbols hold more than that. Measured on 40
# random symbols (17 of them deeper than 600): ZERO trigger flips, values
# differing only at 2e-15 (bb_squeeze, float noise) to 7e-7 (mcdx_banker_*,
# whose EMAs are IIR and never fully forget), and ONE symbol whose S/R set moved
# (POT, 634 bars). That is the price, and it is paid once, now — versus 1000+,
# which would be a true no-op today only to impose a much larger S/R change on
# every symbol the day a full backfill lands.
#
# Measured at 300 bars, for contrast: S/R sets move on 87% of symbols and
# triggered state on 21%, to save 16 minutes a night. And measured unbounded
# against a full-history table (~3,280 bars average): ~7.6 s/symbol, i.e. a ~4 h
# nightly pass inside a 6 h GitHub Actions ceiling, to produce exactly the same
# ~8,600 stored rows.
DAILY_WARMUP_BARS = 600


def load_ohlcv(client, symbol: str, max_bars: int | None = None) -> pd.DataFrame:
    """Load OHLCV history for a symbol from ta_ohlcv as a date-indexed DataFrame.

    `max_bars` keeps only the most recent N bars — a trailing window, re-read
    each run. Pass it on the DAILY path, where only the newest date is written.
    Leave it None for `--since` / `--all-dates`, which compute PAST dates and
    therefore need the bars that preceded them.

    PAGED, and it has to be. This read has no date bound by design — every
    indicator computes over the whole series — so it grows with the symbol's
    history, and PostgREST silently caps an unbounded select at 1000 rows.
    Ordered ASC, the rows it drops are the NEWEST: past 1000 bars this would
    have gone on returning a clean-looking DataFrame that stopped before the
    present, computing today's signals from years-old data with no error
    anywhere. Nothing warns you. The deepest symbol currently holds ~604 bars,
    so the cap has not bitten yet — it would have arrived silently with the
    first deeper OHLCV backfill.

    (symbol, date) is ta_ohlcv's primary key, so ordering by date under a
    single-symbol filter is the total order that offset paging requires.
    """
    if max_bars is None:
        data = paged_select(
            lambda off, lim: (
                client.table("ta_ohlcv")
                .select("date,open,high,low,close,volume")
                .eq("symbol", symbol)
                .order("date", desc=False)
                .range(off, off + lim - 1)
            ),
            label=f"ohlcv load {symbol}",
        )
    else:
        # Bounded read: ask the DATABASE for the newest max_bars rows rather
        # than paging the whole series and slicing in pandas. Same result, but
        # the work scales with the WINDOW instead of the symbol's history —
        # otherwise a full-history table would still cost 4 requests and ~3,280
        # rows per symbol every night to keep 600 of them, and the bound would
        # cap only the compute, not the read.
        #
        # (symbol, date) is the primary key, so descending under a single-symbol
        # filter is the same total order as ascending, just reversed.
        data = []
        offset = 0
        while len(data) < max_bars:
            lim = min(PAGE_SIZE, max_bars - len(data))
            rows = safe_execute(
                client.table("ta_ohlcv")
                .select("date,open,high,low,close,volume")
                .eq("symbol", symbol)
                .order("date", desc=True)
                .range(offset, offset + lim - 1),
                label=f"ohlcv load {symbol}",
            ).data or []
            data.extend(rows)
            if len(rows) < lim:
                break
            offset += lim
        data.reverse()  # back to ascending, which everything downstream assumes

    if not data:
        return pd.DataFrame()

    df = pd.DataFrame(data)
    df["date"] = pd.to_datetime(df["date"]).dt.date
    df = df.set_index("date").sort_index()
    # Belt and braces: the bounded read above already returns at most max_bars,
    # but sort_index is what actually guarantees the window is the NEWEST bars
    # rather than whatever order the pages arrived in.
    if max_bars is not None and len(df) > max_bars:
        df = df.iloc[-max_bars:]
    # Ensure numeric dtypes
    for col in ("open", "high", "low", "close"):
        df[col] = df[col].astype(float)
    df["volume"] = df["volume"].astype("int64")
    return df


def compute_signals_for_symbol(symbol: str, ohlcv: pd.DataFrame, *, levels=None, trendlines=None, benchmark=None) -> list[dict]:
    """Run every indicator on this symbol's OHLCV and return signal rows.

    `levels` is the symbol's active S/R levels (from ta.sr.detect_levels).
    `trendlines` is the symbol's active trendlines (from ta.trendlines.detect_trendlines).
    `benchmark` is the VN-Index close Series (from ta.benchmark.get_vnindex_closes),
    consumed by relative-strength indicators only.

    Returns rows shaped for ta_signals: {date, symbol, indicator, triggered, value, metadata}.
    Dates where an indicator returns NaN value (insufficient history) are skipped.
    """
    if ohlcv.empty:
        return []

    rows: list[dict] = []
    for spec in INDICATOR_SPECS:
        try:
            kwargs = _compute_kwargs_for(spec.compute, levels=levels, trendlines=trendlines, benchmark=benchmark)
            result = spec.compute(ohlcv, **kwargs)
        except Exception as e:
            print(f"    {symbol} / {spec.key} failed: {e}")
            continue

        for date_idx, r in result.iterrows():
            triggered = bool(r.get("triggered", False))
            value = r.get("value")
            # Skip rows where value is NaN AND not triggered — no useful signal,
            # avoids polluting the DB with empty rows for early indicators that
            # don't have enough lookback yet (e.g., MA200).
            if (value is None or (isinstance(value, float) and math.isnan(value))) and not triggered:
                continue

            metadata = r.get("metadata") if "metadata" in result.columns else None

            rows.append(
                {
                    "date": date_idx.isoformat() if hasattr(date_idx, "isoformat") else str(date_idx),
                    "symbol": symbol,
                    "indicator": spec.key,
                    "triggered": triggered,
                    "value": None if (value is None or (isinstance(value, float) and math.isnan(value))) else float(value),
                    "metadata": metadata if isinstance(metadata, dict) else None,
                }
            )
    return rows


def filter_dates(rows: list[dict], since: date | None, latest_only: bool, ohlcv: pd.DataFrame) -> list[dict]:
    """Restrict signal rows to a date range."""
    if not rows:
        return rows
    if latest_only:
        latest = ohlcv.index.max().isoformat()
        return [r for r in rows if r["date"] == latest]
    if since is not None:
        since_str = since.isoformat()
        return [r for r in rows if r["date"] >= since_str]
    return rows


def write_signals(client, rows: list[dict]) -> int:
    """Persist a symbol's signal rows, storing ONLY the triggered ones.

    Untriggered rows — an indicator that ran and answered "no" — are computed
    and then dropped. Every reader filters `triggered = true`: the TA Scanner's
    two date-scoped reads and the Analysis chart's marker read. Nothing has ever
    asked which symbols did NOT fire, so the ~82% of rows answering "no" were an
    unread archive growing ~1.4 GB a year. The underlying value stays
    recomputable from ta_ohlcv, which is the actual source of record.

    DELETE-THEN-INSERT, not a bare upsert, and that is the whole safety of it.
    The upsert this replaces kept history honest by OVERWRITING a stale
    `triggered = true` with the `false` that a recomputation produced. Once the
    false rows are no longer written, that repair silently disappears: a re-run
    (`--since`, `--all-dates`, or a resweep after refresh_adjustments.py
    re-backfills a corporate action and changes what those bars trigger) would
    leave the old true row standing forever — a signal the scanner still lists
    and the chart still marks, for a bar that no longer produces it.

    The cleared span comes from `rows` BEFORE the triggered filter, because a
    symbol-date whose signals all turned false must still clear its old rows,
    and by then it has nothing left to name the date with. On the daily path the
    span is one fresh date, so the delete matches nothing and costs one indexed
    lookup on (symbol, date).

    The insert stays an upsert so a `safe_execute` retry after a partially
    applied chunk is idempotent rather than a primary-key violation.
    """
    if not rows:
        return 0

    by_symbol: dict[str, list[dict]] = {}
    for r in rows:
        by_symbol.setdefault(r["symbol"], []).append(r)

    total = 0
    for symbol, srows in by_symbol.items():
        dates = [r["date"] for r in srows]
        lo, hi = min(dates), max(dates)
        safe_execute(
            client.table("ta_signals").delete()
            .eq("symbol", symbol).gte("date", lo).lte("date", hi),
            label=f"clear ta_signals {symbol} {lo}..{hi}",
        )
        keep = [r for r in srows if r["triggered"]]
        for i in range(0, len(keep), UPSERT_CHUNK_SIZE):
            chunk = keep[i : i + UPSERT_CHUNK_SIZE]
            safe_execute(
                client.table("ta_signals").upsert(chunk, on_conflict="date,symbol,indicator"),
                label=f"write ta_signals {symbol} chunk[{i // UPSERT_CHUNK_SIZE}]",
            )
        total += len(keep)
    return total


def start_run(client, trading_date: str) -> int | None:
    """Insert a 'running' row in ta_runs, return its id."""
    res = safe_execute(
        client.table("ta_runs").insert(
            {
                "trading_date": trading_date,
                "status": "running",
            }
        ),
        label="ta_runs start",
    )
    return res.data[0]["id"] if res.data else None


def finish_run(client, run_id: int | None, status: str, symbols_n: int, signals_n: int,
               err: str | None = None, trading_date: str | None = None):
    """Close out a ta_runs row, correcting trading_date to what was WRITTEN.

    start_run has to stamp something before any signal is computed, so it uses
    the wall clock. That is only right when the run happens to be computing
    today's bar. It was wrong twice over:

      * a backfill (`--since` / `--all-dates`) writes older dates entirely;
      * any run after midnight VN stamps a date the market has not traded yet.

    Both mint a ta_runs row for a date with NO signals — and the TA Scanner
    builds its date dropdown from ta_runs (deliberately, to avoid scanning the
    multi-million-row ta_signals table), defaulting to the newest. On
    2026-08-19 a 01:03 backfill produced exactly that: a `success` run stamped
    2026-08-19, zero signals for it, and a scanner showing no symbols at all.

    So the run records the LATEST date it actually wrote.
    """
    if run_id is None:
        return
    payload = {
        "finished_at": "now()",
        "status": status,
        "symbols_processed": symbols_n,
        "signals_written": signals_n,
        "error_message": err,
    }
    if trading_date:
        payload["trading_date"] = trading_date
    safe_execute(
        client.table("ta_runs").update(payload).eq("id", run_id),
        label="ta_runs finish",
    )


def inspect_symbol_date(client, symbol: str, target_date: str):
    """Pretty-print all signals for a single symbol+date (debugging helper)."""
    print(f"Loading OHLCV for {symbol}...")
    # Same trailing window the daily pass uses, so inspecting the latest date
    # reproduces exactly what was stored rather than a near-miss. A date older
    # than the window falls back to the full series — this is a debugging tool,
    # and answering the question matters more than matching the pipeline for a
    # date the pipeline is no longer computing.
    ohlcv = load_ohlcv(client, symbol, max_bars=DAILY_WARMUP_BARS)
    if not ohlcv.empty and target_date < ohlcv.index.min().isoformat():
        print(f"  {target_date} predates the {DAILY_WARMUP_BARS}-bar window "
              f"(starts {ohlcv.index.min()}) — reloading full history.")
        ohlcv = load_ohlcv(client, symbol)
    if ohlcv.empty:
        print(f"  No OHLCV for {symbol}")
        return

    benchmark = get_vnindex_closes(client)
    levels = detect_levels(ohlcv)
    lines = detect_trendlines(ohlcv)
    print(f"  {len(ohlcv)} bars, range {ohlcv.index.min()} → {ohlcv.index.max()}")
    if levels:
        sup = [lvl for lvl in levels if lvl["level_type"] == "support"]
        res = [lvl for lvl in levels if lvl["level_type"] == "resistance"]
        print(f"  S/R levels: {len(sup)} support, {len(res)} resistance")
        for lvl in sup + res:
            print(f"    {lvl['level_type']:11s} @ {lvl['price']:>10,.0f}  touches={lvl['touches']}  strength={lvl['strength']:.2f}")
    else:
        print(f"  No S/R levels detected")
    if lines:
        up = [ln for ln in lines if ln["trend_type"] == "uptrend"]
        dn = [ln for ln in lines if ln["trend_type"] == "downtrend"]
        print(f"  Trendlines: {len(up)} uptrend, {len(dn)} downtrend")
        for ln in up + dn:
            print(f"    {ln['trend_type']:9s}  {ln['start_date']} {ln['start_price']:,.0f} → {ln['end_date']} {ln['end_price']:,.0f}  slope={ln['slope']:+.2f}/bar  touches={ln['touches']}")
    else:
        print(f"  No trendlines detected")

    print(f"\nSignals at {target_date}:")
    print(f"  {'Key':<28} {'Triggered':<10} {'Value':>14}")
    print("  " + "─" * 56)

    for spec in INDICATOR_SPECS:
        try:
            kwargs = _compute_kwargs_for(spec.compute, levels=levels, trendlines=lines, benchmark=benchmark)
            result = spec.compute(ohlcv, **kwargs)
        except Exception as e:
            print(f"  {spec.key:<28} ERROR: {e}")
            continue

        target = pd.to_datetime(target_date).date()
        if target not in result.index:
            print(f"  {spec.key:<28} {'—':<10} {'(no row)':>14}")
            continue

        r = result.loc[target]
        triggered = bool(r.get("triggered", False))
        val = r.get("value")
        val_str = f"{float(val):>14,.3f}" if val is not None and not (isinstance(val, float) and math.isnan(val)) else f"{'NaN':>14}"
        flag = "✓ YES" if triggered else "  no"
        print(f"  {spec.key:<28} {flag:<10} {val_str}")


def main():
    parser = argparse.ArgumentParser(description="Compute TA signals into ta_signals")
    parser.add_argument("--symbols", nargs="+", help="Limit to these symbols (default: full active universe)")
    parser.add_argument("--all-dates", action="store_true", help="Compute signals for every date with OHLCV data")
    parser.add_argument("--since", help="Compute signals from this date onward (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true", help="Compute and count but don't write")
    parser.add_argument("--inspect", nargs=2, metavar=("SYMBOL", "DATE"),
                        help="Show all signals for a single symbol+date and exit")
    args = parser.parse_args()

    client = get_supabase_client()

    if args.inspect:
        inspect_symbol_date(client, args.inspect[0].upper(), args.inspect[1])
        return

    # Resolve symbols
    if args.symbols:
        symbols = [s.upper() for s in args.symbols]
        print(f"Computing for {len(symbols)} explicit symbols.")
    else:
        symbols = get_active_symbols(client)
        if not symbols:
            print("ta_universe is empty. Run refresh_ta_universe.py first.")
            sys.exit(1)
        print(f"Computing for {len(symbols)} active universe symbols.")

    # Resolve date scope
    latest_only = not args.all_dates and not args.since
    # Backfills compute PAST dates and need the bars before them, so they read
    # everything; the daily path only ever writes the newest date.
    warmup = DAILY_WARMUP_BARS if latest_only else None
    since_date = date.fromisoformat(args.since) if args.since else None
    if latest_only:
        print("Date scope: latest available date only.")
    elif since_date:
        print(f"Date scope: from {since_date} onward.")
    else:
        print("Date scope: all available dates (full backfill).")

    print(f"Indicators ({len(INDICATOR_SPECS)}): {', '.join(all_keys())}\n")

    run_id = None
    trading_date_str = today_vn().isoformat()
    if not args.dry_run:
        run_id = start_run(client, trading_date_str)

    # VN-Index benchmark for relative-strength indicators. Fetched once;
    # passed into every symbol's compute pass. If the fetch fails (e.g.,
    # vnstock outage), RS indicators silently return False — the rest of the
    # pipeline still runs.
    benchmark = get_vnindex_closes(client)
    if benchmark is None:
        print("::warning:: VN-Index benchmark unavailable from vnstock AND macro_series "
              "— relative-strength indicators will be skipped for this run.")

    total_signals = 0
    total_evaluated = 0
    processed = 0
    max_written_date: str | None = None
    start = time.time()

    # Refresh the Supabase client every CLIENT_REFRESH_EVERY symbols so the
    # underlying HTTP/2 connection doesn't run out of stream IDs (~20k limit).
    CLIENT_REFRESH_EVERY = 150

    try:
        for i, symbol in enumerate(symbols, 1):
            if i > 1 and (i - 1) % CLIENT_REFRESH_EVERY == 0:
                client = get_supabase_client()
                print(f"[{i}/{len(symbols)}] (refreshed Supabase client)")

            ohlcv = load_ohlcv(client, symbol, max_bars=warmup)
            if ohlcv.empty:
                print(f"[{i}/{len(symbols)}] {symbol} — no OHLCV, skipping")
                continue

            # Phase 2a/2b: detect S/R levels + trendlines per symbol, persist
            # snapshots, then pass them to the level/line-aware indicators.
            levels = detect_levels(ohlcv)
            lines = detect_trendlines(ohlcv)
            avg_vol_20d = int(ohlcv["volume"].tail(20).mean()) if len(ohlcv) >= 20 else None
            if not args.dry_run:
                upsert_levels(client, symbol, levels)
                upsert_trendlines(client, symbol, lines)
                if avg_vol_20d is not None:
                    safe_execute(
                        client.table("ta_universe").update({"avg_volume_20d": avg_vol_20d}).eq("symbol", symbol),
                        label=f"avg_vol {symbol}",
                    )

            rows = compute_signals_for_symbol(symbol, ohlcv, levels=levels, trendlines=lines, benchmark=benchmark)
            rows = filter_dates(rows, since_date, latest_only, ohlcv)
            n_triggered = sum(1 for r in rows if r["triggered"])
            if rows:
                d = max(r["date"] for r in rows)
                max_written_date = d if max_written_date is None else max(max_written_date, d)

            if not args.dry_run:
                write_signals(client, rows)

            # Count what is STORED, not what was evaluated — total_signals feeds
            # ta_runs.signals_written and the caller's floor gate.
            total_signals += n_triggered
            total_evaluated += len(rows)
            processed += 1
            print(f"[{i}/{len(symbols)}] {symbol}: {n_triggered} triggered of {len(rows)} evaluated, {len(levels)} S/R, {len(lines)} TL")

        elapsed = time.time() - start
        action = "would write" if args.dry_run else "wrote"
        print(f"\n{action.capitalize()} {total_signals:,} triggered signal rows "
              f"({total_evaluated:,} evaluated) for {processed} symbols in {elapsed:.1f}s.")

        if not args.dry_run:
            finish_run(client, run_id, "success", processed, total_signals,
                       trading_date=max_written_date)
            if max_written_date and max_written_date != trading_date_str:
                print(f"  ta_runs trading_date corrected {trading_date_str} -> "
                      f"{max_written_date} (the newest date actually written).")

    except Exception as e:
        if not args.dry_run:
            finish_run(client, run_id, "failed", processed, total_signals, str(e))
        raise


if __name__ == "__main__":
    main()
