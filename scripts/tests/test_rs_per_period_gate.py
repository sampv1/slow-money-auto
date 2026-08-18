#!/usr/bin/env python3
"""Pin the per-period RS gate (2026-08-11).

Runnable directly (`python3 scripts/tests/test_rs_per_period_gate.py`) or under
pytest, matching the convention in test_bqs_v8.py.

Why this exists
---------------
`_trailing_returns` used to return None for the WHOLE symbol as soon as any one
period lacked a bar within `tolerance_days`. That cost ~60 symbols their `rs_3m`
purely because their 12-MONTH anchor was missing — data the 3-month return does
not use. And "missing" rarely meant young: AMV had 230 bars over 777 days with a
five-month hole straddling its 12-month anchor, because thinly-traded UPCOM names
do not print near every target date.

The fix is `require_all=False` in the main pass. The two things that must not
regress:

  1. A missing long anchor must NOT void the short periods.
  2. `rs_composite` must STILL require all four periods. It feeds TA Score (20%)
     and thence Final Score, so a partial, silently-reweighted blend would move
     every grade in the system. NA has to propagate.
"""

import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ta.rs_rating import RS_DEFAULTS, _trailing_returns  # noqa: E402

PERIODS = RS_DEFAULTS["periods"]          # 3m/6m/9m/12m
TOL = RS_DEFAULTS["tolerance_days"]       # 25


def _series(day_offsets, price=100.0):
    """[(iso_date, close)] at the given offsets back from a fixed 'today'."""
    end = date(2026, 8, 10)
    return [((end - timedelta(days=d)).isoformat(), price + d * 0.01)
            for d in sorted(day_offsets, reverse=True)]


def test_full_history_rates_every_period():
    s = _series(range(0, 400, 3))
    r = _trailing_returns(s, PERIODS, TOL, require_all=False)
    assert r is not None and set(r) == set(PERIODS), r


def test_missing_12m_anchor_still_yields_3m():
    """The regression this change exists to prevent."""
    # Bars only over the last ~200 days: 3m and 6m anchored, 9m and 12m are not.
    s = _series(range(0, 200, 3))
    legacy = _trailing_returns(s, PERIODS, TOL, require_all=True)
    assert legacy is None, "legacy behaviour changed; the rest of this test is moot"

    r = _trailing_returns(s, PERIODS, TOL, require_all=False)
    assert r is not None, "per-period gate must still rate this symbol"
    assert "3m" in r and "6m" in r, r
    assert "9m" not in r and "12m" not in r, r


def test_hole_at_the_anchor_not_short_history():
    """A long series with a GAP at the 12m mark — the real-world AMV shape."""
    # Two years of bars, but nothing within tolerance of today-365.
    offsets = [d for d in range(0, 780, 3) if not (365 - 60 <= d <= 365 + 60)]
    s = _series(offsets)
    r = _trailing_returns(s, PERIODS, TOL, require_all=False)
    assert r is not None
    assert "12m" not in r, "a 60-day hole around the anchor must void only 12m"
    assert "3m" in r and "6m" in r and "9m" in r, r


def test_no_bars_returns_none():
    assert _trailing_returns([], PERIODS, TOL, require_all=False) is None
    # Only very recent bars: not one period is computable.
    assert _trailing_returns(_series(range(0, 10)), PERIODS, TOL, require_all=False) is None


def _pct(s):
    """The production percentile helper, mirrored (see compute_rs_ratings)."""
    import pandas as pd

    v = pd.to_numeric(s, errors="coerce").astype(float)
    return (v.rank(method="average", pct=True) * 99).round().clip(1, 99).astype("Int64")


def test_rank_drops_nulls_on_every_dtype():
    """pandas' NULLABLE dtypes silently give pd.NA a real rank.

    Measured on pandas 2.3.3: [30.0, <NA>, 59.4] as Float64 ranks to [66, 33, 99]
    — a 33 invented from nothing. Only numpy float64 propagates NaN through
    rank(), which is why `pct` coerces with .astype(float). Without it, 99
    symbols received a fabricated rs_composite that fed TA and Final Score.
    """
    import pandas as pd

    raw = pd.Series([50, None, 99], dtype="Int64")
    for name, s in [
        ("Int64", raw),
        ("Float64", raw.astype("Float64")),
        ("float64", raw.astype(float)),
    ]:
        out = _pct(s)
        assert pd.isna(out.iloc[1]), f"{name}: null was given rank {out.iloc[1]}"
        assert out.iloc[0] == 50 and out.iloc[2] == 99, f"{name}: {out.tolist()}"


def test_composite_still_requires_all_four_periods():
    """A symbol missing one period must get NO composite — through to the rank.

    Mirrors the production expression end to end:
        blend = sum(weights[k] * df[f"rs_{k}"].astype(float) for k in periods)
        df["rs_composite"] = pct(blend)
    Asserting on `blend` alone is NOT enough: the first version of this change
    did exactly that, passed, and still shipped a composite for every symbol,
    because the null was only resurrected one step later inside pct().
    """
    import pandas as pd

    weights = RS_DEFAULTS["weights"]
    df = pd.DataFrame(
        {"rs_3m": [50, 50, 10], "rs_6m": [50, 50, 10],
         "rs_9m": [50, None, 10], "rs_12m": [50, 50, 10]},
        index=["full", "partial", "other"],
    ).astype("Int64")
    blend = sum(weights[k] * df[f"rs_{k}"].astype(float) for k in weights)
    assert pd.isna(blend["partial"]), "blend must be null for a partial symbol"
    comp = _pct(blend)
    assert not pd.isna(comp["full"]), "a fully-rated symbol must get a composite"
    assert pd.isna(comp["partial"]), "a partial symbol must NOT get a composite"


def test_periods_and_weights_still_agree():
    """Re-pinned here too: the gate change must not have touched the blend keys."""
    assert set(RS_DEFAULTS["periods"]) == set(RS_DEFAULTS["weights"])
    assert "1m" not in RS_DEFAULTS["periods"], "rs_1m is display-only, outside the blend"


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
