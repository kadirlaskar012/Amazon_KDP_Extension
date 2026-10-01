// src/services/titleAnalysis.ts
// Word and bigram frequency analyzer for top books' titles and subtitles

import type { Book, WordFrequencyItem, TitleAnalysisResult, KeywordItem } from '../types';
import { DEFAULT_ENGLISH_STOPWORDS, DEFAULT_KDP_FILLER_WORDS } from '../config/stopwords';
import { TOP_N_TITLE_WORDS, DEFAULT_KEYWORD_WEIGHTS } from '../config/defaults';

/**
 * Escapes regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks if a title contains a keyword (case-insensitive, normalized word-boundary aware)
 */
export function containsKeyword(title: string | undefined | null, keyword: string): boolean {
  if (!title || !keyword) return false;
  const cleanTitle = title.toLowerCase().trim();
  const cleanKeyword = keyword.toLowerCase().trim();
  if (!cleanKeyword) return false;

  // Use word boundary check
  try {
    const escaped = escapeRegex(cleanKeyword);
    const regex = new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, 'i');
    return regex.test(cleanTitle);
  } catch {
    return cleanTitle.includes(cleanKeyword);
  }
}

/**
 * Normalizes text and tokenizes into words, stripping punctuation
 */
export function tokenizeText(text: string): string[] {
  if (!text) return [];
  // Replace punctuation, dashes, quotes, brackets with space, preserve words
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !/^\d+$/.test(word));
}

/**
 * Analyzes top books (typically top 10) to find most frequent unigrams and bigrams
 */
export function analyzeTitles(
  books: Book[],
  customStopwords?: Set<string>,
  maxResults: number = TOP_N_TITLE_WORDS
): TitleAnalysisResult {
  const topBooks = books.slice(0, 10);
  const totalTitlesAnalyzed = topBooks.length;

  if (totalTitlesAnalyzed === 0) {
    return {
      unigrams: [],
      bigrams: [],
      totalTitlesAnalyzed: 0,
    };
  }

  const combinedStopwords = new Set<string>([
    ...DEFAULT_ENGLISH_STOPWORDS,
    ...DEFAULT_KDP_FILLER_WORDS,
    ...(customStopwords ? Array.from(customStopwords) : []),
  ]);

  // Overall counts across all titles
  const unigramCounts = new Map<string, number>();
  const bigramCounts = new Map<string, number>();

  // In how many distinct titles did the word/bigram appear (X of 10)
  const unigramTitlePresence = new Map<string, number>();
  const bigramTitlePresence = new Map<string, number>();

  for (const book of topBooks) {
    const fullText = [book.title, book.subtitle].filter(Boolean).join(' ');
    const rawTokens = tokenizeText(fullText);

    // Filter out stopwords
    const filteredTokens = rawTokens.filter((token) => !combinedStopwords.has(token));

    const bookUniqueUnigrams = new Set<string>();
    const bookUniqueBigrams = new Set<string>();

    // Count unigrams
    for (const word of filteredTokens) {
      unigramCounts.set(word, (unigramCounts.get(word) || 0) + 1);
      bookUniqueUnigrams.add(word);
    }

    // Count bigrams
    for (let i = 0; i < filteredTokens.length - 1; i++) {
      const bigram = `${filteredTokens[i]} ${filteredTokens[i + 1]}`;
      bigramCounts.set(bigram, (bigramCounts.get(bigram) || 0) + 1);
      bookUniqueBigrams.add(bigram);
    }

    // Update presence
    for (const word of bookUniqueUnigrams) {
      unigramTitlePresence.set(word, (unigramTitlePresence.get(word) || 0) + 1);
    }
    for (const bigram of bookUniqueBigrams) {
      bigramTitlePresence.set(bigram, (bigramTitlePresence.get(bigram) || 0) + 1);
    }
  }

  // Convert to sorted WordFrequencyItem array
  const unigrams: WordFrequencyItem[] = Array.from(unigramCounts.entries())
    .map(([word, count]) => {
      const inTitlesCount = unigramTitlePresence.get(word) || 0;
      return {
        word,
        count,
        inTitlesCount,
        percentage: Math.round((inTitlesCount / totalTitlesAnalyzed) * 100),
      };
    })
    .sort((a, b) => b.inTitlesCount - a.inTitlesCount || b.count - a.count)
    .slice(0, maxResults);

  const bigrams: WordFrequencyItem[] = Array.from(bigramCounts.entries())
    .map(([word, count]) => {
      const inTitlesCount = bigramTitlePresence.get(word) || 0;
      return {
        word,
        count,
        inTitlesCount,
        percentage: Math.round((inTitlesCount / totalTitlesAnalyzed) * 100),
      };
    })
    .sort((a, b) => b.inTitlesCount - a.inTitlesCount || b.count - a.count)
    .slice(0, maxResults);

  return {
    unigrams,
    bigrams,
    totalTitlesAnalyzed,
  };
}

/**
 * Automatically extracts high-ranking niche keywords, multi-word phrases,
 * and top 7 golden target keywords directly from ranking book titles on the current page
 */
export function extractNicheKeywordsFromBooks(
  books: Book[],
  query: string = '',
  weights = DEFAULT_KEYWORD_WEIGHTS
): {
  top7GoldenKeywords: KeywordItem[];
  allExtractedKeywords: KeywordItem[];
} {
  const topBooks = books.slice(0, 15);
  const totalBooks = topBooks.length;
  if (totalBooks === 0 && !query) {
    return { top7GoldenKeywords: [], allExtractedKeywords: [] };
  }

  const candidatesMap = new Map<string, { count: number; inTitles: number; bsrValues: number[] }>();

  const recordCandidate = (phrase: string, inTitleCount: number, bsrList: number[]) => {
    const clean = phrase.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ');
    if (clean.length < 3 || clean.split(' ').length > 6) return;
    const existing = candidatesMap.get(clean);
    if (existing) {
      existing.inTitles = Math.max(existing.inTitles, inTitleCount);
      existing.count++;
      existing.bsrValues.push(...bsrList);
    } else {
      candidatesMap.set(clean, { count: 1, inTitles: inTitleCount, bsrValues: [...bsrList] });
    }
  };

  // 1. Seed query
  if (query && query.trim()) {
    const qClean = query.toLowerCase().trim();
    const queryTitlesCount = topBooks.filter((b) => containsKeyword(b.title, qClean)).length;
    const bsrs = topBooks.filter((b) => containsKeyword(b.title, qClean) && b.bsrOverall).map((b) => b.bsrOverall!);
    recordCandidate(qClean, Math.max(queryTitlesCount, Math.round(totalBooks * 0.7)), bsrs);
  }

  // 2. High-frequency bigrams and unigrams from titles
  const titleData = analyzeTitles(topBooks, undefined, 20);

  for (const bi of titleData.bigrams) {
    const bsrs = topBooks.filter((b) => containsKeyword(b.title, bi.word) && b.bsrOverall).map((b) => b.bsrOverall!);
    recordCandidate(bi.word, bi.inTitlesCount, bsrs);
  }

  for (const uni of titleData.unigrams) {
    if (uni.inTitlesCount >= 3) {
      const bsrs = topBooks.filter((b) => containsKeyword(b.title, uni.word) && b.bsrOverall).map((b) => b.bsrOverall!);
      recordCandidate(uni.word, uni.inTitlesCount, bsrs);
    }
  }

  // 3. Extract common 3-word title phrases
  for (const book of topBooks) {
    const tokens = tokenizeText(book.title || '');
    if (tokens.length >= 3) {
      for (let i = 0; i <= tokens.length - 3; i++) {
        const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
        const count = topBooks.filter((b) => containsKeyword(b.title, trigram)).length;
        if (count >= 2) {
          const bsrs = topBooks.filter((b) => containsKeyword(b.title, trigram) && b.bsrOverall).map((b) => b.bsrOverall!);
          recordCandidate(trigram, count, bsrs);
        }
      }
    }
  }

  // Convert to KeywordItems
  const allItems: KeywordItem[] = Array.from(candidatesMap.entries()).map(([kw, data], idx) => {
    const avgBsr = data.bsrValues.length > 0 ? Math.round(data.bsrValues.reduce((a, b) => a + b, 0) / data.bsrValues.length) : null;
    
    // Position simulation (0-9 for top candidates)
    const pos = Math.min(9, Math.floor(idx / 2));
    
    // Fallback scoring calculation if scoreKeyword is imported
    const posScore = Math.round(100 - pos * (80 / 9));
    const freqScore = Math.round((Math.min(data.inTitles, totalBooks || 10) / (totalBooks || 10)) * 100);
    const bsrScore = avgBsr && avgBsr < 20000 ? 100 : avgBsr && avgBsr < 100000 ? 75 : 40;
    const totalScore = Math.round((posScore * 0.4) + (freqScore * 0.4) + (bsrScore * 0.2));
    const scoreLabel: 'high' | 'medium' | 'low' = totalScore >= 70 ? 'high' : totalScore >= 40 ? 'medium' : 'low';

    return {
      keyword: kw,
      bestPosition: pos,
      inTitlesCount: data.inTitles,
      avgBsr,
      totalScore,
      scoreLabel,
      isPartial: false,
    };
  });

  // Sort by score descending and title frequency
  allItems.sort((a, b) => b.totalScore - a.totalScore || b.inTitlesCount - a.inTitlesCount);

  // Pick top 7 distinct golden keywords
  const top7GoldenKeywords: KeywordItem[] = [];
  const seenWordRoots = new Set<string>();

  for (const item of allItems) {
    if (top7GoldenKeywords.length >= 7) break;
    top7GoldenKeywords.push(item);
  }

  // If fewer than 7, fill with remaining
  for (const item of allItems) {
    if (top7GoldenKeywords.length >= 7) break;
    if (!top7GoldenKeywords.some((g) => g.keyword === item.keyword)) {
      top7GoldenKeywords.push(item);
    }
  }

  return {
    top7GoldenKeywords,
    allExtractedKeywords: allItems,
  };
}
