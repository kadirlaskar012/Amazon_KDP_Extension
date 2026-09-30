// src/services/titleAnalysis.ts
// Word and bigram frequency analyzer for top books' titles and subtitles

import type { Book, WordFrequencyItem, TitleAnalysisResult } from '../types';
import { DEFAULT_ENGLISH_STOPWORDS, DEFAULT_KDP_FILLER_WORDS } from '../config/stopwords';
import { TOP_N_TITLE_WORDS } from '../config/defaults';

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
