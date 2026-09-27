#!/usr/bin/env python3
"""Pins the four rules BA's CHOT_HOAN_THANH_TAB_PHI_NHAN_THO_GUI_IT_V1 settles.

Each of the four had shipped as its opposite, and each failure was invisible in
the output rather than loud:

  1. An UNDETERMINED report scope was reported as PASS, because the check asked a
     two-way question and had to put "unknown" on one side.
  2. The verification covered the four displayed quarters while the formulas read
     eight, so P2's year-ago quarter and P3's TTM opening date had no scope at all.
  3. A volatility flag lived inside `calculation_status`, so all 36 P3 results
     announced a volatility that one observation had.
  4. `PENDING` meant "blocks" on one row and "does not block" on the next.

Runs standalone or under pytest.
"""
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from export_insurance_nonlife_check import (  # noqa: E402
    CALC_ACCEPTED, CALC_REJECTED, SCOPE_SOURCE_OFFSETS, finalise_statuses,
    metric_result, quarter_end, resolve_scope, scope_status_for, shift,
)

HDR_HN = {"report_scope": "HN"}
HDR_DL = {"report_scope": "ĐL"}
POLICY_NONE = {}
POL_NO_CONSO = {"X": {"scope_policy": "NO_CONSOLIDATED_PREPARED",
                      "effective_from": "2020-01-01", "effective_to": None,
                      "verification_source": "CBTT HNX — <link>",
                      "verified_date": "2026-09-27", "verified_by": "BA",
                      "note": None}}
POL_CONSO = {"X": {"scope_policy": "CONSOLIDATED_PREPARED",
                   "effective_from": "2020-01-01", "effective_to": None,
                   "verification_source": "CBTT HNX — <link>",
                   "verified_date": "2026-09-27", "verified_by": "BA", "note": None}}

_fail = []


def check(name, cond, detail=""):
    print(f"{'ok  ' if cond else 'FAIL'} {name}" + (f" — {detail}" if detail else ""))
    if not cond:
        _fail.append(name)


# ---------------------------------------------------------------------------
# 1. Unknown is not agreement (§5.2, §6.2)
# ---------------------------------------------------------------------------
def test_unknown_scope_is_PENDING_never_PASS():
    check("PENDING on UNDETERMINED",
          scope_status_for(["CONSOLIDATED", "UNDETERMINED"]) == "PENDING")
    check("PENDING on None",
          scope_status_for(["CONSOLIDATED", None]) == "PENDING")
    # The whole point: a single known value plus an unknown one must NOT read as
    # a match, which is what the previous rule reported.
    check("one known + unknown is not PASS",
          scope_status_for(["STANDALONE", "UNDETERMINED"]) != "PASS")
    check("PASS on one distinct known",
          scope_status_for(["STANDALONE", "STANDALONE"]) == "PASS")
    check("FAIL on two distinct known",
          scope_status_for(["STANDALONE", "CONSOLIDATED"]) == "FAIL")
    # PENDING wins over FAIL: with an unknown in the set we cannot claim the
    # known ones are the whole story.
    check("PENDING outranks FAIL",
          scope_status_for(["STANDALONE", "CONSOLIDATED", "UNDETERMINED"]) == "PENDING")


# ---------------------------------------------------------------------------
# 2. Evidence admissible for a report scope (§4.2, §4.5)
# ---------------------------------------------------------------------------
def test_header_consolidated_is_verified():
    r = resolve_scope("X", "2026-Q2", HDR_HN, 1.0, POLICY_NONE)
    check("header HN ⇒ CONSOLIDATED", r["record_report_scope"] == "CONSOLIDATED")
    check("header HN ⇒ VERIFIED", r["scope_review_status"] == "VERIFIED")
    check("header HN ⇒ available True", r["consolidated_report_available"] is True)


def test_header_standalone_knows_the_record_but_not_the_existence():
    """The distinction the old single column could not hold."""
    r = resolve_scope("X", "2026-Q2", HDR_DL, 0.0, POLICY_NONE)
    check("header ĐL ⇒ record STANDALONE", r["record_report_scope"] == "STANDALONE")
    # NULL, not False. False would claim a verification nobody performed.
    check("header ĐL ⇒ existence unknown (None)",
          r["consolidated_report_available"] is None)
    check("header ĐL ⇒ review PENDING", r["scope_review_status"] == "PENDING")
    check("header ĐL ⇒ method is the header",
          r["scope_verification_method"] == "STATEMENT_HEADER")


def test_minority_interest_identifies_a_consolidated_record():
    """Admissible because it asserts PRESENCE of a consolidated subsidiary."""
    r = resolve_scope("X", "2024-Q3", None, 145_723_147_660.0, POLICY_NONE)
    check("NCI>0, no header ⇒ CONSOLIDATED",
          r["record_report_scope"] == "CONSOLIDATED")
    check("NCI>0 ⇒ method recorded",
          r["scope_verification_method"] == "BALANCE_SHEET_MINORITY_INTEREST")
    check("NCI>0 ⇒ VERIFIED", r["scope_review_status"] == "VERIFIED")


def test_a_ZERO_minority_interest_proves_nothing():
    """THE REFUSAL THAT MATTERS. A zero is consistent with a standalone filing
    AND with consolidating wholly-owned subsidiaries, so it may not decide the
    scope in either direction (BA §4.2). 96 of 171 source periods land here."""
    r = resolve_scope("X", "2024-Q3", None, 0.0, POLICY_NONE)
    check("NCI=0, no header ⇒ UNDETERMINED",
          r["record_report_scope"] == "UNDETERMINED")
    check("NCI=0 ⇒ never VERIFIED", r["scope_review_status"] != "VERIFIED")
    check("NCI=0 ⇒ selected scope UNDETERMINED",
          r["selected_report_scope"] == "UNDETERMINED")
    check("NCI=0 ⇒ existence still unknown",
          r["consolidated_report_available"] is None)
    # A missing balance sheet is the same answer, not a worse one.
    r2 = resolve_scope("X", "2021-Q1", None, None, POLICY_NONE)
    check("no balance sheet ⇒ UNDETERMINED",
          r2["record_report_scope"] == "UNDETERMINED")


def test_a_verified_policy_is_what_closes_the_existence_question():
    r = resolve_scope("X", "2024-Q3", None, 0.0, POL_NO_CONSO)
    check("policy NO_CONSOLIDATED ⇒ STANDALONE",
          r["record_report_scope"] == "STANDALONE")
    # The ONLY route to False: a verified negative.
    check("policy NO_CONSOLIDATED ⇒ available False",
          r["consolidated_report_available"] is False)
    check("policy ⇒ VERIFIED", r["scope_review_status"] == "VERIFIED")
    check("policy ⇒ source carries the disclosure",
          r["scope_verification_source"].startswith("CBTT"))


def test_a_consolidated_report_the_provider_lacks_is_a_CONFLICT():
    """§4.5 — standalone must not be accepted silently in that case."""
    r = resolve_scope("X", "2026-Q2", HDR_DL, 0.0, POL_CONSO)
    check("policy CONSOLIDATED + ĐL record ⇒ CONFLICT",
          r["scope_review_status"] == "CONFLICT")
    check("CONFLICT ⇒ not selected as standalone",
          r["selected_report_scope"] == "UNDETERMINED")
    check("CONFLICT ⇒ reason names the missing report",
          r["scope_selection_reason"] == "CONSOLIDATED_MISSING_FROM_PROVIDER")


def test_a_policy_does_not_reach_back_before_its_effective_date():
    """§4.6 — the policy is a date range, so a quarter that ended before it
    began is still unverified. Without this a single row would silently restate
    every quarter the company ever filed."""
    pol = {"X": {**POL_NO_CONSO["X"], "effective_from": "2025-01-01"}}
    before = resolve_scope("X", "2024-Q3", None, 0.0, pol)
    after = resolve_scope("X", "2025-Q2", None, 0.0, pol)
    check("quarter before effective_from is untouched",
          before["record_report_scope"] == "UNDETERMINED")
    check("quarter after effective_from is verified",
          after["scope_review_status"] == "VERIFIED")
    check("quarter_end is the quarter's LAST day",
          quarter_end("2025-Q2") == dt.date(2025, 6, 30))


# ---------------------------------------------------------------------------
# 3. The volatility flag is not a status (§7)
# ---------------------------------------------------------------------------
def test_the_flag_never_enters_calculation_status():
    r = metric_result("id", "X", "2026-Q2", "P3", 4.75, "%", CALC_ACCEPTED,
                      "run", flag="HIGH_VARIATION")
    check("flag lives in metric_flag", r["metric_flag"] == "HIGH_VARIATION")
    check("calculation_status is clean", r["calculation_status"] == CALC_ACCEPTED)
    check("no VOLATILITY inside the status",
          "VOLATILITY" not in r["calculation_status"])
    normal = metric_result("id2", "X", "2026-Q2", "P3", 4.75, "%", CALC_ACCEPTED,
                           "run", flag="NORMAL")
    # The defect in one line: the two used to be indistinguishable.
    check("NORMAL and HIGH_VARIATION differ in the row",
          normal["metric_flag"] != r["metric_flag"]
          and normal["calculation_status"] == r["calculation_status"])


def test_the_flag_does_not_block_scoring():
    """§7.3 — information only: it changes no points and no status."""
    rid = "r1"
    res = [metric_result(rid, "X", "2026-Q2", "P3", 4.75, "%", CALC_ACCEPTED,
                         "run", flag="HIGH_VARIATION")]
    lin = [{"metric_result_id": rid, "source_role": "A"}]
    finalise_statuses(res, lin, {("X", "2026-Q2"): "CONSOLIDATED"},
                      {rid: ("2026-Q2",)}, {"X": True}, {rid: {"A"}})
    check("HIGH_VARIATION result is still ELIGIBLE",
          res[0]["scoring_eligibility"] == "ELIGIBLE", res[0]["blocked_reason"] or "")


# ---------------------------------------------------------------------------
# 4. Eligibility is the conjunction, and every refusal names itself (§10)
# ---------------------------------------------------------------------------
def _one(scope_map, periods, company=True, roles={"A"}, present={"A"},
         status=CALC_ACCEPTED, min_hist=True):
    rid = "r"
    res = [metric_result(rid, "X", "2026-Q2", "P3", 1.0, "%", status, "run",
                         min_history_met=min_hist)]
    lin = [{"metric_result_id": rid, "source_role": x} for x in present]
    finalise_statuses(res, lin, scope_map, {rid: periods},
                      {"X": company}, {rid: roles})
    return res[0]


def test_every_condition_can_block_and_says_which():
    ok = _one({("X", "2026-Q2"): "CONSOLIDATED"}, ("2026-Q2",))
    check("all conditions met ⇒ ELIGIBLE", ok["scoring_eligibility"] == "ELIGIBLE")

    r = _one({("X", "2026-Q2"): "CONSOLIDATED", ("X", "2025-Q2"): "UNDETERMINED"},
             ("2026-Q2", "2025-Q2"))
    check("undetermined source ⇒ BLOCKED", r["scoring_eligibility"] == "BLOCKED")
    # §10.2: never "thiếu dữ liệu" — the period is named, because the action
    # needed (obtain a disclosure) differs from every other failure here.
    check("blocked reason names the period", "2025-Q2" in (r["blocked_reason"] or ""))

    r = _one({("X", "2026-Q2"): "CONSOLIDATED"}, ("2026-Q2",), status=CALC_REJECTED)
    check("REJECTED calculation ⇒ BLOCKED", r["scoring_eligibility"] == "BLOCKED")
    check("reason names calculation_status",
          "calculation_status" in (r["blocked_reason"] or ""))

    r = _one({("X", "2026-Q2"): "CONSOLIDATED"}, ("2026-Q2",),
             roles={"A", "B"}, present={"A"})
    check("incomplete lineage ⇒ BLOCKED", r["scoring_eligibility"] == "BLOCKED")
    check("reason names the missing role", "B" in (r["blocked_reason"] or ""))

    r = _one({("X", "2026-Q2"): "CONSOLIDATED"}, ("2026-Q2",), company=False)
    check("company not eligible ⇒ BLOCKED", r["scoring_eligibility"] == "BLOCKED")
    check("reason names the company condition",
          "eligible_for_scoring" in (r["blocked_reason"] or ""))

    r = _one({("X", "2026-Q2"): "CONSOLIDATED"}, ("2026-Q2",), min_hist=False)
    check("too little history ⇒ BLOCKED", r["scoring_eligibility"] == "BLOCKED")
    check("reason names the history condition",
          "lịch sử" in (r["blocked_reason"] or ""))


def test_a_blocked_result_is_never_scored_zero():
    """§10.1 — BLOCKED withholds the result; it does not assert a worst case.
    The value stays on the row for the internal table, and nothing turns it
    into a 0 or an N/A that a ranking could consume."""
    r = _one({("X", "2026-Q2"): "UNDETERMINED"}, ("2026-Q2",))
    check("value survives a block", r["result_value"] == 1.0)
    check("no points field is invented",
          not any(k.endswith("_points") or k == "score" for k in r))


def test_a_result_with_no_required_periods_is_PENDING_not_PASS():
    """A formula whose source periods were never recorded cannot have its scope
    validated. Defaulting to PASS is how an unmeasured condition passes."""
    r = _one({}, ())
    check("no periods ⇒ scope PENDING", r["scope_validation_status"] == "PENDING")
    check("no periods ⇒ BLOCKED", r["scoring_eligibility"] == "BLOCKED")


# ---------------------------------------------------------------------------
# 5. The source periods each criterion reads (§4.3)
# ---------------------------------------------------------------------------
def test_the_source_window_is_the_formula_not_the_display():
    check("P1 reads its own quarter", SCOPE_SOURCE_OFFSETS["P1"] == (0,))
    check("P2 reads the year-ago quarter too",
          SCOPE_SOURCE_OFFSETS["P2"] == (0, 4))
    # Five, not four: the four TTM income quarters PLUS the opening balance date,
    # which is q−4 and was the period nothing had verified.
    check("P3 reads five periods", SCOPE_SOURCE_OFFSETS["P3"] == (0, 1, 2, 3, 4))
    check("P4 reads its own quarter", SCOPE_SOURCE_OFFSETS["P4"] == (0,))
    check("shift crosses the year boundary", shift("2026-Q2", 4) == "2025-Q2")
    check("shift(q, 3) stays inside the TTM window",
          shift("2026-Q1", 3) == "2025-Q2")


if __name__ == "__main__":
    for fn in [v for k, v in sorted(globals().items()) if k.startswith("test_")]:
        print(f"\n-- {fn.__name__}")
        fn()
    print(f"\n{'FAILED: ' + ', '.join(_fail) if _fail else 'all checks passed'}")
    sys.exit(1 if _fail else 0)
