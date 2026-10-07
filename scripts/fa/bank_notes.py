"""Bank thuyết minh (notes) from VCI's `section=NOTE`, with validation gates.

WHY THIS MODULE EXISTS
    Charts 2, 3 and 4 of `BANK_CHARTS_DESIGN.md` need figures that are not in
    the four primary statements: the loan-classification block (nợ nhóm 2-5),
    the short/medium/long-term loan split, and the investment-book corporate
    bond line.

    vnstock cannot reach them. `_IQ_FINANCE_REPORT` (explorer/vci/const.py)
    maps four sections, so `Finance` exposes four statements and the notes look
    absent. The provider serves them anyway, at

        GET /v1/company/{symbol}/financial-statement?section=NOTE

    which returns `{data: {years: [...], quarters: [...]}}` with each record
    carrying `nob1..nob219`. Verified on 29/29 banks, 18-34 quarters each.

THE nob INDEX IS NOT A MAPPING, AND THIS IS THE CENTRAL HAZARD
    The payload carries no field names, so the ids have to come from somewhere
    else. Matching values against ONE labelled sample is not enough, and that is
    not a hypothetical: `nob4` matched a labelled `NT_GENERAL_CAR` series on
    34/34 periods and is not CAR at all -- it agreed only where both sides were
    zero, and its real values are money amounts in the hundreds of trillions.
    `nob66`/`nob67` look like the demand/term deposit split and disagree with
    `RT_BANK_CASA` on 7 of 27 banks (ACB 44.5% vs 20.6%, KLB 69.5% vs 5.8%).

    So every id in `FIELDS` below has passed an INDEPENDENT reconciliation --
    against a figure the provider computes separately, or against an identity
    that must hold -- and `validate()` re-checks those identities on every
    symbol-quarter at ingest rather than trusting this file to stay true.

    Where the provider already publishes the ratio (`RT_BANK_CASA`,
    `RT_BANK_CAR`), that is used instead and nothing is taken from the notes.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

# The VCI quote host; imported lazily so this module can be unit-tested without
# vnstock installed (the tests exercise mapping and validation, not the network).
_SECTION = "NOTE"

#: nob id -> stable semantic name, for the fields that passed validation.
#: Keep this table and `CHECKS` in step: a field with no identity to test it
#: does not belong here (see `UNVALIDATED`).
FIELDS: dict[str, str] = {
    "nob1": "NT_BS_LOANS_AND_ADVANCES_BY_GRADING",
    "nob41": "NT_BS_SPECIAL_MENTIONED",          # nợ nhóm 2
    "nob42": "NT_BS_SUBSTANDARD",                # nợ nhóm 3
    "nob43": "NT_BS_DOUBTFUL",                   # nợ nhóm 4
    "nob44": "NT_BS_BAD",                        # nợ nhóm 5
    "nob46": "NT_BS_SHORT_TERM_LOANS",
    "nob47": "NT_BS_MEDIUM_TERM_LOANS",
    "nob48": "NT_BS_LONG_TERM_LOANS",
    "nob184": "NT_BS_INVESTMENT_SECURITIES_SECURITIES_ISSUED_BY_LOCAL_ECONOMIC_ENTITIES",
}

#: Deliberately NOT ingested, with the reason. Recorded so a future reader does
#: not "helpfully" add them back.
UNVALIDATED: dict[str, str] = {
    "nob4": "matched a labelled CAR series only on coinciding zeros; real values "
            "are money amounts. Use RT_BANK_CAR (period_type='year') instead.",
    "nob66": "demand-deposit candidate; disagrees with RT_BANK_CASA on 7 of 27 "
             "banks. Use RT_BANK_CASA instead.",
    "nob67": "term-deposit candidate; same failure as nob66.",
}

#: Relative tolerance for the identity checks. The two loan identities held at
#: 0.0% on 28/28 banks, so this is slack for rounding, not for disagreement.
TOLERANCE = 0.005

GRADED = "NT_BS_LOANS_AND_ADVANCES_BY_GRADING"
MATURITY = ("NT_BS_SHORT_TERM_LOANS", "NT_BS_MEDIUM_TERM_LOANS", "NT_BS_LONG_TERM_LOANS")
GROUPS = ("NT_BS_SPECIAL_MENTIONED", "NT_BS_SUBSTANDARD", "NT_BS_DOUBTFUL", "NT_BS_BAD")
NPL_GROUPS = ("NT_BS_SUBSTANDARD", "NT_BS_DOUBTFUL", "NT_BS_BAD")
TPDN = "NT_BS_INVESTMENT_SECURITIES_SECURITIES_ISSUED_BY_LOCAL_ECONOMIC_ENTITIES"


@dataclass
class Check:
    """One validation outcome for one symbol-period.

    `fatal` separates two different kinds of disagreement, and conflating them
    cost real data on the first run:

      * FATAL is an INTERNAL identity breaking -- the maturity legs no longer
        sum to the book, a debt group exceeds the book it is drawn from, a
        negative appears. These can only mean the positional mapping moved, so
        the period is refused.
      * ADVISORY is a disagreement with a figure the PROVIDER computes
        separately. That can equally well be the provider being wrong, and on
        the first full run it was: 24 of 31 `npl_matches_provider` failures
        landed on 2021-Q4/2022-Q1 across many banks at once, and spot-checking
        VCB showed our note-derived 0.64% is its published end-2021 NPL while
        the provider's ratio row carries the neighbouring quarter's value. A
        cross-check that fires on one date for half the sector is evidence about
        the yardstick, not the measurement, so it is recorded and the period is
        still stored.
    """

    symbol: str
    period: str
    rule: str
    ok: bool
    detail: str = ""
    fatal: bool = True


@dataclass
class Ingest:
    """What `collect_symbol` produced, including what it refused."""

    symbol: str
    rows: list[dict] = field(default_factory=list)
    checks: list[Check] = field(default_factory=list)
    dropped: int = 0

    @property
    def failures(self) -> list[Check]:
        """Fatal failures only -- the ones that cost a period."""
        return [c for c in self.checks if not c.ok and c.fatal]

    @property
    def advisories(self) -> list[Check]:
        return [c for c in self.checks if not c.ok and not c.fatal]


def _num(v) -> float | None:
    """Provider numerics, with absence kept distinct from zero."""
    if v is None or isinstance(v, bool):
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f and f not in (float("inf"), float("-inf")) else None


def period_label(rec: dict) -> str | None:
    """`{yearReport, lengthReport}` -> '2026-Q2' or '2026'.

    `lengthReport` is the quarter for a quarterly record and 5 for an annual
    one; anything else is a shape we do not recognise and is skipped rather
    than guessed at.
    """
    y = rec.get("yearReport")
    n = rec.get("lengthReport")
    if not isinstance(y, int):
        return None
    if n in (1, 2, 3, 4):
        return f"{y}-Q{n}"
    if n == 5:
        return str(y)
    return None


def map_record(rec: dict) -> dict[str, float]:
    """Pull the validated fields out of one `nob*` record.

    ABSENT STAYS ABSENT. A field the provider did not report is omitted, not
    stored as 0 -- 0 is a real accounting value here (a bank genuinely holding
    no group-5 debt) and the two must not collapse.
    """
    out: dict[str, float] = {}
    for nob, name in FIELDS.items():
        v = _num(rec.get(nob))
        if v is not None:
            out[name] = v
    return out


def _rel(a: float, b: float) -> float:
    return abs(a - b) / abs(b) if b else (0.0 if a == 0 else float("inf"))


def validate(
    symbol: str,
    period: str,
    items: dict[str, float],
    *,
    gross_loans: float | None = None,
    investment_securities: float | None = None,
    npl_ratio: float | None = None,
) -> list[Check]:
    """Re-check, per symbol-period, the identities that earned each field its place.

    These are not defensive extras. They are the ONLY thing standing between a
    positional index and a chart: if the provider renumbers `nob`, every value
    still parses and every chart still draws, and the identity check is what
    turns that into a visible failure instead of a quietly wrong NPL.
    """
    checks: list[Check] = []

    def add(rule: str, ok: bool, detail: str = "", fatal: bool = True) -> None:
        checks.append(Check(symbol, period, rule, ok, detail, fatal))

    # ZERO IN A NOTE BLOCK MEANS UNREPORTED, NOT ZERO. The provider writes 0 for
    # a line it did not carry that quarter -- the same shape as its
    # IS_BASIC_EARNINGS_PER_SHARE, which is 0.0 in 102 of 254 insurance cells. A
    # bank with a real loan book and `nob1 = 0` is SHB in 22 of its 42 periods,
    # where the maturity legs are present and sum to the balance sheet exactly.
    # Treating that 0 as a measured zero refused half of SHB's history.
    graded = items.get(GRADED)
    if not graded:
        graded = None
    # The balance sheet stands in as the denominator when the note block omits it.
    book = graded if graded is not None else (gross_loans or None)

    mats = [items.get(k) for k in MATURITY]
    have_mat = [m for m in mats if m is not None]

    # 1. The maturity split must exhaust the book. Held at 0.0% on 28/28 banks.
    if book and len(have_mat) == len(MATURITY):
        total = sum(have_mat)
        d = _rel(total, book)
        add("maturity_sums_to_graded", d <= TOLERANCE, f"{d:.4%}")
    elif have_mat and len(have_mat) != len(MATURITY):
        add("maturity_sums_to_graded", False, "partial maturity block")

    # 2. Where the note block DOES carry the graded total it must equal the
    #    balance sheet. Absent is handled above and is not a failure.
    if graded is not None and gross_loans:
        d = _rel(graded, gross_loans)
        add("graded_equals_bs_gross", d <= TOLERANCE, f"{d:.4%}")

    # 3. NPL derived from the groups vs the provider's own ratio. ADVISORY --
    #    see `Check`. It is what proves nob41-44 are the classification block,
    #    and at the current edge it reproduced the provider on 27/27 banks.
    if book and npl_ratio is not None and all(items.get(k) is not None for k in NPL_GROUPS):
        npl = sum(items[k] for k in NPL_GROUPS) / book
        add("npl_matches_provider", abs(npl - npl_ratio) <= 0.0015,
            f"derived {npl:.4%} vs provider {npl_ratio:.4%}", fatal=False)

    # 4. A group cannot exceed the book it is drawn from.
    for k in GROUPS:
        v = items.get(k)
        if v is not None and book and v > book * (1 + TOLERANCE):
            add("group_within_graded", False, f"{k} {v:,.0f} > book {book:,.0f}")

    # 5. `nob184` has no independent yardstick, so it gets a BOUND rather than
    #    an identity: the investment-book bond line cannot exceed investment
    #    securities. Verified on TCB only; this is what carries it elsewhere.
    tpdn = items.get(TPDN)
    if tpdn is not None and investment_securities:
        add("tpdn_within_investment_securities",
            tpdn <= investment_securities * (1 + TOLERANCE),
            f"{tpdn:,.0f} vs {investment_securities:,.0f}")

    # 6. Nothing here may be negative.
    for k, v in items.items():
        if v < 0:
            add("non_negative", False, f"{k} = {v:,.0f}")

    return checks


def fetch_notes(symbol: str, *, timeout: int = 45, attempts: int = 3) -> dict:
    """The raw `section=NOTE` payload for one symbol.

    An exception after retries is a FAILED CALL; an empty dict is a provider
    that served nothing. The caller keeps them apart -- the same rule
    `fa/vnstock_source.py` learned when a transient failure was being filed as
    "this company publishes no balance sheet".
    """
    import requests
    from vnstock.explorer.vci.const import _VCIQ_URL
    from vnstock.core.utils.user_agent import get_headers

    url = f"{_VCIQ_URL}/v1/company/{symbol}/financial-statement"
    last: BaseException | None = None
    for i in range(attempts):
        try:
            r = requests.get(url, params={"section": _SECTION},
                             headers=get_headers(data_source="VCI"), timeout=timeout)
            r.raise_for_status()
            return r.json().get("data") or {}
        except Exception as exc:  # noqa: BLE001 - retried, then re-raised
            last = exc
            time.sleep(1.5 * (i + 1))
    assert last is not None
    raise last


def collect_symbol(symbol: str, payload: dict, context: dict | None = None) -> Ingest:
    """Turn one payload into upsert rows, dropping any period that fails validation.

    `context` carries the yardsticks, keyed by period:
        {'2026-Q2': {'gross_loans': ..., 'investment_securities': ..., 'npl_ratio': ...}}
    A period with no context is still written -- the internal identities (the
    maturity split, the group bounds) do not need it, and refusing to store a
    quarter because a cross-check input is missing would lose data the charts
    can legitimately use.
    """
    out = Ingest(symbol=symbol)
    ctx = context or {}
    for kind, period_type in (("quarters", "quarter"), ("years", "year")):
        for rec in payload.get(kind) or []:
            period = period_label(rec)
            if period is None:
                continue
            items = map_record(rec)
            if not items:
                continue
            c = ctx.get(period, {})
            checks = validate(
                symbol, period, items,
                gross_loans=c.get("gross_loans"),
                investment_securities=c.get("investment_securities"),
                npl_ratio=c.get("npl_ratio"),
            )
            out.checks.extend(checks)
            # Only a FATAL failure costs the period; an advisory is recorded and
            # the data is still stored (see `Check`).
            if any(not x.ok and x.fatal for x in checks):
                out.dropped += 1
                continue
            out.rows.append({
                "symbol": symbol,
                "period": period,
                "period_type": period_type,
                "statement": "note",
                "items": items,
            })
    return out
