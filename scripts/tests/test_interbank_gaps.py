#!/usr/bin/env python3
"""Pin the interbank COMPLETENESS check (2026-08-19).

Runnable directly (`python3 scripts/tests/test_interbank_gaps.py`) or under
pytest, matching the convention in test_bqs_v8.py.

Why this exists
---------------
`interbank_overnight` is stitched from two feeds with complementary blind spots:

  * the SBV portal is authoritative and freshest, but shows exactly ONE date —
    whatever it currently calls latest;
  * Vietstock NormID 293 carries the history, trailing by 2-3 business days.

So a date reaches us from SBV only if our once-a-day sample lands while the
portal is displaying it. On 2026-08-18 the portal read 14/08; on 2026-08-19 it
read 18/08. Its own lag had shrunk from three business days to one, and
2026-08-17 was shown to nobody — it fell out of the series.

Nothing noticed. Every existing gate counts POINTS, and the run that lost the day
collected a healthy 14 of them; the staleness check was happier still, because
the newest stored date (2026-08-18) was one day old. Freshness and completeness
fail independently, and the FCI forward-fills its inputs, so the hole silently
reused the previous session's rate rather than raising anything.

The four properties that must not regress:

  1. A date missing BEHIND the newest stored point is a gap.
  2. A date missing AHEAD of it is NOT — every feed here is legitimately a
     session or two behind on any given day, and a warning that is always on
     trains people to ignore the report.
  3. Public holidays are not gaps: the calendar comes from the stored VN-Index
     sessions, never from Mon-Fri.
  4. A young gap warns (the fallback feed is still catching up); an old one
     fails the run, because by then it will never heal on its own.
"""

import datetime as dt
import io
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import refresh_macro as rm  # noqa: E402
from ta.run_status import RunStatus  # noqa: E402

# A week of sessions with the Wednesday absent from the calendar entirely — a
# public holiday, i.e. a day on which no rate was ever published by anyone.
SESSIONS = {"2026-08-10", "2026-08-11", "2026-08-13", "2026-08-14",
            "2026-08-17", "2026-08-18"}


def test_a_hole_behind_the_newest_point_is_a_gap():
    """The 2026-08-17 incident, exactly."""
    stored = SESSIONS - {"2026-08-17"}
    assert rm.interior_gaps(stored, SESSIONS) == ["2026-08-17"]


def test_lag_ahead_of_the_newest_point_is_not_a_gap():
    """Both feeds trail the market daily. Counting that as a hole would put a
    permanent warning on a healthy series — which is how a report stops being
    read at all."""
    stored = {"2026-08-10", "2026-08-11", "2026-08-13"}
    assert rm.interior_gaps(stored, SESSIONS) == [], \
        "sessions after the newest stored point are lag, not gaps"


def test_holidays_are_never_gaps():
    """2026-08-12 is absent from the session calendar, so it is absent from the
    rate series too — correctly, and no check may say otherwise."""
    assert "2026-08-12" not in SESSIONS
    assert rm.interior_gaps(set(SESSIONS), SESSIONS) == []


def test_a_complete_series_reports_nothing():
    assert rm.interior_gaps(set(SESSIONS), SESSIONS) == []


def test_empty_either_side_reports_nothing():
    """No data is not evidence of a hole — the staleness checks own that case."""
    assert rm.interior_gaps(set(), SESSIONS) == []
    assert rm.interior_gaps(set(SESSIONS), set()) == []


def _report(gaps, end):
    """Drive report_interbank_gaps with a stubbed lookup; return (code, output)."""
    real = rm.interbank_interior_gaps
    rm.interbank_interior_gaps = lambda _client, _end: gaps
    try:
        st = RunStatus("test run")
        buf = io.StringIO()
        # stderr too: RunStatus echoes each failure there, and a passing test run
        # that prints "FAILED:" three times is a test run nobody trusts.
        with redirect_stdout(buf), redirect_stderr(io.StringIO()):
            rm.report_interbank_gaps(None, end, st)
            code = st.finish()
        return code, buf.getvalue()
    finally:
        rm.interbank_interior_gaps = real


def test_a_young_gap_warns_but_does_not_fail():
    """Vietstock fills a fresh hole within 2-3 business days. Say so; don't go
    red on a run that is about to be right."""
    end = dt.date(2026, 8, 19)
    code, out = _report(["2026-08-17"], end)
    assert code == 0
    assert "::warning::" in out and "::error::" not in out
    assert "2026-08-17" in out, "the report must name the dates, not just count them"


def test_an_old_gap_fails_the_run():
    """Past the grace period both feeds have published well beyond the date, so
    it will never heal by itself — that needs a person, which needs a red run."""
    end = dt.date(2026, 8, 19)
    old = (end - dt.timedelta(days=rm.INTERBANK_GAP_ESCALATE_DAYS + 5)).isoformat()
    code, out = _report([old], end)
    assert code == 1
    assert "::error::" in out


def test_no_gap_is_an_explicit_ok():
    code, out = _report([], dt.date(2026, 8, 19))
    assert code == 0
    assert "::error::" not in out and "::warning::" not in out


def test_grace_boundary_is_inclusive():
    """Exactly at the threshold is still 'catching up'; one day past is not."""
    end = dt.date(2026, 8, 19)
    at = (end - dt.timedelta(days=rm.INTERBANK_GAP_ESCALATE_DAYS)).isoformat()
    past = (end - dt.timedelta(days=rm.INTERBANK_GAP_ESCALATE_DAYS + 1)).isoformat()
    assert _report([at], end)[0] == 0
    assert _report([past], end)[0] == 1


def test_the_oldest_gap_decides_the_verdict():
    """A batch is judged by its worst member, or one stale hole hides behind a
    fresh one and the run stays green forever."""
    end = dt.date(2026, 8, 19)
    old = (end - dt.timedelta(days=rm.INTERBANK_GAP_ESCALATE_DAYS + 5)).isoformat()
    assert _report([old, "2026-08-17"], end)[0] == 1


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
