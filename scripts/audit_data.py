#!/usr/bin/env python3
"""
audit_data.py — one pass over every dataset the site serves, newest-first.

Answers the only question worth asking after "something looks wrong": WHICH
LAYER stopped, and is it broken or merely waiting on an upstream publisher.

Why a whole-chain audit rather than a per-table check
----------------------------------------------------
The data flows one way, and a break propagates silently downstream while every
downstream table keeps its previous values and looks populated:

    ta_ohlcv ──> ta_signals ──> ta_universe (rs_*, trend_*, ta_score)
                                     └─────> fa_scores.final_score
    macro_series raw ─────────────────────> macro_fci_*   (grid = vnindex dates)

Three real incidents all presented as "the DASHBOARD is wrong" and were really
one table upstream:

  * TA Scanner showed nothing        -> a phantom ta_runs date, not signals.
  * FCI froze at 2026-08-14          -> vnindex missing; the FCI grid IS the
                                        VN-Index date index.
  * Signal Pro's RS Line went blank  -> the benchmark fetch failed and the
                                        writer nulled the column for everyone.

So this reports the chain in dependency order and names the FIRST break. Fixing
that one usually fixes everything under it; fixing a downstream symptom never
holds.

Usage:
  python3 audit_data.py                # audit against the newest trading day
  python3 audit_data.py --json         # machine-readable, for a workflow step
  python3 audit_data.py --asof DATE    # audit as if DATE were today

Exit code: 0 = healthy or only known-lagging series; 1 = at least one CRITICAL
gap. Safe to run any time; it only reads.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client, today_vn  # noqa: E402

# Series whose publisher is genuinely slower than daily. Being behind is NORMAL
# here and must not read as a fault — the noise from flagging these is exactly
# what makes an audit get ignored. Value = how many days behind is still fine.
KNOWN_LAG_DAYS = {
    "interbank_overnight": 10,   # Vietstock/SBV publish in bursts
    "govbond_10y": 5,            # ADB ABO lands T-1..T-3
    "sofr": 5,                   # NY Fed, US calendar
    "dxy": 5,                    # US calendar
    "fed_target": 400,           # only moves on FOMC days
    "cpi_mom_index": 70,         # monthly
    "bank_lending_avg_min": 120, # SBV monthly report
    "bank_lending_avg_max": 120,
    "margin_debt_total": 130,    # quarterly, ~3 weeks after quarter end
    # World Bank annual indicators publish 1-2 years in arrears, so ~2.6 years
    # behind is their NORMAL state, not a gap. Tuned to 1200d after the audit
    # flagged them on a healthy database — a warning that is always on trains
    # people to ignore the whole report.
    "wb_deposit_rate": 1200,
    "wb_lending_rate": 1200,
    "wb_rate_spread": 1200,
    "bank_deposit_12m_avg": 5,
}

# Everything else in macro_series should track the trading calendar.
MACRO_DAILY = [
    "vnindex", "fx_central_rate", "fx_vcb_sell", "omo_net_injection",
    "foreign_net_value", "market_pe", "macro_fci_full", "macro_fci_core",
]

OK, WARN, FAIL = "ok", "warn", "fail"


def _fmt(status: str) -> str:
    return {OK: "  ok  ", WARN: " WARN ", FAIL: " FAIL "}[status]


class Audit:
    def __init__(self, client, asof: date):
        self.c = client
        self.asof = asof
        self.rows: list[dict] = []

    def add(self, layer: str, name: str, latest: str | None, status: str, detail: str):
        self.rows.append({"layer": layer, "name": name, "latest": latest,
                          "status": status, "detail": detail})

    # -- helpers ------------------------------------------------------------

    def _count(self, table: str, **eq) -> int:
        q = self.c.table(table).select("*", count="exact")
        for k, v in eq.items():
            q = q.eq(k, v)
        return q.limit(1).execute().count or 0

    def _latest(self, table: str, col: str, **eq) -> str | None:
        q = self.c.table(table).select(col)
        for k, v in eq.items():
            q = q.eq(k, v)
        r = q.not_.is_(col, "null").order(col, desc=True).limit(1).execute().data
        return r[0][col] if r else None

    def _lag(self, latest: str | None) -> int | None:
        if not latest:
            return None
        return (self.asof - date.fromisoformat(latest)).days

    # -- the chain, in dependency order -------------------------------------

    def sessions(self) -> list[str]:
        """The recent trading calendar, taken from the bars themselves.

        Derived rather than assumed: a hard-coded Mon-Fri calendar would call
        every VN public holiday an outage, and this audit is only useful if it
        stays quiet when nothing is wrong.
        """
        since = (self.asof - timedelta(days=20)).isoformat()
        rows, frm = [], 0
        while True:
            r = (self.c.table("ta_ohlcv").select("date")
                 .gte("date", since).order("date", desc=True)
                 .range(frm, frm + 999).execute().data)
            rows += r
            if len(r) < 1000:
                break
            frm += 1000
        return sorted({x["date"] for x in rows}, reverse=True)

    def layer_ohlcv(self, sessions: list[str]) -> None:
        if not sessions:
            self.add("1 bars", "ta_ohlcv", None, FAIL, "no bars in the last 20 days at all")
            return
        latest = sessions[0]
        n = self._count("ta_ohlcv", date=latest)
        # A normal session prices ~60-68% of tracked members. A day far below
        # its neighbours is a partial collection, which is the shape that
        # produced 29 bars on 2026-08-17 and still reported success.
        prev = [self._count("ta_ohlcv", date=d) for d in sessions[1:4]]
        typical = max(prev) if prev else n
        if n < typical * 0.5:
            self.add("1 bars", "ta_ohlcv", latest, FAIL,
                     f"{n:,} bars vs ~{typical:,} on recent sessions — partial collection")
        else:
            self.add("1 bars", "ta_ohlcv", latest, OK, f"{n:,} bars")

        # Holes BEHIND the newest session are invisible on every dashboard yet
        # corrupt every trailing calculation that walks the history.
        thin = [d for d in sessions[1:8] if self._count("ta_ohlcv", date=d) < typical * 0.5]
        if thin:
            self.add("1 bars", "ta_ohlcv history", latest, FAIL,
                     f"thin session(s) behind the front: {', '.join(thin)}")

    def layer_signals(self, sessions: list[str]) -> None:
        latest_sig = self._latest("ta_signals", "date")
        lag = self._lag(latest_sig)
        status = OK if lag is not None and lag <= 4 else FAIL
        self.add("2 signals", "ta_signals", latest_sig, status,
                 f"{self._count('ta_signals', date=latest_sig):,} rows" if latest_sig else "empty")

        # The TA Scanner builds its date dropdown from ta_runs, so a successful
        # run stamped with a date that carries NO signals empties the page for
        # every indicator. See finish_run in compute_ta_signals.py.
        runs = (self.c.table("ta_runs").select("id,trading_date")
                .eq("status", "success").order("trading_date", desc=True)
                .limit(10).execute().data)
        phantom = []
        for r in {x["trading_date"]: x for x in runs}.values():
            if self._count("ta_signals", date=r["trading_date"]) == 0:
                phantom.append(f"run {r['id']} -> {r['trading_date']}")
        if phantom:
            self.add("2 signals", "ta_runs phantom dates", None, FAIL,
                     f"success runs whose date has no signals: {'; '.join(phantom)} "
                     f"— the TA Scanner will show nothing on that date")
        else:
            self.add("2 signals", "ta_runs dates", runs[0]["trading_date"] if runs else None,
                     OK, "every successful run's date carries signals")

    def layer_universe(self) -> None:
        active = self._count("ta_universe", is_active=True)
        for col, label, critical in (
            ("rs_date", "rs_*", True),
            ("rs_line_date", "rs_line_*", True),
            ("trend_date", "trend_*", True),
        ):
            latest = self._latest("ta_universe", col)
            lag = self._lag(latest)
            status = OK if lag is not None and lag <= 4 else (FAIL if critical else WARN)
            filled = (self.c.table("ta_universe").select("symbol", count="exact")
                      .eq("is_active", True).not_.is_(col, "null").limit(1).execute().count or 0)
            pct = filled / active * 100 if active else 0
            # A column that is present but sparse is the RS-Line failure mode:
            # the writer nulled it for the whole universe and TA Score silently
            # scored the missing 20% component as 0.
            if status == OK and pct < 50:
                status = FAIL
            self.add("3 universe", label, latest, status,
                     f"{filled:,}/{active:,} active ({pct:.0f}%)")

        for col in ("ta_score", "trend_score"):
            filled = (self.c.table("ta_universe").select("symbol", count="exact")
                      .eq("is_active", True).not_.is_(col, "null").limit(1).execute().count or 0)
            pct = filled / active * 100 if active else 0
            self.add("3 universe", col, None, OK if pct >= 50 else FAIL,
                     f"{filled:,}/{active:,} active ({pct:.0f}%)")

    def layer_final(self) -> None:
        r = (self.c.table("fa_scores").select("as_of_period")
             .order("as_of_period", desc=True).limit(1).execute().data)
        period = r[0]["as_of_period"] if r else None
        # Scoped to the LATEST period. fa_scores keeps full quarterly history and
        # only the newest quarter is rewritten, so an unscoped count stays healthy
        # on the strength of frozen old quarters long after the current one breaks.
        scored = (self.c.table("fa_scores").select("symbol", count="exact")
                  .eq("as_of_period", period).not_.is_("final_score", "null")
                  .limit(1).execute().count or 0) if period else 0
        total = (self.c.table("fa_scores").select("symbol", count="exact")
                 .eq("as_of_period", period).limit(1).execute().count or 0) if period else 0
        self.add("4 scores", "fa_scores.final_score", period,
                 OK if scored > 0 else FAIL,
                 f"{scored:,}/{total:,} symbols scored in {period}")

    def layer_macro(self) -> None:
        rows, frm = [], 0
        while True:
            r = (self.c.table("macro_series").select("metric,date")
                 .order("metric").range(frm, frm + 999).execute().data)
            rows += r
            if len(r) < 1000:
                break
            frm += 1000
        latest_by = {}
        for x in rows:
            m, d = x["metric"], x["date"]
            if m not in latest_by or d > latest_by[m]:
                latest_by[m] = d

        for metric in sorted(latest_by):
            latest = latest_by[metric]
            lag = self._lag(latest)
            allowed = KNOWN_LAG_DAYS.get(metric)
            if allowed is not None:
                status = OK if lag <= allowed else WARN
                detail = f"{lag}d behind (publisher lag; tolerated up to {allowed}d)"
            elif metric in MACRO_DAILY or metric.startswith("macro_fci_"):
                status = OK if lag <= 4 else FAIL
                detail = f"{lag}d behind"
            else:
                status = OK if lag <= 10 else WARN
                detail = f"{lag}d behind"
            self.add("5 macro", metric, latest, status, detail)

        # The FCI deserves its own line because presence is not freshness: a run
        # can rewrite hundreds of FCI rows and still end days in the past, since
        # its date grid IS the VN-Index date index. Row count proves nothing.
        fci, vn = latest_by.get("macro_fci_full"), latest_by.get("vnindex")
        if fci and vn and fci < vn:
            self.add("5 macro", "FCI vs vnindex", fci, FAIL,
                     f"FCI stops at {fci} while vnindex reaches {vn} — recompute needed")
        elif fci and vn:
            self.add("5 macro", "FCI vs vnindex", fci, OK, f"FCI tracks vnindex ({vn})")

    def layer_aux(self) -> None:
        for table, col, label, allowed in (
            ("implied_risk", "date", "implied_risk", 5),
            ("symbol_catalysts", "as_of", "symbol_catalysts", 14),
        ):
            latest = self._latest(table, col)
            lag = self._lag(latest)
            status = OK if lag is not None and lag <= allowed else WARN
            self.add("6 aux", label, latest, status,
                     f"{lag}d behind (best-effort)" if lag is not None else "empty")

    # -- run ----------------------------------------------------------------

    def run(self) -> None:
        sessions = self.sessions()
        self.layer_ohlcv(sessions)
        self.layer_signals(sessions)
        self.layer_universe()
        self.layer_final()
        self.layer_macro()
        self.layer_aux()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--asof", help="audit as if this date were today (YYYY-MM-DD)")
    args = ap.parse_args()

    asof = date.fromisoformat(args.asof) if args.asof else today_vn()
    audit = Audit(get_supabase_client(), asof)
    audit.run()

    fails = [r for r in audit.rows if r["status"] == FAIL]
    warns = [r for r in audit.rows if r["status"] == WARN]

    if args.json:
        print(json.dumps({"asof": asof.isoformat(), "rows": audit.rows,
                          "failures": len(fails), "warnings": len(warns)}, indent=1))
        return 1 if fails else 0

    print(f"=== Data audit as of {asof} ===\n")
    layer = None
    for r in audit.rows:
        if r["layer"] != layer:
            layer = r["layer"]
            print(f"-- {layer}")
        print(f"[{_fmt(r['status'])}] {r['name']:26} {str(r['latest'] or '—'):12} {r['detail']}")

    print()
    if fails:
        # Dependency order is the point: the first failure is usually the cause
        # and the rest are its shadow. Fixing a downstream symptom never holds.
        print(f"{len(fails)} CRITICAL gap(s). Fix the FIRST one — the chain flows "
              f"one way and everything under it is likely a consequence:")
        for r in fails:
            print(f"  * [{r['layer']}] {r['name']}: {r['detail']}")
    if warns:
        print(f"{len(warns)} warning(s) (publisher lag / best-effort):")
        for r in warns:
            print(f"  - {r['name']}: {r['detail']}")
    if not fails and not warns:
        print("Every layer is current.")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
