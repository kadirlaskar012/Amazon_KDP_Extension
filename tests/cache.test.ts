import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CACHE_TTL_MS } from '../src/config/defaults';

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
      clear: vi.fn(async () => {
        for (const k of Object.keys(mockStorage)) {
          delete mockStorage[k];
        }
      }),
    },
  },
} as any;

import { getCachedBook, setCachedBook, getCachedBooks } from '../src/storage';

describe('Product 24-Hour Cache', () => {
  beforeEach(() => {
    for (const k of Object.keys(mockStorage)) {
      delete mockStorage[k];
    }
    vi.clearAllMocks();
  });

  it('stores and retrieves cached book within TTL', async () => {
    const asin = 'B09TESTASIN';
    await setCachedBook(asin, {
      title: 'Cached Title',
      bsrOverall: 12500,
      pageCount: 110,
    });

    const cached = await getCachedBook(asin);
    expect(cached).not.toBeNull();
    expect(cached?.title).toBe('Cached Title');
    expect(cached?.bsrOverall).toBe(12500);
    expect(cached?.pageCount).toBe(110);
  });

  it('expires cache after 24 hours', async () => {
    const asin = 'B09EXPIRED';
    const oldTimestamp = Date.now() - (CACHE_TTL_MS + 1000); // 24h + 1s ago

    mockStorage[`kdp_cache_${asin}`] = {
      asin,
      data: { title: 'Old Title', bsrOverall: 9999 },
      timestamp: oldTimestamp,
    };

    const cached = await getCachedBook(asin);
    expect(cached).toBeNull();
  });

  it('retrieves batch of books from cache', async () => {
    await setCachedBook('ASIN1', { title: 'Book 1', bsrOverall: 1000 });
    await setCachedBook('ASIN2', { title: 'Book 2', bsrOverall: 2000 });

    const batch = await getCachedBooks(['ASIN1', 'ASIN2', 'ASIN_MISSING']);
    expect(batch['ASIN1']?.title).toBe('Book 1');
    expect(batch['ASIN2']?.title).toBe('Book 2');
    expect(batch['ASIN_MISSING']).toBeUndefined();
  });
});
