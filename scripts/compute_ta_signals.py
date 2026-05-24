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

from ta.benchmark import fetch_vnindex_closes
from ta.common import get_supabase_client, safe_execute, today_vn
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


def load_ohlcv(client, symbol: str) -> pd.DataFrame:
    """Load full OHLCV history for a symbol from ta_ohlcv as a date-indexed DataFrame."""
    result = (
        client.table("ta_ohlcv")
        .select("date,open,high,low,close,volume")
        .eq("symbol", symbol)
        .order("date", desc=False)
        .execute()
    )
    if not result.data:
        return pd.DataFrame()

    df = pd.DataFrame(result.data)
    df["date"] = pd.to_datetime(df["date"]).dt.date
    df = df.set_index("date").sort_index()
    # Ensure numeric dtypes
    for col in ("open", "high", "low", "close"):
        df[col] = df[col].astype(float)
    df["volume"] = df["volume"].astype("int64")
    return df


def compute_signals_for_symbol(symbol: str, ohlcv: pd.DataFrame, *, levels=None, trendlines=None, benchmark=None) -> list[dict]:
    """Run every indicator on this symbol's OHLCV and return signal rows.

    `levels` is the symbol's active S/R levels (from ta.sr.detect_levels).
    `trendlines` is the symbol's active trendlines (from ta.trendlines.detect_trendlines).
    `benchmark` is the VN-Index close Series (from ta.benchmark.fetch_vnindex_closes),
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


def upsert_signals(client, rows: list[dict]) -> int:
    """Upsert signal rows in chunks. Returns total rows written.

    Each chunk uses `safe_execute` so transient HTTP/2 stream exhaustion
    (common after thousands of upserts on one connection) survives a retry
    instead of crashing the whole job.
    """
    if not rows:
        return 0
    total = 0
    for i in range(0, len(rows), UPSERT_CHUNK_SIZE):
        chunk = rows[i : i + UPSERT_CHUNK_SIZE]
        safe_execute(
            client.table("ta_signals").upsert(chunk, on_conflict="date,symbol,indicator"),
            label=f"upsert ta_signals chunk[{i // UPSERT_CHUNK_SIZE}]",
        )
        total += len(chunk)
    return total


def start_run(client, trading_date: str) -> int | None:
    """Insert a 'running' row in ta_runs, return its id."""
    res = client.table("ta_runs").insert(
        {
            "trading_date": trading_date,
            "status": "running",
        }
    ).execute()
    return res.data[0]["id"] if res.data else None


def finish_run(client, run_id: int | None, status: str, symbols_n: int, signals_n: int, err: str | None = None):
    if run_id is None:
        return
    client.table("ta_runs").update(
        {
            "finished_at": "now()",
            "status": status,
            "symbols_processed": symbols_n,
            "signals_written": signals_n,
            "error_message": err,
        }
    ).eq("id", run_id).execute()


def inspect_symbol_date(client, symbol: str, target_date: str):
    """Pretty-print all signals for a single symbol+date (debugging helper)."""
    print(f"Loading OHLCV for {symbol}...")
    ohlcv = load_ohlcv(client, symbol)
    if ohlcv.empty:
        print(f"  No OHLCV for {symbol}")
        return

    benchmark = fetch_vnindex_closes()
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
    benchmark = fetch_vnindex_closes()
    if benchmark is None:
        print("Warning: VN-Index benchmark unavailable — relative-strength indicators will be skipped.")

    total_signals = 0
    processed = 0
    start = time.time()

    # Refresh the Supabase client every CLIENT_REFRESH_EVERY symbols so the
    # underlying HTTP/2 connection doesn't run out of stream IDs (~20k limit).
    CLIENT_REFRESH_EVERY = 150

    try:
        for i, symbol in enumerate(symbols, 1):
            if i > 1 and (i - 1) % CLIENT_REFRESH_EVERY == 0:
                client = get_supabase_client()
                print(f"[{i}/{len(symbols)}] (refreshed Supabase client)")

            ohlcv = load_ohlcv(client, symbol)
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
                    client.table("ta_universe").update({"avg_volume_20d": avg_vol_20d}).eq("symbol", symbol).execute()

            rows = compute_signals_for_symbol(symbol, ohlcv, levels=levels, trendlines=lines, benchmark=benchmark)
            rows = filter_dates(rows, since_date, latest_only, ohlcv)
            n_triggered = sum(1 for r in rows if r["triggered"])

            if not args.dry_run:
                upsert_signals(client, rows)

            total_signals += len(rows)
            processed += 1
            print(f"[{i}/{len(symbols)}] {symbol}: {len(rows)} rows ({n_triggered} triggered, {len(levels)} S/R, {len(lines)} TL)")

        elapsed = time.time() - start
        action = "would write" if args.dry_run else "wrote"
        print(f"\n{action.capitalize()} {total_signals:,} signal rows for {processed} symbols in {elapsed:.1f}s.")

        if not args.dry_run:
            finish_run(client, run_id, "success", processed, total_signals)

    except Exception as e:
        if not args.dry_run:
            finish_run(client, run_id, "failed", processed, total_signals, str(e))
        raise


if __name__ == "__main__":
    main()
