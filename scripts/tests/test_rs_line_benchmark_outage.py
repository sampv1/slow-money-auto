#!/usr/bin/env python3
"""Pin the RS-Line fail-closed guard (2026-08-18).

Runnable directly (`python3 scripts/tests/test_rs_line_benchmark_outage.py`) or
under pytest, matching the convention in test_bqs_v8.py.

Why this exists
---------------
On 2026-08-18 vnstock raised `RetryError[UnboundLocalError]` from inside
`fetch_vnindex_closes`, twice, 84 minutes apart. With no VN-Index the RS-Line
build produced nothing — and the write path then sent `rs_line*: None` for all
1,422 rated symbols, overwriting a good snapshot with nulls.

That is not a display bug. TA Score reads `rs_line_score` at a 20% weight and
scores a missing component as **0**, so one flaky external call silently marked
down the TA Score, Final Score and grade of the entire universe.

The rule: **no benchmark is absence of the yardstick, not evidence that 1,400
stocks stopped having relative strength.** So the payload must OMIT the rs_line*
keys entirely (an upsert leaves unnamed columns alone), while still writing a
genuine null for a symbol that has a benchmark but too little data of its own.

Both halves matter. Omitting always would freeze a stale line onto a symbol that
legitimately lost its own; nulling always is the bug above.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

RS_LINE_KEYS = {"rs_line", "rs_line_full", "rs_line_dates",
                "rs_line_date", "rs_line_score", "rs_line_grade"}


def _payload(have_benchmark: bool, rs_lines: dict, rs_scores: dict, symbols):
    """The payload comprehension from rs_rating.compute_rs_ratings, isolated.

    Kept in step with the source by test_payload_shape_matches_source below,
    which greps the real module for the `if have_benchmark else {}` guard.
    """
    return [
        {
            "symbol": sym,
            "rs_3m": 50,
            **(
                {
                    "rs_line": rs_lines[sym][0] if sym in rs_lines else None,
                    "rs_line_full": rs_lines[sym][0] if sym in rs_lines else None,
                    "rs_line_dates": rs_lines[sym][1] if sym in rs_lines else None,
                    "rs_line_date": "2026-08-18" if sym in rs_lines else None,
                    "rs_line_score": rs_scores[sym][0] if sym in rs_scores else None,
                    "rs_line_grade": rs_scores[sym][1] if sym in rs_scores else None,
                }
                if have_benchmark else {}
            ),
        }
        for sym in symbols
    ]


def test_no_benchmark_omits_every_rs_line_key():
    """The regression itself: an outage must write NOTHING to those columns."""
    rows = _payload(False, {}, {}, ["AAA", "BBB", "CCC"])
    for r in rows:
        assert RS_LINE_KEYS.isdisjoint(r), f"{r['symbol']} would overwrite RS Line: {r}"
        assert r["rs_3m"] == 50, "the rest of the RS snapshot must still be written"


def test_benchmark_present_writes_real_nulls_for_symbols_without_a_line():
    """The other half: a symbol that genuinely has no line still gets nulled,
    so a stale line cannot outlive the data that produced it."""
    rows = _payload(True, {"AAA": ([1.0, 1.1], ["d1", "d2"])}, {"AAA": (80, "B")},
                    ["AAA", "BBB"])
    aaa, bbb = rows[0], rows[1]
    assert aaa["rs_line_score"] == 80 and aaa["rs_line_grade"] == "B"
    assert aaa["rs_line_full"] == [1.0, 1.1]
    assert RS_LINE_KEYS.issubset(bbb), "keys must be present in order to null them"
    assert all(bbb[k] is None for k in RS_LINE_KEYS)


def test_ta_score_scores_a_missing_rs_line_as_zero():
    """Why the guard has to live in the WRITE path rather than be patched later:
    once the column is null, TA Score quietly treats it as a real 0."""
    from ta.ta_score import TA_SCORE_DEFAULTS, _resolve_weights

    w = _resolve_weights(TA_SCORE_DEFAULTS["weights"])
    comps = {"rs_3m": 90, "rs_composite": 90, "rs_line": 90, "trend": 90}
    full = sum(w[k] * (comps[k] or 0) for k in w)

    comps["rs_line"] = None
    wiped = sum(w[k] * (comps[k] or 0) for k in w)

    assert full == 90
    assert wiped == 72, "a null RS Line costs 20% of TA Score outright, not a reweight"


def test_payload_shape_matches_source():
    """Guard against the isolated copy above drifting from the real module."""
    src = (Path(__file__).resolve().parents[1] / "ta" / "rs_rating.py").read_text()
    assert "if have_benchmark else {}" in src, \
        "rs_rating.py no longer omits the rs_line* keys on a benchmark outage"
    assert "have_benchmark = bool(vnindex)" in src


def test_get_vnindex_closes_falls_back_before_giving_up():
    """The outage should not happen at all: macro_series carries the series."""
    import ta.benchmark as bm

    calls = []
    orig_fetch, orig_db = bm.fetch_vnindex_closes, bm.load_vnindex_from_db
    try:
        bm.fetch_vnindex_closes = lambda *a, **k: (calls.append("live"), None)[1]
        bm.load_vnindex_from_db = lambda *a, **k: (calls.append("db"), _fake_series())[1]
        out = bm.get_vnindex_closes(client=object())
        assert calls == ["live", "db"], calls
        assert out is not None and len(out) == 3
    finally:
        bm.fetch_vnindex_closes, bm.load_vnindex_from_db = orig_fetch, orig_db


def test_get_vnindex_closes_returns_none_when_both_sources_fail():
    """None must still be reachable — that is the signal callers fail closed on."""
    import ta.benchmark as bm

    orig_fetch, orig_db = bm.fetch_vnindex_closes, bm.load_vnindex_from_db
    try:
        bm.fetch_vnindex_closes = lambda *a, **k: None
        bm.load_vnindex_from_db = lambda *a, **k: None
        assert bm.get_vnindex_closes(client=object()) is None
    finally:
        bm.fetch_vnindex_closes, bm.load_vnindex_from_db = orig_fetch, orig_db


def _fake_series():
    import pandas as pd
    from datetime import date
    s = pd.Series([1000.0, 1010.0, 1005.0])
    s.index = [date(2026, 8, 14), date(2026, 8, 17), date(2026, 8, 18)]
    return s


if __name__ == "__main__":
    fails = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  ok   {name}")
            except AssertionError as e:
                fails += 1
                print(f"  FAIL {name}: {e}")
    print("PASS" if not fails else f"{fails} FAILED")
    sys.exit(1 if fails else 0)
