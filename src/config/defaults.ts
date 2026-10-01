import type {
  Settings,
  ScoreWeights,
  BsrSalesTier,
  PrintingCostTier,
  PrintingCostConfig,
  Thresholds,
  KeywordWeights,
  CategoryDifficultyThresholds,
  AiSettings,
  ExportSettings,
  TrendsConfig,
} from '../types';
import { DEFAULT_FORBIDDEN_WORDS } from './forbiddenWords';

export const DEFAULT_THRESHOLDS: Thresholds = {
  demandBsr: 100000,
  lowReviewCount: 50,
  weakReviewCount: 30,
  weakRating: 4.0,
  newEntrantMonths: 12,
  greenMin: 80,
  yellowMin: 60,
};

export const DEFAULT_KEYWORD_WEIGHTS: KeywordWeights = {
  autocompletePosition: 40,
  titleFrequency: 30,
  topResultBsr: 30,
};

export const DEFAULT_CATEGORY_DIFFICULTY: CategoryDifficultyThresholds = {
  easyMinBsrAtTop20: 50000,
  mediumMinBsrAtTop20: 15000,
};

export const MIN_KEYWORD_LENGTH = 3;
export const TOP_N_TITLE_WORDS = 25;
export const AUTOCOMPLETE_ALPHA_SUFFIXES = 'abcdefghijklmnopqrstuvwxyz'.split('');
export const AUTOCOMPLETE_DIGIT_SUFFIXES = '0123456789'.split('');

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  demand: 35,
  competitionGap: 30,
  weakCompetitors: 15,
  profit: 10,
  newEntrant: 10,
};

export const DEFAULT_BSR_SALES_TABLE: BsrSalesTier[] = [
  { minBsr: 1, maxBsr: 1000, monthlySales: 3000 },
  { minBsr: 1001, maxBsr: 5000, monthlySales: 1500 },
  { minBsr: 5001, maxBsr: 20000, monthlySales: 350 },
  { minBsr: 20001, maxBsr: 100000, monthlySales: 80 },
  { minBsr: 100001, maxBsr: 10000000, monthlySales: 20 },
];

export const DEFAULT_PRINTING_COST: PrintingCostConfig = {
  fixedCost: 1.00,
  perPageCost: 0.012,
};

export const DEFAULT_PRINTING_COST_TABLE: PrintingCostTier[] = [
  { minPages: 24, maxPages: 108, fixedCost: 2.30, perPageCost: 0 },
  { minPages: 109, maxPages: 828, fixedCost: 1.00, perPageCost: 0.012 },
];

export const DEFAULT_ROYALTY_RATE = 0.6;

export const DEFAULT_SETTINGS: Settings = {
  geminiApiKey: '',
  geminiApiKeys: [],
  geminiModel: 'gemini-flash-latest',
  weights: DEFAULT_SCORE_WEIGHTS,
  thresholds: DEFAULT_THRESHOLDS,
  keywordWeights: DEFAULT_KEYWORD_WEIGHTS,
  categoryDifficulty: DEFAULT_CATEGORY_DIFFICULTY,
  bsrSalesTable: DEFAULT_BSR_SALES_TABLE,
  printingCost: DEFAULT_PRINTING_COST,
  printingCostTable: DEFAULT_PRINTING_COST_TABLE,
  royaltyRate: DEFAULT_ROYALTY_RATE,
  fetchDelayMs: {
    min: 2000,
    max: 3000,
  },
  marketplace: 'amazon.com',
  theme: 'system',
  sidebarPosition: 'right',
  sidebarDefaultOpen: true,
  sidebarWidth: 440,
  textSize: 'normal',
  pauseAllFetching: false,
  maxFetchesPerSearch: 20,
  cacheDurationHours: 24,
  ai: {
    model: 'gemini-flash-latest',
    maxTokens: 4000,
    temperature: 0.7,
    ideasCount: 10,
    timeoutMs: 60000,
    maxSavedIdeas: 100,
    forbiddenWords: DEFAULT_FORBIDDEN_WORDS,
    systemPrompt:
      'You are a KDP (Amazon Kindle Direct Publishing) niche research assistant. Use ONLY the data provided plus general publishing knowledge. Do not invent sales numbers or BSR values. Return ONLY valid JSON, no markdown, no commentary. Follow Amazon KDP content guidelines: no brand names, trademarks, character names, celebrity names, or terms like "best seller", "free", "new", "top rated" in titles or subtitles. No keyword stuffing. Titles up to 200 characters including subtitle. Each idea must clearly differ from the others and must address at least one weakness found in the data (complaints, weak competitors, missing sub-niche, spec gap). If the data is too thin to support ideas, return an empty array and a "notes" field explaining what data is missing.',
  },
  exportSettings: {
    csvDelimiter: ',',
    includeBom: true,
  },
  trends: {
    geo: 'US',
    baseUrl: 'https://trends.google.com/trends/explore',
  },
};

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_FETCHES_PER_SEARCH = 20;
export const MAX_ORGANIC_RESULTS_TO_PARSE = 16;

export const DEFAULT_REVIEW_SETTINGS = {
  booksToAnalyze: 5,
  maxStarsIncluded: 3,
  topPhrasesShown: 15,
  minPhraseLength: 2,
};

export const DEFAULT_TRACKER_CONFIG = {
  alarmName: 'kdp-daily-refresh',
  periodMinutes: 1440,
  maxWatchlistSize: 50,
  historyMaxPoints: 365,
  fetchDelayMs: { min: 2000, max: 3000 },
  checkThresholdHours: 20,
};

export const DEFAULT_TREND_CONFIG = {
  windowDays: 7,
  stableChangePercent: 5,
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  model: 'gemini-flash-latest',
  maxTokens: 4000,
  temperature: 0.7,
  ideasCount: 10,
  timeoutMs: 60000,
  maxSavedIdeas: 100,
  forbiddenWords: DEFAULT_FORBIDDEN_WORDS,
  systemPrompt:
    'You are a KDP (Amazon Kindle Direct Publishing) niche research assistant. Use ONLY the data provided plus general publishing knowledge. Do not invent sales numbers or BSR values. Return ONLY valid JSON, no markdown, no commentary. Follow Amazon KDP content guidelines: no brand names, trademarks, character names, celebrity names, or terms like "best seller", "free", "new", "top rated" in titles or subtitles. No keyword stuffing. Titles up to 200 characters including subtitle. Each idea must clearly differ from the others and must address at least one weakness found in the data (complaints, weak competitors, missing sub-niche, spec gap). If the data is too thin to support ideas, return an empty array and a "notes" field explaining what data is missing.',
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  csvDelimiter: ',',
  includeBom: true,
};

export const DEFAULT_TRENDS_CONFIG: TrendsConfig = {
  geo: 'US',
  baseUrl: 'https://trends.google.com/trends/explore',
};
