"""Implied risk (log basis) of the VN30 index futures.

For each trading day we compute the log basis embedded in the front-month
future relative to the spot index:

    ir = ln(future / spot)

This is the raw (un-annualized) implied-risk signal: negative in the usual VN
discount/backwardation regime (hedging/fear), positive in premium/contango
(greed). Dropping the old /t annualization keeps it well-behaved and defined on
every session — including the contract-expiry day, where t -> 0 previously made
the rate undefined. `r_days` / `t` are still stored as informational context
(days to expiry) but no longer enter the IR computation.

We store the RAW signed `ir`; the dashboard flips the sign (plots -ir) so
"up = more implied risk" while preserving the rare premium days as dips.

Expiry source (two paths, one validates the other):
  - LIVE  — the exchange-reported `last_trading_date` for VN30F1M, read from the
            VCI price_board. Authoritative, no guessing. Used for the current
            front-month contract.
  - RULE  — VN index futures expire on the third Thursday of the contract month
            (HNX), rolling back to the prior trading day on a holiday. Used to
            reconstruct expiries for the historical backfill, validated against
            the spot trading calendar. The rule reproduces the exchange's own
            current date exactly (verified: July 2026 -> 16/07/2026).
"""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta

import pandas as pd

from .common import VNSTOCK_SOURCE

SPOT_SYMBOL = "VN30"
FUTURE_SYMBOL = "VN30F1M"

# VN30 index futures launched 2017-08-10; the future is the binding constraint
# on how far back we can compute IR.
HISTORY_START = date(2017, 8, 10)


# --------------------------------------------------------------------------- #
# Data fetch
# --------------------------------------------------------------------------- #
def fetch_closes(symbol: str, start: date, end: date) -> pd.Series | None:
    """Return a date-indexed (ascending) Series of daily closes, or None.

    Quote() in vnstock 4.0.x throws a "charting library" error on its first
    call due to a lazy banner-init bug; retrying once is the documented
    workaround used across the TA pipeline (see ta/ohlcv.py, ta/benchmark.py).
    """
    from vnstock import Quote

    df = None
    for attempt in range(2):
        try:
            q = Quote(symbol=symbol, source=VNSTOCK_SOURCE)
            df = q.history(start=start.isoformat(), end=end.isoformat(), interval="1D")
            break
        except Exception as e:  # noqa: BLE001 — vnstock raises bare Exceptions
            if "charting library" in str(e).lower() and attempt == 0:
                continue
            print(f"  {symbol} fetch failed: {str(e)[:120]}")
            return None

    if df is None or df.empty:
        return None

    out = pd.Series(df["close"].astype(float).values, name=f"{symbol}_close")
    out.index = pd.to_datetime(df["time"]).dt.date
    out.index.name = "date"
    return out.sort_index()


def live_expiry() -> date | None:
    """Authoritative expiry of the current VN30F1M contract, read from the VCI
    price_board `last_trading_date` field (format DD/MM/YYYY). None on failure.
    """
    from vnstock import Trading

    for attempt in range(2):
        try:
            pb = Trading(source=VNSTOCK_SOURCE).price_board([FUTURE_SYMBOL])
            raw = pb[("listing", "last_trading_date")].iloc[0]
            return datetime.strptime(str(raw), "%d/%m/%Y").date()
        except Exception as e:  # noqa: BLE001
            if "charting library" in str(e).lower() and attempt == 0:
                continue
            print(f"  live expiry lookup failed: {str(e)[:120]}")
            return None
    return None


# --------------------------------------------------------------------------- #
# Expiry rule (third Thursday, holiday-adjusted)
# --------------------------------------------------------------------------- #
def third_thursday(year: int, month: int) -> date:
    """Third Thursday of `year`-`month` (the standard HNX futures expiry)."""
    first = date(year, month, 1)
    # weekday(): Mon=0 .. Thu=3. Days to the first Thursday, then +2 weeks.
    offset = (3 - first.weekday()) % 7
    return first + timedelta(days=offset + 14)


def _holiday_adjust(expiry: date, trading_days: set[date]) -> date:
    """If `expiry` falls on a non-trading day (holiday), roll back to the prior
    trading day. Only adjusts when the date is *within* the known calendar — a
    future expiry can't be validated yet, so it is returned unchanged (the live
    price_board value covers the current contract exactly).
    """
    if not trading_days:
        return expiry
    if expiry > max(trading_days):
        return expiry  # future contract — not verifiable from history
    floor = min(trading_days)
    while expiry not in trading_days and expiry > floor:
        expiry -= timedelta(days=1)
    return expiry


def front_month_expiry(d: date, trading_days: set[date]) -> date:
    """Expiry of the front-month (F1M) contract active on date `d`.

    The front month is the current month's contract until its expiry passes,
    then it rolls to next month.
    """
    e = _holiday_adjust(third_thursday(d.year, d.month), trading_days)
    if d <= e:
        return e
    ny, nm = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    return _holiday_adjust(third_thursday(ny, nm), trading_days)


# --------------------------------------------------------------------------- #
# IR computation
# --------------------------------------------------------------------------- #
def compute_ir(spot: float, future: float) -> float | None:
    """Log basis ln(future / spot) — the (un-annualized) implied-risk signal.

    Negative in the usual VN discount/backwardation regime (fear/hedging),
    positive in premium/contango (greed). Defined on every session including
    the expiry day, since there is no division by time-to-expiry. None only
    when a price is non-positive (outside the log domain).
    """
    if spot <= 0 or future <= 0:
        return None
    return math.log(future / spot)


def build_rows(spot: pd.Series, future: pd.Series, override_expiry: date | None) -> list[dict]:
    """Join spot+future on common dates and build one implied_risk row per day.

    `override_expiry` (the live price_board value) is applied to every date whose
    rule-derived contract matches the current contract month, making the current
    contract's r_days exact.
    """
    common = spot.index.intersection(future.index)
    trading_days = set(spot.index)  # spot calendar = the market trading calendar
    rows: list[dict] = []
    for d in sorted(common):
        s = float(spot.loc[d])
        f = float(future.loc[d])
        expiry = front_month_expiry(d, trading_days)
        if (
            override_expiry is not None
            and expiry.year == override_expiry.year
            and expiry.month == override_expiry.month
        ):
            expiry = override_expiry
        r_days = (expiry - d).days  # informational only (days to expiry)
        ir = compute_ir(s, f)
        rows.append(
            {
                "date": d.isoformat(),
                "spot": round(s, 2),
                "future": round(f, 2),
                "expiry": expiry.isoformat(),
                "r_days": r_days,
                "t": round(r_days / 365.0, 6),
                "ir": None if ir is None else round(ir, 6),
            }
        )
    return rows


def upsert_implied_risk(client, rows: list[dict]) -> int:
    """Upsert implied_risk rows (keyed on date). Returns rows written."""
    if not rows:
        return 0
    for j in range(0, len(rows), 500):
        client.table("implied_risk").upsert(rows[j:j + 500], on_conflict="date").execute()
    return len(rows)
