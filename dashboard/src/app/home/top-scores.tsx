import Link from "next/link";
import type { HomeTopScore } from "@/lib/cached-data";
import { type Locale, t } from "@/lib/i18n";
import { scoreGradeClass } from "@/lib/format";

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
  if (!grade) return <span className="text-gray-300">—</span>;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs rounded font-medium ${scoreGradeClass(grade)}`}
    >
      {grade}
    </span>
  );
}

const num = (v: number | null) =>
  v === null ? <span className="text-gray-300">—</span> : v.toFixed(0);

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
      className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:text-indigo-900"
    >
      {t(locale, "homeSeeAllPrefix")} {universeSize.toLocaleString("en-US")}{" "}
      {t(locale, "homeSeeAllSuffix")} <span aria-hidden="true">→</span>
    </Link>
  );

  return (
    <section className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-4 sm:px-5 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">{t(locale, "homeTopScoresTitle")}</h2>
        <p className="mt-1 text-sm text-gray-600">{t(locale, "homeTopScoresSub")}</p>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 sm:px-5 text-sm text-gray-500">{t(locale, "homeNoScores")}</p>
      ) : (
        <>
          {/* Table — sm and up */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="text-left font-medium px-5 py-2">{t(locale, "symbol")}</th>
                  <th className="text-left font-medium px-3 py-2">{t(locale, "homeColGrade")}</th>
                  <th className="text-right font-medium px-3 py-2">{t(locale, "homeColFinal")}</th>
                  <th className="text-right font-medium px-3 py-2">{t(locale, "homeColTa")}</th>
                  <th className="text-right font-medium px-3 py-2">{t(locale, "homeColFa")}</th>
                  <th className="text-right font-medium px-3 py-2">RS 3M</th>
                  <th className="text-left font-medium px-5 py-2">{t(locale, "homeColBase")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.symbol} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-2.5">
                      <Link
                        href={`/analysis/${r.symbol}`}
                        className="font-semibold text-indigo-700 hover:text-indigo-900"
                      >
                        {r.symbol}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <Grade grade={r.final_grade} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                      {r.final_score.toFixed(0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                      {num(r.ta_score)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                      {num(r.fa_normalized)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                      {num(r.rs_3m)}
                    </td>
                    <td className="px-5 py-2.5 text-gray-600">{baseLabel(r.base_type, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards — below sm */}
          <ul className="sm:hidden divide-y divide-gray-100">
            {rows.map((r) => (
              <li key={r.symbol} className="px-4 py-3">
                <Link href={`/analysis/${r.symbol}`} className="flex items-center gap-3">
                  <span className="font-semibold text-indigo-700 w-14 shrink-0">{r.symbol}</span>
                  <Grade grade={r.final_grade} />
                  <span className="ml-auto text-lg font-semibold tabular-nums text-gray-900">
                    {r.final_score.toFixed(0)}
                  </span>
                </Link>
                <p className="mt-1 text-xs text-gray-500 tabular-nums">
                  {t(locale, "homeColTa")} {num(r.ta_score)} · {t(locale, "homeColFa")}{" "}
                  {num(r.fa_normalized)} · RS 3M {num(r.rs_3m)} · {baseLabel(r.base_type, locale)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="px-4 py-3 sm:px-5 border-t border-gray-200 bg-gray-50">{seeAll}</div>
    </section>
  );
}
