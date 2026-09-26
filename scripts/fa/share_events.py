"""
Corporate share-issue announcements → the IAS 33 restatement factor.

BA's chart 11 spec splits every share-count change in two (see
`data/fa/analysis-charts/manufacturing/bổ sung biểu đồ thứ 11 …docx`):

  Nhóm 1 — cổ tức bằng cổ phiếu, cổ phiếu thưởng, chia tách. No money enters
           the company; the shareholder's stake is unchanged. IAS 33 / VAS 30
           require every EARLIER period's EPS to be divided by the factor, or
           the series shows a cliff that never happened.
  Nhóm 2 — phát hành riêng lẻ, quyền mua có thu tiền, ESOP, chào bán, hoán đổi
           sáp nhập. Real money, real dilution. Deliberately NOT restated, so
           the current quarter's EPS falls and the SDR card warns.

WHAT THIS MODULE IS FOR IS TELLING THE TWO APART, WHICH NOTHING COULD BEFORE.
The statement store records that charter capital changed, never why, and
`corporate_actions` is built by detecting price gaps so its `kind` is 'unknown'
on every row — migration 043 states outright that "only the corporate
announcement gives the type".

THE ANNOUNCEMENT IS THE LABEL; THE BALANCE SHEET IS THE TOTAL. BA approved this
split (reply lần 2 §1) and it is not defensive programming — measured on 12
symbols whose share count grew, 4 could not be explained by their own
announcements: ABW announced a 200% rights issue that never reached the share
count at all, BMS's 175.8% placement was part subscribed, KSF's merger carries
no ratio, BIG's events imply 2.14x against a filed 2.27x. A blind product of
(1 + ratio) would have overstated ABW's factor twofold.

Everything here except `fetch_events` is pure, so the reconciliation is pinned
by `scripts/tests/test_share_events.py` against fixtures rather than the feed.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field

# --- classification --------------------------------------------------------- #
#
# Matched against the provider's ENGLISH title, which carries the kind in a
# stable phrase: "Share Issue - Stock dividend ratio 17.0%". The Vietnamese
# title is stored too but not matched on — it is the one the provider is more
# likely to reword.
GROUP1_KINDS = ("Stock dividend", "Bonus Issue", "Stock split")
GROUP2_KINDS = (
    "Private Placements",
    "Rights issue",
    "ESOP",
    "Public Offering",
    "Stock for stock merger",
    # BA's "Chuyển đổi Trái phiếu thành Cổ phiếu", which the provider words as a
    # TRANSFER rather than a conversion — 25 events over 12 symbols, and the only
    # kind the first full pass could not classify. Real capital arrived (as debt
    # that is now equity), so it dilutes and must never restate history.
    "Transfer from Convertible Bonds",
)

# `chia tách cổ phiếu` is in Group 1 for completeness and BA confirmed (reply
# lần 1 Q9) that it does not arise here: Vietnamese par value is fixed at
# 10,000đ, so a split is executed as a bonus issue. Kept so a provider that
# does emit it is classified rather than rejected.

REASONS = {
    "NO_CHANGE": "share count unchanged",
    "OK": "announcements account for the filed change",
    "NO_SHARES": "charter capital missing for this quarter or the one before",
    "UNKNOWN_TITLE": "a share-issue title in this quarter matched no known kind",
    "GROUP1_NO_RATIO": "a Nhóm 1 event in this quarter carries no usable ratio",
    "FIRST_PERIOD": "no earlier quarter to compare against",
}

# A filed share count that moves by less than this is rounding in charter
# capital, not an issue. 0.5% is well below the smallest real ratio observed
# (TCX's 0.02% ESOP is the exception that proves the point — it is Group 2, so
# it never earns a technical factor anyway).
CHANGE_EPS = 0.005

# How far the announcements may fall short of the filed change before a window
# is refused. Part-subscribed placements and rounding in charter capital both
# land here; 2% was chosen because the four measured mismatches were all >10%.
RECONCILE_TOL = 0.02


def classify(title_en: str | None) -> int | None:
    """1 (technical), 2 (dilutive), or None when the wording is not recognised.

    None is a REFUSAL, not a default. A title this module has never seen must
    make its window fail closed and become visible, because guessing wrong in
    the Group 1 direction silently rewrites every earlier quarter's EPS.
    """
    # NOT `title_en or ""`: the provider sends a float NaN for a missing title,
    # and NaN is TRUTHY, so that idiom let it through to `kind in t` and raised
    # "argument of type 'float' is not iterable" — which the caller then counted
    # as a failed FETCH. VPH was the one symbol in 651 that hit it.
    t = title_en if isinstance(title_en, str) else ""
    for kind in GROUP1_KINDS:
        if kind in t:
            return 1
    for kind in GROUP2_KINDS:
        if kind in t:
            return 2
    return None


def quarter_of(d: dt.date) -> str:
    return f"{d.year}-Q{(d.month - 1) // 3 + 1}"


def shift_quarter(period: str, k: int) -> str:
    y, q = period.split("-Q")
    idx = int(y) * 4 + int(q) - 1 - k
    return f"{idx // 4}-Q{idx % 4 + 1}"


def quarter_key(period: str) -> tuple[int, int]:
    y, q = period.split("-Q")
    return int(y), int(q)


# --- the events ------------------------------------------------------------- #

@dataclass(frozen=True)
class ShareEvent:
    symbol: str
    event_id: str
    event_code: str
    title_en: str | None
    title_vi: str | None
    group: int | None
    ratio: float | None
    exright_date: dt.date | None
    public_date: dt.date | None
    record_date: dt.date | None
    listing_date: dt.date | None


def _date(v) -> dt.date | None:
    if v is None:
        return None
    s = str(v)
    if s[:10] in ("", "nan", "None", "NaT") or len(s) < 10:
        return None
    try:
        return dt.date.fromisoformat(s[:10])
    except ValueError:
        return None


def _ratio(v) -> float | None:
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f:  # NaN
        return None
    return f


def parse_events(symbol: str, records: list[dict]) -> list[ShareEvent]:
    """Provider event rows → the share-issue subset, classified.

    Only ISS and AIS are kept. Everything else the feed carries — AGMs, insider
    deals, cash dividends — cannot change the share count and would only crowd
    out the events that can, given the feed's 50-row-per-symbol cap.
    """
    out: list[ShareEvent] = []
    for r in records:
        code = str(r.get("event_code") or "")
        if code not in ("ISS", "AIS"):
            continue
        title_en = r.get("event_title_en")
        out.append(
            ShareEvent(
                symbol=symbol,
                event_id=str(r.get("id") or ""),
                event_code=code,
                title_en=title_en if isinstance(title_en, str) else None,
                title_vi=r.get("event_title_vi") if isinstance(r.get("event_title_vi"), str) else None,
                # An AIS row is a listing notice, never a ratio, so it is never
                # classified — it exists to explain a lag, not to score one.
                group=classify(title_en) if code == "ISS" else None,
                ratio=_ratio(r.get("exercise_ratio")) if code == "ISS" else None,
                exright_date=_date(r.get("exright_date")),
                public_date=_date(r.get("public_date")),
                record_date=_date(r.get("record_date")),
                listing_date=_date(r.get("listing_date")),
            )
        )
    return [e for e in out if e.event_id]


def fetch_events(symbol: str, attempts: int = 3, pause: float = 3.0) -> list[dict]:
    """Raw provider event rows for one symbol, or raise.

    RETRIES, AND AN EXHAUSTED RETRY MUST RAISE. The caller has to be able to
    tell "this symbol announced nothing" from "we could not ask" — the lesson
    `refresh_fa_vnstock.py` learned when a try/except-continue cost VNM its
    whole quarterly balance sheet while the run printed `ok`.
    """
    import time

    from vnstock import Company

    last: BaseException | None = None
    for i in range(attempts):
        try:
            df = Company(source="vci", symbol=symbol).events()
            return [] if df is None or df.empty else df.to_dict("records")
        except BaseException as exc:  # noqa: BLE001 — re-raised below
            last = exc
            if i + 1 < attempts:
                time.sleep(pause)
    raise RuntimeError(f"events({symbol}) failed after {attempts} attempts: {last}")


# --- the per-quarter factor ------------------------------------------------- #

@dataclass
class Adjustment:
    period: str
    shares: float | None = None
    shares_prev: float | None = None
    total_ratio: float | None = None
    k_technical: float = 1.0
    announced_ratio: float | None = None
    data_ok: bool = True
    reason: str = "NO_CHANGE"


def _by_exdate(events: list[ShareEvent], period: str) -> dict[dt.date, list[ShareEvent]]:
    """This quarter's ISS events, grouped by ex-right date.

    BA's ruling (reply lần 2 §3): Nhóm 1 is anchored on the EX-RIGHT date,
    because the exchange adjusts the reference price that session and the event
    is therefore certain. An ISS row with no ex-right date is skipped here —
    that is the Nhóm 2 shape (no official figure until the issue result), and
    Nhóm 2 is taken as the residual rather than from an announcement.

    THE FEED REPEATS EVENTS UNDER DIFFERENT IDS, and because ratios on one
    ex-date are ADDITIVE a repeat inflates the factor rather than being
    harmless. ABI announced a 20% stock dividend and a 20% bonus on
    2025-09-11; the feed carries each twice — one copy with a listing date and
    one without — so the sum read 0.80 and k came out 1.80 against a filed
    1.400. Measured over the whole store: 19 duplicate groups on 14 symbols, of
    which 5 inflate a Nhóm 1 factor (ABI 1.80 vs 1.40, BKG 1.10 vs 1.05, GAS
    1.06 vs 1.03, HSL 1.10 vs 1.05, VC3 1.18 vs 1.09).

    The identity is (ex-right date, title, ratio) and NOT the provider's
    `event_id`, which is what differs between the copies. Two genuinely separate
    issues on one ex-date would have to share all three to collide, and a real
    pair does not: ABI's own two events differ by title, and GIC's 100% rights
    issue and 10% stock dividend on one date differ by both.

    Deduplicating here rather than at ingest is deliberate — `fa_share_events`
    stays a faithful record of what the feed served, so the duplication remains
    auditable and a later provider fix needs no backfill.
    """
    out: dict[dt.date, list[ShareEvent]] = {}
    seen: set[tuple] = set()
    for e in events:
        if e.event_code != "ISS" or e.exright_date is None:
            continue
        if quarter_of(e.exright_date) != period:
            continue
        key = (e.exright_date, e.title_en, e.ratio)
        if key in seen:
            continue
        seen.add(key)
        out.setdefault(e.exright_date, []).append(e)
    return out


def _quarter_grid(first: str, last: str) -> list[str]:
    out, p = [], first
    while quarter_key(p) <= quarter_key(last):
        out.append(p)
        p = shift_quarter(p, -1)
    return out


def compute_adjustments(
    events: list[ShareEvent],
    shares_by_period: dict[str, float],
) -> dict[str, Adjustment]:
    """One `Adjustment` per quarter on a CONTIGUOUS grid.

    Every field is LOCAL to its quarter. The cumulative factor BA writes as
    K(Q_i -> Q_0), and the reconciliation, belong to whoever owns the window —
    see `window_factor`. A per-quarter reconciliation is wrong, because the
    ex-right and listing dates fall in different quarters (BIG's 6% dividend
    went ex in Q2/2025 and listed in Q3).

    THE GRID IS CONTIGUOUS, NOT "THE QUARTERS THAT HAVE A SHARE COUNT", and BIG
    is why: its 2024-Q4 charter capital is missing from the store while a 5.2%
    stock dividend went ex on 03/12/2024 — inside that very quarter. Keyed on
    the filed quarters alone there is no 2024-Q4 row at all, so that factor was
    silently dropped and every window spanning it understated K. A quarter with
    no share count still gets a row, carrying its announcements.

    A missing share count is therefore NOT a data fault here. It costs that
    quarter its own EPS_adj, and it disqualifies the quarter as a window
    ENDPOINT (`window_factor` checks that), but it does not stop the factors
    either side of it composing. `data_ok` is about the ANNOUNCEMENTS being
    usable — an unrecognised title, or a technical event of unknown size.
    """
    filed = sorted(shares_by_period, key=quarter_key)
    ex_quarters = [quarter_of(e.exright_date) for e in events
                   if e.event_code == "ISS" and e.exright_date is not None]
    if not filed and not ex_quarters:
        return {}
    known = filed + ex_quarters
    periods = _quarter_grid(min(known, key=quarter_key), max(known, key=quarter_key))
    out: dict[str, Adjustment] = {}

    for i, p in enumerate(periods):
        adj = Adjustment(period=p, shares=shares_by_period.get(p))
        # `shares_prev` is the most recent EARLIER quarter that filed one, which
        # may be more than one quarter back. `total_ratio` then spans the gap —
        # it is an audit figure, never the window math, which reads the
        # endpoints' share counts directly.
        earlier = [q for q in periods[:i] if shares_by_period.get(q)]
        adj.shares_prev = shares_by_period.get(earlier[-1]) if earlier else None
        if i == 0:
            adj.reason = "FIRST_PERIOD"
            out[p] = adj
            continue
        if adj.shares and adj.shares_prev:
            adj.total_ratio = adj.shares / adj.shares_prev

        dated = _by_exdate(events, p)
        # Additive within an ex-date, multiplicative across them — measured on
        # GIC (rights 100% + dividend 10% on one date gave exactly 2.10x) and
        # CDC (two dates compounded to exactly 2.40x).
        k = 1.0
        announced = 1.0
        for _, evs in sorted(dated.items()):
            g1 = 0.0
            allg = 0.0
            for e in evs:
                if e.group is None:
                    adj.data_ok = False
                    adj.reason = "UNKNOWN_TITLE"
                    continue
                r = e.ratio
                if e.group == 1 and (r is None or r <= 0):
                    # A technical event whose size we do not know cannot be
                    # applied, and must not be silently treated as 1.0 — that
                    # would leave earlier quarters unrestated with no trace.
                    adj.data_ok = False
                    adj.reason = "GROUP1_NO_RATIO"
                    continue
                r = r or 0.0
                allg += r
                if e.group == 1:
                    g1 += r
            k *= 1.0 + g1
            announced *= 1.0 + allg

        adj.k_technical = k
        adj.announced_ratio = announced
        if adj.data_ok:
            if adj.total_ratio is None:
                adj.reason = "NO_SHARES"
            elif abs(adj.total_ratio - 1.0) > CHANGE_EPS or k != 1.0:
                adj.reason = "OK"
            else:
                adj.reason = "NO_CHANGE"
        out[p] = adj

    return out


# --- the window ------------------------------------------------------------- #

@dataclass
class WindowFactor:
    """K(from_period -> to_period) and whether it may be applied."""

    k: float = 1.0
    group2_ratio: float | None = None
    reconciled: bool = False
    reason: str = "OK"
    #: The per-quarter rows the factor was built from, for the audit trail.
    periods: list[str] = field(default_factory=list)


def window_factor(
    adjustments: dict[str, Adjustment],
    from_period: str,
    to_period: str,
) -> WindowFactor:
    """The cumulative technical factor from `from_period` to `to_period`.

    K is the product of `k_technical` over the quarters AFTER `from_period` up
    to and including `to_period` — a factor applied to `from_period`'s share
    count to state it on `to_period`'s basis. K = 1 for `from_period ==
    to_period`, which is why the newest bar's EPS_adj is just its EPS.

    RECONCILED IS A PROPERTY OF THE WINDOW, NOT OF A QUARTER. The filed change
    over the window is `shares[to] / shares[from]`, and the technical part of it
    cannot exceed that. Where it does, the announcements describe an issue the
    share count never received — ABW's unexecuted 200% rights issue — and the
    window is refused so the chart draws unadjusted. Checking cumulatively is
    also what absorbs the ex-right/listing lag, which a per-quarter check reads
    as two separate faults.
    """
    if quarter_key(from_period) > quarter_key(to_period):
        return WindowFactor(reconciled=False, reason="BAD_RANGE")

    span = [p for p in sorted(adjustments, key=quarter_key)
            if quarter_key(from_period) < quarter_key(p) <= quarter_key(to_period)]
    out = WindowFactor(periods=span)

    start = adjustments.get(from_period)
    end = adjustments.get(to_period)
    if start is None or end is None or not start.shares or not end.shares:
        out.reason = "NO_SHARES"
        return out

    # Any row with a data problem poisons the window: an unrecognised title or
    # an unsized bonus could be the whole explanation for the change.
    bad = next((a for a in (adjustments[p] for p in span) if not a.data_ok), None)
    if bad is not None:
        out.reason = bad.reason
        return out

    k = 1.0
    for p in span:
        k *= adjustments[p].k_technical
    out.k = k

    cum_total = end.shares / start.shares
    if k > cum_total * (1.0 + RECONCILE_TOL):
        # The technical factor exceeds the whole filed change. Refuse, and hand
        # back k=1 so a caller that ignores `reconciled` still cannot restate.
        out.k = 1.0
        out.reason = "UNRECONCILED"
        return out

    out.group2_ratio = cum_total / k - 1.0
    out.reconciled = True
    out.reason = "OK"
    return out


def eps_adjusted(
    parent_profit: float | None,
    shares: float | None,
    k: float,
) -> float | None:
    """BA's EPS_adj: parent profit / (shares × K). Preferred dividends are 0.

    BA confirmed the zero (reply lần 1 Q8) and asked that the formula keep the
    term: no Vietnamese non-financial filer in the statement store reports a
    preferred dividend line, so subtracting it is subtracting nothing.
    """
    preferred_dividend = 0.0
    if parent_profit is None or not shares or not k:
        return None
    return (parent_profit - preferred_dividend) / (shares * k)


def sdr(
    adjustments: dict[str, Adjustment],
    period: str,
    lookback: int = 4,
) -> tuple[float | None, WindowFactor]:
    """BA's Share Dilution Rate over one year, in percent.

    SDR = shares[Q0] / (shares[Q-4] × K(Q-4 -> Q0)) - 1, i.e. exactly the share
    growth that was NOT technical. It is the window's `group2_ratio` by
    construction, which is why the two cannot disagree.
    """
    base = shift_quarter(period, lookback)
    wf = window_factor(adjustments, base, period)
    if not wf.reconciled or wf.group2_ratio is None:
        return None, wf
    return wf.group2_ratio * 100.0, wf
