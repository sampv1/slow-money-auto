#!/usr/bin/env python3
"""The deep OHLCV backfill must not poison the series it is filling.

Three failures this pins, each of which is SILENT rather than an error:

  1. A MALFORMED BAR IS NOT A CHEAP STOCK. The provider returns rows with
     high/low/close = 0 for a listing's untraded first day — A32 carried one at
     2018-10-23, found on the very first symbol of the first run. Stored, it
     draws a candle spiking to the floor, re-scales the whole chart's y-axis,
     and hands every reader a −100% return for that session. It is dropped, and
     the drop is COUNTED, because quietly returning fewer bars than the provider
     sent is how a partial response gets mistaken for a short listing history.

  2. DEPTH MUST NOT DEPEND ON SORT ORDER. Measured on vnstock 4.0.4: the FIRST
     history() call in a process escapes the community tier's 8-year cap (FPT
     returned 4,912 bars to 2006; every later call returned 1,997 from
     2018-08-30). Whichever symbol sorts first would carry twenty years of chart
     and its neighbours eight — and which one that is changes with the
     work-list. `warm_up_provider` burns the uncapped call on a throwaway.

  3. A FAILED FETCH MUST NOT BE RECORDED AS DONE. `--resume` exists because the
     run is ~100 minutes of sequential calls; a symbol that returned nothing is
     either a transient failure or a never-traded line, and recording it turns a
     retryable blip into a symbol nothing will ever revisit.

Runnable directly or under pytest.
"""

import sys
import types
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# A stub `vnstock` installed BEFORE ta.* is imported, so the suite neither needs
# the package nor makes a network call. ta.common's hosting-service patch reads
# vnstock.core.utils.env inside a try/except and simply no-ops here.
_calls: list[dict] = []


class _FakeQuote:
    frame = None  # set per test

    def __init__(self, symbol, source=None):
        self.symbol = symbol

    def history(self, start=None, end=None, interval=None):
        _calls.append({"symbol": self.symbol, "start": start, "end": end})
        return _FakeQuote.frame


sys.modules.setdefault("vnstock", types.ModuleType("vnstock")).Quote = _FakeQuote

import pandas as pd  # noqa: E402

import backfill_ta_ohlcv as bf  # noqa: E402
from ta import ohlcv  # noqa: E402

FAILURES: list[str] = []


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


def frame(rows):
    """A vnstock-shaped history frame: time + OHLCV, prices in thousands."""
    return pd.DataFrame(rows, columns=["time", "open", "high", "low", "close", "volume"])


def main():
    print("Deep OHLCV backfill")

    # --- 1. the malformed-bar filter ----------------------------------
    check(ohlcv._valid_bar(10.0, 11.0, 9.5, 10.5), "a normal bar is valid")
    check(ohlcv._valid_bar(10.0, 10.0, 10.0, 10.0),
          "a flat bar (open=high=low=close) is valid — a limit-locked session")
    # The exact A32 2018-10-23 row: an open, then zeros.
    check(not ohlcv._valid_bar(11.55, 0.0, 0.0, 0.0),
          "the real A32 hole (high/low/close = 0) is rejected")
    check(not ohlcv._valid_bar(10.0, 11.0, 9.0, 0.0), "a zero CLOSE alone is rejected")
    check(not ohlcv._valid_bar(-1.0, 11.0, 9.0, 10.0), "a negative price is rejected")
    check(not ohlcv._valid_bar(10.0, 9.0, 11.0, 10.0), "high < low is rejected")

    # ...and that fetch_ohlcv actually applies it, keeping the good rows.
    _FakeQuote.frame = frame([
        ("2018-10-23", 11.55, 0.0, 0.0, 0.0, 0),        # the hole
        ("2018-10-24", 11.55, 11.55, 11.55, 11.55, 0),  # untraded but well-formed
        ("2018-10-25", 11.55, 12.0, 11.0, 11.80, 1000),
    ])
    rows = ohlcv.fetch_ohlcv("A32", date(2000, 1, 1), date(2026, 9, 2))
    check(len(rows) == 2, f"the malformed bar is dropped, the rest kept (got {len(rows)})")
    check([r["date"] for r in rows] == ["2018-10-24", "2018-10-25"],
          "the dropped bar is the zero row, not a neighbour")
    check(rows[0]["close"] == 11550.0,
          f"prices are scaled to raw VND (got {rows[0]['close']})")
    check(all(r["high"] >= r["low"] > 0 for r in rows), "every surviving bar is drawable")

    # A frame that is ENTIRELY malformed yields [], never None: "the provider
    # answered with nothing usable" is a different thing from "no data in
    # range", and only the latter should read as an absent listing.
    _FakeQuote.frame = frame([("2018-10-23", 1.0, 0.0, 0.0, 0.0, 0)])
    check(ohlcv.fetch_ohlcv("X", date(2000, 1, 1), date(2026, 9, 2)) == [],
          "an all-malformed frame returns [], not None")

    # --- 2. the full-history window -----------------------------------
    check(ohlcv.FULL_HISTORY_START == date(2000, 1, 1),
          "FULL_HISTORY_START asks for everything; the provider imposes its own cap")

    _FakeQuote.frame = frame([("2026-09-01", 10.0, 10.0, 10.0, 10.0, 5)])
    _calls.clear()

    class _Client:  # upsert_ohlcv's only requirement
        def table(self, _):
            return self

        def upsert(self, rows, on_conflict=None):
            self._rows = rows
            return self

        def execute(self):
            return types.SimpleNamespace(data=self._rows)

    ohlcv.backfill_symbol(_Client(), "FPT", days=90, start=ohlcv.FULL_HISTORY_START)
    check(_calls[-1]["start"] == "2000-01-01",
          f"an explicit start OVERRIDES --days (asked for {_calls[-1]['start']})")
    _calls.clear()
    ohlcv.backfill_symbol(_Client(), "FPT", days=90)
    check(_calls[-1]["start"] != "2000-01-01",
          "without a start, the --days window still applies (gap-fill unchanged)")

    check(callable(ohlcv.warm_up_provider),
          "warm_up_provider exists — depth must not depend on work-list order")

    # --- 3. the resume file -------------------------------------------
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        state = Path(d) / "done"
        check(bf.load_done(state) == set(), "a missing state file resumes from empty")
        check(bf.record_completion(state, "FPT", 1997) is True, "a symbol with bars is recorded")
        check(bf.record_completion(state, "DEAD", 0) is False,
              "a symbol that returned NOTHING is not recorded — it must be retried")
        check(bf.load_done(state) == {"FPT"},
              f"only the successful symbol is skipped next run (got {bf.load_done(state)})")
        bf.record_completion(state, "HPG", 1997)
        check(bf.load_done(state) == {"FPT", "HPG"}, "the file accumulates across symbols")

    print(f"\n{'FAILED' if FAILURES else 'PASSED'}: {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


def test_ohlcv_backfill():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
