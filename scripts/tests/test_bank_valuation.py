#!/usr/bin/env python3
"""Chart 10 — peer valuation matrix arithmetic and its refusals.

The cases that matter here are the ones where a plausible number would be
WRONG rather than merely absent: a negative adjusted book plotting as the
cheapest bank on the chart, over-provisioning adding to book value, and beta
pairing two series by position when they do not hold the same weeks.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fa import bank_valuation as bv

FAILS = 0


def check(name, cond, detail=""):
    global FAILS
    if cond:
        print(f"  ok   {name}")
    else:
        FAILS += 1
        print(f"  FAIL {name} {detail}")


def weekly_resampling():
    print("weekly resampling")
    bars = [("2026-01-05", 10.0), ("2026-01-07", 11.0), ("2026-01-09", 12.0),
            ("2026-01-12", 13.0), ("2026-01-16", 14.0)]
    w = bv.weekly_closes(bars)
    check("one close per ISO week", len(w) == 2, str(w))
    check("it is the LAST of the week", w[0] == ("2026-01-09", 12.0), str(w[0]))
    check("non-positive closes are dropped",
          bv.weekly_closes([("2026-01-05", 0.0), ("2026-01-07", 11.0)])[0][1] == 11.0)


def beta_pairs_by_date():
    """A suspended week must not slide the phase for every later week."""
    print("beta pairs by date, not position")
    idx = [(f"2026-01-{d:02d}", 100.0 * (1.02 ** i)) for i, d in enumerate(range(5, 32, 7))]
    idx += [(f"2026-02-{d:02d}", 110.0 * (1.02 ** i)) for i, d in enumerate(range(2, 30, 7))]
    sym = [(d, p * 2) for d, p in idx]
    raw, blume, status = bv.beta(sym, idx)
    check("too few weeks is refused, not estimated",
          raw is None and status.startswith("INSUFFICIENT_WEEKS"), status)

    # 60 aligned weeks of VARYING returns. A constant-return series has zero
    # variance and beta is undefined there -- the first version of this fixture
    # used one and measured float noise (-5.8e12), which is what added the
    # near-zero-variance guard.
    import datetime as dt
    base = dt.date(2025, 1, 6)
    days = [(base + dt.timedelta(weeks=i)).isoformat() for i in range(60)]
    rets = [0.03 * math.sin(i * 1.1) + 0.004 for i in range(59)]

    def series(start, scale):
        out, p = [(days[0], start)], start
        for d, r in zip(days[1:], rets):
            p *= 1 + scale * r
            out.append((d, p))
        return out

    idx = series(100.0, 1.0)
    raw, blume, status = bv.beta(series(50.0, 1.0), idx)
    check("a bank that moves with the market has beta 1",
          raw is not None and abs(raw - 1.0) < 1e-6, f"{raw}")
    check("Blume leaves beta 1 alone", abs(blume - 1.0) < 1e-6, f"{blume}")

    raw2, blume2, _ = bv.beta(series(50.0, 2.0), idx)
    check("twice the market's moves gives beta ~2", 1.9 < raw2 < 2.1, f"{raw2:.3f}")
    check("Blume shrinks it toward the market",
          raw2 > blume2 > 1.0, f"raw {raw2:.3f} blume {blume2:.3f}")

    # Drop one week from the SYMBOL only. Pairing by position would misalign
    # every later week; pairing by date costs only that observation.
    gapped = [p for p in series(50.0, 2.0) if p[0] != days[30]]
    raw3, _, _ = bv.beta(gapped, idx)
    check("one missing week barely moves beta", abs(raw3 - raw2) < 0.1,
          f"{raw2:.3f} -> {raw3:.3f}")

    flat = [(d, 100.0) for d in days]
    check("a flat benchmark is refused, not amplified",
          bv.beta(series(50.0, 1.0), flat)[2] == "DEGENERATE_BENCHMARK")

def provisioning_floor():
    print("over-provisioning cannot add to book value")
    # VCB's real shape: provisions exceed classified debt.
    check("floored at zero",
          bv.hidden_npl_unprovisioned(15_188e9, -29_985e9) == 0.0)
    check("a genuine shortfall is the difference",
          bv.hidden_npl_unprovisioned(76_300e9, -34_695e9) == 76_300e9 - 34_695e9)
    check("provision sign does not matter",
          bv.hidden_npl_unprovisioned(100.0, -40.0) == bv.hidden_npl_unprovisioned(100.0, 40.0))
    check("absent input stays absent",
          bv.hidden_npl_unprovisioned(None, -40.0) is None)


def accrued_scaling():
    print("accrued interest scales with the bank's own stress")
    check("stressed book writes more off",
          bv.accrued_overdue(1000.0, 50.0, 50.0, 1000.0) == 100.0)
    check("capped at 100% of accrued",
          bv.accrued_overdue(1000.0, 900.0, 900.0, 1000.0) == 1000.0)
    check("a clean book writes off ~nothing",
          bv.accrued_overdue(1000.0, 1.0, 1.0, 1000.0) == 2.0)
    check("no book is absent, not zero",
          bv.accrued_overdue(1000.0, 1.0, 1.0, 0.0) is None)


def negative_book_is_not_cheap():
    """The case a plausible number would get badly wrong."""
    print("a wiped-out book does not plot as the cheapest bank")
    bvps, adj = bv.adjusted_bvps(10_000e9, 1e9, hidden=20_000e9, overdue=5_000e9, eff_tax=0.2)
    check("adjusted book goes negative", adj < 0, f"{adj:,.2f}")
    p = bv.BankPoint(symbol="X", adjusted_bvps=adj, adjusted_pb=20_000 / adj,
                     sustainable_roe=0.05)
    check("the implied P/B is negative", p.adjusted_pb < 0)
    check("and the point is NOT plotted", not p.plottable)
    good = bv.BankPoint(symbol="Y", adjusted_bvps=10_000.0, adjusted_pb=1.4,
                        sustainable_roe=0.18)
    check("a healthy bank plots", good.plottable)
    check("a missing coordinate does not plot",
          not bv.BankPoint(symbol="Z", adjusted_bvps=1.0, adjusted_pb=1.0).plottable)


def parent_equity_basis():
    print("the haircut is after tax and per share")
    bvps, adj = bv.adjusted_bvps(100.0, 10.0, hidden=20.0, overdue=10.0, eff_tax=0.2)
    check("BVPS is equity per share", bvps == 10.0)
    check("haircut is (1-t) x loss / shares", abs(adj - (10.0 - 0.8 * 30.0 / 10.0)) < 1e-9,
          f"{adj}")
    check("no shares is absent", bv.adjusted_bvps(100.0, 0, None, None, 0.2) == (None, None))


def extra_provision_is_a_flow():
    """The defect reading B fixes: a STOCK subtracted from an annual RETURN.

    The first implementation used the accumulated shortfall, and HDB -- the
    sector's highest reported ROE at 25.8% -- came out at -29.5%, with the
    sector median "sustainable" ROE at -5.3%.
    """
    print("extra provision is a flow, not the accumulated stock")
    check("the year's movement is the charge",
          bv.extra_provision_charge(500.0, 300.0) == 200.0)
    check("provisioning faster than debt grew is not a bonus",
          bv.extra_provision_charge(300.0, 500.0) == 0.0)
    check("no year-ago figure is absent, not zero",
          bv.extra_provision_charge(500.0, None) is None)

    # HDB's shape: a large standing shortfall that barely moved.
    equity, roe = 100.0, 0.258
    stock_now, stock_ago = 47.0, 45.0
    as_stock = bv.sustainable_roe(roe, 0.0, stock_now, equity)
    as_flow = bv.sustainable_roe(
        roe, 0.0, bv.extra_provision_charge(stock_now, stock_ago), equity)
    check("the stock reading drives a strong bank deeply negative", as_stock < -0.15,
          f"{as_stock:.1%}")
    check("the flow reading keeps it positive", as_flow > 0, f"{as_flow:.1%}")
    check("a DETERIORATING bank is still marked down",
          bv.sustainable_roe(roe, 0.0,
                             bv.extra_provision_charge(80.0, 45.0), equity) < 0,
          "shortfall grew 35 against 100 of equity")


def sustainable_roe_cases():
    print("sustainable ROE")
    r = bv.sustainable_roe(0.20, non_recurring_ttm=10.0, extra_provision=10.0,
                           avg_equity=100.0)
    check("both deductions apply", abs(r - 0.0) < 1e-9, f"{r}")
    check("absent deductions are skipped, not zeroed",
          bv.sustainable_roe(0.20, None, None, 100.0) == 0.20)
    check("no equity is absent", bv.sustainable_roe(0.20, 1.0, 1.0, 0) is None)


def sector_and_diagonal():
    print("sector view")
    pts = [bv.BankPoint(symbol=s, adjusted_bvps=1.0, adjusted_pb=pb, sustainable_roe=roe)
           for s, pb, roe in [("A", 1.0, 0.10), ("B", 2.0, 0.20), ("C", 3.0, 0.30)]]
    pts.append(bv.BankPoint(symbol="D", adjusted_bvps=-1.0, adjusted_pb=-5.0,
                            sustainable_roe=0.05))
    v = bv.sector_view(pts)
    check("the wiped-out bank leaves the median", v["n_valid"] == 3)
    check("median is of the valid set", v["median_adjusted_pb"] == 2.0)
    check("diagonal starts at (g, 0)", v["diagonal"]["x0"] == bv.G_SECTOR
          and v["diagonal"]["y0"] == 0.0)
    check("diagonal ends at the widest ROE", v["diagonal"]["x1"] == 0.30)
    check("the line is (x-g)/(Ke-g)", abs(bv.target_pb_sector(0.12) - 1.0) < 1e-9)
    check("ROE = g gives P/B 1.0x... at g it is 0", abs(bv.target_pb_sector(0.07)) < 1e-9)
    check("no valid points -> no median", bv.sector_view([])["median_adjusted_pb"] is None)


def peer_selection():
    print("peer labelling (BA round 3 Top-8 fallback)")
    pts = [bv.BankPoint(symbol=s, total_assets=a) for s, a in [
        ("VCB", 2_600_000), ("BID", 3_000_000), ("CTG", 2_900_000), ("TCB", 1_100_000),
        ("MBB", 1_200_000), ("VPB", 1_000_000), ("ACB", 900_000), ("STB", 800_000),
        ("NVB", 130_000), ("PGB", 70_000), ("SGB", 40_000), ("BVB", 100_000),
        ("KLB", 90_000), ("VAB", 120_000)]]
    g = bv.peer_group("VCB", pts)
    check("an anchor gets the eight anchors", set(g) == set(bv.ANCHORS), str(g))
    g2 = bv.peer_group("NVB", pts)
    check("a tier-2 bank is included", "NVB" in g2)
    check("the five tier-2 anchors are included",
          all(a in g2 for a in bv.TIER2_ANCHORS), str(g2))
    check("at most 12 labels", len(g2) <= bv.MAX_LABELLED, str(len(g2)))
    check("nearest-by-size are picked, not the largest",
          "VAB" in g2 and "BVB" in g2, str(g2))
    check("no duplicates", len(g2) == len(set(g2)))


if __name__ == "__main__":
    weekly_resampling()
    beta_pairs_by_date()
    provisioning_floor()
    accrued_scaling()
    negative_book_is_not_cheap()
    extra_provision_is_a_flow()
    parent_equity_basis()
    sustainable_roe_cases()
    sector_and_diagonal()
    peer_selection()
    print(f"\n{'FAILED' if FAILS else 'PASSED'}: {FAILS} failure(s)")
    raise SystemExit(1 if FAILS else 0)
