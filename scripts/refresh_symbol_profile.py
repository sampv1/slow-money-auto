#!/usr/bin/env python3
"""
refresh_symbol_profile.py — Company name + ICB industry sector, per symbol.

Fills `symbol_profile` (name/short name in vi+en, ICB L1..L4 codes, company type,
exchange, logo) and `icb_sectors` (bilingual labels for the codes in use), from
one keyless Vietcap endpoint. Migration 050. See ta/profile.py for the source.

Reference data only — nothing in the scoring pipeline reads it, and it does NOT
touch `fa_industry`, which stays FiinProX-authoritative so the real-estate FA
rubric split cannot move.

`update_ta_daily.py` runs this as its Step 7; this script is for manual /
ad-hoc refreshes and for the first population after 050 is applied.

Usage:
  python3 refresh_symbol_profile.py --dry-run   # fetch + report coverage, no writes
  python3 refresh_symbol_profile.py             # fetch + upsert
  python3 refresh_symbol_profile.py --symbols VNM,HPG --dry-run   # inspect a few
"""

import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client
from ta.profile import fetch_profiles, fetch_universe, upsert_profiles


def _report(profiles: list[dict], sectors: list[dict], universe: list[dict]) -> None:
    """Coverage against the ACTIVE universe — the population that matters.

    Reported per field rather than as one total: a single number would hide one
    field collapsing while the others stayed full, which is exactly how a
    changed upstream key would show up.
    """
    by_symbol = {p["symbol"]: p for p in profiles}
    active = [u["symbol"] for u in universe if u.get("is_active")]
    if not active:
        print("  ta_universe returned no active symbols — skipping coverage report")
        return

    n = len(active)
    print(f"\nCoverage against {n} active symbols:")
    for field in ("short_name_vi", "short_name_en", "name_vi", "name_en",
                  "icb_l1", "icb_l4", "com_type_code", "logo_url"):
        have = sum(1 for s in active if by_symbol.get(s, {}).get(field))
        flag = "" if have == n else "   <-- partial"
        print(f"  {field:16} {have:5}/{n} ({100 * have / n:5.1f}%){flag}")

    missing = [s for s in active if s not in by_symbol]
    if missing:
        print(f"  NOT IN PAYLOAD: {len(missing)} — {', '.join(sorted(missing)[:12])}")

    # The source's own floor vs ours. A disagreement is worth seeing, not fixing
    # here: ta_universe stays authoritative for exchange.
    ours = {u["symbol"]: u.get("exchange") for u in universe}
    mismatch = [(s, ours[s], by_symbol[s].get("exchange"))
                for s in active
                if s in by_symbol and by_symbol[s].get("exchange") and by_symbol[s]["exchange"] != ours.get(s)]
    print(f"  exchange disagreements vs ta_universe: {len(mismatch)}"
          + (f" — {mismatch[:5]}" if mismatch else ""))

    types = Counter(by_symbol[s].get("com_type_code") for s in active if s in by_symbol)
    print(f"  company types: {dict(types.most_common())}")
    print(f"  icb_sectors rows: {len(sectors)} "
          f"({dict(Counter(s['level'] for s in sectors).most_common())} by level)")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Refresh symbol_profile + icb_sectors from the Vietcap listing")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch and report, don't write")
    parser.add_argument("--symbols", type=str, default=None,
                        help="Comma-separated subset to write/inspect (default: all)")
    args = parser.parse_args()

    print("Fetching company profiles (vi + en)...")
    result = fetch_profiles(show_log=True)
    if result is None:
        # Fail CLOSED. A partial or failed fetch writing nothing is the whole
        # point: one bad call must never read as "every company lost its name".
        print("\nFetch failed — NOTHING was written.")
        return 1

    profiles, sectors = result
    print(f"  parsed {len(profiles)} symbols, {len(sectors)} ICB labels")

    if args.symbols:
        wanted = {s.strip().upper() for s in args.symbols.split(",") if s.strip()}
        profiles = [p for p in profiles if p["symbol"] in wanted]
        print(f"  filtered to {len(profiles)} of {len(wanted)} requested symbols")
        for p in profiles:
            print(f"    {p['symbol']}: {p['short_name_vi']!r} / {p['short_name_en']!r}  "
                  f"L1={p['icb_l1']} L4={p['icb_l4']}  {p['com_type_code']}  {p['exchange']}")

    client = get_supabase_client()
    _report(profiles, sectors, fetch_universe(client))

    n_p, n_s = upsert_profiles(client, profiles, sectors, dry_run=args.dry_run)
    verb = "would upsert" if args.dry_run else "Upserted"
    print(f"\n{verb} symbol_profile={n_p}  icb_sectors={n_s}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
