"""Data-mapping guard QA — BA FINAL SPEC 2026-10-01 §18 and §31 cases A-F.

Runs standalone or under pytest, with NO database: every case is a hand-built
reserve series, so a failure means the guard changed, not that a provider did.

THE POINT OF THE GUARD IS WHAT IT REFUSES TO DO. A broken mapping must produce
ABSENCE, never a zero and never a proxy — `score = 0` asserts "measured, worst
case" while a mapping break is "not measurable". Every case below therefore
asserts the status AND that no score survived.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fa import holding as H            # noqa: E402
from fa import holding_guard as G      # noqa: E402
from fa import insurance_deep as D     # noqa: E402
from export_insurance_deep import score_symbol_period  # noqa: E402

PASS, FAIL = [], []


def check_eq(name, got, want):
    ok = got == want
    (PASS if ok else FAIL).append(f"{name}: got {got!r} want {want!r}")
    assert ok, f"{name}: got {got!r}, want {want!r}"


def series_for(symbol):
    """Twelve-plus observations per metric so nothing is blocked merely for
    being short — the guard, not the history gate, must be what fires."""
    periods = [f"{y}-Q{q}" for y in range(2022, 2026) for q in (1, 2, 3, 4)]
    return {c: {p: 10.0 + i for i, p in enumerate(periods)}
            for c in H.METRICS_BY_TICKER[symbol]}, periods


def guard_of(reserves, period, symbol="PVI", valid_from=None, stored_fp=None):
    return G.reserve_guard(reserves, period, symbol, valid_from, stored_fp)


# --- Case A -- reserve null ------------------------------------------------

def test_caseA_null_reserve_is_pending_review():
    g = guard_of({"2025-Q3": 100.0, "2025-Q4": None}, "2025-Q4")
    check_eq("A status", g.status, G.STATUS_PENDING)
    check_eq("A alert", g.alert, True)
    check_eq("A reason", g.reason, G.REASON_MISSING)


def test_caseA_missing_period_entirely_is_pending_review():
    g = guard_of({"2025-Q3": 100.0}, "2025-Q4")
    check_eq("A' reason", g.reason, G.REASON_MISSING)
    check_eq("A' alert", g.alert, True)


# --- Case B -- reserve <= 0 ------------------------------------------------

def test_caseB_zero_reserve_is_pending_review():
    g = guard_of({"2025-Q3": 100.0, "2025-Q4": 0.0}, "2025-Q4")
    check_eq("B0 reason", g.reason, G.REASON_NON_POSITIVE)
    check_eq("B0 status", g.status, G.STATUS_PENDING)


def test_caseB_negative_reserve_is_pending_review():
    g = guard_of({"2025-Q3": 100.0, "2025-Q4": -5.0}, "2025-Q4")
    check_eq("B- reason", g.reason, G.REASON_NON_POSITIVE)


# --- Cases C/D/E -- the +-50% structural jump ------------------------------

def test_caseC_qoq_plus_51_raises_the_alert():
    g = guard_of({"2025-Q3": 100.0, "2025-Q4": 151.0}, "2025-Q4")
    check_eq("C reason", g.reason, G.REASON_QOQ_JUMP)
    check_eq("C alert", g.alert, True)
    check_eq("C qoq", round(g.qoq_pct, 6), 51.0)


def test_caseD_qoq_minus_51_raises_the_alert():
    g = guard_of({"2025-Q3": 100.0, "2025-Q4": 49.0}, "2025-Q4")
    check_eq("D reason", g.reason, G.REASON_QOQ_JUMP)
    check_eq("D qoq", round(g.qoq_pct, 6), -51.0)


def test_caseE_qoq_plus_49_raises_no_alert():
    g = guard_of({"2025-Q3": 100.0, "2025-Q4": 149.0}, "2025-Q4")
    check_eq("E alert", g.alert, False)
    check_eq("E status", g.status, G.STATUS_OK)
    check_eq("E reason", g.reason, None)


def test_caseE_qoq_minus_49_raises_no_alert():
    g = guard_of({"2025-Q3": 100.0, "2025-Q4": 51.0}, "2025-Q4")
    check_eq("E' alert", g.alert, False)


def test_the_boundary_is_strictly_greater_than_50():
    """BA writes `> +50%` and `< -50%`. Exactly 50 is NOT an alert, and a
    boundary written with the wrong operator is the defect the insurance band
    tables already produced once."""
    check_eq("50 exactly", guard_of(
        {"2025-Q3": 100.0, "2025-Q4": 150.0}, "2025-Q4").alert, False)
    check_eq("-50 exactly", guard_of(
        {"2025-Q3": 100.0, "2025-Q4": 50.0}, "2025-Q4").alert, False)


def test_qoq_uses_the_immediately_preceding_quarter_by_label():
    g = guard_of({"2024-Q4": 100.0, "2025-Q1": 120.0}, "2025-Q1")
    check_eq("prev label", g.prev_period, "2024-Q4")
    check_eq("prev crosses the year boundary", round(g.qoq_pct, 6), 20.0)


# --- Case F -- lineage ------------------------------------------------------

def test_caseF_mapping_lineage_change_raises_the_alert():
    g = guard_of({"2025-Q3": 100.0, "2025-Q4": 110.0}, "2025-Q4",
                 stored_fp="deadbeefdeadbeef")
    check_eq("F reason", g.reason, G.REASON_LINEAGE)
    check_eq("F status", g.status, G.STATUS_PENDING)


def test_caseF_same_fingerprint_is_not_a_change():
    g = guard_of({"2025-Q3": 100.0, "2025-Q4": 110.0}, "2025-Q4",
                 stored_fp=G.mapping_fingerprint())
    check_eq("F= alert", g.alert, False)


def test_first_run_has_no_stored_fingerprint_and_is_not_a_change():
    g = guard_of({"2025-Q3": 100.0, "2025-Q4": 110.0}, "2025-Q4", stored_fp=None)
    check_eq("F-none alert", g.alert, False)


def test_fingerprint_is_stable_across_calls():
    check_eq("fp stable", G.mapping_fingerprint(), G.mapping_fingerprint())


# --- The cutoff is not a silent skip ---------------------------------------

def test_qoq_across_the_valid_from_cutoff_is_declared_not_silently_ignored():
    """BVH's 2021-Q4 -> 2022-Q1 step is the very break `valid_from` excludes.
    Comparing across it would fire on data the cutoff already removed, so the
    guard records WHY it did not compare instead of just not comparing."""
    g = guard_of({"2021-Q4": 285.0, "2022-Q1": 130_804.0}, "2022-Q1",
                 symbol="BVH", valid_from="2022-Q1")
    check_eq("cutoff alert", g.alert, False)
    check_eq("cutoff qoq not computed", g.qoq_pct, None)
    assert any(G.REASON_QOQ_NOT_COMPARABLE in n for n in g.notes), g.notes


# --- No silent fallback anywhere (§18.4) -----------------------------------

def test_blocked_metrics_carry_no_score_and_no_value():
    """NO_ZERO_FILL. A blocked reserve metric must publish absence."""
    series, periods = series_for("PVI")
    period = periods[-1]
    reserves = {p: 100.0 for p in periods}
    reserves[period] = None
    rows, g = score_symbol_period("PVI", series, reserves, period)
    check_eq("blocked guard alert", g.alert, True)
    by = {r["metric_code"]: r for r in rows}
    check_eq("P4 status", by["P4"]["data_status"], G.STATUS_PENDING)
    check_eq("P4 score is absent, not 0", by["P4"]["score"], None)
    check_eq("P4 value is absent", by["P4"]["current_value"], None)
    check_eq("P4 alert flagged", by["P4"]["data_mapping_alert"], True)
    check_eq("P4 reason recorded", by["P4"]["guard_reason"], G.REASON_MISSING)


def test_a_reserve_break_does_not_block_metrics_that_never_read_reserves():
    """Scope is by DEPENDENCY. P1/P2/P3 are income-statement metrics; blocking
    them because a balance-sheet field broke would withhold a good measurement.
    Same rule as the CTCK funding-cost cascade."""
    series, periods = series_for("PVI")
    period = periods[-1]
    reserves = {p: 100.0 for p in periods}
    reserves[period] = None
    rows, _ = score_symbol_period("PVI", series, reserves, period)
    by = {r["metric_code"]: r for r in rows}
    for code in ("P1", "P2", "P3"):
        check_eq(f"{code} still scored", by[code]["data_status"], "OK")
        assert by[code]["score"] is not None, code
        check_eq(f"{code} not flagged", by[code]["data_mapping_alert"], False)
    check_eq("reserve-dependent set", G.RESERVE_DEPENDENT, ("B3", "B4", "P4"))


def test_deep_total_is_absent_when_any_component_is_blocked():
    """A partial total would read as a low score. Absence says what happened."""
    series, periods = series_for("PVI")
    period = periods[-1]
    reserves = {p: 100.0 for p in periods}
    reserves[period] = -1.0
    rows, _ = score_symbol_period("PVI", series, reserves, period)
    check_eq("deep_total absent", rows[0]["deep_total"], None)


def test_a_clean_quarter_scores_all_four_and_totals_unrounded():
    series, periods = series_for("BVH")
    period = periods[-1]
    reserves = {p: 100.0 + i for i, p in enumerate(periods)}
    rows, g = score_symbol_period("BVH", series, reserves, period)
    check_eq("clean: no alert", g.alert, False)
    check_eq("clean: four rows", len(rows), 4)
    check_eq("clean: all OK", {r["data_status"] for r in rows}, {"OK"})
    check_eq("clean: weights", sum(r["weight"] for r in rows), 38)
    total = sum(r["score"] for r in rows)
    check_eq("clean: total matches parts", round(rows[0]["deep_total"], 12),
             round(total, 12))


# --- A cleared alert resumes scoring, and only through the declared path ----

def test_a_reviewed_alert_can_be_cleared_and_scoring_resumes():
    """BA §18.2: a review that confirms a real economic move sets ALERT_CLEAR
    and scoring resumes. It re-enables the normal computation; it never edits
    a score, so NO_MANUAL_SCORE_OVERRIDE still holds."""
    key = ("PVI", "2025-Q4", G.REASON_QOQ_JUMP)
    reserves = {"2025-Q3": 100.0, "2025-Q4": 200.0}
    check_eq("before clear", guard_of(reserves, "2025-Q4").alert, True)
    G.ALERT_CLEARED.add(key)
    try:
        g = guard_of(reserves, "2025-Q4")
        check_eq("after clear: no alert", g.alert, False)
        check_eq("after clear: scoring resumes", g.status, G.STATUS_OK)
        assert any("ALERT_CLEAR" in n for n in g.notes), g.notes
    finally:
        G.ALERT_CLEARED.discard(key)
    check_eq("clear list is empty by default", len(G.ALERT_CLEARED), 0)


def test_lineage_is_checked_before_the_values():
    """If WHAT we read changed, the values are not comparable with the stored
    history whatever they look like — so lineage must win over a healthy QoQ."""
    g = guard_of({"2025-Q3": 100.0, "2025-Q4": 101.0}, "2025-Q4",
                 stored_fp="0000000000000000")
    check_eq("lineage wins", g.reason, G.REASON_LINEAGE)


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
