import { describe, it, expect } from 'vitest';
import {
  escapeCsvCell,
  toCsvString,
  buildExportFileName,
  buildSearchResultsCsv,
  buildKeywordsCsv,
  buildCategoriesCsv,
  buildSpecsCsv,
  buildReviewsCsv,
  buildWatchlistCsv,
  buildAiIdeasCsv,
  buildFullResearchPackCsv,
  parseImportSnapshotJson,
} from '../src/services/exporter';
import type {
  SearchSnapshot,
  Book,
  KeywordItem,
  CategoryStat,
  SpecsSummary,
  ReviewGapAnalysis,
  WatchlistItem,
  BookIdea,
} from '../src/types';

describe('Exporter Service (Module L)', () => {
  describe('CSV Escaping and Formatting', () => {
    it('escapes cells containing commas, quotes, and newlines per RFC 4180', () => {
      expect(escapeCsvCell('simple text')).toBe('simple text');
      expect(escapeCsvCell('text, with comma')).toBe('"text, with comma"');
      expect(escapeCsvCell('text with "quotes"')).toBe('"text with ""quotes"""');
      expect(escapeCsvCell("line 1\nline 2")).toBe('"line 1\nline 2"');
      expect(escapeCsvCell("line 1\r\nline 2")).toBe('"line 1\r\nline 2"');
    });

    it('joins array items with pipe separator', () => {
      const arr = ['first tag', 'second tag', 'third tag'];
      expect(escapeCsvCell(arr)).toBe('first tag | second tag | third tag');
    });

    it('handles null and undefined as empty strings', () => {
      expect(escapeCsvCell(null)).toBe('');
      expect(escapeCsvCell(undefined)).toBe('');
    });

    it('includes UTF-8 BOM when requested for proper Excel rendering', () => {
      const rows = [
        ['Header 1', 'Header 2'],
        ['Val 1', 'Val 2'],
      ];
      const withBom = toCsvString(rows, ',', true);
      expect(withBom.startsWith('\uFEFF')).toBe(true);

      const withoutBom = toCsvString(rows, ',', false);
      expect(withoutBom.startsWith('\uFEFF')).toBe(false);
    });
  });

  describe('File Name Formatting', () => {
    it('generates standardized file names matching kdp-<kind>-<query-slug>-<YYYYMMDD-HHmm>.csv', () => {
      const fileName = buildExportFileName('search_results', 'Toddler Coloring Book!');
      expect(fileName).toMatch(/^kdp-search-results-toddler-coloring-book-\d{8}-\d{4}\.csv$/);

      const ideasFileName = buildExportFileName('ai_ideas', 'Cursive Handwriting');
      expect(ideasFileName).toMatch(/^kdp-ai-ideas-cursive-handwriting-\d{8}-\d{4}\.csv$/);
    });
  });

  describe('Data Section CSV Builders', () => {
    it('builds search results CSV with all metrics and opportunity flags', () => {
      const books: Book[] = [
        {
          asin: 'B001',
          title: 'Coloring Book for Kids, Toddlers Edition',
          author: 'Jane Doe',
          price: 6.99,
          bsrOverall: 4500,
          rating: 4.6,
          reviewCount: 120,
          pageCount: 80,
          trimSize: '8.5 x 11 inches',
          isLowContent: true,
          monthlySalesEstimate: 1500,
          monthlyRoyaltyEstimate: 2800,
          isOpportunity: true,
          opportunityReasons: ['High BSR with low review count'],
          categoryRanks: [],
        },
      ];

      const csv = buildSearchResultsCsv(books, 'coloring book');
      expect(csv).toContain('ASIN,Title,Author,Price ($),BSR Overall');
      expect(csv).toContain('B001');
      expect(csv).toContain('"Coloring Book for Kids, Toddlers Edition"');
      expect(csv).toContain('6.99');
      expect(csv).toContain('YES');
      expect(csv).toContain('High BSR with low review count');
    });

    it('builds keywords CSV with score metrics', () => {
      const keywords: KeywordItem[] = [
        {
          keyword: 'toddler coloring book',
          bestPosition: 1,
          inTitlesCount: 8,
          bsrScore: 85,
          totalScore: 92,
          scoreLabel: 'high',
          isPartial: false,
        },
      ];

      const csv = buildKeywordsCsv(keywords);
      expect(csv).toContain('Keyword,Position,Title Frequency (in 10)');
      expect(csv).toContain('toddler coloring book,1,8,85,92,HIGH');
    });

    it('builds categories CSV with difficulty cutoffs', () => {
      const categories: CategoryStat[] = [
        {
          name: 'Children Coloring Books',
          bookCount: 5,
          bestRankAmongTopBooks: 2,
          avgRank: 4.2,
          difficulty: 'medium',
          bsrAtTop1: 500,
          bsrAtTop10: 2500,
          bsrAtTop20: 8000,
          url: 'https://amazon.com/b?node=123',
          isGeneric: false,
        },
      ];

      const csv = buildCategoriesCsv(categories);
      expect(csv).toContain('Category Name,Books in Category,Best Rank in Top Books');
      expect(csv).toContain('Children Coloring Books,5,2,4,MEDIUM,500,2500,8000');
    });

    it('builds specs summary CSV with recommendations', () => {
      const specs: SpecsSummary = {
        pageCount: { median: 80, min: 40, max: 120, mostCommonRange: '60-80', distribution: [] },
        trimSize: { mostCommon: '8.5 x 11 inches', count: 6, percentage: 75 },
        price: { median: 6.99, min: 4.99, max: 9.99, mostCommonPoint: 6.99, distribution: [] },
        readingAge: { mostCommon: '3-5 years', count: 5 },
        formatShare: { lowContentCount: 8, total: 10, percentage: 80 },
        recommended: {
          pageCount: 80,
          pageCountReason: 'Matches market standard',
          trimSize: '8.5 x 11 inches',
          trimSizeReason: 'Standard art format',
          priceRange: '$6.99 - $7.99',
          priceReason: 'Optimal profit margin',
        },
      };

      const csv = buildSpecsCsv(specs);
      expect(csv).toContain('Specification Metric,Observed Value,Recommendation & Context');
      expect(csv).toContain('Median Page Count,80 pages');
      expect(csv).toContain('8.5 x 11 inches,75% of analyzed competitor books');
    });

    it('builds reviews CSV including both complaints and positive elements', () => {
      const reviewGap: ReviewGapAnalysis = {
        totalBooksAnalyzed: 5,
        totalNegativeReviews: 12,
        categorySummary: [],
        reviewsRequireLogin: false,
        booksRequiringLogin: 0,
        complaints: [
          {
            category: 'Paper Quality',
            phrase: 'bleed through',
            count: 7,
            bookCount: 4,
            sampleQuotes: ['Markers bleed right through the page'],
          },
        ],
        positivePhrases: [{ word: 'thick outlines', count: 9, inTitlesCount: 3, percentage: 30 }],
      };

      const csv = buildReviewsCsv(reviewGap);
      expect(csv).toContain('Negative Complaint,bleed through,Paper Quality,7,4,Markers bleed right through the page');
      expect(csv).toContain('Positive Signal (What Customers Like),thick outlines,Positive Customer Feedback,9,,');
    });

    it('builds AI ideas CSV with multi-item array joining', () => {
      const ideas: BookIdea[] = [
        {
          id: 'idea_1',
          createdAt: Date.now(),
          title: 'Forest Adventure Coloring',
          subtitle: 'Cute Animals for Preschoolers',
          subNiche: 'Forest Wildlife',
          targetAudience: 'Kids ages 3-6',
          sevenBackendKeywords: ['forest animals', 'preschool coloring', 'woodland creatures'],
          threeCategories: ['Books > Animals', 'Books > Coloring'],
          shortDescription: 'Fun coloring book description.',
          pageCount: 72,
          trimSize: '8.5 x 11 inches',
          priceSuggestion: 6.99,
          differentiationAngle: 'Single-sided printing',
          contentPlan: '40 unique woodland scenes',
          estimatedDifficulty: 3,
          whyItCouldWork: 'Under-served woodland theme',
          risks: 'Seasonal variation',
        },
      ];

      const csv = buildAiIdeasCsv(ideas);
      expect(csv).toContain('Title,Subtitle,Sub-Niche,Target Audience,7 Backend Keywords');
      expect(csv).toContain('Forest Adventure Coloring');
      expect(csv).toContain('forest animals | preschool coloring | woodland creatures');
      expect(csv).toContain('Books > Animals | Books > Coloring');
    });

    it('builds watchlist CSV with historical tracking entries', () => {
      const watchlist: WatchlistItem[] = [
        {
          asin: 'B001',
          title: 'Tracked Coloring Book',
          author: 'Test Author',
          price: 6.99,
          addedAt: 123456,
          history: [
            {
              date: '2026-09-30',
              bsrOverall: 5000,
              price: 6.99,
              reviewCount: 50,
              rating: 4.5,
              categoryRank: { name: 'Coloring', rank: 12 },
            },
          ],
        },
      ];

      const csv = buildWatchlistCsv(watchlist);
      expect(csv).toContain('ASIN,Title,Author,Track Date,BSR Overall');
      expect(csv).toContain('B001');
      expect(csv).toContain('Tracked Coloring Book');
      expect(csv).toContain('2026-09-30,5000,6.99,50,4.5');
    });

    it('builds full research pack combining multiple sections with section headers', () => {
      const snapshot: SearchSnapshot = {
        query: 'dinosaur coloring book',
        date: Date.now(),
        books: [
          {
            asin: 'B999',
            title: 'Dino Fun',
            author: 'Jane Author',
            price: 7.99,
            categoryRanks: [],
          },
        ],
        scores: {
          total: 82,
          demand: 25,
          competitionGap: 18,
          weakCompetitors: 15,
          profit: 14,
          newEntrant: 10,
          label: 'green',
          verdict: 'Excellent niche opportunity',
          booksAnalyzed: 10,
          warnings: [],
          breakdown: {
            demand: { name: 'Demand', points: 25, maxPoints: 30, ratio: 0.83, explanation: 'High' },
            competitionGap: { name: 'Competition Gap', points: 18, maxPoints: 20, ratio: 0.9, explanation: 'Good' },
            weakCompetitors: { name: 'Weak Competitors', points: 15, maxPoints: 20, ratio: 0.75, explanation: 'Present' },
            profit: { name: 'Profit', points: 14, maxPoints: 15, ratio: 0.93, explanation: 'Strong' },
            newEntrant: { name: 'New Entrant', points: 10, maxPoints: 15, ratio: 0.67, explanation: 'Decent' },
          },
        },
      };

      const packCsv = buildFullResearchPackCsv(snapshot, [], []);
      expect(packCsv).toContain('=== KDP NICHE RESEARCH PACK: "DINOSAUR COLORING BOOK" ===');
      expect(packCsv).toContain('Niche Score: 82/100 (GREEN)');
      expect(packCsv).toContain('=== SECTION 1: COMPETITOR BOOKS (1) ===');
      expect(packCsv).toContain('B999');
    });
  });

  describe('JSON Snapshot Backup and Security', () => {
    it('parses valid snapshot JSON and strictly strips sensitive API keys', () => {
      const rawJson = JSON.stringify({
        query: 'mandala coloring',
        date: 123456789,
        books: [{ asin: 'B123', title: 'Mandala Art', categoryRanks: [] }],
        apiKey: 'sensitive-key-12345',
        geminiApiKey: 'AIzaSy-another-secret-67890',
      });

      const parsed = parseImportSnapshotJson(rawJson);
      expect(parsed.query).toBe('mandala coloring');
      expect(parsed.books.length).toBe(1);
      expect((parsed as any).apiKey).toBeUndefined();
      expect((parsed as any).geminiApiKey).toBeUndefined();
    });

    it('throws handled error for malformed or incomplete snapshot JSON', () => {
      expect(() => parseImportSnapshotJson('not a json')).toThrow();
      expect(() => parseImportSnapshotJson('{"invalid": true}')).toThrow(
        'Invalid KDP snapshot JSON: missing query or books array.'
      );
    });
  });
});
