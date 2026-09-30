// src/services/reviewGap.ts
// Review Gap Analyzer: Extracts complaint phrases, matches against complaint lexicon,
// computes category summaries, discovers emergent phrases, and captures positive signals.

import type {
  Book,
  ReviewItem,
  ComplaintStat,
  CategoryComplaintCount,
  ReviewGapAnalysis,
  WordFrequencyItem,
} from '../types';
import { DEFAULT_COMPLAINT_LEXICON } from '../config/complaintLexicon';
import { DEFAULT_REVIEW_SETTINGS } from '../config/defaults';
import { DEFAULT_ENGLISH_STOPWORDS } from '../config/stopwords';
import { tokenizeText } from './titleAnalysis';

/**
 * Cuts a quote to max 120 characters with ellipsis if trimmed
 */
export function truncateQuote(text: string, maxLength: number = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength - 3).trim() + '...';
}

/**
 * Extracts a relevant snippet surrounding a matched keyword
 */
export function extractSampleSnippet(fullText: string, phrase: string, maxLength: number = 120): string {
  const clean = fullText.replace(/\s+/g, ' ').trim();
  const lower = clean.toLowerCase();
  const phraseLower = phrase.toLowerCase();
  const idx = lower.indexOf(phraseLower);

  if (idx === -1) {
    return truncateQuote(clean, maxLength);
  }

  // Center around the phrase
  const start = Math.max(0, idx - 30);
  const end = Math.min(clean.length, start + maxLength);
  let snippet = clean.slice(start, end).trim();

  if (start > 0) snippet = '...' + snippet;
  if (end < clean.length) snippet = snippet + '...';

  return truncateQuote(snippet, maxLength);
}

/**
 * Analyzes reviews across top books to extract negative complaints and positive signals
 */
export function analyzeReviewGap(
  books: Book[],
  options?: {
    booksToAnalyze?: number;
    maxStarsIncluded?: number;
    topPhrasesShown?: number;
  }
): ReviewGapAnalysis {
  const limitBooks = options?.booksToAnalyze ?? DEFAULT_REVIEW_SETTINGS.booksToAnalyze;
  const maxStars = options?.maxStarsIncluded ?? DEFAULT_REVIEW_SETTINGS.maxStarsIncluded;
  const topShown = options?.topPhrasesShown ?? DEFAULT_REVIEW_SETTINGS.topPhrasesShown;

  const targetBooks = books.slice(0, limitBooks);
  let totalNegativeReviews = 0;
  let booksRequiringLogin = 0;

  const negativeReviewsByBook = new Map<string, ReviewItem[]>();
  const allPositiveReviews: ReviewItem[] = [];

  for (const book of targetBooks) {
    if (book.reviewsRequireLogin) {
      booksRequiringLogin++;
    }

    const reviews = book.reviews || [];

    const negList: ReviewItem[] = [];
    for (const r of reviews) {
      if (r.rating <= maxStars) {
        negList.push(r);
        totalNegativeReviews++;
      } else if (r.rating >= 4) {
        allPositiveReviews.push(r);
      }
    }

    negativeReviewsByBook.set(book.asin, negList);
  }

  // 1. Step 1: Match against complaint lexicon
  const complaintStatsMap = new Map<
    string,
    {
      phrase: string;
      category: string;
      count: number;
      booksWithPhrase: Set<string>;
      sampleQuotes: string[];
    }
  >();

  for (const [categoryName, categoryConfig] of Object.entries(DEFAULT_COMPLAINT_LEXICON)) {
    for (const phrase of categoryConfig.phrases) {
      const phraseLower = phrase.toLowerCase();

      for (const [asin, negReviews] of negativeReviewsByBook.entries()) {
        for (const review of negReviews) {
          const fullText = [review.title, review.body].filter(Boolean).join('. ');
          if (fullText.toLowerCase().includes(phraseLower)) {
            const existing = complaintStatsMap.get(phraseLower);
            const sample = extractSampleSnippet(fullText, phrase, 120);

            if (existing) {
              existing.count++;
              existing.booksWithPhrase.add(asin);
              if (existing.sampleQuotes.length < 2 && !existing.sampleQuotes.includes(sample)) {
                existing.sampleQuotes.push(sample);
              }
            } else {
              complaintStatsMap.set(phraseLower, {
                phrase,
                category: categoryName,
                count: 1,
                booksWithPhrase: new Set([asin]),
                sampleQuotes: [sample],
              });
            }
          }
        }
      }
    }
  }

  // 2. Step 2: Emergent bigram and trigram extraction from negative reviews
  const nGramCounts = new Map<string, { count: number; books: Set<string>; sampleQuote: string }>();

  for (const [asin, negReviews] of negativeReviewsByBook.entries()) {
    for (const review of negReviews) {
      const fullText = [review.title, review.body].filter(Boolean).join(' ');
      const rawTokens = tokenizeText(fullText);
      const filtered = rawTokens.filter((t) => !DEFAULT_ENGLISH_STOPWORDS.has(t));

      // Bigrams
      for (let i = 0; i < filtered.length - 1; i++) {
        const bigram = `${filtered[i]} ${filtered[i + 1]}`;
        const item = nGramCounts.get(bigram) || {
          count: 0,
          books: new Set<string>(),
          sampleQuote: truncateQuote(fullText, 120),
        };
        item.count++;
        item.books.add(asin);
        nGramCounts.set(bigram, item);
      }

      // Trigrams
      for (let i = 0; i < filtered.length - 2; i++) {
        const trigram = `${filtered[i]} ${filtered[i + 1]} ${filtered[i + 2]}`;
        const item = nGramCounts.get(trigram) || {
          count: 0,
          books: new Set<string>(),
          sampleQuote: truncateQuote(fullText, 120),
        };
        item.count++;
        item.books.add(asin);
        nGramCounts.set(trigram, item);
      }
    }
  }

  // Add high-frequency emergent phrases (frequency >= 2) not already present in lexicon
  for (const [nGram, data] of nGramCounts.entries()) {
    if (data.count >= 2 && !complaintStatsMap.has(nGram.toLowerCase())) {
      // Check if it's already a subphrase of a known lexicon phrase
      let alreadyCovered = false;
      for (const known of complaintStatsMap.keys()) {
        if (known.includes(nGram.toLowerCase()) || nGram.toLowerCase().includes(known)) {
          alreadyCovered = true;
          break;
        }
      }

      if (!alreadyCovered) {
        complaintStatsMap.set(nGram, {
          phrase: nGram,
          category: 'General feedback',
          count: data.count,
          booksWithPhrase: data.books,
          sampleQuotes: [data.sampleQuote],
        });
      }
    }
  }

  // Format into ComplaintStat array
  const allComplaints: ComplaintStat[] = Array.from(complaintStatsMap.values()).map((c) => ({
    phrase: c.phrase,
    category: c.category,
    count: c.count,
    bookCount: c.booksWithPhrase.size,
    sampleQuotes: c.sampleQuotes,
  }));

  // Sort by count desc, then bookCount desc
  allComplaints.sort((a, b) => b.count - a.count || b.bookCount - a.bookCount);

  const topComplaints = allComplaints.slice(0, topShown);

  // 3. Category Summary
  const categoryCountsMap = new Map<string, number>();
  let totalCategorized = 0;

  for (const c of allComplaints) {
    categoryCountsMap.set(c.category, (categoryCountsMap.get(c.category) || 0) + c.count);
    totalCategorized += c.count;
  }

  const categorySummary: CategoryComplaintCount[] = Array.from(categoryCountsMap.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: totalCategorized > 0 ? Math.round((count / totalCategorized) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // 4. Extract Positive Signals (from 4-5 star reviews of the same books)
  const posBigramCounts = new Map<string, number>();

  for (const review of allPositiveReviews) {
    const fullText = [review.title, review.body].filter(Boolean).join(' ');
    const rawTokens = tokenizeText(fullText);
    const filtered = rawTokens.filter((t) => !DEFAULT_ENGLISH_STOPWORDS.has(t));

    for (let i = 0; i < filtered.length - 1; i++) {
      const bigram = `${filtered[i]} ${filtered[i + 1]}`;
      posBigramCounts.set(bigram, (posBigramCounts.get(bigram) || 0) + 1);
    }
  }

  const positivePhrases: WordFrequencyItem[] = Array.from(posBigramCounts.entries())
    .map(([word, count]) => ({
      word,
      count,
      inTitlesCount: count,
      percentage: 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    complaints: topComplaints,
    categorySummary,
    positivePhrases,
    totalNegativeReviews,
    totalBooksAnalyzed: targetBooks.length,
    reviewsRequireLogin: booksRequiringLogin > 0,
    booksRequiringLogin,
  };
}
