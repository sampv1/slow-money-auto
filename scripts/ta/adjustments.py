"""Detect corporate-action price adjustments and re-backfill only the affected
symbols, so trailing returns (and hence RS) aren't corrupted by stale prices.

WHY THIS EXISTS
    `ta_ohlcv` is append-only: the daily path appends today's raw price_board
    bar and never re-adjusts older bars. vnstock `history()` returns a fully
    BACK-ADJUSTED series, but our stored history keeps the old nominal prices.
    So when a symbol goes ex-dividend / ex-rights / bonus / split, our series
    develops a discontinuity at the ex-date — the pre-event bars sit at the old
    price level while new bars come in adjusted. A trailing return computed
    across that discontinuity is wrong (e.g. PET showed a spurious -29% and its
    RS3M collapsed to 7 vs a back-adjusted ~91).

THE FIX (targeted, not a whole-universe re-backfill)
    Detect the handful of symbols whose stored history just picked up an
    adjustment, then re-backfill ONLY those via `fetch_ohlcv` (which is
    back-adjusted). Two complementary detection signals:

    1. Impossible gap (ALL exchanges) — a day-over-day move in the stored
       closes that exceeds the exchange daily price limit + a buffer cannot be
       normal trading; it's a corporate action (or a listing/halt reference
       reset — re-backfilling is idempotent and harmless either way). A
       min-price floor excludes penny-tick rounding (e.g. 400<->500 on UPCOM is
       +25% but not an action).

    2. Reference mismatch (HOSE/HNX only) — the exchange sets today's reference
       price to the ADJUSTED prior close, so `ref_price != stored prior close`
       means an action took effect today. This catches small cash dividends
       that stay within the daily limit (the gap signal would miss them). NOT
       used on UPCOM, whose reference is a prior-session AVERAGE and so differs
       from the close even with no action.
"""

import time
from datetime import timedelta


from .common import REQUEST_DELAY, safe_execute, today_vn
from .ohlcv import (
    PRICE_BOARD_CHUNK,
    _coerce_num,
    _make_trading,
    fetch_ohlcv,
    upsert_ohlcv,
)
from .rs_rating import _exchange_map, _load_closes
from .universe import get_active_symbols

# Daily price-move limits by exchange (band around the reference). vnstock/HOSE
# is labelled "HSX"; accept both spellings. Unknown → most permissive (UPCOM).
EXCHANGE_LIMIT = {"HOSE": 0.07, "HSX": 0.07, "HNX": 0.10, "UPCOM": 0.15}
DEFAULT_LIMIT = 0.15
REF_EXCHANGES = {"HOSE", "HSX", "HNX"}  # exchanges whose reference == prior close

# Tunables (overridable from the CLI).
GAP_BUFFER = 0.03      # a move must exceed limit+buffer to count as an action
MIN_PRICE = 2000.0     # below this, tick rounding fabricates >limit moves
REF_TOL = 0.005        # ref vs prior-close deviation that counts as an action
SCAN_DAYS = 430        # how far back to scan stored closes (≈ the RS window)
REBACKFILL_DAYS = 500  # history window re-fetched per flagged symbol (> RS win)


def _exchange_limit(exchange: str | None) -> float:
    return EXCHANGE_LIMIT.get((exchange or "").upper(), DEFAULT_LIMIT)


def classify_action(ratio: float | None) -> tuple[str, float | None, str | None]:
    """(kind, share_multiplier_equivalent, label) for a post/pre price ratio.

    THE TYPE IS NOT INFERRED, because it is not inferrable from price. Two
    attempts were made and both failed on AIG, whose answer is known from its AGM
    (5% cash dividend ex 07-31 + 15% bonus ex 08-04):

      1. Matching 1/ratio to a simple rational — with denominators to 12 there is
         a rational within a fraction of a percent of almost any number, so
         near-identical ratios split into different classes and upward moves got
         labels like "x0.714286".
      2. A magnitude cutoff (drop >= 15% => stock) — the 15% bonus shows as a
         13.03% drop and landed on the wrong side.
      3. A round-number test (round share ratio vs round VND amount) — for AIG
         BOTH fired: 1/0.8693 = 1.1504 ~ 1.15, and 52,100 x 0.1307 = 6,809 ~ 6,800.

    Nor does the share count settle it: charter capital and listed_share update at
    LISTING, weeks after the ex-date, so during the whole relevant window they
    still read the pre-action figure.

    So `ratio` is recorded as the fact and `share_multiplier` as its arithmetic
    inverse — the equivalent share multiplier, a restatement rather than a claim.
    `kind` stays 'unknown' unless a corporate announcement fills it in.
    """
    if not ratio or ratio <= 0 or ratio >= 1.0:
        return "unknown", None, None
    return "unknown", round(1.0 / ratio, 4), f"-{(1.0 - ratio) * 100:.1f}%"


RESTATE_TOL = 0.005   # below this a difference is rounding, not an adjustment
RESTATE_DAYS = 120    # window of bars compared per symbol


def detect_restated(client, symbols: list[str], days: int = RESTATE_DAYS,
                    tol: float = RESTATE_TOL, delay: float = REQUEST_DELAY) -> list[dict]:
    """THE RELIABLE CHECK: re-fetch each symbol's history and compare it, bar for
    bar, with what we stored. A bar whose value changed was restated, which means
    the series was adjusted. Returns the same event dicts as detect_adjusted_symbols.

    Why this and not find_gap(): find_gap infers an action from a price move
    larger than the exchange band, so anything inside the band is invisible to
    it. AIG's 15% bonus moved UPCOM price -9.98% against a +-15% band and was
    missed completely; so was a second BMD action. This check does not infer
    anything — it compares our copy against the provider's own adjusted series,
    so magnitude, exchange and action type are all irrelevant.

    Cost is one history() call per symbol, so it is for targeted use (open
    positions, a rolling slice of the universe), not a daily full sweep.

    Caveat that no detector can remove: the provider must have applied the
    adjustment already. On AIG's ex-date the back-adjustment was not live at
    16:07 ICT but was by 21:56, so a same-session run can still see nothing.
    That is why exits are deferred rather than trusted — see update_prices.py.
    """
    cutoff = (today_vn() - timedelta(days=days)).isoformat()
    exch = _exchange_map(client)
    out: list[dict] = []
    detected = today_vn().isoformat()

    for i, sym in enumerate(symbols):
        stored = _stored_closes(client, sym, cutoff)
        if len(stored) < 2:
            continue
        try:
            fresh = fetch_ohlcv(sym, today_vn() - timedelta(days=days), today_vn())
        except Exception:  # noqa: BLE001 — a fetch failure is not a detection
            fresh = None
        if i < len(symbols) - 1:
            time.sleep(delay)
        if not fresh:
            continue
        adj = {r["date"]: float(r["close"]) for r in fresh if r.get("close")}

        common = [d for d in sorted(stored) if d in adj and stored[d]]
        if not common:
            continue
        moved = [(d, stored[d], adj[d]) for d in common
                 if abs(adj[d] / stored[d] - 1.0) > tol]
        if not moved:
            continue
        # Ex-date = the first bar that was NOT restated (back-adjustment applies
        # to everything strictly before the action). If every bar moved, the
        # action predates the window and we can only bound it.
        unmoved = [d for d in common if d not in {m[0] for m in moved}]
        ex_date = min(unmoved) if unmoved else None
        ratio = moved[-1][2] / moved[-1][1]  # factor applied to the pre-ex bars
        kind, mult, label = classify_action(ratio)
        out.append({
            "symbol": sym, "exchange": exch.get(sym),
            "reasons": [f"restated@{ex_date or '<=' + common[0]} "
                        f"{len(moved)}/{len(common)} bars x{ratio:.4f}"],
            "events": ([{
                "symbol": sym, "ex_date": ex_date, "ratio": round(ratio, 8),
                "kind": kind, "share_multiplier": mult, "label": label,
                "detected_at": detected, "source": "restate",
                "exchange": exch.get(sym),
                "prev_close": moved[-1][1], "new_close": moved[-1][2],
                "listed_share": None,
            }] if ex_date else []),
        })
    return out


def record_actions(client, events: list[dict]) -> int:
    """Upsert detected corporate actions. Non-fatal: this is an explanatory log,
    never a precondition for the price repair that follows it."""
    if not events:
        return 0
    try:
        safe_execute(
            client.table("corporate_actions").upsert(events, on_conflict="symbol,ex_date"),
            label="corporate_actions upsert",
        )
        return len(events)
    except Exception as e:  # noqa: BLE001
        print(f"  corporate_actions not recorded ({str(e)[:90]}) — price repair unaffected")
        return 0


def find_gap(closes: list[tuple[str, float]], exchange: str | None,
             buffer: float = GAP_BUFFER, min_price: float = MIN_PRICE):
    """Most recent day-over-day gap beyond the exchange limit+buffer, or None.

    `closes` is ascending [(date, close)]. Returns (date, prev, cur, ratio).
    Pairs where either price is below `min_price` are ignored (tick noise).
    """
    limit = _exchange_limit(exchange) + buffer
    found = None
    for i in range(1, len(closes)):
        p0 = closes[i - 1][1]
        d1, p1 = closes[i]
        if not p0 or not p1 or min(p0, p1) < min_price:
            continue
        if abs(p1 / p0 - 1.0) > limit:
            found = (d1, p0, p1, p1 / p0)  # keep the most recent
    return found


def _close_before(closes: list[tuple[str, float]], date_iso: str) -> float | None:
    """Last stored close strictly before `date_iso` (closes ascending)."""
    prior = None
    for d, c in closes:
        if d < date_iso and c:
            prior = c
        elif d >= date_iso:
            break
    return prior


def _fetch_ref_prices(symbols: list[str], chunk_size: int = PRICE_BOARD_CHUNK) -> dict[str, tuple[float, str, float | None]]:
    """Bulk price_board → {symbol: (ref_price, trading_date, listed_share)}.

    Reference price is the exchange's official prior-close (adjusted). The share
    count rides along free — it is in the same `listing` block — and is stored on
    the recorded action so a later event can settle the stock-vs-cash ambiguity
    that price alone cannot. Failures skip a chunk.
    """
    out: dict[str, tuple[float, str, float | None]] = {}
    trading = _make_trading()
    for start in range(0, len(symbols), chunk_size):
        chunk = symbols[start:start + chunk_size]
        retried = False
        df = None
        while True:
            try:
                df = trading.price_board(chunk)
                break
            except Exception as e:  # noqa: BLE001
                if "charting library" in str(e).lower() and not retried:
                    trading = _make_trading()
                    retried = True
                    continue
                break
        if df is None or df.empty:
            continue
        listing = df["listing"]
        for i in range(len(df)):
            sym = listing["symbol"].iloc[i]
            rp = _coerce_num(listing["ref_price"].iloc[i])
            td = str(listing["trading_date"].iloc[i])[:10]
            ls = _coerce_num(listing["listed_share"].iloc[i]) if "listed_share" in listing else None
            if rp and rp > 0:
                out[sym] = (rp, td, ls)
    return out


def detect_adjusted_symbols(client, scan_days: int = SCAN_DAYS, use_ref: bool = True,
                            symbols: list[str] | None = None, buffer: float = GAP_BUFFER,
                            min_price: float = MIN_PRICE, ref_tol: float = REF_TOL) -> list[dict]:
    """Scan stored closes (+ optional live reference prices) for adjustment
    signals. Returns [{symbol, exchange, reasons:[...], events:[...]}], one per
    flagged symbol.

    `events` carries the same findings structurally (ex_date, ratio, inferred
    kind, …) ready for corporate_actions; `reasons` stays the human-readable
    strings the CLI callers print. Both describe the same detections.
    """
    detected = today_vn().isoformat()
    active = symbols or get_active_symbols(client)
    exch = _exchange_map(client)
    cutoff = (today_vn() - timedelta(days=scan_days)).isoformat()
    closes = _load_closes(client, active, cutoff)
    ref = _fetch_ref_prices(active) if use_ref else {}

    flagged: list[dict] = []
    for sym in active:
        ser = closes.get(sym) or []
        ex = exch.get(sym)
        reasons: list[str] = []
        # Keyed by ex_date so the two signals describing the SAME action merge
        # into one event (source 'gap+ref') instead of duplicating it, while two
        # genuinely different dates stay two events.
        by_date: dict[str, dict] = {}

        def _add(ex_date: str, ratio: float, prev: float, new: float, src: str):
            # Record DOWNWARD moves only. Every dividend, bonus and split lowers
            # the price; an upward gap is a genuine move, a halt resumption or a
            # rare consolidation, and attributing it to a corporate action would
            # publish a confident falsehood. The symbol is still flagged for
            # repair either way — repair_symbols verifies and skips, so a false
            # flag is harmless there, whereas a false LOG entry is user-visible.
            if ratio >= 1.0:
                return
            kind, mult, label = classify_action(ratio)
            cur = by_date.get(ex_date)
            if cur is not None:
                cur["source"] = f"{cur['source']}+{src}" if src not in cur["source"] else cur["source"]
                return
            by_date[ex_date] = {
                "symbol": sym, "ex_date": ex_date, "ratio": round(ratio, 8),
                "kind": kind, "share_multiplier": mult, "label": label,
                "detected_at": detected, "source": src, "exchange": ex,
                "prev_close": prev, "new_close": new,
                "listed_share": (ref.get(sym) or (None, None, None))[2],
            }

        gap = find_gap(ser, ex, buffer, min_price)
        if gap:
            d, p0, p1, ratio = gap
            reasons.append(f"gap@{d} {p0:,.0f}->{p1:,.0f} ({(ratio - 1) * 100:+.0f}%)")
            _add(d, ratio, p0, p1, "gap")

        if use_ref and (ex or "").upper() in REF_EXCHANGES and sym in ref:
            rp, td, _ls = ref[sym]
            prior = _close_before(ser, td)
            if prior and prior >= min_price:
                dev = rp / prior - 1.0
                if abs(dev) > ref_tol:
                    reasons.append(f"ref@{td} {prior:,.0f}->{rp:,.0f} ({dev * 100:+.1f}%)")
                    _add(td, rp / prior, prior, rp, "ref")

        if reasons:
            flagged.append({"symbol": sym, "exchange": ex, "reasons": reasons,
                            "events": sorted(by_date.values(), key=lambda e: e["ex_date"])})
    return flagged


def _stored_closes(client, symbol: str, cutoff_iso: str) -> dict[str, float]:
    """{date: close} for one symbol since cutoff (paged)."""
    out: dict[str, float] = {}
    offset = 0
    while True:
        rows = safe_execute(
            client.table("ta_ohlcv").select("date,close")
            .eq("symbol", symbol).gte("date", cutoff_iso).order("date")
            .range(offset, offset + 999),
            label=f"repair closes {symbol}",
        ).data
        for r in rows:
            if r.get("close") is not None:
                out[r["date"]] = float(r["close"])
        if len(rows) < 1000:
            break
        offset += 1000
    return out


def _differs(fresh_rows: list[dict], stored: dict[str, float], tol: float = 0.005) -> bool:
    """True if adjusted `fresh_rows` disagree with `stored` on any shared date by
    more than `tol` — i.e. re-backfilling would actually change something (a real
    stale adjustment), vs a genuine price gap where the two already match."""
    for r in fresh_rows:
        old = stored.get(r["date"])
        new = r.get("close")
        if old and new and old > 0 and abs(new / old - 1.0) > tol:
            return True
    return False


def repair_symbols(client, symbols: list[str], days: int = REBACKFILL_DAYS,
                   delay: float = REQUEST_DELAY, dry_run: bool = False) -> dict[str, dict]:
    """Re-backfill each flagged symbol from adjusted history(), but upsert only
    when the fresh series actually disagrees with what we have stored (so a
    genuine >limit price gap, which needs no fix, is a no-op we can report).

    Returns {symbol: {"rows": int, "changed": bool}}.
    """
    results: dict[str, dict] = {}
    if dry_run or not symbols:
        return results
    end = today_vn()
    start = end - timedelta(days=days)
    cutoff_iso = start.isoformat()
    total = len(symbols)
    for i, symbol in enumerate(symbols, 1):
        fresh = fetch_ohlcv(symbol, start, end)
        if not fresh:
            results[symbol] = {"rows": 0, "changed": False}
            print(f"  [{i}/{total}] {symbol}: no data")
            if i < total:
                time.sleep(delay)
            continue
        stored = _stored_closes(client, symbol, cutoff_iso)
        changed = _differs(fresh, stored)
        if changed:
            upsert_ohlcv(client, fresh)
        results[symbol] = {"rows": len(fresh) if changed else 0, "changed": changed}
        print(f"  [{i}/{total}] {symbol}: {'re-adjusted ' + str(len(fresh)) + ' bars' if changed else 'no change (genuine gap)'}")
        if i < total:
            time.sleep(delay)
    return results
