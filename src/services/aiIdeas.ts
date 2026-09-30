import type { SearchSnapshot } from '../types';

export interface BookIdea {
  title: string;
  subtitle: string;
  sevenBackendKeywords: string[];
  threeCategories: string[];
  shortDescription: string;
  pageCountSuggestion: number;
  trimSizeSuggestion: string;
  differentiationAngle: string;
  estimatedDifficulty: number;
}

/**
 * AI Book Idea Generator stub (Module J)
 */
export async function generateBookIdeasWithClaude(
  _snapshot: SearchSnapshot,
  _apiKey: string,
  _model: string = 'claude-sonnet-5-5'
): Promise<BookIdea[]> {
  // Activated in Phase 5
  return [];
}
