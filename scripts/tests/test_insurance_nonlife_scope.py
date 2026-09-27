#!/usr/bin/env python3
"""Pins the status-layer rules that survived BA's §2 rewrite.

The report-scope resolver this file also used to test was REPLACED — BA's
PHAN_HOI_CHOT_CUOI §2 withdrew the "does a consolidated report exist" question
entirely, and `tests/test_nonlife_scope.py` covers the flow that replaced it.
What remains here is still live and still load-bearing: the three-state scope
comparison P2 and P3 use, the eligibility conjunction, and the separation of the
P3 volatility flag from the calculation status.

Originally written against CHOT_HOAN_THANH_TAB_PHI_NHAN_THO_GUI_IT_V1.

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
    CALC_ACCEPTED, CALC_REJECTED, SCOPE_EXEMPT_METRICS, SCOPE_SOURCE_OFFSETS,
    finalise_statuses, metric_result, scope_status_for, shift,
)


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
