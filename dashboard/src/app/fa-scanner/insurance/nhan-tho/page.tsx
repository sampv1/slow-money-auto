import { getLocale } from "@/lib/i18n";
import { DataError } from "@/components/data-error";
import { InsPageClient } from "../ins-page-client";
import { loadInsTab } from "../ins-load";

export const revalidate = 0;

/**
 * Bảo hiểm → Nhân thọ.
 *
 * IT USES THE SHARED LAYOUT EVEN THOUGH ITS UNIVERSE IS EMPTY. §2.12.A is
 * explicit about all four halves: show the header, Nền tảng chung /50, Năng
 * lực Nhân thọ /38 and Định giá /12; say "Hiện chưa có mã Nhân thọ trong
 * universe chấm điểm"; and do NOT hide the tab, drop the header, invent NA rows
 * or score anything 0.
 *
 * That replaces the card grid this page used to be. The reasoning for the cards
 * was that an empty grid reads as a failed load — which §2.12.A answers better:
 * the structure stays, and one sentence says the absence is a universe fact.
 * Keeping a second layout for the one tab with no rows is also precisely what
 * §2.1 forbids.
 *
 * There is no listed pure-play life insurer in Vietnam; life exposure exists
 * only inside BVH, which is scored on the Holding rubric. So this tab fills in
 * by itself when one lists — nothing here names a symbol.
 */
export default async function Page({
  searchParams,
}: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const locale = await getLocale();
  const params = await searchParams;
  // The load is awaited OUTSIDE the JSX: a component constructed inside a
  // try/catch is not covered by it, because React renders it later.
  let d: Awaited<ReturnType<typeof loadInsTab>> | null = null;
  let loadError: unknown = null;
  try {
    d = await loadInsTab(params, "LIFE");
  } catch (e) {
    loadError = e;
  }
  if (loadError || !d) return <DataError error={loadError} locale={locale} />;

  return (
    <InsPageClient
      locale={locale} basePath="/fa-scanner/insurance/nhan-tho" typeCode="LIFE"
      quarters={d.quarters} selected={d.selected} minScore={d.minScore}
      ticker={d.ticker} rows={d.rows} emptyNote="insLifeEmptyUniverse"
    />
  );
}
