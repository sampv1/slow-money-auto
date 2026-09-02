#!/usr/bin/env python3
"""
backfill_ta_ohlcv.py — Backfill OHLCV history into ta_ohlcv.

Two jobs, one script:

  * GAP-FILL (the original): a short window for symbols a sync just added, or
    a repair after a run collected nothing. `--days N`, active symbols.
  * DEEP BACKFILL (`--full --scope members`): everything the provider will
    serve, for every universe MEMBER rather than only the active ones. This is
    what makes the per-symbol chart usable on its own — a symbol that carries
    no RS, no TA Score and no signals still gets its price history, so it can
    be typed into the Analysis or TA Scanner box and drawn.

WHAT "FULL" MEANS, MEASURED
  The community tier serves 8 years of daily OHLCV (~1,997 bars back to
  2018-08-30 as of 2026-09-02) — with one exception, which is why
  `warm_up_provider` exists: the FIRST history() call in a process escapes the
  cap entirely. Left alone, that hands whichever symbol happened to sort first
  a twenty-year series and everyone else eight years, so chart depth would be
  an artefact of the work-list's ordering. The warm-up burns that call on a
  throwaway request; see ta/ohlcv.py.

THE DEEP BACKFILL REWRITES HISTORY, AND THAT IS THE POINT
  `history()` is BACK-ADJUSTED; ta_ohlcv is append-only and stores the raw
  price_board print. So this does not merely extend each series backwards, it
  re-states the part we already had onto today's adjusted basis — which is the
  same repair `refresh_adjustments.py` performs, applied to the whole history
  instead of the trailing 500 days it can reach. Everything downstream reads a
  bounded window (signals 600 bars, RS 780 days, trend ~1.5 years), so the
  nightly pass simply recomputes from the repaired series.

Usage:
  # Deep backfill, every member, resumable (~2 h at the default delay):
  python3 backfill_ta_ohlcv.py --full --scope members --resume

  # The original gap-fill behaviour (unchanged defaults):
  python3 backfill_ta_ohlcv.py --days 180
  python3 backfill_ta_ohlcv.py --symbols FPT HPG VCB

  # Plan without fetching:
  python3 backfill_ta_ohlcv.py --full --scope members --dry-run
"""

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import REQUEST_DELAY, get_supabase_client
from ta.ohlcv import FULL_HISTORY_START, backfill_symbols, warm_up_provider
from ta.universe import get_active_symbols, get_universe_symbols

# Completed symbols, one per line. Lives under outputs/ (gitignored) because it
# is run state, not configuration. A deep backfill is ~2 hours of sequential
# network calls; without this, an interruption at symbol 1,400 costs the lot.
DEFAULT_STATE = Path(__file__).resolve().parent / "outputs" / "backfill_ohlcv.done"


def load_done(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {ln.strip().upper() for ln in path.read_text().splitlines() if ln.strip()}


def record_completion(state: Path, symbol: str, rows: int) -> bool:
    """Record `symbol` as done — but ONLY if it actually came back with bars.

    The distinction is the whole point of the file. A symbol that returned
    nothing is either a transient fetch failure or a line that has genuinely
    never traded, and the two are indistinguishable from one attempt. Recording
    it would make the next `--resume` skip it permanently, converting a
    retryable blip into a symbol with no chart that nothing will ever revisit —
    the same shape of bug as a green CI run over a collection that wrote zero
    rows.

    Costing a never-traded line one wasted call per resume is the cheaper error.
    """
    if rows <= 0:
        return False
    with state.open("a") as fh:
        fh.write(f"{symbol}\n")
    return True


def main():
    parser = argparse.ArgumentParser(description="Backfill OHLCV history into ta_ohlcv")
    parser.add_argument("--days", type=int, default=90, help="Calendar days to backfill (default 90)")
    parser.add_argument("--full", action="store_true",
                        help="Fetch everything the provider serves (~8 years) instead of --days")
    parser.add_argument("--scope", choices=["active", "members"], default="active",
                        help="'active' = is_active symbols (default); 'members' = every ta_universe "
                             "row, active or not — the chart-history scope")
    parser.add_argument("--symbols", nargs="+", help="Specific symbols (overrides --scope)")
    parser.add_argument("--limit", type=int, help="Cap the work-list (for a trial run)")
    parser.add_argument("--resume", action="store_true",
                        help="Skip symbols already recorded complete in the state file")
    parser.add_argument("--state", type=Path, default=DEFAULT_STATE,
                        help=f"Resume state file (default {DEFAULT_STATE})")
    parser.add_argument("--delay", type=float, default=REQUEST_DELAY, help=f"Seconds between requests (default {REQUEST_DELAY})")
    parser.add_argument("--dry-run", action="store_true", help="Show what would run, don't fetch")
    args = parser.parse_args()

    client = get_supabase_client()

    if args.symbols:
        symbols = [s.upper() for s in args.symbols]
        print(f"Using {len(symbols)} explicit symbols.")
    elif args.scope == "members":
        symbols = get_universe_symbols(client)
        if not symbols:
            print("ta_universe is empty. Run refresh_ta_universe.py first.")
            sys.exit(1)
        active = set(get_active_symbols(client))
        print(f"Loaded {len(symbols)} ta_universe members "
              f"({len(active)} active, {len(symbols) - len(active)} inactive).")
    else:
        symbols = get_active_symbols(client)
        if not symbols:
            print("ta_universe is empty. Run refresh_ta_universe.py first.")
            sys.exit(1)
        print(f"Loaded {len(symbols)} symbols from ta_universe (is_active=true).")

    skipped = 0
    if args.resume:
        done = load_done(args.state)
        before = len(symbols)
        symbols = [s for s in symbols if s not in done]
        skipped = before - len(symbols)
        print(f"Resuming: {skipped} already complete, {len(symbols)} to go.")
    if args.limit:
        symbols = symbols[:args.limit]

    if not symbols:
        print("Nothing to do.")
        return

    start = FULL_HISTORY_START if args.full else None
    span = f"from {start} (provider-capped)" if args.full else f"{args.days} days"
    est_minutes = len(symbols) * (args.delay + 0.8) / 60
    print(f"Planned: {len(symbols)} symbols × {span}, ~{est_minutes:.0f} min at {args.delay}s/req.")

    if args.dry_run:
        print("\nDry run — would backfill these symbols:")
        for s in symbols:
            print(f"  {s}")
        return

    # Uniform depth: spend the uncapped first call on a throwaway (see module
    # docstring). Only matters for --full; harmless otherwise.
    if args.full:
        print("Warming up the provider (burns the uncapped first call)... ", end="", flush=True)
        print("ok" if warm_up_provider() else "failed — first symbol may get a deeper series")
        time.sleep(args.delay)

    args.state.parent.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    def on_done(i, symbol, rows):
        record_completion(args.state, symbol, rows)
        if i % 50 == 0:
            rate = (time.time() - t0) / i
            print(f"  ...{i}/{len(symbols)} · {rate:.1f}s/symbol · "
                  f"~{rate * (len(symbols) - i) / 60:.0f} min left")

    print()
    results = backfill_symbols(client, symbols, days=args.days, delay=args.delay,
                               start=start, on_done=on_done)
    total_rows = sum(results.values())
    successes = sum(1 for n in results.values() if n > 0)
    failures = [s for s, n in results.items() if n == 0]
    print(f"\nDone in {(time.time() - t0) / 60:.0f} min. "
          f"{successes}/{len(symbols)} symbols backfilled. {total_rows:,} rows written.")
    if failures:
        # A symbol with no data is not necessarily an error — a never-traded
        # UPCOM line legitimately has none — so this is a re-run list, not a
        # failure count. Re-running is idempotent (upsert on symbol,date).
        print(f"\nNo data for {len(failures)} symbol(s). Retry with:\n"
              f"  python3 backfill_ta_ohlcv.py --full --symbols {' '.join(failures)}")


if __name__ == "__main__":
    main()
