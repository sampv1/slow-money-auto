#!/usr/bin/env python3
"""
run_prompt.py — Run the trading prompt via Claude API with web search, then auto-push results.

Sends the original trading prompt to Claude with the built-in web_search tool
enabled. Claude searches for real-time market data itself — same quality as
claude.ai. Extracts the JSON block, validates it, and pushes to Supabase.

Usage:
  # Full run: Claude with web search → validate → push to Supabase:
  python3 run_prompt.py

  # Dry run (call Claude, validate, but don't push):
  python3 run_prompt.py --dry-run

  # Add extra context (e.g. sentiment score):
  python3 run_prompt.py --context "CSS sentiment hôm nay: 62"

  # Use a different model (default is claude-opus-4-7):
  python3 run_prompt.py --model claude-sonnet-4-6

  # Limit web searches (default: 15):
  python3 run_prompt.py --max-searches 20

Requires ANTHROPIC_API_KEY in scripts/.env (alongside Supabase keys).
"""

import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

PROMPT_FILE = Path(__file__).parent.parent / "prompt-trading-vietnam-v4-complete-json.md"
DEFAULT_MODEL = "claude-opus-4-7"
MAX_TOKENS = 16000
DEFAULT_MAX_SEARCHES = 15

# Vietnam timezone (UTC+7) — GitHub Actions runs in UTC.
VN_TZ = timezone(timedelta(hours=7))


def today_vn() -> date:
    """Return today's date in Vietnam timezone (GMT+7)."""
    return datetime.now(VN_TZ).date()

# Web search tool version — 20260209 supports dynamic filtering (better accuracy)
WEB_SEARCH_TOOL_VERSION = "web_search_20260209"


def get_supabase_client():
    from supabase import create_client

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def call_claude(prompt_text: str, model: str, max_searches: int) -> str:
    """Call Claude API with web search tool and return the response text."""
    import anthropic

    if not ANTHROPIC_API_KEY:
        print("Error: ANTHROPIC_API_KEY must be set in scripts/.env")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    print(f"\nCalling Claude ({model}) with web search enabled...")
    print(f"Prompt size: ~{len(prompt_text):,} chars")
    print(f"Max web searches: {max_searches}")

    message = client.messages.create(
        model=model,
        max_tokens=MAX_TOKENS,
        messages=[{"role": "user", "content": prompt_text}],
        tools=[{
            "type": WEB_SEARCH_TOOL_VERSION,
            "name": "web_search",
            "max_uses": max_searches,
        }],
    )

    # Extract text blocks from response (skip server_tool_use and web_search_tool_result blocks)
    response_text = ""
    search_count = 0
    for block in message.content:
        if block.type == "text":
            response_text += block.text
        elif block.type == "server_tool_use":
            search_count += 1

    # Get search count from usage if available
    usage = message.usage
    web_searches = getattr(getattr(usage, "server_tool_use", None), "web_search_requests", search_count)

    print(f"Response: {len(response_text):,} chars | Stop reason: {message.stop_reason}")
    print(f"Tokens: {usage.input_tokens:,} in / {usage.output_tokens:,} out")
    print(f"Web searches: {web_searches}")

    return response_text


def extract_and_validate(response_text: str) -> dict:
    """Extract JSON from Claude's response and validate it."""
    from push_recommendation import extract_json_from_text, validate_data

    try:
        data = extract_json_from_text(response_text)
    except json.JSONDecodeError as e:
        print(f"\nError: Could not extract valid JSON from response.")
        print(f"JSON parse error: {e}")
        print("\n--- Response tail (last 500 chars) ---")
        print(response_text[-500:])
        sys.exit(1)

    errors = validate_data(data)
    if errors:
        print(f"\nValidation failed ({len(errors)} error(s)):")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)

    return data


def push_results(data: dict, dry_run: bool, full_response: str | None = None):
    """Push validated data to Supabase (reuses push_recommendation logic)."""
    from push_recommendation import push_to_supabase, strip_json_block

    print(f"\nResult: {data['trading_date']} | {data['conclusion']} | "
          f"{len(data.get('recommendations', []))} rec(s)")

    if data.get("recommendations"):
        for rec in data["recommendations"]:
            print(f"  #{rec['rank']} {rec['symbol']} @ {rec['entry_price']} | "
                  f"SL {rec['stop_loss']} | TP1 {rec['tp1']} | R={rec['r_multiple']}")

    # Strip JSON block from the response to store only the analysis text
    analysis_text = strip_json_block(full_response) if full_response else None
    push_to_supabase(data, dry_run=dry_run, full_response=analysis_text)


def save_response(response_text: str, trading_date: str):
    """Save the full Claude response for reference."""
    output_dir = Path(__file__).parent / "outputs"
    output_dir.mkdir(exist_ok=True)

    filename = output_dir / f"response_{trading_date}.md"
    filename.write_text(response_text, encoding="utf-8")
    print(f"Full response saved to: {filename}")


def main():
    parser = argparse.ArgumentParser(
        description="Run trading prompt via Claude API with web search and auto-push results"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Validate only, don't push to Supabase"
    )
    parser.add_argument(
        "--context", type=str, default=None,
        help="Extra context to append to prompt (e.g. sentiment score)"
    )
    parser.add_argument(
        "--model", type=str, default=DEFAULT_MODEL,
        help=f"Claude model to use (default: {DEFAULT_MODEL})"
    )
    parser.add_argument(
        "--max-searches", type=int, default=DEFAULT_MAX_SEARCHES,
        help=f"Max web searches per request (default: {DEFAULT_MAX_SEARCHES})"
    )
    parser.add_argument(
        "--no-save", action="store_true",
        help="Don't save the full response to scripts/outputs/"
    )
    parser.add_argument(
        "--prompt", type=str, default=None,
        help="Path to prompt file (default: prompt-trading-vietnam-v4-complete-json.md)"
    )
    args = parser.parse_args()

    # Read prompt
    prompt_path = Path(args.prompt) if args.prompt else PROMPT_FILE
    if not prompt_path.exists():
        print(f"Error: Prompt file not found: {prompt_path}")
        sys.exit(1)
    prompt_text = prompt_path.read_text(encoding="utf-8")
    print(f"Loaded prompt: {prompt_path.name} ({len(prompt_text):,} chars)")

    # Inject today's date (Vietnam timezone) so Claude doesn't fall back
    # to its training-cutoff date. Vietnamese weekday names included to
    # avoid any locale ambiguity.
    today = today_vn()
    weekday_vn = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm",
                  "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"][today.weekday()]
    date_header = (
        f"⚠️ HÔM NAY LÀ {weekday_vn}, NGÀY {today.strftime('%d/%m/%Y')} "
        f"(ISO: {today.isoformat()}, múi giờ Việt Nam UTC+7).\n"
        f"BẮT BUỘC dùng đúng ngày này cho analysis_date và trading_date trong JSON output. "
        f"KHÔNG được dùng ngày khác kể cả nếu dữ liệu training của bạn cho thấy ngày khác.\n"
    )
    prompt_text = date_header + "\n" + prompt_text
    print(f"Injected today's date: {today.isoformat()} ({weekday_vn})")

    # Append extra context if provided
    if args.context:
        prompt_text += f"\n\n--- CONTEXT BỔ SUNG ---\n{args.context}\n"

    # Call Claude API with web search
    response_text = call_claude(prompt_text, args.model, args.max_searches)

    # Save full response
    if not args.no_save:
        try:
            from push_recommendation import extract_json_from_text
            data_peek = extract_json_from_text(response_text)
            td = data_peek.get("trading_date", today_vn().strftime("%Y-%m-%d"))
        except Exception:
            td = today_vn().strftime("%Y-%m-%d")
        save_response(response_text, td)

    # Extract JSON and validate
    data = extract_and_validate(response_text)

    # Push to Supabase (include full response for homepage display)
    push_results(data, dry_run=args.dry_run, full_response=response_text)


if __name__ == "__main__":
    main()
