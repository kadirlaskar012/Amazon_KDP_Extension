// tests/specsAnalysis.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateMedian,
  normalizeTrimSize,
  analyzeSpecs,
  isLowContentBook,
} from '../src/services/specsAnalysis';
import type { Book } from '../src/types';

describe('specsAnalysis service', () => {
  it('calculates median correctly with both odd and even counts', () => {
    // Odd count: [10, 20, 30] -> 20
    expect(calculateMedian([30, 10, 20])).toBe(20);

    // Even count: [10, 20, 30, 40] -> (20 + 30) / 2 = 25
    expect(calculateMedian([40, 10, 30, 20])).toBe(25);

    // Single item
    expect(calculateMedian([42])).toBe(42);

    // Empty list
    expect(calculateMedian([])).toBe(0);
  });

  it('normalizes dimensions to standard KDP trim sizes', () => {
    expect(normalizeTrimSize('8.5 x 0.25 x 11 inches')).toBe('8.5 x 11 inches');
    expect(normalizeTrimSize('8.5 x 11 x 0.2 inches')).toBe('8.5 x 11 inches');
    expect(normalizeTrimSize('6 x 0.5 x 9 inches')).toBe('6 x 9 inches');
    expect(normalizeTrimSize('21.59 x 0.61 x 27.94 cm')).toBe('8.5 x 11 inches');
    expect(normalizeTrimSize(null)).toBeNull();
  });

  it('detects low content formats via title or attribute', () => {
    const coloringBook: Book = {
      asin: 'B01',
      title: 'Animal Coloring Book for Toddlers',
      author: 'Color Press',
      categoryRanks: [],
    };
    expect(isLowContentBook(coloringBook)).toBe(true);

    const normalNovel: Book = {
      asin: 'B02',
      title: 'A Story of Two Cities',
      author: 'Charles Dickens',
      categoryRanks: [],
      isLowContent: false,
    };
    expect(isLowContentBook(normalNovel)).toBe(false);
  });

  it('analyzes specs across top books, ignores missing values, and generates recommendations', () => {
    const mockBooks: Book[] = [
      {
        asin: 'B01',
        title: 'Toddler Coloring Book',
        author: 'Color Press',
        pages: 64,
        dimensions: '8.5 x 0.2 x 11 inches',
        price: 6.99,
        readingAge: '1 - 3 years',
        categoryRanks: [],
      },
      {
        asin: 'B02',
        title: 'Preschool Coloring Book',
        author: 'Early Learning',
        pages: 80,
        dimensions: '8.5 x 0.25 x 11 inches',
        price: 7.99,
        readingAge: '1 - 3 years',
        categoryRanks: [],
      },
      {
        asin: 'B03',
        title: 'Animal Tracing Workbook',
        author: 'Trace Masters',
        pages: 72,
        dimensions: '8.5 x 11 inches',
        price: 7.49,
        readingAge: '2 - 4 years',
        categoryRanks: [],
      },
      {
        asin: 'B04',
        title: 'Missing Details Book',
        author: 'Unknown',
        // pages, dimensions, price missing
        categoryRanks: [],
      },
    ];

    const summary = analyzeSpecs(mockBooks);

    // Median pages for [64, 72, 80] = 72
    expect(summary.pageCount.median).toBe(72);
    expect(summary.pageCount.min).toBe(64);
    expect(summary.pageCount.max).toBe(80);

    // Trim size: 8.5 x 11 inches used by 3 of 4 books
    expect(summary.trimSize.mostCommon).toBe('8.5 x 11 inches');
    expect(summary.trimSize.count).toBe(3);

    // Price: [6.99, 7.49, 7.99] median = 7.49
    expect(summary.price.median).toBe(7.49);

    // Reading age: 1 - 3 years (2 books)
    expect(summary.readingAge.mostCommon).toBe('1 - 3 years');

    // Recommendations
    // Page count recommended is median rounded to nearest 10: 72 -> 70
    expect(summary.recommended.pageCount).toBe(70);
    expect(summary.recommended.trimSize).toBe('8.5 x 11 inches');
    expect(summary.recommended.priceRange).toBe('$6.49 - $8.49');
    expect(summary.recommended.readingAge).toBe('1 - 3 years');
  });
});
