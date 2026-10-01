// tests/trendsCsv.test.ts
// Unit tests for Google Trends CSV parser

import { describe, it, expect } from 'vitest';
import { parseTrendsCsv, aggregateMonthlyAverages, splitByYear } from '../src/services/trendsCsv';

const WEEKLY_CSV = `Category: All categories

Week,"toddler coloring book: (United States)"
2024-01-07 – 2024-01-13,45
2024-01-14 – 2024-01-20,52
2024-01-21 – 2024-01-27,<1
2024-01-28 – 2024-02-03,60
2024-02-04 – 2024-02-10,55
`;

const MONTHLY_CSV = `Category: All categories

Month,"christmas coloring book: (United States)"
Jan 2023,20
Feb 2023,15
Mar 2023,18
Apr 2023,22
May 2023,25
Jun 2023,30
Jul 2023,40
Aug 2023,60
Sep 2023,75
Oct 2023,90
Nov 2023,100
Dec 2023,95
`;

const BAD_CSV = `some random file
without any proper headers at all
foo,bar
baz
`;

describe('parseTrendsCsv', () => {
  it('parses a valid weekly CSV into a series', () => {
    const result = parseTrendsCsv(WEEKLY_CSV, 'toddler coloring book', 'US');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.series.dates.length).toBeGreaterThanOrEqual(4);
    expect(result.series.values[0]).toBe(45);
    expect(result.series.values[2]).toBe(0); // "<1" maps to 0
    expect(result.series.keyword).toBe('toddler coloring book');
    expect(result.series.geo).toBe('US');
  });

  it('parses a valid monthly CSV', () => {
    const result = parseTrendsCsv(MONTHLY_CSV, 'christmas coloring book', 'US');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.series.dates.length).toBe(12);
    expect(result.series.values[10]).toBe(100); // November
  });

  it('fails gracefully on a bad CSV', () => {
    const result = parseTrendsCsv(BAD_CSV, 'test', 'US');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.length).toBeGreaterThan(10);
  });

  it('handles UTF-8 BOM at start of file', () => {
    const withBom = '\uFEFF' + MONTHLY_CSV;
    const result = parseTrendsCsv(withBom, 'christmas coloring book', 'US');
    expect(result.ok).toBe(true);
  });
});

describe('aggregateMonthlyAverages', () => {
  it('returns 12 values averaging values per calendar month', () => {
    const result = parseTrendsCsv(MONTHLY_CSV, 'christmas coloring book', 'US');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const avgs = aggregateMonthlyAverages(result.series);
    expect(avgs).toHaveLength(12);
    // Jan = 20, Dec = 95
    expect(avgs[0]).toBe(20); // January
    expect(avgs[11]).toBe(95); // December
    expect(avgs[10]).toBe(100); // November (peak)
  });
});

describe('splitByYear', () => {
  it('groups data by year', () => {
    const result = parseTrendsCsv(MONTHLY_CSV, 'christmas', 'US');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byYear = splitByYear(result.series);
    const years = Object.keys(byYear).map(Number);
    expect(years).toContain(2023);
    expect(byYear[2023]).toHaveLength(12);
  });
});
