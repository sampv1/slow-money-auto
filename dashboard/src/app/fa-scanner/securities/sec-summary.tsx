"use client";

import Link from "next/link";
import { type Locale, t } from "@/lib/i18n";
import {
  type SecScore,
  SEC_SUMMARY_QUALITY,
  coverageColor,
  secStatusLabel,
  secStatusStyle,
  secDisplayScore,
  groupVerdict,
} from "@/lib/fa-securities";
import { TABLE, TABLE_FREEZE, THEAD_STICKY, TH, TH_WRAP, TH_NUM_WRAP, TR, TD_NUM, TD_SYMBOL } from "@/lib/table";
import { PinButton } from "@/components/pin-button";
import { usePinnedSymbols } from "@/lib/pinned-symbols";

/**
 * Tab 1 — the plain-language summary (V11v3 sheet 49).
 *
 * Same rows, same engine, same session as the detail tab: this receives the
 * ALREADY-FILTERED array and reads only fields the scorer wrote. It never
 * recomputes a score, a coverage or a gate — two tabs disagreeing about one
 * symbol is the exact failure AT18 checks for, and the cheapest way to
 * guarantee they cannot is to give them one source and no arithmetic.
 *
 * THE HARD PART IS LANGUAGE, NOT LAYOUT. "No data" and "bad result" look
 * identical once both are a small number in a cell, so sheet 49's UI-S01..S04
 * fix four distinct renderings:
 *
 *   3/4     measured
 *   0/4     measured, worst band — red, a real judgement about the broker
 *   N/A     not measured; grey, and it left the denominator entirely
 *   3/4*    measured on a method that has not passed its own gate
 *
 * Three columns the spec asks for — business model, headline driver, main
 * risk — are owned by Research/Data and have no source in the pipeline. They
 * render an explicit "not yet recorded" rather than an empty cell, because a
 * blank reads as "this broker has no notable driver" instead of "nobody has
 * written one down yet".
 */

function Cell({
  earned,
  max,
  provisional,
}: {
  earned: number | null | undefined;
  max: number | null | undefined;
  provisional?: boolean;
}) {
  if (earned === null || earned === undefined || !max) {
    return <span className="text-fg-muted">N/A</span>;
  }
  return (
    <span className={earned === 0 ? "text-down font-semibold" : ""}>
      {Number(earned).toFixed(0)}/{max}
      {provisional ? <span className="text-fg-muted">*</span> : null}
    </span>
  );
}

// Above ten-fold, a percentage stops informing and starts looking like a bug.
// These are real: a broker whose margin book was near zero a year ago prints
// +5,247.8% (WSS) or +1,315.4% (VUA) on live data. "x53.5" says the same thing
// in four characters and reads as a magnitude rather than a typo. The cutoff is
// on the RATIO, so it is symmetric and never fires on an ordinary quarter.
const GROWTH_AS_MULTIPLE = 10;

function Growth({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-fg-muted">N/A</span>;
  const up = value >= 0;
  const text = value >= GROWTH_AS_MULTIPLE
    ? `\u00d7${(1 + value).toFixed(1)}`
    : `${up ? "+" : ""}${(value * 100).toFixed(1)}%`;
  return <span className={up ? "text-up" : "text-down"}>{text}</span>;
}

export function SecSummaryTable({ rows, locale }: { rows: SecScore[]; locale: Locale }) {
  const { pinned, toggle } = usePinnedSymbols();

  return (
    <>
      <div className={TABLE_FREEZE}>
        <table className={TABLE}>
          <thead className={THEAD_STICKY}>
            <tr>
              <th className={TH}>{t(locale, "symbol")}</th>
              <th className={TH_NUM_WRAP} title={t(locale, "secFinalScoreTip")}>
                {t(locale, "secFinalScore")}
              </th>
              <th className={TH_WRAP} title={t(locale, "secCoverageTip")}>
                {t(locale, "secSumDisclosure")}
              </th>
              <th className={TH_WRAP}>{t(locale, "secSumModel")}</th>
              <th className={TH_WRAP}>{t(locale, "secSumDriver")}</th>
              <th className={TH_WRAP}>{t(locale, "secSumRisk")}</th>
              <th className={TH_WRAP} title={t(locale, "secC4Hint")}>{t(locale, "secC4")}</th>
              <th className={TH_NUM_WRAP} title={t(locale, "secC7Hint")}>
                {t(locale, "secSumMarginGrowth")}
              </th>
              <th className={TH_NUM_WRAP} title={t(locale, "secC2Hint")}>
                {t(locale, "secSumCoreGrowth")}
              </th>
              {SEC_SUMMARY_QUALITY.map((g) => (
                <th
                  key={g.key}
                  className={TH_NUM_WRAP}
                  title={t(locale, `${g.label}Hint` as Parameters<typeof t>[1])}
                >
                  {t(locale, g.label)}
                </th>
              ))}
              <th className={TH_NUM_WRAP} title={t(locale, "secC18Hint")}>
                {t(locale, "secC18")}
              </th>
              <th className={TH_NUM_WRAP} title={t(locale, "secBlockValuationHint")}>
                {t(locale, "secBlockValuation")}
              </th>
              <th className={TH_NUM_WRAP}>{t(locale, "secSumTotal")}</th>
              <th className={TH_WRAP} title={t(locale, "secGateTip")}>
                {t(locale, "secSumVerdict")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cr = r.criteria ?? {};
              // ONE rule for both tabs — see secDisplayScore. Computing it
              // here is how the two tabs disagreed in the first place.
              const score = secDisplayScore(r);
              const passed = r.publish_gate === "PASS";
              return (
                <tr key={r.symbol} className={TR}>
                  <td className={TD_SYMBOL}>
                    <span className="flex items-center gap-1">
                      <PinButton
                        symbol={r.symbol}
                        pinned={pinned.has(r.symbol)}
                        onToggle={toggle}
                        locale={locale}
                      />
                      <Link
                        href={`/analysis/${r.symbol}`}
                        title={t(locale, "taOpenAnalysisTitle")}
                        className="text-accent hover:underline"
                      >
                        {r.symbol}
                      </Link>
                    </span>
                  </td>
                  <td className={`${TD_NUM} font-semibold`}>
                    {score.provisional ? (
                      <span className="text-fg-muted" title={t(locale, "secProvisional")}>
                        {score.text}*
                      </span>
                    ) : (
                      score.text
                    )}
                  </td>
                  <td className="px-2 row-h whitespace-nowrap">
                    <span className={coverageColor(r.coverage)}>
                      {r.coverage === null ? "—" : `${Math.round(r.coverage * 100)}%`}
                    </span>
                    <span className="text-fg-label" title={secStatusLabel(locale, r.fa_status)}>
                      {" "}
                      · {r.data_group ?? "—"}
                    </span>
                  </td>
                  {/* Research-owned copy. NEVER derived from C1-C20 — a
                      business model inferred from scores would be the system
                      inventing an opinion and presenting it as analysis. Only
                      the first column carries the words; repeating them down
                      three columns read as a broken page rather than as
                      content nobody has written yet. */}
                  <td className="px-2 row-h text-body text-fg-muted italic">
                    {r.business_model_summary ?? t(locale, "secNarrativePending")}
                  </td>
                  <td className="px-2 row-h text-body text-fg-muted">
                    {r.key_driver_summary ?? <span className="text-fg-faint">—</span>}
                  </td>
                  <td className="px-2 row-h text-body text-fg-muted">
                    {r.key_risk_summary ?? <span className="text-fg-faint">—</span>}
                  </td>
                  {/* C4 has no source at all. The label is the wording the spec
                      fixes — never an inferred "under 2%", which would be a
                      number we do not have. */}
                  {/* No `whitespace-nowrap`: "Not determined" is the widest
                      thing in this column and the column is the least
                      important in the table, so it wraps rather than sizing
                      itself off a placeholder. */}
                  <td className="px-2 row-h text-body leading-tight">
                    {cr.c4?.status === "VALID" ? (
                      <>
                        <div>{r.market_share_pct?.toFixed(2)}%</div>
                        <div className="text-fg-label">
                          C4: <Cell earned={cr.c4.earned} max={cr.c4.available_max} />
                        </div>
                      </>
                    ) : (
                      <span className="text-fg-muted">{t(locale, "secSumShareUnknown")}</span>
                    )}
                  </td>
                  {/* The margin book's ACTUAL growth, with C7's score demoted
                      to a sub-line. This column previously showed "3/3" — the
                      score — under a header reading "margin book growth", which
                      is our opinion standing in for the fact. */}
                  <td className={`${TD_NUM} leading-tight`}>
                    {/* LABELLED and stacked. Side by side, "+50.4% / +11.6%"
                        does not say which number is which — and it held the
                        column at 138px, the widest on the tab. */}
                    <div>
                      <Growth value={r.margin_loan_growth_yoy_pct} />
                      <span className="text-fg-label"> YoY</span>
                    </div>
                    <div>
                      <Growth value={r.margin_loan_growth_qoq_pct} />
                      <span className="text-fg-label"> QoQ</span>
                    </div>
                    <div className="text-fg-label" title={t(locale, "secC7SubLine")}>
                      C7{" "}
                      <Cell
                        earned={cr.c7?.earned}
                        max={cr.c7?.available_max}
                        provisional={cr.c7?.tier === "PROVISIONAL"}
                      />
                    </div>
                  </td>
                  <td className={TD_NUM}>
                    <Growth value={cr.c2?.value} />
                  </td>
                  {/* Read straight off the row. Sheet 44: the backend owns
                      this sum and the UI must not re-add it from criteria[] —
                      a second implementation of the tier rules is what made
                      the two tabs disagree in V11v3.
                      The OFFICIAL side is shown; where a group also carries
                      provisional points (C9's proxy inside capital safety)
                      the `*` says the two differ. */}
                  {SEC_SUMMARY_QUALITY.map((g) => {
                    const grp = r.quality_groups?.[g.key];
                    const verdict = groupVerdict(
                      grp?.final_earned, grp?.final_available_max, locale);
                    // The provisional part gets its OWN line rather than a `*`
                    // on the official total: capital safety's 8/8 is official
                    // and C9's proxy is not, and one starred number cannot say
                    // which half is which.
                    const c9 = g.key === "capital_safety" ? cr.c9 : undefined;
                    return (
                      <td key={g.key} className={`${TD_NUM} leading-tight`}>
                        <div>
                          <Cell earned={grp?.final_earned} max={grp?.final_available_max} />
                        </div>
                        {/* Stacked, not appended. "4/10 · Trung bình" on one
                            line makes the column as wide as the sum of both;
                            stacked it is as wide as the longer one, which is
                            ~45px per column across three columns. */}
                        {verdict ? <div className="text-fg-label">{verdict}</div> : null}
                        {c9 && c9.status === "VALID" ? (
                          <div className="text-fg-label" title={t(locale, "secC9SubLine")}>
                            C9 {c9.earned}/{c9.available_max}*
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className={TD_NUM}>
                    <Cell
                      earned={cr.c18?.earned}
                      max={cr.c18?.available_max}
                      provisional={cr.c18?.tier === "PROVISIONAL"}
                    />
                  </td>
                  <td className={TD_NUM}>
                    <Cell
                      earned={r.valuation_score}
                      max={r.valuation_available_max}
                      provisional={cr.c20?.status === "VALID" && cr.c20?.tier === "PROVISIONAL"}
                    />
                  </td>
                  {/* THE SAME TIER AS THE HEADLINE. Reading earned/available
                      off the provisional tier while the headline shows the
                      official score puts two numbers in one row that do not
                      divide into each other — VCK read "65.7" beside "59/96",
                      which is 61.5%. Whichever tier the headline came from is
                      the one whose arithmetic is shown. */}
                  <td className={TD_NUM}>
                    <Cell
                      earned={passed ? r.final_earned : r.provisional_earned}
                      max={passed ? r.final_available_max : r.provisional_available_max}
                      provisional={!passed}
                    />
                  </td>
                  {/* The GATE, not the data group. The column beside the
                      score already says how much data there was; this says
                      whether the official score is published, and the two can
                      disagree — which is the whole point of having both. */}
                  <td className="px-2 row-h whitespace-nowrap">
                    <span
                      className={`inline-block border px-1.5 text-body font-semibold leading-tight ${secStatusStyle(r.fa_status)}`}
                    >
                      {t(locale, passed ? "secGatePass" : "secGateFail")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-body text-fg-label max-w-[76ch]">
        {t(locale, "secSumGroupNote")}
      </p>
    </>
  );
}
