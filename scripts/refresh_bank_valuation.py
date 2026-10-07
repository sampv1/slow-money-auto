#!/usr/bin/env python3
"""Chart 10 — compute and store the bank peer valuation matrix.

    python3 refresh_bank_valuation.py            # newest quarter, all banks
    python3 refresh_bank_valuation.py --dry-run  # compute and print, write nothing

Needs migration 082. See `fa/bank_valuation.py` for why this is a stored
cross-sectional snapshot rather than a dashboard computation.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date

sys.path.insert(0, __file__.rsplit("/", 1)[0])

from ta.common import get_supabase_client, paged_select, safe_execute  # noqa: E402
from fa import bank_valuation as bv  # noqa: E402

EXCLUDED = {"EVF", "TIN"}
BETA_LOOKBACK_DAYS = 900          # ~2.5y of calendar days to yield 104 weeks
TTM = 4


def banks(client) -> list[str]:
    rows = paged_select(
        lambda lo, hi: client.table("symbol_profile").select("symbol")
        .eq("com_type_code", "NH").order("symbol").range(lo, hi),
        label="bank universe")
    return [r["symbol"] for r in rows if r["symbol"] not in EXCLUDED]


def _stmt(client, symbols, statement, fields, periods):
    sel = "symbol,period," + ",".join(f"{k}:items->{v}" for k, v in fields.items())
    out: dict[tuple[str, str], dict] = {}
    for i in range(0, len(symbols), 6):
        rows = paged_select(
            lambda lo, hi, c=symbols[i:i + 6]: client.table("fa_vnstock_statements")
            .select(sel).eq("statement", statement).eq("period_type", "quarter")
            .in_("symbol", c).in_("period", periods)
            .order("symbol").order("period").range(lo, hi),
            label=f"{statement} {i}")
        for r in rows:
            out[(r["symbol"], r["period"])] = r
    return out


def _quarters(latest: str, n: int) -> list[str]:
    y, q = int(latest[:4]), int(latest[-1])
    out = []
    for _ in range(n):
        out.append(f"{y}-Q{q}")
        q -= 1
        if q == 0:
            q, y = 4, y - 1
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--period", help="quarter label; default the newest stored")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    client = get_supabase_client()
    syms = banks(client)

    if args.period:
        period = args.period
    else:
        r = safe_execute(
            client.table("fa_vnstock_statements").select("period")
            .eq("statement", "balance").eq("period_type", "quarter")
            .in_("symbol", syms[:8]).order("period", desc=True).limit(1),
            label="newest period")
        period = r.data[0]["period"]
    window = _quarters(period, TTM + 1)          # t .. t-4, for 5-point averages
    print(f"{len(syms)} banks, period {period} (window {window[-1]}..{window[0]})")

    bal = _stmt(client, syms, "balance", {
        "E": "BS_EQUITY", "M": "BS_MINORITY_INTEREST", "A": "BS_TOTAL_ASSETS",
        "P": "BS_PROVISION_LOANS_TO_CUSTOMERS",
        "ACC": "BS_INTEREST_AND_FEE_RECEIVABLES"}, window)
    inc = _stmt(client, syms, "income", {
        "OTH": "IS_NET_OTHER_INCOME", "PBT": "IS_PROFIT_BEFORE_TAX",
        "TAX": "IS_CORPORATE_INCOME_TAX_EXPENSES",
        "NP": "IS_PROFIT_AFTER_TAX_FOR_SHAREHOLDERS_OF_PARENT_COMPANY"}, window)
    rat = _stmt(client, syms, "ratio", {"S": "RT_VALUE_OUTSTANDING_SHARES"}, [period])
    note = _stmt(client, syms, "note", {
        "G2": "NT_BS_SPECIAL_MENTIONED", "G3": "NT_BS_SUBSTANDARD",
        "G4": "NT_BS_DOUBTFUL", "G5": "NT_BS_BAD",
        "TOT": "NT_BS_LOANS_AND_ADVANCES_BY_GRADING"}, [period, window[TTM]])

    since = (date.today() - __import__("datetime").timedelta(days=BETA_LOOKBACK_DAYS)).isoformat()
    idx = [(r["date"], r["value"]) for r in paged_select(
        lambda lo, hi: client.table("macro_series").select("date,value")
        .eq("metric", "vnindex").gte("date", since).order("date").range(lo, hi),
        label="vnindex")]

    points: list[bv.BankPoint] = []
    for s in syms:
        p = bv.BankPoint(symbol=s)
        b, r_, n = bal.get((s, period)), rat.get((s, period)), note.get((s, period))
        if not b:
            p.reasons["all"] = "NO_BALANCE_SHEET"
            points.append(p)
            continue
        g = lambda d, k: (d or {}).get(k)
        p.total_assets = g(b, "A")
        p.shares = g(r_, "S")
        eq, mi = g(b, "E"), g(b, "M") or 0.0
        p.parent_equity = None if eq is None else eq - mi

        bars = [(x["date"], x["close"]) for x in paged_select(
            lambda lo, hi, s=s: client.table("ta_ohlcv").select("date,close")
            .eq("symbol", s).gte("date", since).order("date").range(lo, hi),
            label=f"bars {s}")]
        if bars:
            p.price, p.price_date = bars[-1][1], bars[-1][0]
            p.beta_raw, p.beta_blume, status = bv.beta(bars, idx)
            p.reasons["beta"] = status
            if p.beta_blume is not None:
                p.ke = bv.RF + p.beta_blume * bv.ERP
        else:
            p.reasons["price"] = "NO_BARS"

        groups = sum(x for k in ("G2", "G3", "G4", "G5")
                     if (x := g(n, k)) is not None) if n else None
        npl = sum(x for k in ("G3", "G4", "G5")
                  if (x := g(n, k)) is not None) if n else None
        p.hidden_npl_unprovisioned = bv.hidden_npl_unprovisioned(groups, g(b, "P"))

        # The same shortfall a year back, so the CHARGE is a flow rather than
        # the accumulated stock -- see bank_valuation.extra_provision_charge.
        n_ago, b_ago = note.get((s, window[TTM])), bal.get((s, window[TTM]))
        groups_ago = sum(x for k in ("G2", "G3", "G4", "G5")
                         if (x := g(n_ago, k)) is not None) if n_ago else None
        short_ago = bv.hidden_npl_unprovisioned(groups_ago, g(b_ago, "P"))
        extra = bv.extra_provision_charge(p.hidden_npl_unprovisioned, short_ago)
        if extra is None:
            p.reasons["extra_provision"] = "NO_YEAR_AGO_SHORTFALL"
        p.accrued_overdue = bv.accrued_overdue(
            g(b, "ACC"), g(n, "G2") if n else None, npl, g(n, "TOT") if n else None)

        pbt = sum(x for q in window[:TTM] if (x := g(inc.get((s, q)), "PBT")) is not None)
        tax = sum(x for q in window[:TTM] if (x := g(inc.get((s, q)), "TAX")) is not None)
        eff = abs(tax) / pbt if pbt and pbt > 0 and 0 < abs(tax) / pbt < 1 else 0.20
        p.bvps, p.adjusted_bvps = bv.adjusted_bvps(
            p.parent_equity, p.shares, p.hidden_npl_unprovisioned, p.accrued_overdue, eff)
        if p.price and p.adjusted_bvps:
            p.adjusted_pb = p.price / p.adjusted_bvps

        eqs = [g(bal.get((s, q)), "E") for q in window]
        mis = [g(bal.get((s, q)), "M") or 0.0 for q in window]
        avg_eq = (sum(e - m for e, m in zip(eqs, mis)) / len(eqs)
                  if all(e is not None for e in eqs) else None)
        np_ttm = sum(x for q in window[:TTM] if (x := g(inc.get((s, q)), "NP")) is not None)
        p.roe_ttm = np_ttm / avg_eq if avg_eq else None
        oth = sum(x for q in window[:TTM] if (x := g(inc.get((s, q)), "OTH")) is not None)
        p.sustainable_roe = bv.sustainable_roe(p.roe_ttm, oth, extra, avg_eq)
        if p.shares is None:
            p.reasons["shares"] = "NO_OUTSTANDING_SHARES"
        if p.adjusted_pb is None:
            p.reasons["adjusted_pb"] = (
                "NO_PRICE" if p.price is None else
                "NO_SHARES" if p.shares is None else
                "NO_PARENT_EQUITY" if p.parent_equity is None else
                "NON_POSITIVE_ADJUSTED_BOOK")
        if p.sustainable_roe is None:
            p.reasons["sustainable_roe"] = "NO_ROE_OR_AVG_EQUITY"
        points.append(p)

    sector = bv.sector_view(points)
    drawn = [p for p in points if p.plottable]
    print(f"  plottable {len(drawn)}/{len(points)}; "
          f"median adj P/B {sector['median_adjusted_pb']:.3f}" if drawn else "  none plottable")
    for p in sorted(drawn, key=lambda x: -(x.sustainable_roe or 0))[:5]:
        print(f"    {p.symbol:5} ROE {p.sustainable_roe:7.2%}  adjP/B {p.adjusted_pb:5.2f}"
              f"  beta {p.beta_blume if p.beta_blume else float('nan'):.2f}")

    rows = [{
        "symbol": p.symbol, "as_of_date": date.today().isoformat(),
        "price": p.price, "price_date": p.price_date, "shares": p.shares,
        "parent_equity": p.parent_equity, "total_assets": p.total_assets,
        "sustainable_roe": p.sustainable_roe, "adjusted_pb": p.adjusted_pb,
        "bvps": p.bvps, "adjusted_bvps": p.adjusted_bvps, "roe_ttm": p.roe_ttm,
        "hidden_npl_unprovisioned": p.hidden_npl_unprovisioned,
        "accrued_overdue": p.accrued_overdue,
        "beta_raw": p.beta_raw, "beta_blume": p.beta_blume,
        "beta_status": p.reasons.get("beta"), "ke": p.ke,
        "target_pb": None, "target_pb_reason": "NO_DIVIDEND_PAYOUT_SOURCE",
        "plottable": p.plottable, "sector": sector, "reasons": p.reasons,
    } for p in points]

    if args.dry_run:
        print(f"\nDRY-RUN: {len(rows)} row(s) not written")
        return 0
    for i in range(0, len(rows), 50):
        safe_execute(
            client.table("fa_bank_valuation").upsert(
                rows[i:i + 50], on_conflict="symbol,as_of_date"),
            label=f"upsert valuation[{i}]")
    print(f"\n{len(rows)} row(s) written")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
