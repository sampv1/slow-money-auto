"""Real-estate (BĐS) fundamental scoring — 13 criteria, max 100.

The manufacturing rubric fits a property developer badly: revenue is
recognition-lumpy, "inventory" is land bank, and customer advances (Người mua
trả tiền trước) — the real forward-revenue signal — are invisible to it. This
module implements the separate rubric in `data/tieu_chi_cham_diem_bds.xlsx`.

TWO HALVES, deliberately split:
  parse_workbook()  FiinProX export -> raw metrics per symbol (no scoring)
  score_metrics()   raw metrics -> points (no Excel)

so a rubric change re-scores straight from `fa_re_metrics` in the database. The
rubric changed four times in two days; re-exporting from FiinProX every time is
not a workflow.

WEIGHTS AND BANDS ARE READ FROM THE SPREADSHEET, never hard-coded here. The
sheet is the contract; this file is the engine.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from statistics import median

# The four quarters that make up "TTM" and the trailing-average inventory.
TTM_QUARTERS = [("Q3", 2025), ("Q4", 2025), ("Q1", 2026), ("Q2", 2026)]
BALANCE_QUARTER = ("Q2", 2026)
AS_OF_PERIOD = "2026-Q2"

# "20 quý gần nhất" for C12/C13. Q3/Q4 2026 are unpublished, so the 20 most
# recent quarters end at Q2.2026 — exactly the window the rubric asks for.
VALUATION_WINDOW = [f"Q{q}.{y}" for y in (2021, 2022, 2023, 2024, 2025, 2026) for q in (1, 2, 3, 4)]
VALUATION_WINDOW = VALUATION_WINDOW[
    VALUATION_WINDOW.index("Q3.2021"): VALUATION_WINDOW.index("Q2.2026") + 1
]

CFO_YEARS = (2023, 2024, 2025)

# Criteria whose denominator is total borrowings. A company with NO borrowings
# scores maximum on each rather than going unscored — "how exposed is this
# company to its debt" has an unambiguous best case at zero.
#
# C10 is NOT here: its own rule (spreadsheet, C10 "Tra cứu") tests cash flow
# FIRST, so a debt-free company that is burning cash does not collect a free 8.
DEBT_DENOMINATOR_CRITERIA = (4, 6, 8)

# Criteria scored on a raw ratio/count rather than a percentage.
NON_PERCENT_CRITERIA = (7, 9)

# Below this much scorable weight a symbol gets no `normalized_score`, so it
# contributes nothing to the Final Score rather than a number assembled from a
# handful of criteria. 21 of the 118 filed no Q2/2026 balance sheet at all.
RE_MIN_SCORABLE = 80.0

# Sheet roles in the FiinProX export. Sheet names have already changed once
# (Sheet3 -> "CFO quý - năm"), so they are resolved by ROLE, with the tolerated
# aliases listed here rather than assumed positionally.
SHEET_ALIASES = {
    "balance": ("Sheet1",),
    "cogs": ("Sheet2",),
    "cfo": ("CFO quý - năm", "Sheet3"),
    "valuation": ("PB năm", "Sheet4"),
    "wip": ("Chi Phí SXKD dài hạn",),
    "pb_quarterly": ("PB",),
    "pe_quarterly": ("PE",),
}

# The FiinProX row that carries the column headers (0-indexed).
HEADER_ROW = 7
ICB_REAL_ESTATE = "Bất động sản"


# ---------------------------------------------------------------------------
# Rubric
# ---------------------------------------------------------------------------
@dataclass
class Criterion:
    idx: int
    name: str
    weight: float
    formula: str
    bands: list[tuple[float | None, float | None, float, str]]


def parse_bands(text: str) -> list[tuple[float | None, float | None, float, str]]:
    """'<50%: 0\\n50-100%: 2\\n…' -> [(lo, hi, points, label)]; None = open-ended.

    Bounds are kept in the units the sheet writes them in (percent for most,
    plain ratio for C7, a count for C9); `score_band` converts the value, not
    the bands, so what is stored matches what a reader sees in the spreadsheet.
    """
    out = []
    for line in str(text).split("\n"):
        line = line.strip()
        if not line or ":" not in line:
            continue
        cond, pts = line.rsplit(":", 1)
        label = cond.strip()
        cond = cond.replace("%", "").replace("x", "").replace("năm", "").strip()
        points = float(pts.strip())
        if cond.startswith("<"):
            out.append((None, float(cond[1:]), points, label))
        elif cond.startswith(">"):
            out.append((float(cond[1:]), None, points, label))
        elif "-" in cond:
            lo, hi = cond.split("-", 1)
            out.append((float(lo), float(hi), points, label))
        else:
            out.append((float(cond), float(cond), points, label))
    return out


def load_rubric(criteria_xlsx: str) -> dict[int, Criterion]:
    """Read weights + bands out of `data/tieu_chi_cham_diem_bds.xlsx`."""
    import pandas as pd

    df = pd.read_excel(criteria_xlsx, header=0)
    df.columns = [str(c).strip() for c in df.columns]
    rubric = {}
    for _, r in df.iterrows():
        idx = int(r["STT"])
        rubric[idx] = Criterion(
            idx=idx,
            name=" ".join(str(r["Tiêu chí"]).split()),
            weight=float(r["Trọng số"]),
            formula=" ".join(str(r["Công thức tính"]).split()),
            bands=parse_bands(r["Cách chấm điểm"]),
        )
    total = sum(c.weight for c in rubric.values())
    if round(total) != 100:
        raise ValueError(f"rubric weights sum to {total}, expected 100")
    for c in rubric.values():
        band_max = max(p for _, _, p, _ in c.bands)
        if band_max != c.weight:
            raise ValueError(
                f"C{c.idx}: band max {band_max} != weight {c.weight} — "
                "the spreadsheet disagrees with itself"
            )
    return rubric


def score_band(crit: Criterion, value: float | None) -> tuple[float | None, str | None]:
    """-> (points, matched band label). None when the value is not computable."""
    if value is None:
        return None, None
    v = value if crit.idx in NON_PERCENT_CRITERIA else value * 100
    for lo, hi, pts, label in crit.bands:
        if (lo is None and v < hi) or (hi is None and v > lo) or (
            lo is not None and hi is not None and lo <= v <= hi
        ):
            return pts, label
    return None, None


# ---------------------------------------------------------------------------
# Parsing: FiinProX export -> raw metrics
# ---------------------------------------------------------------------------
def _resolve_sheets(xl) -> dict[str, str]:
    resolved = {}
    for role, aliases in SHEET_ALIASES.items():
        match = next((a for a in aliases if a in xl.sheet_names), None)
        if match is None:
            raise ValueError(
                f"workbook has no sheet for role {role!r}; tried {aliases}, "
                f"found {xl.sheet_names}"
            )
        resolved[role] = match
    return resolved


def _find_column(columns, metric: str, quarter=None, year=None, annual=False) -> str:
    """Exactly one column matching metric + period, or raise.

    Tolerant of the header variants FiinProX actually emits: 'Quý: Q2' vs
    'Quý: 2', and 'Lưu chuyển thuần' vs 'Lưu chuyển tiền thuần'.
    """
    hits = []
    for c in columns:
        s = str(c)
        if metric.lower() not in s.lower():
            continue
        if year is not None and f"Năm: {year}" not in s:
            continue
        if annual != ("Hàng năm" in s):
            continue
        if quarter is not None and f"Quý: {quarter}" not in s and f"Quý: Q{quarter}" not in s:
            continue
        hits.append(c)
    if len(hits) != 1:
        raise ValueError(
            f"column lookup {metric!r} quarter={quarter} year={year} annual={annual} "
            f"matched {len(hits)} columns: {hits}"
        )
    return hits[0]


def parse_workbook(path: str) -> tuple[list[dict], list[dict]]:
    """FiinProX BĐS export -> (industry rows, metric rows).

    Industry rows cover EVERY symbol in the export (so the manufacturing scanner
    knows what to exclude); metric rows cover only the real-estate ones.
    """
    import pandas as pd

    xl = pd.ExcelFile(path)
    sh = _resolve_sheets(xl)

    def load(role: str):
        df = pd.read_excel(path, sheet_name=sh[role], header=HEADER_ROW)
        return df[df["Mã"].notna()].set_index("Mã")

    balance, cogs, cfo = load("balance"), load("cogs"), load("cfo")
    valuation, wip = load("valuation"), load("wip")
    pb_q, pe_q = load("pb_quarterly"), load("pe_quarterly")

    # ---- classification, for the whole export ----
    industry = []
    for sym, row in balance.iterrows():
        icb = row.get("Phân ngành - ICB L4")
        icb = None if pd.isna(icb) else str(icb).strip()
        industry.append({
            "symbol": str(sym).strip(),
            "industry_group": _group_for(icb),
            "icb_industry": icb,
            "source": "fiinpro",
        })

    universe = [r["symbol"] for r in industry if r["industry_group"] == "real_estate"]

    # ---- column handles, resolved once ----
    q, y = BALANCE_QUARTER
    B = lambda metric, qq=q, yy=y: _find_column(balance.columns, metric, qq[1], yy)
    col = {
        "equity": B("VỐN CHỦ SỞ HỮU"),
        "cash": B("Tiền và tương đương tiền"),
        "debt_st": B("Vay và nợ thuê tài chính ngắn hạn"),
        "debt_lt": B("Vay và nợ thuê tài chính dài hạn"),
        "current_assets": B("TÀI SẢN NGẮN HẠN"),
        "current_liabilities": B("Nợ phải trả ngắn hạn"),
        "advance_st": B("Người mua trả tiền trước ngắn hạn"),
        "advance_lt": B("Người mua trả tiền trước dài hạn"),
        "advance_st_yoy": B("Người mua trả tiền trước ngắn hạn", "Q2", 2025),
        "advance_lt_yoy": B("Người mua trả tiền trước dài hạn", "Q2", 2025),
        # C11 pairs CUSTOMER receivables against CUSTOMER advances — both sides
        # of the ratio describe the same counterparty.
        "receivable_st": B("Phải thu ngắn hạn của khách hàng"),
        "receivable_lt": B("Phải thu khách hang dài hạn"),   # sic: FiinProX typo
    }
    inv_cols = {qq: _find_column(balance.columns, "Hàng tồn kho", qq[0][1], qq[1]) for qq in TTM_QUARTERS}
    wip_cols = {qq: _find_column(wip.columns, "Chi phí sản xuất, kinh doanh dở dang dài hạn",
                                 qq[0][1], qq[1]) for qq in TTM_QUARTERS}
    cogs_cols = {qq: _find_column(cogs.columns, "Giá vốn hàng bán", qq[0][1], qq[1])
                 for qq in TTM_QUARTERS}
    cfo_cols = {qq: _find_column(cfo.columns, "hoạt động kinh doanh", qq[0][1], qq[1])
                for qq in TTM_QUARTERS}
    cfo_year_cols = {yy: _find_column(cfo.columns, "hoạt động kinh doanh", year=yy, annual=True)
                     for yy in CFO_YEARS}
    pb_now_col = next(c for c in valuation.columns if str(c).startswith("P/B") and "TTM" in str(c))
    pe_now_col = next(c for c in valuation.columns if str(c).startswith("P/E") and "TTM" in str(c))
    pb_win = [c for c in pb_q.columns if _quarter_label(c) in VALUATION_WINDOW]
    pe_win = [c for c in pe_q.columns if _quarter_label(c) in VALUATION_WINDOW]
    if len(pb_win) != 20 or len(pe_win) != 20:
        raise ValueError(f"valuation window is {len(pb_win)}/{len(pe_win)} quarters, expected 20/20")

    def num(df, sym, column):
        if sym not in df.index or column not in df.columns:
            return None
        v = df.loc[sym, column]
        return None if pd.isna(v) else float(v)

    metrics = []
    for sym in universe:
        m: dict = {k: num(balance, sym, c) for k, c in col.items()}
        m["inventory"] = [num(balance, sym, inv_cols[qq]) for qq in TTM_QUARTERS]
        m["wip_lt"] = [num(wip, sym, wip_cols[qq]) for qq in TTM_QUARTERS]
        m["cogs"] = [num(cogs, sym, cogs_cols[qq]) for qq in TTM_QUARTERS]
        m["cfo_quarterly"] = [num(cfo, sym, cfo_cols[qq]) for qq in TTM_QUARTERS]
        m["cfo_annual"] = {str(yy): num(cfo, sym, cfo_year_cols[yy]) for yy in CFO_YEARS}
        m["pb_now"] = num(valuation, sym, pb_now_col)
        m["pe_now"] = num(valuation, sym, pe_now_col)
        m["pb_hist"] = [num(pb_q, sym, c) for c in pb_win]
        m["pe_hist"] = [num(pe_q, sym, c) for c in pe_win]
        metrics.append({
            "symbol": sym,
            "as_of_period": AS_OF_PERIOD,
            "metrics": m,
            "company_name": _text(balance, sym, "Tên công ty"),
            "exchange": _text(balance, sym, "Sàn"),
        })
    return industry, metrics


def _text(df, sym, column):
    import pandas as pd
    if sym not in df.index or column not in df.columns:
        return None
    v = df.loc[sym, column]
    return None if pd.isna(v) else str(v).strip()


def _quarter_label(header) -> str | None:
    m = re.search(r"Quý:\s*(Q[1-4]\.\d{4})", str(header))
    return m.group(1) if m else None


def _group_for(icb: str | None) -> str:
    """ICB L4 -> rubric group. A BINARY split, by explicit decision (2026-08-14).

    Real estate is exactly `Phân ngành - ICB L4 == "Bất động sản"`. Everything
    else — construction and financials included — keeps the manufacturing
    rubric, which is where they are scored today.

    An earlier cut gave Xây dựng and the financial industries their own group
    values, following FA_GROUPS_DESIGN.md's eventual three-group plan. That was
    premature: neither has a rubric to be scored by, and a group value with no
    rubric behind it only invites the manufacturing page to subtract 247 symbols
    into a page that does not exist. `fa_industry`'s check constraint still
    permits those values for when their rubrics land.
    """
    return "real_estate" if icb == ICB_REAL_ESTATE else "manufacturing"


# ---------------------------------------------------------------------------
# Scoring: raw metrics -> points
# ---------------------------------------------------------------------------
@dataclass
class ReScore:
    symbol: str
    total: float = 0.0
    scorable: float = 0.0
    n_scored: int = 0
    breakdown: dict = field(default_factory=dict)

    @property
    def normalized(self) -> float | None:
        if self.scorable < RE_MIN_SCORABLE or self.scorable == 0:
            return None
        return round(100 * self.total / self.scorable, 2)


def _z(x):
    return 0.0 if x is None else float(x)


def _div(a, b):
    if a is None or b in (None, 0):
        return None
    return a / b


def score_metrics(symbol: str, m: dict, rubric: dict[int, Criterion]) -> ReScore:
    """Score one symbol from its raw metric blob. No Excel, no network."""
    # Tồn kho tổng = Hàng tồn kho + Chi phí SXKD dở dang dài hạn (rubric C1-C3).
    # For a developer the long-term WIP line IS land bank; FiinProX books it
    # outside inventory, and for some names it is the larger half.
    #
    # The two halves are NOT treated alike. A blank WIP line means the company
    # genuinely has none (most do), so it reads as zero; a blank inventory line
    # means the quarter was not filed, so that quarter has no total at all.
    # Collapsing both to zero understated the average and inflated C2's turnover.
    inv = [None if htk is None else htk + _z(w)
           for htk, w in zip(m["inventory"], m["wip_lt"])]
    inv_now = inv[-1]
    known = [x for x in inv if x is not None]
    avg_inv = sum(known) / len(known) if known else None

    advance = _z(m["advance_st"]) + _z(m["advance_lt"])
    advance_yoy = _z(m["advance_st_yoy"]) + _z(m["advance_lt_yoy"])
    debt = _z(m["debt_st"]) + _z(m["debt_lt"])
    receivable = _z(m["receivable_st"]) + _z(m["receivable_lt"])
    cogs_ttm = sum(abs(_z(x)) for x in m["cogs"])
    cfo_ttm = sum(_z(x) for x in m["cfo_quarterly"])
    equity = m["equity"]

    # A symbol that filed NOTHING has blank borrowing columns — that is absence
    # of data, not absence of debt, and must not collect the zero-debt maximum.
    reported = equity is not None
    no_debt = reported and debt == 0

    cfo_years = [m["cfo_annual"].get(str(y)) for y in CFO_YEARS]
    pb_hist = [x for x in m["pb_hist"] if x is not None]
    pe_hist = [x for x in m["pe_hist"] if x is not None]
    pb_med = median(pb_hist) if pb_hist else None
    pe_med = median(pe_hist) if pe_hist else None
    pe_now = m["pe_now"]

    values = {
        1: _div(inv_now, equity),
        2: _div(cogs_ttm, avg_inv),
        3: _div(advance, inv_now),
        4: _div(advance, debt),
        5: _div(advance - advance_yoy, advance_yoy) if advance_yoy else None,
        6: _div(m["cash"], debt),
        7: _div(m["current_assets"], m["current_liabilities"]),
        8: _div(m["debt_st"], debt),
        9: (sum(1 for x in cfo_years if x > 0)
            if all(x is not None for x in cfo_years) else None),
        10: _div(cfo_ttm, debt),
        11: _div(receivable, advance) if advance else None,
        12: _div(m["pb_now"], pb_med),
        # A negative P/E (loss-making) makes the ratio meaningless in either term.
        13: (_div(pe_now, pe_med)
             if pe_med is not None and pe_med > 0 and pe_now is not None and pe_now > 0
             else None),
    }

    out = ReScore(symbol=symbol)
    for idx in sorted(rubric):
        crit = rubric[idx]
        value = values[idx]
        points, band = score_band(crit, value)
        note = None

        if no_debt and idx in DEBT_DENOMINATOR_CRITERIA:
            points, band, note = crit.weight, "no borrowings", "zero_debt"

        # C10's own two-step rule, which OVERRIDES the zero-debt maximum:
        #   Bước 1  CFO TTM <= 0            -> 0, stop, debt is irrelevant
        #           CFO TTM > 0, no debt    -> max, stop
        #   Bước 2  CFO TTM > 0, debt > 0   -> score on the bands
        if idx == 10 and reported:
            if cfo_ttm <= 0:
                points, band, note = 0.0, "CFO TTM ≤ 0", "cfo_not_positive"
            elif debt == 0:
                points, band, note = crit.weight, "CFO > 0, no borrowings", "cfo_positive_no_debt"

        # `note` is a STABLE KEY, not prose. The dashboard is bilingual and
        # renders this string directly, so English prose stored here would show
        # untranslated on the Vietnamese page. See NOTE_LABELS in lib/fa-re.ts.
        entry = {"value": None if value is None else round(value, 6),
                 "points": points, "weight": crit.weight, "band": band}
        if note:
            entry["note"] = note
        out.breakdown[f"c{idx}"] = entry

        if points is not None:
            out.total += points
            out.scorable += crit.weight
            out.n_scored += 1
    return out
