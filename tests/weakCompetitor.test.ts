import { describe, it, expect } from 'vitest';
import { isOpportunity, getOpportunityReasons } from '../src/services/weakCompetitor';
import { DEFAULT_THRESHOLDS } from '../src/config/defaults';
import type { Book } from '../src/types';

describe('Weak Competitor Detector', () => {
  const baseBook: Book = {
    asin: 'B00TEST001',
    title: 'Test Notebook',
    author: 'Test Author',
    categoryRanks: [],
  };

  it('detects opportunity when BSR < 100,000 and reviews < 30', () => {
    const book: Book = {
      ...baseBook,
      bsrOverall: 50000,
      reviewCount: 29,
      rating: 4.5,
    };

    expect(isOpportunity(book, DEFAULT_THRESHOLDS)).toBe(true);
    const reasons = getOpportunityReasons(book, DEFAULT_THRESHOLDS);
    expect(reasons.some((r) => r.includes('reviews'))).toBe(true);
    expect(reasons.some((r) => r.includes('BSR'))).toBe(true);
  });

  it('detects opportunity when BSR < 100,000 and rating < 4.0', () => {
    const book: Book = {
      ...baseBook,
      bsrOverall: 25000,
      reviewCount: 150,
      rating: 3.9,
    };

    expect(isOpportunity(book, DEFAULT_THRESHOLDS)).toBe(true);
    const reasons = getOpportunityReasons(book, DEFAULT_THRESHOLDS);
    expect(reasons.some((r) => r.includes('Rating 3.9'))).toBe(true);
  });

  it('detects opportunity when both low reviews and low rating are present', () => {
    const book: Book = {
      ...baseBook,
      bsrOverall: 12000,
      reviewCount: 10,
      rating: 3.5,
    };

    expect(isOpportunity(book, DEFAULT_THRESHOLDS)).toBe(true);
    const reasons = getOpportunityReasons(book, DEFAULT_THRESHOLDS);
    expect(reasons).toHaveLength(3); // BSR + reviews + rating
  });

  it('tests boundary values for reviews: 29 is opportunity, 30 is not (with rating >= 4.0)', () => {
    const book29: Book = { ...baseBook, bsrOverall: 50000, reviewCount: 29, rating: 4.5 };
    const book30: Book = { ...baseBook, bsrOverall: 50000, reviewCount: 30, rating: 4.5 };

    expect(isOpportunity(book29, DEFAULT_THRESHOLDS)).toBe(true);
    expect(isOpportunity(book30, DEFAULT_THRESHOLDS)).toBe(false);
  });

  it('tests boundary values for rating: 3.9 is opportunity, 4.0 is not (with reviews >= 30)', () => {
    const book39: Book = { ...baseBook, bsrOverall: 50000, reviewCount: 50, rating: 3.9 };
    const book40: Book = { ...baseBook, bsrOverall: 50000, reviewCount: 50, rating: 4.0 };

    expect(isOpportunity(book39, DEFAULT_THRESHOLDS)).toBe(true);
    expect(isOpportunity(book40, DEFAULT_THRESHOLDS)).toBe(false);
  });

  it('tests boundary values for BSR: 99,999 is opportunity, 100,000 is not', () => {
    const book99k: Book = { ...baseBook, bsrOverall: 99999, reviewCount: 10, rating: 3.5 };
    const book100k: Book = { ...baseBook, bsrOverall: 100000, reviewCount: 10, rating: 3.5 };

    expect(isOpportunity(book99k, DEFAULT_THRESHOLDS)).toBe(true);
    expect(isOpportunity(book100k, DEFAULT_THRESHOLDS)).toBe(false);
  });

  it('returns false if BSR is missing or null', () => {
    const bookNoBsr: Book = { ...baseBook, reviewCount: 5, rating: 3.2 };
    expect(isOpportunity(bookNoBsr, DEFAULT_THRESHOLDS)).toBe(false);
    expect(getOpportunityReasons(bookNoBsr, DEFAULT_THRESHOLDS)).toEqual([]);
  });
});
