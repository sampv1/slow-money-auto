import type { Locale } from "./i18n";

/**
 * Company identity for one symbol: name, and the industry it trades in.
 *
 * Assembled from THREE tables and resolved once, server-side, so no page has to
 * know the precedence rule:
 *   - `symbol_profile` (migration 050) — names + ICB L1..L4 codes, both languages
 *   - `icb_sectors`    (migration 050) — the bilingual label for each ICB code
 *   - `fa_industry`                    — FiinProX's own ICB L4 label, Vietnamese
 */
export type SymbolMeta = {
  symbol: string;
  nameVi: string | null;
  nameEn: string | null;
  shortVi: string | null;
  shortEn: string | null;
  industryVi: string | null;
  industryEn: string | null;
  /** Which table won. Not rendered — it exists so a surprising label is traceable. */
  industrySource: "fiinpro" | "icb" | null;
};

export type IcbLabel = { icb_code: string; level: number; name_vi: string; name_en: string };

/**
 * Resolve one symbol's industry. FIINPRO WINS.
 *
 * FiinProX is the authority by explicit decision: it is the source the FA rubrics
 * are built on, so if the two ever disagree the scanners and the score must be
 * talking about the same company. They agree on 1,588/1,592 symbols (99.7%)
 * today — the exceptions are label variance (`Dịch vụ hàng không` where ICB says
 * `Hàng không`), so this rule is about which wording is canonical far more often
 * than it is about which industry is correct.
 *
 * THE ENGLISH PROBLEM. `fa_industry.icb_industry` is a Vietnamese free-text
 * label with no code and no translation — taking it verbatim would leave the
 * English page showing Vietnamese for every symbol FiinProX has, which is all of
 * them. So the label is bridged back to an ICB code by matching it against
 * `icb_sectors.name_vi`, which recovers the English for 99.7% of symbols. Where
 * the wording does not match anything (the aviation trio), English falls back to
 * the Vietnamese text: showing `Dịch vụ hàng không` to an English reader is worse
 * than showing `Hàng không`, but showing nothing is worse still.
 */
export function resolveIndustry(
  fiinLabel: string | null | undefined,
  icbL4Code: string | null | undefined,
  labelsByCode: Map<string, IcbLabel>,
  enByVi: Map<string, string>,
): Pick<SymbolMeta, "industryVi" | "industryEn" | "industrySource"> {
  const fiin = fiinLabel?.trim();
  if (fiin) {
    return {
      industryVi: fiin,
      industryEn: enByVi.get(fiin) ?? fiin,
      industrySource: "fiinpro",
    };
  }
  const label = icbL4Code ? labelsByCode.get(icbL4Code) : undefined;
  if (label) {
    return {
      industryVi: label.name_vi,
      industryEn: label.name_en,
      industrySource: "icb",
    };
  }
  return { industryVi: null, industryEn: null, industrySource: null };
}

/** Index `icb_sectors` for the two lookups `resolveIndustry` needs. */
export function indexIcbLabels(labels: IcbLabel[]): {
  labelsByCode: Map<string, IcbLabel>;
  enByVi: Map<string, string>;
} {
  const labelsByCode = new Map<string, IcbLabel>();
  const enByVi = new Map<string, string>();
  for (const l of labels) {
    // L4 is the display level — it is the granularity FiinProX publishes, so it
    // is the only level the two sources can be compared at.
    if (l.level === 4) {
      labelsByCode.set(l.icb_code, l);
      // First writer wins: a Vietnamese label shared by two codes (Ngân hàng
      // appears at several levels) must map to one English string, not flap.
      if (!enByVi.has(l.name_vi)) enByVi.set(l.name_vi, l.name_en);
    }
  }
  return { labelsByCode, enByVi };
}

// --- Reading a SymbolMeta in the current locale ------------------------------
//
// Every call site goes through these rather than picking a field, so "which
// language is this column in" has one answer per page instead of one per cell.

/** The short, display-length company name — 'Hòa Phát', not the legal name. */
export function metaShortName(m: SymbolMeta | undefined, locale: Locale): string | null {
  if (!m) return null;
  // Falls through to the other language before giving up: a name in the wrong
  // language still identifies the company, a blank cell does not.
  return (locale === "en" ? m.shortEn ?? m.shortVi : m.shortVi ?? m.shortEn) ?? null;
}

/** The full legal name — 'Công ty Cổ phần Tập đoàn Hòa Phát'. */
export function metaFullName(m: SymbolMeta | undefined, locale: Locale): string | null {
  if (!m) return null;
  return (locale === "en" ? m.nameEn ?? m.nameVi : m.nameVi ?? m.nameEn) ?? null;
}

export function metaIndustry(m: SymbolMeta | undefined, locale: Locale): string | null {
  if (!m) return null;
  return (locale === "en" ? m.industryEn ?? m.industryVi : m.industryVi ?? m.industryEn) ?? null;
}

/**
 * `symbol -> industry label`, already in the reader's language, for the symbols
 * on one page.
 *
 * This is what crosses the server/client boundary. The full SymbolMeta map is
 * 0.42 MB and carries four name fields plus both languages of every industry —
 * serialising that into the RSC payload of a client-rendered scanner would put
 * all of it in the HTML on every load. Narrowed to the page's own symbols and
 * one language, it is ~50 KB.
 *
 * Symbols with no industry are omitted rather than mapped to null, so the object
 * stays sparse and `industry[sym] ?? "—"` is the only check a caller needs.
 */
export function industryMapFor(
  symbols: string[],
  meta: Map<string, SymbolMeta>,
  locale: Locale,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of symbols) {
    const label = metaIndustry(meta.get(s), locale);
    if (label) out[s] = label;
  }
  return out;
}

/**
 * The distinct industries present in `symbols`, in the current locale, sorted
 * for a filter dropdown.
 *
 * Built from the rows actually on the page rather than from all 87 ICB sectors:
 * an option that matches nothing is a dead end, and on a filtered scanner most
 * of them would be.
 */
export function industryOptions(
  symbols: string[],
  industry: Record<string, string>,
  locale: Locale,
): string[] {
  // Takes the same localised record the column renders from, not the SymbolMeta
  // map: this runs in a client component, and the meta map never crosses the
  // RSC boundary (see industryMapFor).
  const seen = new Set<string>();
  for (const s of symbols) {
    const label = industry[s];
    if (label) seen.add(label);
  }
  // localeCompare with the Vietnamese collator: plain sort puts 'Đ' after 'Z'
  // because it compares UTF-16 code units, which scatters the Đ-initial
  // industries (Điện, Đồ uống, Đầu tư) to the bottom of the list.
  return [...seen].sort((a, b) => a.localeCompare(b, locale === "en" ? "en" : "vi"));
}
