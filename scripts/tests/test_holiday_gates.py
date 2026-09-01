#!/usr/bin/env python3
"""Two gates measured the calendar where they should have measured the market.

Vietnam closes the exchange for several days at a time — Tet runs 8-10 calendar
days, and National Day 2026 closed 08-31..09-02. Anything that counts weekdays,
or days-since, treats those closures as if the market had traded and failed.

  * refresh_macro's FCI freshness gate allowed 4 CALENDAR days. Measured over
    1,911 sessions since 2019: 22 closures exceed that, ~2.9/year, and Tet
    produced three consecutive red runs every year. Nothing was wrong with the
    data on any of them.
  * update_prices' holding-period counter counted Mon-Fri with no holiday
    calendar, so each holiday aged a position by one session. That feeds
    check_expiry, which runs even when there is no fresh bar, so a position
    could be EXPIRED and stamped closed_at on a day the market never opened.

Runnable directly or under pytest.
"""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import update_prices  # noqa: E402
from update_prices import count_sessions_held  # noqa: E402

FAILURES: list[str] = []


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


# The real calendar around Vietnam's 2026 National Day closure: the market
# traded Mon 24th .. Fri 28th, was shut Mon 31st, Tue 1st and Wed 2nd, and
# reopened Thu 3rd.
CAL = ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28",
       "2026-09-03", "2026-09-04"]


def _at(iso):
    """Pin today_vn() for a deterministic count."""
    update_prices.today_vn = lambda: date.fromisoformat(iso)


def test_holidays_are_not_sessions():
    _at("2026-09-02")           # the last day of the closure
    got = count_sessions_held("2026-08-26", CAL)
    check(got == 2, f"26th -> 2nd is 2 sessions (27th, 28th), got {got}")

    # The old rule, stated explicitly so it cannot creep back.
    weekdays = sum(1 for d in ("2026-08-27", "2026-08-28", "2026-08-31",
                               "2026-09-01", "2026-09-02")
                   if date.fromisoformat(d).weekday() < 5)
    check(weekdays == 5, "Mon-Fri counting would have said 5")
    check(got < weekdays, f"the closure costs {weekdays - got} phantom sessions")


def test_the_reopen_counts():
    _at("2026-09-03")
    got = count_sessions_held("2026-08-28", CAL)
    check(got == 1, f"the 3rd is a real session and counts, got {got}")


def test_same_day_is_zero():
    _at("2026-08-28")
    check(count_sessions_held("2026-08-28", CAL) == 0,
          "a position opened today has held zero sessions")


def test_expiry_no_longer_fires_during_a_closure():
    """The consequence that made this worth fixing."""
    _at("2026-09-02")
    rec = {"status": "OPEN", "holding_period_sessions": 3}   # threshold = 4
    old_days = 5      # what Mon-Fri counting produced
    new_days = count_sessions_held("2026-08-26", CAL)
    check(update_prices.check_expiry(rec, old_days) is not None,
          "under the old count this position EXPIRED mid-closure")
    check(update_prices.check_expiry(rec, new_days) is None,
          "counting real sessions, it stays open")


def test_falls_back_rather_than_refusing_to_age():
    """A calendar read can fail. Over-counting is what the old code always did;
    not ageing a position at all would be worse."""
    _at("2026-09-02")
    got = count_sessions_held("2026-08-26", None)
    check(got == 5, f"no calendar -> Mon-Fri fallback, got {got}")
    check(count_sessions_held("2026-08-26", []) == 5, "an empty calendar falls back too")


def test_fci_gate_counts_sessions_not_days():
    import refresh_macro
    from refresh_macro import FCI_MAX_SESSIONS_BEHIND, fci_sessions_behind
    check(FCI_MAX_SESSIONS_BEHIND == 1,
          f"threshold is in SESSIONS, got {FCI_MAX_SESSIONS_BEHIND}")
    check(not hasattr(refresh_macro, "FCI_MAX_LAG_DAYS"),
          "the calendar-day constant is gone, not left beside its replacement")

    # CALL it, do not merely read the constant. The first cut of this function
    # used safe_execute without importing it at module scope; every assertion
    # about the constant still passed, and it raised NameError the moment a run
    # reached the gate.
    class _Res:
        def __init__(self, n): self.count = n
    class _Q:
        def __init__(self, n): self.n = n
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def gt(self, *a, **k): return self
        def limit(self, *a, **k): return self
        def execute(self): return _Res(self.n)
    class _C:
        def __init__(self, n): self.n = n
        def table(self, _): return _Q(self.n)
    check(fci_sessions_behind(_C(0), "2026-08-28") == 0,
          "a closed market leaves the FCI 0 sessions behind")
    check(fci_sessions_behind(_C(3), "2026-08-14") == 3,
          "a stuck FCI is counted in sessions that actually exist")


def main():
    for fn in [
        test_holidays_are_not_sessions,
        test_the_reopen_counts,
        test_same_day_is_zero,
        test_expiry_no_longer_fires_during_a_closure,
        test_falls_back_rather_than_refusing_to_age,
        test_fci_gate_counts_sessions_not_days,
    ]:
        print(f"\n{fn.__name__}:")
        fn()
    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILURE(S)")
        return 1
    print("All holiday-gate checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
