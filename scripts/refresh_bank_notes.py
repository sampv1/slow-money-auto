#!/usr/bin/env python3
"""Load bank thuyết minh (VCI `section=NOTE`) into fa_vnstock_statements.

    python3 refresh_bank_notes.py                 # all banks, missing+changed
    python3 refresh_bank_notes.py --symbols VCB,TCB
    python3 refresh_bank_notes.py --dry-run       # fetch, validate, write nothing
    python3 refresh_bank_notes.py --audit         # validate what is STORED

Needs migration 081 (admits statement='note').

Every period is validated before it is written (`fa/bank_notes.validate`) and a
period that fails is DROPPED, not stored with a warning: the fields here are
addressed positionally in the provider's payload, so a silent renumbering would
otherwise reach the NPL chart as a plausible wrong number.
"""

from __future__ import annotations

import argparse
import sys
import time

sys.path.insert(0, __file__.rsplit("/", 1)[0])

from ta.common import get_supabase_client, paged_select, safe_execute  # noqa: E402
from fa import bank_notes as bn  # noqa: E402

EXCLUDED = {"EVF", "TIN"}  # no deposit-taking business (BA round 3)
CHUNK = 100


def bank_symbols(client) -> list[str]:
    rows = paged_select(
        lambda lo, hi: client.table("symbol_profile")
        .select("symbol").eq("com_type_code", "NH").order("symbol").range(lo, hi),
        label="bank universe",
    )
    return [r["symbol"] for r in rows if r["symbol"] not in EXCLUDED]


def yardsticks(client, symbols: list[str]) -> dict[str, dict[str, dict]]:
    """Per symbol/period cross-check inputs, read from what we already store."""
    out: dict[str, dict[str, dict]] = {s: {} for s in symbols}
    for i in range(0, len(symbols), 6):
        chunk = symbols[i:i + 6]
        for stmt, keys in (
            ("balance", {"gross_loans": "BS_LOANS_TO_CUSTOMERS_GROSS",
                         "investment_securities": "BS_INVESTMENT_SECURITIES"}),
            ("ratio", {"npl_ratio": "RT_BANK_NPL"}),
        ):
            sel = "symbol,period," + ",".join(f"{k}:items->{v}" for k, v in keys.items())
            rows = paged_select(
                lambda lo, hi, sel=sel, stmt=stmt, chunk=chunk: client
                .table("fa_vnstock_statements").select(sel)
                .eq("statement", stmt).in_("symbol", chunk)
                .order("symbol").order("period").range(lo, hi),
                label=f"yardstick {stmt}",
            )
            for r in rows:
                d = out[r["symbol"]].setdefault(r["period"], {})
                for k in keys:
                    v = r.get(k)
                    if isinstance(v, (int, float)):
                        d[k] = float(v)
    return out


def write(client, rows: list[dict], dry_run: bool) -> int:
    if dry_run or not rows:
        return 0
    n = 0
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i:i + CHUNK]
        safe_execute(
            client.table("fa_vnstock_statements")
            .upsert(chunk, on_conflict="symbol,period,period_type,statement"),
            label=f"upsert notes[{i}:{i + len(chunk)}]",
        )
        n += len(chunk)
    return n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--symbols", help="comma-separated; default every bank")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--audit", action="store_true", help="validate STORED rows, fetch nothing")
    ap.add_argument("--delay", type=float, default=0.4)
    args = ap.parse_args()

    client = get_supabase_client()
    symbols = ([s.strip().upper() for s in args.symbols.split(",") if s.strip()]
               if args.symbols else bank_symbols(client))
    print(f"{len(symbols)} bank(s)")

    yard = yardsticks(client, symbols)

    if args.audit:
        bad = 0
        for s in symbols:
            rows = paged_select(
                lambda lo, hi, s=s: client.table("fa_vnstock_statements")
                .select("period,period_type,items").eq("symbol", s)
                .eq("statement", "note").order("period").range(lo, hi),
                label=f"stored notes {s}",
            )
            for r in rows:
                c = yard.get(s, {}).get(r["period"], {})
                res = bn.validate(s, r["period"], r["items"] or {}, **c)
                fails = [x for x in res if not x.ok and x.fatal]
                for f in fails:
                    print(f"  ::error:: {f.symbol} {f.period} {f.rule} {f.detail}")
                for a in [x for x in res if not x.ok and not x.fatal]:
                    print(f"  ::warning:: {a.symbol} {a.period} {a.rule} {a.detail}")
                bad += len(fails)
            print(f"  {s}: {len(rows)} stored period(s)")
        print(f"\naudit: {bad} failing check(s)")
        return 1 if bad else 0

    total_rows = total_dropped = total_failed = total_advice = 0
    failed_calls: list[str] = []
    for s in symbols:
        try:
            payload = bn.fetch_notes(s)
        except Exception as exc:  # noqa: BLE001
            print(f"  {s}: FETCH FAILED -> {type(exc).__name__}: {exc}")
            failed_calls.append(s)
            continue
        ing = bn.collect_symbol(s, payload, yard.get(s))
        for f in ing.failures:
            print(f"  ::error:: {f.symbol} {f.period} {f.rule} {f.detail}")
        for a in ing.advisories:
            print(f"  ::warning:: {a.symbol} {a.period} {a.rule} {a.detail} (stored)")
        n = write(client, ing.rows, args.dry_run)
        total_rows += len(ing.rows)
        total_dropped += ing.dropped
        total_failed += len(ing.failures)
        total_advice += len(ing.advisories)
        flag = " DRY-RUN" if args.dry_run else ""
        print(f"  {s}: {len(ing.rows)} period(s){flag}"
              + (f", {ing.dropped} dropped" if ing.dropped else ""))
        time.sleep(args.delay)

    print(f"\n{total_rows} period(s) {'validated' if args.dry_run else 'written'}, "
          f"{total_dropped} dropped on {total_failed} fatal check(s), "
          f"{total_advice} advisory")
    if failed_calls:
        print(f"::error::fetch failed for {len(failed_calls)}: "
              f"--symbols {','.join(failed_calls)}")
        return 1
    # A dropped period is a real signal (the mapping moved), not routine noise.
    if total_dropped:
        print("::warning::some periods failed validation and were not stored")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
