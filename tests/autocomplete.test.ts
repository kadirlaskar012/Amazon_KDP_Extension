// tests/autocomplete.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseAutocompleteResponse,
  mergeSuggestions,
  buildAmazonAutocompleteUrl,
  fetchAutocompleteKeywords,
} from '../src/services/autocomplete';

describe('autocomplete service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds valid Amazon Books suggestion URL', () => {
    const url = buildAmazonAutocompleteUrl('toddler coloring');
    expect(url).toContain('https://completion.amazon.com/api/2017/suggestions');
    expect(url).toContain('alias=stripbooks');
    expect(url).toContain('prefix=toddler%20coloring');
    expect(url).toContain('mid=ATVPDKIKX0DER');
  });

  it('parses saved sample suggestion JSON response', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/autocomplete_response.json');
    const json = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

    const suggestions = parseAutocompleteResponse(json);

    expect(suggestions.length).toBe(5);
    expect(suggestions).toContain('toddler coloring book');
    expect(suggestions).toContain('toddler coloring books ages 1-3');
    expect(suggestions).toContain('toddler coloring book animals');
  });

  it('parses legacy array format suggestions', () => {
    const legacy = ['toddler', ['toddler coloring book', 'toddler bed', 'toddler toys']];
    const suggestions = parseAutocompleteResponse(legacy);
    expect(suggestions).toEqual(['toddler coloring book', 'toddler bed', 'toddler toys']);
  });

  it('deduplicates and preserves best position when merging suggestions', () => {
    const map = new Map<string, { keyword: string; bestPosition: number }>();

    // Batch 1: "toddler coloring book" at position 2
    mergeSuggestions(map, ['toddler bed', 'toddler shoes', 'toddler coloring book']);
    expect(map.get('toddler coloring book')?.bestPosition).toBe(2);

    // Batch 2: "toddler coloring book" appears again at position 0
    mergeSuggestions(map, ['toddler coloring book', 'toddler coloring pages']);
    expect(map.get('toddler coloring book')?.bestPosition).toBe(0); // lowest/best index kept

    // Batch 3: "toddler coloring book" appears at position 5
    mergeSuggestions(map, ['a', 'b', 'c', 'd', 'e', 'toddler coloring book']);
    expect(map.get('toddler coloring book')?.bestPosition).toBe(0); // still 0
  });

  it('fetches autocomplete keywords with mocked network and handles responses', async () => {
    // Mock global fetch to return sample response
    const mockResponse = {
      suggestions: [
        { value: 'toddler coloring book' },
        { value: 'toddler coloring animal' },
      ],
    };

    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const abortController = new AbortController();
    // Abort after first prefix call to keep test fast and verify graceful completion
    setTimeout(() => abortController.abort(), 100);

    const results = await fetchAutocompleteKeywords('toddler coloring', {
      signal: abortController.signal,
    });

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0 && results[0]) {
      expect(results[0].keyword).toBe('toddler coloring book');
      expect(results[0].bestPosition).toBe(0);
      expect(results[0].isPartial).toBe(true);
    }
  });
});
