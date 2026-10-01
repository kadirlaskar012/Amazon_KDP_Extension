// src/services/discoverScanner.ts
// Discover Top 10 Opportunities scanner.
// Builds a candidate pool from 5 sources, applies quality filters,
// selects the best 10, computes trend/streak, handles resume-from-cursor.
// All network calls are rate-limited (2-3s) and stop on CAPTCHA.

import type { DiscoverIdea, DiscoverIdeaStatus, DiscoverScanStatus } from '../types/discover';
import { parseBestSellersPage } from '../parsers/bestSellersPage';
import { parseMoversShakersPage } from '../parsers/moversShakersPage';
import { parseNewReleasesPage } from '../parsers/newReleasesPage';
import { parseAutocompleteResponse } from './autocomplete';
import { buildAmazonAutocompleteUrl } from './autocomplete';
import { getDayIndex, getRotatingSeeds, buildRotatingQueries } from './discoverRotation';
import { getSettings } from '../storage/settings';
import { getStorageItem } from '../storage';
import {
  getDiscoverIdeas,
  saveDiscoverIdeas,
  getDiscoverHistory,
  saveDiscoverHistoryEntry,
  getActiveDismissedPhrases,
  getDiscoverScanState,
  saveDiscoverScanState,
} from '../storage/discover';
import { checkForbiddenWords } from '../config/forbiddenWords';
import {
  DISCOVER_IDEAS_SHOWN,
  DISCOVER_POOL_SIZE,
  DISCOVER_STALE_HOURS,
  DISCOVER_LOCK_EXPIRY_MS,
  DISCOVER_HISTORY_DAYS,
  DISCOVER_STABLE_STREAK,
  DISCOVER_DROPPED_OUT_MAX,
  DISCOVER_RELATED_LOOKBACK_DAYS,
  DISCOVER_MIN_BSR_CHECKS,
  DEFAULT_DISCOVER_SEEDS,
} from '../config/discoverDefaults';
import type { DiscoverSettings } from '../types/discover';

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleepRandom(minMs = 2000, maxMs = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, delay));
}

/** Derive a simple niche keyword phrase from a book title */
export function titleToKeyword(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(a|an|the|and|or|for|with|in|to|of|by|from|on|at|is|are|was|were)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 5)
    .join(' ');
}

/** Get today's ISO date string "YYYY-MM-DD" */
export function todayIso(): string {
  return new Date().toISOString().split('T')[0]!;
}

export interface ScanProgress {
  requestsUsed: number;
  total: number;
  message: string;
}

export interface ScanResult {
  success: boolean;
  scanStatus: DiscoverScanStatus;
  requestsUsed: number;
  pool: DiscoverIdea[];
  top10: DiscoverIdea[];
  captchaUrl?: string;
}

// ── Fetch with rate limit and CAPTCHA detection ───────────────────────────────

type FetchFn = (url: string) => Promise<string>;

function defaultFetch(url: string): Promise<string> {
  return fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  });
}

// ── Lock management ───────────────────────────────────────────────────────────

const LOCK_KEY = 'kdp_discover_lock';

export async function acquireDiscoverLock(): Promise<boolean> {
  const lock = await getStorageItem<{ lockedAt: number } | null>(LOCK_KEY, null);
  const now = Date.now();
  if (lock && now - lock.lockedAt < DISCOVER_LOCK_EXPIRY_MS) return false;
  const { setStorageItem } = await import('../storage');
  await setStorageItem(LOCK_KEY, { lockedAt: now });
  return true;
}

export async function releaseDiscoverLock(): Promise<void> {
  const { removeStorageItem } = await import('../storage');
  await removeStorageItem(LOCK_KEY);
}

// ── Quality filter ────────────────────────────────────────────────────────────

/**
 * Returns true if a phrase passes all quality gates:
 * - Not in dismissed list
 * - No forbidden/brand words
 * - Status >= "checked" (bsrChecked >= MIN) or asin present (Book gap)
 */
export function passesQualityFilter(
  idea: DiscoverIdea,
  dismissedPhrases: Set<string>,
  forbiddenWords: string[]
): boolean {
  // Dismissed
  if (dismissedPhrases.has(idea.phrase.toLowerCase())) return false;

  // Forbidden words
  const hasForbidden = checkForbiddenWords(idea.phrase, forbiddenWords);
  if (hasForbidden.length > 0) return false;

  // Minimum data: Checked status = bsrChecked >= MIN_BSR_CHECKS
  // OR Book gap with own asin
  if (idea.status === 'quick' && !idea.asin) return false;
  if (idea.status === 'checked' && idea.bsrChecked < DISCOVER_MIN_BSR_CHECKS && !idea.asin) return false;

  return true;
}

// ── Top 10 selection ──────────────────────────────────────────────────────────

const STATUS_WEIGHT: Record<DiscoverIdeaStatus, number> = {
  verified: 3,
  checked: 2,
  quick: 1,
};

/**
 * Selects the best 10 from the pool:
 * 1. Apply quality filter
 * 2. Sort by statusWeight DESC, then score DESC, then isNewToday DESC (tie-break)
 * 3. Take first DISCOVER_IDEAS_SHOWN
 */
export function selectTop10(
  pool: DiscoverIdea[],
  dismissedPhrases: Set<string>,
  forbiddenWords: string[]
): DiscoverIdea[] {
  const qualified = pool.filter((idea) =>
    passesQualityFilter(idea, dismissedPhrases, forbiddenWords)
  );

  qualified.sort((a, b) => {
    const swA = STATUS_WEIGHT[a.status] ?? 0;
    const swB = STATUS_WEIGHT[b.status] ?? 0;
    if (swB !== swA) return swB - swA;
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: new today ranks higher
    const aNew = a.isNewToday ? 1 : 0;
    const bNew = b.isNewToday ? 1 : 0;
    return bNew - aNew;
  });

  return qualified.slice(0, DISCOVER_IDEAS_SHOWN);
}

// ── Trend & Streak computation ────────────────────────────────────────────────

/**
 * Enriches top10 ideas with trend and streak data from history.
 * Also returns the "dropped out" list (was in yesterday's top10, not today's).
 */
export function enrichWithTrendAndStreak(
  top10: DiscoverIdea[],
  history: Awaited<ReturnType<typeof getDiscoverHistory>>
): { enriched: DiscoverIdea[]; droppedOut: { phrase: string; reason: string }[] } {
  // Yesterday's top10 (history[0] is most recent)
  const yesterday = history[0]?.ideas10 ?? [];
  const yesterdayPhrases = new Set(yesterday.map((i) => i.phrase.toLowerCase()));
  const yesterdayRank = new Map(yesterday.map((i, idx) => [i.phrase.toLowerCase(), idx + 1]));

  const todayPhrases = new Set(top10.map((i) => i.phrase.toLowerCase()));

  const enriched: DiscoverIdea[] = top10.map((idea, idx) => {
    const rank = idx + 1;
    const phraseKey = idea.phrase.toLowerCase();
    const isNewToday = !yesterdayPhrases.has(phraseKey);

    // Trend
    let trend: string;
    if (idea.source === 'Rising today') {
      trend = 'Rising';
    } else if (isNewToday) {
      trend = 'New today';
    } else {
      const prevRank = yesterdayRank.get(phraseKey) ?? rank;
      const delta = prevRank - rank;
      if (delta > 0) trend = `Up ${delta}`;
      else if (delta < 0) trend = `Down ${Math.abs(delta)}`;
      else trend = 'Same';
    }

    // Streak: count how many consecutive days this phrase appeared in history
    let streak = 1; // today counts
    for (const entry of history) {
      if (entry.ideas10.some((i) => i.phrase.toLowerCase() === phraseKey)) {
        streak++;
      } else {
        break;
      }
    }

    return {
      ...idea,
      isNewToday,
      trend,
      streak,
    };
  });

  // Dropped out: was in yesterday's top10, not in today's
  const droppedOut: { phrase: string; reason: string }[] = [];
  for (const prev of yesterday) {
    if (!todayPhrases.has(prev.phrase.toLowerCase())) {
      const reason =
        prev.score && prev.score > 0
          ? 'Better ideas appeared or score fell'
          : 'Insufficient data';
      droppedOut.push({ phrase: prev.phrase, reason });
      if (droppedOut.length >= DISCOVER_DROPPED_OUT_MAX) break;
    }
  }

  return { enriched, droppedOut };
}

// ── Main scanner ──────────────────────────────────────────────────────────────

export interface DiscoverScanOptions {
  forceRefresh?: boolean;
  fetchFn?: FetchFn;
  onProgress?: (p: ScanProgress) => void;
  nowMs?: number; // injectable for tests
}

/**
 * Checks whether the current discover data is stale (older than STALE_HOURS).
 */
export async function isDiscoverDataStale(nowMs: number = Date.now()): Promise<boolean> {
  const ideas = await getDiscoverIdeas();
  if (!ideas) return true;
  const ageHours = (nowMs - ideas.generatedAt) / (1000 * 60 * 60);
  return ageHours >= DISCOVER_STALE_HOURS;
}

/**
 * Runs the full Discover scan.
 * Sources: M&S → New Releases → Best Sellers → Autocomplete → Related
 * Respects: rate limit, CAPTCHA stop, request budget, resume cursor.
 */
export async function runDiscoverScan(options: DiscoverScanOptions = {}): Promise<ScanResult> {
  const { fetchFn = defaultFetch, onProgress, nowMs = Date.now() } = options;

  const acquired = await acquireDiscoverLock();
  if (!acquired && !options.forceRefresh) {
    const existing = await getDiscoverIdeas();
    return {
      success: false,
      scanStatus: 'running',
      requestsUsed: 0,
      pool: existing?.pool ?? [],
      top10: existing?.top10 ?? [],
    };
  }

  // Mark scan as running
  await saveDiscoverIdeas({
    generatedAt: nowMs,
    scanStatus: 'running',
    requestsUsed: 0,
    pool: [],
    top10: [],
  });

  const settings = await getSettings();
  const discoverSettings: DiscoverSettings = (settings as any).discover ?? {
    autoRefresh: true,
    maxRequestsPerScan: 120,
    categorysources: [],
    seedList: DEFAULT_DISCOVER_SEEDS,
  };

  if (settings.pauseAllFetching) {
    await releaseDiscoverLock();
    return { success: false, scanStatus: 'idle', requestsUsed: 0, pool: [], top10: [] };
  }

  const maxRequests = discoverSettings.maxRequestsPerScan ?? 120;
  const categorySourcesFromSettings = discoverSettings.categorysources ?? [];
  const seedList = discoverSettings.seedList?.length ? discoverSettings.seedList : DEFAULT_DISCOVER_SEEDS;
  const forbiddenWords: string[] = settings.ai?.forbiddenWords ?? [];

  // Resume state
  const scanState = await getDiscoverScanState();
  const resumeCursor = options.forceRefresh ? 0 : scanState.cursor;

  let requestsUsed = 0;
  let captchaUrl: string | undefined;
  const pool: DiscoverIdea[] = [];
  const seenPhrases = new Set<string>();

  const addIdea = (idea: DiscoverIdea) => {
    const key = idea.phrase.toLowerCase();
    if (!seenPhrases.has(key)) {
      seenPhrases.add(key);
      pool.push(idea);
    }
  };

  const notifyProgress = (msg: string) => {
    onProgress?.({ requestsUsed, total: maxRequests, message: msg });
  };

  const shouldStop = () => requestsUsed >= maxRequests || !!captchaUrl;

  // Helper: fetch HTML with rate limit and captcha check
  const fetchPage = async (url: string): Promise<string | null> => {
    if (shouldStop()) return null;
    if (requestsUsed > 0) await sleepRandom(2000, 3000);
    try {
      const html = await fetchFn(url);
      requestsUsed++;
      // Simple captcha detection on raw HTML
      if (
        html.includes('captchacharacters') ||
        html.includes('/errors/validateCaptcha') ||
        html.toLowerCase().includes('robot check')
      ) {
        captchaUrl = url;
        return null;
      }
      return html;
    } catch {
      requestsUsed++;
      return null;
    }
  };

  const fetchJson = async (url: string): Promise<unknown | null> => {
    if (shouldStop()) return null;
    if (requestsUsed > 0) await sleepRandom(2000, 3000);
    try {
      const res = await fetch(url);
      requestsUsed++;
      if (!res.ok) return null;
      return await res.json();
    } catch {
      requestsUsed++;
      return null;
    }
  };

  // ── SOURCE A: Movers & Shakers ────────────────────────────────────────────
  notifyProgress('Scanning Movers & Shakers...');
  for (const cat of categorySourcesFromSettings) {
    if (shouldStop()) break;
    if (!cat.moversShakersUrl) continue;
    const html = await fetchPage(cat.moversShakersUrl);
    if (!html) break;
    notifyProgress(`M&S: ${cat.label}`);
    const parsed = parseMoversShakersPage(html);
    if (parsed.isCaptcha) { captchaUrl = cat.moversShakersUrl; break; }
    for (const item of parsed.items.slice(0, 20)) {
      const phrase = titleToKeyword(item.title);
      if (!phrase) continue;
      addIdea({
        phrase,
        source: 'Rising today',
        score: 0,
        status: 'quick',
        bsrChecked: 0,
        bsrTotal: 5,
        whyText: `Rank jumped${item.rankChangePercent ? ` ${Math.abs(item.rankChangePercent)}%` : ''} in ${cat.label}`,
        rankChangePercent: item.rankChangePercent,
        asin: item.asin,
      });
    }
  }

  // ── SOURCE B: New Releases ─────────────────────────────────────────────────
  notifyProgress('Scanning New Releases...');
  for (const cat of categorySourcesFromSettings) {
    if (shouldStop()) break;
    if (!cat.newReleasesUrl) continue;
    const html = await fetchPage(cat.newReleasesUrl);
    if (!html) break;
    notifyProgress(`New Releases: ${cat.label}`);
    const parsed = parseNewReleasesPage(html);
    if (parsed.isCaptcha) { captchaUrl = cat.newReleasesUrl; break; }
    for (const item of parsed.items.slice(0, 20)) {
      const phrase = titleToKeyword(item.title);
      if (!phrase) continue;
      addIdea({
        phrase,
        source: 'New release',
        score: 0,
        status: 'quick',
        bsrChecked: 0,
        bsrTotal: 5,
        whyText: `New release in ${cat.label}${item.publishDate ? `, published ${item.publishDate}` : ''}`,
        publishDate: item.publishDate,
        asin: item.asin,
      });
    }
  }

  // ── SOURCE C: Best Sellers (weak competitors) ──────────────────────────────
  notifyProgress('Scanning Best Sellers for weak competitors...');
  for (const cat of categorySourcesFromSettings) {
    if (shouldStop()) break;
    if (!cat.bestSellersUrl) continue;
    const html = await fetchPage(cat.bestSellersUrl);
    if (!html) break;
    notifyProgress(`Best Sellers: ${cat.label}`);
    const parsed = parseBestSellersPage(html);
    if ((parsed as any).isCaptcha) { captchaUrl = cat.bestSellersUrl; break; }
    for (const item of parsed.items) {
      const isWeak =
        item.reviewCount !== undefined &&
        item.reviewCount < 30 ||
        (item.rating !== undefined && item.rating < 4.0);
      if (!isWeak) continue;
      const phrase = titleToKeyword(item.title);
      if (!phrase) continue;
      addIdea({
        phrase,
        source: 'Weak competitor',
        score: 0,
        status: 'quick',
        bsrChecked: 1,
        bsrTotal: 5,
        whyText: `Weak competitor in ${cat.label}${item.reviewCount !== undefined ? `: ${item.reviewCount} reviews` : ''}${item.rating !== undefined ? `, rating ${item.rating}` : ''}`,
        asin: item.asin,
      });
    }
  }

  // ── SOURCE D: Rotating autocomplete seeds ─────────────────────────────────
  if (!shouldStop()) {
    notifyProgress('Scanning autocomplete suggestions...');
    const dayIndex = getDayIndex(nowMs);
    const queries = buildRotatingQueries(dayIndex, seedList);
    for (const query of queries) {
      if (shouldStop() || pool.length >= DISCOVER_POOL_SIZE) break;
      const url = buildAmazonAutocompleteUrl(query);
      const data = await fetchJson(url);
      if (data !== null) {
        const suggestions = parseAutocompleteResponse(data);
        for (const phrase of suggestions) {
          if (pool.length >= DISCOVER_POOL_SIZE) break;
          addIdea({
            phrase,
            source: 'Autocomplete',
            score: 0,
            status: 'quick',
            bsrChecked: 0,
            bsrTotal: 5,
            whyText: `Autocomplete suggestion for "${query}"`,
          });
        }
      }
    }
  }

  // ── SOURCE E: Related phrases from browsing (last 7 days) ─────────────────
  if (!shouldStop()) {
    const relatedKey = 'kdp_related_phrases';
    type RelatedEntry = { phrase: string; savedAt: number };
    const relatedRaw = await getStorageItem<RelatedEntry[]>(relatedKey, []);
    const cutoff = nowMs - DISCOVER_RELATED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    const recent = relatedRaw.filter((r) => r.savedAt >= cutoff);
    for (const r of recent) {
      if (pool.length >= DISCOVER_POOL_SIZE) break;
      addIdea({
        phrase: r.phrase,
        source: 'Related',
        score: 0,
        status: 'quick',
        bsrChecked: 0,
        bsrTotal: 5,
        whyText: 'Related phrase from recent Amazon browsing',
      });
    }
  }

  // ── Trim pool to size ──────────────────────────────────────────────────────
  const trimmedPool = pool.slice(0, DISCOVER_POOL_SIZE);

  // ── Save cursor so partial scans can resume ────────────────────────────────
  await saveDiscoverScanState({ cursor: trimmedPool.length });

  // ── Quality filter + Top 10 selection ─────────────────────────────────────
  const dismissed = await getActiveDismissedPhrases();
  const top10Raw = selectTop10(trimmedPool, dismissed, forbiddenWords);

  // ── Trend & Streak enrichment ──────────────────────────────────────────────
  const history = await getDiscoverHistory();
  const { enriched: top10 } = enrichWithTrendAndStreak(top10Raw, history);

  const scanStatus: DiscoverScanStatus = captchaUrl
    ? 'captcha'
    : requestsUsed >= maxRequests
    ? 'partial'
    : 'complete';

  // ── Persist results ────────────────────────────────────────────────────────
  const result: DiscoverIdea[] = top10;
  await saveDiscoverIdeas({
    generatedAt: nowMs,
    scanStatus,
    requestsUsed,
    pool: trimmedPool,
    top10: result,
  });

  // ── Save today's history entry ─────────────────────────────────────────────
  await saveDiscoverHistoryEntry({
    date: new Date(nowMs).toISOString().split('T')[0]!,
    ideas10: result,
  });

  await releaseDiscoverLock();

  return {
    success: !captchaUrl,
    scanStatus,
    requestsUsed,
    pool: trimmedPool,
    top10: result,
    captchaUrl,
  };
}

/**
 * Trigger a scan only if data is stale and auto-refresh is enabled.
 * Called from background.ts on startup and content.tsx on page open.
 */
export async function triggerScanIfStale(options: DiscoverScanOptions = {}): Promise<boolean> {
  const settings = await getSettings();
  const discoverSettings: DiscoverSettings = (settings as any).discover ?? { autoRefresh: true };
  if (!discoverSettings.autoRefresh) return false;
  if (settings.pauseAllFetching) return false;

  const stale = await isDiscoverDataStale(options.nowMs);
  if (!stale) return false;

  // Fire and forget — don't await
  runDiscoverScan(options).catch((err) =>
    console.warn('[Discover] Background scan error:', err)
  );
  return true;
}
