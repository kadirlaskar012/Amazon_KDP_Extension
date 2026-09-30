import { BEST_SELLERS_SELECTORS } from '../config';

export interface BestSellerCategoryData {
  categoryName: string;
  topBsr?: number;
  rank20Bsr?: number;
  difficultyLabel: 'easy' | 'medium' | 'hard';
}

/**
 * Parses Amazon Best Sellers category page for Top 100 and Top 20 BSR benchmarks (Module F)
 */
export function parseBestSellersPage(doc: Document = document): BestSellerCategoryData {
  let categoryName = 'Unknown Category';
  for (const selector of BEST_SELLERS_SELECTORS.categoryTitle) {
    const el = doc.querySelector(selector);
    if (el && el.textContent) {
      categoryName = el.textContent.trim().replace(/^Best Sellers in\s+/i, '');
      break;
    }
  }

  // Difficulty will be computed in Phase 3 when checking #1 and #20 books
  return {
    categoryName,
    difficultyLabel: 'medium',
  };
}
