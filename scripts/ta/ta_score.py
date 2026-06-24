"""TA Score — a weighted blend of the technical components stored on ta_universe.

    TA Score = RS3M·20% + RS Composite·25% + RS Line·20% + BQS(price base)·35%

All four inputs (rs_3m, rs_composite, rs_line_score, base_score) are on a 0-100
scale and already live on ta_universe (written by the RS + price-base passes).
This step simply re-reads them and writes the blended ta_score, so it must run
AFTER those passes. A MISSING component contributes 0 (weights unchanged); a row
gets a null ta_score only when ALL four components are missing.

Weights come from the scoring_config 'ta_score' row (deep-merged over
TA_SCORE_DEFAULTS).
"""

from .common import load_scoring_config, safe_execute

# DB-overridable defaults (see scoring_config key 'ta_score'). Keys map to the
# ta_universe columns rs_3m / rs_composite / rs_line_score / base_score.
TA_SCORE_DEFAULTS = {
    "weights": {"rs_3m": 0.20, "rs_composite": 0.25, "rs_line": 0.20, "bqs": 0.35},
}


def _read_components(client) -> list[dict]:
    """Paged read of the four TA-Score inputs + exchange (needed for the
    INSERT…ON CONFLICT upsert's NOT NULL exchange column)."""
    out: list[dict] = []
    offset, page = 0, 1000
    while True:
        rows = safe_execute(
            client.table("ta_universe")
            .select("symbol,exchange,rs_3m,rs_composite,rs_line_score,base_score")
            .range(offset, offset + page - 1),
            label="ta_score read",
        ).data
        out.extend(rows)
        if len(rows) < page:
            break
        offset += page
    return out


def compute_ta_score(client, dry_run: bool = False) -> dict:
    """Compute + persist ta_score for every ta_universe row. Returns a stats
    dict: rows (total), scored (non-null ta_score)."""
    cfg = load_scoring_config(client, "ta_score", TA_SCORE_DEFAULTS)
    w = cfg["weights"]

    rows = _read_components(client)
    stats = {"rows": len(rows), "scored": 0}

    payload = []
    for r in rows:
        comps = {
            "rs_3m": r.get("rs_3m"),
            "rs_composite": r.get("rs_composite"),
            "rs_line": r.get("rs_line_score"),
            "bqs": r.get("base_score"),
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
    return stats
