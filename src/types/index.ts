export interface CategoryRank {
  name: string;
  rank: number;
  url?: string;
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
  trimSize?: string;
  publishDate?: string;
  readingAge?: string;
  isLowContent?: boolean;
  fetchedAt?: number;
  productUrl?: string;
  isOpportunity?: boolean;
  monthlySalesEstimate?: number;
  monthlyRoyaltyEstimate?: number;
  topReviewsText?: string[];
}

export interface NicheScore {
  total: number;
  demand: number;
  competitionGap: number;
  weakCompetitors: number;
  profit: number;
  newEntrant: number;
  label: 'green' | 'yellow' | 'red';
}

export interface SearchSnapshot {
  query: string;
  date: number;
  books: Book[];
  scores?: NicheScore;
  category?: string;
}

export interface KeywordItem {
  keyword: string;
  autocompletePosition: number;
  topResultBsr?: number;
  titleFrequency: number;
  score: number;
}

export interface WatchlistHistoryEntry {
  date: number;
  bsr?: number;
  price?: number;
  reviewCount?: number;
}

export interface WatchlistItem {
  asin: string;
  title?: string;
  author?: string;
  price?: number;
  addedAt: number;
  history: WatchlistHistoryEntry[];
}

export interface BsrSalesTier {
  minBsr: number;
  maxBsr: number;
  monthlySales: number;
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

export interface Settings {
  claudeApiKey: string;
  claudeModel: string;
  weights: ScoreWeights;
  bsrSalesTable: BsrSalesTier[];
  printingCostTable: PrintingCostTier[];
  fetchDelayMs: {
    min: number;
    max: number;
  };
  marketplace: string;
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
  | { type: 'CHECK_SEARCH_PAGE' };
