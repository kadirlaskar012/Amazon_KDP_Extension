// src/storage/discover.ts
// Storage helpers for all Discover Top 10 data.

import type {
  DiscoverIdeasStorage,
  DiscoverHistoryEntry,
  DiscoverDismissedEntry,
  DiscoverScanState,
} from '../types/discover';
import { getStorageItem, setStorageItem } from './index';
import { DISCOVER_HISTORY_DAYS } from '../config/discoverDefaults';

// ── Storage keys ──────────────────────────────────────────────────────────────
const KEY_IDEAS = 'kdp_discover_ideas';
const KEY_HISTORY = 'kdp_discover_history';
const KEY_DISMISSED = 'kdp_discover_dismissed';
const KEY_SCAN_STATE = 'kdp_discover_scan_state';

// ── DiscoverIdeas ─────────────────────────────────────────────────────────────

export async function getDiscoverIdeas(): Promise<DiscoverIdeasStorage | null> {
  return getStorageItem<DiscoverIdeasStorage | null>(KEY_IDEAS, null);
}

export async function saveDiscoverIdeas(data: DiscoverIdeasStorage): Promise<void> {
  await setStorageItem(KEY_IDEAS, data);
}

// ── DiscoverHistory ───────────────────────────────────────────────────────────

export async function getDiscoverHistory(): Promise<DiscoverHistoryEntry[]> {
  return getStorageItem<DiscoverHistoryEntry[]>(KEY_HISTORY, []);
}

/**
 * Saves a new history entry.
 * Trims to the last DISCOVER_HISTORY_DAYS entries (newest first).
 * If an entry for the same date already exists, it is replaced.
 */
export async function saveDiscoverHistoryEntry(entry: DiscoverHistoryEntry): Promise<void> {
  const history = await getDiscoverHistory();
  const filtered = history.filter((h) => h.date !== entry.date);
  const updated = [entry, ...filtered].slice(0, DISCOVER_HISTORY_DAYS);
  await setStorageItem(KEY_HISTORY, updated);
}

export async function clearDiscoverHistory(): Promise<void> {
  await setStorageItem(KEY_HISTORY, []);
}

// ── DiscoverDismissed ─────────────────────────────────────────────────────────

export async function getDiscoverDismissed(): Promise<DiscoverDismissedEntry[]> {
  return getStorageItem<DiscoverDismissedEntry[]>(KEY_DISMISSED, []);
}

/**
 * Adds or refreshes a dismiss entry. Prunes expired entries on write.
 */
export async function dismissPhrase(phrase: string, durationDays: number = 30): Promise<void> {
  const now = Date.now();
  const until = now + durationDays * 24 * 60 * 60 * 1000;
  const list = await getDiscoverDismissed();
  // Remove expired + any existing entry for this phrase
  const cleaned = list.filter((d) => d.until > now && d.phrase !== phrase);
  cleaned.push({ phrase, until });
  await setStorageItem(KEY_DISMISSED, cleaned);
}

/**
 * Restores a dismissed phrase (removes it from the dismissed list).
 */
export async function restoreDismissedPhrase(phrase: string): Promise<void> {
  const list = await getDiscoverDismissed();
  const updated = list.filter((d) => d.phrase !== phrase);
  await setStorageItem(KEY_DISMISSED, updated);
}

/**
 * Returns only the currently active (non-expired) dismissed phrases.
 */
export async function getActiveDismissedPhrases(): Promise<Set<string>> {
  const now = Date.now();
  const list = await getDiscoverDismissed();
  return new Set(list.filter((d) => d.until > now).map((d) => d.phrase));
}

export async function clearDiscoverDismissed(): Promise<void> {
  await setStorageItem(KEY_DISMISSED, []);
}

// ── DiscoverScanState ─────────────────────────────────────────────────────────

export async function getDiscoverScanState(): Promise<DiscoverScanState> {
  return getStorageItem<DiscoverScanState>(KEY_SCAN_STATE, { cursor: 0 });
}

export async function saveDiscoverScanState(state: DiscoverScanState): Promise<void> {
  await setStorageItem(KEY_SCAN_STATE, state);
}

export async function clearDiscoverScanState(): Promise<void> {
  await setStorageItem(KEY_SCAN_STATE, { cursor: 0 });
}
