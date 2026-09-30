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
});
