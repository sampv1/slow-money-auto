"""Final score — latest TA score blended with the latest FA score.

    Final score = 0.59 · TA score + 0.41 · FA score   (both 0-100)

A single LATEST-snapshot value per symbol: ta_universe.ta_score blended with the
most recent FA period's normalized_score. Null unless BOTH components exist (we
only emit a Final score when both sides are present). Stored on ta_universe; the
Signal Pro page surfaces it only for the latest quarter.

Weights come from the scoring_config 'final_score' row (deep-merged over
FINAL_SCORE_DEFAULTS). Runs after ta_score (it re-reads that column).
"""

from .common import load_scoring_config, safe_execute

# DB-overridable defaults (see scoring_config key 'final_score').
FINAL_SCORE_DEFAULTS = {"weights": {"ta": 0.59, "fa": 0.41}}


def _latest_fa_normalized(client) -> dict[str, float]:
    """{symbol: normalized_score} for the most recent FA as_of_period."""
    res = safe_execute(
        client.table("fa_scores").select("as_of_period")
        .order("as_of_period", desc=True).limit(1),
        label="final latest period",
    ).data
    if not res:
        return {}
    period = res[0]["as_of_period"]

    out: dict[str, float] = {}
    offset, page = 0, 1000
    while True:
        rows = safe_execute(
            client.table("fa_scores").select("symbol,normalized_score")
            .eq("as_of_period", period).range(offset, offset + page - 1),
            label="final fa read",
        ).data
        for r in rows:
            ns = r.get("normalized_score")
            if ns is not None:
                out[r["symbol"]] = float(ns)
        if len(rows) < page:
            break
        offset += page
    return out


def _ta_scores(client) -> list[dict]:
    """Paged read of symbol, exchange (for the upsert NOT NULL), ta_score."""
    out: list[dict] = []
    offset, page = 0, 1000
    while True:
        rows = safe_execute(
            client.table("ta_universe").select("symbol,exchange,ta_score")
            .range(offset, offset + page - 1),
            label="final ta read",
        ).data
        out.extend(rows)
        if len(rows) < page:
            break
        offset += page
    return out


def compute_final_score(client, dry_run: bool = False) -> dict:
    """Compute + persist final_score on ta_universe. Returns stats: rows, scored."""
    cfg = load_scoring_config(client, "final_score", FINAL_SCORE_DEFAULTS)
    w = cfg["weights"]
    fa = _latest_fa_normalized(client)
    rows = _ta_scores(client)
    stats = {"rows": len(rows), "scored": 0}

    payload = []
    for r in rows:
        ta = r.get("ta_score")
        fa_val = fa.get(r["symbol"])
        if ta is None or fa_val is None:
            score = None
        else:
            score = int(round(w["ta"] * ta + w["fa"] * fa_val))
            stats["scored"] += 1
        payload.append({
            "symbol": r["symbol"],
            "exchange": r.get("exchange") or "HOSE",
            "final_score": score,
        })

    if dry_run:
        return stats

    for i in range(0, len(payload), 500):
        safe_execute(
            client.table("ta_universe").upsert(payload[i:i + 500], on_conflict="symbol"),
            label="final upsert",
        )
    return stats
