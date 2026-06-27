import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/supabase-server";

const ACTIVE_STATUSES = ["OPEN", "TP1_HIT"];

interface ManualInput {
  symbol?: string;
  action?: string;
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
      return sell(symbol, close, body.note);
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

  // Reject duplicates: one active manual position per symbol.
  const { data: dup } = await supabase
    .from("recommendations")
    .select("id")
    .eq("symbol", symbol)
    .eq("source", "MANUAL")
    .in("status", ACTIVE_STATUSES)
    .limit(1);
  if (dup && dup.length > 0) {
    return Response.json(
      { error: `${symbol} already has an active manual position` },
      { status: 409 },
    );
  }

  const entry = close.price;
  const stopLoss = num(body.stop_loss);
  const tp1 = num(body.tp1);
  const tp2 = num(body.tp2);
  const holding = (body.holding ?? "").toString().trim() || null;
  const note = (body.note ?? "").toString().trim() || null;

  const row = {
    daily_log_id: null,
    trading_date: close.date,
    rank: null,
    symbol,
    exchange: uni.exchange,
    action: "BUY",
    setup: "MANUAL",
    entry_price: entry,
    stop_loss: stopLoss,
    tp1,
    tp2,
    last_close: entry,
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
    current_price: entry,
    current_price_date: close.date,
    unrealized_pnl_pct: 0,
  };

  const { data: inserted, error } = await supabase
    .from("recommendations")
    .insert(row)
    .select("id")
    .single();

  if (error || !inserted) {
    return Response.json({ error: `Failed to add position: ${error?.message}` }, { status: 500 });
  }
  return Response.json({ success: true, action: "BUY", id: inserted.id, symbol, entry, date: close.date });
}

async function sell(
  symbol: string,
  close: { price: number; date: string },
  noteInput: string | null | undefined,
) {
  // Find the open manual position to finalize.
  const { data: pos } = await supabase
    .from("recommendations")
    .select("id,entry_price,trading_date,note")
    .eq("symbol", symbol)
    .eq("source", "MANUAL")
    .in("status", ACTIVE_STATUSES)
    .order("trading_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pos) {
    return Response.json({ error: `No active manual position for ${symbol}` }, { status: 404 });
  }

  const entry = Number(pos.entry_price);
  const exit = close.price;
  const pnl = Number((((exit - entry) / entry) * 100).toFixed(2));
  const sellNote = (noteInput ?? "").toString().trim();
  const note = sellNote
    ? pos.note ? `${pos.note} | SELL: ${sellNote}` : `SELL: ${sellNote}`
    : pos.note;

  const { error } = await supabase
    .from("recommendations")
    .update({
      status: "CLOSED_MANUAL",
      actual_exit_price: exit,
      actual_pnl_pct: pnl,
      closed_at: close.date,
      current_price: exit,
      current_price_date: close.date,
      unrealized_pnl_pct: null,
      days_held: businessDays(pos.trading_date as string, close.date),
      note,
    })
    .eq("id", pos.id);

  if (error) {
    return Response.json({ error: `Failed to finalize position: ${error.message}` }, { status: 500 });
  }
  return Response.json({ success: true, action: "SELL", symbol, entry, exit, pnl, date: close.date });
}
