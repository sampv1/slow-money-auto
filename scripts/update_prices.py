#!/usr/bin/env python3
"""
update_prices.py — Fetch latest prices and evaluate open recommendations.

This is the daily script to run after market close. It:
1. Fetches today's price for each symbol directly from vnstock
2. Checks if TP1, TP2, or stop loss was hit using intraday high/low
3. Updates recommendation status, current price, unrealized/actual P&L
4. Marks expired recommendations (exceeded holding period)

Usage:
  # Normal daily run:
  python3 update_prices.py

  # Dry run (show what would change, don't update):
  python3 update_prices.py --dry-run

  # Force re-evaluate all (including already closed):
  python3 update_prices.py --all
"""

import argparse
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

# Statuses considered "still active" (can transition)
ACTIVE_STATUSES = {"OPEN", "TP1_HIT"}
# Statuses considered "closed"
CLOSED_STATUSES = {"TP2_HIT", "STOPPED", "EXPIRED", "CLOSED_MANUAL"}

# Vietnam T+2.5 settlement: can only sell from afternoon of T+2.
# Since we use daily OHLCV (not intraday), the day's low on T+2 might occur
# in the morning when selling is not possible. So we only check SL/TP from T+3.
MIN_DAYS_BEFORE_EXIT = 3

# A corporate action can drag the RAW price through a nominal stop without the
# position having lost anything. The rebase normally prevents that, but it needs
# the provider's back-adjusted history, and the provider may not have applied it
# yet: on AIG's ex-date (2026-08-04, 15% bonus) the adjustment was not live at
# 16:07 ICT — when the daily job ran — but was by 21:56. So the job saw k=1.0,
# compared a post-bonus 46,900 against a pre-bonus 48,000 stop, and closed a
# position that was actually +6.7%.
#
# Guard 1 (same session): when a symbol looks adjusted but we could NOT rebase
# (k == 1.0), skip the exit decision for that session. The price is still
# recorded; only the irreversible close is deferred, and the next run decides
# with correct data.
# Deviation of today's exchange reference from the last stored close. HOSE/HNX
# set it to the adjusted prior close, so a few % is already conclusive; UPCOM
# uses a session average, hence a threshold well above normal average-vs-close
# drift (AIG showed -11.9%).
SUSPECT_REF_DEV = 0.05

# Guard 2 (every LATER session) — see effective_factor().
#
# Guard 1 only asks "did an action take effect TODAY?", because the exchange
# reference it compares against is reset to the adjusted close overnight. On
# ex-date+1 that signal is gone, while a provider that is still behind keeps
# answering k=1.0 — so the identical false stop fires one day later, outside the
# guard entirely. AIG was stopped twice for one bonus: once on 08-04 (fixed by
# guard 1) and again on 08-05, when the same 46,900 low was measured against the
# same pre-bonus 48,000 stop. The correct nominal low that session was 54,474.
#
# The fix is to stop treating the provider as the only witness. Two more sources
# answer the same question and fail independently:
#   * `recommendations.adj_factor` — a factor a PREVIOUS run already observed
#     and persisted. AIG carried 0.860962, written 08-04, while the run that
#     closed it on 08-05 derived 1.0 and never looked.
#   * `ta_ohlcv` — our own history, which the TA pipeline re-backfills (adjusted)
#     in its Step 1b. It ran at 09:23 UTC on 08-04, so by the 08-05 evaluation
#     the correct factor was sitting in our own database.
#
# They combine with min() rather than a precedence order, because k is
# MONOTONICALLY NON-INCREASING over a position's life: k = adjusted(ref_date) /
# nominal(ref_date), the denominator is fixed at rec time, and every corporate
# action only ever lowers the numerator. So a source that is behind reports a k
# too HIGH (1.0 = "nothing happened"), never too low — every failure mode biases
# the same way, and the lowest candidate is the one that has seen the most.
# A rise in k is not a corporate action reversing; it is a source regressing.

# vnstock KBS source: free, no API key needed
VNSTOCK_SOURCE = "KBS"
REQUEST_DELAY = 3.5  # seconds between requests to stay under rate limit

# Vietnam timezone (UTC+7) — GitHub Actions runs in UTC, so date.today() would
# return UTC date which may differ from Vietnam date. Always use this instead.
VN_TZ = timezone(timedelta(hours=7))


def today_vn() -> date:
    """Return today's date in Vietnam timezone (GMT+7)."""
    return datetime.now(VN_TZ).date()


def get_supabase_client():
    from supabase import create_client

    # Service role since migration 045 — anon is read-only. Shared resolver so
    # the four standalone entry points can't drift from the pipeline's.
    from ta.common import resolve_supabase_key

    if not SUPABASE_URL:
        print("Error: SUPABASE_URL must be set in .env")
        sys.exit(1)
    key, _label = resolve_supabase_key()
    if not key:
        print("Error: no Supabase key set (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)")
        sys.exit(1)
    return create_client(SUPABASE_URL, key)


def fetch_price_history(symbol: str, start: date, end: date) -> dict[str, dict] | None:
    """Fetch adjusted daily OHLCV from vnstock KBS over [start, end].

    Returns {date_iso: {date, open, high, low, close, volume}} in raw VND
    (vnstock returns thousands; ×1000), or None on error / no data.

    NOTE: KBS history() is BACK-ADJUSTED — a corporate action (dividend / bonus
    / rights / split) re-scales the pre-ex bars downward. A recommendation's
    entry/SL/TP are the NOMINAL levels captured at rec time, so comparing them
    against adjusted prices would false-trigger a stop on the ex-date drop. See
    adjustment_factor() / _rebase_price(), which reconcile the two.
    """
    from vnstock import Vnstock

    try:
        stock = Vnstock().stock(symbol=symbol, source=VNSTOCK_SOURCE)
        df = stock.quote.history(start=start.isoformat(), end=end.isoformat(), interval="1D")
    except Exception as e:
        error_msg = str(e)
        if "Dữ liệu trống" in error_msg or "empty" in error_msg.lower():
            print(f"  {symbol}: no data")
            return None
        print(f"  {symbol}: error fetching — {error_msg}")
        return None

    if df is None or df.empty:
        print(f"  {symbol}: no data returned")
        return None

    out: dict[str, dict] = {}
    for _, row in df.iterrows():
        d = str(row["time"])[:10]
        # vnstock returns thousands VND (28.05 = 28,050); DB stores raw VND.
        out[d] = {
            "date": d,
            "open": float(row["open"]) * 1000,
            "high": float(row["high"]) * 1000,
            "low": float(row["low"]) * 1000,
            "close": float(row["close"]) * 1000,
            "volume": int(row["volume"]),
        }
    return out


def _latest_today_bar(hist: dict | None, today_iso: str) -> dict | None:
    """Most recent bar, but only if it is from today (staleness guard)."""
    if not hist:
        return None
    d = max(hist)
    return hist[d] if d == today_iso else None


def _close_on_or_before(hist: dict, date_iso: str) -> float | None:
    """Adjusted close on `date_iso`, or the nearest prior trading day."""
    cands = [d for d in hist if d <= date_iso]
    return hist[max(cands)]["close"] if cands else None


def adjustment_factor(hist: dict | None, rec: dict, tol: float = 0.01) -> float:
    """Corporate-action factor k = adjusted_close(ref_date) / nominal_close(ref_date).

    The recommendation stores `last_close` (the NOMINAL close at `last_close_date`,
    captured at rec time). KBS now returns those bars BACK-ADJUSTED, so if a
    dividend/bonus/split happened since, adjusted < nominal and k < 1. Dividing
    the fetched (adjusted) prices by k rebases them into the recommendation's
    original nominal terms, so the existing SL/TP/P&L logic stays correct and an
    ex-date drop can't false-trigger a stop. Returns 1.0 when there is no usable
    reference or no material adjustment (|k−1| ≤ tol).
    """
    ref_date = rec.get("last_close_date")
    ref_nominal = rec.get("last_close")
    if not hist or not ref_date or ref_nominal is None:
        return 1.0
    try:
        ref_nominal = float(ref_nominal)
    except (TypeError, ValueError):
        return 1.0
    if ref_nominal <= 0:
        return 1.0
    adj = _close_on_or_before(hist, ref_date)
    if not adj or adj <= 0:
        return 1.0
    return _sane_factor(adj / ref_nominal, tol)


def _sane_factor(k: float, tol: float = 0.01) -> float:
    """A raw ratio reduced to a usable corporate-action factor, or 1.0.

    Rejects k > 1 as well as k <= 0. Every corporate action LOWERS the adjusted
    price, so adjusted > nominal is never one — it is a mistyped `last_close` on
    a manual entry, or a provider glitch. Left alone it is actively dangerous:
    _rebase_price divides by k, so k = 1.05 marks every price down 5% and can
    fire a stop the market never touched, which is the exact failure this whole
    module exists to prevent — just with the sign flipped.
    """
    if k <= 0 or k > 1.0:
        return 1.0
    return k if abs(k - 1.0) > tol else 1.0


def _db_factor(rec: dict, ref_closes: dict[tuple[str, str], float], tol: float = 0.01) -> float:
    """The same factor derived from `ta_ohlcv` instead of the provider's live answer.

    `ta_ohlcv` is append-only and RAW, but the TA pipeline's Step 1b re-backfills
    (adjusted) any symbol it detects an action on, so once that has run our own
    copy carries the adjustment. It runs at 09:23 UTC, this job at 08:43 — so on
    the ex-date itself this source is still behind (guard 1 covers that session)
    and from ex-date+1 it is the one that is reliably ahead of the provider.
    """
    ref_date = rec.get("last_close_date")
    ref_nominal = rec.get("last_close")
    if not ref_date or ref_nominal is None:
        return 1.0
    try:
        ref_nominal = float(ref_nominal)
    except (TypeError, ValueError):
        return 1.0
    if ref_nominal <= 0:
        return 1.0
    stored = ref_closes.get((rec["symbol"], ref_date))
    if not stored or stored <= 0:
        return 1.0
    return _sane_factor(stored / ref_nominal, tol)


def _stored_factor(rec: dict, tol: float = 0.01) -> float:
    """The factor a previous run already observed and persisted on the row."""
    k = rec.get("adj_factor")
    if k is None:
        return 1.0
    try:
        return _sane_factor(float(k), tol)
    except (TypeError, ValueError):
        return 1.0


def effective_factor(rec: dict, hist: dict | None,
                     ref_closes: dict[tuple[str, str], float]) -> tuple[float, str]:
    """(k, source) — the most-adjusted factor any witness reports.

    See the SUSPECT_REF_DEV block for why min() is the right combiner: k can only
    fall over a position's life, so the lowest candidate is the best-informed one
    and a source that is behind can only ever pull the answer toward 1.0.
    """
    cands = {
        "history": adjustment_factor(hist, rec),
        "stored": _stored_factor(rec),
        "ta_ohlcv": _db_factor(rec, ref_closes),
    }
    source, k = min(cands.items(), key=lambda kv: kv[1])
    if k == 1.0:
        return 1.0, "none"
    # Name every witness that agrees, so the log distinguishes "all three saw it"
    # from "only our own database did" — the second is a provider lag worth
    # noticing, and it is exactly the state AIG was in on 2026-08-05.
    # Relative tolerance, not exact equality: `adj_factor` is persisted rounded to
    # six decimals, so the stored witness never matches the freshly computed one
    # to the bit and every log would read as a lone source.
    agree = [n for n, v in cands.items() if abs(v - k) <= 5e-6 * k]
    return k, "+".join(agree)


def _rebase_price(bar: dict | None, k: float) -> dict | None:
    """Express an adjusted price bar in the recommendation's nominal basis
    (divide OHLC by the corporate-action factor k). No-op when k == 1.0."""
    if not bar or k == 1.0:
        return bar
    return {**bar, **{f: bar[f] / k for f in ("open", "high", "low", "close")}}


def count_business_days(since_date: str) -> int:
    """Count weekdays (Mon-Fri) between since_date and today, excluding since_date."""
    start = date.fromisoformat(since_date)
    end = today_vn()
    count = 0
    current = start + timedelta(days=1)
    while current <= end:
        if current.weekday() < 5:  # Mon=0 ... Fri=4
            count += 1
        current += timedelta(days=1)
    return count


def fetch_ref_closes(client, recs: list[dict]) -> dict[tuple[str, str], float]:
    """{(symbol, ref_date): our stored close on or before ref_date} from ta_ohlcv.

    One tiny query per distinct (symbol, reference date) — a handful per run.
    A symbol outside the TA universe simply has no entry, which _db_factor reads
    as "no evidence" (k = 1.0), never as "no adjustment".
    """
    out: dict[tuple[str, str], float] = {}
    pairs = {(r["symbol"], r["last_close_date"]) for r in recs if r.get("last_close_date")}
    for sym, ref_date in sorted(pairs):
        try:
            rows = (
                client.table("ta_ohlcv").select("date,close")
                .eq("symbol", sym).lte("date", ref_date)
                .order("date", desc=True).limit(1).execute()
            ).data
        except Exception:  # noqa: BLE001 — a missing table must not stop evaluation
            continue
        if rows and rows[0].get("close") is not None:
            out[(sym, ref_date)] = float(rows[0]["close"])
    return out


def suspect_adjustments(client, symbols: list[str]) -> dict[str, float]:
    """{symbol: deviation} where the exchange's reference price disagrees with the
    last close we stored before it — the same-session signal that a corporate
    action took effect, available before the provider back-adjusts its history.
    Failures return {} so the guard degrades to today's behaviour, never worse.
    """
    out: dict[str, float] = {}
    if not symbols:
        return out
    try:
        from ta.adjustments import _fetch_ref_prices, _stored_closes
        ref = _fetch_ref_prices(symbols)
    except Exception as e:  # noqa: BLE001
        print(f"  adjustment guard inactive (reference fetch failed: {str(e)[:70]})")
        return out
    cutoff = (date.today() - timedelta(days=45)).isoformat()
    for sym in symbols:
        got = ref.get(sym)
        if not got:
            continue
        rp, td, _shares = got
        try:
            closes = _stored_closes(client, sym, cutoff)
        except Exception:  # noqa: BLE001
            continue
        prior = max((d for d in closes if d < td), default=None)
        if not prior or not closes[prior]:
            continue
        dev = rp / closes[prior] - 1.0
        if abs(dev) > SUSPECT_REF_DEV:
            out[sym] = dev
    return out


# Fields evaluate_recommendation() sets when it CLOSES a position. Stripping
# these (and restoring the prior status) turns a close back into a plain
# mark-to-market update, which is what deferring an exit means.
CLOSE_FIELDS = ("actual_exit_price", "actual_pnl_pct", "closed_at")


def evaluate_recommendation(rec: dict, price: dict, days_held: int) -> dict | None:
    """Evaluate a recommendation against today's price.

    Returns a dict of fields to update, or None if no change needed.
    SL/TP checks are skipped if days_held < MIN_DAYS_BEFORE_EXIT (T+2.5 rule).
    """
    if not price:
        return None

    entry = float(rec["entry_price"])
    # Manual (admin-added) entries may omit SL/TP — when absent, no exit is
    # triggered and we only track current price + drawdown.
    stop_loss = float(rec["stop_loss"]) if rec.get("stop_loss") is not None else None
    tp1 = float(rec["tp1"]) if rec.get("tp1") is not None else None
    tp2 = float(rec["tp2"]) if rec.get("tp2") else None
    status = rec["status"]

    # Guard against targets on the wrong side of entry (this tracker is
    # long-only). A take-profit at/below entry or a stop at/above entry is bad
    # data — e.g. a mistyped manual entry of tp1=20 against a 10,200 entry —
    # which would otherwise fire a false exit and book a catastrophic "gain"
    # (exit at 20 → −99.8% P&L and max drawdown). Treat such targets as absent.
    if str(rec.get("action") or "BUY").upper() != "SELL":
        if stop_loss is not None and stop_loss >= entry:
            stop_loss = None
        if tp1 is not None and tp1 <= entry:
            tp1 = None
        if tp2 is not None and tp2 <= entry:
            tp2 = None

    day_high = float(price["high"])
    day_low = float(price["low"])
    day_close = float(price["close"])
    day_date = price["date"]

    updates = {}

    # Vietnam T+2.5: can only sell from T+3 onward (using daily OHLCV).
    # Before that, only update current price — no SL/TP evaluation.
    can_exit = days_held >= MIN_DAYS_BEFORE_EXIT

    if can_exit and status == "OPEN":
        # Check stop loss first (conservative: assume worst case hit first)
        if stop_loss is not None and day_low <= stop_loss:
            updates["status"] = "STOPPED"
            updates["actual_exit_price"] = stop_loss
            updates["actual_pnl_pct"] = round((stop_loss - entry) / entry * 100, 2)
            updates["closed_at"] = day_date

        # Check TP1
        elif tp1 is not None and day_high >= tp1:
            updates["status"] = "TP1_HIT"
            if not tp2:
                # No TP2 defined, close at TP1
                updates["actual_exit_price"] = tp1
                updates["actual_pnl_pct"] = round((tp1 - entry) / entry * 100, 2)
                updates["closed_at"] = day_date

    elif can_exit and status == "TP1_HIT":
        # After TP1 hit, stop loss moves to entry (breakeven for remaining 50%)
        if day_low <= entry:
            # Stopped at breakeven on remaining 50%
            # Blended P&L: 50% at TP1 + 50% at entry = 50% of TP1 gain
            tp1_gain_pct = (tp1 - entry) / entry * 100
            blended_pnl = tp1_gain_pct * 0.5
            updates["status"] = "STOPPED"
            updates["actual_exit_price"] = entry
            updates["actual_pnl_pct"] = round(blended_pnl, 2)
            updates["closed_at"] = day_date

        elif tp2 and day_high >= tp2:
            # TP2 hit — full success
            # Blended P&L: 50% at TP1 + 50% at TP2
            tp1_gain_pct = (tp1 - entry) / entry * 100
            tp2_gain_pct = (tp2 - entry) / entry * 100
            blended_pnl = (tp1_gain_pct + tp2_gain_pct) / 2
            updates["status"] = "TP2_HIT"
            updates["actual_exit_price"] = tp2
            updates["actual_pnl_pct"] = round(blended_pnl, 2)
            updates["closed_at"] = day_date

    # Always update current price (even before T+2.5)
    updates["current_price"] = day_close
    updates["current_price_date"] = day_date

    # Track max drawdown from entry.
    # If the position closed today (SL/TP/expiry triggered), drawdown is
    # bounded by actual_pnl_pct — we exited at SL/TP price, not at the
    # post-exit intraday low. Otherwise, use day_low.
    is_closing_today = "actual_pnl_pct" in updates
    if is_closing_today:
        actual_pnl = updates["actual_pnl_pct"]
        # Losing exits (SL): drawdown = exit % (e.g., -5% SL), regardless of
        # any deeper intraday low after the SL was hit. For winning exits,
        # leave prior max_drawdown_pct unchanged.
        if actual_pnl < 0:
            updates["max_drawdown_pct"] = actual_pnl
    else:
        today_drawdown_pct = round((day_low - entry) / entry * 100, 2)
        if today_drawdown_pct < 0:
            prev_dd = rec.get("max_drawdown_pct")
            if prev_dd is None or today_drawdown_pct < float(prev_dd):
                updates["max_drawdown_pct"] = today_drawdown_pct

    new_status = updates.get("status", status)
    if new_status in ACTIVE_STATUSES:
        updates["unrealized_pnl_pct"] = round((day_close - entry) / entry * 100, 2)

    return updates if updates else None


def check_expiry(rec: dict, days_held: int) -> dict | None:
    """Check if a recommendation has exceeded its holding period."""
    max_sessions = rec.get("holding_period_sessions")
    if not max_sessions:
        return None

    # Add 50% buffer before auto-expiring (holding period is an estimate)
    expiry_threshold = int(max_sessions * 1.5)

    if days_held > expiry_threshold and rec["status"] in ACTIVE_STATUSES:
        return {
            "status": "EXPIRED",
            "closed_at": today_vn().isoformat(),
        }
    return None


def main():
    parser = argparse.ArgumentParser(description="Evaluate open recommendations against market prices")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without updating")
    parser.add_argument("--all", action="store_true", help="Re-evaluate all recommendations (including closed)")
    args = parser.parse_args()

    client = get_supabase_client()

    # Get recommendations to evaluate
    query = client.table("recommendations").select("*")
    if not args.all:
        query = query.in_("status", list(ACTIVE_STATUSES))
    query = query.order("trading_date").order("rank")
    result = query.execute()
    recs = result.data

    if not recs:
        print("No active recommendations to evaluate.")
        return

    symbols = list(set(r["symbol"] for r in recs))
    print(f"Evaluating {len(recs)} recommendation(s) across {len(symbols)} symbol(s)")

    today_iso = today_vn().isoformat()

    # Earliest reference date per symbol (a rec's last_close_date, falling back
    # to trading_date) — we fetch history back to there so a corporate action
    # anywhere in the holding period is detectable via adjustment_factor().
    earliest_ref: dict[str, str] = {}
    for rec in recs:
        ref = rec.get("last_close_date") or rec.get("trading_date")
        if ref:
            cur = earliest_ref.get(rec["symbol"])
            if cur is None or ref < cur:
                earliest_ref[rec["symbol"]] = ref

    # Step 1: Fetch adjusted price history per symbol (one vnstock call each),
    # covering the holding period so we can rebase for corporate actions.
    print("\nFetching prices (adjusted; rebased to nominal per recommendation)...")
    hist_by_symbol: dict[str, dict | None] = {}
    latest_by_symbol: dict[str, dict | None] = {}
    for i, symbol in enumerate(sorted(symbols)):
        ref = earliest_ref.get(symbol, today_iso)
        start = date.fromisoformat(ref) - timedelta(days=7)
        hist = fetch_price_history(symbol, start, today_vn())
        hist_by_symbol[symbol] = hist
        latest = _latest_today_bar(hist, today_iso)
        latest_by_symbol[symbol] = latest
        if latest:
            print(f"  {symbol}: {latest['date']} C={latest['close']:,.0f} H={latest['high']:,.0f} L={latest['low']:,.0f}")
        elif hist:
            print(f"  {symbol}: latest bar {max(hist)} != {today_iso} — no fresh price today")
        if i < len(symbols) - 1:
            time.sleep(REQUEST_DELAY)

    # One bulk price_board call for the open symbols — cheap, and it is the only
    # signal available on the ex-date itself (see SUSPECT_REF_DEV).
    # Our own copy of the same history, as an independent witness to any
    # corporate action the provider has not applied yet (see effective_factor).
    ref_closes = fetch_ref_closes(client, recs)

    suspects = suspect_adjustments(client, symbols)
    for sym, dev in suspects.items():
        print(f"  {sym}: exchange reference {dev * 100:+.1f}% vs last stored close "
              f"— corporate action suspected")

    # Step 2: Evaluate each recommendation
    print(f"\n{'Symbol':<7} {'Entry':>9} {'SL':>9} {'TP1':>9} {'Current':>9} {'P&L':>8} {'Status':<12} {'Change'}")
    print("─" * 90)

    updates_count = 0
    for rec in recs:
        hist = hist_by_symbol.get(rec["symbol"])
        # Rebase today's adjusted bar into this recommendation's nominal basis
        # so a corporate action during the holding period can't false-trigger a
        # stop and P&L stays on the entry/SL/TP scale.
        k, ksrc = effective_factor(rec, hist, ref_closes)
        price = _rebase_price(latest_by_symbol.get(rec["symbol"]), k)
        if k != 1.0:
            print(f"  {rec['symbol']} (id {rec['id']}): corporate-action factor k={k:.4f} "
                  f"applied (source: {ksrc}) — entry/SL/TP evaluated on nominal basis")
        days_held = count_business_days(rec["trading_date"])

        # Evaluate TP/SL (respects T+2.5 settlement)
        updates = evaluate_recommendation(rec, price, days_held)

        # Defer — never close — on a suspected same-session adjustment we could
        # not rebase. k != 1.0 means the rebase already handled it and the exit is
        # trustworthy; k == 1.0 with the reference disagreeing means the provider
        # has not back-adjusted yet, so any exit here is measured against a
        # re-scaled price. The mark-to-market still lands; only the irreversible
        # part waits for the next run.
        if (updates and k == 1.0 and rec["symbol"] in suspects
                and any(f in updates for f in CLOSE_FIELDS)):
            dev = suspects[rec["symbol"]]
            for f in CLOSE_FIELDS:
                updates.pop(f, None)
            updates["status"] = rec["status"]
            print(f"  {rec['symbol']} (id {rec['id']}): exit DEFERRED — exchange "
                  f"reference {dev * 100:+.1f}% vs last stored close suggests a "
                  f"corporate action the price history has not picked up yet")

        # Check expiry (only if not already closed by TP/SL)
        if updates and updates.get("status", rec["status"]) in ACTIVE_STATUSES:
            expiry = check_expiry(rec, days_held)
            if expiry:
                updates.update(expiry)
        elif not updates:
            expiry = check_expiry(rec, days_held)
            if expiry:
                updates = expiry

        # Add days_held
        if updates:
            updates["days_held"] = days_held

        # Display
        current = updates.get("current_price", rec.get("current_price")) if updates else rec.get("current_price")
        entry = float(rec["entry_price"])
        pnl = updates.get("unrealized_pnl_pct") or updates.get("actual_pnl_pct") if updates else None
        new_status = updates.get("status", rec["status"]) if updates else rec["status"]
        changed = new_status != rec["status"]

        pnl_str = f"{pnl:+.1f}%" if pnl is not None else "—"
        current_str = f"{current:,.0f}" if current else "—"
        change_str = f"{rec['status']} -> {new_status}" if changed else ""
        if days_held < MIN_DAYS_BEFORE_EXIT and rec["status"] in ACTIVE_STATUSES:
            change_str += f" (T+{days_held}, settlement pending)"

        sl_str = f"{float(rec['stop_loss']):>9,.0f}" if rec.get("stop_loss") is not None else f"{'—':>9}"
        tp1_str = f"{float(rec['tp1']):>9,.0f}" if rec.get("tp1") is not None else f"{'—':>9}"
        print(
            f"{rec['symbol']:<7} "
            f"{entry:>9,.0f} "
            f"{sl_str} "
            f"{tp1_str} "
            f"{current_str:>9} "
            f"{pnl_str:>8} "
            f"{new_status:<12} "
            f"{change_str}"
        )

        # Record the corporate-action factor. Presentation + audit only: no stored
        # P&L depends on it (the rebase above already makes P&L a total-return
        # measure on the original share count). The Portfolio page uses it to show
        # the market-basis price beside the nominal one, so a row reading
        # entry 50,000 / current 52,000 while the market trades at 26,000 explains
        # itself instead of looking broken.
        #
        # Guarded on the column being present in the fetched row: recs come from
        # select("*"), so before migration 042 is applied the key is simply absent
        # and we skip the write rather than failing the whole daily evaluation.
        if k != 1.0 and "adj_factor" in rec:
            updates = updates or {}
            updates["adj_factor"] = round(k, 6)
            if rec.get("adj_detected_at") is None and price:
                # First observation. Not the exchange ex-date — nothing here
                # records ex-dates — so it means "detected on or before".
                updates["adj_detected_at"] = price["date"]

        # Apply updates
        if updates and not args.dry_run:
            client.table("recommendations").update(updates).eq("id", rec["id"]).execute()
            updates_count += 1
        elif updates and args.dry_run:
            updates_count += 1

    action = "would update" if args.dry_run else "updated"
    print(f"\n{action.capitalize()} {updates_count} recommendation(s).")

    if args.dry_run:
        print("(DRY RUN — no changes applied)")


if __name__ == "__main__":
    main()
