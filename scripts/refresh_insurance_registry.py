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
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import export_insurance_toan_nganh as TN
from fa import holding as H
from fa import insurance_deep as D
from fa import nonlife_bands as NB
from fa import reinsurance_bands as RB
from ta.common import get_supabase_client, safe_execute

#: How a criterion earns its points (migration 078).
#:
#: SELF_HISTORY_PERCENTILE IS NOT A BAND AND MUST NEVER BE CALLED ONE. BA §9 and
#: §35 forbid the words "band" and "ngưỡng tuyệt đối" for B1-B4/P1-P4, because
#: that tier scores `weight x percentile` against each company's OWN history —
#: there is no table of value ranges to publish, and printing one would be an
#: invention. The method travels as data so the tooltip never has to guess it
#: from a metric code's first letter.
BAND, TABLE_LOOKUP, PERCENTILE, UNRELEASED = (
    "ABSOLUTE_BAND", "FIXED_TABLE", "SELF_HISTORY_PERCENTILE", "NOT_RELEASED")

LIFE_LED, NONLIFE_LED = "LIFE_LED_HOLDING", "NONLIFE_REINSURANCE_HOLDING"


def _lines(xs):
    """A band list as the tooltip prints it. None where there is nothing to
    print, which the 078 check constraint then requires to be the percentile
    and not-released cases."""
    return "\n".join(xs) if xs else None

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
    # BA 04/10 §21 — the formula, unit and threshold list each criterion's
    # tooltip must show. The threshold TEXT is generated from the scorer's own
    # tables (`TN.band_text`), never typed out beside them.
    common = [
        ("C1", "Tăng trưởng EPS YoY",
         "(EPS quý này − EPS cùng kỳ năm trước) / |EPS cùng kỳ năm trước| × 100",
         "Lợi nhuận trên mỗi cổ phần đang cải thiện hay suy giảm so với cùng kỳ. "
         "Mẫu số lấy trị tuyệt đối nên chuyển lỗ thành lãi được đọc đúng dấu.",
         "EPS chuẩn hóa theo sự kiện cổ phiếu, quý t so với quý t−4"),
        ("C2", "Số quý EPS tăng trưởng",
         "Đếm số quý trong 3 quý gần nhất có EPS tăng so với cùng kỳ năm trước",
         "Đà tăng EPS có bền không, hay chỉ là một quý thuận lợi đơn lẻ.",
         "3 quý gần nhất, mỗi quý so với cùng kỳ năm trước"),
        ("C3", "Tăng trưởng doanh thu bảo hiểm YoY",
         "(Doanh thu bảo hiểm thuần quý này − cùng kỳ) / |cùng kỳ| × 100",
         "Quy mô nghiệp vụ bảo hiểm đang mở rộng hay thu hẹp.",
         "Quý t so với quý t−4"),
        ("C4", "ROE TTM cổ đông mẹ",
         "Lợi nhuận sau thuế cổ đông mẹ TTM / Vốn chủ sở hữu cổ đông mẹ bình quân × 100",
         "Hiệu quả sinh lời trên phần vốn thuộc về cổ đông công ty mẹ.",
         "Tử số TTM 4 quý; mẫu số bình quân hai đầu kỳ TTM"),
        ("C5", "Xu hướng đệm vốn",
         "(Đệm vốn quý này / Đệm vốn cùng kỳ − 1) × 100, "
         "với Đệm vốn = Vốn chủ sở hữu / Dự phòng nghiệp vụ bảo hiểm",
         "Lớp đệm vốn trên dự phòng nghiệp vụ đang dày lên hay mỏng đi. "
         "Đây là XU HƯỚNG, không phải mức tuyệt đối.",
         "Quý t so với quý t−4"),
    ]
    for code, name, formula, meaning, basis in common:
        out.append(row("COMMON", code, name, "COMMON_50", 10,
                       unit=TN.C_UNIT[code],
                       formula_text=formula,
                       economic_meaning=meaning,
                       period_basis=basis,
                       scoring_method=TABLE_LOOKUP if code == "C2" else BAND,
                       threshold_text=_lines(TN.band_text(code)),
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
                       unit=NB.UNIT_TEXT[code],
                       formula_text=NB.FORMULA_TEXT[code],
                       scoring_method=BAND,
                       threshold_text=_lines(NB.band_text(code)),
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
                       unit=RB.UNIT_TEXT[code],
                       formula_text=RB.FORMULA_TEXT[code],
                       scoring_method=BAND,
                       threshold_text=_lines(RB.band_text(code)),
                       formula_version=RB.FORMULA_VERSION,
                       band_version=RB.THRESHOLD_VERSION,
                       code_module="scripts/fa/reinsurance_bands.py · "
                                   "scripts/export_insurance_reinsurance.py",
                       source_document=f"{DOC}/YEU_CAU_IT_CHOT_R4_V2_VA_CHUAN_HOA_"
                                       f"GIAO_DIEN_BAO_HIEM_2026-10-04.md",
                       implementation_status="PRODUCTION_READY",
                       data_verification_status="VERIFIED",
                       acceptance_status="ACCEPTED",
                       note="V2 chỉ thay ngưỡng R4; R1, R2, R3, R5 giữ nguyên.",
                       owner="BA"))

    # --- Holding: TWO ENGINES, ONE PUBLIC CATEGORY -------------------------
    #
    # BVH and PVI sit in the same public category and are scored by two
    # different deep engines (BA 04/10 §2). Both sets live under
    # HOLDING_MIXED, so `engine_profile` is what keeps them apart — without it
    # the registry reads as one 76-point block, which is the misreading §11
    # forbids ("không dùng riêng điểm /38 để so sánh trực tiếp hai doanh
    # nghiệp"). PVI's P1-P4 were MISSING from this register entirely until now,
    # which is the same class of gap the register exists to catch.
    #
    # NO THRESHOLD TEXT ON ANY OF THEM. This tier scores `weight x percentile`
    # against the company's own history; there is no table of value ranges, and
    # §9 forbids captioning it as one. The 078 check constraint enforces that.
    holding = [
        (LIFE_LED, "B1", "Hiệu suất hoạt động tài chính TTM",
         "Lợi nhuận hoạt động tài chính TTM / Tài sản đầu tư bình quân × 100", "%",
         "Khối tài sản đầu tư đang sinh lời ở mức nào so với chính lịch sử của "
         "doanh nghiệp."),
        (LIFE_LED, "B2", "Δ Hiệu suất hoạt động tài chính YoY",
         "B1(t) − B1(t−4)", "ppt",
         "Hiệu suất đầu tư đang cải thiện hay suy giảm so với cùng kỳ. "
         "Đơn vị là điểm phần trăm, không phải tốc độ tăng trưởng."),
        (LIFE_LED, "B3", "Bao phủ tài sản đầu tư",
         "Tài sản đầu tư / Dự phòng nghiệp vụ bảo hiểm", "%",
         "Tài sản đầu tư phủ được bao nhiêu phần nghĩa vụ dự phòng. "
         "KHÔNG phải tỷ lệ an toàn vốn theo quy định."),
        (LIFE_LED, "B4", "Mức đệm vốn",
         "Vốn chủ sở hữu / Dự phòng nghiệp vụ bảo hiểm", "%",
         "Lớp đệm vốn chủ sở hữu trên nghĩa vụ dự phòng, đo ở MỨC tuyệt đối "
         "(khác C5, vốn đo XU HƯỚNG). KHÔNG phải tỷ lệ an toàn vốn theo quy định."),
        (NONLIFE_LED, "P1", "Biên lợi nhuận bảo hiểm TTM",
         "Lợi nhuận hoạt động bảo hiểm gộp TTM / Doanh thu bảo hiểm thuần TTM × 100",
         "%", "Nghiệp vụ bảo hiểm tự nó sinh lời ở mức nào, trước chi phí quản lý."),
        (NONLIFE_LED, "P2", "Δ Biên lợi nhuận bảo hiểm YoY",
         "P1(t) − P1(t−4)", "ppt",
         "Biên lợi nhuận nghiệp vụ đang cải thiện hay suy giảm so với cùng kỳ. "
         "Đơn vị là điểm phần trăm, không phải tốc độ tăng trưởng."),
        (NONLIFE_LED, "P3", "Hiệu suất hoạt động tài chính TTM",
         "Lợi nhuận hoạt động tài chính TTM / Tài sản đầu tư bình quân × 100", "%",
         "Khối tài sản đầu tư đang sinh lời ở mức nào so với chính lịch sử của "
         "doanh nghiệp."),
        (NONLIFE_LED, "P4", "Mức đệm vốn",
         "Vốn chủ sở hữu / Dự phòng nghiệp vụ bảo hiểm", "%",
         "Lớp đệm vốn chủ sở hữu trên nghĩa vụ dự phòng, đo ở MỨC tuyệt đối "
         "(khác C5, vốn đo XU HƯỚNG). KHÔNG phải tỷ lệ an toàn vốn theo quy định."),
    ]
    for profile, code, name, formula, unit, meaning in holding:
        out.append(row("HOLDING_MIXED", code, name, "INTERNAL_38", H.WEIGHTS[code],
                       engine_profile=profile,
                       unit=unit,
                       formula_text=formula,
                       economic_meaning=meaning,
                       period_basis="Giá trị hiện tại so với phân vị lịch sử "
                                    "của chính doanh nghiệp",
                       scoring_method=PERCENTILE,
                       threshold_text=None,
                       formula_version=H.HOLDING_FORMULA_VERSION,
                       band_version=H.HOLDING_SCORING_VERSION,
                       code_module="scripts/fa/holding.py",
                       source_document=f"{DOC}/FINAL_BA_SPEC_HOLDING_BVH_PVI_"
                                       f"IMPLEMENT_CLOSE_2026-10-01.md",
                       implementation_status="PRODUCTION_READY",
                       data_verification_status="VERIFIED",
                       acceptance_status="ACCEPTED",
                       minimum_history_required=H.MIN_N_VALID,
                       lookback_requirement="phân vị trên lịch sử của chính DN",
                       owner="BA"))

    # The Phase A H1-H5 design is recorded but is NOT what production runs.
    # Keeping it visible is the point of this register: the non-life bands sat
    # frozen in a module for weeks and were reported as not existing.
    h_names = {"H1": "Biên/Chất lượng sinh lời hoạt động bảo hiểm",
               "H2": "Δ Biên lợi nhuận bảo hiểm YoY",
               "H3": D.H3_LABEL_VI, "H4": "Đệm vốn bảo hiểm",
               "H5": "P/B hiện tại / trung vị P/B lịch sử"}
    for code, w in (("H1", 12), ("H2", 10), ("H3", 8), ("H4", 8), ("H5", 12)):
        out.append(row("HOLDING_MIXED", code, h_names[code],
                       "VALUATION_12" if code == "H5" else "INTERNAL_38", w,
                       engine_profile=None,
                       scoring_method=UNRELEASED,
                       formula_version=D.ENGINE_VERSION,
                       band_version=None,
                       code_module="scripts/fa/insurance_deep.py",
                       source_document=f"{DOC}/YEU_CAU_IT_CHAM_DIEM_TOAN_BO_TAB_BAO_HIEM_2026-10-02.md",
                       implementation_status="FORMULA_FROZEN",
                       note="Thiết kế Giai đoạn A, KHÔNG phải bản đang phát hành. "
                            "Bản 01/10 (B1-B4 / P1-P4) là bản chạy thật.",
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
                       scoring_method=UNRELEASED,
                       source_document=f"{DOC}/dac_ta_IT_tab_bao_hiem_va_nhan_tho.md",
                       implementation_status="DRAFT",
                       note="Universe = 0; lưu kiến trúc, không chấm.",
                       owner="BA"))
    return out


def main() -> int:
    rows = build()
    # Weights must reconcile per block before anything is written: 50/38/12.
    # RECONCILED PER ENGINE, NOT PER TYPE. BVH's B1-B4 and PVI's P1-P4 each sum
    # to 38 on their own and are never added together — summing them is exactly
    # the "two companies share one /38 block" reading BA §11 rules out. The
    # Phase A H1-H5 design is a third set and is reconciled as its own.
    def bucket(r):
        if r["insurance_type_code"] != "HOLDING_MIXED":
            return (r["insurance_type_code"], r["metric_group"], "")
        tag = r.get("engine_profile") or ("PHASE_A" if r["metric_code"][0] == "H" else "?")
        return ("HOLDING_MIXED", r["metric_group"], tag)

    by: dict[tuple, float] = {}
    for r in rows:
        by[bucket(r)] = by.get(bucket(r), 0) + r["weight"]
    for (tc, grp, tag), total in sorted(by.items()):
        want = {"COMMON_50": 50, "INTERNAL_38": 38, "VALUATION_12": 12}[grp]
        ok = total == want
        label = f"{tc}/{tag}" if tag else tc
        print(f"   {label:38} {grp:13} = {total:5.1f}  "
              f"{'OK' if ok else 'MISMATCH (want %s)' % want}")
        if not ok:
            raise SystemExit(f"weights do not reconcile for {label}/{grp}")

    client = get_supabase_client()

    # REUSE THE LIVE ROW'S `effective_from` RATHER THAN STAMPING TODAY'S.
    #
    # The primary key carries `effective_from` while a partial unique index
    # allows only ONE row per metric with `effective_to is null` — so writing a
    # new date inserts a second effective row and the index rejects the batch.
    # That is the table working as designed: a new effective_from means BA
    # issued a NEW VERSION of the criterion, and the old one has to be closed
    # off first.
    #
    # This run is not that. BA §21 calls the missing formula/unit/threshold
    # metadata "thiếu implementation, không phải business question mới" — the
    # criteria did not change, the register simply never carried the fields.
    # Stamping a new effective date would claim a definition changed on 04/10
    # when none did, which is the same fault as storing an effective date in a
    # column named for a publication date. So the live row is updated in place,
    # and only a genuinely NEW metric (PVI's P1-P4, absent until now) is
    # inserted with today's date.
    live = {(r["insurance_type_code"], r["metric_code"]): r["effective_from"]
            for r in (safe_execute(
                client.table(TABLE)
                .select("insurance_type_code,metric_code,effective_from")
                .is_("effective_to", "null"), label="live rows").data or [])}
    # A NEW ROW NEEDS AN EXPLICIT DATE, NOT THE COLUMN DEFAULT. PostgREST sends
    # a batch as ONE uniform column list, so a key missing from some rows is
    # transmitted as NULL for them rather than being left out for the default to
    # fill — which the NOT NULL then rejects, taking the whole batch with it.
    today = date.today().isoformat()
    added = 0
    for r in rows:
        key = (r["insurance_type_code"], r["metric_code"])
        if key in live:
            r["effective_from"] = live[key]
        else:
            r["effective_from"] = today
            added += 1
    print(f"\n{len(rows) - added} live rows updated in place, {added} new metric rows")

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
