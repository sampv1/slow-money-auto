"""ΔFA is the change in Total /100, not in the FA /88 subtotal.

BA `YEU_CAU_IT_CHOT_R4_V2_VA_CHUAN_HOA_GIAO_DIEN_BAO_HIEM_2026-10-04.md` §2.2,
§2.10 and §2.20.1.

WHY THIS NEEDS ITS OWN FILE. The two bases are not a cosmetic choice: FA/88 is
formed from Common + Internal, while Total/100 additionally needs Valuation. So
a symbol with no valuation block HAS an /88 delta and has NO /100 delta, and the
rule change can only be verified by asserting both answers on the same input.
Holding is exactly that case in production today.

Runs standalone or under pytest, with NO database.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fa import insurance_tab as T          # noqa: E402

PASS, FAIL = [], []


def check(name, got, want):
    ok = got == want
    (PASS if ok else FAIL).append(f"{name}: got {got!r} want {want!r}")
    assert ok, f"{name}: got {got!r}, want {want!r}"


def score(common, internal, valuation):
    """One TabScore built through the real assembler, so the arithmetic under
    test is the arithmetic production runs."""
    criteria = {}
    codes = T.INTERNAL_CRITERIA["REINSURANCE"]
    for i, c in enumerate(codes):
        criteria[c] = {"value": 0.0, "band": None,
                       "score": None if internal is None
                       else (internal if i == 0 else 0)}
    for c in T.VALUATION_CRITERIA["REINSURANCE"]:
        criteria[c] = {"value": 0.0, "band": None, "score": valuation}
    return T.assemble("X", "2026-Q2", "REINSURANCE", common, criteria)


# --- the basis ------------------------------------------------------------

def test_default_basis_is_total_100():
    check("default", T.fa_change(score(40, 28, 12), score(40, 20, 10))[1],
          T.CHANGE_CALCULATED)
    # 80 against 70 -> +14.2857%
    pct, _ = T.fa_change(score(40, 28, 12), score(40, 20, 10))
    check("pct on /100", round(pct, 4), round((80 - 70) / 70 * 100, 4))


def test_the_two_bases_give_different_answers():
    """The whole reason §2.10 had to be stated. Valuation moved and the /88
    subtotal did not, so an /88 delta reports 0% for a company whose displayed
    score fell."""
    now, before = score(40, 28, 0), score(40, 28, 12)
    total_pct, _ = T.fa_change(now, before, T.TOTAL_BASIS)
    fa_pct, _ = T.fa_change(now, before, T.FA_BASIS)
    check("total basis moved", round(total_pct, 4),
          round((68 - 80) / 80 * 100, 4))
    check("fa basis flat", fa_pct, 0.0)
    check("they disagree", total_pct == fa_pct, False)


def test_no_valuation_means_no_displayed_delta():
    """A Holding row: Common and Internal both scored, Valuation absent. The
    /88 delta exists; the one the interface shows must not."""
    now = score(40, 28, None)
    before = score(40, 26, None)
    check("total status", T.fa_change(now, before, T.TOTAL_BASIS)[1],
          T.CHANGE_CURRENT_INCOMPLETE)
    check("total pct", T.fa_change(now, before, T.TOTAL_BASIS)[0], None)
    check("fa status", T.fa_change(now, before, T.FA_BASIS)[1],
          T.CHANGE_CALCULATED)


# --- the four outcomes stay four (§2.10) ----------------------------------

def test_no_previous_quarter():
    check("no prev", T.fa_change(score(40, 28, 12), None)[1], T.CHANGE_NO_PREV)
    check("no prev pct", T.fa_change(score(40, 28, 12), None)[0], None)


def test_previous_quarter_has_no_total():
    """Not the same as having no previous quarter at all, but it is the same
    answer: there is nothing comparable to difference against."""
    check("prev incomplete",
          T.fa_change(score(40, 28, 12), score(40, 28, None))[1],
          T.CHANGE_NO_PREV)


def test_current_quarter_incomplete():
    check("current incomplete",
          T.fa_change(score(None, 28, 12), score(40, 28, 12))[1],
          T.CHANGE_CURRENT_INCOMPLETE)


def test_zero_base_is_never_an_infinity():
    """A previous Total of exactly 0 is reachable — every block measured at its
    worst. Dividing by it would print an infinity, and reporting it as "no
    comparable quarter" would hide a real improvement."""
    now, before = score(40, 28, 12), score(0, 0, 0)
    pct, status = T.fa_change(now, before)
    check("zero base status", status, T.CHANGE_ZERO_BASE)
    check("zero base pct", pct, None)


def test_zero_total_is_a_legal_current_score():
    """0 is a score, not an absence (§0). A row at 0/100 must still produce a
    delta rather than falling into CURRENT_FA_INCOMPLETE."""
    now, before = score(0, 0, 0), score(40, 28, 12)
    check("current zero scores", now.total_score, 0.0)
    pct, status = T.fa_change(now, before)
    check("status", status, T.CHANGE_CALCULATED)
    check("pct", pct, -100.0)


def test_a_flat_quarter_is_calculated_not_absent():
    """0% change and "could not compare" are different facts and must not share
    a rendering."""
    pct, status = T.fa_change(score(40, 28, 12), score(40, 28, 12))
    check("flat status", status, T.CHANGE_CALCULATED)
    check("flat pct", pct, 0.0)


def test_total_is_the_sum_of_all_three_blocks():
    s = score(40, 28, 12)
    check("total", s.total_score, 80.0)
    check("fa subtotal", s.fa_score, 68.0)
    check("status", s.score_status, T.STATUS_COMPLETE)


def main():
    fns = [v for k, v in sorted(globals().items())
           if k.startswith("test_") and callable(v)]
    failed = 0
    for fn in fns:
        try:
            fn()
        except AssertionError as e:
            failed += 1
            print(f"FAIL {fn.__name__}: {e}")
    print(f"\n{len(PASS)} checks passed, {len(FAIL)} failed, "
          f"{len(fns) - failed}/{len(fns)} test functions OK")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
