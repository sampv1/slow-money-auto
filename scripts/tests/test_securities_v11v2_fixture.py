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

# C9 is provisional by method, so it is never part of a LOCKED quality max.
Q_LOCKED_V4 = [k for k in Q_ALL if k not in ("c9",)]


def build(q_earned, q_max, sector_earned, c19_earned, c19_max, prov):
    pool = Q_LOCKED if q_max <= 39 else Q_LOCKED_V4
    cr, avail = {}, pick(pool, q_max)
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

# QA_A CHANGED in V11v4: quality locked max is 46, not 50. BA formalised that
# C9 can never be locked — its only method is the risk-asset proxy — so its 4
# points leave the FINAL side and join C18 + C20 in the provisional extra
# (4 + 7 + 12 = 23). Final max 46 + 23 + 8 = 77, and the score moves 56.79 ->
# 55.84. The engine already behaved this way; it was the fixture that assumed
# an official CAR nobody can source.
#      name  q_earned q_max sector c19e c19max prov            | final e/m/score | prov e/m/cov/score
CASES = [
    ("QA_A", 27, 46, 8, 8, 8, {"c9": 4, "c18": 1, "c20": 12}, 43, 77, 55.84415584415584, 60, 100, 1.00, 60.0),
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


# --- V11v4 ------------------------------------------------------------------

print("\n=== V11v4 quality groups (AT22 / TC-GROUP) ===")
# The realistic broker: C4/C5 unsourced, C9 proxy-only, everything else locked.
gcr = {}
for i in range(1, 15):
    k = f"c{i}"
    if k in ("c4", "c5"):
        gcr[k] = Criterion(None, None, "N_A", "no source")
    elif k == "c9":
        gcr[k] = Criterion(3.0, 0.0, "OK", "proxy", tier=sec.TIER_PROVISIONAL)
    else:
        gcr[k] = Criterion(float(CRITERION_POINTS[k]), 0.0)
for k in SECTOR:
    gcr[k] = Criterion(float(CRITERION_POINTS[k]), 0.0)
gcr["c19"] = Criterion(8.0, 0.0)
gcr["c18"] = Criterion(None, None, "N_A", "x")
gcr["c20"] = Criterion(None, None, "N_A", "x")
groups = sec.assemble(gcr)["quality_groups"]

for name, codes, design, final_av, prov_av in [
    ("asset_quality", ["c3", "c12", "c13"], 10, 10, 10),
    ("operating_efficiency", ["c1", "c2", "c4", "c5", "c6", "c7", "c8"], 28, 21, 21),
    ("capital_safety", ["c9", "c10", "c11", "c14"], 12, 8, 12),
]:
    g = groups[name]
    ok = (list(g["criteria"]) == codes and g["design_max"] == design
          and g["final_available_max"] == final_av
          and g["provisional_available_max"] == prov_av)
    if not ok:
        fails += 1
    print(f"   {'PASS' if ok else 'FAIL'}  {name:22s} {'+'.join(codes):28s} "
          f"design {g['design_max']:.0f}/{design}  final {g['final_available_max']:.0f}/{final_av}"
          f"  prov {g['provisional_available_max']:.0f}/{prov_av}")

total_design = sum(g["design_max"] for g in groups.values())
ok = total_design == 50
if not ok:
    fails += 1
print(f"   {'PASS' if ok else 'FAIL'}  TC-WEIGHT-01: the three groups' design maxima sum to "
      f"{total_design:.0f} (want 50)")

covered = sorted(k for g in groups.values() for k in g["criteria"])
ok = covered == sorted(f"c{i}" for i in range(1, 15))
if not ok:
    fails += 1
print(f"   {'PASS' if ok else 'FAIL'}  the groups partition C1-C14 exactly once — no criterion "
      f"counted twice or dropped")

# C9's proxy must sit OUTSIDE the official subtotal, or a provisional method
# ends up inside a number labelled official.
cap = groups["capital_safety"]
ok = cap["final_earned"] == 8.0 and cap["provisional_earned"] == 11.0
if not ok:
    fails += 1
print(f"   {'PASS' if ok else 'FAIL'}  C9's proxy is in capital safety's PROVISIONAL side only "
      f"(final {cap['final_earned']}, prov {cap['provisional_earned']})")

print("\n=== V11v4 criterion weights (AT23) ===")
WEIGHTS = {"c1": 6, "c2": 5, "c3": 5, "c4": 4, "c5": 3, "c6": 4, "c7": 3,
           "c8": 3, "c9": 4, "c10": 3, "c11": 3, "c12": 3, "c13": 2, "c14": 2}
bad = {k: (CRITERION_POINTS[k], v) for k, v in WEIGHTS.items() if CRITERION_POINTS[k] != v}
if bad:
    fails += 1
print(f"   {'PASS' if not bad else f'FAIL {bad}'}  C1-C14 weights match the V11v4 master "
      f"(C1=6, C3=5, C8=3, C13=2, C14=2)")
tot = sum(CRITERION_POINTS[f"c{i}"] for i in range(1, 15))
ok = tot == 50
if not ok:
    fails += 1
print(f"   {'PASS' if ok else 'FAIL'}  and sum to {tot} (want 50)")
ok = sum(CRITERION_POINTS.values()) == 100
if not ok:
    fails += 1
print(f"   {'PASS' if ok else 'FAIL'}  the whole rubric still sums to 100")

print("\n=== V11v4 per-criterion history windows (AT24) ===")
import refresh_fa_securities as rfs  # noqa: E402

W = rfs.CRITERION_WINDOWS
ok = W["c14"] == W["c19"] == rfs.CORE_PE_HISTORY_QUARTERS and W["c18"] > W["c14"]
if not ok:
    fails += 1
print(f"   {'PASS' if ok else 'FAIL'}  C14 and C19 stay at the V10 depth ({W['c14']}) while C18 "
      f"runs deeper ({W['c18']}) — AT24-B")

hist = [{"quarter": f"2026-Q{4 - (i % 4)}", "core_roe": 0.1} for i in range(21)]
v14, l14 = rfs.history_window(hist, "c14")
v18, l18 = rfs.history_window(hist, "c18")
ok = len(v14) == W["c14"] + 1 and len(v18) == W["c18"] + 1 and len(v18) > len(v14)
if not ok:
    fails += 1
print(f"   {'PASS' if ok else 'FAIL'}  each criterion receives its OWN slice "
      f"(c14 {len(v14)}, c18 {len(v18)})")

# The whole point of AT24: making C18's window deeper must not change what C14
# sees. Growing the source list is exactly what silently moved C14 on 20 of 42
# brokers in round 3.
deeper = hist + [{"quarter": "2019-Q1", "core_roe": 0.1} for _ in range(10)]
v14b, l14b = rfs.history_window(deeper, "c14")
ok = l14b["source_hash"] == l14["source_hash"] and v14b == v14
if not ok:
    fails += 1
print(f"   {'PASS' if ok else 'FAIL'}  AT24-C: extending the source history leaves C14's window "
      f"and content hash unchanged")

ok = set(l18) >= {"required_window", "observed_window", "source_start",
                  "source_end", "source_hash"}
if not ok:
    fails += 1
print(f"   {'PASS' if ok else 'FAIL'}  AT24-D: lineage records window and content hash")

try:
    rfs.history_window(hist, "c7")
    print("   FAIL  an undeclared criterion must raise, not inherit a default depth")
    fails += 1
except KeyError:
    print("   ok:   an undeclared criterion raises rather than inheriting a neighbour's depth")

print("\n" + ("ALL FIXTURES PASS (AT17 + AT21 + AT22-24)" if not fails
             else f"{fails} CHECK(S) FAILED"))
sys.exit(1 if fails else 0)
