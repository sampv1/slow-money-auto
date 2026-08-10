import { supabase } from "@/lib/supabase";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import {
  SPARKLINE_BATCH,
  slimRsLine,
  type BaseChartData,
  type SymbolCharts,
} from "@/lib/sparkline";

export const runtime = "nodejs";
// Row-chart data for a caller-supplied symbol list — never a whole-page read, so
// there is nothing to cache per URL. The underlying table is refreshed nightly
// and the response is small; letting the browser hold it briefly is enough.
export const revalidate = 0;

/**
 * POST { symbols: string[] } -> { charts: Record<symbol, SymbolCharts> }
 *
 * Signal Pro renders its table first and then asks for the sparklines of the
 * rows it is actually showing. Inline, this data was ~1.7 MB of a 4.55 MB page
 * because it covered all 1,569 symbols to draw ~124.
 *
 * PUBLIC, deliberately: ta_universe is world-readable (migration 045's "Public
 * read"), and this returns strictly less than querying that table directly —
 * the anon key in the browser could fetch the same columns. Trimming happens
 * HERE rather than client-side so the wire carries 90 points per symbol instead
 * of the ~242 stored.
 */
// Generous: one page load is 1 call, and clearing every filter is 4 (1,447 new
// symbols / 400 per batch). 120/min leaves a normal session far below the line
// while stopping a script from using this as a cheap DB amplifier.
const LIMIT = 120;
const WINDOW_MS = 60 * 1000;

export async function POST(request: Request) {
  try {
    const gate = rateLimit(`sparklines:${clientKey(request)}`, LIMIT, WINDOW_MS);
    if (!gate.ok) {
      return Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
      );
    }

    const body = await request.json();
    const raw = Array.isArray(body?.symbols) ? body.symbols : null;
    if (!raw) {
      return Response.json({ error: "symbols[] required" }, { status: 400 });
    }

    // Normalize and bound before touching the database.
    const symbols = Array.from(
      new Set(
        raw
          .filter((s: unknown): s is string => typeof s === "string")
          .map((s: string) => s.trim().toUpperCase())
          .filter((s: string) => s.length > 0 && s.length <= 12),
      ),
    ).slice(0, SPARKLINE_BATCH);

    if (symbols.length === 0) return Response.json({ charts: {} });

    const { data, error } = await supabase
      .from("ta_universe")
      .select("symbol,rs_line_full,base_chart")
      .in("symbol", symbols);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const charts: Record<string, SymbolCharts> = {};
    for (const row of data ?? []) {
      charts[row.symbol as string] = {
        rs: slimRsLine(row.rs_line_full as number[] | null),
        base: (row.base_chart as BaseChartData | null) ?? null,
      };
    }
    return Response.json({ charts });
  } catch (err) {
    return Response.json({ error: `Server error: ${err}` }, { status: 500 });
  }
}
