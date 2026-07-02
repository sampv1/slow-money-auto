"""Catalyst scoring — CAN SLIM "N" (New) for the final-grade A/A+ shortlist.

Split of responsibility (the whole design):
  - Claude + web_search EXTRACTS + timestamps + classifies recent company
    catalysts (new product / service / factory-capacity / market / management).
  - This module VALUES them over time with a deterministic decay, because LLMs
    are inconsistent at temporal math:

        effective = raw_points                              # 3 (<25% rev) | 9 (>25% rev)
                  * 0.5 ** (age_days / half_life[category])  # time decay
                  * (1 - priced_in)                          # market absorption (from OHLCV)
                  * status_factor                            # upcoming 1.0 / realized 0.3

    age is anchored on published_date (fallback first_seen) so an old good-news
    fades toward 0 even if today's search still surfaces the same article.

Rollup: ta_universe.catalyst_score = AVERAGE of the effective scores of the
catalysts found (null when none). Signal Pro shows the number; a click opens a
modal that reads symbol_catalysts.

Config: scoring_config 'catalyst_score' (deep-merged over CATALYST_DEFAULTS).
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta

from .common import load_scoring_config, safe_execute, today_vn

# DB-overridable defaults (see scoring_config key 'catalyst_score').
CATALYST_DEFAULTS = {
    "categories": ["new_product", "new_service", "new_factory_capacity", "new_market", "new_management"],
    "raw_points": {"none": 0, "below_25pct_rev": 3, "above_25pct_rev": 9},
    "half_life_days": {
        "new_factory_capacity": 90, "new_market": 90,
        "new_management": 120, "new_product": 60, "new_service": 30,
    },
    "status_factor": {"upcoming": 1.0, "realized": 0.3},
    "priced_in": {"ref_move_pct": 20.0, "max_discount": 1.0},
    "search_lookback_days": 180,
    "model": "claude-opus-4-8",
    "max_searches_per_symbol": 4,
}

WEB_SEARCH_TOOL_VERSION = "web_search_20260209"
MAX_TOKENS = 4000
_DEFAULT_HALF_LIFE = 90


# --------------------------------------------------------------------------- #
# A-group selection
# --------------------------------------------------------------------------- #
def get_agroup_symbols(client) -> list[dict]:
    """Symbols with final_grade A/A+ in the latest FA period, with exchange.

    Returns [{'symbol', 'exchange', 'final_grade'}], highest final_score first.
    """
    period_res = safe_execute(
        client.table("fa_scores").select("as_of_period")
        .order("as_of_period", desc=True).limit(1),
        label="catalyst latest period",
    ).data
    if not period_res:
        return []
    period = period_res[0]["as_of_period"]

    rows = safe_execute(
        client.table("fa_scores").select("symbol,final_grade,final_score")
        .eq("as_of_period", period).in_("final_grade", ["A", "A+"])
        .order("final_score", desc=True),
        label="catalyst a-group",
    ).data or []
    syms = [r["symbol"] for r in rows]
    if not syms:
        return []

    exch: dict[str, str] = {}
    for i in range(0, len(syms), 200):
        er = safe_execute(
            client.table("ta_universe").select("symbol,exchange").in_("symbol", syms[i:i + 200]),
            label="catalyst exchange",
        ).data or []
        for r in er:
            exch[r["symbol"]] = r.get("exchange") or "HOSE"

    return [
        {"symbol": r["symbol"], "exchange": exch.get(r["symbol"], "HOSE"), "final_grade": r["final_grade"]}
        for r in rows
    ]


# --------------------------------------------------------------------------- #
# AI extraction (Claude + web_search)
# --------------------------------------------------------------------------- #
def _build_prompt(symbol: str, exchange: str, cfg: dict) -> str:
    lookback = cfg["search_lookback_days"]
    cutoff = (today_vn() - timedelta(days=lookback)).isoformat()
    cats = ", ".join(cfg["categories"])
    return f"""Bạn là chuyên viên phân tích cổ phiếu Việt Nam. Hãy tìm kiếm tin tức về công ty **{symbol}** (niêm yết trên {exchange}) và xác định các "catalyst" (chất xúc tác cơ bản) theo phương pháp O'Neil CAN SLIM (chữ "N" = New).

Chỉ xét tin tức được công bố TỪ {cutoff} trở về sau (khoảng {lookback} ngày gần nhất). Dùng web_search để tìm tin thật, có nguồn đáng tin cậy (báo tài chính, công bố thông tin của công ty). Bỏ qua tin đồn không nguồn.

Các loại catalyst (category), chỉ dùng đúng các mã sau: {cats}
  - new_product: sản phẩm mới
  - new_service: dịch vụ mới
  - new_factory_capacity: nhà máy / mở rộng công suất mới
  - new_market: thị trường / khu vực / kênh phân phối mới
  - new_management: ban lãnh đạo / nhân sự cấp cao mới

Với MỖI catalyst có thật, chấm điểm mức độ trọng yếu (raw_points) theo đóng góp doanh thu:
  - 3 điểm: có, nhưng đóng góp DƯỚI 25% doanh thu
  - 9 điểm: có, và đóng góp TRÊN 25% doanh thu
(Nếu không phải catalyst thật thì KHÔNG đưa vào danh sách — không có mục 0 điểm.)

Phân loại trạng thái (status):
  - "upcoming": sắp diễn ra / chưa phản ánh vào kết quả kinh doanh (còn kỳ vọng phía trước)
  - "realized": đã diễn ra / đã phản ánh vào doanh thu-lợi nhuận (tin đã cũ)

Sau khi tìm kiếm xong, trả về DUY NHẤT một mảng JSON trong một khối ```json (không thêm chữ nào sau khối này). Mỗi phần tử:
{{
  "category": "<một trong các mã trên>",
  "raw_points": 3 hoặc 9,
  "status": "upcoming" hoặc "realized",
  "headline": "<tiêu đề ngắn gọn tiếng Việt>",
  "source_url": "<URL nguồn tin>",
  "published_date": "YYYY-MM-DD hoặc null nếu không rõ",
  "reasoning": "<1-2 câu giải thích vì sao chấm điểm như vậy>"
}}

Nếu không tìm thấy catalyst nào hợp lệ, trả về mảng rỗng: ```json
[]
```"""


def _extract_json_array(text: str) -> list:
    """Pull the JSON array from Claude's reply (last ```json block, else a
    bracket-matched top-level array). Returns [] on failure."""
    blocks = re.findall(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    candidates = list(reversed(blocks)) if blocks else []
    # Fallback: last top-level [...] span.
    if not candidates:
        start = text.rfind("[")
        end = text.rfind("]")
        if start != -1 and end > start:
            candidates = [text[start:end + 1]]
    for c in candidates:
        try:
            data = json.loads(c)
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            continue
    return []


def fetch_catalysts(symbol: str, exchange: str, cfg: dict, api_key: str) -> list[dict]:
    """Call Claude with web_search and return the raw catalyst list for a symbol.

    Raises on API failure so the caller can log-and-skip one symbol without
    aborting the batch.
    """
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model=cfg["model"],
        max_tokens=MAX_TOKENS,
        messages=[{"role": "user", "content": _build_prompt(symbol, exchange, cfg)}],
        tools=[{
            "type": WEB_SEARCH_TOOL_VERSION,
            "name": "web_search",
            "max_uses": cfg["max_searches_per_symbol"],
        }],
    )
    text = "".join(b.text for b in message.content if b.type == "text")
    return _extract_json_array(text)


# --------------------------------------------------------------------------- #
# Deterministic time-decay valuation
# --------------------------------------------------------------------------- #
def _norm_headline(h: str) -> str:
    """Normalized dedupe key: lowercased, punctuation stripped, whitespace collapsed."""
    s = re.sub(r"[^\w\s]", " ", (h or "").lower())
    return re.sub(r"\s+", " ", s).strip()


def _parse_date(v) -> date | None:
    if not v:
        return None
    try:
        return datetime.strptime(str(v)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _load_closes(client, symbol: str, days: int = 240) -> list[tuple[str, float]]:
    """(date_iso, close) ascending for a symbol's recent bars."""
    cutoff = (today_vn() - timedelta(days=days)).isoformat()
    rows = safe_execute(
        client.table("ta_ohlcv").select("date,close").eq("symbol", symbol)
        .gte("date", cutoff).order("date"),
        label="catalyst ohlcv",
    ).data or []
    return [(r["date"], float(r["close"])) for r in rows if r.get("close") is not None]


def _price_move_pct(closes: list[tuple[str, float]], anchor_iso: str) -> float | None:
    """% move from the first close on/after `anchor_iso` to the latest close."""
    if not closes:
        return None
    anchor = next((px for d, px in closes if d >= anchor_iso), None)
    if anchor is None or anchor <= 0:
        return None
    latest = closes[-1][1]
    return (latest / anchor - 1.0) * 100.0


def compute_effective(cat: dict, anchor: date, price_move_pct: float | None,
                      cfg: dict, as_of: date) -> dict:
    """Decay a raw catalyst into its effective contribution + audit factors."""
    raw = float(cat["raw_points"])
    category = cat["category"]
    hl = cfg["half_life_days"].get(category, _DEFAULT_HALF_LIFE)
    age = max(0, (as_of - anchor).days)
    decay = 0.5 ** (age / hl)

    pin_cfg = cfg["priced_in"]
    move = price_move_pct if (price_move_pct and price_move_pct > 0) else 0.0
    priced_in = min(pin_cfg["max_discount"], move / pin_cfg["ref_move_pct"]) if pin_cfg["ref_move_pct"] else 0.0

    status_factor = cfg["status_factor"].get(cat.get("status", "upcoming"), 1.0)
    effective = raw * decay * (1.0 - priced_in) * status_factor
    return {
        "price_move_pct": round(price_move_pct, 2) if price_move_pct is not None else None,
        "decay_factor": round(decay, 4),
        "priced_in": round(priced_in, 4),
        "effective": round(effective, 3),
    }


# --------------------------------------------------------------------------- #
# Persistence
# --------------------------------------------------------------------------- #
_VALID_STATUS = {"upcoming", "realized"}


def _build_rows(client, symbol: str, raw_cats: list[dict], cfg: dict, as_of: date) -> list[dict]:
    """Validate + decay one symbol's catalysts into DB rows (first_seen preserved
    from any existing row with the same dedupe key)."""
    existing = safe_execute(
        client.table("symbol_catalysts").select("dedup_key,first_seen").eq("symbol", symbol),
        label="catalyst existing",
    ).data or []
    first_seen_by_key = {r["dedup_key"]: r["first_seen"] for r in existing}

    closes = _load_closes(client, symbol)
    valid_cats = set(cfg["categories"])
    as_of_iso = as_of.isoformat()
    rows: list[dict] = []
    seen_keys: set[str] = set()

    for c in raw_cats:
        if not isinstance(c, dict):
            continue
        category = c.get("category")
        raw_points = c.get("raw_points")
        headline = (c.get("headline") or "").strip()
        if category not in valid_cats or raw_points not in (3, 9) or not headline:
            continue
        key = _norm_headline(headline)
        if not key or key in seen_keys:
            continue
        seen_keys.add(key)

        status = c.get("status") if c.get("status") in _VALID_STATUS else "upcoming"
        published = _parse_date(c.get("published_date"))
        first_seen = _parse_date(first_seen_by_key.get(key)) or as_of
        anchor = published or first_seen
        move = _price_move_pct(closes, anchor.isoformat())
        factors = compute_effective(
            {"raw_points": raw_points, "category": category, "status": status},
            anchor, move, cfg, as_of,
        )
        rows.append({
            "symbol": symbol,
            "category": category,
            "dedup_key": key,
            "raw_points": raw_points,
            "status": status,
            "headline": headline,
            "source_url": (c.get("source_url") or None),
            "published_date": published.isoformat() if published else None,
            "first_seen": first_seen.isoformat(),
            "reasoning": (c.get("reasoning") or None),
            "as_of": as_of_iso,
            **factors,
        })
    return rows


def _persist_symbol(client, symbol: str, rows: list[dict]) -> float | None:
    """Replace a symbol's catalyst rows and return the rollup (avg effective) or
    None when no catalysts."""
    safe_execute(
        client.table("symbol_catalysts").delete().eq("symbol", symbol),
        label="catalyst delete",
    )
    if not rows:
        return None
    client.table("symbol_catalysts").insert(rows).execute()
    effs = [r["effective"] for r in rows if r.get("effective") is not None]
    return round(sum(effs) / len(effs), 3) if effs else None


def compute_catalysts(client, api_key: str, dry_run: bool = False,
                      symbols: list[str] | None = None, limit: int | None = None) -> dict:
    """Refresh catalyst scores for the A-group (or an explicit symbol list).

    Per-symbol failures are logged and skipped (non-fatal). Returns stats.
    """
    cfg = load_scoring_config(client, "catalyst_score", CATALYST_DEFAULTS)
    as_of = today_vn()

    if symbols:
        agroup = [{"symbol": s.upper(), "exchange": "HOSE"} for s in symbols]
    else:
        agroup = get_agroup_symbols(client)
    if limit:
        agroup = agroup[:limit]

    stats = {"as_of": as_of.isoformat(), "candidates": len(agroup),
             "evaluated": 0, "with_catalysts": 0, "catalysts": 0, "errors": 0}
    if not agroup:
        print("No A-group symbols — nothing to do.")
        return stats

    print(f"Catalyst refresh for {len(agroup)} symbol(s): "
          f"{', '.join(a['symbol'] for a in agroup)}")

    results: list[tuple[str, list[dict], float | None]] = []
    for a in agroup:
        sym, exch = a["symbol"], a["exchange"]
        try:
            raw_cats = fetch_catalysts(sym, exch, cfg, api_key)
        except Exception as e:  # noqa: BLE001 — one bad symbol must not kill the batch
            stats["errors"] += 1
            print(f"  {sym}: fetch failed — {str(e)[:140]}")
            continue
        rows = _build_rows(client, sym, raw_cats, cfg, as_of)
        stats["evaluated"] += 1
        stats["catalysts"] += len(rows)
        score = None
        if rows:
            stats["with_catalysts"] += 1
            effs = [r["effective"] for r in rows if r.get("effective") is not None]
            score = round(sum(effs) / len(effs), 3) if effs else None
        results.append((sym, rows, score))
        print(f"  {sym}: {len(rows)} catalyst(s), score={score}")

    if dry_run:
        print("[dry-run] no writes.")
        return stats

    # Clear stale scores across the active universe, then write this run's
    # (mirrors the price-base clear-then-write; the A-group changes daily).
    safe_execute(
        client.table("ta_universe").update({"catalyst_score": None, "catalyst_date": None})
        .eq("is_active", True),
        label="catalyst clear",
    )
    for sym, rows, _score in results:
        score = _persist_symbol(client, sym, rows)
        safe_execute(
            client.table("ta_universe").update(
                {"catalyst_score": score, "catalyst_date": as_of.isoformat()}
            ).eq("symbol", sym),
            label="catalyst rollup",
        )
    return stats
