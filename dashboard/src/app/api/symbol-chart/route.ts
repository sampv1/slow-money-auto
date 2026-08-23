import { NextResponse } from "next/server";
import { buildChartProps, getSymbolData } from "@/lib/chart-payload";

/**
 * Chart payload for one symbol, for the TA Scanner's inline chart.
 *
 * The scanner is a client component, so it cannot await a server read the way
 * the Analysis page does — but it must show the SAME chart. This route is the
 * bridge: it calls the same `getSymbolData` cache entry and the same
 * `buildChartProps` derivation the Analysis page uses, so neither the data nor
 * the default indicator selection can drift between the two views.
 *
 * `ind` is passed through verbatim, including the difference between absent
 * ("choose sensible defaults") and empty ("the user cleared the selection").
 */
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase().trim();

  // Ticker shape, checked before it reaches PostgREST. Not a security boundary
  // — the client is parameterised — but it turns a typo into a 400 instead of
  // an empty 200 that the caller would render as "no data for this symbol".
  if (!/^[A-Z0-9]{2,10}$/.test(symbol)) {
    return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  }

  try {
    const data = await getSymbolData(symbol);
    if (data.candles.length === 0) {
      return NextResponse.json({ error: "no bars", symbol }, { status: 404 });
    }
    // `has("ind")` rather than `get("ind") ?? undefined`: an explicitly empty
    // ?ind= means "no indicators", which must not fall back to the defaults.
    const ind = searchParams.has("ind") ? searchParams.get("ind") ?? "" : undefined;
    return NextResponse.json(buildChartProps(symbol, data, ind));
  } catch (e) {
    console.error("[symbol-chart]", symbol, e);
    return NextResponse.json({ error: "fetch failed", symbol }, { status: 500 });
  }
}
