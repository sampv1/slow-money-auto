"""Parse the FA Excel exports into normalized rows for the DB.

Two workbooks (both in initial_fa_data/ by default):

  Data_FiinPro.xlsx  — multi-sheet financials. Each sheet has a 6-row preamble,
                       the header on row 7 (0-indexed: row index 7), data from
                       row 8. ID columns A-D = STT, Mã, Tên, Sàn. Metric columns
                       carry a quarter in their header (3 label formats). Sheets:
                         EPS                 -> single-quarter EPS ("EPS Qn/YYYY")
                         Biên lãi gộp + ròng -> gross & net margin ("Biên lãi … Qn/YYYY")
                         Doanh thu           -> single-quarter net revenue
                         Nợ ngắn hạn         -> short-term financial debt
                         Nợ dài hạn          -> long-term financial debt
                         Vốn chủ             -> total owner's equity
                         ROE                 -> ROE % (TTM)
                       Sheets are joined by symbol into one row per (symbol, period).

  PE.xlsx            — annual P/E (Chỉ số năm) per symbol, 2021-2025. Header on
                       row 0; ID columns A-D; metric columns carry a year.

Everything is an additive upsert of only the rows present — partial files are
expected and re-importable.
"""

import re

import openpyxl

HEADER_ROW_IDX = 7   # Data_FiinPro: 0-indexed header row
SYMBOL_COL = 1       # column B

# Quarter labels appear in 3 forms across sheets:
#   "… Quý: Q2 ⏎ Năm: 2024 …"      (statement line items)
#   "… Quý: Q2.2024 …"             (TTM ratios, shares)
#   "EPS Q2/2024" / "Biên lãi gộp Q2/2024"  (pre-computed per-quarter metrics)
_RE_Q_NAM = re.compile(r"Quý:\s*Q([1-4]).*?Năm:\s*(\d{4})", re.DOTALL)
_RE_Q_DOT = re.compile(r"Quý:\s*Q([1-4])\.(\d{4})")
_RE_Q_SLASH = re.compile(r"Q([1-4])/(\d{4})")


def _parse_quarter(header: str):
    """Return 'YYYY-Qn' from a header cell, or None if no quarter is present."""
    if not header:
        return None
    for rx in (_RE_Q_NAM, _RE_Q_DOT, _RE_Q_SLASH):
        m = rx.search(str(header))
        if m:
            return f"{m.group(2)}-Q{m.group(1)}"
    return None


def _num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if f != f else f  # drop NaN


def _sheet_quarter_map(ws, header_row_idx: int, want_prefix: str | None = None):
    """Map column index -> 'YYYY-Qn' for metric columns of one sheet.

    `want_prefix`: when a sheet holds several blocks (e.g. the margin sheet has
    revenue + gross profit + net profit + gross margin + net margin), restrict to
    columns whose header starts with this text so we pick the right block.
    """
    header = None
    for i, row in enumerate(ws.iter_rows(min_row=header_row_idx + 1, max_row=header_row_idx + 1, values_only=True)):
        header = row
        break
    out = {}
    for idx, cell in enumerate(header or []):
        if idx < 4 or cell is None:
            continue
        text = str(cell)
        if want_prefix and not text.strip().startswith(want_prefix):
            continue
        q = _parse_quarter(text)
        if q:
            out[idx] = q
    return out


def _read_sheet_metric(ws, header_row_idx: int, want_prefix: str | None = None):
    """Return {symbol: {period: value}} for the matching metric block of a sheet."""
    colmap = _sheet_quarter_map(ws, header_row_idx, want_prefix)
    data: dict[str, dict[str, float]] = {}
    for row in ws.iter_rows(min_row=header_row_idx + 2, values_only=True):
        sym = row[SYMBOL_COL] if len(row) > SYMBOL_COL else None
        if not sym:
            continue
        sym = str(sym).strip().upper()
        per: dict[str, float] = {}
        for idx, period in colmap.items():
            if idx < len(row):
                val = _num(row[idx])
                if val is not None:
                    per[period] = val
        if per:
            data[sym] = per
    return data


def parse_fiinpro(path: str) -> list[dict]:
    """Parse Data_FiinPro.xlsx → list of fa_quarterly row dicts (only present cells).

    One dict per (symbol, period) that has at least one metric value.
    """
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)

    eps = _read_sheet_metric(wb["EPS"], HEADER_ROW_IDX, want_prefix="EPS ")
    gm = _read_sheet_metric(wb["Biên lãi gộp + ròng"], HEADER_ROW_IDX, want_prefix="Biên lãi gộp")
    nm = _read_sheet_metric(wb["Biên lãi gộp + ròng"], HEADER_ROW_IDX, want_prefix="Biên lãi ròng")
    rev = _read_sheet_metric(wb["Doanh thu"], HEADER_ROW_IDX, want_prefix="3. Doanh thu")
    std = _read_sheet_metric(wb["Nợ ngắn hạn"], HEADER_ROW_IDX, want_prefix="1.10")
    ltd = _read_sheet_metric(wb["Nợ dài hạn"], HEADER_ROW_IDX, want_prefix="2.8")
    eq = _read_sheet_metric(wb["Vốn chủ"], HEADER_ROW_IDX, want_prefix="II. VỐN CHỦ")
    roe = _read_sheet_metric(wb["ROE"], HEADER_ROW_IDX, want_prefix="ROE")

    blocks = {
        "eps": eps, "gross_margin": gm, "net_margin": nm, "revenue": rev,
        "st_debt": std, "lt_debt": ltd, "total_equity": eq, "roe_ttm": roe,
    }

    # union of all (symbol, period) keys that appear in any block
    rows: dict[tuple[str, str], dict] = {}
    for field, data in blocks.items():
        for sym, per in data.items():
            for period, val in per.items():
                key = (sym, period)
                r = rows.get(key)
                if r is None:
                    year, q = period.split("-Q")
                    r = {"symbol": sym, "period": period, "year": int(year), "quarter": int(q)}
                    rows[key] = r
                r[field] = val
    return list(rows.values())


def parse_pe(path: str) -> list[dict]:
    """Parse PE.xlsx → list of fa_annual_pe row dicts (only present cells)."""
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb["Sheet1"] if "Sheet1" in wb.sheetnames else wb.worksheets[0]
    # header on row 0; year columns carry "Năm: YYYY"
    header = next(ws.iter_rows(min_row=1, max_row=1, values_only=True))
    colyear = {}
    for idx, cell in enumerate(header):
        if idx < 4 or cell is None:
            continue
        m = re.search(r"Năm:\s*(\d{4})", str(cell))
        if m:
            colyear[idx] = int(m.group(1))
    out = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        sym = row[SYMBOL_COL] if len(row) > SYMBOL_COL else None
        if not sym:
            continue
        sym = str(sym).strip().upper()
        for idx, year in colyear.items():
            if idx < len(row):
                val = _num(row[idx])
                if val is not None:
                    out.append({"symbol": sym, "year": year, "pe": val})
    return out
