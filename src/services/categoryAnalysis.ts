// src/services/categoryAnalysis.ts
// Category analysis, difficulty assessment, and rule-based category recommendations

import type { Book, CategoryStat, CategoryDifficulty, CategoryDifficultyThresholds } from '../types';
import { GENERIC_CATEGORIES } from '../config/stopwords';
import { DEFAULT_CATEGORY_DIFFICULTY } from '../config/defaults';

/**
 * Normalizes category name for consistency and deduplication
 */
export function normalizeCategoryName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/**
 * Checks if category is considered generic/broad
 */
export function isGenericCategory(name: string, customGenericList?: Set<string>): boolean {
  const normalized = normalizeCategoryName(name).toLowerCase();
  if (customGenericList && customGenericList.has(normalized)) return true;
  if (GENERIC_CATEGORIES.has(normalized)) return true;

  // Additional generic checks (exact matches or sub-matches)
  for (const gen of GENERIC_CATEGORIES) {
    if (normalized === gen) return true;
  }
  return false;
}

/**
 * Analyzes top 10 books' category ranks and aggregates category statistics
 */
export function analyzeCategories(
  books: Book[],
  customGenericList?: Set<string>
): CategoryStat[] {
  const topBooks = books.slice(0, 10);
  const categoryMap = new Map<
    string,
    {
      name: string;
      url: string;
      bookCount: number;
      ranks: number[];
      minRank: number;
    }
  >();

  for (const book of topBooks) {
    if (!book.categoryRanks || book.categoryRanks.length === 0) continue;

    const seenInBook = new Set<string>();

    for (const cr of book.categoryRanks) {
      const name = normalizeCategoryName(cr.category || cr.name || '');
      if (!name) continue;

      const lowerKey = name.toLowerCase();
      if (seenInBook.has(lowerKey)) continue;
      seenInBook.add(lowerKey);

      const existing = categoryMap.get(lowerKey);
      if (existing) {
        existing.bookCount++;
        existing.ranks.push(cr.rank);
        if (cr.rank < existing.minRank) {
          existing.minRank = cr.rank;
        }
        if (!existing.url && cr.url) {
          existing.url = cr.url;
        }
      } else {
        categoryMap.set(lowerKey, {
          name,
          url: cr.url || '',
          bookCount: 1,
          ranks: [cr.rank],
          minRank: cr.rank,
        });
      }
    }
  }

  const results: CategoryStat[] = Array.from(categoryMap.values()).map((entry) => {
    const sum = entry.ranks.reduce((a, b) => a + b, 0);
    const avgRank = Math.round(sum / entry.ranks.length);
    const isGeneric = isGenericCategory(entry.name, customGenericList);

    return {
      name: entry.name,
      url: entry.url,
      bookCount: entry.bookCount,
      bestRankAmongTopBooks: entry.minRank,
      avgRank,
      isGeneric,
    };
  });

  // Sort primarily by bookCount desc, secondarily by bestRankAmongTopBooks asc
  return results.sort((a, b) => b.bookCount - a.bookCount || a.bestRankAmongTopBooks - b.bestRankAmongTopBooks);
}

/**
 * Evaluates category difficulty based on the BSR of the #20 book:
 * - Easy: BSR > 50,000 (lower threshold for Top 20)
 * - Medium: BSR 15,000 to 50,000
 * - Hard: BSR < 15,000 (high competition)
 */
export function evaluateCategoryDifficulty(
  bsrAtTop20: number | null | undefined,
  thresholds: CategoryDifficultyThresholds = DEFAULT_CATEGORY_DIFFICULTY
): { difficulty: CategoryDifficulty; difficultyText: string } | null {
  if (bsrAtTop20 === null || bsrAtTop20 === undefined || bsrAtTop20 <= 0) {
    return null;
  }

  const formattedBsr = bsrAtTop20.toLocaleString();

  if (bsrAtTop20 > thresholds.easyMinBsrAtTop20) {
    return {
      difficulty: 'easy',
      difficultyText: `To reach Top 20 in this category you need roughly BSR #${formattedBsr} or better (Low competition).`,
    };
  }

  if (bsrAtTop20 >= thresholds.mediumMinBsrAtTop20) {
    return {
      difficulty: 'medium',
      difficultyText: `To reach Top 20 in this category you need roughly BSR #${formattedBsr} or better (Moderate competition).`,
    };
  }

  return {
    difficulty: 'hard',
    difficultyText: `To reach Top 20 in this category you need roughly BSR #${formattedBsr} or better (High competition).`,
  };
}

export interface RecommendedCategoryPick {
  category: CategoryStat;
  reason: string;
}

/**
 * Suggests up to 3 categories using deterministic rule-based scoring (no AI):
 * - Prefer non-generic categories
 * - Prefer bookCount >= 2
 * - Prefer easy or medium difficulty if checked
 */
export function getRecommendedCategoryPicks(
  categories: CategoryStat[],
  maxPicks: number = 3
): RecommendedCategoryPick[] {
  if (!categories || categories.length === 0) return [];

  // Score categories deterministically
  const scored = categories.map((cat) => {
    let score = 0;

    // Favor niche specific over broad
    if (!cat.isGeneric) {
      score += 50;
    } else {
      score -= 20;
    }

    // High presence among top competitors
    if (cat.bookCount >= 2) {
      score += 30 + cat.bookCount * 10;
    } else {
      score += cat.bookCount * 10;
    }

    // Difficulty weighting if checked
    if (cat.difficulty === 'easy') {
      score += 40;
    } else if (cat.difficulty === 'medium') {
      score += 20;
    } else if (cat.difficulty === 'hard') {
      score -= 30;
    }

    // Reward lower best rank
    if (cat.bestRankAmongTopBooks <= 10) {
      score += 15;
    } else if (cat.bestRankAmongTopBooks <= 50) {
      score += 5;
    }

    return { cat, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const topPicks = scored.slice(0, maxPicks);

  return topPicks.map(({ cat }) => {
    const parts: string[] = [];

    if (!cat.isGeneric) {
      parts.push('Specific sub-category');
    }

    if (cat.bookCount >= 2) {
      parts.push(`${cat.bookCount} of top 10 competitors appear here (best #${cat.bestRankAmongTopBooks})`);
    } else {
      parts.push(`Competitor achieved #${cat.bestRankAmongTopBooks}`);
    }

    if (cat.difficulty) {
      parts.push(`${cat.difficulty} competition`);
    }

    const reason = parts.join(', ') + '.';

    return {
      category: cat,
      reason,
    };
  });
}

/**
 * Checks category difficulty live by fetching the Best Sellers page,
 * extracting #1, #10, #20 books, retrieving their BSRs, and evaluating difficulty.
 */
export async function checkCategoryDifficultyLive(
  categoryUrl: string,
  thresholds: CategoryDifficultyThresholds = DEFAULT_CATEGORY_DIFFICULTY
): Promise<{
  difficulty: CategoryDifficulty;
  difficultyText: string;
  bsrAtTop1: number | null;
  bsrAtTop10: number | null;
  bsrAtTop20: number | null;
}> {
  const { parseBestSellersPage } = await import('../parsers/bestSellersPage');
  const { parseProductPage, isCaptchaPage } = await import('../parsers/productPage');
  const { ProductCache } = await import('./cache');
  const { getStorageItem, setStorageItem } = await import('../storage');
  const { CACHE_TTL_MS } = await import('../config/defaults');

  const cacheKey = `kdp_cat_diff_${encodeURIComponent(categoryUrl)}`;
  const cached = await getStorageItem<{
    difficulty: CategoryDifficulty;
    difficultyText: string;
    bsrAtTop1: number | null;
    bsrAtTop10: number | null;
    bsrAtTop20: number | null;
    timestamp: number;
  } | null>(cacheKey, null);

  if (cached && Date.now() - cached.timestamp <= CACHE_TTL_MS) {
    return {
      difficulty: cached.difficulty,
      difficultyText: cached.difficultyText,
      bsrAtTop1: cached.bsrAtTop1,
      bsrAtTop10: cached.bsrAtTop10,
      bsrAtTop20: cached.bsrAtTop20,
    };
  }

  // Fetch category Best Sellers page
  const fullUrl = categoryUrl.startsWith('http') ? categoryUrl : `https://www.amazon.com${categoryUrl}`;
  const res = await fetch(fullUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const html = await res.text();
  const parsedCategory = parseBestSellersPage(html);

  if (parsedCategory.isCaptcha) {
    throw new Error('CAPTCHA_DETECTED');
  }

  if (parsedCategory.items.length === 0) {
    throw new Error('NO_CATEGORY_ITEMS');
  }

  // Find target ranks: #1, #10, #20
  const item1 = parsedCategory.items.find((i) => i.rank === 1) || parsedCategory.items[0];
  const item10 = parsedCategory.items.find((i) => i.rank === 10) || (parsedCategory.items.length >= 10 ? parsedCategory.items[9] : undefined);
  const item20 = parsedCategory.items.find((i) => i.rank === 20) || (parsedCategory.items.length >= 20 ? parsedCategory.items[19] : parsedCategory.items[parsedCategory.items.length - 1]);

  async function fetchBsr(asin?: string): Promise<number | null> {
    if (!asin) return null;
    try {
      const cachedBook = await ProductCache.get(asin);
      if (cachedBook && cachedBook.bsrOverall) {
        return cachedBook.bsrOverall;
      }

      // 2-3s delay
      const delay = Math.floor(Math.random() * 1000) + 2000;
      await new Promise((r) => setTimeout(r, delay));

      const pRes = await fetch(`https://www.amazon.com/dp/${asin}`, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      const pHtml = await pRes.text();
      const parser = new DOMParser();
      const pDoc = parser.parseFromString(pHtml, 'text/html');
      if (isCaptchaPage(pDoc)) {
        throw new Error('CAPTCHA_DETECTED');
      }

      const parsed = parseProductPage(pHtml);
      await ProductCache.set(asin, parsed);
      return parsed.bsrOverall || null;
    } catch (err: any) {
      if (err.message === 'CAPTCHA_DETECTED') throw err;
      return null;
    }
  }

  const bsrAtTop1 = await fetchBsr(item1?.asin);
  const bsrAtTop10 = item10 ? await fetchBsr(item10.asin) : null;
  const bsrAtTop20 = item20 ? await fetchBsr(item20.asin) : null;

  const evalResult = evaluateCategoryDifficulty(bsrAtTop20 || bsrAtTop10 || bsrAtTop1, thresholds);
  const difficulty = evalResult?.difficulty || 'medium';
  const difficultyText = evalResult?.difficultyText || 'Difficulty estimate unavailable.';

  const result = {
    difficulty,
    difficultyText,
    bsrAtTop1,
    bsrAtTop10,
    bsrAtTop20,
  };

  await setStorageItem(cacheKey, {
    ...result,
    timestamp: Date.now(),
  });

  return result;
}
