#!/usr/bin/env python3
"""FA Scanner pipeline — import Excel data and score symbols.

Subcommands:
  import   Parse Data_FiinPro.xlsx and/or PE.xlsx and additively upsert into
           fa_quarterly / fa_annual_pe (only the rows present in the file).
  score    Read fa_quarterly + fa_annual_pe + ta_ohlcv + fa_scoring_config and
           upsert fa_scores snapshots. Default = latest eligible quarter per
           symbol (live price); --backfill = every fully-scorable quarter
           (point-in-time quarter-end price for older quarters).

Usage:
  python3 refresh_fa.py import --fiin ../initial_fa_data/Data_FiinPro.xlsx --pe ../initial_fa_data/PE.xlsx
  python3 refresh_fa.py score --backfill
  python3 refresh_fa.py score                      # daily: latest quarter, live price
  python3 refresh_fa.py score --symbols FPT HPG
  python3 refresh_fa.py score --inspect FPT
  python3 refresh_fa.py score --dry-run
"""

import argparse
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client, safe_execute  # noqa: E402
from fa import excel_import, metrics as fa_metrics, persist as fa_persist  # noqa: E402
from fa.scoring import compute_score  # noqa: E402

CLIENT_REFRESH_EVERY = 200
_QUARTER_END = {1: (3, 31), 2: (6, 30), 3: (9, 30), 4: (12, 31)}


# --------------------------------------------------------------------------
# import
# --------------------------------------------------------------------------

def cmd_import(args) -> int:
    client = get_supabase_client()
    if args.fiin:
        rows = excel_import.parse_fiinpro(args.fiin)
        syms = len({r["symbol"] for r in rows})
        pers = sorted({r["period"] for r in rows})
        print(f"Data_FiinPro: {len(rows)} (symbol,period) rows · {syms} symbols · periods {pers}")
        if not args.dry_run:
            n = fa_persist.upsert_quarterly(client, rows)
            print(f"  upserted {n} fa_quarterly rows")
    if args.pe:
        rows = excel_import.parse_pe(args.pe)
        syms = len({r["symbol"] for r in rows})
        yrs = sorted({r["year"] for r in rows})
        print(f"PE: {len(rows)} (symbol,year) rows · {syms} symbols · years {yrs}")
        if not args.dry_run:
            n = fa_persist.upsert_annual_pe(client, rows)
            print(f"  upserted {n} fa_annual_pe rows")
    if not args.fiin and not args.pe:
        print("Nothing to import — pass --fiin and/or --pe.")
    return 0


# --------------------------------------------------------------------------
# score
# --------------------------------------------------------------------------

def _paged(builder):
    out, off = [], 0
    while True:
        d = builder(off, off + 999).execute().data
        out.extend(d)
        if len(d) < 1000:
            break
        off += 1000
    return out


def _load_quarterly(client, symbols=None):
    """Return {symbol: {period: row}}."""
    def build(a, b):
        q = client.table("fa_quarterly").select("*")
        if symbols:
            q = q.in_("symbol", symbols)
        return q.order("symbol").order("period").range(a, b)
    rows = _paged(build)
    series: dict[str, dict] = {}
    for r in rows:
        series.setdefault(r["symbol"], {})[r["period"]] = r
    return series


def _load_annual_pe(client, symbols=None):
    def build(a, b):
        q = client.table("fa_annual_pe").select("symbol,year,pe")
        if symbols:
            q = q.in_("symbol", symbols)
        return q.order("symbol").range(a, b)
    out: dict[str, list] = {}
    for r in _paged(build):
        out.setdefault(r["symbol"], []).append((r["year"], r["pe"]))
    return out


def _load_prices(client, symbol):
    """Sorted [(date, close)] for a symbol from ta_ohlcv (ascending)."""
    res = safe_execute(
        client.table("ta_ohlcv").select("date,close").eq("symbol", symbol).order("date"),
        label=f"ta_ohlcv {symbol}",
    )
    out = []
    for r in res.data or []:
        try:
            out.append((date.fromisoformat(r["date"]), float(r["close"])))
        except (TypeError, ValueError):
            continue
    return out


def _qend_close(prices, period):
    """(close, date) on/before the quarter-end of `period`, or (None, None)."""
    year, q = period.split("-Q")
    m, d = _QUARTER_END[int(q)]
    qend = date(int(year), m, d)
    prior = [(dt, c) for (dt, c) in prices if dt <= qend]
    if not prior:
        return None, None
    dt, c = prior[-1]
    return c, dt.isoformat()


def _score_symbol(symbol, series, annual_pe, prices, config, backfill):
    """Return list of fa_scores row dicts for one symbol."""
    elig = fa_metrics.eligible_periods(series)
    if not elig:
        return []
    latest = elig[-1]
    periods = elig if backfill else [latest]
    live_close = prices[-1][1] if prices else None
    live_date = prices[-1][0].isoformat() if prices else None

    out = []
    for period in periods:
        if period == latest:
            price, price_date = live_close, live_date
        else:
            price, price_date = _qend_close(prices, period)
        m = fa_metrics.compute_metrics(series, period, price, annual_pe)
        res = compute_score(m, config, fully_scorable=True)
        out.append(fa_persist.score_row_for(symbol, period, m, res, price_date))
    return out


def cmd_score(args) -> int:
    client = get_supabase_client()
    config = fa_persist.load_scoring_config(client)

    symbols = [s.upper() for s in args.symbols] if args.symbols else None
    if args.inspect:
        symbols = [args.inspect.upper()]
    series_all = _load_quarterly(client, symbols)
    pe_all = _load_annual_pe(client, symbols)
    target = sorted(symbols) if symbols else sorted(series_all)

    if args.inspect:
        _print_inspect(client, args.inspect.upper(), series_all, pe_all, config)
        return 0

    print(f"FA score: {len(target)} symbol(s) · {'BACKFILL' if args.backfill else 'latest-only'}"
          f"{' · DRY RUN' if args.dry_run else ''}")
    run_id = None if args.dry_run else fa_persist.start_run(client, None)
    processed = skipped = 0
    latest_period = None
    try:
        for i, sym in enumerate(target):
            if i and i % CLIENT_REFRESH_EVERY == 0 and not args.dry_run:
                client = get_supabase_client()
            series = series_all.get(sym, {})
            if not series:
                skipped += 1
                continue
            prices = _load_prices(client, sym)
            rows = _score_symbol(sym, series, pe_all.get(sym, []), prices, config, args.backfill)
            if not rows:
                skipped += 1
                continue
            latest_period = latest_period or max(r["as_of_period"] for r in rows)
            if not args.dry_run:
                fa_persist.upsert_scores(client, rows)
            processed += 1
            if i % 100 == 0:
                print(f"  ...{i}/{len(target)}")
        if not args.dry_run:
            fa_persist.finish_run(client, run_id, "success", processed, skipped, latest_period)
        print(f"Done. scored={processed} skipped={skipped}")
        return 0
    except Exception as e:  # noqa: BLE001
        if not args.dry_run:
            fa_persist.finish_run(client, run_id, "failed", processed, skipped, latest_period, str(e)[:500])
        print(f"FATAL: {e}")
        return 1


_LABELS = {
    "c1": "C1 EPS YoY %", "c2": "C2 avg EPS YoY% 3q", "c3": "C3 # q EPS grew /3",
    "c4": "C4 revenue YoY %", "c5": "C5 gross-margin Δ pp", "c6": "C6 net-margin Δ pp",
    "c7": "C7 ROE TTM %", "c8": "C9 fin.debt/equity", "c9": "C14 P/E vs 5y median",
}


def _print_inspect(client, symbol, series_all, pe_all, config):
    series = series_all.get(symbol, {})
    print(f"\n=== {symbol}: FA score breakdown ===")
    if not series:
        print("  (no fa_quarterly data)")
        return
    elig = fa_metrics.eligible_periods(series)
    print(f"  periods in DB: {sorted(series)}")
    print(f"  fully-scorable: {elig}")
    if not elig:
        print("  (no fully-scorable quarter)")
        return
    period = elig[-1]
    prices = _load_prices(client, symbol)
    price = prices[-1][1] if prices else None
    m = fa_metrics.compute_metrics(series, period, price, pe_all.get(symbol, []))
    res = compute_score(m, config, fully_scorable=True)
    print(f"  scoring quarter: {period}  price={price}  ttm_eps={m['current_eps_ttm']}  median_pe={m['pe_5y_median']}\n")
    print(f"  {'Criterion':<22}{'Value':>12}{'Pts':>5}")
    print("  " + "-" * 40)
    for k in ("c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9"):
        v = res.criteria[k]["value"]
        vs = f"{v:.2f}" if isinstance(v, (int, float)) else "—"
        print(f"  {_LABELS[k]:<22}{vs:>12}{res.pts(k):>5}")
    print("  " + "-" * 40)
    print(f"  {'TOTAL':<22}{'':>12}{res.total_score:>5}  -> {res.rating}")
    if res.notes:
        print(f"  notes: {'; '.join(res.notes)}")


def main() -> int:
    p = argparse.ArgumentParser(description="FA Scanner pipeline")
    sub = p.add_subparsers(dest="cmd", required=True)

    pi = sub.add_parser("import", help="Import Excel data into the DB")
    pi.add_argument("--fiin", help="Path to Data_FiinPro.xlsx")
    pi.add_argument("--pe", help="Path to PE.xlsx")
    pi.add_argument("--dry-run", action="store_true")
    pi.set_defaults(func=cmd_import)

    ps = sub.add_parser("score", help="Compute fa_scores snapshots")
    ps.add_argument("--backfill", action="store_true", help="Score every fully-scorable quarter")
    ps.add_argument("--symbols", nargs="+")
    ps.add_argument("--inspect", metavar="SYMBOL", help="Print one symbol's breakdown, no write")
    ps.add_argument("--dry-run", action="store_true")
    ps.set_defaults(func=cmd_score)

    args = p.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
