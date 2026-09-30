import { describe, it, expect } from 'vitest';
import { buildTrendsUrl, buildCompareUrl } from '../src/services/trends';

describe('Google Trends URL Builder (Module K)', () => {
  it('builds standard exploration URL for a single keyword with default US geo', () => {
    const url = buildTrendsUrl('toddler coloring book');
    expect(url).toContain('https://trends.google.com/trends/explore');
    expect(url).toContain('geo=US');
    expect(url).toContain('q=toddler+coloring+book');
  });

  it('correctly handles spaces and special characters with URL encoding', () => {
    const url = buildTrendsUrl('kids 8.5x11 & animals/activity');
    expect(url).toContain('https://trends.google.com/trends/explore');
    expect(url).toContain('q=kids+8.5x11+%26+animals%2Factivity');
  });

  it('supports custom geo parameters including UK mapping to GB and worldwide', () => {
    const ukUrl = buildTrendsUrl('sudoku puzzle', 'UK');
    expect(ukUrl).toContain('geo=GB');

    const caUrl = buildTrendsUrl('sudoku puzzle', 'CA');
    expect(caUrl).toContain('geo=CA');

    const worldwideUrl = buildTrendsUrl('sudoku puzzle', 'worldwide');
    expect(worldwideUrl).not.toContain('geo=');
    expect(worldwideUrl).toContain('q=sudoku+puzzle');

    const globalUrl = buildTrendsUrl('sudoku puzzle', 'GLOBAL');
    expect(globalUrl).not.toContain('geo=');
  });

  it('builds comparison URL with comma-separated query terms', () => {
    const compare = buildCompareUrl(['coloring book', 'activity book', 'word search'], 'US');
    expect(compare).toContain('https://trends.google.com/trends/explore');
    expect(compare).toContain('geo=US&');
    expect(compare).toContain('q=coloring%20book,activity%20book,word%20search');
  });

  it('limits compare URL to a maximum of 5 keywords', () => {
    const keywords = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];
    const compare = buildCompareUrl(keywords, 'US');
    const qPart = compare.split('q=')[1] || '';
    const terms = qPart.split(',');
    expect(terms.length).toBe(5);
    expect(terms).toEqual(['one', 'two', 'three', 'four', 'five']);
  });

  it('handles empty inputs gracefully', () => {
    expect(buildTrendsUrl('')).toBe('https://trends.google.com/trends/explore');
    expect(buildTrendsUrl('   ')).toBe('https://trends.google.com/trends/explore');
    expect(buildCompareUrl([])).toBe('https://trends.google.com/trends/explore');
    expect(buildCompareUrl(['  ', ''])).toBe('https://trends.google.com/trends/explore');
  });
});
