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
import time
from datetime import date, datetime, timedelta

# common lives in ta/ (shared pipeline helpers: env, Supabase client, config).
from ta.common import load_scoring_config, safe_execute, today_vn

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
    "search_lookback_days": 90,
    # Only score A/A+ symbols whose 20-session avg volume is at least this many
    # shares (drops illiquid names). 0 = no liquidity filter.
    "min_avg_volume_20d": 100000,
    "model": "claude-sonnet-5",
    # Each web_search_20260209 call runs a server-side search + dynamic-filter
    # loop (~2-4 min). 2 = one broad query (covers all 5 dimensions) + one
    # follow-up; higher values multiply runtime. Kept low so requests finish.
    "max_searches_per_symbol": 2,
    # web_fetch downloads FULL article pages into a growing agentic-loop context
    # that is re-billed each turn — it 3-4x'd cost in testing. Off by default
    # (web_search_20260209 already returns filtered page content). Set > 0 to
    # opt in; web_fetch_max_content_tokens then caps each fetched page.
    "max_fetches_per_symbol": 0,
    "web_fetch_max_content_tokens": 4000,
}

# BASIC web search. The _20260209 "dynamic filtering" variant runs code-execution
# under the hood — one query spawns many slow server-tool calls (observed 18+ in
# 5 min, NOT capped by max_uses), which is the runtime + cost blow-up. The basic
# variant just returns search results and respects max_uses.
WEB_SEARCH_TOOL_VERSION = "web_search_20250305"
WEB_FETCH_TOOL_VERSION = "web_fetch_20260209"
MAX_TOKENS = 4000
_DEFAULT_HALF_LIFE = 90

# Per-request wall-clock cap so a single slow/hung call can't eat the whole
# scheduled-job budget. With thinking disabled a web_search request is ~1-3 min;
# 600s is generous headroom. No retry: a timeout retry just doubles the wasted
# time on a genuinely slow call (the per-symbol try/except keeps the run going).
REQUEST_TIMEOUT = 600.0
MAX_RETRIES = 0


# --------------------------------------------------------------------------- #
# A-group selection
# --------------------------------------------------------------------------- #
def get_agroup_symbols(client, min_avg_volume: float = 0) -> list[dict]:
    """Symbols with final_grade A/A+ in the latest FA period, with exchange,
    filtered to those whose 20-session avg volume >= `min_avg_volume`.

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

    # exchange + 20d avg volume from ta_universe (for the liquidity filter).
    uni: dict[str, tuple[str, float | None]] = {}
    for i in range(0, len(syms), 200):
        er = safe_execute(
            client.table("ta_universe").select("symbol,exchange,avg_volume_20d").in_("symbol", syms[i:i + 200]),
            label="catalyst universe",
        ).data or []
        for r in er:
            uni[r["symbol"]] = (r.get("exchange") or "HOSE", r.get("avg_volume_20d"))

    out: list[dict] = []
    dropped = 0
    for r in rows:
        exch, avg_vol = uni.get(r["symbol"], ("HOSE", None))
        if min_avg_volume and (avg_vol is None or avg_vol < min_avg_volume):
            dropped += 1
            continue
        out.append({"symbol": r["symbol"], "exchange": exch, "final_grade": r["final_grade"]})
    if dropped:
        print(f"  liquidity filter: dropped {dropped} A/A+ symbol(s) below "
              f"{int(min_avg_volume):,} avg 20d volume", flush=True)
    return out


# --------------------------------------------------------------------------- #
# AI extraction (Claude + web_search)
# --------------------------------------------------------------------------- #
def _build_prompt(symbol: str, exchange: str, cfg: dict) -> str:
    lookback = cfg["search_lookback_days"]
    cutoff = (today_vn() - timedelta(days=lookback)).isoformat()
    cats = ", ".join(cfg["categories"])
    return f"""Bạn là nhà đầu tư đang nghiên cứu cổ phiếu **{symbol}** (niêm yết trên {exchange}). Hãy tra cứu tin tức GIỐNG HỆT cách một người thật làm trên Google — mục tiêu là KHÔNG BỎ SÓT tin quan trọng:

BƯỚC 1 — Tìm rộng. Dùng web_search với MỘT truy vấn RỘNG bao trùm cả 5 khía cạnh cùng lúc, ví dụ:
  "Tin tức mới nhất liên quan đến sản phẩm, dịch vụ, nhà máy, thị trường, ban lãnh đạo của công ty {symbol}"
  Nếu bạn biết TÊN ĐẦY ĐỦ của công ty, hãy dùng cả tên đó (không chỉ mã {symbol}) để kết quả chính xác hơn.
BƯỚC 2 — Đọc kỹ. Xem VÀI KẾT QUẢ ĐẦU TIÊN và đọc kỹ nội dung của những bài quan trọng (đừng chỉ đọc tiêu đề; nếu có công cụ web_fetch thì mở bài để xem chi tiết).
BƯỚC 3 — Tìm bổ sung nếu cần. Có thể thêm 1-2 truy vấn hẹp hơn theo từng khía cạnh, hoặc "{symbol} công bố thông tin / nghị quyết HĐQT / kế hoạch".

Chỉ xét tin công bố TỪ {cutoff} trở lại đây (~{lookback} ngày). Ưu tiên nguồn uy tín: cafef.vn, vietstock.vn, tinnhanhchungkhoan.vn, vneconomy.vn, ndh.vn, và công bố thông tin của sở giao dịch (hsx.vn / hnx.vn). Bỏ qua tin đồn không nguồn.

Phân loại mỗi catalyst vào ĐÚNG một mã trong: {cats}
  - new_product: sản phẩm mới
  - new_service: dịch vụ mới
  - new_factory_capacity: nhà máy / mở rộng công suất mới
  - new_market: thị trường / khu vực / kênh phân phối mới
  - new_management: ban lãnh đạo / nhân sự cấp cao mới

Chấm điểm mức độ trọng yếu (raw_points) theo đóng góp doanh thu:
  - 3: có, đóng góp DƯỚI 25% doanh thu
  - 9: có, đóng góp TRÊN 25% doanh thu
(Không phải catalyst thật thì KHÔNG đưa vào danh sách.)

status: "upcoming" (chưa phản ánh vào KQKD, còn kỳ vọng phía trước) hoặc "realized" (đã phản ánh vào doanh thu-lợi nhuận).

Sau khi đọc xong, trả về DUY NHẤT một mảng JSON trong một khối ```json (không thêm chữ nào sau khối này). Mỗi phần tử:
{{
  "category": "<một mã ở trên>",
  "raw_points": 3 hoặc 9,
  "status": "upcoming" hoặc "realized",
  "headline": "<tiêu đề ngắn gọn tiếng Việt>",
  "source_url": "<URL nguồn tin>",
  "published_date": "YYYY-MM-DD hoặc null nếu không rõ",
  "reasoning": "<1-2 câu giải thích vì sao chấm điểm như vậy>"
}}

Nếu không có catalyst hợp lệ, trả về mảng rỗng: ```json
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


def _request_params(symbol: str, exchange: str, cfg: dict) -> dict:
    """Messages-API params for one symbol (used as a batch request body).

    web_search does the broad query (and returns filtered page content).
    web_fetch (opt-in, capped) reads full articles — off by default because
    full-page reads inside the agentic loop are the dominant cost. No
    user_location: web_search rejects country "VN" (400); VN relevance comes
    from the Vietnamese query + the source list in the prompt.
    """
    tools = [{
        "type": WEB_SEARCH_TOOL_VERSION,
        "name": "web_search",
        "max_uses": cfg["max_searches_per_symbol"],
    }]
    max_fetches = cfg.get("max_fetches_per_symbol", 0)
    if max_fetches and max_fetches > 0:
        tools.append({
            "type": WEB_FETCH_TOOL_VERSION,
            "name": "web_fetch",
            "max_uses": max_fetches,
            "max_content_tokens": cfg.get("web_fetch_max_content_tokens", 4000),
        })
    return {
        "model": cfg["model"],
        "max_tokens": MAX_TOKENS,
        # Disable thinking: on Sonnet 5 omitting `thinking` runs ADAPTIVE thinking
        # by default, which deep-thinks at every turn of the web-search loop —
        # minutes-long requests + big token bills. News extraction doesn't need
        # it. (Valid on Sonnet 5 / Opus 4.8/4.7; would 400 on Fable 5.)
        "thinking": {"type": "disabled"},
        "messages": [{"role": "user", "content": _build_prompt(symbol, exchange, cfg)}],
        "tools": tools,
    }


def _result_error_detail(result_obj) -> str:
    """Human-readable error from a non-succeeded batch/API result."""
    err = getattr(result_obj, "error", None)
    inner = getattr(err, "error", None)  # ErrorResponse.error -> ErrorObject(type,message)
    if inner is not None:
        return f"{getattr(inner, 'type', '')}: {getattr(inner, 'message', '')}".strip(": ")
    return str(err)[:240] if err is not None else ""


def _text_of(message) -> str:
    return "".join(blk.text for blk in message.content if blk.type == "text")


def fetch_catalysts_batch(agroup: list[dict], cfg: dict, api_key: str,
                          poll_interval: float = 15.0,
                          max_wait: float = 2400.0) -> dict[str, list | None] | None:
    """Score the whole shortlist in ONE Message Batch (50% cheaper; nightly job
    isn't latency-sensitive). Returns {symbol: raw_catalyst_list | None} — None
    for a symbol whose result errored/expired. Returns the top-level None on
    total failure (submit error or poll timeout) so the caller writes nothing.
    """
    import anthropic

    client = anthropic.Anthropic(api_key=api_key, timeout=REQUEST_TIMEOUT, max_retries=MAX_RETRIES)
    requests = [
        {"custom_id": a["symbol"], "params": _request_params(a["symbol"], a["exchange"], cfg)}
        for a in agroup
    ]
    try:
        batch = client.messages.batches.create(requests=requests)
    except Exception as e:  # noqa: BLE001
        print(f"  batch submit failed — {str(e)[:240]}")
        return None

    print(f"  batch {batch.id} submitted ({len(requests)} requests); polling…", flush=True)
    waited = 0.0
    while True:
        b = client.messages.batches.retrieve(batch.id)
        c = b.request_counts  # live progress: succeeded/errored/processing/…
        done = c.succeeded + c.errored + c.canceled + c.expired
        print(f"  batch {b.processing_status}: {done}/{len(requests)} done "
              f"(ok={c.succeeded} err={c.errored} proc={c.processing}) · elapsed {waited / 60:.1f}m", flush=True)
        if b.processing_status == "ended":
            break
        if waited >= max_wait:
            print(f"  batch not finished after {int(max_wait)}s (status={b.processing_status}); "
                  f"keeping existing scores.", flush=True)
            return None
        time.sleep(poll_interval)
        waited += poll_interval

    out: dict[str, list | None] = {}
    for result in client.messages.batches.results(batch.id):
        sym = result.custom_id
        if result.result.type == "succeeded":
            out[sym] = _extract_json_array(_text_of(result.result.message))
        else:
            print(f"  {sym}: batch result {result.result.type} — {_result_error_detail(result.result)}")
            out[sym] = None
    return out


def fetch_catalysts_sync(agroup: list[dict], cfg: dict, api_key: str) -> dict[str, list | None]:
    """Per-symbol calls, STREAMED. web_search runs a long server-side loop; a
    non-streaming request trips the total-request timeout (~10 min) and errors.
    Streaming keeps the connection alive — the timeout becomes idle-based (time
    between events), so a slow-but-progressing request completes instead of
    dying. Live progress + ETA go to the CI log.
    """
    import anthropic

    client = anthropic.Anthropic(api_key=api_key, timeout=REQUEST_TIMEOUT, max_retries=MAX_RETRIES)
    out: dict[str, list | None] = {}
    n = len(agroup)
    t0 = time.monotonic()
    for i, a in enumerate(agroup, 1):
        sym = a["symbol"]
        print(f"  [{i}/{n}] {sym}: searching…", flush=True)
        started = time.monotonic()
        try:
            searches = 0
            with client.messages.stream(**_request_params(sym, a["exchange"], cfg)) as stream:
                for event in stream:  # live heartbeat: see each server-tool call (progress vs hang)
                    try:
                        if (event.type == "content_block_start"
                                and getattr(event.content_block, "type", "") == "server_tool_use"):
                            searches += 1
                            tool = getattr(event.content_block, "name", "tool")
                            print(f"      · {tool} #{searches} at {time.monotonic() - started:.0f}s", flush=True)
                    except Exception:  # noqa: BLE001 — logging must never break the fetch
                        pass
                msg = stream.get_final_message()
            out[sym] = _extract_json_array(_text_of(msg))
            status = f"{len(out[sym])} found (stop={msg.stop_reason})"
        except Exception as e:  # noqa: BLE001
            out[sym] = None
            status = f"ERROR {str(e)[:160]}"
        dt = time.monotonic() - started
        elapsed = time.monotonic() - t0
        eta = (elapsed / i) * (n - i)  # simple running-average ETA
        print(f"  [{i}/{n}] {sym}: {status} ({dt:.0f}s) · elapsed {elapsed / 60:.1f}m · "
              f"eta ~{eta / 60:.1f}m", flush=True)
    return out


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
                      symbols: list[str] | None = None, limit: int | None = None,
                      use_batch: bool = False) -> dict:
    """Refresh catalyst scores for the A-group (or an explicit symbol list).

    Errored symbols are logged, counted, and left UNTOUCHED (keep yesterday's
    scores). A run with zero successful results writes nothing. Returns stats.
    """
    cfg = load_scoring_config(client, "catalyst_score", CATALYST_DEFAULTS)
    as_of = today_vn()

    min_vol = cfg.get("min_avg_volume_20d", 0)
    if symbols:  # explicit override skips the A-group + liquidity filter
        agroup = [{"symbol": s.upper(), "exchange": "HOSE"} for s in symbols]
    else:
        agroup = get_agroup_symbols(client, min_vol)
    if limit:
        agroup = agroup[:limit]

    stats = {"as_of": as_of.isoformat(), "candidates": len(agroup),
             "evaluated": 0, "with_catalysts": 0, "catalysts": 0, "errors": 0}
    if not agroup:
        print("No A-group symbols — nothing to do.")
        return stats

    mode = "batch" if use_batch else "sync"
    fetches = cfg.get("max_fetches_per_symbol", 0)
    print(f"Catalyst refresh · {as_of.isoformat()} · mode={mode} · "
          f"model={cfg['model']} · thinking=off · searches/sym={cfg['max_searches_per_symbol']} · "
          f"web_fetch={'ON x' + str(fetches) if fetches else 'off'} · "
          f"lookback={cfg['search_lookback_days']}d · min_vol={int(min_vol):,}", flush=True)
    if fetches:
        print("  ⚠️ web_fetch is ON — full-page reads are slow and costly. "
              "Set scoring_config.catalyst_score max_fetches_per_symbol=0 to disable.", flush=True)
    print(f"{len(agroup)} symbol(s): {', '.join(a['symbol'] for a in agroup)}", flush=True)

    fetch = fetch_catalysts_batch if use_batch else fetch_catalysts_sync
    raw_by_symbol = fetch(agroup, cfg, api_key)
    if raw_by_symbol is None:  # total batch failure (submit/timeout)
        stats["errors"] = len(agroup)
        print("Batch failed to run — no writes; existing scores kept.")
        return stats

    # Build rows only for symbols that returned successfully; errored → skip.
    results: list[tuple[str, list[dict], float | None]] = []
    for a in agroup:
        sym = a["symbol"]
        raw_cats = raw_by_symbol.get(sym)
        if raw_cats is None:  # errored/expired — leave this symbol untouched
            stats["errors"] += 1
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
        print(f"  scored {sym}: {len(rows)} catalyst(s), score={score}", flush=True)

    if not results:
        print(f"No successful results ({stats['errors']} errored) — no writes; existing scores kept.")
        return stats
    if dry_run:
        print("[dry-run] no writes.")
        return stats

    # Symbols that previously had catalysts (rows exist) — used to clear ones
    # that have since dropped out of the A-group. Errored symbols are NOT here-
    # cleared (they're in agroup), so they keep yesterday's data.
    agroup_set = {a["symbol"] for a in agroup}
    prev = safe_execute(client.table("symbol_catalysts").select("symbol"), label="catalyst scored").data or []
    scored_before = {r["symbol"] for r in prev}

    # Write successes.
    for sym, rows, _score in results:
        score = _persist_symbol(client, sym, rows)
        safe_execute(
            client.table("ta_universe").update(
                {"catalyst_score": score, "catalyst_date": as_of.isoformat()}
            ).eq("symbol", sym),
            label="catalyst rollup",
        )

    # Clear symbols that dropped out of the A-group since they were last scored.
    for sym in scored_before - agroup_set:
        _persist_symbol(client, sym, [])  # delete rows
        safe_execute(
            client.table("ta_universe").update({"catalyst_score": None, "catalyst_date": None}).eq("symbol", sym),
            label="catalyst dropout clear",
        )
    return stats
