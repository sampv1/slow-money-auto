"""Shared helpers for the TA pipeline (env loading, Supabase client, VN time)."""

import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the scripts/ directory (one level up from scripts/ta/)
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_PATH)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

# vnstock data source. VCI works on vnstock 4.0.3+ without requiring the
# proprietary vnstock_chart library; KBS triggers a charting-library import
# error in 4.0.x. If VCI rate-limits, try TCBS as a fallback.
VNSTOCK_SOURCE = "VCI"
REQUEST_DELAY = 3.5  # seconds between vnstock calls

VN_TZ = timezone(timedelta(hours=7))


def today_vn() -> date:
    """Today's date in Vietnam timezone (GMT+7)."""
    return datetime.now(VN_TZ).date()


def get_supabase_client():
    from supabase import create_client

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("Error: SUPABASE_URL and SUPABASE_ANON_KEY are not set.")
        print(f"  SUPABASE_URL is {'set' if SUPABASE_URL else 'EMPTY/MISSING'}")
        print(f"  SUPABASE_ANON_KEY is {'set' if SUPABASE_ANON_KEY else 'EMPTY/MISSING'}")
        print("  Set them via env vars (CI) or scripts/.env (local).")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
