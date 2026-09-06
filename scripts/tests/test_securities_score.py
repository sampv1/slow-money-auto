#!/usr/bin/env python3
"""The CTCK Cycle rules, and the gate that decides whether a score is shown.

TWO THINGS ARE PINNED HERE.

1. THE 16 ACCEPTANCE CASES from the rubric's own test sheet (V8 sheet 28),
   verbatim. They cover the boundaries that are easy to get subtly wrong: a
   percentile with too little history is N/A and NOT 0, a reversal expires after
   10 sessions, an ADTV bonus needs breadth to confirm, and C17 is first-match
   from 5 downwards so overlapping rules cannot both fire.

2. NORMALIZATION, which is the whole reason this rubric can be scored at all.
   `earned / available_max` — an N/A criterion leaves the DENOMINATOR instead of
   scoring zero. A broker whose filings do not disclose something is not a
   broker that scored badly at it. Get this wrong and the two most interesting
   real cases both break: HCM, whose funding cost is only in the cash-flow
   statement, and FTS, which reports none anywhere and must not be ranked.

Coverage is necessary but NOT sufficient (V5 TC-V5-09): a symbol at 80% with no
valuation at all is INVALID_CRITICAL, because half the rubric's job is telling
you what you are paying for the earnings.

Runnable directly or under pytest. No DB, no network.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fa import securities as sec  # noqa: E402
from fa.securities import Criterion  # noqa: E402

FAILURES: list[str] = []


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


# (id, kind, kwargs, expected) — V9 sheet 34 for C15 speed, V8 sheet 28 for the rest.
CASES = [
    # C15 SPEED V2: percentile sets the base, the SIGN caps it.
    ("TC15-01", "speed", dict(delta5=-0.3, percentile=0.05, history_obs=500), 4),
    ("TC15-02", "speed", dict(delta5=-0.05, percentile=0.40, history_obs=500), 2),
    ("TC15-03", "speed", dict(delta5=0, percentile=0.40, history_obs=500), 1),
    # Worsening with a good percentile is capped at 1 — never 2-4.
    ("TC15-04", "speed", dict(delta5=0.03, percentile=0.30, history_obs=500), 1),
    ("TC15-05", "speed", dict(delta5=0.03, percentile=0.80, history_obs=500), 0),
    ("TC15-06", "speed", dict(delta5=-0.3, percentile=0.05, history_obs=190), None),
    # Gordon justified P/B — shadow only, and it must fail CLOSED.
    ("TC20-02", "gordon", dict(roe=0.12, coe=0.12, g=0.02), 1.0),
    ("TC20-03", "gordon", dict(roe=0.12, coe=0.10, g=0.10), None),
    ("TC20-04", "gordon", dict(roe=0.03, coe=0.12, g=0.05), None),
    ("TC15-R1", "rev", dict(event_valid=True, prior_positive=3, negative_streak=1,
                            delta10=0.01, days_since=0), 1),
    ("TC15-R2", "rev", dict(event_valid=True, prior_positive=4, negative_streak=2,
                            delta10=0.01, days_since=1), 2),
    ("TC15-R3", "rev", dict(event_valid=True, prior_positive=4, negative_streak=3,
                            delta10=-0.05, days_since=2), 3),
    ("TC15-R4", "rev", dict(event_valid=True, prior_positive=4, negative_streak=4,
                            delta10=-0.08, days_since=11), 0),
    ("TC16-01", "c16", dict(momentum=0.05, breadth=0.45, breadth_change_5d=0.03,
                            breadth_valid=True), 4),
    ("TC16-02", "c16", dict(momentum=0.05, breadth=0.45, breadth_change_5d=-0.01,
                            breadth_valid=True), 3),
    ("TC16-03", "c16", dict(momentum=0.35, breadth=0.55, breadth_change_5d=0.01,
                            breadth_valid=True), 8),
    ("TC16-04", "c16", dict(momentum=-0.05, breadth=0.55, breadth_change_5d=0.01,
                            breadth_valid=True), 2),
    ("TC17-01", "c17", dict(breadth=0.65, d5=0.01, d10=0.02), 5),
    ("TC17-02", "c17", dict(breadth=0.25, d5=0.06, d10=0.12), 4),
    ("TC17-03", "c17", dict(breadth=0.52, d5=-0.02, d10=-0.03), 3),
    ("TC17-04", "c17", dict(breadth=0.25, d5=-0.02, d10=-0.04), 0),
]


def run_case(kind, kw):
    if kind == "speed":
        return sec.c15_speed(**kw)[0]
    if kind == "gordon":
        return sec.justified_pb(**kw)
    if kind == "rev":
        return sec.c15_reversal(**kw)
    if kind == "c16":
        return sec.c16_adtv(**kw)[0]
    return sec.c17_breadth(**kw)[0]


def full_criteria(points_fraction=0.6):
    return {k: Criterion(sec.CRITERION_POINTS[k] * points_fraction)
            for k in sec.CRITERION_POINTS}


class _UnblockedCore:
    """A core result that is fine, so C20's N/A is the criterion's own doing."""
    blocked = False


def na(criteria, keys, reason="no data"):
    for k in keys:
        criteria[k] = Criterion(None, None, "N_A", reason)
    return criteria


def main():
    print("=== acceptance cases: V9 sheet 34 (C15/C20) + V8 sheet 28 ===\n")
    for tc, kind, kw, expected in CASES:
        got = run_case(kind, kw)
        check(got == expected, f"{tc}: expected {expected}, got {got}")

    print("\n=== normalization and the publication gate ===\n")

    # What is unavailable today: market share x2 and ATTC (no source), C18
    # (mapping unlocked) and C20 (formula withdrawn in V9). This is the
    # healthy-broker case, and it lands EXACTLY on the gate.
    healthy = na(full_criteria(), ["c4", "c5", "c9", "c18", "c20"])
    r = sec.assemble(healthy)
    check(r["available_max"] == 70,
          f"C4+C5 (7) + C9 (4) + C18 (7) + C20 (12) leave exactly 70 of 100 "
          f"reachable (got {r['available_max']})")
    check(r["fa_status"] == "PUBLISHABLE",
          f"70% coverage clears the 70% gate — but with ZERO margin, so one more "
          f"missing input drops a broker out (got {r['fa_status']})")
    check(abs(r["normalized_fa_score"] - 60.0) < 0.01,
          f"scoring 60% of what was available normalizes to 60, not to 49.2/100 "
          f"(got {r['normalized_fa_score']})")

    # The FTS case: no funding cost anywhere, so the nine dependants go with it.
    blocked = na(dict(healthy), sec.FUNDING_DEPENDENT, "no eligible funding cost")
    rb = sec.assemble(blocked)
    check(rb["available_max"] == 34,
          f"the funding chain removes a further 36 reachable points (got {rb['available_max']})")
    check(rb["fa_status"] == "INVALID_CRITICAL",
          f"and the symbol is not publishable (got {rb['fa_status']})")
    check(not rb["core_usable"] and not rb["valuation_usable"],
          "because both core earnings and valuation are gone")
    check(rb["normalized_fa_score"] is not None,
          "the score is still COMPUTED for internal use — it is publication that stops")

    # Coverage alone is not enough (TC-V5-09).
    no_val = na(full_criteria(), ["c19", "c20"], "no valuation")
    rv = sec.assemble(no_val)
    check(rv["coverage"] >= 0.70 and rv["fa_status"] == "INVALID_CRITICAL",
          f"80% coverage with no valuation is INVALID_CRITICAL, not PUBLISHABLE "
          f"(coverage {rv['coverage']:.0%}, status {rv['fa_status']})")

    # The band between provisional and publishable.
    thin = na(full_criteria(), ["c4", "c5", "c9", "c18", "c20", "c15", "c16"])
    rt = sec.assemble(thin)
    check(rt["fa_status"] == "PROVISIONAL" and 0.50 <= rt["coverage"] < 0.70,
          f"a symbol between 50% and 70% is PROVISIONAL (coverage {rt['coverage']:.0%}, "
          f"status {rt['fa_status']})")

    # An N/A must never be scored as a zero — the distinction the whole rubric rests on.
    zeroed = dict(healthy)
    for k in ("c4", "c5", "c9", "c18", "c20"):
        zeroed[k] = Criterion(0)
    rz = sec.assemble(zeroed)
    check(rz["available_max"] == 100 and rz["normalized_fa_score"] < r["normalized_fa_score"],
          f"scoring those four as 0 instead of N/A drops the score from "
          f"{r['normalized_fa_score']} to {rz['normalized_fa_score']} — which is the bug")

    # --- the two V9 fixes, stated as properties rather than single cases
    band1 = [sec.c15_speed(d, p_, 500)[0]
             for d, p_ in ((0.0, 0.40), (0.03, 0.30), (-0.005, 0.60))]
    check(band1 == [1, 1, 1],
          f"C15 speed band 1 is reachable from three different states — it never "
          f"fired once in 190 live sessions under V8 (got {band1})")
    worsening = [sec.c15_speed(0.05, p_, 500)[0] for p_ in (0.01, 0.20, 0.45, 0.90)]
    check(max(worsening) <= 1,
          f"a WORSENING FCI can never score above 1 however good its percentile "
          f"(got {worsening})")

    withdrawn = sec.score_valuation(_UnblockedCore(), {"pb_ratio": 2.9})
    check(withdrawn["c20"].points is None and withdrawn["c20"].status == "PROVISIONAL_INVALID",
          "C20 is N/A, not 0 — it scored 0 for the entire universe, which is a "
          "criterion that cannot discriminate rather than one finding everyone expensive")
    r20 = sec.assemble({**full_criteria(), "c20": withdrawn["c20"]})
    check(r20["available_max"] == 88,
          f"and its 12 points leave the denominator rather than dragging the score "
          f"down (got {r20['available_max']})")

    # Every N/A is explained, so a thin score can be audited rather than guessed at.
    check(set(rb["dependency_flags"]) >= set(sec.FUNDING_DEPENDENT),
          "each N/A criterion records its own reason in dependency_flags")

    print(f"\n{'FAILED' if FAILURES else 'PASSED'}: {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


def test_securities_score():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
