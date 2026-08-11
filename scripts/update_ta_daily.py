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
import traceback
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.benchmark import fetch_vnindex_closes
from ta.common import REQUEST_DELAY, get_supabase_client, safe_execute, today_vn
from ta.ohlcv import fetch_today_snapshot, upsert_ohlcv
from ta.rs_rating import compute_rs_ratings
from ta.price_base import compute_price_bases
from ta.ta_score import compute_ta_score
from ta.final_score import compute_final_score
from ta.sr import detect_levels, upsert_levels
from ta.trendlines import detect_trendlines, upsert_trendlines
from ta.universe import get_active_symbols, get_universe_symbols


def log_step_failure(step: str) -> None:
    """Print a step's FULL traceback, then flag it in the Actions summary.

    Was `print(f"... failed (non-fatal): {str(e)[:160]}")`. Two problems that cost
    a whole investigation on 2026-08-07: 160 characters truncates a PostgREST
    APIError before its message/details/hint, and the traceback — which says WHICH
    write raised — was discarded entirely. A step that swallows its exception must
    at least record what it swallowed.
    """
    print(f"  {step} FAILED (non-fatal) — full traceback follows:", flush=True)
    traceback.print_exc()
    write_job_summary(f"\n> **{step} failed** (non-fatal) — see the step log for the traceback.\n")


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
    # COLLECT for every member (Step 1), SCORE only the active ones (Steps 2+,
    # which iterate `symbols`). Step 1 is a single bulk price_board snapshot, so the
    # extra rows cost almost nothing — whereas collecting only the active set
    # makes dormancy unobservable for anything excluded, and
    # `excluded ⇒ no data ⇒ looks dormant ⇒ stays excluded` becomes a loop that
    # no universe re-sync can open. See ta.universe.get_universe_symbols.
    members = get_universe_symbols(client)   # collect prices for these
    symbols = get_active_symbols(client)     # score/scan only these
    if not members:
        print("ta_universe is empty. Run refresh_ta_universe.py first.")
        sys.exit(1)

    today_str = today_vn().isoformat()
    print(f"=== TA daily update for {today_str} ===")
    print(f"Universe: {len(members)} members ({len(symbols)} active)")
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
        print(f"(dry-run) would fetch today's ({today_str}) snapshot for {len(members)} members")
    else:
        t0 = time.time()
        rows, snap_stats = fetch_today_snapshot(members, expected_date=today_str)
        # Chunked upsert keeps payloads well under PostgREST limits.
        for j in range(0, len(rows), 500):
            upsert_ohlcv(client, rows[j:j + 500])
        ohlcv_total = len(rows)
        written_syms = {r["symbol"] for r in rows}
        ohlcv_ok = len(written_syms)
        print(f"OHLCV snapshot: {ohlcv_ok}/{len(members)} members, {ohlcv_total:,} rows in {time.time()-t0:.1f}s "
              f"(no-price today: {snap_stats['skipped_no_price']}, stale skipped: {snap_stats['skipped_stale']})")
        if snap_stats["skipped_stale"]:
            print(f"  NOTE: snapshot trading_date(s) {sorted(snap_stats['stale_dates'])} != {today_str} "
                  f"— likely a non-trading day or close not yet published; those rows were NOT written.")

        # Symbols with no fresh bar today (halted / untraded / stale). Not a
        # hard failure, but surfaced in the summary for visibility.
        # Scoped to ACTIVE symbols: a dormant member legitimately has no bar
        # today, and listing 100+ of them every night would bury a real failure.
        failed_first_pass = [s for s in symbols if s not in written_syms]
        final_failed = failed_first_pass

    # Step 1b: corporate-action adjustment repair. ta_ohlcv is append-only, so a
    # symbol that just went ex-dividend / ex-rights / bonus / split keeps stale
    # unadjusted history and a discontinuity at the ex-date — which corrupts
    # trailing returns and RS. Detect just-adjusted symbols (cheap: last ~15
    # sessions of stored closes + one bulk price_board pass) and re-backfill ONLY
    # those with adjusted history, BEFORE signals/RS so scores use fixed prices.
    # Non-fatal, and capped so a bad detection can't stall the daily run.
    adj_repaired = 0
    MAX_DAILY_REPAIRS = 120
    if not args.dry_run:
        try:
            print("\n--- Step 1b: corporate-action adjustment repair ---")
            from ta.adjustments import detect_adjusted_symbols, record_actions, repair_symbols
            flagged = detect_adjusted_symbols(client, scan_days=15, use_ref=True)
            # Log the events before repairing. Every flagged symbol is recorded,
            # not just the ones inside the repair cap, so the log never silently
            # omits an action just because the day was busy. Non-fatal by design.
            n_act = record_actions(client, [e for f in flagged for e in f.get("events", [])])
            if n_act:
                print(f"  Recorded {n_act} corporate action(s).")
            targets = [f["symbol"] for f in flagged]
            if len(targets) > MAX_DAILY_REPAIRS:
                print(f"  {len(targets)} symbols flagged (> cap {MAX_DAILY_REPAIRS}); "
                      f"re-backfilling the first {MAX_DAILY_REPAIRS}. Run "
                      f"refresh_adjustments.py --scan-days 450 for a full sweep.")
                targets = targets[:MAX_DAILY_REPAIRS]
            if targets:
                for f in flagged[:MAX_DAILY_REPAIRS][:30]:
                    print(f"    {f['symbol']}: {'; '.join(f['reasons'])}")
                res = repair_symbols(client, targets)
                adj_repaired = sum(1 for r in res.values() if r["changed"])
                print(f"  Re-adjusted {adj_repaired} symbol(s) "
                      f"({len(targets) - adj_repaired} genuine gaps, no change).")
                client = get_supabase_client()  # fresh HTTP/2 conn after the fetches
            else:
                print("  No adjustments detected.")
        except Exception as e:  # noqa: BLE001
            log_step_failure("Step 1b adjustment repair")

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
                log_step_failure("Step 3 RS ratings")

        # Step 4: Price bases (BQS V3). Runs after RS (Module 14 reuses the RS
        # Line). Isolated so a failure here doesn't undo the signal run.
        base_stats = {"based": 0, "by_grade": {}, "as_of": None}
        if not args.dry_run:
            try:
                print("\n--- Step 4: price bases (BQS V3) ---")
                base_stats = compute_price_bases(client)
                bg = base_stats["by_grade"]
                print(f"Price bases: {base_stats['based']} detected "
                      f"(A={bg.get('A',0)} B={bg.get('B',0)} C={bg.get('C',0)} D={bg.get('D',0)}).")
            except Exception as e:
                log_step_failure("Step 4 price bases")

        # Step 5: TA Score (weighted blend of RS3M / RS Composite / RS Line /
        # BQS). Runs last because it re-reads the columns the prior steps wrote.
        ta_stats = {"rows": 0, "scored": 0}
        if not args.dry_run:
            try:
                print("\n--- Step 5: TA Score ---")
                ta_stats = compute_ta_score(client)
                print(f"TA Score: scored {ta_stats['scored']}/{ta_stats['rows']} symbols.")
            except Exception as e:
                log_step_failure("Step 5 TA Score")

        # Step 6: Final score (latest TA blended with latest FA). Runs after
        # ta_score; reads the latest FA period's normalized scores.
        final_stats = {"rows": 0, "scored": 0}
        if not args.dry_run:
            try:
                print("\n--- Step 6: Final score ---")
                final_stats = compute_final_score(client)
                print(f"Final score: scored {final_stats['scored']}/{final_stats['rows']} symbols "
                      f"(period {final_stats.get('period')}).")
            except Exception as e:
                log_step_failure("Step 6 Final score")

        # GitHub Actions Job Summary — visible on the run page without opening logs.
        summary_lines = [
            "## TA Daily Update Summary",
            "",
            f"- **Trading date**: {today_str}",
            f"- **Universe**: {len(members)} members, {len(symbols)} active (scored)",
            f"- **OHLCV snapshot**: {ohlcv_ok}/{len(members)} members ({ohlcv_total:,} rows)",
        ]
        summary_lines.append(f"- **Adjustments repaired**: {adj_repaired}")
        summary_lines.append(f"- **Signals written**: {total_signals:,} ({triggered_total} triggered)")
        summary_lines.append(f"- **RS scored**: {rs_stats['scored']} liquid (rs_date {rs_stats['rs_date']})")
        summary_lines.append(f"- **Price bases**: {base_stats['based']} detected")
        summary_lines.append(f"- **TA Score**: {ta_stats['scored']}/{ta_stats['rows']} scored")
        summary_lines.append(f"- **Final score**: {final_stats['scored']}/{final_stats['rows']} scored")
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
