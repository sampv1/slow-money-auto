#!/usr/bin/env python3
"""Pin C1/C2/C3 on the IAS 33 restated EPS, and C9 staying as it was.

Runnable directly (`python3 scripts/tests/test_fa_eps_adjusted.py`) or under
pytest. No network.

Why each case is here:

1. A stock dividend made FPT's as-filed EPS read -1.7% YoY where the same
   earnings restated read +13.7%. The rubric scored the first, which is the
   defect this change fixes.
2. A placement must NOT restate anything. That dilution is real, and hiding it
   would flatter exactly the companies that issued shares to grow.
3. An unreconcilable window falls back to the AS-FILED figure, never to None —
   `_tier_lt(None)` returns the BOTTOM tier, so a null would assert the worst
   score rather than withhold one. That is the RS Line failure shape.
4. C9 is untouched (BA, 2026-09-24): its TTM EPS pairs with a back-adjusted
   price and the current logic is correct.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fa.metrics import _eps_yoy_adjusted, compute_metrics, trailing_ttm_eps  # noqa: E402
from fa.scoring import _tier_lt, compute_score  # noqa: E402
from fa.share_events import Adjustment  # noqa: E402

C1_TIERS = {"type": "tier_lt", "bounds": [20, 30, 60], "points": [0, 4, 8, 12]}


def _adj(pairs, ok=True, reason="OK"):
    """{period: Adjustment} from (period, k, shares) triples."""
    return {p: Adjustment(period=p, shares=sh, k_technical=k, total_ratio=k,
                          data_ok=ok, reason=reason)
            for p, k, sh in pairs}


def _series(eps_by_period, **extra):
    out = {p: {"eps": v} for p, v in eps_by_period.items()}
    for p in out:
        out[p].update(extra)
    return out


# --- the restatement itself -------------------------------------------------

def test_no_factors_is_the_as_filed_figure():
    s = _series({"2025-Q2": 1000.0, "2026-Q2": 1150.0})
    assert _eps_yoy_adjusted(s, "2026-Q2", None) == (15.0, "raw")


def test_a_bonus_issue_restates_the_base_not_the_ratio():
    """1.150 against a base of 1.000 restated by 1,15 is +32,25%, not +15%.

    Restating the BASE and dividing the ratio agree only while the base is
    positive, and a year-ago loss is a real state in this rubric — hence the
    next test.
    """
    s = _series({"2025-Q2": 1000.0, "2026-Q2": 1150.0})
    adj = _adj([("2025-Q2", 1.0, 100e6), ("2025-Q3", 1.15, 115e6),
                ("2025-Q4", 1.0, 115e6), ("2026-Q1", 1.0, 115e6),
                ("2026-Q2", 1.0, 115e6)])
    value, basis = _eps_yoy_adjusted(s, "2026-Q2", adj)
    assert basis == "adjusted"
    assert abs(value - (1150.0 / (1000.0 / 1.15) - 1) * 100) < 1e-9
    assert abs(value - 32.25) < 0.01


def test_a_year_ago_loss_does_not_blow_up():
    """The rubric's own denominator is `abs(base)`, so a loss must survive it."""
    s = _series({"2025-Q2": -500.0, "2026-Q2": 250.0})
    adj = _adj([("2025-Q2", 1.0, 100e6), ("2025-Q3", 1.15, 115e6),
                ("2026-Q2", 1.0, 115e6)])
    value, basis = _eps_yoy_adjusted(s, "2026-Q2", adj)
    assert basis == "adjusted"
    # restated base -434.78; (250 - -434.78)/434.78 = +157.5%
    assert abs(value - 157.5) < 0.01


def test_a_placement_restates_nothing():
    """K = 1 for a dilutive issue, so the as-filed comparison stands — and the
    basis says `unchanged`, not `raw`, because the window WAS reconciled."""
    s = _series({"2025-Q2": 1000.0, "2026-Q2": 1150.0})
    adj = _adj([("2025-Q2", 1.0, 100e6), ("2025-Q3", 1.0, 250e6),
                ("2026-Q2", 1.0, 250e6)])
    assert _eps_yoy_adjusted(s, "2026-Q2", adj) == (15.0, "unchanged")


# --- the fallback, and why it is not None -----------------------------------

def test_a_null_c1_would_score_the_bottom_tier():
    """The reason the fallback exists at all."""
    assert _tier_lt(None, C1_TIERS) == 0
    assert _tier_lt(0.0, C1_TIERS) == 0


def test_an_unreconcilable_window_keeps_the_as_filed_figure():
    s = _series({"2025-Q2": 1000.0, "2026-Q2": 1150.0})
    # An announced bonus that never reached the share count: k exceeds the
    # filed change, so the window is refused.
    adj = _adj([("2025-Q2", 1.0, 100e6), ("2025-Q3", 3.0, 100e6),
                ("2026-Q2", 1.0, 100e6)])
    value, basis = _eps_yoy_adjusted(s, "2026-Q2", adj)
    assert basis == "raw", "a refused window must not be scored as a null"
    assert value == 15.0


def test_an_unrecognised_title_keeps_the_as_filed_figure():
    s = _series({"2025-Q2": 1000.0, "2026-Q2": 1150.0})
    adj = _adj([("2025-Q2", 1.0, 100e6), ("2025-Q3", 1.15, 115e6),
                ("2026-Q2", 1.0, 115e6)], ok=False, reason="UNKNOWN_TITLE")
    assert _eps_yoy_adjusted(s, "2026-Q2", adj) == (15.0, "raw")


# --- through the whole rubric ------------------------------------------------

def _full_series(eps):
    """Enough fields for compute_metrics to run end to end."""
    return _series(eps, revenue=1e12, gross_margin=0.2, net_margin=0.1,
                   roe_ttm=0.15, st_debt=1e11, lt_debt=1e11, total_equity=1e12)


def test_c1_c2_c3_move_and_c9_does_not():
    """One symbol scored both ways: the EPS criteria change, C9 is identical."""
    eps = {f"{y}-Q{q}": v for (y, q), v in {
        (2024, 3): 800.0, (2024, 4): 850.0,
        (2025, 1): 900.0, (2025, 2): 1000.0, (2025, 3): 950.0, (2025, 4): 980.0,
        (2026, 1): 1050.0, (2026, 2): 1150.0,
    }.items()}
    s = _full_series(eps)
    # A 15% bonus with ex-right inside 2025-Q3, so it sits between every
    # compared pair for Q4/2025 onward.
    adj = _adj([("2024-Q3", 1.0, 100e6), ("2024-Q4", 1.0, 100e6),
                ("2025-Q1", 1.0, 100e6), ("2025-Q2", 1.0, 100e6),
                ("2025-Q3", 1.15, 115e6), ("2025-Q4", 1.0, 115e6),
                ("2026-Q1", 1.0, 115e6), ("2026-Q2", 1.0, 115e6)])
    cfg = {
        "criteria": {
            "c1": C1_TIERS, "c2": C1_TIERS,
            "c3": {"type": "count", "map": {"0": 0, "1": 4, "2": 8, "3": 12}},
            "c4": C1_TIERS,
            "c5": {"type": "tier_lt", "bounds": [0, 1, 2], "points": [0, 4, 8, 12]},
            "c6": {"type": "tier_lt", "bounds": [0, 1, 2], "points": [0, 4, 8, 12]},
            "c7": {"type": "tier_lt", "bounds": [10, 15, 20], "points": [0, 4, 8, 12]},
            "c9": {"type": "debt_equity", "low": 0.8, "high": 1.5,
                   "points_low": 12, "points_mid": 6, "points_high": -4},
            "c14": {"low_mult": 0.8, "high_mult": 1.2, "points_cheap": 12,
                    "points_neutral": 8, "points_expensive": 0},
        },
        "rating": {"A_min": 60, "B_min": 30},
        "normalize": {"raw_max": 108, "target": 100},
    }
    annual_pe = [(2024, 12.0), (2025, 14.0)]

    raw = compute_metrics(s, "2026-Q2", 20_000.0, annual_pe, None)
    fix = compute_metrics(s, "2026-Q2", 20_000.0, annual_pe, adj)

    assert raw["eps_basis"] == "raw" and fix["eps_basis"] == "adjusted"
    assert fix["c1_eps_yoy"] > raw["c1_eps_yoy"], "restating the base raises growth"
    assert fix["c2_eps_3q_avg_yoy"] > raw["c2_eps_3q_avg_yoy"]

    # C9's inputs are untouched: same TTM EPS, same P/E, same median.
    assert fix["current_eps_ttm"] == raw["current_eps_ttm"] == trailing_ttm_eps(s, "2026-Q2")
    assert fix["current_pe"] == raw["current_pe"]
    assert fix["pe_5y_median"] == raw["pe_5y_median"]

    r_raw = compute_score(raw, cfg, fully_scorable=True)
    r_fix = compute_score(fix, cfg, fully_scorable=True)
    assert r_fix.pts("c1") >= r_raw.pts("c1")
    assert r_fix.pts("c9") == r_raw.pts("c9"), "C9 must not move"
    assert r_fix.total_score >= r_raw.total_score


def test_direction_depends_on_the_SIGN_of_the_base():
    """The restatement raises growth from a PROFIT and lowers it from a LOSS.

    "K >= 1, so the base shrinks and the ratio grows" is true only while the
    base is positive, and stating it unconditionally is a mistake this project
    made twice — once in a written impact assessment. A negative base restated
    by K becomes a SMALLER loss per share, so an improvement measured against
    it is smaller too.

    Both cases are pinned with the live numbers that produced them, because
    they are the only two symbols of 984 whose total score FELL when this
    shipped, and a future reader will otherwise take that for a bug.
    """
    # Profit base: 1.000 -> restated 869,57, so +15% becomes +32,25%.
    profit = _series({"2025-Q2": 1000.0, "2026-Q2": 1150.0})
    raw_p, _ = _eps_yoy_adjusted(profit, "2026-Q2", None)
    for k in (1.0, 1.05, 1.5, 2.0, 7.0):
        adj = _adj([("2025-Q2", 1.0, 100e6), ("2025-Q3", k, 100e6 * k),
                    ("2026-Q2", 1.0, 100e6 * k)])
        value, _ = _eps_yoy_adjusted(profit, "2026-Q2", adj)
        assert value >= raw_p - 1e-9, f"K={k} lowered growth from a profit base"

    # Loss base — DSD's Q1/2026: -276,1 against a year-ago -337,6 that restates
    # to -272,3 on a 1,2399 factor. +18,2% as filed, -1,4% comparable.
    loss = _series({"2025-Q1": -337.6, "2026-Q1": -276.1})
    adj = _adj([("2025-Q1", 1.0, 100e6), ("2025-Q2", 1.2399, 123.99e6),
                ("2025-Q3", 1.0, 123.99e6), ("2025-Q4", 1.0, 123.99e6),
                ("2026-Q1", 1.0, 123.99e6)])
    raw_l, _ = _eps_yoy_adjusted(loss, "2026-Q1", None)
    adj_l, basis = _eps_yoy_adjusted(loss, "2026-Q1", adj)
    assert basis == "adjusted"
    assert abs(raw_l - 18.2) < 0.2, raw_l
    assert abs(adj_l - (-1.4)) < 0.2, adj_l
    assert adj_l < raw_l, "a restated LOSS base must lower the improvement"


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"{len(tests)} passed")
