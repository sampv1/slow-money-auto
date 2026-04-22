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
    navAnalysis: "Phan tich",
    navActive: "Dang mo",
    navHistory: "Lich su",
    navLogs: "Nhat ky",
    navStats: "Thong ke",
    navInput: "Nhap lieu",

    // Analysis page
    dailyAnalysis: "Phan tich hang ngay",
    recs: "khuyen nghi",
    confidence: "Do tin cay",
    noAnalysisYet: "Chua co phan tich. Nhap du lieu qua trang Nhap lieu hoac chay script.",
    noFullResponse: "Chua luu noi dung phan tich cho ngay nay. Hay day phan hoi day du tu Claude (khong chi JSON) de xem phan tich o day.",
    previousDay: "Ngay truoc",
    nextDay: "Ngay sau",

    // Active page
    activePositions: "Vi the dang mo",
    position: "vi the",
    positions: "vi the",
    noActivePositions: "Khong co vi the dang mo. Tat ca khuyen nghi da dong hoac chua co du lieu.",

    // Table headers (shared)
    date: "Ngay",
    symbol: "Ma CK",
    setup: "Chien luoc",
    entry: "Gia vao",
    sl: "Cat lo",
    tp1: "TP1",
    tp2: "TP2",
    current: "Hien tai",
    pnl: "L/L",
    rMultiple: "R",
    sharpe: "Sharpe",
    status: "Trang thai",
    exit: "Gia ra",
    days: "So ngay",
    closed: "Ngay dong",
    count: "SL",
    winPct: "% Thang",
    totalPnl: "Tong L/L",
    trades: "Lenh",
    avgR: "TB R",

    // History page
    history: "Lich su",
    recommendation: "khuyen nghi",
    recommendations: "khuyen nghi",
    symbolPlaceholder: "Ma CK",
    allClosed: "Tat ca da dong",
    allStatuses: "Tat ca trang thai",
    tp2Hit: "Dat TP2",
    tp1Hit: "Dat TP1",
    stopped: "Cat lo",
    expired: "Het han",
    closedManual: "Dong thu cong",
    filter: "Loc",
    reset: "Dat lai",
    winRate: "Ty le thang",
    avgPnl: "TB L/L",
    noClosedRecs: "Khong tim thay khuyen nghi da dong.",

    // Logs page
    dailyLogs: "Nhat ky giao dich",
    tradingDay: "ngay giao dich",
    tradingDays: "ngay giao dich",
    standAside: "Dung ngoai",
    ofDays: "so ngay",
    totalRecs: "Tong KN",
    avgRecsPerDay: "TB KN/Ngay",
    noLogs: "Chua co nhat ky.",
    conclusion: "Ket luan",
    regime: "Che do",
    auction: "Phien",
    vnIndex: "VN-Index",
    change: "Thay doi",
    vix: "VIX",
    conf: "Tin cay",

    // Log detail page
    backToLogs: "Quay lai nhat ky",
    logNotFound: "Khong tim thay nhat ky cho ngay",
    marketContext: "Boi canh thi truong",
    auctionState: "Trang thai phien",
    strategy: "Chien luoc",
    sp500: "S&P 500",
    dxy: "DXY",
    us10y: "US 10Y",
    oilWti: "Dau WTI",
    killZone: "Vung nguy hiem",
    international: "Quoc te",
    scenarios: "Kich ban",
    bullish: "Tang",
    neutral: "Trung lap",
    bearish: "Giam",
    standAsideReason: "Ly do dung ngoai",
    noRecsForDay: "Khong co khuyen nghi cho ngay nay.",
    details: "Chi tiet",
    rating: "Danh gia",
    winRateEst: "Uoc tinh % thang",
    expectancy: "Ky vong",
    hitProb: "Xac suat dat",
    holding: "Thoi gian giu",
    sizing: "Ty trong",
    sessions: "phien",

    // Stats page
    performanceStats: "Thong ke hieu suat",
    active: "dang mo",
    closedLower: "da dong",
    avgRMultiple: "TB R-Multiple",
    profitFactor: "He so loi nhuan",
    avgWin: "TB Thang",
    avgLoss: "TB Thua",
    avgDaysHeld: "TB Ngay giu",
    standAsideRate: "Ty le dung ngoai",
    recsPerTradingDay: "KN / Ngay GD",
    equityCurve: "Duong von (Tong L/L %)",
    noEquityData: "Chua co khuyen nghi da dong voi du lieu L/L.",
    cumulative: "Tich luy",
    statusBreakdown: "Phan bo trang thai",
    bySetupType: "Theo chien luoc",
    noClosedRecsYet: "Chua co khuyen nghi da dong.",
    topSymbols: "Ma tot nhat (theo L/L)",
    worstSymbols: "Ma kem nhat (theo L/L)",
    byRegime: "Theo che do",
    bySector: "Theo nganh",

    // Input page
    pushRecommendation: "Nhap khuyen nghi",
    inputDescription: "Dan JSON tu Claude (Phan K) vao day. Ho tro JSON hoac markdown code block.",
    validate: "Kiem tra",
    pushToSupabase: "Day len Supabase",
    pushing: "Dang day...",
    pushedSuccessfully: "Day thanh cong",
    viewInDailyLogs: "Xem trong Nhat ky",

    // v5 fields
    macroScore: "Diem vi mo",
    cssSentiment: "CSS Sentiment",
    topSectors: "Nganh tiem nang",
    avoidSectors: "Nganh nen tranh",
    funnelSummary: "Tom tat pheu loc",
    funnelStory: "Sau cau chuyen",
    funnelRisk: "Sau loc rui ro",
    funnelTechnical: "Sau ky thuat",
    nearMiss: "Suyt vao danh sach",
    story: "Cau chuyen",
    storyType: "Loai cau chuyen",
    pricedIn: "Da phan anh",
    pricedInLevel: "Muc phan anh",
    remainingTrigger: "Trigger con lai",
    firstNewsDate: "Ngay tin dau",

    // Auth
    login: "Dang nhap",
    logout: "Dang xuat",

    // Regime labels
    regime1: "Tang + Bien dong thap",
    regime2: "Tang + Bien dong cao",
    regime3: "Di ngang",
    regime4: "Giam",

    // Status labels
    statusOpen: "Dang mo",
    statusTp1Hit: "Dat TP1",
    statusTp2Hit: "Dat TP2",
    statusStopped: "Cat lo",
    statusExpired: "Het han",
    statusClosed: "Da dong",
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
