"""Final score — latest TA score blended with each quarter's FA score.

    Final score = 0.59 · TA score + 0.41 · FA score   (both 0-100)

Stored PER QUARTER on fa_scores (symbol + as_of_period). Each daily run only
(re)writes the LATEST FA period's rows, blending the current ta_score with that
period's normalized FA. Older periods are never touched, so their Final score
stays FROZEN at whatever it last was while they were current — no daily/TA
updates for old quarters. Null unless both components exist.

Weights + grade bands come from the scoring_config 'final_score' row
(deep-merged over FINAL_SCORE_DEFAULTS). Runs after ta_score.
"""

from .common import load_scoring_config, safe_execute

# DB-overridable defaults (see scoring_config key 'final_score'). grades are
# descending [min_score, grade]; the first whose min <= score wins.
FINAL_SCORE_DEFAULTS = {
    "weights": {"ta": 0.59, "fa": 0.41},
    "grades": [[90, "A+"], [80, "A"], [70, "B"], [60, "C"], [0, "D"]],
}


def _grade(score: int, grades: list) -> str:
    for thr, g in grades:  # descending thresholds
        if score >= thr:
            return g
    return grades[-1][1]


def _latest_fa_period(client) -> str | None:
    res = safe_execute(
        client.table("fa_scores").select("as_of_period")
        .order("as_of_period", desc=True).limit(1),
        label="final latest period",
    ).data
    return res[0]["as_of_period"] if res else None


def _fa_normalized_for_period(client, period: str) -> dict[str, float]:
    """{symbol: normalized_score} for a given FA period."""
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


def _ta_score_map(client) -> dict[str, int]:
    """{symbol: ta_score} from the latest ta_universe snapshot."""
    out: dict[str, int] = {}
    offset, page = 0, 1000
    while True:
        rows = safe_execute(
            client.table("ta_universe").select("symbol,ta_score")
            .range(offset, offset + page - 1),
            label="final ta read",
        ).data
        for r in rows:
            if r.get("ta_score") is not None:
                out[r["symbol"]] = r["ta_score"]
        if len(rows) < page:
            break
        offset += page
    return out


def compute_final_score(client, dry_run: bool = False) -> dict:
    """Compute + persist the Final score onto the LATEST FA period's fa_scores
    rows. Returns stats: rows (in latest period), scored, period."""
    cfg = load_scoring_config(client, "final_score", FINAL_SCORE_DEFAULTS)
    w = cfg["weights"]
    grades = cfg["grades"]

    period = _latest_fa_period(client)
    if period is None:
        return {"rows": 0, "scored": 0, "period": None}

    fa = _fa_normalized_for_period(client, period)
    ta = _ta_score_map(client)

    # Group symbols by their (score, grade) so each distinct value is one bulk
    # UPDATE — at most ~101 distinct scores, vs a write per symbol.
    buckets: dict[tuple[int, str], list[str]] = {}
    for sym, fa_val in fa.items():
        ta_val = ta.get(sym)
        if ta_val is None or fa_val is None:
            continue
        score = int(round(w["ta"] * ta_val + w["fa"] * fa_val))
        buckets.setdefault((score, _grade(score, grades)), []).append(sym)

    scored = sum(len(v) for v in buckets.values())
    stats = {"rows": len(fa), "scored": scored, "period": period}
    if dry_run:
        return stats

    # Reset the latest period (so symbols that lost a component go back to null),
    # then write each bucket. UPDATE (not upsert) — no INSERT, so no NOT NULL
    # issues with the other fa_scores columns.
    safe_execute(
        client.table("fa_scores").update({"final_score": None, "final_grade": None})
        .eq("as_of_period", period),
        label="final reset",
    )
    for (score, grade), syms in buckets.items():
        for i in range(0, len(syms), 300):
            safe_execute(
                client.table("fa_scores").update({"final_score": score, "final_grade": grade})
                .eq("as_of_period", period).in_("symbol", syms[i:i + 300]),
                label="final write",
            )
    return stats
