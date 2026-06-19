/**
 * Tolerant parser for the FA Excel exports (FiinProX financials + PE).
 *
 * Designed to survive format drift: it does NOT assume fixed sheet names, a
 * fixed header row, or fixed column positions. Instead it:
 *   - finds the header row by locating the "Mã" (symbol) cell,
 *   - finds the symbol column from that cell,
 *   - maps each metric to columns by matching Vietnamese label patterns
 *     (accent/case-insensitive substring) scanned across ALL sheets,
 *   - detects the quarter/year from each column header (3 label formats).
 *
 * Mirrors scripts/fa/excel_import.py. Patterns live here (in code) by design.
 */

import * as XLSX from "xlsx";

// ---- normalization -------------------------------------------------------

/** lowercase, strip Vietnamese diacritics, collapse whitespace. */
export function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseQuarter(header: unknown): string | null {
  const s = String(header ?? "");
  let m = s.match(/Quý:\s*Q([1-4])[\s\S]*?Năm:\s*(\d{4})/);
  if (m) return `${m[2]}-Q${m[1]}`;
  m = s.match(/Quý:\s*Q([1-4])\.(\d{4})/);
  if (m) return `${m[2]}-Q${m[1]}`;
  m = s.match(/Q([1-4])\/(\d{4})/);
  if (m) return `${m[2]}-Q${m[1]}`;
  return null;
}

function parseYear(header: unknown): number | null {
  const m = String(header ?? "").match(/Năm:\s*(\d{4})/);
  return m ? Number(m[1]) : null;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const f = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(f) ? f : null;
}

// ---- field label patterns (the only format-specific knowledge) -----------

type FieldDef = { field: string; test: (h: string) => boolean };

const FINANCIAL_FIELDS: FieldDef[] = [
  { field: "eps", test: (h) => h.includes("eps") },
  { field: "gross_margin", test: (h) => h.includes("bien lai gop") },
  { field: "net_margin", test: (h) => h.includes("bien lai rong") },
  { field: "revenue", test: (h) => h.includes("doanh thu thuan") },
  { field: "st_debt", test: (h) => h.includes("vay") && h.includes("ngan han") },
  { field: "lt_debt", test: (h) => h.includes("vay") && h.includes("dai han") },
  { field: "total_equity", test: (h) => h.includes("von chu so huu") },
  { field: "roe_ttm", test: (h) => h.includes("roe") },
];

// ---- result types --------------------------------------------------------

export type QuarterlyRow = {
  symbol: string; period: string; year: number; quarter: number;
  eps?: number | null; gross_margin?: number | null; net_margin?: number | null;
  roe_ttm?: number | null; revenue?: number | null; st_debt?: number | null;
  lt_debt?: number | null; total_equity?: number | null;
};
export type AnnualPeRow = { symbol: string; year: number; pe: number | null };

export type DetectedField = { field: string; sheet: string; columns: number; periods: string[] };

export type ParseResult =
  | { type: "financials"; rows: QuarterlyRow[]; detected: DetectedField[]; periods: string[]; symbolCount: number; warnings: string[] }
  | { type: "pe"; rows: AnnualPeRow[]; detected: DetectedField[]; years: number[]; symbolCount: number; warnings: string[] };

// ---- sheet helpers -------------------------------------------------------

type Grid = unknown[][];

function sheetGrid(ws: XLSX.WorkSheet): Grid {
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
}

/** Locate the header row + symbol column by finding the "Mã" cell. */
function findHeader(grid: Grid): { headerIdx: number; symbolCol: number } | null {
  const limit = Math.min(grid.length, 20);
  for (let r = 0; r < limit; r++) {
    const row = grid[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (norm(row[c]) === "ma") return { headerIdx: r, symbolCol: c };
    }
  }
  return null;
}

// ---- financials ----------------------------------------------------------

function parseFinancials(wb: XLSX.WorkBook): ParseResult {
  const warnings: string[] = [];
  const detected: DetectedField[] = [];
  const merged = new Map<string, QuarterlyRow>();

  for (const def of FINANCIAL_FIELDS) {
    let placed = false;
    for (const sheetName of wb.SheetNames) {
      const grid = sheetGrid(wb.Sheets[sheetName]);
      const hdr = findHeader(grid);
      if (!hdr) continue;
      const headerRow = grid[hdr.headerIdx] || [];
      // columns of this sheet that belong to this field (label match + a quarter)
      const cols: { idx: number; period: string }[] = [];
      for (let c = hdr.symbolCol + 1; c < headerRow.length; c++) {
        const cell = headerRow[c];
        const period = parseQuarter(cell);
        if (period && def.test(norm(cell))) cols.push({ idx: c, period });
      }
      if (cols.length === 0) continue;
      // first sheet that yields this field wins
      for (let r = hdr.headerIdx + 1; r < grid.length; r++) {
        const row = grid[r] || [];
        const sym = String(row[hdr.symbolCol] ?? "").trim().toUpperCase();
        if (!sym) continue;
        for (const { idx, period } of cols) {
          const val = toNum(row[idx]);
          if (val === null) continue;
          const key = `${sym}|${period}`;
          let mrow = merged.get(key);
          if (!mrow) {
            const [y, q] = period.split("-Q");
            mrow = { symbol: sym, period, year: Number(y), quarter: Number(q) };
            merged.set(key, mrow);
          }
          (mrow as Record<string, unknown>)[def.field] = val;
        }
      }
      detected.push({ field: def.field, sheet: sheetName, columns: cols.length, periods: [...new Set(cols.map((c) => c.period))].sort() });
      placed = true;
      break;
    }
    if (!placed) warnings.push(`Could not locate any column for "${def.field}"`);
  }

  const rows = [...merged.values()];
  const periods = [...new Set(rows.map((r) => r.period))].sort();
  const symbolCount = new Set(rows.map((r) => r.symbol)).size;
  return { type: "financials", rows, detected, periods, symbolCount, warnings };
}

// ---- PE ------------------------------------------------------------------

function parsePe(wb: XLSX.WorkBook): ParseResult {
  const warnings: string[] = [];
  const detected: DetectedField[] = [];
  const rows: AnnualPeRow[] = [];
  let usedSheet = "";

  for (const sheetName of wb.SheetNames) {
    const grid = sheetGrid(wb.Sheets[sheetName]);
    const hdr = findHeader(grid);
    if (!hdr) continue;
    const headerRow = grid[hdr.headerIdx] || [];
    const cols: { idx: number; year: number }[] = [];
    for (let c = hdr.symbolCol + 1; c < headerRow.length; c++) {
      const cell = headerRow[c];
      const year = parseYear(cell);
      if (year && norm(cell).includes("p/e")) cols.push({ idx: c, year });
    }
    if (cols.length === 0) continue;
    for (let r = hdr.headerIdx + 1; r < grid.length; r++) {
      const row = grid[r] || [];
      const sym = String(row[hdr.symbolCol] ?? "").trim().toUpperCase();
      if (!sym) continue;
      for (const { idx, year } of cols) {
        const val = toNum(row[idx]);
        if (val !== null) rows.push({ symbol: sym, year, pe: val });
      }
    }
    detected.push({ field: "pe", sheet: sheetName, columns: cols.length, periods: cols.map((c) => String(c.year)).sort() });
    usedSheet = sheetName;
    break;
  }

  if (!usedSheet) warnings.push("Could not locate any annual P/E columns");
  const years = [...new Set(rows.map((r) => r.year))].sort();
  const symbolCount = new Set(rows.map((r) => r.symbol)).size;
  return { type: "pe", rows, detected, years, symbolCount, warnings };
}

// ---- entry point ---------------------------------------------------------

/** Parse a workbook buffer. `hint` ('financials'|'pe') from the UI selector;
 *  if omitted, auto-detect. */
export function parseWorkbook(buf: ArrayBuffer | Uint8Array, hint?: "financials" | "pe"): ParseResult {
  const wb = XLSX.read(buf, { type: "array" });

  if (hint === "pe") return parsePe(wb);
  if (hint === "financials") return parseFinancials(wb);

  // auto-detect: prefer financials if any quarterly metric is found
  const fin = parseFinancials(wb);
  if (fin.rows.length > 0) return fin;
  return parsePe(wb);
}
