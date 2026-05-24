#!/usr/bin/env python3
"""
update_ta_daily.py — Daily incremental TA update.

Designed to run from the GitHub Actions cron (`.github/workflows/ta-daily.yml`)
after VN market close. Does two things in sequence:

1. Fetches the last few days of OHLCV for each active symbol and upserts
   into ta_ohlcv. The short window (default 5 days) captures today's bar
   plus a small buffer for late corrections and bridges weekends/holidays.
2. Recomputes TA signals for the latest available date across all symbols
   and upserts into ta_signals. Also writes a row into ta_runs.

Usage:
  # Daily incremental run (the cron's default):
  python3 update_ta_daily.py

  # Override the OHLCV lookback window (useful after a multi-day outage):
  python3 update_ta_daily.py --ohlcv-days 10

  # Dry-run (no writes):
  python3 update_ta_daily.py --dry-run
"""

import argparse
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.benchmark import fetch_vnindex_closes
from ta.common import REQUEST_DELAY, get_supabase_client, today_vn
from ta.ohlcv import backfill_symbols
from ta.sr import detect_levels, upsert_levels
from ta.trendlines import detect_trendlines, upsert_trendlines
from ta.universe import get_active_symbols


def write_job_summary(text: str) -> None:
    """Append markdown text to the GitHub Actions Job Summary if running in CI."""
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    try:
        with open(summary_path, "a", encoding="utf-8") as f:
            f.write(text)
    except Exception as e:
        print(f"  (could not write job summary: {e})")

# Re-use the orchestrator's helpers so we don't duplicate logic
from compute_ta_signals import (  # noqa: E402
    compute_signals_for_symbol,
    filter_dates,
    finish_run,
    load_ohlcv,
    start_run,
    upsert_signals,
)


def main():
    parser = argparse.ArgumentParser(description="Daily incremental TA update (OHLCV + signals)")
    parser.add_argument("--ohlcv-days", type=int, default=10, help="OHLCV lookback days (default 10 — provides self-healing if a previous day failed)")
    parser.add_argument("--delay", type=float, default=REQUEST_DELAY, help=f"vnstock request delay (default {REQUEST_DELAY}s)")
    parser.add_argument("--dry-run", action="store_true", help="Compute and report, don't write to DB")
    args = parser.parse_args()

    client = get_supabase_client()
    symbols = get_active_symbols(client)
    if not symbols:
        print("ta_universe is empty. Run refresh_ta_universe.py first.")
        sys.exit(1)

    today_str = today_vn().isoformat()
    print(f"=== TA daily update for {today_str} ===")
    print(f"Active universe: {len(symbols)} symbols")
    print(f"OHLCV lookback: {args.ohlcv_days} days")
    print()

    # Step 1: incremental OHLCV
    print(f"--- Step 1: incremental OHLCV fetch ---")
    ohlcv_ok = 0
    ohlcv_total = 0
    failed_first_pass: list[str] = []
    final_failed: list[str] = []
    recovered_count = 0
    if args.dry_run:
        print(f"(dry-run) would fetch {args.ohlcv_days} days for {len(symbols)} symbols")
    else:
        t0 = time.time()
        results = backfill_symbols(client, symbols, days=args.ohlcv_days, delay=args.delay)
        ohlcv_total = sum(results.values())
        ohlcv_ok = sum(1 for n in results.values() if n > 0)
        first_pass_elapsed = time.time() - t0
        print(f"OHLCV pass 1: {ohlcv_ok}/{len(symbols)} symbols ok, {ohlcv_total:,} rows in {first_pass_elapsed:.1f}s")

        failed_first_pass = [s for s, n in results.items() if n == 0]
        if failed_first_pass:
            # Reconciliation pass — re-fetch failed symbols with a longer per-
            # request delay so vnstock's rate-limit window has time to recover
            # from whatever caused the first-pass failures.
            recon_delay = max(args.delay * 2.0, 8.0)
            print(f"\n--- Step 1b: reconciliation for {len(failed_first_pass)} failed symbols (delay {recon_delay:.1f}s) ---")
            t1 = time.time()
            recon_results = backfill_symbols(client, failed_first_pass, days=args.ohlcv_days, delay=recon_delay)
            for s, n in recon_results.items():
                if n > 0:
                    results[s] = n
                    recovered_count += 1
            ohlcv_total = sum(results.values())
            ohlcv_ok = sum(1 for n in results.values() if n > 0)
            print(f"Reconciliation: recovered {recovered_count}/{len(failed_first_pass)} in {time.time()-t1:.1f}s")

        final_failed = [s for s, n in results.items() if n == 0]
        if final_failed:
            print(f"Still failed after reconciliation ({len(final_failed)}): {', '.join(final_failed)}")
        else:
            print(f"All {len(symbols)} symbols ok after pass 1 + reconciliation.")

    # Step 2: compute signals (latest date only) and log to ta_runs
    print(f"\n--- Step 2: compute signals (latest date) ---")
    run_id = None
    if not args.dry_run:
        run_id = start_run(client, today_str)

    # VN-Index benchmark for relative-strength indicators. One-off fetch per
    # run; passed into each symbol's compute pass. If the fetch fails, RS
    # indicators silently return False but the rest of the pipeline continues.
    benchmark = fetch_vnindex_closes()
    if benchmark is None:
        print("Warning: VN-Index benchmark unavailable — RS indicators will be skipped.")

    total_signals = 0
    triggered_total = 0
    processed = 0
    t0 = time.time()

    # Refresh the Supabase client every CLIENT_REFRESH_EVERY symbols so the
    # underlying HTTP/2 connection doesn't run out of stream IDs (~20k limit).
    CLIENT_REFRESH_EVERY = 150

    try:
        for i, symbol in enumerate(symbols, 1):
            if i > 1 and (i - 1) % CLIENT_REFRESH_EVERY == 0:
                client = get_supabase_client()
                print(f"  [{i}/{len(symbols)}] (refreshed Supabase client)")

            ohlcv = load_ohlcv(client, symbol)
            if ohlcv.empty:
                print(f"  [{i}/{len(symbols)}] {symbol} — no OHLCV, skipping")
                continue

            # Phase 2a/2b: refresh S/R levels + trendlines snapshots, then
            # reuse the in-memory lists for the level/line-aware indicators.
            levels = detect_levels(ohlcv)
            lines = detect_trendlines(ohlcv)
            avg_vol_20d = int(ohlcv["volume"].tail(20).mean()) if len(ohlcv) >= 20 else None
            if not args.dry_run:
                upsert_levels(client, symbol, levels)
                upsert_trendlines(client, symbol, lines)
                if avg_vol_20d is not None:
                    client.table("ta_universe").update({"avg_volume_20d": avg_vol_20d}).eq("symbol", symbol).execute()

            rows = compute_signals_for_symbol(symbol, ohlcv, levels=levels, trendlines=lines, benchmark=benchmark)
            rows = filter_dates(rows, since=None, latest_only=True, ohlcv=ohlcv)
            n_triggered = sum(1 for r in rows if r["triggered"])
            triggered_total += n_triggered

            if not args.dry_run:
                upsert_signals(client, rows)

            total_signals += len(rows)
            processed += 1

        elapsed = time.time() - t0
        action = "would write" if args.dry_run else "wrote"
        print(f"Signals: {action} {total_signals:,} rows for {processed} symbols "
              f"({triggered_total} triggered) in {elapsed:.1f}s")

        if not args.dry_run:
            finish_run(client, run_id, "success", processed, total_signals)

        # GitHub Actions Job Summary — visible on the run page without opening logs.
        summary_lines = [
            "## TA Daily Update Summary",
            "",
            f"- **Trading date**: {today_str}",
            f"- **Universe size**: {len(symbols)}",
            f"- **OHLCV pass 1**: {len(symbols) - len(failed_first_pass)}/{len(symbols)} ok",
        ]
        if failed_first_pass:
            summary_lines.append(f"- **Reconciliation recovered**: {recovered_count}/{len(failed_first_pass)}")
        summary_lines.append(f"- **OHLCV final**: {ohlcv_ok}/{len(symbols)} ok ({ohlcv_total:,} rows)")
        summary_lines.append(f"- **Signals written**: {total_signals:,} ({triggered_total} triggered)")
        if final_failed:
            shown = ", ".join(final_failed[:25])
            more = f" (+{len(final_failed) - 25} more)" if len(final_failed) > 25 else ""
            summary_lines.append(f"- **Still failed**: {shown}{more}")
        summary_lines.append("")
        write_job_summary("\n".join(summary_lines))

        print(f"\n=== TA daily update done ===")

    except Exception as e:
        if not args.dry_run:
            finish_run(client, run_id, "failed", processed, total_signals, str(e))
        print(f"\n!!! FAILED: {e}", file=sys.stderr)
        raise


if __name__ == "__main__":
    main()
