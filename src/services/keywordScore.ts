// src/services/keywordScore.ts
// Keyword scoring calculation and 7 backend keyword slot generator

import type { KeywordItem, KeywordWeights } from '../types';
import { DEFAULT_KEYWORD_WEIGHTS } from '../config/defaults';

/**
 * Calculates position score:
 * Position 0 = 100, decreasing linearly to 20 at position 9 and beyond.
 * Formula: 100 - position * (80 / 9)
 */
export function calculatePositionScore(position: number): number {
  if (position <= 0) return 100;
  if (position >= 9) return 20;
  return Math.round(100 - position * (80 / 9));
}

/**
 * Calculates frequency score:
 * (number of top-10 titles containing keyword / totalTitles) * 100
 */
export function calculateFrequencyScore(inTitlesCount: number, totalTitles: number = 10): number {
  if (totalTitles <= 0) return 0;
  const clamped = Math.max(0, Math.min(inTitlesCount, totalTitles));
  return Math.round((clamped / totalTitles) * 100);
}

/**
 * Calculates BSR score based on average BSR of top 5 results for that keyword:
 * BSR < 5,000 -> 100
 * BSR < 20,000 -> 75
 * BSR < 100,000 -> 50
 * otherwise -> 20
 */
export function calculateBsrScore(avgBsr: number | null | undefined): number | null {
  if (avgBsr === null || avgBsr === undefined || avgBsr <= 0) {
    return null;
  }
  if (avgBsr < 5000) return 100;
  if (avgBsr < 20000) return 75;
  if (avgBsr < 100000) return 50;
  return 20;
}

/**
 * Computes full keyword score and label.
 * If bsrScore is missing/null, redistributes its weight proportionally to the other two
 * and marks isPartial = true.
 */
export function scoreKeyword(
  keyword: string,
  bestPosition: number,
  inTitlesCount: number,
  avgBsr?: number | null,
  weights: KeywordWeights = DEFAULT_KEYWORD_WEIGHTS,
  totalTitles: number = 10
): KeywordItem {
  const posScore = calculatePositionScore(bestPosition);
  const freqScore = calculateFrequencyScore(inTitlesCount, totalTitles);
  const bsrScore = calculateBsrScore(avgBsr);

  let totalScore: number;
  let isPartial = false;

  if (bsrScore !== null && bsrScore !== undefined) {
    const sumWeights = weights.autocompletePosition + weights.titleFrequency + weights.topResultBsr;
    totalScore =
      sumWeights > 0
        ? Math.round(
            (posScore * weights.autocompletePosition +
              freqScore * weights.titleFrequency +
              bsrScore * weights.topResultBsr) /
              sumWeights
          )
        : posScore;
    isPartial = false;
  } else {
    // Redistribute missing BSR weight proportionally to position and title frequency
    const nonBsrWeight = weights.autocompletePosition + weights.titleFrequency;
    totalScore =
      nonBsrWeight > 0
        ? Math.round(
            (posScore * weights.autocompletePosition + freqScore * weights.titleFrequency) /
              nonBsrWeight
          )
        : posScore;
    isPartial = true;
  }

  // Determine label: high (>= 70), medium (40-69), low (< 40)
  let scoreLabel: 'high' | 'medium' | 'low';
  if (totalScore >= 70) {
    scoreLabel = 'high';
  } else if (totalScore >= 40) {
    scoreLabel = 'medium';
  } else {
    scoreLabel = 'low';
  }

  return {
    keyword,
    bestPosition,
    inTitlesCount,
    bsrScore,
    avgBsr: avgBsr ?? null,
    totalScore,
    scoreLabel,
    isPartial,
    autocompletePosition: bestPosition,
  };
}

/**
 * Groups top keywords into 7 backend keyword slots for KDP publishing:
 * - Up to 7 lines of up to 50 characters each
 * - No repeated words across lines
 * - Skips words already present in the seed keyword
 */
export function generate7BackendKeywordSlots(
  keywords: KeywordItem[],
  seedKeyword: string = '',
  maxSlots: number = 7,
  maxCharsPerSlot: number = 50
): string[] {
  // Normalize seed words to avoid repeating seed words
  const seedWords = new Set(
    seedKeyword
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0)
  );

  const usedWords = new Set<string>();
  const slots: string[] = [];
  let currentWordsInSlot: string[] = [];

  // Sort keywords by score descending
  const sorted = [...keywords].sort((a, b) => b.totalScore - a.totalScore);

  for (const item of sorted) {
    if (slots.length >= maxSlots) break;

    const words = item.keyword
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0);

    for (const word of words) {
      if (slots.length >= maxSlots) break;
      if (seedWords.has(word) || usedWords.has(word)) continue;

      const prospective = [...currentWordsInSlot, word].join(' ');
      if (prospective.length <= maxCharsPerSlot) {
        currentWordsInSlot.push(word);
        usedWords.add(word);
      } else {
        // Current slot is full, finalize it
        if (currentWordsInSlot.length > 0) {
          slots.push(currentWordsInSlot.join(' '));
          currentWordsInSlot = [];
        }
        // Try starting new slot with this word if under character limit
        if (slots.length < maxSlots && word.length <= maxCharsPerSlot) {
          currentWordsInSlot.push(word);
          usedWords.add(word);
        }
      }
    }
  }

  // Push remaining slot if any
  if (currentWordsInSlot.length > 0 && slots.length < maxSlots) {
    slots.push(currentWordsInSlot.join(' '));
  }

  return slots;
}
