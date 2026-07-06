#!/usr/bin/env python3
"""probe_vietstock.py — ONE-OFF endpoint probe for Vietstock macro data.

We can't reach the network from the dev sandbox, so RUN THIS ON YOUR MACHINE
(or any box with internet) and paste the output back. It captures the real
request/response shape of Vietstock's macro endpoint so the fetcher's parser is
built against actual data — not a guess.

What it does:
  1. GET the VNIBOR interbank page to establish a session (cookies) and scrape
     the __RequestVerificationToken hidden input.
  2. POST several candidate payloads to /data/getdatabynormid (normid=66 =
     "Lãi suất liên ngân hàng VNIBOR") and report status + a preview of each.
  3. Save the first JSON-looking response to scripts/macro/_probe_vnibor.json.

Usage:
  python3 scripts/macro/probe_vietstock.py
  python3 scripts/macro/probe_vietstock.py --normid 66 --from 01/05/2026 --to 30/06/2026

Then paste the console output (and the saved JSON if produced).
"""

import argparse
import json
import re
from pathlib import Path

import requests

PAGE = "https://finance.vietstock.vn/vi-mo/du-lieu/lai-suat-lien-ngan-hang-vnibor-66"
ENDPOINT = "https://finance.vietstock.vn/data/getdatabynormid"
# The hidden input may render name-before-value or value-before-name, single or
# double quotes — try both orders.
TOKEN_RES = [
    re.compile(r'name=["\']__RequestVerificationToken["\'][^>]*?value=["\']([^"\']+)["\']'),
    re.compile(r'value=["\']([^"\']+)["\'][^>]*?name=["\']__RequestVerificationToken["\']'),
]

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")


def bootstrap(session: requests.Session) -> str | None:
    """GET the page → set cookies, return the form __RequestVerificationToken."""
    r = session.get(PAGE, headers={"User-Agent": UA}, timeout=30)
    print(f"GET page → {r.status_code}, {len(r.text)} bytes")
    print("cookies:", {c.name: (c.value[:12] + '…' if c.value and len(c.value) > 12 else c.value)
                        for c in session.cookies})
    token = None
    for rx in TOKEN_RES:
        m = rx.search(r.text)
        if m:
            token = m.group(1)
            break
    print("form __RequestVerificationToken:", (token[:24] + "…") if token else "NOT FOUND")
    return token


def candidate_payloads(normid: int, frm: str, to: str, token: str | None) -> list[dict]:
    """A few likely param spellings — the probe tries each; keep whichever the
    server accepts. Vietstock macro endpoints have used these shapes over time."""
    base_variants = [
        {"normid": normid, "fromdate": frm, "todate": to, "page": 1, "pageSize": 50},
        {"normId": normid, "fromDate": frm, "toDate": to, "page": 1, "pageSize": 50},
        {"normid": normid, "type": 0, "fromdate": frm, "todate": to, "page": 1, "pageSize": 50},
        {"normid": normid, "fromyear": frm[-4:], "toyear": to[-4:], "page": 1, "pageSize": 50},
    ]
    if token:
        for b in base_variants:
            b["__RequestVerificationToken"] = token
    return base_variants


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--normid", type=int, default=66)
    ap.add_argument("--from", dest="frm", default="01/05/2026")
    ap.add_argument("--to", dest="to", default="30/06/2026")
    args = ap.parse_args()

    s = requests.Session()
    token = bootstrap(s)
    cookie_token = s.cookies.get("__RequestVerificationToken")

    headers = {
        "User-Agent": UA,
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://finance.vietstock.vn",
        "Referer": PAGE,
        "Accept": "application/json, text/javascript, */*; q=0.01",
    }
    print(f"\ncookie __RequestVerificationToken present: {bool(cookie_token)}")
    print(f"Trying {ENDPOINT} with normid={args.normid} {args.frm}..{args.to}\n" + "-" * 60)

    saved = False
    for i, payload in enumerate(candidate_payloads(args.normid, args.frm, args.to, token), 1):
        try:
            r = s.post(ENDPOINT, data=payload, headers=headers, timeout=30)
        except Exception as e:  # noqa: BLE001
            print(f"[{i}] EXCEPTION {type(e).__name__}: {str(e)[:120]}")
            continue
        ct = r.headers.get("content-type", "")
        preview = r.text[:400].replace("\n", " ")
        print(f"[{i}] params={list(payload)} → {r.status_code} ({ct})")
        print(f"    preview: {preview}")
        if r.ok and ("json" in ct or r.text.strip()[:1] in "[{"):
            try:
                data = r.json()
            except Exception:  # noqa: BLE001
                data = None
            if data:
                out = Path(__file__).with_name("_probe_vnibor.json")
                out.write_text(json.dumps(data, ensure_ascii=False, indent=2))
                print(f"    ✓ JSON saved → {out}")
                print("    top-level type:", type(data).__name__,
                      "| keys/len:", list(data)[:8] if isinstance(data, dict) else len(data))
                saved = True
                break

    if not saved:
        print("\nNo candidate returned usable JSON. Paste the previews above so we can "
              "adjust the param names / headers (or the endpoint may need the cookie "
              "token to equal the form token, or an extra field).")


if __name__ == "__main__":
    main()
