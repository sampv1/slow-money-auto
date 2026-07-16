"""Macro pressure composite — implements MACRO_COMPOSITE_DESIGN.md (v1).

FROZEN design: components, signs, weights, standardization, and variant
membership come from MACRO_COMPOSITE_DESIGN.md §3–§5 and may not be tuned.
The ONLY open knobs are the two pre-registered dev-sample choices:
  * rolling z window: 504 vs 756 sessions
  * DXY transform: level vs 63-session change
Everything else here implements the doc verbatim. The dashboard formulas for
%-to-ceiling and CPI headroom are mirrored exactly from
dashboard/src/app/macro/page.tsx (buildCpiRows / ceiling math).

Pure computation module: no network, no DB writes. Callers pass a "bundle"
(dict of metric -> pd.Series, see load_macro_bundle) and get back daily
component scores + both composite variants on the VN trading-day grid.

Micro-decisions the design doc leaves open — fixed here BEFORE any validation
was run (also listed in the validation report):
  * Rolling z windows include the current observation (standard FCI practice).
  * As-of joins carry a value at most 15 calendar days; a dead source goes NaN
    rather than flatlining into the composite.
  * DXY "63-session change" = percent change over 63 VN-grid sessions.
  * Foreign 20-session cumulative = rolling sum over the trailing 20 grid
    sessions requiring >=15 present values (min_periods) — undefined across
    the CafeF 2019-21 hole instead of quietly biased.
  * A variant starts on the first grid date by which EVERY member component
    has produced a defined z (structural availability — this is what yields
    the doc's stated ~2019-04 / late-2022 start dates). After the start, a
    day's weights renormalize over defined components (§5), but the day goes
    NaN if <70% of the variant's total weight is defined.
  * CPI monthly z is step-filled to days with a 100-day staleness cap
    (normal staleness is ~2 months: December headroom is undefined, so
    January carries November's value until January's publishes).
"""

from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Frozen constants (MACRO_COMPOSITE_DESIGN.md §3–§5)
# ---------------------------------------------------------------------------

# Direction convention: higher component score = worse conditions.
# score = sign * z(transform).
COMPONENTS: dict[str, dict] = {
    "on":      {"weight": 15, "sign": +1, "pillar": "liq"},   # VNIBOR ON level
    "spread":  {"weight": 15, "sign": -1, "pillar": "liq"},   # VNIBOR - SOFR (more negative = worse)
    "omo":     {"weight": 10, "sign": -1, "pillar": "liq"},   # cum. net injection (drained = worse)
    "fx":      {"weight": 30, "sign": -1, "pillar": "fx"},    # % headroom to SBV ceiling
    "dxy":     {"weight":  8, "sign": +1, "pillar": "ext"},   # level OR 63-session change (dev choice)
    "foreign": {"weight": 12, "sign": -1, "pillar": "ext"},   # 20-session cum. net (selling = worse)
    "cpi":     {"weight": 10, "sign": -1, "pillar": "cpi"},   # inflation-budget headroom
}
CORE_MEMBERS = ("on", "spread", "omo", "dxy", "cpi")
FULL_MEMBERS = tuple(COMPONENTS)

Z_WINDOWS = (504, 756)            # pre-registered choice 1 (sessions)
DXY_MODES = ("level", "chg63")    # pre-registered choice 2
MIN_OBS_DAILY = 252               # expanding allowed from here; fewer -> NaN
CPI_Z_WINDOW = 36                 # months
CPI_MIN_OBS = 24                  # months
WINSOR = 3.0                      # all z clipped to +/-3

ASOF_MAX_STALE_DAYS = 15
FOREIGN_WINDOW = 20
FOREIGN_MIN_PRESENT = 15
CPI_MAX_STALE_DAYS = 100
MIN_DEFINED_WEIGHT_FRAC = 0.70
DXY_CHG_SESSIONS = 63

GRID_START = pd.Timestamp("2015-01-01")  # earliest component start

# Effective-dated defaults, mirroring the dashboard (scoring_config['macro']
# overrides when present; see migrations 035/037/039).
DEFAULT_BANDS = [("2015-08-19", 0.03), ("2022-10-17", 0.05)]
DEFAULT_CPI_TARGETS = [("2015-01-01", 5.0), ("2017-01-01", 4.0), ("2023-01-01", 4.5)]

BUNDLE_METRICS = (
    "vnindex", "interbank_overnight", "sofr", "dxy", "omo_net_injection",
    "fx_central_rate", "fx_vcb_sell", "foreign_net_value", "cpi_mom_index",
)


# ---------------------------------------------------------------------------
# Data loading (paged — PostgREST silently truncates at 1000 rows)
# ---------------------------------------------------------------------------

def fetch_metric_series(client, metric: str) -> pd.Series:
    rows: list[dict] = []
    page = 0
    while True:
        resp = (client.table("macro_series").select("date,value")
                .eq("metric", metric).order("date", desc=False)
                .range(page * 1000, page * 1000 + 999).execute())
        data = resp.data or []
        rows += data
        if len(data) < 1000:
            break
        page += 1
    if not rows:
        return pd.Series(dtype=float)
    s = pd.Series([float(r["value"]) for r in rows],
                  index=pd.to_datetime([r["date"] for r in rows]))
    return s[~s.index.duplicated(keep="last")].sort_index()


def load_macro_bundle(client) -> dict:
    """All composite inputs: metric series + effective-dated band/target config."""
    bundle: dict = {m: fetch_metric_series(client, m) for m in BUNDLE_METRICS}
    bands, targets = DEFAULT_BANDS, DEFAULT_CPI_TARGETS
    try:
        resp = client.table("scoring_config").select("config").eq("key", "macro").execute()
        cfg = (resp.data or [{}])[0].get("config") or {}
        raw_b = cfg.get("usdvnd_band")
        if isinstance(raw_b, list) and raw_b:
            bands = sorted((e["from"], float(e["value"])) for e in raw_b)
        raw_t = cfg.get("cpi_target")
        if isinstance(raw_t, list) and raw_t:
            targets = sorted((e["from"], float(e["value"])) for e in raw_t)
    except Exception as e:  # noqa: BLE001 — defaults mirror the dashboard's
        print(f"  scoring_config('macro') unavailable, using defaults: {str(e)[:80]}")
    bundle["bands"] = bands
    bundle["cpi_targets"] = targets
    return bundle


# ---------------------------------------------------------------------------
# Building blocks
# ---------------------------------------------------------------------------

def effective_value(date_iso: str, entries: list[tuple[str, float]]) -> float:
    """Effective-dated lookup (same semantics as the dashboard's bandFor)."""
    v = entries[0][1]
    for frm, val in entries:
        if frm <= date_iso:
            v = val
        else:
            break
    return v


def asof_on_grid(s: pd.Series, grid: pd.DatetimeIndex,
                 max_stale_days: int = ASOF_MAX_STALE_DAYS) -> pd.Series:
    """Last value <= t, carried at most max_stale_days (design §3: as-of joins)."""
    if s.empty:
        return pd.Series(np.nan, index=grid)
    s = s.dropna().sort_index()
    merged = pd.merge_asof(
        pd.DataFrame({"date": grid}),
        s.rename("v").rename_axis("date").reset_index(),
        on="date", tolerance=pd.Timedelta(days=max_stale_days),
    )
    return pd.Series(merged["v"].values, index=grid)


def rolling_z(s: pd.Series, window: int, min_obs: int = MIN_OBS_DAILY,
              winsor: float = WINSOR) -> pd.Series:
    """Rolling z over `window` positions, >= min_obs non-missing, winsorized.

    pandas semantics match the design exactly: the window spans `window`
    grid sessions; NaN positions count toward the span but not min_periods.
    """
    m = s.rolling(window, min_periods=min_obs).mean()
    sd = s.rolling(window, min_periods=min_obs).std()  # ddof=1
    z = (s - m) / sd
    z = z.mask(~np.isfinite(z))
    return z.clip(-winsor, winsor)


def cpi_headroom_monthly(cpi_mom: pd.Series, targets: list[tuple[str, float]]) -> pd.Series:
    """Inflation-budget headroom per month — mirrors buildCpiRows in
    dashboard/src/app/macro/page.tsx exactly.

    MoM index chained to a level; YoY = level[M]/level[M-12mo] - 1; per
    calendar year, headroom = (target*12 - sum(YoY elapsed incl. M)) /
    months_remaining - YoY(M). Undefined in December and while YoY is
    undefined (first 12 months).
    """
    if cpi_mom.empty:
        return pd.Series(dtype=float)
    months = cpi_mom.sort_index()
    level = (months / 100.0).cumprod() * 100.0
    lvl = {d: v for d, v in level.items()}

    out: dict[pd.Timestamp, float] = {}
    cur_year, sum_yoy = None, 0.0
    for d in months.index:
        if d.year != cur_year:
            cur_year, sum_yoy = d.year, 0.0
        prev = pd.Timestamp(dt.date(d.year - 1, d.month, 1))
        yoy = (lvl[d] / lvl[prev] - 1) * 100.0 if prev in lvl else None
        if yoy is not None:
            sum_yoy += yoy
        target = effective_value(d.date().isoformat(), targets)
        months_remaining = 12 - d.month
        out[d] = ((target * 12 - sum_yoy) / months_remaining - yoy
                  if yoy is not None and months_remaining > 0 else np.nan)
    return pd.Series(out)


def cpi_score_on_grid(cpi_mom: pd.Series, targets: list[tuple[str, float]],
                      grid: pd.DatetimeIndex) -> pd.Series:
    """Monthly headroom -> monthly z (36m window, min 24) -> step-fill to grid.

    Publication-lag rule (§3): month M's value becomes usable on the first
    trading day of M+1, implemented by re-keying the monthly z to M+1's first
    calendar day before the as-of join.
    """
    headroom = cpi_headroom_monthly(cpi_mom, targets)
    z = rolling_z(headroom, CPI_Z_WINDOW, CPI_MIN_OBS)
    z = z.dropna()
    if z.empty:
        return pd.Series(np.nan, index=grid)
    usable = pd.Series(z.values, index=z.index + pd.DateOffset(months=1))
    return asof_on_grid(usable, grid, max_stale_days=CPI_MAX_STALE_DAYS)


# ---------------------------------------------------------------------------
# Components -> scores -> composites
# ---------------------------------------------------------------------------

def trading_grid(bundle: dict) -> pd.DatetimeIndex:
    """VN trading-day grid = VN-Index dates from the earliest component start."""
    vn = bundle["vnindex"]
    return vn.index[vn.index >= GRID_START]


def build_raw_components(bundle: dict, grid: pd.DatetimeIndex, dxy_mode: str) -> pd.DataFrame:
    """Pre-z component series on the grid (transform column of design §3)."""
    if dxy_mode not in DXY_MODES:
        raise ValueError(f"dxy_mode must be one of {DXY_MODES}")

    on = asof_on_grid(bundle["interbank_overnight"], grid)
    sofr = asof_on_grid(bundle["sofr"], grid)
    spread = on - sofr

    # Cumulative OMO outstanding. The unknown pre-2016 base is an additive
    # constant that cancels inside the rolling z (§3).
    omo_flows = bundle["omo_net_injection"].dropna().sort_index()
    omo_cum = asof_on_grid(omo_flows.cumsum(), grid)

    central = asof_on_grid(bundle["fx_central_rate"], grid)
    vcb = asof_on_grid(bundle["fx_vcb_sell"], grid)
    bands = pd.Series(
        [effective_value(d.date().isoformat(), bundle["bands"]) for d in grid], index=grid)
    ceiling = central * (1 + bands)
    fx = (ceiling - vcb) / ceiling * 100.0

    dxy_level = asof_on_grid(bundle["dxy"], grid)
    dxy = (dxy_level if dxy_mode == "level"
           else dxy_level.pct_change(DXY_CHG_SESSIONS, fill_method=None) * 100.0)

    # Exact-date reindex (HOSE sessions == grid); NO as-of fill — a missing
    # CafeF day must stay missing so the min_periods rule can see the hole.
    foreign_daily = bundle["foreign_net_value"].reindex(grid)
    foreign = foreign_daily.rolling(FOREIGN_WINDOW, min_periods=FOREIGN_MIN_PRESENT).sum()

    return pd.DataFrame({
        "on": on, "spread": spread, "omo": omo_cum, "fx": fx,
        "dxy": dxy, "foreign": foreign,
    }, index=grid)


def build_scores(bundle: dict, window: int, dxy_mode: str,
                 grid: pd.DatetimeIndex | None = None) -> pd.DataFrame:
    """Per-component scores (sign * winsorized z) on the grid."""
    if window not in Z_WINDOWS:
        raise ValueError(f"window must be one of {Z_WINDOWS}")
    if grid is None:
        grid = trading_grid(bundle)
    raw = build_raw_components(bundle, grid, dxy_mode)
    scores = pd.DataFrame(index=grid)
    for name in raw.columns:
        scores[name] = COMPONENTS[name]["sign"] * rolling_z(raw[name], window)
    scores["cpi"] = COMPONENTS["cpi"]["sign"] * cpi_score_on_grid(
        bundle["cpi_mom_index"], bundle["cpi_targets"], grid)
    return scores[list(COMPONENTS)]


def combine_with_attribution(
    scores: pd.DataFrame, members: tuple[str, ...],
    weight_override: dict[str, float] | None = None,
) -> tuple[pd.Series, pd.DataFrame]:
    """Weighted composite over `members` (§5 missing-data policy) plus per-
    COMPONENT contributions. Contribution_i = wᵢ·scoreᵢ / Σ_defined wᵢ, so the
    component columns sum exactly to the composite wherever it is defined
    (that's what the dashboard's stacked attribution chart draws — one band per
    component). ctb columns are `members`, in the given order.

    `weight_override` exists ONLY for the §3 robustness check (perturb pillar
    weights ±10pp and confirm conclusions hold) — never for tuning.
    """
    w = weight_override or {}
    weights = np.array([w.get(n, COMPONENTS[n]["weight"]) for n in members], dtype=float)
    total = weights.sum()
    sub = scores[list(members)]

    starts = [sub[n].first_valid_index() for n in members]
    if any(s is None for s in starts):
        return (pd.Series(np.nan, index=scores.index),
                pd.DataFrame(np.nan, index=scores.index, columns=list(members)))
    start = max(starts)
    sub = sub.loc[sub.index >= start]

    defined_w = sub.notna().mul(weights, axis=1).sum(axis=1)
    weighted_sum = sub.mul(weights, axis=1).sum(axis=1)  # skipna
    comp = weighted_sum / defined_w
    comp = comp.mask(defined_w < MIN_DEFINED_WEIGHT_FRAC * total)

    # Per-component share: (wᵢ·scoreᵢ) / Σ_defined wᵢ. NaN where a component is
    # undefined that day (that band is simply absent); the defined columns still
    # sum to the composite.
    ctb = sub.mul(weights, axis=1).div(defined_w, axis=0)
    ctb.loc[comp.isna().values, :] = np.nan
    return comp.reindex(scores.index), ctb.reindex(scores.index)


def combine(scores: pd.DataFrame, members: tuple[str, ...],
            weight_override: dict[str, float] | None = None) -> pd.Series:
    """Composite only — see combine_with_attribution."""
    return combine_with_attribution(scores, members, weight_override)[0]


def build_composites(bundle: dict, window: int, dxy_mode: str) -> pd.DataFrame:
    """Scores + composite_core + composite_full + vnindex, on the grid."""
    grid = trading_grid(bundle)
    df = build_scores(bundle, window, dxy_mode, grid)
    df["composite_core"] = combine(df, CORE_MEMBERS)
    df["composite_full"] = combine(df, FULL_MEMBERS)
    df["vnindex"] = bundle["vnindex"].reindex(grid)
    return df


# ---------------------------------------------------------------------------
# Timing rule (§6) — sustained-crossing state machine with hysteresis
# ---------------------------------------------------------------------------

RISK_OFF_ENTER = 1.0   # composite > +1.0 for >=5 of last 7 sessions
RISK_OFF_EXIT = 0.5    # composite < +0.5 for >=5 of last 7 sessions
RISK_ON_GATE = -0.5    # composite < -0.5 allows KB1/KB2
SUSTAIN_HITS = 5
SUSTAIN_WINDOW = 7


def risk_off_state(comp: pd.Series) -> pd.Series:
    """Boolean risk-off state per §6 (NaN composite counts as neither)."""
    above = (comp > RISK_OFF_ENTER).rolling(SUSTAIN_WINDOW, min_periods=1).sum() >= SUSTAIN_HITS
    calm = (comp < RISK_OFF_EXIT).rolling(SUSTAIN_WINDOW, min_periods=1).sum() >= SUSTAIN_HITS
    state = np.zeros(len(comp), dtype=bool)
    cur = False
    a, c = above.values, calm.values
    for i in range(len(comp)):
        if not cur and a[i]:
            cur = True
        elif cur and c[i]:
            cur = False
        state[i] = cur
    return pd.Series(state, index=comp.index)
