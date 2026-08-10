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
# Full-access key that bypasses RLS. Migration 045 revoked anon's write access
# (the anon key ships to every browser, so it could rewrite the whole dataset),
# which makes this the credential every WRITER now needs. Never expose it to a
# client: CI secret / Vercel env / scripts/.env only, never NEXT_PUBLIC_*.
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# vnstock data source. VCI works on vnstock 4.0.3+ without requiring the
# proprietary vnstock_chart library; KBS triggers a charting-library import
# error in 4.0.x. If VCI rate-limits, try TCBS as a fallback.
VNSTOCK_SOURCE = "VCI"
# Seconds between vnstock requests. 4.0s ≈ 15 req/min — comfortably below
# VCI's observed ceiling (~30/min) with plenty of headroom against
# rate-limit-driven failures. The midnight cron prioritizes reliability over
# wall time; pair this with the retry schedule in ta/ohlcv.py.
REQUEST_DELAY = 4.0

VN_TZ = timezone(timedelta(hours=7))


def today_vn() -> date:
    """Today's date in Vietnam timezone (GMT+7)."""
    return datetime.now(VN_TZ).date()


def resolve_supabase_key() -> tuple[str, str]:
    """(key, label) for the pipeline's Supabase credential.

    Service role first — since migration 045 it is the only key that can WRITE.
    The anon fallback keeps read-only tools working and covers the window between
    deploying this code and setting the secret, but it is announced loudly: a
    denied PostgREST write returns 204 with zero rows affected rather than an
    error, so a job running on the anon key after 045 would report success while
    persisting nothing. That exact failure shape (a silent partial write) has
    already cost this project a night of RS data — never let it be quiet.
    """
    if SUPABASE_SERVICE_ROLE_KEY:
        return SUPABASE_SERVICE_ROLE_KEY, "service_role"
    print(
        "WARNING: SUPABASE_SERVICE_ROLE_KEY is not set — falling back to the anon "
        "key. Since migration 045 anon is READ-ONLY, so every write in this run "
        "will be silently discarded (PostgREST answers a denied write with 204 / "
        "0 rows, not an error). Set it in CI secrets or scripts/.env.",
        file=sys.stderr,
    )
    return SUPABASE_ANON_KEY, "anon"


def get_supabase_client():
    from supabase import create_client

    if not SUPABASE_URL or not (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY):
        print("Error: SUPABASE_URL and a Supabase key are not set.")
        print(f"  SUPABASE_URL is {'set' if SUPABASE_URL else 'EMPTY/MISSING'}")
        print(f"  SUPABASE_SERVICE_ROLE_KEY is {'set' if SUPABASE_SERVICE_ROLE_KEY else 'EMPTY/MISSING'}")
        print(f"  SUPABASE_ANON_KEY is {'set' if SUPABASE_ANON_KEY else 'EMPTY/MISSING'}")
        print("  Set them via env vars (CI) or scripts/.env (local).")
        sys.exit(1)
    key, _label = resolve_supabase_key()
    return create_client(SUPABASE_URL, key)


# Transient failures are matched on the exception TYPE, not on its message.
# Matching on text alone silently failed: httpx.WriteError's message is
# "EOF occurred in violation of protocol (_ssl.c:2427)" and httpx.ConnectError's
# is "[Errno 111] Connection refused" — neither contains its own type name, so
# type-name entries in a message-substring list were dead weight. Only the h2
# case ever matched, because httpx embeds "<ConnectionTerminated ...>" in the
# message text. That let a one-off SSL blip kill the whole TA daily run.
#
# These are matched against the full MRO, so listing a BASE class covers every
# subclass: httpx.TimeoutException covers Connect/Read/Write/PoolTimeout, and
# httpx.NetworkError covers Connect/Read/Write/CloseError. httpx and httpcore
# use parallel names, so one set serves both.
#
# Deliberately EXCLUDED: HTTPStatusError (a real 4xx/5xx answer, not a network
# fault) and LocalProtocolError (a client-side bug — retrying just hides it).
_TRANSIENT_ERROR_TYPES = frozenset({
    "TimeoutException",        # httpx/httpcore timeout base
    "NetworkError",            # httpx/httpcore network base (incl. WriteError)
    "RemoteProtocolError",     # peer broke the connection mid-flight
    "ProxyError",
    "ConnectionError",         # builtin base: Reset/Aborted/Refused/BrokenPipe
    "TimeoutError",            # builtin (also socket.timeout)
    "SSLError",                # ssl.SSLError, incl. SSLEOFError
    "IncompleteRead",
})

# Message substrings for failures whose TYPE is generic. PostgREST can't parse a
# Cloudflare HTML error body, so a gateway blip surfaces as an APIError reading
# "JSON could not be generated" — infra, never a real data error, so it is safe
# to retry. Seen as Cloudflare 520-525 or a 500 with "Failed to get project
# config".
_TRANSIENT_ERROR_MARKERS = (
    "ConnectionTerminated",    # h2 GOAWAY: stream exhaustion on a long-lived conn
    "stream_id",
    "JSON could not be generated",
    "Failed to get project config",
    "SSL handshake failed",
    "Web server is returning an unknown error",
    "Server disconnected",
)


def is_transient_error(exc: BaseException) -> bool:
    """True when `exc` is a network/gateway blip worth retrying.

    Walks the __cause__/__context__ chain because httpx wraps httpcore and
    postgrest wraps httpx — the retryable type is often not the outermost one.
    """
    seen: set[int] = set()
    err: BaseException | None = exc
    while err is not None and id(err) not in seen:
        seen.add(id(err))
        if any(t.__name__ in _TRANSIENT_ERROR_TYPES for t in type(err).__mro__):
            return True
        if any(marker in str(err) for marker in _TRANSIENT_ERROR_MARKERS):
            return True
        err = err.__cause__ or err.__context__
    return False


def _deep_merge(default: dict, override: dict) -> dict:
    """Recursively merge `override` onto `default` (override wins; nested dicts
    merged). Lists/scalars are replaced wholesale."""
    out = dict(default)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def load_scoring_config(client, key: str, default: dict) -> dict:
    """Load a JSON scoring config row from the `scoring_config` table by key,
    deep-merged onto `default` so a missing key or missing fields fall back to
    the hardcoded defaults. Never raises — returns `default` on any error."""
    try:
        res = client.table("scoring_config").select("config").eq("key", key).maybe_single().execute()
        cfg = (res.data or {}).get("config") if res and res.data else None
        if isinstance(cfg, dict):
            return _deep_merge(default, cfg)
    except Exception as e:
        print(f"  scoring_config[{key}] load failed, using defaults — {str(e)[:100]}")
    return default


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
