"""Supabase upserts for the FA pipeline (fa_quarterly / fa_scores / fa_runs).

Mirrors the run-log + chunked-upsert pattern from compute_ta_signals.py, using
`safe_execute` so transient HTTP/2 stream exhaustion survives a retry.
"""

from ta.common import safe_execute

UPSERT_CHUNK_SIZE = 500


def quarterly_rows_for(symbol: str, quarters: list[dict], qend_closes: dict) -> list[dict]:
    """Build fa_quarterly rows from normalized quarters + quarter-end closes."""
    rows = []
    for q in quarters:
        close = qend_closes.get(q["period"])
        eps = q["eps"]
        pe_at_qend = (close / (eps * 4.0)) if (close and eps and eps > 0) else None
        rows.append({
            "symbol": symbol,
            "period": q["period"],
            "year": q["year"],
            "quarter": q["quarter"],
            "revenue": q["revenue"],
            "gross_profit": q["gross_profit"],
            "net_income": q["net_income"],
            "eps": q["eps"],
            "total_equity": q["total_equity"],
            "total_debt": q["total_debt"],
            "gross_margin": q["gross_margin"],
            "net_margin": q["net_margin"],
            "close_at_qend": close,
            "pe_at_qend": pe_at_qend,
        })
    return rows


def score_row_for(symbol: str, as_of_period: str, metrics: dict, result) -> dict:
    """Build a single fa_scores row from metrics + ScoreResult."""
    c = result.criteria
    notes = "; ".join(result.notes) if result.notes else None
    return {
        "symbol": symbol,
        "as_of_period": as_of_period,
        "c1_eps_qoq": c.get("c1", {}).get("value"),            "c1_pts": result.pts("c1"),
        "c2_eps_3q_avg": c.get("c2", {}).get("value"),         "c2_pts": result.pts("c2"),
        "c3_eps_pos_count": c.get("c3", {}).get("value"),      "c3_pts": result.pts("c3"),
        "c4_rev_qoq": c.get("c4", {}).get("value"),            "c4_pts": result.pts("c4"),
        "c5_gross_margin_delta": c.get("c5", {}).get("value"), "c5_pts": result.pts("c5"),
        "c6_net_margin_delta": c.get("c6", {}).get("value"),   "c6_pts": result.pts("c6"),
        "c7_roe": c.get("c7", {}).get("value"),                "c7_pts": result.pts("c7"),
        "c8_debt_to_equity": c.get("c8", {}).get("value"),     "c8_pts": result.pts("c8"),
        "c9_current_pe": c.get("c9", {}).get("value"),         "c9_pts": result.pts("c9"),
        "total_score": result.total_score,
        "rating": result.rating,
        "current_eps_ttm": metrics.get("current_eps_ttm"),
        "current_pe": metrics.get("current_pe"),
        "pe_4q_median": metrics.get("pe_4q_median"),
        "current_price": metrics.get("current_price"),
        "current_price_date": metrics.get("current_price_date"),
        "notes": notes,
        "computed_at": "now()",
    }


def upsert_quarterly(client, rows: list[dict]) -> int:
    if not rows:
        return 0
    total = 0
    for i in range(0, len(rows), UPSERT_CHUNK_SIZE):
        chunk = rows[i:i + UPSERT_CHUNK_SIZE]
        safe_execute(
            client.table("fa_quarterly").upsert(chunk, on_conflict="symbol,period"),
            label=f"upsert fa_quarterly chunk[{i // UPSERT_CHUNK_SIZE}]",
        )
        total += len(chunk)
    return total


def upsert_scores(client, rows: list[dict]) -> int:
    if not rows:
        return 0
    total = 0
    for i in range(0, len(rows), UPSERT_CHUNK_SIZE):
        chunk = rows[i:i + UPSERT_CHUNK_SIZE]
        safe_execute(
            client.table("fa_scores").upsert(chunk, on_conflict="symbol"),
            label=f"upsert fa_scores chunk[{i // UPSERT_CHUNK_SIZE}]",
        )
        total += len(chunk)
    return total


def start_run(client, as_of_period: str | None) -> int | None:
    res = client.table("fa_runs").insert({
        "as_of_period": as_of_period,
        "status": "running",
    }).execute()
    return res.data[0]["id"] if res.data else None


def finish_run(client, run_id: int | None, status: str, processed: int, skipped: int,
               as_of_period: str | None = None, err: str | None = None):
    if run_id is None:
        return
    client.table("fa_runs").update({
        "finished_at": "now()",
        "status": status,
        "symbols_processed": processed,
        "symbols_skipped": skipped,
        "as_of_period": as_of_period,
        "error_message": err,
    }).eq("id", run_id).execute()
