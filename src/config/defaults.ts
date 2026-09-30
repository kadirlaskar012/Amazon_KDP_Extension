import type { Settings, ScoreWeights, BsrSalesTier, PrintingCostTier } from '../types';

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

export const DEFAULT_PRINTING_COST_TABLE: PrintingCostTier[] = [
  // Standard KDP Black & White Paperback on White Paper (US)
  { minPages: 24, maxPages: 108, fixedCost: 2.30, perPageCost: 0 },
  { minPages: 109, maxPages: 828, fixedCost: 1.00, perPageCost: 0.012 },
];

export const DEFAULT_SETTINGS: Settings = {
  claudeApiKey: '',
  claudeModel: 'claude-sonnet-5-5',
  weights: DEFAULT_SCORE_WEIGHTS,
  bsrSalesTable: DEFAULT_BSR_SALES_TABLE,
  printingCostTable: DEFAULT_PRINTING_COST_TABLE,
  fetchDelayMs: {
    min: 2000,
    max: 3000,
  },
  marketplace: 'amazon.com',
};

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_FETCHES_PER_SEARCH = 20;
export const MAX_ORGANIC_RESULTS_TO_PARSE = 16;
