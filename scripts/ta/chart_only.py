"""Indices and VN30 futures — charted, never scored.

WHAT THESE ARE AND WHY THEY ARE NOT IN ta_universe
  `ta_universe` is the exchange's STOCK roster (`type='stock'`), owned by
  `sync_universe_to_listing`. An index is not a stock and a futures contract is
  not a stock: neither has an exchange, a float, a fundamental statement or a
  peer group to be percentile-ranked against. Putting them in that table would
  either fight the listing sync every night or quietly enter them into RS,
  Trend, TA Score and both scanners.

  So they live here instead, as a fixed list, and reach the dashboard through
  `getChartSymbols` — the same union that already makes a retired stock
  chartable. This is the "collection is wider than scoring" principle taken one
  step further: the chart needs bars and nothing else, so bars are all these get.

NOTHING COMPUTES SIGNALS FOR THEM, BY CONSTRUCTION rather than by exclusion.
  `compute_ta_signals` and every scoring pass iterate `get_active_symbols()`,
  which reads `ta_universe`. A symbol that is not in that table is unreachable
  from all of them — no filter to remember, no flag to keep in sync. Same for
  `refresh_adjustments` (an index has no corporate actions to repair anyway).

THE PRICE SCALE IS DIFFERENT, AND THIS IS THE ONE THING THAT CAN GO WRONG.
  vnstock returns STOCK prices in thousands of VND, so `fetch_ohlcv` multiplies
  by 1,000: FPT 72.2 -> 72,200 VND. An index is already in POINTS — VNINDEX came
  back as 1827.72 on 2026-09-03, and scaling that would store 1,827,720 as the
  VN-Index. `macro_series.vnindex` stores the true value (1832.12), so scaling
  here would also put two different numbers for the same series in one database.
  `price_scale()` is consulted inside `fetch_ohlcv`, so every caller — daily
  refresh, backfill, any future gap-fill — is correct without knowing about it.

ta_ohlcv.VNINDEX IS NOT THE BENCHMARK SOURCE. `ta/benchmark.py` reads
`macro_series.vnindex` and must keep doing so: that series is the FCI's date
grid and the RS Line's denominator, it is written by `refresh_macro.py`, and it
is close-only. What lives here is OHLC + volume for drawing candles. Same
numbers in the close column, different jobs — do not cross the wires.
"""

from __future__ import annotations

# The four cash indices HOSE/HNX/UPCOM publish, plus the three VN30 futures
# contracts. VN30F1M/2M are the front and second month; VN30F1Q the front
# quarter. Each is a CONTINUOUS series stitched by the provider across rolls,
# which is what makes it chartable at all — an individual expiry would be a
# stub. Verified against vnstock 4.0.4 on 2026-09-03: all seven return ~1,995
# daily bars from 2018-09-05, today's session included.
INDICES = ("VNINDEX", "HNXINDEX", "UPCOMINDEX", "VN30")
FUTURES = ("VN30F1M", "VN30F2M", "VN30F1Q")

CHART_ONLY_SYMBOLS = INDICES + FUTURES

# Index points and futures points are both already in their own unit.
UNSCALED = frozenset(CHART_ONLY_SYMBOLS)

# Stocks: vnstock's thousands-of-VND -> whole VND.
STOCK_PRICE_SCALE = 1000.0


def price_scale(symbol: str) -> float:
    """The multiplier `fetch_ohlcv` applies to this symbol's prices.

    A property of the SYMBOL, not of the call site, which is why it is looked up
    inside the fetch rather than passed in: a caller that forgets would store an
    index at 1,000x silently, and the chart would still draw a plausible-looking
    line at the wrong absolute level.
    """
    return 1.0 if symbol.upper() in UNSCALED else STOCK_PRICE_SCALE


def is_chart_only(symbol: str) -> bool:
    return symbol.upper() in UNSCALED
