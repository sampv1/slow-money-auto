import Link from "next/link";
import type { HomeTopScore } from "@/lib/cached-data";
import { type Locale, t } from "@/lib/i18n";
import { scoreGradeClass } from "@/lib/format";
import { TABLE, TABLE_SCROLL, TD, TD_NUM, TD_SYMBOL, TH, TH_NUM, THEAD, TR } from "@/lib/table";

/**
 * The homepage hook: the highest Final Scores among liquid names.
 *
 * Renders as a TABLE from `sm` up and as a CARD LIST below it. The rest of the
 * app answers narrow screens with horizontal scroll (16-18 column tables), but
 * this is the front door and takes real phone traffic, so it gets a genuine
 * small-screen layout instead. Scoped to this page only.
 */

// Mirrors baseTypeLabel in src/app/signal-pro/price-base.tsx. Inlined rather
// than imported because that module is "use client" and carries the whole
// price-base chart; this is a two-value enum fixed by the BQS V8 spec.
function baseLabel(type: string | null, locale: Locale): string {
  if (type === "bottoming") return locale === "vi" ? "Tạo đáy" : "Bottoming";
  if (type === "continuation") return locale === "vi" ? "Tiếp diễn" : "Continuation";
  return "—";
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
      {t(locale, "homeSeeAllPrefix")} {universeSize.toLocaleString("en-US")}{" "}
      {t(locale, "homeSeeAllSuffix")} <span aria-hidden="true">→</span>
    </Link>
  );

  return (
    <section className="rounded-lg border border-line bg-panel overflow-hidden">
      <div className="px-4 py-4 sm:px-5 border-b border-line">
        <h2 className="text-title font-semibold text-fg tracking-tight">{t(locale, "homeTopScoresTitle")}</h2>
        <p className="mt-1 text-body-lg text-fg-muted">{t(locale, "homeTopScoresSub")}</p>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 sm:px-5 text-body-lg text-fg-muted">{t(locale, "homeNoScores")}</p>
      ) : (
        <>
          {/* Table — sm and up */}
          <div className={`hidden sm:block ${TABLE_SCROLL}`}>
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={`${TH} pl-5`}>{t(locale, "symbol")}</th>
                  <th className={TH}>{t(locale, "homeColGrade")}</th>
                  <th className={TH_NUM}>{t(locale, "homeColFinal")}</th>
                  <th className={TH_NUM}>{t(locale, "homeColTa")}</th>
                  <th className={TH_NUM}>{t(locale, "homeColFa")}</th>
                  <th className={TH_NUM}>RS 3M</th>
                  <th className={`${TH} pr-5`}>{t(locale, "homeColBase")}</th>
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
                    <td className={`${TD} pr-5`}>{baseLabel(r.base_type, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards — below sm */}
          <ul className="sm:hidden divide-y divide-line-faint">
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
                  {num(r.fa_normalized)} · RS 3M {num(r.rs_3m)} · {baseLabel(r.base_type, locale)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="px-4 py-3 sm:px-5 border-t border-line bg-panel-2">{seeAll}</div>
    </section>
  );
}
