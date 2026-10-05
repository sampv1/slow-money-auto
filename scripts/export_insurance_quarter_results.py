"""Compute and persist quarterly business results for the 13 insurers.

BA `FINAL_BA_FIX_HOLDING_INTEGRATION_ADD_QUARTERLY_KQKD_2026-10-05.md` Phần II.

DISPLAY DATA, NOT A SCORE. §0 and §17 forbid touching any scorer this round;
nothing written here reaches a rubric. The universe comes from the
classification table, so the overview's 13 rows and this table's 13 rows cannot
drift apart.

Usage:
    python3 export_insurance_quarter_results.py              # dry run
    python3 export_insurance_quarter_results.py --write
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa import insurance_quarter_results as K
from ta.common import get_supabase_client, paged_select, safe_execute

TABLE = "fa_insurance_quarter_results"


def eligible_symbols(client) -> list[str]:
    rows = paged_select(
        lambda o, l: client.table("fa_insurance_classification")
        .select("symbol,scoring_eligibility")
        .is_("insurance_type_effective_to", "null").range(o, o + l - 1),
        label="classification")
    return sorted(r["symbol"] for r in rows
                  if r["scoring_eligibility"] == "ELIGIBLE")


def load_income(client, symbols) -> dict[tuple[str, str], dict]:
    rows = paged_select(
        lambda o, l: client.table("fa_vnstock_statements")
        .select(f"symbol,period,rev:items->{K.REVENUE_FIELD},"
                f"np:items->{K.PROFIT_FIELD}")
        .in_("symbol", symbols).eq("period_type", "quarter")
        .eq("statement", "income").order("symbol").order("period")
        .range(o, o + l - 1), label="income")
    out: dict[tuple[str, str], dict] = {}
    for r in rows:
        out[(r["symbol"], r["period"])] = {
            K.REVENUE_FIELD: None if r["rev"] is None else float(r["rev"]),
            K.PROFIT_FIELD: None if r["np"] is None else float(r["np"]),
        }
    return out


def periods_of(client) -> list[str]:
    """The quarters the overview can show — those the common layer scored."""
    rows = paged_select(
        lambda o, l: client.table("fa_insurance_scores").select("period")
        .range(o, o + l - 1), label="periods")
    return sorted({r["period"] for r in rows})


def build(client):
    symbols = eligible_symbols(client)
    income = load_income(client, symbols)
    out = []
    for period in periods_of(client):
        for sym in symbols:
            out.append(K.quarter_result(income, sym, period))
    return symbols, out


def reconcile(rows) -> list[str]:
    bad = []
    for r in rows:
        k = f"{r['symbol']} {r['period']}"
        for figure, prev, pct, status in (
                ("quarter_revenue", "quarter_revenue_prev",
                 "quarter_revenue_yoy", "quarter_revenue_status"),
                ("quarter_net_profit", "quarter_net_profit_prev",
                 "quarter_net_profit_yoy", "quarter_net_profit_status")):
            if (r[pct] is not None) != (r[status] == K.CALCULATED):
                bad.append(f"{k}: {pct} and {status} disagree")
            if r[status] == K.CALCULATED:
                want = (r[figure] / r[prev] - 1) * 100
                if abs(r[pct] - want) > 1e-6:
                    bad.append(f"{k}: {pct} does not reconcile")
                # §7.4 — a percentage may never come from a non-positive base.
                if r[prev] <= 0:
                    bad.append(f"{k}: {pct} computed against a base of {r[prev]}")
        if r["kqkd_source_period"] != K.shift(r["period"], 4):
            bad.append(f"{k}: source period is not four quarters back")
    return bad


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()

    client = get_supabase_client()
    symbols, rows = build(client)
    print(f"{len(symbols)} eligible symbols · {len(rows)} symbol-quarters")

    bad = reconcile(rows)
    if bad:
        raise SystemExit(f"FAIL_RECONCILIATION on {len(bad)}: {bad[:5]}")
    print("reconciliation: PASS")

    latest = max(r["period"] for r in rows)
    print(f"\n{latest} — the quarter the overview opens on:")
    for r in sorted((x for x in rows if x["period"] == latest),
                    key=lambda x: x["symbol"]):
        rv = "—" if r["quarter_revenue"] is None else f"{r['quarter_revenue']/1e9:>9,.1f}"
        np_ = "—" if r["quarter_net_profit"] is None else f"{r['quarter_net_profit']/1e9:>8,.1f}"
        ry = (f"{r['quarter_revenue_yoy']:+7.1f}%" if r["quarter_revenue_yoy"] is not None
              else f"{r['quarter_revenue_status']:>8}")
        ny = (f"{r['quarter_net_profit_yoy']:+8.1f}%" if r["quarter_net_profit_yoy"] is not None
              else f"{r['quarter_net_profit_status']:>9}")
        print(f"   {r['symbol']:4} DT {rv} tỷ {ry}   LNST {np_} tỷ {ny}")

    from collections import Counter
    print("\nstatus mix:",
          dict(Counter(r["quarter_net_profit_status"] for r in rows)))

    if not a.write:
        print("\ndry run: nothing written")
        return 0

    for i in range(0, len(rows), 200):
        safe_execute(client.table(TABLE).upsert(
            rows[i:i + 200], on_conflict="symbol,period,kqkd_mapping_version"),
            label="kqkd upsert")
    back = safe_execute(client.table(TABLE)
                        .select("symbol,period,quarter_revenue")
                        .eq("kqkd_mapping_version", K.MAPPING_VERSION),
                        label="readback").data or []
    want = {(r["symbol"], r["period"]) for r in rows}
    got = {(r["symbol"], r["period"]) for r in back}
    if want - got:
        raise SystemExit(f"read-back missing {len(want - got)}: {sorted(want - got)[:5]}")
    print(f"\nwrote {len(rows)} rows; read-back covers all of them")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
