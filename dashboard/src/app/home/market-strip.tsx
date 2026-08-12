import type { MacroHeadline } from "@/lib/cached-data";
import { type Locale, t } from "@/lib/i18n";
import { pnlColor } from "@/lib/format";

/**
 * The four-number band at the top of the homepage.
 *
 * The FCI value is READ from macro_series (`macro_fci_core`), never recomputed —
 * the index is frozen, so a second derivation must not exist in this tree. The
 * regime word below is presentation only: it labels the stored number, it does
 * not re-score it.
 *
 * Thresholds match the sign convention used on /macro: the FCI is a conditions
 * index where positive = tighter. The dead band around zero exists so a value of
 * -0.036 reads "Neutral" rather than flipping to "Easing" on noise.
 */
function fciRegime(v: number): { key: "homeFciEasing" | "homeFciNeutral" | "homeFciTight"; cls: string } {
  if (v <= -0.5) return { key: "homeFciEasing", cls: "text-green-600" };
  if (v >= 0.5) return { key: "homeFciTight", cls: "text-red-600" };
  return { key: "homeFciNeutral", cls: "text-gray-600" };
}

function Cell({
  label,
  value,
  sub,
  subClass,
}: {
  label: string;
  value: string;
  sub?: string;
  subClass?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] uppercase tracking-wide text-gray-500 truncate">{label}</span>
      <span className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-base font-semibold tabular-nums text-gray-900">{value}</span>
        {sub && <span className={`text-xs tabular-nums ${subClass ?? "text-gray-500"}`}>{sub}</span>}
      </span>
    </div>
  );
}

const DASH = "—";

export function MarketStrip({ data, locale }: { data: MacroHeadline; locale: Locale }) {
  const { vnindex, fci, usdvnd, interbank } = data;
  const fciWord = fci ? fciRegime(fci.value) : null;
  // The strip is dated by the freshest observation it shows; the series run on
  // different schedules, so pinning it to one of them would misdate the others.
  const asOf = [vnindex?.date, fci?.date, usdvnd?.date, interbank?.date]
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
        <h2 className="text-sm font-semibold text-gray-700">{t(locale, "homeMarketToday")}</h2>
        {asOf && <span className="text-xs tabular-nums text-gray-400">{asOf}</span>}
      </div>
      {/* 2-up on phones, 4-up from sm. Long Vietnamese labels truncate rather
          than wrapping the row into uneven heights. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
        <Cell
          label="VN-Index"
          value={vnindex ? vnindex.value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : DASH}
          sub={
            vnindex?.changePct !== null && vnindex?.changePct !== undefined
              ? `${vnindex.changePct >= 0 ? "+" : ""}${vnindex.changePct.toFixed(2)}%`
              : undefined
          }
          subClass={pnlColor(vnindex?.changePct ?? null)}
        />
        <Cell
          label={t(locale, "homeFci")}
          value={fci ? fci.value.toFixed(2) : DASH}
          sub={fciWord ? t(locale, fciWord.key) : undefined}
          subClass={fciWord?.cls}
        />
        <Cell
          label={t(locale, "homeUsdVnd")}
          value={usdvnd ? usdvnd.value.toLocaleString("en-US", { maximumFractionDigits: 0 }) : DASH}
        />
        <Cell
          label={t(locale, "homeInterbank")}
          value={interbank ? `${interbank.value.toFixed(2)}%` : DASH}
        />
      </div>
    </section>
  );
}
