"""Score Holding valuation /12 and assemble BVH/PVI into the tab score table.

BA `FINAL_BA_SPEC_HOLDING_VALUATION_HOLDING_UI_TOAN_NGANH_UI_2026-10-04.md`.

TWO WRITES, AND THE ORDER MATTERS. `fa_insurance_valuation_scores` takes the
working (current P/B, the 20-quarter median, n_valid, the window), and
`fa_insurance_tab_scores` takes the assembled Common/50 + Deep/38 +
Valuation/12 = Total/100 — the SAME table and the SAME arithmetic the non-life
and reinsurance tabs already use. Giving Holding its own total path would mean
two implementations of one rule, which is what made the securities tabs
disagree about a score twice.

THE DEEP SCORE IS READ, NEVER RECOMPUTED. `fa_insurance_deep_scores` was
written by the frozen Holding engine and §0 forbids touching it. This script
reads those rows, reads the common layer, adds the valuation it just scored,
and sums. Nothing here re-derives a percentile.

THE CRITERION SET IS A PROPERTY OF THE COMPANY, NOT THE TYPE. BVH scores B1-B4
and PVI P1-P4, so the internal codes are passed per symbol; a type-level
constant could only name one of the two and would score the other's block as
entirely missing.

Usage:
    python3 export_insurance_holding.py                 # dry run
    python3 export_insurance_holding.py --write
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa import holding as H
from fa import holding_valuation as HV
from fa import insurance_tab as T
from ta.common import get_supabase_client, paged_select, safe_execute

VALUATION_TABLE = "fa_insurance_valuation_scores"
TAB_TABLE = "fa_insurance_tab_scores"
PB_FIELD = "RT_VALUE_PB"
SYMBOLS = ("BVH", "PVI")
COMMON_VERSION = "INS_TOAN_NGANH_50_V1"

#: The valuation criterion's code per company. It sits in the same `criteria`
#: map as the deep metrics so the stored row carries one coherent record.
VALUATION_CODE = {"BVH": "B5", "PVI": "P5"}


def load_pb(client) -> dict[str, dict[str, float]]:
    rows = paged_select(
        lambda o, l: client.table("fa_vnstock_statements")
        .select(f"symbol,period,pb:items->{PB_FIELD}")
        .in_("symbol", list(SYMBOLS)).eq("period_type", "quarter")
        .eq("statement", "ratio").order("symbol").order("period")
        .range(o, o + l - 1), label="pb")
    out: dict[str, dict[str, float]] = {s: {} for s in SYMBOLS}
    for r in rows:
        if r["pb"] is not None:
            out[r["symbol"]][r["period"]] = float(r["pb"])
    return out


def load_deep(client) -> dict[tuple[str, str], dict[str, dict]]:
    """The frozen engine's stored component scores, by (symbol, period)."""
    rows = paged_select(
        lambda o, l: client.table("fa_insurance_deep_scores").select("*")
        .in_("symbol", list(SYMBOLS))
        .eq("scoring_version", H.HOLDING_SCORING_VERSION)
        .order("symbol").order("period").range(o, o + l - 1), label="deep")
    out: dict[tuple[str, str], dict[str, dict]] = {}
    for r in rows:
        out.setdefault((r["symbol"], r["period"]), {})[r["metric_code"]] = r
    return out


def load_common(client) -> dict[tuple[str, str], float]:
    return {(r["symbol"], r["period"]): r["score_50"] for r in paged_select(
        lambda o, l: client.table("fa_insurance_scores")
        .select("symbol,period,score_50").in_("symbol", list(SYMBOLS))
        .range(o, o + l - 1), label="common")}


def load_release_dates(client) -> dict[tuple[str, str], str]:
    """§6's `as_of_date`: the day the quarter's statements were published.

    THE SNAPSHOT DATE IS NOT THE QUARTER LABEL. Storing the label would make a
    look-ahead invisible, which is the whole reason §3.1 names the field.
    """
    try:
        rows = paged_select(
            lambda o, l: client.table("fa_statement_release_dates")
            .select("symbol,period,release_date").in_("symbol", list(SYMBOLS))
            .range(o, o + l - 1), label="release dates")
        return {(r["symbol"], r["period"]): r["release_date"] for r in rows
                if r.get("release_date")}
    except Exception as e:                       # noqa: BLE001
        print(f"   release dates unavailable ({type(e).__name__}); "
              f"as_of_date will be null")
        return {}


def build(client):
    pb = load_pb(client)
    deep = load_deep(client)
    common = load_common(client)
    released = load_release_dates(client)

    valuation_rows, tab_rows = [], []
    assembled: dict[tuple[str, str], T.TabScore] = {}

    # Every quarter the frozen deep engine produced, in order — the valuation
    # exists for a quarter only where the rest of the score does.
    periods = sorted({p for (_, p) in deep})

    for sym in SYMBOLS:
        codes = H.METRICS_BY_TICKER[sym]
        vcode = VALUATION_CODE[sym]
        for period in periods:
            metrics = deep.get((sym, period))
            if not metrics:
                continue

            v = HV.relative_pb(pb[sym], period)
            valuation_rows.append({
                "symbol": sym, "period": period,
                "as_of_date": released.get((sym, period)),
                "current_pb": v["current_pb"],
                "median_pb_20q": v["median_pb_20q"],
                "relative_pb": v["relative_pb"],
                "n_valid": v["n_valid"],
                "window_first": v["window_first"],
                "window_last": v["window_last"],
                "valuation_score": v["score"],
                "valuation_weight": HV.VALUATION_WEIGHT,
                "band_label": v["band"],
                "data_status": v["status"],
                "formula_version": HV.FORMULA_VERSION,
                "threshold_version": HV.THRESHOLD_VERSION,
                "mapping_version": HV.MAPPING_VERSION,
            })

            criteria = {}
            for code in codes:
                m = metrics.get(code, {})
                criteria[code] = {"value": m.get("current_value"),
                                  "band": None, "score": m.get("score"),
                                  "percentile": m.get("history_percentile"),
                                  "unit": m.get("unit"),
                                  "max": m.get("weight"),
                                  "status": m.get("data_status")}
            criteria[vcode] = {
                "value": v["relative_pb"], "band": v["band"], "score": v["score"],
                "unit": HV.UNIT_TEXT, "max": HV.VALUATION_WEIGHT,
                "formula": HV.FORMULA_TEXT, "bands": HV.band_text(),
                "current_pb": v["current_pb"], "median_pb_20q": v["median_pb_20q"],
                "n_valid": v["n_valid"], "status": v["status"],
            }

            s = T.assemble(sym, period, "HOLDING_MIXED", common.get((sym, period)),
                           criteria, internal_codes=tuple(codes),
                           valuation_codes=(vcode,))
            assembled[(sym, period)] = s

    for (sym, period), s in sorted(assembled.items()):
        prev = assembled.get((sym, _shift(period, 1)))
        pct, status = T.fa_change(s, prev, T.TOTAL_BASIS)
        fa_pct, fa_status = T.fa_change(s, prev, T.FA_BASIS)
        tab_rows.append({
            "symbol": sym, "period": period,
            "insurance_type_code": "HOLDING_MIXED",
            "common_score": s.common_score,
            "internal_change_score": s.internal_change_score,
            "valuation_score": s.valuation_score,
            "fa_score": s.fa_score, "total_score": s.total_score,
            "criteria": s.criteria,
            "previous_period": _shift(period, 1) if prev else None,
            "previous_fa_score": prev.fa_score if prev else None,
            "fa_change_pct": fa_pct, "fa_change_status": fa_status,
            "previous_total_score": prev.total_score if prev else None,
            "total_change_pct": pct, "total_change_status": status,
            "score_status": s.score_status,
            "blocked_reason": s.blocked_reason,
            "blocked_metrics": s.blocked_metrics,
            "common_score_version": COMMON_VERSION,
            "formula_version": H.HOLDING_FORMULA_VERSION,
            "band_version": H.HOLDING_SCORING_VERSION,
            "taxonomy_version": "INS_TAXONOMY_2026_10_02",
            "source_run_id": None,
        })
    return valuation_rows, tab_rows


def _shift(period: str, back: int) -> str:
    y, q = int(period[:4]), int(period[-1])
    t = y * 4 + (q - 1) - back
    return f"{t // 4}-Q{t % 4 + 1}"


def reconcile(valuation_rows, tab_rows) -> list[str]:
    """Every rule BA states, on every row. Any failure stops the write."""
    bad = []
    for r in valuation_rows:
        k = f"{r['symbol']} {r['period']}"
        # §3.3 — twenty observations or no score.
        if r["valuation_score"] is not None and r["n_valid"] != HV.N_REQUIRED:
            bad.append(f"{k}: scored on {r['n_valid']} observations")
        # §3.4 / NOT_SCORED != 0.
        if (r["data_status"] == "OK") != (r["valuation_score"] is not None):
            bad.append(f"{k}: status {r['data_status']} vs score {r['valuation_score']}")
        # The relative must equal the two figures it divides.
        if r["relative_pb"] is not None:
            want = r["current_pb"] / r["median_pb_20q"]
            if abs(r["relative_pb"] - want) > 1e-9:
                bad.append(f"{k}: relative does not reconcile")
            if HV.score(r["relative_pb"]) != r["valuation_score"]:
                bad.append(f"{k}: score disagrees with the band table")
        # §3.1 — the window may never reach past its own period.
        if r["window_last"] and r["window_last"] > r["period"]:
            bad.append(f"{k}: LOOK-AHEAD, window ends {r['window_last']}")
    for r in tab_rows:
        k = f"{r['symbol']} {r['period']}"
        if r["total_score"] is not None:
            parts = (r["common_score"] or 0) + (r["internal_change_score"] or 0) \
                + (r["valuation_score"] or 0)
            if abs(r["total_score"] - parts) > 1e-9:
                bad.append(f"{k}: total != parts")
            if not 0 <= r["total_score"] <= 100:
                bad.append(f"{k}: total out of range")
        if (r["total_change_pct"] is not None) != (r["total_change_status"] == "CALCULATED"):
            bad.append(f"{k}: delta pct/status disagree")
    return bad


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()

    issues = HV.audit_bands()
    if issues:
        raise SystemExit(f"threshold table disagrees with the spec: {issues}")
    print(f"§5 boundary table: PASS ({HV.THRESHOLD_VERSION})")

    client = get_supabase_client()
    valuation_rows, tab_rows = build(client)

    bad = reconcile(valuation_rows, tab_rows)
    if bad:
        raise SystemExit(f"FAIL_RECONCILIATION on {len(bad)}: {bad[:5]}")
    print(f"reconciliation: PASS on {len(valuation_rows)} valuation "
          f"and {len(tab_rows)} assembled rows")

    scored = [r for r in valuation_rows if r["valuation_score"] is not None]
    print(f"\nvaluation: {len(scored)}/{len(valuation_rows)} scored "
          f"({len(valuation_rows) - len(scored)} short of "
          f"{HV.N_REQUIRED} quarters)")
    for r in sorted(scored, key=lambda x: (x["symbol"], x["period"]))[-4:]:
        print(f"   {r['symbol']} {r['period']}: P/B {r['current_pb']:.4f} / "
              f"trung vị {r['median_pb_20q']:.4f} = {r['relative_pb']:.4f} lần "
              f"→ {r['valuation_score']}/12  ({r['band_label']})")

    done = [r for r in tab_rows if r["score_status"] == "SCORING_COMPLETE"]
    print(f"\n{len(tab_rows)} symbol-quarters · {len(done)} with a complete Total /100")
    for r in sorted(done, key=lambda x: (x["symbol"], x["period"]))[-4:]:
        print(f"   {r['symbol']} {r['period']}: "
              f"Nền tảng {r['common_score']:.0f}/50 "
              f"+ Năng lực {r['internal_change_score']:.2f}/38 "
              f"+ Định giá {r['valuation_score']:.0f}/12 "
              f"= Tổng FA {r['total_score']:.2f}/100")

    if not a.write:
        print("\ndry run: nothing written")
        return 0

    for table, rows, key in (
            (VALUATION_TABLE, valuation_rows,
             "symbol,period,formula_version,threshold_version"),
            (TAB_TABLE, tab_rows, "symbol,period,formula_version,band_version")):
        for i in range(0, len(rows), 100):
            safe_execute(client.table(table).upsert(rows[i:i + 100], on_conflict=key),
                         label=f"{table} upsert")
        print(f"wrote {len(rows)} rows to {table}")

    # Read back PINNED to this engine's versions: the tab table deliberately
    # keeps other types' rows, and an unpinned read would compare against them.
    back = safe_execute(client.table(TAB_TABLE)
                        .select("symbol,period,total_score")
                        .eq("formula_version", H.HOLDING_FORMULA_VERSION)
                        .eq("band_version", H.HOLDING_SCORING_VERSION),
                        label="readback").data or []
    want = {(r["symbol"], r["period"]): r["total_score"] for r in tab_rows}
    got = {(r["symbol"], r["period"]): r["total_score"] for r in back}
    # COMPARE AT THE COLUMN'S OWN PRECISION, NOT AT FLOAT EXACTNESS.
    # `total_score` is `numeric(6,2)` while the engine sums unrounded doubles:
    # BVH 2026-Q2 is 63.4543610547667 and stores as 63.45. Scoring still runs at
    # full precision (§26) — the percentile math is unrounded and only the
    # STORED result is at display precision — so an exact float comparison here
    # reports a mismatch against a write that is entirely correct. 0.005 is half
    # the column's last digit.
    TOL = 0.005
    miss = [k for k in want if k not in got
            or (want[k] is None) != (got[k] is None)
            or (want[k] is not None and abs(float(want[k]) - float(got[k])) > TOL)]
    if miss:
        raise SystemExit(f"read-back mismatch on {len(miss)}: {miss[:5]}")
    print("read-back matches exactly")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
