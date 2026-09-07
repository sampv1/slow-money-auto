"""Deep point-in-time market ADTV history, and the V11v2 criteria it feeds.

Three things here have already gone wrong once, in this module or its
ancestors, and each has a test that fails if it comes back:

  * OFFSET PAGING over a multi-million-row read degrades quadratically. The
    first version of the backfill used one `paged_select` over the whole window
    and was killed after 15 minutes without finishing a single year (measured:
    0.25 s at offset 0, 2.43 s at offset 300k). The month chunker is what makes
    it linear, so its boundaries are pinned.

  * YoY BY POSITION rather than by label. After a quarter is rejected for
    having too few sessions, "four rows back" is no longer "the same quarter
    last year".

  * A PROVISIONAL criterion scored as 0. Dropping it from the numerator while
    leaving it in the denominator is the exact confusion normalization exists
    to prevent — that is the V9 C20 bug, which cost every broker ~15 points.
"""

import datetime as dt
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import pandas as pd  # noqa: E402

import fa.securities as sec  # noqa: E402
from ta import market_history as mh  # noqa: E402

FAILS: list[str] = []


def check(cond, msg):
    print(f"  {'ok:  ' if cond else 'FAIL:'} {msg}")
    if not cond:
        FAILS.append(msg)


def _series(start: str, n_days: int, value: float = 1.0) -> pd.Series:
    """`n_days` consecutive daily points — a stand-in for market sessions."""
    idx = pd.date_range(start, periods=n_days, freq="D")
    return pd.Series([value] * n_days, index=idx)


print("=== month chunking (the fix for quadratic offset paging) ===")
chunks = list(mh._month_starts(dt.date(2019, 1, 15), dt.date(2019, 4, 3)))
check(chunks[0] == (dt.date(2019, 1, 15), dt.date(2019, 1, 31)),
      f"the first chunk starts at the requested day, not the 1st (got {chunks[0]})")
check(chunks[-1] == (dt.date(2019, 4, 1), dt.date(2019, 4, 3)),
      f"the last chunk stops at the requested end (got {chunks[-1]})")
check(all(a[1] + dt.timedelta(days=1) == b[0] for a, b in zip(chunks, chunks[1:])),
      "chunks are contiguous — no session can fall between two of them")
check(len({d for lo, hi in chunks
           for d in pd.date_range(lo, hi)}) == (dt.date(2019, 4, 3)
                                                - dt.date(2019, 1, 15)).days + 1,
      "and they do not overlap, so no session is summed twice")
leap = list(mh._month_starts(dt.date(2020, 2, 1), dt.date(2020, 2, 29)))
check(leap == [(dt.date(2020, 2, 1), dt.date(2020, 2, 29))],
      f"February in a leap year is one whole chunk (got {leap})")

print("\n=== quarterly aggregation ===")
daily = pd.concat([
    _series("2019-01-01", 60, 100.0),    # 2019-Q1, full
    _series("2019-04-01", 60, 200.0),    # 2019-Q2, full
    _series("2020-01-01", 60, 150.0),    # 2020-Q1, full
    _series("2020-04-01", 10, 999.0),    # 2020-Q2, THIN but completed
    _series("2020-07-01", 60, 300.0),    # 2020-Q3, the OPEN quarter — dropped
])
q = mh.to_quarterly(daily, min_sessions=40)
check(q.loc["2019-Q1", "adtv"] == 100.0 and q.loc["2019-Q2", "adtv"] == 200.0,
      "a full quarter's ADTV is the mean of its sessions")
check(pd.isna(q.loc["2020-Q2", "adtv"]),
      "a quarter under min_sessions has NO adtv — it is visible as rejected "
      "rather than silently absent or silently wrong")
check(q.loc["2020-Q2", "sessions"] == 10,
      "but its session count is still reported, so the rejection is auditable")
check("2020-Q3" not in q.index,
      "and the quarter the data ends in is absent entirely — it is still open")

# The quarter the data ENDS in is still open, and an open quarter is dropped
# entirely — otherwise the series depends on the day the job was run, and two
# invocations leave the same logical quarter stored twice at different dates.
still_open = mh.to_quarterly(pd.concat([_series("2025-01-01", 60, 100.0),
                                        _series("2025-04-01", 50, 120.0)]),
                             min_sessions=40)
check("2025-Q2" not in still_open.index and "2025-Q1" in still_open.index,
      f"the quarter the data ends in is dropped as unfinished, and the completed "
      f"one is kept (got {list(still_open.index)})")

print("\n=== YoY is by LABEL, never by position ===")
check(abs(q.loc["2020-Q1", "yoy"] - 0.5) < 1e-12,
      f"2020-Q1 (150) against 2019-Q1 (100) is +50% (got {q.loc['2020-Q1', 'yoy']})")
# Absent, not zero. pandas stores the gap as NaN in a float column, which
# `build_rows` filters on — what must never happen is a 0.0 that reads as "the
# market was flat year on year".
check(pd.isna(q.loc["2019-Q1", "yoy"]),
      "the first year has no base and yields no value, NOT 0")
check(pd.isna(q.loc["2020-Q2", "yoy"]),
      "a rejected quarter yields no YoY of its own...")
# The trap: 2020-Q1's base is four LABELS back (2019-Q1), but only two ROWS back
# in this frame, because 2019-Q3/Q4 never existed. Positional lag would have
# paired it with 2019-Q1 by luck here and with the wrong quarter elsewhere.
sparse = mh.to_quarterly(pd.concat([_series("2019-01-01", 60, 100.0),
                                    _series("2020-01-01", 60, 150.0),
                                    _series("2020-04-01", 60, 111.0)]),
                         min_sessions=40)
check(abs(sparse.loc["2020-Q1", "yoy"] - 0.5) < 1e-12,
      "with 2019-Q2..Q4 entirely absent, 2020-Q1 still finds 2019-Q1 as its base")

print("\n=== rows are dated on a real session ===")
rows = mh.build_rows(daily, q)
qrows = {r["date"]: r for r in rows if r["metric"] == mh.METRIC_ADTV_Q}
check("2019-03-01" in qrows,
      f"a quarterly point sits on its last TRADED session, not the calendar "
      f"quarter end (got {sorted(qrows)[:1]})")
check(all(r["meta"]["model_version"] == mh.MODEL_VERSION for r in rows)
      and all("unit" in r and r["source"] == "ta_ohlcv" for r in rows),
      "every row is stamped with the model version, and carries the same "
      "source/unit/meta shape macro_series already uses — the column is `meta`, "
      "not `metadata`, and a mismatch is only caught at write time")
check(not any(r["metric"] == mh.METRIC_ADTV_Q and r["meta"]["quarter"] == "2020-Q2"
              for r in rows),
      "the thin quarter is not written at all")

print("\n=== C5 proxy (sheet 45) ===")
check(sec.score_c5_proxy(0.18, 0.10).points == 2,
      "AT07: brokerage GP +18% against market ADTV +10% is a +8pp spread -> 2/3")
check(sec.score_c5_proxy(0.18, 0.10).tier == sec.TIER_PROVISIONAL,
      "and it is PROVISIONAL — the proxy answers a neighbouring question")
check(sec.score_c5_proxy(0.30, 0.10).points == 3
      and sec.score_c5_proxy(0.05, 0.10).points == 1
      and sec.score_c5_proxy(0.05, 0.30).points == 0,
      "the other three bands land at +20pp -> 3, -5pp -> 1, -25pp -> 0")
missing = sec.score_c5_proxy(None, 0.10)
check(missing.points is None and missing.status == "N_A",
      "a missing input is N/A, NOT 0 — a broker whose market context we cannot "
      "measure has not lost share")

print("\n=== C20 cross-section (sheet 48) ===")
small = sec.c20_cross_section({f"S{i}": (1.2, 0.15) for i in range(19)})
check(small["model"]["status"] == "INSUFFICIENT_SAMPLE" and not small["scores"],
      "TC-C20-02: 19 brokers is below the 20 minimum, so NOBODY is scored")

# A clean linear world: ln(P/B) = -0.5 + 3*ROE, plus one obviously cheap and one
# obviously dear name placed by hand.
import math  # noqa: E402
obs = {}
for i in range(40):
    roe = 0.05 + 0.005 * i
    obs[f"S{i:02d}"] = (math.exp(-0.5 + 3.0 * roe), roe)
obs["CHEAP"] = (math.exp(-0.5 + 3.0 * 0.15) * 0.5, 0.15)
obs["DEAR"] = (math.exp(-0.5 + 3.0 * 0.15) * 2.0, 0.15)
res = sec.c20_cross_section(obs)
m = res["model"]
check(m["status"] == "CROSS_SECTION" and m["n"] == 42,
      f"42 valid observations fit the cross-section (got {m['n']})")
check(abs(m["b"] - 3.0) < 0.35,
      f"the fitted slope recovers the generating one (b={m['b']:.3f}, want ~3.0)")
check(res["scores"]["CHEAP"].points == 12 and res["scores"]["DEAR"].points == 0,
      "the name trading at half its ROE-justified P/B scores 12; the one at "
      "double scores 0 — cheapness ranks on the NEGATIVE residual")
check(res["scores"]["CHEAP"].tier == sec.TIER_PROVISIONAL,
      "and C20 is PROVISIONAL until C20-G2 passes, whatever it measured")
check(len({c.points for c in res["scores"].values()}) >= 3,
      "the mapping produces at least 3 distinct levels (the G2-1 shape)")

zero_pb = sec.c20_cross_section({**obs, "BAD": (0.0, 0.10)})
check("BAD" not in zero_pb["scores"],
      "a non-positive P/B cannot enter the sample — ln(P/B) is undefined, and "
      "excluding it is not the same as scoring it 0")

print("\n=== C20 reads current_pb, NEVER pb_ratio ===")
# `pb_ratio` is the V8 DIAGNOSTIC — actual P/B divided by a core-only justified
# P/B — and it survives in ctx for backtest comparability. It is not a P/B: on
# the live sector ORS carried pb_ratio 110.32 against a true P/B of 1.10, and
# because the four such names all sat at LOW ROE, fitting on the wrong variable
# inverted the slope to b = -6.8. Two same-shaped keys, one of which silently
# produces a plausible-looking model, is exactly what needs a test.
import refresh_fa_securities as rfs  # noqa: E402

collected = {}
for i in range(25):
    roe = 0.04 + 0.006 * i
    collected[f"S{i:02d}"] = {"ctx": {
        "current_pb": math.exp(-0.5 + 3.0 * roe),   # the real thing
        "pb_ratio": 50.0 - i,                       # the decoy, anti-correlated
        "normalized_total_roe": roe,
    }}
model = rfs.add_c20_cross_section(collected)
check(model["b"] > 0,
      f"fitting on current_pb gives an economically sensible slope "
      f"(b={model['b']:.3f} > 0)")
check(all("c20_criterion" in d["ctx"] for d in collected.values()),
      "and every symbol in the sample receives an injected criterion")
top = max(collected, key=lambda s: collected[s]["ctx"]["normalized_total_roe"])
check(collected[top]["ctx"]["c20_criterion"].points is not None,
      "including the highest-ROE name, which the decoy would have ranked worst")

print("\n=== the tier split (V11v2 sheet 44) ===")
full = {k: sec.Criterion(0.0, 0.0) for k in sec.CRITERION_POINTS}
full["c20"] = sec.Criterion(9.0, 70.0, "OK", "cheap", tier=sec.TIER_PROVISIONAL)
full["c18"] = sec.Criterion(None, None, "N_A", "mapping not LOCKED")
t = sec.assemble(full)
check(t["final_available_max"] == 81 and t["provisional_available_max"] == 93,
      f"C20's 12 points are in the provisional denominator and out of the "
      f"official one (got {t['final_available_max']} / "
      f"{t['provisional_available_max']})")
check(t["final_earned"] == 0.0 and t["provisional_earned"] == 9.0,
      "and out of the official numerator too — never counted as a measured 0")
check(t["final_fa_score"] is None or t["final_fa_score"] == 0.0,
      "the official score is computed from the locked half alone")

print("\n" + ("PASSED: 0 failure(s)" if not FAILS else f"FAILED: {len(FAILS)} failure(s)"))
sys.exit(1 if FAILS else 0)
