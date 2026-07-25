#!/usr/bin/env python3
"""
fetch_bank_lending.py — Vietnam system-wide AVERAGE LENDING RATE range (%/year)
into data/bank_lending_manual.csv (+ optionally macro_series).

WHAT: SBV publishes a monthly report "Diễn biến lãi suất của tổ chức tín dụng đối
với khách hàng tháng M/YYYY" (~3 weeks after month-end) that states the system-wide
average VND lending rate for new + outstanding loans as a range, e.g.:
    "...lãi suất cho vay bình quân ... đối với các khoản cho vay mới và cũ còn dư
     nợ ở mức 8,1-10,5%/năm"  -> min 8.1, max 10.5
This is the broadest, most authoritative "average lending rate of commercial banks"
available for Vietnam. There is no daily source (loans are per-contract); monthly is
the finest grain that exists. The deposit leg (daily) + this (monthly) + the World
Bank annual underlay together drive the /macro "Bank interest rates" panel.

SOURCES (tried in order per month):
  1. SBV portal PDF — the authoritative original. The listing page
     (sbv.gov.vn/vi/thong-cao-bao-chi) is cloud-reachable and links the last few
     months' "Lai suat thang M.YYYY.pdf"; the PDF itself downloads with full browser
     headers (Referer). Parsed with pypdf. (The HTML article route 403s; the PDF
     does not.)
  2. CafeF news — republishes older months' report verbatim (fallback / backfill).
Unresolved months are reported; hand-fill them in data/bank_lending_manual.csv.

Usage:
  python3 fetch_bank_lending.py                 # recent months (SBV listing) -> CSV
  python3 fetch_bank_lending.py --from 2025-01  # resolve every month 2025-01 -> now
  python3 fetch_bank_lending.py --month 2026-06 # a single month
  python3 fetch_bank_lending.py --dry-run       # show findings (+ evidence), don't write
  python3 fetch_bank_lending.py --upsert        # also push to macro_series (needs scripts/.env)

Notes:
  * ALWAYS eyeball a --dry-run: SBV/news wording drifts. The evidence sentence + URL
    are printed for every resolved month.
  * SBV only lists the most recent ~4 months; older months come from CafeF (which
    stopped the system-wide-range format after ~2025-04) or by hand. The monthly cron
    accumulates forward, so steady-state needs no backfill.
"""

from __future__ import annotations

import argparse
import datetime as dt
import io
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote, unquote

import requests

MANUAL_CSV = Path(__file__).resolve().parent.parent / "data" / "bank_lending_manual.csv"
METRIC_MIN = "bank_lending_avg_min"
METRIC_MAX = "bank_lending_avg_max"

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
SBV_LISTING = "https://sbv.gov.vn/vi/thong-cao-bao-chi"
# Full browser headers — the SBV WAF 403s a bare requests fetch of the PDF/article,
# but serves the PDF with a navigation-style header set + Referer.
_SBV_HDR = {
    "User-Agent": _UA,
    "Accept": "application/pdf,application/xhtml+xml,text/html,*/*",
    "Accept-Language": "vi,en;q=0.8",
    "Referer": SBV_LISTING,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
}
CAFEF_SEARCH = "https://cafef.vn/tim-kiem.chn?keywords={q}"

# The lending-range sentence. Anchor on "cho vay bình quân", then the first
# "X,Y-Z,W%/năm". The negative lookahead drops the USD-loan variant ("bằng USD");
# the caller also drops priority-sector ("lĩnh vực ưu tiên") / short-term matches.
_LEND = re.compile(
    r"cho vay b[ìi]nh qu[âa]n(?![^%]{0,50}USD)[^%]{0,240}?"
    r"(\d{1,2}[.,]\d)\s*[-–]\s*(\d{1,2}[.,]\d)\s*%\s*/?\s*n[ăa]m",
    re.I,
)
_EXCLUDE = re.compile(r"USD|[ưu]u ti[êe]n|ng[ắa]n h[ạa]n", re.I)


def _num(s: str) -> float:
    return float(s.replace(",", "."))


def _clean(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))


def _extract_range(text: str) -> tuple[float, float, str] | None:
    """First plausible (min, max, evidence) lending range in `text`, or None.

    Skips USD / priority-sector / short-term matches; bounds-checks the pair."""
    for m in _LEND.finditer(text):
        seg = m.group(0)
        if _EXCLUDE.search(seg):
            continue
        lo, hi = _num(m.group(1)), _num(m.group(2))
        if 3.0 <= lo <= hi <= 20.0 and (hi - lo) <= 6.0:
            return lo, hi, re.sub(r"\s+", " ", text[max(0, m.start() - 40):m.end()]).strip()
    return None


# --------------------------------------------------------------------------- #
# SBV PDF (authoritative)
# --------------------------------------------------------------------------- #
def _sbv_get(url: str, session: requests.Session, tries: int = 3) -> str:
    """GET an SBV page through the F5 WAF: full navigation headers + retries. The
    SBV WAF 403s bare fetches and can rate-limit; a short retry rides transient
    blocks. Returns '' on persistent failure (caller degrades to CafeF)."""
    for attempt in range(tries):
        try:
            r = session.get(url, headers=_SBV_HDR, timeout=60)
            if r.status_code == 200 and len(r.text) > 3000:
                return r.text
        except Exception as e:  # noqa: BLE001
            if attempt == tries - 1:
                print(f"    SBV fetch error: {str(e)[:60]}")
        time.sleep(2.0 * (attempt + 1))
    return ""


def sbv_pdf_index(session: requests.Session) -> dict[tuple[int, int], str]:
    """{(year, month): pdf_url} for the monthly rate reports on the SBV listing.

    Matches attachment names like 'Lai suat thang 6.2026.pdf', tolerant of literal
    spaces or %20 in the href (the listing uses either)."""
    html = _sbv_get(SBV_LISTING, session)
    if not html:
        print("  SBV listing unreachable (WAF/rate-limit) — falling back to CafeF for all months.")
        return {}
    out: dict[tuple[int, int], str] = {}
    for href in re.findall(r'href="(/documents/[^"]+)"', html):
        m = re.search(r"[Ll]ai\s*suat\s*thang\s*(\d{1,2})[.\-](\d{4})", unquote(href))
        if not m:
            continue
        key = (int(m.group(2)), int(m.group(1)))
        out.setdefault(key, "https://sbv.gov.vn" + quote(href, safe="/:%"))
    return out


def _pdf_text(url: str, session: requests.Session) -> str:
    """Download a SBV PDF (full headers) and extract text via pypdf."""
    from pypdf import PdfReader  # lazy: only the SBV path needs it
    r = session.get(url, headers=_SBV_HDR, timeout=60)
    r.raise_for_status()
    if r.content[:4] != b"%PDF":
        raise RuntimeError(f"not a PDF (status {r.status_code}, {len(r.content)}b)")
    reader = PdfReader(io.BytesIO(r.content))
    return "\n".join(p.extract_text() or "" for p in reader.pages)


def resolve_sbv(year: int, month: int, index: dict[tuple[int, int], str],
                session: requests.Session) -> tuple[float, float, str, str] | None:
    url = index.get((year, month))
    if not url:
        return None
    try:
        text = _clean(_pdf_text(url, session))
    except Exception as e:  # noqa: BLE001
        print(f"    SBV PDF {year}-{month:02d} failed: {str(e)[:70]}")
        return None
    got = _extract_range(text)
    if got is None:
        return None
    lo, hi, ev = got
    return lo, hi, ev, url


# --------------------------------------------------------------------------- #
# CafeF (fallback / backfill for older months)
# --------------------------------------------------------------------------- #
def _get(url: str) -> str:
    try:
        r = requests.get(url, headers={"User-Agent": _UA}, timeout=35).text
        time.sleep(0.4)
        return r
    except Exception as e:  # noqa: BLE001
        print(f"    fetch failed ({str(e)[:50]}): {url[:70]}")
        return ""


def _pub_month_from_url(url: str) -> tuple[int, int] | None:
    """Publish (year, month) from a CafeF URL id ('…-188YYMMDD…….chn')."""
    m = re.search(r"-\d{3}(\d{6})\d+\.chn", url)
    if not m:
        return None
    d = m.group(1)
    if 20 <= int(d[:2]) <= 30 and 1 <= int(d[2:4]) <= 12:
        return (2000 + int(d[:2]), int(d[2:4]))
    return None


def resolve_cafef(year: int, month: int) -> tuple[float, float, str, str] | None:
    """Best-effort: find a CafeF article reporting `month`'s lending range.

    The report is published in month+1, so accept articles whose in-text 'tháng M'
    matches and (when derivable) whose publish month is month or month+1."""
    seen: set[str] = set()
    for q in (f"lãi suất cho vay bình quân tháng {month}", "lãi suất cho vay bình quân"):
        html = _get(CAFEF_SEARCH.format(q=quote(q)))
        for mm in re.finditer(r'href="((?:https?://cafef\.vn)?/[^"]+\.chn)"[^>]*title="([^"]*)"', html):
            url, title = mm.group(1), mm.group(2)
            url = ("https://cafef.vn" + url) if url.startswith("/") else url
            if url in seen or "bình quân" not in title.lower():
                continue
            seen.add(url)
            pub = _pub_month_from_url(url)
            if pub is not None and pub not in ((year, month), (year + (month == 12), month % 12 + 1)):
                continue
            text = _clean(_get(url))
            # require the reported month to appear near a "cho vay bình quân … tháng M"
            if not re.search(rf"cho vay b[ìi]nh qu[âa]n[^.]{{0,120}}?th[aá]ng\s*0?{month}\b", text, re.I) \
               and not re.search(rf"th[aá]ng\s*0?{month}\b", title, re.I):
                continue
            got = _extract_range(text)
            if got is not None:
                lo, hi, ev = got
                return lo, hi, ev, url
    return None


def resolve_month(year: int, month: int, index: dict[tuple[int, int], str],
                  session: requests.Session) -> tuple[float, float, str, str] | None:
    return resolve_sbv(year, month, index, session) or resolve_cafef(year, month)


# --------------------------------------------------------------------------- #
# CSV + DB
# --------------------------------------------------------------------------- #
_HEADER = (
    "# Vietnam system-wide AVERAGE LENDING RATE range (%/year), VND new + outstanding\n"
    "# loans, from SBV's monthly 'Diễn biến lãi suất' report (fetch_bank_lending.py).\n"
    "# Hand-fill any month the script can't resolve. Columns: month,min,max\n"
    "month,min,max"
)


def update_manual_csv(path: Path, resolved: dict[str, tuple[float, float]], dry_run: bool) -> None:
    header_lines: list[str] = []
    existing: dict[str, tuple[float, float]] = {}
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
            if mm and len(parts) >= 3:
                try:
                    existing[f"{int(mm.group(1)):04d}-{int(mm.group(2)):02d}"] = (float(parts[1]), float(parts[2]))
                except ValueError:
                    pass
    if not header_lines:
        header_lines = _HEADER.splitlines()

    merged = dict(existing)
    merged.update(resolved)
    body = "\n".join(f"{k},{merged[k][0]},{merged[k][1]}" for k in sorted(merged))
    content = "\n".join(header_lines) + "\n" + body + "\n"
    if dry_run:
        print(f"\n[dry-run] would write {len(resolved)} resolved + {len(existing)} existing "
              f"= {len(merged)} rows to {path.name} (not written).")
        return
    path.write_text(content, encoding="utf-8")
    print(f"\nWrote {len(merged)} rows to {path} ({len(resolved)} from this run).")


def upsert_macro_series(resolved: dict[str, tuple[float, float]]) -> None:
    if not resolved:
        return
    from ta.common import get_supabase_client  # noqa: PLC0415  (lazy: keeps CSV path dep-light)
    rows: list[dict] = []
    for k, (lo, hi) in sorted(resolved.items()):
        rows.append({"metric": METRIC_MIN, "date": f"{k}-01", "value": lo, "unit": "%", "source": "sbv"})
        rows.append({"metric": METRIC_MAX, "date": f"{k}-01", "value": hi, "unit": "%", "source": "sbv"})
    get_supabase_client().table("macro_series").upsert(rows, on_conflict="metric,date").execute()
    print(f"Upserted {len(rows)} rows into macro_series ({METRIC_MIN}/{METRIC_MAX}, source=sbv).")


def _months(f: tuple[int, int], t: tuple[int, int]):
    y, m = f
    while (y, m) <= t:
        yield y, m
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)


def _vn_today() -> dt.date:
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).date()


def main() -> None:
    ap = argparse.ArgumentParser(description="Fetch VN average lending-rate range (SBV monthly) into data/bank_lending_manual.csv")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--from", dest="from_month", metavar="YYYY-MM", help="resolve every month from YYYY-MM -> now")
    g.add_argument("--month", metavar="YYYY-MM", help="resolve a single month")
    ap.add_argument("--lookback", type=int, default=4, help="default mode: recent months to (re)resolve (default 4)")
    ap.add_argument("--dry-run", action="store_true", help="show findings (+ evidence/URL), don't write")
    ap.add_argument("--upsert", action="store_true", help="also upsert to macro_series (needs scripts/.env)")
    ap.add_argument("--csv", default=str(MANUAL_CSV), help="target CSV (default: data/bank_lending_manual.csv)")
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
    elif args.from_month:
        targets = list(_months(parse_ym(args.from_month), cur))
    else:
        start = (cur[0], cur[1] - args.lookback + 1)
        if start[1] < 1:
            start = (start[0] - 1, start[1] + 12)
        targets = list(_months(start, cur))

    print(f"Resolving lending range for {len(targets)} month(s): "
          f"{targets[0][0]}-{targets[0][1]:02d} .. {targets[-1][0]}-{targets[-1][1]:02d}")
    session = requests.Session()
    session.headers.update({"User-Agent": _UA})
    try:  # warm the WAF cookie (best-effort — a block here just means CafeF fallback)
        session.get("https://sbv.gov.vn/vi", headers=_SBV_HDR, timeout=40)
    except Exception:  # noqa: BLE001, S110
        pass
    index = sbv_pdf_index(session)
    if index:
        print(f"  SBV listing: {len(index)} monthly report(s) available "
              f"({min(index)[0]}-{min(index)[1]:02d} .. {max(index)[0]}-{max(index)[1]:02d})")

    resolved: dict[str, tuple[float, float]] = {}
    missing: list[str] = []
    for y, m in targets:
        key = f"{y:04d}-{m:02d}"
        res = resolve_month(y, m, index, session)
        if res is None:
            missing.append(key)
            print(f"  {key}: not found")
            continue
        lo, hi, ev, url = res
        resolved[key] = (lo, hi)
        src = "SBV" if url.startswith("https://sbv.gov.vn") else "CafeF"
        print(f"  {key}: {lo:.1f}-{hi:.1f}%/năm  [{src}]")
        print(f"          “…{ev[-95:]}…”")
        print(f"          {url[:100]}")

    if not resolved:
        print("\nNothing resolved. (Reports may not be published yet, or wording changed.)")
        if missing:
            print("Fill by hand in data/bank_lending_manual.csv:", ", ".join(missing))
        sys.exit(1)

    update_manual_csv(Path(args.csv), resolved, args.dry_run)
    if args.upsert and not args.dry_run:
        upsert_macro_series(resolved)
    if missing:
        print(f"\nUnresolved ({len(missing)}) — hand-fill in data/bank_lending_manual.csv: {', '.join(missing)}")
    print("\nTip: review the values above; refresh_macro.py re-asserts the CSV to the DB each run.")


if __name__ == "__main__":
    main()
