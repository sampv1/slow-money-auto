#!/usr/bin/env python3
"""Pin the silent-success guard (2026-08-19).

Runnable directly (`python3 scripts/tests/test_run_status.py`) or under pytest,
matching the convention in test_bqs_v8.py.

Why this exists
---------------
Three GitHub Actions runs reported SUCCESS while collecting no data:

  * 2026-08-18 ta-daily   — every vnstock call raised; zero bars written.
  * 2026-08-18 macro-daily — `0 vnindex` upserted, freezing the FCI at 08-14.
  * 2026-08-17 ta-daily   — 29 bars of ~900.

All three were steps that completed WITHOUT RAISING and produced nothing. That
is why `require()` exists and why try/except alone is not enough: the exit code
has to depend on the data, not on whether an exception escaped.

The four properties that must not regress:

  1. A critical shortfall exits non-zero.
  2. A best-effort shortfall exits ZERO but is still annotated — tolerated is
     not the same as hidden.
  3. A swallowed exception still fails the run (the steps keep running; the run
     goes red).
  4. KeyboardInterrupt / SystemExit are never swallowed.
"""

import io
import sys
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ta.run_status import RunStatus  # noqa: E402


def _run(fn):
    """Run fn(status) capturing stdout; return (exit_code, printed)."""
    st = RunStatus("test run")
    buf = io.StringIO()
    with redirect_stdout(buf):
        fn(st)
        code = st.finish()
    return code, buf.getvalue()


def test_all_good_exits_zero():
    code, out = _run(lambda st: st.require("step", 1200, minimum=1))
    assert code == 0
    assert "::error::" not in out


def test_critical_shortfall_exits_nonzero():
    """The 2026-08-18 ta-daily case: zero rows, no exception."""
    code, out = _run(lambda st: st.require("Step 1 OHLCV", 0, minimum=1, unit="bars"))
    assert code == 1, "a step that collected nothing must fail the run"
    assert "::error::" in out
    assert "collected 0 bars" in out


def test_partial_collection_below_minimum_fails():
    """The 2026-08-17 case: 29 bars of ~900 is a failure, not a success."""
    code, _ = _run(lambda st: st.require("Step 1 OHLCV", 29, minimum=500, unit="bars"))
    assert code == 1


def test_best_effort_shortfall_warns_but_passes():
    code, out = _run(lambda st: st.expect("catalysts", 0, minimum=1))
    assert code == 0, "best-effort steps must not fail the run"
    assert "::warning::" in out, "but they must still be annotated, not silent"
    assert "::error::" not in out


def test_swallowed_exception_still_fails_the_run():
    def body(st):
        with st.step("Step 3 RS"):
            raise RuntimeError("postgrest exploded")
        # execution must continue past the failed step
        st.ok("Step 4 trend")
    code, out = _run(body)
    assert code == 1
    assert "::error::" in out
    assert "Step 4 trend" in out, "later steps must still run after a failure"


def test_non_critical_step_swallows_into_a_warning():
    def body(st):
        with st.step("Step 7 profiles", critical=False):
            raise RuntimeError("vietcap down")
    code, out = _run(body)
    assert code == 0
    assert "::warning::" in out


def test_keyboard_interrupt_is_never_swallowed():
    st = RunStatus("test run")
    try:
        with st.step("Step 1"):
            raise KeyboardInterrupt
    except KeyboardInterrupt:
        return
    raise AssertionError("KeyboardInterrupt must propagate, not be recorded as a step failure")


def test_system_exit_is_never_swallowed():
    st = RunStatus("test run")
    try:
        with st.step("Step 1"):
            sys.exit(3)
    except SystemExit as e:
        assert e.code == 3
        return
    raise AssertionError("SystemExit must propagate")


def test_annotation_is_single_line():
    """GitHub truncates a workflow command at the first newline."""
    code, out = _run(lambda st: st.fail("step", "line one\nline two\nline three"))
    assert code == 1
    errs = [ln for ln in out.splitlines() if ln.startswith("::error::")]
    assert len(errs) == 1
    assert "line one line two line three" in errs[0]


def test_failures_are_listed_in_the_verdict():
    def body(st):
        st.require("a", 0)
        st.require("b", 5)
        st.expect("c", 0)
    code, out = _run(body)
    assert code == 1
    assert "1 ok, 1 warning(s), 1 failure(s)" in out


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
