"use client";

import Link from "next/link";
import { type Locale, t } from "@/lib/i18n";

/**
 * "Bắt đầu từ đâu?" — the five-step journey (§11).
 *
 * THE ORDER IS THE CONTENT. market → company → risk → valuation → Signal Pro,
 * and §11.2 forbids the earlier shape that split entry timing and position
 * sizing into steps 4–5 and lost the RISK step altogether. So the numbers here
 * encode a real sequence rather than decorating five cards, which is the only
 * reason they earn a numeral at all.
 *
 * It sits OUTSIDE the table's scroll container (§3): scrolling the page must
 * reach it, and cramming it into a final table row is called out as wrong.
 *
 * THE BUTTONS ONLY EXIST WHERE THEY GO SOMEWHERE. §11.3 is explicit that these
 * are proposed UX, "nếu triển khai nút, phải có đích hoạt động thực sự" — so
 * steps 01–04 scroll to a real anchor on this page, and 05 links to the actual
 * Signal Pro route. Step 05 deliberately passes NO query parameters: the spec
 * forbids inventing one or pretending the destination is pre-filtered by
 * ticker, and the route takes none today.
 */

const STEPS = [
  { n: "01", title: "secStep1", body: "secStep1Body", cta: "secStep1Cta", target: "#sec-context" },
  { n: "02", title: "secStep2", body: "secStep2Body", cta: "secStep2Cta", target: "#sec-table" },
  { n: "03", title: "secStep3", body: "secStep3Body", cta: "secStep3Cta", target: "#sec-table" },
  { n: "04", title: "secStep4", body: "secStep4Body", cta: "secStep4Cta", target: "#sec-table" },
  { n: "05", title: "secStep5", body: "secStep5Body", cta: "secStep5Cta", href: "/signal-pro" },
] as const;

/**
 * Scroll a step's target into view and put focus on it.
 *
 * Focus, not just scroll: §11.3 asks for "đặt focus phù hợp", and a keyboard
 * user who is scrolled somewhere without their focus moving has not actually
 * been taken anywhere. The targets carry `tabIndex={-1}` so they can receive it
 * without entering the tab order.
 */
function goTo(sel: string) {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.focus({ preventScroll: true });
}

const CARD = "bg-panel border border-line px-4 py-4 flex flex-col h-full";
const CTA =
  "mt-3 self-start sec-note border border-line px-2 py-1.5 min-h-[32px] touch-manipulation text-accent hover:bg-panel-2 hover:underline";

export function SecGuide({ locale }: { locale: Locale }) {
  return (
    <section className="mt-8" aria-label={t(locale, "secGuideTitle")}>
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start mb-4">
        <div>
          <h2 className="text-title font-semibold leading-tight">{t(locale, "secGuideTitle")}</h2>
          <p className="text-body-lg text-fg-muted mt-1">{t(locale, "secGuideSub")}</p>
          <p className="sec-body text-fg-muted mt-2 max-w-[76ch]">
            {t(locale, "secGuidePhilosophy")}
          </p>
        </div>
        <div className="bg-panel-2 border border-line px-4 py-3 lg:max-w-[38ch]">
          <div className="sec-note uppercase tracking-wide text-fg-label mb-1">
            {t(locale, "secGuidePrincipleTitle")}
          </div>
          <p className="sec-body text-fg">{t(locale, "secGuidePrinciple")}</p>
        </div>
      </div>

      {/* Three cards then two — §11.1. The second row's two cards each take half
          the width rather than leaving a third slot empty, and there is no
          sixth step. */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {STEPS.slice(0, 3).map((s) => (
          <Step key={s.n} step={s} locale={locale} />
        ))}
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mt-4">
        {STEPS.slice(3).map((s) => (
          <Step key={s.n} step={s} locale={locale} />
        ))}
      </div>
    </section>
  );
}

function Step({
  step, locale,
}: { step: (typeof STEPS)[number]; locale: Locale }) {
  return (
    <div className={CARD}>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-body-lg font-semibold text-fg-label">{step.n}</span>
        <h3 className="text-body-lg font-semibold leading-snug">{t(locale, step.title)}</h3>
      </div>
      <p className="sec-body text-fg-muted mt-2 flex-1">{t(locale, step.body)}</p>
      {"href" in step ? (
        <Link href={step.href} className={CTA}>
          {t(locale, step.cta)} →
        </Link>
      ) : (
        <button type="button" className={CTA} onClick={() => goTo(step.target)}>
          {t(locale, step.cta)} ↓
        </button>
      )}
    </div>
  );
}
