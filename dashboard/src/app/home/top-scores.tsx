import Link from "next/link";
import type { HomeTopScore } from "@/lib/cached-data";
import { type Locale, t } from "@/lib/i18n";
import { scoreGradeClass, formatNumber } from "@/lib/format";
import { TABLE, TABLE_SCROLL, TD, TD_NUM, TD_SYMBOL, TH, TH_NUM_WRAP, THEAD, TR } from "@/lib/table";

/**
 * The homepage hook: the highest Final Scores among liquid names.
 *
 * Renders as a TABLE from `sm` up and as a CARD LIST below it. The rest of the
 * app answers narrow screens with horizontal scroll (16-18 column tables), but
 * this is the front door and takes real phone traffic, so it gets a genuine
 * small-screen layout instead. Scoped to this page only.
 */

// Mirrors the STATUS map in src/app/signal-pro/trend.tsx. Inlined rather than
// imported because that module is "use client" and carries the whole trend chart.
//
// The cost of that inlining is real and has already bitten once: when the status
// vocabulary was replaced, this copy still listed the old codes and EVERY row on
// the homepage silently rendered a dash — no type error, because both the column
// and this function are plain `string | null`. If the codes in trend_status change
// again, they must change here too. The four below are the whole set; a null
// status is normal (no readable daily structure) and correctly shows a dash.
function trendLabel(status: string | null, locale: Locale): string {
  const vi = locale === "vi";
  switch (status) {
    case "tao_day": return vi ? "Tạo đáy" : "Basing";
    case "tiep_dien": return vi ? "Tiếp diễn" : "Continuing";
    case "cho_mua": return vi ? "Chờ mua" : "Wait to buy";
    case "san_sang_mua": return vi ? "Sẵn sàng mua" : "Ready to buy";
    default: return "—";
  }
}

function Grade({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-fg-faint">—</span>;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-label rounded-sm font-medium ${scoreGradeClass(grade)}`}
    >
      {grade}
    </span>
  );
}

const num = (v: number | null) =>
  v === null ? <span className="text-fg-faint">—</span> : v.toFixed(0);

export function TopScores({
  rows,
  universeSize,
  locale,
}: {
  rows: HomeTopScore[];
  universeSize: number;
  locale: Locale;
}) {
  const seeAll = (
    <Link
      href="/signal-pro"
      className="inline-flex items-center gap-1 text-body font-medium text-accent hover:text-accent-hover"
    >
      {t(locale, "homeSeeAllPrefix")} {formatNumber(universeSize)}{" "}
      {t(locale, "homeSeeAllSuffix")} <span aria-hidden="true">→</span>
    </Link>
  );

  return (
    // `h-full flex flex-col` so the card fills the grid row and the "see all"
    // bar sits on its floor rather than wherever the table happens to end.
    <section className="rounded-lg border border-line bg-panel overflow-hidden h-full flex flex-col">
      <div className="px-4 py-4 sm:px-5 border-b border-line">
        <h2 className="text-title font-semibold text-fg tracking-tight">{t(locale, "homeTopScoresTitle")}</h2>
        <p className="mt-1 text-body-lg text-fg-muted">{t(locale, "homeTopScoresSub")}</p>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 sm:px-5 text-body-lg text-fg-muted">{t(locale, "homeNoScores")}</p>
      ) : (
        <>
          {/* Table — sm and up */}
          <div className={`hidden sm:block flex-1 min-h-0 ${TABLE_SCROLL}`}>
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={`${TH} pl-5`}>{t(locale, "symbol")}</th>
                  <th className={TH}>{t(locale, "homeColGrade")}</th>
                  {/* THE THREE SCORE HEADERS WRAP. Their labels are far wider
                      than the two-digit numbers beneath them — "TỔNG HỢP",
                      "KỸ THUẬT" and "CƠ BẢN" against "92" — and with
                      `whitespace-nowrap` the LABEL sizes the column. Adding the
                      Analysis column pushed the Vietnamese table 44px past its
                      container at 1024 for exactly that reason; wrapping hands
                      the width back to the data. English is unaffected either
                      way, which is the whole point of measuring in the longer
                      language. "RS 3M" is already shorter than its data. */}
                  <th className={TH_NUM_WRAP}>{t(locale, "homeColFinal")}</th>
                  <th className={TH_NUM_WRAP}>{t(locale, "homeColTa")}</th>
                  <th className={TH_NUM_WRAP}>{t(locale, "homeColFa")}</th>
                  <th className={TH_NUM_WRAP}>RS 3M</th>
                  <th className={TH}>{t(locale, "homeColTrend")}</th>
                  {/* Same last-column treatment as the TA Scanner, so the two
                      tables are read the same way. */}
                  <th className={`${TH} pr-5 text-right`}>{t(locale, "taOpenAnalysis")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.symbol} className={TR}>
                    <td className={`${TD_SYMBOL} pl-5`}>
                      <Link href={`/analysis/${r.symbol}`} className="hover:text-accent-hover">
                        {r.symbol}
                      </Link>
                    </td>
                    <td className={TD}>
                      <Grade grade={r.final_grade} />
                    </td>
                    <td className={`${TD_NUM} font-semibold`}>{r.final_score.toFixed(0)}</td>
                    <td className={`${TD_NUM} text-fg-muted`}>{num(r.ta_score)}</td>
                    <td className={`${TD_NUM} text-fg-muted`}>{num(r.fa_normalized)}</td>
                    <td className={`${TD_NUM} text-fg-muted`}>{num(r.rs_3m)}</td>
                    <td className={TD}>{trendLabel(r.trend_status, locale)}</td>
                    {/* REDUNDANT WITH THE TICKER, AND WORTH IT. The symbol cell
                        has always linked here, but a bare ticker in a column
                        headed "Symbol" does not announce that it goes anywhere
                        — a reader has to hover it to find out. The TA Scanner
                        solved that with a named link in the last column and
                        this is the same table read the same way, so it gets the
                        same control rather than a second convention. */}
                    <td className={`${TD} pr-5 text-right whitespace-nowrap`}>
                      <Link
                        href={`/analysis/${r.symbol}`}
                        title={t(locale, "taOpenAnalysisTitle")}
                        className="text-accent hover:underline"
                      >
                        {t(locale, "taOpenAnalysis")} →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards — below sm. NO "Analysis →" here: the whole card is
              already a Link to that page, and an anchor inside an anchor is
              invalid HTML that browsers silently unnest. */}
          <ul className="sm:hidden flex-1 divide-y divide-line-faint">
            {rows.map((r) => (
              <li key={r.symbol} className="px-4 py-3">
                <Link href={`/analysis/${r.symbol}`} className="flex items-center gap-3">
                  <span className="font-semibold text-accent w-14 shrink-0">{r.symbol}</span>
                  <Grade grade={r.final_grade} />
                  <span className="ml-auto text-title font-semibold tnum text-fg">
                    {r.final_score.toFixed(0)}
                  </span>
                </Link>
                <p className="mt-1 text-label text-fg-label tnum normal-case tracking-normal">
                  {t(locale, "homeColTa")} {num(r.ta_score)} · {t(locale, "homeColFa")}{" "}
                  {num(r.fa_normalized)} · RS 3M {num(r.rs_3m)} · {trendLabel(r.trend_status, locale)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-auto px-4 py-3 sm:px-5 border-t border-line bg-panel-2">{seeAll}</div>
    </section>
  );
}
