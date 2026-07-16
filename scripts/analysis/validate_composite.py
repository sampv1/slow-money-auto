#!/usr/bin/env python3
"""validate_composite.py — frozen validation protocol for the macro composite.

Implements MACRO_COMPOSITE_DESIGN.md §7 exactly. Temporal split, never shuffled:
  dev      series start -> 2022-12-30   (default sample)
  holdout  2023-01-03 -> present        (scored ONCE, only after the two §4
                                         choices are frozen below)

Dev mode evaluates all 4 pre-registered combos (window 504/756 x DXY
level/chg63) on `composite_core` and emits a markdown report. Forward-return
windows are not allowed to cross the split boundary (an embargo — dev signals
are never scored against holdout-period market data), which is stricter than
the doc, never looser.

Holdout mode is gated: it refuses to run until FROZEN_CHOICES is set (stage
3->4 of the design doc), and then runs ONLY that combo.

Usage:
  python3 analysis/validate_composite.py                  # dev, all combos
  python3 analysis/validate_composite.py --refresh        # refetch cache first
  python3 analysis/validate_composite.py --sample holdout # gated, see above
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from macro.composite import (  # noqa: E402
    COMPONENTS, CORE_MEMBERS, DXY_MODES, RISK_OFF_ENTER, RISK_ON_GATE,
    Z_WINDOWS, build_composites, combine, load_macro_bundle, risk_off_state,
)

DEV_END = pd.Timestamp("2022-12-30")
HOLDOUT_START = pd.Timestamp("2023-01-03")

# Stage 3->4 gate: set ONLY when the two §4 choices are frozen after the dev
# review. Frozen 2026-07-16 (user sign-off; dev report tmp/composite_dev_report.md):
# W=504 + DXY level won every pre-registered dev metric, factor-consistently.
FROZEN_CHOICES: dict | None = {"window": 504, "dxy": "level"}

# Pre-registered dev event (§7.3): 2022 tightening.
DEV_TOP = pd.Timestamp("2022-04-04")

# Pre-registered holdout events (§7.3). The third class — 2025-26 episodes —
# is identified mechanically from VN-Index drawdowns >10% (composite-blind).
HOLDOUT_EVENTS = [
    ("Sep-2023 SBV bill issuance", pd.Timestamp("2023-09-21")),
    ("Apr-2024 FX squeeze (SBV spot sales)", pd.Timestamp("2024-04-19")),
]

REPO = Path(__file__).resolve().parent.parent.parent
CACHE_DEFAULT = REPO / "tmp" / "macro_cache.json"
HORIZONS = (20, 60)


# ---------------------------------------------------------------------------
# Bundle cache (so reruns don't hammer Supabase)
# ---------------------------------------------------------------------------

def bundle_to_json(bundle: dict) -> dict:
    return {
        "fetched": dt.datetime.now().isoformat(timespec="seconds"),
        "metrics": {k: [[d.date().isoformat(), float(v)] for d, v in s.items()]
                    for k, s in bundle.items() if isinstance(s, pd.Series)},
        "bands": bundle["bands"],
        "cpi_targets": bundle["cpi_targets"],
    }


def bundle_from_json(obj: dict) -> dict:
    bundle: dict = {}
    for k, pts in obj["metrics"].items():
        idx = pd.to_datetime([p[0] for p in pts])
        bundle[k] = pd.Series([p[1] for p in pts], index=idx).sort_index()
    bundle["bands"] = [tuple(e) for e in obj["bands"]]
    bundle["cpi_targets"] = [tuple(e) for e in obj["cpi_targets"]]
    return bundle


def load_bundle(cache: Path, refresh: bool) -> dict:
    if cache.exists() and not refresh:
        obj = json.loads(cache.read_text())
        print(f"Bundle from cache {cache} (fetched {obj.get('fetched')})")
        return bundle_from_json(obj)
    from ta.common import get_supabase_client
    print("Fetching macro_series from Supabase ...")
    bundle = load_macro_bundle(get_supabase_client())
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(bundle_to_json(bundle)))
    print(f"Cached to {cache}")
    return bundle


# ---------------------------------------------------------------------------
# Metric helpers (§7)
# ---------------------------------------------------------------------------

def forward_return(vn: pd.Series, h: int) -> pd.Series:
    return vn.shift(-h) / vn - 1


def forward_max_drawdown(vn: pd.Series, h: int = 60) -> pd.Series:
    """Worst return within the next h sessions (min over t+1..t+h vs t)."""
    v = vn.values.astype(float)
    out = np.full(len(v), np.nan)
    if len(v) > h:
        from numpy.lib.stride_tricks import sliding_window_view
        wins = sliding_window_view(v, h + 1)          # rows: v[t..t+h]
        out[: len(v) - h] = wins[:, 1:].min(axis=1) / wins[:, 0] - 1
    return pd.Series(out, index=vn.index)


def spearman_nonoverlap(comp: pd.Series, fwd: pd.Series, step: int) -> dict:
    """Spearman rho on non-overlapping windows: subsample every `step`-th
    valid session. Reported across all `step` phase offsets (offset 0 is the
    headline; median/min/max show phase sensitivity — no offset is chosen)."""
    valid = comp.notna() & fwd.notna()
    c, f = comp[valid], fwd[valid]
    rhos = []
    for off in range(step):
        cc, ff = c.iloc[off::step], f.iloc[off::step]
        if len(cc) >= 8:
            # Spearman = Pearson on average ranks (avoids a scipy dependency).
            rho = cc.rank().corr(ff.rank())
            if np.isfinite(rho):
                rhos.append(rho)
    if not rhos:
        return {"n": 0}
    return {
        "n": len(c.iloc[0::step]), "offset0": rhos[0],
        "median": float(np.median(rhos)), "min": min(rhos), "max": max(rhos),
    }


def bucket_table(comp: pd.Series, vn: pd.Series) -> list[dict]:
    """§7.2 quantile table over the pre-registered buckets."""
    fwd = {h: forward_return(vn, h) for h in HORIZONS}
    mdd = forward_max_drawdown(vn, 60)
    buckets = [
        (f"z < {RISK_ON_GATE}", comp < RISK_ON_GATE),
        (f"{RISK_ON_GATE} .. +{RISK_OFF_ENTER}", (comp >= RISK_ON_GATE) & (comp <= RISK_OFF_ENTER)),
        (f"z > +{RISK_OFF_ENTER}", comp > RISK_OFF_ENTER),
    ]
    rows = []
    for label, mask in buckets:
        m20 = mask & fwd[20].notna()
        m60 = mask & fwd[60].notna()
        rows.append({
            "bucket": label, "days": int(mask.sum()),
            "fwd20_mean": fwd[20][m20].mean() * 100 if m20.any() else np.nan,
            "fwd20_neg": (fwd[20][m20] < 0).mean() * 100 if m20.any() else np.nan,
            "fwd60_mean": fwd[60][m60].mean() * 100 if m60.any() else np.nan,
            "mdd60_mean": mdd[m60 & mdd.notna()].mean() * 100 if (m60 & mdd.notna()).any() else np.nan,
        })
    return rows


def episodes(comp: pd.Series, vn: pd.Series) -> list[dict]:
    """Risk-off episodes under the §6 state machine, with outcomes."""
    state = risk_off_state(comp)
    fwd20, fwd60 = forward_return(vn, 20), forward_return(vn, 60)
    entries = state & ~state.shift(1, fill_value=False)
    exits = ~state & state.shift(1, fill_value=False)
    exit_dates = list(comp.index[exits])
    out = []
    for d in comp.index[entries]:
        exit_d = next((x for x in exit_dates if x > d), None)
        out.append({
            "entry": d, "exit": exit_d,
            "days": int(state.loc[d:exit_d].sum()) if exit_d is not None else int(state.loc[d:].sum()),
            "comp": comp.loc[d], "vn": vn.loc[d],
            "fwd20": fwd20.loc[d], "fwd60": fwd60.loc[d],
        })
    return out


def hit_rate(comp: pd.Series, vn: pd.Series) -> dict:
    """§7 headline: P(fwd20 < 0 | risk-off state) vs unconditional base."""
    state = risk_off_state(comp)
    fwd20 = forward_return(vn, 20)
    valid = fwd20.notna() & comp.notna()
    base = (fwd20[valid] < 0).mean()
    in_state = valid & state
    cond = (fwd20[in_state] < 0).mean() if in_state.any() else np.nan
    return {"base": base * 100, "riskoff": cond * 100,
            "riskoff_days": int(in_state.sum()), "eval_days": int(valid.sum())}


# ---------------------------------------------------------------------------
# Report assembly
# ---------------------------------------------------------------------------

def fmt(x, nd=2, suffix=""):
    return "—" if x is None or (isinstance(x, float) and not np.isfinite(x)) else f"{x:.{nd}f}{suffix}"


def d8(ts) -> str:
    return "—" if ts is None else pd.Timestamp(ts).date().isoformat()


def variant_metrics(comp: pd.Series, vn: pd.Series) -> dict:
    """The §7 metric battery for one composite variant on one sample."""
    return {
        "dist": {
            "days": int(comp.notna().sum()), "std": comp.std(),
            "p05": comp.quantile(0.05), "p50": comp.quantile(0.50), "p95": comp.quantile(0.95),
            "share_gt1": (comp > RISK_OFF_ENTER).mean() * 100,
            "share_lt_m05": (comp < RISK_ON_GATE).mean() * 100,
        },
        "spearman": {h: spearman_nonoverlap(comp, forward_return(vn, h), h) for h in HORIZONS},
        "buckets": bucket_table(comp, vn),
        "episodes": episodes(comp, vn),
        "hit": hit_rate(comp, vn),
    }


def evaluate_combo(bundle: dict, window: int, dxy_mode: str, dev: bool) -> dict:
    """Build composites, truncate to the sample, compute all §7 metrics."""
    df = build_composites(bundle, window, dxy_mode)
    sample = df.loc[df.index <= DEV_END] if dev else df.loc[df.index >= HOLDOUT_START]
    comp, vn = sample["composite_core"], sample["vnindex"]
    full = sample["composite_full"]

    res: dict = {"window": window, "dxy": dxy_mode, "df": df, "dev": dev,
                 "core_start": d8(comp.first_valid_index()),
                 "full_start": d8(df["composite_full"].first_valid_index()),
                 "full_days_in_sample": int(full.notna().sum())}

    res.update(variant_metrics(comp, vn))
    if not dev:
        # Holdout is the one sample where composite_full (the live headline)
        # has full depth — score it in the same one-shot run.
        res["full_metrics"] = variant_metrics(full, vn)

    # §7.5 expected miss, documented in advance: COVID Mar-2020 (exogenous).
    covid = comp.loc["2020-02-01":"2020-04-30"]
    res["covid_max"] = covid.max() if not covid.empty else np.nan

    # §5 standalone raw-leg event checks (composite_full can't be scored on
    # the 2022 episode): fx and foreign component scores through 2022.
    legs = {}
    for leg in ("fx", "foreign"):
        s = df[leg].loc["2022-01-01":"2022-12-30"]
        first_gt1 = s.index[s > 1.0]
        legs[leg] = {"max": s.max() if not s.empty else np.nan,
                     "max_date": d8(s.idxmax()) if s.notna().any() else None,
                     "first_gt1": d8(first_gt1[0]) if len(first_gt1) else None}
    res["legs_2022"] = legs
    return res


def event_lines(eps: list[dict], vn_full: pd.Series) -> list[str]:
    """§7.3 event narrative for the 2022 dev episode."""
    lines = []
    top_close = vn_full.loc[DEV_TOP] if DEV_TOP in vn_full.index else np.nan
    dd10 = vn_full.loc[(vn_full.index > DEV_TOP) & (vn_full <= 0.9 * top_close)]
    dd10_date = dd10.index[0] if len(dd10) else None
    lines.append(f"- VN-Index 2022 top: {d8(DEV_TOP)} (close {fmt(top_close, 1)}); "
                 f"first −10% close: {d8(dd10_date)}")
    win = [e for e in eps if pd.Timestamp("2021-10-01") <= e["entry"] <= DEV_END]
    if not win:
        lines.append("- NO risk-off entry in the 2021-10 .. 2022-12 window — event MISSED.")
    for e in win:
        lead_top = (DEV_TOP - e["entry"]).days
        lead_dd = (dd10_date - e["entry"]).days if dd10_date is not None else None
        lines.append(
            f"- entry {d8(e['entry'])} (comp {fmt(e['comp'])}, VN {fmt(e['vn'], 1)}) → "
            f"exit {d8(e['exit'])} ({e['days']}d); fwd20 {fmt(e['fwd20'] * 100, 1, '%')}, "
            f"fwd60 {fmt(e['fwd60'] * 100, 1, '%')}; lead vs top {lead_top:+d}d"
            + (f", vs −10% {lead_dd:+d}d" if lead_dd is not None else ""))
    return lines


def vn_drawdown_episodes(vn: pd.Series, threshold: float = 0.10) -> list[tuple]:
    """Distinct drawdown episodes >threshold from the running max — used to
    identify holdout events composite-blind (§7.3). Returns (peak, trough, dd)."""
    run_max = vn.cummax()
    dd = vn / run_max - 1
    out, in_ep = [], False
    peak_val = peak_date = trough_date = None
    trough = 0.0
    for d in vn.index:
        if not in_ep and dd.loc[d] <= -threshold:
            in_ep = True
            peak_val = run_max.loc[d]
            prior = vn.loc[:d]
            peak_date = prior[prior >= peak_val].index[-1]
            trough_date, trough = d, dd.loc[d]
        elif in_ep:
            if dd.loc[d] < trough:
                trough, trough_date = dd.loc[d], d
            if vn.loc[d] >= peak_val:
                out.append((peak_date, trough_date, trough))
                in_ep = False
    if in_ep:
        out.append((peak_date, trough_date, trough))
    return out


def holdout_event_lines(eps: list[dict], vn: pd.Series) -> list[str]:
    """§7.3 holdout events: the two pre-registered anchors + composite-blind
    2025-26 drawdown episodes. An entry 'covers' an anchor if it falls in
    [anchor−120d, anchor+60d]."""
    lines = []
    for name, anchor in HOLDOUT_EVENTS:
        near = [e for e in eps
                if anchor - pd.Timedelta(days=120) <= e["entry"] <= anchor + pd.Timedelta(days=60)]
        if not near:
            lines.append(f"- {name} ({d8(anchor)}): no risk-off entry in −120/+60d — MISSED.")
        for e in near:
            lead = (anchor - e["entry"]).days
            lines.append(
                f"- {name} ({d8(anchor)}): entry {d8(e['entry'])} (lead {lead:+d}d vs anchor), "
                f"comp {fmt(e['comp'])}; fwd20 {fmt(e['fwd20'] * 100, 1, '%')}, "
                f"fwd60 {fmt(e['fwd60'] * 100, 1, '%')}")
    dd_eps = [x for x in vn_drawdown_episodes(vn)
              if x[0] >= pd.Timestamp("2025-01-01")]
    if not dd_eps:
        lines.append("- 2025-26 composite-blind screen: no VN-Index drawdown >10%.")
    for peak, trough, ddv in dd_eps:
        near = [e for e in eps
                if peak - pd.Timedelta(days=120) <= e["entry"] <= peak + pd.Timedelta(days=30)]
        tag = (f"entry {d8(near[0]['entry'])} ({(peak - near[0]['entry']).days:+d}d before peak)"
               if near else "no risk-off entry in −120/+30d — MISSED")
        lines.append(f"- 2025-26 drawdown {ddv * 100:.1f}% (peak {d8(peak)}, trough {d8(trough)}): {tag}")
    return lines


def robustness(bundle: dict, window: int, dxy_mode: str) -> list[str]:
    """§3 robustness: perturb each pillar's weight ±10pp (renormalizing the
    rest proportionally), recompute median non-overlapping Spearman(20d)."""
    df = build_composites(bundle, window, dxy_mode)
    dev = df.loc[df.index <= DEV_END]
    vn = dev["vnindex"]
    pillars: dict[str, list[str]] = {}
    for n in CORE_MEMBERS:
        pillars.setdefault(COMPONENTS[n]["pillar"], []).append(n)
    base_w = {n: COMPONENTS[n]["weight"] for n in CORE_MEMBERS}
    total = sum(base_w.values())
    lines = []
    for p, names in pillars.items():
        pw = sum(base_w[n] for n in names)
        for delta in (+10, -10):
            new_pw = max(pw + delta, 0)
            scale_in = new_pw / pw if pw else 0
            scale_out = (total - new_pw) / (total - pw) if total > pw else 0
            w = {n: base_w[n] * (scale_in if n in names else scale_out) for n in CORE_MEMBERS}
            comp = combine(df, CORE_MEMBERS, weight_override=w).loc[dev.index]
            sp = spearman_nonoverlap(comp, forward_return(vn, 20), 20)
            lines.append(f"- pillar `{p}` {pw}→{new_pw}pp: rho20 median {fmt(sp.get('median'), 3)}")
    return lines


def render_report(results: list[dict], sample: str) -> str:
    lines = [
        f"# Macro composite — {sample.upper()} validation report",
        "",
        f"Generated {dt.datetime.now():%Y-%m-%d %H:%M}. Protocol: MACRO_COMPOSITE_DESIGN.md §7 "
        f"(split dev ≤ {d8(DEV_END)} / holdout ≥ {d8(HOLDOUT_START)}; forward windows never cross the split).",
        "",
        "Variant evaluated: `composite_core` (5 components — ON, spread, OMO, DXY, CPI). "
        "`composite_full` lacks dev depth by design (foreign/FX z start late); its dev-period "
        "start and the §5 standalone FX/foreign leg checks are reported per combo.",
        "",
        "## Summary (all pre-registered combos)",
        "",
        "| combo | core start | rho20 (off0 / med) | rho60 (off0 / med) | P(fwd20<0) risk-off vs base | risk-off days | episodes | 2022 entry | COVID max |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for r in results:
        eps22 = [e for e in r["episodes"] if pd.Timestamp("2021-10-01") <= e["entry"] <= DEV_END]
        s20, s60, hit = r["spearman"][20], r["spearman"][60], r["hit"]
        lines.append(
            f"| W={r['window']}, dxy={r['dxy']} | {r['core_start']} "
            f"| {fmt(s20.get('offset0'), 3)} / {fmt(s20.get('median'), 3)} "
            f"| {fmt(s60.get('offset0'), 3)} / {fmt(s60.get('median'), 3)} "
            f"| {fmt(hit['riskoff'], 0, '%')} vs {fmt(hit['base'], 0, '%')} "
            f"| {hit['riskoff_days']} | {len(r['episodes'])} "
            f"| {(d8(eps22[0]['entry']) if eps22 else 'MISS') if r['dev'] else 'n/a'} "
            f"| {fmt(r['covid_max']) if r['dev'] else 'n/a'} |")
    lines.append("")
    lines.append("(rho: Spearman vs forward return on non-overlapping windows; negative = composite "
                 "high → returns low, i.e. the predicted direction. off0 = first phase offset, "
                 "med = median across all phase offsets.)")

    for r in results:
        lines += ["", f"## W={r['window']}, dxy={r['dxy']}", "",
                  f"- composite_core defined from {r['core_start']}; composite_full from "
                  f"{r['full_start']} ({r['full_days_in_sample']} sample days).",
                  f"- distribution: std {fmt(r['dist']['std'])}, p05 {fmt(r['dist']['p05'])}, "
                  f"p50 {fmt(r['dist']['p50'])}, p95 {fmt(r['dist']['p95'])}; "
                  f"days >+1: {fmt(r['dist']['share_gt1'], 1, '%')}, "
                  f"days <−0.5: {fmt(r['dist']['share_lt_m05'], 1, '%')} of {r['dist']['days']}.",
                  "", "### Bucket table (§7.2)", "",
                  "| bucket | days | fwd20 mean | P(fwd20<0) | fwd60 mean | maxDD60 mean |",
                  "|---|---|---|---|---|---|"]
        for b in r["buckets"]:
            lines.append(f"| {b['bucket']} | {b['days']} | {fmt(b['fwd20_mean'], 2, '%')} "
                         f"| {fmt(b['fwd20_neg'], 0, '%')} | {fmt(b['fwd60_mean'], 2, '%')} "
                         f"| {fmt(b['mdd60_mean'], 2, '%')} |")
        lines += ["", "### Risk-off episodes (§6 state machine)", ""]
        if not r["episodes"]:
            lines.append("- none")
        whip = 0
        for e in r["episodes"]:
            bad = np.isfinite(e["fwd20"]) and e["fwd20"] >= 0
            whip += bad
            lines.append(f"- {d8(e['entry'])} → {d8(e['exit'])} ({e['days']}d), comp {fmt(e['comp'])}: "
                         f"fwd20 {fmt(e['fwd20'] * 100, 1, '%')}, fwd60 {fmt(e['fwd60'] * 100, 1, '%')}"
                         + (" ← whipsaw" if bad else ""))
        lines.append(f"- whipsaw count (§7.4): {whip} of {len(r['episodes'])}")
        if r["dev"]:
            lines += ["", "### 2022 tightening event study (§7.3)", ""]
            lines += event_lines(r["episodes"], r["df"]["vnindex"])
            lines += ["", "### Expected-miss check — COVID Mar-2020 (§7.5)", "",
                      f"- composite_core max Feb–Apr 2020: {fmt(r['covid_max'])} "
                      "(exogenous shock — a miss here is expected and pre-documented).",
                      "", "### Standalone FX / foreign leg checks over 2022 (§5)", ""]
            for leg, info in r["legs_2022"].items():
                lines.append(f"- `{leg}` score 2022: max {fmt(info['max'])} on {info['max_date']}; "
                             f"first day >+1: {info['first_gt1'] or '—'}")
        else:
            vn_sample = r["df"].loc[r["df"].index >= HOLDOUT_START, "vnindex"]
            lines += ["", "### Holdout event studies (§7.3)", ""]
            lines += holdout_event_lines(r["episodes"], vn_sample)
            fm = r["full_metrics"]
            lines += ["", "### composite_full (live headline) on holdout", "",
                      f"- distribution: std {fmt(fm['dist']['std'])}, p05 {fmt(fm['dist']['p05'])}, "
                      f"p50 {fmt(fm['dist']['p50'])}, p95 {fmt(fm['dist']['p95'])}; "
                      f"days >+1: {fmt(fm['dist']['share_gt1'], 1, '%')}, "
                      f"days <−0.5: {fmt(fm['dist']['share_lt_m05'], 1, '%')} of {fm['dist']['days']}.",
                      f"- rho20 {fmt(fm['spearman'][20].get('offset0'), 3)} / "
                      f"med {fmt(fm['spearman'][20].get('median'), 3)}; "
                      f"rho60 {fmt(fm['spearman'][60].get('offset0'), 3)} / "
                      f"med {fmt(fm['spearman'][60].get('median'), 3)}",
                      f"- hit rate: P(fwd20<0 | risk-off) {fmt(fm['hit']['riskoff'], 0, '%')} vs "
                      f"base {fmt(fm['hit']['base'], 0, '%')} ({fm['hit']['riskoff_days']} risk-off days)",
                      "", "| bucket | days | fwd20 mean | P(fwd20<0) | fwd60 mean | maxDD60 mean |",
                      "|---|---|---|---|---|---|"]
            for b in fm["buckets"]:
                lines.append(f"| {b['bucket']} | {b['days']} | {fmt(b['fwd20_mean'], 2, '%')} "
                             f"| {fmt(b['fwd20_neg'], 0, '%')} | {fmt(b['fwd60_mean'], 2, '%')} "
                             f"| {fmt(b['mdd60_mean'], 2, '%')} |")
            lines += ["", "#### composite_full risk-off episodes", ""]
            if not fm["episodes"]:
                lines.append("- none")
            for e in fm["episodes"]:
                bad = np.isfinite(e["fwd20"]) and e["fwd20"] >= 0
                lines.append(f"- {d8(e['entry'])} → {d8(e['exit'])} ({e['days']}d), comp {fmt(e['comp'])}: "
                             f"fwd20 {fmt(e['fwd20'] * 100, 1, '%')}, fwd60 {fmt(e['fwd60'] * 100, 1, '%')}"
                             + (" ← whipsaw" if bad else ""))
            lines += ["", "#### Holdout events under composite_full", ""]
            lines += holdout_event_lines(fm["episodes"], vn_sample)
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Frozen validation protocol runner (design §7)")
    ap.add_argument("--sample", choices=["dev", "holdout"], default="dev")
    ap.add_argument("--cache", type=Path, default=CACHE_DEFAULT)
    ap.add_argument("--refresh", action="store_true", help="refetch macro_series into the cache")
    ap.add_argument("--report", type=Path, default=None)
    ap.add_argument("--robustness", action="store_true",
                    help="also run the ±10pp pillar-weight perturbation (dev only)")
    args = ap.parse_args()

    if args.sample == "holdout":
        if FROZEN_CHOICES is None:
            sys.exit("REFUSED: holdout is scored once, only after the two §4 dev choices are "
                     "frozen (set FROZEN_CHOICES in this file per the signed-off design doc).")
        combos = [(FROZEN_CHOICES["window"], FROZEN_CHOICES["dxy"])]
    else:
        combos = [(w, m) for w in Z_WINDOWS for m in DXY_MODES]

    bundle = load_bundle(args.cache, args.refresh)
    dev = args.sample == "dev"
    results = []
    for w, m in combos:
        print(f"Evaluating W={w}, dxy={m} ...")
        results.append(evaluate_combo(bundle, w, m, dev=dev))

    report = render_report(results, args.sample)
    if args.robustness and dev:
        report += "\n## Robustness: pillar weights ±10pp (§3) — run on each combo\n\n"
        for w, m in combos:
            report += f"### W={w}, dxy={m}\n\n" + "\n".join(robustness(bundle, w, m)) + "\n\n"

    out = args.report or (REPO / "tmp" / f"composite_{args.sample}_report.md")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(report)
    print(f"\nReport written to {out}\n")
    print(report)


if __name__ == "__main__":
    main()
