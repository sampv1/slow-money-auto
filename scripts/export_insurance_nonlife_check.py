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
from collections import Counter
import subprocess
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa.nonlife_scope import (USED as SCOPE_USED, ControlEvent,
                              resolve_series)
from fa.one_off import (CHECK_ONE_OFF_TIER2_CURRENT, COMPLETION_COMPLETED,
                        STATUS_REVIEW_TRIGGERED, STATUS_SOURCE_INCOMPLETE,
                        TriggerInput, check_tier2_current, completion_status,
                        screen as one_off_screen)
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
#: §3.3 — the one-off filter's variable is SINGLE-QUARTER pre-tax profit, never
#: a cumulative figure: it tests the abnormal amount before tax and avoids tax
#: noise. Plus the "other income" line T4 reads.
PBT = "IS_PROFIT_BEFORE_TAX"
OTHER_INCOME = "IS_OTHER_INCOME"
FIN_EXPENSE = "IS_FINANCIAL_EXPENSES"
INCOME_KEYS = [REV, COST, GROSS_PROFIT, FIN_INCOME, FIN_EXPENSE,
               PBT, OTHER_INCOME]

CASH = "BS_CASH_AND_PRECIOUS_METALS"
ST_INV = "BS_SHORT_TERM_INVESTMENTS"
LT_INV = "BS_LONG_TERM_INVESTMENTS"
HTM_SEC = "BS_HELD_TO_MATURITY_SECURITIES"
FVTPL = "BS_FVTPL_FINANCIAL_ASSETS"
IMPAIRMENT = "BS_PROVISIONS_FOR_IMPAIRMENT_LOSS_OF_FINANCIAL_ASSETS_AND_MORTGAGES"
GROSS_RESERVE = "BS_INSURANCE_RESERVES"
REINS_ASSETS = "BS_REINSURANCE_ASSETS"
BALANCE_KEYS = [CASH, ST_INV, LT_INV, HTM_SEC, FVTPL, IMPAIRMENT, "BS_MINORITY_INTEREST",
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
SPEC_VERSION = "CHOT_HOAN_THANH_TAB_PHI_NHAN_THO_GUI_IT_V1"

#: §4.3 — the source periods each criterion actually reads, as OFFSETS back
#: from the result's own quarter. Verifying only the four displayed quarters
#: was the gap: P2 reads the year-ago quarter and P3 reads five.
SCOPE_SOURCE_OFFSETS = {"P1": (0,), "P2": (0, 4), "P3": (0, 1, 2, 3, 4),
                        "P4": (0,)}
#: §5.7 / §7.9 — P5 is NOT gated on report scope. It reads the provider's P/B
#: series directly, and BA rules the scope check out for it explicitly: "Không
#: dùng phạm vi hợp nhất/công ty mẹ để chặn chuỗi P/B trực tiếp." Before this,
#: requiring a determined scope for all 20 P/B quarters blocked P5 on six of
#: nine symbols and was the single largest cause of 3/9.
SCOPE_EXEMPT_METRICS = frozenset({"P5"})

#: The balance-sheet line that POSITIVELY identifies a consolidated record.
#: A value above zero means the record consolidates a partly-owned subsidiary.
#: Zero proves nothing (§4.2) and is never used.
MINORITY = "BS_MINORITY_INTEREST"
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


#: §9.2 — the four words that may stand in for a number, each answering a
#: DIFFERENT question. BA bans a shared "N/A" precisely because it collapses
#: them: a measured zero, a field that does not apply, a score BA has not
#: authorised yet, and a document we could not obtain are four separate facts
#: and call for four different actions.
NOT_APPLICABLE = "NOT_APPLICABLE"
NOT_SCORED_BY_DESIGN = "NOT_SCORED_BY_DESIGN"
SOURCE_INCOMPLETE = "SOURCE_INCOMPLETE"


def _oo_amount(oo):
    """§9.2 item 11. An amount exists only for CONFIRMED_ONE_OFF; §4.2 forbids
    estimating one anywhere else, so every other state says so rather than
    printing a 0 that would read as "we looked and it was zero đồng"."""
    st = oo.get("one_off_review_status")
    if st == STATUS_SOURCE_INCOMPLETE:
        return SOURCE_INCOMPLETE
    if oo.get("one_off_amount") is not None:
        return f"{oo['one_off_amount']:,.0f}"
    return NOT_APPLICABLE


def _oo_basis(oo):
    """§9.2 item 12. The basis is a property of a CONFIRMED amount; with no
    amount there is no basis to state, and asserting PRE_TAX would claim a
    measurement was taken on it."""
    st = oo.get("one_off_review_status")
    if st == STATUS_SOURCE_INCOMPLETE:
        return SOURCE_INCOMPLETE
    return oo.get("tax_basis") or NOT_APPLICABLE


def _oo_ratio(oo, key):
    """§9.2 item 13. R is amount ÷ profit, so with no amount there is no ratio —
    not a ratio of zero."""
    st = oo.get("one_off_review_status")
    if st == STATUS_SOURCE_INCOMPLETE:
        return SOURCE_INCOMPLETE
    v = oo.get(key)
    return NOT_APPLICABLE if v is None else f"{v * 100:,.2f}%"


def _oo_penalty(oo):
    """§9.2 item 14, and the one place a plain 0 is right. A filing that was
    read and found ordinary carries a MEASURED deduction of zero; that is a
    result, not an absence. Where the filing could not be read, the deduction is
    unknown and must not render as 0 (§4.2)."""
    st = oo.get("one_off_review_status")
    if st == STATUS_SOURCE_INCOMPLETE:
        return SOURCE_INCOMPLETE
    if st == STATUS_REVIEW_TRIGGERED:
        return "CHỜ TẦNG 2"
    v = oo.get("one_off_penalty")
    return 0 if v is None else v


def _incomplete_reason(g, oo):
    """§9.2 item 18. Names the condition, never "thiếu dữ liệu"."""
    if not g.get("eligible_for_total"):
        return g.get("blocking_reason") or "P1–P5 chưa đủ điều kiện"
    st = oo.get("one_off_review_status")
    if st == STATUS_REVIEW_TRIGGERED:
        return "chờ tầng 2 đọc BCTC gốc (§3.2)"
    if st == STATUS_SOURCE_INCOMPLETE:
        return (oo.get("tier2_incomplete_reason")
                or "đã kiểm tra nguồn nhưng không lấy được BCTC gốc (§3.2)")
    # §7.1 — P1-P5 and the one-off are done; the FA score is not, by design.
    return "vòng dữ liệu hoàn tất; điểm FA chờ BA khóa thang điểm (§5.1)"


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
    BASE = ("symbol,insurance_type,insurance_type_source,"
            "insurance_type_effective_from,insurance_type_effective_to,"
            "insurance_type_review_status,classification_note")
    # §8.2's two columns arrive with migration 073, while the TABLE arrived with
    # 072 — so a missing COLUMN and a missing TABLE are different failures and
    # must not share a handler. Only the second may fall back to ICB, and that
    # fallback is dangerous: ICB files PVI under the same code as the nine
    # non-life insurers, so it reinstates exactly what 072 removed. A missing
    # column merely means the statuses are derived in Python this run.
    cls, source_of_truth = None, None
    for sel, tag in ((BASE + ",classification_source_status,"
                      "classification_usage_status", "migration 073"),
                     (BASE, "migration 072, 073 chưa áp")):
        try:
            cls = safe_execute(
                client.table("fa_insurance_classification").select(sel)
                .is_("insurance_type_effective_to", "null").order("symbol"),
                label="classification").data or []
            source_of_truth = f"fa_insurance_classification ({tag})"
            break
        except Exception:  # noqa: BLE001
            continue
    try:
        if cls is None:
            raise RuntimeError("fa_insurance_classification not readable")
        by_symbol = {r["symbol"]: r for r in cls}
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
            src_status = c.get("classification_source_status")
            use_status = c.get("classification_usage_status")
        else:
            itype = ("Tái bảo hiểm" if r.get("icb_l4") == ICB_REINSURANCE
                     else "Phi nhân thọ" if r.get("icb_l4") == ICB_NON_LIFE
                     else "Holding/Hỗn hợp")
            src, eff, review = "ICB", NOT_AVAILABLE, "PENDING"
            note = "fallback: classification table not available"
            src_status = use_status = None
        # §8.2 — PENDING must mean ONE thing. Two questions, two columns:
        # how good the evidence for the TYPE is, and whether that type may route
        # and score. Derived here only when migration 073 has not run, so the DB
        # stays the single owner of the rule once it is applied.
        if src_status is None:
            src_status = ("BA_VERIFIED" if src == "BA_DECISION"
                          else "PENDING_REVIEW" if review == "CONFLICT"
                          else "PROVIDER")
        if use_status is None:
            use_status = "BLOCKED" if review == "CONFLICT" else "ACTIVE"
        out.append({
            **r,
            "insurance_type": itype,
            "insurance_type_source": src,
            "insurance_type_effective_from": eff,
            "insurance_type_review_status": review,
            "classification_source_status": src_status,
            "classification_usage_status": use_status,
            "classification_note": note,
            "classification_read_from": source_of_truth,
            # BLOCKED means the TYPE is unresolved, so the symbol may not be
            # routed to any tab — separate from eligible_for_scoring, which is
            # about the DATA (IFA is ACTIVE non-life and still unscorable).
            "belongs_to_nonlife_universe": (itype == "Phi nhân thọ"
                                            and use_status == "ACTIVE"),
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


#: §7.2 — `calculation_status` has exactly three values, and none of them may
#: carry a second meaning. The old `ACCEPTED_WITH_VOLATILITY_FLAG` was stamped
#: on all 36 P3 results while only ONE observation was actually volatile, so 35
#: normal readings looked flagged. A flag is not a status.
CALC_ACCEPTED, CALC_CALCULATED, CALC_REJECTED = "ACCEPTED", "CALCULATED", "REJECTED"


def metric_result(rid, symbol, period, code, value, unit, status, run_id,
                  flag=None, min_history_met=True, calc_note=None):
    """§5.2 Bảng A + §10 — one row per P-result, with its status layers SEPARATE.

    Five independent questions, five fields. Folding any two together is what
    produced both defects this round fixes: a scope check that reported PASS on
    data it had never determined, and a volatility flag masquerading as an
    acceptance status.

      calculation_status    did the formula produce a number from real inputs
      scope_validation_status  are the source periods provably one scope
      source_lineage_status is every required source row present
      metric_flag           information only — never affects points (§7.3)
      scoring_eligibility   the CONJUNCTION, resolved in one place (§10.1)

    The last three are filled by `finalise_statuses` once lineage exists.
    """
    return {"metric_result_id": rid, "symbol": symbol, "period": period,
            "metric_code": code, "result_value": value, "unit": unit,
            "calculation_status": status,
            # Placeholders, resolved below. Present from the start so a row can
            # never be written with the field simply absent.
            "scope_validation_status": None,
            "source_lineage_status": None,
            "metric_flag": flag or "NONE",
            "scoring_eligibility": None,
            "blocked_reason": None,
            "min_history_met": min_history_met,
            "calculation_note": calc_note,
            "formula_version": FORMULA_VERSION,
            "mapping_version": INV_MAP_VERSION, "run_id": run_id}


def scope_status_for(scopes):
    """§5.2 / §6.2 — three states over the REQUIRED source periods.

    An UNDETERMINED scope is not a scope that DIFFERS, and it is not a scope
    that MATCHES either. The rule this replaces answered a two-way question and
    so had to put "unknown" on one side; it chose PASS, which reported agreement
    between one known period and one it had never established.
    """
    if any(x == "UNDETERMINED" or x is None for x in scopes):
        return "PENDING"
    return "PASS" if len(set(scopes)) == 1 else "FAIL"


def finalise_statuses(results, lin, record_scope, required_periods,
                      company_eligible, lineage_required):
    """§10.1 — resolve `scoring_eligibility` in ONE place.

    Five conditions, ANDed. Each failure names itself: §10.2 forbids reporting a
    blocked result as "thiếu dữ liệu", because the four reasons call for four
    different actions — a filing to publish, a disclosure to obtain, a source row
    to add, or simply more quarters to elapse.
    """
    roles_by = {}
    for L in lin:
        roles_by.setdefault(L["metric_result_id"], set()).add(L["source_role"])
    for r in results:
        rid, sym, code = r["metric_result_id"], r["symbol"], r["metric_code"]
        periods = required_periods.get(rid, ())
        scopes = [record_scope.get((sym, p)) for p in periods]
        if code in SCOPE_EXEMPT_METRICS:
            # §5.7 — exempt by rule, not by having no periods to check. Recorded
            # as its own value so a reader can see the exemption was applied
            # rather than inferring it from an empty check.
            r["scope_validation_status"] = "NOT_APPLICABLE"
        else:
            r["scope_validation_status"] = (scope_status_for(scopes) if periods
                                            else "PENDING")
        r["scope_source_period_count"] = len(periods)
        r["scope_undetermined_periods"] = ", ".join(
            p for p, sc in zip(periods, scopes)
            if sc == "UNDETERMINED" or sc is None) or None

        need = lineage_required.get(rid)
        if need is None:
            r["source_lineage_status"] = "INCOMPLETE"
        else:
            missing = need - roles_by.get(rid, set())
            r["source_lineage_status"] = "COMPLETE" if not missing else "INCOMPLETE"
            r["lineage_missing_roles"] = ", ".join(sorted(missing)) or None

        reasons = []
        if r["calculation_status"] != CALC_ACCEPTED:
            reasons.append(f"calculation_status={r['calculation_status']}"
                           + (f" ({r['calculation_note']})" if r.get("calculation_note") else ""))
        if r["scope_validation_status"] not in ("PASS", "NOT_APPLICABLE"):
            reasons.append(
                f"scope_validation_status={r['scope_validation_status']}"
                + (f" — kỳ chưa xác định phạm vi: {r['scope_undetermined_periods']}"
                   if r["scope_undetermined_periods"] else ""))
        if r["source_lineage_status"] != "COMPLETE":
            reasons.append(f"source_lineage_status={r['source_lineage_status']}"
                           + (f" — thiếu {r.get('lineage_missing_roles')}"
                              if r.get("lineage_missing_roles") else ""))
        if not company_eligible.get(sym):
            reasons.append("doanh nghiệp eligible_for_scoring=False")
        if not r["min_history_met"]:
            reasons.append(f"{code} chưa đủ lịch sử tối thiểu")
        r["scoring_eligibility"] = "ELIGIBLE" if not reasons else "BLOCKED"
        r["blocked_reason"] = "; ".join(reasons) or None


def run_metadata(out_path, rows_result, rows_lineage, snapshot):
    """§7.2 — enough to reproduce this exact run."""
    def git_raw(*args):
        """Raw stdout, EMPTY STRING when git says nothing.

        Kept separate from `git()` below because the two need opposite
        treatments of emptiness: a missing commit hash is NOT_AVAILABLE, while
        an empty `status --porcelain` is the meaningful answer "clean". Folding
        them together made `pipeline_working_tree` report dirty unconditionally
        — the fallback string is truthy, so the emptiness test never fired.
        """
        try:
            return subprocess.run(["git", *args], capture_output=True, text=True,
                                  cwd=Path(__file__).resolve().parent,
                                  timeout=10).stdout.strip()
        except Exception:  # noqa: BLE001
            return None

    def git(*args):
        out = git_raw(*args)
        return out if out else NOT_AVAILABLE
    script = Path(__file__).resolve()
    return [
        {"key": "run_id", "value": RUN_ID},
        {"key": "generated_at", "value": dt.datetime.now().isoformat(timespec="seconds")},
        {"key": "pipeline_commit_hash", "value": git("rev-parse", "HEAD")},
        {"key": "pipeline_working_tree", "value":
            (NOT_AVAILABLE if (st := git_raw("status", "--porcelain", "--", str(script)))
             is None else ("dirty" if st else "clean"))},
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
    ap.add_argument("--no-persist", action="store_true",
                    help="§8: skip writing scope/gate to the DB (inspection only). "
                         "Persistence is the DEFAULT — §12 condition 3 requires "
                         "the data to be read back from the database.")
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
    # P5 looks 20 quarters back from the latest quarter, one deeper than the
    # P1-P4 window, and §11.1 CHECK_SCOPE_05 applies to every criterion — so the
    # scope has to be resolved over the UNION, not over the P1-P4 window alone.
    pb_periods = [shift(QUARTERS[-1], i) for i in range(PB_MAX_OBS)]
    scope_periods = sorted(set(need) | set(pb_periods))
    inc = load(client, SY, need, "income", INCOME_KEYS)
    bal = load(client, SY, scope_periods, "balance", BALANCE_KEYS)
    src = load_source_meta(client, SY, set(scope_periods))
    # §2.6 — verified loss-of-control events, the ONLY thing that licenses moving
    # a symbol from consolidated to standalone. Read from the DB; empty is the
    # correct state, and with no event §2.1 item 4 waits rather than switching.
    events_by_symbol: dict[str, list] = {}
    try:
        for r_ in (safe_execute(
                client.table("fa_insurance_control_events")
                .select("symbol,effective_date,transaction_completed,"
                        "has_remaining_subsidiaries,evidence_type,evidence_source")
                .order("symbol").order("effective_date"),
                label="control events").data or []):
            events_by_symbol.setdefault(r_["symbol"], []).append(ControlEvent(
                effective_date=dt.date.fromisoformat(r_["effective_date"]),
                transaction_completed=bool(r_["transaction_completed"]),
                has_remaining_subsidiaries=r_["has_remaining_subsidiaries"],
                evidence_type=r_["evidence_type"],
                evidence_source=r_["evidence_source"]))
    except Exception as exc:  # noqa: BLE001
        print(f"::warning::fa_insurance_control_events unreadable "
              f"({type(exc).__name__}) — apply supabase/073. Treating as no "
              f"events, which is the conservative branch of §2.1 item 4.")
    n_events = sum(len(v) for v in events_by_symbol.values())
    print(f"sự kiện mất quyền kiểm soát đã xác minh: {n_events} "
          f"({'đúng trạng thái ban đầu' if not n_events else 'từ CSDL'})")

    # §2 — resolve every source period any formula reads, OLDEST FIRST, because
    # §2.1 item 4 compares against the prior period's RESOLVED status.
    scope_res: dict[tuple[str, str], dict] = {}
    for s_ in SY:
        series = resolve_series(
            s_, scope_periods,
            {p_: (src.get((s_, p_)) or {}).get("report_scope") for p_ in scope_periods},
            {p_: (bal.get((s_, p_)) or {}).get(MINORITY) for p_ in scope_periods},
            events_by_symbol.get(s_))
        for p_, r_ in series.items():
            scope_res[(s_, p_)] = r_
    # What the scope CHECKS compare. A period the system did not select (waiting
    # for a consolidated report) has no usable basis, so it reads None and the
    # dependent metric is blocked rather than scored on a basis nobody chose.
    record_scope = {k: (v["selected_report_type"] if v["usage_status"] == SCOPE_USED
                        else None)
                    for k, v in scope_res.items()}

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
    # §10 — recorded as the results are built, so the eligibility rule is
    # evaluated against what each formula ACTUALLY read rather than against a
    # per-criterion constant that a later formula change could silently outgrow.
    req_periods, req_roles = {}, {}
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
            results.append(metric_result(
                rid1, s, q, "P1", p1, "%",
                CALC_ACCEPTED if r["p1_acceptance_status"] == "ACCEPTED"
                else CALC_CALCULATED if p1 is not None else CALC_REJECTED, RUN_ID,
                calc_note=(None if r["p1_acceptance_status"] == "ACCEPTED"
                           else "đối chiếu LN gộp vượt sai số cho phép"
                           if p1 is not None else "thiếu DTT hoặc LN gộp bảo hiểm")))
            req_periods[rid1] = tuple(shift(q, k) for k in SCOPE_SOURCE_OFFSETS["P1"])
            req_roles[rid1] = {"P1_NUMERATOR_GROSS_PROFIT", "P1_DENOMINATOR_NET_REVENUE"}
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
            results.append(metric_result(
                rid2, s, q, "P2", p2, "điểm phần trăm",
                CALC_ACCEPTED if p2 is not None else CALC_REJECTED, RUN_ID,
                calc_note=None if p2 is not None else "thiếu P1 quý hiện tại hoặc cùng kỳ"))
            req_periods[rid2] = tuple(shift(q, k) for k in SCOPE_SOURCE_OFFSETS["P2"])
            req_roles[rid2] = {"P2_CURRENT_P1", "P2_PRIOR_YEAR_P1"}
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
                     # §7.1/§7.2 — the flag lives in its OWN field. It used to be
                     # welded into the status, so all 36 results announced a
                     # volatility that only one observation had.
                     p3_acceptance_status=(CALC_ACCEPTED if calc_ok else CALC_REJECTED),
                     volatility_flag=vol)
            rid3 = result_id(s, q, "P3", RUN_ID)
            r["p3_metric_result_id"] = rid3
            results.append(metric_result(
                rid3, s, q, "P3", p3, "%",
                CALC_ACCEPTED if calc_ok else CALC_REJECTED, RUN_ID,
                # NORMAL and HIGH_VARIATION are both real readings; a symbol
                # without eight prior quarters gets neither, and says so.
                flag=vol,
                calc_note=None if calc_ok else "thiếu quý TTM hoặc mốc tài sản"))
            req_periods[rid3] = tuple(shift(q, k) for k in SCOPE_SOURCE_OFFSETS["P3"])
            req_roles[rid3] = ({"P3_NET_FINANCE_CURRENT_Q",
                                "P3_INVESTMENT_ASSETS_BEGIN_TTM",
                                "P3_INVESTMENT_ASSETS_END_TTM"}
                               | {f"P3_NET_FINANCE_Q_MINUS_{k_}" for k_ in (1, 2, 3)})
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
            results.append(metric_result(
                rid4, s, q, "P4", r["p4_gross_coverage_x"], "lần",
                CALC_ACCEPTED if r["p4_acceptance_status"] == "ACCEPTED"
                else CALC_REJECTED, RUN_ID,
                calc_note=None if r["p4_acceptance_status"] == "ACCEPTED"
                else "thiếu tài sản tài chính hoặc dự phòng gộp"))
            req_periods[rid4] = tuple(shift(q, k) for k in SCOPE_SOURCE_OFFSETS["P4"])
            req_roles[rid4] = {"P4_FINANCIAL_ASSETS_END_Q", "P4_GROSS_RESERVES_END_Q"}
            lin.append(lineage(rid4, "P4_FINANCIAL_ASSETS_END_Q", q, "balance",
                               f"{CASH} + {ST_INV} + {LT_INV}", bn(a_end), mm))
            lin.append(lineage(rid4, "P4_GROSS_RESERVES_END_Q", q, "balance",
                               GROSS_RESERVE, bn(gr), mm,
                               "P4 thuần chỉ tham khảo, không chấm điểm"))

            rows.append(r)

    # §4.3 / §12 — one row per SOURCE PERIOD, not per displayed quarter, with the
    # criteria that read it. 36 rows covered the four quarters on screen; the
    # formulas reach further back than that, and those were the periods with no
    # scope at all.
    used_by = {}
    for r_ in rows:
        for code, offs in SCOPE_SOURCE_OFFSETS.items():
            for k_ in offs:
                used_by.setdefault((r_["symbol"], shift(r_["period"], k_)),
                                   set()).add(code)

    # ---------- P5 (§8) ----------
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
            CALC_ACCEPTED if n >= PB_MIN_OBS else CALC_REJECTED, RUN_ID,
            min_history_met=n >= PB_MIN_OBS,
            calc_note=None if n >= PB_MIN_OBS
            else f"chỉ có {n} quan sát P/B, tối thiểu {PB_MIN_OBS}"))
        # §5.7 / §7.9 — P5 IS NOT SCOPE-GATED, and BA rules it out in as many
        # words: "Không dùng phạm vi hợp nhất/công ty mẹ để chặn chuỗi P/B trực
        # tiếp." It reads the provider's P/B series directly rather than
        # recombining price, equity and share count, so the consolidated /
        # standalone question does not arise per slice. Requiring a determined
        # scope across all 20 quarters is what blocked P5 on six of nine symbols
        # and was the single largest cause of the previous 3/9.
        #
        # An EMPTY tuple, not an omission: `finalise_statuses` reads
        # `required_periods.get(rid, ())` and treats a missing entry as
        # "no source periods recorded" -> PENDING, which would re-block P5 by
        # accident. SCOPE_EXEMPT_METRICS makes the exemption explicit there.
        req_periods[rid5] = ()
        req_roles[rid5] = ({"P5_CURRENT_PB"}
                           | {f"P5_HISTORICAL_PB_{per}" for per, _ in series})
        lin.append(lineage(rid5, "P5_CURRENT_PB", series[-1][0] if series else "—",
                           "ratio", PB, cur, {"symbol": s}))
        for per, v in series:
            lin.append(lineage(rid5, f"P5_HISTORICAL_PB_{per}", per, "ratio",
                               PB, v, {"symbol": s}))
        for per, _ in series:
            used_by.setdefault((s, per), set()).add("P5")

    # Migration 072 left three columns NOT NULL — selected_report_scope,
    # scope_selection_reason and scope_review_status — and BA's §2 model does not
    # produce them directly. They are DERIVED from the new fields rather than
    # dropped, because 072 is applied and its constraints still hold.
    #
    # scope_review_status is the honest mapping of BA's own vocabulary: the three
    # statuses ending in _VERIFIED are verified, and the two SCOPE_AS_PROVIDED
    # ones are explicitly operational rather than verified (§2.3), so they stay
    # PENDING. That is not a blocker any more — §2.5 item 3 and §11.1.2 both say
    # a period like this must still be usable, and `usage_status` is what the
    # gate reads.
    LEGACY_SELECTED = {"CONSOLIDATED": "CONSOLIDATED", "STANDALONE": "STANDALONE",
                       "NONE_WAITING_CONSOLIDATED": "UNDETERMINED"}
    # `scope_selection_reason` keeps 072's five permitted values, and they answer
    # 072's question: "why was this scope selected", framed around whether a
    # consolidated report EXISTS. BA withdrew that question, so the column is
    # legacy — `scope_status` and `scope_decision_rule` carry the §2 model.
    #
    # The mapping is still literally true, which is the only reason it is
    # acceptable: NOT_YET_VERIFIED says the EXISTENCE question is unverified, and
    # it is, for every row that is not consolidated. It does NOT contradict
    # PARENT_VERIFIED, which is about the scope of the RECORD we read — two
    # different questions, which is exactly the distinction §2.3 draws. The
    # workbook states this so a reader cannot take the two for a conflict.
    LEGACY_REASON = {
        "CONSOLIDATED_VERIFIED": "CONSOLIDATED_AVAILABLE_AND_SELECTED",
        "SCOPE_CHANGE_VERIFIED": "NO_CONSOLIDATED_REPORT_STANDALONE_SELECTED",
        "WAITING_CONSOLIDATED": "CONSOLIDATED_MISSING_FROM_PROVIDER",
        "PARENT_VERIFIED": "NOT_YET_VERIFIED",
        "SCOPE_AS_PROVIDED_BASELINE": "NOT_YET_VERIFIED",
        "SCOPE_AS_PROVIDED_CONTINUOUS": "NOT_YET_VERIFIED",
    }
    for (s_, p_), codes in sorted(used_by.items()):
        r_ = scope_res[(s_, p_)]
        st = r_["scope_status"]
        scope_rows.append({
            "symbol": s_, "period": p_,
            "used_by_metrics": ", ".join(sorted(codes)),
            **r_,
            "selected_report_scope": LEGACY_SELECTED.get(
                r_["selected_report_type"], "UNDETERMINED"),
            "scope_selection_reason": LEGACY_REASON[st],
            "scope_review_status": ("VERIFIED" if st.endswith("_VERIFIED")
                                    else "PENDING"),
            "scope_note": r_["scope_decision_rule"],
        })

    # §10.1 — the conjunction, resolved once over every result.
    company_eligible = {u["symbol"]: bool(u["eligible_for_scoring"]) for u in universe}
    finalise_statuses(results, lin, record_scope, req_periods,
                      company_eligible, req_roles)
    elig_by = {(r["symbol"], r["period"], r["metric_code"]): r for r in results}
    # §12 — the three status layers must be visible on P1_P5_OUTPUT too, or the
    # sheet a reader opens first would show a computed number with no indication
    # that it is blocked from scoring.
    for r_ in rows:
        for code in ("P1", "P2", "P3", "P4"):
            m_ = elig_by.get((r_["symbol"], r_["period"], code), {})
            lo = code.lower()
            r_[f"{lo}_scope_validation_status"] = m_.get("scope_validation_status")
            r_[f"{lo}_source_lineage_status"] = m_.get("source_lineage_status")
            r_[f"{lo}_scoring_eligibility"] = m_.get("scoring_eligibility")
            r_[f"{lo}_blocked_reason"] = m_.get("blocked_reason")
    for r_ in p5:
        m_ = elig_by.get((r_["symbol"], QUARTERS[-1], "P5"), {})
        r_["p5_scope_validation_status"] = m_.get("scope_validation_status")
        r_["p5_source_lineage_status"] = m_.get("source_lineage_status")
        r_["p5_scoring_eligibility"] = m_.get("scoring_eligibility")
        r_["p5_blocked_reason"] = m_.get("blocked_reason")

    # ---------- §6.1: the company-level gate, BEFORE any summing ----------
    # A criterion can be computable on its own; a company earns a 50-point total
    # only with all five valid for the SAME period. §6.1 forbids the
    # alternatives by name: no partial sum, no normalising four criteria up to
    # 50, no scoring a blocked criterion 0, and no appearance in that period's
    # official ranking.
    #
    # P5 is keyed on the LATEST quarter only (it is a valuation snapshot against
    # the symbol's own history, not a per-quarter figure), so every period's gate
    # reads the same P5 verdict. Stated here because silently reusing it would
    # look like a bug to the next reader.
    gate_rows = []
    p5_elig = {r_["symbol"]: elig_by.get((r_["symbol"], QUARTERS[-1], "P5"), {})
               for r_ in p5}
    for s_ in SY:
        for q_ in QUARTERS:
            valid, blocking, why = {}, [], []
            for code in ("P1", "P2", "P3", "P4"):
                m_ = elig_by.get((s_, q_, code), {})
                ok = m_.get("scoring_eligibility") == "ELIGIBLE"
                valid[code] = ok
                if not ok:
                    blocking.append(code)
                    if m_.get("blocked_reason"):
                        why.append(f"{code}: {m_['blocked_reason']}")
            m5 = p5_elig.get(s_, {})
            valid["P5"] = m5.get("scoring_eligibility") == "ELIGIBLE"
            if not valid["P5"]:
                blocking.append("P5")
                if m5.get("blocked_reason"):
                    why.append(f"P5: {m5['blocked_reason']}")
            gate_rows.append({
                "symbol": s_, "period": q_,
                **{f"{k.lower()}_valid": v for k, v in valid.items()},
                "eligible_for_total": not blocking,
                # §12.3 and §6.1 both forbid a generic reason.
                "blocking_criteria": ", ".join(blocking) or None,
                "blocking_reason": "; ".join(why) or None,
                "run_id": RUN_ID,
            })
    gate_by = {(g["symbol"], g["period"]): g for g in gate_rows}

    # ---------- §3: one-off screen (tier 1 only — T1..T5) ----------
    # Returns REVIEW_TRIGGERED or AUTO_NORMAL and nothing else. §3.2 puts the
    # original filing between a trigger and a penalty, so no amount, ratio or
    # deduction is produced here.
    def _inc(sym, per, key):
        return (inc.get((sym, per)) or {}).get(key)

    one_off_rows = []
    for s_ in SY:
        for q_ in QUARTERS:
            prior = [shift(q_, k) for k in range(1, 9)]
            one_off_rows.append(one_off_screen(TriggerInput(
                symbol=s_, period=q_,
                pbt=_inc(s_, q_, PBT), pbt_year_ago=_inc(s_, shift(q_, 4), PBT),
                prior_8q_pbt=[_inc(s_, x, PBT) for x in prior],
                other_income=_inc(s_, q_, OTHER_INCOME),
                prior_8q_other_income=[_inc(s_, x, OTHER_INCOME) for x in prior],
                financial_income=_inc(s_, q_, FIN_INCOME),
                prior_8q_financial_income=[_inc(s_, x, FIN_INCOME) for x in prior],
                # §3.4 — T5 is written for non-financial issuers. Recorded so a
                # reviewer looks for a specific non-recurring line rather than
                # treating investment income as one-off.
                is_financial_sector=True,
                # The insurance template serves no non-operating "Thu nhập khác"
                # line: what it calls other income is not an addend of pre-tax
                # profit. See the measurement in fa/one_off.py — T4 is therefore
                # unevaluable here, which is honest rather than firing it on a
                # line that means something else.
                other_income_is_pl_addend=False)))
    # §3.2 / §3.6 — tier 2's verdicts, READ from the audit file. The export only
    # reads it: a verdict must never be produced by the same pass that raised the
    # trigger, because §3.2 puts the issuer's filing between the two.
    tier2_path = (Path(__file__).resolve().parents[1] / "data" / "fa" / "rubrics"
                  / "insurance" / "one_off_tier2_results.json")
    tier2 = {}
    if tier2_path.exists():
        for v in json.loads(tier2_path.read_text()).get("verdicts", []):
            tier2[(v["symbol"], v["period"])] = v
    for r_ in one_off_rows:
        v = tier2.get((r_["symbol"], r_["period"]))
        if not v:
            continue
        # A RECORDED READING OUTRANKS A TIER-1 SCREEN, INCLUDING WHEN TIER 1 NO
        # LONGER FIRES. BA ordered the five 2026-Q2 filings read while T4 was
        # still fed the insurance other-income line; correcting that mapping
        # makes T4 unevaluable, so those rows now screen AUTO_NORMAL on their
        # own. Applying the verdict only to a REVIEW_TRIGGERED row would then
        # discard all five readings — and AIC's unresolved one would disappear
        # from the workbook entirely, which is precisely the outcome §14 forbids
        # ("không đổi luật giữa chừng để né việc đọc năm mã đã kích hoạt").
        # For the four CONFIRMED_NORMAL rows this changes nothing but the
        # provenance; for AIC it is the difference between a reported gap and a
        # silent one.
        r_["tier1_status_before_tier2"] = r_["one_off_review_status"]
        # §3.6 requires the source reference; without it the verdict does not
        # apply and the symbol stays REVIEW_TRIGGERED.
        if not v.get("source_page_note"):
            print(f"::warning::tier 2 verdict for {r_['symbol']} {r_['period']} "
                  f"has no source_page_note — không áp dụng (§3.6)")
            continue
        r_["one_off_review_status"] = v["classification"]
        r_["one_off_penalty"] = v.get("penalty")
        r_["tier2_source_document"] = v.get("source_document")
        r_["tier2_source_page_note"] = v.get("source_page_note")
        r_["tier2_reviewed_by"] = v.get("reviewed_by")
        r_["tier2_reviewed_date"] = v.get("reviewed_date")
        # §9.2 items 11-13 — carried only where tier 2 actually established
        # them. §4.2 forbids deriving any of these from tier 1.
        for k_ in ("one_off_amount", "tax_basis", "r_q", "r_ttm", "r_used",
                   "tier2_incomplete_reason", "source_url"):
            if v.get(k_) is not None:
                r_[k_] = v[k_]
    print(f"tier 2 (§3.2): {len(tier2)} phán quyết đã đọc từ "
          f"one_off_tier2_results.json; "
          f"{sum(1 for r_ in one_off_rows if r_['one_off_review_status'] == STATUS_REVIEW_TRIGGERED)}"
          f" mã-kỳ còn chờ BCTC gốc")
    one_off_by = {(r_["symbol"], r_["period"]): r_ for r_ in one_off_rows}


    # ---------- §8: write the scope + gate to the DB, then READ THEM BACK ----------
    # Persistence is no longer behind a flag. §8 makes writing and reading back
    # part of acceptance, and §12 condition 3 requires the data to come from the
    # database rather than only from a spreadsheet. --no-persist exists for a
    # dry inspection.
    scope_db_rows = None
    gate_db_rows = None
    if not args.no_persist:
            # §8 — write the scope verdicts and the gate to the operational DB, not only in a
        # spreadsheet: that is where a later verification gets recorded against
        # the same key, and where the pipeline will read it back.
        # Only the columns migration 073 defines. Sending a key the table does
        # not have fails the whole batch, so the payload is built from an
        # explicit allow-list rather than from whatever the resolver returned.
        SCOPE_COLS = (
            "symbol", "period", "provider_report_type", "selected_report_type",
            "prior_period_scope", "prior_period", "loss_of_control_event",
            "event_effective_date", "has_remaining_subsidiaries",
            "scope_decision_rule", "scope_verification_method", "checked_date",
            "usage_status", "used_by_metrics", "scope_status",
            "consolidated_report_available", "standalone_report_available",
            "scope_verification_source",
            # 072's NOT NULL columns, derived above.
            "selected_report_scope", "scope_selection_reason",
            "scope_review_status", "scope_note",
        )
        payload = [{k: r.get(k) for k in SCOPE_COLS if k in r} for r in scope_rows]
        wrote = read_back = 0
        try:
            for i in range(0, len(payload), 200):
                safe_execute(
                    client.table("fa_insurance_report_scope").upsert(
                        payload[i:i + 200], on_conflict="symbol,period"),
                    label="scope upsert")
                wrote += len(payload[i:i + 200])
            # §8 item 4-5 — read it BACK, and prove the scorer uses the table
            # rather than only that the write returned 204. A denied PostgREST
            # write answers 204 with zero rows affected, which looks identical
            # to success.
            read_back = safe_execute(
                client.table("fa_insurance_report_scope")
                .select("*", count="exact").limit(1),
                label="scope read-back").count or 0
            print(f"§8 fa_insurance_report_scope: ghi {wrote} dòng, "
                  f"đọc lại {read_back} dòng")
        except Exception as exc:  # noqa: BLE001
            print(f"::warning::không ghi được bảng phạm vi "
                  f"({type(exc).__name__}: {str(exc)[:300]})")

        gate_payload = [{k: g.get(k) for k in (
            "symbol", "period", "p1_valid", "p2_valid", "p3_valid", "p4_valid",
            "p5_valid", "eligible_for_total", "blocking_criteria",
            "blocking_reason", "run_id")} for g in gate_rows]
        try:
            for i in range(0, len(gate_payload), 200):
                safe_execute(
                    client.table("fa_insurance_nonlife_eligibility").upsert(
                        gate_payload[i:i + 200], on_conflict="symbol,period"),
                    label="eligibility upsert")
            back = safe_execute(
                client.table("fa_insurance_nonlife_eligibility")
                .select("*", count="exact").limit(1),
                label="eligibility read-back").count or 0
            print(f"§6 fa_insurance_nonlife_eligibility: ghi {len(gate_payload)} "
                  f"dòng, đọc lại {back} dòng")
        except Exception as exc:  # noqa: BLE001
            print(f"::warning::không ghi được bảng cổng ({type(exc).__name__})")
        scope_db_rows, gate_db_rows = read_back, back

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

    def fails(name, bad, rule, pending=None, note=None):
        """Three-state, because two states forced "unknown" onto one side.

        §5.2 is explicit: PENDING may not be folded into PASS. A check that can
        only answer yes or no has to call unverified data one of the two, and the
        old implementation called it PASS — reporting that two periods shared a
        scope when one of them had never been established.
        """
        state = "FAIL" if bad else ("PENDING" if pending else "PASS")
        # Every key on every row, always — a sheet writer that takes its headers
        # from one row cannot print a column that only some rows carry.
        return {"check": name, "quy_tac": rule, "so_vi_pham": len(bad),
                "so_chua_xac_dinh": len(pending or []),
                "ket_qua": state,
                "chi_tiet": ", ".join(bad[:6]) or ", ".join((pending or [])[:6]) or "—",
                "ghi_chu": note}

    checks = []
    # ---- scope (§11.1) ----
    # §11.1 items 1-4, rewritten for BA's §2 model. The two checks this
    # replaces tested the WITHDRAWN premise — "chọn riêng lẻ ⇒ đã xác minh không
    # có BCTC hợp nhất" — which is the manual confirmation §1 item 4 says must no
    # longer block anything.
    bad = [f"{r['symbol']} {r['period']}" for r in scope_rows
           if r["symbol"] in ("BHI", "BIC", "PTI")
           and r["selected_report_type"] != "CONSOLIDATED"]
    checks.append(fails("CHECK_SCOPE_01", bad,
                        "BHI, BIC, PTI dùng hợp nhất ở mọi kỳ (§11.1.1)"))

    SIX = ("ABI", "AIC", "BLI", "BMI", "MIG", "PGI")
    bad = [f"{r['symbol']} {r['period']}" for r in scope_rows
           if r["symbol"] in SIX and r["usage_status"] != SCOPE_USED]
    checks.append(fails(
        "CHECK_SCOPE_02", bad,
        "sáu mã riêng lẻ được dùng theo chuỗi nguồn liên tục, không bị chặn "
        "vì yêu cầu xác minh thủ công cũ (§11.1.2)"))

    # §11.1.4 — THE CHECK THAT ENCODES BA's CORRECTION. A zero minority interest
    # must never produce PARENT_VERIFIED, because a consolidated report of a
    # wholly-owned parent reads zero too. Only a direct source label earns it.
    bad = []
    for r in scope_rows:
        if r["scope_status"] != "PARENT_VERIFIED":
            continue
        if (src.get((r["symbol"], r["period"])) or {}).get("report_scope") != "ĐL":
            bad.append(f"{r['symbol']} {r['period']}")
    checks.append(fails(
        "CHECK_SCOPE_04A", bad,
        "PARENT_VERIFIED chỉ khi nguồn ghi TRỰC TIẾP riêng lẻ — không bao giờ "
        "từ lợi ích cổ đông không kiểm soát = 0 (§2.3, §11.1.4)"))

    # §11.1.3 — the first period of a series, with no direct evidence.
    bad = []
    for s_ in SY:
        first = min(p_ for (sy, p_) in scope_res if sy == s_)
        r = scope_res[(s_, first)]
        if (r["provider_report_type"] == "UNDETERMINED"
                and r["scope_status"] != "SCOPE_AS_PROVIDED_BASELINE"):
            bad.append(f"{s_} {first}")
    checks.append(fails(
        "CHECK_SCOPE_04B", bad,
        "kỳ đầu chuỗi thiếu bằng chứng trực tiếp ⇒ SCOPE_AS_PROVIDED_BASELINE "
        "(§2.5, §11.1.3)"))

    # §11.1.5 / §8 — the program must READ the new table, not merely write it.
    # Proved by reading back and comparing to what was resolved in memory.
    # A read-back that never ran is UNKNOWN, not a violation — the same rule
    # §5.2 states for scope. Reporting it as FAIL under --no-persist inflated
    # the failure count with a check nobody had performed, which is the
    # unmeasured-condition mistake in the other direction.
    checks.append(fails(
        "CHECK_SCOPE_073",
        [] if scope_db_rows is None or scope_db_rows == len(scope_rows)
        else [f"ghi {len(scope_rows)} nhưng đọc lại {scope_db_rows}"],
        "migration 073 đã áp và số dòng phạm vi đọc lại khớp số dòng đã ghi",
        pending=(None if scope_db_rows is not None
                 else ["chưa ghi — chạy không có --no-persist để kiểm tra"]),
        note=(f"đọc lại {scope_db_rows} dòng từ fa_insurance_report_scope"
              if scope_db_rows is not None else
              "chưa ghi (bản chạy --no-persist không kiểm tra được vòng ghi/đọc)")))

    # §5.2 — the rule, verbatim: unknown on either side is PENDING, never PASS.
    bad, pend = [], []
    for r in rows:
        cur_s = record_scope.get((r["symbol"], r["period"]))
        pri_s = record_scope.get((r["symbol"], shift(r["period"], 4)))
        if cur_s in (None, "UNDETERMINED") or pri_s in (None, "UNDETERMINED"):
            pend.append(f"{r['symbol']} {r['period']}")
        elif cur_s != pri_s:
            bad.append(f"{r['symbol']} {r['period']}")
    checks.append(fails(
        "CHECK_SCOPE_03", bad,
        "P2: phạm vi quý hiện tại và cùng kỳ đều xác định VÀ giống nhau",
        pending=pend,
        note=("Trước đây báo PASS: quy tắc cũ chỉ so sánh hai giá trị và phải "
              "xếp 'chưa xác định' về một phía. Nay kỳ cùng kỳ chưa xác định "
              "phạm vi thì kết quả là PENDING." if pend else None)))

    # §6.2 — all five source periods of P3, by the same rule.
    bad, pend = [], []
    for r in rows:
        rid = r["p3_metric_result_id"]
        sc = [record_scope.get((r["symbol"], p_)) for p_ in req_periods.get(rid, ())]
        st = scope_status_for(sc) if sc else "PENDING"
        if st == "FAIL":
            bad.append(f"{r['symbol']} {r['period']}")
        elif st == "PENDING":
            pend.append(f"{r['symbol']} {r['period']}")
    checks.append(fails(
        "CHECK_SCOPE_04", bad,
        "P3: cả 4 quý TTM và 2 mốc tài sản đều xác định phạm vi và chỉ có một phạm vi",
        pending=pend,
        note=("Kiểm tra trên TOÀN BỘ kỳ nguồn bắt buộc, không bỏ qua dòng chưa "
              "biết vì một dòng tổng đã có phạm vi (§6.3)." if pend else None)))

    # §11.1 — the guard on the rule itself. It can only pass by construction
    # today, and that is the point: it is what would catch a future edit that
    # lets an undetermined source through the gate.
    bad = [f"{r['symbol']} {r['period']} {r['metric_code']}" for r in results
           if r["scoring_eligibility"] == "ELIGIBLE"
           and r["metric_code"] not in SCOPE_EXEMPT_METRICS
           and (r["scope_validation_status"] != "PASS"
                or r.get("scope_undetermined_periods"))]
    checks.append(fails("CHECK_SCOPE_05", bad,
                        "không có kết quả ELIGIBLE nào chứa nguồn scope chưa xác định"))

    # ---- P1-P4 formulas (§11.2) ----
    bad = [f"{r['symbol']} {r['period']}" for r in rows
           if r["p1_reconciliation_diff"] is not None
           and r["p1_reconciliation_diff"] > TOL]
    checks.append(fails("CHECK_P1_01", bad,
                        f"|LN gộp bảo hiểm − (DTT + tổng chi phí)| ≤ {TOL} tỷ"))
    bad = [f"{r['symbol']} {r['period']}" for r in rows
           if r["p2_underwriting_margin_delta_yoy_pp"] is not None
           and abs(r["p2_underwriting_margin_delta_yoy_pp"]
                   - (r["p1_current_q_pct"] - r["p1_same_q_last_year_pct"])) > 1e-9]
    checks.append(fails("CHECK_P2_01", bad, "P2 = P1 hiện tại − P1 cùng quý năm trước"))
    bad = [r["metric_result_id"] for r in results
           if r["metric_code"] == "P2" and r["unit"] != "điểm phần trăm"]
    checks.append(fails("CHECK_P2_02", bad, "đơn vị P2 là điểm phần trăm"))
    bad = [f"{r['symbol']} {r['period']}" for r in rows
           if r["p3_calculation_status"] == "PASS_DERIVED"
           and len([x for x in (r["investment_income_net_ttm"],) if x is None])]
    bad += [f"{r['symbol']} {r['period']} lineage" for r in results
            if r["metric_code"] == "P3" and r["calculation_status"] == CALC_ACCEPTED
            and len([L for L in lin_by.get(r["metric_result_id"], [])
                     if L["source_role"].startswith("P3_NET_FINANCE")]) != 4]
    checks.append(fails("CHECK_P3_01", bad, "đủ bốn quý lợi nhuận tài chính thuần"))
    bad = [f"{r['symbol']} {r['period']}" for r in rows
           if r["p3_calculation_status"] == "PASS_DERIVED"
           and (r["investment_assets_begin_ttm"] is None
                or r["investment_assets_end_ttm"] is None)]
    checks.append(fails("CHECK_P3_02", bad, "đủ tài sản đầu và cuối kỳ TTM"))
    # §3.3 — the numerator is already a 12-month figure. Asserted by recomputing
    # the ratio from the two stored inputs: a stray ×4 would show up as 4.0.
    bad = [f"{r['symbol']} {r['period']}" for r in rows
           if r["p3_investment_yield_net_ttm_pct"] is not None
           and r["investment_assets_average_ttm"]
           and abs(r["p3_investment_yield_net_ttm_pct"]
                   - r["investment_income_net_ttm"]
                   / r["investment_assets_average_ttm"] * 100) > 1e-9]
    checks.append(fails("CHECK_P3_03", bad,
                        "P3 = LN tài chính thuần TTM / tài sản bình quân TTM × 100, KHÔNG nhân 4"))
    bad = [f"{r['symbol']} {r['period']}" for r in rows
           if r["deposit_duplication_check"] != "NO_DUPLICATION"]
    checks.append(fails("CHECK_P3_04", bad,
                        "không cộng trùng tiền gửi đã nằm trong đầu tư ngắn hạn"))
    bad = [f"{r['symbol']} {r['period']}" for r in rows if r["p4_reserve_basis"] != "GROSS"]
    checks.append(fails("CHECK_P4_01", bad, "P4 dùng dự phòng GỘP"))
    bad = [f"{r['symbol']} {r['period']}" for r in rows
           if r["p4_gross_coverage_x"] is not None
           and {L["source_period"] for L in lin_by.get(r["p4_metric_result_id"], [])}
           != {r["period"]}]
    checks.append(fails("CHECK_P4_02", bad, "tử số và mẫu số P4 cùng kỳ"))

    # ---- P3 volatility flag (§7.4) ----
    bad = []
    for r in rows:
        yq, med8 = r["investment_yield_q_pct"], r["investment_yield_prior_8q_median_pct"]
        expect = ("INSUFFICIENT_HISTORY" if med8 is None
                  else "HIGH_VARIATION" if (med8 > 0 and yq is not None
                                            and yq > VOLATILITY_MULTIPLE * med8)
                  else "NORMAL")
        if r["investment_income_volatility_flag"] != expect:
            bad.append(f"{r['symbol']} {r['period']}")
    checks.append(fails("CHECK_P3_FLAG_01", bad,
                        "HIGH_VARIATION ⇔ hiệu suất quý > 2 × trung vị 8 quý trước"))
    bad = [f"{r['symbol']} {r['period']} {r['metric_code']}" for r in results
           if r["metric_code"] == "P3" and "VOLATILITY" in r["calculation_status"]]
    checks.append(fails("CHECK_P3_FLAG_02", bad,
                        "calculation_status không mang cờ biến động"))
    mr_flags = Counter(r["metric_flag"] for r in results if r["metric_code"] == "P3")
    out_flags = Counter(r["investment_income_volatility_flag"] for r in rows)
    bad = ([f"METRIC_RESULT {dict(mr_flags)} ≠ P1_P5_OUTPUT {dict(out_flags)}"]
           if mr_flags != out_flags else [])
    checks.append(fails("CHECK_P3_FLAG_03", bad,
                        "số cờ trong METRIC_RESULT = số cờ trong P1_P5_OUTPUT",
                        note=f"METRIC_RESULT: {dict(mr_flags)}"))

    # ---- classification (§11.5) ----
    dup = [k for k, v in Counter(
        u["symbol"] for u in universe
        if u["classification_usage_status"] == "ACTIVE").items() if v > 1]
    checks.append(fails("CHECK_CLASSIFICATION_01", dup,
                        "mỗi mã chỉ có một phân loại ACTIVE tại một thời điểm"))
    bad = [u["symbol"] for u in universe if u["symbol"] in ("PVI", "BVH")
           and u["belongs_to_nonlife_universe"]]
    fallback = universe and universe[0]["classification_read_from"].startswith("FALLBACK")
    checks.append(fails(
        "CHECK_CLASSIFICATION_02", bad,
        "PVI và BVH không quay lại Phi nhân thọ khi thiếu bảng phân loại",
        note=("bảng phân loại KHÔNG đọc được — chạy ở chế độ fallback, "
              "không đạt chuẩn nghiệm thu" if fallback else None)))
    bad = [u["symbol"] for u in universe
           if u["classification_usage_status"] == "BLOCKED" and u["display_group"] != "BLOCKED"]
    checks.append(fails("CHECK_CLASSIFICATION_03", bad,
                        "mã BLOCKED không được tự động đưa vào tab"))

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
    # §11.4 — a required source must carry a DETERMINED scope before its metric
    # can be scored. Distinct from CHECK_SCOPE_05: that one reads the resolved
    # verdict, this one reads the lineage rows themselves, so a resolver that
    # disagreed with its own sources would be caught.
    bad, pend = [], []
    for r in results:
        rid = r["metric_result_id"]
        unknown = [L["source_period"] for L in lin_by.get(rid, [])
                   if L["source_period"] in {p_ for p_ in req_periods.get(rid, ())}
                   and record_scope.get((r["symbol"], L["source_period"]))
                   in (None, "UNDETERMINED")]
        if not unknown:
            continue
        (bad if r["scoring_eligibility"] == "ELIGIBLE" else pend).append(
            f"{r['symbol']} {r['period']} {r['metric_code']}")
    checks.append(fails("CHECK_LINEAGE_08", bad,
                        "nguồn bắt buộc phải có report_scope xác định trước khi ELIGIBLE",
                        pending=pend))
    known = {r["metric_result_id"] for r in results}
    bad = sorted({L["metric_result_id"] for L in lin if L["metric_result_id"] not in known})
    checks.append(fails("CHECK_LINEAGE_10", bad,
                        "không có lineage trỏ tới metric_result_id không tồn tại"))
    bad = sorted(r["metric_result_id"] for r in results
                 if r["metric_result_id"] not in lin_by)
    checks.append(fails("CHECK_LINEAGE_09", bad, "không có metric_result_id mồ côi"))

    # ---------- §6 — the tier-2 check -----------------------------------
    # Deliberately NOT a `fails(...)`: every other check here asks whether the
    # arithmetic is self-consistent, and all of them can pass while not one
    # filing has been read. §6.1 says so outright — "38 PASS" proves the
    # numbers ran, never that the round is finished. This check is the only one
    # that answers the second question, so it is built and reported separately.
    latest = QUARTERS[-1]
    tier2_check = check_tier2_current(
        [r_["one_off_review_status"] for r_ in one_off_rows
         if r_["period"] == latest])
    _t2_out = sorted(f"{r_['symbol']} {r_['one_off_review_status']}"
                     for r_ in one_off_rows if r_["period"] == latest
                     and completion_status(r_["one_off_review_status"])
                     != COMPLETION_COMPLETED)
    checks.append({
        "check": CHECK_ONE_OFF_TIER2_CURRENT,
        "quy_tac": ("PASS khi mọi mã kỳ hiện tại có one_off_review_status thuộc "
                    "AUTO_NORMAL / CONFIRMED_NORMAL / CONFIRMED_ONE_OFF; PENDING "
                    "khi còn REVIEW_TRIGGERED hoặc SOURCE_INCOMPLETE (§6)"),
        # A PENDING here is NOT a violation of an arithmetic rule, so it is
        # counted in the unverified column rather than the violation one —
        # otherwise the FAIL total would grow for work that is merely unfinished.
        "so_vi_pham": 0,
        "so_chua_xac_dinh": tier2_check["outstanding"],
        "ket_qua": tier2_check["result"],
        "chi_tiet": ", ".join(_t2_out) or "—",
        "ghi_chu": (f"{tier2_check['total']} mã kỳ {latest}; "
                    f"chờ tầng 2 {tier2_check['pending_review']}; "
                    f"không lấy được nguồn {tier2_check['source_incomplete']}"),
    })

    # ---------- §14 summary table ----------
    by = {(r["symbol"], r["period"]): r for r in rows}
    p5_by = {r["symbol"]: r for r in p5}
    table = []
    for s in SY:
        r, v = by.get((s, latest), {}), p5_by.get(s, {})
        f = lambda x, d=2: "—" if x is None else f"{x:,.{d}f}"
        sc = scope_res.get((s, latest), {})
        g = gate_by.get((s, latest), {})
        oo = one_off_by.get((s, latest), {})
        table.append({
            "Mã": s, "Tên": names.get(s), "data_period": latest,
            # §10.1 — the report type the source recorded, what the system
            # selected, and the evidence grade, as three separate columns.
            "Loại BC nguồn ghi": sc.get("provider_report_type"),
            "Phạm vi hệ thống chọn": sc.get("selected_report_type"),
            "Trạng thái phạm vi": sc.get("scope_status"),
            "P1 (%)": f(r.get("p1_underwriting_margin_pct")),
            "P1 trạng thái": r.get("p1_scoring_eligibility"),
            "P2 (điểm %)": f(r.get("p2_underwriting_margin_delta_yoy_pp")),
            "P2 trạng thái": r.get("p2_scoring_eligibility"),
            "P3 TTM (%)": f(r.get("p3_investment_yield_net_ttm_pct")),
            "P3 trạng thái": r.get("p3_scoring_eligibility"),
            # The prior round blanked this unless HIGH_VARIATION, so a column of
            # "NORMAL" would not read as a column of warnings. §9.2 now forbids
            # an unexplained blank, and the two rules point opposite ways here —
            # so the AUDIT export prints the measured value and the dashboard
            # keeps the sparse rendering. A measured NORMAL is a result, and
            # none of §9.2's four stand-in words can say that; blanking it would
            # make "we measured this and it was ordinary" look identical to
            # "nothing was measured", which is the distinction §9.2 exists for.
            "Cờ biến động P3": (r.get("investment_income_volatility_flag")
                                or NOT_APPLICABLE),
            "P4 gộp (lần)": f(r.get("p4_gross_coverage_x")),
            "P4 trạng thái": r.get("p4_scoring_eligibility"),
            "P5 (lần)": f(v.get("p5_pb_relative_x"), 3),
            "P5 trạng thái": v.get("p5_scoring_eligibility"),
            "Số quý P/B": v.get("pb_observation_count"),
            # §5 — DATA_READY / BLOCKED, which is a statement about P1-P5 only.
            # It used to read ELIGIBLE, a word the one-off and FA layers also
            # use, so one glance could not tell which question had been answered.
            "company_metric_eligibility": ("DATA_READY"
                                           if g.get("eligible_for_total")
                                           else "BLOCKED"),
            "Chỉ tiêu đang chặn": g.get("blocking_criteria") or NOT_APPLICABLE,
            "Điều kiện T1–T5 kích hoạt": oo.get("triggers_fired") or "KHÔNG",
            "one_off_review_status": oo.get("one_off_review_status"),
            # §9.2 items 10-14. A verdict with no one-off has no amount, no
            # ratio and no deduction to state — but the DEDUCTION is a measured
            # 0, while the amount and the ratios do not apply. §9.2 forbids one
            # blank standing for both, so they take different values.
            "Tài liệu tầng 2 đã đọc": (oo.get("tier2_source_document")
                                       or NOT_APPLICABLE),
            "Trang/thuyết minh đã đọc": (oo.get("tier2_source_page_note")
                                         or NOT_APPLICABLE),
            "Khoản one-off xác nhận": _oo_amount(oo),
            "Cơ sở trước/sau thuế": _oo_basis(oo),
            "R_Q": _oo_ratio(oo, "r_q"),
            "R_TTM": _oo_ratio(oo, "r_ttm"),
            "R sử dụng": _oo_ratio(oo, "r_used"),
            "Điểm trừ one-off": _oo_penalty(oo),
            # §5 — the process state, separate from the verdict above.
            "one_off_completion_status": completion_status(
                oo.get("one_off_review_status") or STATUS_REVIEW_TRIGGERED),
            # §7 — three fields, not one "Kỳ FA". The data round has a data
            # period; it does NOT have a completed FA period, because BA has not
            # locked the P1-P5 thresholds and nothing has been scored.
            "fa_completion_status": NOT_SCORED_BY_DESIGN,
            "fa_completed_period": NOT_SCORED_BY_DESIGN,
            "Điểm FA thô": NOT_SCORED_BY_DESIGN,
            "Điểm FA cuối": NOT_SCORED_BY_DESIGN,
            "Lý do chưa hoàn thành": _incomplete_reason(g, oo),
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
        dist("P5 P/B tương đối", "p5_pb_relative_x", p5, "lần", 3),
        dist("Tỷ lệ nhượng tái", "ceded_share_pct", cur, "%", 1),
        {"chi_tieu": "— trên toàn bộ 4 quý —"},
        dist("P1 (4 quý)", "p1_underwriting_margin_pct", rows, "%"),
        dist("P3 TTM (4 quý)", "p3_investment_yield_net_ttm_pct", rows, "%"),
    ]

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
        # §7 — the two are reported SEPARATELY now. One field said both, so 35
        # ordinary readings carried a volatility announcement.
        {"muc": "P3 calculation_status",
         "gia_tri": " · ".join(f"{k} {v}" for k, v in sorted(Counter(
             r["calculation_status"] for r in results
             if r["metric_code"] == "P3").items()))},
        {"muc": "P3 cờ biến động (metric_flag)",
         "gia_tri": " · ".join(f"{k} {v}" for k, v in sorted(vol_counts.items()))},
        {"muc": "cờ biến động tác động điểm", "gia_tri": "KHÔNG — chỉ là thông tin (§7.3)"},
        {"muc": "P3 nhân 4", "gia_tri": "KHÔNG — công thức đã ở cơ sở 12 tháng"},
        {"muc": "P4 cơ sở chấm", "gia_tri": "GROSS (thuần chỉ tham khảo)"},
        {"muc": "P5 cửa sổ", "gia_tri": f"tối đa {PB_MAX_OBS}, tối thiểu {PB_MIN_OBS} quý"},
        {"muc": "P5 ACCEPTED", "gia_tri": f"{sum(1 for r in p5 if r['p5_acceptance_status']=='ACCEPTED')}/{len(p5)}"},
        {"muc": "IFA", "gia_tri": "belongs_to_nonlife_universe=True · "
                                   "eligible_for_scoring=False · display_group=WATCHLIST"},
        {"muc": "phạm vi báo cáo", "gia_tri": "đọc từ header BCTC, KHÔNG mặc định hợp nhất"},
        {"muc": "truy vết nguồn", "gia_tri": "Kết quả từng chỉ tiêu lưu tại METRIC_RESULT; toàn bộ nguồn dữ liệu dùng để tính kết quả lưu tại METRIC_SOURCE_LINEAGE (§10.3)"},
        {"muc": "formula_version", "gia_tri": FORMULA_VERSION},
        {"muc": "ngưỡng điểm", "gia_tri": "KHÔNG đặt — §15.17"},
        {"muc": "giao diện", "gia_tri": "KHÔNG lập trình — §15.18"},
    ]

    # §12.2 / §12.3 — grouped by ROOT CAUSE, not one line per downstream
    # symptom. BA's objection was precise: the old file's 96 / 120 / 54 / 4 were
    # the chain effects of ONE scope problem presented as hundreds of
    # independent faults.
    def _issue(cause, syms, periods, metrics, status, checked, action):
        return {"nguyen_nhan_goc": cause,
                "ma_anh_huong": ", ".join(sorted(set(syms))) or "—",
                "ky_anh_huong": ", ".join(sorted(set(periods))) or "—",
                "chi_tieu_anh_huong": ", ".join(sorted(set(metrics))) or "—",
                "trang_thai": status, "nguon_da_kiem_tra": checked,
                "hanh_dong_can_lam": action}

    issues = []
    blocked = [r for r in results if r["scoring_eligibility"] == "BLOCKED"]
    by_cause: dict[str, list] = {}
    for r in blocked:
        # The first named condition in blocked_reason IS the root cause; the rest
        # are its consequences on the same row.
        cause = (r["blocked_reason"] or "không rõ").split(";")[0].split("—")[0].strip()
        by_cause.setdefault(cause, []).append(r)
    for cause, rs in sorted(by_cause.items(), key=lambda x: -len(x[1])):
        issues.append(_issue(
            cause, [x["symbol"] for x in rs], [x["period"] for x in rs],
            [x["metric_code"] for x in rs],
            f"BLOCKED · {len(rs)} kết quả chỉ tiêu",
            "fa_vnstock_statements, fa_statement_release_dates, "
            "fa_insurance_report_scope",
            "xem blocked_reason trong METRIC_RESULT cho từng mã–kỳ"))
    waiting = [v for v in scope_res.values()
               if v["usage_status"] != SCOPE_USED]
    if waiting:
        issues.append(_issue(
            "Kỳ hiện tại chỉ có BCTC riêng lẻ trong khi kỳ hoàn thành gần nhất "
            "dùng hợp nhất (§2.1.4)",
            [v["symbol"] for v in waiting], [v["period"] for v in waiting],
            ["P1", "P2", "P3", "P4"], "WAITING_CONSOLIDATED",
            "header BCTC (nguồn), fa_insurance_control_events",
            "chờ BCTC hợp nhất của kỳ hiện tại; giữ điểm kỳ hoàn thành gần nhất"))
    triggered = [r for r in one_off_rows
                 if r["one_off_review_status"] == "REVIEW_TRIGGERED"]
    if triggered:
        issues.append(_issue(
            "Bộ lọc số học T1–T5 kích hoạt — cần tier 2 đọc BCTC gốc (§3.2)",
            [r["symbol"] for r in triggered], [r["period"] for r in triggered],
            ["Điểm trừ one-off"], "REVIEW_TRIGGERED",
            "fa_vnstock_statements (LNTT, thu nhập khác, DT tài chính)",
            "prompt mở BCTC gốc + thuyết minh trên website DN; chưa trừ điểm"))
    # §9.3 — a symbol whose source could not be obtained is an OPEN issue and
    # must appear here. It is deliberately a separate row from REVIEW_TRIGGERED:
    # "nobody has read it yet" is closed by reading, while "we tried and could
    # not get the document" is closed by someone supplying it, and one row for
    # both would hide which action is needed.
    incomplete = [r for r in one_off_rows
                  if r["one_off_review_status"] == STATUS_SOURCE_INCOMPLETE]
    if incomplete:
        issues.append(_issue(
            "Đã chạy tầng 2 nhưng KHÔNG lấy được BCTC gốc — cần BA cung cấp "
            "bản mềm (§3.2)",
            [r["symbol"] for r in incomplete], [r["period"] for r in incomplete],
            ["Điểm trừ one-off"], STATUS_SOURCE_INCOMPLETE,
            "website doanh nghiệp (12 tên miền), HNX, SSC, Vietstock, CafeF, "
            "Simplize, Fireant, VNDirect, kho static2.vietstock.vn, tìm kiếm web",
            "BA gửi BCTC quý II/2026 (kèm bản đính chính 03/08/2026); xem "
            "rationale trong one_off_tier2_results.json"))
    # §9.3 — "giữ lại lịch sử vấn đề và thêm kết quả đóng, không xóa dấu vết".
    # These five DID trigger and WERE read; correcting the T4 input means tier 1
    # no longer raises them, so without this row the workbook would show no
    # trace that the round's largest piece of work ever happened.
    closed = [r for r in one_off_rows
              if r.get("tier1_status_before_tier2")
              and r["one_off_review_status"] != STATUS_SOURCE_INCOMPLETE]
    if closed:
        issues.append(_issue(
            "ĐÃ ĐÓNG — T4 kích hoạt theo ánh xạ cũ, đã đọc BCTC gốc và xác nhận "
            "bình thường (§3.5)",
            [r["symbol"] for r in closed], [r["period"] for r in closed],
            ["Điểm trừ one-off"], "CONFIRMED_NORMAL · điểm trừ 0",
            "BCTC gốc + thuyết minh của từng doanh nghiệp (xem cột 'Tài liệu "
            "tầng 2 đã đọc')",
            "không còn hành động; giữ dòng này làm dấu vết theo §9.3"))
    unlabelled = [v for v in scope_res.values()
                  if v["scope_status"] in ("SCOPE_AS_PROVIDED_CONTINUOUS",
                                           "SCOPE_AS_PROVIDED_BASELINE")]
    if unlabelled:
        issues.append(_issue(
            "Nguồn chỉ phục vụ nhãn loại báo cáo cho 4 quý gần nhất (§2.3)",
            [v["symbol"] for v in unlabelled], [v["period"] for v in unlabelled],
            ["P2", "P3"], "SCOPE_AS_PROVIDED — trạng thái vận hành, "
            "KHÔNG phải đã xác minh",
            "header BCTC: đã thử page_size 6/20/40, nguồn luôn trả 4 quý",
            "không chặn tính toán (§2.5.3); không ghi là đã xác minh riêng lẻ"))

    failed = [c for c in checks if c["ket_qua"] == "FAIL"]
    pending_checks = [c for c in checks if c["ket_qua"] == "PENDING"]
    elig = Counter((r["metric_code"], r["scoring_eligibility"]) for r in results)
    scope_state = Counter(r["scope_status"] for r in scope_rows)
    review_state = Counter(r["scope_review_status"] for r in scope_rows)
    full = sorted({r["symbol"] for r in results} - {
        r["symbol"] for r in results if r["scoring_eligibility"] != "ELIGIBLE"})
    summary = [*summary,
        # §12 — computable and scoreable are DIFFERENT counts and are labelled
        # as such. One "đủ điều kiện" number over both is what BA rejected.
        {"muc": "— tách công thức tính được vs đủ điều kiện chấm —", "gia_tri": ""},
        *[{"muc": f"{c} tính được (calculation_status=ACCEPTED)",
           "gia_tri": f"{sum(1 for r in results if r['metric_code'] == c and r['calculation_status'] == CALC_ACCEPTED)}"
                      f"/{sum(1 for r in results if r['metric_code'] == c)}"}
          for c in ("P1", "P2", "P3", "P4", "P5")],
        *[{"muc": f"{c} đủ điều kiện chấm (scoring_eligibility=ELIGIBLE)",
           "gia_tri": f"{elig[(c, 'ELIGIBLE')]}"
                      f"/{sum(1 for r in results if r['metric_code'] == c)}"}
          for c in ("P1", "P2", "P3", "P4", "P5")],
        {"muc": "DN đủ cả P1–P5 ELIGIBLE tại mọi kỳ (§10.2)",
         "gia_tri": f"{len(full)}/{len(SY)}" + (f" — {', '.join(full)}" if full else "")},
        # §4.2 raises a comparability question the per-result rule cannot see:
        # every condition in §10.1 is INTRA-result, while a ranking compares
        # symbols. So the basis of the official table is reported separately.
        {"muc": "cơ sở báo cáo của bảng chính thức có đồng nhất giữa các mã?",
         "gia_tri": (lambda b: ("CÓ — tất cả " + " · ".join(f"{k} {v} mã"
                                for k, v in sorted(b.items())))
                     if len(b) == 1 else
                     ("KHÔNG — " + " · ".join(f"{k} {v} mã" for k, v in sorted(b.items()))))(
             Counter(record_scope.get((s_, QUARTERS[-1])) for s_ in full)) if full
             else "không có mã nào trong bảng chính thức"},
        {"muc": "— phạm vi báo cáo trên MỌI kỳ nguồn —", "gia_tri": ""},
        {"muc": "số mã-kỳ nguồn được xác minh phạm vi", "gia_tri": len(scope_rows)},
        {"muc": "scope_status (§2.4)",
         "gia_tri": " · ".join(f"{k} {v}" for k, v in sorted(scope_state.items()))},
        {"muc": "scope_review_status",
         "gia_tri": " · ".join(f"{k} {v}" for k, v in sorted(review_state.items()))},
        {"muc": "sự kiện mất quyền kiểm soát đã xác minh (§2.6)",
         "gia_tri": f"{n_events} sự kiện — bảng fa_insurance_control_events"},
        {"muc": "ghi chú cột legacy 072",
         "gia_tri": "scope_selection_reason/scope_review_status trả lời câu hỏi "
                    "CŨ (có tồn tại BCTC hợp nhất hay không) mà BA đã bỏ; "
                    "scope_status mới là trạng thái theo §2.4. NOT_YET_VERIFIED "
                    "KHÔNG mâu thuẫn với PARENT_VERIFIED — hai câu hỏi khác nhau"},
        {"muc": "— phân loại (§8.2) —", "gia_tri": ""},
        {"muc": "classification_source_status",
         "gia_tri": " · ".join(f"{k} {v}" for k, v in sorted(Counter(
             u["classification_source_status"] for u in universe).items()))},
        {"muc": "classification_usage_status",
         "gia_tri": " · ".join(f"{k} {v}" for k, v in sorted(Counter(
             u["classification_usage_status"] for u in universe).items()))},
        {"muc": "PENDING của phân loại có chặn chấm điểm?",
         "gia_tri": "KHÔNG. classification_usage_status quyết định (ACTIVE/BLOCKED); "
                    "mã ICB rõ ràng là ACTIVE dù chưa BA xác minh thủ công"},
        {"muc": "— nghiệm thu —", "gia_tri": ""},
        # §9.1 — SEVEN separate numbers, because one "38 PASS" line described
        # the arithmetic and was then read as describing the whole process. The
        # arithmetic checks can all pass while not one filing has been read.
        {"muc": "kiểm tra số học", "gia_tri":
            f"PASS {len(checks) - len(failed) - len(pending_checks)} · "
            f"PENDING {len(pending_checks)} · FAIL {len(failed)} / {len(checks)}"},
        {"muc": "số mã P1–P5 DATA_READY", "gia_tri":
            f"{sum(1 for t in table if t['company_metric_eligibility'] == 'DATA_READY')}"
            f"/{len(table)}"},
        {"muc": "số mã one-off hoàn thành", "gia_tri":
            f"{sum(1 for t in table if t['one_off_completion_status'] == COMPLETION_COMPLETED)}"
            f"/{len(table)}"},
        {"muc": "số mã one-off chờ tầng 2", "gia_tri":
            f"{tier2_check['pending_review']} chờ đọc · "
            f"{tier2_check['source_incomplete']} không lấy được nguồn"},
        {"muc": CHECK_ONE_OFF_TIER2_CURRENT, "gia_tri":
            f"{tier2_check['result']} — {tier2_check['outstanding']} mã chưa hoàn tất"},
        {"muc": "số mã FA đã chấm chính thức", "gia_tri":
            f"0/{len(table)} — {NOT_SCORED_BY_DESIGN} (BA chưa khóa thang điểm P1–P5)"},
        {"muc": "trạng thái vòng chấm điểm", "gia_tri":
            f"{NOT_SCORED_BY_DESIGN} — vòng này chỉ là vòng DỮ LIỆU (§2.1)"},
        {"muc": "kiểm tra PENDING", "gia_tri":
            ", ".join(c["check"] for c in pending_checks) or "—"},
        {"muc": "kiểm tra FAIL", "gia_tri":
            ", ".join(c["check"] for c in failed) or "—"},
        {"muc": "run_id", "gia_tri": RUN_ID},
        {"muc": "nguồn phân loại", "gia_tri": universe[0]["classification_read_from"]
            if universe else NOT_AVAILABLE},
        # §12 — "hoàn tất" is not written while anything is PENDING or FAIL.
        {"muc": "trạng thái vòng dữ liệu", "gia_tri":
            "CHƯA HOÀN TẤT — chưa áp migration 072/073" if universe
            and universe[0]["classification_read_from"].startswith("FALLBACK")
            else ("CHƯA HOÀN TẤT — còn kiểm tra FAIL" if failed
                  # §6.2 — the tier-2 check is named separately rather than
                  # folded into "còn kiểm tra PENDING", because it is the one
                  # that decides whether the ROUND is done; the others are
                  # arithmetic. §12 item 5 and item 10 both hang off it.
                  else (f"CHƯA HOÀN TẤT — {CHECK_ONE_OFF_TIER2_CURRENT} = PENDING, "
                        f"{tier2_check['outstanding']} mã chưa hoàn tất one-off "
                        f"(§6.2)" if tier2_check["result"] != "PASS"
                        else "CHƯA HOÀN TẤT — còn kiểm tra PENDING" if pending_checks
                        else "HOÀN TẤT"))},
        # §9.5 — the workbook holds no Excel formulas; the numbers are computed
        # in code and exported. BA accepts that ONLY if it is declared, so that
        # nobody edits an input cell expecting a score to follow.
        {"muc": "— bản xuất (§9.5) —", "gia_tri": ""},
        {"muc": "Workbook type", "gia_tri": "STATIC_AUDIT_EXPORT"},
        {"muc": "ý nghĩa", "gia_tri":
            "Không chứa công thức Excel. Công thức khóa trong mã nguồn; sửa số "
            "trong file này KHÔNG làm điểm tự cập nhật. Cùng dữ liệu + cùng "
            "phiên bản mã nguồn tái tạo cùng kết quả."},
        {"muc": "truy vết", "gia_tri":
            "METRIC_RESULT = kết quả chỉ tiêu · METRIC_SOURCE_LINEAGE = các "
            "dòng nguồn tạo ra kết quả (không có sheet TRUY_VET)"},
        # §11 — the 072 columns answer the question BA withdrew. They stay for
        # database compatibility and must never be read as business state.
        {"muc": "— trường cũ (§11) —", "gia_tri": ""},
        {"muc": "selected_report_scope, scope_review_status, "
                "scope_selection_reason (migration 072)",
         "gia_tri": "LEGACY_DO_NOT_USE_FOR_SCORING — giữ để tương thích CSDL. "
                    "Trường nghiệp vụ chính thức là scope_status (§2.4)."}]

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
        "CONG_DU_DIEU_KIEN": gate_rows,
        "MOT_LAN_T1_T5": one_off_rows,
        "universe_theo_loai_hinh": universe,
        "DANH_SACH_THEO_DOI": watch or [{"note": "không có mã nào chờ dữ liệu"}],
        "VAN_DE_DU_LIEU_CAN_XU_LY": issues or [{"note": "không có"}],
        "meta": run_metadata(out, len(results), len(lin), snapshot),
    })
    print(f"run_id {RUN_ID}")
    print(f"  METRIC_RESULT {len(results)} · LINEAGE {len(lin)} · "
          f"P5_INPUT_HISTORY {len(p5_hist)}")
    print(f"  kiểm tra tự động: PASS {len(checks) - len(failed) - len(pending_checks)}"
          f" · PENDING {len(pending_checks)} · FAIL {len(failed)} / {len(checks)}")
    if pending_checks:
        print(f"    PENDING: {', '.join(c['check'] for c in pending_checks)}")
    if failed:
        print(f"    FAIL: {', '.join(c['check'] for c in failed)}")
    print(f"  phạm vi kỳ nguồn: {len(scope_rows)} mã-kỳ — "
          + " · ".join(f"{k} {v}" for k, v in sorted(scope_state.items()))
          + " | review " + " · ".join(f"{k} {v}" for k, v in sorted(review_state.items())))
    for c_ in ("P1", "P2", "P3", "P4", "P5"):
        tot = sum(1 for r in results if r["metric_code"] == c_)
        print(f"  {c_}: tính được "
              f"{sum(1 for r in results if r['metric_code'] == c_ and r['calculation_status'] == CALC_ACCEPTED)}"
              f"/{tot} · ELIGIBLE {elig[(c_, 'ELIGIBLE')]}/{tot}")
    print(f"  DN đủ cả P1–P5 ELIGIBLE: {len(full)}/{len(SY)}"
          + (f" — {', '.join(full)}" if full else ""))
    print(f"rows {len(rows)} · P3 TTM PASS "
          f"{sum(1 for r in rows if r['p3_calculation_status']=='PASS_DERIVED')}/{len(rows)}"
          f" · cờ biến động {dict(vol_counts)}")
    print(f"P5 ACCEPTED {sum(1 for r in p5 if r['p5_acceptance_status']=='ACCEPTED')}/{len(p5)}")
    print(f"Wrote {out} ({out.stat().st_size / 1024:.0f} KB)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
