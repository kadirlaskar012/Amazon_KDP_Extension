// tests/seasonality.test.ts
// Unit tests for Seasonality & Holiday Trend Predictor service

import { describe, it, expect } from 'vitest';
import { analyzeSeasonality } from '../src/services/seasonality';
import type { Book, KeywordItem } from '../src/types';

describe('Seasonality & Holiday Trend Predictor', () => {
  it('detects Evergreen niches with high baseline stability and year-round launch advice', () => {
    const report = analyzeSeasonality({
      query: 'toddler coloring book',
      books: [
        {
          asin: 'B01ABC1',
          title: 'My First Toddler Coloring Book',
          author: 'Author Name',
          categoryRanks: [],
          price: 6.99,
          bsrOverall: 12000,
          reviewCount: 45,
          rating: 4.6,
        },
      ],
    });

    expect(report.type).toBe('evergreen');
    expect(report.typeLabel).toContain('Evergreen');
    expect(report.evergreenScore).toBeGreaterThanOrEqual(80);
    expect(report.launchUrgency).toBe('anytime');
    expect(report.monthlyHeatmap).toHaveLength(12);
    expect(report.trendsUrl).toContain('trends.google.com');
  });

  it('detects Christmas & Q4 Holiday Spike niches from query', () => {
    const report = analyzeSeasonality({
      query: 'christmas coloring book for kids',
    });

    expect(report.type).toBe('holiday_spike');
    expect(report.primaryEvent).toContain('Christmas');
    expect(report.peakMonths).toContain('Oct - Dec');
    expect(report.recommendedLaunchWindow).toContain('July - August');
    expect(report.evergreenScore).toBeLessThan(50);
  });

  it('detects Halloween Spike from competitor book titles even if query is short', () => {
    const mockBooks: Book[] = [
      {
        asin: 'B01HAL1',
        title: 'Spooky Halloween Activity Book for Toddlers',
        author: 'Spooky Author',
        categoryRanks: [],
        price: 7.99,
        bsrOverall: 8000,
      },
      {
        asin: 'B01HAL2',
        title: 'Trick or Treat Pumpkin Coloring Pages',
        author: 'Pumpkin Press',
        categoryRanks: [],
        price: 6.99,
        bsrOverall: 9500,
      },
      {
        asin: 'B01HAL3',
        title: 'Cute Witch and Ghost Fun Book',
        author: 'Witchy Media',
        categoryRanks: [],
        price: 8.99,
        bsrOverall: 14000,
      },
    ];

    const report = analyzeSeasonality({
      query: 'spooky fun',
      books: mockBooks,
    });

    expect(report.type).toBe('holiday_spike');
    expect(report.primaryEvent).toContain('Halloween');
    expect(report.peakMonths).toContain('Sep - Oct');
    expect(report.signalsDetected.some((s) => s.toLowerCase().includes('competitor title'))).toBe(true);
  });

  it('detects Back to School & Fall Education seasonal wave', () => {
    const report = analyzeSeasonality({
      query: 'kindergarten workbook handwriting practice',
    });

    expect(report.type).toBe('seasonal_wave');
    expect(report.primaryEvent).toContain('Back to School');
    expect(report.peakMonths).toContain('Jul - Sep');
    expect(report.recommendedLaunchWindow).toContain('May - June');
  });

  it('detects Easter seasonal holiday spike from keywords', () => {
    const mockKeywords: KeywordItem[] = [
      {
        keyword: 'easter basket stuffer coloring',
        bestPosition: 1,
        inTitlesCount: 5,
        totalScore: 92,
        scoreLabel: 'high',
        isPartial: false,
      },
      {
        keyword: 'bunny egg hunt coloring',
        bestPosition: 2,
        inTitlesCount: 4,
        totalScore: 88,
        scoreLabel: 'high',
        isPartial: false,
      },
    ];

    const report = analyzeSeasonality({
      query: 'spring coloring',
      keywords: mockKeywords,
    });

    expect(report.type).toBe('holiday_spike');
    expect(report.primaryEvent).toContain('Easter');
    expect(report.peakMonths).toContain('Mar - Apr');
  });

  it("detects Valentine's Day spike", () => {
    const report = analyzeSeasonality({
      query: 'valentine couple love coupon book',
    });

    expect(report.type).toBe('holiday_spike');
    expect(report.primaryEvent).toContain("Valentine");
    expect(report.peakMonths).toContain('Jan - Feb');
  });

  it('detects Annual Planner & New Year resolution season', () => {
    const report = analyzeSeasonality({
      query: 'daily planner 2026 habit tracker',
    });

    expect(report.type).toBe('annual_event');
    expect(report.primaryEvent).toContain('New Year');
    expect(report.peakMonths).toContain('Nov - Jan');
  });

  it('calculates optimal launch urgency when current month matches runway', () => {
    // Christmas launch window is July (month 6) - August (month 7)
    const julyDate = new Date(2026, 6, 15); // July 15

    const report = analyzeSeasonality({
      query: 'christmas stocking stuffer puzzle book',
      currentDate: julyDate,
    });

    expect(report.launchUrgency).toBe('optimal_now');
    expect(report.urgencyAdvice).toContain('Optimal Launch Window NOW');
  });

  it('flags late urgency when current month is active peak season', () => {
    // Christmas peak is November (month 10) - December (month 11)
    const novemberDate = new Date(2026, 10, 20); // November 20

    const report = analyzeSeasonality({
      query: 'christmas coloring book',
      currentDate: novemberDate,
    });

    expect(report.launchUrgency).toBe('late');
    expect(report.urgencyAdvice).toContain('Active Peak Season In Progress');
  });

  it('generates a valid 12-month demand heatmap with proper month names and intensities', () => {
    const report = analyzeSeasonality({
      query: 'sudoku puzzle book',
    });

    expect(report.monthlyHeatmap).toHaveLength(12);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    report.monthlyHeatmap.forEach((m, idx) => {
      expect(m.month).toBe(months[idx]);
      expect(m.monthIndex).toBe(idx);
      expect(['Low', 'Med', 'High', 'Peak']).toContain(m.intensity);
      expect(m.score).toBeGreaterThanOrEqual(0);
      expect(m.score).toBeLessThanOrEqual(100);
    });
  });
});
