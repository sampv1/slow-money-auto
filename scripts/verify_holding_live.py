"""Live verification for the Holding tab: R1 formula reproduction, R7 cutoff,
R8 aggregation, accounting-semantic continuity, and the current scores.

Separate from `tests/test_holding_regression.py` because that suite must run
with no database. This one reads the real filings and proves the engine
reproduces them; it is the evidence BA's final pack cites.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa import holding as H
from fa import insurance_deep as D
from ta.common import get_supabase_client, safe_execute

TOL = 1e-6


def load(client, symbol, statement, keys):
    sel = "symbol,period," + ",".join(f"{k}:items->{k}" for k in keys)
    rows = safe_execute(
        client.table("fa_vnstock_statements").select(sel).eq("symbol", symbol)
        .eq("period_type", "quarter").eq("statement", statement).order("period"),
        label=f"{symbol} {statement}").data or []
    return {r["period"]: {k: (float(r[k]) if r[k] is not None else None)
                          for k in keys} for r in rows}


def build(client, symbol):
    inc = load(client, symbol, "income", D.INCOME_KEYS)
    bal = load(client, symbol, "balance", D.BALANCE_KEYS)
    series: dict[str, dict[str, float]] = {c: {} for c in H.METRICS_BY_TICKER[symbol]}

    fin_eff, margin = {}, {}
    for p in sorted(set(inc) | set(bal)):
        v = H.financial_efficiency(inc, bal, p)
        if v is not None:
            fin_eff[p] = v
        m = H.insurance_margin_ttm(inc, p)
        if m is not None:
            margin[p] = m

    for p in sorted(bal):
        cut_cov = H.VALID_FROM.get((symbol, "B3"))
        cut_buf = H.VALID_FROM.get((symbol, "B4") if symbol == "BVH" else (symbol, "P4"))
        if symbol == "BVH":
            if not (cut_cov and p < cut_cov):
                v = H.investment_coverage(bal, p)
                if v is not None:
                    series["B3"][p] = v
            if not (cut_buf and p < cut_buf):
                v = H.capital_buffer_level(bal, p)
                if v is not None:
                    series["B4"][p] = v
        else:
            v = H.capital_buffer_level(bal, p)
            if v is not None:
                series["P4"][p] = v

    if symbol == "BVH":
        series["B1"] = dict(fin_eff)
        series["B2"] = {p: d for p in sorted(fin_eff)
                        if (d := H.yoy_delta(fin_eff, p)) is not None}
    else:
        series["P1"] = dict(margin)
        series["P2"] = {p: d for p in sorted(margin)
                        if (d := H.yoy_delta(margin, p)) is not None}
        series["P3"] = dict(fin_eff)
    return inc, bal, series


def r1_formula_reproduction(symbol, inc, bal, series):
    """Recompute each metric from RAW FIELDS by hand and compare to the engine."""
    rows = []
    for code, s in series.items():
        periods = sorted(s)
        if not periods:
            continue
        picks = [periods[0], periods[len(periods) // 2], periods[-1]]
        for p in picks:
            engine = s[p]
            if code in ("B1", "P3"):
                q4 = [D.shift(p, i) for i in range(4)]
                num = sum(inc[q][D.FIN_NET] for q in q4)
                a = sum(bal[D.shift(p, 4)][k] for k in H.INVESTABLE_WHITELIST)
                b = sum(bal[p][k] for k in H.INVESTABLE_WHITELIST)
                manual = num / ((a + b) / 2) * 100
            elif code == "P1":
                q4 = [D.shift(p, i) for i in range(4)]
                manual = (sum(inc[q][D.GROSS_INSURANCE_PROFIT] for q in q4)
                          / sum(inc[q][D.NET_INSURANCE_REVENUE] for q in q4) * 100)
            elif code == "B3":
                manual = (sum(bal[p][k] for k in H.INVESTABLE_WHITELIST)
                          / bal[p][D.INSURANCE_RESERVES] * 100)
            elif code in ("B4", "P4"):
                manual = bal[p][D.EQUITY] / bal[p][D.INSURANCE_RESERVES] * 100
            elif code in ("B2", "P2"):
                base = series["B1" if code == "B2" else "P1"]
                manual = base[p] - base[D.shift(p, 4)]
            else:
                continue
            diff = abs(manual - engine)
            rows.append((code, p, manual, engine, diff, "PASS" if diff <= TOL else "FAIL"))
    return rows


def main():
    c = get_supabase_client()
    all_rows, totals = [], {}
    print("=" * 78)
    print("R1 — FORMULA REPRODUCTION (manual from raw fields vs engine)")
    print("=" * 78)
    print(f"{'metric':6s} {'period':9s} {'manual':>14s} {'engine':>14s} {'diff':>10s}  status")
    for sym in H.UNIVERSE:
        inc, bal, series = build(c, sym)
        rows = r1_formula_reproduction(sym, inc, bal, series)
        all_rows += rows
        for code, p, m, e, d, st in rows:
            print(f"{code:6s} {p:9s} {m:14.6f} {e:14.6f} {d:10.2e}  {st}")

        # R7 — reference set bounds
        print(f"\nR7 — {sym} reference sets")
        for code in H.METRICS_BY_TICKER[sym]:
            ps = sorted(series[code])
            cut = H.VALID_FROM.get((sym, code))
            bad = [p for p in ps if cut and p < cut]
            print(f"   {code}: first={ps[0]} last={ps[-1]} N={len(ps)} "
                  f"eff_windows={H.effective_history_windows(len(ps))} "
                  f"valid_from={cut or '-'} pre_cutoff_leak={len(bad)}")

        # scores
        scores = []
        for code in H.METRICS_BY_TICKER[sym]:
            vals = [series[code][p] for p in sorted(series[code])]
            cur = vals[-1] if vals else None
            scores.append(H.percentile_score(vals, cur, H.WEIGHTS[code], code))
        tot = H.deep_total(scores)
        totals[sym] = (scores, tot)

    print("\n" + "=" * 78)
    print("R8 — SCORES AND UNROUNDED AGGREGATION")
    print("=" * 78)
    for sym, (scores, tot) in totals.items():
        print(f"\n{sym} ({H.MODEL_BY_TICKER[sym]})")
        for s in scores:
            print(f"   {s.metric}: current={s.current:9.4f} rank={s.rank:5.1f} "
                  f"N={s.n_valid:3d} pct={s.percentile*100:6.2f}% "
                  f"score={s.score:7.4f}/{s.weight} ({s.status})")
        rounded = sum(round(s.score, 1) for s in scores)
        print(f"   DEEP_TOTAL (unrounded sum) = {tot:.4f}/38")
        print(f"   sum of rounded components  = {rounded:.4f}  "
              f"(drift {abs(tot - rounded):.4f})")

    fails = [r for r in all_rows if r[5] == "FAIL"]
    print("\n" + "=" * 78)
    print(f"R1 cases: {len(all_rows)}  PASS: {len(all_rows)-len(fails)}  FAIL: {len(fails)}")
    print(f"tolerance = {TOL}")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
