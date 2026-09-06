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

3. THE A/B/C GATE (V10). Coverage is necessary but not sufficient, and where a
   partial symbol lands changed deliberately: a symbol at 80% coverage with no
   usable valuation is B, not C. Its earnings half WAS measured, and filing that
   beside "we could not measure this at all" loses the difference. C means
   under 50% coverage or no usable core. Neither B nor C ever carries a
   `final_fa_score` — that column is what the Pro composite reads, so absence,
   not a low number, is what keeps a partial score out of a ranking.

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

    # --- V10: A/B/C, and the split that keeps a partial score out of the composite
    a = sec.assemble(na(full_criteria(), ["c4", "c5", "c9", "c18", "c20"]))
    check(a["data_group"] == "A" and a["final_fa_score"] == a["provisional_score"],
          f"70% coverage with usable core and valuation is group A, and its final "
          f"score exists (got {a['data_group']}, final {a['final_fa_score']})")

    b = sec.assemble(na(full_criteria(), ["c19", "c20"]))
    check(b["data_group"] == "B" and b["final_fa_score"] is None
          and b["provisional_score"] is not None,
          f"good coverage with NO usable valuation is B — not C — and carries a "
          f"provisional score but no final one (got {b['data_group']}, "
          f"final {b['final_fa_score']}, provisional {b['provisional_score']})")

    c_ = sec.assemble(na(full_criteria(), ["c1", "c2", "c3", "c4", "c5", "c9", "c18", "c20"]))
    check(c_["data_group"] == "C" and c_["final_fa_score"] is None,
          f"no usable core earnings is C, with no final score whatever the "
          f"coverage (got {c_['data_group']}, coverage {c_['coverage']:.0%})")

    # The block denominators the UI must divide by — the reason it printed 8/30.
    blocks = sec.assemble(na(full_criteria(), ["c4", "c5", "c9", "c18", "c20"]))
    check(blocks["cycle_available_max"] == 23 and blocks["valuation_available_max"] == 8,
          f"cycle's available max is 23 (C18 N/A), not the rubric's 30, and "
          f"valuation's is 8 (C20 N/A), not 20 (got {blocks['cycle_available_max']} "
          f"and {blocks['valuation_available_max']})")
    check(blocks["criteria"]["c18"]["available_max"] == 0
          and blocks["criteria"]["c18"]["static_max"] == 7,
          "an N/A criterion contributes 0 to the denominator while still "
          "reporting the rubric weight it would have carried")
    # Taken from the real scorer, not the test helper: the distinction lives in
    # score_valuation, which is the code a reader's tooltip actually reflects.
    real_c20 = sec.score_valuation(_UnblockedCore(), {"pb_ratio": 2.9})["c20"]
    mixed = sec.assemble({**na(full_criteria(), ["c4"],
                                "broker market share not published by the provider"),
                          "c20": real_c20})
    check(mixed["criteria"]["c20"]["status"] == "SHADOW"
          and mixed["criteria"]["c4"]["status"] == "N_A",
          f"a withdrawn formula is SHADOW; a symbol simply missing data is N_A — "
          f"the tooltip must not tell a reader the broker lacked data when the "
          f"criterion was pulled for everyone (got {mixed['criteria']['c20']['status']} "
          f"and {mixed['criteria']['c4']['status']})")
    check(mixed["criteria"]["c20"]["reason_code"] == "C20_WITHDRAWN_V9"
          and mixed["criteria"]["c4"]["reason_code"] == "NO_SOURCE_MARKET_SHARE",
          "and each carries a machine-readable reason code, so a UI can group "
          "them without parsing prose")

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
    check(rb["data_group"] == "C" and rb["final_fa_score"] is None,
          f"and the symbol is group C with no final score (got {rb['data_group']})")
    check(not rb["core_usable"] and not rb["valuation_usable"],
          "because both core earnings and valuation are gone")
    check(rb["normalized_fa_score"] is not None,
          "the score is still COMPUTED for internal use — it is publication that stops")

    # Coverage alone is not enough (TC-V5-09).
    no_val = na(full_criteria(), ["c19", "c20"], "no valuation")
    rv = sec.assemble(no_val)
    # V10 sheet 38 SOFTENED this. Under V5 it was INVALID_CRITICAL, the worst
    # bucket. The earnings half WAS measured, and filing that beside "we could
    # not measure this at all" loses the difference — so it is now B. It still
    # never reaches a final score, which is what the gate is actually for.
    check(rv["coverage"] >= 0.70 and rv["data_group"] == "B"
          and rv["final_fa_score"] is None,
          f"80% coverage with no valuation is group B — scored for reference, "
          f"never final (coverage {rv['coverage']:.0%}, group {rv['data_group']}, "
          f"final {rv['final_fa_score']})")

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
