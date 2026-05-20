import { supabase } from "@/lib/supabase";
import { getLocale, t } from "@/lib/i18n";
import { ScannerClient } from "./scanner-client";

export const revalidate = 0;

export type TriggeredSignal = {
  symbol: string;
  indicator: string;
  value: number | null;
};

export type LatestClose = {
  symbol: string;
  close: number;
  volume: number;
};

export default async function ScannerPage() {
  const locale = await getLocale();

  // Find the latest date that has signal data.
  const { data: latestRow, error: latestErr } = await supabase
    .from("ta_signals")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestErr) {
    return <p className="text-red-600">Error loading scanner: {latestErr.message}</p>;
  }

  if (!latestRow) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-4">{t(locale, "taScanner")}</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {t(locale, "taNoData")}
        </div>
      </div>
    );
  }

  const latestDate = latestRow.date as string;

  // Fetch all triggered signals for the latest date in one query.
  const { data: signalsRaw, error: signalsErr } = await supabase
    .from("ta_signals")
    .select("symbol,indicator,value")
    .eq("date", latestDate)
    .eq("triggered", true);

  if (signalsErr) {
    return <p className="text-red-600">Error loading signals: {signalsErr.message}</p>;
  }

  // Closing prices for ranking display.
  const { data: ohlcvRaw } = await supabase
    .from("ta_ohlcv")
    .select("symbol,close,volume")
    .eq("date", latestDate);

  const signals = (signalsRaw ?? []) as TriggeredSignal[];
  const closes = (ohlcvRaw ?? []) as LatestClose[];

  return (
    <ScannerClient
      latestDate={latestDate}
      signals={signals}
      closes={closes}
      locale={locale}
    />
  );
}
