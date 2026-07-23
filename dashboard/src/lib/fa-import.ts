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

// Raw statement components — NOT persisted (not fa_quarterly columns). Used only
// to DERIVE eps / gross_margin / net_margin when the workbook ships raw items
// instead of the pre-computed columns above — the single-sheet "DE - Doanh
// nghiệp" template. The formulas reproduce FiinProX's own pre-computed values
// exactly: eps = parent profit ÷ shares, gross_margin = gross profit ÷ revenue,
// net_margin = net profit ÷ revenue (margins are fractions — no ×100).
// Mirror: scripts/fa/excel_import.py.
type RawComponents = { parentProfit?: number; shares?: number; grossProfit?: number; netProfit?: number };

const RAW_COMPONENT_FIELDS: { field: keyof RawComponents; test: (h: string) => boolean }[] = [
  // "17.1. Lợi nhuận sau thuế phân bổ cho chủ sở hữu" (EPS numerator)
  { field: "parentProfit", test: (h) => h.includes("loi nhuan sau thue") && h.includes("chu so huu") },
  // "Số CP lưu hành hiện thời"
  { field: "shares", test: (h) => h.includes("cp luu hanh") },
  // "5. Lợi nhuận gộp…" (distinct from margin "bien lai gop")
  { field: "grossProfit", test: (h) => h.includes("loi nhuan gop") },
  // "18. Lợi nhuận sau thuế thu nhập doanh nghiệp" (net_margin numerator)
  { field: "netProfit", test: (h) => h.includes("loi nhuan sau thue") && h.includes("thu nhap doanh nghiep") },
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

  // Parse every sheet's grid + header once (findHeader locates the "Mã" row).
  const sheets = wb.SheetNames
    .map((name) => {
      const grid = sheetGrid(wb.Sheets[name]);
      return { name, grid, hdr: findHeader(grid) };
    })
    .filter((s): s is { name: string; grid: Grid; hdr: { headerIdx: number; symbolCol: number } } => s.hdr !== null);

  // Scan all sheets for the columns matching `test` (label + a parseable quarter);
  // the FIRST sheet that yields any matching column wins. `sink` is called per
  // cell value. Returns detection info, or null if no sheet matched.
  function scanField(test: (h: string) => boolean, field: string, sink: (sym: string, period: string, val: number) => void): DetectedField | null {
    for (const { name, grid, hdr } of sheets) {
      const headerRow = grid[hdr.headerIdx] || [];
      const cols: { idx: number; period: string }[] = [];
      for (let c = hdr.symbolCol + 1; c < headerRow.length; c++) {
        const cell = headerRow[c];
        const period = parseQuarter(cell);
        if (period && test(norm(cell))) cols.push({ idx: c, period });
      }
      if (cols.length === 0) continue;
      for (let r = hdr.headerIdx + 1; r < grid.length; r++) {
        const row = grid[r] || [];
        const sym = String(row[hdr.symbolCol] ?? "").trim().toUpperCase();
        if (!sym) continue;
        for (const { idx, period } of cols) {
          const val = toNum(row[idx]);
          if (val !== null) sink(sym, period, val);
        }
      }
      return { field, sheet: name, columns: cols.length, periods: [...new Set(cols.map((c) => c.period))].sort() };
    }
    return null;
  }

  function rowFor(sym: string, period: string): QuarterlyRow {
    const key = `${sym}|${period}`;
    let mrow = merged.get(key);
    if (!mrow) {
      const [y, q] = period.split("-Q");
      mrow = { symbol: sym, period, year: Number(y), quarter: Number(q) };
      merged.set(key, mrow);
    }
    return mrow;
  }

  // 1) Direct DB metrics from pre-computed columns. Old multi-sheet files fill
  //    all 8; the single-sheet raw template fills 5 (eps/margins derived below).
  const satisfied = new Set<string>();
  for (const def of FINANCIAL_FIELDS) {
    const d = scanField(def.test, def.field, (sym, period, val) => {
      (rowFor(sym, period) as Record<string, unknown>)[def.field] = val;
    });
    if (d) { detected.push(d); satisfied.add(def.field); }
  }

  // 2) Raw statement components (not persisted) → keyed parallel map.
  const rawByKey = new Map<string, RawComponents>();
  for (const def of RAW_COMPONENT_FIELDS) {
    scanField(def.test, def.field, (sym, period, val) => {
      const key = `${sym}|${period}`;
      const rc = rawByKey.get(key) ?? {};
      rc[def.field] = val;
      rawByKey.set(key, rc);
    });
  }

  // 3) Derivation pass: fill eps/gross_margin/net_margin from raw components when
  //    the pre-computed metric is absent (pre-computed always wins → old files
  //    are untouched). Guard denominators against 0/null.
  const derivedPeriods: Record<"eps" | "gross_margin" | "net_margin", Set<string>> = {
    eps: new Set(), gross_margin: new Set(), net_margin: new Set(),
  };
  for (const [key, rc] of rawByKey) {
    const existing = merged.get(key);
    const revenue = existing?.revenue ?? null;
    const set: { eps?: number; gross_margin?: number; net_margin?: number } = {};
    if ((existing?.eps ?? null) === null && rc.parentProfit != null && rc.shares) set.eps = rc.parentProfit / rc.shares;
    if ((existing?.gross_margin ?? null) === null && rc.grossProfit != null && revenue) set.gross_margin = rc.grossProfit / revenue;
    if ((existing?.net_margin ?? null) === null && rc.netProfit != null && revenue) set.net_margin = rc.netProfit / revenue;
    const fields = Object.keys(set) as (keyof typeof set)[];
    if (fields.length === 0) continue;
    const sep = key.indexOf("|");
    const row = existing ?? rowFor(key.slice(0, sep), key.slice(sep + 1));
    Object.assign(row, set);
    for (const f of fields) derivedPeriods[f].add(row.period);
  }
  for (const f of ["eps", "gross_margin", "net_margin"] as const) {
    if (derivedPeriods[f].size > 0) {
      detected.push({ field: `${f} (derived)`, sheet: "(computed from raw items)", columns: 0, periods: [...derivedPeriods[f]].sort() });
      satisfied.add(f);
    }
  }

  for (const def of FINANCIAL_FIELDS) {
    if (!satisfied.has(def.field)) warnings.push(`Could not locate a column for "${def.field}"`);
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
