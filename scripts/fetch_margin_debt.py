#!/usr/bin/env python3
"""
fetch_margin_debt.py — Vietnam TOTAL MARKET MARGIN DEBT (quarterly) into
data/margin_debt_manual.csv (+ optionally macro_series).

WHAT: "Dư nợ cho vay margin toàn thị trường" — the aggregate margin lending balance
across all securities companies (CTCK). It is a QUARTERLY figure: each broker
discloses its margin balance only in its quarterly financial statements, and the
financial press aggregates the market total ~3 weeks after quarter-end. There is
NO daily or monthly source. This script tracks the market total by reading the
quarterly "dư nợ margin toàn thị trường" report on CafeF and extracting the
headline figure + the quarter it reports.

Value is stored in TRILLION VND (nghìn tỷ) in the CSV, and pushed to macro_series
as `margin_debt_total` in BILLION VND (× 1000), keyed to the quarter-end date.

DEFINITION CAVEAT: the headline sometimes means pure margin, sometimes margin +
advance-on-sale (ứng trước tiền bán) — they differ ~10-15 nghìn tỷ. We store the
reported headline; the trend is reliable, small level steps may exist.

Usage:
  python3 fetch_margin_debt.py                 # resolve the latest 2 quarters -> CSV
  python3 fetch_margin_debt.py --from 2024-Q3  # resolve every quarter from there -> now
  python3 fetch_margin_debt.py --quarter 2026-Q2
  python3 fetch_margin_debt.py --dry-run       # show findings (+ evidence/URL), don't write
  python3 fetch_margin_debt.py --upsert        # also push to macro_series (needs scripts/.env)

Notes:
  * ALWAYS eyeball a --dry-run: news phrasing drifts. The evidence sentence + URL
    are printed per resolved quarter.
  * Older quarters (2022-Q2 .. 2024-Q2) aren't well indexed by CafeF search — the
    latest-quarter path is reliable; hand-fill history gaps in the CSV.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote

import requests

MANUAL_CSV = Path(__file__).resolve().parent.parent / "data" / "margin_debt_manual.csv"
METRIC = "margin_debt_total"

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
CAFEF_SEARCH = "https://cafef.vn/tim-kiem.chn?keywords={q}"

# The market-total figure: "toàn thị trường … 445.000 tỷ" / "ước tính … 445.000 tỷ" /
# "gần 450.000 tỷ" / "chạm ngưỡng 400.000 tỷ" / "… 445 nghìn tỷ".
_TOTAL = re.compile(
    r"(?:to[àa]n th[ị i] tr[ưuơ]+ng|[ưu][ớơ]c t[íi]nh|g[ầa]n|kho[ảa]ng|ch[ạa]m ng[ưuơ]+ng|đ[ạa]t)"
    r"[^.%]{0,70}?(\d{2,3}(?:\.\d{3})?)\s*(ngh[ìi]n\s*t[ỷy]|t[ỷy])",
    re.I,
)
_QNEAR = r"(?:cu[ốo]i )?qu[ýy]\s*{q}\s*[/ ]\s*{y}"


def _to_trillion(num: str, unit: str) -> float:
    """'445.000' + 'tỷ' -> 445.0 ; '445' + 'nghìn tỷ' -> 445.0."""
    n = float(num.replace(".", ""))
    if "ngh" in unit.lower():
        return round(n, 1)               # already in nghìn tỷ (trillion)
    return round(n / 1000.0, 1) if n >= 1000 else round(n, 1)  # 'NNN.NNN tỷ' -> trillion


def _get(url: str, session: requests.Session) -> str:
    try:
        r = session.get(url, headers={"User-Agent": _UA}, timeout=30).text
        time.sleep(0.35)
        return r
    except Exception as e:  # noqa: BLE001
        print(f"    fetch failed ({str(e)[:50]}): {url[:70]}")
        return ""


def _clean(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))


def _extract_total(text: str, y: int, q: int) -> tuple[float, str] | None:
    """Headline market total (trillion VND) for quarter (y, q) if the text ties a
    figure to that quarter; else None. Requires a 'quý q/y' (or 'cuối năm y' for Q4)
    mention within ~200 chars of the figure, so we don't grab a different quarter."""
    qnear = re.compile(_QNEAR.format(q=q, y=y), re.I)
    ynear = re.compile(rf"cu[ốo]i n[ăa]m\s*{y}", re.I) if q == 4 else None
    for m in _TOTAL.finditer(text):
        window = text[max(0, m.start() - 200):m.end() + 60]
        if qnear.search(window) or (ynear and ynear.search(window)):
            val = _to_trillion(m.group(1), m.group(2))
            if 40 <= val <= 900:  # plausibility (trillion VND)
                return val, re.sub(r"\s+", " ", text[max(0, m.start() - 50):m.end() + 20]).strip()
    return None


def resolve_quarter(y: int, q: int, session: requests.Session) -> tuple[float, str, str] | None:
    """Resolve quarter (y, q)'s market total from CafeF. Returns (trillion, evidence,
    url) or None. Prefers articles whose TITLE is about the whole market."""
    seen: set[str] = set()
    queries = [
        f"dư nợ margin toàn thị trường quý {q}/{y}",
        f"dư nợ margin toàn thị trường quý {q} {y}",
        "dư nợ margin toàn thị trường",
    ]
    best: tuple[float, str, str] | None = None
    for query in queries:
        html = _get(CAFEF_SEARCH.format(q=quote(query)), session)
        for m in re.finditer(r'href="((?:https?://cafef\.vn)?/[^"]+\.chn)"[^>]*title="([^"]*)"', html):
            url, title = m.group(1), m.group(2)
            low = title.lower()
            if "margin" not in low and "ký quỹ" not in low:
                continue
            # prefer whole-market articles
            title_market = any(k in low for k in ("toàn thị trường", "toàn ngành", "các ctck", "các công ty chứng khoán", "chạm ngưỡng"))
            url = ("https://cafef.vn" + url) if url.startswith("/") else url
            if url in seen:
                continue
            seen.add(url)
            got = _extract_total(_clean(_get(url, session)), y, q)
            if got is not None:
                val, ev = got
                if best is None or title_market:
                    best = (val, ev, url)
                if title_market:
                    return best
        if best is not None:
            return best
    return best


# --------------------------------------------------------------------------- #
# Quarter helpers
# --------------------------------------------------------------------------- #
def _quarter_end(y: int, q: int) -> dt.date:
    return {1: dt.date(y, 3, 31), 2: dt.date(y, 6, 30), 3: dt.date(y, 9, 30), 4: dt.date(y, 12, 31)}[q]


def _latest_reportable(today: dt.date) -> tuple[int, int]:
    """The most recent quarter whose report should be published by `today` (~25 days
    after quarter-end). E.g. 2026-07-25 -> (2026, 2)."""
    y, m = today.year, today.month
    q = (m - 1) // 3 + 1  # quarter `today` is in
    # step back to the just-ended quarter, and once more if <25 days since its end
    y0, q0 = (y, q - 1) if q > 1 else (y - 1, 4)
    if (today - _quarter_end(y0, q0)).days < 25:
        y0, q0 = (y0, q0 - 1) if q0 > 1 else (y0 - 1, 4)
    return y0, q0


def _quarters(f: tuple[int, int], t: tuple[int, int]):
    y, q = f
    while (y, q) <= t:
        yield y, q
        y, q = (y + 1, 1) if q == 4 else (y, q + 1)


def _vn_today() -> dt.date:
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).date()


# --------------------------------------------------------------------------- #
# CSV + DB
# --------------------------------------------------------------------------- #
def update_manual_csv(path: Path, resolved: dict[str, float], dry_run: bool) -> None:
    header_lines: list[str] = []
    existing: dict[str, float] = {}
    seen_header = False
    if path.exists():
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not seen_header:
                header_lines.append(raw)
                if line.lower().startswith("quarter"):
                    seen_header = True
                continue
            if not line or line.startswith("#"):
                continue
            parts = [c.strip() for c in line.split(",")]
            if len(parts) >= 2 and re.match(r"20\d{2}-Q[1-4]$", parts[0]):
                try:
                    existing[parts[0]] = float(parts[1])
                except ValueError:
                    pass
    if not header_lines:
        header_lines = ["quarter,trillion_vnd"]
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
    if not resolved:
        return
    from ta.common import get_supabase_client  # noqa: PLC0415  (lazy: keeps CSV path dep-light)
    rows = []
    for key, trillion in sorted(resolved.items()):
        y, q = int(key[:4]), int(key[-1])
        rows.append({"metric": METRIC, "date": _quarter_end(y, q).isoformat(),
                     "value": round(trillion * 1000.0, 1), "unit": "billion VND", "source": "cafef-news"})
    get_supabase_client().table("macro_series").upsert(rows, on_conflict="metric,date").execute()
    print(f"Upserted {len(rows)} rows into macro_series ({METRIC}, source=cafef-news).")


def main() -> None:
    ap = argparse.ArgumentParser(description="Fetch VN total-market margin debt (quarterly) into data/margin_debt_manual.csv")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--from", dest="from_q", metavar="YYYY-Qn", help="resolve every quarter from YYYY-Qn -> latest")
    g.add_argument("--quarter", metavar="YYYY-Qn", help="resolve a single quarter")
    ap.add_argument("--lookback", type=int, default=2, help="default mode: recent quarters to (re)resolve (default 2)")
    ap.add_argument("--dry-run", action="store_true", help="show findings (+ evidence/URL), don't write")
    ap.add_argument("--upsert", action="store_true", help="also upsert to macro_series (needs scripts/.env)")
    ap.add_argument("--csv", default=str(MANUAL_CSV), help="target CSV (default: data/margin_debt_manual.csv)")
    args = ap.parse_args()

    def parse_q(s: str) -> tuple[int, int]:
        m = re.match(r"(20\d{2})-Q([1-4])$", s.strip(), re.I)
        if not m:
            ap.error(f"bad YYYY-Qn: {s!r}")
        return int(m.group(1)), int(m.group(2))

    latest = _latest_reportable(_vn_today())
    if args.quarter:
        targets = [parse_q(args.quarter)]
    elif args.from_q:
        targets = list(_quarters(parse_q(args.from_q), latest))
    else:
        # default: the latest `lookback` reportable quarters (catches a new release)
        start = latest
        for _ in range(args.lookback - 1):
            start = (start[0], start[1] - 1) if start[1] > 1 else (start[0] - 1, 4)
        targets = list(_quarters(start, latest))

    print(f"Resolving margin debt for {len(targets)} quarter(s): "
          f"{targets[0][0]}-Q{targets[0][1]} .. {targets[-1][0]}-Q{targets[-1][1]}")
    session = requests.Session()
    resolved: dict[str, float] = {}
    missing: list[str] = []
    for y, q in targets:
        key = f"{y}-Q{q}"
        res = resolve_quarter(y, q, session)
        if res is None:
            missing.append(key)
            print(f"  {key}: not found")
            continue
        val, ev, url = res
        resolved[key] = val
        print(f"  {key}: {val:.0f} nghìn tỷ")
        print(f"          “…{ev[-95:]}…”")
        print(f"          {url[:100]}")

    if not resolved:
        print("\nNothing resolved. (Report may not be published yet, or wording changed.)")
        if missing:
            print("Hand-fill in data/margin_debt_manual.csv:", ", ".join(missing))
        sys.exit(1)

    update_manual_csv(Path(args.csv), resolved, args.dry_run)
    if args.upsert and not args.dry_run:
        upsert_macro_series(resolved)
    if missing:
        print(f"\nUnresolved ({len(missing)}) — hand-fill in data/margin_debt_manual.csv: {', '.join(missing)}")
    print("\nTip: review the values above; refresh_macro.py re-asserts the CSV to the DB each run.")


if __name__ == "__main__":
    main()
