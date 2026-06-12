#!/usr/bin/env python3
"""FA Scanner refresh — fetch fundamentals, score, upsert to Supabase.

Quarterly job: for each symbol in ta_universe, pull the (up to) 4 most recent
quarterly statements from vnstock, compute the 9-criterion graduated score
(see FA_FEATURE_PLAN.md), and upsert into fa_quarterly + fa_scores.

vnstock free caps statements at 4 periods, so growth criteria use QoQ (not YoY)
and valuation uses a 4-quarter median P/E. See scripts/fa/fetcher.py for details.

Usage:
  python3 refresh_fa.py                      # full universe
  python3 refresh_fa.py --symbols FPT HPG    # subset for debugging
  python3 refresh_fa.py --inspect FPT        # print one symbol's score, no DB write
  python3 refresh_fa.py --dry-run            # compute, log counts, no write
  python3 refresh_fa.py --limit 50           # cap symbol count (smoke tests)
"""

import argparse
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client, safe_execute  # noqa: E402
from fa import metrics as fa_metrics  # noqa: E402
from fa import persist as fa_persist  # noqa: E402
from fa.fetcher import fetch_quarters  # noqa: E402
from fa.scoring import compute_score  # noqa: E402

# Refresh the Supabase client every N symbols to dodge HTTP/2 stream exhaustion
# on a long-running connection (same rationale as the TA pipeline).
CLIENT_REFRESH_EVERY = 150

_QUARTER_END = {1: (3, 31), 2: (6, 30), 3: (9, 30), 4: (12, 31)}


def _quarter_end_date(year: int, quarter: int) -> date:
    month, day = _QUARTER_END[quarter]
    return date(year, month, day)


def _load_prices(client, symbol: str) -> list[tuple[date, float]]:
    """Return [(date, close)] for a symbol from ta_ohlcv, ascending by date."""
    res = safe_execute(
        client.table("ta_ohlcv").select("date,close").eq("symbol", symbol).order("date", desc=False),
        label=f"load ta_ohlcv {symbol}",
    )
    rows = res.data or []
    out = []
    for r in rows:
        try:
            d = date.fromisoformat(r["date"])
            out.append((d, float(r["close"])))
        except (TypeError, ValueError):
            continue
    return out


def _quarter_end_closes(prices: list[tuple[date, float]], quarters: list[dict]) -> dict:
    """For each quarter, the last close on/before that quarter's calendar end."""
    closes = {}
    for q in quarters:
        qend = _quarter_end_date(q["year"], q["quarter"])
        prior = [c for (d, c) in prices if d <= qend]
        if prior:
            closes[q["period"]] = prior[-1]
    return closes


def process_symbol(client, symbol: str):
    """Fetch + compute everything for one symbol.

    Returns (quarters, qend_closes, metrics, result) or None if no fundamentals.
    """
    quarters = fetch_quarters(symbol)
    if not quarters:
        return None

    prices = _load_prices(client, symbol)
    qend_closes = _quarter_end_closes(prices, quarters)
    current_price = prices[-1][1] if prices else None
    current_price_date = prices[-1][0].isoformat() if prices else None

    metrics = fa_metrics.compute_metrics(quarters, qend_closes, current_price)
    metrics["current_price_date"] = current_price_date
    result = compute_score(metrics, n_quarters=len(quarters))
    return quarters, qend_closes, metrics, result


_C_LABELS = {
    "c1": "EPS growth QoQ (%)",
    "c2": "Avg EPS growth 3Q (%)",
    "c3": "# QoQ positive (0-3)",
    "c4": "Revenue growth QoQ (%)",
    "c5": "Gross margin Δ (pp)",
    "c6": "Net margin Δ (pp)",
    "c7": "ROE TTM (%)",
    "c8": "Debt/Equity",
    "c9": "Current P/E vs 4Q median",
}


def _print_inspect(client, symbol: str) -> None:
    print(f"\n=== {symbol}: FA score breakdown ===")
    out = process_symbol(client, symbol)
    if out is None:
        print("  (no fundamental data returned)")
        return
    quarters, qend_closes, metrics, result = out

    print(f"  Quarters available: {len(quarters)} ({', '.join(q['period'] for q in quarters)})")
    print(f"  Quarter-end closes: {qend_closes}")
    print()
    print(f"  {'Criterion':<28} {'Value':>14} {'Pts':>5}")
    print("  " + "-" * 50)
    for key in ("c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9"):
        crit = result.criteria.get(key, {})
        val = crit.get("value")
        val_str = f"{val:,.2f}" if isinstance(val, (int, float)) else "—"
        print(f"  {_C_LABELS[key]:<28} {val_str:>14} {crit.get('pts', 0):>5}")
    print("  " + "-" * 50)
    print(f"  {'TOTAL':<28} {'':>14} {result.total_score:>5}")
    print(f"  Rating: {result.rating}")
    print(f"  Valuation: current_pe={metrics.get('current_pe')}, "
          f"pe_4q_median={metrics.get('pe_4q_median')}, "
          f"ttm_eps={metrics.get('current_eps_ttm')}, price={metrics.get('current_price')}")
    if result.notes:
        print(f"  Notes: {'; '.join(result.notes)}")


def _load_universe(client, limit: int | None) -> list[str]:
    res = safe_execute(
        client.table("ta_universe").select("symbol").eq("is_active", True).order("symbol"),
        label="load ta_universe",
    )
    symbols = [r["symbol"] for r in (res.data or [])]
    if limit:
        symbols = symbols[:limit]
    return symbols


def main() -> int:
    parser = argparse.ArgumentParser(description="FA Scanner refresh")
    parser.add_argument("--symbols", nargs="+", help="Specific symbols (default: full ta_universe)")
    parser.add_argument("--inspect", metavar="SYMBOL", help="Print one symbol's score and exit (no DB write)")
    parser.add_argument("--dry-run", action="store_true", help="Compute but do not write to Supabase")
    parser.add_argument("--limit", type=int, help="Cap number of symbols processed")
    args = parser.parse_args()

    client = get_supabase_client()

    if args.inspect:
        _print_inspect(client, args.inspect.upper())
        return 0

    if args.symbols:
        symbols = [s.upper() for s in args.symbols]
    else:
        symbols = _load_universe(client, args.limit)
    if args.limit and args.symbols:
        symbols = symbols[:args.limit]

    print(f"FA refresh: {len(symbols)} symbol(s){' [DRY RUN]' if args.dry_run else ''}")

    run_id = None
    if not args.dry_run:
        run_id = fa_persist.start_run(client, as_of_period=None)

    processed = 0
    skipped = 0
    latest_period = None

    try:
        for idx, symbol in enumerate(symbols):
            if idx and idx % CLIENT_REFRESH_EVERY == 0 and not args.dry_run:
                client = get_supabase_client()

            try:
                out = process_symbol(client, symbol)
            except Exception as e:  # noqa: BLE001
                print(f"  {symbol}: ERROR {str(e)[:120]} — skipped")
                skipped += 1
                continue

            if out is None:
                print(f"  {symbol}: no fundamentals — skipped")
                skipped += 1
                continue

            quarters, qend_closes, metrics, result = out
            as_of = quarters[0]["period"]
            latest_period = latest_period or as_of

            print(f"  {symbol}: {as_of}  score={result.total_score}  rating={result.rating}")

            if not args.dry_run:
                q_rows = fa_persist.quarterly_rows_for(symbol, quarters, qend_closes)
                fa_persist.upsert_quarterly(client, q_rows)
                score_row = fa_persist.score_row_for(symbol, as_of, metrics, result)
                fa_persist.upsert_scores(client, [score_row])

            processed += 1

        if not args.dry_run:
            fa_persist.finish_run(client, run_id, "success", processed, skipped, as_of_period=latest_period)
        print(f"\nDone. processed={processed} skipped={skipped}")
        return 0

    except Exception as e:  # noqa: BLE001
        if not args.dry_run:
            fa_persist.finish_run(client, run_id, "failed", processed, skipped,
                                  as_of_period=latest_period, err=str(e)[:500])
        print(f"FATAL: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
