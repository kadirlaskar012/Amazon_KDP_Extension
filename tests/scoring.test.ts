import { describe, it, expect } from 'vitest';
import { calculateNicheScore, normalizeWeights } from '../src/services/scoring';
import { DEFAULT_SETTINGS } from '../src/config/defaults';
import type { Book, ScoreWeights } from '../src/types';

describe('Niche Scoring System (Phase 2)', () => {
  it('returns >= 80 (green) for an all-strong low-competition niche', () => {
    const strongBooks: Book[] = Array.from({ length: 10 }).map((_, i) => ({
      asin: `B00STRONG${i}`,
      title: `Strong Book ${i}`,
      author: `Author ${i}`,
      price: 11.99, // good profit ($11.99 * 0.6 - 2.20 = ~$5.00 royalty)
      pageCount: 100,
      bsrOverall: 35000, // strong demand (< 100k)
      reviewCount: 15, // low reviews (< 50, and < 30 = weak competitor)
      rating: 3.8, // weak rating (< 4.0)
      publishDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // new entrant
      categoryRanks: [],
    }));

    const result = calculateNicheScore(strongBooks, DEFAULT_SETTINGS);

    expect(result.total).toBeGreaterThanOrEqual(80);
    expect(result.label).toBe('green');
    expect(result.breakdown.demand.points).toBe(35);
    expect(result.breakdown.competitionGap.points).toBe(30);
    expect(result.breakdown.weakCompetitors.points).toBe(15);
    expect(result.breakdown.profit.points).toBe(10);
    expect(result.breakdown.newEntrant.points).toBe(10);
    expect(result.verdict).toContain('Worth building');
  });

  it('returns < 60 (red) for a saturated, high-competition niche', () => {
    const saturatedBooks: Book[] = Array.from({ length: 10 }).map((_, i) => ({
      asin: `B00SATURATED${i}`,
      title: `Old Giant Book ${i}`,
      author: `Famous Author ${i}`,
      price: 4.99, // very low profit
      pageCount: 150,
      bsrOverall: 250000, // weak demand (> 100k)
      reviewCount: 8500, // heavy reviews (> 50)
      rating: 4.8,
      publishDate: '2016-01-01', // very old
      categoryRanks: [],
    }));

    const result = calculateNicheScore(saturatedBooks, DEFAULT_SETTINGS);

    expect(result.total).toBeLessThan(60);
    expect(result.label).toBe('red');
    expect(result.verdict).toContain('Too competitive');
  });

  it('returns label "insufficient" when fewer than 3 books have BSR', () => {
    const fewBooks: Book[] = [
      {
        asin: 'B001',
        title: 'Only One with BSR',
        author: 'Author',
        bsrOverall: 12000,
        categoryRanks: [],
      },
      {
        asin: 'B002',
        title: 'Second with BSR',
        author: 'Author',
        bsrOverall: 45000,
        categoryRanks: [],
      },
      {
        asin: 'B003',
        title: 'No BSR yet',
        author: 'Author',
        categoryRanks: [],
      },
    ];

    const result = calculateNicheScore(fewBooks, DEFAULT_SETTINGS);

    expect(result.label).toBe('insufficient');
    expect(result.total).toBe(0);
    expect(result.warnings.some((w) => w.includes('Insufficient data'))).toBe(true);
  });

  it('handles missing fields without throwing errors', () => {
    const missingFieldsBooks: Book[] = Array.from({ length: 5 }).map((_, i) => ({
      asin: `B00MISSING${i}`,
      title: `Book with missing data ${i}`,
      author: `Author ${i}`,
      bsrOverall: 50000, // has BSR so n = 5 >= 3
      categoryRanks: [],
      // price, rating, reviewCount, pageCount, publishDate all omitted
    }));

    expect(() => calculateNicheScore(missingFieldsBooks, DEFAULT_SETTINGS)).not.toThrow();
    const result = calculateNicheScore(missingFieldsBooks, DEFAULT_SETTINGS);
    expect(result.booksAnalyzed).toBe(5);
    expect(result.total).toBeGreaterThan(0);
  });

  it('normalizes weights so they sum to 100', () => {
    const unnormalizedWeights: ScoreWeights = {
      demand: 50,
      competitionGap: 50,
      weakCompetitors: 50,
      profit: 50,
      newEntrant: 50,
    }; // sum = 250

    const normalized = normalizeWeights(unnormalizedWeights);
    const sum =
      normalized.demand +
      normalized.competitionGap +
      normalized.weakCompetitors +
      normalized.profit +
      normalized.newEntrant;

    expect(sum).toBe(100);
    expect(normalized.demand).toBe(20);
    expect(normalized.competitionGap).toBe(20);
    expect(normalized.weakCompetitors).toBe(20);
    expect(normalized.profit).toBe(20);
    expect(normalized.newEntrant).toBe(20);
  });

  it('recomputes all 5 factors by hand for a fixture of 10 books and matches exact manual points', () => {
    const now = Date.now();
    const fixture10: Book[] = [
      {
        asin: 'B01',
        title: 'Book 1',
        author: 'A1',
        categoryRanks: [],
        bsrOverall: 20000,
        reviewCount: 15,
        rating: 3.8,
        price: 9.99,
        pageCount: 100,
        publishDate: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        asin: 'B02',
        title: 'Book 2',
        author: 'A2',
        categoryRanks: [],
        bsrOverall: 50000,
        reviewCount: 25,
        rating: 4.5,
        price: 8.99,
        pageCount: 100,
        publishDate: new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        asin: 'B03',
        title: 'Book 3',
        author: 'A3',
        categoryRanks: [],
        bsrOverall: 80000,
        reviewCount: 40,
        rating: 3.7,
        price: 7.99,
        pageCount: 100,
        publishDate: new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        asin: 'B04',
        title: 'Book 4',
        author: 'A4',
        categoryRanks: [],
        bsrOverall: 90000,
        reviewCount: 45,
        rating: 4.2,
        price: 6.99,
        pageCount: 80,
        publishDate: '2023-01-01',
      },
      {
        asin: 'B05',
        title: 'Book 5',
        author: 'A5',
        categoryRanks: [],
        bsrOverall: 95000,
        reviewCount: 48,
        rating: 4.4,
        price: 9.99,
        pageCount: 100,
        publishDate: '2023-01-01',
      },
      {
        asin: 'B06',
        title: 'Book 6',
        author: 'A6',
        categoryRanks: [],
        bsrOverall: 150000,
        reviewCount: 60,
        rating: 4.6,
        price: 7.99,
        pageCount: 80,
        publishDate: '2022-01-01',
      },
      {
        asin: 'B07',
        title: 'Book 7',
        author: 'A7',
        categoryRanks: [],
        bsrOverall: 200000,
        reviewCount: 80,
        rating: 4.5,
        price: 9.99,
        pageCount: 100,
        publishDate: '2022-01-01',
      },
      {
        asin: 'B08',
        title: 'Book 8',
        author: 'A8',
        categoryRanks: [],
        bsrOverall: 250000,
        reviewCount: 120,
        rating: 4.7,
        price: 9.99,
        pageCount: 100,
        publishDate: '2022-01-01',
      },
      {
        asin: 'B09',
        title: 'Book 9',
        author: 'A9',
        categoryRanks: [],
        bsrOverall: 300000,
        reviewCount: 200,
        rating: 4.8,
        price: 9.99,
        pageCount: 100,
        publishDate: '2021-01-01',
      },
      {
        asin: 'B10',
        title: 'Book 10',
        author: 'A10',
        categoryRanks: [],
        bsrOverall: 400000,
        reviewCount: 500,
        rating: 4.9,
        price: 9.99,
        pageCount: 100,
        publishDate: '2020-01-01',
      },
    ];

    const score = calculateNicheScore(fixture10, DEFAULT_SETTINGS);

    // 1. Demand: 5/10 books < 100k -> 0.5 * 35 = 17.5
    expect(score.breakdown.demand.points).toBe(17.5);
    // 2. Comp gap: 5/10 books < 50 reviews -> 0.5 * 30 = 15.0
    expect(score.breakdown.competitionGap.points).toBe(15);
    // 3. Weak competitors: 3 books (B01, B02, B03) -> 3/3 = 1.0 * 15 = 15.0
    expect(score.breakdown.weakCompetitors.points).toBe(15);
    // 4. Profit: Median profit is 3.79 >= 3.0 -> 1.0 * 10 = 10.0
    expect(score.breakdown.profit.points).toBe(10);
    // 5. New entrant: 3/10 books <= 6 months -> 0.3 / 0.3 = 1.0 * 10 = 10.0
    expect(score.breakdown.newEntrant.points).toBe(10);

    // Total: 17.5 + 15 + 15 + 10 + 10 = 67.5 -> rounded to 68
    expect(score.total).toBe(68);
    expect(score.label).toBe('yellow');
  });

  it('guarantees total score is strictly clamped between 0 and 100', () => {
    // Extreme custom weights that could overshoot if unhandled
    const extremeSettings = {
      ...DEFAULT_SETTINGS,
      weights: {
        demand: 150,
        competitionGap: 150,
        weakCompetitors: 100,
        profit: 100,
        newEntrant: 100,
      },
    };

    const strongBooks: Book[] = Array.from({ length: 10 }).map((_, i) => ({
      asin: `B${i}`,
      title: `Book ${i}`,
      author: 'Author',
      categoryRanks: [],
      bsrOverall: 5000,
      reviewCount: 10,
      rating: 3.5,
      price: 15.99,
      pageCount: 100,
      publishDate: new Date().toISOString(),
    }));

    const score = calculateNicheScore(strongBooks, extremeSettings);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(score.total).toBeGreaterThanOrEqual(0);
  });
});
