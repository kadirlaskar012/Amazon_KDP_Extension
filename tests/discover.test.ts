// tests/discover.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  titleToKeyword,
  passesQualityFilter,
  selectTop10,
  enrichWithTrendAndStreak,
} from '../src/services/discoverScanner';
import {
  getDayIndex,
  getRotatingSeeds,
  getLetterWindow,
  buildRotatingQueries,
} from '../src/services/discoverRotation';
import { parseNewReleasesPage } from '../src/parsers/newReleasesPage';
import { parseMoversShakersPage } from '../src/parsers/moversShakersPage';
import type { DiscoverIdea, DiscoverHistoryEntry } from '../src/types/discover';

describe('Discover Top 10 Opportunities', () => {
  describe('titleToKeyword helper', () => {
    it('strips common stopwords and limits to 5 words', () => {
      const title = 'The Ultimate Coloring Book for Kids and Toddlers with Fun Animals';
      const kw = titleToKeyword(title);
      expect(kw).toBe('ultimate coloring book kids toddlers');
    });

    it('handles special characters cleanly', () => {
      const title = 'Word-Search Puzzle Book (Vol. 1): 100+ Puzzles!';
      const kw = titleToKeyword(title);
      expect(kw).toBe('word search puzzle book vol');
    });
  });

  describe('discoverRotation deterministic scheduling', () => {
    const testSeeds = ['seed1', 'seed2', 'seed3', 'seed4', 'seed5'];

    it('computes correct dayIndex from timestamp', () => {
      const ms = 1700000000000;
      expect(getDayIndex(ms)).toBe(Math.floor(ms / (1000 * 60 * 60 * 24)));
    });

    it('rotates 3 seeds deterministically per dayIndex', () => {
      const day0 = getRotatingSeeds(0, testSeeds);
      expect(day0).toEqual(['seed1', 'seed2', 'seed3']);

      const day1 = getRotatingSeeds(1, testSeeds);
      expect(day1).toEqual(['seed2', 'seed3', 'seed4']);

      const day4 = getRotatingSeeds(4, testSeeds);
      expect(day4).toEqual(['seed5', 'seed1', 'seed2']);
    });

    it('shifts letter window by 9 characters and wraps correctly', () => {
      const win0 = getLetterWindow(0);
      expect(win0.length).toBe(9);
      expect(win0[0]).toBe('a');
      expect(win0[8]).toBe('i');

      const win1 = getLetterWindow(1);
      expect(win1[0]).toBe('j');
      expect(win1[8]).toBe('r');

      const win4 = getLetterWindow(4); // 4 * 9 = 36 % 36 = 0 -> wraps back to start
      expect(win4).toEqual(win0);
    });

    it('builds full query list for day: 3 seeds * 9 letters = 27 queries', () => {
      const queries = buildRotatingQueries(0, testSeeds);
      expect(queries.length).toBe(27);
      expect(queries[0]).toBe('seed1 a');
      expect(queries[8]).toBe('seed1 i');
      expect(queries[9]).toBe('seed2 a');
    });
  });

  describe('passesQualityFilter', () => {
    const forbidden = ['disney', 'marvel', 'lego'];
    const dismissed = new Set(['bad niche phrase']);

    it('rejects dismissed phrases', () => {
      const idea: DiscoverIdea = {
        phrase: 'bad niche phrase',
        score: 80,
        status: 'checked',
        bsrChecked: 5,
        bsrTotal: 10,
        source: 'best-sellers',
        whyInteresting: 'Good stats',
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
      };
      expect(passesQualityFilter(idea, dismissed, forbidden)).toBe(false);
    });

    it('rejects phrases containing forbidden words', () => {
      const idea: DiscoverIdea = {
        phrase: 'disney princess coloring book',
        score: 95,
        status: 'verified',
        bsrChecked: 10,
        bsrTotal: 10,
        source: 'best-sellers',
        whyInteresting: 'High volume',
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
      };
      expect(passesQualityFilter(idea, dismissed, forbidden)).toBe(false);
    });

    it('rejects quick status items without ASIN', () => {
      const idea: DiscoverIdea = {
        phrase: 'quick incomplete idea',
        score: 80,
        status: 'quick',
        bsrChecked: 0,
        bsrTotal: 0,
        source: 'autocomplete',
        whyInteresting: 'Search suggestion',
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
      };
      expect(passesQualityFilter(idea, dismissed, forbidden)).toBe(false);
    });

    it('accepts book ideas with ASIN even if quick status', () => {
      const idea: DiscoverIdea = {
        phrase: 'toddler coloring activity',
        score: 75,
        status: 'quick',
        bsrChecked: 0,
        bsrTotal: 0,
        source: 'new-releases',
        whyInteresting: 'New Release fast mover',
        asin: 'B08NEWREL1',
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
      };
      expect(passesQualityFilter(idea, dismissed, forbidden)).toBe(true);
    });

    it('accepts checked ideas with sufficient BSR checks', () => {
      const idea: DiscoverIdea = {
        phrase: 'sudoku large print for seniors',
        score: 85,
        status: 'checked',
        bsrChecked: 4,
        bsrTotal: 10,
        source: 'best-sellers',
        whyInteresting: 'Low competition',
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
      };
      expect(passesQualityFilter(idea, dismissed, forbidden)).toBe(true);
    });
  });

  describe('selectTop10 ranking and limits', () => {
    it('returns at most 10 items, ranked by statusWeight then score', () => {
      const pool: DiscoverIdea[] = [];
      // Generate 20 ideas with varied scores and statuses
      for (let i = 1; i <= 20; i++) {
        pool.push({
          phrase: `niche opportunity ${i}`,
          score: i * 4,
          status: i > 15 ? 'verified' : 'checked',
          bsrChecked: 5,
          bsrTotal: 10,
          source: 'best-sellers',
          whyInteresting: `Item ${i}`,
          firstSeenAt: Date.now(),
          lastSeenAt: Date.now(),
        });
      }

      const top10 = selectTop10(pool, new Set(), []);
      expect(top10.length).toBe(10);

      // First items should be the 'verified' ones (items 16-20)
      expect(top10[0]!.status).toBe('verified');
      expect(top10[0]!.score).toBe(80); // item 20: 20 * 4 = 80
      expect(top10[1]!.score).toBe(76); // item 19: 19 * 4 = 76

      // Verified items end at index 4 (5 items: 20, 19, 18, 17, 16)
      expect(top10[4]!.status).toBe('verified');
      // Next items are 'checked'
      expect(top10[5]!.status).toBe('checked');
      expect(top10[5]!.score).toBe(60); // item 15: 15 * 4 = 60
    });
  });

  describe('enrichWithTrendAndStreak', () => {
    it('identifies new ideas, rank movements, streaks, and dropped-out items', () => {
      const history: DiscoverHistoryEntry[] = [
        {
          date: '2026-09-30',
          generatedAt: Date.now() - 86400000,
          ideas10: [
            {
              phrase: 'phrase Alpha',
              score: 85,
              status: 'verified',
              bsrChecked: 5,
              bsrTotal: 10,
              source: 'best-sellers',
              whyInteresting: '',
              firstSeenAt: 0,
              lastSeenAt: 0,
            },
            {
              phrase: 'phrase Beta',
              score: 80,
              status: 'verified',
              bsrChecked: 5,
              bsrTotal: 10,
              source: 'best-sellers',
              whyInteresting: '',
              firstSeenAt: 0,
              lastSeenAt: 0,
            },
            {
              phrase: 'phrase Dropped',
              score: 75,
              status: 'checked',
              bsrChecked: 5,
              bsrTotal: 10,
              source: 'best-sellers',
              whyInteresting: '',
              firstSeenAt: 0,
              lastSeenAt: 0,
            },
          ],
        },
      ];

      // Today's top 10 has Beta at #1 (moved up), Alpha at #2 (moved down), and Gamma (brand new)
      const todayIdeas: DiscoverIdea[] = [
        {
          phrase: 'phrase Beta',
          score: 90,
          status: 'verified',
          bsrChecked: 5,
          bsrTotal: 10,
          source: 'best-sellers',
          whyInteresting: '',
          firstSeenAt: 0,
          lastSeenAt: 0,
        },
        {
          phrase: 'phrase Alpha',
          score: 85,
          status: 'verified',
          bsrChecked: 5,
          bsrTotal: 10,
          source: 'best-sellers',
          whyInteresting: '',
          firstSeenAt: 0,
          lastSeenAt: 0,
        },
        {
          phrase: 'phrase Gamma',
          score: 82,
          status: 'verified',
          bsrChecked: 5,
          bsrTotal: 10,
          source: 'best-sellers',
          whyInteresting: '',
          firstSeenAt: 0,
          lastSeenAt: 0,
        },
      ];

      const { enriched, droppedOut } = enrichWithTrendAndStreak(todayIdeas, history);

      // Beta was #2 yesterday, is #1 today -> up
      expect(enriched[0]!.phrase).toBe('phrase Beta');
      expect(enriched[0]!.trend).toBe('Up 1');
      expect(enriched[0]!.isNewToday).toBe(false);

      // Alpha was #1 yesterday, is #2 today -> down
      expect(enriched[1]!.phrase).toBe('phrase Alpha');
      expect(enriched[1]!.trend).toBe('Down 1');

      // Gamma was not in yesterday's top 10 -> new
      expect(enriched[2]!.phrase).toBe('phrase Gamma');
      expect(enriched[2]!.trend).toBe('New today');
      expect(enriched[2]!.isNewToday).toBe(true);

      // phrase Dropped was in yesterday's top 10 but not today's
      expect(droppedOut.length).toBe(1);
      expect(droppedOut[0]!.phrase).toBe('phrase Dropped');
    });
  });

  describe('New Releases and Movers & Shakers parsers', () => {
    it('detects CAPTCHA correctly on new releases page', () => {
      const captchaHtml = `<html><head><title>Robot Check</title></head><body><form action="/validateCaptcha"></form></body></html>`;
      const res = parseNewReleasesPage(captchaHtml);
      expect(res.isCaptcha).toBe(true);
      expect(res.items).toEqual([]);
    });

    it('parses new releases items with title, asin, and price', () => {
      const html = `
        <html>
          <body>
            <span class="zg-banner">Hot New Releases in Books</span>
            <div data-asin="B09TEST001" class="zg-grid-general-faceout">
              <a href="/dp/B09TEST001">Autumn Fall Coloring Book</a>
              <span class="a-price"><span class="a-offscreen">$7.99</span></span>
              <span class="a-icon-alt">4.8 out of 5 stars</span>
              <span class="a-size-small">52</span>
            </div>
          </body>
        </html>
      `;
      const res = parseNewReleasesPage(html);
      expect(res.isCaptcha).toBe(false);
      expect(res.items.length).toBe(1);
      expect(res.items[0]!.asin).toBe('B09TEST001');
      expect(res.items[0]!.title).toContain('Autumn Fall Coloring Book');
      expect(res.items[0]!.price).toBe(7.99);
      expect(res.items[0]!.rating).toBe(4.8);
      expect(res.items[0]!.reviewCount).toBe(52);
    });

    it('parses movers and shakers items with rank change', () => {
      const html = `
        <html>
          <body>
            <div data-asin="B09MOVER01" class="zg-grid-general-faceout">
              <a href="/dp/B09MOVER01">Daily Habit Tracker Journal</a>
              <span class="zg-percent-change">Up 1,450%</span>
              <span class="a-price"><span class="a-offscreen">$8.50</span></span>
            </div>
          </body>
        </html>
      `;
      const res = parseMoversShakersPage(html);
      expect(res.isCaptcha).toBe(false);
      expect(res.items.length).toBe(1);
      expect(res.items[0]!.asin).toBe('B09MOVER01');
      expect(res.items[0]!.title).toContain('Daily Habit Tracker Journal');
      expect(res.items[0]!.rankChangePercent).toBe(1450);
    });
  });
});
