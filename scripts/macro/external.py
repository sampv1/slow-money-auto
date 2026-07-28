"""External (U.S.) series for the External-Pressure block — SOFR, DXY, Fed target.

* SOFR — overnight USD secured funding rate, the U.S. leg of the VND–SOFR
  spread. Source: FRED's keyless CSV endpoint (official NY Fed data, published
  T+1 U.S. mornings, history since 2018-04-03):
      https://fred.stlouisfed.org/graph/fredgraph.csv?id=SOFR

* DXY — ICE U.S. Dollar Index (contextual backdrop). Source: Yahoo Finance
  chart API (symbol DX-Y.NYB), keyless, same-day fresh. Unofficial API, so the
  collector is failure-tolerant: a broken day never blocks other metrics and
  self-heals inside the daily 21-day refresh window.

* FED TARGET RANGE — the policy rate the FOMC actually *declares* (lower and
  upper limits of the federal funds target range), from the same keyless FRED
  CSV endpoint: series DFEDTARL / DFEDTARU, daily since 2008-12-16.
  Deliberately the TARGET, not the effective rate (EFFR/DFF): the question the
  panel answers is "where has the Fed set policy", and the target is a step
  function that only moves on FOMC decision days, whereas EFFR wobbles daily
  with market conditions. Both limits are stored so the chart can draw the
  range as a band. (FRED also has DFEDTAR, the single pre-2008 target — not
  fetched: the panel never reaches back that far.)

The spread itself (VNIBOR ON − SOFR) is computed at view time on the dashboard
(as-of join), like `% to ceiling` — no derived series is stored.

NOTE: the Fed-target series is CONTEXT ONLY. It must never become an FCI input
— the FCI design is frozen and its holdout already consumed.
"""

import csv
import datetime as dt
import io
import subprocess

import requests

from macro.exchange_rate import _UA

METRIC_SOFR = "sofr"
METRIC_DXY = "dxy"
METRIC_FED_TARGET_LOWER = "fed_target_lower"
METRIC_FED_TARGET_UPPER = "fed_target_upper"

SOFR_HISTORY_START = dt.date(2018, 4, 1)  # series begins 2018-04-03
DXY_HISTORY_START = dt.date(2015, 1, 1)   # match VNIBOR depth for full context
# The target range exists from 2008-12-16, but the External-Pressure panel is
# gated by SOFR (2018-04) and its deepest context series is DXY (2015), so
# there is nothing to show before then — matching DXY keeps macro_series lean.
FED_TARGET_HISTORY_START = dt.date(2015, 1, 1)

FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}"
FRED_SERIES_SOFR = "SOFR"
FRED_SERIES_FED_LOWER = "DFEDTARL"
FRED_SERIES_FED_UPPER = "DFEDTARU"
YAHOO_DXY = "https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB"


def _fred_series(series: str, start: dt.date, end: dt.date) -> list[tuple[dt.date, float]]:
    """One FRED series (%/year) over [start, end] from the keyless CSV endpoint.

    The endpoint always returns the full series — fetched once and sliced.
    Missing observations appear as '.' and are skipped.

    Transport is curl via subprocess with curl's DEFAULT User-Agent, NOT
    requests and NOT a browser UA: FRED sits behind Akamai, which stalls both
    python-requests' TLS fingerprint and any browser-like UA that doesn't come
    from a real browser, while plain `curl` answers in <1 s (verified 2026-07).
    curl exists on the dev box and on GitHub's ubuntu runners.
    """
    text: str | None = None
    last_err = ""
    for _ in range(3):
        proc = subprocess.run(
            ["curl", "-fsS", "-m", "60", FRED_CSV.format(series=series)],
            capture_output=True, text=True,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            text = proc.stdout
            break
        last_err = (proc.stderr or f"exit {proc.returncode}").strip()[:120]
    if text is None:
        raise RuntimeError(f"FRED {series}: curl failed after retries: {last_err}")
    out: list[tuple[dt.date, float]] = []
    for row in csv.DictReader(io.StringIO(text)):
        raw = (row.get(series) or "").strip()
        if raw in ("", "."):
            continue
        try:
            d = dt.date.fromisoformat(row["observation_date"])
            v = float(raw)
        except (KeyError, ValueError):
            continue
        if start <= d <= end:
            out.append((d, v))
    if not out:
        raise RuntimeError(f"FRED {series}: no rows parsed — endpoint or format changed")
    return out


def fetch_sofr_history(start: dt.date, end: dt.date) -> list[tuple[dt.date, float]]:
    """SOFR (%/year) over [start, end] from FRED's keyless CSV."""
    return _fred_series(FRED_SERIES_SOFR, start, end)


def fetch_fed_target_history(
    start: dt.date, end: dt.date
) -> tuple[list[tuple[dt.date, float]], list[tuple[dt.date, float]]]:
    """(lower, upper) limits of the FOMC federal funds target range, %/year.

    Two separate FRED series, fetched independently — they are published as one
    decision, so a mismatch in coverage would be a source problem worth seeing
    rather than silently papering over.
    """
    lower = _fred_series(FRED_SERIES_FED_LOWER, start, end)
    upper = _fred_series(FRED_SERIES_FED_UPPER, start, end)
    return lower, upper


def fetch_dxy_history(start: dt.date, end: dt.date) -> list[tuple[dt.date, float]]:
    """ICE DXY daily closes over [start, end] via Yahoo's chart API.

    Bar timestamps are session starts in exchange time; meta.gmtoffset converts
    them to the exchange-local calendar date.
    """
    p1 = int(dt.datetime.combine(start, dt.time()).timestamp())
    p2 = int(dt.datetime.combine(end + dt.timedelta(days=1), dt.time()).timestamp())
    resp = requests.get(
        YAHOO_DXY,
        params={"period1": p1, "period2": p2, "interval": "1d"},
        headers={"User-Agent": _UA},
        timeout=45,
    )
    resp.raise_for_status()
    result = (resp.json().get("chart", {}).get("result") or [None])[0]
    if not result:
        raise RuntimeError("Yahoo DXY: empty chart result")
    offset = int(result.get("meta", {}).get("gmtoffset", 0))
    ts = result.get("timestamp") or []
    closes = (result.get("indicators", {}).get("quote") or [{}])[0].get("close") or []
    by_date: dict[dt.date, float] = {}
    for t, c in zip(ts, closes):
        if c is None:
            continue
        d = dt.datetime.fromtimestamp(t + offset, dt.timezone.utc).date()
        if start <= d <= end:
            by_date[d] = round(float(c), 3)
    if not by_date:
        raise RuntimeError("Yahoo DXY: no usable closes in range")
    return sorted(by_date.items())
