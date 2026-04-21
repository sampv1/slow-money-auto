export interface DailyLog {
  id: string;
  analysis_date: string;
  trading_date: string;
  conclusion: "KB1" | "KB2" | "KB3";
  regime: number;
  regime_label: string;
  auction_state: string;
  strategy: string;
  vn_index_close: number | null;
  vn_index_change_pct: number | null;
  vn_index_session_date: string | null;
  sp500_change_pct: number | null;
  dxy: number | null;
  us10y: number | null;
  vix: number | null;
  oil_wti: number | null;
  international_environment: string | null;
  confidence: number | null;
  stand_aside_reason: string | null;
  scenario_bullish_pct: number | null;
  scenario_bullish_desc: string | null;
  scenario_neutral_pct: number | null;
  scenario_neutral_desc: string | null;
  scenario_bearish_pct: number | null;
  scenario_bearish_desc: string | null;
  kill_zone_vn_index: number | null;
  avg_sharpe: number | null;
  avg_expectancy: number | null;
  num_recommendations: number;
  full_response: string | null;
  created_at: string;
}

export interface Recommendation {
  id: string;
  daily_log_id: string;
  trading_date: string;
  rank: number;
  symbol: string;
  exchange: string;
  company_name: string | null;
  sector: string | null;
  action: string;
  setup: string;
  setup_confidence: string;
  rating: string;
  entry_price: number;
  entry_range_low: number | null;
  entry_range_high: number | null;
  stop_loss: number;
  tp1: number;
  tp2: number | null;
  trailing_stop_method: string | null;
  last_close: number;
  last_close_date: string;
  stop_loss_pct: number;
  tp1_pct: number;
  tp2_pct: number | null;
  r_multiple: number;
  sharpe: number;
  win_rate_est: number;
  expectancy: number;
  hit_probability: string;
  holding_period_sessions: number | null;
  holding_period_label: string | null;
  sizing_method: string | null;
  size_pct: number | null;
  kelly_raw_pct: number | null;
  quarter_kelly_pct: number | null;
  entry_timing: string | null;
  entry_method: string | null;
  reasoning_summary: string | null;
  status: "OPEN" | "TP1_HIT" | "TP2_HIT" | "STOPPED" | "EXPIRED" | "CLOSED_MANUAL";
  current_price: number | null;
  current_price_date: string | null;
  unrealized_pnl_pct: number | null;
  actual_exit_price: number | null;
  actual_pnl_pct: number | null;
  closed_at: string | null;
  days_held: number | null;
  created_at: string;
  updated_at: string;
}

export type RecommendationStatus = Recommendation["status"];

export const CLOSED_STATUSES: RecommendationStatus[] = [
  "TP2_HIT",
  "STOPPED",
  "EXPIRED",
  "CLOSED_MANUAL",
];

export const ACTIVE_STATUSES: RecommendationStatus[] = ["OPEN", "TP1_HIT"];
