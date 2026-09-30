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
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
  },
} as any;

import {
  shouldRefreshItem,
  acquireTrackerLock,
  releaseTrackerLock,
  refreshWatchlist,
} from '../src/services/tracker';
import type { WatchlistItem } from '../src/types';

describe('tracker service', () => {
  beforeEach(() => {
    for (const k of Object.keys(mockStorage)) {
      delete mockStorage[k];
    }
    vi.clearAllMocks();
  });

  describe('shouldRefreshItem', () => {
    it('skips items checked under 20 hours ago', () => {
      const recentItem: WatchlistItem = {
        asin: 'B01RECENT',
        title: 'Recent Book',
        addedAt: Date.now() - 24 * 3600 * 1000,
        lastCheckedAt: Date.now() - 10 * 3600 * 1000, // 10 hours ago (< 20h)
        history: [],
      };

      expect(shouldRefreshItem(recentItem, 20)).toBe(false);
    });

    it('refreshes items checked 20 or more hours ago or never checked', () => {
      const dueItem: WatchlistItem = {
        asin: 'B02DUE',
        title: 'Due Book',
        addedAt: Date.now() - 48 * 3600 * 1000,
        lastCheckedAt: Date.now() - 21 * 3600 * 1000, // 21 hours ago (>= 20h)
        history: [],
      };
      expect(shouldRefreshItem(dueItem, 20)).toBe(true);

      const newItem: WatchlistItem = {
        asin: 'B03NEW',
        title: 'New Book',
        addedAt: Date.now(),
        history: [],
      };
      expect(shouldRefreshItem(newItem, 20)).toBe(true);
    });

    it('forceAll refreshes even recently checked items', () => {
      const recentItem: WatchlistItem = {
        asin: 'B01RECENT',
        title: 'Recent Book',
        addedAt: Date.now(),
        lastCheckedAt: Date.now() - 1 * 3600 * 1000, // 1 hour ago
        history: [],
      };

      expect(shouldRefreshItem(recentItem, 20, true)).toBe(true);
    });
  });

  describe('Concurrency Lock', () => {
    it('lock prevents double run and releases cleanly', async () => {
      const first = await acquireTrackerLock();
      expect(first).toBe(true);

      // Second immediate acquisition should fail
      const second = await acquireTrackerLock();
      expect(second).toBe(false);

      // Release
      await releaseTrackerLock();
      const third = await acquireTrackerLock();
      expect(third).toBe(true);
      await releaseTrackerLock();
    });

    it('ignores expired lock after 30 minutes', async () => {
      const thirtyOneMinutesAgo = Date.now() - 31 * 60 * 1000;
      mockStorage['kdp_tracker_lock'] = { lockedAt: thirtyOneMinutesAgo };

      const acquired = await acquireTrackerLock();
      expect(acquired).toBe(true);
      await releaseTrackerLock();
    });
  });

  describe('refreshWatchlist execution', () => {
    it('stops and marks captcha when CAPTCHA is encountered', async () => {
      mockStorage['kdp_watchlist'] = [
        {
          asin: 'B01CAPTCHA',
          title: 'Book 1',
          lastCheckedAt: 0,
          history: [],
        },
        {
          asin: 'B02REMAIN',
          title: 'Book 2',
          lastCheckedAt: 0,
          history: [],
        },
      ];

      const captchaHtml = `
        <html><body>
          <form action="/errors/validateCaptcha">
            <input id="captchacharacters" />
          </form>
          <p>Type the characters you see in this image</p>
        </body></html>
      `;

      const result = await refreshWatchlist({
        forceAll: true,
        fetchFn: async () => captchaHtml,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('CAPTCHA_DETECTED');

      // Remaining items should be marked 'captcha'
      const list: WatchlistItem[] = mockStorage['kdp_watchlist'];
      expect(list[0]!.lastStatus).toBe('captcha');
      expect(list[1]!.lastStatus).toBe('captcha');
    });

    it('marks a single failure and continues with next items', async () => {
      mockStorage['kdp_watchlist'] = [
        {
          asin: 'B01FAIL',
          title: 'Book 1',
          lastCheckedAt: 0,
          history: [{ date: '2024-01-01', bsrOverall: 10000 }],
        },
        {
          asin: 'B02SUCCESS',
          title: 'Book 2',
          lastCheckedAt: 0,
          history: [],
        },
      ];

      const successHtml = `
        <html><body>
          <div id="detailBullets_feature_div">
            <li><span>Best Sellers Rank: #42,100 in Books</span></li>
          </div>
        </body></html>
      `;

      const result = await refreshWatchlist({
        forceAll: true,
        fetchFn: async (url) => {
          if (url.includes('B01FAIL')) {
            throw new Error('404 Not Found');
          }
          return successHtml;
        },
      });

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(1);

      const list: WatchlistItem[] = mockStorage['kdp_watchlist'];
      // First item is marked failed but preserved history
      expect(list[0]!.lastStatus).toBe('failed');
      expect(list[0]!.history).toHaveLength(1);

      // Second item succeeded
      expect(list[1]!.lastStatus).toBe('ok');
      expect(list[1]!.history).toHaveLength(1);
      expect(list[1]!.history[0]!.bsrOverall).toBe(42100);
    });
  });
});
