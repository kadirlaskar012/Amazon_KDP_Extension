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
    reasons.push(`BSR #${book.bsrOverall.toLocaleString()} (strong demand)`);
  }

  if (
    book.reviewCount !== undefined &&
    book.reviewCount < thresholds.weakReviewCount
  ) {
    reasons.push(
      `Only ${book.reviewCount} reviews (< ${thresholds.weakReviewCount})`
    );
  }

  if (book.rating !== undefined && book.rating < thresholds.weakRating) {
    reasons.push(
      `Rating ${book.rating.toFixed(1)} (< ${thresholds.weakRating.toFixed(1)})`
    );
  }

  return reasons;
}
