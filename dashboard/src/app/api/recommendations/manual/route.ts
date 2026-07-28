import { revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import { TAG_REC } from "@/lib/cached-data";
import { todayVn } from "@/lib/format";
import { getUserRole } from "@/lib/supabase-server";

const ACTIVE_STATUSES = ["OPEN", "TP1_HIT"];

interface ManualInput {
  symbol?: string;
  action?: string;
  id?: string; // SELL only: close just this one recommendation (else all for the symbol)
  price?: number | null; // entry (BUY) / exit (SELL); defaults to latest close
  stop_loss?: number | null;
  tp1?: number | null;
  tp2?: number | null;
  holding?: string | null;
  win_rate_est?: number | null;
  sharpe?: number | null;
  note?: string | null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Latest close + date for a symbol, straight from ta_ohlcv (authoritative). */
async function latestClose(symbol: string): Promise<{ price: number; date: string } | null> {
  const { data } = await supabase
    .from("ta_ohlcv")
    .select("date,close")
    .eq("symbol", symbol)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { price: Number(data.close), date: data.date as string };
}

/** Weekday (Mon-Fri) count between two ISO dates, excluding the start. */
function businessDays(from: string, to: string): number {
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  let count = 0;
  const cur = new Date(start);
  cur.setUTCDate(cur.getUTCDate() + 1);
  while (cur <= end) {
    const day = cur.getUTCDay();
    if (day >= 1 && day <= 5) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

// POST — BUY opens a manual position (added to the Active list); SELL finalizes
// the open manual position (P/L computed → shows on History). Entry/exit prices
// are the latest close, fetched server-side (never trusted from the client).
export async function POST(request: Request) {
  try {
    const role = await getUserRole();
    if (role !== "admin") {
      return Response.json({ error: "Unauthorized — admin access required" }, { status: 403 });
    }

    let body: ManualInput;
    try {
      body = (await request.json()) as ManualInput;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const symbol = (body.symbol ?? "").trim().toUpperCase();
    const action = (body.action ?? "").trim().toUpperCase();
    if (!symbol) return Response.json({ error: "Missing symbol" }, { status: 400 });
    if (action !== "BUY" && action !== "SELL") {
      return Response.json({ error: "action must be BUY or SELL" }, { status: 400 });
    }

    const close = await latestClose(symbol);
    if (!close) {
      return Response.json({ error: `No price data for ${symbol}` }, { status: 404 });
    }

    if (action === "SELL") {
      return sell(symbol, close, body);
    }
    return buy(symbol, close, body);
  } catch (err) {
    return Response.json({ error: `Server error: ${err}` }, { status: 500 });
  }
}

async function buy(
  symbol: string,
  close: { price: number; date: string },
  body: ManualInput,
) {
  // Exchange from the TA universe (needed by the NOT NULL/check constraint).
  const { data: uni } = await supabase
    .from("ta_universe")
    .select("exchange")
    .eq("symbol", symbol)
    .maybeSingle();
  if (!uni) {
    return Response.json({ error: `Unknown symbol: ${symbol}` }, { status: 404 });
  }

  // Entry defaults to the latest close but the admin can override it.
  const entryInput = num(body.price);
  const entry = entryInput !== null && entryInput > 0 ? entryInput : close.price;
  const stopLoss = num(body.stop_loss);
  const tp1 = num(body.tp1);
  const tp2 = num(body.tp2);
  const holding = (body.holding ?? "").toString().trim() || null;
  const note = (body.note ?? "").toString().trim() || null;

  // Reject targets on the wrong side of entry (long-only tracker). A mistyped
  // TP at/below entry would otherwise sit in the DB until update_prices.py's
  // daily eval either books a false "take-profit" exit at that price (a huge
  // apparent loss) or — after that pipeline guard — silently drops it; better
  // to catch the typo here, at entry, than either of those.
  const issues: string[] = [];
  if (stopLoss !== null && stopLoss >= entry) issues.push(`Stop loss (${stopLoss}) must be below entry (${entry})`);
  if (tp1 !== null && tp1 <= entry) issues.push(`TP1 (${tp1}) must be above entry (${entry})`);
  if (tp2 !== null && tp2 <= entry) issues.push(`TP2 (${tp2}) must be above entry (${entry})`);
  if (issues.length > 0) {
    return Response.json({ error: issues.join("; ") }, { status: 400 });
  }

  // The date the position was actually opened — TODAY in Vietnam, not the date
  // of the bar the price came from. Those differ whenever the admin buys before
  // today's bar lands (or on a non-trading day), and trading_date is what the
  // T+2.5 settlement guard, the expiry clock and days_held all count from, so it
  // has to be the real decision date. `last_close_date` / `current_price_date`
  // below stay on close.date — they describe the PRICE's provenance.
  const tradingDate = todayVn();

  const row = {
    daily_log_id: null,
    trading_date: tradingDate,
    rank: null,
    symbol,
    exchange: uni.exchange,
    action: "BUY",
    setup: "MANUAL",
    entry_price: entry,
    stop_loss: stopLoss,
    tp1,
    tp2,
    last_close: close.price,
    last_close_date: close.date,
    stop_loss_pct: stopLoss !== null ? Number((((stopLoss - entry) / entry) * 100).toFixed(2)) : null,
    tp1_pct: tp1 !== null ? Number((((tp1 - entry) / entry) * 100).toFixed(2)) : null,
    tp2_pct: tp2 !== null ? Number((((tp2 - entry) / entry) * 100).toFixed(2)) : null,
    sharpe: num(body.sharpe),
    win_rate_est: num(body.win_rate_est),
    holding_period_label: holding,
    note,
    source: "MANUAL",
    status: "OPEN",
    current_price: close.price,
    current_price_date: close.date,
    unrealized_pnl_pct: Number((((close.price - entry) / entry) * 100).toFixed(2)),
  };

  const { data: inserted, error } = await supabase
    .from("recommendations")
    .insert(row)
    .select("id")
    .single();

  if (error || !inserted) {
    return Response.json({ error: `Failed to add position: ${error?.message}` }, { status: 500 });
  }
  // Drop the cached recommendations so Active/History/Stats show the new
  // position on the very next view.
  revalidateTag(TAG_REC, { expire: 0 });
  return Response.json({ success: true, action: "BUY", id: inserted.id, symbol, entry, date: tradingDate });
}

async function sell(
  symbol: string,
  close: { price: number; date: string },
  body: ManualInput,
) {
  // Finalize open positions for the symbol. By default ALL of them (any source —
  // AI or manual); when `id` is supplied (Active page single-close), just that
  // one. Each stays an independent transaction on the Active/History pages: it
  // closes at the same exit price but keeps its own entry, so its own P/L is
  // computed.
  const id = (body.id ?? "").toString().trim();
  let query = supabase
    .from("recommendations")
    .select("id,entry_price,trading_date,note")
    .eq("symbol", symbol)
    .in("status", ACTIVE_STATUSES);
  if (id) query = query.eq("id", id);
  const { data: positions } = await query;
  if (!positions || positions.length === 0) {
    return Response.json(
      { error: id ? "Position not found or already closed" : `No active position for ${symbol}` },
      { status: 404 },
    );
  }

  // Exit defaults to the latest close but the admin can override it.
  const exitInput = num(body.price);
  const exit = exitInput !== null && exitInput > 0 ? exitInput : close.price;
  const sellNote = (body.note ?? "").toString().trim();

  // The date the position was actually closed — TODAY in Vietnam, matching how
  // BUY stamps trading_date. Using the bar's date here would let a same-day
  // buy-and-sell record a close that predates its own open. days_held counts
  // from entry to THIS date, so it stays consistent with both ends.
  const exitDate = todayVn();

  let totalEntry = 0;
  const results = await Promise.all(
    positions.map((pos) => {
      const entry = Number(pos.entry_price);
      totalEntry += entry;
      const pnl = Number((((exit - entry) / entry) * 100).toFixed(2));
      const note = sellNote
        ? pos.note ? `${pos.note} | SELL: ${sellNote}` : `SELL: ${sellNote}`
        : pos.note;
      return supabase
        .from("recommendations")
        .update({
          status: "CLOSED_MANUAL",
          actual_exit_price: exit,
          actual_pnl_pct: pnl,
          closed_at: exitDate,
          current_price: exit,
          current_price_date: close.date, // provenance of the PRICE, not the trade
          unrealized_pnl_pct: null,
          days_held: businessDays(pos.trading_date as string, exitDate),
          note,
        })
        .eq("id", pos.id);
    }),
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return Response.json({ error: `Failed to finalize position: ${failed.error.message}` }, { status: 500 });
  }

  // Drop the cached recommendations so the closed position leaves Active and
  // lands in History/Stats on the very next view.
  revalidateTag(TAG_REC, { expire: 0 });

  // Equal-weight average entry (same volume per position) for the summary.
  const avgEntry = Number((totalEntry / positions.length).toFixed(2));
  const avgPnl = Number((((exit - avgEntry) / avgEntry) * 100).toFixed(2));
  return Response.json({
    success: true,
    action: "SELL",
    symbol,
    count: positions.length,
    avg_entry: avgEntry,
    exit,
    pnl: avgPnl,
    date: exitDate,
  });
}
