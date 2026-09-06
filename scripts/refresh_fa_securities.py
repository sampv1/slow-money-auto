#!/usr/bin/env python3
"""
refresh_fa_securities.py — daily FA score for securities firms (CTCK rubric).

Rubric #3, scored per (symbol, as_of_date, model_version). Unlike the
manufacturing and real-estate rubrics this one is genuinely DAILY: Cycle (30)
and Valuation (20) are half the score and move every session, while Quality (50)
changes only when a filing lands.

RUNS AFTER macro-daily, NOT WITH THE OTHER FA JOBS. C15 is the single largest
criterion at 10 points and reads the FCI, which macro-daily writes at 13:30 UTC
— more than three hours after fa-score-daily at 10:10. Scoring at 10:10 would
silently read yesterday's FCI and stamp it as today. So a run whose FCI date
does not match the target writes nothing official; `--allow-preliminary` exists
for previews and marks the row PRELIMINARY_FCI_T_MINUS_1, which is never ranked.

Usage:
  python3 refresh_fa_securities.py                    # today's official score
  python3 refresh_fa_securities.py --as-of 2026-09-04 # a specific session
  python3 refresh_fa_securities.py --dry-run          # compute, write nothing
  python3 refresh_fa_securities.py --allow-preliminary
"""

import argparse
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa import securities as sec
from fa.securities import Criterion
from ta.common import get_supabase_client, paged_select, safe_execute
from ta.market_series import (METRIC_ADTV_MOMENTUM, METRIC_BREADTH,
                              METRIC_BREADTH_CHG_5D, METRIC_BREADTH_CHG_10D,
                              MODEL_VERSION as BREADTH_CONVENTION)
from ta.run_status import RunStatus, write_job_summary

SECURITIES_ICB_L4 = "8777"          # 'Môi giới chứng khoán'
FCI_METRIC = "macro_fci_full"
FCI_LOOKBACK = 500


def broker_universe(client) -> list[str]:
    rows = paged_select(
        lambda o, l: client.table("symbol_profile").select("symbol")
        .eq("icb_l4", SECURITIES_ICB_L4).range(o, o + l - 1),
        label="broker universe",
    )
    return sorted({r["symbol"] for r in rows})


def market_context(client, as_of: str) -> dict:
    """ADTV momentum and breadth for the target session, from macro_series.

    Read for the TARGET DATE specifically, never "the latest row": a stale
    series would otherwise be scored as if it were today's market.
    """
    wanted = [METRIC_ADTV_MOMENTUM, METRIC_BREADTH,
              METRIC_BREADTH_CHG_5D, METRIC_BREADTH_CHG_10D]
    rows = safe_execute(
        client.table("macro_series").select("metric,value,meta")
        .in_("metric", wanted).eq("date", as_of),
        label="market context",
    ).data or []
    return _market_from({r["metric"]: r for r in rows})


def _market_from(by: dict) -> dict:
    breadth = by.get(METRIC_BREADTH)
    meta = (breadth or {}).get("meta") or {}
    return {
        "momentum": _num(by.get(METRIC_ADTV_MOMENTUM)),
        "breadth": _num(breadth),
        "breadth_change_5d": _num(by.get(METRIC_BREADTH_CHG_5D)),
        "breadth_change_10d": _num(by.get(METRIC_BREADTH_CHG_10D)),
        "breadth_valid": breadth is not None,
        "breadth_denominator": meta.get("denominator"),
        "breadth_convention": meta.get("convention"),
    }


def _num(row):
    return float(row["value"]) if row and row.get("value") is not None else None


def fci_context(client, as_of: str) -> dict:
    """FCI level, 5-day change, its point-in-time percentile, and turn state.

    The percentile EXCLUDES the target date from its own distribution — ranking
    a value against a history that contains it is a look-ahead, and a small one
    compounds across a backtest.
    """
    rows = paged_select(
        lambda o, l: client.table(FCI_METRIC.startswith("macro") and "macro_series" or "")
        .select("date,value").eq("metric", FCI_METRIC).lte("date", as_of)
        .order("date").range(o, o + l - 1),
        label="fci history",
    )
    series = [(r["date"], float(r["value"])) for r in rows if r.get("value") is not None]
    if not series or series[-1][0] != as_of:
        return {"as_of": series[-1][0] if series else None, "value": None}

    return _fci_state([v for _, v in series], as_of)


def _fci_state(vals: list[float], as_of: str) -> dict:
    d5 = vals[-1] - vals[-6] if len(vals) > 5 else None
    d10 = vals[-1] - vals[-11] if len(vals) > 10 else None

    deltas = [vals[i] - vals[i - 5] for i in range(5, len(vals))]
    history = deltas[:-1][-FCI_LOOKBACK:]          # excludes today's own delta
    pct = (sum(1 for x in history if x < d5) / len(history)) if history and d5 is not None else None

    # A turn is a confirmed change of state: mostly worsening, then a crossing,
    # then persistence. One flip is noise.
    event_valid = False
    prior_positive = None
    days_since = None
    for i in range(len(deltas) - 1, max(0, len(deltas) - 1 - 11), -1):
        if deltas[i] < 0 and deltas[i - 1] >= 0:
            prior_positive = sum(1 for x in deltas[max(0, i - 6):i - 1] if x > 0)
            days_since = len(deltas) - 1 - i
            event_valid = True
            break
    streak = 0
    for x in reversed(deltas):
        if x < 0:
            streak += 1
        else:
            break
    return {"as_of": as_of, "value": vals[-1], "delta5": d5, "delta10": d10,
            "percentile": pct, "history_obs": len(history),
            "event_valid": event_valid, "prior_positive": prior_positive,
            "negative_streak": streak, "days_since_reversal": days_since}


def rank_pct(values: dict[str, float], ascending: bool = True) -> dict[str, float]:
    """Cross-sectional percentile, 0 = best. Only symbols WITH the metric are
    ranked, so a missing value never lands mid-pack by default."""
    have = {s: v for s, v in values.items() if v is not None}
    if len(have) < 5:            # too thin a peer group to rank against
        return {}
    order = sorted(have, key=lambda s: have[s], reverse=not ascending)
    n = len(order) - 1 or 1
    return {s: i / n for i, s in enumerate(order)}


def latest_quarter(client, probe: str = "SSI") -> str | None:
    """Newest quarter with statements, asked of ONE symbol.

    An unscoped `order by period desc limit 1` sorts ~240k rows on a column with
    no index and hits the statement timeout. Every symbol shares the same
    reporting calendar, so one liquid broker answers it for the whole sector.
    """
    r = safe_execute(
        client.table("fa_vnstock_statements").select("period")
        .eq("symbol", probe).eq("period_type", "quarter")
        .order("period", desc=True).limit(1),
        label="latest quarter",
    ).data
    return r[0]["period"] if r else None


# Equity risk premium over the 10-year government bond. A parameter, not a
# measurement — it sets where "fairly valued" sits for every broker at once, so
# it is named here rather than buried in an expression, and it is versioned with
# the model. 8% is the conventional Vietnam equity premium.
EQUITY_RISK_PREMIUM = 0.08
DEFAULT_RISK_FREE = 0.045
# Quarters of a symbol's own core P/E history to rank today's against. C19 asks
# where the current valuation sits in ITS OWN range, not against peers: a broker
# that always trades at 8x is not cheap at 8x.
CORE_PE_HISTORY_QUARTERS = 12


def risk_free_rate(client) -> float:
    r = safe_execute(
        client.table("macro_series").select("value").eq("metric", "govbond_10y")
        .order("date", desc=True).limit(1), label="risk free").data
    return (float(r[0]["value"]) / 100) if r and r[0].get("value") else DEFAULT_RISK_FREE


def latest_prices(client, symbols: list[str], as_of: str) -> dict[str, float]:
    """Close on or before `as_of` for each symbol — the price the score is marked to."""
    out = {}
    for sym in symbols:
        r = safe_execute(
            client.table("ta_ohlcv").select("close,date").eq("symbol", sym)
            .lte("date", as_of).order("date", desc=True).limit(1),
            label=f"price {sym}").data
        if r and r[0].get("close"):
            out[sym] = float(r[0]["close"])
    return out


def core_history(statements: dict, quarter: str) -> list[dict]:
    """Core_NPAT, core ROE and non-core, for each of the trailing TTM windows.

    One pass, shared by everything that needs the past: C14's dispersion, the
    C20 shadows' non-core normalization, and the core P/E percentile.
    """
    out = []
    for back in range(0, CORE_PE_HISTORY_QUARTERS + 1):
        qs, oq, cq = sec.ttm_window(quarter)
        qs = _shift_quarters(qs, back)
        oq, cq = _shift_quarters([oq, cq], back)
        bal_q = statements.get("balance", {}).get(cq)
        if not bal_q:
            continue
        past = sec.compute_core(statements, qs, oq, cq)
        cn, rep = past.val("core_npat_ttm"), past.val("reported_npat_ttm")
        eq = past.val("avg_equity")
        out.append({
            "quarter": cq,
            "core_npat": cn,
            "reported_npat": rep,
            "noncore": (rep - cn) if (cn is not None and rep is not None) else None,
            "core_roe": (cn / eq) if (cn is not None and eq) else None,
            "equity": bal_q.get(sec.BS_EQUITY),
            "shares": bal_q.get(sec.BS_SHARES),
        })
    return out


def valuation_inputs(statements: dict, core, quarter: str, price: float | None,
                     coe: float, history: list[dict]) -> dict:
    """Core P/E against its own history, and P/B against a ROE-justified P/B.

    Both deliberately use CORE earnings rather than reported: a broker whose
    prop desk had a good quarter looks cheap on headline P/E precisely when its
    recurring business has not changed.
    """
    if price is None:
        return {"core_pe": None, "p_core_pe": None, "pb_ratio": None, "c20_shadow": None}
    _, _, close_q = sec.ttm_window(quarter)
    bal = statements.get("balance", {}).get(close_q, {})
    shares = bal.get(sec.BS_SHARES) or 0
    equity = bal.get(sec.BS_EQUITY) or 0
    if not shares:
        return {"core_pe": None, "p_core_pe": None, "pb_ratio": None, "c20_shadow": None}
    market_cap = price * shares

    core_npat = core.val("core_npat_ttm")
    core_pe = (market_cap / core_npat) if (core_npat and core_npat > 0) else None

    # Where today's core P/E sits in the symbol's own trailing range. Each past
    # point is a full Core_NPAT recomputation, so the history is genuinely
    # comparable rather than a reported-earnings series wearing a core label.
    #
    # APPROXIMATION, DELIBERATE AND FLAGGED. The market cap is held at TODAY's
    # while the earnings vary, so this measures where current core earnings sit
    # in their own range — not a true P/E percentile. Using historical prices
    # instead would walk straight into the documented trap: `ta_ohlcv` is
    # TOTAL-RETURN back-adjusted while share counts are as-reported, and pairing
    # them misprices historical P/E by -37% to +26% (the same fault the Analysis
    # charts avoid by reading provider ratios for history). There is no provider
    # ratio for a CORE P/E, so neither option is clean. This one at least has a
    # known, single-signed bias. C19 is PROVISIONAL until the backtest.
    hist = history or []
    pe_hist = [market_cap / h["core_npat"] for h in hist[1:]
               if h["core_npat"] and h["core_npat"] > 0]
    p_core_pe = None
    if core_pe is not None and len(pe_hist) >= 6:
        p_core_pe = sum(1 for h in pe_hist if h < core_pe) / len(pe_hist)

    # CALIBRATION WARNING, measured on the live sector 2026-09-04: with g = 0,
    # justified P/B = Core_ROE / CoE gives 0.24-0.90 against actual P/B of
    # 0.78-2.30, so the ratio lands above 1.25 for ALL 30 brokers and every one
    # scores 0 of 12. A criterion that cannot separate the universe is not
    # measuring it. Two things are suspect and the backtest must settle both:
    # zero growth is a strong assumption for a cyclical sector, and a CORE-only
    # ROE is being compared with a whole-firm cost of equity while the market
    # prices the prop desk too. Left as specified rather than quietly retuned —
    # the rubric marks C20 PROVISIONAL and says its formula must be backtested
    # before production lock.
    current_pb = (market_cap / equity) if equity else None
    # The V8 ratio is still computed and stored, but ONLY as a diagnostic —
    # C20 no longer scores it. Keeping it makes the V8 and V9 rows comparable
    # when the backtest asks what changed.
    pb_ratio = None
    if current_pb and core_npat and equity and coe > 0:
        justified_core_only = (core_npat / equity) / coe
        if justified_core_only > 0:
            pb_ratio = current_pb / justified_core_only

    # --- C20 shadows. Raw values, never a score.
    noncore = [h["noncore"] for h in hist if h["noncore"] is not None]
    # Held at today's price, same limitation as the core P/E history: a
    # back-adjusted historical price against an as-reported share count is the
    # documented -37%/+26% trap.
    pb_hist = [(price * h["shares"]) / h["equity"] for h in hist
               if h.get("equity") and h.get("shares")]

    noncore_norm = sec.normalize_noncore(noncore)
    normalized_total_roe = None
    if equity and core_npat is not None and noncore_norm["median"] is not None:
        normalized_total_roe = (core_npat + noncore_norm["median"]) / equity

    shadow = {
        "a_absolute": sec.c20_shadow_a(current_pb, normalized_total_roe, coe),
        "b_relative": sec.c20_shadow_b(current_pb, pb_hist),
        "noncore_normalized": noncore_norm,
        "v8_core_only_pb_ratio": pb_ratio,
        "note": "shadow only — C20 is not scored in this model version",
    }
    return {"core_pe": core_pe, "p_core_pe": p_core_pe, "pb_ratio": pb_ratio,
            "c20_shadow": shadow}


def _shift_quarters(quarters: list[str], back: int) -> list[str]:
    out = []
    for q in quarters:
        y, n = int(q[:4]), int(q[-1])
        n -= back
        while n <= 0:
            n += 4
            y -= 1
        out.append(f"{y}-Q{n}")
    return out


def collect(client, symbols: list[str], quarter: str, prices: dict, coe: float) -> dict:
    """Pass 1 — canonical core plus the raw metrics the cross-sectional
    criteria will rank. No scoring happens here, because four criteria cannot be
    scored until every peer has been measured."""
    qs, open_q, close_q = sec.ttm_window(quarter)
    pqs, popen, pclose = sec.ttm_window(quarter, back=1)
    out = {}
    for sym in symbols:
        st = sec.load_statements(client, sym)
        if not st.get("income"):
            continue
        core = sec.compute_core(st, qs, open_q, close_q)
        prior = sec.compute_core(st, pqs, popen, pclose)

        avg_margin = core.val("avg_margin")
        avg_ea = core.val("avg_earning_assets")
        equity = core.val("avg_equity")
        efc = core.fields["eligible_funding_cost"].value
        bal = st.get("balance", {})
        debt = sec._sum(bal.get(close_q, {}), sec.BS_DEBT)
        trading_book = sec._sum(bal.get(close_q, {}),
                                ["BS_FVTPL_FINANCIAL_ASSETS",
                                 "BS_AVAILABLE_FOR_SALE_FINANCIAL_ASSETS_AFS"])

        # Core history, computed ONCE per symbol and reused by C14, the C20
        # shadows and the core P/E percentile. It is 12 full Core_NPAT
        # recomputations, so doing it three times over would triple the cost of
        # the whole pass for identical numbers.
        history = core_history(st, quarter)
        core_roes = [h["core_roe"] for h in history if h["core_roe"] is not None]

        margin_income = sec.ttm(st, "income", sec.MARGIN_INCOME, qs)
        cof = (efc / avg_ea) if (efc and avg_ea) else None
        ctx = {
            "core_npat_prior": prior.val("core_npat_ttm"),
            "core_history_n": len(st.get("income", {})),
            # Net spread: what the margin book yields, less what funding costs
            # across all earning assets. Both sides on the same denominator.
            "spread": ((margin_income / avg_margin) - cof)
                      if (avg_margin and cof is not None) else None,
            "cir": (abs(sec.ttm(st, "income", sec.MANAGEMENT_OPEX, qs)) /
                    (core.val("core_pbt") + abs(sec.ttm(st, "income", sec.MANAGEMENT_OPEX, qs))))
                   if core.val("core_pbt") else None,
            "cof": cof,
            "leverage": (debt / equity) if (equity and debt is not None) else None,
            "prop_risk": (trading_book / equity) if equity else None,
            "margin_growth": _margin_growth(bal, quarter),
            # C13: what the broker charged against its own earning assets.
            "asset_risk": (abs(sec.ttm(st, "income", sec.PROVISION_EXPENSE, qs)) / avg_ea)
                          if avg_ea else None,
            # C14: dispersion of core ROE, penalised for core-loss quarters.
            "stability": sec.core_roe_volatility(core_roes),
            "core_history_n": len(core_roes),
        }
        ctx.update(valuation_inputs(st, core, quarter, prices.get(sym), coe, history))
        ctx["has_market_cap"] = prices.get(sym) is not None and bool(
            bal.get(close_q, {}).get(sec.BS_SHARES))
        out[sym] = {"core": core, "ctx": ctx, "statements": st, "history": history}
    return out


def _margin_growth(balance: dict, quarter: str) -> float | None:
    """C7: 70% year-on-year + 30% quarter-on-quarter growth of the margin book."""
    _, _, close_q = sec.ttm_window(quarter)
    _, _, yoy_q = sec.ttm_window(quarter, back=1)
    y, q = int(quarter[:4]), int(quarter[-1])
    prev_q = f"{y}-Q{q-1}" if q > 1 else f"{y-1}-Q4"
    now = sec._sum(balance.get(close_q, {}), sec.BS_MARGIN)
    ly = sec._sum(balance.get(yoy_q, {}), sec.BS_MARGIN)
    lq = sec._sum(balance.get(prev_q, {}), sec.BS_MARGIN)
    if not now or not ly or not lq:
        return None
    return 0.7 * (now / ly - 1) + 0.3 * (now / lq - 1)


def add_percentiles(collected: dict) -> None:
    """Pass 2a — rank each cross-sectional metric across the peer group.

    Direction matters and is not uniform: a HIGH spread is good, a HIGH cost of
    funds is bad. Each is ranked so that percentile 0 always means best-in-class,
    which is what the band tables assume.
    """
    metrics = {"spread": False, "cir": True, "cof": True, "leverage": True,
               "prop_risk": True, "stability": True, "asset_risk": True}
    for name, ascending in metrics.items():
        ranks = rank_pct({s: d["ctx"].get(name) for s, d in collected.items()},
                         ascending=ascending)
        for s, d in collected.items():
            d["ctx"][f"p_{name}"] = ranks.get(s)


def score_all(collected: dict, market: dict, fci: dict) -> dict:
    """Pass 2b — score every broker against the same formulas."""
    cycle = sec.score_cycle(market, fci)          # identical for every symbol
    out = {}
    for sym, d in collected.items():
        criteria = {}
        criteria.update(sec.score_quality(d["core"], d["ctx"]))
        criteria.update(cycle)
        criteria.update(sec.score_valuation(d["core"], d["ctx"]))
        totals = sec.assemble(criteria)
        out[sym] = {"criteria": criteria, "totals": totals, "core": d["core"],
                    "shadow": d["ctx"].get("c20_shadow")}
    return out


def build_row(symbol: str, scored: dict, as_of: str, quarter: str,
              market: dict, fci: dict, score_status: str) -> dict:
    """One fa_securities_scores row, with the audit trail the spec requires."""
    criteria, totals, core = scored["criteria"], scored["totals"], scored["core"]
    row = {
        "symbol": symbol,
        "as_of_date": as_of,
        "model_version": sec.MODEL_VERSION,
        "quality_period": quarter,
        # Recorded on BOTH paths, not just the backfill: it is what proves a
        # score did not read a filing published after its own date, and a live
        # row without it cannot be replayed alongside a backfilled one.
        "quality_effective_date": effective_date_of(quarter),
        "earned_score": totals["earned_score"],
        "available_max": totals["available_max"],
        "coverage": totals["coverage"],
        "normalized_fa_score": totals["normalized_fa_score"],
        "quality_score": totals["quality_score"],
        "quality_available_max": totals["quality_available_max"],
        "cycle_score": totals["cycle_score"],
        "cycle_available_max": totals["cycle_available_max"],
        "valuation_score": totals["valuation_score"],
        "valuation_available_max": totals["valuation_available_max"],
        "data_group": totals["data_group"],
        "provisional_score": totals["provisional_score"],
        "final_fa_score": totals["final_fa_score"],
        "criteria": totals["criteria"],
        "fa_status": totals["fa_status"],
        "score_status": score_status,
        "fci_as_of_date": fci.get("as_of"),
        "breadth_convention": market.get("breadth_convention") or BREADTH_CONVENTION,
        "breadth_denominator": market.get("breadth_denominator"),
        "field_metadata": {
            **{k: c.as_meta() for k, c in core.fields.items()},
            # Shadow candidates ride in the audit blob rather than in columns:
            # they are evidence for a future lock decision, not something any
            # query should be able to sort or rank on today.
            **({"c20_shadow": shadow} if (shadow := scored.get("shadow")) else {}),
        },
        "dependency_flags": totals["dependency_flags"],
        "data_cutoff_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }
    if fci.get("as_of") and fci["as_of"] != as_of:
        row["input_lag_days"] = (dt.date.fromisoformat(as_of)
                                 - dt.date.fromisoformat(fci["as_of"])).days
    for key in sec.CRITERION_POINTS:
        c = criteria.get(key)
        row[f"{key}_score"] = c.points if c else None
    return row


# Circular 96/2020/TT-BTC: a quarterly filing is due 20 days after period end.
# That date, not the period end, is when the numbers become knowable — scoring
# 2026-07-10 against 2026-Q2 would be reading a filing that did not exist yet,
# and a backtest built on that measures nothing but hindsight.
FILING_LAG_DAYS = 20


def effective_quarter(as_of: str) -> str:
    """The newest quarter whose filing deadline has passed by `as_of`."""
    d = dt.date.fromisoformat(as_of)
    y = d.year
    ends = [(dt.date(y - 1, 12, 31), f"{y-1}-Q4"), (dt.date(y, 3, 31), f"{y}-Q1"),
            (dt.date(y, 6, 30), f"{y}-Q2"), (dt.date(y, 9, 30), f"{y}-Q3"),
            (dt.date(y, 12, 31), f"{y}-Q4")]
    usable = [q for end, q in ends if end + dt.timedelta(days=FILING_LAG_DAYS) <= d]
    return usable[-1] if usable else f"{y-1}-Q3"


def effective_date_of(quarter: str) -> str:
    y, q = int(quarter[:4]), int(quarter[-1])
    end = {1: dt.date(y, 3, 31), 2: dt.date(y, 6, 30),
           3: dt.date(y, 9, 30), 4: dt.date(y, 12, 31)}[q]
    return (end + dt.timedelta(days=FILING_LAG_DAYS)).isoformat()


def price_history(client, symbols: list[str], since: str) -> dict:
    """{symbol: [(date, close)]} ascending, for marking each session to its price."""
    out = {}
    for sym in symbols:
        rows = paged_select(
            lambda o, l, s=sym: client.table("ta_ohlcv").select("date,close")
            .eq("symbol", s).gte("date", since).order("date").range(o, o + l - 1),
            label=f"prices {sym}")
        out[sym] = [(r["date"], float(r["close"])) for r in rows if r.get("close")]
    return out


def price_asof(series: list[tuple[str, float]], as_of: str) -> float | None:
    """Last close on or before `as_of`. Never a later one — that is the whole point."""
    prev = None
    for d, c in series:
        if d > as_of:
            break
        prev = c
    return prev


def load_fci_series(client) -> list[tuple[str, float]]:
    rows = paged_select(
        lambda o, l: client.table("macro_series").select("date,value")
        .eq("metric", FCI_METRIC).order("date").range(o, o + l - 1),
        label="fci history")
    return [(r["date"], float(r["value"])) for r in rows if r.get("value") is not None]


def fci_context_from(series: list[tuple[str, float]], as_of: str) -> dict:
    """Same computation as `fci_context`, from a series loaded once.

    The live path can afford a query; a backfill cannot — pulling 5,600 FCI rows
    per session would be over a thousand paged requests for one run.
    """
    cut = [(d, v) for d, v in series if d <= as_of]
    if not cut or cut[-1][0] != as_of:
        return {"as_of": cut[-1][0] if cut else None, "value": None}
    return _fci_state([v for _, v in cut], as_of)


def run_backfill(client, args, st) -> int:
    """Score every session that already has market series, point-in-time.

    Cores are computed ONCE PER QUARTER rather than once per day: the Quality
    block only changes when a filing lands, so recomputing it for each of ~250
    sessions would repeat identical work ~60 times per quarter.
    """
    dates = [r["date"] for r in paged_select(
        lambda o, l: client.table("macro_series").select("date")
        .eq("metric", METRIC_BREADTH).gte("date", args.since or "2000-01-01")
        .order("date").range(o, o + l - 1), label="sessions")]
    if not dates:
        st.fail("Backfill", "no market series stored — run the market-series backfill first")
        return 0

    symbols = args.symbols or broker_universe(client)
    coe = risk_free_rate(client) + EQUITY_RISK_PREMIUM
    prices = price_history(client, symbols, dates[0])
    fci_series = load_fci_series(client)
    market_rows = paged_select(
        lambda o, l: client.table("macro_series")
        .select("metric,date,value,meta")
        .in_("metric", [METRIC_ADTV_MOMENTUM, METRIC_BREADTH,
                        METRIC_BREADTH_CHG_5D, METRIC_BREADTH_CHG_10D])
        .gte("date", dates[0]).order("date").range(o, o + l - 1),
        label="market series history")
    market_by_date: dict[str, dict] = {}
    for r in market_rows:
        market_by_date.setdefault(r["date"], {})[r["metric"]] = r
    print(f"Backfilling {len(dates)} sessions ({dates[0]} .. {dates[-1]}) "
          f"over {len(symbols)} brokers; cost of equity {coe:.1%}")

    by_quarter: dict[str, list[str]] = {}
    for d in dates:
        by_quarter.setdefault(effective_quarter(d), []).append(d)

    # Written per quarter rather than once at the end: a full backfill is
    # thousands of rows over several minutes, and accumulating them all means a
    # failure in the last quarter throws away the first three.
    total = 0
    for quarter, qdates in sorted(by_quarter.items()):
        all_rows: list[dict] = []
        print(f"  {quarter} (effective {effective_date_of(quarter)}): "
              f"{len(qdates)} sessions {qdates[0]} .. {qdates[-1]}")
        cores = collect(client, symbols, quarter, {}, coe)   # prices added per date
        if not cores:
            continue
        for as_of in qdates:
            market = _market_from(market_by_date.get(as_of, {}))
            fci = fci_context_from(fci_series, as_of)
            status = "OFFICIAL" if fci.get("as_of") == as_of else "PRELIMINARY_FCI_T_MINUS_1"
            for sym, d in cores.items():
                # `history` is REQUIRED here, not optional. Omitting it made the
                # parameter fall back to None, which emptied the core-P/E series
                # and took C19 to N/A for the entire universe — while the daily
                # path, which passes it, scored the same brokers 8/8. The
                # backfill ran last, so it overwrote the good rows.
                d["ctx"].update(valuation_inputs(
                    d["statements"], d["core"], quarter,
                    price_asof(prices.get(sym, []), as_of), coe, d["history"]))
            add_percentiles(cores)
            scored = score_all(cores, market, fci)
            for sym, sc in scored.items():
                row = build_row(sym, sc, as_of, quarter, market, fci, status)
                all_rows.append(row)

        for j in range(0, len(all_rows), 200):
            safe_execute(
                client.table("fa_securities_scores")
                .upsert(all_rows[j:j + 200], on_conflict="symbol,as_of_date,model_version"),
                label=f"backfill upsert {quarter} [{j // 200}]")
        total += len(all_rows)
        print(f"    wrote {len(all_rows):,} rows ({total:,} so far)")

    print(f"Wrote {total:,} rows across {len(dates)} sessions.")
    st.require("Backfilled sessions", len(dates), minimum=1, unit="sessions")
    return total


def main():
    ap = argparse.ArgumentParser(description="Daily securities (CTCK) FA score")
    ap.add_argument("--as-of", help="trading date to score (default: latest market series)")
    ap.add_argument("--dry-run", action="store_true", help="compute and report, write nothing")
    ap.add_argument("--allow-preliminary", action="store_true",
                    help="score with a stale FCI, marked PRELIMINARY and never ranked")
    ap.add_argument("--symbols", nargs="*", help="limit to these tickers")
    ap.add_argument("--backfill", action="store_true",
                    help="score every session that has market series, point-in-time")
    ap.add_argument("--since", help="earliest session for --backfill")
    args = ap.parse_args()

    client = get_supabase_client()
    st = RunStatus("FA securities score")

    if args.backfill:
        run_backfill(client, args, st)
        write_job_summary(st)
        sys.exit(1 if st.failures else 0)

    as_of = args.as_of
    if not as_of:
        r = safe_execute(
            client.table("macro_series").select("date").eq("metric", METRIC_BREADTH)
            .order("date", desc=True).limit(1), label="latest breadth").data
        if not r:
            st.fail("Market series", "no breadth stored — run update_ta_daily.py first")
            write_job_summary(st)
            sys.exit(1)
        as_of = r[0]["date"]

    quarter = latest_quarter(client)
    symbols = args.symbols or broker_universe(client)
    print(f"=== Securities FA score {as_of} ({sec.MODEL_VERSION}) ===")
    print(f"Universe: {len(symbols)} brokers; quality quarter {quarter}")

    market = market_context(client, as_of)
    fci = fci_context(client, as_of)

    # THE GATE THAT MUST NOT BE A ROW-EXISTS CHECK. The FCI job runs hours after
    # this one's inputs are ready, so "a row is present" is routinely true for
    # YESTERDAY. Only a matching date makes a score official.
    score_status = "OFFICIAL"
    if fci.get("as_of") != as_of or fci.get("value") is None:
        if not args.allow_preliminary:
            st.fail("FCI freshness",
                    f"no FCI for {as_of} (latest stored {fci.get('as_of')}). "
                    f"macro-daily writes it at 13:30 UTC; this job must run after. "
                    f"Nothing written — use --allow-preliminary for a preview.")
            write_job_summary(st)
            sys.exit(1)
        score_status = "PRELIMINARY_FCI_T_MINUS_1"
        st.warn("FCI freshness", f"scoring {as_of} against FCI {fci.get('as_of')} — "
                                 f"PRELIMINARY, will not be ranked or published")
    if not market.get("breadth_valid"):
        st.warn("Market series", f"no breadth for {as_of} — C16/C17 go N/A, "
                                 f"costing 13 points of coverage")

    prices = latest_prices(client, symbols, as_of)
    coe = risk_free_rate(client) + EQUITY_RISK_PREMIUM
    print(f"Cost of equity {coe:.1%} (10y govbond + {EQUITY_RISK_PREMIUM:.0%} premium); "
          f"prices for {len(prices)}/{len(symbols)} brokers")
    collected = collect(client, symbols, quarter, prices, coe)
    st.require("Collected brokers", len(collected), minimum=1, unit="symbols",
               detail=f"of {len(symbols)} in the ICB {SECURITIES_ICB_L4} universe")
    add_percentiles(collected)
    scored = score_all(collected, market, fci)

    rows = [build_row(s, d, as_of, quarter, market, fci, score_status)
            for s, d in sorted(scored.items())]

    by_status = {}
    for r in rows:
        by_status[r["fa_status"]] = by_status.get(r["fa_status"], 0) + 1
    pub = by_status.get("PUBLISHABLE", 0)
    print(f"\nScored {len(rows)} brokers: " +
          ", ".join(f"{k} {v}" for k, v in sorted(by_status.items())))
    top = sorted((r for r in rows if r["fa_status"] == "PUBLISHABLE"),
                 key=lambda r: -(r["normalized_fa_score"] or 0))[:8]
    for r in top:
        print(f"   {r['symbol']:5s} {r['normalized_fa_score']:5.1f}  "
              f"(coverage {r['coverage']*100:.0f}%, Q {r['quality_score']:.0f}/"
              f"C {r['cycle_score']:.0f}/V {r['valuation_score']:.0f})")

    if args.dry_run:
        print("\n(dry-run) nothing written.")
    else:
        try:
            for j in range(0, len(rows), 200):
                safe_execute(
                    client.table("fa_securities_scores")
                    .upsert(rows[j:j + 200], on_conflict="symbol,as_of_date,model_version"),
                    label=f"fa_securities_scores upsert [{j // 200}]",
                )
            print(f"\nWrote {len(rows)} rows to fa_securities_scores.")
        except Exception as e:  # noqa: BLE001
            # Migrations are applied by hand in the SQL editor, so "table not
            # found" is a deployment step outstanding, not a bug. Say which one.
            msg = str(e)
            # Migrations are applied by hand, so a missing table OR a missing
            # column is an outstanding deployment step, not a bug. Name the file.
            # Column first: PostgREST reports a missing COLUMN as "Could not find
            # the 'x' column ... in the schema cache", which also matches the
            # table test — checked in the wrong order it blames the wrong file.
            if "column" in msg and "schema cache" in msg or "PGRST204" in msg:
                st.fail("Write scores",
                        f"a column this version writes is missing — apply "
                        f"supabase/061_fa_securities_v10.sql in the Supabase SQL editor "
                        f"first. The scores above were computed correctly and were not "
                        f"written. ({msg[:120]})")
            elif "PGRST205" in msg or "schema cache" in msg:
                st.fail("Write scores",
                        "fa_securities_scores does not exist — apply "
                        "supabase/059_fa_securities.sql in the Supabase SQL editor first. "
                        "The scores above were computed correctly and were not written.")
            else:
                raise

    # Publishable count is the gate that matters: rows can be written while
    # every one of them is too thin to show anyone.
    st.expect("Publishable brokers", pub, minimum=1, unit="brokers",
              detail=f"of {len(rows)} scored at >= {sec.PUBLISH_THRESHOLD:.0%} coverage")
    write_job_summary(st)
    sys.exit(1 if st.failures else 0)


if __name__ == "__main__":
    main()
