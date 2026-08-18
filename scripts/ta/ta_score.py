"""TA Score — a weighted blend of the technical components stored on ta_universe.

    TA Score = RS3M·20% + RS Composite·20% + RS Line·20% + Trend·40%

All four inputs (rs_3m, rs_composite, rs_line_score, trend_score) are on a 0-100
scale and already live on ta_universe (written by the RS + trend passes). This
step simply re-reads them and writes the blended ta_score, so it must run AFTER
those passes. A MISSING component contributes 0 (weights unchanged); a row gets a
null ta_score only when ALL four components are missing.

Trend's 40% used to be BQS's 35% (`base_score`, retired by migration 051 in
favour of the structural trend score); migration 052 then moved a further 5
points to it from RS Composite. That trim reduces a real overlap rather than
de-weighting relative strength — rs_3m is itself one of the four periods blended
into rs_composite, so the two components were counting the 3-month return twice.

Weights come from the scoring_config 'ta_score' row (deep-merged over
TA_SCORE_DEFAULTS).
"""

from .common import load_scoring_config, safe_execute

# DB-overridable defaults (see scoring_config key 'ta_score'). Keys map to the
# ta_universe columns rs_3m / rs_composite / rs_line_score / trend_score.
TA_SCORE_DEFAULTS = {
    "weights": {"rs_3m": 0.20, "rs_composite": 0.20, "rs_line": 0.20, "trend": 0.40},
}


def _read_components(client) -> list[dict]:
    """Paged read of the four TA-Score inputs + exchange (needed for the
    INSERT…ON CONFLICT upsert's NOT NULL exchange column).

    ACTIVE SYMBOLS ONLY. Scoring every row regardless of is_active manufactured
    phantom scores: RS is cleared when a symbol is retired, but the price/structure
    component survives, and "missing component = 0" then yields
    ta_score = component x 0.35 — a plausible-looking number built from a reading
    months or years stale. That is the same arithmetic that made VNM read 24
    during the 2026-08-07 incident, which is precisely why it must not be
    reachable by an ordinary retirement. Inactive rows are nulled out below rather
    than left holding an old value.
    """
    out: list[dict] = []
    offset, page = 0, 1000
    while True:
        rows = safe_execute(
            client.table("ta_universe")
            .select("symbol,exchange,rs_3m,rs_composite,rs_line_score,trend_score")
            .eq("is_active", True)
            # order() is required, not cosmetic: paging with range() over an
            # unordered select relies on Postgres heap order, which this table's
            # daily rewrites change — page boundaries would then duplicate or SKIP
            # symbols, silently dropping them from TA scoring with no error.
            .order("symbol")
            .range(offset, offset + page - 1),
            label="ta_score read",
        ).data
        out.extend(rows)
        if len(rows) < page:
            break
        offset += page
    return out


#: The components this module can actually read off ta_universe.
_COMPONENTS = ("rs_3m", "rs_composite", "rs_line", "trend")


def _resolve_weights(weights: dict) -> dict:
    """Drop weight keys with no component behind them, loudly.

    `load_scoring_config` DEEP-MERGES the stored row over the code defaults, so
    the stored 'ta_score' row's own keys always survive. Before migration 051 is
    applied that row still reads "bqs": 0.35 — alongside the new "trend": 0.35 the
    weights would sum to 1.35 and every TA Score, Final Score and grade would come
    out a third of a retired price base too high.

    Dropping the orphan rather than raising is deliberate: the surviving weights
    are then exactly the code defaults, which is the correct blend, so the run
    still produces right answers in the window between deploying this code and
    applying the migration. The warning is what stops that window becoming
    permanent — and it also catches a typo'd key in a hand-edited config, which
    would otherwise silently drop a component's weight to nothing.
    """
    out = {k: v for k, v in weights.items() if k in _COMPONENTS}
    for k in weights:
        if k not in _COMPONENTS:
            print(f"  ::warning:: ta_score: ignoring unknown weight '{k}' "
                  f"({weights[k]}) — no such component. Apply supabase/051_trend_score.sql.")
    total = sum(out.values())
    if abs(total - 1.0) > 0.01:
        print(f"  ::warning:: ta_score: weights sum to {total:.2f}, not 1.00 "
              f"({out}) — scores are on a different scale than 0-100.")
    return out


def compute_ta_score(client, dry_run: bool = False) -> dict:
    """Compute + persist ta_score for every ta_universe row. Returns a stats
    dict: rows (total), scored (non-null ta_score)."""
    cfg = load_scoring_config(client, "ta_score", TA_SCORE_DEFAULTS)
    w = _resolve_weights(cfg["weights"])

    rows = _read_components(client)
    stats = {"rows": len(rows), "scored": 0}

    payload = []
    for r in rows:
        comps = {
            "rs_3m": r.get("rs_3m"),
            "rs_composite": r.get("rs_composite"),
            "rs_line": r.get("rs_line_score"),
            "trend": r.get("trend_score"),
        }
        # Null only when EVERY component is missing; otherwise missing = 0.
        if all(v is None for v in comps.values()):
            score = None
        else:
            score = int(round(sum(w[k] * (comps[k] or 0) for k in w)))
            stats["scored"] += 1
        payload.append({
            "symbol": r["symbol"],
            "exchange": r.get("exchange") or "HOSE",
            "ta_score": score,
        })

    if dry_run:
        return stats

    for i in range(0, len(payload), 500):
        safe_execute(
            client.table("ta_universe").upsert(payload[i:i + 500], on_conflict="symbol"),
            label="ta_score upsert",
        )

    # An inactive symbol must not keep the score it held while active — otherwise
    # retiring it leaves a stale TA Score on the row forever, since the read above
    # will never visit it again. Scoped by is_active (not "everything we didn't
    # just write"), so a short write can never be mistaken for a retirement.
    cleared = safe_execute(
        client.table("ta_universe").update({"ta_score": None})
        .eq("is_active", False).not_.is_("ta_score", "null"),
        label="ta_score clear inactive",
    )
    stats["cleared_inactive"] = len(cleared.data or [])
    return stats
