#!/usr/bin/env python3
"""The daily OHLCV path must target the market's LATEST SESSION, not `today`.

Regression test for the 2026-08-27/28 data loss. GitHub delayed the 09:23 UTC
cron by ~10 hours, so `update_ta_daily.py` began at 02:52 VN on the FOLLOWING
calendar day. `price_board` correctly returned the previous session; the run
compared each bar's date against `today_vn()`, found none equal, classified the
whole snapshot as a non-trading day, printed "Nothing written, by design" and
exited 0. Because it exited 0, the backup cron's precheck saw a success for the
day and skipped. Two sessions were lost with every gate green.

Runnable directly or under pytest.
"""

import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402

from ta.common import VN_TZ  # noqa: E402
from ta import ohlcv  # noqa: E402
from ta.ohlcv import (  # noqa: E402
    MARKET_CLOSE_VN,
    SESSION_SETTLE,
    fetch_latest_session,
    is_session_final,
)

FAILURES: list[str] = []


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


def vn(y, m, d, hh, mm):
    return datetime(y, m, d, hh, mm, tzinfo=VN_TZ)


# --------------------------------------------------------------------------
def test_delayed_cron_accepts_yesterdays_session():
    """THE INCIDENT. 02:52 VN on 08-28; the market's last session was 08-27."""
    now = vn(2026, 8, 28, 2, 52)
    session = date(2026, 8, 27)

    check(is_session_final(session, now),
          "a completed prior session is final at 02:52 VN the next day")
    # The rule that caused the loss, stated explicitly so it cannot creep back.
    check(session != now.date(),
          "the old `trading_date == today_vn()` rule rejects it — which is the bug")


def test_intraday_bar_is_not_a_close():
    """The guard that MATTERS: a mid-session print must never be stored."""
    today = date(2026, 8, 27)
    check(not is_session_final(today, vn(2026, 8, 27, 11, 0)),
          "today's session at 11:00 VN is still open — refused")
    check(not is_session_final(today, vn(2026, 8, 27, 15, 5)),
          "today's session 5 min after the bell is inside the settle margin — refused")
    close_ok = (datetime.combine(today, MARKET_CLOSE_VN, tzinfo=VN_TZ) + SESSION_SETTLE)
    check(is_session_final(today, close_ok),
          "today's session at close + settle is final — accepted")
    check(is_session_final(today, vn(2026, 8, 27, 16, 23)),
          "today's session at the cron's own 16:23 VN slot is final — accepted")


def test_future_session_is_refused():
    check(not is_session_final(date(2026, 8, 28), vn(2026, 8, 27, 16, 23)),
          "a session dated in the future is refused rather than guessed at")


# --------------------------------------------------------------------------
def _board(records):
    """A price_board-shaped frame: (symbol, trading_date, price) triples."""
    cols = pd.MultiIndex.from_tuples([
        ("listing", "symbol"), ("listing", "trading_date"),
        ("match", "match_price"), ("match", "open_price"),
        ("match", "highest"), ("match", "lowest"), ("match", "accumulated_volume"),
    ])
    rows = [(s, d, p, p, p, p, 1000) for s, d, p in records]
    return pd.DataFrame(rows, columns=cols)


class _Stub:
    def __init__(self, frame, fail=False):
        self.frame, self.fail = frame, fail

    def price_board(self, chunk):
        if self.fail:
            raise RuntimeError("upstream 503")
        return self.frame


def _with_board(stub, fn):
    orig_make, orig_delays = ohlcv._make_trading, ohlcv.RETRY_DELAYS_SECONDS
    ohlcv._make_trading = lambda: stub
    ohlcv.RETRY_DELAYS_SECONDS = ()          # no real sleeping in tests
    try:
        return fn()
    finally:
        ohlcv._make_trading, ohlcv.RETRY_DELAYS_SECONDS = orig_make, orig_delays


def test_session_is_the_max_date_not_today():
    """price_board reports each symbol's OWN last trade, so a snapshot carries
    many dates. The session is the newest of them; the rest are dormant names,
    not stale data."""
    board = _board([
        ("AAA", "2026-08-27", 21.0),
        ("BBB", "2026-08-27", 15.5),
        ("CCC", "2026-08-27", 8.0),
        ("DRM", "2026-05-21", 4.2),     # dormant UPCOM line
        ("DRN", "2025-01-13", 3.1),     # dormant, much older
        ("NIL", "None", 7.0),           # never traded
        ("HLT", "2026-08-27", 0.0),     # halted: no match price
    ])
    rows, stats = _with_board(_Stub(board),
                              lambda: fetch_latest_session(["AAA"] * 7))

    check(stats["session_date"] == date(2026, 8, 27),
          f"session resolved to the newest date, got {stats['session_date']}")
    check(len(rows) == 3, f"only the 3 symbols that traded in it are kept, got {len(rows)}")
    check(stats["skipped_older"] == 2, f"2 dormant symbols skipped, got {stats['skipped_older']}")
    check(stats["skipped_undated"] == 1, f"1 undated skipped, got {stats['skipped_undated']}")
    check(stats["skipped_no_price"] == 1, f"1 unpriced skipped, got {stats['skipped_no_price']}")
    check(stats["failed_chunks"] == 0, "a healthy fetch reports no failed chunks")
    check(all(r["date"] == "2026-08-27" for r in rows), "every kept row carries the session date")


def test_provider_outage_is_distinguishable_from_emptiness():
    """The 2026-08-18 lesson: 'nothing came back' and 'nothing qualified' are
    different failures and must stay tellable apart."""
    rows, stats = _with_board(_Stub(None, fail=True),
                              lambda: fetch_latest_session(["AAA", "BBB"]))
    check(rows == [], "an outage yields no rows")
    check(stats["failed_chunks"] == stats["chunks"] == 1,
          "every chunk is recorded as failed, so the caller can go RED")
    check(stats["session_date"] is None, "no session can be identified from an outage")

    # Contrast: the provider answers, but nothing is datable.
    rows, stats = _with_board(_Stub(_board([("NIL", "None", 7.0)])),
                              lambda: fetch_latest_session(["NIL"]))
    check(stats["failed_chunks"] == 0 and stats["session_date"] is None,
          "an answer carrying no usable date is NOT an outage — failed_chunks stays 0")


def test_holiday_reruns_the_same_session():
    """A weekend run sees the last real session, which the caller then compares
    against what it already holds (stored_bar_count) rather than assuming."""
    board = _board([("AAA", "2026-08-28", 21.0), ("BBB", "2026-08-28", 9.0)])
    rows, stats = _with_board(_Stub(board), lambda: fetch_latest_session(["AAA", "BBB"]))
    saturday = vn(2026, 8, 29, 16, 23)
    check(stats["session_date"] == date(2026, 8, 28) and len(rows) == 2,
          "Saturday's run still resolves Friday's session")
    check(is_session_final(stats["session_date"], saturday),
          "and that session is final — so 'holiday' is decided by the DB, not by the clock")


def main():
    for fn in [
        test_delayed_cron_accepts_yesterdays_session,
        test_intraday_bar_is_not_a_close,
        test_future_session_is_refused,
        test_session_is_the_max_date_not_today,
        test_provider_outage_is_distinguishable_from_emptiness,
        test_holiday_reruns_the_same_session,
    ]:
        print(f"\n{fn.__name__}:")
        fn()
    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILURE(S)")
        return 1
    print("All session-guard checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
