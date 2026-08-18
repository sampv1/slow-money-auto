#!/usr/bin/env python3
"""Pin the RS `periods` / `weights` invariant.

Runnable directly (`python3 scripts/tests/test_rs_periods_weights.py`) or under
pytest, matching the convention in test_bqs_v8.py.

Why this exists
---------------
`compute_rs_ratings` builds the composite as

    blend = sum(weights[k] * df[f"rs_{k}"] for k in periods)

so any key in `periods` without a matching entry in `weights` raises KeyError —
and because the whole RS pass is one function, that writes NO RS for the entire
universe, which the dashboard then renders as blank TA components with a TA Score
silently computed as if RS were 0.

The specific way this nearly happened: adding a 1-month period for the FA
Scanner's RS1M column. It looks like a one-line change to `periods`, and the
scoring_config DB row appears to protect you because it pins periods to
3m/6m/9m/12m — but `ta/common.py::_deep_merge` merges NESTED dicts, so a key
added to the code default survives the merge and reaches the blend anyway.
rs_1m is therefore a top-level scalar (`rs_1m_days`) computed outside the blend.

If you are here because this test failed: you probably want a separate pass over
`df.index`, not a new `periods` member. See migration 044's header comment.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ta.common import _deep_merge  # noqa: E402
from ta.rs_rating import RS_DEFAULTS  # noqa: E402


def test_periods_and_weights_have_identical_keys():
    assert set(RS_DEFAULTS["periods"]) == set(RS_DEFAULTS["weights"]), (
        "every `periods` key needs a `weights` entry — blend indexes weights[k] "
        f"for k in periods. periods={sorted(RS_DEFAULTS['periods'])} "
        f"weights={sorted(RS_DEFAULTS['weights'])}"
    )


def test_rs_1m_is_not_a_period():
    """rs_1m must stay outside the blend so rs_composite/TA Score never move."""
    assert "1m" not in RS_DEFAULTS["periods"], (
        "rs_1m is display-only and must NOT be a `periods` member — that changes "
        "rs_composite, hence TA Score (20% weight) and Final Score, for every symbol."
    )
    assert "1m" not in RS_DEFAULTS["weights"]
    assert isinstance(RS_DEFAULTS.get("rs_1m_days"), int), \
        "rs_1m_days must remain a top-level scalar (immune to the nested deep-merge)"


def test_deep_merge_cannot_rescue_a_stray_period():
    """The DB config does NOT protect against a stray key in the code default.

    This is the surprising half: `scoring_config['rs_rating']` pins periods to
    3m/6m/9m/12m, so it *looks* like the DB row is authoritative. It is not —
    _deep_merge preserves default-only keys inside a merged dict.
    """
    default = {"periods": {"1m": 30, "3m": 91}, "weights": {"3m": 0.4}}
    db_row = {"periods": {"3m": 91, "6m": 182}, "weights": {"3m": 0.4, "6m": 0.2}}
    merged = _deep_merge(default, db_row)
    assert "1m" in merged["periods"], "regression: _deep_merge no longer preserves nested defaults"
    assert "1m" not in merged["weights"]
    # ...which is exactly the KeyError the production code would hit:
    missing = [k for k in merged["periods"] if k not in merged["weights"]]
    assert missing == ["1m"]


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
