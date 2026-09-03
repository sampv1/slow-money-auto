#!/usr/bin/env python3
"""Indices and futures are charted, never scored — and never scaled.

THE SCALE IS THE FAILURE THAT WOULD NOT LOOK LIKE ONE. vnstock returns STOCK
prices in thousands of VND, so `fetch_ohlcv` multiplies by 1,000: FPT 72.2 ->
72,200. An index is already in points. Scaling VNINDEX would store 1,827,720
and the chart would still draw a perfectly plausible line — every candle,
every moving average, the whole shape identical — just at 1,000x the true
level, disagreeing with `macro_series.vnindex` (1832.12) in the same database.
Nothing would throw and nothing would look wrong.

Also pinned: the Python list and its TypeScript mirror must not drift. The
dashboard decides which symbols to suggest AND which to format unscaled from
its own copy, so a symbol added on one side only is either invisible in the
search box or drawn 1,000x off.

Runnable directly or under pytest.
"""

import re
import sys
import types
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

_calls: list[dict] = []


class _FakeQuote:
    frame = None

    def __init__(self, symbol, source=None):
        self.symbol = symbol

    def history(self, start=None, end=None, interval=None):
        _calls.append({"symbol": self.symbol})
        return _FakeQuote.frame


sys.modules.setdefault("vnstock", types.ModuleType("vnstock")).Quote = _FakeQuote

import pandas as pd  # noqa: E402

from ta import chart_only as co  # noqa: E402
from ta import ohlcv  # noqa: E402

FAILURES: list[str] = []


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


def main():
    print("Chart-only symbols (indices + VN30 futures)")

    # --- the seven, and only the seven -------------------------------
    check(co.CHART_ONLY_SYMBOLS == ("VNINDEX", "HNXINDEX", "UPCOMINDEX", "VN30",
                                    "VN30F1M", "VN30F2M", "VN30F1Q"),
          f"the list is the four indices plus three futures (got {co.CHART_ONLY_SYMBOLS})")
    check(len(co.INDICES) == 4 and len(co.FUTURES) == 3, "split 4 indices / 3 futures")

    # Every one must be 2-10 chars of A-Z0-9: that is the shape test the chart
    # API and the scanner's symbol box both apply, so a longer name would be
    # rejected before it ever reached the database. UPCOMINDEX is exactly 10.
    for s in co.CHART_ONLY_SYMBOLS:
        check(re.fullmatch(r"[A-Z0-9]{2,10}", s) is not None,
              f"{s} passes the API's symbol-shape gate ({len(s)} chars)")

    # --- the price scale --------------------------------------------
    for s in co.CHART_ONLY_SYMBOLS:
        check(co.price_scale(s) == 1.0, f"{s} is UNSCALED (points, not thousands of VND)")
    check(co.price_scale("vnindex") == 1.0, "the lookup is case-insensitive")
    for s in ("FPT", "VNM", "AGG", "E1VFVN30"):
        check(co.price_scale(s) == 1000.0, f"{s} still scales x1000 (a stock)")
    check(co.is_chart_only("FPT") is False and co.is_chart_only("VN30") is True,
          "is_chart_only separates the two")

    # --- end to end through fetch_ohlcv -----------------------------
    # The provider's own numbers for 2026-09-03, measured.
    _FakeQuote.frame = pd.DataFrame(
        [{"time": "2026-09-03", "open": 1830.0, "high": 1835.0,
          "low": 1820.0, "close": 1827.72, "volume": 633349761}])
    rows = ohlcv.fetch_ohlcv("VNINDEX", date(2018, 1, 1), date(2026, 9, 3))
    check(len(rows) == 1, "the index bar survives validation")
    check(rows[0]["close"] == 1827.72,
          f"VNINDEX close stored as points, NOT x1000 (got {rows[0]['close']})")
    check(rows[0]["high"] == 1835.0 and rows[0]["low"] == 1820.0,
          "high/low unscaled too, not just close")

    # ...and the stock path is unchanged by the same code.
    _FakeQuote.frame = pd.DataFrame(
        [{"time": "2026-09-03", "open": 72.0, "high": 72.5,
          "low": 71.8, "close": 72.2, "volume": 1000}])
    rows = ohlcv.fetch_ohlcv("FPT", date(2018, 1, 1), date(2026, 9, 3))
    check(rows[0]["close"] == 72200.0,
          f"a stock is still scaled to whole VND (got {rows[0]['close']})")

    # A malformed index bar is dropped by the same validator as a stock's.
    _FakeQuote.frame = pd.DataFrame(
        [{"time": "2026-09-03", "open": 1830.0, "high": 0.0,
          "low": 0.0, "close": 0.0, "volume": 0}])
    check(ohlcv.fetch_ohlcv("VNINDEX", date(2018, 1, 1), date(2026, 9, 3)) == [],
          "a zero-price index bar is dropped, not stored")

    # --- the TypeScript mirror must agree ---------------------------
    ts = (ROOT / "dashboard/src/lib/chart-only-symbols.ts").read_text()

    def ts_list(name):
        m = re.search(rf"export const {name} = \[(.*?)\]", ts, re.S)
        return tuple(re.findall(r'"([A-Z0-9]+)"', m.group(1))) if m else ()

    check(ts_list("CHART_ONLY_INDICES") == co.INDICES,
          f"TS indices match Python (TS {ts_list('CHART_ONLY_INDICES')})")
    check(ts_list("CHART_ONLY_FUTURES") == co.FUTURES,
          f"TS futures match Python (TS {ts_list('CHART_ONLY_FUTURES')})")
    check("isUnscaledSymbol" in ts,
          "the TS mirror exports isUnscaledSymbol, which the chart's formatter asks")

    # The dashboard must union these into the suggestion list; if that import
    # goes, the symbols silently vanish from both search boxes.
    cached = (ROOT / "dashboard/src/lib/cached-data.ts").read_text()
    check("CHART_ONLY_SYMBOLS" in cached,
          "getChartSymbols still unions the chart-only list")
    # And the chart must ask per symbol rather than hard-coding the divisor.
    chart = (ROOT / "dashboard/src/app/analysis/[symbol]/chart-client.tsx").read_text()
    check("isUnscaledSymbol" in chart, "the chart consults isUnscaledSymbol")
    check("priceFormatFor" in chart and "const PRICE_FORMAT =" not in chart,
          "the price format is per-symbol, not a module constant")

    print(f"\n{'FAILED' if FAILURES else 'PASSED'}: {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


def test_chart_only_symbols():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
