"""Catalyst scoring — CAN SLIM "N" (New) for the final-grade A/A+ shortlist.

Split of responsibility (the whole design):
  - Groq `groq/compound` (built-in web search) EXTRACTS + timestamps + classifies
    recent company catalysts (new product / service / factory-capacity /
    market / management).
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

Auth: GROQ_API_KEY in scripts/.env.

Config: scoring_config 'catalyst_score' (deep-merged over CATALYST_DEFAULTS).
"""

from __future__ import annotations

import json
import re
import time
from datetime import date, datetime, timedelta

import requests

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
    # Groq's agentic system: web search is BUILT IN, not a declarable tool, and
    # it runs its own search loop. That is why there is no max_searches /
    # max_fetches knob here — the equivalents on the Anthropic path controlled a
    # tool we no longer declare. `groq/compound-mini` is the cheaper sibling.
    "model": "groq/compound",
    # Output cap per symbol — bounds the returned JSON array only. It does NOT
    # affect the 413s (that was tested: 150 failed while 300 succeeded on the
    # same prompt), because the search loop's context dwarfs the output.
    "max_tokens": 1200,
    # Seconds between symbols. The free tier allows 70,000 tokens/minute and a
    # symbol costs ~21.8k, so ~3 fit per minute.
    "request_delay_sec": 20.0,
    # 413 is a transient overrun of compound's search context, not a bad request
    # — see _score_one. Retries must be SPACED, not rapid: 12 attempts 8s apart
    # drained the internal sub-model's quota and turned every 413 into a 429.
    # At ~9% success per attempt, 10 spaced tries lands a symbol ~61% of the time.
    # The shortlist is small (4 symbols), so this costs <=40 of the free tier's
    # 250 requests/day and paces out to roughly one call per minute.
    "max_attempts": 10,
    "retry_delay_sec": 45.0,
}

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
_DEFAULT_HALF_LIFE = 90

# Per-request wall-clock cap so a single slow/hung call can't eat the whole
# scheduled-job budget. A compound search round-trip measured ~10-30s; 600s is
# generous headroom. No retry: retrying a timeout doubles the wasted time on a
# genuinely slow call, and the per-symbol try/except already keeps the run going.
REQUEST_TIMEOUT = 600.0


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
# AI extraction (Groq compound — built-in web search)
# --------------------------------------------------------------------------- #
def _build_prompt(symbol: str, exchange: str, cfg: dict) -> str:
    lookback = cfg["search_lookback_days"]
    cutoff = (today_vn() - timedelta(days=lookback)).isoformat()
    cats = ", ".join(cfg["categories"])
    return f"""Bạn là nhà đầu tư đang nghiên cứu cổ phiếu **{symbol}** (niêm yết trên {exchange}). Hãy tra cứu tin tức GIỐNG HỆT cách một người thật làm trên Google — mục tiêu là KHÔNG BỎ SÓT tin quan trọng:

BƯỚC 1 — Tìm rộng. Tìm trên web với MỘT truy vấn RỘNG bao trùm cả 5 khía cạnh cùng lúc, ví dụ:
  "Tin tức mới nhất liên quan đến sản phẩm, dịch vụ, nhà máy, thị trường, ban lãnh đạo của công ty {symbol}"
  Nếu bạn biết TÊN ĐẦY ĐỦ của công ty, hãy dùng cả tên đó (không chỉ mã {symbol}) để kết quả chính xác hơn.
BƯỚC 2 — Đọc kỹ. Xem VÀI KẾT QUẢ ĐẦU TIÊN và đọc kỹ nội dung của những bài quan trọng (đừng chỉ đọc tiêu đề — mở bài để xem chi tiết).
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
    """Pull the JSON array from the model's reply (last ```json block, else a
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


def _request_body(symbol: str, exchange: str, cfg: dict) -> dict:
    """Groq chat-completions body for one symbol.

    No `tools` array: `groq/compound` has web search BUILT IN and runs its own
    search loop, unlike the Anthropic path where web_search was a declared tool
    with a max_uses cap. Nothing here controls how many searches it makes.
    """
    return {
        "model": cfg["model"],
        "max_tokens": cfg.get("max_tokens", 1200),
        "messages": [{"role": "user", "content": _build_prompt(symbol, exchange, cfg)}],
    }


def _searched(msg: dict) -> bool:
    """Whether the model actually ran a web search for this answer.

    Groq reports its built-in tool activity on `executed_tools`. An answer with
    no search entry came from model memory, which for 90-day company news is
    exactly the failure mode this feature exists to avoid — so the caller logs
    it rather than silently trusting the output.
    """
    return any(t.get("type") == "search" for t in (msg.get("executed_tools") or []))


def _score_one(symbol: str, exchange: str, cfg: dict,
               api_key: str) -> tuple[list | None, str, int, bool]:
    """Score one symbol, retrying the transient 413.

    Returns (result, status, attempts, quota_dead) — `quota_dead` meaning the
    account-wide 429 ceiling was hit, so the caller should stop rather than
    repeat the same doomed retry budget on every remaining symbol.

    Why a retry loop exists at all — HTTP 413 here is NOT "your request is too
    big". Measured against the real prompt (2,162 chars):

      * the same request fails and succeeds at random, ~1 success in 11 tries;
      * failure arrives 15-22s in, i.e. AFTER the search loop ran, not at
        request validation;
      * the identical prompt on a plain model (llama-3.3-70b, no built-in
        search) returns 200 in 1.5s using 1,038 tokens;
      * shrinking the prompt or max_tokens does not help, and neither does
        restricting search domains;
      * it fires with the token budget FULL (69,030 of 70,000 remaining).

    So the payload is fine. What overruns is `groq/compound`'s own accumulated
    search context, and the quota it overruns is NOT the one in the response
    headers. A 429 here named the real ceiling:

        Rate limit reached for model `meta-llama/llama-4-scout-17b-16e-instruct`

    — the sub-model compound drives its search loop with. That model 404s if
    called directly on this key, so its quota is invisible and cannot be tuned
    from the request; meanwhile the visible `groq/compound` headers still report
    ~69,000/70,000 tokens and 200+/250 requests free. Whether an attempt fits is
    decided by how much text the pages it happens to pull contain, which is why
    retrying works at all: a fresh attempt draws a different set of pages.

    That makes 413 a RETRY rather than an error — but a slow one. Retries must
    be spaced (see `retry_delay_sec`): 12 attempts 8s apart drained the
    sub-model's budget and converted every 413 into a 429, which is strictly
    worse. Expect partial coverage per run on the free tier; a symbol that never
    lands returns None and keeps yesterday's score. A paid Groq tier, which
    raises the sub-model quota too, is what makes this reliable.
    """
    max_attempts = int(cfg.get("max_attempts", 12))
    backoff = float(cfg.get("retry_delay_sec", 8.0))
    last = "no attempt"
    last_code = 0

    for attempt in range(1, max_attempts + 1):
        try:
            resp = requests.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {api_key}",
                         "Content-Type": "application/json"},
                json=_request_body(symbol, exchange, cfg),
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code == 200:
                msg = (resp.json().get("choices") or [{}])[0].get("message") or {}
                found = _extract_json_array(msg.get("content") or "")
                note = "" if _searched(msg) else " [NO SEARCH — from model memory]"
                return found, f"{len(found)} found{note}", attempt, False

            if resp.status_code in (413, 429) and attempt < max_attempts:
                # 429 reports how long the bucket needs; 413 does not, so a
                # short pause is enough — we are re-rolling the page mix, not
                # waiting for quota.
                wait = backoff
                if resp.status_code == 429:
                    try:
                        wait = max(wait, float(resp.headers.get("retry-after", 0)) + 1)
                    except ValueError:
                        pass
                last, last_code = f"HTTP {resp.status_code}", resp.status_code
                time.sleep(wait)
                continue

            # Reached on a non-retryable code, and on 413/429 in the FINAL
            # attempt (the retry branch above is gated on attempt < max). A 429
            # here means the account-wide ceiling, so flag the quota as dead —
            # this return, not the one after the loop, is where an exhausted
            # 429 budget actually lands.
            detail = resp.text[:160].replace("\n", " ")
            return (None, f"ERROR HTTP {resp.status_code} {detail}", attempt,
                    resp.status_code == 429)
        except Exception as e:  # noqa: BLE001 — one bad symbol must not end the run
            last, last_code = f"ERROR {str(e)[:160]}", 0
            if attempt < max_attempts:
                time.sleep(backoff)
                continue
            return None, last, attempt, False

    # Burning every attempt and ending on 429 means the shared quota is gone,
    # not that this symbol was unlucky — 413 is per-attempt, 429 is account-wide.
    # The caller uses this to stop rather than repeat the same wait per symbol.
    return (None, f"GAVE UP after {max_attempts} attempts (last: {last})",
            max_attempts, last_code == 429)


def fetch_catalysts_groq(agroup: list[dict], cfg: dict, api_key: str) -> dict[str, list | None]:
    """Score the shortlist one symbol at a time against Groq.

    Sequential, not batched: Groq has no Batch API (the Anthropic path used one
    for the 50% discount). Pacing matters instead — the free tier allows 70,000
    tokens/minute and one symbol costs ~21.8k, so roughly three fit per minute.
    `request_delay_sec` spaces the calls; retries within a symbol are paced by
    `_score_one`.

    Returns {symbol: raw_catalyst_list | None} — None for a symbol that errored,
    which the caller leaves untouched so yesterday's score survives.
    """
    out: dict[str, list | None] = {}
    delay = float(cfg.get("request_delay_sec", 20.0))
    n = len(agroup)
    t0 = time.monotonic()

    for i, a in enumerate(agroup, 1):
        sym, exch = a["symbol"], a["exchange"]
        started = time.monotonic()
        out[sym], status, tries, quota_dead = _score_one(sym, exch, cfg, api_key)

        dt = time.monotonic() - started
        elapsed = time.monotonic() - t0
        eta = (elapsed / i) * (n - i)  # simple running-average ETA
        att = f" · {tries} attempt(s)" if tries > 1 else ""
        print(f"  [{i}/{n}] {sym}: {status} ({dt:.0f}s{att}) · elapsed {elapsed / 60:.1f}m · "
              f"eta ~{eta / 60:.1f}m", flush=True)

        if quota_dead:
            # The 429 ceiling is account-wide, so every remaining symbol would
            # burn the same full retry budget for the same failure — 4 symbols
            # cost 28 minutes of CI to score nothing before this guard existed.
            # Leave the rest as None so they keep their previous scores.
            for rest in agroup[i:]:
                out[rest["symbol"]] = None
            print(f"  Groq quota exhausted (429 on every attempt) — stopping; "
                  f"{n - i} symbol(s) skipped, existing scores kept.", flush=True)
            break

        if i < n and delay > 0:
            time.sleep(delay)
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
                      symbols: list[str] | None = None, limit: int | None = None) -> dict:
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

    delay = float(cfg.get("request_delay_sec", 20.0))
    print(f"Catalyst refresh · {as_of.isoformat()} · provider=groq · "
          f"model={cfg['model']} · max_tokens={cfg.get('max_tokens', 1200)} · "
          f"delay={delay:.0f}s · lookback={cfg['search_lookback_days']}d · "
          f"min_vol={int(min_vol):,}", flush=True)
    print(f"{len(agroup)} symbol(s): {', '.join(a['symbol'] for a in agroup)}", flush=True)

    raw_by_symbol = fetch_catalysts_groq(agroup, cfg, api_key)

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
