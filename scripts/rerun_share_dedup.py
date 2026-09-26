#!/usr/bin/env python3
"""
rerun_share_dedup.py — BA's §9 controlled rerun of the share-event dedup.

The provider serves some share-issue events TWICE under different event ids, and
because ratios on one ex-right date are ADDITIVE a repeat inflates the technical
factor. ABI's 20% stock dividend + 20% bonus on 2025-09-11 arrived four times and
read k = 1.80 against a filed 1.400. `fa/share_events._by_exdate` now deduplicates
on (ex-right date, title, ratio); this script applies that to the stored data
under the audit trail BA's §9 requires.

IT RECOMPUTES FROM THE STORED `fa_share_events` AND NEVER CALLS THE FEED. That is
the whole reason it exists rather than `refresh_share_events.py --symbols …`:
re-fetching would let new announcements arrive in the same pass, and the
before/after tables would then measure the feed's changes plus the dedup's. This
project has already produced two wrong impact measurements by moving two things at
once. Nothing here can change what was announced — only how the factor is summed.

BA's eight steps, in order:
  1  snapshot `fa_share_adjustments` and `fa_scores` before any write
  2  the duplicate-event list and the key used to collapse it
  3  factors before/after for every symbol, not only the five known movers
  4  EPS per quarter before/after
  5  C1, C2, total score and ΔFA before/after
  6  (the threshold comparison is re-run separately, by export_insurance_toan_nganh)
  7  stamp EPS_STD_IAS33_DEDUP_V2
  8  write only once the before/after tables reconcile

Usage:
  python3 rerun_share_dedup.py --dry-run --out ../data/exports/dedup_truoc_sau.xlsx
  python3 rerun_share_dedup.py           --out ../data/exports/dedup_truoc_sau.xlsx
"""

import argparse
import datetime as dt
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa.metrics import compute_metrics
from fa.scoring import compute_score
from fa import persist as fa_persist
from fa.share_events import Adjustment, ShareEvent, compute_adjustments, window_factor
from refresh_share_events import load_charter_capital, write_adjustments
from ta.common import get_supabase_client, paged_select, safe_execute

EPS_NORM_VERSION = "EPS_STD_IAS33_DEDUP_V2"

#: The dedup key, spelled out because §9 step 2 asks for it explicitly.
DEDUP_KEY = "(exright_date, title_en, ratio)"

#: Fields `compute_metrics` reads off `fa_quarterly`.
Q_FIELDS = ["revenue", "gross_margin", "net_margin", "roe_ttm",
            "st_debt", "lt_debt", "total_equity", "eps"]


def page(client, table, cols, narrow=None, order=("symbol",)):
    def build(off, lim):
        q = client.table(table).select(cols)
        if narrow:
            q = narrow(q)
        for c in order:
            q = q.order(c)
        return q.range(off, off + lim - 1)
    return paged_select(build, label=table)


def load_events(client) -> dict[str, list[ShareEvent]]:
    """Every stored event, rebuilt into the dataclass the factor math takes."""
    out: dict[str, list[ShareEvent]] = defaultdict(list)
    rows = page(client, "fa_share_events",
                "symbol,event_id,event_code,title_en,title_vi,event_group,ratio,"
                "exright_date,public_date,record_date,listing_date",
                order=("symbol", "event_id"))
    def d(v):
        return dt.date.fromisoformat(str(v)[:10]) if v else None
    for r in rows:
        out[r["symbol"]].append(ShareEvent(
            symbol=r["symbol"], event_id=r["event_id"], event_code=r["event_code"],
            title_en=r.get("title_en"), title_vi=r.get("title_vi"),
            group=r.get("event_group"), ratio=r.get("ratio"),
            exright_date=d(r.get("exright_date")), public_date=d(r.get("public_date")),
            record_date=d(r.get("record_date")), listing_date=d(r.get("listing_date"))))
    return out


def load_adjustments(client) -> dict[str, dict[str, Adjustment]]:
    out: dict[str, dict[str, Adjustment]] = defaultdict(dict)
    for r in page(client, "fa_share_adjustments",
                  "symbol,period,shares,shares_prev,total_ratio,k_technical,"
                  "announced_ratio,data_ok,reason", order=("symbol", "period")):
        out[r["symbol"]][r["period"]] = Adjustment(
            period=r["period"], shares=r.get("shares"),
            shares_prev=r.get("shares_prev"),
            total_ratio=r.get("total_ratio"), k_technical=r.get("k_technical") or 1.0,
            announced_ratio=r.get("announced_ratio"),
            data_ok=bool(r.get("data_ok")), reason=r.get("reason") or "")
    return out


def duplicate_groups(events: dict[str, list[ShareEvent]]) -> list[dict]:
    """§9 step 2. Only ISS rows with an ex-date and a ratio can inflate a factor."""
    groups: dict[tuple, list[ShareEvent]] = defaultdict(list)
    for sym, evs in events.items():
        for e in evs:
            if e.event_code == "ISS" and e.exright_date and e.ratio is not None:
                groups[(sym, e.exright_date, e.title_en, float(e.ratio))].append(e)
    out = []
    for (sym, ex, title, ratio), evs in sorted(groups.items(), key=lambda kv: str(kv[0])):
        if len(evs) < 2:
            continue
        out.append({
            "symbol": sym, "exright_date": str(ex), "title_en": title,
            "ratio": ratio, "so_ban_ghi": len(evs),
            "ban_ghi_du": len(evs) - 1,
            "event_group": evs[0].group,
            "event_ids": ", ".join(e.event_id for e in evs),
            "listing_dates": ", ".join(str(e.listing_date) for e in evs),
            "anh_huong_he_so": "có" if evs[0].group == 1 else "không (Nhóm 2 hoặc chưa phân loại)",
        })
    return out


def shift(period: str, back: int) -> str:
    y, q = int(period[:4]), int(period[-1])
    t = y * 4 + (q - 1) - back
    return f"{t // 4}-Q{t % 4 + 1}"


def main() -> int:
    ap = argparse.ArgumentParser(description="BA §9 controlled share-event dedup rerun")
    ap.add_argument("--out", required=True)
    ap.add_argument("--dry-run", action="store_true",
                    help="compute and write the workbook, touch no table")
    ap.add_argument("--snapshot-dir", default="outputs/dedup_snapshot")
    args = ap.parse_args()

    client = get_supabase_client()
    cfg = fa_persist.load_scoring_config(client)

    # ---- step 1: snapshot ------------------------------------------------- #
    snap = Path(args.snapshot_dir)
    snap.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%dT%H%M%S")
    adj_before = load_adjustments(client)
    scores_before = page(client, "fa_scores",
                         "symbol,as_of_period,c1_eps_yoy,c1_pts,c2_eps_3q_avg_yoy,"
                         "c2_pts,c3_eps_pos_count,c3_pts,total_score,"
                         "normalized_score,rating,final_score,final_grade,"
                         "current_price,computed_at",
                         order=("symbol", "as_of_period"))
    (snap / f"fa_share_adjustments_{stamp}.json").write_text(
        json.dumps({s: {p: a.__dict__ for p, a in v.items()}
                    for s, v in adj_before.items()}, default=str, indent=1))
    (snap / f"fa_scores_{stamp}.json").write_text(
        json.dumps(scores_before, default=str, indent=1))
    print(f"[1] snapshot: {sum(len(v) for v in adj_before.values()):,} adjustment rows, "
          f"{len(scores_before):,} score rows -> {snap}")

    # ---- step 2: the duplicate list --------------------------------------- #
    events = load_events(client)
    dups = duplicate_groups(events)
    n_factor = sum(1 for d in dups if d["event_group"] == 1)
    print(f"[2] duplicate groups: {len(dups)} on "
          f"{len({d['symbol'] for d in dups})} symbols; {n_factor} can inflate a factor. "
          f"Key = {DEDUP_KEY}")

    # ---- step 3: factors before/after, EVERY symbol ----------------------- #
    charter = load_charter_capital(client)
    adj_after: dict[str, dict[str, Adjustment]] = {}
    factor_rows = []
    for sym in sorted(set(charter) | set(events)):
        adj_after[sym] = compute_adjustments(events.get(sym, []), charter.get(sym, {}))
        before, after = adj_before.get(sym, {}), adj_after[sym]
        for per in sorted(set(before) | set(after)):
            b, a = before.get(per), after.get(per)
            kb = None if b is None else b.k_technical
            ka = None if a is None else a.k_technical
            if kb == ka and (b is None) == (a is None):
                continue
            factor_rows.append({
                "symbol": sym, "period": per,
                "k_truoc": kb, "k_sau": ka,
                "total_ratio": None if a is None else a.total_ratio,
                "data_ok_truoc": None if b is None else b.data_ok,
                "data_ok_sau": None if a is None else a.data_ok,
                "reason_truoc": None if b is None else b.reason,
                "reason_sau": None if a is None else a.reason,
            })
    moved_syms = sorted({r["symbol"] for r in factor_rows})
    print(f"[3] factors changed on {len(factor_rows)} symbol-quarters, "
          f"{len(moved_syms)} symbols: {', '.join(moved_syms)}")

    # ---- steps 4 + 5: EPS, C1/C2, total, ΔFA before/after ----------------- #
    eps_rows, score_rows = [], []
    if moved_syms:
        q_by_sym: dict[str, dict] = defaultdict(dict)
        for r in page(client, "fa_quarterly", ",".join(["symbol", "period"] + Q_FIELDS),
                      narrow=lambda q: q.in_("symbol", moved_syms),
                      order=("symbol", "period")):
            q_by_sym[r["symbol"]][r["period"]] = {k: r.get(k) for k in Q_FIELDS}
        pe_by_sym: dict[str, list] = defaultdict(list)
        for r in page(client, "fa_annual_pe", "symbol,year,pe",
                      narrow=lambda q: q.in_("symbol", moved_syms),
                      order=("symbol", "year")):
            if r.get("pe") is not None:
                pe_by_sym[r["symbol"]].append((r["year"], r["pe"]))
        stored = {(r["symbol"], r["as_of_period"]): r for r in scores_before}
        # Only each symbol's LATEST quarter is maintained on the current basis;
        # `refresh_fa.py score` freezes older quarters by design, so a 2025-Q4 row
        # written in June cannot be expected to reproduce today. Measured across
        # the whole table: 4,250/4,250 rows follow that rule exactly. The write
        # gate therefore tests the LIVE rows and reports the frozen ones.
        latest_by_symbol = {}
        for (sym_, per_) in stored:
            latest_by_symbol[sym_] = max(latest_by_symbol.get(sym_, ""), per_)

        for sym in moved_syms:
            ser = q_by_sym.get(sym, {})
            # step 4: the restated year-ago EPS each window implies
            for per in sorted(ser):
                y4 = shift(per, 4)
                if y4 not in ser or ser[y4].get("eps") is None:
                    continue
                wb = window_factor(adj_before.get(sym, {}), y4, per)
                wa = window_factor(adj_after.get(sym, {}), y4, per)
                if (wb.k, wb.reconciled) == (wa.k, wa.reconciled):
                    continue
                base = ser[y4]["eps"]
                eps_rows.append({
                    "symbol": sym, "period": per,
                    "eps_cung_ky_nhu_cong_bo": base,
                    "k_cua_so_truoc": wb.k, "doi_chieu_truoc": wb.reconciled,
                    "eps_cung_ky_hoi_to_truoc": base / wb.k if wb.reconciled and wb.k else None,
                    "k_cua_so_sau": wa.k, "doi_chieu_sau": wa.reconciled,
                    "eps_cung_ky_hoi_to_sau": base / wa.k if wa.reconciled and wa.k else None,
                    "eps_quy_hien_tai": ser[per].get("eps"),
                })
            # step 5: the scored quarters only — those are what fa_scores holds
            for per in sorted(p for (s, p) in stored if s == sym):
                st = stored[(sym, per)]
                price = st.get("current_price")
                pe = pe_by_sym.get(sym, [])
                mb = compute_metrics(ser, per, price, pe, adj_before.get(sym, {}))
                ma = compute_metrics(ser, per, price, pe, adj_after.get(sym, {}))
                rb = compute_score(mb, cfg, fully_scorable=True)
                ra = compute_score(ma, cfg, fully_scorable=True)
                is_live = per == latest_by_symbol.get(sym)
                reproduces = rb.total_score == st["total_score"]
                score_rows.append({
                    "symbol": sym, "period": per,
                    "la_quy_moi_nhat": is_live,
                    "tai_lap_khop_so_da_luu": reproduces,
                    "trang_thai_co_so": (
                        "khớp" if reproduces
                        else "đóng băng trên cơ sở EPS cũ" if not is_live
                        else "LỆCH — cần điều tra"),
                    "computed_at_da_luu": st.get("computed_at"),
                    "total_da_luu": st["total_score"],
                    "c1_truoc": rb.pts("c1"), "c1_sau": ra.pts("c1"),
                    "c1_yoy_truoc": mb.get("c1_eps_yoy"), "c1_yoy_sau": ma.get("c1_eps_yoy"),
                    "eps_basis_truoc": mb.get("eps_basis"), "eps_basis_sau": ma.get("eps_basis"),
                    "c2_truoc": rb.pts("c2"), "c2_sau": ra.pts("c2"),
                    "c3_truoc": rb.pts("c3"), "c3_sau": ra.pts("c3"),
                    "total_truoc": rb.total_score, "total_sau": ra.total_score,
                    "delta_total": ra.total_score - rb.total_score,
                    "rating_truoc": rb.rating, "rating_sau": ra.rating,
                    "eps_norm_version": EPS_NORM_VERSION,
                })

    # ---- step 8's gate: the reproduction must hold before anything is written --- #
    # The gate tests only the rows a rescore will actually rewrite.
    mismatches = [r for r in score_rows
                  if r["la_quy_moi_nhat"] and not r["tai_lap_khop_so_da_luu"]]
    frozen = [r for r in score_rows
              if not r["la_quy_moi_nhat"] and not r["tai_lap_khop_so_da_luu"]]
    changed = [r for r in score_rows if r["delta_total"] != 0]
    print(f"[4] EPS windows changed: {len(eps_rows)}")
    print(f"[5] scored quarters affected: {len(changed)} of {len(score_rows)}; "
          f"ratings moved: {sum(1 for r in changed if r['rating_truoc'] != r['rating_sau'])}")
    if frozen:
        print(f"    note: {len(frozen)} historical rows are frozen on the pre-restatement "
              f"basis and are NOT rewritten by a default rescore:")
        for r in frozen:
            print(f"       {r['symbol']} {r['period']}: tái lập {r['total_truoc']} "
                  f"vs đã lưu {r['total_da_luu']} (ghi ngày {str(r['computed_at_da_luu'])[:10]})")
    if mismatches:
        print(f"    !! {len(mismatches)} LIVE rows do not reproduce the stored score before "
              f"the change — the comparison is not clean, refusing to write:")
        for r in mismatches[:10]:
            print(f"       {r['symbol']} {r['period']}: tái lập {r['total_truoc']} "
                  f"vs đã lưu {r['total_da_luu']}")

    summary = [
        {"metric": "snapshot", "value": str(snap)},
        {"metric": "dedup key", "value": DEDUP_KEY},
        {"metric": "duplicate groups", "value": len(dups)},
        {"metric": "groups affecting a factor", "value": n_factor},
        {"metric": "symbol-quarters with a changed factor", "value": len(factor_rows)},
        {"metric": "symbols with a changed factor", "value": ", ".join(moved_syms)},
        {"metric": "EPS windows changed", "value": len(eps_rows)},
        {"metric": "scored quarters affected", "value": len(changed)},
        {"metric": "live-row reproduction mismatches (must be 0)", "value": len(mismatches)},
        {"metric": "historical rows frozen on the old basis", "value": len(frozen)},
        {"metric": "eps_norm_version", "value": EPS_NORM_VERSION},
        {"metric": "mode", "value": "dry-run" if args.dry_run else "applied"},
    ]
    from export_fa_scanner import write_xlsx
    out = Path(args.out)
    write_xlsx(out, {
        "summary": summary,
        "su_kien_trung": dups or [{"note": "không có"}],
        "he_so_truoc_sau": factor_rows or [{"note": "không có"}],
        "eps_truoc_sau": eps_rows or [{"note": "không có"}],
        "diem_truoc_sau": score_rows or [{"note": "không có"}],
    })
    print(f"Wrote {out} ({out.stat().st_size / 1024:.0f} KB)")

    # ---- step 7 + 8: write ------------------------------------------------ #
    if args.dry_run:
        print("[7/8] dry run — nothing written.")
        return 0
    if mismatches:
        print("[8] REFUSING TO WRITE: the before state does not reproduce.")
        return 1
    n = 0
    for sym in moved_syms:
        n += write_adjustments(client, sym, adj_after[sym], dry=False)
    print(f"[7/8] wrote {n} adjustment rows for {len(moved_syms)} symbols "
          f"({EPS_NORM_VERSION}).")
    print("      Next: refresh_fa.py score  ->  refresh_final_score.py  -> revalidate cache")
    return 0


if __name__ == "__main__":
    sys.exit(main())
