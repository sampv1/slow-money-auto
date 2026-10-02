"""Populate INSURANCE_SCORING_MASTER_REGISTRY — BA 02/10 §5, Bước 2.

ONE EFFECTIVE ROW PER METRIC, carrying both the business definition and WHERE
IT LIVES IN THE CODE. `code_module` and `source_document` are the two fields
this register exists for: the non-life P1-P5 bands sat frozen in
`fa/nonlife_bands.py` for weeks while the tab showed no score, and nothing in
any status table could reveal that — so they were reported as not existing.

`implementation_status` is per METRIC and never per tab (§5.1). A tab-level
status is exactly how a missing module hides behind a finished one.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa import holding as H
from fa import insurance_deep as D
from fa import nonlife_bands as NB
from ta.common import get_supabase_client, safe_execute

TABLE = "insurance_scoring_master_registry"
DOC = "data/fa/rubrics/insurance"


def row(tc, code, name, group, weight, **kw):
    base = dict(insurance_type_code=tc, metric_code=code, metric_name_vi=name,
                metric_group=group, weight=weight, implementation_status="DRAFT")
    base.update(kw)
    return base


def build() -> list[dict]:
    out: list[dict] = []

    # --- Common C1-C5 -----------------------------------------------------
    common = [("C1", "Tăng trưởng EPS YoY"), ("C2", "Số quý EPS tăng trưởng"),
              ("C3", "Tăng trưởng doanh thu bảo hiểm YoY"), ("C4", "ROE TTM"),
              ("C5", "Xu hướng đệm vốn")]
    for code, name in common:
        out.append(row("COMMON", code, name, "COMMON_50", 10,
                       formula_version="INS_TOAN_NGANH_50_V1",
                       band_version="ba_v2",
                       code_module="scripts/export_insurance_toan_nganh.py",
                       source_document=f"{DOC}/Dac_ta_IT_Tab_Bao_hiem_Ban_chot.md",
                       implementation_status="PRODUCTION_READY",
                       data_verification_status="VERIFIED",
                       acceptance_status="ACCEPTED",
                       # C2 is what bounds the scoreable range: it needs seven
                       # contiguous quarters and the EPS source starts 2024-Q2.
                       minimum_history_required=7 if code == "C2" else 5,
                       lookback_requirement="7 quý liên tiếp" if code == "C2" else "YoY",
                       owner="BA"))

    # --- Non-life P1-P5: bands FROZEN, scorer not yet joined to a table ----
    nl_names = {"P1": "Biên lợi nhuận bảo hiểm",
                "P2": "Thay đổi biên lợi nhuận bảo hiểm YoY",
                "P3": "Hiệu suất đầu tư thuần TTM",
                "P4": "Khả năng bao phủ dự phòng gộp",
                "P5": "P/B hiện tại so với trung vị lịch sử"}
    for code, w in NB.CRITERION_MAX.items():
        out.append(row("NON_LIFE", code, nl_names[code],
                       "VALUATION_12" if code == "P5" else "INTERNAL_38", w,
                       formula_version="NONLIFE_P1_P5_V1_TTM_GROSS",
                       band_version=NB.SCORE_BANDS_VERSION,
                       code_module="scripts/fa/nonlife_bands.py · "
                                   "scripts/export_insurance_nonlife_check.py",
                       source_document=f"{DOC}/CHOT_BAND_DIEM_P1_P5_PHI_NHAN_THO_GUI_IT.md",
                       implementation_status="BAND_FROZEN",
                       data_verification_status="VERIFIED",
                       minimum_history_required=20 if code == "P5" else 4,
                       lookback_requirement="trung vị P/B 8-20 kỳ" if code == "P5"
                                            else ("TTM 4 quý" if code == "P3" else "YoY"),
                       owner="BA"))

    # --- Reinsurance R1-R5: formulas locked, BANDS ARE BA'S STEP (Giai đoạn C)
    r_names = {"R1": "Biên lợi nhuận nghiệp vụ tái bảo hiểm",
               "R2": "Thay đổi biên lợi nhuận tái bảo hiểm YoY",
               "R3": "Tỷ lệ giữ lại rủi ro / nhượng tái tiếp",
               "R4": "Hiệu suất đầu tư tài sản bảo hiểm",
               "R5": "P/B hiện tại so với trung vị lịch sử"}
    for code, w in (("R1", 12), ("R2", 10), ("R3", 8), ("R4", 8), ("R5", 12)):
        out.append(row("REINSURANCE", code, r_names[code],
                       "VALUATION_12" if code == "R5" else "INTERNAL_38", w,
                       formula_version=D.ENGINE_VERSION,
                       band_version=None,
                       code_module="scripts/fa/insurance_deep.py",
                       source_document=f"{DOC}/Dac_ta_Tab_Tai_Bao_Hiem_Khoa_Quy_Tac_Gui_IT.md",
                       implementation_status="FORMULA_FROZEN",
                       note="Band là Giai đoạn C của BA; tài liệu khóa cấm IT tự đặt band.",
                       owner="BA"))

    # --- Holding: TWO designs coexist, and both are recorded ---------------
    # Recording only one would reproduce the failure this register exists to
    # stop. The 01/10 engine is what production runs; H1-H5 is the Phase A
    # design BA's 02/10 scoring request names.
    for code in H.METRICS_BY_TICKER["BVH"]:
        out.append(row("HOLDING_MIXED", code, code, "INTERNAL_38", H.WEIGHTS[code],
                       formula_version=H.HOLDING_FORMULA_VERSION,
                       band_version=H.HOLDING_SCORING_VERSION,
                       code_module="scripts/fa/holding.py",
                       source_document=f"{DOC}/FINAL_BA_SPEC_HOLDING_BVH_PVI_IMPLEMENT_CLOSE_2026-10-01.md",
                       implementation_status="PRODUCTION_READY",
                       data_verification_status="VERIFIED",
                       acceptance_status="ACCEPTED",
                       minimum_history_required=H.MIN_N_VALID,
                       lookback_requirement="phân vị trên lịch sử của chính DN",
                       note="Engine BVH. PVI dùng P1-P4 của cùng module.",
                       owner="BA"))
    h_names = {"H1": "Biên/Chất lượng sinh lời hoạt động bảo hiểm",
               "H2": "Δ Biên lợi nhuận bảo hiểm YoY",
               "H3": D.H3_LABEL_VI, "H4": "Đệm vốn bảo hiểm",
               "H5": "P/B hiện tại / trung vị P/B lịch sử"}
    for code, w in (("H1", 12), ("H2", 10), ("H3", 8), ("H4", 8), ("H5", 12)):
        out.append(row("HOLDING_MIXED", code, h_names[code],
                       "VALUATION_12" if code == "H5" else "INTERNAL_38", w,
                       formula_version=D.ENGINE_VERSION,
                       band_version=None,
                       code_module="scripts/fa/insurance_deep.py",
                       source_document=f"{DOC}/YEU_CAU_IT_CHAM_DIEM_TOAN_BO_TAB_BAO_HIEM_2026-10-02.md",
                       implementation_status="FORMULA_FROZEN",
                       note="Thiết kế Giai đoạn A. Khác bản 01/10 đang phát hành "
                            "về trọng số và tập metric; cần BA xác nhận bản phát hành.",
                       owner="BA"))

    # --- Life: architecture stored, universe is 0 -------------------------
    life = [("LIFE-1", "New Business Value / Profitability", 10),
            ("LIFE-2", "CSM Growth / Movement", 10),
            ("LIFE-3", "Persistency / Lapse Quality", 8),
            ("LIFE-4", "Solvency / Capital Adequacy", 10),
            ("LIFE-5", "Relative P/EV", 12)]
    for code, name, w in life:
        out.append(row("LIFE", code, name,
                       "VALUATION_12" if code == "LIFE-5" else "INTERNAL_38", w,
                       code_module=None, band_version=None, formula_version=None,
                       source_document=f"{DOC}/dac_ta_IT_tab_bao_hiem_va_nhan_tho.md",
                       implementation_status="DRAFT",
                       note="Universe = 0; lưu kiến trúc, không chấm.",
                       owner="BA"))
    return out


def main() -> int:
    rows = build()
    # Weights must reconcile per block before anything is written: 50/38/12.
    by: dict[tuple[str, str], float] = {}
    for r in rows:
        by[(r["insurance_type_code"], r["metric_group"])] = \
            by.get((r["insurance_type_code"], r["metric_group"]), 0) + r["weight"]
    for (tc, grp), total in sorted(by.items()):
        want = {"COMMON_50": 50, "INTERNAL_38": 38, "VALUATION_12": 12}[grp]
        # Holding carries TWO designs, so its internal block legitimately
        # doubles; everything else must land on its nominal maximum.
        ok = total == want or (tc == "HOLDING_MIXED" and grp == "INTERNAL_38" and total == 76)
        print(f"   {tc:14} {grp:13} = {total:5.1f}  {'OK' if ok else 'MISMATCH (want %s)' % want}")
        if not ok:
            raise SystemExit(f"weights do not reconcile for {tc}/{grp}")

    client = get_supabase_client()
    safe_execute(client.table(TABLE).upsert(
        rows, on_conflict="insurance_type_code,metric_code,effective_from"),
        label="registry upsert")
    back = safe_execute(client.table(TABLE).select("insurance_type_code,metric_code,"
                                                   "implementation_status"), label="readback").data or []
    print(f"\nwrote {len(rows)} metric rows; read back {len(back)}")
    from collections import Counter
    print("status mix:", dict(Counter(r["implementation_status"] for r in back)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
