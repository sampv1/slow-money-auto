"""Quarterly financials from the FREE vnstock package, shaped for `fa_quarterly`.

WHY THE FREE PACKAGE, NOT vnstock_data
  `fa/vnstock_source.py` (the display-only statement loader) uses the sponsor
  package. This one deliberately does not. The sponsor wheel is delivered as a
  file, is `License: Proprietary`, and this repo is PUBLIC — so it cannot be
  vendored, and it is not on PyPI, so CI cannot install it. Free `vnstock` IS
  pinned in requirements.txt, and its documented limit is prices only:

      ⚠️ Community edition: OHLCV data (1D) limited to 8 years.

  Measured 2026-09-02, free vs sponsor on the same symbol and quarter: 20 of 20
  field-symbol pairs byte-identical, over the same 34 quarterly periods back to
  2018-Q1. Statements are not what the free tier restricts. That is the whole
  reason FA can be automated in GitHub Actions when the TA deep backfill cannot.

WHAT FREE DOES NOT GIVE
  The `ratio` table: 4 quarterly periods instead of 34, and the annual one comes
  back malformed (16 columns all labelled '2018'). Everything it would have
  supplied is derived here instead — see `derive_rows`.

See FA_AUTO_IMPORT_DESIGN.md for the measured fidelity of every mapping below.
"""

from __future__ import annotations

import math
import time
from typing import Any

# Exact `item_en` labels in the free package's statement frames. Matching is on
# the FIRST occurrence: the balance sheet repeats some labels ("Preferred
# shares", "Bonus and welfare funds"), and the first is the one in the main
# statement body rather than a sub-schedule.
INCOME = {
    "revenue": "Net sales",
    "gross_profit": "Gross Profit",
    "npat": "Net profit/(loss) after tax",
    "parent_profit": "Attributable to parent company",
}
BALANCE = {
    "st_debt": "Short-term borrowings",
    "lt_debt": "Long-term borrowings",
    "total_equity": "Owner's Equity",
    "paid_in_capital": "Paid-in capital",
}

# VN par value. `Paid-in capital / PAR` was verified to equal the sponsor field
# BS_CHARTER_CAPITAL-derived share count exactly.
PAR_VALUE = 10_000.0

FIELDS = ("eps", "revenue", "gross_margin", "net_margin",
          "roe_ttm", "st_debt", "lt_debt", "total_equity")


def _num(v) -> float | None:
    """Coerce a cell to float, treating NaN and blanks as absent."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def _series(df, label: str) -> dict[str, float]:
    """{period: value} for one line item, by exact `item_en` match.

    Returns {} when the label is absent — a statement a company does not file is
    not an error, and must not be confused with a failed fetch (that distinction
    is `fetch_frames`' job, not this one's).
    """
    if df is None or "item_en" not in getattr(df, "columns", []):
        return {}
    hit = df[df["item_en"].astype(str).str.strip() == label]
    if hit.empty:
        return {}
    row = hit.iloc[0]                       # first occurrence — see BALANCE note
    out: dict[str, float] = {}
    for col in df.columns:
        c = str(col)
        if len(c) >= 6 and c[:4].isdigit() and "-Q" in c:
            v = _num(row[col])
            if v is not None:
                out[c] = v
    return out


def _shift(period: str, back: int) -> str:
    """`period` moved `back` quarters into the past ('2026-Q2', 1 -> '2026-Q1')."""
    y, q = period.split("-Q")
    idx = int(y) * 4 + (int(q) - 1) - back
    return f"{idx // 4}-Q{idx % 4 + 1}"


def _div(a, b):
    return (a / b) if (a is not None and b not in (None, 0)) else None


# Every label the 9-criterion rubric needs. A statement that is missing any of
# them is not a sparse filing — it is a DIFFERENT FORMAT, and deriving from it
# yields nulls that the scorer reads as lost points rather than absent data.
REQUIRED = tuple(INCOME.values()) + tuple(BALANCE.values())


def missing_labels(income, balance) -> list[str]:
    """Which required line items this filer does not use.

    BANKS AND SECURITIES FIRMS FILE A DIFFERENT CHART OF ACCOUNTS, and the
    result is silent rather than loud. Measured at 2026-Q2:

        VCB (bank)        6 of 8 labels absent -> every field None
        SSI (securities)  'Gross Profit' and 'Net profit/(loss) after tax'
                          absent -> revenue and EPS derive fine, both MARGINS
                          come out None
        FPT (industrial)  none absent

    The bank case is self-limiting: with no revenue and no EPS the importer
    already refuses the row. The securities case is the dangerous one — a row
    that looks complete enough to write, whose C5/C6 then score as missing. In
    the 70-symbol verification that is what moved SSI A->B and VCI B->C.

    CLAUDE.md records the same split for the vnstock chart set ("banks and
    securities firms file different formats, so the named line items are
    absent"), where the residual is 98% of TCB's assets. Same cause here.

    Callers must treat a non-empty result as "this filer needs its own mapping",
    never as "these values are zero".
    """
    have = set()
    for df in (income, balance):
        if df is not None and "item_en" in getattr(df, "columns", []):
            have |= set(df["item_en"].astype(str).str.strip())
    return [lbl for lbl in REQUIRED if lbl not in have]


def statement_status(income, balance) -> tuple[str, list[str]]:
    """('ok' | 'no_data' | 'unsupported_format', missing labels).

    THREE OUTCOMES, NOT TWO, and conflating the first two is the mistake this
    exists to prevent. Measured on the live work-list: A32, ACE, ACS, AG1 and
    AGX all return an income frame of shape (0, 0) — no columns, no rows. That
    is the provider having nothing for the symbol, which is a completely
    different thing from VCB filing a bank's chart of accounts. Reporting both
    as "unsupported format" would hide a coverage gap inside a mapping problem.

      no_data              an EMPTY frame. The provider returned successfully
                           and gave us nothing. Note this is NOT retried by
                           `fetch_frames`, which only retries on an exception —
                           so a silently-empty response and a genuine absence
                           are still indistinguishable here, and the count must
                           stay visible rather than being folded into a total.
      unsupported_format   a POPULATED frame missing required labels, i.e. a
                           filer using a different chart of accounts.
      ok                   every required label present.
    """
    empty = [df is None or getattr(df, "empty", True) or
             "item_en" not in getattr(df, "columns", [])
             for df in (income, balance)]
    if all(empty):
        return "no_data", []
    missing = missing_labels(income, balance)
    return ("unsupported_format", missing) if missing else ("ok", [])


def derive_rows(symbol: str, income, balance) -> dict[str, dict[str, Any]]:
    """{period: fa_quarterly-shaped dict} derived from two statement frames.

    Pure: no network, no clock, no database — so it is testable against fixtures.

    THREE MAPPINGS THAT ARE NOT THE OBVIOUS ONE, each found by measuring against
    FiinProX over 571 (symbol, quarter) pairs:

      * MARGINS come from raw line items, never the ratio table. RT_PRT_GROSS_
        MARGIN matches FiinProX on 4% of quarters and RT_PRT_NET_MARGIN on 1% —
        they are on a TTM basis, not single-quarter. Derived here: 98% / 97%.
      * NET MARGIN divides TOTAL net profit, not parent-attributable. Using
        parent scores 59%. Silently wrong, never an error.
      * EPS is DERIVED, not read. The filed `EPS basic (VND)` matches 43% and is
        0 in 130 of 525 quarters where FiinProX has a value. parent_profit over
        (paid-in capital / par) reaches 82% within 1%, 88% within 5%.

    ROE is TTM by definition (`fa_quarterly.roe_ttm`), so it needs four quarters
    of profit and an average equity — it cannot be computed from one period, and
    is None for the earliest three periods of any series rather than guessed.

    ROE IS THE WEAKEST MAPPING AND THIS IS ITS MEASURED ERROR. Free's ratio
    table stops at 2018-Q4 (verified: 4 period columns, with and without
    `dropna`), so the provider's own ROE — which tracks FiinProX at 90% within
    1% — is simply unavailable for a current quarter. It has to be derived, and
    no simple variant reproduces FiinProX exactly. Measured on 45 symbols at
    2026-Q2:

        parent TTM / avg(equity_t, equity_t-4)   25% <=1%, 68% <=5%, median 2.8%
        parent TTM / ending equity                9% <=1%, 57% <=5%
        parent TTM / avg(equity_t, equity_t-1)   20% <=1%, 66% <=5%
        npat   TTM / avg(equity_t, equity_t-4)   25% <=1%, 70% <=5%
        npat   TTM / ending equity               15% <=1%, 65% <=5%

    The first is used. What matters is not the value error but whether C7's
    BANDED points move, and they mostly do not: on the same 45 symbols, **C7
    points are identical on 42 of 44 (95%)**, the two exceptions each moving one
    band up (8->12, 4->8) — 4 points of 108. That is why the overall band
    agreement stays at 97% despite ROE being the least faithful field.
    """
    inc = {k: _series(income, lbl) for k, lbl in INCOME.items()}
    bal = {k: _series(balance, lbl) for k, lbl in BALANCE.items()}

    periods = sorted(
        set().union(*(d.keys() for d in inc.values()), *(d.keys() for d in bal.values())),
        key=lambda p: (int(p.split("-Q")[0]), int(p.split("-Q")[1])),
    )

    out: dict[str, dict[str, Any]] = {}
    for p in periods:
        rev = inc["revenue"].get(p)
        parent = inc["parent_profit"].get(p)
        shares = _div(bal["paid_in_capital"].get(p), PAR_VALUE)

        # TTM parent profit over {p .. p-3}; None if any quarter is missing, so a
        # gap produces no ROE rather than a sum over three quarters called four.
        ttm = [inc["parent_profit"].get(_shift(p, k)) for k in range(4)]
        ttm_profit = sum(ttm) if all(v is not None for v in ttm) else None

        eq_now = bal["total_equity"].get(p)
        eq_then = bal["total_equity"].get(_shift(p, 4))
        avg_eq = ((eq_now + eq_then) / 2.0) if (eq_now is not None and eq_then is not None) else eq_now

        out[p] = {
            "symbol": symbol,
            "period": p,
            "year": int(p.split("-Q")[0]),
            "quarter": int(p.split("-Q")[1]),
            "eps": _div(parent, shares),
            "revenue": rev,
            "gross_margin": _div(inc["gross_profit"].get(p), rev),
            "net_margin": _div(inc["npat"].get(p), rev),
            "roe_ttm": _div(ttm_profit, avg_eq),
            "st_debt": bal["st_debt"].get(p),
            "lt_debt": bal["lt_debt"].get(p),
            "total_equity": eq_now,
        }
    return out


def fetch_frames(symbol: str, attempts: int = 3, pause: float = 1.5):
    """(income, balance) quarterly frames from free vnstock, or raise.

    RETRIES PER CALL, and the caller must treat an exhausted retry as a FAILED
    FETCH rather than as "this company filed nothing". `refresh_fa_vnstock.py`
    learned this the hard way: a try/except-continue made a transient network
    error and an unpublished statement indistinguishable, and VNM silently lost
    its entire quarterly balance sheet while the run printed `ok` and exited 0.
    """
    from vnstock import Finance

    fin = Finance(symbol=symbol, source="VCI")
    frames = []
    for getter in ("income_statement", "balance_sheet"):
        last: Exception | None = None
        for i in range(attempts):
            try:
                frames.append(getattr(fin, getter)(period="quarter", lang="en", dropna=True))
                last = None
                break
            except Exception as e:  # noqa: BLE001
                last = e
                if i < attempts - 1:
                    time.sleep(pause * (i + 1))
        if last is not None:
            raise RuntimeError(f"{symbol}/{getter} failed after {attempts} attempts: {last}") from last
    return frames[0], frames[1]


def rows_for_symbol(symbol: str) -> dict[str, dict[str, Any]]:
    """Convenience: fetch + derive. Raises on a failed fetch (see fetch_frames)."""
    income, balance = fetch_frames(symbol)
    return derive_rows(symbol, income, balance)


def rows_and_status(symbol: str) -> tuple[dict[str, dict[str, Any]], str, list[str]]:
    """(rows, status, missing_labels) — everything the importer needs to decide."""
    income, balance = fetch_frames(symbol)
    status, missing = statement_status(income, balance)
    return derive_rows(symbol, income, balance), status, missing
