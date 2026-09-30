import { describe, it, expect } from 'vitest';
import { calculateNicheScore } from '../src/services/scoring';
import type { Book } from '../src/types';

describe('Niche Score Formula', () => {
  it('calculates high green score for strong demand, low reviews, and weak competitors', () => {
    const mockBooks: Book[] = Array.from({ length: 10 }).map((_, i) => ({
      asin: `B00000000${i}`,
      title: `Book ${i}`,
      author: `Author ${i}`,
      price: 14.99,
      rating: 3.5, // low rating = weak competitor opportunity
      reviewCount: 15, // low reviews = competition gap & weak competitor
      bsrOverall: 25000, // strong demand (< 100,000)
      categoryRanks: [],
      publishDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // new entrant
    }));

    const score = calculateNicheScore(mockBooks);

    expect(score.demand).toBe(35);
    expect(score.competitionGap).toBe(30);
    expect(score.weakCompetitors).toBe(15);
    expect(score.newEntrant).toBe(10);
    expect(score.total).toBeGreaterThanOrEqual(80);
    expect(score.label).toBe('green');
  });

  it('calculates red score for saturated niches with high reviews and high BSR', () => {
    const mockBooks: Book[] = Array.from({ length: 10 }).map((_, i) => ({
      asin: `B00000000${i}`,
      title: `Old Book ${i}`,
      author: `Famous Author ${i}`,
      price: 6.99,
      rating: 4.8,
      reviewCount: 3500, // heavily saturated
      bsrOverall: 250000, // poor demand (> 100k)
      categoryRanks: [],
      publishDate: '2018-01-01',
    }));

    const score = calculateNicheScore(mockBooks);

    expect(score.demand).toBe(0);
    expect(score.competitionGap).toBe(0);
    expect(score.weakCompetitors).toBe(0);
    expect(score.total).toBeLessThan(60);
    expect(score.label).toBe('red');
  });
});
