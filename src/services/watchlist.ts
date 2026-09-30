// src/services/watchlist.ts
// Watchlist data service: add, remove, list, daily history append/overwrite, and BSR trend calculation

import type { WatchlistItem, HistoryPoint, TrendInfo, Book } from '../types';
import { DEFAULT_TRACKER_CONFIG, DEFAULT_TREND_CONFIG } from '../config/defaults';
import { getStorageItem, setStorageItem } from '../storage';

const WATCHLIST_STORAGE_KEY = 'kdp_watchlist';

/**
 * Returns today's ISO date string: "YYYY-MM-DD"
 */
export function getTodayIsoDate(dateObj: Date = new Date()): string {
  return dateObj.toISOString().split('T')[0] ?? '';
}

/**
 * Retrieves the full watchlist from chrome.storage.local
 */
export async function getWatchlist(): Promise<WatchlistItem[]> {
  const items = await getStorageItem<WatchlistItem[]>(WATCHLIST_STORAGE_KEY, []);
  // Ensure history points are sorted by date
  return items.map((item) => ({
    ...item,
    history: Array.isArray(item.history)
      ? [...item.history].sort((a, b) => a.date.localeCompare(b.date))
      : [],
  }));
}

/**
 * Adds a book to the watchlist.
 * Creates the initial history point immediately from known data.
 * Throws an error or returns false if maxWatchlistSize is exceeded.
 */
export async function addToWatchlist(
  book: Partial<Book> & { asin: string; title: string },
  maxSize: number = DEFAULT_TRACKER_CONFIG.maxWatchlistSize
): Promise<{ success: boolean; message?: string; item?: WatchlistItem }> {
  const list = await getWatchlist();
  const existingIdx = list.findIndex((w) => w.asin.toUpperCase() === book.asin.toUpperCase());

  if (existingIdx >= 0) {
    return {
      success: true,
      message: 'Book is already in your watchlist.',
      item: list[existingIdx],
    };
  }

  if (list.length >= maxSize) {
    return {
      success: false,
      message: `Watchlist is full (max ${maxSize} books). Please remove an item first.`,
    };
  }

  const today = getTodayIsoDate();
  const firstPoint: HistoryPoint = {
    date: today,
    bsrOverall: book.bsrOverall,
    bsr: book.bsrOverall,
    price: book.price,
    reviewCount: book.reviewCount,
    rating: book.rating,
    categoryRank: book.categoryRanks && book.categoryRanks[0]
      ? { name: book.categoryRanks[0].name || book.categoryRanks[0].category || '', rank: book.categoryRanks[0].rank }
      : undefined,
  };

  const newItem: WatchlistItem = {
    asin: book.asin.toUpperCase(),
    title: book.title,
    author: book.author,
    price: book.price,
    addedAt: Date.now(),
    lastCheckedAt: Date.now(),
    lastStatus: 'ok',
    history: [firstPoint],
  };

  const updatedList = [newItem, ...list];
  await setStorageItem(WATCHLIST_STORAGE_KEY, updatedList);

  return {
    success: true,
    message: `Added "${book.title.slice(0, 25)}..." to watchlist!`,
    item: newItem,
  };
}

/**
 * Removes a book from the watchlist by ASIN
 */
export async function removeFromWatchlist(asin: string): Promise<WatchlistItem[]> {
  const list = await getWatchlist();
  const filtered = list.filter((w) => w.asin.toUpperCase() !== asin.toUpperCase());
  await setStorageItem(WATCHLIST_STORAGE_KEY, filtered);
  return filtered;
}

/**
 * Appends or overwrites today's history point for an existing watchlist item.
 * Trims history to maxPoints (default 365).
 */
export async function appendHistoryPoint(
  asin: string,
  point: HistoryPoint,
  maxPoints: number = DEFAULT_TRACKER_CONFIG.historyMaxPoints
): Promise<WatchlistItem | null> {
  const list = await getWatchlist();
  const targetIdx = list.findIndex((w) => w.asin.toUpperCase() === asin.toUpperCase());
  if (targetIdx === -1) return null;

  const item = list[targetIdx]!;
  const history = [...(item.history || [])];

  // Overwrite if same calendar day already exists; otherwise append
  const existingPointIdx = history.findIndex((h) => h.date === point.date);
  if (existingPointIdx >= 0) {
    history[existingPointIdx] = {
      ...history[existingPointIdx],
      ...point,
      bsr: point.bsrOverall ?? point.bsr,
    };
  } else {
    history.push({
      ...point,
      bsr: point.bsrOverall ?? point.bsr,
    });
  }

  // Sort ascending by date
  history.sort((a, b) => a.date.localeCompare(b.date));

  // Trim to maxPoints (keep newest)
  const trimmedHistory = history.length > maxPoints ? history.slice(history.length - maxPoints) : history;

  const updatedItem: WatchlistItem = {
    ...item,
    history: trimmedHistory,
    price: point.price ?? item.price,
    lastCheckedAt: Date.now(),
    lastStatus: 'ok',
  };

  list[targetIdx] = updatedItem;
  await setStorageItem(WATCHLIST_STORAGE_KEY, list);
  return updatedItem;
}

/**
 * Computes trend and performance statistics for a watchlist item.
 * Lower BSR is better.
 * - improving: BSR dropped by > stableChangePercent
 * - declining: BSR rose by > stableChangePercent
 * - stable: within +/- stableChangePercent
 * - unknown: fewer than 2 valid history points
 */
export function getTrend(
  item: WatchlistItem,
  windowDays: number = DEFAULT_TREND_CONFIG.windowDays,
  stableChangePercent: number = DEFAULT_TREND_CONFIG.stableChangePercent
): TrendInfo {
  const validPoints = (item.history || [])
    .filter((h) => typeof (h.bsrOverall ?? h.bsr) === 'number' && (h.bsrOverall ?? h.bsr)! > 0);

  if (validPoints.length < 2) {
    const singleBsr = validPoints[0] ? (validPoints[0].bsrOverall ?? validPoints[0].bsr) : undefined;
    return {
      trend: 'unknown',
      percentChange: 0,
      bestBsr: singleBsr,
      worstBsr: singleBsr,
      avgBsr: singleBsr,
      daysTracked: validPoints.length,
      reviewCountChange: 0,
      priceChange: 0,
    };
  }

  const allBsrs = validPoints.map((h) => (h.bsrOverall ?? h.bsr)!);
  const bestBsr = Math.min(...allBsrs);
  const worstBsr = Math.max(...allBsrs);
  const avgBsr = Math.round(allBsrs.reduce((a, b) => a + b, 0) / allBsrs.length);

  // Compare recent window with preceding window (or first vs last point)
  let prevBsrAvg: number;
  let currBsrAvg: number;

  if (validPoints.length >= windowDays * 2) {
    const currWindow = validPoints.slice(validPoints.length - windowDays);
    const prevWindow = validPoints.slice(validPoints.length - windowDays * 2, validPoints.length - windowDays);

    currBsrAvg = currWindow.reduce((a, b) => a + (b.bsrOverall ?? b.bsr)!, 0) / currWindow.length;
    prevBsrAvg = prevWindow.reduce((a, b) => a + (b.bsrOverall ?? b.bsr)!, 0) / prevWindow.length;
  } else {
    // Fallback: compare first point to latest point
    prevBsrAvg = (validPoints[0]!.bsrOverall ?? validPoints[0]!.bsr)!;
    currBsrAvg = (validPoints[validPoints.length - 1]!.bsrOverall ?? validPoints[validPoints.length - 1]!.bsr)!;
  }

  // Calculate percentage change
  // Note: if BSR drops from 100k to 90k, percentChange = (90k - 100k) / 100k * 100 = -10%
  const percentChange = Math.round(((currBsrAvg - prevBsrAvg) / prevBsrAvg) * 1000) / 10;

  let trend: 'improving' | 'declining' | 'stable' | 'unknown';
  if (percentChange < -stableChangePercent) {
    // BSR dropped by more than 5% -> Rank is better!
    trend = 'improving';
  } else if (percentChange > stableChangePercent) {
    // BSR rose by more than 5% -> Rank is worse!
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  const firstPoint = validPoints[0]!;
  const latestPoint = validPoints[validPoints.length - 1]!;

  const reviewCountChange =
    latestPoint.reviewCount !== undefined && firstPoint.reviewCount !== undefined
      ? latestPoint.reviewCount - firstPoint.reviewCount
      : undefined;

  const priceChange =
    latestPoint.price !== undefined && firstPoint.price !== undefined
      ? Math.round((latestPoint.price - firstPoint.price) * 100) / 100
      : undefined;

  return {
    trend,
    percentChange,
    bestBsr,
    worstBsr,
    avgBsr,
    daysTracked: validPoints.length,
    reviewCountChange,
    priceChange,
  };
}

/**
 * Checks if a book is currently watched
 */
export async function isBookWatched(asin: string): Promise<boolean> {
  const list = await getWatchlist();
  return list.some((w) => w.asin.toUpperCase() === asin.toUpperCase());
}
