import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/supabase-server";

interface MarketContext {
  regime: number;
  regime_label?: string;
  auction_state?: string;
  strategy?: string;
  confidence?: number;
  macro_score?: number;
  css?: number;
  top_sectors?: string[];
  avoid_sectors?: string[];
  vn_index?: {
    close?: number;
    change_pct?: number;
    session_date?: string;
  };
  international?: {
    sp500_change_pct?: number;
    dxy?: number;
    us10y?: number;
    vix?: number;
    oil_wti?: number;
    environment?: string;
  };
}

interface RecInput {
  rank: number;
  symbol: string;
  exchange: string;
  company_name?: string;
  sector?: string;
  action: string;
  setup: string;
  setup_confidence: string;
  rating: string;
  entry_price: number;
  entry_range_low?: number;
  entry_range_high?: number;
  stop_loss: number;
  tp1: number;
  tp2?: number;
  trailing_stop_method?: string;
  last_close: number;
  last_close_date: string;
  stop_loss_pct: number;
  tp1_pct: number;
  tp2_pct?: number;
  r_multiple: number;
  sharpe: number;
  win_rate_est: number;
  expectancy: number;
  hit_probability: string;
  holding_period_sessions?: number;
  holding_period_label?: string;
  position_sizing?: {
    method?: string;
    size_pct?: number;
    kelly_raw_pct?: number;
    quarter_kelly_pct?: number;
  };
  entry_timing?: string;
  entry_method?: string;
  reasoning_summary?: string;
  story?: {
    type?: number;
    type_label?: string;
    summary?: string;
    first_news_date?: string;
    priced_in_level?: string;
    priced_in_pct?: number;
    remaining_trigger?: string;
  };
}

interface PushData {
  analysis_date: string;
  trading_date: string;
  market_context: MarketContext;
  conclusion: "KB1" | "KB2" | "KB3";
  stand_aside_reason?: string;
  funnel_summary?: {
    candidates_after_story?: number;
    candidates_after_risk_filter?: number;
    candidates_after_technical?: number;
    near_miss?: { symbol: string; reason: string }[];
  };
  recommendations: RecInput[];
  scenarios?: {
    bullish?: { probability_pct?: number; description?: string };
    neutral?: { probability_pct?: number; description?: string };
    bearish?: { probability_pct?: number; description?: string };
    kill_zone_vn_index?: number;
  };
  track_record?: {
    avg_sharpe?: number;
    avg_expectancy?: number;
  };
}

function validate(data: PushData): string[] {
  const errors: string[] = [];

  if (!data.analysis_date) errors.push("Missing analysis_date");
  if (!data.trading_date) errors.push("Missing trading_date");
  if (!data.market_context) errors.push("Missing market_context");
  if (!["KB1", "KB2", "KB3"].includes(data.conclusion)) {
    errors.push(`Invalid conclusion: ${data.conclusion}`);
  }

  const regime = data.market_context?.regime;
  if (typeof regime !== "number" || ![1, 2, 3, 4].includes(regime)) {
    errors.push(`Invalid regime: ${regime}`);
  }

  const recs = data.recommendations ?? [];
  if (["KB1", "KB2"].includes(data.conclusion) && recs.length === 0) {
    errors.push("Conclusion is KB1/KB2 but recommendations is empty");
  }
  if (data.conclusion === "KB3" && recs.length > 0) {
    errors.push("Conclusion is KB3 but recommendations is not empty");
  }

  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    const p = `recommendations[${i}] (${rec.symbol ?? "?"})`;
    const required = [
      "symbol", "exchange", "action", "setup", "entry_price",
      "stop_loss", "tp1", "r_multiple", "sharpe", "win_rate_est",
      "expectancy", "hit_probability", "rating", "setup_confidence",
      "last_close", "last_close_date", "stop_loss_pct", "tp1_pct",
    ] as const;
    for (const f of required) {
      if (rec[f] === undefined || rec[f] === null) {
        errors.push(`${p}: missing '${f}'`);
      }
    }
    if (rec.stop_loss >= rec.entry_price) {
      errors.push(`${p}: stop_loss must be < entry_price`);
    }
    if (rec.tp1 <= rec.entry_price) {
      errors.push(`${p}: tp1 must be > entry_price`);
    }
  }

  return errors;
}

function buildDailyLogRow(data: PushData) {
  const ctx = data.market_context;
  const vni = ctx.vn_index ?? {};
  const intl = ctx.international ?? {};
  const scenarios = data.scenarios ?? {};
  const track = data.track_record ?? {};
  const funnel = data.funnel_summary ?? {};

  return {
    analysis_date: data.analysis_date,
    trading_date: data.trading_date,
    conclusion: data.conclusion,
    regime: ctx.regime,
    regime_label: ctx.regime_label ?? "",
    auction_state: ctx.auction_state ?? "",
    strategy: ctx.strategy ?? "",
    vn_index_close: vni.close ?? null,
    vn_index_change_pct: vni.change_pct ?? null,
    vn_index_session_date: vni.session_date ?? null,
    sp500_change_pct: intl.sp500_change_pct ?? null,
    dxy: intl.dxy ?? null,
    us10y: intl.us10y ?? null,
    vix: intl.vix ?? null,
    oil_wti: intl.oil_wti ?? null,
    international_environment: intl.environment ?? null,
    confidence: ctx.confidence ?? null,
    stand_aside_reason: data.stand_aside_reason ?? null,
    scenario_bullish_pct: scenarios.bullish?.probability_pct ?? null,
    scenario_bullish_desc: scenarios.bullish?.description ?? null,
    scenario_neutral_pct: scenarios.neutral?.probability_pct ?? null,
    scenario_neutral_desc: scenarios.neutral?.description ?? null,
    scenario_bearish_pct: scenarios.bearish?.probability_pct ?? null,
    scenario_bearish_desc: scenarios.bearish?.description ?? null,
    kill_zone_vn_index: scenarios.kill_zone_vn_index ?? null,
    avg_sharpe: track.avg_sharpe ?? null,
    avg_expectancy: track.avg_expectancy ?? null,
    num_recommendations: (data.recommendations ?? []).length,
    // v5 fields
    macro_score: ctx.macro_score ?? null,
    css: ctx.css ?? null,
    top_sectors: ctx.top_sectors ?? null,
    avoid_sectors: ctx.avoid_sectors ?? null,
    funnel_candidates_story: funnel.candidates_after_story ?? null,
    funnel_candidates_risk: funnel.candidates_after_risk_filter ?? null,
    funnel_candidates_technical: funnel.candidates_after_technical ?? null,
    funnel_near_miss: funnel.near_miss ?? null,
  };
}

function buildRecRow(rec: RecInput, dailyLogId: string, tradingDate: string) {
  const sizing = rec.position_sizing ?? {};
  const story = rec.story ?? {};
  return {
    daily_log_id: dailyLogId,
    trading_date: tradingDate,
    rank: rec.rank,
    symbol: rec.symbol,
    exchange: rec.exchange,
    company_name: rec.company_name ?? null,
    sector: rec.sector ?? null,
    action: rec.action,
    setup: rec.setup,
    setup_confidence: rec.setup_confidence,
    rating: rec.rating,
    entry_price: rec.entry_price,
    entry_range_low: rec.entry_range_low ?? null,
    entry_range_high: rec.entry_range_high ?? null,
    stop_loss: rec.stop_loss,
    tp1: rec.tp1,
    tp2: rec.tp2 ?? null,
    trailing_stop_method: rec.trailing_stop_method ?? null,
    last_close: rec.last_close,
    last_close_date: rec.last_close_date,
    stop_loss_pct: rec.stop_loss_pct,
    tp1_pct: rec.tp1_pct,
    tp2_pct: rec.tp2_pct ?? null,
    r_multiple: rec.r_multiple,
    sharpe: rec.sharpe,
    win_rate_est: rec.win_rate_est,
    expectancy: rec.expectancy,
    hit_probability: rec.hit_probability,
    holding_period_sessions: rec.holding_period_sessions ?? null,
    holding_period_label: rec.holding_period_label ?? null,
    sizing_method: sizing.method ?? null,
    size_pct: sizing.size_pct ?? null,
    kelly_raw_pct: sizing.kelly_raw_pct ?? null,
    quarter_kelly_pct: sizing.quarter_kelly_pct ?? null,
    entry_timing: rec.entry_timing ?? null,
    entry_method: rec.entry_method ?? null,
    reasoning_summary: rec.reasoning_summary ?? null,
    // v5 story fields
    story_type: story.type ?? null,
    story_type_label: story.type_label ?? null,
    story_summary: story.summary ?? null,
    story_first_news_date: story.first_news_date ?? null,
    story_priced_in_level: story.priced_in_level ?? null,
    story_priced_in_pct: story.priced_in_pct ?? null,
    story_remaining_trigger: story.remaining_trigger ?? null,
    status: "OPEN",
  };
}

function stripJsonBlock(text: string): string {
  // Remove ```json ... ``` code blocks from the response text
  return text.replace(/```json\s*\n[\s\S]*?\n\s*```/g, "").trim();
}

function extractJson(text: string): string {
  // Try to find JSON inside ```json ... ``` code block first
  const match = text.match(/```json\s*\n([\s\S]*?)\n\s*```/);
  if (match) return match[1];
  // Fall back to raw text (might be pure JSON)
  return text.trim();
}

export async function POST(request: Request) {
  try {
    // Admin-only: check auth
    const role = await getUserRole();
    if (role !== "admin") {
      return Response.json({ error: "Unauthorized — admin access required" }, { status: 403 });
    }

    const body = await request.text();

    // Extract JSON from the input (which may be full Claude response or just JSON)
    const jsonStr = extractJson(body);

    let data: PushData;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      return Response.json({ error: "Invalid JSON — could not find valid JSON in the input" }, { status: 400 });
    }

    // Build full_response: if input contains more than just JSON, store the analysis text
    const hasCodeBlock = /```json\s*\n[\s\S]*?\n\s*```/.test(body);
    const fullResponse = hasCodeBlock ? stripJsonBlock(body) : null;

    // Validate
    const errors = validate(data);
    if (errors.length > 0) {
      return Response.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from("daily_logs")
      .select("id")
      .eq("trading_date", data.trading_date);

    if (existing && existing.length > 0) {
      return Response.json(
        { error: `A daily log for ${data.trading_date} already exists` },
        { status: 409 }
      );
    }

    // Insert daily log
    const logRow = buildDailyLogRow(data);
    if (fullResponse) {
      (logRow as Record<string, unknown>).full_response = fullResponse;
    }

    const { data: logResult, error: logError } = await supabase
      .from("daily_logs")
      .insert(logRow)
      .select("id")
      .single();

    if (logError || !logResult) {
      return Response.json({ error: `Failed to insert daily log: ${logError?.message}` }, { status: 500 });
    }

    const dailyLogId = logResult.id;

    // Insert recommendations
    const recs = data.recommendations ?? [];
    let insertedCount = 0;
    if (recs.length > 0) {
      const rows = recs.map((rec) => buildRecRow(rec, dailyLogId, data.trading_date));
      const { data: recResult, error: recError } = await supabase
        .from("recommendations")
        .insert(rows)
        .select("id");

      if (recError) {
        return Response.json({ error: `Failed to insert recommendations: ${recError.message}` }, { status: 500 });
      }
      insertedCount = recResult?.length ?? 0;
    }

    return Response.json({
      success: true,
      trading_date: data.trading_date,
      conclusion: data.conclusion,
      daily_log_id: dailyLogId,
      recommendations_inserted: insertedCount,
      has_full_response: !!fullResponse,
    });
  } catch (err) {
    return Response.json({ error: `Server error: ${err}` }, { status: 500 });
  }
}
