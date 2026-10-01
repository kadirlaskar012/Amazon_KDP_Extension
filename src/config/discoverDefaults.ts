// src/config/discoverDefaults.ts
// Constants and defaults for the Discover Top 10 Opportunities feature

import type { DiscoverCategorySource } from '../types/discover';

/** Fixed number of ideas shown in the UI (never changes) */
export const DISCOVER_IDEAS_SHOWN = 10;

/** Max internal candidate pool size evaluated per scan */
export const DISCOVER_POOL_SIZE = 40;

/** Default max HTTP requests per daily scan (user-editable in Options) */
export const DISCOVER_MAX_REQUESTS_DEFAULT = 120;

/** Hours before a scan result is considered stale */
export const DISCOVER_STALE_HOURS = 20;

/** Lock expiry — if a lock is older than 30 minutes, it is considered dead */
export const DISCOVER_LOCK_EXPIRY_MS = 30 * 60 * 1000;

/** Alarm name for daily Discover auto-refresh */
export const DISCOVER_ALARM_NAME = 'kdp-discover-daily';

/** How many days of history to keep */
export const DISCOVER_HISTORY_DAYS = 30;

/** How many days a dismissed phrase is suppressed */
export const DISCOVER_DISMISS_DAYS = 30;

/** Streak threshold for "Stable" label */
export const DISCOVER_STABLE_STREAK = 3;

/** Max ideas shown in "Dropped out" section */
export const DISCOVER_DROPPED_OUT_MAX = 5;

/** Days back to include "Related" phrases from browsing */
export const DISCOVER_RELATED_LOOKBACK_DAYS = 7;

/** Minimum BSR checks to qualify for Top 10 ("Checked" status) */
export const DISCOVER_MIN_BSR_CHECKS = 4;

/**
 * Default 5 category source configurations.
 * Each has Movers & Shakers, New Releases, and Best Sellers URLs.
 */
export const DEFAULT_DISCOVER_CATEGORY_SOURCES: DiscoverCategorySource[] = [
  {
    label: 'Coloring Books',
    moversShakersUrl: 'https://www.amazon.com/gp/movers-and-shakers/books/16272401011',
    newReleasesUrl: 'https://www.amazon.com/gp/new-releases/books/16272401011',
    bestSellersUrl: 'https://www.amazon.com/best-sellers-books-Amazon/zgbs/books/16272401011',
  },
  {
    label: 'Activity Books',
    moversShakersUrl: 'https://www.amazon.com/gp/movers-and-shakers/books/16268088011',
    newReleasesUrl: 'https://www.amazon.com/gp/new-releases/books/16268088011',
    bestSellersUrl: 'https://www.amazon.com/best-sellers-books-Amazon/zgbs/books/16268088011',
  },
  {
    label: 'Puzzle Books',
    moversShakersUrl: 'https://www.amazon.com/gp/movers-and-shakers/books/16268088011',
    newReleasesUrl: 'https://www.amazon.com/gp/new-releases/books/3890',
    bestSellersUrl: 'https://www.amazon.com/best-sellers-books-Amazon/zgbs/books/3890',
  },
  {
    label: 'Journals & Notebooks',
    moversShakersUrl: 'https://www.amazon.com/gp/movers-and-shakers/books/11081081',
    newReleasesUrl: 'https://www.amazon.com/gp/new-releases/books/11081081',
    bestSellersUrl: 'https://www.amazon.com/best-sellers-books-Amazon/zgbs/books/11081081',
  },
  {
    label: 'Handwriting & Calligraphy',
    moversShakersUrl: 'https://www.amazon.com/gp/movers-and-shakers/books/16318691011',
    newReleasesUrl: 'https://www.amazon.com/gp/new-releases/books/16318691011',
    bestSellersUrl: 'https://www.amazon.com/best-sellers-books-Amazon/zgbs/books/16318691011',
  },
];

/** Default seed phrases for the rotating autocomplete source */
export const DEFAULT_DISCOVER_SEEDS: string[] = [
  'coloring book for kids',
  'activity book for toddlers',
  'gratitude journal',
  'log book',
  'word search puzzle book',
  'sudoku puzzle book',
  'maze book for kids',
  'handwriting practice',
  'dot markers activity book',
  'kids journal',
  'adult coloring book',
  'bible study journal',
  'composition notebook',
  'lined journal for women',
  'crossword puzzle book',
  'multiplication practice',
  'lined paper notebook',
  'baby tracker log',
  'password keeper book',
  'fitness journal',
];
