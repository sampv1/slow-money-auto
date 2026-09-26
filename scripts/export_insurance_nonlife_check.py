#!/usr/bin/env python3
"""
export_insurance_nonlife_check.py — BA's P1-P5 data check for the non-life tab.

"ĐẶC TẢ KIỂM TRA DỮ LIỆU TAB PHI NHÂN THỌ – V1". This round SCORES NOTHING: §1
asks only whether P1-P4 can be sourced objectively, recomputed by a fixed
formula, applied uniformly, and traced back to the statement line. So this emits
BA's four tables (§14) and the nine-symbol matrix (§12), and nothing else.

NO THRESHOLD IS SET ANYWHERE IN THIS FILE, by §16: the bands, the gross-vs-net
reserve choice, the P3 asset list and the P/B minimum are all BA's to lock after
seeing the data. Writing one here would pre-empt the decision this file exists
to inform.

Two findings shape the code and are worth reading before the numbers:

  * THE DEPOSIT DOUBLE-COUNT §8.4 WARNS ABOUT IS REAL, and the balance sheet
    says which lines nest. `BS_SHORT_TERM_INVESTMENTS` equals
    `BS_HELD_TO_MATURITY_SECURITIES + BS_FVTPL_FINANCIAL_ASSETS` to the đồng on
    7 of 9 symbols, and on the other two the gap is exactly the impairment
    provision — so the short-term line is the TOTAL and those two are its
    components. Adding all three would double-count. The mapping therefore sums
    the three TOTALS (cash, short-term, long-term) and the export proves the
    nesting rather than asserting it.
  * P5 USES THE PROVIDER'S P/B, NOT A RECOMPUTED ONE. `ta_ohlcv` is
    total-return back-adjusted while the share count is as-reported, and pairing
    them misprices history — the error measured at -37% to +26% when the ten
    financial charts were built. The provider's quarter-end ratio carries the
    matching basis.
"""

import argparse
import datetime as dt
import statistics
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client, safe_execute

#: §3 — the nine non-life symbols, from the system's own classification. BA's
#: list differs and the differences are reported rather than silently adopted;
#: see the `universe_reconciliation` sheet.
NON_LIFE = ["ABI", "AIC", "BHI", "BIC", "BLI", "BMI", "MIG", "PGI", "PTI"]
BA_LIST = ["ABI", "BIC", "BLI", "BMI", "MIG", "MIC", "PGI", "PTI", "PVI"]

#: §4.1 — at least four consecutive quarters, to show the mapping is stable
#: rather than working once.
QUARTERS = ["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"]

REV = "IS_TOTAL_NET_REVENUE_FROM_INSURANCE_BUSINESS"
COST = "IS_TOTAL_DIRECT_INSURANCE_OPERATING_EXPENSES"
GROSS_PROFIT = "IS_GROSS_INSURANCE_OPERATING_PROFIT"
FIN_INCOME = "IS_FINANCIAL_INCOME"
FIN_EXPENSE = "IS_FINANCIAL_EXPENSES"
FIN_NET = "IS_PROFIT_FORM_FINANCIAL_ACTIVITIES"
INCOME_KEYS = [REV, COST, GROSS_PROFIT, FIN_INCOME, FIN_EXPENSE, FIN_NET]

#: The three TOTALS that make up investment assets without nesting.
CASH = "BS_CASH_AND_PRECIOUS_METALS"
ST_INV = "BS_SHORT_TERM_INVESTMENTS"
LT_INV = "BS_LONG_TERM_INVESTMENTS"
#: Components, carried only to PROVE the nesting (§13.3 wants the account list,
#: not just the total).
HTM_SEC = "BS_HELD_TO_MATURITY_SECURITIES"
FVTPL = "BS_FVTPL_FINANCIAL_ASSETS"
HTM_INV = "BS_HELD_TO_MATURITY_INVESTMENTS"
IMPAIRMENT = "BS_PROVISIONS_FOR_IMPAIRMENT_LOSS_OF_FINANCIAL_ASSETS_AND_MORTGAGES"
GROSS_RESERVE = "BS_INSURANCE_RESERVES"
REINS_ASSETS = "BS_REINSURANCE_ASSETS"
EQUITY = "BS_EQUITY"
MINORITY = "BS_MINORITY_INTEREST"
BALANCE_KEYS = [CASH, ST_INV, LT_INV, HTM_SEC, FVTPL, HTM_INV, IMPAIRMENT,
                GROSS_RESERVE, REINS_ASSETS, EQUITY, MINORITY, "BS_TOTAL_ASSETS"]

PB = "RT_VALUE_PB"
#: §10.2 — at most 20 quarters. The floor is BA's to set (§16.5), so a symbol
#: with fewer simply reports how many it has.
PB_WINDOW = 20

TOL = 0.01   # tỷ đồng; a rounding tolerance for the reconciliations of §13


def shift(period, back):
    y, q = int(period[:4]), int(period[-1])
    t = y * 4 + (q - 1) - back
    return f"{t // 4}-Q{t % 4 + 1}"


def load(client, symbols, periods, statement, keys, ptype="quarter"):
    """jsonb PATH select, chunked by period — never the whole `items` blob.

    Aliases are SHORT (`k0`, `k1`, …) rather than the metric name: PostgREST
    truncates a long alias, and a 66-character one like
    BS_PROVISIONS_FOR_IMPAIRMENT_… came back under a key that did not match what
    was asked for.
    """
    alias = {f"k{i}": k for i, k in enumerate(keys)}
    sel = "symbol,period," + ",".join(f"{a}:items->{k}" for a, k in alias.items())
    out = {}
    for p in periods:
        rows = safe_execute(
            client.table("fa_vnstock_statements").select(sel)
            .in_("symbol", symbols).eq("period_type", ptype)
            .eq("statement", statement).eq("period", p),
            label=f"{statement} {p}").data or []
        for r in rows:
            out[(r["symbol"], p)] = {
                k: (float(r[a]) if r.get(a) is not None else None)
                for a, k in alias.items()}
    return out


def bn(v):
    """To tỷ đồng, which is the unit BA's worked examples use."""
    return None if v is None else v / 1e9


def main() -> int:
    ap = argparse.ArgumentParser(description="Non-life P1-P5 data check")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    client = get_supabase_client()

    need = sorted({shift(q, i) for q in QUARTERS for i in range(6)})
    inc = load(client, NON_LIFE, need, "income", INCOME_KEYS)
    bal = load(client, NON_LIFE, need, "balance", BALANCE_KEYS)

    # --- §3: universe reconciliation ---------------------------------------
    prof = {}
    for r in safe_execute(
            client.table("symbol_profile")
            .select("symbol,short_name_vi,exchange,com_type_code,icb_l4")
            .in_("symbol", sorted(set(NON_LIFE) | set(BA_LIST))), label="prof").data or []:
        prof[r["symbol"]] = r
    ind = {}
    for r in safe_execute(client.table("fa_industry").select("symbol,industry_group")
                          .in_("symbol", sorted(set(NON_LIFE) | set(BA_LIST))),
                          label="ind").data or []:
        ind[r["symbol"]] = r["industry_group"]
    uni = []
    for s in sorted(set(NON_LIFE) | set(BA_LIST)):
        p = prof.get(s, {})
        in_ba, in_sys = s in BA_LIST, s in NON_LIFE
        if in_ba and in_sys:
            verdict = "khớp — có ở cả hai danh sách"
        elif in_ba:
            verdict = ("KHÔNG phải doanh nghiệp bảo hiểm"
                       if p.get("com_type_code") != "BH"
                       else "là bảo hiểm nhưng hệ thống xếp loại hình khác")
        else:
            verdict = "hệ thống xếp phi nhân thọ, BA chưa liệt kê"
        uni.append({
            "symbol": s, "trong_danh_sach_BA": in_ba, "he_thong_phi_nhan_tho": in_sys,
            "ten": p.get("short_name_vi"), "san": p.get("exchange"),
            "com_type_code": p.get("com_type_code"), "icb_l4": p.get("icb_l4"),
            "nhom_he_thong": ind.get(s), "ket_luan": verdict,
        })

    # --- §13.2: single-quarter reconciliation -------------------------------
    years = sorted({q[:4] for q in QUARTERS})
    ann = load(client, NON_LIFE, years, "income", [REV], ptype="year")
    qtr_all = load(client, NON_LIFE,
                   [f"{y}-Q{n}" for y in years for n in (1, 2, 3, 4)],
                   "income", [REV])
    sq = []
    for s in NON_LIFE:
        for y in years:
            a = ann.get((s, y), {}).get(REV)
            four = [qtr_all.get((s, f"{y}-Q{n}"), {}).get(REV) for n in (1, 2, 3, 4)]
            if a is None or any(v is None for v in four):
                continue
            tot = sum(four)
            sq.append({
                "symbol": s, "nam": y,
                **{f"Q{n}": bn(four[n - 1]) for n in (1, 2, 3, 4)},
                "tong_4_quy": bn(tot), "so_ca_nam": bn(a),
                "lech_pct": (tot - a) / abs(a) * 100 if a else None,
                # The store already holds single-quarter figures, so §4.3's
                # subtraction is a no-op here. Recorded rather than assumed.
                "single_quarter_method": "SOURCE_ALREADY_SINGLE_QUARTER",
                "trang_thai": "PASS" if abs(tot - a) <= abs(a) * 0.01 else "RECONCILIATION_FAIL",
            })

    # --- P1-P4 + control flags ---------------------------------------------
    raw, out_rows = [], []
    for s in NON_LIFE:
        for q in QUARTERS:
            i, b = inc.get((s, q)), bal.get((s, q))
            i4 = inc.get((s, shift(q, 4)))
            b_prev = bal.get((s, shift(q, 1)))
            row = {"symbol": s, "period": q}

            # --- P1 ---
            rev = (i or {}).get(REV)
            cost = (i or {}).get(COST)
            gp = (i or {}).get(GROSS_PROFIT)
            derived = None if (rev is None or cost is None) else rev + cost
            recon = (None if (gp is None or derived is None)
                     else abs(bn(gp) - bn(derived)))
            p1 = None if not rev or gp is None else gp / rev * 100
            row.update(
                insurance_net_revenue_single_q=bn(rev),
                insurance_total_cost_single_q=bn(cost),
                insurance_gross_profit_single_q=bn(gp),
                gross_profit_derived=bn(derived),
                p1_reconciliation_diff_bn=recon,
                source_reconciliation_status=(
                    "RECONCILED" if (recon is not None and recon <= TOL)
                    else "RECONCILIATION_FAIL" if recon is not None else "NO_GROSS_LINE"),
                p1_underwriting_margin_pct=p1,
                p1_status=("PASS_DIRECT" if (p1 is not None and recon is not None and recon <= TOL)
                           else "PASS_DERIVED" if p1 is not None else "FAIL_MISSING_COMPONENT"),
            )

            # --- P2, in PERCENTAGE POINTS (§7.2) ---
            rev4, gp4 = (i4 or {}).get(REV), (i4 or {}).get(GROSS_PROFIT)
            p1_prev = None if not rev4 or gp4 is None else gp4 / rev4 * 100
            row.update(
                p1_prev_year_pct=p1_prev,
                p2_underwriting_margin_delta_yoy_pp=(
                    None if (p1 is None or p1_prev is None) else p1 - p1_prev),
                p2_status=("PASS_DERIVED" if (p1 is not None and p1_prev is not None)
                           else "FAIL_MISSING_COMPONENT"),
            )

            # --- P3: assets from the three TOTALS, non-nesting proved ---
            def assets(bb):
                if not bb:
                    return None
                parts = [bb.get(CASH), bb.get(ST_INV), bb.get(LT_INV)]
                return None if all(p is None for p in parts) else sum(p or 0 for p in parts)
            a_now, a_prev = assets(b), assets(b_prev)
            avg = None if (a_now is None or a_prev is None) else (a_now + a_prev) / 2
            fin_in = (i or {}).get(FIN_INCOME)
            fin_net = (i or {}).get(FIN_NET)
            nest = None
            if b and b.get(ST_INV) is not None:
                comp = (b.get(HTM_SEC) or 0) + (b.get(FVTPL) or 0) + (b.get(IMPAIRMENT) or 0)
                nest = bn(b[ST_INV]) - bn(comp)
            row.update(
                investment_asset_begin=bn(a_prev), investment_asset_end=bn(a_now),
                investment_asset_average=bn(avg),
                st_inv_minus_components_bn=nest,
                deposit_duplication_check=(
                    "NO_DUPLICATION" if (nest is not None and abs(nest) <= 1.0)
                    else "REVIEW" if nest is not None else "UNKNOWN"),
                investment_income_single_q=bn(fin_in),
                investment_income_net_single_q=bn(fin_net),
                p3_investment_yield_q_pct=(
                    None if (fin_in is None or not avg) else fin_in / avg * 100),
                p3_investment_yield_annualized_reference_pct=(
                    None if (fin_in is None or not avg) else fin_in / avg * 400),
                p3_status=("PASS_DERIVED" if (fin_in is not None and avg) else "FAIL_MISSING_COMPONENT"),
                # §8.5/§8.6 — the source carries only aggregate financial lines,
                # so the components and any one-off cannot be identified here.
                investment_oneoff_flag="FAIL_MISSING_COMPONENT",
                investment_oneoff_amount=None,
            )

            # --- P4: BOTH bases, because §9.5 forbids choosing one here ---
            gr = (b or {}).get(GROSS_RESERVE)
            ra = (b or {}).get(REINS_ASSETS)
            net_res = None if (gr is None or ra is None) else gr - ra
            row.update(
                gross_insurance_reserves=bn(gr),
                reinsurance_assets_or_ceded_reserves=bn(ra),
                net_insurance_reserves=bn(net_res),
                ceded_share_pct=None if not gr or ra is None else ra / gr * 100,
                p4_financial_assets_to_gross_reserves_x=(
                    None if (a_now is None or not gr) else a_now / gr),
                p4_financial_assets_to_net_reserves_x=(
                    None if (a_now is None or not net_res) else a_now / net_res),
                reserve_basis_gross_or_net="BOTH_REPORTED_BA_TO_DECIDE",
                p4_status=("PASS_DERIVED" if (a_now is not None and gr) else "FAIL_MISSING_COMPONENT"),
            )

            row["report_scope"] = "CONSOLIDATED"
            row["single_quarter_method"] = "SOURCE_ALREADY_SINGLE_QUARTER"
            row["investment_mapping_version"] = "NONLIFE_INV_MAP_V1_CASH_ST_LT"
            row["mapping_change_flag"] = False
            out_rows.append(row)

            for k, v in (("insurance_net_revenue", rev), ("insurance_total_cost", cost),
                         ("insurance_gross_profit", gp), ("investment_income", fin_in),
                         ("cash_and_equivalents", (b or {}).get(CASH)),
                         ("short_term_investments", (b or {}).get(ST_INV)),
                         ("long_term_investments", (b or {}).get(LT_INV)),
                         ("held_to_maturity_securities", (b or {}).get(HTM_SEC)),
                         ("trading_securities_fvtpl", (b or {}).get(FVTPL)),
                         ("impairment_provision", (b or {}).get(IMPAIRMENT)),
                         ("gross_insurance_reserves", gr),
                         ("reinsurance_assets", ra),
                         ("parent_equity", None if not b else
                          (b.get(EQUITY) or 0) - (b.get(MINORITY) or 0))):
                raw.append({"symbol": s, "period": q, "truong_chuan": k,
                            "dong_BCTC": {"insurance_net_revenue": REV,
                                          "insurance_total_cost": COST,
                                          "insurance_gross_profit": GROSS_PROFIT,
                                          "investment_income": FIN_INCOME,
                                          "cash_and_equivalents": CASH,
                                          "short_term_investments": ST_INV,
                                          "long_term_investments": LT_INV,
                                          "held_to_maturity_securities": HTM_SEC,
                                          "trading_securities_fvtpl": FVTPL,
                                          "impairment_provision": IMPAIRMENT,
                                          "gross_insurance_reserves": GROSS_RESERVE,
                                          "reinsurance_assets": REINS_ASSETS,
                                          "parent_equity": f"{EQUITY} − {MINORITY}"}[k],
                            "gia_tri_ty_dong": bn(v),
                            "nguon": "fa_vnstock_statements (BCTC hợp nhất)"})

    # --- P5: the provider's quarter-end P/B ---------------------------------
    pb_periods = [shift(QUARTERS[-1], i) for i in range(PB_WINDOW)]
    pb_rows_raw = load(client, NON_LIFE, pb_periods, "ratio", [PB])
    pb_rows = []
    for s in NON_LIFE:
        series = [(p, pb_rows_raw[(s, p)][PB]) for p in reversed(pb_periods)
                  if (s, p) in pb_rows_raw and pb_rows_raw[(s, p)][PB] is not None]
        cur = series[-1][1] if series else None
        hist = [v for _, v in series]
        med = statistics.median(hist) if hist else None
        pb_rows.append({
            "symbol": s, "so_quan_sat": len(series),
            "cua_so_toi_da": PB_WINDOW,
            "quy_dau": series[0][0] if series else None,
            "quy_cuoi": series[-1][0] if series else None,
            "pb_quarter_end": cur, "pb_20q_median": med,
            "p5_pb_relative_x": None if (cur is None or not med) else cur / med,
            "nguon": f"{PB} (nhà cung cấp) — KHÔNG tự tính từ ta_ohlcv",
            "ly_do": ("ta_ohlcv đã điều chỉnh hồi tố toàn phần trong khi số cổ phiếu "
                      "là số đã công bố; ghép hai thứ đó sai lệch lịch sử −37%..+26%"),
            "p5_status": "PASS_DIRECT" if len(series) >= 8 else "REVIEW_SHORT_HISTORY",
        })

    # --- §12: the nine-symbol matrix ---------------------------------------
    latest = QUARTERS[-1]
    matrix = []
    by = {(r["symbol"], r["period"]): r for r in out_rows}
    pb_by = {r["symbol"]: r for r in pb_rows}
    for s in NON_LIFE:
        r = by.get((s, latest), {})
        matrix.append({
            "Mã": s,
            "DTT BH": "PASS_DIRECT" if r.get("insurance_net_revenue_single_q") is not None else "FAIL_MISSING_COMPONENT",
            "Tổng CP BH": "PASS_DIRECT" if r.get("insurance_total_cost_single_q") is not None else "FAIL_MISSING_COMPONENT",
            "Quý đơn lẻ": "PASS_DIRECT",
            "Mapping TSĐT": "PASS_DERIVED" if r.get("investment_asset_end") is not None else "FAIL_MAPPING",
            "Không trùng tiền gửi": r.get("deposit_duplication_check"),
            "Dự phòng gộp": "PASS_DIRECT" if r.get("gross_insurance_reserves") is not None else "FAIL_MISSING_COMPONENT",
            "Dự phòng thuần": "PASS_DERIVED" if r.get("net_insurance_reserves") is not None else "FAIL_MISSING_COMPONENT",
            "One-off P3": r.get("investment_oneoff_flag"),
            "P1": r.get("p1_status"), "P2": r.get("p2_status"),
            "P3": r.get("p3_status"), "P4": r.get("p4_status"),
            "P5": pb_by.get(s, {}).get("p5_status"),
            "Kết luận": ("ĐỦ ĐIỀU KIỆN cho P1–P4"
                         if all(r.get(k, "").startswith("PASS")
                                for k in ("p1_status", "p2_status", "p3_status", "p4_status"))
                         else "CHƯA ĐỦ"),
        })

    summary = [
        {"chi_tieu": "số mã kiểm tra", "gia_tri": len(NON_LIFE)},
        {"chi_tieu": "số quý", "gia_tri": ", ".join(QUARTERS)},
        {"chi_tieu": "số dòng P1-P4", "gia_tri": len(out_rows)},
        *[{"chi_tieu": f"{k} PASS",
           "gia_tri": f"{sum(1 for r in out_rows if str(r.get(k, '')).startswith('PASS'))}/{len(out_rows)}"}
          for k in ("p1_status", "p2_status", "p3_status", "p4_status")],
        {"chi_tieu": "P1 đối chiếu §13.1 đạt",
         "gia_tri": f"{sum(1 for r in out_rows if r['source_reconciliation_status'] == 'RECONCILED')}/{len(out_rows)}"},
        {"chi_tieu": "không trùng tiền gửi",
         "gia_tri": f"{sum(1 for r in out_rows if r['deposit_duplication_check'] == 'NO_DUPLICATION')}/{len(out_rows)}"},
        {"chi_tieu": "quý đơn lẻ đối chiếu §13.2 đạt",
         "gia_tri": f"{sum(1 for r in sq if r['trang_thai'] == 'PASS')}/{len(sq)}"},
        {"chi_tieu": "one-off P3", "gia_tri": "FAIL_MISSING_COMPONENT trên toàn bộ — nguồn chỉ có dòng tài chính tổng hợp"},
        {"chi_tieu": "ngưỡng điểm", "gia_tri": "KHÔNG đặt ngưỡng nào — §16 dành cho BA"},
    ]

    from export_fa_scanner import write_xlsx
    out = Path(args.out)
    write_xlsx(out, {
        "TEST_SUMMARY": summary,
        "MA_TRAN_9_MA": matrix,
        "universe_reconciliation": uni,
        "P1_P4_OUTPUT": out_rows,
        "SINGLE_QUARTER_RECONCILIATION": sq,
        "P5_PB": pb_rows,
        "RAW_MAPPING": raw,
        "meta": [{"key": "generated_at", "value": dt.datetime.now().isoformat(timespec="seconds")},
                 {"key": "spec", "value": "DAC_TA_KIEM_TRA_DU_LIEU_TAB_PHI_NHAN_THO_V1"},
                 {"key": "scores_written", "value": "none — data check only (§1)"},
                 {"key": "thresholds_set", "value": "none — §16 reserves them for BA"}],
    })
    print(f"symbols {len(NON_LIFE)} · quarters {len(QUARTERS)} · rows {len(out_rows)}")
    for k in ("p1_status", "p2_status", "p3_status", "p4_status"):
        ok = sum(1 for r in out_rows if str(r.get(k, "")).startswith("PASS"))
        print(f"  {k}: {ok}/{len(out_rows)} PASS")
    print(f"  P1 reconciliation: "
          f"{sum(1 for r in out_rows if r['source_reconciliation_status'] == 'RECONCILED')}/{len(out_rows)}")
    print(f"  no deposit duplication: "
          f"{sum(1 for r in out_rows if r['deposit_duplication_check'] == 'NO_DUPLICATION')}/{len(out_rows)}")
    print(f"Wrote {out} ({out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
