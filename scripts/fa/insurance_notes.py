"""Insurance thuyết minh (VCI `section=NOTE`), with validation gates.

WHY THIS MODULE EXISTS
    BĐ4 (Net Float) and BĐ6 (RSM nhân thọ) of the ten insurance charts need
    BVH's claim reserve and its mathematical reserve. Neither is on BVH's
    balance sheet: `BS_CLAIM_RESERVE` is 0 on all 34 quarters and there is no
    mathematical-reserve field at all -- the whole 208.016 tỷ sits in one
    aggregate `BS_INSURANCE_RESERVES` line. BA asked IT to take them from the
    notes instead (reply lần 1 §3.2), and the provider serves them.

THE PREFIX IS `noi`, NOT `nob`
    Banks use `nob1..nob219`; insurers use **`noi1..noi307`** at the same
    endpoint. That difference is the whole reason the notes looked absent for
    insurers after the bank work had already found the endpoint.

WHAT IS ESTABLISHED, AND HOW
    A `noi` id is a POSITIONAL handle with no name attached, so the bank rule
    applies unchanged: ingest only ids backed by an INDEPENDENT yardstick.
    Here the yardstick is an internal identity that needs no external figure:

        noi103 = noi104 + noi118 + noi132 + noi146
        (total technical reserve = UPR + claim + catastrophe + mathematical)

    Measured over every insurer-period the provider serves: **375/375, 0
    violations at 0.5%**. Three of the four components additionally match the
    provider's own balance-sheet fields on the 12 non-life insurers
    (`BS_UNEARNED_PREMIUM_RESERVE` / `BS_CLAIM_RESERVE` /
    `BS_CATASTROPHE_RESERVE`, 99.6% on 260 symbol-quarters), which is what
    establishes the positions; `noi146` is then the residual the identity
    closes, and it is material only for BVH.

    The investment-portfolio ids are deliberately NOT ingested -- no contiguous
    window of up to 20 of them reconciles to any investment line on the balance
    sheet (best 62.9%), which is the standard already refused for banks. See
    `UNVALIDATED`.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

_SECTION = "NOTE"

#: noi id -> stable semantic name. Every id here is closed by the identity in
#: `validate`; nothing is written on position alone.
FIELDS: dict[str, str] = {
    "noi103": "NT_BS_INSURANCE_RESERVES_TOTAL",
    "noi104": "NT_BS_UNEARNED_PREMIUM_RESERVE",
    "noi118": "NT_BS_CLAIM_RESERVE",
    "noi132": "NT_BS_CATASTROPHE_RESERVE",
    "noi146": "NT_BS_MATHEMATICAL_RESERVE",
}

#: Deliberately NOT ingested, with the reason, so a future reader does not add
#: them back on the strength of a plausible-looking magnitude.
UNVALIDATED: dict[str, str] = {
    "noi6/noi7/noi301..303": "the investment book. No contiguous window of up to "
        "20 ids reconciles to BS_SHORT_TERM_INVESTMENTS, BS_LONG_TERM_INVESTMENTS, "
        "BS_FVTPL_FINANCIAL_ASSETS, BS_HELD_TO_MATURITY_* or BS_INVESTMENT_PROPERTIES "
        "-- best match 62.9% of symbol-quarters, below the standard refused for "
        "banks' nob66/nob67. BĐ5 therefore uses the five balance-sheet tiers BA "
        "settled in reply lần 2 §6.",
    "noi153..noi163": "an 11-way split that sums to gross written premium exactly "
        "(100% on 282 symbol-quarters) and looks like the statutory line-of-business "
        "taxonomy -- but PTI reads 165.7% on one column and -158.5% on another, and "
        "PVI puts 100% in the last column alone. Plausible, unlabelled, inconsistent "
        "across issuers: the nob66 situation. Needs a labelled sample from BA.",
    "noi226..noi249": "financial income/expense detail. Totals match "
        "IS_FINANCIAL_INCOME / IS_FINANCIAL_EXPENSES (~95%), but the components are "
        "unlabelled and the whole region is EMPTY for PGI and VNR.",
}

#: The internal identity's tolerance. Measured at 0 violations over 375 records,
#: so this is slack for rounding, not for disagreement.
TOLERANCE = 0.005

#: The note total is compared against `BS_INSURANCE_RESERVES` as a SCOPE check,
#: and this threshold is measured rather than chosen: the deviation is 0.046% at
#: the median and 1.127% at p90, while every record above 5% is BVH before
#: 2022-Q3 -- 22 periods where the provider's note block carries only the
#: non-life subsidiary while the balance sheet carries the group (or, before
#: 2022-Q1, the reverse: the balance sheet held a collapsed 285 tỷ). Both are
#: scope mismatches and both must be refused, so the gate sits at 5%, a 4.4x
#: margin over p90.
SCOPE_TOLERANCE = 0.05

TOTAL = "NT_BS_INSURANCE_RESERVES_TOTAL"
PARTS = (
    "NT_BS_UNEARNED_PREMIUM_RESERVE",
    "NT_BS_CLAIM_RESERVE",
    "NT_BS_CATASTROPHE_RESERVE",
    "NT_BS_MATHEMATICAL_RESERVE",
)


@dataclass
class Check:
    """One validation outcome for one symbol-period.

    FATAL means the period is refused. Both gates here are fatal, and for the
    same reason: each can only mean the figures are not what we think they are.
    A broken identity means the positional mapping moved; a scope mismatch means
    the note block and the balance sheet are describing different entities, and
    BVH's 2022-Q1/Q2 shows that produces a figure 18x too small -- which would
    draw as a collapse in float rather than as missing data.
    """

    symbol: str
    period: str
    rule: str
    ok: bool
    detail: str = ""
    fatal: bool = True


@dataclass
class Ingest:
    symbol: str
    rows: list[dict] = field(default_factory=list)
    checks: list[Check] = field(default_factory=list)
    dropped: int = 0

    @property
    def failures(self) -> list[Check]:
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
    return f if f == f and abs(f) != float("inf") else None


def period_label(rec: dict) -> str | None:
    """`{yearReport, lengthReport}` -> '2026-Q2' or '2026'."""
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
    """The ingested fields of one payload record, under stable names.

    A ZERO *TOTAL* MEANS UNREPORTED, AND RETURNS NOTHING AT ALL. The provider
    serves a note record for many periods in which the reserve block is simply
    not filled, and it fills it with 0 rather than omitting it -- VNR reads
    `noi103 = 0` on 25 of 42 periods while its balance sheet carries 4.603 tỷ of
    technical reserves. Read as a measured zero those periods fail the scope
    gate at 100% and look like 25 broken records; read as absence they are
    simply records with no block in them. Same shape as `nob1 = 0` for SHB in
    the bank loader, and as `IS_BASIC_EARNINGS_PER_SHARE` being 0.0 in 102 of
    254 insurance cells.

    A zero COMPONENT is kept, because there it is meaningful and common: 12 of
    the 13 insurers report no mathematical reserve, and dropping those zeros
    would break the identity that validates the rest.
    """
    total = _num(rec.get("noi103"))
    if not total:
        return {}
    out: dict[str, float] = {}
    for src, name in FIELDS.items():
        v = _num(rec.get(src))
        if v is not None:
            out[name] = v
    return out


def validate(
    symbol: str,
    period: str,
    items: dict[str, float],
    *,
    reserves_total: float | None = None,
) -> list[Check]:
    """Both gates, on one symbol-period.

    `reserves_total` is `BS_INSURANCE_RESERVES` for the same period, the scope
    yardstick. A period with no yardstick still passes the identity gate -- the
    identity needs nothing external, and refusing a period because a cross-check
    input is absent would lose data the charts can legitimately use.
    """
    checks: list[Check] = []
    total = items.get(TOTAL)
    parts = [items.get(k) for k in PARTS]

    if total is None or all(p is None for p in parts):
        checks.append(Check(symbol, period, "reserve_block_present", False,
                            "no reserve block in this record"))
        return checks

    # 1. The identity. Internal, so it needs no provider figure.
    s = sum(p or 0.0 for p in parts)
    den = max(abs(total), abs(s))
    dev = abs(total - s) / den if den else 0.0
    checks.append(Check(
        symbol, period, "reserve_parts_sum_to_total", dev <= TOLERANCE,
        f"total={total:.0f} parts={s:.0f} dev={dev:.4%}",
    ))

    # 2. No negative component. A technical reserve is a liability balance.
    neg = [k for k, v in zip(PARTS, parts) if v is not None and v < 0]
    checks.append(Check(symbol, period, "no_negative_reserve", not neg,
                        f"negative: {', '.join(neg)}" if neg else ""))

    # 3. Scope: does this block describe the same entity as the balance sheet?
    if reserves_total:
        sdev = abs(total - reserves_total) / abs(reserves_total)
        checks.append(Check(
            symbol, period, "scope_matches_balance_sheet", sdev <= SCOPE_TOLERANCE,
            f"note={total:.0f} balance={reserves_total:.0f} dev={sdev:.2%}",
        ))
    return checks


def fetch_notes(symbol: str, *, timeout: int = 45, attempts: int = 3) -> dict:
    """The raw `section=NOTE` payload for one symbol.

    An exception after retries is a FAILED CALL; an empty dict is a provider
    that served nothing. The caller keeps them apart -- the lesson
    `fa/vnstock_source.py` learned when a try/except-continue cost VNM its whole
    quarterly balance sheet while the run printed `ok`.
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
    """Turn one payload into upsert rows, dropping any period that fails a gate.

    `context` carries the scope yardstick, keyed by period:
        {'2026-Q2': {'reserves_total': 3.5e12}}
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
            checks = validate(
                symbol, period, items,
                reserves_total=ctx.get(period, {}).get("reserves_total"),
            )
            out.checks.extend(checks)
            if any(not c.ok and c.fatal for c in checks):
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
