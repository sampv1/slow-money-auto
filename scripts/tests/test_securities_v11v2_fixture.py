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
from fa.securities import Criterion, assemble, CRITERION_POINTS, TIER_PROVISIONAL

Q_ALL    = [f"c{i}" for i in range(1, 15)]                 # 50 pts
Q_LOCKED = ["c1","c2","c3","c6","c7","c8","c10","c11","c12","c13","c14"]  # 39
SECTOR   = ["c15","c16","c17"]                             # 23

def pick(keys, want_max):
    """Smallest prefix of `keys` whose points sum to exactly want_max."""
    got, out = 0, []
    for k in keys:
        if got == want_max: break
        if got + CRITERION_POINTS[k] <= want_max:
            out.append(k); got += CRITERION_POINTS[k]
    assert got == want_max, f"cannot hit max {want_max} (got {got})"
    return out

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

print(f"\n{'ALL FIXTURES PASS (AT17)' if not fails else f'{fails} CHECK(S) FAILED'}")
sys.exit(1 if fails else 0)
