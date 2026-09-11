"""The 60-session price age rule, and the property it exists for: both paths agree.

On 2026-09-09 the daily run and the backfill scored the same session with the
same model and disagreed on six rows. The cause was not arithmetic: the daily
loader took each broker's newest close with no age limit, while the backfill
loaded prices only from its own first session, so ART (last traded 2024-07-25)
was valued in one path and not the other — and C20 being a peer regression, one
extra observation moved five other brokers.

These tests pin the rule (`sec.resolve_price`) and, more importantly, that the
two loaders' views of a price resolve to the SAME answer once the backfill
reaches back past its window by the age limit. The last test reproduces the
original defect so it cannot quietly return.

Run standalone or under pytest. No DB, no network.
"""

import datetime as dt
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fa.securities import (  # noqa: E402
    PRICE_MAX_AGE_SESSIONS,
    PRICE_RULE_ID,
    price_age_sessions,
    price_bar_asof,
    resolve_price,
    sessions_before,
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


def calendar(n=240, start=dt.date(2025, 1, 6)):
    out, d = [], start
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d.isoformat())
        d += dt.timedelta(days=1)
    return out


C = calendar()


def daily_bar(series, as_of):
    """What `latest_price_bars` returns: the newest bar on or before the session."""
    rows = [b for b in series if b[0] <= as_of]
    return rows[-1] if rows else None


def backfill_bar(series, window_start, as_of, lookback=PRICE_MAX_AGE_SESSIONS + 1, with_prior=True):
    """What the backfill sees: bars from `lookback` sessions before its window, opened
    by the last bar before that (`price_history`)."""
    since = sessions_before(C, window_start, lookback) if lookback else window_start
    loaded = [b for b in series if b[0] >= since]
    prior = [b for b in series if b[0] < since][-1:] if with_prior else []
    return price_bar_asof(prior + loaded, as_of)


def test_rule_constants():
    check("limit is 60 sessions", PRICE_MAX_AGE_SESSIONS, 60)
    _, basis = resolve_price((C[0], 10.0), C[0], C)
    check("basis names the rule", basis["rule_id"], PRICE_RULE_ID)


def test_boundary():
    px, b = resolve_price((C[10], 10.0), C[10], C)
    check("same-session price, age 0", (px, b["age_sessions"], b["usable"]), (10.0, 0, True))
    px, b = resolve_price((C[10], 10.0), C[70], C)
    check("age exactly 60 is usable", (px, b["age_sessions"], b["usable"]), (10.0, 60, True))
    px, b = resolve_price((C[10], 10.0), C[71], C)
    check("age 61 is no price", (px, b["age_sessions"], b["reason"]), (None, 61, "STALE_PRICE"))


def test_non_session_dates_and_absence():
    # A Saturday bar counts from the Friday before it.
    friday = dt.date.fromisoformat(C[4])
    saturday = (friday + dt.timedelta(days=1)).isoformat()
    check("weekend bar counts from the prior session",
          price_age_sessions(saturday, C[14], C), 10)
    px, b = resolve_price(None, C[20], C)
    check("no bar is NO_PRICE", (px, b["reason"]), (None, "NO_PRICE"))
    px, b = resolve_price(("2019-01-02", 10.0), C[20], C)
    check("a date before the calendar is not assumed fresh", (px, b["reason"]), (None, "NO_CALENDAR"))


def test_both_paths_agree():
    window_start = C[100]
    as_of = C[150]
    live = [(C[i], 20.0 + i) for i in range(0, 145)]           # last trade 5 sessions ago
    thin = [(C[i], 30.0 + i) for i in (60, 70, 95)]              # last trade 55 sessions ago
    dead = [(C[i], 40.0 + i) for i in range(0, 20)]              # last trade 131 sessions ago
    for name, series, want_usable in (("live", live, True), ("thin", thin, True), ("dead", dead, False)):
        d = resolve_price(daily_bar(series, as_of), as_of, C)
        b = resolve_price(backfill_bar(series, window_start, as_of), as_of, C)
        check(f"{name}: daily and backfill give the same price", d[0], b[0])
        # The explanation must match too: a dead line reads "N sessions old" on
        # both paths, never "no price" on one of them.
        check(f"{name}: daily and backfill give the same basis", d[1], b[1])
        check(f"{name}: usable as expected", d[1]["usable"], want_usable)


def test_the_original_defect_is_reproduced_without_lookback():
    # A broker whose last trade predates the window by less than the age limit:
    # the daily path prices it, and a backfill that loads only from its own first
    # session does not — exactly the ART-shaped divergence, one rule step removed.
    window_start = C[100]
    as_of = C[101]
    series = [(C[i], 50.0) for i in range(0, 90)]                # last trade C[89], 12 sessions old
    daily = resolve_price(daily_bar(series, as_of), as_of, C)[0]
    no_lookback = resolve_price(backfill_bar(series, window_start, as_of, lookback=0, with_prior=False), as_of, C)[0]
    with_lookback = resolve_price(backfill_bar(series, window_start, as_of), as_of, C)[0]
    check("daily prices it", daily, 50.0)
    check("a window-bounded loader does not (the old defect)", no_lookback, None)
    check("the lookback loader agrees with daily", with_lookback, daily)


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            print(name)
            fn()
    print(f"\n{PASSED} passed, {FAILED} failed")
    sys.exit(1 if FAILED else 0)
