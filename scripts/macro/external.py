"""External (U.S.) series for the External-Pressure block — SOFR + DXY.

* SOFR — overnight USD secured funding rate, the U.S. leg of the VND–SOFR
  spread. Source: FRED's keyless CSV endpoint (official NY Fed data, published
  T+1 U.S. mornings, history since 2018-04-03):
      https://fred.stlouisfed.org/graph/fredgraph.csv?id=SOFR

* DXY — ICE U.S. Dollar Index (contextual backdrop). Source: Yahoo Finance
  chart API (symbol DX-Y.NYB), keyless, same-day fresh. Unofficial API, so the
  collector is failure-tolerant: a broken day never blocks other metrics and
  self-heals inside the daily 21-day refresh window.

The spread itself (VNIBOR ON − SOFR) is computed at view time on the dashboard
(as-of join), like `% to ceiling` — no derived series is stored.
"""

import csv
import datetime as dt
import io
import subprocess

import requests

from macro.exchange_rate import _UA

METRIC_SOFR = "sofr"
METRIC_DXY = "dxy"

SOFR_HISTORY_START = dt.date(2018, 4, 1)  # series begins 2018-04-03
DXY_HISTORY_START = dt.date(2015, 1, 1)   # match VNIBOR depth for full context

FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=SOFR"
YAHOO_DXY = "https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB"


def fetch_sofr_history(start: dt.date, end: dt.date) -> list[tuple[dt.date, float]]:
    """SOFR (%/year) over [start, end] from FRED's keyless CSV.

    The endpoint always returns the full series (~35 KB) — fetched once and
    sliced. Missing observations appear as '.' and are skipped.

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
            ["curl", "-fsS", "-m", "60", FRED_CSV],
            capture_output=True, text=True,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            text = proc.stdout
            break
        last_err = (proc.stderr or f"exit {proc.returncode}").strip()[:120]
    if text is None:
        raise RuntimeError(f"FRED SOFR: curl failed after retries: {last_err}")
    out: list[tuple[dt.date, float]] = []
    for row in csv.DictReader(io.StringIO(text)):
        raw = (row.get("SOFR") or "").strip()
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
        raise RuntimeError("FRED SOFR: no rows parsed — endpoint or format changed")
    return out


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
