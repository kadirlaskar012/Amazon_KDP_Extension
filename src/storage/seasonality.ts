// src/storage/seasonality.ts
// Storage for per-keyword Google Trends CSV data and recent keyword history for the Seasonality tab.

import { getStorageItem, setStorageItem } from './index';

const RECENT_KEYWORDS_KEY = 'kdp_seasonality_recent_keywords';
const TRENDS_CSV_PREFIX = 'kdp_trends_csv_';
const MAX_RECENT = 20;

/**
 * Returns the last up-to-20 keywords the user typed into the Seasonality tab input.
 */
export async function getRecentSeasonalityKeywords(): Promise<string[]> {
  return getStorageItem<string[]>(RECENT_KEYWORDS_KEY, []);
}

/**
 * Adds a keyword to the front of the recent list and trims to 20 items.
 */
export async function addRecentSeasonalityKeyword(keyword: string): Promise<void> {
  const trimmed = keyword.trim().toLowerCase();
  if (!trimmed) return;
  const existing = await getRecentSeasonalityKeywords();
  const deduplicated = [trimmed, ...existing.filter((k) => k !== trimmed)].slice(0, MAX_RECENT);
  await setStorageItem(RECENT_KEYWORDS_KEY, deduplicated);
}

export interface ParsedTrendsSeries {
  keyword: string;
  geo: string;
  /** ISO week/month strings matching the data rows */
  dates: string[];
  /** Interest values (0-100, <1 is stored as 0) */
  values: number[];
  /** First date in the series */
  startDate: string;
  /** Last date in the series */
  endDate: string;
  /** Approximate number of years of data */
  yearsOfData: number;
  storedAt: number;
}

function trendsCsvKey(keyword: string, geo: string): string {
  const normalizedKeyword = keyword.trim().toLowerCase().replace(/\s+/g, '_');
  const normalizedGeo = (geo || 'US').toUpperCase();
  return `${TRENDS_CSV_PREFIX}${normalizedKeyword}_${normalizedGeo}`;
}

/**
 * Retrieves parsed Google Trends CSV data for a specific keyword+geo, or null if not stored.
 */
export async function getTrendsCsvData(keyword: string, geo: string): Promise<ParsedTrendsSeries | null> {
  return getStorageItem<ParsedTrendsSeries | null>(trendsCsvKey(keyword, geo), null);
}

/**
 * Saves parsed Google Trends CSV data for a keyword+geo.
 */
export async function saveTrendsCsvData(series: ParsedTrendsSeries): Promise<void> {
  await setStorageItem(trendsCsvKey(series.keyword, series.geo), { ...series, storedAt: Date.now() });
}

/**
 * Removes stored Trends CSV data for a keyword+geo (so user can re-upload fresh data).
 */
export async function clearTrendsCsvData(keyword: string, geo: string): Promise<void> {
  const key = trendsCsvKey(keyword, geo);
  await setStorageItem(key, null);
}
