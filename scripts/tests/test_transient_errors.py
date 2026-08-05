#!/usr/bin/env python3
"""Pin is_transient_error / safe_execute against real exception objects.

Regression guard for the 2026-08-05 TA daily failure. The classifier used to
match markers against str(exc) only, so entries that were exception TYPE names
could never match: httpx.WriteError's message is "EOF occurred in violation of
protocol (_ssl.c:2427)" and httpx.ConnectError's is "[Errno 111] Connection
refused" — neither contains its own type name. Seven of eight network faults
were therefore never retried, and a one-off SSL blip during upsert_signals
killed the whole nightly run.

Only the h2 case worked, because httpx embeds "<ConnectionTerminated ...>" in
the message text — which is exactly why the gap went unnoticed: the one error
anyone had actually seen was the one that matched.

Run directly (python3 scripts/tests/test_transient_errors.py) or via pytest.
"""

import ssl
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpcore
import httpx

from ta.common import is_transient_error, safe_execute

# (label, exception) — network/gateway blips that MUST be retried.
TRANSIENT = [
    ("httpx.WriteError (the 2026-08-05 failure)",
     httpx.WriteError("EOF occurred in violation of protocol (_ssl.c:2427)")),
    ("httpx.ReadError", httpx.ReadError("")),
    ("httpx.ConnectError", httpx.ConnectError("[Errno 111] Connection refused")),
    ("httpx.ConnectTimeout", httpx.ConnectTimeout("")),
    ("httpx.ReadTimeout", httpx.ReadTimeout("")),
    ("httpx.WriteTimeout", httpx.WriteTimeout("")),
    ("httpx.PoolTimeout", httpx.PoolTimeout("")),
    ("httpx.RemoteProtocolError",
     httpx.RemoteProtocolError("Server disconnected without sending a response.")),
    ("httpcore.WriteError", httpcore.WriteError("EOF occurred in violation of protocol")),
    ("httpcore.ReadTimeout", httpcore.ReadTimeout("")),
    ("h2 stream exhaustion",
     httpx.RemoteProtocolError("<ConnectionTerminated error_code:0, last_stream_id:1000>")),
    ("ssl.SSLEOFError", ssl.SSLEOFError("EOF occurred in violation of protocol")),
    ("ConnectionResetError", ConnectionResetError(104, "Connection reset by peer")),
    ("BrokenPipeError", BrokenPipeError(32, "Broken pipe")),
    ("Cloudflare blip via PostgREST", Exception("JSON could not be generated")),
    ("Supabase control-plane blip", Exception("Failed to get project config")),
]

# Real errors that MUST propagate — retrying these hides a genuine bug.
PERMANENT = [
    ("httpx.LocalProtocolError (client bug)", httpx.LocalProtocolError("bad header")),
    ("ValueError", ValueError("invalid literal for int()")),
    ("KeyError", KeyError("symbol")),
    ("FileNotFoundError", FileNotFoundError(2, "No such file")),
    ("TypeError", TypeError("unsupported operand")),
]


def _wrapped_chain() -> BaseException:
    """postgrest/httpx wrap the real cause, so the chain must be walked."""
    try:
        try:
            raise httpx.WriteError("EOF occurred in violation of protocol")
        except Exception as inner:
            raise RuntimeError("upsert failed") from inner
    except Exception as e:
        return e


def test_transient_errors_are_retried():
    for label, exc in TRANSIENT:
        assert is_transient_error(exc), f"{label} should be transient"


def test_permanent_errors_are_not_retried():
    for label, exc in PERMANENT:
        assert not is_transient_error(exc), f"{label} must NOT be treated as transient"


def test_wrapped_cause_is_detected():
    assert is_transient_error(_wrapped_chain()), "must walk __cause__/__context__"


class _Builder:
    """Minimal postgrest-like builder: fails `fail_times`, then succeeds."""

    def __init__(self, exc, fail_times):
        self.exc, self.fail_times, self.calls = exc, fail_times, 0

    def execute(self):
        self.calls += 1
        if self.calls <= self.fail_times:
            raise self.exc
        return "ok"


def test_safe_execute_retries_then_succeeds():
    b = _Builder(httpx.WriteError("EOF occurred in violation of protocol"), fail_times=2)
    assert safe_execute(b, label="t", max_retries=4, base_delay=0) == "ok"
    assert b.calls == 3, b.calls


def test_safe_execute_reraises_permanent_immediately():
    b = _Builder(ValueError("bad data"), fail_times=99)
    try:
        safe_execute(b, label="t", max_retries=4, base_delay=0)
        raise AssertionError("should have raised")
    except ValueError:
        pass
    assert b.calls == 1, f"permanent error must not retry (got {b.calls} calls)"


def test_safe_execute_gives_up_after_max_retries():
    b = _Builder(httpx.WriteError("EOF"), fail_times=99)
    try:
        safe_execute(b, label="t", max_retries=3, base_delay=0)
        raise AssertionError("should have raised")
    except httpx.WriteError:
        pass
    assert b.calls == 3, b.calls


if __name__ == "__main__":
    failures = 0
    for label, exc in TRANSIENT:
        ok = is_transient_error(exc)
        failures += not ok
        print(f"  {'ok  RETRY' if ok else 'FAIL     '}  {label}")
    print()
    for label, exc in PERMANENT:
        ok = not is_transient_error(exc)
        failures += not ok
        print(f"  {'ok  RAISE' if ok else 'FAIL     '}  {label}")
    print()
    for fn in (test_wrapped_cause_is_detected,
               test_safe_execute_retries_then_succeeds,
               test_safe_execute_reraises_permanent_immediately,
               test_safe_execute_gives_up_after_max_retries):
        try:
            fn()
            print(f"  ok  {fn.__name__}")
        except AssertionError as e:
            failures += 1
            print(f"  FAIL {fn.__name__}: {e}")
    print(f"\n{'ALL PASS' if not failures else f'{failures} FAILURE(S)'}")
    sys.exit(1 if failures else 0)
