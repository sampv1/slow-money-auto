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
import sys
import time
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.benchmark import get_vnindex_closes
from ta.run_status import RunStatus, write_job_summary

# Fraction of tracked members that must receive a bar before Step 1 counts as a
# real collection. See the Step 1 gate for why a bare "> 0" is not enough.
MIN_SNAPSHOT_FRACTION = 0.25
from ta.common import REQUEST_DELAY, get_supabase_client, safe_execute, today_vn
from ta.ohlcv import fetch_today_snapshot, upsert_ohlcv
from ta.rs_rating import compute_rs_ratings
from ta.trend_score import compute_trend_scores
from ta.ta_score import compute_ta_score
from ta.final_score import compute_final_score
from ta.profile import fetch_profiles, upsert_profiles
from ta.sr import detect_levels, upsert_levels
from ta.trendlines import detect_trendlines, upsert_trendlines
from ta.universe import get_active_symbols, get_universe_symbols


# Statuses whose position is still live, so its stored prices still decide money.
# Mirrors update_prices.ACTIVE_STATUSES; kept local so this module does not import
# a recommendation-tracking script just for two strings.
OPEN_REC_STATUSES = ("OPEN", "TP1_HIT")


def open_position_symbols(client) -> list[str]:
    """Symbols carrying a live recommendation.

    These get the adjustment repair unconditionally, not only when a detector
    flags them, because BOTH detectors have a blind spot that a real position
    already fell into. `find_gap` needs a day-over-day move beyond the exchange
    band (UPCOM: 15% + 3% buffer) and the reference check is disabled on UPCOM
    entirely, since its reference is a session average rather than the prior
    close. AIG's 15% bonus (ex 2026-08-04) moved the price -13.0% on UPCOM and so
    was invisible to both; its history stayed unadjusted until a hand-run repair.

    `repair_symbols` re-fetches and upserts only when the fresh series actually
    disagrees with ours, so a symbol that is already correct costs one history()
    call and writes nothing. Non-fatal: a failure here just means no extra
    targets, which is the behaviour this replaces.
    """
    try:
        rows = safe_execute(
            client.table("recommendations").select("symbol")
            .in_("status", list(OPEN_REC_STATUSES)),
            label="open recommendation symbols",
        ).data
    except Exception as e:  # noqa: BLE001
        print(f"  open-position symbols unavailable ({str(e)[:80]}) — flagged symbols only")
        return []
    return sorted({r["symbol"] for r in rows if r.get("symbol")})


def log_step_failure(status: RunStatus, step: str, critical: bool = True) -> None:
    """Record a swallowed exception against the run, with its FULL traceback.

    Swallowing stays deliberate — one broken step must not stop the others from
    running. What changed on 2026-08-19 is that swallowing no longer makes the
    RUN green: a critical step records a failure, and the process exits 1.

    The traceback matters as much as the exit code. This was once
    `print(f"... failed (non-fatal): {str(e)[:160]}")`, and 160 characters
    truncates a PostgREST APIError before its message/details/hint — which cost
    a whole investigation on 2026-08-07.
    """
    exc = sys.exc_info()[1]
    if critical:
        status.fail(step, exc=exc)
    else:
        print(f"  [WARN] {step} — full traceback follows:", flush=True)
        traceback.print_exc()
        status.warn(step, f"{type(exc).__name__}: {exc}" if exc else "failed")



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
    st = RunStatus(f"TA daily update {today_str}")

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

        # THE gate this whole pipeline was missing. "No exception raised" is not
        # evidence that bars were collected: on 2026-08-18 every price_board
        # chunk failed, 0 rows were written, and the run still went green.
        #
        # The two ways this legitimately writes nothing are told apart by
        # failed_chunks (see fetch_today_snapshot):
        #   provider outage — nothing came back at all           => CRITICAL
        #   holiday / close not published — rows came back but
        #   the staleness guard rejected them                    => warning
        if snap_stats["failed_chunks"]:
            st.fail("Step 1 OHLCV snapshot",
                    f"{snap_stats['failed_chunks']}/{snap_stats['chunks']} price_board "
                    f"chunks failed; wrote {ohlcv_total:,} rows for {ohlcv_ok}/{len(members)} "
                    f"members. The provider, not the market, is the problem.")
        elif snap_stats["returned"] and not ohlcv_total and snap_stats["skipped_stale"]:
            st.warn("Step 1 OHLCV snapshot",
                    f"no fresh bar for {today_str} — the snapshot carried "
                    f"{sorted(snap_stats['stale_dates'])}, i.e. a non-trading day or a "
                    f"close not yet published. Nothing written, by design.")
        else:
            # A PROPORTIONAL floor, because minimum=1 would have passed the
            # 2026-08-17 run that wrote 29 bars of the ~890 a normal session
            # produces. That run reported success too.
            #
            # A typical day prices ~60-68% of members (many are dormant UPCOM
            # lines that rarely trade), so 25% leaves wide room for a genuinely
            # thin session or a wave of halts while still catching a collection
            # that mostly failed. Below the floor the run goes red and the
            # backup cron re-runs it — which is the outcome we want, since
            # price_board is cheap and a partial day corrupts every percentile.
            floor = max(1, int(len(members) * MIN_SNAPSHOT_FRACTION))
            st.require("Step 1 OHLCV snapshot", ohlcv_ok, minimum=floor, unit="members",
                       detail=f"of {len(members)} tracked, {ohlcv_total:,} bars")

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
            # Open positions FIRST so the cap below can never drop one: they are
            # a handful of symbols, and they are the ones where an unrepaired
            # adjustment closes a trade rather than skewing a percentile.
            held = open_position_symbols(client)
            if held:
                print(f"  + {len(held)} symbol(s) with an open position, checked unconditionally")
            targets = list(dict.fromkeys(held + [f["symbol"] for f in flagged]))
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
            log_step_failure(st, "Step 1b adjustment repair", critical=False)

    # Step 2: compute signals (latest date only) and log to ta_runs
    print(f"\n--- Step 2: compute signals (latest date) ---")
    run_id = None
    if not args.dry_run:
        run_id = start_run(client, today_str)

    # VN-Index benchmark for relative-strength indicators. One-off fetch per
    # run; passed into each symbol's compute pass. If the fetch fails, RS
    # indicators silently return False but the rest of the pipeline continues.
    benchmark = get_vnindex_closes(client)
    if benchmark is None:
        print("::warning:: VN-Index benchmark unavailable from vnstock AND macro_series "
              "— RS indicators will be skipped for this run.")

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
        # Signals are computed from stored OHLCV, so this failing means the DB
        # read or the write failed — not the market.
        st.require("Step 2 signals", total_signals, minimum=1, unit="rows",
                   detail=f"{processed} symbols, {triggered_total} triggered")

        # Step 3: RS ratings (cross-sectional). Isolated so a failure here does
        # not undo the already-committed signal run.
        rs_stats = {"liquid": 0, "scored": 0, "rs_date": None}
        if not args.dry_run:
            try:
                print("\n--- Step 3: RS ratings ---")
                rs_stats = compute_rs_ratings(client)
                print(f"RS: scored {rs_stats['scored']}/{rs_stats['liquid']} liquid symbols, "
                      f"{rs_stats.get('rs_lines', 0)} RS lines (rs_date {rs_stats['rs_date']}).")
                st.require("Step 3 RS ratings", rs_stats["scored"], minimum=1,
                           unit="symbols", detail=f"rs_date {rs_stats['rs_date']}")
                # RS Line is a 20% component of TA Score and its own column on
                # Signal Pro; losing it for the whole universe is not a detail.
                st.expect("Step 3 RS Line", rs_stats.get("rs_lines", 0), minimum=1,
                          unit="symbols", detail="benchmark ratio series")
            except Exception as e:
                log_step_failure(st, "Step 3 RS ratings")

        # Step 4: Trend Score (daily + weekly structure). Replaced the BQS
        # price-base pass in migration 051. Isolated so a failure here doesn't
        # undo the signal run.
        trend_stats = {"scored": 0, "by_grade": {}, "by_action": {}, "as_of": None}
        if not args.dry_run:
            try:
                print("\n--- Step 4: trend score (daily + weekly) ---")
                trend_stats = compute_trend_scores(client)
                tg, ta_ = trend_stats["by_grade"], trend_stats["by_action"]
                print(f"Trend: scored {trend_stats['scored']} "
                      f"(A+={tg.get('A+',0)} A={tg.get('A',0)} B={tg.get('B',0)} "
                      f"C={tg.get('C',0)} D={tg.get('D',0)}; "
                      f"buy_watch={ta_.get('buy_watch',0)}), as_of {trend_stats['as_of']}.")
                st.require("Step 4 trend score", trend_stats["scored"], minimum=1,
                           unit="symbols", detail=f"as_of {trend_stats['as_of']}")
            except Exception as e:
                log_step_failure(st, "Step 4 trend score")

        # Step 5: TA Score (weighted blend of RS3M / RS Composite / RS Line /
        # Trend). Runs last because it re-reads the columns the prior steps wrote.
        ta_stats = {"rows": 0, "scored": 0}
        if not args.dry_run:
            try:
                print("\n--- Step 5: TA Score ---")
                ta_stats = compute_ta_score(client)
                print(f"TA Score: scored {ta_stats['scored']}/{ta_stats['rows']} symbols.")
                st.require("Step 5 TA Score", ta_stats["scored"], minimum=1,
                           unit="symbols", detail=f"of {ta_stats['rows']} rows")
            except Exception as e:
                log_step_failure(st, "Step 5 TA Score")

        # Step 6: Final score (latest TA blended with latest FA). Runs after
        # ta_score; reads the latest FA period's normalized scores.
        final_stats = {"rows": 0, "scored": 0}
        if not args.dry_run:
            try:
                print("\n--- Step 6: Final score ---")
                final_stats = compute_final_score(client)
                print(f"Final score: scored {final_stats['scored']}/{final_stats['rows']} symbols "
                      f"(period {final_stats.get('period')}).")
                st.require("Step 6 Final score", final_stats["scored"], minimum=1,
                           unit="symbols", detail=f"period {final_stats.get('period')}")
            except Exception as e:
                log_step_failure(st, "Step 6 Final score")

        # Step 7: company names + ICB sectors. Reference data, so it runs LAST
        # and nothing above depends on it — a failure here must not colour a
        # scoring run that already succeeded. Two bulk HTTP calls, ~1s.
        # fetch_profiles() returns None rather than raising on a bad fetch, so
        # the failure path writes nothing instead of half a table.
        profile_stats = {"symbols": 0, "sectors": 0}
        if not args.dry_run:
            try:
                print("\n--- Step 7: company profiles + ICB sectors ---")
                fetched = fetch_profiles()
                if fetched is None:
                    print("Company profiles: fetch failed, nothing written (kept previous values).")
                else:
                    profiles, sectors = fetched
                    n_p, n_s = upsert_profiles(client, profiles, sectors)
                    profile_stats = {"symbols": n_p, "sectors": n_s}
                    print(f"Company profiles: {n_p} symbols, {n_s} ICB labels.")
            except Exception as e:
                log_step_failure(st, "Step 7 company profiles", critical=False)

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
        summary_lines.append(
            f"- **Trend scored**: {trend_stats['scored']} "
            f"(buy_watch {trend_stats['by_action'].get('buy_watch', 0)})")
        summary_lines.append(f"- **TA Score**: {ta_stats['scored']}/{ta_stats['rows']} scored")
        summary_lines.append(f"- **Final score**: {final_stats['scored']}/{final_stats['rows']} scored")
        summary_lines.append(f"- **Company profiles**: {profile_stats['symbols']} symbols, "
                             f"{profile_stats['sectors']} ICB labels")
        if final_failed:
            shown = ", ".join(final_failed[:25])
            more = f" (+{len(final_failed) - 25} more)" if len(final_failed) > 25 else ""
            summary_lines.append(f"- **No fresh bar today**: {len(final_failed)} — {shown}{more}")
        summary_lines.append("")
        write_job_summary("\n".join(summary_lines))

        print(f"\n=== TA daily update done ===")
        # The run is red when data is missing, not only when the script crashed.
        exit_code = st.finish()
        if exit_code:
            sys.exit(exit_code)

    except Exception as e:
        if not args.dry_run:
            finish_run(client, run_id, "failed", processed, total_signals, str(e))
        print(f"\n!!! FAILED: {e}", file=sys.stderr)
        raise


if __name__ == "__main__":
    main()
