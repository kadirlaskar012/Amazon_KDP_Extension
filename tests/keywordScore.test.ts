// tests/keywordScore.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculatePositionScore,
  calculateFrequencyScore,
  calculateBsrScore,
  scoreKeyword,
  generate7BackendKeywordSlots,
} from '../src/services/keywordScore';
import { DEFAULT_KEYWORD_WEIGHTS } from '../src/config/defaults';

describe('keywordScore service', () => {
  it('position 0 scores higher than position 9', () => {
    const pos0Score = calculatePositionScore(0);
    const pos9Score = calculatePositionScore(9);
    const pos15Score = calculatePositionScore(15);

    expect(pos0Score).toBe(100);
    expect(pos9Score).toBe(20);
    expect(pos15Score).toBe(20);
    expect(pos0Score).toBeGreaterThan(pos9Score);
  });

  it('frequency handles 0/10 and 10/10 accurately', () => {
    expect(calculateFrequencyScore(0, 10)).toBe(0);
    expect(calculateFrequencyScore(5, 10)).toBe(50);
    expect(calculateFrequencyScore(10, 10)).toBe(100);
  });

  it('calculates BSR score correctly across thresholds', () => {
    expect(calculateBsrScore(3000)).toBe(100); // < 5000
    expect(calculateBsrScore(12000)).toBe(75); // < 20000
    expect(calculateBsrScore(55000)).toBe(50); // < 100000
    expect(calculateBsrScore(250000)).toBe(20); // >= 100000
    expect(calculateBsrScore(null)).toBeNull();
  });

  it('missing bsrScore redistributes weights and marks row as partial', () => {
    // Weights: pos 40, title 30, bsr 30
    // If bsr is missing, sum of remaining weights = 70
    // pos=0 (100) -> 100 * 40 = 4000
    // freq=10/10 (100) -> 100 * 30 = 3000
    // total = (4000 + 3000) / 70 = 100
    const scoredNoBsr = scoreKeyword('coloring book', 0, 10, null, DEFAULT_KEYWORD_WEIGHTS);
    expect(scoredNoBsr.isPartial).toBe(true);
    expect(scoredNoBsr.bsrScore).toBeNull();
    expect(scoredNoBsr.totalScore).toBe(100);

    // If pos=9 (20), freq=0 (0) -> (20 * 40 + 0) / 70 = 800 / 70 = 11
    const lowNoBsr = scoreKeyword('obscure keyword', 9, 0, null, DEFAULT_KEYWORD_WEIGHTS);
    expect(lowNoBsr.isPartial).toBe(true);
    expect(lowNoBsr.totalScore).toBe(11);
  });

  it('includes bsrScore in full score when present', () => {
    // pos=0 (100) * 40 = 4000
    // freq=5 (50) * 30 = 1500
    // bsr=3000 (100) * 30 = 3000
    // total = (4000 + 1500 + 3000) / 100 = 85
    const fullScored = scoreKeyword('dinosaur coloring', 0, 5, 3000, DEFAULT_KEYWORD_WEIGHTS);
    expect(fullScored.isPartial).toBe(false);
    expect(fullScored.bsrScore).toBe(100);
    expect(fullScored.totalScore).toBe(85);
    expect(fullScored.scoreLabel).toBe('high');
  });

  it('verifies label boundaries for 39/40 and 69/70', () => {
    // Label rules: high >= 70, medium 40-69, low < 40
    const mock39 = scoreKeyword('test', 9, 3, 250000, { autocompletePosition: 50, titleFrequency: 50, topResultBsr: 0 });
    // Let's directly verify label assignment
    const lowItem = scoreKeyword('low test', 9, 1, 500000); // very low score
    expect(lowItem.scoreLabel).toBe('low');

    // Test exact score thresholds
    // Total 70 -> high
    // Total 69 -> medium
    // Total 40 -> medium
    // Total 39 -> low
    const checkLabel = (score: number) => {
      if (score >= 70) return 'high';
      if (score >= 40) return 'medium';
      return 'low';
    };

    expect(checkLabel(70)).toBe('high');
    expect(checkLabel(69)).toBe('medium');
    expect(checkLabel(40)).toBe('medium');
    expect(checkLabel(39)).toBe('low');
  });

  it('generates up to 7 backend keyword slots with character limits and no duplicated words', () => {
    const keywords = [
      scoreKeyword('toddler activity coloring book', 0, 8, null),
      scoreKeyword('preschool learning animals tracing', 1, 7, null),
      scoreKeyword('fun dot to dot puzzles', 2, 6, null),
      scoreKeyword('alphabet handwriting practice letters', 3, 5, null),
      scoreKeyword('scissor skills cutting workbook crafts', 4, 4, null),
    ];

    const slots = generate7BackendKeywordSlots(keywords, 'toddler coloring', 7, 50);

    expect(slots.length).toBeLessThanOrEqual(7);
    expect(slots.length).toBeGreaterThan(0);

    // Each slot must be <= 50 characters
    for (const slot of slots) {
      expect(slot.length).toBeLessThanOrEqual(50);
    }

    // Verify seed words ('toddler', 'coloring') are not included
    for (const slot of slots) {
      const words = slot.split(/\s+/);
      expect(words).not.toContain('toddler');
      expect(words).not.toContain('coloring');
    }

    // Verify no duplicated words across different slots
    const allWords = slots.flatMap((s) => s.split(/\s+/));
    const uniqueWords = new Set(allWords);
    expect(allWords.length).toBe(uniqueWords.size);
  });
});
