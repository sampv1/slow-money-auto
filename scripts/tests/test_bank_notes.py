#!/usr/bin/env python3
"""Bank note ingest: mapping, period labels and the validation gates.

The gates are the point of this suite. The `nob` ids are POSITIONAL handles into
a provider payload, so the failure that matters is not "the fetch broke" -- it
is the provider renumbering while every value still parses and every chart still
draws. Two real near-misses are pinned here as cases:

  * `nob4` matched a labelled CAR series on 34/34 periods and is a money amount.
    It agreed only where both sides were zero -- so `test_zero_agreement_is_not_evidence`
    asserts the shape of that trap directly.
  * `nob66`/`nob67` disagree with RT_BANK_CASA on 7 of 27 banks, which is why
    CASA is read from the ratio block and these ids are refused by name.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fa import bank_notes as bn

FAILS = 0


def check(name, cond, detail=""):
    global FAILS
    if cond:
        print(f"  ok   {name}")
    else:
        FAILS += 1
        print(f"  FAIL {name} {detail}")


# --- a realistic TCB 2026-Q2 record (figures as filed, in đồng) --------------
TCB = {
    "yearReport": 2026, "lengthReport": 2,
    "nob1": 847_336e9,
    "nob41": 5_641e9, "nob42": 1_397e9, "nob43": 1_887e9, "nob44": 5_886e9,
    "nob46": 343_778e9, "nob47": 119_025e9, "nob48": 384_533e9,
    "nob184": 51_618e9,
    "nob4": 268_521_900_000_000.0,   # the field that is NOT CAR
    "nob66": 1.0, "nob67": 2.0,      # the deposit candidates
}
TCB_CTX = {
    "gross_loans": 847_336e9,
    "investment_securities": 120_000e9,
    "npl_ratio": (1_397 + 1_887 + 5_886) / 847_336,
}


def period_labels():
    print("period labels")
    check("quarter", bn.period_label({"yearReport": 2026, "lengthReport": 2}) == "2026-Q2")
    check("annual (lengthReport=5)", bn.period_label({"yearReport": 2025, "lengthReport": 5}) == "2025")
    check("unknown length is skipped, not guessed",
          bn.period_label({"yearReport": 2026, "lengthReport": 9}) is None)
    check("no year is skipped", bn.period_label({"lengthReport": 2}) is None)


def mapping():
    print("mapping")
    items = bn.map_record(TCB)
    check("validated fields are mapped", len(items) == len(bn.FIELDS), f"got {len(items)}")
    check("nhóm 2 by name", items["NT_BS_SPECIAL_MENTIONED"] == 5_641e9)
    check("maturity by name", items["NT_BS_LONG_TERM_LOANS"] == 384_533e9)
    for nob in bn.UNVALIDATED:
        check(f"{nob} is refused by name", nob not in bn.FIELDS)
        check(f"{nob} never reaches items",
              not any(v == TCB[nob] for k, v in items.items() if k != "NT_BS_LOANS_AND_ADVANCES_BY_GRADING"))
    check("absent stays absent, not zero",
          "NT_BS_BAD" not in bn.map_record({"nob1": 1.0}))
    check("zero is kept as a real value",
          bn.map_record({"nob44": 0})["NT_BS_BAD"] == 0.0)


def gates_pass_on_good_data():
    print("gates on a correct record")
    items = bn.map_record(TCB)
    checks = bn.validate("TCB", "2026-Q2", items, **TCB_CTX)
    bad = [c for c in checks if not c.ok]
    check("no failures", not bad, str([(c.rule, c.detail) for c in bad]))
    rules = {c.rule for c in checks}
    for r in ("maturity_sums_to_graded", "graded_equals_bs_gross", "npl_matches_provider",
              "tpdn_within_investment_securities"):
        check(f"{r} actually ran", r in rules)


def gates_catch_renumbering():
    print("gates catch a renumbered payload")
    # The whole hazard: the provider shifts nob46..48 onto a neighbouring block.
    shifted = dict(TCB, nob46=343_778e9, nob47=119_025e9, nob48=1_000e9)
    checks = bn.validate("TCB", "2026-Q2", bn.map_record(shifted), **TCB_CTX)
    check("maturity identity fails",
          any(c.rule == "maturity_sums_to_graded" and not c.ok for c in checks))

    moved = dict(TCB, nob42=900_000e9)
    checks = bn.validate("TCB", "2026-Q2", bn.map_record(moved), **TCB_CTX)
    check("a group bigger than the book fails",
          any(c.rule == "group_within_graded" and not c.ok for c in checks))
    check("NPL cross-check fails too",
          any(c.rule == "npl_matches_provider" and not c.ok for c in checks))

    neg = dict(TCB, nob44=-5e9)
    check("negative is refused",
          any(c.rule == "non_negative" and not c.ok
              for c in bn.validate("TCB", "2026-Q2", bn.map_record(neg), **TCB_CTX)))

    big = dict(TCB, nob184=900_000e9)
    check("TPDN above investment securities fails",
          any(c.rule == "tpdn_within_investment_securities" and not c.ok
              for c in bn.validate("TCB", "2026-Q2", bn.map_record(big), **TCB_CTX)))


def zero_agreement_is_not_evidence():
    """The `nob4` trap, as a test.

    A candidate that is zero wherever the labelled series is zero will "match"
    on every period and still be the wrong field. Any future mapping work must
    reconcile on NON-ZERO periods; this asserts the two are distinguishable.
    """
    print("zero agreement is not evidence")
    labelled = [0.0, 0.0, 0.0, 0.1461]       # a CAR series: mostly unreported
    candidate = [0.0, 0.0, 0.0, 2.685e14]    # nob4: a money amount
    naive = sum(1 for a, b in zip(labelled, candidate) if abs(a - b) <= 1)
    check("naive match looks convincing", naive == 3, f"{naive}/4")
    nonzero = [(a, b) for a, b in zip(labelled, candidate) if a or b]
    check("restricted to non-zero periods it fails",
          all(abs(a - b) > 1 for a, b in nonzero))


def partial_block_is_a_failure():
    print("a partial maturity block is a failure, not a pass")
    items = bn.map_record({k: v for k, v in TCB.items() if k != "nob48"})
    checks = bn.validate("TCB", "2026-Q2", items, gross_loans=847_336e9)
    check("missing a maturity leg fails the identity",
          any(c.rule == "maturity_sums_to_graded" and not c.ok for c in checks))


def collect_drops_failing_periods():
    print("collect_symbol drops what fails")
    good = dict(TCB)
    bad = dict(TCB, yearReport=2026, lengthReport=1, nob48=1.0)
    payload = {"quarters": [good, bad], "years": []}
    ctx = {"2026-Q2": TCB_CTX, "2026-Q1": {"gross_loans": 847_336e9}}
    ing = bn.collect_symbol("TCB", payload, ctx)
    check("only the valid period is written", len(ing.rows) == 1, f"{len(ing.rows)}")
    check("the bad one is counted as dropped", ing.dropped == 1)
    check("row is shaped for the statements table",
          ing.rows[0]["statement"] == "note" and ing.rows[0]["period_type"] == "quarter")
    check("failures are reported", bool(ing.failures))

    annual = bn.collect_symbol("TCB", {"quarters": [], "years": [dict(TCB, lengthReport=5)]}, {})
    check("annual records land as period_type=year",
          annual.rows and annual.rows[0]["period_type"] == "year"
          and annual.rows[0]["period"] == "2026")


def zero_graded_is_absent_not_zero():
    """SHB's case: `nob1 = 0` in 22 of 42 periods while the maturity legs are real.

    Reading that 0 as a measured zero made both loan identities fail and refused
    half of SHB's history. The balance sheet stands in as the denominator.
    """
    print("zero graded total is absent, not zero")
    rec = dict(TCB, nob1=0)
    items = bn.map_record(rec)
    checks = bn.validate("SHB", "2023-Q1", items, gross_loans=847_336e9)
    fatal = [c for c in checks if not c.ok and c.fatal]
    check("no fatal failure", not fatal, str([(c.rule, c.detail) for c in fatal]))
    check("maturity still checked against the balance sheet",
          any(c.rule == "maturity_sums_to_graded" and c.ok for c in checks))
    check("graded-vs-BS is skipped rather than failed",
          not any(c.rule == "graded_equals_bs_gross" for c in checks))
    ing = bn.collect_symbol("SHB", {"quarters": [rec], "years": []},
                            {"2026-Q2": {"gross_loans": 847_336e9}})
    check("the period is kept", len(ing.rows) == 1 and ing.dropped == 0)


def provider_disagreement_is_advisory():
    """A cross-check against a figure the provider computes separately must not
    cost us data: on the first full run it fired on 2021-Q4/2022-Q1 for half the
    sector, and the note-derived figure was the correct one."""
    print("provider disagreement is advisory, not fatal")
    ctx = dict(TCB_CTX, npl_ratio=0.0500)   # provider disagrees wildly
    checks = bn.validate("VCB", "2021-Q4", bn.map_record(TCB), **ctx)
    npl = [c for c in checks if c.rule == "npl_matches_provider"]
    check("the check ran and failed", npl and not npl[0].ok)
    check("but it is NOT fatal", npl and not npl[0].fatal)
    check("no fatal failures at all", not [c for c in checks if not c.ok and c.fatal])
    ing = bn.collect_symbol("VCB", {"quarters": [TCB], "years": []}, {"2026-Q2": ctx})
    check("the period is still stored", len(ing.rows) == 1 and ing.dropped == 0)
    check("and it is reported as an advisory", len(ing.advisories) == 1)
    check("internal identity breaks stay fatal",
          all(c.fatal for c in bn.validate(
              "X", "p", bn.map_record(dict(TCB, nob48=1.0)), **TCB_CTX)
              if not c.ok and c.rule != "npl_matches_provider"))


def no_context_still_stores():
    print("a period with no yardstick is still stored")
    ing = bn.collect_symbol("TCB", {"quarters": [TCB], "years": []}, {})
    check("internal identities suffice", len(ing.rows) == 1 and ing.dropped == 0)


if __name__ == "__main__":
    period_labels()
    mapping()
    gates_pass_on_good_data()
    gates_catch_renumbering()
    zero_agreement_is_not_evidence()
    partial_block_is_a_failure()
    collect_drops_failing_periods()
    zero_graded_is_absent_not_zero()
    provider_disagreement_is_advisory()
    no_context_still_stores()
    print(f"\n{'FAILED' if FAILS else 'PASSED'}: {FAILS} failure(s)")
    raise SystemExit(1 if FAILS else 0)
