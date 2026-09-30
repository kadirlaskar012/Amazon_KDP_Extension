// tests/titleAnalysis.test.ts
import { describe, it, expect } from 'vitest';
import { analyzeTitles, containsKeyword, tokenizeText } from '../src/services/titleAnalysis';
import type { Book } from '../src/types';

describe('titleAnalysis service', () => {
  it('correctly tokenizes and handles punctuation and casing', () => {
    const tokens = tokenizeText('Toddler\'s Coloring-Book: 100 Amazing Animals!!');
    expect(tokens).toContain('toddler');
    expect(tokens).toContain('coloring');
    expect(tokens).toContain('animals');
    // Numbers alone and punctuation should be excluded
    expect(tokens).not.toContain('100');
    expect(tokens).not.toContain('!!');
  });

  it('checks keyword containment cleanly with word boundaries', () => {
    expect(containsKeyword('My Great Coloring Book for Kids', 'coloring book')).toBe(true);
    expect(containsKeyword('My Great COLORING Book for Kids', 'coloring')).toBe(true);
    expect(containsKeyword('Discoloration of Teeth Guide', 'color')).toBe(false);
    expect(containsKeyword(undefined, 'coloring')).toBe(false);
    expect(containsKeyword('Book', '')).toBe(false);
  });

  it('removes stopwords and counts unigrams and bigrams correctly', () => {
    const mockBooks: Book[] = [
      {
        asin: 'B01',
        title: 'Toddler Activity Book: Animals and Dinosaurs',
        subtitle: 'Fun Coloring Book for Ages 2-4',
        author: 'Kids Press',
        categoryRanks: [],
      },
      {
        asin: 'B02',
        title: 'Animals Coloring Adventure for Toddlers',
        subtitle: 'Preschool Dinosaurs Activity',
        author: 'Creative Studio',
        categoryRanks: [],
      },
      {
        asin: 'B03',
        title: 'Awesome Dinosaurs: Animals Discovery',
        author: 'Dino Publishing',
        categoryRanks: [],
      },
    ];

    const result = analyzeTitles(mockBooks);

    expect(result.totalTitlesAnalyzed).toBe(3);

    // Common stopwords like "and", "for", "the", and KDP filler like "book", "books", "ages" should be stripped
    const unigramWords = result.unigrams.map((u) => u.word);
    expect(unigramWords).not.toContain('for');
    expect(unigramWords).not.toContain('and');
    expect(unigramWords).not.toContain('book');
    expect(unigramWords).not.toContain('books');

    // "animals" and "dinosaurs" appear in all 3 titles
    const animalsItem = result.unigrams.find((u) => u.word === 'animals');
    expect(animalsItem).toBeDefined();
    expect(animalsItem?.inTitlesCount).toBe(3);
    expect(animalsItem?.percentage).toBe(100);

    const dinosaursItem = result.unigrams.find((u) => u.word === 'dinosaurs');
    expect(dinosaursItem).toBeDefined();
    expect(dinosaursItem?.inTitlesCount).toBe(3);

    // Bigrams: consecutive non-stop words
    // In book 1: "animals dinosaurs"
    // In book 3: "awesome dinosaurs", "dinosaurs animals"
    const bigramWords = result.bigrams.map((b) => b.word);
    expect(bigramWords).toContain('animals dinosaurs');
  });

  it('handles empty books list gracefully', () => {
    const emptyResult = analyzeTitles([]);
    expect(emptyResult.totalTitlesAnalyzed).toBe(0);
    expect(emptyResult.unigrams).toEqual([]);
    expect(emptyResult.bigrams).toEqual([]);
  });
});
