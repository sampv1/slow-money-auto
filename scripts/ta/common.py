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
# Seconds between vnstock requests. 2.5s ≈ 24 req/min — safely below VCI's
# observed ceiling (~30/min) while keeping the daily cron under ~30 min for
# the post-filter universe of ~600 symbols.
REQUEST_DELAY = 2.5

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


# Transient-error markers we'd see from httpx/httpcore over a long-running job.
# Most common: HTTP/2 stream exhaustion after ~20k requests on one connection.
_TRANSIENT_ERROR_MARKERS = (
    "RemoteProtocolError",
    "ConnectionTerminated",
    "stream_id",
    "ConnectError",
    "ConnectTimeout",
    "ReadTimeout",
    "WriteTimeout",
    "PoolTimeout",
    "TimeoutException",
)


def is_transient_error(exc: BaseException) -> bool:
    err = str(exc)
    return any(marker in err for marker in _TRANSIENT_ERROR_MARKERS)


def safe_execute(query_builder, label: str = "query", max_retries: int = 4, base_delay: float = 1.0):
    """Execute a Supabase / postgrest query builder with retry-on-transient.

    Retries on network-flavored errors (HTTP/2 stream exhaustion is the most
    common one in long-running jobs). NOT a retry for actual data errors —
    those raise immediately.
    """
    import time as _time

    last_err: BaseException | None = None
    for attempt in range(max_retries):
        try:
            return query_builder.execute()
        except Exception as e:
            last_err = e
            if not is_transient_error(e) or attempt == max_retries - 1:
                raise
            wait = base_delay * (2 ** attempt)
            print(f"  {label}: transient error (attempt {attempt + 1}/{max_retries}), retrying in {wait:.1f}s — {str(e)[:120]}")
            _time.sleep(wait)
    if last_err:
        raise last_err
