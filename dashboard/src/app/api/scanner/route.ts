import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CACHE_TTL_SECONDS, TAG_TA, fetchAllPaged } from "@/lib/cached-data";
import type { LatestClose, TriggeredSignal } from "@/app/scanner/page";

// Triggered signals + closes for ONE date, keyed by date (unstable_cache folds
// the argument into the key). Same table reads and cache tag as the scanner
// page's server load — the client hits this when the user picks a different
// date, so the table swaps without a full-page navigation (a searchParams-only
// soft nav is served from the client Router Cache and won't re-render the
// server component). Universe (RS / avg-volume) is date-independent, so the
// client keeps the copy it already has and this route never re-sends it.
const getScannerSignals = unstable_cache(
  async (date: string): Promise<{ signals: TriggeredSignal[]; closes: LatestClose[] }> => {
    const [signals, closes] = await Promise.all([
      fetchAllPaged<TriggeredSignal>((from, to, withCount) =>
        supabase
          .from("ta_signals")
          .select("symbol,indicator,value", withCount ? { count: "exact" } : undefined)
          .eq("date", date)
          .eq("triggered", true)
          .order("symbol", { ascending: true })
          .order("indicator", { ascending: true })
          .range(from, to),
      ),
      fetchAllPaged<LatestClose>((from, to, withCount) =>
        supabase
          .from("ta_ohlcv")
          .select("symbol,close,volume", withCount ? { count: "exact" } : undefined)
          .eq("date", date)
          .order("symbol", { ascending: true })
          .range(from, to),
      ),
    ]);
    return { signals, closes };
  },
  ["scanner-signals"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA] },
);

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid or missing date" }, { status: 400 });
  }
  try {
    const data = await getScannerSignals(date);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
