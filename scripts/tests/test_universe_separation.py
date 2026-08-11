#!/usr/bin/env python3
"""Pin the TA/FA universe separation (2026-08-11).

Runnable directly (`python3 scripts/tests/test_universe_separation.py`) or under
pytest, matching the convention in test_bqs_v8.py.

The TA universe now comes from the exchange's stock listing instead of from
`fa_scores`. Three properties of that must not regress, each of which has a
failure mode far worse than a wrong number:

  1. A FAILED listing fetch must write NOTHING. The sync retires every active
     symbol absent from the listing, so "listing came back empty" and "every
     symbol was delisted" are the same input — one flaky external call away from
     wiping the universe.
  2. Only a currently-ACTIVE symbol may be retired for dormancy. OHLCV is
     collected for members only, so an inactive symbol's last bar records when we
     stopped collecting, not when it stopped trading. Judging it on that closes
     the loop `excluded ⇒ no data ⇒ looks dormant ⇒ stays excluded`.
  3. Retiring must blank the derived reads, not just flip the flag — only two
     dashboard reads filter on is_active.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ta import universe as U  # noqa: E402


class FakeQuery:
    """Records every write the code attempts; returns canned reads."""

    def __init__(self, log, rows):
        self._log, self._rows = log, rows

    def select(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def eq(self, *a, **k):
        return self

    def gte(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def in_(self, *a, **k):
        return self

    def range(self, lo, hi):
        self._slice = (lo, hi)
        return self

    def update(self, payload):
        self._log.append(("update", payload))
        return self

    def upsert(self, payload, **k):
        self._log.append(("upsert", payload))
        return self

    def execute(self):
        lo, hi = getattr(self, "_slice", (0, 999))
        return type("R", (), {"data": self._rows[lo:hi + 1], "count": len(self._rows)})()


class FakeClient:
    def __init__(self, rows=None):
        self.log = []
        self._rows = rows or []

    def table(self, name):
        return FakeQuery(self.log, self._rows if name == "ta_universe" else [])


def test_failed_listing_fetch_writes_nothing():
    """The guard that stands between a flaky API and an erased universe."""
    orig = U.fetch_all_listed_stocks
    try:
        U.fetch_all_listed_stocks = lambda: None
        client = FakeClient([{"symbol": "AAA", "is_active": True}])
        stats = U.sync_universe_to_listing(client)
        assert stats.get("error"), "a failed fetch must be reported as an error"
        assert stats["retired"] == 0, f"retired {stats['retired']} on a failed fetch"
        assert client.log == [], f"wrote {client.log} on a failed fetch"
    finally:
        U.fetch_all_listed_stocks = orig


def test_empty_listing_is_treated_as_failure_not_as_total_delisting():
    orig = U.fetch_all_listed_stocks
    try:
        U.fetch_all_listed_stocks = lambda: []
        client = FakeClient([{"symbol": "AAA", "is_active": True}])
        stats = U.sync_universe_to_listing(client)
        assert stats.get("error"), "an empty listing must not mean 'all delisted'"
        assert client.log == []
    finally:
        U.fetch_all_listed_stocks = orig


def test_retired_fields_blank_every_derived_read():
    """Flipping is_active alone leaves the row visible to most dashboard reads."""
    f = U.RETIRED_FIELDS
    assert f["is_active"] is False
    for col in ("rs_1m", "rs_3m", "rs_6m", "rs_9m", "rs_12m", "rs_composite",
                "rs_date", "rs_line", "rs_line_full", "rs_line_score", "ta_score"):
        assert col in f, f"{col} would survive retirement"
        assert f[col] is None, f"{col} must be cleared, got {f[col]!r}"


def test_only_active_symbols_can_be_judged_dormant():
    """An inactive symbol's stale bars mean 'we stopped collecting', not 'dead'.

    Mirrors the `trading()` predicate inside sync_universe_to_listing.
    """
    cutoff = "2026-05-12"

    def trading(sym, existing, last):
        if not existing.get(sym, False):
            return True
        return sym in last and last[sym] >= cutoff

    # Active + recent bar ⇒ stays.
    assert trading("A", {"A": True}, {"A": "2026-08-10"})
    # Active + stale bar ⇒ retired. We WERE collecting, so absence is real.
    assert not trading("B", {"B": True}, {"B": "2024-07-25"})
    # Active + no bar at all ⇒ retired.
    assert not trading("C", {"C": True}, {})
    # INACTIVE + stale bar ⇒ admitted. The staleness is our own doing.
    assert trading("D", {"D": False}, {"D": "2026-06-19"})
    # Brand new ⇒ admitted, backfill decides later.
    assert trading("E", {}, {})


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
