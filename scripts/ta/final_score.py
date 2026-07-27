"""Final score — latest TA score blended with each symbol's LATEST FA score.

    Final score = 0.59 · TA score + 0.41 · FA score   (both 0-100)

Stored PER QUARTER on fa_scores (symbol + as_of_period), but computed for each
symbol on ITS OWN most recent as_of_period — not a single global "latest
quarter". Symbols report on different schedules (e.g. ~424 symbols at 2026-Q2
while ~1,144 were still at 2026-Q1), so keying on one global period left the
majority of the universe with a stale score. Every daily run refreshes the score
on each symbol's newest FA row using the current ta_score, and when a symbol
files a new quarter that row simply becomes the new target.

NOT frozen: the previous behaviour (write only the single newest global period,
leave everything else untouched) is gone. Older, superseded rows keep whatever
Final score they last had as a historical record — they are never displayed and
never recomputed, because blending today's TA with an old quarter's FA would be
meaningless. Null unless both components exist.

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


def _latest_fa_rows(client) -> dict[str, tuple[str, float]]:
    """{symbol: (latest_as_of_period, normalized_score)} — one row per symbol.

    Scans the whole fa_scores table (a few thousand rows) and keeps the highest
    as_of_period per symbol. Quarter labels are 'YYYY-Qn', which sort correctly
    as plain strings. Symbols whose latest row has no normalized_score are
    dropped (nothing to blend)."""
    latest: dict[str, tuple[str, float | None]] = {}
    offset, page = 0, 1000
    while True:
        rows = safe_execute(
            client.table("fa_scores").select("symbol,as_of_period,normalized_score")
            .order("symbol").order("as_of_period")
            .range(offset, offset + page - 1),
            label="final fa read",
        ).data
        for r in rows:
            sym, period = r["symbol"], r["as_of_period"]
            ns = r.get("normalized_score")
            cur = latest.get(sym)
            if cur is None or period > cur[0]:
                latest[sym] = (period, float(ns) if ns is not None else None)
        if len(rows) < page:
            break
        offset += page
    return {s: (p, ns) for s, (p, ns) in latest.items() if ns is not None}


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
    """Compute + persist the Final score onto EACH SYMBOL's latest fa_scores row.

    Returns stats: rows (symbols with a usable latest FA row), scored, and
    periods ({as_of_period: n_symbols scored in it})."""
    cfg = load_scoring_config(client, "final_score", FINAL_SCORE_DEFAULTS)
    w = cfg["weights"]
    grades = cfg["grades"]

    latest = _latest_fa_rows(client)
    if not latest:
        return {"rows": 0, "scored": 0, "periods": {}}
    ta = _ta_score_map(client)

    # Bucket by (period, score, grade): each distinct combination is one bulk
    # UPDATE instead of a write per symbol. Periods are few (one per reporting
    # cohort) and scores are 0-100, so this stays a small number of statements.
    buckets: dict[tuple[str, int, str], list[str]] = {}
    periods: dict[str, int] = {}
    for sym, (period, fa_val) in latest.items():
        ta_val = ta.get(sym)
        if ta_val is None:
            continue
        score = int(round(w["ta"] * ta_val + w["fa"] * fa_val))
        buckets.setdefault((period, score, _grade(score, grades)), []).append(sym)
        periods[period] = periods.get(period, 0) + 1

    scored = sum(len(v) for v in buckets.values())
    stats = {"rows": len(latest), "scored": scored, "periods": periods}
    if dry_run:
        return stats

    # Reset each symbol's latest row first (so a symbol that lost a component
    # goes back to null rather than keeping a stale score), then write the
    # buckets. UPDATE (not upsert) — no INSERT, so no NOT NULL issues with the
    # other fa_scores columns. Older superseded rows are deliberately untouched.
    by_period: dict[str, list[str]] = {}
    for sym, (period, _) in latest.items():
        by_period.setdefault(period, []).append(sym)
    for period, syms in by_period.items():
        for i in range(0, len(syms), 300):
            safe_execute(
                client.table("fa_scores").update({"final_score": None, "final_grade": None})
                .eq("as_of_period", period).in_("symbol", syms[i:i + 300]),
                label="final reset",
            )
    for (period, score, grade), syms in buckets.items():
        for i in range(0, len(syms), 300):
            safe_execute(
                client.table("fa_scores").update({"final_score": score, "final_grade": grade})
                .eq("as_of_period", period).in_("symbol", syms[i:i + 300]),
                label="final write",
            )
    return stats
