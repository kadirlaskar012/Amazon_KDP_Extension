// src/services/ideaScoring.ts
// Local validation and sanity checks for AI-generated KDP book ideas

import type { BookIdea } from '../types';
import { checkForbiddenWords, DEFAULT_FORBIDDEN_WORDS } from '../config/forbiddenWords';

/**
 * Counts words in a string
 */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Validates a single BookIdea against KDP publishing guidelines and best practices.
 * Returns an array of warning strings.
 */
export function scoreAndValidateIdea(
  idea: BookIdea,
  allIdeas: BookIdea[] = [],
  customForbiddenWords?: string[]
): string[] {
  const warnings: string[] = [];

  // 1. Forbidden words in title / subtitle
  const fullTitle = `${idea.title} ${idea.subtitle || ''}`.trim();
  const forbidden = checkForbiddenWords(fullTitle, customForbiddenWords || DEFAULT_FORBIDDEN_WORDS);
  if (forbidden.length > 0) {
    warnings.push(`Contains forbidden/trademarked words: "${forbidden.join('", "')}"`);
  }

  // 2. Title + subtitle total character count (< 200 chars)
  const fullTitleText = idea.subtitle ? `${idea.title}: ${idea.subtitle}` : idea.title;
  if (fullTitleText.length > 200) {
    warnings.push(`Combined title length exceeds 200 characters (${fullTitleText.length}/200)`);
  }

  // 3. Exactly 7 backend keywords check
  const kwList = Array.isArray(idea.sevenBackendKeywords) ? idea.sevenBackendKeywords : [];
  if (kwList.length !== 7) {
    warnings.push(`KDP backend keywords: found ${kwList.length} slots instead of exactly 7`);
  }

  // Check 50-character limit per keyword slot
  const overLengthKeywords = kwList.filter((k) => k.length > 50);
  if (overLengthKeywords.length > 0) {
    warnings.push(`${overLengthKeywords.length} keyword slot(s) exceed the 50-character limit`);
  }

  // Check repeating words from title inside backend keywords
  const titleWords = new Set(
    idea.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  let repeatsTitleWord = false;
  for (const kw of kwList) {
    const kwWords = kw.toLowerCase().split(/\s+/);
    for (const w of kwWords) {
      if (titleWords.has(w)) {
        repeatsTitleWord = true;
        break;
      }
    }
    if (repeatsTitleWord) break;
  }
  if (repeatsTitleWord) {
    warnings.push('Backend keywords repeat words already in the title (waste of slot space)');
  }

  // 4. Description word count check (target 150 - 200 words)
  const descWordCount = countWords(idea.shortDescription);
  if (descWordCount < 150) {
    warnings.push(`Description is shorter than recommended (${descWordCount}/150 words)`);
  } else if (descWordCount > 200) {
    warnings.push(`Description is longer than recommended (${descWordCount}/200 words)`);
  }

  // 5. Category count check (recommend 3 category paths)
  const cats = Array.isArray(idea.threeCategories) ? idea.threeCategories : [];
  if (cats.length !== 3) {
    warnings.push(`Category paths: found ${cats.length} instead of 3`);
  }

  // 6. Duplicate check against other ideas in the same batch
  if (allIdeas.length > 1) {
    const thisTitleLower = idea.title.toLowerCase().trim();
    const duplicates = allIdeas.filter(
      (other) => other !== idea && other.title.toLowerCase().trim() === thisTitleLower
    );
    if (duplicates.length > 0) {
      warnings.push('Duplicate or highly identical title found in this idea batch');
    }
  }

  return warnings;
}

/**
 * Runs validation across all ideas in a batch and attaches warnings
 */
export function validateBatchIdeas(
  ideas: BookIdea[],
  customForbiddenWords?: string[]
): BookIdea[] {
  return ideas.map((idea) => {
    const warnings = scoreAndValidateIdea(idea, ideas, customForbiddenWords);
    return {
      ...idea,
      warnings,
    };
  });
}
