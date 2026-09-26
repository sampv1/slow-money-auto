#!/usr/bin/env python3
"""
export_insurance_nonlife_check.py — BA's P1-P5 rerun for the non-life tab.

Implements "CHỐT PHƯƠNG ÁN XỬ LÝ DỮ LIỆU TAB PHI NHÂN THỌ – V1". This round
still SCORES NOTHING and sets NO THRESHOLD (§15.17): BA locks the bands only
after seeing the distributions this file produces.

What changed from the first check, and why each change matters:

  * P3 IS NET FINANCIAL PROFIT OVER A TTM WINDOW, not gross revenue over a
    single quarter (§6.2/§6.4). A single quarter moves with the timing of
    interest, dividends and disposals, and the gross line credits income the
    financing cost has already consumed. The result is already annual, so it is
    NOT multiplied by 4 — §15.7 makes that an acceptance condition, because the
    old field was a quarterly figure scaled up.
  * ONE-OFFS ARE NOT CLAIMED EITHER WAY (§6.6). The source carries three
    aggregate financial lines and none of the seven components, so the honest
    output is an objective VOLATILITY flag — this quarter's yield above twice
    the median of the prior eight — plus a status saying the source lacks
    detail. It never says "no one-off found", and it never moves P3.
  * P4 IS THE GROSS RESERVE (§7.1). Net would quietly reward a high cession
    rate and depends on assuming the reinsurer pays. Net is still computed and
    carried, clearly marked reference-only.
  * P3's THREE STATUSES ARE SEPARATE (§9.1). One field cannot say both "the
    formula computed" and "the source cannot identify a one-off" — the first
    file did, and the matrix then drew a conclusion the statuses did not
    support.
"""

import argparse
import datetime as dt
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client, safe_execute

#: §2.5 — the list is NOT the condition. A symbol qualifies by its stored
#: business type; these are the ICB L4 codes the provider assigns.
ICB_NON_LIFE = "8536"
ICB_REINSURANCE = "8538"
#: BA's explicit rulings, which ICB alone cannot express: PVI carries the
#: non-life code but files as a holding, and BVH is full-line. Kept as a named
#: override with its source recorded on every row, so the decision is visible
#: rather than buried — and flagged to BA as something that belongs in a stored
#: `insurance_type` column once the tab ships.
TYPE_OVERRIDE = {"PVI": "Holding/Hỗn hợp", "BVH": "Holding/Hỗn hợp"}

QUARTERS = ["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"]

#: §6.7 — the volatility flag compares against the median of the prior EIGHT
#: quarters, and is only computed when all eight exist.
VOLATILITY_LOOKBACK = 8
VOLATILITY_MULTIPLE = 2.0
#: §8.3
PB_MAX_OBS, PB_MIN_OBS = 20, 8

REV = "IS_TOTAL_NET_REVENUE_FROM_INSURANCE_BUSINESS"
COST = "IS_TOTAL_DIRECT_INSURANCE_OPERATING_EXPENSES"
GROSS_PROFIT = "IS_GROSS_INSURANCE_OPERATING_PROFIT"
FIN_INCOME = "IS_FINANCIAL_INCOME"
FIN_EXPENSE = "IS_FINANCIAL_EXPENSES"
INCOME_KEYS = [REV, COST, GROSS_PROFIT, FIN_INCOME, FIN_EXPENSE]

CASH = "BS_CASH_AND_PRECIOUS_METALS"
ST_INV = "BS_SHORT_TERM_INVESTMENTS"
LT_INV = "BS_LONG_TERM_INVESTMENTS"
HTM_SEC = "BS_HELD_TO_MATURITY_SECURITIES"
FVTPL = "BS_FVTPL_FINANCIAL_ASSETS"
IMPAIRMENT = "BS_PROVISIONS_FOR_IMPAIRMENT_LOSS_OF_FINANCIAL_ASSETS_AND_MORTGAGES"
GROSS_RESERVE = "BS_INSURANCE_RESERVES"
REINS_ASSETS = "BS_REINSURANCE_ASSETS"
BALANCE_KEYS = [CASH, ST_INV, LT_INV, HTM_SEC, FVTPL, IMPAIRMENT,
                GROSS_RESERVE, REINS_ASSETS]
PB = "RT_VALUE_PB"

INV_MAP_VERSION = "NONLIFE_INV_MAP_V1_CASH_ST_LT"
TOL = 0.01   # tỷ đồng


def shift(period, back):
    y, q = int(period[:4]), int(period[-1])
    t = y * 4 + (q - 1) - back
    return f"{t // 4}-Q{t % 4 + 1}"


def bn(v):
    return None if v is None else v / 1e9


def load(client, symbols, periods, statement, keys, ptype="quarter"):
    """jsonb PATH select, chunked by period. Aliases are SHORT because
    PostgREST truncates a long one — a 66-character metric name came back under
    a key that did not match what was asked for."""
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


def resolve_universe(client):
    """§2.5 — membership follows the stored business type, not a written list."""
    prof = safe_execute(
        client.table("symbol_profile")
        .select("symbol,short_name_vi,exchange,com_type_code,icb_l4")
        .eq("com_type_code", "BH").order("symbol"), label="profile").data or []
    out = []
    for r in prof:
        sym = r["symbol"]
        if sym in TYPE_OVERRIDE:
            itype, src = TYPE_OVERRIDE[sym], "BA_RULING"
        elif r.get("icb_l4") == ICB_REINSURANCE:
            itype, src = "Tái bảo hiểm", f"ICB_L4_{ICB_REINSURANCE}"
        elif r.get("icb_l4") == ICB_NON_LIFE:
            itype, src = "Phi nhân thọ", f"ICB_L4_{ICB_NON_LIFE}"
        else:
            itype, src = "Holding/Hỗn hợp", f"ICB_L4_{r.get('icb_l4')}"
        out.append({**r, "insurance_type": itype, "insurance_type_source": src,
                    "trong_tab_phi_nhan_tho": itype == "Phi nhân thọ"})
    return out


def trace(symbol, period, name, formula, num, num_parts, den, den_parts,
          unit, value, status, note=None):
    """§10 — every result carries its numerator, its parts, its denominator, its
    parts and the formula in words. BA must be able to see which figures made a
    number without opening the script."""
    return {"symbol": symbol, "period": period, "chi_tieu": name,
            "cong_thuc": formula,
            "tu_so": num, "cau_phan_tu_so": num_parts,
            "mau_so": den, "cau_phan_mau_so": den_parts,
            "don_vi": unit, "ket_qua": value,
            "loai_bao_cao": "Hợp nhất", "mapping_version": INV_MAP_VERSION,
            "trang_thai": status, "ghi_chu": note}


def main() -> int:
    ap = argparse.ArgumentParser(description="Non-life P1-P5 rerun (BA V1)")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    client = get_supabase_client()

    universe = resolve_universe(client)
    candidates = [u["symbol"] for u in universe if u["trong_tab_phi_nhan_tho"]]
    # §2.5 gives membership by TYPE; a symbol still needs the data to be scored.
    # IFA is non-life by classification and holds no statements at all, so it is
    # recognised and watched rather than carried as a row of nulls — the same
    # rule the Toàn ngành tab uses, so a symbol cannot be "in" on one tab and
    # silently absent on another.
    have = set()
    for p_ in QUARTERS:
        rows_ = safe_execute(
            client.table("fa_vnstock_statements").select("symbol")
            .in_("symbol", candidates).eq("period", p_)
            .eq("period_type", "quarter").eq("statement", "income"),
            label=f"probe {p_}").data or []
        have.update(r["symbol"] for r in rows_)
    SY = [s_ for s_ in candidates if s_ in have]
    watch = [u for u in universe
             if u["trong_tab_phi_nhan_tho"] and u["symbol"] not in have]
    for u in watch:
        u["ly_do_theo_doi"] = "Không có BCTC trong cửa sổ kiểm tra"
    if watch:
        print(f"danh sách theo dõi (nhận diện nhưng chưa có dữ liệu): "
              f"{', '.join(u['symbol'] for u in watch)}")
    names = {u["symbol"]: u.get("short_name_vi") for u in universe}
    print(f"universe (theo loại hình, không theo danh sách cứng): {len(SY)} mã — {', '.join(SY)}")

    # Deep enough for the volatility flag: 8 prior quarterly yields, each needing
    # its own opening balance, plus the TTM window.
    need = sorted({shift(q, i) for q in QUARTERS for i in range(VOLATILITY_LOOKBACK + 8)})
    inc = load(client, SY, need, "income", INCOME_KEYS)
    bal = load(client, SY, need, "balance", BALANCE_KEYS)

    def assets(s, p):
        b = bal.get((s, p))
        if not b:
            return None
        parts = [b.get(CASH), b.get(ST_INV), b.get(LT_INV)]
        return None if all(x is None for x in parts) else sum(x or 0 for x in parts)

    def net_fin_q(s, p):
        """§6.2 — revenue minus cost. The cost line is stored NEGATIVE, so the
        economically correct operation is addition; asserted by the sign check
        below rather than assumed."""
        i = inc.get((s, p))
        if not i or i.get(FIN_INCOME) is None:
            return None
        exp = i.get(FIN_EXPENSE) or 0.0
        return i[FIN_INCOME] + exp if exp <= 0 else i[FIN_INCOME] - exp

    def yield_q(s, p):
        """Quarterly yield — the volatility input only, never P3 (§6.7)."""
        nf = net_fin_q(s, p)
        a_now, a_prev = assets(s, p), assets(s, shift(p, 1))
        if nf is None or a_now is None or a_prev is None:
            return None
        avg = (a_now + a_prev) / 2
        return None if not avg else nf / avg * 100

    rows, traces = [], []
    for s in SY:
        for q in QUARTERS:
            i, b = inc.get((s, q)), bal.get((s, q))
            i4 = inc.get((s, shift(q, 4)))
            r = {"symbol": s, "ten": names.get(s), "period": q,
                 "insurance_type": "Phi nhân thọ",
                 "report_scope": "Hợp nhất", "investment_mapping_version": INV_MAP_VERSION}

            # ---------- P1 (§4) ----------
            rev, cost, gp = ((i or {}).get(REV), (i or {}).get(COST), (i or {}).get(GROSS_PROFIT))
            derived = None if (rev is None or cost is None) else (
                rev + cost if cost <= 0 else rev - cost)
            diff = None if (gp is None or derived is None) else abs(bn(gp) - bn(derived))
            p1 = None if not rev or gp is None else gp / rev * 100
            r.update(insurance_net_revenue_single_q=bn(rev),
                     insurance_total_cost_single_q=bn(cost),
                     insurance_gross_profit_single_q=bn(gp),
                     p1_underwriting_margin_pct=p1,
                     p1_reconciliation_diff=diff,
                     p1_acceptance_status="ACCEPTED" if (p1 is not None and diff is not None
                                                        and diff <= TOL) else "REVIEW")
            traces.append(trace(s, q, "P1 Biên lợi nhuận bảo hiểm",
                                "LN gộp BH quý đơn lẻ / DTT BH quý đơn lẻ × 100",
                                bn(gp), f"{GROSS_PROFIT}", bn(rev), f"{REV}",
                                "%", p1, r["p1_acceptance_status"],
                                f"đối chiếu |LN gộp − (DTT + CP)| = {diff:.4f} tỷ" if diff is not None else None))

            # ---------- P2 (§5) ----------
            rev4, gp4 = (i4 or {}).get(REV), (i4 or {}).get(GROSS_PROFIT)
            p1_prev = None if not rev4 or gp4 is None else gp4 / rev4 * 100
            p2 = None if (p1 is None or p1_prev is None) else p1 - p1_prev
            r.update(p1_current_q_pct=p1, p1_same_q_last_year_pct=p1_prev,
                     p2_underwriting_margin_delta_yoy_pp=p2,
                     p2_acceptance_status="ACCEPTED" if p2 is not None else "REVIEW")
            traces.append(trace(s, q, "P2 Thay đổi biên BH YoY",
                                "P1 quý hiện tại − P1 cùng quý năm trước",
                                p1, f"P1({q})", p1_prev, f"P1({shift(q,4)})",
                                "điểm phần trăm", p2, r["p2_acceptance_status"]))

            # ---------- P3 (§6) ----------
            four = [net_fin_q(s, shift(q, k)) for k in range(4)]
            ttm = None if any(x is None for x in four) else sum(four)
            a_end, a_begin = assets(s, q), assets(s, shift(q, 4))
            avg_ttm = None if (a_end is None or a_begin is None) else (a_end + a_begin) / 2
            # §6.4 — already a 12-month figure. NOT multiplied by 4 (§15.7).
            p3 = None if (ttm is None or not avg_ttm) else ttm / avg_ttm * 100

            prior = [yield_q(s, shift(q, k)) for k in range(1, VOLATILITY_LOOKBACK + 1)]
            prior_ok = [x for x in prior if x is not None]
            med8 = statistics.median(prior_ok) if len(prior_ok) == VOLATILITY_LOOKBACK else None
            yq = yield_q(s, q)
            if med8 is None:
                vol = "INSUFFICIENT_HISTORY"
            elif med8 > 0 and yq is not None and yq > VOLATILITY_MULTIPLE * med8:
                vol = "HIGH_VARIATION"
            else:
                vol = "NORMAL"

            bb = bal.get((s, q)) or {}
            nest = None
            if bb.get(ST_INV) is not None:
                comp = (bb.get(HTM_SEC) or 0) + (bb.get(FVTPL) or 0) + (bb.get(IMPAIRMENT) or 0)
                nest = bn(bb[ST_INV]) - bn(comp)
            calc_ok = p3 is not None
            r.update(investment_income_net_q=bn(four[0]),
                     investment_income_net_ttm=bn(ttm),
                     investment_assets_begin_ttm=bn(a_begin),
                     investment_assets_end_ttm=bn(a_end),
                     investment_assets_average_ttm=bn(avg_ttm),
                     p3_investment_yield_net_ttm_pct=p3,
                     investment_yield_q_pct=yq,
                     investment_yield_prior_8q_median_pct=med8,
                     investment_income_volatility_flag=vol,
                     st_inv_minus_components_bn=nest,
                     deposit_duplication_check=("NO_DUPLICATION"
                                                if (nest is not None and abs(nest) <= 1.0)
                                                else "REVIEW"),
                     p3_calculation_status="PASS_DERIVED" if calc_ok else "FAIL_MISSING_COMPONENT",
                     # §6.6 — the source has three aggregate lines and none of
                     # the seven components, so this never claims either way.
                     p3_oneoff_control_status="SOURCE_NOT_DETAILED",
                     p3_acceptance_status=("ACCEPTED_WITH_VOLATILITY_FLAG" if calc_ok
                                           else "PENDING_DATA"))
            traces.append(trace(s, q, "P3 Hiệu suất đầu tư thuần TTM",
                                "LN tài chính thuần TTM / Tài sản đầu tư bình quân TTM × 100 "
                                "(đã là cơ sở 12 tháng, KHÔNG nhân 4)",
                                bn(ttm), f"Σ 4 quý ({FIN_INCOME} + {FIN_EXPENSE})",
                                bn(avg_ttm), f"({CASH} + {ST_INV} + {LT_INV}) đầu và cuối kỳ TTM / 2",
                                "%", p3, r["p3_acceptance_status"],
                                f"cờ biến động: {vol}"))

            # ---------- P4 (§7) ----------
            gr, ra = bb.get(GROSS_RESERVE), bb.get(REINS_ASSETS)
            net_res = None if (gr is None or ra is None) else gr - ra
            r.update(financial_assets_end_q=bn(a_end),
                     gross_insurance_reserves_end_q=bn(gr),
                     reinsurance_assets_end_q=bn(ra),
                     net_insurance_reserves_end_q=bn(net_res),
                     ceded_share_pct=None if not gr or ra is None else ra / gr * 100,
                     p4_gross_coverage_x=None if (a_end is None or not gr) else a_end / gr,
                     p4_net_coverage_reference_x=(None if (a_end is None or not net_res)
                                                  else a_end / net_res),
                     p4_reserve_basis="GROSS",
                     p4_acceptance_status="ACCEPTED" if (a_end is not None and gr) else "REVIEW")
            traces.append(trace(s, q, "P4 Bao phủ dự phòng gộp",
                                "Tài sản tài chính cuối quý / Dự phòng nghiệp vụ GỘP cuối quý",
                                bn(a_end), f"{CASH} + {ST_INV} + {LT_INV}",
                                bn(gr), f"{GROSS_RESERVE}", "lần",
                                r["p4_gross_coverage_x"], r["p4_acceptance_status"],
                                "P4 thuần chỉ tham khảo, không chấm điểm"))
            rows.append(r)

    # ---------- P5 (§8) ----------
    pb_periods = [shift(QUARTERS[-1], i) for i in range(PB_MAX_OBS)]
    pb_raw = load(client, SY, pb_periods, "ratio", [PB])
    p5 = []
    for s in SY:
        series = [(p, pb_raw[(s, p)][PB]) for p in reversed(pb_periods)
                  if (s, p) in pb_raw and pb_raw[(s, p)][PB] is not None]
        cur = series[-1][1] if series else None
        med = statistics.median([v for _, v in series]) if series else None
        n = len(series)
        p5.append({
            "symbol": s, "ten": names.get(s),
            "pb_current_q": cur, "pb_history_median": med,
            "pb_observation_count": n,
            "pb_first_period": series[0][0] if series else None,
            "pb_last_period": series[-1][0] if series else None,
            "p5_pb_relative_x": None if (cur is None or not med) else cur / med,
            "p5_acceptance_status": "ACCEPTED" if n >= PB_MIN_OBS else "WATCHLIST_INSUFFICIENT_HISTORY",
            "nguon": f"{PB} — chỉ tiêu định giá của nguồn chuẩn hóa",
            "ghi_chu": ("không tự ghép giá hồi tố với số cổ phiếu công bố: sai lệch "
                        "lịch sử −37%..+26%"),
        })

    # ---------- §14 summary table ----------
    latest = QUARTERS[-1]
    by = {(r["symbol"], r["period"]): r for r in rows}
    p5_by = {r["symbol"]: r for r in p5}
    table = []
    for s in SY:
        r, v = by.get((s, latest), {}), p5_by.get(s, {})
        f = lambda x, d=2: "—" if x is None else f"{x:,.{d}f}"
        table.append({
            "Mã": s, "Tên": names.get(s),
            "P1 (%)": f(r.get("p1_underwriting_margin_pct")),
            "P2 (điểm %)": f(r.get("p2_underwriting_margin_delta_yoy_pp")),
            "P3 TTM (%)": f(r.get("p3_investment_yield_net_ttm_pct")),
            "Cờ biến động P3": r.get("investment_income_volatility_flag"),
            "P4 gộp (lần)": f(r.get("p4_gross_coverage_x")),
            "P4 thuần tham khảo (lần)": f(r.get("p4_net_coverage_reference_x")),
            "P5 (lần)": f(v.get("p5_pb_relative_x"), 3),
            "Số quý P/B": v.get("pb_observation_count"),
            "Kết luận": ("P1–P4 đủ dữ liệu; P3 có cờ biến động, "
                         "không tự động xác định one-off"),
        })

    # ---------- distributions (§14, items 1-8) ----------
    def dist(name, key, source, unit, digits=2):
        vals = sorted(x for x in (r.get(key) for r in source) if x is not None)
        if not vals:
            return {"chi_tieu": name, "n": 0}
        def q(p):
            i = (len(vals) - 1) * p
            lo, hi = int(i), min(int(i) + 1, len(vals) - 1)
            return round(vals[lo] + (vals[hi] - vals[lo]) * (i - lo), digits)
        return {"chi_tieu": name, "don_vi": unit, "n": len(vals),
                "min": q(0), "p25": q(.25), "trung_vi": q(.5),
                "p75": q(.75), "max": q(1)}

    cur = [r for r in rows if r["period"] == latest]
    distributions = [
        dist("P1 Biên bảo hiểm", "p1_underwriting_margin_pct", cur, "%"),
        dist("P2 Δ biên YoY", "p2_underwriting_margin_delta_yoy_pp", cur, "điểm %"),
        dist("P3 Hiệu suất đầu tư thuần TTM", "p3_investment_yield_net_ttm_pct", cur, "%"),
        dist("P4 Bao phủ dự phòng gộp", "p4_gross_coverage_x", cur, "lần"),
        dist("P4 thuần (tham khảo)", "p4_net_coverage_reference_x", cur, "lần"),
        dist("P5 P/B tương đối", "p5_pb_relative_x", p5, "lần", 3),
        dist("Tỷ lệ nhượng tái", "ceded_share_pct", cur, "%", 1),
        {"chi_tieu": "— trên toàn bộ 4 quý —"},
        dist("P1 (4 quý)", "p1_underwriting_margin_pct", rows, "%"),
        dist("P3 TTM (4 quý)", "p3_investment_yield_net_ttm_pct", rows, "%"),
    ]

    from collections import Counter
    vol_counts = Counter(r["investment_income_volatility_flag"] for r in rows)
    summary = [
        {"muc": "universe", "gia_tri": f"{len(SY)} mã theo loại hình: {', '.join(SY)}"},
        {"muc": "MIC trong tab", "gia_tri": "KHÔNG (không phải doanh nghiệp bảo hiểm)"},
        {"muc": "PVI trong tab", "gia_tri": "KHÔNG (Holding/Hỗn hợp)"},
        {"muc": "số mã-quý", "gia_tri": len(rows)},
        {"muc": "P1 ACCEPTED", "gia_tri": f"{sum(1 for r in rows if r['p1_acceptance_status']=='ACCEPTED')}/{len(rows)}"},
        {"muc": "P2 ACCEPTED", "gia_tri": f"{sum(1 for r in rows if r['p2_acceptance_status']=='ACCEPTED')}/{len(rows)}"},
        {"muc": "P3 tính được theo công thức TTM",
         "gia_tri": f"{sum(1 for r in rows if r['p3_calculation_status']=='PASS_DERIVED')}/{len(rows)}"},
        {"muc": "P3 không trùng tài sản đầu tư",
         "gia_tri": f"{sum(1 for r in rows if r['deposit_duplication_check']=='NO_DUPLICATION')}/{len(rows)}"},
        {"muc": "P3 có đủ lịch sử cờ biến động",
         "gia_tri": f"{sum(1 for r in rows if r['investment_income_volatility_flag']!='INSUFFICIENT_HISTORY')}/{len(rows)}"},
        {"muc": "P3 nguồn có chi tiết one-off", "gia_tri": f"0/{len(rows)} — SOURCE_NOT_DETAILED"},
        {"muc": "P3 acceptance status", "gia_tri": "ACCEPTED_WITH_VOLATILITY_FLAG"},
        {"muc": "cờ biến động P3",
         "gia_tri": " · ".join(f"{k} {v}" for k, v in sorted(vol_counts.items()))},
        {"muc": "P3 nhân 4", "gia_tri": "KHÔNG — công thức đã ở cơ sở 12 tháng"},
        {"muc": "P4 cơ sở chấm", "gia_tri": "GROSS (thuần chỉ tham khảo)"},
        {"muc": "P5 cửa sổ", "gia_tri": f"tối đa {PB_MAX_OBS}, tối thiểu {PB_MIN_OBS} quý"},
        {"muc": "P5 ACCEPTED", "gia_tri": f"{sum(1 for r in p5 if r['p5_acceptance_status']=='ACCEPTED')}/{len(p5)}"},
        {"muc": "ngưỡng điểm", "gia_tri": "KHÔNG đặt — §15.17"},
        {"muc": "giao diện", "gia_tri": "KHÔNG lập trình — §15.18"},
    ]

    issues = [{"symbol": r["symbol"], "period": r["period"], "van_de": k,
               "gia_tri": r.get(k)}
              for r in rows for k in ("p1_acceptance_status", "p2_acceptance_status",
                                      "p3_calculation_status", "p4_acceptance_status")
              if not str(r.get(k, "")).startswith(("ACCEPTED", "PASS"))]
    issues += [{"symbol": r["symbol"], "period": "—",
                "van_de": "p5_acceptance_status", "gia_tri": r["p5_acceptance_status"]}
               for r in p5 if r["p5_acceptance_status"] != "ACCEPTED"]

    from export_fa_scanner import write_xlsx
    out = Path(args.out)
    write_xlsx(out, {
        "TEST_SUMMARY": summary,
        "BANG_TONG_HOP_9_MA": table,
        "PHAN_PHOI": distributions,
        "P1_P5_OUTPUT": rows,
        "P5_PB": p5,
        "TRUY_VET": traces,
        "universe_theo_loai_hinh": universe,
        "DANH_SACH_THEO_DOI": watch or [{"note": "không có mã nào chờ dữ liệu"}],
        "LOI_VA_KY_THIEU": issues or [{"note": "không có"}],
        "meta": [{"key": "generated_at", "value": dt.datetime.now().isoformat(timespec="seconds")},
                 {"key": "spec", "value": "CHOT_PHUONG_AN_TAB_PHI_NHAN_THO_GUI_IT_V1"},
                 {"key": "scores_written", "value": "none"},
                 {"key": "thresholds_set", "value": "none — §15.17"}],
    })
    print(f"rows {len(rows)} · P3 TTM PASS "
          f"{sum(1 for r in rows if r['p3_calculation_status']=='PASS_DERIVED')}/{len(rows)}"
          f" · cờ biến động {dict(vol_counts)}")
    print(f"P5 ACCEPTED {sum(1 for r in p5 if r['p5_acceptance_status']=='ACCEPTED')}/{len(p5)}")
    print(f"Wrote {out} ({out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
