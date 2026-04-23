export type Locale = "en" | "vi";

export const translations = {
  en: {
    // Layout / Nav
    appName: "Slow Money",
    navAnalysis: "Analysis",
    navActive: "Active",
    navHistory: "History",
    navLogs: "Daily Logs",
    navStats: "Stats",
    navInput: "Input",

    // Analysis page
    dailyAnalysis: "Daily Analysis",
    recs: "recs",
    confidence: "Confidence",
    noAnalysisYet: "No daily analysis yet. Push data via the Input page or run the prompt script.",
    noFullResponse: "No full analysis text stored for this day. Push the complete Claude response (not just JSON) to see the analysis here.",
    previousDay: "Previous day",
    nextDay: "Next day",
    poweredBy: "Powered by Claude Opus 4.7",
    frontierModel: "World's most advanced reasoning AI",

    // Active page
    activePositions: "Active Positions",
    position: "position",
    positions: "positions",
    noActivePositions: "No active positions. All recommendations are closed or no data yet.",

    // Table headers (shared)
    date: "Date",
    symbol: "Symbol",
    setup: "Setup",
    entry: "Entry",
    sl: "SL",
    tp1: "TP1",
    tp2: "TP2",
    current: "Current",
    pnl: "P&L",
    rMultiple: "R",
    sharpe: "Sharpe",
    status: "Status",
    exit: "Exit",
    days: "Days",
    closed: "Closed",
    count: "Count",
    winPct: "Win%",
    totalPnl: "Total P&L",
    trades: "Trades",
    avgR: "Avg R",

    // History page
    history: "History",
    recommendation: "recommendation",
    recommendations: "recommendations",
    symbolPlaceholder: "Symbol",
    allClosed: "All Closed",
    allStatuses: "All Statuses",
    tp2Hit: "TP2 Hit",
    tp1Hit: "TP1 Hit",
    stopped: "Stopped",
    expired: "Expired",
    closedManual: "Closed Manual",
    filter: "Filter",
    reset: "Reset",
    winRate: "Win Rate",
    avgPnl: "Avg P&L",
    noClosedRecs: "No closed recommendations found.",

    // Logs page
    dailyLogs: "Daily Logs",
    tradingDay: "trading day",
    tradingDays: "trading days",
    standAside: "Stand Aside",
    ofDays: "of days",
    totalRecs: "Total Recs",
    avgRecsPerDay: "Avg Recs/Day",
    noLogs: "No daily logs yet.",
    conclusion: "Conclusion",
    regime: "Regime",
    auction: "Auction",
    vnIndex: "VN-Index",
    change: "Change",
    vix: "VIX",
    conf: "Conf.",

    // Log detail page
    backToLogs: "Back to logs",
    logNotFound: "Log not found for",
    marketContext: "Market Context",
    auctionState: "Auction State",
    strategy: "Strategy",
    sp500: "S&P 500",
    dxy: "DXY",
    us10y: "US 10Y",
    oilWti: "Oil WTI",
    killZone: "Kill Zone",
    international: "International",
    scenarios: "Scenarios",
    bullish: "Bullish",
    neutral: "Neutral",
    bearish: "Bearish",
    standAsideReason: "Stand Aside Reason",
    noRecsForDay: "No recommendations for this day.",
    details: "Details",
    rating: "Rating",
    winRateEst: "Win Rate Est",
    expectancy: "Expectancy",
    hitProb: "Hit Prob",
    holding: "Holding",
    sizing: "Sizing",
    sessions: "sessions",

    // Stats page
    performanceStats: "Performance Stats",
    active: "active",
    closedLower: "closed",
    avgRMultiple: "Avg R-Multiple",
    profitFactor: "Profit Factor",
    avgWin: "Avg Win",
    avgLoss: "Avg Loss",
    avgDaysHeld: "Avg Days Held",
    standAsideRate: "Stand Aside Rate",
    recsPerTradingDay: "Recs / Trading Day",
    equityCurve: "Equity Curve (Cumulative P&L %)",
    noEquityData: "No closed recommendations with P&L data yet.",
    cumulative: "Cumulative",
    statusBreakdown: "Status Breakdown",
    bySetupType: "By Setup Type",
    noClosedRecsYet: "No closed recommendations yet.",
    topSymbols: "Top Symbols (by P&L)",
    worstSymbols: "Worst Symbols (by P&L)",
    byRegime: "By Regime",
    bySector: "By Sector",

    // Input page
    pushRecommendation: "Push Recommendation",
    inputDescription: "Paste Claude's JSON output (Phan K) below. Supports raw JSON or markdown code blocks.",
    validate: "Validate",
    pushToSupabase: "Push to Supabase",
    pushing: "Pushing...",
    pushedSuccessfully: "Pushed successfully",
    viewInDailyLogs: "View in Daily Logs",

    // v5 fields
    macroScore: "Macro Score",
    cssSentiment: "CSS Sentiment",
    topSectors: "Top Sectors",
    avoidSectors: "Avoid Sectors",
    funnelSummary: "Funnel Summary",
    funnelStory: "After Story",
    funnelRisk: "After Risk Filter",
    funnelTechnical: "After Technical",
    nearMiss: "Near Miss",
    story: "Story",
    storyType: "Story Type",
    pricedIn: "Priced In",
    pricedInLevel: "Priced In Level",
    remainingTrigger: "Remaining Trigger",
    firstNewsDate: "First News Date",

    // Auth
    login: "Login",
    logout: "Logout",
    contact: "Contact",

    // Regime labels
    regime1: "Uptrend + Low Vol",
    regime2: "Uptrend + High Vol",
    regime3: "Sideway",
    regime4: "Downtrend",

    // Status labels
    statusOpen: "Open",
    statusTp1Hit: "TP1 Hit",
    statusTp2Hit: "TP2 Hit",
    statusStopped: "Stopped",
    statusExpired: "Expired",
    statusClosed: "Closed",
  },
  vi: {
    // Layout / Nav
    appName: "Slow Money",
    navAnalysis: "Phân tích",
    navActive: "Đang nắm giữ",
    navHistory: "Lịch sử",
    navLogs: "Nhật ký",
    navStats: "Thống kê",
    navInput: "Nhập liệu",

    // Analysis page
    dailyAnalysis: "Phân tích hàng ngày",
    recs: "Khuyến nghị",
    confidence: "Độ tin cậy",
    noAnalysisYet: "Chưa có phân tích. Nhập dữ liệu qua trang Nhập liệu hoặc chạy script.",
    noFullResponse: "Chưa lưu nội dung phân tích cho ngày này. Hãy đẩy phản hồi đầy đủ từ Claude (không chỉ JSON) để xem phân tích ở đây.",
    previousDay: "Ngày trước",
    nextDay: "Ngày sau",
    poweredBy: "Vận hành bởi Claude Opus 4.7",
    frontierModel: "AI suy luận tiên tiến nhất thế giới",

    // Active page
    activePositions: "Vị thế đang mở",
    position: "vị thế",
    positions: "vị thế",
    noActivePositions: "Không có vị thế đang mở. Tất cả khuyến nghị đã đóng hoặc chưa có dữ liệu.",

    // Table headers (shared)
    date: "Ngày",
    symbol: "Mã CK",
    setup: "Chiến lược",
    entry: "Giá vào",
    sl: "Cắt lỗ",
    tp1: "TP1",
    tp2: "TP2",
    current: "Hiện tại",
    pnl: "L/L",
    rMultiple: "R",
    sharpe: "Sharpe",
    status: "Trạng thái",
    exit: "Giá ra",
    days: "Số ngày",
    closed: "Ngày đóng",
    count: "SL",
    winPct: "% Thắng",
    totalPnl: "Tổng L/L",
    trades: "Lệnh",
    avgR: "TB R",

    // History page
    history: "Lịch sử",
    recommendation: "khuyến nghị",
    recommendations: "khuyến nghị",
    symbolPlaceholder: "Mã CK",
    allClosed: "Tất cả đã đóng",
    allStatuses: "Tất cả trạng thái",
    tp2Hit: "Đạt TP2",
    tp1Hit: "Đạt TP1",
    stopped: "Cắt lỗ",
    expired: "Hết hạn",
    closedManual: "Đóng thủ công",
    filter: "Lọc",
    reset: "Đặt lại",
    winRate: "Tỷ lệ thắng",
    avgPnl: "TB L/L",
    noClosedRecs: "Không tìm thấy khuyến nghị đã đóng.",

    // Logs page
    dailyLogs: "Nhật ký giao dịch",
    tradingDay: "ngày giao dịch",
    tradingDays: "ngày giao dịch",
    standAside: "Đứng ngoài",
    ofDays: "số ngày",
    totalRecs: "Tổng KN",
    avgRecsPerDay: "TB KN/Ngày",
    noLogs: "Chưa có nhật ký.",
    conclusion: "Kết luận",
    regime: "Chế độ",
    auction: "Phiên",
    vnIndex: "VN-Index",
    change: "Thay đổi",
    vix: "VIX",
    conf: "Tin cậy",

    // Log detail page
    backToLogs: "Quay lại nhật ký",
    logNotFound: "Không tìm thấy nhật ký cho ngày",
    marketContext: "Bối cảnh thị trường",
    auctionState: "Trạng thái phiên",
    strategy: "Chiến lược",
    sp500: "S&P 500",
    dxy: "DXY",
    us10y: "US 10Y",
    oilWti: "Dầu WTI",
    killZone: "Vùng nguy hiểm",
    international: "Quốc tế",
    scenarios: "Kịch bản",
    bullish: "Tăng",
    neutral: "Trung lập",
    bearish: "Giảm",
    standAsideReason: "Lý do đứng ngoài",
    noRecsForDay: "Không có khuyến nghị cho ngày này.",
    details: "Chi tiết",
    rating: "Đánh giá",
    winRateEst: "Ước tính % thắng",
    expectancy: "Kỳ vọng",
    hitProb: "Xác suất đạt",
    holding: "Thời gian giữ",
    sizing: "Tỷ trọng",
    sessions: "phiên",

    // Stats page
    performanceStats: "Thống kê hiệu suất",
    active: "đang mở",
    closedLower: "đã đóng",
    avgRMultiple: "TB R-Multiple",
    profitFactor: "Hệ số lợi nhuận",
    avgWin: "TB Thắng",
    avgLoss: "TB Thua",
    avgDaysHeld: "TB Ngày giữ",
    standAsideRate: "Tỷ lệ đứng ngoài",
    recsPerTradingDay: "KN / Ngày GD",
    equityCurve: "Đường vốn (Tổng L/L %)",
    noEquityData: "Chưa có khuyến nghị đã đóng với dữ liệu L/L.",
    cumulative: "Tích lũy",
    statusBreakdown: "Phân bổ trạng thái",
    bySetupType: "Theo chiến lược",
    noClosedRecsYet: "Chưa có khuyến nghị đã đóng.",
    topSymbols: "Mã tốt nhất (theo L/L)",
    worstSymbols: "Mã kém nhất (theo L/L)",
    byRegime: "Theo chế độ",
    bySector: "Theo ngành",

    // Input page
    pushRecommendation: "Nhập khuyến nghị",
    inputDescription: "Dán JSON từ Claude (Phần K) vào đây. Hỗ trợ JSON hoặc markdown code block.",
    validate: "Kiểm tra",
    pushToSupabase: "Đẩy lên Supabase",
    pushing: "Đang đẩy...",
    pushedSuccessfully: "Đẩy thành công",
    viewInDailyLogs: "Xem trong Nhật ký",

    // v5 fields
    macroScore: "Điểm vĩ mô",
    cssSentiment: "CSS Sentiment",
    topSectors: "Ngành tiềm năng",
    avoidSectors: "Ngành nên tránh",
    funnelSummary: "Tóm tắt phễu lọc",
    funnelStory: "Sau câu chuyện",
    funnelRisk: "Sau lọc rủi ro",
    funnelTechnical: "Sau kỹ thuật",
    nearMiss: "Suýt vào danh sách",
    story: "Câu chuyện",
    storyType: "Loại câu chuyện",
    pricedIn: "Đã phản ánh",
    pricedInLevel: "Mức phản ánh",
    remainingTrigger: "Trigger còn lại",
    firstNewsDate: "Ngày tin đầu",

    // Auth
    login: "Đăng nhập",
    logout: "Đăng xuất",
    contact: "Liên hệ",

    // Regime labels
    regime1: "Tăng + Biến động thấp",
    regime2: "Tăng + Biến động cao",
    regime3: "Đi ngang",
    regime4: "Giảm",

    // Status labels
    statusOpen: "Đang mở",
    statusTp1Hit: "Đạt TP1",
    statusTp2Hit: "Đạt TP2",
    statusStopped: "Cắt lỗ",
    statusExpired: "Hết hạn",
    statusClosed: "Đã đóng",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale][key];
}

export const DEFAULT_LOCALE: Locale = "en";

export function getLocaleFromCookie(cookieValue: string | null): Locale {
  if (cookieValue === "en" || cookieValue === "vi") return cookieValue;
  return DEFAULT_LOCALE;
}

export async function getLocale(): Promise<Locale> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return getLocaleFromCookie(cookieStore.get("locale")?.value ?? null);
}
