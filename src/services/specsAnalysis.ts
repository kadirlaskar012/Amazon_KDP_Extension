// src/services/specsAnalysis.ts
// Common specs analyzer for top 10 books: page counts, trim sizes, prices, reading ages, and format share

import type { Book, SpecsSummary, PageCountDistribution, PriceDistribution } from '../types';
import { LOW_CONTENT_KEYWORDS } from '../config/stopwords';

/**
 * Calculates median of an array of numbers (handles odd and even counts)
 */
export function calculateMedian(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  // Even count: average of the two middle values
  const val1 = sorted[mid - 1] ?? 0;
  const val2 = sorted[mid] ?? 0;
  return Math.round(((val1 + val2) / 2) * 100) / 100;
}

/**
 * Normalizes book dimensions into standard KDP trim size strings
 * e.g. "8.5 x 0.25 x 11 inches" -> "8.5 x 11 inches"
 *      "21.59 x 0.5 x 27.94 cm" -> "8.5 x 11 inches"
 */
export function normalizeTrimSize(dimensions: string | null | undefined): string | null {
  if (!dimensions) return null;
  const clean = dimensions.trim();
  if (!clean) return null;

  const isCm = /cm\b/i.test(clean);

  // Extract all numeric floats
  const matches = clean.match(/\d+(?:\.\d+)?/g);
  if (!matches || matches.length < 2) {
    return clean;
  }

  let nums = matches.map((n) => parseFloat(n)).filter((n) => !isNaN(n) && n > 0);

  if (isCm) {
    // Convert cm to inches (1 in = 2.54 cm)
    nums = nums.map((n) => Math.round((n / 2.54) * 100) / 100);
  }

  // If 3 dimensions (width, spine thickness, height), discard the thickness (smallest, usually < 1 inch)
  let width: number;
  let height: number;

  if (nums.length >= 3) {
    nums.sort((a, b) => a - b);
    // nums[0] is thickness, nums[1] and nums[2] are width and height
    width = nums[1] ?? 0;
    height = nums[2] ?? 0;
  } else {
    const n0 = nums[0] ?? 0;
    const n1 = nums[1] ?? 0;
    width = Math.min(n0, n1);
    height = Math.max(n0, n1);
  }

  // Snap to common standard KDP trim sizes if within 0.25 inches
  const standardSizes = [
    { w: 8.5, h: 11, label: '8.5 x 11 inches' },
    { w: 6.0, h: 9.0, label: '6 x 9 inches' },
    { w: 8.5, h: 8.5, label: '8.5 x 8.5 inches' },
    { w: 7.0, h: 10.0, label: '7 x 10 inches' },
    { w: 5.5, h: 8.5, label: '5.5 x 8.5 inches' },
    { w: 8.25, h: 11.0, label: '8.25 x 11 inches' },
    { w: 8.25, h: 6.0, label: '8.25 x 6 inches' },
    { w: 7.5, h: 9.25, label: '7.5 x 9.25 inches' },
    { w: 5.0, h: 8.0, label: '5 x 8 inches' },
  ];

  for (const std of standardSizes) {
    if (Math.abs(width - std.w) <= 0.3 && Math.abs(height - std.h) <= 0.3) {
      return std.label;
    }
  }

  return `${width} x ${height} inches`;
}

/**
 * Checks if a book title or attributes indicate a low-content format
 */
export function isLowContentBook(book: Book, customKeywords: string[] = LOW_CONTENT_KEYWORDS): boolean {
  if (typeof book.isLowContent === 'boolean') {
    return book.isLowContent;
  }
  const text = [book.title, book.subtitle].filter(Boolean).join(' ').toLowerCase();
  return customKeywords.some((kw) => text.includes(kw.toLowerCase()));
}

/**
 * Analyzes top books (typically top 10) to generate specs summary and recommendations
 */
export function analyzeSpecs(books: Book[]): SpecsSummary {
  const topBooks = books.slice(0, 10);
  const total = topBooks.length;

  // 1. Page Counts
  const validPages = topBooks
    .map((b) => b.pages ?? b.pageCount)
    .filter((p): p is number => typeof p === 'number' && p > 0);

  const pageMedian = calculateMedian(validPages);
  const pageMin = validPages.length > 0 ? Math.min(...validPages) : 0;
  const pageMax = validPages.length > 0 ? Math.max(...validPages) : 0;

  // Buckets of 10 pages (e.g. 20-29, 30-39, etc.)
  const pageBuckets = new Map<string, number>();
  for (const p of validPages) {
    const bucketStart = Math.floor(p / 10) * 10;
    const bucketEnd = bucketStart + 9;
    const key = `${bucketStart}-${bucketEnd}`;
    pageBuckets.set(key, (pageBuckets.get(key) || 0) + 1);
  }

  let mostCommonRange = 'N/A';
  let maxBucketCount = 0;
  const pageDistribution: PageCountDistribution[] = [];

  const sortedBucketKeys = Array.from(pageBuckets.keys()).sort((a, b) => {
    const startA = parseInt(a.split('-')[0] ?? '0', 10);
    const startB = parseInt(b.split('-')[0] ?? '0', 10);
    return startA - startB;
  });

  for (const key of sortedBucketKeys) {
    const count = pageBuckets.get(key) || 0;
    pageDistribution.push({ range: key, count });
    if (count > maxBucketCount) {
      maxBucketCount = count;
      mostCommonRange = key;
    }
  }

  // 2. Trim Size
  const trimCounts = new Map<string, number>();
  for (const b of topBooks) {
    const normalized = normalizeTrimSize(b.dimensions ?? b.trimSize);
    if (normalized) {
      trimCounts.set(normalized, (trimCounts.get(normalized) || 0) + 1);
    }
  }

  let mostCommonTrim = '8.5 x 11 inches';
  let maxTrimCount = 0;
  for (const [trim, count] of trimCounts.entries()) {
    if (count > maxTrimCount) {
      maxTrimCount = count;
      mostCommonTrim = trim;
    }
  }

  const trimPercentage = total > 0 ? Math.round((maxTrimCount / total) * 100) : 0;

  // 3. Price
  const validPrices = topBooks
    .map((b) => b.price)
    .filter((p): p is number => typeof p === 'number' && p > 0);

  const priceMedian = calculateMedian(validPrices);
  const priceMin = validPrices.length > 0 ? Math.min(...validPrices) : 0;
  const priceMax = validPrices.length > 0 ? Math.max(...validPrices) : 0;

  // Price points count
  const pricePoints = new Map<number, number>();
  for (const pr of validPrices) {
    const rounded = Math.round(pr * 100) / 100;
    pricePoints.set(rounded, (pricePoints.get(rounded) || 0) + 1);
  }

  let mostCommonPoint = priceMedian;
  let maxPointCount = 0;
  for (const [pt, count] of pricePoints.entries()) {
    if (count > maxPointCount) {
      maxPointCount = count;
      mostCommonPoint = pt;
    }
  }

  // Price distribution in $2 buckets
  const priceBuckets = new Map<string, number>();
  for (const pr of validPrices) {
    const lower = Math.floor(pr / 2) * 2;
    const upper = lower + 1.99;
    const key = `$${lower.toFixed(2)} - $${upper.toFixed(2)}`;
    priceBuckets.set(key, (priceBuckets.get(key) || 0) + 1);
  }

  const priceDistribution: PriceDistribution[] = Array.from(priceBuckets.entries())
    .map(([range, count]) => ({ range, count }))
    .sort((a, b) => {
      const numA = parseFloat(a.range.replace(/[^\d.]/g, ''));
      const numB = parseFloat(b.range.replace(/[^\d.]/g, ''));
      return numA - numB;
    });

  // 4. Reading Age
  const ageCounts = new Map<string, number>();
  for (const b of topBooks) {
    if (b.readingAge) {
      const cleaned = b.readingAge.trim();
      ageCounts.set(cleaned, (ageCounts.get(cleaned) || 0) + 1);
    }
  }

  let mostCommonAge = 'N/A';
  let maxAgeCount = 0;
  for (const [age, count] of ageCounts.entries()) {
    if (count > maxAgeCount) {
      maxAgeCount = count;
      mostCommonAge = age;
    }
  }

  // 5. Format Share
  let lowContentCount = 0;
  for (const b of topBooks) {
    if (isLowContentBook(b)) {
      lowContentCount++;
    }
  }

  const formatPercentage = total > 0 ? Math.round((lowContentCount / total) * 100) : 0;

  // 6. Recommendation
  // Recommended page count: median rounded to nearest 10
  const recommendedPages = pageMedian > 0 ? Math.max(24, Math.round(pageMedian / 10) * 10) : 80;
  const lowerPrice = Math.max(2.99, Math.round((priceMedian - 1) * 100) / 100);
  const upperPrice = Math.round((priceMedian + 1) * 100) / 100;
  const recommendedPriceRange = priceMedian > 0 ? `$${lowerPrice.toFixed(2)} - $${upperPrice.toFixed(2)}` : '$6.99 - $8.99';

  return {
    pageCount: {
      median: pageMedian,
      min: pageMin,
      max: pageMax,
      mostCommonRange,
      distribution: pageDistribution,
    },
    trimSize: {
      mostCommon: mostCommonTrim,
      count: maxTrimCount,
      percentage: trimPercentage,
    },
    price: {
      median: priceMedian,
      min: priceMin,
      max: priceMax,
      mostCommonPoint,
      distribution: priceDistribution,
    },
    readingAge: {
      mostCommon: mostCommonAge,
      count: maxAgeCount,
    },
    formatShare: {
      lowContentCount,
      total,
      percentage: formatPercentage,
    },
    recommended: {
      pageCount: recommendedPages,
      pageCountReason: `Median is ${pageMedian} pages with most books in the ${mostCommonRange} page range.`,
      trimSize: mostCommonTrim,
      trimSizeReason: `Used by ${maxTrimCount} of ${total} top books (${trimPercentage}% adoption).`,
      priceRange: recommendedPriceRange,
      priceReason: `Centered around competitor median price of $${priceMedian.toFixed(2)}.`,
      readingAge: mostCommonAge !== 'N/A' ? mostCommonAge : undefined,
      readingAgeReason: mostCommonAge !== 'N/A' ? `Most frequent age specification in top competitor listings.` : undefined,
    },
  };
}
