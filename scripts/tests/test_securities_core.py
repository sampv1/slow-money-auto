#!/usr/bin/env python3
"""Core_NPAT for a broker, and the funding cost the whole rubric hangs on.

WHAT WENT WRONG BEFORE. An earlier cut of this rubric defined margin profit as
`margin interest income - TOTAL financial expenses`: the entire balance sheet's
funding charged to the margin book, while every prop income it also supports was
excluded from Core. VND's core-earnings ratio came out at 0.8%, scoring 0 on
earnings quality for a broker that is not distressed. Funding is now allocated
by share of AVERAGE EARNING ASSETS, and VND reads 45.7%.

Allocating by share of DEBT was measured and rejected rather than argued about:
VIX funds its margin book largely from equity (margin/debt = 306%), so a
debt-share split hands it a NEGATIVE margin profit. The test below pins that the
allocation ratio can never exceed 100%, which is what makes that impossible.

THE FOUR-WAY FUNDING STATUS is the other half, and two of its outcomes look
identical in the data while meaning opposite things:

    debt > 0, field absent   -> MISSING   (nothing was reported)
    debt > 0, field == 0     -> FAIL      (a zero that cannot be true)
    debt == 0, no cost       -> OK        (funded from equity)
    income statement silent  -> CASHFLOW_DERIVED, when the cash-flow statement
                                carries it

That last one is not a workaround. HCM and FTS report no interest expense on the
income statement despite 26,093 and 9,918 tỷ of debt — their funding sits inside
operating expenses. Deriving it from OPEX or a peer median is forbidden, so HCM
would lose 48 of 100 points. But `CF_INTEREST_EXPENSE` carries its 1,893.6 tỷ,
and across the 32 brokers reporting BOTH fields it matches the income statement
within 1% on 28 — a fallback with evidence, never an override. HCM's core ratio
goes from a nonsensical 169.1% (perfect score on a data hole) to 90.3%.

Runnable directly or under pytest. No DB, no network.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fa import securities as sec  # noqa: E402

FAILURES: list[str] = []


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


QS, OPEN_Q, CLOSE_Q = sec.ttm_window("2026-Q2")
B = 1_000_000_000


def statements(*, interest=None, cf_interest=None, debt=B * 100, margin=B * 50,
               htm=B * 20, fvtpl=B * 30, margin_income=B * 12, pbt=B * 10,
               tax=B * 2, reported=B * 8, opex=-B * 2):
    """A broker with round numbers, so every assertion is arithmetic not fitting."""
    inc = {}
    for q in QS:
        row = {sec.MARGIN_INCOME: margin_income / 4,
               sec.MANAGEMENT_OPEX: opex / 4,
               sec.PROFIT_BEFORE_TAX: pbt / 4,
               sec.TAX_LINES[0]: -tax / 4,
               sec.NPAT_PARENT: reported / 4,
               sec.BROKERAGE_REVENUE[0]: B / 4,
               sec.BROKERAGE_EXPENSE[0]: -B / 8}
        if interest is not None:
            row[sec.INTEREST_EXPENSE] = -interest / 4
        inc[q] = row
    cf = {}
    for q in QS:
        cf[q] = {sec.CF_INTEREST_EXPENSE: cf_interest / 4} if cf_interest is not None else {}
    bal = {}
    for q in (OPEN_Q, CLOSE_Q):
        bal[q] = {sec.BS_MARGIN: margin, "BS_HELD_TO_MATURITY_SECURITIES": htm,
                  "BS_FVTPL_FINANCIAL_ASSETS": fvtpl,
                  "BS_AVAILABLE_FOR_SALE_FINANCIAL_ASSETS_AFS": 0,
                  sec.BS_EQUITY: B * 40, sec.BS_DEBT[0]: debt}
    return {"income": inc, "cashflow": cf, "balance": bal}


def main():
    print("=== funding-cost hierarchy and Core_NPAT ===\n")

    # --- 1. DIRECT wins when the income statement reports it
    r = sec.compute_core(statements(interest=B * 4, cf_interest=B * 9), QS, OPEN_Q, CLOSE_Q)
    efc = r.fields["eligible_funding_cost"]
    check(efc.source_type == "DIRECT" and efc.value == B * 4,
          f"a reported interest expense is used DIRECT (got {efc.source_type}, {efc.value/B:.0f}B)")
    check(not r.blocked, "and Core is computed")

    # --- 2. cash flow is a FALLBACK, never added to the direct figure
    check(efc.value != B * 4 + B * 9,
          "the cash-flow figure is NOT summed with the direct one — one source only")

    # --- 3. the rescue: income statement silent, cash flow carries it
    r = sec.compute_core(statements(interest=None, cf_interest=B * 9), QS, OPEN_Q, CLOSE_Q)
    efc = r.fields["eligible_funding_cost"]
    check(efc.source_type == "CASHFLOW_DERIVED" and efc.value == B * 9,
          f"an absent income-statement line falls back to cash flow (got {efc.source_type})")
    check(efc.confidence == "MEDIUM",
          "and is marked MEDIUM confidence, so the fallback is visible in the audit")
    check(not r.blocked and r.val("core_npat_ttm") is not None,
          "so the broker is scored rather than losing 48 points to a filing convention")

    # --- 4. a zero that cannot be true
    r = sec.compute_core(statements(interest=0, cf_interest=None), QS, OPEN_Q, CLOSE_Q)
    check(r.fields["eligible_funding_cost"].status == "FAIL",
          "debt with a ZERO funding cost and no other source is FAIL, not a free lunch")
    check(r.blocked and r.val("core_npat_ttm") is None,
          "and Core is N/A — never computed from a funding cost of zero")

    # --- 5. no debt is not missing data
    r = sec.compute_core(statements(interest=None, cf_interest=None, debt=0), QS, OPEN_Q, CLOSE_Q)
    check(r.fields["eligible_funding_cost"].status == "OK" and not r.blocked,
          "a broker with no interest-bearing debt legitimately has no funding cost")

    # --- 6. allocation is by earning assets, and is bounded
    #        margin 50 of (50 + 20 + 30) = 50%, so half the funding.
    r = sec.compute_core(statements(interest=B * 4), QS, OPEN_Q, CLOSE_Q)
    check(abs(r.val("margin_net") - (B * 12 - B * 4 * 0.5)) < 1,
          f"margin_net charges 50% of funding, matching its 50% share of earning "
          f"assets (got {r.val('margin_net')/B:.2f}B, expected {(B*12 - B*2)/B:.2f}B)")
    check(r.checks["margin_allocation_ratio"] == "OK"
          and r.checks["core_allocation_total"] == "OK",
          "and both allocation ratios pass the 0-100% check")

    # --- 7. the check that makes a debt-share split impossible
    r = sec.compute_core(statements(interest=B * 4, margin=B * 200), QS, OPEN_Q, CLOSE_Q)
    check(r.checks["margin_allocation_ratio"] == "OK",
          "a margin book larger than the debt still allocates within 0-100% "
          "(the VIX case that a debt-share split turns negative)")

    # --- 8. missing propagates as N/A, and NEVER as zero
    r = sec.compute_core(statements(interest=0), QS, OPEN_Q, CLOSE_Q)
    downstream = ("margin_net", "core_treasury_net", "core_pbt", "core_npat_ttm")
    check(all(r.fields[k].value is None and r.fields[k].status == "MISSING" for k in downstream),
          "every metric downstream of funding cost inherits N/A, none becomes 0")

    # --- 9. a negative denominator is SPECIAL_CASE, but >100% is ordinary
    r = sec.compute_core(statements(interest=B * 4, reported=-B * 5, pbt=-B * 5),
                         QS, OPEN_Q, CLOSE_Q)
    check(r.fields["core_ratio_ttm"].status == "SPECIAL_CASE",
          "a zero or negative reported NPAT is SPECIAL_CASE, not a small ratio")
    r = sec.compute_core(statements(interest=B * 4, reported=B), QS, OPEN_Q, CLOSE_Q)
    check(r.fields["core_ratio_ttm"].status == "OK" and r.val("core_ratio_ttm") > 1,
          f"a ratio above 100% is kept raw — it means the non-core segments lost "
          f"money (got {r.val('core_ratio_ttm'):.0%})")

    # --- 10. expenses are stored NEGATIVE, so segment profit must ADD them
    r = sec.compute_core(statements(interest=B * 4), QS, OPEN_Q, CLOSE_Q)
    check(abs(r.val("brokerage_ib_gross_profit") - B * 0.5) < 1,
          f"brokerage revenue 1B less a 0.5B cost gives 0.5B, not 1.5B "
          f"(got {r.val('brokerage_ib_gross_profit')/B:.2f}B) — the sign trap")

    # --- 11. per-field provenance, required by acceptance criterion A1
    meta = r.fields["eligible_funding_cost"].as_meta()
    check(all(k in meta for k in ("value", "source_field", "source_type", "status", "confidence")),
          "every canonical value carries value/source/type/status/confidence")

    print(f"\n{'FAILED' if FAILURES else 'PASSED'}: {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


def test_securities_core():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
