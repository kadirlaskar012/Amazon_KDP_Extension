import { describe, it, expect } from 'vitest';
import {
  estimateMonthlySales,
  estimateRoyaltyPerSale,
  estimateMonthlyRoyalty,
  estimateNicheRevenue,
} from '../src/services/salesEstimator';
import { DEFAULT_BSR_SALES_TABLE, DEFAULT_SETTINGS } from '../src/config/defaults';
import type { Book } from '../src/types';

describe('Sales & Royalty Estimator (Phase 2)', () => {
  it('tests BSR lookup at every table boundary', () => {
    // 1 - 1000: 3000
    expect(estimateMonthlySales(1, DEFAULT_BSR_SALES_TABLE).value).toBe(3000);
    expect(estimateMonthlySales(1000, DEFAULT_BSR_SALES_TABLE).value).toBe(3000);

    // 1001 - 5000: 1500
    expect(estimateMonthlySales(1001, DEFAULT_BSR_SALES_TABLE).value).toBe(1500);
    expect(estimateMonthlySales(5000, DEFAULT_BSR_SALES_TABLE).value).toBe(1500);

    // 5001 - 20000: 350
    expect(estimateMonthlySales(5001, DEFAULT_BSR_SALES_TABLE).value).toBe(350);
    expect(estimateMonthlySales(20000, DEFAULT_BSR_SALES_TABLE).value).toBe(350);

    // 20001 - 100000: 80
    expect(estimateMonthlySales(20001, DEFAULT_BSR_SALES_TABLE).value).toBe(80);
    expect(estimateMonthlySales(100000, DEFAULT_BSR_SALES_TABLE).value).toBe(80);

    // 100001+: 20
    expect(estimateMonthlySales(100001, DEFAULT_BSR_SALES_TABLE).value).toBe(20);
    expect(estimateMonthlySales(999999, DEFAULT_BSR_SALES_TABLE).value).toBe(20);
  });

  it('handles null, undefined, and non-positive BSR cleanly', () => {
    expect(estimateMonthlySales(null).value).toBeNull();
    expect(estimateMonthlySales(undefined).value).toBeNull();
    expect(estimateMonthlySales(0).value).toBeNull();
    expect(estimateMonthlySales(-50).value).toBeNull();
  });

  it('calculates royalty with known example: price 9.99, 110 pages', () => {
    // printingCost = 1.00 + 0.012 * 110 = 2.32
    // royalty = 0.6 * 9.99 - 2.32 = 5.994 - 2.32 = 3.67
    const result = estimateRoyaltyPerSale(9.99, 110, DEFAULT_SETTINGS);
    expect(result.value).toBe(3.67);
    expect(result.isEstimate).toBe(true);
  });

  it('estimates monthly royalty and niche revenue for top 10 books', () => {
    const book: Book = {
      asin: 'B001',
      title: 'Sample Journal',
      author: 'Author',
      price: 9.99,
      pageCount: 110,
      bsrOverall: 5000, // 1500 sales, 3.67 royalty = 5505.00
      categoryRanks: [],
    };

    const bookRoyalty = estimateMonthlyRoyalty(book, DEFAULT_SETTINGS);
    expect(bookRoyalty.value).toBe(5505.00);

    const nicheRev = estimateNicheRevenue([book], DEFAULT_SETTINGS);
    expect(nicheRev.totalMonthlyRoyalty.value).toBe(5505.00);
    expect(nicheRev.avgMonthlyRoyalty.value).toBe(5505.00);
    expect(nicheRev.medianMonthlyRoyalty.value).toBe(5505.00);
  });
});
