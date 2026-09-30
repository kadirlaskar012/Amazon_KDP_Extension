// src/parsers/reviewsParser.ts
// Parses visible top reviews from Amazon product page HTML without login

import type { ReviewItem, ParsedReviewsResult } from '../types';
import { PRODUCT_PAGE_SELECTORS } from '../config/selectors';

/**
 * Helper to query first matching element from a selector list
 */
function querySelectorAny(parent: Element | Document, selectors: string[]): Element | null {
  for (const selector of selectors) {
    try {
      const el = parent.querySelector(selector);
      if (el) return el;
    } catch {
      // ignore selector errors
    }
  }
  return null;
}

/**
 * Clean and parse star rating (e.g. "2.0 out of 5 stars" -> 2)
 */
function parseRating(text?: string | null): number {
  if (!text) return 5;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:out of|\/|de)\s*5/i) || text.match(/(\d+(?:\.\d+)?)/);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    return isNaN(val) ? 5 : val;
  }
  return 5;
}

/**
 * Clean and parse helpful vote statement
 * e.g. "14 people found this helpful" -> 14
 *      "One person found this helpful" -> 1
 */
function parseHelpfulVotes(text?: string | null): number | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes('one person found this helpful')) {
    return 1;
  }
  const match = text.replace(/,/g, '').match(/(\d+)\s*(?:people|person)/i);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

/**
 * Parses visible customer reviews from product page HTML or Document.
 * Never attempts login or bypasses walls. If login is required, returns reviewsRequireLogin = true.
 */
export function parseProductReviews(
  htmlOrDoc: string | Document,
  asin?: string
): ParsedReviewsResult {
  let doc: Document;
  if (typeof htmlOrDoc === 'string') {
    const parser = new DOMParser();
    doc = parser.parseFromString(htmlOrDoc, 'text/html');
  } else {
    doc = htmlOrDoc;
  }

  // Find all review card elements
  let reviewCards: Element[] = [];
  for (const selector of PRODUCT_PAGE_SELECTORS.reviewItems) {
    const found = doc.querySelectorAll(selector);
    if (found.length > 0) {
      reviewCards = Array.from(found);
      break;
    }
  }

  // Check login wall indicators if no reviews are found
  if (reviewCards.length === 0) {
    let requiresLogin = false;
    for (const selector of PRODUCT_PAGE_SELECTORS.loginPrompt) {
      try {
        if (doc.querySelector(selector)) {
          requiresLogin = true;
          break;
        }
      } catch {
        // ignore
      }
    }

    const bodyText = (doc.body?.innerText || doc.body?.textContent || '').toLowerCase();
    if (
      bodyText.includes('sign in to see reviews') ||
      bodyText.includes('sign in to review') ||
      bodyText.includes('customer reviews are not visible')
    ) {
      requiresLogin = true;
    }

    return {
      reviews: [],
      reviewsRequireLogin: requiresLogin,
    };
  }

  const reviews: ReviewItem[] = [];

  for (const card of reviewCards) {
    // 1. Rating
    const ratingEl = querySelectorAny(card, PRODUCT_PAGE_SELECTORS.reviewRating);
    const rating = parseRating(ratingEl?.textContent || ratingEl?.getAttribute('aria-label'));

    // 2. Title
    const titleEl = querySelectorAny(card, PRODUCT_PAGE_SELECTORS.reviewTitle);
    const title = titleEl?.textContent?.replace(/\s+/g, ' ').trim() || '';

    // 3. Body text
    const textEl = querySelectorAny(card, PRODUCT_PAGE_SELECTORS.reviewText);
    const body = textEl?.textContent?.replace(/\s+/g, ' ').trim() || '';

    // If there is neither title nor body, skip this card
    if (!title && !body) {
      continue;
    }

    // 4. Date
    const dateEl = querySelectorAny(card, PRODUCT_PAGE_SELECTORS.reviewDate);
    const date = dateEl?.textContent?.replace(/\s+/g, ' ').trim() || undefined;

    // 5. Helpful votes
    const helpfulEl = querySelectorAny(card, PRODUCT_PAGE_SELECTORS.reviewHelpful);
    const helpfulVotes = parseHelpfulVotes(helpfulEl?.textContent);

    const id = card.getAttribute('id') || undefined;

    reviews.push({
      id,
      asin,
      rating,
      title,
      body,
      date,
      helpfulVotes,
    });
  }

  return {
    reviews,
    reviewsRequireLogin: false,
  };
}
