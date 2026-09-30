import type { Settings, Book, WatchlistItem, SearchSnapshot } from '../types';
import { DEFAULT_SETTINGS, CACHE_TTL_MS } from '../config/defaults';

const STORAGE_KEYS = {
  SETTINGS: 'kdp_settings',
  WATCHLIST: 'kdp_watchlist',
  SNAPSHOTS: 'kdp_snapshots',
  ACTIVE_SNAPSHOT: 'kdp_active_snapshot',
  CACHE_PREFIX: 'kdp_cache_',
} as const;

interface CacheEntry {
  asin: string;
  data: Partial<Book>;
  timestamp: number;
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
  } catch (error) {
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
export async function getSettings(): Promise<Settings> {
  const saved = await getStorageItem<Partial<Settings>>(STORAGE_KEYS.SETTINGS, {});
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    weights: {
      ...DEFAULT_SETTINGS.weights,
      ...(saved.weights || {}),
    },
    fetchDelayMs: {
      ...DEFAULT_SETTINGS.fetchDelayMs,
      ...(saved.fetchDelayMs || {}),
    },
  };
}

export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated: Settings = {
    ...current,
    ...settings,
    weights: {
      ...current.weights,
      ...(settings.weights || {}),
    },
    fetchDelayMs: {
      ...current.fetchDelayMs,
      ...(settings.fetchDelayMs || {}),
    },
  };
  await setStorageItem(STORAGE_KEYS.SETTINGS, updated);
  return updated;
}

// 24-Hour Product Cache
export async function getCachedBook(asin: string): Promise<Book | null> {
  if (!asin) return null;
  const key = `${STORAGE_KEYS.CACHE_PREFIX}${asin}`;
  const entry = await getStorageItem<CacheEntry | null>(key, null);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
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
    for (const asin of asins) {
      const entry = raw[`${STORAGE_KEYS.CACHE_PREFIX}${asin}`] as CacheEntry | undefined;
      if (entry && now - entry.timestamp <= CACHE_TTL_MS) {
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
