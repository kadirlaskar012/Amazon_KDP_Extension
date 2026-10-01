export * from './discover';
export interface CategoryRank {
  name: string;
  rank: number;
  url?: string;
  category?: string;
}

export interface EstimateResult<T = number> {
  value: T;
  isEstimate: true;
}

export interface BookMetrics {
  monthlySales: EstimateResult<number | null>;
  royaltyPerSale: EstimateResult<number | null>;
  monthlyRoyalty: EstimateResult<number | null>;
  isOpportunity: boolean;
  opportunityReasons: string[];
}

export interface Book {
  asin: string;
  title: string;
  subtitle?: string;
  author: string;
  price?: number;
  rating?: number;
  reviewCount?: number;
  bsrOverall?: number;
  categoryRanks: CategoryRank[];
  pageCount?: number;
  pages?: number;
  trimSize?: string;
  dimensions?: string;
  publishDate?: string;
  readingAge?: string;
  isLowContent?: boolean;
  fetchedAt?: number;
  productUrl?: string;
  isOpportunity?: boolean;
  opportunityReasons?: string[];
  monthlySalesEstimate?: number;
  monthlyRoyaltyEstimate?: number;
  metrics?: BookMetrics;
  topReviewsText?: string[];
  reviews?: ReviewItem[];
  reviewsRequireLogin?: boolean;
}

export interface FactorBreakdown {
  name: string;
  points: number;
  maxPoints: number;
  ratio: number;
  explanation: string;
}

export interface ScoreBreakdown {
  demand: FactorBreakdown;
  competitionGap: FactorBreakdown;
  weakCompetitors: FactorBreakdown;
  profit: FactorBreakdown;
  newEntrant: FactorBreakdown;
}

export interface NicheScore {
  total: number;
  demand: number;
  competitionGap: number;
  weakCompetitors: number;
  profit: number;
  newEntrant: number;
  label: 'green' | 'yellow' | 'red' | 'insufficient';
  breakdown: ScoreBreakdown;
  booksAnalyzed: number;
  warnings: string[];
  verdict: string;
}

export interface SearchSnapshot {
  query: string;
  date: number;
  books: Book[];
  scores?: NicheScore;
  category?: string;
  keywords?: KeywordItem[];
  categories?: CategoryStat[];
  specs?: SpecsSummary;
  reviewGap?: ReviewGapAnalysis;
  ideas?: BookIdea[];
  seasonality?: SeasonalityReport;
}

export interface KeywordWeights {
  autocompletePosition: number;
  titleFrequency: number;
  topResultBsr: number;
}

export interface KeywordItem {
  keyword: string;
  bestPosition: number;
  inTitlesCount: number;
  bsrScore?: number | null;
  avgBsr?: number | null;
  totalScore: number;
  scoreLabel: 'high' | 'medium' | 'low';
  isPartial: boolean;
  isChecking?: boolean;
  // Backward compatibility alias
  autocompletePosition?: number;
}

export type CategoryDifficulty = 'easy' | 'medium' | 'hard';

export interface CategoryDifficultyThresholds {
  easyMinBsrAtTop20: number;
  mediumMinBsrAtTop20: number;
}

export interface CategoryStat {
  name: string;
  url: string;
  bookCount: number;
  bestRankAmongTopBooks: number;
  avgRank: number;
  isGeneric: boolean;
  difficulty?: CategoryDifficulty;
  bsrAtTop1?: number | null;
  bsrAtTop10?: number | null;
  bsrAtTop20?: number | null;
  difficultyText?: string;
  isChecking?: boolean;
  path?: string;
  salesOpportunityLevel?: 'high' | 'medium' | 'moderate';
  bestSellerTargetBsr?: number | null;
  dailySalesForNo1?: number | null;
}

export interface BestSellerItem {
  rank: number;
  asin: string;
  title: string;
  price?: number;
  rating?: number;
  reviewCount?: number;
  productUrl?: string;
}

export interface BestSellerCategoryData {
  categoryName: string;
  items: BestSellerItem[];
  bsrAtTop1?: number | null;
  bsrAtTop10?: number | null;
  bsrAtTop20?: number | null;
  difficulty?: CategoryDifficulty;
  difficultyText?: string;
}

export interface WordFrequencyItem {
  word: string;
  count: number;
  inTitlesCount: number; // In X of 10 titles
  percentage: number;
}

export interface TitleAnalysisResult {
  unigrams: WordFrequencyItem[];
  bigrams: WordFrequencyItem[];
  totalTitlesAnalyzed: number;
}

export interface PageCountDistribution {
  range: string;
  count: number;
}

export interface PriceDistribution {
  range: string;
  count: number;
}

export interface SpecsSummary {
  pageCount: {
    median: number;
    min: number;
    max: number;
    mostCommonRange: string;
    distribution: PageCountDistribution[];
  };
  trimSize: {
    mostCommon: string;
    count: number;
    percentage: number;
  };
  price: {
    median: number;
    min: number;
    max: number;
    mostCommonPoint: number;
    distribution: PriceDistribution[];
  };
  readingAge: {
    mostCommon: string;
    count: number;
  };
  formatShare: {
    lowContentCount: number;
    total: number;
    percentage: number;
  };
  recommended: {
    pageCount: number;
    pageCountReason: string;
    trimSize: string;
    trimSizeReason: string;
    priceRange: string;
    priceReason: string;
    readingAge?: string;
    readingAgeReason?: string;
  };
}

export interface ReviewItem {
  id?: string;
  rating: number;
  title: string;
  body: string;
  date?: string;
  helpfulVotes?: number;
  asin?: string;
}

export interface ParsedReviewsResult {
  reviews: ReviewItem[];
  reviewsRequireLogin: boolean;
}

export interface ComplaintStat {
  phrase: string;
  category: string;
  count: number;
  bookCount: number;
  sampleQuotes: string[];
}

export interface CategoryComplaintCount {
  category: string;
  count: number;
  percentage: number;
}

export interface ReviewGapAnalysis {
  complaints: ComplaintStat[];
  categorySummary: CategoryComplaintCount[];
  positivePhrases: WordFrequencyItem[];
  totalNegativeReviews: number;
  totalBooksAnalyzed: number;
  reviewsRequireLogin: boolean;
  booksRequiringLogin: number;
}

export interface HistoryPoint {
  date: string; // ISO day string: "YYYY-MM-DD"
  bsrOverall?: number;
  price?: number;
  reviewCount?: number;
  rating?: number;
  categoryRank?: { name: string; rank: number };
  // Backward compatibility alias:
  bsr?: number;
}

export interface WatchlistItem {
  asin: string;
  title: string;
  author?: string;
  price?: number;
  addedAt: number;
  lastCheckedAt?: number;
  lastStatus?: 'ok' | 'failed' | 'captcha';
  history: HistoryPoint[];
}

export interface TrendInfo {
  trend: 'improving' | 'declining' | 'stable' | 'unknown';
  percentChange: number;
  bestBsr?: number;
  worstBsr?: number;
  avgBsr?: number;
  daysTracked: number;
  reviewCountChange?: number;
  priceChange?: number;
}

export interface BsrSalesTier {
  minBsr: number;
  maxBsr: number;
  monthlySales: number;
}

export interface PrintingCostConfig {
  fixedCost: number;
  perPageCost: number;
}

export interface PrintingCostTier {
  minPages: number;
  maxPages: number;
  fixedCost: number;
  perPageCost: number;
}

export interface ScoreWeights {
  demand: number;
  competitionGap: number;
  weakCompetitors: number;
  profit: number;
  newEntrant: number;
}

export interface Thresholds {
  demandBsr: number;
  lowReviewCount: number;
  weakReviewCount: number;
  weakRating: number;
  newEntrantMonths: number;
  greenMin: number;
  yellowMin: number;
}

export interface NicheRevenueEstimate {
  totalMonthlyRoyalty: EstimateResult<number>;
  avgMonthlyRoyalty: EstimateResult<number>;
  medianMonthlyRoyalty: EstimateResult<number>;
  booksWithEstimates: number;
}

export interface Settings {
  geminiApiKey: string;
  geminiApiKeys?: string[];
  geminiModel: string;
  weights: ScoreWeights;
  thresholds: Thresholds;
  keywordWeights: KeywordWeights;
  categoryDifficulty: CategoryDifficultyThresholds;
  bsrSalesTable: BsrSalesTier[];
  printingCost: PrintingCostConfig;
  printingCostTable: PrintingCostTier[];
  royaltyRate: number;
  fetchDelayMs: {
    min: number;
    max: number;
  };
  marketplace: string;
  theme?: 'light' | 'dark' | 'system';
  sidebarPosition?: 'right' | 'left';
  sidebarDefaultOpen?: boolean;
  sidebarWidth?: number; // 380, 440, 520 (default 440)
  textSize?: 'normal' | 'large' | 'extra-large'; // 'normal' (16px base / 14px small), 'large' (+2px), 'extra-large' (+4px)
  pauseAllFetching?: boolean;
  maxFetchesPerSearch?: number;
  cacheDurationHours?: number;
  ai?: {
    model: string;
    maxTokens: number;
    temperature: number;
    ideasCount: number;
    timeoutMs: number;
    maxSavedIdeas: number;
    forbiddenWords: string[];
    systemPrompt: string;
  };
  exportSettings?: {
    csvDelimiter: string;
    includeBom: boolean;
  };
  trends?: {
    geo: string;
    baseUrl: string;
  };
  stopWords?: string[];
  genericCategories?: string[];
  discover?: import('./discover').DiscoverSettings;
}

export interface BookIdea {
  id?: string;
  createdAt?: number;
  query?: string;
  title: string;
  subtitle: string;
  subNiche: string;
  targetAudience: string;
  sevenBackendKeywords: string[];
  threeCategories: string[];
  shortDescription: string;
  pageCount: number;
  trimSize: string;
  priceSuggestion: number;
  differentiationAngle: string;
  contentPlan: string;
  estimatedDifficulty: number;
  whyItCouldWork: string;
  risks: string;
  warnings?: string[];
}

export interface AiSettings {
  model: string;
  maxTokens: number;
  temperature: number;
  ideasCount: number;
  timeoutMs: number;
  maxSavedIdeas: number;
  forbiddenWords: string[];
  systemPrompt: string;
}

export type ExportKind =
  | 'search_results'
  | 'keywords'
  | 'categories'
  | 'specs'
  | 'reviews'
  | 'watchlist'
  | 'ai_ideas'
  | 'full_pack';

export interface AiIdeasResponse {
  notes?: string;
  ideas: BookIdea[];
  rawText?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export interface TrendsConfig {
  geo: string;
  baseUrl: string;
}

export type SeasonalityType =
  | 'evergreen'
  | 'holiday_spike'
  | 'seasonal_wave'
  | 'annual_event';

export type DemandIntensity = 'Low' | 'Med' | 'High' | 'Peak';

export interface MonthDemand {
  month: string; // 'Jan', 'Feb', ...
  monthIndex: number; // 0-11
  intensity: DemandIntensity;
  score: number; // 0-100 relative index
}

export interface SeasonalityReport {
  type: SeasonalityType;
  typeLabel: string;
  primaryEvent?: string;
  peakMonths: string;
  recommendedLaunchWindow: string;
  launchUrgency: 'optimal_now' | 'preparation' | 'late' | 'anytime';
  urgencyAdvice: string;
  evergreenScore: number; // 0 - 100
  monthlyHeatmap: MonthDemand[];
  trendsUrl: string;
  signalsDetected: string[];
}

export interface ExportSettings {
  csvDelimiter: string;
  includeBom: boolean;
}

export interface QueueProgressState {
  isRunning: boolean;
  isPaused: boolean;
  current: number;
  total: number;
  captchaDetected: boolean;
  currentAsin?: string;
  message?: string;
}

export type ExtensionMessage =
  | { type: 'START_PRODUCT_FETCH'; asins: string[]; query?: string }
  | { type: 'PAUSE_QUEUE' }
  | { type: 'RESUME_QUEUE' }
  | { type: 'CANCEL_QUEUE' }
  | { type: 'GET_QUEUE_STATUS' }
  | { type: 'QUEUE_STATUS_UPDATE'; status: QueueProgressState }
  | { type: 'PRODUCT_FETCHED'; asin: string; bookPartial: Partial<Book> }
  | { type: 'CAPTCHA_TRIGGERED'; url: string }
  | { type: 'QUEUE_COMPLETE'; totalFetched: number }
  | { type: 'GET_CACHE_ITEMS'; asins: string[] }
  | { type: 'CHECK_SEARCH_PAGE' }
  | { type: 'REFRESH_WATCHLIST_NOW' }
  | { type: 'WATCHLIST_REFRESH_COMPLETE'; updatedCount: number }
  | { type: 'WATCHLIST_CAPTCHA'; url?: string }
  | { type: 'DOM_PARSE_PRODUCT'; html: string }
  | { type: 'DOM_PARSE_PRODUCT_RESULT'; parsed: unknown }
  | { type: 'GENERATE_AI_IDEAS'; payloadText: string; systemPrompt?: string }
  | { type: 'TEST_GEMINI_KEY'; apiKey?: string; model?: string }
  | { type: 'GET_STORAGE_USAGE' }
  | { type: 'OPEN_OPTIONS_PAGE' }
  | { type: 'OPEN_OPTIONS' }
  | { type: 'DISCOVER_SCAN_START'; forceRefresh?: boolean }
  | { type: 'DISCOVER_SCAN_CANCEL' }
  | { type: 'DISCOVER_SCAN_PROGRESS'; requestsUsed: number; total: number; message: string }
  | { type: 'DISCOVER_SCAN_COMPLETE'; scanStatus: string; requestsUsed: number; top10Count: number }
  | { type: 'DISCOVER_SCAN_CAPTCHA'; url: string };
