#!/usr/bin/env python3
"""
fetch_cpi.py — Get Vietnam headline CPI (MoM) and write it to data/macro/cpi_manual.csv.

WHY: Vietstock's CPI dataset froze at 2025-08 and every free structured feed lags
(IMF 2025-03) or omits Vietnam; GSO (current, authoritative) geo-gates cloud IPs
behind a VPN portal. The one CURRENT source that IS cloud-reachable is Vietnamese
financial news, which republishes GSO's monthly figure verbatim. This script reads
CafeF's CPI articles, extracts the HEADLINE month-on-month change, and writes it as
the MoM index (prev month = 100) into data/macro/cpi_manual.csv — the overlay that
refresh_macro.py upserts on top of the Vietstock history.

  Headline MoM sentence (GSO wording, quoted by CafeF):
    "... so với tháng trước, CPI tháng M/YYYY tăng 0,84%"   -> 100.84
    "CPI ... tháng 3/2026 tăng 1,23% so với tháng liền trước" -> 101.23
  It is NOT the core line ("lạm phát cơ bản ... so với tháng trước") nor the YoY
  line ("... so với cùng kỳ"); the parser anchors on the month-on-month phrase and
  excludes those. Values are cross-checked across multiple articles (majority vote).

Usage:
  python3 fetch_cpi.py                      # daily: resolve the last 3 months, update CSV
  python3 fetch_cpi.py --backfill           # resolve every month 2025-09 -> now
  python3 fetch_cpi.py --from 2025-09       # resolve every month from 2025-09 -> now
  python3 fetch_cpi.py --month 2026-05      # a single month
  python3 fetch_cpi.py --dry-run            # show what was found (+ source sentence/URL), don't write
  python3 fetch_cpi.py --upsert             # also push straight to macro_series (needs scripts/.env)

Notes:
  * News prose varies month to month, so ALWAYS eyeball a --dry-run before trusting a
    value. Months the script can't resolve confidently are reported — fill those by
    hand in data/macro/cpi_manual.csv.
  * CafeF is cloud-reachable, so this can also run on the macro-daily cron if desired.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
import time
from collections import Counter
from pathlib import Path
from urllib.parse import quote

import requests

MANUAL_CPI_CSV = Path(__file__).resolve().parent.parent / "data" / "macro" / "cpi_manual.csv"
BACKFILL_START = (2025, 9)  # --backfill resolves from here to now

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
CAFEF_SEARCH = "https://cafef.vn/tim-kiem.chn?keywords={q}"

# --- extraction patterns (Vietnamese, GSO's standard CPI wording) ---
_CPIKW = re.compile(r"CPI|ch[ỉi] s[ốo] gi[áa] ti[êe]u d[ùu]ng", re.I)
_CORE = re.compile(r"c[ơo] b[ảa]n", re.I)                 # "lạm phát cơ bản" (core) — exclude
_US = re.compile(r"\bM[ỹy]\b|Fed", re.I)                   # US CPI — exclude
_CITY = re.compile(  # city/province CPI releases ("Hà Nội: CPI tháng 11 tăng 0,26%...") — exclude
    r"H[àa] N[ộo]i|TP\.?\s?HCM|TPHCM|H[ồo] Ch[íi] Minh|[ĐD][àa] N[ẵă]ng|"
    r"C[ụu]c Th[ốo]ng k[êe] (?:th[àa]nh ph[ốo]|t[ỉi]nh)", re.I)
_MONTH = re.compile(r"th[aá]ng\s*(\d{1,2})(?:\s*/\s*(\d{4}))?", re.I)  # "tháng M" (year optional)
# MoM %, phrased either way around the month-on-month anchor ("so với tháng (liền) trước"):
_P_BEFORE = re.compile(  # "... tăng 1,23% so với tháng (liền) trước"
    r"(t[ăa]ng|gi[ảa]m)\s*(\d+,\d+)\s*%\s*so v[ơớ]i th[aá]ng (?:li[ềe]n )?tr[ưuơớ]+c", re.I)
_P_AFTER = re.compile(   # "so với tháng (liền) trước, CPI ... tăng 0,84%"
    r"so v[ơớ]i th[aá]ng (?:li[ềe]n )?tr[ưuơớ]+c\s*,?\s*"
    r"(?:CPI|ch[ỉi] s[ốo] gi[áa] ti[êe]u d[ùu]ng)[^%]{0,55}?(t[ăa]ng|gi[ảa]m)\s*(\d+,\d+)\s*%", re.I)


def _get(url: str) -> str:
    try:
        r = requests.get(url, headers={"User-Agent": _UA}, timeout=35).text
        time.sleep(0.4)  # be polite — rapid back-to-back requests get throttled (empty results)
        return r
    except Exception as e:  # noqa: BLE001
        print(f"    fetch failed ({str(e)[:60]}): {url[:70]}")
        return ""


def _clean(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))


def search_cpi_articles(month: int) -> list[str]:
    """CafeF CPI-article URLs, unioned across a per-month and a broad query (search
    ranking is noisy, so neither alone is complete). De-duplicated, cafef.vn .chn only."""
    out: list[str] = []
    for q in (f"CPI tháng {month}", "chỉ số giá tiêu dùng"):
        html = _get(CAFEF_SEARCH.format(q=quote(q)))
        for a in re.findall(r'href="((?:https?://cafef\.vn)?/[^"]+\.chn)"[^>]*title="[^"]*(?:CPI|ti[êe]u d[ùu]ng)[^"]*"', html):
            u = ("https://cafef.vn" + a) if a.startswith("/") else a
            if u not in out:
                out.append(u)
    return out


def _mom_from_match(m: re.Match) -> float | None:
    """MoM index (prev month=100) from a (direction, 'X,YY') match; plausibility-bounded."""
    num = float(m.group(2).replace(",", "."))
    signed = num if m.group(1).lower().startswith("t") else -num
    idx = round(100 + signed, 2)
    return idx if 96.0 <= idx <= 105.0 else None  # MoM in [-4%, +5%]


def _month_ok(seg: str, want_m: int, want_y: int | None) -> bool:
    """True if `seg` names 'tháng {want_m}'. When want_y is given, the explicit year
    (if present) must match; when want_y is None (year already confirmed by the
    article's publish date) a bare 'tháng M' is accepted."""
    m = _MONTH.search(seg)
    if not m or int(m.group(1)) != want_m:
        return False
    if want_y is not None and m.group(2) is not None and int(m.group(2)) != want_y:
        return False
    return True


def parse_headline_mom(text: str, want_m: int, want_y: int | None) -> list[tuple[float, str]]:
    """Extract HEADLINE CPI MoM index candidates for month `want_m` from article text.

    Returns [(mom_index, evidence_sentence), ...]. Excludes the core ('cơ bản') and YoY
    ('so với cùng kỳ') lines by anchoring on the month-on-month phrase, and US CPI. If
    want_y is None the year is assumed pre-confirmed (by publish date); otherwise an
    explicit in-text year must match it.
    """
    out: list[tuple[float, str]] = []
    for m in _P_BEFORE.finditer(text):
        pre = text[max(0, m.start() - 75):m.start()]
        if _CORE.search(pre) or _US.search(pre) or _CITY.search(pre) or not _CPIKW.search(pre):
            continue
        if not _month_ok(text[max(0, m.start() - 75):m.end()], want_m, want_y):
            continue
        idx = _mom_from_match(m)
        if idx is not None:
            out.append((idx, text[max(0, m.start() - 55):m.end()].strip()))
    for m in _P_AFTER.finditer(text):
        seg = text[m.start():m.end()]
        if _CORE.search(seg) or _US.search(seg) or _CITY.search(seg) or not _month_ok(seg, want_m, want_y):
            continue
        idx = _mom_from_match(m)
        if idx is not None:
            out.append((idx, seg.strip()))
    return out


def _cpi_period(pub: tuple[int, int] | None) -> tuple[int, int] | None:
    """CPI month a recap reports on, from its publish (year, month): CPI month = M−1."""
    if pub is None:
        return None
    py, pm = pub
    return (py - 1, 12) if pm == 1 else (py, pm - 1)


def _pub_from_url(url: str) -> tuple[int, int] | None:
    """Publish (year, month) from the CafeF URL id ('…-CCCYYMMDD…….chn' → YYMMDD at
    offset 3). Cheap — lets us skip off-target articles without fetching them."""
    m = re.search(r"-(\d{15,20})\.chn", url)
    if not m:
        return None
    d = m.group(1)[3:9]
    if len(d) == 6 and 20 <= int(d[:2]) <= 30 and 1 <= int(d[2:4]) <= 12 and 1 <= int(d[4:6]) <= 31:
        return (2000 + int(d[:2]), int(d[2:4]))
    return None


def _pub_from_html(html: str) -> tuple[int, int] | None:
    """Publish (year, month) from JSON-LD/meta 'datePublished' (YYYY-MM-DD)."""
    m = re.search(r'(?:datePublished|article:published_time)"?\s*[:=]\s*"?(\d{4})-(\d{2})-(\d{2})', html)
    return (int(m.group(1)), int(m.group(2))) if m else None


def resolve_month(year: int, month: int, max_articles: int = 8) -> tuple[float, int, str, str] | None:
    """Resolve one month's headline CPI MoM index via CafeF (majority vote across
    articles). Returns (mom_index, n_votes, url, sentence) or None if unresolved.

    Per article: if its publish date confirms it reports (year, month), parse the MoM
    with the year pre-confirmed (accepts a bare 'tháng M'); otherwise fall back to
    requiring an explicit in-text 'tháng M/YYYY' (screens out wrong-year matches)."""
    votes: Counter[float] = Counter()
    evidence: dict[float, tuple[str, str]] = {}
    fetched = 0
    for url in search_cpi_articles(month):
        if fetched >= max_articles:
            break
        # Cheap pre-filter: skip articles the URL-id publish date says are a different month.
        if _cpi_period(_pub_from_url(url)) not in (None, (year, month)):
            continue
        html = _get(url)
        fetched += 1
        period = _cpi_period(_pub_from_url(url) or _pub_from_html(html))
        if period is not None and period != (year, month):
            continue
        want_y = None if period == (year, month) else year
        for idx, sentence in parse_headline_mom(_clean(html), month, want_y):
            votes[idx] += 1
            evidence.setdefault(idx, (url, sentence))
    if not votes:
        return None
    idx, n = votes.most_common(1)[0]
    url, sentence = evidence[idx]
    return idx, n, url, sentence


def _months(f: tuple[int, int], t: tuple[int, int]):
    y, m = f
    while (y, m) <= t:
        yield y, m
        m += 1
        if m > 12:
            y, m = y + 1, 1


def update_manual_csv(path: Path, resolved: dict[str, float], dry_run: bool) -> None:
    """Merge resolved {YYYY-MM: mom_index} into data/macro/cpi_manual.csv, preserving the
    explanatory comment header (everything up to and including 'month,mom_index') and
    writing sorted real rows. Existing hand-entered rows are kept unless overwritten."""
    header_lines: list[str] = []
    existing: dict[str, float] = {}
    seen_header = False
    if path.exists():
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not seen_header:
                header_lines.append(raw)
                if line.lower().startswith("month"):
                    seen_header = True
                continue
            if not line or line.startswith("#"):
                continue
            parts = [c.strip() for c in line.split(",")]
            mm = re.match(r"(\d{4})-(\d{1,2})", parts[0]) if parts else None
            if mm and len(parts) >= 2:
                try:
                    existing[f"{int(mm.group(1)):04d}-{int(mm.group(2)):02d}"] = float(parts[1])
                except ValueError:
                    pass
    if not header_lines:
        header_lines = ["month,mom_index"]

    merged = dict(existing)
    merged.update(resolved)
    body = "\n".join(f"{k},{merged[k]}" for k in sorted(merged))
    content = "\n".join(header_lines) + "\n" + body + "\n"
    if dry_run:
        print(f"\n[dry-run] would write {len(resolved)} resolved + {len(existing)} existing "
              f"= {len(merged)} rows to {path.name} (not written).")
        return
    path.write_text(content, encoding="utf-8")
    print(f"\nWrote {len(merged)} rows to {path} ({len(resolved)} from this run).")


def upsert_macro_series(resolved: dict[str, float]) -> None:
    """Push resolved months straight to macro_series (source='gso-cafef'). Lazy imports
    the Supabase client so the default CSV path needs no DB deps/creds."""
    if not resolved:
        return
    from ta.common import get_supabase_client  # noqa: PLC0415  (lazy: keeps CSV path dep-light)
    rows = [{"metric": "cpi_mom_index", "date": f"{k}-01", "value": v,
             "unit": "index", "source": "gso-cafef"} for k, v in sorted(resolved.items())]
    get_supabase_client().table("macro_series").upsert(rows, on_conflict="metric,date").execute()
    print(f"Upserted {len(rows)} rows into macro_series (source=gso-cafef).")


def _vn_today() -> dt.date:
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).date()


def main() -> None:
    ap = argparse.ArgumentParser(description="Fetch Vietnam headline CPI (MoM) from CafeF into data/macro/cpi_manual.csv")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--backfill", action="store_true", help=f"resolve every month {BACKFILL_START[0]}-{BACKFILL_START[1]:02d} -> now")
    g.add_argument("--from", dest="from_month", metavar="YYYY-MM", help="resolve every month from YYYY-MM -> now")
    g.add_argument("--month", metavar="YYYY-MM", help="resolve a single month")
    ap.add_argument("--lookback", type=int, default=3, help="daily mode: how many recent months to (re)resolve (default 3)")
    ap.add_argument("--dry-run", action="store_true", help="show findings (+ source sentence/URL), don't write")
    ap.add_argument("--upsert", action="store_true", help="also upsert to macro_series (needs scripts/.env)")
    ap.add_argument("--csv", default=str(MANUAL_CPI_CSV), help="target CSV (default: data/macro/cpi_manual.csv)")
    args = ap.parse_args()

    today = _vn_today()
    cur = (today.year, today.month)

    def parse_ym(s: str) -> tuple[int, int]:
        m = re.match(r"(\d{4})-(\d{1,2})$", s.strip())
        if not m:
            ap.error(f"bad YYYY-MM: {s!r}")
        return int(m.group(1)), int(m.group(2))

    if args.month:
        targets = [parse_ym(args.month)]
    elif args.from_month or args.backfill:
        start = parse_ym(args.from_month) if args.from_month else BACKFILL_START
        targets = list(_months(start, cur))
    else:
        # daily: the last `lookback` months up to the current one (catches a new release)
        targets = list(_months((cur[0], cur[1] - args.lookback + 1) if cur[1] - args.lookback + 1 >= 1
                               else (cur[0] - 1, cur[1] - args.lookback + 13), cur))

    print(f"Resolving CPI for {len(targets)} month(s): {targets[0][0]}-{targets[0][1]:02d} .. {targets[-1][0]}-{targets[-1][1]:02d}")
    resolved: dict[str, float] = {}
    missing: list[str] = []
    for y, m in targets:
        key = f"{y:04d}-{m:02d}"
        res = resolve_month(y, m)
        if res is None:
            missing.append(key)
            print(f"  {key}: not found")
            continue
        idx, n, url, sentence = res
        resolved[key] = idx
        print(f"  {key}: MoM index {idx}  ({idx - 100:+.2f}%, {n} vote{'s' if n > 1 else ''})")
        print(f"          “…{sentence[-90:]}…”")
        print(f"          {url}")

    if not resolved:
        print("\nNothing resolved. (News phrasing may have changed, or the months aren't published yet.)")
        if missing:
            print("Fill these by hand in data/macro/cpi_manual.csv:", ", ".join(missing))
        sys.exit(1)

    update_manual_csv(Path(args.csv), resolved, args.dry_run)
    if args.upsert and not args.dry_run:
        upsert_macro_series(resolved)
    if missing:
        print(f"\nUnresolved ({len(missing)}) — verify + fill by hand in data/macro/cpi_manual.csv: {', '.join(missing)}")
    print("\nTip: review the values above; then the macro-daily cron (or refresh_macro.py) pushes the CSV to the DB.")


if __name__ == "__main__":
    main()
