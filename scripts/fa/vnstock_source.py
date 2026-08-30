"""Financial statements from vnstock_data (sponsor API) -> fa_vnstock_statements.

DISPLAY-ONLY DATA. Nothing here feeds a score: the FA rubric stays on FiinProX
(`fa_quarterly`), for the reason recorded in migration 055 -- the two providers
agree to 0.00% on revenue, gross profit, equity and short-term debt, but EPS
diverges enough to move a rubric band.

REQUIRES ~/.venv, NOT scripts/.venv. `vnstock_data` is a closed-source sponsor
package that is not on PyPI, so it cannot be installed in CI and is deliberately
absent from requirements.txt. `_require_vnstock_data` says so in one line rather
than letting an ImportError surface with no explanation.

com_type is left on AUTO. The explicit 'Bank'/'Securities' taxonomies return a
small curated SUBSET, not more detail -- measured on TCB the balance sheet is 13
rows under 'Bank' against 80 under auto, and VND's income statement is 2 rows
under 'Securities' against 79.
"""

from __future__ import annotations

import math
import time

# Provider method name -> the `statement` value stored in the table.
STATEMENTS = {
    "income_statement": "income",
    "balance_sheet": "balance",
    "cash_flow": "cashflow",
    "ratio": "ratio",
}

PERIOD_TYPES = ("quarter", "year")

UPSERT_CHUNK_SIZE = 500


def _require_vnstock_data():
    try:
        from vnstock_data import Fundamental, Reference  # noqa: F401
    except ImportError as exc:
        raise SystemExit(
            "vnstock_data is not importable.\n"
            "  It is a sponsor package, not on PyPI, and lives in ~/.venv.\n"
            "  Run this script with:  ~/.venv/bin/python refresh_fa_vnstock.py ...\n"
            f"  (original error: {exc})"
        ) from exc
    from vnstock_data import Fundamental, Reference
    return Fundamental, Reference


def list_symbols() -> list[str]:
    """Every symbol the PROVIDER lists -- not `ta_universe`, not `fa_scores`.

    Loose on purpose (migration 055): this table must never become a reason
    another feature's membership cannot change.
    """
    _, Reference = _require_vnstock_data()
    df = Reference().equity.list()
    return sorted({str(s).strip().upper() for s in df["symbol"] if str(s).strip()})


def _num(v):
    """A finite float, or None. NaN/inf must not reach jsonb as literal NaN."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


# How many times one statement is asked for before its failure is accepted.
# The provider is flaky per-call rather than per-symbol: on the first full pass
# 625 of 1,734 symbols came back missing at least one of their eight
# statement/period combinations, and re-fetching a sample got half of them on
# the very next try (VNM's quarterly balance sheet -- 4,012 rows -- among them).
_STATEMENT_ATTEMPTS = 3
_RETRY_PAUSE_S = 1.5


def fetch_symbol(symbol: str) -> tuple[list[dict], list[dict], int]:
    """(statement rows, metric-dictionary rows, failed-call count) for one symbol.

    Returns empty rows rather than raising when the provider has nothing for the
    symbol -- a company that has never filed is absence of data, not an error,
    and must not abort a 1,700-symbol run.

    THE THIRD RETURN VALUE IS THE POINT. A statement that RAISED and one the
    provider genuinely does not publish both used to end as "no rows", which
    made a transient network failure indistinguishable from a company that
    files no cash-flow statement -- and silently cost VNM charts 7, 8 and 9
    while the run reported success. Only the caller can decide what to do about
    that, so the count is handed up rather than swallowed here.
    """
    Fundamental, _ = _require_vnstock_data()
    eq = Fundamental().equity(symbol)

    rows: list[dict] = []
    metrics: dict[str, dict] = {}
    failed_calls = 0

    for method, stmt in STATEMENTS.items():
        for ptype in PERIOD_TYPES:
            df = None
            for attempt in range(_STATEMENT_ATTEMPTS):
                try:
                    df = getattr(eq, method)(period=ptype)
                    break
                except Exception:
                    # One statement missing (banks have no cash-flow detail
                    # under some taxonomies) must not cost the symbol its other
                    # three -- but nor should one flaky call be taken as proof
                    # the statement does not exist.
                    if attempt == _STATEMENT_ATTEMPTS - 1:
                        failed_calls += 1
                    else:
                        time.sleep(_RETRY_PAUSE_S * (attempt + 1))
            if df is None or not len(df):
                continue
            if not {"period", "id", "value"}.issubset(df.columns):
                continue

            by_period: dict[str, dict] = {}
            for r in df.itertuples(index=False):
                mid = getattr(r, "id", None)
                per = getattr(r, "period", None)
                if not mid or not per:
                    continue
                val = _num(getattr(r, "value", None))
                # ABSENT, not 0 -- see migration 055. A category header row
                # carries no value and simply never enters `items`.
                if val is not None:
                    by_period.setdefault(str(per), {})[str(mid)] = val

                if mid not in metrics:
                    name = getattr(r, "name", None)
                    metrics[str(mid)] = {
                        "metric_id": str(mid),
                        "statement": stmt,
                        "name_vi": str(name).replace("‣", "").strip() if name else None,
                        "name_en": None,  # provider ships vi only; filled later if ever
                        "unit": (str(getattr(r, "unit", "") or "").strip() or None),
                        "display_order": _int(getattr(r, "order", None)),
                        "level": _int(getattr(r, "level", None)),
                    }

            for per, items in by_period.items():
                if not items:
                    continue
                rows.append({
                    "symbol": symbol,
                    "period": per,
                    "period_type": ptype,
                    "statement": stmt,
                    "items": items,
                })

    return rows, list(metrics.values()), failed_calls


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def upsert_statements(client, rows: list[dict], dry_run: bool = False) -> int:
    return _chunked(client, "fa_vnstock_statements", rows,
                    "symbol,period,period_type,statement", dry_run)


def upsert_metrics(client, rows: list[dict], dry_run: bool = False) -> int:
    return _chunked(client, "fa_vnstock_metrics", rows, "metric_id", dry_run)


def _chunked(client, table: str, rows: list[dict], on_conflict: str, dry_run: bool) -> int:
    if not rows or dry_run:
        return 0
    from ta.common import safe_execute
    total = 0
    for i in range(0, len(rows), UPSERT_CHUNK_SIZE):
        chunk = rows[i:i + UPSERT_CHUNK_SIZE]
        safe_execute(
            client.table(table).upsert(chunk, on_conflict=on_conflict),
            label=f"upsert {table}[{i}:{i + len(chunk)}]",
        )
        total += len(chunk)
    return total


def stored_symbols(client) -> set[str]:
    """Symbols already imported, so a resumed run skips them.

    PAGED: PostgREST truncates at 1000 and there are far more rows than that --
    an unpaged read would report a handful of symbols as done and re-fetch the
    rest of a multi-hour run every time.
    """
    from ta.common import safe_execute
    out: set[str] = set()
    step, frm = 1000, 0
    while True:
        res = safe_execute(
            client.table("fa_vnstock_statements")
            .select("symbol")
            .order("symbol")
            .range(frm, frm + step - 1),
            label="read stored symbols",
        )
        data = res.data or []
        out.update(r["symbol"] for r in data)
        if len(data) < step:
            return out
        frm += step
