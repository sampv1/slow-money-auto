#!/usr/bin/env python3
"""ta_signals stores only triggered rows, and a re-run must not leave stale ones.

Two properties are pinned here, and the second is the reason the first is safe.

1. Untriggered rows are never stored. Every reader filters `triggered = true`
   (the TA Scanner's two date-scoped reads and the Analysis chart's markers), so
   the ~82% of rows answering "no" were an unread archive costing ~1.4 GB a year.

2. The write DELETES the span before inserting. The upsert this replaced kept
   history honest by OVERWRITING a stale `triggered = true` with the `false` a
   recomputation produced. Once false rows are no longer written, that repair
   silently vanishes — so a re-run (`--since`, `--all-dates`, or a resweep after
   refresh_adjustments.py re-backfills a corporate action) would leave the old
   true row standing forever: a signal the scanner still lists and the chart
   still marks, for a bar that no longer produces it. Dropping untriggered rows
   WITHOUT the delete is the bug; this test is what stops them being separated.

The cleared span comes from the rows BEFORE the triggered filter, because a
symbol-date whose signals all turned false has nothing left to name the date.

Runnable directly or under pytest.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import compute_ta_signals  # noqa: E402

FAILURES: list[str] = []


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


class _Result:
    def __init__(self, data=None):
        self.data = data or []


class FakeTable:
    """Enough of the PostgREST builder to record deletes and captured writes."""

    def __init__(self, store, log):
        self.store, self.log = store, log
        self._op = None
        self._payload = None
        self._filters = {}

    def delete(self):
        self._op = "delete"
        return self

    def upsert(self, rows, on_conflict=None):
        self._op = "upsert"
        self._payload = rows
        return self

    def eq(self, col, val):
        self._filters[("eq", col)] = val
        return self

    def gte(self, col, val):
        self._filters[("gte", col)] = val
        return self

    def lte(self, col, val):
        self._filters[("lte", col)] = val
        return self

    def execute(self):
        if self._op == "delete":
            sym = self._filters.get(("eq", "symbol"))
            lo = self._filters.get(("gte", "date"))
            hi = self._filters.get(("lte", "date"))
            self.log.append(("delete", sym, lo, hi))
            kept = [r for r in self.store
                    if not (r["symbol"] == sym and lo <= r["date"] <= hi)]
            self.store[:] = kept
        elif self._op == "upsert":
            self.log.append(("upsert", len(self._payload)))
            self.store.extend(self._payload)
        return _Result()


class FakeClient:
    def __init__(self):
        self.store: list[dict] = []
        self.log: list[tuple] = []

    def table(self, _name):
        return FakeTable(self.store, self.log)


def row(sym, date_, ind, triggered, value=1.0):
    return {"date": date_, "symbol": sym, "indicator": ind,
            "triggered": triggered, "value": value, "metadata": None}


def main():
    print("ta_signals write path")

    # --- 1. only triggered rows are stored -------------------------------
    c = FakeClient()
    rows = [row("FPT", "2026-08-28", "above_ma50", True),
            row("FPT", "2026-08-28", "below_ma50", False),
            row("FPT", "2026-08-28", "rsi_oversold", False)]
    written = compute_ta_signals.write_signals(c, rows)
    check(written == 1, f"returns the stored count, not the evaluated count (got {written})")
    check(len(c.store) == 1, f"1 of 3 rows persisted (got {len(c.store)})")
    check(all(r["triggered"] for r in c.store), "every stored row is triggered")

    # --- 2. a re-run must not leave a stale `true` behind -----------------
    # First run: the indicator fires. Second run (same date, corrected bars):
    # it no longer fires, so it produces only an UNTRIGGERED row — which is
    # never written. Without the delete, the old true row would survive.
    c = FakeClient()
    compute_ta_signals.write_signals(c, [row("FPT", "2026-08-28", "breaks_52w_high", True)])
    check(len(c.store) == 1, "first run stored the triggered row")

    compute_ta_signals.write_signals(c, [row("FPT", "2026-08-28", "breaks_52w_high", False)])
    check(len(c.store) == 0,
          f"re-run cleared the stale true row (store holds {c.store})")
    check(("delete", "FPT", "2026-08-28", "2026-08-28") in c.log,
          "the delete spanned the recomputed date even though nothing was written")

    # --- 3. the cleared span covers every recomputed date ----------------
    c = FakeClient()
    for d in ("2026-08-26", "2026-08-27", "2026-08-28"):
        compute_ta_signals.write_signals(c, [row("FPT", d, "above_ma50", True)])
    check(len(c.store) == 3, "three dates stored independently")
    # A backfill re-runs the whole span; all three now read false.
    compute_ta_signals.write_signals(c, [row("FPT", d, "above_ma50", False)
                                         for d in ("2026-08-26", "2026-08-27", "2026-08-28")])
    check(len(c.store) == 0, f"backfill cleared the full span (store holds {c.store})")

    # --- 4. one symbol's rewrite must not touch another's ----------------
    c = FakeClient()
    compute_ta_signals.write_signals(c, [row("VNM", "2026-08-28", "above_ma50", True)])
    compute_ta_signals.write_signals(c, [row("FPT", "2026-08-28", "above_ma50", False)])
    check([r["symbol"] for r in c.store] == ["VNM"],
          "rewriting FPT left VNM's row for the same date alone")

    # --- 5. nothing computed => no delete, so a failed symbol is not wiped
    c = FakeClient()
    compute_ta_signals.write_signals(c, [row("FPT", "2026-08-28", "above_ma50", True)])
    c.log.clear()
    check(compute_ta_signals.write_signals(c, []) == 0, "empty input writes nothing")
    check(c.log == [], "empty input issues NO delete — an indicator crash must "
                       "not erase the symbol's stored signals")
    check(len(c.store) == 1, "the previously stored row survived")

    print(f"\n{'FAILED' if FAILURES else 'PASSED'}: {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


def test_signal_write():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
