"""Score R1-R5 for VNR and PRE and persist the assembled tab row.

BA `DAC_TA_CHOT_NGUONG_CHAM_DIEM_TAB_TAI_BAO_HIEM_V1_2026-10-04.md`, steps
B1-B10. The formulas were already locked in `fa/insurance_deep.py`; this adds
the thresholds (`fa/reinsurance_bands.py`), runs the history, reconciles and
writes `fa_insurance_tab_scores`.

R5 READS THE PROVIDER'S PER-QUARTER P/B, never a ratio reconstructed from
today's price. §7.2 forbids `current price / historical BVPS` by name, and that
is the easy mistake here because the result looks entirely reasonable —
`RT_VALUE_PB` is already "close of quarter t over BVPS of quarter t", which is
exactly the series the spec asks for.

EVERY ABSENCE KEEPS ITS OWN NAME (§10). `NOT_SCORED` is a metric that could not
be formed, `REVIEW_TRIGGERED` is a value we believe is a mapping fault, and 0
is a real score a weak company earns. Three states, never collapsed into a
nullable number.

Usage:
    python3 export_insurance_reinsurance.py                  # dry run + backtest
    python3 export_insurance_reinsurance.py --write
    python3 export_insurance_reinsurance.py --backtest out.csv
"""

from __future__ import annotations

import argparse
import csv
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa import insurance_deep as D
from fa import insurance_tab as T
from fa import reinsurance_bands as RB
from ta.common import get_supabase_client, paged_select, safe_execute

TABLE = "fa_insurance_tab_scores"
PB_FIELD = "RT_VALUE_PB"
COMMON_VERSION = "INS_TOAN_NGANH_50_V1"
#: §13 — 20 quarters of depth is the target; run everything verifiable.
HISTORY_QUARTERS = 24


def load(client, symbols, statement, keys):
    sel = "symbol,period," + ",".join(f"{k}:items->{k}" for k in keys)
    rows = paged_select(
        lambda o, l: client.table("fa_vnstock_statements").select(sel)
        .in_("symbol", symbols).eq("period_type", "quarter")
        .eq("statement", statement).order("symbol").order("period")
        .range(o, o + l - 1), label=f"{statement}")
    out: dict[tuple[str, str], dict] = {}
    for r in rows:
        out[(r["symbol"], r["period"])] = {
            k: (float(r[k]) if r[k] is not None else None) for k in keys}
    return out


def raw_metrics(sym, periods, inc, bal, pb):
    """R1-R5 raw values per quarter, each from its own locked formula."""
    margin: dict[str, float] = {}
    for p in periods:
        v = D.insurance_margin(inc.get((sym, p), {}))
        if v is not None:
            margin[p] = v

    out: dict[str, dict[str, float | None]] = {}
    for p in periods:
        r1 = margin.get(p)
        # R2 compares the SAME quarter a year earlier, by label (§4.2).
        prev = margin.get(D.shift(p, 4))
        r2 = None if (r1 is None or prev is None) else r1 - prev

        ret = D.retention(bal.get((sym, p), {}) | inc.get((sym, p), {}))
        r3 = ret.r3_written if ret.status == D.OK else None

        # R4 is TTM over average investable assets at the two window ends.
        q4 = [D.shift(p, i) for i in range(4)]
        nii = D.ttm([D.net_investment_income(inc.get((sym, q), {}), D.NII_NET)
                     for q in q4])
        begin = D.investment_assets(bal.get((sym, D.shift(p, 4)), {}))
        end = D.investment_assets(bal.get((sym, p), {}))
        avg = D.average_endpoints(
            begin.value if begin and begin.status == D.OK else None,
            end.value if end and end.status == D.OK else None)
        r4 = D.investment_yield(nii, avg)

        rel = D.pb_relative_asof(pb.get(sym, {}), p)
        r5 = rel.get("relative")

        out[p] = {"R1": r1, "R2": r2, "R3": r3, "R4": r4, "R5": r5,
                  "_pb_obs": rel.get("observations"),
                  "_pb_current": rel.get("current"),
                  "_pb_median": rel.get("median")}
    return out


def build(client):
    symbols = ["PRE", "VNR"]
    latest = "2026-Q2"
    periods = [D.shift(latest, i) for i in range(HISTORY_QUARTERS)][::-1]
    need = sorted(set(periods) | {D.shift(p, i) for p in periods for i in range(5)})

    inc = load(client, symbols, "income", list(D.INCOME_KEYS))
    bal = load(client, symbols, "balance", list(D.BALANCE_KEYS))
    pb_rows = load(client, symbols, "ratio", [PB_FIELD])
    pb: dict[str, dict[str, float]] = {s: {} for s in symbols}
    for (s, p), v in pb_rows.items():
        if v.get(PB_FIELD) is not None:
            pb[s][p] = v[PB_FIELD]

    common = {(r["symbol"], r["period"]): r["score_50"] for r in paged_select(
        lambda o, l: client.table("fa_insurance_scores")
        .select("symbol,period,score_50").in_("symbol", symbols)
        .range(o, o + l - 1), label="common")}

    assembled: dict[tuple[str, str], T.TabScore] = {}
    detail: dict[tuple[str, str], dict] = {}
    for sym in symbols:
        raws = raw_metrics(sym, need, inc, bal, pb)
        for p in periods:
            r = raws.get(p, {})
            criteria, statuses = {}, {}
            for code in ("R1", "R2", "R3", "R4", "R5"):
                score, status = RB.score_one(code, r.get(code))
                criteria[code] = {"value": r.get(code), "band": None, "score": score}
                statuses[code] = status
            s = T.assemble(sym, p, "REINSURANCE", common.get((sym, p)), criteria)
            assembled[(sym, p)] = s
            detail[(sym, p)] = {"raw": r, "status": statuses}
    return assembled, detail, periods, symbols


def rows_for_write(assembled, detail):
    out = []
    for (sym, p), s in sorted(assembled.items()):
        prev = assembled.get((sym, D.shift(p, 1)))
        pct, dstatus = T.fa_change(s, prev)
        st = detail[(sym, p)]["status"]
        flags = sorted({v for v in st.values() if v == RB.STATUS_REVIEW})
        out.append({
            "symbol": sym, "period": p, "insurance_type_code": "REINSURANCE",
            "common_score": s.common_score,
            "internal_change_score": s.internal_change_score,
            "valuation_score": s.valuation_score,
            "fa_score": s.fa_score, "total_score": s.total_score,
            "criteria": s.criteria,
            "previous_period": D.shift(p, 1) if prev else None,
            "previous_fa_score": prev.fa_score if prev else None,
            "fa_change_pct": pct, "fa_change_status": dstatus,
            "score_status": s.score_status,
            "blocked_reason": s.blocked_reason or (flags[0] if flags else None),
            "blocked_metrics": s.blocked_metrics,
            "common_score_version": COMMON_VERSION,
            "formula_version": RB.FORMULA_VERSION,
            "band_version": RB.THRESHOLD_VERSION,
            "taxonomy_version": "INS_TAXONOMY_2026_10_02",
            "source_run_id": None,
        })
    return out


def reconcile(rows):
    """§14.2 — every equation, on every row. Any failure stops the write."""
    bad = []
    for r in rows:
        c, i, v = r["common_score"], r["internal_change_score"], r["valuation_score"]
        if i is not None and not 0 <= i <= 38: bad.append((r["symbol"], r["period"], "internal range"))
        if v is not None and not 0 <= v <= 12: bad.append((r["symbol"], r["period"], "valuation range"))
        if r["fa_score"] is not None and abs(r["fa_score"] - (c + i)) > 1e-9:
            bad.append((r["symbol"], r["period"], "FA != Common+Internal"))
        if r["total_score"] is not None and abs(r["total_score"] - (r["fa_score"] + v)) > 1e-9:
            bad.append((r["symbol"], r["period"], "Total != FA+Valuation"))
        if r["total_score"] is not None and not 0 <= r["total_score"] <= 100:
            bad.append((r["symbol"], r["period"], "total range"))
    return bad


def backtest(rows, detail, path):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Quarter", "Ticker", "R1 raw", "R1", "R2 raw", "R2",
                    "R3 raw", "R3", "R4 raw", "R4", "R5 raw", "R5",
                    "Internal", "Common", "FA", "Total", "Status", "Flags"])
        for r in rows:
            c = r["criteria"]
            w.writerow([r["period"], r["symbol"]]
                       + [x for code in ("R1", "R2", "R3", "R4", "R5")
                          for x in (c[code]["value"], c[code]["score"])]
                       + [r["internal_change_score"], r["common_score"],
                          r["fa_score"], r["total_score"], r["score_status"],
                          r["blocked_reason"] or ""])
    # §13 — raw distribution per metric, for QA only. It never moves a band.
    print(f"\nraw distribution (QA only — does not change V1 thresholds)")
    print(f"   {'metric':6} {'n':>3} {'min':>9} {'P25':>9} {'median':>9} {'P75':>9} {'max':>9}")
    for code in ("R1", "R2", "R3", "R4", "R5"):
        vals = sorted(r["criteria"][code]["value"] for r in rows
                      if r["criteria"][code]["value"] is not None)
        if not vals:
            print(f"   {code:6} {0:>3}"); continue
        q = statistics.quantiles(vals, n=4) if len(vals) > 3 else [vals[0]] * 3
        print(f"   {code:6} {len(vals):>3} {vals[0]:9.2f} {q[0]:9.2f} "
              f"{statistics.median(vals):9.2f} {q[2]:9.2f} {vals[-1]:9.2f}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--backtest", help="write the §13 backtest table here")
    a = ap.parse_args()

    issues = RB.audit_bands()
    if issues:
        raise SystemExit(f"threshold table disagrees with the spec: {issues}")

    client = get_supabase_client()
    assembled, detail, periods, symbols = build(client)
    rows = rows_for_write(assembled, detail)

    bad = reconcile(rows)
    if bad:
        raise SystemExit(f"FAIL_RECONCILIATION on {len(bad)}: {bad[:5]}")
    print(f"§14.2 reconciliation: PASS on all {len(rows)} rows")

    done = [r for r in rows if r["score_status"] == "SCORING_COMPLETE"]
    print(f"\n{len(rows)} symbol-quarters · {len(done)} with a complete Total /100")
    for r in sorted(done, key=lambda x: (x["symbol"], x["period"]))[-6:]:
        c = r["criteria"]
        print(f"   {r['symbol']} {r['period']}: "
              f"R1 {c['R1']['score']}/12 R2 {c['R2']['score']}/10 "
              f"R3 {c['R3']['score']}/8 R4 {c['R4']['score']}/8 "
              f"→ Int {r['internal_change_score']:.0f}/38 + Com {r['common_score']:.0f}/50 "
              f"= FA {r['fa_score']:.0f}/88 + R5 {c['R5']['score']}/12 "
              f"= {r['total_score']:.0f}/100")

    if a.backtest:
        backtest(rows, detail, a.backtest)
        print(f"\nbacktest table -> {a.backtest}")

    if not a.write:
        print("\ndry run: nothing written")
        return 0

    for i in range(0, len(rows), 200):
        safe_execute(client.table(TABLE).upsert(
            rows[i:i + 200],
            on_conflict="symbol,period,formula_version,band_version"),
            label="reinsurance upsert")
    back = safe_execute(client.table(TABLE)
                        .select("symbol,period,total_score,score_status")
                        .eq("formula_version", RB.FORMULA_VERSION), label="readback").data or []
    want = {(r["symbol"], r["period"]): r["total_score"] for r in rows}
    got = {(r["symbol"], r["period"]): r["total_score"] for r in back}
    miss = [k for k in want if k not in got
            or (want[k] is None) != (got[k] is None)
            or (want[k] is not None and abs(float(want[k]) - float(got[k])) > 1e-9)]
    if miss:
        raise SystemExit(f"read-back mismatch on {len(miss)}: {miss[:5]}")
    print(f"\nwrote {len(rows)} rows; read-back matches exactly")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
