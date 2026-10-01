import type { Book, WatchlistItem, SearchSnapshot } from '../types';
import { DEFAULT_SETTINGS, CACHE_TTL_MS } from '../config/defaults';

export { getDiscoverIdeas, saveDiscoverIdeas, getDiscoverHistory, saveDiscoverHistoryEntry, clearDiscoverHistory, getDiscoverDismissed, dismissPhrase, restoreDismissedPhrase, getActiveDismissedPhrases, clearDiscoverDismissed, getDiscoverScanState, saveDiscoverScanState, clearDiscoverScanState } from './discover';

export const STORAGE_VERSION = 2;
export const STORAGE_VERSION_KEY = 'kdp_storage_version';

const STORAGE_KEYS = {
  SETTINGS: 'kdp_settings',
  WATCHLIST: 'kdp_watchlist',
  SNAPSHOTS: 'kdp_snapshots',
  ACTIVE_SNAPSHOT: 'kdp_active_snapshot',
  CACHE_PREFIX: 'kdp_cache_',
  DISCOVER_IDEAS: 'kdp_discover_ideas',
  DISCOVER_HISTORY: 'kdp_discover_history',
  DISCOVER_DISMISSED: 'kdp_discover_dismissed',
  DISCOVER_SCAN_STATE: 'kdp_discover_scan_state',
} as const;

interface CacheEntry {
  asin: string;
  data: Partial<Book>;
  timestamp: number;
}

/**
 * Migrates older extension storage representations to the current version schema
 */
export async function migrateStorage(): Promise<void> {
  const currentVer = await getStorageItem<number>(STORAGE_VERSION_KEY, 0);
  if (currentVer < STORAGE_VERSION) {
    try {
      // Version 1→2: clean up snapshots
      const snapshots = await getSnapshots();
      if (Array.isArray(snapshots)) {
        const cleaned = snapshots.map((s) => ({
          ...s,
          books: Array.isArray(s.books) ? s.books : [],
          keywords: Array.isArray(s.keywords) ? s.keywords : [],
          categories: Array.isArray(s.categories) ? s.categories : [],
          ideas: Array.isArray(s.ideas) ? s.ideas : [],
        }));
        await setStorageItem(STORAGE_KEYS.SNAPSHOTS, cleaned);
      }

      // Version 1→2: migrate old top-50 discover data to top-10 shape
      if (currentVer < 2) {
        const oldDiscover = await getStorageItem<any>(STORAGE_KEYS.DISCOVER_IDEAS, null);
        if (oldDiscover && Array.isArray(oldDiscover.ideas)) {
          // Old shape: { ideas: Idea[], generatedAt } → new: { pool, top10, scanStatus, requestsUsed }
          const sorted = [...oldDiscover.ideas].sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));
          const top10 = sorted.slice(0, 10).map((idea: any) => ({
            phrase: idea.phrase || idea.keyword || '',
            source: 'Autocomplete' as const,
            score: idea.score ?? 0,
            status: 'quick' as const,
            bsrChecked: 0,
            bsrTotal: 5,
            whyText: 'Migrated from previous scan data',
          }));
          await setStorageItem(STORAGE_KEYS.DISCOVER_IDEAS, {
            generatedAt: oldDiscover.generatedAt ?? Date.now(),
            scanStatus: 'complete',
            requestsUsed: 0,
            pool: top10,
            top10,
          });
        }
      }

      await setStorageItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
      console.log(`[KDP Storage] Migrated storage schema to version ${STORAGE_VERSION}`);
    } catch (err) {
      console.warn('[KDP Storage] Migration encountered an error:', err);
    }
  }
}

/**
 * Safe chrome.storage.local accessor
 */
export async function getStorageItem<T>(key: string, defaultValue: T): Promise<T> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return defaultValue;
    }
    const result = await chrome.storage.local.get([key]);
    return result[key] !== undefined ? (result[key] as T) : defaultValue;
  } catch (error) {
    console.warn(`[KDP Storage] Failed to read ${key}:`, error);
    return defaultValue;
  }
}

export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }
    await chrome.storage.local.set({ [key]: value });
  } catch (error: any) {
    const errStr = String(error?.message || error || '');
    if (errStr.includes('QUOTA') || errStr.includes('quota')) {
      console.warn(`[KDP Storage] Storage quota warning while writing ${key}. Pruning old snapshots and cache...`);
      try {
        // Drop oldest snapshots (keep top 10)
        const snapshots = await getSnapshots();
        if (snapshots.length > 10) {
          await chrome.storage.local.set({ [STORAGE_KEYS.SNAPSHOTS]: snapshots.slice(0, 10) });
        }
        // Clear expired cache entries
        await clearCache();
        // Retry writing the requested item
        await chrome.storage.local.set({ [key]: value });
        return;
      } catch (retryErr) {
        console.error('[KDP Storage] Quota recovery failed:', retryErr);
      }
    }
    console.warn(`[KDP Storage] Failed to write ${key}:`, error);
  }
}

export async function removeStorageItem(key: string): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }
    await chrome.storage.local.remove([key]);
  } catch (error) {
    console.warn(`[KDP Storage] Failed to remove ${key}:`, error);
  }
}

// Settings
import { getSettings, saveSettings } from './settings';
export { getSettings, saveSettings };

async function getEffectiveTtl(): Promise<number> {
  try {
    const settings = await getSettings();
    if (settings.cacheDurationHours && settings.cacheDurationHours > 0) {
      return settings.cacheDurationHours * 3600 * 1000;
    }
  } catch {
    // Fall back to default
  }
  return CACHE_TTL_MS;
}

// Dynamic Product Cache
export async function getCachedBook(asin: string): Promise<Book | null> {
  if (!asin) return null;
  const key = `${STORAGE_KEYS.CACHE_PREFIX}${asin}`;
  const entry = await getStorageItem<CacheEntry | null>(key, null);
  if (!entry) return null;

  const now = Date.now();
  const ttl = await getEffectiveTtl();
  if (now - entry.timestamp > ttl) {
    // Expired
    await removeStorageItem(key);
    return null;
  }
  return entry.data as Book;
}

export async function setCachedBook(asin: string, data: Partial<Book>): Promise<void> {
  if (!asin) return;
  const key = `${STORAGE_KEYS.CACHE_PREFIX}${asin}`;
  const entry: CacheEntry = {
    asin,
    data: { ...data, fetchedAt: Date.now() },
    timestamp: Date.now(),
  };
  await setStorageItem(key, entry);
}

export async function getCachedBooks(asins: string[]): Promise<Record<string, Book>> {
  const result: Record<string, Book> = {};
  if (!asins.length || typeof chrome === 'undefined' || !chrome.storage?.local) {
    return result;
  }
  const keys = asins.map((asin) => `${STORAGE_KEYS.CACHE_PREFIX}${asin}`);
  try {
    const raw = await chrome.storage.local.get(keys);
    const now = Date.now();
    const ttl = await getEffectiveTtl();
    for (const asin of asins) {
      const entry = raw[`${STORAGE_KEYS.CACHE_PREFIX}${asin}`] as CacheEntry | undefined;
      if (entry && now - entry.timestamp <= ttl) {
        result[asin] = entry.data as Book;
      }
    }
  } catch (err) {
    console.warn('[KDP Storage] Batch cache read error:', err);
  }
  return result;
}

export async function clearCache(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  try {
    const all = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(all).filter((k) => k.startsWith(STORAGE_KEYS.CACHE_PREFIX));
    if (keysToRemove.length) {
      await chrome.storage.local.remove(keysToRemove);
    }
  } catch (err) {
    console.warn('[KDP Storage] Failed to clear cache:', err);
  }
}

// Watchlist
export async function getWatchlist(): Promise<WatchlistItem[]> {
  return getStorageItem<WatchlistItem[]>(STORAGE_KEYS.WATCHLIST, []);
}

export async function saveWatchlistItem(item: WatchlistItem): Promise<void> {
  const list = await getWatchlist();
  const existingIdx = list.findIndex((w) => w.asin === item.asin);
  if (existingIdx >= 0) {
    list[existingIdx] = item;
  } else {
    list.push(item);
  }
  await setStorageItem(STORAGE_KEYS.WATCHLIST, list);
}

export async function removeWatchlistItem(asin: string): Promise<void> {
  const list = await getWatchlist();
  const filtered = list.filter((w) => w.asin !== asin);
  await setStorageItem(STORAGE_KEYS.WATCHLIST, filtered);
}

// Snapshots
export async function getSnapshots(): Promise<SearchSnapshot[]> {
  return getStorageItem<SearchSnapshot[]>(STORAGE_KEYS.SNAPSHOTS, []);
}

export async function saveSnapshot(snapshot: SearchSnapshot): Promise<void> {
  const list = await getSnapshots();
  // Keep last 30 snapshots
  const updated = [snapshot, ...list.filter((s) => s.query !== snapshot.query || s.date !== snapshot.date)].slice(0, 30);
  await setStorageItem(STORAGE_KEYS.SNAPSHOTS, updated);
  await setStorageItem(STORAGE_KEYS.ACTIVE_SNAPSHOT, snapshot);
}

export async function getActiveSnapshot(): Promise<SearchSnapshot | null> {
  return getStorageItem<SearchSnapshot | null>(STORAGE_KEYS.ACTIVE_SNAPSHOT, null);
}

export async function clearAllData(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.clear();
  await saveSettings(DEFAULT_SETTINGS);
}
