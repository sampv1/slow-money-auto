"""AT17 — fa/securities.assemble() against the V11v2 sheet-53 QA fixture.

The fixture is SYNTHETIC on purpose (V11v2 changelog #10): the V11 draft quoted
VCK at 70% coverage on one sheet and 89% on another for the same session, so
real tickers could not anchor an expected score. QA_A/QA_B/QA_C exercise the
arithmetic instead, and QA_B is the realistic broker — locked quality 39 (C4,
C5, C9 unavailable) + sector 23 + C19 8 = exactly 70, the publish gate with
zero margin.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import fa.securities as sec
from fa.securities import Criterion, assemble, CRITERION_POINTS, TIER_PROVISIONAL

Q_ALL    = [f"c{i}" for i in range(1, 15)]                 # 50 pts
Q_LOCKED = ["c1","c2","c3","c6","c7","c8","c10","c11","c12","c13","c14"]  # 39
SECTOR   = ["c15","c16","c17"]                             # 23

def pick(keys, want_max):
    """A subset of `keys` whose points sum to EXACTLY want_max.

    Exact subset-sum rather than a greedy prefix: the criterion weights are
    6,5,5,4,3,3,3,3,3,2,2, and greedy cannot reach 33 or 37 at all — which
    matters because those are precisely the "lost one criterion" cases the
    publish gate has to be tested at.
    """
    reach = {0: []}
    for k in keys:
        v = CRITERION_POINTS[k]
        for total in sorted(reach, reverse=True):
            if total + v <= want_max and (total + v) not in reach:
                reach[total + v] = reach[total] + [k]
    assert want_max in reach, f"cannot hit max {want_max} from {keys}"
    return reach[want_max]

def build(q_earned, q_max, sector_earned, c19_earned, c19_max, prov):
    cr, avail = {}, pick(Q_ALL if q_max > 39 else Q_LOCKED, q_max)
    rem = q_earned
    for k in avail:
        take = min(CRITERION_POINTS[k], rem); rem -= take
        cr[k] = Criterion(points=float(take), value=0.0)
    assert rem == 0
    for k in Q_ALL:
        cr.setdefault(k, Criterion(points=None, status="N_A", reason="no source"))
    rem = sector_earned
    for k in SECTOR:
        take = min(CRITERION_POINTS[k], rem); rem -= take
        cr[k] = Criterion(points=float(take), value=0.0)
    cr["c19"] = (Criterion(points=float(c19_earned), value=0.0) if c19_max
                 else Criterion(points=None, status="N_A", reason="no core P/E history"))
    for k, pts in prov.items():
        cr[k] = Criterion(points=float(pts), value=0.0, tier=TIER_PROVISIONAL)
    for k in ("c18", "c20"):
        cr.setdefault(k, Criterion(points=None, status="N_A", reason="insufficient"))
    return cr

#      name  q_earned q_max sector c19e c19max prov            | final e/m/score | prov e/m/cov/score
CASES = [
    ("QA_A", 30, 50, 8, 8, 8, {"c18": 2, "c20": 12}, 46, 81, 56.79012345679013, 60, 100, 1.00, 60.0),
    ("QA_B", 22, 39, 8, 6, 8, {"c18": 3},            36, 70, 51.42857142857143, 39,  77, 0.77, 50.64935064935065),
    ("QA_C",  1, 11, 8, 0, 0, {},                     9, 34, None,               9,  34, 0.34, 26.470588235294116),
]

fails = 0
for (name, qe, qm, se, c19e, c19m, prov, fe, fm, fs, pe, pm, pc, ps) in CASES:
    r = assemble(build(qe, qm, se, c19e, c19m, prov))
    print(f"\n{name}  group={r['data_group']}  model_status={r['model_status']}")
    for label, got, want in [
        ("final_earned", r["final_earned"], fe),
        ("final_available_max", r["final_available_max"], fm),
        ("final_coverage", r["final_coverage"], round(fm/100, 4)),
        ("final_fa_score", r["final_fa_score"], None if fs is None else round(fs, 2)),
        ("provisional_earned", r["provisional_earned"], pe),
        ("provisional_available_max", r["provisional_available_max"], pm),
        ("provisional_coverage", r["provisional_coverage"], pc),
        ("provisional_fa_score", r["provisional_fa_score"], round(ps, 2)),
    ]:
        ok = (got is None and want is None) or (
            got is not None and want is not None and abs(got - want) < 1e-9)
        if not ok: fails += 1
        print(f"   {'PASS' if ok else 'FAIL'}  {label:26s} got={got!r:>10} want={want!r}")


# --- V11v3 ------------------------------------------------------------------
# The publish gate moved from "coverage >= 70" to four simultaneous conditions.
# 70 was exactly the locked ceiling (39 + 23 + 8), so every publishable broker
# sat on the line and one missing criterion would have dropped the whole sector
# at once. 65 plus per-block floors buys slack in quality WITHOUT letting it be
# spent on valuation.

def gate(quality_max, cycle_max, valuation_max):
    """Build a symbol whose LOCKED availability is exactly as asked."""
    cr = {}
    for k in pick(Q_ALL if quality_max > 39 else Q_LOCKED, quality_max):
        cr[k] = Criterion(0.0, 0.0)
    for k in Q_ALL:
        cr.setdefault(k, Criterion(None, None, "N_A", "no source"))
    rem = cycle_max
    for k in SECTOR:
        take = min(CRITERION_POINTS[k], rem); rem -= take
        cr[k] = Criterion(0.0, 0.0) if take else Criterion(None, None, "N_A", "x")
    cr["c19"] = (Criterion(0.0, 0.0) if valuation_max
                 else Criterion(None, None, "N_A", "no core P/E history"))
    for k in ("c18", "c20"):
        cr[k] = Criterion(None, None, "N_A", "insufficient")
    return sec.assemble(cr)

print("\n=== V11v3 publish gate (AT21 / TC-GATE) ===")
for name, q, cyc, val, want in [
    ("TC-GATE-01  max 65, Q 34, cycle 23, val 8", 34, 23, 8, "PASS"),
    ("TC-GATE-02  max 64 (Q 33) — one point short", 33, 23, 8, "FAIL"),
    ("TC-GATE-03  max 65 but NO valuation", 34, 23, 0, "FAIL"),
    ("today's broker: Q 39, cycle 23, val 8", 39, 23, 8, "PASS"),
    ("loses C13 (2pts): Q 37", 37, 23, 8, "PASS"),
    ("loses C11 (3pts): Q 36", 36, 23, 8, "PASS"),
    ("loses C1 (6pts): Q 33", 33, 23, 8, "FAIL"),
    ("market series failed: cycle 18", 39, 18, 8, "FAIL"),
]:
    r = gate(q, cyc, val)
    got = r["publish_gate"]
    ok = got == want
    if not ok:
        fails += 1
    print(f"   {'PASS' if ok else 'FAIL'}  {name:44s} max={r['final_available_max']:5.0f} "
          f"-> {got} (want {want})")

# The valuation floor must read LOCKED availability only. C20 carries
# provisional points from V11v2 onward, so a gate that accepted it would let a
# broker with no core P/E publish on a method that has not passed its own gate.
cr = {k: Criterion(0.0, 0.0) for k in Q_LOCKED}
for k in Q_ALL:
    cr.setdefault(k, Criterion(None, None, "N_A", "no source"))
for k in SECTOR:
    cr[k] = Criterion(0.0, 0.0)
cr["c19"] = Criterion(None, None, "N_A", "no core P/E history")
cr["c18"] = Criterion(None, None, "N_A", "insufficient")
cr["c20"] = Criterion(9.0, 70.0, "OK", "cheap", tier=sec.TIER_PROVISIONAL)
r = gate_c20 = sec.assemble(cr)
ok = r["publish_gate"] == "FAIL" and r["valuation_locked_available"] == 0
if not ok:
    fails += 1
print(f"   {'PASS' if ok else 'FAIL'}  a scored-but-PROVISIONAL C20 cannot satisfy the "
      f"valuation floor (locked val={r['valuation_locked_available']}, "
      f"gate={r['publish_gate']})")

print("\n=== C9 reason codes (TC-C9-RC01/02) ===")
for pct, want_pts, want_code in [(85, 3, "C9_PROXY_TOP20"), (65, 2, "C9_PROXY_50_80"),
                                 (35, 1, "C9_PROXY_20_50"), (10, 0, "C9_PROXY_BOTTOM20")]:
    c = sec.score_c9_proxy(pct, 42)
    ok = c.points == want_pts and c.code == want_code
    if not ok:
        fails += 1
    print(f"   {'PASS' if ok else 'FAIL'}  percentile {pct:3d} -> {c.points}/4 "
          f"{c.code} (want {want_pts}, {want_code})")
c = sec.score_c9_proxy(85, 19)
ok = c.points is None and c.code == "C9_INSUFFICIENT_SAMPLE"
if not ok:
    fails += 1
print(f"   {'PASS' if ok else 'FAIL'}  19 peers is below the 20 minimum, so nobody is "
      f"scored (got {c.points}, {c.code})")
c = sec.score_c9_proxy(None, 42)
ok = c.points is None and c.status == "N_A"
if not ok:
    fails += 1
print(f"   {'PASS' if ok else 'FAIL'}  a missing balance-sheet line is N/A, never 0 — "
      f"coalescing it would make an under-reporting broker look safest")
if c.points == 0:
    fails += 1

print("\n=== C18 router (TC-C18) ===")
for obs, method, pct, want in [(12, "HISTORICAL_SENSITIVITY", 85, 7),
                               (12, "HISTORICAL_SENSITIVITY", 65, 5),
                               (9, "EXPOSURE_PROXY", 45, 3),
                               (9, "EXPOSURE_PROXY", 25, 2),
                               (9, "EXPOSURE_PROXY", 10, 0)]:
    c = sec.score_c18(pct, method, obs)
    ok = c.points == want and c.tier == sec.TIER_PROVISIONAL
    if not ok:
        fails += 1
    print(f"   {'PASS' if ok else 'FAIL'}  {obs:2d}q {method:24s} p{pct:3d} -> "
          f"{c.points}/7 {c.tier}")
c = sec.score_c18(90, "EXPOSURE_PROXY", 7)
ok = c.points is None and c.code == "C18_INSUFFICIENT_HISTORY"
if not ok:
    fails += 1
print(f"   {'PASS' if ok else 'FAIL'}  under 8 quarters nothing is scored, whatever the "
      f"percentile (got {c.points})")

print("\n" + ("ALL FIXTURES PASS (AT17 + AT21)" if not fails
             else f"{fails} CHECK(S) FAILED"))
sys.exit(1 if fails else 0)
