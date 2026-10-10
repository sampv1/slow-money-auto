#!/usr/bin/env python3
"""Load insurance thuyết minh (VCI `section=NOTE`) into fa_vnstock_statements.

    python3 refresh_insurance_notes.py                 # all insurers
    python3 refresh_insurance_notes.py --symbols BVH,PVI
    python3 refresh_insurance_notes.py --dry-run       # fetch, validate, write nothing
    python3 refresh_insurance_notes.py --audit         # validate what is STORED

Needs migration 081 (admits statement='note'; already applied for the banks).

Every period is validated before it is written (`fa/insurance_notes.validate`)
and a period that fails is DROPPED, not stored with a warning. Two gates, both
fatal: the four reserve components must sum to the total (the positional
mapping), and the total must agree with `BS_INSURANCE_RESERVES` within 5% (the
SCOPE -- BVH's note block carries only its non-life subsidiary before 2022-Q3,
which would otherwise reach BĐ4 as a float 18x too small).
"""

from __future__ import annotations

import argparse
import sys
import time

sys.path.insert(0, __file__.rsplit("/", 1)[0])

from ta.common import get_supabase_client, paged_select, safe_execute  # noqa: E402
from fa import insurance_notes as ins  # noqa: E402

#: OTC, no statements at all, absent from ta_universe -- so there is nothing to
#: validate a note against. BA's universe is the other 13.
EXCLUDED = {"IFA"}
CHUNK = 100


def insurance_symbols(client) -> list[str]:
    rows = paged_select(
        lambda lo, hi: client.table("symbol_profile")
        .select("symbol").eq("com_type_code", "BH").order("symbol").range(lo, lo + hi - 1),
        label="insurance universe",
    )
    return [r["symbol"] for r in rows if r["symbol"] not in EXCLUDED]


def scope_context(client, symbol: str) -> dict[str, dict]:
    """`BS_INSURANCE_RESERVES` per period -- the scope yardstick."""
    rows = paged_select(
        lambda lo, hi: client.table("fa_vnstock_statements")
        .select("period,period_type,items")
        .eq("symbol", symbol).eq("statement", "balance")
        .order("period").range(lo, lo + hi - 1),
        label=f"scope context {symbol}",
    )
    out: dict[str, dict] = {}
    for r in rows:
        v = (r.get("items") or {}).get("BS_INSURANCE_RESERVES")
        if isinstance(v, (int, float)) and v:
            out[r["period"]] = {"reserves_total": float(v)}
    return out


def write(client, rows: list[dict], *, dry: bool) -> int:
    if dry or not rows:
        return 0
    n = 0
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i:i + CHUNK]
        safe_execute(
            client.table("fa_vnstock_statements")
            .upsert(chunk, on_conflict="symbol,period,period_type,statement"),
            label=f"upsert insurance notes[{i}:{i + len(chunk)}]",
        )
        n += len(chunk)
    return n


def audit(client, symbols: list[str]) -> int:
    """Re-run both gates against what is STORED, so a renumbering that happened
    after ingest is visible without re-fetching."""
    bad = 0
    for s in symbols:
        ctx = scope_context(client, s)
        rows = paged_select(
            lambda lo, hi, s=s: client.table("fa_vnstock_statements")
            .select("period,period_type,items")
            .eq("symbol", s).eq("statement", "note").order("period").range(lo, lo + hi - 1),
            label=f"stored notes {s}",
        )
        for r in rows:
            items = {k: float(v) for k, v in (r.get("items") or {}).items()
                     if isinstance(v, (int, float))}
            checks = ins.validate(
                s, r["period"], items,
                reserves_total=ctx.get(r["period"], {}).get("reserves_total"),
            )
            for c in checks:
                if not c.ok:
                    bad += 1
                    print(f"  ::error:: {c.symbol} {c.period} {c.rule}: {c.detail}")
        print(f"  {s:5} {len(rows):3} stored rows")
    print(f"audit: {bad} failing check(s)")
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--symbols", help="comma-separated; default every BH symbol")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--audit", action="store_true", help="validate stored rows, fetch nothing")
    ap.add_argument("--pause", type=float, default=1.0)
    args = ap.parse_args()

    client = get_supabase_client()
    symbols = ([s.strip().upper() for s in args.symbols.split(",") if s.strip()]
               if args.symbols else insurance_symbols(client))
    print(f"insurance notes: {len(symbols)} symbol(s)")

    if args.audit:
        return audit(client, symbols)

    total_rows = total_dropped = failed_calls = 0
    for i, s in enumerate(symbols, 1):
        try:
            payload = ins.fetch_notes(s)
        except Exception as exc:  # noqa: BLE001 - a FAILED CALL, kept apart from empty
            failed_calls += 1
            print(f"  [{i}/{len(symbols)}] {s:5} ::error:: fetch failed: "
                  f"{type(exc).__name__}: {exc}")
            continue
        got = ins.collect_symbol(s, payload, context=scope_context(client, s))
        n = write(client, got.rows, dry=args.dry_run)
        total_rows += len(got.rows)
        total_dropped += got.dropped
        note = f"{len(got.rows):3} rows"
        if got.dropped:
            note += f", {got.dropped} dropped"
        print(f"  [{i}/{len(symbols)}] {s:5} {note}"
              f"{'' if args.dry_run else f' -> wrote {n}'}")
        for c in got.failures:
            print(f"        drop {c.period}: {c.rule} ({c.detail})")
        if i < len(symbols):
            time.sleep(args.pause)

    print(f"\n{'(dry run) ' if args.dry_run else ''}"
          f"{total_rows} rows, {total_dropped} periods dropped, "
          f"{failed_calls} failed call(s)")
    # A failed CALL is an error; a dropped PERIOD is the gate doing its job.
    return 1 if failed_calls else 0


if __name__ == "__main__":
    raise SystemExit(main())
