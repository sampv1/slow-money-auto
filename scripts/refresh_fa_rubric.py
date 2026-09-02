#!/usr/bin/env python3
"""MODULE B — score whatever the download brought in, on the right rubric.

The FA pipeline is split in two, and this is the second half:

  A. `refresh_fa_vnstock.py`  — downloads EVERY statement for EVERY symbol into
     `fa_vnstock_statements`. Rubric-agnostic; it knows nothing about criteria.
  B. this script — finds the symbols whose downloaded data is ahead of their
     score, decides which rubric each one belongs to, derives that rubric's
     inputs FROM THE STORE, and grades them.

WHY THE SPLIT IS WORTH IT
  The previous importer fetched, derived and wrote in one pass, which forced a
  rubric decision into the download: it took `--skip-real-estate`, so property
  developers were simply not downloaded. Downloading is not where that decision
  belongs. Now everything is downloaded once and each rubric reads what it
  needs — and a future bank or securities rubric costs a REGISTRY entry plus a
  scorer, with no change to the download at all.

HOW "NEW DATA TODAY" IS DETECTED — no log, no timestamps
  The work-list is `newest DOWNLOADED period > newest SCORED period`, computed
  from the two tables themselves. That is self-healing in a way an import log is
  not: a run that dies halfway is simply picked up by the next one, a re-run is
  a no-op, and nothing has to remember what happened. It is also honest about
  `updated_at`, which an upsert rewrites whether or not any value changed — so
  "touched today" would have meant "re-fetched", not "new".

TWO GUARDS SURVIVE FROM THE OLD IMPORTER, unchanged:
  1. PERIOD BOUNDARY (`--min-period`, default 2026-Q3). 2026-Q2 and earlier are
     scored history and frozen.
  2. SOURCE PRECEDENCE. A row the FiinProX Excel importer wrote is never
     touched, which is what keeps that importer usable as the override.

Usage:
  python3 refresh_fa_rubric.py --dry-run          # always start here
  python3 refresh_fa_rubric.py
  python3 refresh_fa_rubric.py --symbols FPT VNM TCB --dry-run
  python3 refresh_fa_rubric.py --classify-only    # just report the split
"""

from __future__ import annotations

import argparse
import collections
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa import rubric as rb  # noqa: E402
from fa import vnstock_quarterly as vq  # noqa: E402
from fa import vnstock_store as vs  # noqa: E402
from ta.common import get_supabase_client, paged_select, safe_execute  # noqa: E402
from ta.run_status import RunStatus  # noqa: E402
from ta.universe import get_universe_symbols  # noqa: E402

CHUNK = 500


def period_index(p: str) -> int:
    y, q = p.split("-Q")
    return int(y) * 4 + int(q) - 1


def _newest(rows, key="as_of_period") -> dict[str, str]:
    out: dict[str, str] = {}
    for r in rows:
        s, p = r["symbol"], r.get(key)
        if not p:
            continue
        if s not in out or period_index(p) > period_index(out[s]):
            out[s] = p
    return out


def load_context(client) -> dict:
    """Everything the dispatch needs, in four paged reads."""
    industry = {r["symbol"]: r.get("industry_group") for r in paged_select(
        lambda o, l: client.table("fa_industry").select("symbol,industry_group")
        .order("symbol").range(o, o + l - 1), label="fa_industry")}
    profiles = {r["symbol"]: r for r in paged_select(
        lambda o, l: client.table("symbol_profile")
        .select("symbol,icb_l2,icb_l4,com_type_code")
        .order("symbol").range(o, o + l - 1), label="symbol_profile")}
    scored_mfg = _newest(paged_select(
        lambda o, l: client.table("fa_scores").select("symbol,as_of_period")
        .order("symbol").order("as_of_period").range(o, o + l - 1), label="fa_scores"))
    scored_re = _newest(paged_select(
        lambda o, l: client.table("fa_re_scores").select("symbol,as_of_period")
        .order("symbol").order("as_of_period").range(o, o + l - 1), label="fa_re_scores"))
    return {"industry": industry, "profiles": profiles,
            "scored": {rb.MANUFACTURING: scored_mfg, rb.REAL_ESTATE: scored_re}}


def build_worklist(members, downloaded, ctx, min_period) -> tuple[list[str], dict[str, int]]:
    """Symbols whose downloaded data is ahead of their score, and why the rest are not.

    A symbol is skipped for one of three reasons, counted separately because
    they mean different things: nothing downloaded for it at all (the download
    could not reach it), its newest download is still frozen (normal, off-
    season), or it is already scored on that period (the healthy steady state).
    """
    todo: list[str] = []
    tally = {"no_download": 0, "frozen": 0, "current": 0}
    for s in members:
        dl = downloaded.get(s)
        if not dl:
            tally["no_download"] += 1
            continue
        if period_index(dl) < period_index(min_period):
            tally["frozen"] += 1
            continue
        cls = rb.classify(s, ctx["industry"].get(s), ctx["profiles"].get(s))
        have = ctx["scored"].get(cls.scored_as, {}).get(s)
        if have and period_index(have) >= period_index(dl):
            tally["current"] += 1
            continue
        todo.append(s)
    return todo, tally


def existing_sources(client, symbols: list[str]) -> dict[tuple[str, str], str]:
    """{(symbol, period): source} — the precedence check reads this."""
    out: dict[tuple[str, str], str] = {}
    for i in range(0, len(symbols), 200):
        chunk = symbols[i:i + 200]
        for r in paged_select(
            lambda o, l, x=chunk: client.table("fa_quarterly")
            .select("symbol,period,source").in_("symbol", x)
            .order("symbol").order("period").range(o, o + l - 1),
            label="fa_quarterly sources",
        ):
            out[(r["symbol"], r["period"])] = r.get("source") or "fiinpro"
    return out


def writable_rows(symbol, derived, sources, min_period, status):
    """Rows this pass may write for one symbol, plus what it refused.

    Identical policy to the old importer — the two guards, the empty-row test,
    and the whole-symbol refusal of an unsupported chart of accounts. A filer
    using a different format derives revenue and EPS fine and loses only the
    margins, which would score as LOST POINTS rather than absent data.
    """
    tally = {"frozen": 0, "fiinpro": 0, "empty": 0, "format": 0}
    if status != "ok":
        tally["format"] = len(derived)
        return [], tally
    keep = []
    for period, row in derived.items():
        if period_index(period) < period_index(min_period):
            tally["frozen"] += 1
            continue
        if sources.get((symbol, period)) == "fiinpro":
            tally["fiinpro"] += 1
            continue
        if row.get("eps") is None and row.get("revenue") is None:
            tally["empty"] += 1
            continue
        keep.append({**{k: row.get(k) for k in
                        ("symbol", "period", "year", "quarter", *vq.FIELDS)},
                     "source": "vnstock"})
    return keep, tally


def main() -> int:
    ap = argparse.ArgumentParser(description="Rubric-aware FA scoring dispatch")
    ap.add_argument("--min-period", default="2026-Q3",
                    help="Frozen boundary: nothing at or before this is written (default 2026-Q3)")
    ap.add_argument("--symbols", nargs="+", help="Explicit symbols (default: the work-list)")
    ap.add_argument("--limit", type=int, help="Cap the work-list")
    ap.add_argument("--dry-run", action="store_true", help="Report, write nothing")
    ap.add_argument("--classify-only", action="store_true",
                    help="Print the rubric split and exit — no derivation, no writes")
    ap.add_argument("--no-score", action="store_true",
                    help="Write metrics but do not run the rubric scorers")
    args = ap.parse_args()

    client = get_supabase_client()
    st = RunStatus("FA rubric dispatch")
    print(f"FA rubric dispatch · frozen at/before {args.min_period}"
          f"{' · DRY RUN' if args.dry_run else ''}")

    members = get_universe_symbols(client)
    ctx = load_context(client)

    # --- classification, always reported ------------------------------
    classes = rb.classify_all(members, ctx["industry"], ctx["profiles"])
    by_rubric = collections.Counter(c.rubric for c in classes.values())
    by_evidence = collections.Counter((c.rubric, c.evidence) for c in classes.values())
    print(f"\n{len(members)} members classified:")
    for r, n in by_rubric.most_common():
        spec = rb.REGISTRY[r]
        note = "" if spec.implemented else f"  (no rubric yet → scored as {spec.fallback})"
        print(f"  {r:<15} {n:>5}{note}")
    print("  evidence: " + ", ".join(f"{r}<-{e}:{n}" for (r, e), n in sorted(by_evidence.items())))
    if args.classify_only:
        st.expect("classified", len(members), minimum=1, unit="symbols")
        return st.finish()

    downloaded = vs.newest_period(client)
    st.require("store coverage", len(downloaded), minimum=1, unit="symbols",
               detail="symbols with any quarterly statement in fa_vnstock_statements")

    if args.symbols:
        todo = [s.upper() for s in args.symbols]
        tally = {"no_download": 0, "frozen": 0, "current": 0}
    else:
        todo, tally = build_worklist(members, downloaded, ctx, args.min_period)
    if args.limit:
        todo = todo[:args.limit]

    print(f"\nwork-list: {len(todo)} symbol(s) whose download is ahead of their score")
    print(f"  skipped: {tally['current']} already current, {tally['frozen']} frozen "
          f"(<= {args.min_period}), {tally['no_download']} nothing downloaded")

    if not todo:
        # The healthy steady state, and the healthy off-season state, look the
        # same from here — both are legitimately "nothing to do", not a fault.
        print("::notice::Every symbol is scored on its newest downloaded period.")
        st.expect("work-list", 0, minimum=0, unit="symbols", detail="all current")
        return st.finish()

    # --- group by the rubric that will actually score them ------------
    groups: dict[str, list[str]] = collections.defaultdict(list)
    for s in todo:
        groups[classes[s].scored_as if s in classes else rb.MANUFACTURING].append(s)
    print("  by rubric: " + ", ".join(f"{r}={len(v)}" for r, v in sorted(groups.items())))

    written = 0
    refused = {"frozen": 0, "fiinpro": 0, "empty": 0, "format": 0}
    status_count: collections.Counter = collections.Counter()

    # --- MANUFACTURING: derive from the store, no provider call -------
    mfg = groups.get(rb.MANUFACTURING, [])
    if mfg:
        print(f"\nmanufacturing: deriving {len(mfg)} symbol(s) from fa_vnstock_statements")
        sources = {} if args.dry_run else existing_sources(client, mfg)
        pending: list[dict] = []
        for i, sym in enumerate(mfg, 1):
            derived, status, _missing = vs.manufacturing_rows(client, sym)
            status_count[status] += 1
            rows, t = writable_rows(sym, derived, sources, args.min_period, status)
            for k in refused:
                refused[k] += t[k]
            pending.extend(rows)
            if len(pending) >= CHUNK and not args.dry_run:
                written += _flush(client, pending)
            if i % 100 == 0:
                print(f"  ...{i}/{len(mfg)}")
        if pending and not args.dry_run:
            written += _flush(client, pending)
        elif pending:
            written = len(pending)
        print(f"  {'would write' if args.dry_run else 'wrote'} {written} fa_quarterly row(s)")
        print(f"  statuses: {dict(status_count)}")
        print(f"  refused: {refused['frozen']} frozen, {refused['fiinpro']} FiinProX-owned, "
              f"{refused['empty']} empty, {refused['format']} different chart of accounts")

    # --- REAL ESTATE: metrics still come from the Excel export --------
    re_syms = groups.get(rb.REAL_ESTATE, [])
    if re_syms:
        have = {r["symbol"] for r in paged_select(
            lambda o, l: client.table("fa_re_metrics").select("symbol")
            .in_("symbol", re_syms[:200]).order("symbol").range(o, o + l - 1),
            label="fa_re_metrics")} if re_syms else set()
        missing_re = [s for s in re_syms if s not in have]
        print(f"\nreal estate: {len(re_syms)} symbol(s) due")
        if missing_re:
            # Deriving these from the store is FEASIBLE — every one of the 21
            # metric keys the rubric reads maps to a stored id — but it has not
            # been verified against the Excel-sourced numbers the way the
            # manufacturing derivation was, and this rubric feeds Final Score.
            # Reporting the gap beats writing an unverified number into it.
            st.warn("real-estate metrics",
                    f"{len(missing_re)} symbol(s) have no fa_re_metrics row — run "
                    f"refresh_fa_re.py import. Store-derivation is not enabled yet.")

    # --- score, per rubric --------------------------------------------
    if args.no_score or args.dry_run:
        print("\nscoring skipped (--no-score / --dry-run)")
    else:
        _score(groups, st)

    st.expect("rows written", written, minimum=0, unit="rows",
              detail="0 is normal when nothing new was filed")
    return st.finish()


def _flush(client, pending: list[dict]) -> int:
    n = 0
    for i in range(0, len(pending), CHUNK):
        chunk = pending[i:i + CHUNK]
        safe_execute(client.table("fa_quarterly").upsert(chunk, on_conflict="symbol,period"),
                     label=f"fa_quarterly upsert[{i // CHUNK}]")
        n += len(chunk)
    pending.clear()
    return n


def _score(groups: dict[str, list[str]], st: RunStatus) -> None:
    """Run each rubric's own scorer over the symbols that rubric owns.

    Delegates to the EXISTING scripts rather than reimplementing either rubric:
    both already take `--symbols`, both are idempotent, and both carry their own
    tests. This module decides WHO is scored by WHAT; it does not decide how.
    """
    import argparse as _ap

    if groups.get(rb.MANUFACTURING):
        import refresh_fa
        with st.step("score manufacturing", critical=True):
            refresh_fa.cmd_score(_ap.Namespace(
                backfill=False, symbols=groups[rb.MANUFACTURING],
                inspect=None, dry_run=False))
    if groups.get(rb.REAL_ESTATE):
        import refresh_fa_re
        with st.step("score real estate", critical=True):
            refresh_fa_re.cmd_score(_ap.Namespace(
                rubric=refresh_fa_re.DEFAULT_RUBRIC, period=None,
                symbols=",".join(groups[rb.REAL_ESTATE]), dry_run=False))


if __name__ == "__main__":
    sys.exit(main())
