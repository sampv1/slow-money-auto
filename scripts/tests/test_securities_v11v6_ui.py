"""V11v6 UI FINAL — sheet 06's display fixture and sheet 07's acceptance cases.

THESE QA_A/QA_B/QA_C ARE NOT THE MODEL'S QA_A/QA_B/QA_C, and the name collision
is BA's, not ours. Sheet 06 says it twice ("không thay fixture QA_A/B/C của mô
hình", "Bộ giả lập UI không ghi đè fixture nghiệm thu mô hình V5"): V11v2 sheet
53's fixture pins the SCORING engine and lives in
`test_securities_v11v2_fixture.py`, which still runs and must keep passing. This
file pins the DISPLAY contract with a different set of inputs that happen to
reuse the three labels.

Keeping them in separate files is the whole defence. Merged, the second
definition of QA_A would silently overwrite the first and the engine fixture
would stop testing the engine — which is exactly the failure sheet 06 is warning
about, one level down.

Run standalone (`python3 scripts/tests/test_securities_v11v6_ui.py`) or under
pytest. No DB, no network — the fixture is literal input from the sheet.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fa.securities import CRITERION_POINTS  # noqa: E402
from fa.securities_ui import (  # noqa: E402
    LEVEL_NONE,
    UI_VERSION,
    block_totals,
    gate_detail,
    level_for,
    subgroups,
    ui_contract,
)

PASSED = FAILED = 0


def check(label, got, want):
    global PASSED, FAILED
    if got == want:
        PASSED += 1
        print(f"  PASS  {label}: {got}")
    else:
        FAILED += 1
        print(f"  FAIL  {label}: got {got!r}, want {want!r}")


def crit(earned, status):
    """One criterion in the shape `assemble()` emits (`Criterion.contract`)."""
    scored = earned is not None
    return {"earned": earned, "status": "VALID" if scored else "N_A",
            "tier": (None if not scored
                     else "PROVISIONAL" if status == "PROVISIONAL" else "LOCKED"),
            "reason_code": None}


def build(spec):
    """spec: {"c1": (3, "FINAL"), ...} — every criterion present, N/A as None."""
    return {k: crit(*spec[k]) for k in CRITERION_POINTS}


N = (None, "NA")

# --- sheet 06, exactly as tabulated -------------------------------------------
QA_A = build({
    "c1": (3, "FINAL"), "c2": (5, "FINAL"), "c3": (3, "FINAL"), "c4": (1, "FINAL"),
    "c5": (1, "FINAL"), "c6": (2, "FINAL"), "c7": (2, "FINAL"), "c8": (1, "FINAL"),
    "c9": (3, "PROVISIONAL"), "c10": (2, "FINAL"), "c11": (2, "FINAL"),
    "c12": (2, "FINAL"), "c13": (2, "FINAL"), "c14": (1, "FINAL"),
    "c15": (4, "FINAL"), "c16": (3, "FINAL"), "c17": (1, "FINAL"),
    "c18": (5, "PROVISIONAL"), "c19": (8, "FINAL"), "c20": (9, "PROVISIONAL"),
})
QA_B = build({
    "c1": (2, "FINAL"), "c2": (3, "FINAL"), "c3": (3, "FINAL"), "c4": N,
    "c5": N, "c6": (2, "FINAL"), "c7": (2, "FINAL"), "c8": (1, "FINAL"),
    "c9": N, "c10": (2, "FINAL"), "c11": (2, "FINAL"),
    "c12": (2, "FINAL"), "c13": (2, "FINAL"), "c14": (1, "FINAL"),
    "c15": (4, "FINAL"), "c16": (3, "FINAL"), "c17": (1, "FINAL"),
    "c18": (3, "PROVISIONAL"), "c19": (6, "FINAL"), "c20": N,
})
QA_C = build({
    "c1": (1, "FINAL"), "c2": N, "c3": (0, "FINAL"), "c4": N, "c5": N, "c6": N,
    "c7": N, "c8": N, "c9": N, "c10": N, "c11": N, "c12": N, "c13": N, "c14": N,
    "c15": (4, "FINAL"), "c16": (3, "FINAL"), "c17": (1, "FINAL"), "c18": N,
    "c19": N, "c20": N,
})


def contract(criteria):
    return ui_contract({"criteria": criteria})


print(f"=== V6-02/03/04  sheet 06 fixture — totals, score, coverage, gate ===")
for name, cr, exp in (
    # (final_earned, final_available, score, combined_e, combined_a, coverage, gate)
    ("QA_A", QA_A, (43, 77, 55.84, 60, 100, 1.0, True)),
    ("QA_B", QA_B, (36, 70, 51.43, 39, 77, 0.77, True)),
    ("QA_C", QA_C, (9, 34, None, 9, 34, 0.34, False)),
):
    c = contract(cr)
    fe, fa, score, ce, ca, cov, gate = exp
    check(f"{name} CT earned", c["final_earned"], fe)
    check(f"{name} CT available", c["final_available"], fa)
    check(f"{name} score", c["final_composite_score"], score)
    check(f"{name} coverage_display", c["coverage_display"], cov)
    check(f"{name} gate", c["publish_gate"]["pass"], gate)
    b = c["blocks"]
    check(f"{name} combined earned",
          round(sum(x["combined_earned"] for x in b.values()), 2), ce)
    check(f"{name} combined available",
          round(sum(x["combined_available"] for x in b.values()), 2), ca)

print("\n=== V6-02  QA_A block totals: CT and 'gồm tạm tính' ===")
b = block_totals(QA_A)
check("quality CT", (b["quality"]["final_earned"], b["quality"]["final_available"]), (27, 46))
check("quality combined", (b["quality"]["combined_earned"], b["quality"]["combined_available"]), (30, 50))
check("cycle CT", (b["cycle"]["final_earned"], b["cycle"]["final_available"]), (8, 23))
check("cycle combined", (b["cycle"]["combined_earned"], b["cycle"]["combined_available"]), (13, 30))
check("valuation CT", (b["valuation"]["final_earned"], b["valuation"]["final_available"]), (8, 8))
check("valuation combined", (b["valuation"]["combined_earned"], b["valuation"]["combined_available"]), (17, 20))
check("quality design_max", b["quality"]["design_max"], 50)
check("cycle design_max", b["cycle"]["design_max"], 30)
check("valuation design_max", b["valuation"]["design_max"], 20)

print("\n=== V6-03  QA_B: no provisional layer must NOT repeat a second line ===")
bb = block_totals(QA_B)
check("QA_B quality CT", (bb["quality"]["final_earned"], bb["quality"]["final_available"]), (22, 39))
check("QA_B quality has_provisional (C9 is N/A, not provisional)",
      bb["quality"]["has_provisional"], False)
check("QA_B valuation CT", (bb["valuation"]["final_earned"], bb["valuation"]["final_available"]), (6, 8))
check("QA_B valuation has_provisional (C20 N/A)", bb["valuation"]["has_provisional"], False)
check("QA_B cycle has_provisional (C18 3/7*)", bb["cycle"]["has_provisional"], True)
check("QA_B cycle combined", (bb["cycle"]["combined_earned"], bb["cycle"]["combined_available"]), (11, 30))

print("\n=== V6-05  three quality subgroups, and they must sum to quality CT ===")
for name, cr, want in (
    ("QA_A", QA_A, {"asset": (7, 10), "operation": (15, 28), "capital": (5, 8)}),
    ("QA_B", QA_B, {"asset": (7, 10), "operation": (10, 21), "capital": (5, 8)}),
    ("QA_C", QA_C, {"asset": (0, 5), "operation": (1, 6), "capital": (0, 0)}),
):
    sg = subgroups(cr)
    for g, (e, a) in want.items():
        check(f"{name} {g}", (sg[g]["final_earned"], sg[g]["final_available"]), (e, a))
    tot_e = sum(sg[g]["final_earned"] for g in sg)
    tot_a = sum(sg[g]["final_available"] for g in sg)
    q = block_totals(cr)["quality"]
    check(f"{name} subgroups sum == quality CT",
          (tot_e, tot_a), (q["final_earned"], q["final_available"]))

print("\n=== V6-05  C9 is named as the provisional member of capital safety ===")
check("QA_A capital provisional members", subgroups(QA_A)["capital"]["provisional_criteria"], ["c9"])
check("QA_A capital combined (with C9 3/4*)",
      (subgroups(QA_A)["capital"]["combined_earned"],
       subgroups(QA_A)["capital"]["combined_available"]), (8, 12))
check("QA_B capital provisional members (C9 N/A ⇒ none)",
      subgroups(QA_B)["capital"]["provisional_criteria"], [])

print("\n=== V6-06  the * set: provisional leaves BOTH numerator and denominator ===")
check("QA_A provisional criteria", contract(QA_A)["provisional_criteria"], ["c9", "c18", "c20"])
check("QA_B provisional criteria", contract(QA_B)["provisional_criteria"], ["c18"])
check("QA_C provisional criteria", contract(QA_C)["provisional_criteria"], [])
check("always-provisional set", contract(QA_A)["always_provisional"], ["c18", "c20"])
# 43/77 excludes C9+C18+C20 from the numerator AND the denominator: adding their
# earned back gives 60, adding their max back gives 100 — never one without the
# other, which is the V9 C20 bug.
check("QA_A CT + provisional earned == combined", 43 + 3 + 5 + 9, 60)
check("QA_A CT + provisional max == combined", 77 + 4 + 7 + 12, 100)

print("\n=== V6-04  zero is a MEASUREMENT; N/A is not. No 0/0 denominators ===")
sg_c = subgroups(QA_C)
check("QA_C C3 0/5 keeps its denominator", (sg_c["asset"]["final_earned"], sg_c["asset"]["final_available"]), (0, 5))
check("QA_C asset level is a real band, not NO_DATA", sg_c["asset"]["level"], "LOW")
check("QA_C capital available == 0 ⇒ NO_DATA, not 'thấp'", sg_c["capital"]["level"], LEVEL_NONE)
check("QA_C valuation block is 0/0", (block_totals(QA_C)["valuation"]["final_earned"],
                                     block_totals(QA_C)["valuation"]["final_available"]), (0, 0))
check("QA_C score is None (never 0.0)", contract(QA_C)["final_composite_score"], None)

print("\n=== V6-08  level bands at 0.80 / 0.65 / 0.50 and just under each ===")
check("1.00 -> GOOD", level_for(10, 10), "GOOD")
check("0.80 exactly -> GOOD", level_for(8, 10), "GOOD")
check("0.799 -> FAIR", level_for(7.99, 10), "FAIR")
check("0.65 exactly -> FAIR", level_for(6.5, 10), "FAIR")
check("0.649 -> MID", level_for(6.49, 10), "MID")
check("0.50 exactly -> MID", level_for(5, 10), "MID")
check("0.499 -> LOW", level_for(4.99, 10), "LOW")
check("0.0 measured -> LOW", level_for(0, 10), "LOW")
check("available 0 -> NO_DATA", level_for(0, 0), LEVEL_NONE)
# Rounding must not happen before classification (sheet 04, UI-01). 0.7999 is
# FAIR even though it prints as 0.80.
check("0.7999 classifies FAIR, not GOOD", level_for(7.999, 10), "FAIR")

print("\n=== V6-07  gate boundaries from sheet 07 — AVAILABILITY, not earned ===")


def _exact_subset(keys, target):
    """The subset of `keys` whose points sum to EXACTLY `target`.

    Greedy does not work here — the quality weights are 6,5,5,4,3,4,3,3,4,3,3,3,
    2,2 and taking the largest first overshoots 34 and strands a remainder of 1.
    A gate test that cannot construct its own boundary is worse than no test, so
    this searches rather than approximates.
    """
    def walk(i, left, chosen):
        if left == 0:
            return chosen
        if i >= len(keys) or left < 0:
            return None
        with_k = walk(i + 1, left - CRITERION_POINTS[keys[i]], chosen + [keys[i]])
        return with_k if with_k is not None else walk(i + 1, left, chosen)
    got = walk(0, target, [])
    assert got is not None, f"no subset of {keys} sums to {target}"
    return set(got)


def gate_from(quality_avail, cycle_avail, val_avail, quality_earned=0):
    """Synthesise a criteria map with exactly the requested LOCKED availability."""
    spec = {}
    picked = _exact_subset([f"c{i}" for i in range(1, 15)], quality_avail)
    for k in [f"c{i}" for i in range(1, 15)]:
        if k in picked:
            take = min(quality_earned, CRITERION_POINTS[k])
            spec[k] = (take, "FINAL")
            quality_earned -= take
        else:
            spec[k] = N
    picked = _exact_subset(["c15", "c16", "c17"], cycle_avail)
    for k in ["c15", "c16", "c17"]:
        spec[k] = (0, "FINAL") if k in picked else N
    spec["c18"] = N
    picked = _exact_subset(["c19", "c20"], val_avail)
    for k in ["c19", "c20"]:
        spec[k] = (0, "FINAL") if k in picked else N
    return gate_detail(build(spec))


# 34 + 23 + 8 = 65, so the three group gates passing forces total >= 65 — BA
# flags this themselves. The cases below are therefore group-driven.
check("at the threshold 34/23/8 -> PASS", gate_from(34, 23, 8)["pass"], True)
check("quality 33 -> FAIL", gate_from(33, 23, 8)["pass"], False)
check("sector cycle 18 (not 23) -> FAIL", gate_from(34, 18, 8)["pass"], False)
check("valuation 0 (< 8) -> FAIL", gate_from(34, 23, 0)["pass"], False)
# THE FOUR CONDITIONS ARE NOT INDEPENDENT, and BA says so on sheet 07: "34 + 23
# + 8 = 65. Khi ba gate nhóm cùng PASS thì total tự đạt 65." So losing a quality
# point below 34 necessarily drops the total below 65 too, and BOTH conditions
# report failure. The tooltip listing two reasons for one cause is correct — it
# is a list of conditions, not a diagnosis — and a test asserting only "quality"
# would be asserting that the total condition is silently skipped.
g = gate_from(33, 23, 8)
check("both coupled conditions are named",
      [c["id"] for c in g["failed_conditions"]], ["total", "quality"])
by_id = {c["id"]: c for c in g["failed_conditions"]}
check("quality carries its actual", by_id["quality"]["actual_available"], 33)
check("quality carries its requirement", by_id["quality"]["required_available"], 34)
check("total carries its actual (33+23+8)", by_id["total"]["actual_available"], 64)
check("total carries its requirement", by_id["total"]["required_available"], 65)
# SHEET 07'S "Valuation 7" ROW CANNOT OCCUR, and that is a property of the
# rubric rather than a defect in the gate. Valuation is C19 (8) + C20 (12), so
# the only locked availabilities reachable are 0, 8, 12 and 20 — 7 is not a
# state any payload can be in. The floor is still worth testing at the boundary
# that IS reachable: 0 fails, 8 passes.
#
# The case that matters is the floor failing ALONE, with the quality block
# carrying enough slack that the total still clears 65 (42 + 23 + 0 = 65). That
# is the whole reason V11v3 added per-block floors: quality slack must not be
# spendable on valuation, which is the half V10 established can never be traded
# away.
g2 = gate_from(42, 23, 0)
check("valuation 0 fails ALONE while total still reaches 65",
      [c["id"] for c in g2["failed_conditions"]], ["valuation"])
check("...and the total condition genuinely passed at 65",
      next(c["actual_available"] for c in g2["conditions"] if c["id"] == "total"), 65)
check("valuation 8 is the smallest passing value", gate_from(42, 23, 8)["pass"], True)
# EARNED MUST NOT SUBSTITUTE FOR AVAILABLE. A broker that scored zero on every
# criterion it could measure still passes the gate — and then publishes a 0.0,
# which is the honest outcome.
check("all-zero earned but full availability -> PASS", gate_from(34, 23, 8, 0)["pass"], True)
check("cycle gate is an EQUALITY (25 != 23 impossible; 18 fails)",
      [c["op"] for c in gate_from(34, 23, 8)["conditions"] if c["id"] == "sector_cycle"], ["=="])

print("\n=== V6-09  coverage counts AVAILABILITY, not populated cells ===")
# QA_C has 5 criteria carrying a value and 15 N/A, but coverage is 34%, not 25%.
check("QA_C coverage is 34% (points), not 5/20 cells", contract(QA_C)["coverage_display"], 0.34)
check("QA_A coverage 100% with three provisional", contract(QA_A)["coverage_display"], 1.0)
check("QA_B official coverage differs from display coverage",
      (contract(QA_B)["coverage_final"], contract(QA_B)["coverage_display"]), (0.7, 0.77))
# A high X% does not open the gate.
check("QA_A 100% coverage AND gate PASS", (contract(QA_A)["coverage_display"],
                                           contract(QA_A)["publish_gate"]["pass"]), (1.0, True))

print("\n=== V6-01  ui_version is stamped and is NOT a model_version ===")
check("ui_version", UI_VERSION, "CTCK_UI_FINAL_20260909")
check("ui_version on the contract", contract(QA_A)["ui_version"], "CTCK_UI_FINAL_20260909")

print(f"\n{PASSED} passed, {FAILED} failed")
if FAILED:
    sys.exit(1)
print("ALL V11v6 UI FIXTURES PASS (V6-01..V6-09 arithmetic)")


def test_v11v6_ui_fixture():
    """pytest entry point — the module body is the test."""
    assert FAILED == 0
