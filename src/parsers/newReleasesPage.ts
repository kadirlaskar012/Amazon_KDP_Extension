// src/parsers/newReleasesPage.ts
// Parser for Amazon New Releases category pages.
// Structure is very similar to Best Sellers pages; we add publish-date extraction.

import type { BestSellerItem } from '../types';
import { BEST_SELLERS_SELECTORS, CAPTCHA_DETECTION } from '../config/selectors';

export interface NewReleaseItem extends BestSellerItem {
  publishDate?: string;  // e.g. "September 15, 2026" or ISO string "2026-09-15"
}

export interface NewReleasesData {
  categoryName: string;
  items: NewReleaseItem[];
  isCaptcha?: boolean;
}

function isCaptchaDoc(doc: Document): boolean {
  const title = (doc.title || '').toLowerCase();
  for (const pt of CAPTCHA_DETECTION.pageTitles) {
    if (title.includes(pt)) return true;
  }
  const forms = doc.querySelectorAll('form');
  for (let i = 0; i < forms.length; i++) {
    if ((forms[i]?.getAttribute('action') || '').includes(CAPTCHA_DETECTION.formAction)) return true;
  }
  if (doc.getElementById(CAPTCHA_DETECTION.captchaInputId)) return true;
  const bodyText = (doc.body?.textContent || '').toLowerCase();
  for (const phrase of CAPTCHA_DETECTION.textPhrases) {
    if (bodyText.includes(phrase)) return true;
  }
  return false;
}

function querySelectorAny(parent: Element | Document, selectors: string[]): Element | null {
  for (const sel of selectors) {
    try {
      const el = parent.querySelector(sel);
      if (el) return el;
    } catch { /* ignore */ }
  }
  return null;
}

function extractAsin(el: Element): string {
  const dataAsin = el.getAttribute('data-asin');
  if (dataAsin && /^[A-Z0-9]{10}$/i.test(dataAsin)) return dataAsin.toUpperCase();
  const anyLink = el.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]');
  if (anyLink) {
    const href = anyLink.getAttribute('href') || '';
    const m = href.match(/\/(?:dp|product)\/([A-Z0-9]{10})/i);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return '';
}

function parsePrice(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const m = text.replace(/,/g, '').match(/\$?(\d+(?:\.\d{1,2})?)/);
  if (!m?.[1]) return undefined;
  const n = parseFloat(m[1]);
  return isNaN(n) ? undefined : n;
}

function parseRating(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:out of|\/|de)/i);
  const val = m?.[1] ?? text.match(/^(\d+(?:\.\d+)?)/)?.[1];
  if (!val) return undefined;
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n;
}

function parseReviewCount(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const m = text.replace(/,/g, '').match(/(\d+)/);
  if (!m?.[1]) return undefined;
  const n = parseInt(m[1], 10);
  return isNaN(n) ? undefined : n;
}

/**
 * Selectors for publish date on New Releases pages.
 * Amazon shows something like "Published: September 15, 2026"
 * or a span with the date near the item card.
 */
const PUBLISH_DATE_SELECTORS = [
  'span.a-color-secondary.a-size-small',
  'span.a-size-small.a-color-secondary',
  'span[class*="date"]',
  'span[class*="publish"]',
];

/** Very light pattern to pull a plausible date from arbitrary text */
function extractPublishDate(node: Element): string | undefined {
  // Try dedicated selectors first
  for (const sel of PUBLISH_DATE_SELECTORS) {
    try {
      const el = node.querySelector(sel);
      if (el?.textContent) {
        const txt = el.textContent.trim();
        // Match patterns like "September 15, 2026" or "2026-09-15" or "Sep 15, 2026"
        const monthYear = txt.match(
          /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/i
        );
        if (monthYear) return monthYear[0];
        const isoDate = txt.match(/\d{4}-\d{2}-\d{2}/);
        if (isoDate) return isoDate[0];
      }
    } catch { /* ignore */ }
  }
  // Fallback: scan entire node text for a date pattern
  const nodeText = node.textContent || '';
  const monthYear = nodeText.match(
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/i
  );
  return monthYear ? monthYear[0] : undefined;
}

/**
 * Parses an Amazon New Releases category page.
 * Accepts HTML string or an already-parsed Document.
 */
export function parseNewReleasesPage(htmlOrDoc: string | Document): NewReleasesData {
  let doc: Document;
  if (typeof htmlOrDoc === 'string') {
    const parser = new DOMParser();
    doc = parser.parseFromString(htmlOrDoc, 'text/html');
  } else {
    doc = htmlOrDoc;
  }

  if (isCaptchaDoc(doc)) {
    return { categoryName: 'Verification Required', items: [], isCaptcha: true };
  }

  const titleEl = querySelectorAny(doc, BEST_SELLERS_SELECTORS.categoryTitle);
  const categoryName = titleEl?.textContent?.replace(/\s+/g, ' ').trim() || 'New Releases';

  let itemNodes: Element[] = [];
  for (const sel of BEST_SELLERS_SELECTORS.items) {
    const nodes = doc.querySelectorAll(sel);
    if (nodes.length > 0) { itemNodes = Array.from(nodes); break; }
  }

  const items: NewReleaseItem[] = [];
  let itemIndex = 0;

  for (const node of itemNodes) {
    if (items.length >= 20) break;

    const asin = extractAsin(node);
    if (!asin) continue;
    itemIndex++;

    const rankEl = querySelectorAny(node, BEST_SELLERS_SELECTORS.rankBadge);
    let rank = itemIndex;
    if (rankEl?.textContent) {
      const r = parseInt(rankEl.textContent.replace(/[^\d]/g, ''), 10);
      if (!isNaN(r) && r > 0) rank = r;
    }

    const titleNode = querySelectorAny(node, BEST_SELLERS_SELECTORS.title)
      || node.querySelector('a[href*="/dp/"], a[href*="/gp/product/"], a.a-link-normal');
    const title = titleNode?.textContent?.replace(/\s+/g, ' ').trim() || `Book #${rank}`;

    const priceEl = querySelectorAny(node, BEST_SELLERS_SELECTORS.price);
    const price = parsePrice(priceEl?.textContent);

    const ratingEl = querySelectorAny(node, BEST_SELLERS_SELECTORS.rating)
      || node.querySelector('.a-icon-alt, [class*="star"]');
    const rating = parseRating(
      ratingEl?.getAttribute('aria-label') || ratingEl?.getAttribute('title') || ratingEl?.textContent
    );

    const reviewEl = querySelectorAny(node, BEST_SELLERS_SELECTORS.reviewCount);
    const reviewCount = parseReviewCount(reviewEl?.textContent);

    const linkEl = querySelectorAny(node, BEST_SELLERS_SELECTORS.asinLink);
    const linkHref = linkEl?.getAttribute('href');
    const productUrl = linkHref
      ? (linkHref.startsWith('http') ? linkHref : `https://www.amazon.com${linkHref}`)
      : `https://www.amazon.com/dp/${asin}`;

    const publishDate = extractPublishDate(node);

    items.push({ rank, asin, title, price, rating, reviewCount, productUrl, publishDate });
  }

  return { categoryName, items, isCaptcha: false };
}
