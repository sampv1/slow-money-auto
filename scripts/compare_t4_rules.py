#!/usr/bin/env python3
"""BA §8.2 — regression of T4 v1 (disjunctive) against T4 v2 (conjunctive).

BA locked v2 for every automated run after the 2026-Q2 round and asked for four
numbers before it is switched on: how many warnings each rule raises over the 72
non-life symbol-quarters, which rows v2 drops, and confirmation that the SHARED
engine still detects VLB — the non-financial issuer whose 348.2 tỷ really is
non-operating other income.

TWO THINGS THIS SCRIPT IS CAREFUL ABOUT.

The insurer rows are screened with `other_income_is_pl_addend=True`, which is
DELIBERATELY the opposite of what the live export does. In production that line
is not an addend of pre-tax profit, so T4 is unevaluable and both rules fire
zero — a comparison that would be arithmetically true and completely uninformative.
Feeding the line in anyway is the only way to measure the two THRESHOLD SETS
against each other, which is what §8.2 asks for. The rows are therefore labelled
as a threshold comparison, never as live warnings.

And v1 must keep working. It is what the 2026-Q2 audit record was screened
under, and an audit trail nobody can reproduce is not an audit trail.

    python3 compare_t4_rules.py [--json OUT]
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import export_insurance_nonlife_check as X  # noqa: E402
from fa.one_off import (T4_RULE_V1, T4_RULE_V2, TriggerInput,  # noqa: E402
                        evaluate_triggers)
from ta.common import get_supabase_client  # noqa: E402

#: §8.2 says "72 mã–kỳ": the nine non-life symbols over eight quarters. The
#: acceptance workbook scores four of them; the regression uses the full eight
#: so a rule change is measured over two years rather than one.
REGRESSION_QUARTERS = 8
#: The non-financial control. BA names VLB as the case that must survive any
#: retuning, because its other income reconciles to pre-tax profit exactly.
CONTROL_SYMBOL = "VLB"


def _inputs(inc, sym, per, rule):
    def g(p, k):
        return (inc.get((sym, p)) or {}).get(k)
    prior = [X.shift(per, k) for k in range(1, 9)]
    return TriggerInput(
        symbol=sym, period=per,
        pbt=g(per, X.PBT), pbt_year_ago=g(X.shift(per, 4), X.PBT),
        prior_8q_pbt=[g(x, X.PBT) for x in prior],
        other_income=g(per, X.OTHER_INCOME),
        prior_8q_other_income=[g(x, X.OTHER_INCOME) for x in prior],
        other_income_year_ago=g(X.shift(per, 4), X.OTHER_INCOME),
        financial_income=g(per, X.FIN_INCOME),
        prior_8q_financial_income=[g(x, X.FIN_INCOME) for x in prior],
        is_financial_sector=True,
        # See the module docstring: True here is a THRESHOLD comparison, not the
        # live mapping. The live export passes False and T4 is unevaluable.
        other_income_is_pl_addend=True,
        t4_rule=rule)


def main():
    ap = argparse.ArgumentParser(description="BA §8.2 T4 v1 vs v2 regression")
    ap.add_argument("--json", help="write the full result table here")
    a = ap.parse_args()

    client = get_supabase_client()
    # §6 — the universe is READ, never hard-coded, exactly as the export reads
    # it: classified non-life, then narrowed to the symbols that actually hold
    # statements. `eligible_for_scoring` is decided downstream in the export, so
    # membership plus data is the right basis here and gives the same nine.
    universe = X.resolve_universe(client)
    candidates = [u["symbol"] for u in universe if u["belongs_to_nonlife_universe"]]
    latest = X.QUARTERS[-1]
    quarters = [X.shift(latest, k) for k in range(REGRESSION_QUARTERS - 1, -1, -1)]
    need = sorted({X.shift(q, k) for q in quarters for k in range(0, 9)})
    inc = X.load(client, candidates + [CONTROL_SYMBOL], need, "income", X.INCOME_KEYS)
    symbols = [s for s in candidates
               if any((s, q) in inc for q in quarters)]

    rows, v1_fired, v2_fired = [], [], []
    for s in symbols:
        for q in quarters:
            r1 = evaluate_triggers(_inputs(inc, s, q, T4_RULE_V1))["T4"]
            r2 = evaluate_triggers(_inputs(inc, s, q, T4_RULE_V2))["T4"]
            rows.append({"symbol": s, "period": q,
                         "v1_fired": r1.fired, "v1_detail": r1.detail,
                         "v2_fired": r2.fired, "v2_detail": r2.detail})
            if r1.fired:
                v1_fired.append((s, q))
            if r2.fired:
                v2_fired.append((s, q))

    dropped = [r for r in rows if r["v1_fired"] and not r["v2_fired"]]
    added = [r for r in rows if r["v2_fired"] and not r["v1_fired"]]

    print(f"BA §8.2 — so sánh T4 cũ (v1) và T4 mới (v2)")
    print(f"Phạm vi: {len(symbols)} mã x {len(quarters)} quý = {len(rows)} mã-kỳ "
          f"({quarters[0]} .. {quarters[-1]})")
    print(f"LƯU Ý: chạy với other_income_is_pl_addend=True để so sánh NGƯỠNG. "
          f"Bản chạy thật đặt False nên T4 không đánh giá được cho doanh nghiệp "
          f"bảo hiểm và cả hai luật đều kích hoạt 0.\n")
    print(f"  Số cảnh báo T4 CŨ (v1): {len(v1_fired)} / {len(rows)}")
    print(f"  Số cảnh báo T4 MỚI (v2): {len(v2_fired)} / {len(rows)}")
    print(f"  Bị loại khỏi cảnh báo:   {len(dropped)}")
    print(f"  Phát sinh mới:           {len(added)}")

    if dropped:
        print("\n  Danh sách trường hợp bị loại khỏi cảnh báo:")
        for r in dropped:
            print(f"    {r['symbol']} {r['period']}")
            print(f"      v1: {r['v1_detail']}")
            print(f"      v2: {r['v2_detail']}")
    if added:
        print("\n  Phát sinh mới (v2 kích hoạt mà v1 không):")
        for r in added:
            print(f"    {r['symbol']} {r['period']}  v2: {r['v2_detail']}")

    # ---- the non-financial control -------------------------------------
    print(f"\n  Kiểm chứng {CONTROL_SYMBOL} (doanh nghiệp phi tài chính, "
          f"bộ máy dùng chung):")
    ctrl = []
    for q in quarters:
        c1 = evaluate_triggers(_inputs(inc, CONTROL_SYMBOL, q, T4_RULE_V1))["T4"]
        c2 = evaluate_triggers(_inputs(inc, CONTROL_SYMBOL, q, T4_RULE_V2))["T4"]
        ctrl.append({"symbol": CONTROL_SYMBOL, "period": q,
                     "v1_fired": c1.fired, "v1_detail": c1.detail,
                     "v2_fired": c2.fired, "v2_detail": c2.detail})
        if c1.fired or c2.fired:
            print(f"    {q}: v1={'CÓ' if c1.fired else 'không'} "
                  f"v2={'CÓ' if c2.fired else 'không'}")
            print(f"      v2: {c2.detail}")
    still = [c for c in ctrl if c["v2_fired"]]
    print(f"    -> {CONTROL_SYMBOL} vẫn được phát hiện bởi v2: "
          f"{'CÓ' if still else 'KHÔNG'} ({len(still)} quý)")

    if a.json:
        Path(a.json).write_text(json.dumps(
            {"scope": {"symbols": list(symbols), "quarters": quarters,
                       "symbol_quarters": len(rows),
                       "other_income_is_pl_addend": True,
                       "note": "threshold comparison only; live run passes False"},
             "summary": {"v1_fired": len(v1_fired), "v2_fired": len(v2_fired),
                         "dropped": len(dropped), "added": len(added),
                         "control_symbol": CONTROL_SYMBOL,
                         "control_v2_detected_quarters": len(still)},
             "rows": rows, "control_rows": ctrl},
            ensure_ascii=False, indent=2) + "\n")
        print(f"\nwrote {a.json}")
    return 0 if still else 1


if __name__ == "__main__":
    sys.exit(main())
