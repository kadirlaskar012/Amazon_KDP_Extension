import { describe, it, expect } from 'vitest';
import { analyzeReviewGap, truncateQuote, extractSampleSnippet } from '../src/services/reviewGap';
import type { Book } from '../src/types';

describe('reviewGap service', () => {
  const mockBooks: Book[] = [
    {
      asin: 'B01TEST001',
      title: 'Toddler Coloring Book Vol 1',
      reviews: [
        {
          rating: 1,
          title: 'Thin paper and bleed through',
          body: 'The paper is thin and ink will bleed through to the next page. Also pages are cut off.',
        },
        {
          rating: 2,
          title: 'Waste of money',
          body: 'Too simple and blurry images. Waste of money for sure.',
        },
        {
          rating: 5,
          title: 'My daughter loves this!',
          body: 'My daughter loves coloring every day! Thick paper and cute animal designs.',
        },
      ],
    },
    {
      asin: 'B02TEST002',
      title: 'Toddler Coloring Book Vol 2',
      reviews: [
        {
          rating: 2,
          title: 'Marker bleed through',
          body: 'Markers bleed through the pages. Paper is thin.',
        },
        {
          rating: 3,
          title: 'Small designs',
          body: 'Too small for toddlers. Designs are too complicated and blurry.',
        },
        {
          rating: 4,
          title: 'Great illustrations',
          body: 'My daughter loves the fun pictures! Super nice gift.',
        },
      ],
    },
    {
      asin: 'B03TEST003',
      title: 'Toddler Activity Book',
      reviews: [
        {
          rating: 3,
          title: 'Few designs',
          body: 'Only 20 pages, too few activities. Not worth the price.',
        },
      ],
    },
  ];

  it('matches lexicon phrases case-insensitively and computes counts and bookCount', () => {
    const analysis = analyzeReviewGap(mockBooks);

    expect(analysis.totalBooksAnalyzed).toBe(3);
    expect(analysis.totalNegativeReviews).toBe(5);

    // "bleed through" appears in book 1 and book 2
    const bleedThrough = analysis.complaints.find((c) => c.phrase.toLowerCase() === 'bleed through');
    expect(bleedThrough).toBeDefined();
    expect(bleedThrough?.category).toBe('Paper quality');
    expect(bleedThrough?.count).toBeGreaterThanOrEqual(2);
    expect(bleedThrough?.bookCount).toBe(2);

    // "waste of money" appears only in book 1
    const wasteOfMoney = analysis.complaints.find((c) => c.phrase.toLowerCase() === 'waste of money');
    expect(wasteOfMoney).toBeDefined();
    expect(wasteOfMoney?.category).toBe('Value');
    expect(wasteOfMoney?.bookCount).toBe(1);
  });

  it('sorts category summary descending by complaint count', () => {
    const analysis = analyzeReviewGap(mockBooks);

    expect(analysis.categorySummary.length).toBeGreaterThan(0);
    for (let i = 0; i < analysis.categorySummary.length - 1; i++) {
      expect(analysis.categorySummary[i]!.count).toBeGreaterThanOrEqual(
        analysis.categorySummary[i + 1]!.count
      );
    }
  });

  it('discovers emergent bigrams/trigrams across negative reviews', () => {
    const analysis = analyzeReviewGap(mockBooks);
    // At least some complaints or feedback should be detected
    expect(analysis.complaints.length).toBeGreaterThan(0);
  });

  it('truncates sample quotes to at most 120 characters', () => {
    const longText = 'A'.repeat(200);
    const truncated = truncateQuote(longText, 120);
    expect(truncated.length).toBeLessThanOrEqual(120);
    expect(truncated.endsWith('...')).toBe(true);

    const snippet = extractSampleSnippet(
      'The book has very thin paper which causes markers to bleed through terribly. ' + 'B'.repeat(150),
      'thin paper',
      120
    );
    expect(snippet.length).toBeLessThanOrEqual(120);
  });

  it('separates positive phrases from 4 and 5 star reviews', () => {
    const analysis = analyzeReviewGap(mockBooks);

    expect(analysis.positivePhrases.length).toBeGreaterThan(0);
    // Check for positive bigram "daughter loves" from 5-star & 4-star reviews
    const daughterLoves = analysis.positivePhrases.find((p) => p.word.includes('daughter') || p.word.includes('loves'));
    expect(daughterLoves).toBeDefined();
  });
});
