import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chrome storage
const mockStorage: Record<string, any> = {};

(globalThis as any).chrome = {
  storage: {
    local: {
      get: vi.fn(async (keys: string[] | null) => {
        if (!keys) return { ...mockStorage };
        const result: Record<string, any> = {};
        for (const k of keys) {
          if (mockStorage[k] !== undefined) {
            result[k] = mockStorage[k];
          }
        }
        return result;
      }),
      set: vi.fn(async (items: Record<string, any>) => {
        Object.assign(mockStorage, items);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) {
          delete mockStorage[k];
        }
      }),
    },
  },
} as any;

import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  appendHistoryPoint,
  getTrend,
} from '../src/services/watchlist';
import type { WatchlistItem } from '../src/types';

describe('watchlist service', () => {
  beforeEach(() => {
    for (const k of Object.keys(mockStorage)) {
      delete mockStorage[k];
    }
    vi.clearAllMocks();
  });

  it('adds and removes books from the watchlist', async () => {
    const resAdd = await addToWatchlist({
      asin: 'B01TESTBOOK',
      title: 'Awesome Coloring Book',
      bsrOverall: 50000,
      price: 6.99,
      reviewCount: 45,
    });

    expect(resAdd.success).toBe(true);
    let list = await getWatchlist();
    expect(list).toHaveLength(1);
    expect(list[0]!.asin).toBe('B01TESTBOOK');
    expect(list[0]!.history).toHaveLength(1);
    expect(list[0]!.history[0]!.bsrOverall).toBe(50000);

    // Remove
    await removeFromWatchlist('B01TESTBOOK');
    list = await getWatchlist();
    expect(list).toHaveLength(0);
  });

  it('enforces maximum watchlist size limit', async () => {
    const maxSize = 2;
    await addToWatchlist({ asin: 'B01', title: 'Book 1' }, maxSize);
    await addToWatchlist({ asin: 'B02', title: 'Book 2' }, maxSize);

    const resThird = await addToWatchlist({ asin: 'B03', title: 'Book 3' }, maxSize);
    expect(resThird.success).toBe(false);
    expect(resThird.message).toContain('Watchlist is full');

    const list = await getWatchlist();
    expect(list).toHaveLength(2);
  });

  it('overwrites the history point for the same calendar day without duplicate points', async () => {
    await addToWatchlist({
      asin: 'B01SAME',
      title: 'Book Same Day',
      bsrOverall: 100000,
      price: 9.99,
    });

    const today = new Date().toISOString().split('T')[0]!;

    // Append updated point for same date
    await appendHistoryPoint('B01SAME', {
      date: today,
      bsrOverall: 95000,
      price: 8.99,
      reviewCount: 50,
    });

    const list = await getWatchlist();
    expect(list[0]!.history).toHaveLength(1);
    expect(list[0]!.history[0]!.bsrOverall).toBe(95000);
    expect(list[0]!.history[0]!.price).toBe(8.99);
  });

  it('trims history points when exceeding maxPoints', async () => {
    await addToWatchlist({
      asin: 'B01TRIM',
      title: 'Book Trim',
    });

    // Append 5 points with maxPoints = 3 using future dates to test trimming
    for (let i = 1; i <= 5; i++) {
      await appendHistoryPoint(
        'B01TRIM',
        {
          date: `2029-01-0${i}`,
          bsrOverall: 10000 * i,
        },
        3
      );
    }

    const list = await getWatchlist();
    const history = list[0]!.history;
    expect(history.length).toBeLessThanOrEqual(3);
    // Should preserve the latest points (e.g. 03, 04, 05)
    expect(history[history.length - 1]!.date).toBe('2029-01-05');
  });

  describe('getTrend calculation & boundary tests', () => {
    it('returns unknown when fewer than 2 valid history points exist', () => {
      const item: WatchlistItem = {
        asin: 'B01',
        title: 'Book',
        addedAt: Date.now(),
        history: [{ date: '2024-01-01', bsrOverall: 50000 }],
      };
      const trend = getTrend(item);
      expect(trend.trend).toBe('unknown');
    });

    it('classifies improving trend when BSR drops by more than 5% (boundary test: 5.1%)', () => {
      // BSR drops from 100,000 to 94,900 (-5.1% -> rank improves)
      const item: WatchlistItem = {
        asin: 'B01',
        title: 'Book',
        addedAt: Date.now(),
        history: [
          { date: '2024-01-01', bsrOverall: 100000 },
          { date: '2024-01-02', bsrOverall: 94900 },
        ],
      };
      const trend = getTrend(item, 7, 5);
      expect(trend.trend).toBe('improving');
      expect(trend.percentChange).toBe(-5.1);
    });

    it('classifies declining trend when BSR rises by more than 5% (boundary test: 5.1%)', () => {
      // BSR rises from 100,000 to 105,100 (+5.1% -> rank drops)
      const item: WatchlistItem = {
        asin: 'B01',
        title: 'Book',
        addedAt: Date.now(),
        history: [
          { date: '2024-01-01', bsrOverall: 100000 },
          { date: '2024-01-02', bsrOverall: 105100 },
        ],
      };
      const trend = getTrend(item, 7, 5);
      expect(trend.trend).toBe('declining');
      expect(trend.percentChange).toBe(5.1);
    });

    it('classifies stable trend when BSR changes within +/- 5% (boundary test: 4.9%)', () => {
      // BSR drops by 4.9% (100,000 -> 95,100)
      const itemDrop: WatchlistItem = {
        asin: 'B01',
        title: 'Book',
        addedAt: Date.now(),
        history: [
          { date: '2024-01-01', bsrOverall: 100000 },
          { date: '2024-01-02', bsrOverall: 95100 },
        ],
      };
      expect(getTrend(itemDrop, 7, 5).trend).toBe('stable');

      // BSR rises by 4.9% (100,000 -> 104,900)
      const itemRise: WatchlistItem = {
        asin: 'B02',
        title: 'Book',
        addedAt: Date.now(),
        history: [
          { date: '2024-01-01', bsrOverall: 100000 },
          { date: '2024-01-02', bsrOverall: 104900 },
        ],
      };
      expect(getTrend(itemRise, 7, 5).trend).toBe('stable');
    });
  });
});
