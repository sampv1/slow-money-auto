"""Persist the Holding/Hỗn hợp deep score (/38) for BVH and PVI.

BA FINAL SPEC 2026-10-01 §21-§23. The engine was frozen when Track A closed;
this is the persistence layer it never had, plus the §18 data-mapping guard.

THE REFERENCE SET IS POINT-IN-TIME, and that is the one implementation choice
here worth defending. A backfilled row for 2024-Q1 is scored against the
observations available AT 2024-Q1, never against the full series. Scoring a
historical quarter with observations that had not happened yet is look-ahead:
the stored row would change every time a new quarter landed, which makes it
unreplayable, and it is the same rule the CTCK rubric already enforces through
`market_share_asof` and its effective dates. For the LATEST quarter the two
readings are identical, so nothing on screen today depends on this.

A CONSEQUENCE WORTH EXPECTING: with `MIN_N_VALID = 12`, a metric's first eleven
quarters are `SELF_HISTORY_INSUFFICIENT`, so BVH's reserve metrics — whose
history starts at the source-verified 2022-Q1 cutoff — carry no score until
their twelfth observation. That is the gate reporting honestly, not a gap.

Usage:
    python3 export_insurance_deep.py                  # latest quarter, dry run
    python3 export_insurance_deep.py --write          # latest quarter, persist
    python3 export_insurance_deep.py --backfill --write
    python3 export_insurance_deep.py --period 2026-Q2 --json out.json
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa import holding as H
from fa import holding_guard as G
from fa import insurance_deep as D
from ta.common import get_supabase_client, safe_execute

TABLE = "fa_insurance_deep_scores"
SNAPSHOT_DIR = Path(__file__).resolve().parent / "outputs" / "holding_deep"

#: §24/§25 label text. Stored on the row so the frontend renders a name rather
#: than inventing one — §27 forbids calling B3/B4/P4 a solvency ratio, and a
#: label that lives in one place cannot drift into that in one locale only.
METRIC_NAMES = {
    "B1": "Financial Efficiency TTM",
    "B2": "Δ Financial Efficiency YoY",
    "B3": "Investment Coverage",
    "B4": "Capital Buffer Level",
    "P1": "Insurance Margin TTM",
    "P2": "Δ Insurance Margin YoY",
    "P3": "Financial Efficiency TTM",
    "P4": "Capital Buffer Level",
}

#: B2/P2 are percentage-POINT differences. Printing '%' on them would state
#: something false, so the unit travels with the row (§30).
METRIC_UNITS = {"B1": "%", "B2": "ppt", "B3": "%", "B4": "%",
                "P1": "%", "P2": "ppt", "P3": "%", "P4": "%"}

PERSIST_COLUMNS = (
    "symbol", "period", "public_category", "engine_profile",
    "metric_code", "metric_name", "unit",
    "current_value", "history_percentile", "score", "weight",
    "n_valid", "average_rank", "history_first", "history_last", "valid_from",
    "deep_total", "data_status", "data_mapping_alert", "guard_reason",
    "guard_qoq_pct", "mapping_fingerprint",
    "scoring_version", "formula_version", "mapping_version", "ui_spec_version",
)


# --------------------------------------------------------------------------
# Load + build
# --------------------------------------------------------------------------

def load(client, symbol, statement, keys):
    sel = "symbol,period," + ",".join(f"{k}:items->{k}" for k in keys)
    rows = safe_execute(
        client.table("fa_vnstock_statements").select(sel).eq("symbol", symbol)
        .eq("period_type", "quarter").eq("statement", statement).order("period"),
        label=f"{symbol} {statement}").data or []
    return {r["period"]: {k: (float(r[k]) if r[k] is not None else None)
                          for k in keys} for r in rows}


def metric_series(symbol, inc, bal):
    """Every metric's full valid series, with the locked `valid_from` applied.

    Mirrors `verify_holding_live.build` deliberately: that script is what BA's
    evidence pack cites as the formula reproduction, so the persisted rows must
    come off the same construction rather than a second one.
    """
    series: dict[str, dict[str, float]] = {c: {} for c in H.METRICS_BY_TICKER[symbol]}

    fin_eff, margin = {}, {}
    for p in sorted(set(inc) | set(bal)):
        v = H.financial_efficiency(inc, bal, p)
        if v is not None:
            fin_eff[p] = v
        m = H.insurance_margin_ttm(inc, p)
        if m is not None:
            margin[p] = m

    for p in sorted(bal):
        if symbol == "BVH":
            for code, fn in (("B3", H.investment_coverage),
                             ("B4", H.capital_buffer_level)):
                cut = H.VALID_FROM.get((symbol, code))
                if cut and p < cut:
                    continue
                v = fn(bal, p)
                if v is not None:
                    series[code][p] = v
        else:
            cut = H.VALID_FROM.get((symbol, "P4"))
            if not (cut and p < cut):
                v = H.capital_buffer_level(bal, p)
                if v is not None:
                    series["P4"][p] = v

    if symbol == "BVH":
        series["B1"] = dict(fin_eff)
        series["B2"] = {p: d for p in sorted(fin_eff)
                        if (d := H.yoy_delta(fin_eff, p)) is not None}
    else:
        series["P1"] = dict(margin)
        series["P2"] = {p: d for p in sorted(margin)
                        if (d := H.yoy_delta(margin, p)) is not None}
        series["P3"] = dict(fin_eff)
    return series


def score_symbol_period(symbol, series, reserves, period, stored_fp=None):
    """The four metric rows for one symbol-quarter, guard applied."""
    codes = H.METRICS_BY_TICKER[symbol]
    cut_any = H.VALID_FROM.get((symbol, "B4")) or H.VALID_FROM.get((symbol, "P4"))
    guard = G.reserve_guard(reserves, period, symbol, cut_any, stored_fp)

    rows, scores = [], []
    for code in codes:
        s = series[code]
        # POINT-IN-TIME: observations available at `period`, never after it.
        hist = [s[p] for p in sorted(s) if p <= period]
        cur = s.get(period)
        sc = H.percentile_score(hist, cur, H.WEIGHTS[code], code)

        blocked = guard.applies_to(code)
        status = G.STATUS_PENDING if blocked else sc.status
        rows.append({
            "symbol": symbol, "period": period,
            "public_category": H.PUBLIC_CATEGORY,
            "engine_profile": H.MODEL_BY_TICKER[symbol],
            "metric_code": code, "metric_name": METRIC_NAMES[code],
            "unit": METRIC_UNITS[code],
            "current_value": None if blocked else sc.current,
            "history_percentile": None if blocked else sc.percentile,
            # NO_ZERO_FILL: a blocked metric carries NO score, never 0.
            "score": None if blocked else sc.score,
            "weight": H.WEIGHTS[code],
            "n_valid": len(hist),
            "average_rank": None if blocked else sc.rank,
            "history_first": (sorted(s)[0] if s and hist else None),
            "history_last": (max(p for p in s if p <= period) if hist else None),
            "valid_from": H.VALID_FROM.get((symbol, code)),
            "data_status": status,
            "data_mapping_alert": bool(blocked),
            "guard_reason": guard.reason if blocked else None,
            "guard_qoq_pct": guard.qoq_pct,
            "mapping_fingerprint": guard.fingerprint,
            "scoring_version": H.HOLDING_SCORING_VERSION,
            "formula_version": H.HOLDING_FORMULA_VERSION,
            "mapping_version": H.HOLDING_MAPPING_VERSION,
            "ui_spec_version": H.HOLDING_UI_SPEC_VERSION,
        })
        scores.append(None if blocked else sc.score)

    # UNROUNDED sum; NULL when any component is unscored, because a partial
    # total reads as a low score and §18 says absence, not a number.
    total = None if any(v is None for v in scores) else sum(scores)
    for r in rows:
        r["deep_total"] = total
    return rows, guard


def deep_start(symbol, series) -> str | None:
    """The first quarter at which a /38 EXISTS AT ALL for this ticker.

    A deep observation needs all four drivers in scope, so the start is the
    LATEST of their individual starts -- a declared `VALID_FROM` where there is
    one, otherwise the first quarter the driver can be computed.

    WHY THIS IS NOT COSMETIC. Without it the backfill emitted a B3 and a B4 row
    for every BVH quarter back to 2019-Q1, carrying NULL and the status
    `NOT_SCORED_CURRENT_INVALID` -- "this quarter's value could not be formed
    from four consecutive quarters of filings". That is FALSE: the filings
    exist and reconcile, and we exclude them because the source-verified cutoff
    says the provider's field means something else before 2022-Q1. Writing
    "could not be formed" over "excluded by cutoff" files two different facts
    under one label, and BA §23 forbids the rows outright ("Không backfill
    ngoài valid_from"). Measured: 24 such rows on the first write.

    Nothing analytical is lost by dropping them. The percentile reference set is
    built from the in-memory series, never from stored rows, so BVH's B1/B2
    history still scores exactly as before -- it simply is not filed under a
    /38 that cannot exist at that date.
    """
    starts = []
    for code in H.METRICS_BY_TICKER[symbol]:
        declared = H.VALID_FROM.get((symbol, code))
        observed = min(series[code]) if series[code] else None
        candidates = [x for x in (declared, observed) if x]
        if not candidates:
            return None
        starts.append(max(candidates))
    return max(starts)


def build_rows(client, periods=None, backfill=False):
    out, guards = [], []
    for symbol in H.UNIVERSE:
        inc = load(client, symbol, "income", D.INCOME_KEYS)
        bal = load(client, symbol, "balance", D.BALANCE_KEYS)
        reserves = {p: v.get(D.INSURANCE_RESERVES) for p, v in bal.items()}
        series = metric_series(symbol, inc, bal)

        start = deep_start(symbol, series)
        covered = sorted({p for s in series.values() for p in s}
                         if start is None else
                         {p for s in series.values() for p in s if p >= start})
        if periods:
            targets = [p for p in covered if p in set(periods)]
        elif backfill:
            targets = covered
        else:
            targets = covered[-1:]

        for p in targets:
            rows, g = score_symbol_period(symbol, series, reserves, p)
            out += rows
            guards.append((symbol, p, g))
    return out, guards


# --------------------------------------------------------------------------
# Persist
# --------------------------------------------------------------------------

def persist(client, rows, dry=True, prune=False):
    payload = [{k: r.get(k) for k in PERSIST_COLUMNS} for r in rows]

    # Boundary re-check: never write a total that disagrees with its parts.
    by_key: dict[tuple, list] = {}
    for r in rows:
        by_key.setdefault((r["symbol"], r["period"]), []).append(r)
    for (sym, per), group in by_key.items():
        if len(group) != 4:
            raise RuntimeError(f"{sym} {per}: {len(group)} metric rows, expected 4")
        if sum(g["weight"] for g in group) != 38:
            raise RuntimeError(f"{sym} {per}: weights do not sum to 38")
        parts = [g["score"] for g in group]
        want = None if any(v is None for v in parts) else sum(parts)
        got = group[0]["deep_total"]
        if (want is None) != (got is None) or (
                want is not None and abs(want - got) > 1e-9):
            raise RuntimeError(f"{sym} {per}: deep_total {got} != Σcomponents {want}")

    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%dT%H%M%S")
    try:
        existing = safe_execute(
            client.table(TABLE).select("*")
            .eq("scoring_version", H.HOLDING_SCORING_VERSION),
            label="deep snapshot").data or []
    except Exception as exc:  # noqa: BLE001
        # PGRST205, not Postgres's 42P01 — PostgREST answers from its schema
        # cache first. A dry run stays useful before the migration is applied.
        if "PGRST205" not in str(exc) and "schema cache" not in str(exc):
            raise
        print(f"{TABLE} does not exist yet — apply supabase/074 first.")
        if not dry:
            raise
        print(f"dry run: {len(payload)} rows validated, "
              f"{len(PERSIST_COLUMNS)} columns each; nothing written")
        return 0

    snap = SNAPSHOT_DIR / f"before_{stamp}.json"
    snap.write_text(json.dumps(existing, default=str, indent=1))
    print(f"rollback snapshot: {len(existing)} existing rows -> {snap}")

    if dry:
        print(f"dry run: would write {len(payload)} rows to {TABLE}")
        return 0

    for i in range(0, len(payload), 200):
        safe_execute(
            client.table(TABLE).upsert(
                payload[i:i + 200],
                on_conflict="symbol,period,metric_code,scoring_version"),
            label=f"{TABLE} upsert")
    print(f"wrote {len(payload)} rows to {TABLE}")

    # A FULL BACKFILL OWNS THE WHOLE VERSION, so it must also remove what it no
    # longer produces -- an upsert only adds and replaces. The first write of
    # this table left 24 BVH rows dated before the source-verified cutoff, and
    # without a prune they would have survived every later correct run. Scoped
    # to `--backfill` deliberately: a latest-only run writes one quarter and
    # must never be able to delete history.
    if prune:
        keep = {(r["symbol"], r["period"], r["metric_code"]) for r in payload}
        stored = safe_execute(
            client.table(TABLE).select("symbol,period,metric_code")
            .eq("scoring_version", H.HOLDING_SCORING_VERSION),
            label="deep prune scan").data or []
        stale = [r for r in stored
                 if (r["symbol"], r["period"], r["metric_code"]) not in keep]
        for r in stale:
            safe_execute(
                client.table(TABLE).delete()
                .eq("scoring_version", H.HOLDING_SCORING_VERSION)
                .eq("symbol", r["symbol"]).eq("period", r["period"])
                .eq("metric_code", r["metric_code"]),
                label="deep prune")
        print(f"pruned {len(stale)} row(s) no longer produced by this version")

    # Read back rather than trusting the write (a denied PostgREST write
    # returns 204 with zero rows affected, not an error — migration 045).
    back = safe_execute(
        client.table(TABLE).select("symbol,period,metric_code,score,deep_total,data_status")
        .eq("scoring_version", H.HOLDING_SCORING_VERSION), label="deep readback").data or []
    want = {(r["symbol"], r["period"], r["metric_code"]):
            (r["score"], r["data_status"]) for r in payload}
    got = {(r["symbol"], r["period"], r["metric_code"]):
           (r["score"], r["data_status"]) for r in back}
    bad = [k for k in want if k not in got or (
        (want[k][1] != got[k][1]) or
        ((want[k][0] is None) != (got[k][0] is None)) or
        (want[k][0] is not None and abs(want[k][0] - got[k][0]) > 1e-9))]
    if bad:
        raise RuntimeError(f"read-back mismatch on {len(bad)} rows: {bad[:5]}")
    print(f"read-back: {len(got)} rows match the export exactly")
    return len(payload)


def report(rows, guards):
    print("=" * 78)
    print("HOLDING DEEP SCORE — BVH / PVI")
    print("=" * 78)
    for sym in H.UNIVERSE:
        rs = [r for r in rows if r["symbol"] == sym]
        if not rs:
            continue
        periods = sorted({r["period"] for r in rs})
        print(f"\n{sym} ({H.MODEL_BY_TICKER[sym]}) — {len(periods)} quarter(s), "
              f"{periods[0]}..{periods[-1]}")
        latest = periods[-1]
        for r in [x for x in rs if x["period"] == latest]:
            cur = "    —    " if r["current_value"] is None else f"{r['current_value']:9.4f}"
            pct = "   — " if r["history_percentile"] is None else f"{r['history_percentile']*100:5.2f}%"
            sc = "  —   " if r["score"] is None else f"{r['score']:6.4f}"
            print(f"   {r['metric_code']} {r['metric_name']:30s} "
                  f"{cur} {r['unit']:3s} pct={pct} score={sc}/{r['weight']:2d} "
                  f"N={r['n_valid']:3d} [{r['data_status']}]")
        tot = [x["deep_total"] for x in rs if x["period"] == latest][0]
        print(f"   DEEP_TOTAL = {'—' if tot is None else f'{tot:.4f}'}/38   ({latest})")
        scored = sum(1 for x in rs if x["data_status"] == "OK")
        print(f"   rows: {len(rs)}  scored: {scored}  "
              f"insufficient: {sum(1 for x in rs if x['data_status'] == 'SELF_HISTORY_INSUFFICIENT')}  "
              f"blocked: {sum(1 for x in rs if x['data_mapping_alert'])}")

    alerts = [(s, p, g) for s, p, g in guards if g.alert]
    print(f"\nDATA_MAPPING_GUARD: {len(alerts)} alert(s) over "
          f"{len(guards)} symbol-quarter(s)")
    for s, p, g in alerts:
        print(f"   ALERT {s} {p}: {g.reason} qoq={g.qoq_pct}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backfill", action="store_true",
                    help="every valid quarter, not just the latest")
    ap.add_argument("--period", action="append", help="explicit quarter(s)")
    ap.add_argument("--write", action="store_true", help="persist (default: dry run)")
    ap.add_argument("--json", help="also dump the rows to this path")
    a = ap.parse_args()

    client = get_supabase_client()
    rows, guards = build_rows(client, periods=a.period, backfill=a.backfill)
    report(rows, guards)

    if a.json:
        Path(a.json).write_text(json.dumps(rows, indent=1, default=str))
        print(f"\nwrote {len(rows)} rows -> {a.json}")

    persist(client, rows, dry=not a.write, prune=bool(a.backfill))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
