#!/usr/bin/env python3
"""Pins the corporate-action rebase in update_prices.py against the AIG case.

THE BUG (2026-08-05). AIG went ex a 15% bonus on 2026-08-04. `adjustment_factor`
derives the rebase factor k from the provider's back-adjusted history, and the
provider was still serving pre-bonus prices — so k came back 1.0, the post-bonus
market low of 46,900 was compared against the pre-bonus 48,000 stop, and a
position actually up ~7% was booked as a -5.88% cut loss.

The same-session guard (SUSPECT_REF_DEV) did not catch it because it asks "did an
action take effect TODAY?" — and the action was the day before, by which point the
exchange reference had already been reset to the adjusted close. Meanwhile BOTH
remaining witnesses knew the answer: `recommendations.adj_factor` carried 0.860962
from the previous run, and our own `ta_ohlcv` had been re-backfilled to 44,780.

So these tests pin the combiner, not the provider call: k is monotonically
non-increasing over a position's life, so the LOWEST witness is the best-informed
one, and no single source going quiet may resurrect a nominal stop.

Run standalone or under pytest:
    python3 scripts/tests/test_adjustment_factor.py
    pytest scripts/tests/test_adjustment_factor.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from update_prices import (  # noqa: E402
    _rebase_price,
    _sane_factor,
    adjustment_factor,
    effective_factor,
    evaluate_recommendation,
)

# The real position, as it stood on 2026-08-05.
AIG = {
    "id": "aig", "symbol": "AIG", "status": "OPEN", "action": "BUY",
    "entry_price": 51000, "stop_loss": 48000, "tp1": 80000, "tp2": None,
    "last_close": 52000, "last_close_date": "2026-07-30",
    "adj_factor": 0.860962,
}
K_TRUE = 44770.0 / 52000.0          # 0.860962 — the 15% bonus, as booked
BAR_0805 = {"date": "2026-08-05", "open": 47400.0, "high": 47600.0,
            "low": 46900.0, "close": 47000.0, "volume": 22000}

# What each witness returns when the provider is behind: history() still shows the
# pre-bonus close, ta_ohlcv has been repaired (Step 1b ran the previous evening).
HIST_BEHIND = {"2026-07-30": {"date": "2026-07-30", "close": 52000.0}}
HIST_CAUGHT_UP = {"2026-07-30": {"date": "2026-07-30", "close": 44770.0}}
DB_REPAIRED = {("AIG", "2026-07-30"): 44780.0}
DB_EMPTY: dict = {}


def _stopped(rec, price, k):
    """True if the position would be closed by evaluate_recommendation."""
    upd = evaluate_recommendation(rec, _rebase_price(price, k), days_held=4) or {}
    return upd.get("status") == "STOPPED"


def test_the_original_false_stop_is_reproducible():
    """Without the fix the stop fires — otherwise the rest proves nothing."""
    assert adjustment_factor(HIST_BEHIND, AIG) == 1.0
    assert _stopped(AIG, BAR_0805, 1.0), "the 2026-08-05 false stop must reproduce at k=1"


def test_stored_factor_survives_a_provider_that_went_quiet():
    k, src = effective_factor(AIG, HIST_BEHIND, DB_EMPTY)
    assert abs(k - K_TRUE) < 1e-5, f"expected the stored factor, got {k}"
    assert "stored" in src
    assert not _stopped(AIG, BAR_0805, k)


def test_own_history_alone_also_prevents_it():
    """Even on the first run after the action, before any factor was persisted."""
    k, src = effective_factor({**AIG, "adj_factor": None}, HIST_BEHIND, DB_REPAIRED)
    assert abs(k - K_TRUE) < 1e-3, f"expected the ta_ohlcv factor, got {k}"
    assert "ta_ohlcv" in src
    assert not _stopped(AIG, BAR_0805, k)


def test_nominal_low_clears_the_stop_by_a_wide_margin():
    """Not a boundary case: 54,462 vs a 48,000 stop is ~13% of headroom."""
    k, _ = effective_factor(AIG, HIST_BEHIND, DB_REPAIRED)
    assert BAR_0805["low"] / k > 54_000


def test_lowest_witness_wins_because_k_only_falls():
    """A source that is behind reports k too HIGH (1.0), never too low."""
    k, _ = effective_factor(AIG, HIST_CAUGHT_UP, DB_REPAIRED)
    assert abs(k - K_TRUE) < 1e-5
    # ...and a second, later action must still be able to pull k further down.
    deeper = {**AIG, "adj_factor": 0.5}
    k2, src2 = effective_factor(deeper, HIST_CAUGHT_UP, DB_REPAIRED)
    assert k2 == 0.5 and src2 == "stored"


def test_no_action_still_means_no_rebase():
    """The guard must not invent an adjustment for an ordinary position."""
    clean = {**AIG, "last_close": 44770.0, "adj_factor": None}
    k, src = effective_factor(clean, HIST_CAUGHT_UP, {("AIG", "2026-07-30"): 44770.0})
    assert k == 1.0 and src == "none"
    assert _rebase_price(BAR_0805, k) is BAR_0805, "k=1 must be a no-op, not a copy"


def test_a_factor_above_one_is_rejected():
    """k > 1 is never a corporate action — every action lowers the adjusted price.

    Left alone it marks every price DOWN (_rebase_price divides by k) and can fire
    a stop the market never touched: the same failure, sign-flipped. A mistyped
    manual `last_close` is the realistic way to get one.
    """
    assert _sane_factor(1.05) == 1.0
    assert _sane_factor(0.0) == 1.0 and _sane_factor(-0.5) == 1.0
    mistyped = {**AIG, "last_close": 40000.0, "adj_factor": None}   # ratio 1.119
    k, src = effective_factor(mistyped, HIST_CAUGHT_UP, DB_EMPTY)
    assert k == 1.0 and src == "none"
    # The bar is passed through untouched rather than marked down 10.6%. It may
    # still hit a stop on its own merits — the guard removes a fabricated
    # markdown, it does not veto exits.
    assert _rebase_price(BAR_0805, k)["low"] == BAR_0805["low"]


if __name__ == "__main__":
    fails = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  PASS {name}")
            except AssertionError as e:
                fails += 1
                print(f"  FAIL {name}: {e}")
    print("OK" if not fails else f"{fails} failure(s)")
    sys.exit(1 if fails else 0)
