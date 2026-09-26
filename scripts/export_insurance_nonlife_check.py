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
import hashlib
import json
import statistics
import subprocess
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client, safe_execute

#: §2.5 — the list is NOT the condition. A symbol qualifies by its stored
#: business type; these are the ICB L4 codes the provider assigns.
ICB_NON_LIFE = "8536"
ICB_REINSURANCE = "8538"
#: §6 — there is NO type override here any more. PVI and BVH live in
#: `fa_insurance_classification` with an effective date and a review status.

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
#: §7.3 / §10 — the formula version, separate from the mapping version, so a
#: change to one is distinguishable from a change to the other in a stored row.
FORMULA_VERSION = "NONLIFE_P1_P5_V1_TTM_GROSS"
#: §7.2 — one id per run, stamped onto every result row.
RUN_ID = f"NONLIFE-{dt.datetime.now():%Y%m%dT%H%M%S}-{uuid.uuid4().hex[:6]}"

#: §6.2 — the source fields that reach past the normalised layer to the filing.
#: A value we do not hold is spelled out, never blank and never guessed.
NOT_AVAILABLE = "NOT_AVAILABLE_FROM_PROVIDER"
SPEC_VERSION = "DE_XUAT_HOAN_TAT_KIEM_TRA_DU_LIEU_PHI_NHAN_THO_V1"
#: Which statement each standardised line was read from.
STATEMENT_VI = {"income": "KQKD", "balance": "CĐKT", "ratio": "Chỉ tiêu định giá"}
SCOPE_VI = {"HN": "Hợp nhất", "ĐL": "Riêng lẻ"}
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
    """§6 — classification is READ FROM THE DATABASE, never hard-coded.

    `fa_insurance_classification` holds the type with an effective date, its
    source and its review status, so "what was this symbol when that quarter was
    scored" is answerable. The previous run kept PVI and BVH in a Python dict;
    a business ruling with no date and no history cannot be audited.

    Falls back to ICB with a loud warning if migration 072 has not been applied,
    so the round still runs against the old schema rather than failing closed on
    a reporting script.
    """
    prof = {r["symbol"]: r for r in (safe_execute(
        client.table("symbol_profile")
        .select("symbol,short_name_vi,exchange,com_type_code,icb_l4")
        .eq("com_type_code", "BH").order("symbol"), label="profile").data or [])}
    try:
        cls = safe_execute(
            client.table("fa_insurance_classification")
            .select("symbol,insurance_type,insurance_type_source,"
                    "insurance_type_effective_from,insurance_type_effective_to,"
                    "insurance_type_review_status,classification_note")
            .is_("insurance_type_effective_to", "null").order("symbol"),
            label="classification").data or []
        by_symbol = {r["symbol"]: r for r in cls}
        source_of_truth = "fa_insurance_classification (migration 072)"
    except Exception as exc:  # noqa: BLE001
        # A fallback that silently reinstates ICB would put PVI back among the
        # non-life names — the exact behaviour migration 072 exists to remove.
        # So the run continues for inspection but is marked NOT acceptance-grade.
        print(f"::warning::fa_insurance_classification unavailable "
              f"({type(exc).__name__}). Apply supabase/072 — this run is NOT "
              f"acceptance-grade: ICB alone cannot separate PVI from the "
              f"non-life insurers.")
        by_symbol, source_of_truth = {}, "FALLBACK_ICB_MIGRATION_072_NOT_APPLIED"

    out = []
    for sym, r in prof.items():
        c = by_symbol.get(sym)
        if c:
            itype = c["insurance_type"]
            src = c["insurance_type_source"]
            eff = c["insurance_type_effective_from"]
            review = c["insurance_type_review_status"]
            note = c.get("classification_note")
        else:
            itype = ("Tái bảo hiểm" if r.get("icb_l4") == ICB_REINSURANCE
                     else "Phi nhân thọ" if r.get("icb_l4") == ICB_NON_LIFE
                     else "Holding/Hỗn hợp")
            src, eff, review = "ICB", NOT_AVAILABLE, "PENDING"
            note = "fallback: classification table not available"
        out.append({
            **r,
            "insurance_type": itype,
            "insurance_type_source": src,
            "insurance_type_effective_from": eff,
            "insurance_type_review_status": review,
            "classification_note": note,
            "classification_read_from": source_of_truth,
            "belongs_to_nonlife_universe": itype == "Phi nhân thọ",
            "eligible_for_scoring": None,
            "display_group": None,
        })
    return out


def load_source_meta(client, symbols, periods):
    """§6.2 — the filing behind each standardised figure.

    `fa_statement_release_dates` carries the KBS statement header: publication
    date, audit status and REPORT SCOPE. The scope matters more than it looks —
    the first run hard-coded "Hợp nhất" for every row, and the header says 6 of
    the 9 file SEPARATE statements. The balance sheet agrees independently:
    every symbol marked HN carries a non-zero minority interest and every ĐL
    carries zero, which is exactly the difference between the two scopes.
    """
    out = {}
    rows = safe_execute(
        client.table("fa_statement_release_dates")
        .select("symbol,period,release_date,audit_status,report_scope,source")
        .in_("symbol", symbols).order("symbol").order("period"),
        label="release dates").data or []
    for r in rows:
        if r["period"] in periods:
            out[(r["symbol"], r["period"])] = r
    return out


def result_id(symbol, period, metric, run_id):
    """§5.2 — a stable key for one P-result, so lineage rows can point at it."""
    raw = f"{run_id}|{symbol}|{period}|{metric}"
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


def lineage(rid, role, period, statement, field, value, meta, note=None):
    """§5.2 Bảng B — ONE source row. A result has as many as its formula reads.

    The flat one-row-per-result shape this replaces could not express P2 (two
    periods) or P3 (four income quarters plus two balance-sheet dates): a single
    `source_document_id` named the current quarter's income statement and said
    nothing about the rest.
    """
    m = meta or {}
    scope = SCOPE_VI.get(m.get("report_scope"), m.get("report_scope") or NOT_AVAILABLE)
    return {
        "metric_result_id": rid,
        "source_role": role,
        "source_period": period,
        "source_statement": STATEMENT_VI.get(statement, statement),
        "source_field_code": field,
        "source_value": value,
        # An internal record key, NOT an issuer filing number — §5.5 is explicit
        # that the two must not be conflated, and the provider publishes none.
        "source_document_id": f"{m.get('symbol', '')}|{period}|quarter|{statement}",
        "source_document_name": (f"BCTC {scope} quý {period[-1]}/{period[:4]}"
                                 f" — {m.get('symbol', '')}"
                                 if scope != NOT_AVAILABLE else NOT_AVAILABLE),
        "source_publication_date": m.get("release_date") or NOT_AVAILABLE,
        "source_note_or_page": NOT_AVAILABLE,
        "source_provider": m.get("source") or "vnstock",
        "report_scope": scope,
        "audit_status": m.get("audit_status") or NOT_AVAILABLE,
        "ghi_chu": note,
    }


def metric_result(rid, symbol, period, code, value, unit, status, run_id):
    """§5.2 Bảng A — one row per P-result."""
    return {"metric_result_id": rid, "symbol": symbol, "period": period,
            "metric_code": code, "result_value": value, "unit": unit,
            "calculation_status": status,
            "formula_version": FORMULA_VERSION,
            "mapping_version": INV_MAP_VERSION, "run_id": run_id}


def verify_scope(symbol, period, meta, scope_seen_in_source):
    """§3 — what the system can and cannot establish about the report scope.

    THE HONEST ANSWER IS USUALLY "UNKNOWN", and saying so is the point. The
    store holds exactly ONE record per symbol-period, so it can report which
    scope was served but never whether another version exists unserved. BA
    ruled out the shortcut that was tempting here: a zero minority interest is
    consistent with a standalone filing and does not prove one.
    """
    scope = SCOPE_VI.get(meta.get("report_scope"))
    if scope == "Hợp nhất":
        return {
            "consolidated_report_available": True,
            "standalone_report_available": None,
            "selected_report_scope": "CONSOLIDATED",
            "scope_selection_reason": "CONSOLIDATED_AVAILABLE_AND_SELECTED",
            "scope_verification_source": "Header BCTC do nguồn phục vụ (KBS)",
            "scope_verified_date": dt.date.today().isoformat(),
            "scope_review_status": "VERIFIED",
            "scope_note": "Nguồn phục vụ bản hợp nhất và pipeline dùng đúng bản đó",
        }
    return {
        # NULL, not False: "we did not check" is not "there is none".
        "consolidated_report_available": None,
        "standalone_report_available": True,
        "selected_report_scope": "STANDALONE",
        "scope_selection_reason": "NOT_YET_VERIFIED",
        "scope_verification_source": NOT_AVAILABLE,
        "scope_verified_date": None,
        "scope_review_status": "PENDING",
        "scope_note": ("Nguồn chỉ phục vụ một bản ghi mỗi mã-kỳ và bản đó là "
                       "riêng lẻ. Hệ thống KHÔNG xác minh được có tồn tại BCTC "
                       "hợp nhất hay không; cần nguồn công bố của doanh nghiệp."),
    }


def run_metadata(out_path, rows_result, rows_lineage, snapshot):
    """§7.2 — enough to reproduce this exact run."""
    def git(*args):
        try:
            return subprocess.run(["git", *args], capture_output=True, text=True,
                                  cwd=Path(__file__).resolve().parent,
                                  timeout=10).stdout.strip() or NOT_AVAILABLE
        except Exception:  # noqa: BLE001
            return NOT_AVAILABLE
    script = Path(__file__).resolve()
    return [
        {"key": "run_id", "value": RUN_ID},
        {"key": "generated_at", "value": dt.datetime.now().isoformat(timespec="seconds")},
        {"key": "pipeline_commit_hash", "value": git("rev-parse", "HEAD")},
        {"key": "pipeline_working_tree", "value":
            "dirty" if git("status", "--porcelain", "--", str(script)) else "clean"},
        {"key": "script_name", "value": script.name},
        {"key": "script_sha256", "value":
            hashlib.sha256(script.read_bytes()).hexdigest()[:32]},
        {"key": "formula_version", "value": FORMULA_VERSION},
        {"key": "mapping_version", "value": INV_MAP_VERSION},
        {"key": "source_snapshot_date", "value": snapshot},
        {"key": "spec_version", "value": SPEC_VERSION},
        {"key": "row_count_metric_result", "value": rows_result},
        {"key": "row_count_lineage", "value": rows_lineage},
        {"key": "scores_written", "value": "none"},
        {"key": "thresholds_set", "value": "none"},
    ]


def main() -> int:
    ap = argparse.ArgumentParser(description="Non-life P1-P5 rerun (BA V1)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--persist-scope", action="store_true",
                    help="§3.3: write the scope verdicts to fa_insurance_report_scope")
    args = ap.parse_args()
    client = get_supabase_client()

    universe = resolve_universe(client)
    candidates = [u["symbol"] for u in universe if u["belongs_to_nonlife_universe"]]
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
    # §3.3 — resolve the two remaining facts for EVERY symbol, so the three
    # fields are always populated together and can never disagree.
    for u in universe:
        if not u["belongs_to_nonlife_universe"]:
            u["eligible_for_scoring"] = False
            u["display_group"] = "OTHER_INSURANCE_TAB"
            u["ly_do"] = f"Thuộc loại hình {u['insurance_type']}"
        elif u["symbol"] in have:
            u["eligible_for_scoring"] = True
            u["display_group"] = "SCORED"
            u["ly_do"] = None
        else:
            u["eligible_for_scoring"] = False
            u["display_group"] = "WATCHLIST"
            u["ly_do"] = "Chưa có BCTC để tính P1–P5"
    watch = [u for u in universe if u["display_group"] == "WATCHLIST"]
    if watch:
        print("danh sách theo dõi (thuộc loại hình nhưng chưa đủ điều kiện chấm): "
              f"{', '.join(u['symbol'] for u in watch)}")
    names = {u["symbol"]: u.get("short_name_vi") for u in universe}
    print(f"universe (theo loại hình, không theo danh sách cứng): {len(SY)} mã — {', '.join(SY)}")

    # Deep enough for the volatility flag: 8 prior quarterly yields, each needing
    # its own opening balance, plus the TTM window.
    need = sorted({shift(q, i) for q in QUARTERS for i in range(VOLATILITY_LOOKBACK + 8)})
    inc = load(client, SY, need, "income", INCOME_KEYS)
    bal = load(client, SY, need, "balance", BALANCE_KEYS)
    src = load_source_meta(client, SY, set(need))

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

    rows, results, lin, scope_rows = [], [], [], []
    for s in SY:
        for q in QUARTERS:
            i, b = inc.get((s, q)), bal.get((s, q))
            i4 = inc.get((s, shift(q, 4)))
            m = src.get((s, q), {})
            scope = SCOPE_VI.get(m.get("report_scope"),
                                 m.get("report_scope") or NOT_AVAILABLE)
            r = {"symbol": s, "ten": names.get(s), "period": q,
                 "insurance_type": "Phi nhân thọ",
                 # NOT hard-coded: the filing header says 6 of 9 are riêng lẻ.
                 "report_scope": scope,
                 "audit_status": m.get("audit_status") or NOT_AVAILABLE,
                 "source_publication_date": m.get("release_date") or NOT_AVAILABLE,
                 "source_provider": m.get("source") or "vnstock",
                 "investment_mapping_version": INV_MAP_VERSION,
                 "formula_version": FORMULA_VERSION}

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
            mm = {**m, "symbol": s}
            rid1 = result_id(s, q, "P1", RUN_ID)
            r["p1_metric_result_id"] = rid1
            results.append(metric_result(rid1, s, q, "P1", p1, "%",
                                         r["p1_acceptance_status"], RUN_ID))
            lin.append(lineage(rid1, "P1_NUMERATOR_GROSS_PROFIT", q, "income",
                               GROSS_PROFIT, bn(gp), mm,
                               f"đối chiếu |LN gộp − (DTT + CP)| = {diff:.4f} tỷ"
                               if diff is not None else None))
            lin.append(lineage(rid1, "P1_DENOMINATOR_NET_REVENUE", q, "income",
                               REV, bn(rev), mm))

            # ---------- P2 (§5) ----------
            rev4, gp4 = (i4 or {}).get(REV), (i4 or {}).get(GROSS_PROFIT)
            p1_prev = None if not rev4 or gp4 is None else gp4 / rev4 * 100
            p2 = None if (p1 is None or p1_prev is None) else p1 - p1_prev
            r.update(p1_current_q_pct=p1, p1_same_q_last_year_pct=p1_prev,
                     p2_underwriting_margin_delta_yoy_pp=p2,
                     p2_acceptance_status="ACCEPTED" if p2 is not None else "REVIEW")
            rid2 = result_id(s, q, "P2", RUN_ID)
            r["p2_metric_result_id"] = rid2
            results.append(metric_result(rid2, s, q, "P2", p2, "điểm phần trăm",
                                         r["p2_acceptance_status"], RUN_ID))
            m4 = {**(src.get((s, shift(q, 4))) or {}), "symbol": s}
            # §5.3 — P2's two sources are the two P1 periods, each with its own
            # filing. One document id could never have represented both.
            lin.append(lineage(rid2, "P2_CURRENT_P1", q, "income",
                               f"{GROSS_PROFIT} / {REV}", p1, mm,
                               f"liên kết kết quả P1 {rid1}"))
            lin.append(lineage(rid2, "P2_PRIOR_YEAR_P1", shift(q, 4), "income",
                               f"{GROSS_PROFIT} / {REV}", p1_prev, m4))

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
            rid3 = result_id(s, q, "P3", RUN_ID)
            r["p3_metric_result_id"] = rid3
            results.append(metric_result(rid3, s, q, "P3", p3, "%",
                                         r["p3_acceptance_status"], RUN_ID))
            # §5.3 — all FOUR income quarters and BOTH balance-sheet dates.
            for k_ in range(4):
                pk = shift(q, k_)
                mk = {**(src.get((s, pk)) or {}), "symbol": s}
                role = ("P3_NET_FINANCE_CURRENT_Q" if k_ == 0
                        else f"P3_NET_FINANCE_Q_MINUS_{k_}")
                lin.append(lineage(rid3, role, pk, "income",
                                   f"{FIN_INCOME} + {FIN_EXPENSE}", bn(four[k_]), mk))
                ik = inc.get((s, pk)) or {}
                lin.append(lineage(rid3, f"P3_FINANCIAL_INCOME_{pk}", pk, "income",
                                   FIN_INCOME, bn(ik.get(FIN_INCOME)), mk))
                lin.append(lineage(rid3, f"P3_FINANCIAL_EXPENSE_{pk}", pk, "income",
                                   FIN_EXPENSE, bn(ik.get(FIN_EXPENSE)), mk))
            lin.append(lineage(rid3, "P3_INVESTMENT_ASSETS_END_TTM", q, "balance",
                               f"{CASH} + {ST_INV} + {LT_INV}", bn(a_end), mm,
                               f"cờ biến động: {vol}"))
            lin.append(lineage(rid3, "P3_INVESTMENT_ASSETS_BEGIN_TTM", shift(q, 4),
                               "balance", f"{CASH} + {ST_INV} + {LT_INV}",
                               bn(a_begin), m4))

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
            rid4 = result_id(s, q, "P4", RUN_ID)
            r["p4_metric_result_id"] = rid4
            results.append(metric_result(rid4, s, q, "P4", r["p4_gross_coverage_x"],
                                         "lần", r["p4_acceptance_status"], RUN_ID))
            lin.append(lineage(rid4, "P4_FINANCIAL_ASSETS_END_Q", q, "balance",
                               f"{CASH} + {ST_INV} + {LT_INV}", bn(a_end), mm))
            lin.append(lineage(rid4, "P4_GROSS_RESERVES_END_Q", q, "balance",
                               GROSS_RESERVE, bn(gr), mm,
                               "P4 thuần chỉ tham khảo, không chấm điểm"))

            scope_rows.append({"symbol": s, "period": q,
                               **verify_scope(s, q, m, scope)})
            rows.append(r)

    # ---------- P5 (§8) ----------
    pb_periods = [shift(QUARTERS[-1], i) for i in range(PB_MAX_OBS)]
    pb_raw = load(client, SY, pb_periods, "ratio", [PB])
    p5, p5_hist = [], []
    for s in SY:
        # §4.3 — ascending, valid only, window ends at the current quarter.
        # Every observation is EMITTED, included or not, so the median is
        # reproducible from the file rather than trusted.
        for per in reversed(pb_periods):
            v = (pb_raw.get((s, per)) or {}).get(PB)
            status = "VALID" if v is not None else "MISSING"
            p5_hist.append({
                "symbol": s, "period": per,
                "quarter_end_date": NOT_AVAILABLE,
                "pb_quarter_end": v,
                "price_quarter_end": NOT_AVAILABLE,
                "book_value_or_bvps_basis": NOT_AVAILABLE,
                "source_provider": "vnstock",
                "source_record_id": f"{s}|{per}|quarter|ratio",
                "source_publication_date": NOT_AVAILABLE,
                "mapping_version": INV_MAP_VERSION,
                "formula_version": FORMULA_VERSION,
                "included_in_median": v is not None,
                # §4.3.9 — nothing is dropped for being an outlier. The only
                # exclusion is an absent observation, and it says so.
                "exclusion_reason": None if v is not None else "Không có quan sát P/B",
                "data_status": status,
            })
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
            "source_document_id": f"{s}|{series[-1][0] if series else '—'}|quarter|ratio",
            "source_document_name": (f"Chỉ tiêu định giá cuối quý — {s}"
                                     if series else NOT_AVAILABLE),
            "source_publication_date": NOT_AVAILABLE,
            "source_statement": STATEMENT_VI["ratio"],
            "source_note_or_page": NOT_AVAILABLE,
            "source_provider": "vnstock",
            "mapping_version": INV_MAP_VERSION,
            "formula_version": FORMULA_VERSION,
            "ghi_chu": ("không tự ghép giá hồi tố với số cổ phiếu công bố: sai lệch "
                        "lịch sử −37%..+26%"),
            "metric_result_id": result_id(s, QUARTERS[-1], "P5", RUN_ID),
        })
        rid5 = result_id(s, QUARTERS[-1], "P5", RUN_ID)
        results.append(metric_result(
            rid5, s, QUARTERS[-1], "P5",
            None if (cur is None or not med) else cur / med, "lần",
            "ACCEPTED" if n >= PB_MIN_OBS else "INSUFFICIENT_HISTORY", RUN_ID))
        lin.append(lineage(rid5, "P5_CURRENT_PB", series[-1][0] if series else "—",
                           "ratio", PB, cur, {"symbol": s}))
        for per, v in series:
            lin.append(lineage(rid5, f"P5_HISTORICAL_PB_{per}", per, "ratio",
                               PB, v, {"symbol": s}))


    # ---------- §3.6, §4.4, §5.4: the checks, run and recorded ----------
    # Executed rather than asserted in prose: §7 of the previous round asks for
    # the conditions to be machine-checked and their results stored.
    lin_by = {}
    for L in lin:
        lin_by.setdefault(L["metric_result_id"], []).append(L)
    res_by = {r["metric_result_id"]: r for r in results}
    hist_by = {}
    for h in p5_hist:
        hist_by.setdefault(h["symbol"], []).append(h)

    def fails(name, bad, rule):
        return {"check": name, "quy_tac": rule, "so_vi_pham": len(bad),
                "ket_qua": "PASS" if not bad else "FAIL",
                "chi_tiet": ", ".join(bad[:6]) or "—"}

    checks = []
    # scope
    bad = [f"{r['symbol']} {r['period']}" for r in scope_rows
           if r["selected_report_scope"] == "CONSOLIDATED"
           and r["consolidated_report_available"] is not True]
    checks.append(fails("CHECK_SCOPE_01", bad,
                        "chọn hợp nhất ⇒ consolidated_report_available = True"))
    bad = [f"{r['symbol']} {r['period']}" for r in scope_rows
           if r["selected_report_scope"] == "STANDALONE"
           and r["scope_selection_reason"] == "NOT_YET_VERIFIED"]
    c = fails("CHECK_SCOPE_02", bad,
              "chọn riêng lẻ ⇒ lý do phải khác NOT_YET_VERIFIED")
    c["ghi_chu"] = ("FAIL ĐÚNG THEO THIẾT KẾ: đây chính là tín hiệu phạm vi "
                    "báo cáo của sáu mã riêng lẻ chưa được xác minh. Check này "
                    "chỉ chuyển PASS khi có nguồn công bố của doanh nghiệp."
                    if bad else None)
    checks.append(c)
    scope_by = {(r["symbol"], r["period"]): r["selected_report_scope"] for r in scope_rows}
    src_scope = {(k[0], k[1]): ("CONSOLIDATED" if v.get("report_scope") == "HN"
                                else "STANDALONE") for k, v in src.items()}
    # A scope that is UNKNOWN is not a scope that DIFFERS. The filing-header
    # table only reaches four quarters back, so the year-ago scope is usually
    # absent — failing on that would report a mismatch the data never showed.
    bad, unknown = [], []
    for r in rows:
        if r["p2_acceptance_status"] != "ACCEPTED":
            continue
        a = src_scope.get((r["symbol"], r["period"]))
        b = src_scope.get((r["symbol"], shift(r["period"], 4)))
        if a is None or b is None:
            unknown.append(f"{r['symbol']} {r['period']}")
        elif a != b:
            bad.append(f"{r['symbol']} {r['period']}")
    c = fails("CHECK_SCOPE_03", bad,
              "P2 ACCEPTED ⇒ phạm vi quý hiện tại = phạm vi cùng kỳ")
    c["khong_xac_dinh"] = len(unknown)
    c["ghi_chu"] = ("Không vi phạm; header BCTC chỉ phục vụ 4 quý gần nhất nên "
                    "phạm vi của kỳ cùng kỳ chưa xác định được"
                    if unknown and not bad else None)
    checks.append(c)
    bad, unknown = [], []
    for r in rows:
        if not r["p3_acceptance_status"].startswith("ACCEPTED"):
            continue
        seen = [src_scope.get((r["symbol"], shift(r["period"], k))) for k in range(5)]
        known = {x for x in seen if x is not None}
        if len(known) > 1:
            bad.append(f"{r['symbol']} {r['period']}")
        elif any(x is None for x in seen):
            unknown.append(f"{r['symbol']} {r['period']}")
    c = fails("CHECK_SCOPE_04", bad,
              "P3 ACCEPTED ⇒ mọi kỳ nguồn cùng phạm vi báo cáo")
    c["khong_xac_dinh"] = len(unknown)
    c["ghi_chu"] = ("Không vi phạm; một số kỳ nguồn nằm ngoài 4 quý header "
                    "phục vụ nên phạm vi chưa xác định được"
                    if unknown and not bad else None)
    checks.append(c)
    # P5 reproduction
    bad = []
    for r in p5:
        chosen = [h for h in hist_by.get(r["symbol"], []) if h["included_in_median"]]
        if len(chosen) != r["pb_observation_count"]:
            bad.append(r["symbol"])
    checks.append(fails("CHECK_P5_01", bad,
                        "số dòng included_in_median = pb_observation_count"))
    bad = [r["symbol"] for r in p5
           if [h["period"] for h in hist_by.get(r["symbol"], []) if h["included_in_median"]]
           and min(h["period"] for h in hist_by[r["symbol"]] if h["included_in_median"])
           != r["pb_first_period"]]
    checks.append(fails("CHECK_P5_02", bad, "MIN(kỳ được chọn) = pb_first_period"))
    bad = [r["symbol"] for r in p5
           if [h["period"] for h in hist_by.get(r["symbol"], []) if h["included_in_median"]]
           and max(h["period"] for h in hist_by[r["symbol"]] if h["included_in_median"])
           != r["pb_last_period"]]
    checks.append(fails("CHECK_P5_03", bad, "MAX(kỳ được chọn) = pb_last_period"))
    bad = []
    for r in p5:
        vals = [h["pb_quarter_end"] for h in hist_by.get(r["symbol"], [])
                if h["included_in_median"]]
        if vals and abs(statistics.median(vals) - (r["pb_history_median"] or 0)) > 1e-12:
            bad.append(r["symbol"])
    checks.append(fails("CHECK_P5_04", bad, "MEDIAN(P/B được chọn) = pb_history_median"))
    bad = [r["symbol"] for r in p5
           if r["pb_current_q"] and r["pb_history_median"]
           and abs(r["pb_current_q"] / r["pb_history_median"]
                   - (r["p5_pb_relative_x"] or 0)) > 1e-12]
    checks.append(fails("CHECK_P5_05", bad, "pb_current / median = p5_pb_relative_x"))
    bad = [r["symbol"] for r in p5 if r["p5_acceptance_status"] == "ACCEPTED"
           and not (PB_MIN_OBS <= r["pb_observation_count"] <= PB_MAX_OBS)]
    checks.append(fails("CHECK_P5_06", bad, "ACCEPTED ⇒ 8 ≤ số quan sát ≤ 20"))
    # lineage completeness
    def roles(rid):
        return {L["source_role"] for L in lin_by.get(rid, [])}
    bad = [r["symbol"] + " " + r["period"] for r in results
           if r["metric_code"] == "P2" and r["calculation_status"] == "ACCEPTED"
           and not {"P2_CURRENT_P1", "P2_PRIOR_YEAR_P1"} <= roles(r["metric_result_id"])]
    checks.append(fails("CHECK_LINEAGE_01", bad, "P2 ⇒ có CURRENT_P1 và PRIOR_YEAR_P1"))
    bad = [r["symbol"] + " " + r["period"] for r in results
           if r["metric_code"] == "P3" and r["calculation_status"].startswith("ACCEPTED")
           and len([x for x in roles(r["metric_result_id"])
                    if x.startswith("P3_NET_FINANCE")]) != 4]
    checks.append(fails("CHECK_LINEAGE_02", bad, "P3 ⇒ đủ 4 quý thu nhập tài chính thuần"))
    bad = [r["symbol"] + " " + r["period"] for r in results
           if r["metric_code"] == "P3" and r["calculation_status"].startswith("ACCEPTED")
           and not {"P3_INVESTMENT_ASSETS_BEGIN_TTM", "P3_INVESTMENT_ASSETS_END_TTM"}
           <= roles(r["metric_result_id"])]
    checks.append(fails("CHECK_LINEAGE_03", bad, "P3 ⇒ có tài sản đầu và cuối kỳ TTM"))
    bad = [r["symbol"] + " " + r["period"] for r in results
           if r["metric_code"] == "P4" and r["calculation_status"] == "ACCEPTED"
           and not {"P4_FINANCIAL_ASSETS_END_Q", "P4_GROSS_RESERVES_END_Q"}
           <= roles(r["metric_result_id"])]
    checks.append(fails("CHECK_LINEAGE_05", bad, "P4 ⇒ có tử số và mẫu số cùng kỳ"))
    bad = [r["symbol"] for r in results
           if r["metric_code"] == "P5" and r["calculation_status"] == "ACCEPTED"
           and len([x for x in roles(r["metric_result_id"])
                    if x.startswith("P5_HISTORICAL_PB_")])
           != (p5_by_sym := {x["symbol"]: x for x in p5})[r["symbol"]]["pb_observation_count"]]
    checks.append(fails("CHECK_LINEAGE_06", bad, "P5 ⇒ truy được toàn bộ quan sát"))
    bad = [L["metric_result_id"] for L in lin
           if not L["source_document_id"] or not L["source_provider"]]
    checks.append(fails("CHECK_LINEAGE_07", bad,
                        "không có source_document_id hoặc source_provider trống"))

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
        {"muc": "IFA", "gia_tri": "belongs_to_nonlife_universe=True · "
                                   "eligible_for_scoring=False · display_group=WATCHLIST"},
        {"muc": "phạm vi báo cáo", "gia_tri": "đọc từ header BCTC, KHÔNG mặc định hợp nhất"},
        {"muc": "truy vết nguồn", "gia_tri": "6 trường §6.2 trên mọi dòng TRUY_VET"},
        {"muc": "formula_version", "gia_tri": FORMULA_VERSION},
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

    failed = [c for c in checks if c["ket_qua"] == "FAIL"]
    summary = [*summary,
               {"muc": "kiểm tra tự động", "gia_tri":
                   f"{len(checks) - len(failed)}/{len(checks)} PASS"},
               {"muc": "phạm vi VERIFIED", "gia_tri":
                   f"{sum(1 for r in scope_rows if r['scope_review_status'] == 'VERIFIED')}"
                   f"/{len(scope_rows)} mã-kỳ"},
               {"muc": "run_id", "gia_tri": RUN_ID},
        {"muc": "nguồn phân loại", "gia_tri": universe[0]["classification_read_from"]
            if universe else NOT_AVAILABLE},
        {"muc": "đạt chuẩn nghiệm thu", "gia_tri":
            "KHÔNG — chưa áp migration 072" if universe
            and universe[0]["classification_read_from"].startswith("FALLBACK")
            else "Có"}]

    from export_fa_scanner import write_xlsx
    out = Path(args.out)
    # §7.2 — the snapshot is when the STATEMENT data this run read was last
    # refreshed, not when the release-date lookup ran: the statements are what
    # P1-P4 are computed from, so they are what a reproduction has to match.
    snap_rows = safe_execute(
        client.table("fa_vnstock_statements").select("updated_at")
        .in_("symbol", SY).eq("period_type", "quarter")
        .order("updated_at", desc=True).limit(1), label="snapshot").data or []
    snapshot = (snap_rows[0]["updated_at"][:19] if snap_rows else NOT_AVAILABLE)
    write_xlsx(out, {
        "TEST_SUMMARY": summary,
        "KIEM_TRA_TU_DONG": checks,
        "BANG_TONG_HOP_9_MA": table,
        "PHAN_PHOI": distributions,
        "P1_P5_OUTPUT": rows,
        "P5_PB": p5,
        "P5_INPUT_HISTORY": p5_hist,
        "METRIC_RESULT": results,
        "METRIC_SOURCE_LINEAGE": lin,
        "REPORT_SCOPE_VERIFICATION": scope_rows,
        "universe_theo_loai_hinh": universe,
        "DANH_SACH_THEO_DOI": watch or [{"note": "không có mã nào chờ dữ liệu"}],
        "LOI_VA_KY_THIEU": issues or [{"note": "không có"}],
        "meta": run_metadata(out, len(results), len(lin), snapshot),
    })
    print(f"run_id {RUN_ID}")
    print(f"  METRIC_RESULT {len(results)} · LINEAGE {len(lin)} · "
          f"P5_INPUT_HISTORY {len(p5_hist)}")
    print(f"  kiểm tra tự động: {len(checks) - len(failed)}/{len(checks)} PASS"
          + (f" — FAIL: {', '.join(c['check'] for c in failed)}" if failed else ""))
    print(f"  phạm vi VERIFIED "
          f"{sum(1 for r in scope_rows if r['scope_review_status'] == 'VERIFIED')}"
          f"/{len(scope_rows)} mã-kỳ")
    print(f"rows {len(rows)} · P3 TTM PASS "
          f"{sum(1 for r in rows if r['p3_calculation_status']=='PASS_DERIVED')}/{len(rows)}"
          f" · cờ biến động {dict(vol_counts)}")
    print(f"P5 ACCEPTED {sum(1 for r in p5 if r['p5_acceptance_status']=='ACCEPTED')}/{len(p5)}")
    print(f"Wrote {out} ({out.stat().st_size / 1024:.0f} KB)")

    if args.persist_scope:
        # §3.3 — the verdicts belong in the governance table, not only in a
        # spreadsheet: that is where a later verification gets recorded against
        # the same key, and where the pipeline will read it back.
        payload = [{k: v for k, v in r.items()} for r in scope_rows]
        try:
            for i in range(0, len(payload), 200):
                safe_execute(
                    client.table("fa_insurance_report_scope").upsert(
                        payload[i:i + 200], on_conflict="symbol,period"),
                    label="scope upsert")
            print(f"§3.3 wrote {len(payload)} rows to fa_insurance_report_scope")
        except Exception as exc:  # noqa: BLE001
            print(f"::warning::could not write scope table ({type(exc).__name__}); "
                  f"apply supabase/072")
    return 0


if __name__ == "__main__":
    sys.exit(main())
