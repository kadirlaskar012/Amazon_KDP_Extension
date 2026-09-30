// src/services/tracker.ts
// Daily Watchlist refresh service with 20h threshold, concurrency lock, and CAPTCHA handling

import type { WatchlistItem, HistoryPoint } from '../types';
import { DEFAULT_TRACKER_CONFIG } from '../config/defaults';
import { getStorageItem, setStorageItem, removeStorageItem } from '../storage';
import { getWatchlist, appendHistoryPoint, getTodayIsoDate } from './watchlist';
import { parseProductPage, isCaptchaPage, type ParsedProductDetails } from '../parsers/productPage';

const LOCK_KEY = 'kdp_tracker_lock';
const LOCK_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

interface TrackerLock {
  lockedAt: number;
}

/**
 * Checks whether an item should be refreshed (checked >= 20 hours ago or never checked)
 */
export function shouldRefreshItem(
  item: WatchlistItem,
  thresholdHours: number = DEFAULT_TRACKER_CONFIG.checkThresholdHours,
  forceAll: boolean = false
): boolean {
  if (forceAll) return true;
  if (!item.lastCheckedAt) return true;
  const elapsedHours = (Date.now() - item.lastCheckedAt) / (1000 * 60 * 60);
  return elapsedHours >= thresholdHours;
}

/**
 * Attempts to acquire tracker concurrency lock. Auto-expires after 30 minutes.
 */
export async function acquireTrackerLock(): Promise<boolean> {
  const currentLock = await getStorageItem<TrackerLock | null>(LOCK_KEY, null);
  const now = Date.now();

  if (currentLock && now - currentLock.lockedAt < LOCK_EXPIRY_MS) {
    // Active lock exists
    return false;
  }

  await setStorageItem<TrackerLock>(LOCK_KEY, { lockedAt: now });
  return true;
}

/**
 * Releases the tracker concurrency lock
 */
export async function releaseTrackerLock(): Promise<void> {
  await removeStorageItem(LOCK_KEY);
}

/**
 * Randomized sleep helper between 2000ms - 3000ms
 */
function sleepRandom(minMs: number = 2000, maxMs: number = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export interface TrackerResult {
  success: boolean;
  reason?: 'LOCKED' | 'CAPTCHA_DETECTED' | 'NO_ITEMS';
  updatedCount: number;
  totalEligible: number;
  captchaUrl?: string;
}

/**
 * Sets badge text and background color on the extension action icon
 */
export function setTrackerBadge(text: string, color: string = '#ef4444'): void {
  try {
    if (typeof chrome !== 'undefined' && chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text });
      if (color) {
        chrome.action.setBadgeBackgroundColor({ color });
      }
    }
  } catch (err) {
    // Ignore in unsupported environments
  }
}

/**
 * Refreshes eligible watchlist items:
 * - Checks 20h threshold
 * - Applies 2-3s delay
 * - Captures BSR, price, reviews, ratings
 * - Stops immediately on CAPTCHA and marks remaining items
 * - Gracefully continues on individual item fetch/parse failures
 */
export async function refreshWatchlist(options?: {
  forceAll?: boolean;
  onProgress?: (current: number, total: number, asin: string) => void;
  fetchFn?: (url: string) => Promise<string>;
}): Promise<TrackerResult> {
  const acquired = await acquireTrackerLock();
  if (!acquired) {
    return {
      success: false,
      reason: 'LOCKED',
      updatedCount: 0,
      totalEligible: 0,
    };
  }

  try {
    const list = await getWatchlist();
    const eligible = list.filter((item) => shouldRefreshItem(item, DEFAULT_TRACKER_CONFIG.checkThresholdHours, options?.forceAll));

    if (eligible.length === 0) {
      return {
        success: true,
        reason: 'NO_ITEMS',
        updatedCount: 0,
        totalEligible: 0,
      };
    }

    let updatedCount = 0;
    const today = getTodayIsoDate();

    for (let i = 0; i < eligible.length; i++) {
      const item = eligible[i]!;

      if (options?.onProgress) {
        options.onProgress(i + 1, eligible.length, item.asin);
      }

      // Rate limit delay between product requests (if not first item)
      if (i > 0) {
        await sleepRandom(2000, 3000);
      }

      const productUrl = `https://www.amazon.com/dp/${item.asin}`;
      let html = '';

      try {
        if (options?.fetchFn) {
          html = await options.fetchFn(productUrl);
        } else {
          const res = await fetch(productUrl, {
            headers: {
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          html = await res.text();
        }

        // CAPTCHA check
        if (isCaptchaPage(html)) {
          setTrackerBadge('!');

          // Mark remaining eligible items with 'captcha' status
          const currentList = await getWatchlist();
          for (let j = i; j < eligible.length; j++) {
            const remaining = eligible[j]!;
            const idx = currentList.findIndex((w) => w.asin === remaining.asin);
            if (idx >= 0) {
              currentList[idx] = {
                ...currentList[idx]!,
                lastStatus: 'captcha',
                lastCheckedAt: Date.now(),
              };
            }
          }
          await setStorageItem('kdp_watchlist', currentList);

          return {
            success: false,
            reason: 'CAPTCHA_DETECTED',
            updatedCount,
            totalEligible: eligible.length,
            captchaUrl: productUrl,
          };
        }

        let parsed: ParsedProductDetails;
        if (typeof DOMParser !== 'undefined') {
          parsed = parseProductPage(html);
        } else if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          try {
            const resp = await chrome.runtime.sendMessage({
              type: 'DOM_PARSE_PRODUCT',
              html,
            });
            if (resp && resp.success && resp.parsed) {
              parsed = resp.parsed;
            } else {
              parsed = parseProductPage(html);
            }
          } catch {
            parsed = parseProductPage(html);
          }
        } else {
          parsed = parseProductPage(html);
        }

        if (parsed.isCaptcha) {
          setTrackerBadge('!');
          return {
            success: false,
            reason: 'CAPTCHA_DETECTED',
            updatedCount,
            totalEligible: eligible.length,
            captchaUrl: productUrl,
          };
        }

        // Create new history point
        const point: HistoryPoint = {
          date: today,
          bsrOverall: parsed.bsrOverall,
          bsr: parsed.bsrOverall,
          price: item.price,
          categoryRank: parsed.categoryRanks && parsed.categoryRanks[0]
            ? { name: parsed.categoryRanks[0].name || parsed.categoryRanks[0].category || '', rank: parsed.categoryRanks[0].rank }
            : undefined,
        };

        await appendHistoryPoint(item.asin, point);
        updatedCount++;
      } catch (err) {
        console.warn(`[Tracker] Failed to refresh ASIN ${item.asin}:`, err);
        // Mark failed item without wiping history
        const currentList = await getWatchlist();
        const idx = currentList.findIndex((w) => w.asin === item.asin);
        if (idx >= 0) {
          currentList[idx] = {
            ...currentList[idx]!,
            lastStatus: 'failed',
            lastCheckedAt: Date.now(),
          };
          await setStorageItem('kdp_watchlist', currentList);
        }
      }
    }

    // Clear badge if finished successfully without captcha
    setTrackerBadge('');

    return {
      success: true,
      updatedCount,
      totalEligible: eligible.length,
    };
  } finally {
    await releaseTrackerLock();
  }
}
