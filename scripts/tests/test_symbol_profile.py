#!/usr/bin/env python3
"""Pin the two invariants in ta/profile.py that fail SILENTLY when broken.

Runnable directly (`python3 scripts/tests/test_symbol_profile.py`) or under
pytest, matching the convention in test_bqs_v8.py.

No network and no DB: every test stubs `_fetch_lang`, except the one that
deliberately points at a dead URL.

Why this exists
---------------
1. FAIL CLOSED. `symbol_profile` is upserted, never truncated, so a bad fetch
   that returns a partial result does not error — it quietly overwrites good rows
   with nulls, and the next run cannot tell those nulls from companies that
   genuinely have no English name. Both languages must land or nothing is
   written. An EMPTY result counts as a failure too: it would upsert zero rows,
   print "0 symbols" and exit 0, which reads exactly like success.

2. TICKER COLLISIONS. The upstream payload repeats codes. VNH is both
   `CTCP Đầu tư Việt Việt Nhật` (UPCOM, an ordinary company — the VNH in our
   universe) and `Vietnam Holding Ltd` (floor 'OTHER', a foreign fund). The
   obvious `{r["code"]: r for r in data}` keeps the LAST record, which handed our
   UPCOM stock the fund's name and filed it under `Quỹ đầu tư`. That is not
   hypothetical: it is what the first cut of this module did, and the only reason
   it was caught is that it moved the `com_type_code` histogram by one.
   `_rank` prefers a real exchange, then a non-fund, and `sorted` is stable so
   payload order breaks any remaining tie.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ta import profile  # noqa: E402


def _stub(records):
    """Serve the same records for both languages."""
    return lambda lang, show_log=False: records


# ---------------------------------------------------------------------------
# 1. Fail closed
# ---------------------------------------------------------------------------

def test_dead_url_returns_none():
    orig = profile.SEARCH_BAR_URL
    profile.SEARCH_BAR_URL = "https://iq.vietcap.com.vn/api/does-not-exist-404"
    try:
        assert profile.fetch_profiles() is None, "a failed fetch must write nothing"
    finally:
        profile.SEARCH_BAR_URL = orig


def test_second_language_failing_voids_the_run():
    """Half a result is worse than none — the row would carry a Vietnamese name
    and a null English one, indistinguishable from a real gap."""
    real = profile._fetch_lang
    calls = {"n": 0}

    def first_only(lang, show_log=False):
        calls["n"] += 1
        return [{"code": "VNM", "name": "X"}] if calls["n"] == 1 else None

    profile._fetch_lang = first_only
    try:
        assert profile.fetch_profiles() is None
    finally:
        profile._fetch_lang = real


def test_empty_payload_is_a_failure_not_a_success():
    real = profile._fetch_lang
    profile._fetch_lang = _stub([])
    try:
        assert profile.fetch_profiles() is None, "zero symbols must not report success"
    finally:
        profile._fetch_lang = real


def test_records_without_a_code_yield_no_rows():
    real = profile._fetch_lang
    profile._fetch_lang = _stub([{"code": "", "name": "No ticker"}, {"name": "Also none"}])
    try:
        assert profile.fetch_profiles() is None
    finally:
        profile._fetch_lang = real


# ---------------------------------------------------------------------------
# 2. Ticker collisions
# ---------------------------------------------------------------------------

VNH_FUND = {
    "code": "VNH", "name": "Vietnam Holding Ltd", "shortName": "Vietnam Holding Ltd",
    "floor": "OTHER", "comTypeCode": "QU", "icbLv1": {"code": "8000", "name": "Tài chính"},
}
VNH_REAL = {
    "code": "VNH", "name": "CTCP Đầu tư Việt Việt Nhật", "shortName": "Đầu tư Việt Việt Nhật",
    "floor": "UPCOM", "comTypeCode": "CT", "icbLv1": {"code": "3000", "name": "Hàng Tiêu dùng"},
}


def test_listed_company_beats_foreign_fund():
    picked = profile._by_symbol([VNH_FUND, VNH_REAL])["VNH"]
    assert picked["floor"] == "UPCOM", "the UPCOM-listed company must win"
    assert picked["comTypeCode"] == "CT"


def test_collision_resolution_is_order_independent():
    """The naive dict comprehension passes one ordering and fails the other,
    which is why this asserts on both."""
    for payload in ([VNH_FUND, VNH_REAL], [VNH_REAL, VNH_FUND]):
        assert profile._by_symbol(payload)["VNH"]["floor"] == "UPCOM"


def test_two_funds_still_resolve_deterministically():
    """ASP-VIET-A and VVDIF are both duplicated and both funds — neither is in
    our universe, but the pick must not depend on dict iteration order."""
    a = {"code": "VVDIF", "name": "Fund A", "floor": "OTHER", "comTypeCode": "QU"}
    b = {"code": "VVDIF", "name": "Fund B", "floor": "OTHER", "comTypeCode": "QU"}
    assert profile._by_symbol([a, b])["VVDIF"]["name"] == "Fund A"


# ---------------------------------------------------------------------------
# 3. Absence must stay absent
# ---------------------------------------------------------------------------

def test_blank_strings_become_null():
    """The payload uses '' for absent fields. Stored as '', a missing logo reads
    as data and every `if (logo_url)` check in the dashboard would pass."""
    real = profile._fetch_lang
    profile._fetch_lang = _stub([{
        "code": "TST", "name": "  Test Co  ", "shortName": "", "logoUrl": "",
        "floor": "HOSE", "comTypeCode": "CT",
        "icbLv1": {"code": "3000", "name": "Hàng Tiêu dùng"}, "icbLv4": None,
    }])
    try:
        profiles, sectors = profile.fetch_profiles()
        row = profiles[0]
        assert row["short_name_vi"] is None and row["logo_url"] is None
        assert row["name_vi"] == "Test Co", "whitespace must be trimmed"
        assert row["icb_l4"] is None, "a missing ICB level must not be fabricated"
        assert row["icb_l1"] == "3000"
        assert [s["icb_code"] for s in sectors] == ["3000"], \
            "icb_sectors must only carry codes a symbol actually points at"
    finally:
        profile._fetch_lang = real


def test_icb_codes_keep_their_leading_zeros():
    """Oil & Gas is '0001' and Exploration & Production is '0533'. Coerced to int
    anywhere in the chain they become 1 and 533, and the join to icb_sectors
    silently returns no label."""
    real = profile._fetch_lang
    profile._fetch_lang = _stub([{
        "code": "PVD", "name": "PV Drilling", "floor": "HOSE", "comTypeCode": "CT",
        "icbLv1": {"code": "0001", "name": "Dầu khí"},
        "icbLv4": {"code": "0533", "name": "Sản xuất và Khai thác dầu khí"},
    }])
    try:
        profiles, sectors = profile.fetch_profiles()
        assert profiles[0]["icb_l1"] == "0001"
        assert profiles[0]["icb_l4"] == "0533"
        assert {s["icb_code"] for s in sectors} == {"0001", "0533"}
    finally:
        profile._fetch_lang = real


def test_same_code_at_two_levels_is_kept_separately():
    """The source injects a custom L1 'Ngân hàng' whose code 8301 sits in the L2
    numeric range, so (code, level) — not code — is the key."""
    real = profile._fetch_lang
    profile._fetch_lang = _stub([{
        "code": "TCB", "name": "Techcombank", "floor": "HOSE", "comTypeCode": "NH",
        "icbLv1": {"code": "8301", "name": "Ngân hàng"},
        "icbLv2": {"code": "8300", "name": "Ngân hàng"},
        "icbLv4": {"code": "8355", "name": "Ngân hàng"},
    }])
    try:
        _, sectors = profile.fetch_profiles()
        keys = {(s["icb_code"], s["level"]) for s in sectors}
        assert ("8301", 1) in keys and ("8300", 2) in keys and ("8355", 4) in keys
    finally:
        profile._fetch_lang = real


if __name__ == "__main__":
    fails = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  PASS {name}")
            except AssertionError as e:
                fails += 1
                print(f"  FAIL {name}: {e}")
    print("OK" if not fails else f"{fails} failure(s)")
    sys.exit(1 if fails else 0)
