#!/usr/bin/env python3
"""
export_insurance_toan_nganh.py — the Tab Toàn ngành bảo hiểm deliverable.

Implements BA's "Đặc tả triển khai tab Toàn ngành bảo hiểm" (25/09/2026): five
common criteria at 10 points each, the capital-safety gate, and ΔFA — and emits
the §10 hand-over table, the §15 gate table, and an exception list.

It computes and reports; it writes NOTHING to the database and creates no score
rows. The tab is not accepted yet (§13), and a scoring table built before the
thresholds are settled is a table that has to be rebuilt.

THREE THINGS IN HERE ARE DELIBERATELY NOT DECISIONS:

  * `THRESHOLDS` carries BOTH the Production bands BA mandated (§5.1/5.3/5.4)
    and an insurance-specific proposal, each with a `status`. The default is
    PRODUCTION, because that is what BA specified; the proposal exists so the
    difference can be measured rather than argued. Whichever set runs is
    recorded on every output row, so a number can always say which bands made
    it. Same shape as the securities MARKET_BAND_CONFIG.
  * The 12→10 rescale uses 0/3/7/10, NOT ×10/12. BA's own criterion-2 table is
    0/3/7/10 — the integer rendering of the same 0/4/8/12 shape — so this keeps
    one scale across all five criteria instead of mixing 3,33 with 3.
  * ΔFA is emitted in POINTS as well as percent. §11 asks for percent; at a
    50-point scale where totals cluster in the single and low double digits, a
    percentage turns a 14-point move into +350%, so both travel together and BA
    picks the headline.

Usage:
  python3 export_insurance_toan_nganh.py --out ../data/exports/insurance_toan_nganh.xlsx
  python3 export_insurance_toan_nganh.py --out /tmp/x.xlsx --thresholds insurance_proposed
"""

import argparse
import datetime as dt
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa.metrics import _eps_yoy_adjusted
from fa.scoring import _tier_lt
from fa.share_events import Adjustment
from ta.common import get_supabase_client, paged_select, safe_execute

#: Quarters to score. Three is what the EPS history supports (§4: the score at
#: t needs 7 quarters, ΔFA needs 8, and we hold 9).
QUARTERS = ["2025-Q4", "2026-Q1", "2026-Q2"]

#: §2 — 13 symbols; IFA is out of the working universe.
EXCLUDED = {"IFA"}

REV = "IS_TOTAL_NET_REVENUE_FROM_INSURANCE_BUSINESS"
NP_PARENT = "IS_PROFIT_AFTER_TAX_FOR_SHAREHOLDERS_OF_PARENT_COMPANY"
EQUITY, MINORITY, RESERVE = "BS_EQUITY", "BS_MINORITY_INTEREST", "BS_INSURANCE_RESERVES"

#: BA §5.2 — the ONE criterion with its own table, set deliberately so a single
#: growing quarter cannot collect too much (first spec §9.1).
C2_POINTS = {3: 10, 2: 7, 1: 3, 0: 0}

#: Δ buffer YoY bands, as (floor, points) descending. TWO tables, because BA's
#: reply §3 replaced its own earlier one and that is a real scoring change — it
#: has to be measurable on its own rather than folded into the C1/C3/C4
#: comparison it arrived alongside.
#: Each band is (operator, floor, points), tried in order. The OPERATOR matters:
#: the first spec's 3-point band reads "từ -10% đến dưới -5%", so -10 scores 3,
#: while the reply's 0-point band reads "giảm TỪ 10%", so -10 scores 0. A plain
#: >= floor cannot express both, and collapsing them would move a real boundary.
C5_BANDS_V1 = [(">=", 10, 10), (">=", 5, 8), (">=", 0, 7),
               (">=", -5, 5), (">=", -10, 3), (">=", -20, 1)]      # first spec §5.5
C5_BANDS_V2 = [(">=", 10, 10), (">=", 0, 7), (">", -10, 3)]        # reply §3

#: 12-point production tiers → 10, as integers (see the module docstring).
SCALE_12_TO_10 = {0: 0, 4: 3, 8: 7, 12: 10}

#: BA's final table (§5) — the sign cases, locked. A turnaround and a rise from a
#: zero base take the TOP band; a still-negative EPS takes ZERO whatever the
#: percentage says. Only "dương -> dương" reaches the percentage bands at all.
C1_TOP, C1_ZERO = 10, 0


def c1_sign_override(eps_now, eps_base):
    """BA §5's table. Returns points, or None meaning "score the percentage".

    THE NARROWED LOSS IS THE ROW THAT REVERSED. BA's previous reply scored it by
    the formula, so AIC (-391,3 -> -125,5) collected 10 points for a quarter it
    spent losing money. The final ruling is explicit — "doanh nghiệp vẫn có EPS
    âm nhận 0 điểm C1 dù mức lỗ đã thu hẹp" — so a negative EPS now scores zero
    and the improvement survives only as a note. Measured effect below.

    That makes the override total for every case except dương -> dương: the
    percentage is consulted only when both periods are profitable, which is also
    the only case where it means what a reader assumes.
    """
    if eps_now is None or eps_base is None:
        return None
    if eps_base == 0:
        return C1_TOP if eps_now > 0 else C1_ZERO
    if eps_now < 0:
        # lãi sang lỗ, lỗ thu hẹp, lỗ mở rộng — all zero (§5)
        return C1_ZERO
    if eps_base < 0:
        return C1_TOP                      # lỗ sang lãi
    return None                            # dương -> dương: score the percentage


def c1_display_state(eps_now, eps_base):
    """§5's last column — what the UI shows INSTEAD of a percentage, where a
    percentage would mislead. A turnaround renders as "Lỗ sang lãi" rather than
    +413,5%, per BA's ruling."""
    if eps_now is None or eps_base is None:
        return None
    if eps_base == 0:
        return "phat_sinh_loi_nhuan" if eps_now > 0 else "khong_cai_thien"
    if eps_base > 0 and eps_now < 0:
        return "lai_sang_lo"
    if eps_base < 0 and eps_now > 0:
        return "lo_sang_lai"
    if eps_base < 0 and eps_now < 0:
        return "thu_hep_thua_lo" if eps_now > eps_base else "lo_mo_rong"
    return None                            # dương -> dương: show the percentage


def c2_flag(eps_now, eps_base, pct):
    """§5's C2 column. Counted ONLY for dương->dương rising and lỗ->lãi; every
    other row is "không đếm", including a narrowed loss."""
    ov = c1_sign_override(eps_now, eps_base)
    if ov is not None:
        return ov == C1_TOP
    return pct is not None and pct > 0


THRESHOLDS = {
    # The bands the first spec mandated: the Production table, verbatim.
    "production": {
        "status": "BAN_DAU_THEO_BANG_SAN_XUAT",
        "c1": [20, 30, 60],   # production c1, EPS YoY
        "c3": [10, 15, 20],   # production c4, revenue YoY
        "c4": [15, 17, 20],   # production c7, ROE
        "c5_bands": C5_BANDS_V1,
    },
    # BA's reply §3. Still a PROPOSAL: §4 says BA locks it only after seeing this
    # comparison, so neither set wins by being the default.
    "ba_v2": {
        "status": "DE_XUAT_CHO_BA_KHOA",
        "c1": [0, 10, 20],
        "c3": [0, 5, 10],
        "c4": [5, 10, 15],
        "c5_bands": C5_BANDS_V2,
    },
}

#: §5.1 — label a growth rate computed on a base too small to mean anything.
#: 100 đồng/cp is the 7th percentile of |EPS| over the insurance history; it
#: catches BLI's 18,1 without labelling ordinary quarters. PROPOSED.
LOW_BASE_EPS_VND = 100.0

#: §8 — the versions a row must carry so two quarters can be proved comparable.
#: `threshold_set` travels per row already; these two are global to a run.
SCORE_VERSION = "INS_TOAN_NGANH_50_V1"
EPS_NORM_VERSION = "EPS_STD_IAS33_DEDUP_V2"

#: §6.1 — growth gap above this, in percentage points, in two consecutive
#: quarters. BA's figure, still marked a hypothesis in the first spec.
GROWTH_GAP_PP = 20.0


def shift(period: str, back: int) -> str:
    y, q = int(period[:4]), int(period[-1])
    t = y * 4 + (q - 1) - back
    return f"{t // 4}-Q{t % 4 + 1}"


def yoy_pct(now, before):
    """§5 — divided by |base|, so a loss base keeps its sign sense."""
    if now is None or before in (None, 0):
        return None
    return (now - before) / abs(before) * 100.0


def c5_points(delta_pct, bands):
    """A missing buffer returns None, never 0 — 0 is the WORST band, so returning
    it would assert a collapse that was never measured."""
    if delta_pct is None:
        return None
    for op, floor, pts in bands:
        if (delta_pct >= floor) if op == ">=" else (delta_pct > floor):
            return pts
    return 0


def page(client, table, cols, narrow=None, order=("symbol",)):
    def build(off, lim):
        q = client.table(table).select(cols)
        if narrow:
            q = narrow(q)
        for c in order:
            q = q.order(c)
        return q.range(off, off + lim - 1)
    return paged_select(build, label=f"{table} (insurance)")


def load_universe(client):
    rows = page(client, "symbol_profile",
                "symbol,com_type_code,short_name_vi,exchange,icb_l4")
    # §2's three groups. PVI is Holding/Hỗn hợp, NOT non-life — BA corrected
    # this explicitly, and the ICB code alone puts it with the non-life names.
    holding = {"BVH", "PVI"}
    reinsurance = {"PRE", "VNR"}
    out = []
    for r in sorted(rows, key=lambda x: x["symbol"]):
        if r.get("com_type_code") != "BH" or r["symbol"] in EXCLUDED:
            continue
        s = r["symbol"]
        r["insurance_type"] = ("Holding/Hỗn hợp" if s in holding
                               else "Tái bảo hiểm" if s in reinsurance
                               else "Phi nhân thọ")
        out.append(r)
    return out


def load_statements(client, symbols, periods, statement, keys):
    """jsonb PATH select, chunked by period — never the whole `items` blob."""
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


def load_release_dates(client, symbols, periods):
    out = {}
    for r in page(client, "fa_statement_release_dates", "symbol,period,release_date",
                  narrow=lambda q: q.in_("symbol", symbols), order=("symbol", "period")):
        if r["period"] in periods:
            out[(r["symbol"], r["period"])] = r.get("release_date")
    return out


def score_one(symbol, period, data, bands):
    """One symbol-quarter. Returns the §10 row plus the gate inputs."""
    inc, bal, eps, adj = data["inc"], data["bal"], data["eps"], data["adj"]
    ser, A = eps.get(symbol, {}), adj.get(symbol)
    notes = []

    def iv(p, k):
        r = inc.get((symbol, p))
        return r.get(k) if r else None

    def bv(p, k):
        r = bal.get((symbol, p))
        return r.get(k) if r else None

    def parent_equity(p):
        e = bv(p, EQUITY)
        return None if e is None else e - (bv(p, MINORITY) or 0.0)

    def buffer(p):
        e, rsv = bv(p, EQUITY), bv(p, RESERVE)
        return None if e is None or not rsv else e / rsv

    row = {"period": period, "symbol": symbol}

    # --- C1: EPS chuẩn hóa YoY (§5.1) ---
    q4 = shift(period, 4)
    eps_q = (ser.get(period) or {}).get("eps")
    eps_q4 = (ser.get(q4) or {}).get("eps")
    c1 = c1_basis = None
    if period in ser and q4 in ser:
        c1, c1_basis = _eps_yoy_adjusted(ser, period, A)
    # §2 (locked): the sign cases take a band directly; everything else scores
    # the percentage. `c1_rule` records which, so a stored row says why.
    override = c1_sign_override(eps_q, eps_q4)
    if c1 is None:
        c1_pts, c1_rule = None, None
    elif override is not None:
        c1_pts = override
        c1_rule = c1_display_state(eps_q, eps_q4) or "theo_bang_trang_thai"
    else:
        c1_pts = SCALE_12_TO_10[_tier_lt(c1, {"bounds": bands["c1"],
                                              "points": [0, 4, 8, 12]})]
        c1_rule = "theo_cong_thuc"
    row.update(eps_q=eps_q, eps_q_4=eps_q4, c1_eps_yoy_pct=c1, eps_basis=c1_basis,
               c1_points=c1_pts, c1_rule=c1_rule,
               c1_display_state=c1_display_state(eps_q, eps_q4))
    if eps_q4 is not None and abs(eps_q4) < LOW_BASE_EPS_VND:
        notes.append("NEN_SO_SANH_THAP")   # first spec §5.1; the reply drops it
    if c1_basis == "raw" and A:
        notes.append("EPS_KHONG_DOI_CHIEU_DUOC")  # ABI

    # --- C2: số quý EPS tăng trưởng (§5.2) ---
    flags, missing = [], []
    for t in (period, shift(period, 1), shift(period, 2)):
        if t in ser and shift(t, 4) in ser:
            v, _ = _eps_yoy_adjusted(ser, t, A)
            now, base = ser[t].get("eps"), ser[shift(t, 4)].get("eps")
            flags.append(1 if c2_flag(now, base, v) else 0)
        else:
            missing.append(t)
    count = sum(flags) if not missing else None
    row.update(c2_growth_quarters=count, c2_flags="".join(map(str, flags)) or None,
               c2_points=C2_POINTS.get(count) if count is not None else None)

    # --- C3: doanh thu bảo hiểm thuần YoY (§5.3) ---
    rev_q, rev_q4 = iv(period, REV), iv(q4, REV)
    c3 = yoy_pct(rev_q, rev_q4)
    row.update(ins_rev_net_q=rev_q, ins_rev_net_q_4=rev_q4, c3_rev_yoy_pct=c3,
               c3_points=(SCALE_12_TO_10[_tier_lt(c3, {"bounds": bands["c3"],
                                                       "points": [0, 4, 8, 12]})]
                          if c3 is not None else None))

    # --- C4: ROE bốn quý, phạm vi cổ đông mẹ (§5.4) ---
    np4 = [iv(shift(period, i), NP_PARENT) for i in range(4)]
    np_ttm = sum(np4) if all(x is not None for x in np4) else None
    pe_q, pe_q4 = parent_equity(period), parent_equity(q4)
    avg_pe = None if pe_q is None or pe_q4 is None else (pe_q + pe_q4) / 2
    roe = None
    if np_ttm is not None and avg_pe is not None:
        if avg_pe <= 0:
            notes.append("VCSH_BINH_QUAN_KHONG_DUONG")   # §7.4 of the first spec
        else:
            roe = np_ttm / avg_pe * 100
    row.update(np_parent_ttm=np_ttm, parent_equity_q=pe_q, parent_equity_q_4=pe_q4,
               avg_parent_equity=avg_pe, c4_roe_ttm_pct=roe,
               c4_points=(SCALE_12_TO_10[_tier_lt(roe, {"bounds": bands["c4"],
                                                        "points": [0, 4, 8, 12]})]
                          if roe is not None else None))

    # --- C5: xu hướng đệm vốn (§5.5) — YoY trend ONLY; the 20-quarter median
    # position was withdrawn from this criterion in the implementation spec. ---
    buf_q, buf_q4 = buffer(period), buffer(q4)
    d_buf = None if buf_q is None or not buf_q4 else (buf_q / buf_q4 - 1) * 100
    row.update(total_equity=bv(period, EQUITY), tech_reserve_gross=bv(period, RESERVE),
               capital_buffer_q=buf_q, capital_buffer_q_4=buf_q4,
               c5_buffer_trend_pct=d_buf,
               c5_points=c5_points(d_buf, bands["c5_bands"]))

    # --- Cổng an toàn vốn (§6) ---
    eq_yoy = yoy_pct(bv(period, EQUITY), bv(q4, EQUITY))
    gap = None if c3 is None or eq_yoy is None else c3 - eq_yoy
    prev = shift(period, 1)
    gap_prev = None
    gp, ge = yoy_pct(iv(prev, REV), iv(shift(prev, 4), REV)), \
        yoy_pct(bv(prev, EQUITY), bv(shift(prev, 4), EQUITY))
    if gp is not None and ge is not None:
        gap_prev = gp - ge
    two_q = bool(gap is not None and gap_prev is not None
                 and gap > GROWTH_GAP_PP and gap_prev > GROWTH_GAP_PP)

    eq_now = bv(period, EQUITY)
    # Most severe wins (§6.2's stated priority), so the order here is the rule.
    if eq_now is not None and eq_now <= 0:
        gate, cap = "Không đạt", "loại khỏi xếp hạng"
    elif d_buf is not None and d_buf < -20 and (eq_yoy is not None and eq_yoy < 0):
        gate, cap = "Rủi ro cao", 59
    elif (d_buf is not None and d_buf < -10) or two_q:
        gate, cap = "Cảnh báo", 79
    else:
        gate, cap = "Đạt", None
    reasons = []
    if eq_now is not None and eq_now <= 0:
        reasons.append("tổng VCSH <= 0")
    if d_buf is not None and d_buf < -20:
        reasons.append(f"đệm vốn giảm {d_buf:.1f}%")
    elif d_buf is not None and d_buf < -10:
        reasons.append(f"đệm vốn giảm {d_buf:.1f}%")
    if eq_yoy is not None and eq_yoy < 0:
        reasons.append(f"VCSH giảm {eq_yoy:.1f}% YoY")
    if two_q:
        reasons.append(f"khoảng cách tăng trưởng > {GROWTH_GAP_PP:g} đpt hai quý liên tiếp")
    row.update(equity_yoy_pct=eq_yoy, growth_gap_pp=gap, growth_gap_prev_pp=gap_prev,
               two_quarter_flag=two_q, gate_status=gate, gate_cap=cap,
               gate_reason="; ".join(reasons) or "chưa phát hiện cảnh báo vốn từ BCTC")

    pts = [row[f"c{i}_points"] for i in range(1, 6)]
    row["missing_criteria"] = ", ".join(f"C{i}" for i in range(1, 6)
                                        if row[f"c{i}_points"] is None) or None
    row["score_50"] = sum(p for p in pts if p is not None)
    # The 30 and 20 blocks do not exist yet, so there is no /100 total to cap.
    # Reporting a null rather than the 50 is what keeps "not built" distinct
    # from "scored zero" — the rule the securities rubric exists to enforce.
    row["score_efficiency_30"] = None
    row["score_valuation_20"] = None
    row["one_off_deduction"] = None
    row["total_before_gate"] = None
    row["total_after_gate"] = None
    row["notes"] = ", ".join(notes) or None
    return row



def compare_threshold_sets(client, sets=("production", "ba_v2")):
    """BA §4: run both sets on the SAME data and EPS version, then report what
    §4 asks for — per-criterion point distribution, per-symbol rank, and the
    symbols moving 7 points or more.

    Both runs share one load, so a difference can only come from the bands. It
    also means the ΔFA rule of §8 is satisfied by construction: every quarter of
    every set is recomputed in this one pass, never read back from a stored row.
    """
    from collections import Counter

    runs = {name: build_rows(client, THRESHOLDS[name], name) for name in sets}
    latest = QUARTERS[-1]

    # per-criterion distribution over every symbol-quarter
    dist = []
    for name, rows in runs.items():
        for i in range(1, 6):
            c = Counter(r[f"c{i}_points"] for r in rows)
            dist.append({"threshold_set": name, "criterion": f"C{i}",
                         "pts_0": c.get(0, 0), "pts_3": c.get(3, 0),
                         "pts_7": c.get(7, 0), "pts_10": c.get(10, 0),
                         "khong_do_duoc": c.get(None, 0),
                         "diem_trung_binh": round(
                             sum(p for p in (r[f"c{i}_points"] for r in rows) if p is not None)
                             / max(1, sum(1 for r in rows if r[f"c{i}_points"] is not None)), 2)})

    # per-symbol score and rank at the latest quarter, both sets side by side
    def ranked(rows):
        cur = sorted((r for r in rows if r["period"] == latest),
                     key=lambda r: -r["score_50"])
        out, prev, rank = {}, None, 0
        for i, r in enumerate(cur, start=1):
            if r["score_50"] != prev:      # ties share a rank
                rank, prev = i, r["score_50"]
            out[r["symbol"]] = (r["score_50"], rank)
        return out
    a, b = ranked(runs[sets[0]]), ranked(runs[sets[1]])
    rank_rows = []
    for sym in sorted(a):
        sa, ra = a[sym]
        sb, rb = b.get(sym, (None, None))
        rank_rows.append({
            "symbol": sym, "period": latest,
            f"score_{sets[0]}": sa, f"rank_{sets[0]}": ra,
            f"score_{sets[1]}": sb, f"rank_{sets[1]}": rb,
            "delta_score": None if sb is None else sb - sa,
            "delta_rank": None if rb is None else ra - rb,
            # §4: flag a symbol moving 7 points or more
            "moved_7_plus": bool(sb is not None and abs(sb - sa) >= 7),
        })

    # every symbol-quarter whose total moves, not just the latest
    by = {(name, r["symbol"], r["period"]): r for name, rows in runs.items() for r in rows}
    moved = []
    for sym, per in sorted({(r["symbol"], r["period"]) for r in runs[sets[0]]}):
        ra, rb = by[(sets[0], sym, per)], by[(sets[1], sym, per)]
        if ra["score_50"] == rb["score_50"]:
            continue
        row = {"symbol": sym, "period": per,
               f"total_{sets[0]}": ra["score_50"], f"total_{sets[1]}": rb["score_50"],
               "delta": rb["score_50"] - ra["score_50"],
               "moved_7_plus": abs(rb["score_50"] - ra["score_50"]) >= 7}
        for i in range(1, 6):
            row[f"C{i}"] = f"{ra[f'c{i}_points']} -> {rb[f'c{i}_points']}"
        moved.append(row)
    return runs, dist, rank_rows, sorted(moved, key=lambda r: -abs(r["delta"]))



# --- §7: chỉ số phụ "Nền lợi nhuận 5 năm" ----------------------------------- #
# Display only. It scores nothing, changes no EPS, and never touches ΔFA — BA
# §7.1 is explicit. It exists to separate real growth from a recovery off a weak
# base, which the low-EPS flag (§6) cannot do: that flag only catches a small
# DENOMINATOR, not a profit level still below its own multi-year norm.

PROFIT_HISTORY_VERSION = "PROFIT_HISTORY_CONTEXT_V1"

#: §7.4 — at most 20 quarters, t-19..t.
PH_WINDOW_QUARTERS = 20
#: §7.4 — under 8 quarters, no ratio at all.
PH_MIN_QUARTERS = 8
#: §7.8 — and never fewer than 5 valid HISTORICAL TTMs behind the median.
#: These two floors do not agree: 8 quarters yields 5 TTMs, of which the current
#: one is excluded (§7.6), leaving 4 — below this floor. So the effective
#: minimum is 9 quarters. Reported to BA rather than silently reconciled.
PH_MIN_HISTORICAL_TTM = 5
#: §7.8 — ratio bands, in percent.
PH_BANDS = [(120.0, "NEW_HIGHER_BASE"), (100.0, "NORMAL_RANGE"), (70.0, "RECOVERING")]


def profit_history_context(symbol, period, np_by_period):
    """§7. Returns the §7.11 fields for one symbol-quarter.

    Two rules carry the design and are easy to get wrong:

      * THE CURRENT TTM IS EXCLUDED FROM ITS OWN REFERENCE (§7.6). Leaving it in
        lifts numerator and denominator together, so a strong quarter would
        partly hide its own strength.
      * A MISSING HISTORICAL QUARTER INVALIDATES EVERY TTM THAT CONTAINS IT
        (§7.9), not just its own — a TTM is a sum of four, so one hole corrupts
        four windows. Dropping only the aligned TTM would leave three sums
        quietly short a quarter.

    Absence is always a STATUS, never 0 and never a ratio (§7.9, Phụ lục B).
    """
    quarters = [shift(period, i) for i in range(PH_WINDOW_QUARTERS - 1, -1, -1)]
    # §7.4: "chuỗi liên tiếp hợp lệ" — walk back from t and stop at the first
    # hole, so the window is contiguous rather than a set of survivors.
    contiguous = []
    for i in range(PH_WINDOW_QUARTERS):
        q = shift(period, i)
        if np_by_period.get(q) is None:
            break
        contiguous.append(q)
    contiguous.reverse()

    out = {
        "np_ttm_current": None, "historical_ttm_count": 0,
        "median_np_ttm_history": None, "profit_history_ratio_pct": None,
        "profit_history_status": None, "profit_history_note": None,
        "data_start_quarter": contiguous[0] if contiguous else None,
        "data_end_quarter": period,
        "calculation_version": PROFIT_HISTORY_VERSION,
    }

    # §7.9: the current TTM needs all four of its quarters, whatever the history.
    current_four = [np_by_period.get(shift(period, i)) for i in range(4)]
    if any(v is None for v in current_four):
        out["profit_history_status"] = "ERROR_CURRENT_TTM"
        out["profit_history_note"] = ("Thiếu quý trong TTM hiện tại; đưa vào hàng "
                                      "lỗi dữ liệu nội bộ")
        return out
    out["np_ttm_current"] = sum(current_four)

    if len(contiguous) < PH_MIN_QUARTERS:
        out["profit_history_status"] = "INSUFFICIENT_HISTORY"
        out["profit_history_note"] = "Chưa đủ lịch sử để xác định nền lợi nhuận"
        return out

    # Every TTM the contiguous window supports, then drop the current one (§7.6).
    ttms = []
    for end in range(3, len(contiguous)):
        window = contiguous[end - 3:end + 1]
        if window[-1] == period:
            continue
        ttms.append(sum(np_by_period[q] for q in window))
    out["historical_ttm_count"] = len(ttms)

    if len(ttms) < PH_MIN_HISTORICAL_TTM:
        out["profit_history_status"] = "INSUFFICIENT_HISTORY"
        out["profit_history_note"] = "Chưa đủ lịch sử để xác định nền lợi nhuận"
        return out

    median = statistics.median(ttms)
    out["median_np_ttm_history"] = median
    current = out["np_ttm_current"]

    # §7.7: a ratio exists only when BOTH sides are positive. The other three
    # combinations are real economic states with their own codes (§7.8).
    if median <= 0 and current > 0:
        out["profit_history_status"] = "TURNAROUND"
        out["profit_history_note"] = "Chuyển từ nền lịch sử thua lỗ sang có lãi"
        return out
    if median <= 0:
        out["profit_history_status"] = "PERSISTENT_LOSS"
        out["profit_history_note"] = "Vẫn trong nền lợi nhuận âm"
        return out
    if current <= 0:
        out["profit_history_status"] = "CURRENT_LOSS"
        out["profit_history_note"] = "Hiện đang lỗ, thấp hơn nền lịch sử"
        return out

    ratio = current / median * 100.0
    out["profit_history_ratio_pct"] = ratio
    for floor, code in PH_BANDS:
        if ratio >= floor:
            out["profit_history_status"] = code
            break
    else:
        out["profit_history_status"] = "BELOW_NORMAL"
    out["profit_history_note"] = {
        "NEW_HIGHER_BASE": "Đã vượt rõ mặt bằng lợi nhuận lịch sử",
        "NORMAL_RANGE": "Đã trở lại hoặc nhỉnh hơn nền lịch sử",
        "RECOVERING": "Đang phục hồi về mức bình thường",
        "BELOW_NORMAL": "Lợi nhuận vẫn thấp đáng kể so với lịch sử",
    }[out["profit_history_status"]]
    return out


#: §11's hand-over columns, in reading order.
OUTPUT_ORDER = [
    "release_date", "symbol", "name", "insurance_type", "period",
    "eps_q", "eps_q_4", "c1_eps_yoy_pct", "eps_basis", "c1_points", "c1_rule", "c1_display_state",
    "c2_growth_quarters", "c2_flags", "c2_points",
    "ins_rev_net_q", "ins_rev_net_q_4", "c3_rev_yoy_pct", "c3_points",
    "np_parent_ttm", "parent_equity_q", "parent_equity_q_4", "avg_parent_equity",
    "c4_roe_ttm_pct", "c4_points",
    "total_equity", "tech_reserve_gross", "capital_buffer_q", "capital_buffer_q_4",
    "c5_buffer_trend_pct", "c5_points",
    "score_50", "equity_yoy_pct", "growth_gap_pp", "growth_gap_prev_pp",
    "two_quarter_flag", "gate_status", "gate_cap", "gate_reason",
    "prev_period", "prev_score_50", "delta_fa_points", "delta_fa_pct",
    "delta_fa_label",
    # §7.11 — chỉ số phụ, không tác động điểm
    "np_ttm_current", "historical_ttm_count", "median_np_ttm_history",
    "profit_history_ratio_pct", "profit_history_status", "profit_history_note",
    "low_eps_base_flag", "one_off_profit_flag",
    "data_start_quarter", "data_end_quarter", "calculation_version",
    "missing_criteria", "notes",
    "threshold_set", "threshold_status", "score_version", "eps_norm_version",
]


def _ordered(row):
    r = dict(row)
    r["score_version"] = SCORE_VERSION
    r["eps_norm_version"] = EPS_NORM_VERSION
    return {k: r.get(k) for k in OUTPUT_ORDER}


def build_rows(client, bands, set_name):
    """Every symbol-quarter scored under one band set. One load per call site."""
    universe = load_universe(client)
    symbols = [r["symbol"] for r in universe]
    types = {r["symbol"]: r["insurance_type"] for r in universe}
    names = {r["symbol"]: r.get("short_name_vi") for r in universe}
    # The five criteria reach 8 quarters back (§10 of the earlier spec); §7's
    # profit base reaches 20. One load covers the deeper of the two.
    periods = sorted({shift(q, i) for q in QUARTERS
                      for i in range(PH_WINDOW_QUARTERS + 4)})
    data = {
        "inc": load_statements(client, symbols, periods, "income", [REV, NP_PARENT]),
        "bal": load_statements(client, symbols, periods, "balance",
                               [EQUITY, MINORITY, RESERVE]),
    }
    data["eps"], data["adj"] = load_eps(client, symbols)
    rel = load_release_dates(client, symbols, set(QUARTERS))

    # §7.2 — LNST cổ đông mẹ, riêng từng quý, từ BCTC hợp nhất. Verified
    # per-quarter (not cumulative) on this store, so §7.3's subtraction is a
    # no-op here; kept out of the code rather than applied blindly.
    np_by_symbol = {}
    for sym in symbols:
        np_by_symbol[sym] = {
            per: (data["inc"].get((sym, per)) or {}).get(NP_PARENT)
            for per in periods
        }

    rows = []
    for q in QUARTERS:
        for sym in symbols:
            r = score_one(sym, q, data, bands)
            r["name"] = names.get(sym)
            r["insurance_type"] = types.get(sym)
            r["release_date"] = rel.get((sym, q))
            r["threshold_set"] = set_name
            r["threshold_status"] = bands["status"]
            r.update(profit_history_context(sym, q, np_by_symbol[sym]))
            # §6 — the flag as its own column, per §7.11's field list.
            r["low_eps_base_flag"] = bool(
                r.get("eps_q_4") is not None
                and abs(r["eps_q_4"]) < LOW_BASE_EPS_VND)
            # §7.10 — never inferred; only set once an actual one-off is identified.
            r["one_off_profit_flag"] = False
            rows.append(r)

    # §8: ΔFA from scores recomputed in THIS pass, never from a stored row.
    by = {(r["symbol"], r["period"]): r["score_50"] for r in rows}
    for r in rows:
        prev = shift(r["period"], 1)
        before = by.get((r["symbol"], prev))
        r["prev_period"] = prev if before is not None else None
        r["prev_score_50"] = before
        r["delta_fa_points"] = None if before is None else r["score_50"] - before
        # §8: percent only when the previous score is above zero; a zero base
        # renders as a phrase, never as 0%, 100% or N/A.
        if before is None:
            r["delta_fa_pct"], r["delta_fa_label"] = None, None
        elif before > 0:
            r["delta_fa_pct"] = (r["score_50"] / before - 1) * 100
            r["delta_fa_label"] = None
        else:
            r["delta_fa_pct"] = None
            r["delta_fa_label"] = ("Mới xuất hiện cải thiện" if r["score_50"] > 0
                                   else "Chưa có cải thiện")
    return rows



def main() -> int:
    ap = argparse.ArgumentParser(description="Tab Toàn ngành bảo hiểm deliverable")
    ap.add_argument("--out", required=True)
    ap.add_argument("--thresholds", default="ba_v2", choices=sorted(THRESHOLDS))
    ap.add_argument("--compare", action="store_true",
                    help="BA §4: run both band sets and emit the comparison sheets")
    args = ap.parse_args()

    client = get_supabase_client()
    from collections import Counter

    if args.compare:
        sets = ("production", "ba_v2")
        runs, dist, rank_rows, moved = compare_threshold_sets(client, sets)
        for name in sets:
            tot = [r["score_50"] for r in runs[name] if r["period"] == QUARTERS[-1]]
            print(f"{name:<12} {QUARTERS[-1]} /50: min {min(tot)} · "
                  f"median {statistics.median(tot):.0f} · max {max(tot)}")
        print(f"symbol-quarters whose total moves: {len(moved)} of {len(runs[sets[0]])}"
              f" · moving 7+ points: {sum(1 for r in moved if r['moved_7_plus'])}")
        rows = runs[sets[1]]
        sheets = {
            "phan_bo_diem": dist,               # §4 bullet 2
            "thu_hang": rank_rows,              # §4 bullet 3
            "thay_doi_diem": moved or [{"note": "không có thay đổi"}],   # §4 bullet 4
            "bang_kiem_tra_production": [_ordered(r) for r in runs["production"]],
            "bang_kiem_tra_ba_v2": [_ordered(r) for r in runs["ba_v2"]],
        }
    else:
        bands = THRESHOLDS[args.thresholds]
        rows = build_rows(client, bands, args.thresholds)
        print(f"threshold set: {args.thresholds} ({bands['status']})")
        sheets = {"bang_kiem_tra": [_ordered(r) for r in rows]}

    latest = [r for r in rows if r["period"] == QUARTERS[-1]]
    tot = [r["score_50"] for r in latest]
    na = [r for r in rows if r["missing_criteria"]]
    print(f"universe {len({r['symbol'] for r in rows})} · rows {len(rows)} · "
          f"quarters {', '.join(QUARTERS)}")
    print(f"{QUARTERS[-1]} score/50: min {min(tot)} · median {statistics.median(tot):.0f} "
          f"· max {max(tot)}")
    print(f"gate: {dict(Counter(r['gate_status'] for r in latest))}")
    print(f"rows with a missing criterion: {len(na)}")

    gate_table = [{k: r.get(k) for k in
                   ("symbol", "period", "capital_buffer_q", "capital_buffer_q_4",
                    "c5_buffer_trend_pct", "equity_yoy_pct", "growth_gap_pp",
                    "growth_gap_prev_pp", "two_quarter_flag", "gate_status",
                    "gate_cap", "gate_reason")} for r in latest]
    exceptions = [{"symbol": r["symbol"], "period": r["period"],
                   "issue": r["notes"] or r["missing_criteria"],
                   "detail": r["gate_reason"]}
                  for r in rows if r["notes"] or r["missing_criteria"]]
    summary = [
        {"metric": "mode", "value": "compare" if args.compare else args.thresholds},
        {"metric": "universe", "value": len({r["symbol"] for r in rows})},
        {"metric": "quarters", "value": ", ".join(QUARTERS)},
        {"metric": "rows per set", "value": len(rows)},
        {"metric": f"{QUARTERS[-1]} min /50", "value": min(tot)},
        {"metric": f"{QUARTERS[-1]} median /50", "value": statistics.median(tot)},
        {"metric": f"{QUARTERS[-1]} max /50", "value": max(tot)},
        {"metric": "rows with a missing criterion", "value": len(na)},
        *[{"metric": f"gate {k}", "value": v}
          for k, v in sorted(Counter(r["gate_status"] for r in latest).items())],
        {"metric": "caps applied", "value": "none — BA §7, not in the 50-point scale"},
        {"metric": "blocks not built", "value": "50 điểm chuyên sâu theo loại hình"},
    ]

    from export_fa_scanner import write_xlsx
    out = Path(args.out)
    write_xlsx(out, {"summary": summary, **sheets,
                     "cong_an_toan_von": gate_table,
                     "ngoai_le": exceptions or [{"note": "không có ngoại lệ"}],
                     "universe": load_universe(client),
                     "meta": [{"key": "generated_at",
                               "value": dt.datetime.now().isoformat(timespec="seconds")},
                              {"key": "spec", "value": "BA phản hồi IT tab Toàn ngành bảo hiểm"},
                              {"key": "eps_formula", "value": "(EPS_t - EPS_t-4) / |EPS_t-4|, BA §2"},
                              {"key": "scale", "value": "0/3/7/10, BA §3"},
                              {"key": "score_version", "value": SCORE_VERSION},
                              {"key": "eps_normalization_version", "value": EPS_NORM_VERSION},
                              {"key": "writes_to_db", "value": "none"}]})
    print(f"Wrote {out} ({out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
