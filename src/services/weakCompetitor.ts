import type { Book, Thresholds } from '../types';
import { DEFAULT_THRESHOLDS } from '../config/defaults';

/**
 * Checks if a book qualifies as a weak competitor / opportunity:
 * bsrOverall < demandBsr AND (reviewCount < weakReviewCount OR rating < weakRating)
 */
export function isOpportunity(
  book: Book,
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): boolean {
  if (book.bsrOverall === undefined || book.bsrOverall === null) {
    return false;
  }

  // Must satisfy demand criterion
  if (book.bsrOverall >= thresholds.demandBsr) {
    return false;
  }

  const hasLowReviews =
    book.reviewCount !== undefined && book.reviewCount < thresholds.weakReviewCount;
  const hasLowRating =
    book.rating !== undefined && book.rating < thresholds.weakRating;

  return hasLowReviews || hasLowRating;
}

/**
 * Returns descriptive reasons why this book is considered an opportunity
 */
export function getOpportunityReasons(
  book: Book,
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): string[] {
  if (!isOpportunity(book, thresholds)) {
    return [];
  }

  const reasons: string[] = [];

  if (book.bsrOverall !== undefined) {
    reasons.push(`BSR #${book.bsrOverall.toLocaleString()} (Verified demand)`);
  }

  if (
    book.reviewCount !== undefined &&
    book.reviewCount < thresholds.weakReviewCount
  ) {
    reasons.push(
      `Low review barrier: only ${book.reviewCount} reviews (< ${thresholds.weakReviewCount})`
    );
  }

  if (book.rating !== undefined && book.rating < thresholds.weakRating) {
    reasons.push(
      `Rating ${book.rating} < ${thresholds.weakRating} (Sub-par customer rating, easy to beat)`
    );
  }

  if (book.pageCount !== undefined && book.pageCount < 60) {
    reasons.push(`Low content volume: only ${book.pageCount} pages (Easy to out-value)`);
  }

  return reasons;
}

/**
 * Calculates an opportunity strength score (0-100) for ranking target books to beat
 */
export function calculateOpportunityScore(
  book: Book,
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): number {
  if (!isOpportunity(book, thresholds)) return 0;

  let score = 50;

  // Higher demand (lower BSR) = bigger sales reward if beaten
  if (book.bsrOverall && book.bsrOverall < 20000) {
    score += 25;
  } else if (book.bsrOverall && book.bsrOverall < 50000) {
    score += 15;
  }

  // Fewer reviews = easier to outrank
  if (book.reviewCount !== undefined) {
    if (book.reviewCount < 10) score += 20;
    else if (book.reviewCount < 25) score += 10;
  }

  // Lower rating = easier to convert customers with better quality
  if (book.rating !== undefined && book.rating < 4.0) {
    score += 15;
  }

  return Math.min(100, score);
}
