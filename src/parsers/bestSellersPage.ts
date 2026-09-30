// src/parsers/bestSellersPage.ts
// Parser for Amazon Category Best Sellers pages

import type { BestSellerItem, BestSellerCategoryData } from '../types';
import { BEST_SELLERS_SELECTORS, CAPTCHA_DETECTION } from '../config/selectors';

/**
 * Checks if HTML or Document represents an Amazon CAPTCHA / Robot Check page
 */
export function isBestSellersCaptcha(doc: Document): boolean {
  const title = (doc.title || '').toLowerCase();
  for (const pt of CAPTCHA_DETECTION.pageTitles) {
    if (title.includes(pt)) return true;
  }

  const forms = doc.querySelectorAll('form');
  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    if (!form) continue;
    const action = form.getAttribute('action') || '';
    if (action.includes(CAPTCHA_DETECTION.formAction)) return true;
  }

  if (doc.getElementById(CAPTCHA_DETECTION.captchaInputId)) return true;

  const bodyText = (doc.body?.innerText || doc.body?.textContent || '').toLowerCase();
  for (const phrase of CAPTCHA_DETECTION.textPhrases) {
    if (bodyText.includes(phrase)) return true;
  }

  return false;
}

/**
 * Helper to query first matching selector from a list
 */
function querySelectorAny(parent: Element | Document, selectors: string[]): Element | null {
  for (const selector of selectors) {
    try {
      const el = parent.querySelector(selector);
      if (el) return el;
    } catch {
      // ignore invalid selector syntax if any
    }
  }
  return null;
}

/**
 * Parses numeric price from string (e.g. "$12.99" -> 12.99)
 */
function parsePrice(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const match = text.replace(/,/g, '').match(/\$?(\d+(?:\.\d{1,2})?)/);
  if (!match || !match[1]) return undefined;
  const num = parseFloat(match[1]);
  return isNaN(num) ? undefined : num;
}

/**
 * Parses star rating from string (e.g. "4.6 out of 5 stars" -> 4.6)
 */
function parseRating(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:out of|\/|\bde\b)/i);
  if (match && match[1]) {
    const r = parseFloat(match[1]);
    return isNaN(r) ? undefined : r;
  }
  const altMatch = text.match(/^(\d+(?:\.\d+)?)/);
  if (altMatch && altMatch[1]) {
    const r = parseFloat(altMatch[1]);
    return isNaN(r) ? undefined : r;
  }
  return undefined;
}

/**
 * Parses review count from string (e.g. "1,234" -> 1234)
 */
function parseReviewCount(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/,/g, '').match(/(\d+)/);
  if (!cleaned || !cleaned[1]) return undefined;
  const count = parseInt(cleaned[1], 10);
  return isNaN(count) ? undefined : count;
}

/**
 * Extracts ASIN from link href or attribute
 */
function extractAsin(linkHref: string | null | undefined, el: Element): string {
  // Check data-asin attribute first
  const dataAsin = el.getAttribute('data-asin');
  if (dataAsin && /^[A-Z0-9]{10}$/i.test(dataAsin)) {
    return dataAsin.toUpperCase();
  }

  if (linkHref) {
    const dpMatch = linkHref.match(/\/dp\/([A-Z0-9]{10})/i);
    if (dpMatch && dpMatch[1]) return dpMatch[1].toUpperCase();

    const productMatch = linkHref.match(/\/gp\/product\/([A-Z0-9]{10})/i);
    if (productMatch && productMatch[1]) return productMatch[1].toUpperCase();
  }

  // Check any child link
  const anyLink = el.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]');
  if (anyLink) {
    const href = anyLink.getAttribute('href') || '';
    const match = href.match(/\/(?:dp|product)\/([A-Z0-9]{10})/i);
    if (match && match[1]) return match[1].toUpperCase();
  }

  return '';
}

/**
 * Parses a Category Best Sellers page HTML string or Document
 */
export function parseBestSellersPage(htmlOrDoc: string | Document): BestSellerCategoryData & { isCaptcha?: boolean } {
  let doc: Document;
  if (typeof htmlOrDoc === 'string') {
    const parser = new DOMParser();
    doc = parser.parseFromString(htmlOrDoc, 'text/html');
  } else {
    doc = htmlOrDoc;
  }

  if (isBestSellersCaptcha(doc)) {
    return {
      categoryName: 'Verification Required',
      items: [],
      isCaptcha: true,
    };
  }

  // Extract category title
  const titleEl = querySelectorAny(doc, BEST_SELLERS_SELECTORS.categoryTitle);
  const categoryName = titleEl?.textContent?.replace(/\s+/g, ' ').trim() || 'Best Sellers Category';

  // Find items
  let itemNodes: Element[] = [];
  for (const selector of BEST_SELLERS_SELECTORS.items) {
    const nodes = doc.querySelectorAll(selector);
    if (nodes.length > 0) {
      itemNodes = Array.from(nodes);
      break;
    }
  }

  const items: BestSellerItem[] = [];
  let itemIndex = 0;

  for (const node of itemNodes) {
    if (items.length >= 50) break; // up to 50 items

    // Rank
    const rankEl = querySelectorAny(node, BEST_SELLERS_SELECTORS.rankBadge);
    let rank = itemIndex + 1;
    if (rankEl && rankEl.textContent) {
      const parsedRank = parseInt(rankEl.textContent.replace(/[^\d]/g, ''), 10);
      if (!isNaN(parsedRank) && parsedRank > 0) {
        rank = parsedRank;
      }
    }

    // Link & ASIN
    const linkEl = querySelectorAny(node, BEST_SELLERS_SELECTORS.asinLink);
    const linkHref = linkEl?.getAttribute('href') || undefined;
    const asin = extractAsin(linkHref, node);

    // If no ASIN, this node might not be a product item
    if (!asin) {
      continue;
    }

    itemIndex++;

    // Title
    const titleNode = querySelectorAny(node, BEST_SELLERS_SELECTORS.title);
    const title = titleNode?.textContent?.replace(/\s+/g, ' ').trim() || `Book #${rank}`;

    // Price
    const priceEl = querySelectorAny(node, BEST_SELLERS_SELECTORS.price);
    const price = parsePrice(priceEl?.textContent);

    // Rating
    const ratingEl = querySelectorAny(node, BEST_SELLERS_SELECTORS.rating);
    const rating = parseRating(
      ratingEl?.getAttribute('aria-label') || ratingEl?.getAttribute('title') || ratingEl?.textContent
    );

    // Review Count
    const reviewEl = querySelectorAny(node, BEST_SELLERS_SELECTORS.reviewCount);
    const reviewCount = parseReviewCount(reviewEl?.textContent);

    const productUrl = linkHref ? (linkHref.startsWith('http') ? linkHref : `https://www.amazon.com${linkHref}`) : `https://www.amazon.com/dp/${asin}`;

    items.push({
      rank,
      asin,
      title,
      price,
      rating,
      reviewCount,
      productUrl,
    });
  }

  return {
    categoryName,
    items,
    isCaptcha: false,
  };
}
