#!/usr/bin/env python3
"""
push_recommendation.py — Parse Claude's JSON output and push to Supabase.

Usage:
  # From a file:
  python push_recommendation.py data.json

  # From clipboard paste (interactive):
  python push_recommendation.py

  # From stdin pipe:
  echo '{"analysis_date": ...}' | python push_recommendation.py --stdin

  # Dry run (validate only, don't push):
  python push_recommendation.py data.json --dry-run
"""

import argparse
import json
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
import os

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")


def get_supabase_client():
    from supabase import create_client

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def extract_json_from_text(text: str) -> dict:
    """Extract JSON from text that may contain markdown code blocks or other content."""
    # Try to find JSON inside ```json ... ``` code block
    pattern = r"```json\s*\n(.*?)\n\s*```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        json_str = match.group(1)
    else:
        # Try raw JSON (starts with {)
        json_str = text.strip()

    return json.loads(json_str)


def validate_data(data: dict) -> list[str]:
    """Validate the parsed JSON against expected schema. Returns list of errors."""
    errors = []

    required_top = ["analysis_date", "trading_date", "market_context", "conclusion", "recommendations"]
    for field in required_top:
        if field not in data:
            errors.append(f"Missing required field: {field}")

    if data.get("conclusion") not in ("KB1", "KB2", "KB3"):
        errors.append(f"Invalid conclusion: {data.get('conclusion')} (must be KB1/KB2/KB3)")

    ctx = data.get("market_context", {})
    if not isinstance(ctx.get("regime"), int) or ctx.get("regime") not in (1, 2, 3, 4):
        errors.append(f"Invalid regime: {ctx.get('regime')} (must be 1-4)")

    recs = data.get("recommendations", [])
    if data.get("conclusion") in ("KB1", "KB2") and len(recs) == 0:
        errors.append("conclusion is KB1/KB2 but recommendations is empty")

    if data.get("conclusion") == "KB3" and len(recs) > 0:
        errors.append("conclusion is KB3 but recommendations is not empty")

    for i, rec in enumerate(recs):
        prefix = f"recommendations[{i}] ({rec.get('symbol', '?')})"
        req_fields = ["symbol", "exchange", "action", "setup", "entry_price",
                       "stop_loss", "tp1", "r_multiple", "sharpe", "win_rate_est",
                       "expectancy", "hit_probability", "rating", "setup_confidence",
                       "last_close", "last_close_date", "stop_loss_pct", "tp1_pct"]
        for f in req_fields:
            if f not in rec or rec[f] is None:
                errors.append(f"{prefix}: missing required field '{f}'")

        if rec.get("entry_price") and rec.get("stop_loss"):
            if rec["stop_loss"] >= rec["entry_price"]:
                errors.append(f"{prefix}: stop_loss ({rec['stop_loss']}) must be < entry_price ({rec['entry_price']})")
            if rec.get("tp1") and rec["tp1"] <= rec["entry_price"]:
                errors.append(f"{prefix}: tp1 ({rec['tp1']}) must be > entry_price ({rec['entry_price']})")

    return errors


def build_daily_log_row(data: dict) -> dict:
    """Build the daily_logs insert row from parsed JSON."""
    ctx = data["market_context"]
    vni = ctx.get("vn_index", {})
    intl = ctx.get("international", {})
    scenarios = data.get("scenarios", {})
    track = data.get("track_record", {})

    funnel = data.get("funnel_summary", {})

    row = {
        "analysis_date": data["analysis_date"],
        "trading_date": data["trading_date"],
        "conclusion": data["conclusion"],
        "regime": ctx["regime"],
        "regime_label": ctx.get("regime_label", ""),
        "auction_state": ctx.get("auction_state", ""),
        "strategy": ctx.get("strategy", ""),
        "vn_index_close": vni.get("close"),
        "vn_index_change_pct": vni.get("change_pct"),
        "vn_index_session_date": vni.get("session_date"),
        "sp500_change_pct": intl.get("sp500_change_pct"),
        "dxy": intl.get("dxy"),
        "us10y": intl.get("us10y"),
        "vix": intl.get("vix"),
        "oil_wti": intl.get("oil_wti"),
        "international_environment": intl.get("environment"),
        "confidence": ctx.get("confidence"),
        "stand_aside_reason": data.get("stand_aside_reason"),
        "scenario_bullish_pct": scenarios.get("bullish", {}).get("probability_pct"),
        "scenario_bullish_desc": scenarios.get("bullish", {}).get("description"),
        "scenario_neutral_pct": scenarios.get("neutral", {}).get("probability_pct"),
        "scenario_neutral_desc": scenarios.get("neutral", {}).get("description"),
        "scenario_bearish_pct": scenarios.get("bearish", {}).get("probability_pct"),
        "scenario_bearish_desc": scenarios.get("bearish", {}).get("description"),
        "kill_zone_vn_index": scenarios.get("kill_zone_vn_index"),
        "avg_sharpe": track.get("avg_sharpe"),
        "avg_expectancy": track.get("avg_expectancy"),
        "num_recommendations": len(data.get("recommendations", [])),
        # v5 fields
        "macro_score": ctx.get("macro_score"),
        "css": ctx.get("css"),
        "top_sectors": json.dumps(ctx["top_sectors"]) if ctx.get("top_sectors") else None,
        "avoid_sectors": json.dumps(ctx["avoid_sectors"]) if ctx.get("avoid_sectors") else None,
        "funnel_candidates_story": funnel.get("candidates_after_story"),
        "funnel_candidates_risk": funnel.get("candidates_after_risk_filter"),
        "funnel_candidates_technical": funnel.get("candidates_after_technical"),
        "funnel_near_miss": json.dumps(funnel["near_miss"]) if funnel.get("near_miss") else None,
    }

    return row


def build_recommendation_row(rec: dict, daily_log_id: str, trading_date: str) -> dict:
    """Build a recommendations insert row from a single recommendation object."""
    sizing = rec.get("position_sizing", {})
    story = rec.get("story", {})

    return {
        "daily_log_id": daily_log_id,
        "trading_date": trading_date,
        "rank": rec["rank"],
        "symbol": rec["symbol"],
        "exchange": rec["exchange"],
        "company_name": rec.get("company_name"),
        "sector": rec.get("sector"),
        "action": rec["action"],
        "setup": rec["setup"],
        "setup_confidence": rec["setup_confidence"],
        "rating": rec["rating"],
        "entry_price": rec["entry_price"],
        "entry_range_low": rec.get("entry_range_low"),
        "entry_range_high": rec.get("entry_range_high"),
        "stop_loss": rec["stop_loss"],
        "tp1": rec["tp1"],
        "tp2": rec.get("tp2"),
        "trailing_stop_method": rec.get("trailing_stop_method"),
        "last_close": rec["last_close"],
        "last_close_date": rec["last_close_date"],
        "stop_loss_pct": rec["stop_loss_pct"],
        "tp1_pct": rec["tp1_pct"],
        "tp2_pct": rec.get("tp2_pct"),
        "r_multiple": rec["r_multiple"],
        "sharpe": rec["sharpe"],
        "win_rate_est": rec["win_rate_est"],
        "expectancy": rec["expectancy"],
        "hit_probability": rec["hit_probability"],
        "holding_period_sessions": rec.get("holding_period_sessions"),
        "holding_period_label": rec.get("holding_period_label"),
        "sizing_method": sizing.get("method"),
        "size_pct": sizing.get("size_pct"),
        "kelly_raw_pct": sizing.get("kelly_raw_pct"),
        "quarter_kelly_pct": sizing.get("quarter_kelly_pct"),
        "entry_timing": rec.get("entry_timing"),
        "entry_method": rec.get("entry_method"),
        "reasoning_summary": rec.get("reasoning_summary"),
        # v5 story fields
        "story_type": story.get("type"),
        "story_type_label": story.get("type_label"),
        "story_summary": story.get("summary"),
        "story_first_news_date": story.get("first_news_date"),
        "story_priced_in_level": story.get("priced_in_level"),
        "story_priced_in_pct": story.get("priced_in_pct"),
        "story_remaining_trigger": story.get("remaining_trigger"),
        "status": "OPEN",
    }


def read_input(args) -> str:
    """Read JSON input from file, stdin, or interactive paste."""
    if args.file:
        return Path(args.file).read_text(encoding="utf-8")

    if args.stdin:
        return sys.stdin.read()

    # Interactive paste mode
    print("Paste Claude's JSON output below (press Ctrl+D when done):")
    print("─" * 50)
    lines = []
    try:
        while True:
            lines.append(input())
    except EOFError:
        pass
    return "\n".join(lines)


def strip_json_block(text: str) -> str:
    """Remove ```json ... ``` code blocks from text, leaving the analysis."""
    return re.sub(r"```json\s*\n[\s\S]*?\n\s*```", "", text).strip()


def push_to_supabase(data: dict, dry_run: bool = False, full_response: str | None = None):
    """Push parsed data to Supabase. Optionally stores the full analysis text."""
    daily_log_row = build_daily_log_row(data)
    if full_response:
        daily_log_row["full_response"] = full_response
    rec_rows = [
        build_recommendation_row(rec, "", data["trading_date"])
        for rec in data.get("recommendations", [])
    ]

    if dry_run:
        print("\n=== DRY RUN — Data validated, nothing pushed ===")
        print(f"\nDaily log: {data['trading_date']} | {data['conclusion']} | Regime {data['market_context']['regime']}")
        print(f"Recommendations: {len(rec_rows)}")
        for r in rec_rows:
            print(f"  #{r['rank']} {r['symbol']} {r['action']} @ {r['entry_price']} | SL {r['stop_loss']} | TP1 {r['tp1']} | R={r['r_multiple']} | Sharpe={r['sharpe']}")
        return

    client = get_supabase_client()

    # Check for duplicate trading_date
    existing = client.table("daily_logs").select("id").eq("trading_date", data["trading_date"]).execute()
    if existing.data:
        print(f"Error: A daily log for {data['trading_date']} already exists (id={existing.data[0]['id']}).")
        print("Delete it first or use a different trading_date.")
        sys.exit(1)

    # Insert daily log
    result = client.table("daily_logs").insert(daily_log_row).execute()
    daily_log_id = result.data[0]["id"]
    print(f"Created daily_log: {daily_log_id} ({data['trading_date']} | {data['conclusion']})")

    # Insert recommendations
    if rec_rows:
        for row in rec_rows:
            row["daily_log_id"] = daily_log_id
        result = client.table("recommendations").insert(rec_rows).execute()
        print(f"Inserted {len(result.data)} recommendation(s):")
        for r in result.data:
            print(f"  #{r['rank']} {r['symbol']} {r['action']} @ {r['entry_price']} → TP1 {r['tp1']} / SL {r['stop_loss']}")
    else:
        print("No recommendations (stand aside day).")

    print("\nDone.")


def main():
    parser = argparse.ArgumentParser(description="Push Claude's stock recommendations to Supabase")
    parser.add_argument("file", nargs="?", help="Path to JSON file")
    parser.add_argument("--stdin", action="store_true", help="Read from stdin")
    parser.add_argument("--dry-run", action="store_true", help="Validate only, don't push to Supabase")
    args = parser.parse_args()

    raw_text = read_input(args)

    try:
        data = extract_json_from_text(raw_text)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON — {e}")
        sys.exit(1)

    errors = validate_data(data)
    if errors:
        print(f"Validation failed ({len(errors)} error(s)):")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)

    print(f"Validated OK: {data['trading_date']} | {data['conclusion']} | {len(data.get('recommendations', []))} rec(s)")
    push_to_supabase(data, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
