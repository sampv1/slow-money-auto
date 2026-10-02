"""Assemble and persist the insurance tab score — BA 02/10 §6 Bước 3/5/6.

TWO STAGES ON PURPOSE. `export_insurance_nonlife_check.py` is the verified
producer of P1-P5 raw values and band scores; this script joins that output to
the common layer, regroups it into BA's 38/12 architecture and writes
`fa_insurance_tab_scores`. Keeping them apart means the scoring engine BA has
already accepted is not edited to add a write path — the join is a named step
that can be re-run and diffed on its own.

THE REGROUPING IS A PARTITION, NOT A RESCORE. The non-life engine reports
`deep_score_50 = P1+..+P5`; BA's architecture puts P1-P4 in Internal/38 and P5
in Valuation/12. Same five numbers, different partition, and `Total` is
unchanged by it — asserted per row before anything is written.

Usage:
    python3 export_insurance_tab_scores.py --nonlife-workbook out.xlsx
    python3 export_insurance_tab_scores.py --nonlife-workbook out.xlsx --write
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import openpyxl

from fa import insurance_tab as T
from fa import nonlife_bands as NB
from ta.common import get_supabase_client, paged_select, safe_execute

TABLE = "fa_insurance_tab_scores"
COMMON_VERSION = "INS_TOAN_NGANH_50_V1"
NONLIFE_FORMULA = "NONLIFE_P1_P5_V1_TTM_GROSS"


def num(v):
    """The workbook puts a status STRING in a numeric column when a block could
    not be formed, so a cell is a figure only when it really is one."""
    return v if isinstance(v, (int, float)) else None


def read_nonlife(path: str) -> list[dict]:
    wb = openpyxl.load_workbook(path, read_only=True)
    rows = list(wb["DIEM_36_MA_QUY"].iter_rows(values_only=True))
    hdr = rows[0]
    return [dict(zip(hdr, r)) for r in rows[1:]]


def load_eligible(client) -> dict[str, str]:
    """Scoring universe only — an EXCLUDED symbol must never be scored (§3.2)."""
    rows = paged_select(lambda o, l: client.table("fa_insurance_classification")
                        .select("symbol,insurance_type,scoring_eligibility")
                        .is_("insurance_type_effective_to", "null").range(o, o + l - 1),
                        label="classification")
    return {r["symbol"]: r["insurance_type"]
            for r in rows if r["scoring_eligibility"] == "ELIGIBLE"}


def build(client, workbook: str) -> list[dict]:
    eligible = load_eligible(client)
    src = read_nonlife(workbook)

    # Keyed by (symbol, period) so ΔFA can look back a quarter in-memory.
    assembled: dict[tuple[str, str], T.TabScore] = {}
    detail: dict[tuple[str, str], dict] = {}

    for d in src:
        sym, per = d["symbol"], d["period"]
        if sym not in eligible:
            continue
        criteria = {}
        for code in NB.CRITERION_MAX:
            lo = code.lower()
            criteria[code] = {"value": num(d.get(f"{lo}_value")),
                              "band": d.get(f"{lo}_band"),
                              "score": num(d.get(f"{lo}_score"))}
        s = T.assemble(sym, per, "NON_LIFE", num(d.get("common_score_50")), criteria)
        assembled[(sym, per)] = s
        detail[(sym, per)] = d

        # Boundary check against the engine's own totals — a regrouping that
        # changed a number would be a defect, not a design choice.
        deep50 = num(d.get("deep_score_50"))
        if s.internal_change_score is not None and s.valuation_score is not None:
            if abs(s.internal_change_score + s.valuation_score - deep50) > 1e-9:
                raise RuntimeError(f"{sym} {per}: Internal+Valuation != deep_score_50")
        raw100 = num(d.get("fa_raw_100"))
        if s.total_score is not None and raw100 is not None:
            if abs(s.total_score - raw100) > 1e-9:
                raise RuntimeError(f"{sym} {per}: Total {s.total_score} != fa_raw_100 {raw100}")

    payload = []
    for (sym, per), s in sorted(assembled.items()):
        prev = assembled.get((sym, _shift(per, 1)))
        pct, status = T.fa_change(s, prev)
        d = detail[(sym, per)]
        payload.append({
            "symbol": sym, "period": per,
            "insurance_type_code": "NON_LIFE",
            "common_score": s.common_score,
            "internal_change_score": s.internal_change_score,
            "valuation_score": s.valuation_score,
            "fa_score": s.fa_score,
            "total_score": s.total_score,
            "criteria": {k: v for k, v in s.criteria.items()},
            "previous_period": _shift(per, 1) if prev else None,
            "previous_fa_score": prev.fa_score if prev else None,
            "fa_change_pct": pct,
            "fa_change_status": status,
            "score_status": s.score_status,
            "blocked_reason": s.blocked_reason,
            "blocked_metrics": s.blocked_metrics,
            "common_score_version": COMMON_VERSION,
            "formula_version": NONLIFE_FORMULA,
            "band_version": NB.SCORE_BANDS_VERSION,
            "taxonomy_version": "INS_TAXONOMY_2026_10_02",
            "source_run_id": d.get("run_id"),
        })
    return payload


def _shift(period: str, back: int) -> str:
    y, q = int(period[:4]), int(period[-1])
    t = y * 4 + (q - 1) - back
    return f"{t // 4}-Q{t % 4 + 1}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--nonlife-workbook", required=True)
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()

    client = get_supabase_client()
    payload = build(client, a.nonlife_workbook)

    complete = [p for p in payload if p["score_status"] == "SCORING_COMPLETE"]
    print(f"assembled {len(payload)} symbol-quarters · "
          f"{len(complete)} with a complete Total /100")
    for p in sorted(complete, key=lambda x: -x["total_score"])[:5]:
        print(f"   {p['symbol']} {p['period']}: Common {p['common_score']:.0f}/50 + "
              f"Internal {p['internal_change_score']:.0f}/38 = FA {p['fa_score']:.0f}/88 "
              f"+ Val {p['valuation_score']:.0f}/12 = {p['total_score']:.0f}/100")

    if not a.write:
        print("\ndry run: nothing written")
        return 0

    for i in range(0, len(payload), 200):
        safe_execute(client.table(TABLE).upsert(
            payload[i:i + 200],
            on_conflict="symbol,period,formula_version,band_version"),
            label="tab scores upsert")
    back = safe_execute(client.table(TABLE)
                        .select("symbol,period,total_score,score_status")
                        .eq("formula_version", NONLIFE_FORMULA), label="readback").data or []
    want = {(p["symbol"], p["period"]): p["total_score"] for p in payload}
    got = {(r["symbol"], r["period"]): r["total_score"] for r in back}
    bad = [k for k in want if k not in got
           or (want[k] is None) != (got[k] is None)
           or (want[k] is not None and abs(float(want[k]) - float(got[k])) > 1e-9)]
    if bad:
        raise RuntimeError(f"read-back mismatch on {len(bad)}: {bad[:5]}")
    print(f"\nwrote {len(payload)} rows; read-back matches exactly")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
