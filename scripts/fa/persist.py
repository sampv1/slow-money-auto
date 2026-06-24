"""Supabase reads/upserts for the FA pipeline.

Chunked upserts via `safe_execute` (survives transient HTTP/2 stream errors on
long runs). All upserts are additive — keyed on the natural PK.
"""

from ta.common import safe_execute

UPSERT_CHUNK_SIZE = 500


# ---- config ---------------------------------------------------------------

def load_scoring_config(client) -> dict:
    res = client.table("fa_scoring_config").select("config").eq("id", 1).single().execute()
    return res.data["config"]


# ---- imports (Excel → DB) -------------------------------------------------

def upsert_quarterly(client, rows: list[dict]) -> int:
    return _chunked_upsert(client, "fa_quarterly", rows, "symbol,period")


def upsert_annual_pe(client, rows: list[dict]) -> int:
    return _chunked_upsert(client, "fa_annual_pe", rows, "symbol,year")


def upsert_scores(client, rows: list[dict]) -> int:
    return _chunked_upsert(client, "fa_scores", rows, "symbol,as_of_period")


def _chunked_upsert(client, table: str, rows: list[dict], on_conflict: str) -> int:
    if not rows:
        return 0
    total = 0
    for i in range(0, len(rows), UPSERT_CHUNK_SIZE):
        chunk = rows[i:i + UPSERT_CHUNK_SIZE]
        safe_execute(
            client.table(table).upsert(chunk, on_conflict=on_conflict),
            label=f"upsert {table} chunk[{i // UPSERT_CHUNK_SIZE}]",
        )
        total += len(chunk)
    return total


# ---- score row builder ----------------------------------------------------

def score_row_for(symbol: str, as_of_period: str, metrics: dict, result, current_price_date) -> dict:
    c = result.criteria
    return {
        "symbol": symbol,
        "as_of_period": as_of_period,
        "c1_eps_yoy": c.get("c1", {}).get("value"),            "c1_pts": result.pts("c1"),
        "c2_eps_3q_avg_yoy": c.get("c2", {}).get("value"),     "c2_pts": result.pts("c2"),
        "c3_eps_pos_count": c.get("c3", {}).get("value"),      "c3_pts": result.pts("c3"),
        "c4_rev_yoy": c.get("c4", {}).get("value"),            "c4_pts": result.pts("c4"),
        "c5_gross_margin_delta": c.get("c5", {}).get("value"), "c5_pts": result.pts("c5"),
        "c6_net_margin_delta": c.get("c6", {}).get("value"),   "c6_pts": result.pts("c6"),
        "c7_roe": c.get("c7", {}).get("value"),                "c7_pts": result.pts("c7"),
        "c8_debt_to_equity": c.get("c8", {}).get("value"),     "c8_pts": result.pts("c8"),
        "c9_current_pe": c.get("c9", {}).get("value"),         "c9_pts": result.pts("c9"),
        "total_score": result.total_score,
        "normalized_score": result.normalized_score,
        "rating": result.rating,
        "current_eps_ttm": metrics.get("current_eps_ttm"),
        "current_pe": metrics.get("current_pe"),
        "pe_5y_median": metrics.get("pe_5y_median"),
        "current_price": metrics.get("current_price"),
        "current_price_date": current_price_date,
        "notes": "; ".join(result.notes) if result.notes else None,
        "computed_at": "now()",
    }


# ---- run log --------------------------------------------------------------

def start_run(client, as_of_period: str | None) -> int | None:
    res = client.table("fa_runs").insert({"as_of_period": as_of_period, "status": "running"}).execute()
    return res.data[0]["id"] if res.data else None


def finish_run(client, run_id, status, processed, skipped, as_of_period=None, err=None):
    if run_id is None:
        return
    client.table("fa_runs").update({
        "finished_at": "now()", "status": status,
        "symbols_processed": processed, "symbols_skipped": skipped,
        "as_of_period": as_of_period, "error_message": err,
    }).eq("id", run_id).execute()
