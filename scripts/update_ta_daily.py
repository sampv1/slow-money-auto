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
from ta.common import REQUEST_DELAY, get_supabase_client, safe_execute, today_vn
from ta.ohlcv import fetch_today_snapshot, upsert_ohlcv
from ta.rs_rating import compute_rs_ratings
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
    parser.add_argument("--ohlcv-days", type=int, default=10, help="[legacy] Ignored — the daily path now uses a single price_board snapshot (today only). Use backfill_ta_ohlcv.py to repair multi-day gaps.")
    parser.add_argument("--delay", type=float, default=REQUEST_DELAY, help="[legacy] Ignored by the bulk snapshot path.")
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
    # Bulk snapshot path: vnstock price_board returns today's full OHLCV bar for
    # the whole universe in a few requests (~600 symbols/call). It only ever
    # returns the latest session, so the today-only guard (expected_date) ensures
    # a stale snapshot — run on a holiday or before today's close is published —
    # is never written as a new bar. Multi-day gaps (a fully missed cron) are
    # repaired with `backfill_ta_ohlcv.py`, not here.
    recovered_count = 0
    if args.dry_run:
        print(f"(dry-run) would fetch today's ({today_str}) snapshot for {len(symbols)} symbols")
    else:
        t0 = time.time()
        rows, snap_stats = fetch_today_snapshot(symbols, expected_date=today_str)
        # Chunked upsert keeps payloads well under PostgREST limits.
        for j in range(0, len(rows), 500):
            upsert_ohlcv(client, rows[j:j + 500])
        ohlcv_total = len(rows)
        written_syms = {r["symbol"] for r in rows}
        ohlcv_ok = len(written_syms)
        print(f"OHLCV snapshot: {ohlcv_ok}/{len(symbols)} symbols, {ohlcv_total:,} rows in {time.time()-t0:.1f}s "
              f"(no-price today: {snap_stats['skipped_no_price']}, stale skipped: {snap_stats['skipped_stale']})")
        if snap_stats["skipped_stale"]:
            print(f"  NOTE: snapshot trading_date(s) {sorted(snap_stats['stale_dates'])} != {today_str} "
                  f"— likely a non-trading day or close not yet published; those rows were NOT written.")

        # Symbols with no fresh bar today (halted / untraded / stale). Not a
        # hard failure, but surfaced in the summary for visibility.
        failed_first_pass = [s for s in symbols if s not in written_syms]
        final_failed = failed_first_pass

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
                    safe_execute(
                        client.table("ta_universe").update({"avg_volume_20d": avg_vol_20d}).eq("symbol", symbol),
                        label=f"avg_vol {symbol}",
                    )

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

        # Step 3: RS ratings (cross-sectional). Isolated so a failure here does
        # not undo the already-committed signal run.
        rs_stats = {"liquid": 0, "scored": 0, "rs_date": None}
        if not args.dry_run:
            try:
                print("\n--- Step 3: RS ratings ---")
                rs_stats = compute_rs_ratings(client)
                print(f"RS: scored {rs_stats['scored']}/{rs_stats['liquid']} liquid symbols, "
                      f"{rs_stats.get('rs_lines', 0)} RS lines (rs_date {rs_stats['rs_date']}).")
            except Exception as e:
                print(f"  RS ratings failed (non-fatal): {str(e)[:160]}")

        # GitHub Actions Job Summary — visible on the run page without opening logs.
        summary_lines = [
            "## TA Daily Update Summary",
            "",
            f"- **Trading date**: {today_str}",
            f"- **Universe size**: {len(symbols)}",
            f"- **OHLCV snapshot**: {ohlcv_ok}/{len(symbols)} symbols ({ohlcv_total:,} rows)",
        ]
        summary_lines.append(f"- **Signals written**: {total_signals:,} ({triggered_total} triggered)")
        summary_lines.append(f"- **RS scored**: {rs_stats['scored']} liquid (rs_date {rs_stats['rs_date']})")
        if final_failed:
            shown = ", ".join(final_failed[:25])
            more = f" (+{len(final_failed) - 25} more)" if len(final_failed) > 25 else ""
            summary_lines.append(f"- **No fresh bar today**: {len(final_failed)} — {shown}{more}")
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
