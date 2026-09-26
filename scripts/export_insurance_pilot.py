#!/usr/bin/env python3
"""
export_insurance_pilot.py — the data-feasibility check BA asked for in
"Đặc tả kiểm tra dữ liệu 5 tiêu chí Toàn ngành Bảo hiểm" (2026-09-24).

It answers ONE question: can the five common criteria be sourced or derived,
consistently, for every insurer over BA's 20-quarter window? So it writes the
two artefacts §11.2 and §11.3 name — a coverage matrix and an exception report —
plus the recomputed values and the distributions §6.4 and §8.4 say must be
looked at BEFORE any threshold is fixed.

It scores NOTHING and writes NOTHING back to the database. Thresholds are
deliberately absent: BA reserves them until the distributions are reviewed, and
a number hard-coded here would pre-empt that decision.

Two rules carried over from the rest of the FA pipeline:

  * Reads go by jsonb PATH (`items->KEY`) and are chunked by period. Pulling
    whole `items` blobs at 1,000 rows a page is what exhausted the disk-IO
    budget on 2026-09-22.
  * An absent value is reported as FAIL_DATA / FAIL_MAPPING and never as 0.
    BA's Phụ lục B forbids the substitution, and `_tier_lt(None)` returning the
    BOTTOM tier is why it matters here too.

Usage:
  python3 export_insurance_pilot.py --out ../data/exports/insurance_pilot.xlsx
"""

import argparse
import datetime as dt
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa.metrics import _eps_yoy_adjusted  # the Production EPS engine, per BA §4.2
from fa.share_events import Adjustment
from ta.common import get_supabase_client, paged_select, safe_execute

#: BA's evaluation quarter and the 20-quarter window behind it.
EVAL_Q = "2026-Q2"
WINDOW = 20

#: The insurance universe: every symbol carrying an insurance ICB code. Verified
#: to be exactly the symbols typed `BH` in symbol_profile, so neither test
#: leaks a name the other keeps.
INS_L4 = {"8532", "8534", "8536", "8538", "8575", "8577"}

#: Line items, by criterion. The insurance income statement is its own template
#: — these names do not exist on the non-financial one.
REV = "IS_TOTAL_NET_REVENUE_FROM_INSURANCE_BUSINESS"   # BA §6.2, "doanh thu thuần HĐKD bảo hiểm"
NP_PARENT = "IS_PROFIT_AFTER_TAX_FOR_SHAREHOLDERS_OF_PARENT_COMPANY"
EQUITY = "BS_EQUITY"                                    # includes minority interest (measured)
MINORITY = "BS_MINORITY_INTEREST"
RESERVE = "BS_INSURANCE_RESERVES"                       # gross technical reserve, BA §8.2
INCOME_KEYS = [REV, NP_PARENT]
BALANCE_KEYS = [EQUITY, MINORITY, RESERVE]


def shift(period: str, back: int) -> str:
    y, q = int(period[:4]), int(period[-1])
    t = y * 4 + (q - 1) - back
    return f"{t // 4}-Q{t % 4 + 1}"


def window(end: str, n: int) -> list[str]:
    return [shift(end, i) for i in range(n - 1, -1, -1)]


def pct_change(now, before):
    """BA's formula: divided by |base|, so a loss base keeps its sign sense."""
    if now is None or before in (None, 0):
        return None
    return (now - before) / abs(before) * 100.0


def page(client, table, cols, narrow=None, order=("symbol",)):
    def build(off, lim):
        q = client.table(table).select(cols)
        if narrow:
            q = narrow(q)
        for c in order:
            q = q.order(c)
        return q.range(off, off + lim - 1)
    return paged_select(build, label=f"{table} (insurance pilot)")


def load_universe(client) -> list[dict]:
    rows = page(client, "symbol_profile",
                "symbol,com_type_code,short_name_vi,name_vi,exchange,icb_l2,icb_l4")
    ins = [r for r in rows
           if r.get("icb_l4") in INS_L4 or r.get("com_type_code") == "BH"]
    return sorted(ins, key=lambda r: r["symbol"])


def load_statements(client, symbols, periods, statement, keys) -> dict:
    """jsonb PATH select, one request per period — never the whole `items`."""
    sel = "symbol,period," + ",".join(f"{k}:items->{k}" for k in keys)
    out = {}
    for p in periods:
        rows = safe_execute(
            client.table("fa_vnstock_statements").select(sel)
            .in_("symbol", symbols).eq("period_type", "quarter")
            .eq("statement", statement).eq("period", p),
            label=f"{statement} {p}").data or []
        for r in rows:
            out[(r["symbol"], p)] = {
                k: (float(r[k]) if r[k] is not None else None) for k in keys}
    return out


def load_eps(client, symbols):
    """The Production table's OWN EPS and restatement factors (BA §4.2: do not
    reopen the standardisation)."""
    eps, adj = {}, {}
    for r in page(client, "fa_quarterly", "symbol,period,eps",
                  narrow=lambda q: q.in_("symbol", symbols), order=("symbol", "period")):
        if r.get("eps") is not None:
            eps.setdefault(r["symbol"], {})[r["period"]] = {"eps": r["eps"]}
    for r in page(client, "fa_share_adjustments",
                  "symbol,period,shares,k_technical,total_ratio,data_ok,reason",
                  narrow=lambda q: q.in_("symbol", symbols), order=("symbol", "period")):
        adj.setdefault(r["symbol"], {})[r["period"]] = Adjustment(
            period=r["period"], shares=r.get("shares"),
            k_technical=r.get("k_technical") or 1.0,
            total_ratio=r.get("total_ratio") or 1.0,
            data_ok=bool(r.get("data_ok")), reason=r.get("reason") or "")
    return eps, adj


def status_of(value, present_row: bool) -> str:
    """BA §3.2. A row that does not exist is FAIL_DATA; a 0.0 on a line the
    template always emits is reported separately as a zero, never as data."""
    if not present_row:
        return "FAIL_DATA"
    if value is None:
        return "FAIL_DATA"
    return "DIRECT"


def build(client):
    universe = load_universe(client)
    symbols = [r["symbol"] for r in universe]
    periods = window(EVAL_Q, WINDOW + 8)   # 8 extra so a 20q median has YoY behind it
    inc = load_statements(client, symbols, periods, "income", INCOME_KEYS)
    bal = load_statements(client, symbols, periods, "balance", BALANCE_KEYS)
    eps, adj = load_eps(client, symbols)
    w20 = window(EVAL_Q, WINDOW)

    coverage, exceptions, recomputed = [], [], []
    dist = {"level_gap": [], "buffer_trend": [], "growth_gap": [], "buffer": []}

    for meta in universe:
        s = meta["symbol"]
        ser, A = eps.get(s, {}), adj.get(s)

        def inc_of(p, k):
            r = inc.get((s, p))
            return r.get(k) if r else None

        def bal_of(p, k):
            r = bal.get((s, p))
            return r.get(k) if r else None

        def buffer(p):
            e, rsv = bal_of(p, EQUITY), bal_of(p, RESERVE)
            if e is None or not rsv:
                return None
            return e / rsv

        def add_exception(period, field, kind, found, why, fix):
            exceptions.append({"symbol": s, "period": period, "field": field,
                               "error": kind, "label_found": found,
                               "explanation": why, "proposed_fix": fix})

        # ---- coverage matrix: one row per symbol-quarter -------------------
        for p in w20:
            has_inc, has_bal = (s, p) in inc, (s, p) in bal
            c_eps = "DIRECT" if p in ser else "FAIL_DATA"
            c_rev = status_of(inc_of(p, REV), has_inc)
            c_np = status_of(inc_of(p, NP_PARENT), has_inc)
            c_eq = status_of(bal_of(p, EQUITY), has_bal)
            c_rsv = status_of(bal_of(p, RESERVE), has_bal)
            cells = [c_eps, c_rev, c_np, c_eq, c_rsv]
            coverage.append({
                "symbol": s, "period": p,
                "eps_std": c_eps, "ins_rev_net": c_rev, "np_parent": c_np,
                "total_equity": c_eq,
                # parent equity is equity minus minority — a derivation, so DERIVED
                "parent_equity": "DERIVED" if c_eq == "DIRECT" else c_eq,
                "tech_reserve_gross": c_rsv,
                "result": "PASS" if all(c != "FAIL_DATA" for c in cells) else "FAIL",
            })
            if c_eps == "FAIL_DATA":
                add_exception(p, "eps_std", "FAIL_DATA", "fa_quarterly.eps",
                              "Bộ EPS chuẩn hóa (FiinProX) chỉ bắt đầu từ 2024-Q2.",
                              "Mở rộng lịch sử EPS chuẩn hóa, hoặc thu hẹp cửa sổ kiểm tra EPS.")
            if not has_inc or not has_bal:
                add_exception(p, "bctc", "FAIL_DATA", "fa_vnstock_statements",
                              "Không có BCTC quý này cho mã.",
                              "Xác nhận doanh nghiệp chưa niêm yết/chưa tồn tại ở kỳ này.")

        # ---- tiêu chí 1: EPS chuẩn hóa YoY --------------------------------
        c1 = c1_basis = None
        if p_ok := (EVAL_Q in ser and shift(EVAL_Q, 4) in ser):
            c1, c1_basis = _eps_yoy_adjusted(ser, EVAL_Q, A)
            if c1_basis == "raw" and A:
                add_exception(EVAL_Q, "eps_std", "FAIL_MAPPING", "fa_share_adjustments",
                              "Cửa sổ điều chỉnh cổ phiếu không đối chiếu được; EPS YoY đang "
                              "dùng số như đã công bố dù số cổ phiếu đã thay đổi.",
                              "Đối chiếu nghị quyết phát hành với số cổ phiếu trên BCTC.")

        # ---- tiêu chí 2: số quý EPS tăng trưởng ----------------------------
        flags, missing = [], []
        for t in (EVAL_Q, shift(EVAL_Q, 1), shift(EVAL_Q, 2)):
            if t in ser and shift(t, 4) in ser:
                v, _ = _eps_yoy_adjusted(ser, t, A)
                flags.append(1 if v > 0 else 0)
            else:
                missing.append(t)
        c2 = sum(flags) if not missing else None
        c2_pts = {3: 10, 2: 7, 1: 3, 0: 0}.get(c2)   # BA §5.3, the only fixed scale

        # ---- tiêu chí 3: doanh thu bảo hiểm thuần YoY ----------------------
        c3 = pct_change(inc_of(EVAL_Q, REV), inc_of(shift(EVAL_Q, 4), REV))
        eq_growth = pct_change(bal_of(EVAL_Q, EQUITY), bal_of(shift(EVAL_Q, 4), EQUITY))
        gap = None if c3 is None or eq_growth is None else c3 - eq_growth
        prev = shift(EVAL_Q, 1)
        c3_prev = pct_change(inc_of(prev, REV), inc_of(shift(prev, 4), REV))
        eq_prev = pct_change(bal_of(prev, EQUITY), bal_of(shift(prev, 4), EQUITY))
        gap_prev = None if c3_prev is None or eq_prev is None else c3_prev - eq_prev
        # BA §6.4 threshold is a HYPOTHESIS, reported not applied.
        two_q_fast = (gap is not None and gap_prev is not None
                      and gap > 20 and gap_prev > 20)

        # ---- tiêu chí 4: ROE bốn quý, phạm vi cổ đông mẹ -------------------
        np4 = [inc_of(shift(EVAL_Q, i), NP_PARENT) for i in range(4)]

        def parent_equity(p):
            e = bal_of(p, EQUITY)
            return None if e is None else e - (bal_of(p, MINORITY) or 0.0)
        pe_now, pe_year_ago = parent_equity(EVAL_Q), parent_equity(shift(EVAL_Q, 4))
        roe = avg_eq = None
        if all(x is not None for x in np4) and pe_now is not None and pe_year_ago is not None:
            avg_eq = (pe_now + pe_year_ago) / 2
            roe = None if avg_eq <= 0 else sum(np4) / avg_eq * 100
            if avg_eq <= 0:
                add_exception(EVAL_Q, "avg_parent_equity", "FAIL_DATA", "BS_EQUITY",
                              "VCSH bình quân <= 0; ROE không có ý nghĩa.",
                              "BA §7.4: ROE_SCORE = 0 và bật cờ vốn nghiêm trọng.")

        # ---- tiêu chí 5: đệm vốn BCTC -------------------------------------
        hist = [buffer(p) for p in w20]
        hist_ok = [h for h in hist if h is not None]
        buf_now = buffer(EVAL_Q)
        median20 = statistics.median(hist_ok) if hist_ok else None
        level_gap = None if buf_now is None or not median20 else buf_now / median20 - 1
        buf_year_ago = buffer(shift(EVAL_Q, 4))
        trend = None if buf_now is None or not buf_year_ago else buf_now / buf_year_ago - 1

        # A reserve series with a step change is not a series. Report it rather
        # than letting the median absorb it.
        ratios = [(w20[i], hist[i], hist[i - 1]) for i in range(1, len(hist))
                  if hist[i] and hist[i - 1]]
        for p, now, before in ratios:
            if before and (now / before > 5 or now / before < 0.2):
                add_exception(p, "tech_reserve_gross", "FAIL_MAPPING", RESERVE,
                              f"Đệm vốn đổi {before:.3f} -> {now:.3f} trong một quý: "
                              "chuỗi dự phòng đổi phạm vi trình bày.",
                              "Loại các kỳ trước bước nhảy khỏi trung vị 20 quý.")

        if level_gap is not None:
            dist["level_gap"].append(level_gap)
        if trend is not None:
            dist["buffer_trend"].append(trend)
        if gap is not None:
            dist["growth_gap"].append(gap)
        for h in hist_ok:
            dist["buffer"].append(h)

        recomputed.append({
            "symbol": s, "name": meta.get("short_name_vi"),
            "exchange": meta.get("exchange"), "icb_l4": meta.get("icb_l4"),
            "period": EVAL_Q,
            "c1_eps_yoy_pct": c1, "c1_eps_basis": c1_basis,
            "eps_q": (ser.get(EVAL_Q) or {}).get("eps"),
            "eps_q_4": (ser.get(shift(EVAL_Q, 4)) or {}).get("eps"),
            "c2_growth_quarters": c2, "c2_points": c2_pts,
            "c2_flags": "".join(str(f) for f in flags) or None,
            "c3_rev_yoy_pct": c3, "equity_yoy_pct": eq_growth,
            "growth_gap_pp": gap, "growth_gap_prev_pp": gap_prev,
            "fast_growth_two_quarters": two_q_fast,
            "np_parent_ttm": sum(np4) if all(x is not None for x in np4) else None,
            "avg_parent_equity": avg_eq, "c4_roe_ttm_pct": roe,
            "capital_buffer": buf_now, "median_20q": median20,
            "quarters_in_median": len(hist_ok),
            "c5_level_gap_pct": None if level_gap is None else level_gap * 100,
            "c5_buffer_trend_pct": None if trend is None else trend * 100,
        })

    return universe, coverage, exceptions, recomputed, dist


def percentiles(values):
    v = sorted(values)
    if not v:
        return {}
    def q(p):
        i = (len(v) - 1) * p
        lo, hi = int(i), min(int(i) + 1, len(v) - 1)
        return v[lo] + (v[hi] - v[lo]) * (i - lo)
    return {"n": len(v), "min": q(0), "p10": q(.10), "p25": q(.25),
            "median": q(.5), "p75": q(.75), "p90": q(.90), "max": q(1)}


def main() -> int:
    ap = argparse.ArgumentParser(description="Insurance 5-criteria data feasibility check")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    client = get_supabase_client()
    universe, coverage, exceptions, recomputed, dist = build(client)

    n_pass = sum(1 for r in coverage if r["result"] == "PASS")
    print(f"universe {len(universe)} · coverage cells {len(coverage)} "
          f"({n_pass} PASS, {len(coverage) - n_pass} FAIL) · exceptions {len(exceptions)}")

    summary = [
        {"metric": "symbols in universe", "value": len(universe)},
        {"metric": "evaluation quarter", "value": EVAL_Q},
        {"metric": "window (quarters)", "value": WINDOW},
        {"metric": "coverage rows", "value": len(coverage)},
        {"metric": "coverage PASS", "value": n_pass},
        {"metric": "coverage FAIL", "value": len(coverage) - n_pass},
        {"metric": "exceptions", "value": len(exceptions)},
    ]
    for name, vals in dist.items():
        p = percentiles(vals)
        if p:
            summary.append({"metric": f"{name} n", "value": p["n"]})
            for k in ("min", "p10", "p25", "median", "p75", "p90", "max"):
                summary.append({"metric": f"{name} {k}", "value": round(p[k], 4)})

    from export_fa_scanner import write_xlsx
    out = Path(args.out)
    write_xlsx(out, {
        "summary": summary,
        "coverage_matrix": coverage,
        "exception_report": exceptions or [{"note": "no exceptions"}],
        "recomputed": recomputed,
        "universe": universe,
        "meta": [{"key": "generated_at",
                  "value": dt.datetime.now().isoformat(timespec="seconds")},
                 {"key": "source", "value": "fa_vnstock_statements + fa_quarterly + fa_share_adjustments"},
                 {"key": "thresholds_applied", "value": "none — BA approves after reviewing distributions"}],
    })
    print(f"Wrote {out} ({out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
