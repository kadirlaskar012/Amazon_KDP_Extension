// src/services/autocomplete.ts
// Amazon Books Autocomplete Suggestions fetcher with deduplication and best-position tracking

import type { KeywordItem, KeywordWeights, Book } from '../types';
import { AUTOCOMPLETE_ALPHA_SUFFIXES, AUTOCOMPLETE_DIGIT_SUFFIXES, MIN_KEYWORD_LENGTH, CACHE_TTL_MS } from '../config/defaults';
import { getStorageItem, setStorageItem } from '../storage';
import { getSettings } from '../storage/settings';
import { scoreKeyword, generate7BackendKeywordSlots, buildBackendKeywordSlots } from './keywordScore';
import { containsKeyword } from './titleAnalysis';

export { generate7BackendKeywordSlots, buildBackendKeywordSlots };

export interface AutocompleteProgress {
  current: number;
  total: number;
  message: string;
}

export interface CachedAutocompleteResult {
  seed: string;
  items: KeywordItem[];
  timestamp: number;
}

/**
 * Builds the URL for Amazon's public Books autocomplete suggestion endpoint.
 * 
 * NOTE: Amazon may update or alter its suggestion API endpoints and query parameters.
 * Keeping the URL builder isolated here ensures straightforward adjustments if needed.
 */
export function buildAmazonAutocompleteUrl(prefix: string): string {
  const encoded = encodeURIComponent(prefix.trim());
  return `https://completion.amazon.com/api/2017/suggestions?limit=11&prefix=${encoded}&suggestion-type=KEYWORD&page-type=Search&alias=stripbooks&site-variant=desktop&version=3&event=onKeyPress&mid=ATVPDKIKX0DER`;
}

/**
 * Parses Amazon suggestion API responses supporting both modern JSON object and legacy array formats
 */
export function parseAutocompleteResponse(data: unknown): string[] {
  if (!data) return [];

  // Modern format: { suggestions: [ { value: "..." }, ... ] }
  if (typeof data === 'object' && data !== null && 'suggestions' in data && Array.isArray((data as any).suggestions)) {
    return (data as any).suggestions
      .map((s: any) => {
        if (typeof s === 'string') return s;
        if (s && typeof s === 'object') return s.value || s.term || '';
        return '';
      })
      .map((s: string) => s.trim())
      .filter((s: string) => s.length >= MIN_KEYWORD_LENGTH);
  }

  // Classic format: ["prefix", ["suggestion1", "suggestion2", ...]]
  if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[1])) {
    return data[1]
      .map((s: any) => {
        if (typeof s === 'string') return s;
        if (s && typeof s === 'object') return s.value || s.term || '';
        return '';
      })
      .map((s: string) => s.trim())
      .filter((s: string) => s.length >= MIN_KEYWORD_LENGTH);
  }

  return [];
}

/**
 * Random delay between 2-3 seconds (2000ms - 3000ms)
 */
function sleepRandom(minMs: number = 2000, maxMs: number = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Deduplicates and updates best position for suggestion keywords
 */
export function mergeSuggestions(
  existingMap: Map<string, { keyword: string; bestPosition: number }>,
  suggestions: string[]
): void {
  suggestions.forEach((keyword, position) => {
    const clean = keyword.trim();
    if (clean.length < MIN_KEYWORD_LENGTH) return;
    const lowerKey = clean.toLowerCase();

    const existing = existingMap.get(lowerKey);
    if (existing) {
      if (position < existing.bestPosition) {
        existing.bestPosition = position;
      }
    } else {
      existingMap.set(lowerKey, {
        keyword: clean,
        bestPosition: position,
      });
    }
  });
}

/**
 * Fetches autocomplete keywords for a seed keyword with a-z (and optional 0-9) suffixes
 */
export async function fetchAutocompleteKeywords(
  seed: string,
  options?: {
    includeDigits?: boolean;
    books?: Book[];
    weights?: KeywordWeights;
    signal?: AbortSignal;
    onProgress?: (progress: AutocompleteProgress) => void;
  }
): Promise<KeywordItem[]> {
  const cleanSeed = seed.trim();
  if (!cleanSeed) return [];

  const cacheKey = `kdp_autocomplete_${cleanSeed.toLowerCase()}`;

  // 1. Check 24-hour cache
  const cached = await getStorageItem<CachedAutocompleteResult | null>(cacheKey, null);
  if (cached && Date.now() - cached.timestamp <= CACHE_TTL_MS && cached.items.length > 0) {
    if (options?.onProgress) {
      options.onProgress({
        current: 100,
        total: 100,
        message: 'Loaded suggestions from 24h cache',
      });
    }
    return cached.items;
  }

  const settings = await getSettings();
  if (settings.pauseAllFetching) {
    throw new Error('FETCHING_PAUSED: Background fetching is paused in Settings.');
  }

  // 2. Prepare query prefixes: seed, seed + " a" ... seed + " z"
  const prefixes: string[] = [cleanSeed];
  for (const letter of AUTOCOMPLETE_ALPHA_SUFFIXES) {
    prefixes.push(`${cleanSeed} ${letter}`);
  }
  if (options?.includeDigits) {
    for (const digit of AUTOCOMPLETE_DIGIT_SUFFIXES) {
      prefixes.push(`${cleanSeed} ${digit}`);
    }
  }

  const total = prefixes.length;
  const keywordMap = new Map<string, { keyword: string; bestPosition: number }>();

  // 3. Process requests sequentially with 2-3s delay
  for (let i = 0; i < total; i++) {
    if (options?.signal?.aborted) {
      break;
    }

    const currentPrefix = prefixes[i];
    if (!currentPrefix) continue;
    const progressCurrent = i + 1;

    if (options?.onProgress) {
      options.onProgress({
        current: progressCurrent,
        total,
        message: `Fetching ${progressCurrent}/${total}: "${currentPrefix}"`,
      });
    }

    try {
      const url = buildAmazonAutocompleteUrl(currentPrefix);
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json, text/plain, */*',
        },
        signal: options?.signal,
      });

      if (res.ok) {
        const json = await res.json();
        const suggestions = parseAutocompleteResponse(json);
        mergeSuggestions(keywordMap, suggestions);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        break;
      }
      console.warn(`[Autocomplete] Failed query for "${currentPrefix}":`, err);
      // Keep collected items and continue
    }

    // Delay between calls (if not last item)
    if (i < total - 1 && !options?.signal?.aborted) {
      await sleepRandom(2000, 3000);
    }
  }

  // 4. Score all collected keywords
  const topBooks = (options?.books || []).slice(0, 10);
  const items: KeywordItem[] = Array.from(keywordMap.values()).map(({ keyword, bestPosition }) => {
    // Count presence in top books' titles
    let inTitlesCount = 0;
    if (topBooks.length > 0) {
      for (const b of topBooks) {
        const fullTitle = [b.title, b.subtitle].filter(Boolean).join(' ');
        if (containsKeyword(fullTitle, keyword)) {
          inTitlesCount++;
        }
      }
    }

    return scoreKeyword(
      keyword,
      bestPosition,
      inTitlesCount,
      null,
      options?.weights,
      topBooks.length || 10
    );
  });

  // Sort by score descending by default
  items.sort((a, b) => b.totalScore - a.totalScore);

  // 5. Cache result for 24h
  if (items.length > 0 && !options?.signal?.aborted) {
    await setStorageItem<CachedAutocompleteResult>(cacheKey, {
      seed: cleanSeed,
      items,
      timestamp: Date.now(),
    });
  }

  return items;
}

/**
 * Performs background BSR search for a single keyword:
 * 1. Searches Amazon Books for keyword
 * 2. Takes top 5 organic results
 * 3. Fetches their product pages for BSR
 * 4. Computes average BSR and updates keyword score
 */
export async function checkKeywordBsr(
  item: KeywordItem,
  weights: KeywordWeights,
  totalTitles: number = 10
): Promise<KeywordItem> {
  const settings = await getSettings();
  if (settings.pauseAllFetching) {
    throw new Error('FETCHING_PAUSED: Background fetching is paused in Settings.');
  }

  const { parseSearchResults } = await import('../parsers/searchPage');
  const { parseProductPage, isCaptchaPage } = await import('../parsers/productPage');
  const { ProductCache } = await import('./cache');

  const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(item.keyword)}&i=stripbooks`;
  const res = await fetch(searchUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (isCaptchaPage(doc)) {
    throw new Error('CAPTCHA_DETECTED');
  }

  const organicBooks = parseSearchResults(doc).slice(0, 5);
  const bsrs: number[] = [];

  for (const book of organicBooks) {
    try {
      const cached = await ProductCache.get(book.asin);
      if (cached && cached.bsrOverall) {
        bsrs.push(cached.bsrOverall);
        continue;
      }

      await sleepRandom(2000, 3000);

      const pRes = await fetch(`https://www.amazon.com/dp/${book.asin}`, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      const pHtml = await pRes.text();
      const pDoc = parser.parseFromString(pHtml, 'text/html');
      if (isCaptchaPage(pDoc)) {
        throw new Error('CAPTCHA_DETECTED');
      }

      const parsed = parseProductPage(pHtml);
      await ProductCache.set(book.asin, parsed);
      if (parsed.bsrOverall) {
        bsrs.push(parsed.bsrOverall);
      }
    } catch (err: any) {
      if (err.message === 'CAPTCHA_DETECTED') throw err;
      console.warn(`[checkKeywordBsr] Error fetching ${book.asin}:`, err);
    }
  }

  const avgBsr = bsrs.length > 0 ? Math.round(bsrs.reduce((a, b) => a + b, 0) / bsrs.length) : null;

  return scoreKeyword(
    item.keyword,
    item.bestPosition,
    item.inTitlesCount,
    avgBsr,
    weights,
    totalTitles
  );
}
