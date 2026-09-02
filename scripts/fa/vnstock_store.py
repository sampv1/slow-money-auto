"""Read the universal FA store and derive one rubric's inputs from it.

THE STORE IS RUBRIC-AGNOSTIC ON PURPOSE. `refresh_fa_vnstock.py` downloads every
statement (income / balance / cashflow / ratio, quarterly and annual) for every
symbol into `fa_vnstock_statements` and knows nothing about criteria. This module
is the other half of that split: it reads what was downloaded and shapes it for
whichever rubric a symbol was classified into. Adding a bank or securities rubric
means adding a mapping here, not another download.

WHY THIS IS WORTH THE INDIRECTION
  The importer used to fetch the same two statements a second time to derive
  `fa_quarterly`, so every symbol was pulled twice per run and the two paths
  could disagree about what the provider said. Deriving from the store makes the
  download the single point of contact with the provider — and it removes ~1,500
  redundant calls from every scoring pass.

KEYS ARE SEMANTIC IDS, NOT DISPLAY NAMES. The store holds `IS_NET_REVENUE`;
the live frames are matched on the English label "Net sales". The ids are stable
across provider releases and the prose is not (migration 055 says so), which is
why the store is keyed the way it is — but it does mean the two paths need two
mappings over the same fields, and only ONE copy of the arithmetic
(`vnstock_quarterly.derive_from_series`). Verified equivalent on FPT / VNM /
HPG / AAA / ANV at 2026-Q2: identical inputs, to the đồng.
"""

from __future__ import annotations

from typing import Any

from ta.common import paged_select

from . import vnstock_quarterly as vq

# --- manufacturing rubric (fa_quarterly) -----------------------------------
# The same eight fields fa/vnstock_quarterly.INCOME + BALANCE name by label.
INCOME_IDS = {
    "revenue": "IS_NET_REVENUE",
    "gross_profit": "IS_GROSS_PROFIT",
    "npat": "IS_NET_PROFIT_AFTER_TAX",
    "parent_profit": "IS_PROFIT_AFTER_TAX_FOR_SHAREHOLDERS_OF_PARENT_COMPANY",
}
BALANCE_IDS = {
    "st_debt": "BS_SHORT_TERM_BORROWINGS",
    "lt_debt": "BS_LONG_TERM_BORROWINGS",
    "total_equity": "BS_OWNERS_EQUITY",
    # Paid-in capital. `BS_CHARTER_CAPITAL / 10,000` is the share count the EPS
    # derivation needs; verified to equal the sponsor tier's own share count.
    "paid_in_capital": "BS_CHARTER_CAPITAL",
}

# A filer whose statements lack these is on a different chart of accounts —
# banks and brokers report no revenue and no gross profit. Same test the live
# path makes with `missing_labels`, restated over ids.
REQUIRED_IDS = ("IS_NET_REVENUE", "IS_GROSS_PROFIT", "BS_OWNERS_EQUITY")


def load_statements(client, symbol: str,
                    period_type: str = "quarter") -> dict[str, dict[str, Any]]:
    """{statement: {period: items}} for one symbol, straight from the store.

    Paged: a symbol holds up to ~34 periods x 4 statements, comfortably under
    the PostgREST cap today, but the read is paged anyway because the cap is
    silent and the annual+quarterly history only grows.
    """
    out: dict[str, dict[str, Any]] = {}
    for r in paged_select(
        lambda o, l: client.table("fa_vnstock_statements")
        .select("statement,period,items")
        .eq("symbol", symbol).eq("period_type", period_type)
        .order("statement").order("period").range(o, o + l - 1),
        label=f"statements {symbol}",
    ):
        out.setdefault(r["statement"], {})[r["period"]] = r["items"] or {}
    return out


def _series(by_period: dict[str, dict], metric_id: str) -> dict[str, float]:
    """{period: value} for one metric id, ABSENT entries left absent.

    A metric the provider did not report is missing from `items` rather than
    stored as 0 (migration 055), and that distinction has to survive the read:
    0 is a real accounting value and absence is not. So a None is dropped, never
    coerced.
    """
    out: dict[str, float] = {}
    for period, items in by_period.items():
        v = items.get(metric_id)
        if v is None:
            continue
        try:
            out[period] = float(v)
        except (TypeError, ValueError):
            continue
    return out


def statement_status(stmts: dict[str, dict]) -> tuple[str, list[str]]:
    """('ok' | 'no_data' | 'unsupported_format', missing ids).

    THREE STATES, NOT TWO — the same distinction the live importer had to learn.
    A symbol the provider has nothing for and a bank filing a different chart of
    accounts both end up with no usable rows, and folding them together hides
    one inside the other: the first is a coverage gap to retry, the second is a
    permanent property of the filer that no retry will fix.
    """
    income = stmts.get("income") or {}
    balance = stmts.get("balance") or {}
    if not income and not balance:
        return "no_data", []
    present: set[str] = set()
    for by_period in (income, balance):
        for items in by_period.values():
            present.update(k for k, v in items.items() if v is not None)
    missing = [m for m in REQUIRED_IDS if m not in present]
    if missing:
        return "unsupported_format", missing
    return "ok", []


def manufacturing_rows(client, symbol: str,
                       stmts: dict[str, dict] | None = None
                       ) -> tuple[dict[str, dict[str, Any]], str, list[str]]:
    """(rows, status, missing) — `fa_quarterly`-shaped, derived from the store.

    Drop-in for `vnstock_quarterly.rows_and_status`, minus the network call.
    """
    if stmts is None:
        stmts = load_statements(client, symbol)
    status, missing = statement_status(stmts)
    income = stmts.get("income") or {}
    balance = stmts.get("balance") or {}
    inc = {k: _series(income, mid) for k, mid in INCOME_IDS.items()}
    bal = {k: _series(balance, mid) for k, mid in BALANCE_IDS.items()}
    # ONE copy of the arithmetic, shared with the live-frame path.
    return vq.derive_from_series(symbol, inc, bal), status, missing


def newest_period(client, period_type: str = "quarter") -> dict[str, str]:
    """{symbol: newest period present in the store}.

    This is half of the scoring work-list: a symbol whose newest DOWNLOADED
    period is ahead of its newest SCORED period is a symbol that gained data and
    has not been graded on it yet. Derived from the two tables rather than from
    an import log, so it is self-healing — a scoring run that dies halfway is
    simply picked up by the next one, and nothing has to remember what happened.
    """
    out: dict[str, str] = {}
    for r in paged_select(
        lambda o, l: client.table("fa_vnstock_statements")
        .select("symbol,period").eq("period_type", period_type)
        .order("symbol").order("period").range(o, o + l - 1),
        label="store periods",
    ):
        s, p = r["symbol"], r["period"]
        if s not in out or _pidx(p) > _pidx(out[s]):
            out[s] = p
    return out


def _pidx(p: str) -> int:
    y, q = p.split("-Q")
    return int(y) * 4 + int(q) - 1
