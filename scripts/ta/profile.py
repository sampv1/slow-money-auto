"""Company name + ICB industry classification, per symbol.

Fills `symbol_profile` (one row per ticker) and `icb_sectors` (bilingual labels
for the ICB codes actually in use). Migration 050.

WHY THIS EXISTS
    Every surface in the app identifies a company by its ticker alone.
    `ta_universe` has no name column, and `recommendations.company_name` has been
    empty on every row since it was added. The only industry label the project
    held was `fa_industry.icb_industry`, written as a side effect of hand-
    importing a FiinProX spreadsheet — so it was only as fresh as the last manual
    export, and it exists to route a symbol to the right FA rubric, not to be
    read.

    This module DOES NOT TOUCH `fa_industry`. That table keeps FiinProX as its
    sole authority so the real-estate rubric split cannot move; what is written
    here is additive reference data with no reader in the pipeline.

THE SOURCE
    One keyless GET per language returns the whole board — 2,092 companies,
    ~1.35 MB, under a second. vnstock wraps the same endpoint as
    `Listing(source='VCI').symbols_by_industries(lang=…)`, but that wrapper drops
    `shortName`, `floor` and `logoUrl`, so this calls it directly. Keep the
    vnstock method in mind as the fallback if the raw shape ever changes.
"""

from .common import safe_execute

SEARCH_BAR_URL = "https://iq.vietcap.com.vn/api/iq-insight-service/v2/company/search-bar"

# The endpoint's own language codes.
LANG_VI, LANG_EN = "1", "2"

# A bare requests call gets served fine, but the endpoint is a website's own API
# and an empty UA is the first thing a WAF blocks.
HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

REQUEST_TIMEOUT = 30

# Floors that mean "listed on a Vietnamese exchange". Anything else — the source
# emits 'OTHER' — is a foreign fund or an unlisted entity.
TRADED_FLOORS = {"HOSE", "HNX", "UPCOM"}

CHUNK = 500


def _clean(v) -> str | None:
    """Trim to None. The payload uses '' for absent fields, which would otherwise
    land in the DB as an empty string and read as data."""
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _rank(rec: dict) -> tuple[int, int]:
    """Sort key for resolving a duplicated ticker — lower wins.

    The payload really does repeat codes, and picking the wrong one is silent:
    VNH is BOTH `Công ty Cổ phần Đầu tư Việt Việt Nhật` (UPCOM, an ordinary
    company, and the VNH in our universe) and `Vietnam Holding Ltd` (floor
    'OTHER', a foreign fund). Taking the last record — what a plain dict
    comprehension does — hands our UPCOM stock the fund's name and files it under
    `Quỹ đầu tư`. Prefer a real exchange, then a non-fund; payload order breaks
    any remaining tie because `sorted` is stable.
    """
    return (
        0 if (rec.get("floor") or "").upper() in TRADED_FLOORS else 1,
        0 if (rec.get("comTypeCode") or "").upper() != "QU" else 1,
    )


def _by_symbol(records: list[dict]) -> dict[str, dict]:
    grouped: dict[str, list[dict]] = {}
    for rec in records:
        code = _clean(rec.get("code"))
        if code:
            grouped.setdefault(code.upper(), []).append(rec)
    return {sym: sorted(recs, key=_rank)[0] for sym, recs in grouped.items()}


def _fetch_lang(lang: str, show_log: bool = False) -> list[dict] | None:
    """One language's payload, or None on any failure."""
    import requests

    try:
        resp = requests.get(
            SEARCH_BAR_URL,
            params={"language": lang},
            headers=HEADERS,
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as e:
        print(f"  search-bar fetch failed (language={lang}): {type(e).__name__}: {str(e)[:160]}")
        return None

    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, list) or not data:
        print(f"  search-bar returned no usable data (language={lang}) — API shape may have changed")
        return None

    if show_log:
        print(f"  language={lang}: {len(data)} records")
    return data


def fetch_profiles(show_log: bool = False) -> tuple[list[dict], list[dict]] | None:
    """Fetch both languages and build (symbol_profile rows, icb_sectors rows).

    Returns None if EITHER language fails. Half a result is worse than none: the
    row would be written with one language's name and a null in the other, and a
    later successful run would have no way to tell that null from a company that
    genuinely has no English name. Same rule `fetch_all_listed_stocks` follows —
    one flaky call must never read as "every company lost its name".
    """
    vi_raw = _fetch_lang(LANG_VI, show_log)
    if not vi_raw:
        return None
    en_raw = _fetch_lang(LANG_EN, show_log)
    if not en_raw:
        return None

    vi, en = _by_symbol(vi_raw), _by_symbol(en_raw)

    profiles: list[dict] = []
    # (code, level) -> {name_vi, name_en}. Built from the SAME payloads as the
    # profiles, so a symbol can never point at a label that does not exist.
    sectors: dict[tuple[str, int], dict] = {}

    for symbol in sorted(set(vi) | set(en)):
        v, e = vi.get(symbol, {}), en.get(symbol, {})
        row = {
            "symbol": symbol,
            "name_vi": _clean(v.get("name")),
            "name_en": _clean(e.get("name")),
            "short_name_vi": _clean(v.get("shortName")),
            "short_name_en": _clean(e.get("shortName")),
            "com_type_code": _clean(v.get("comTypeCode")) or _clean(e.get("comTypeCode")),
            "exchange": _clean(v.get("floor")) or _clean(e.get("floor")),
            "logo_url": _clean(v.get("logoUrl")) or _clean(e.get("logoUrl")),
            "source": "vci",
        }

        for level in range(1, 5):
            node_vi = v.get(f"icbLv{level}") or {}
            node_en = e.get(f"icbLv{level}") or {}
            code = _clean(node_vi.get("code")) or _clean(node_en.get("code"))
            row[f"icb_l{level}"] = code
            if not code:
                continue
            name_vi = _clean(node_vi.get("name"))
            name_en = _clean(node_en.get("name"))
            # A label with nothing on either side would violate the NOT NULLs;
            # fall back to the other language rather than dropping the code.
            if name_vi or name_en:
                sectors.setdefault(
                    (code, level),
                    {
                        "icb_code": code,
                        "level": level,
                        "name_vi": name_vi or name_en,
                        "name_en": name_en or name_vi,
                    },
                )

        profiles.append(row)

    # An empty result is a failure wearing a success's clothes: upsert_profiles
    # would write nothing, print "0 symbols" and exit 0. `_fetch_lang` already
    # rejects an empty payload, but the invariant belongs at the layer callers
    # actually use, not one below it.
    if not profiles:
        print("  parsed zero symbols — treating as a failed fetch")
        return None

    return profiles, list(sectors.values())


def upsert_profiles(client, profiles: list[dict], sectors: list[dict], dry_run: bool = False) -> tuple[int, int]:
    """Upsert both tables. Never deletes — a symbol that drops out of the payload
    keeps its last known name instead of going blank."""
    n_p = _chunked_upsert(client, "symbol_profile", profiles, "symbol", dry_run)
    n_s = _chunked_upsert(client, "icb_sectors", sectors, "icb_code,level", dry_run)
    return n_p, n_s


def _chunked_upsert(client, table: str, rows: list[dict], on_conflict: str, dry_run: bool) -> int:
    if not rows:
        return 0
    if dry_run:
        return len(rows)
    for i in range(0, len(rows), CHUNK):
        safe_execute(
            client.table(table).upsert(rows[i:i + CHUNK], on_conflict=on_conflict),
            label=f"upsert {table} chunk[{i // CHUNK}]",
        )
    return len(rows)


def fetch_universe(client) -> list[dict]:
    """ta_universe symbols + is_active, paged.

    PostgREST silently truncates at 1000 rows and the universe is ~1,600, so an
    unpaged read would drop a third of it and understate coverage.
    """
    out, size, start = [], 1000, 0
    while True:
        res = safe_execute(
            client.table("ta_universe").select("symbol,is_active,exchange").order("symbol").range(start, start + size - 1),
            label=f"read ta_universe[{start}]",
        )
        batch = res.data or []
        out += batch
        if len(batch) < size:
            return out
        start += size
