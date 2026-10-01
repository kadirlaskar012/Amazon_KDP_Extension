// src/parsers/moversShakersPage.ts
// Parser for Amazon Movers & Shakers category pages.
// Amazon's M&S pages share most structure with Best Sellers pages, but also
// show a rank-change percentage ("Up X%" or "Down X%" relative to 24h ago).
// We reuse BEST_SELLERS_SELECTORS for item/title/ASIN extraction,
// and add dedicated selectors for the rank-change badge.

import type { BestSellerItem } from '../types';
import { BEST_SELLERS_SELECTORS, CAPTCHA_DETECTION } from '../config/selectors';

export interface MoversShakersItem extends BestSellerItem {
  rankChangePercent?: number;   // positive = climbed, negative = fell
  rankChangeText?: string;      // raw text e.g. "Up 1,234%" or "No. 1"
}

export interface MoversShakersData {
  categoryName: string;
  items: MoversShakersItem[];
  isCaptcha?: boolean;
}

/**
 * Checks whether a Document is an Amazon CAPTCHA page.
 */
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
    } catch { /* ignore invalid selectors */ }
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
 * Selectors specific to the rank-change badges on M&S pages.
 * Amazon shows these as green/red percentage badges per item.
 */
const RANK_CHANGE_SELECTORS = [
  'span.zg-bdg-text',           // standard rank badge (also shows change on M&S)
  'span[class*="badge"]',
  'span[class*="rank"]',
  '.zg-percent-change',
  'span.a-text-bold[class*="color-green"]',
  'span.a-text-bold[class*="color-red"]',
  // Fallback: any span containing "%" inside the item card
];

/**
 * Tries to extract a rank-change percentage from text like "Up 1,234%" or "Down 42%".
 * Returns undefined if none found.
 */
function parseRankChangePercent(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const up = text.match(/up\s+([\d,]+)%/i);
  if (up) {
    const n = parseInt(up[1]!.replace(/,/g, ''), 10);
    return isNaN(n) ? undefined : n;
  }
  const down = text.match(/down\s+([\d,]+)%/i);
  if (down) {
    const n = parseInt(down[1]!.replace(/,/g, ''), 10);
    return isNaN(n) ? undefined : -n;
  }
  return undefined;
}

/**
 * Parses an Amazon Movers & Shakers category page.
 * Accepts HTML string or an already-parsed Document.
 */
export function parseMoversShakersPage(htmlOrDoc: string | Document): MoversShakersData {
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

  // Category title — reuse best sellers selector
  const titleEl = querySelectorAny(doc, BEST_SELLERS_SELECTORS.categoryTitle);
  const categoryName = titleEl?.textContent?.replace(/\s+/g, ' ').trim() || 'Movers & Shakers';

  // Items — same grid structure as Best Sellers
  let itemNodes: Element[] = [];
  for (const sel of BEST_SELLERS_SELECTORS.items) {
    const nodes = doc.querySelectorAll(sel);
    if (nodes.length > 0) { itemNodes = Array.from(nodes); break; }
  }

  const items: MoversShakersItem[] = [];
  let itemIndex = 0;

  for (const node of itemNodes) {
    if (items.length >= 20) break; // top 20 per spec

    const asin = extractAsin(node);
    if (!asin) continue;
    itemIndex++;

    // Rank
    const rankEl = querySelectorAny(node, BEST_SELLERS_SELECTORS.rankBadge);
    let rank = itemIndex;
    if (rankEl?.textContent) {
      const r = parseInt(rankEl.textContent.replace(/[^\d]/g, ''), 10);
      if (!isNaN(r) && r > 0) rank = r;
    }

    // Title
    const titleNode = querySelectorAny(node, BEST_SELLERS_SELECTORS.title)
      || node.querySelector('a[href*="/dp/"], a[href*="/gp/product/"], a.a-link-normal');
    const title = titleNode?.textContent?.replace(/\s+/g, ' ').trim() || `Book #${rank}`;

    // Price
    const priceEl = querySelectorAny(node, BEST_SELLERS_SELECTORS.price);
    const price = parsePrice(priceEl?.textContent);

    // Rating
    const ratingEl = querySelectorAny(node, BEST_SELLERS_SELECTORS.rating)
      || node.querySelector('.a-icon-alt, [class*="star"]');
    const rating = parseRating(
      ratingEl?.getAttribute('aria-label') || ratingEl?.getAttribute('title') || ratingEl?.textContent
    );

    // Review count
    const reviewEl = querySelectorAny(node, BEST_SELLERS_SELECTORS.reviewCount);
    const reviewCount = parseReviewCount(reviewEl?.textContent);

    // Product URL
    const linkEl = querySelectorAny(node, BEST_SELLERS_SELECTORS.asinLink);
    const linkHref = linkEl?.getAttribute('href');
    const productUrl = linkHref
      ? (linkHref.startsWith('http') ? linkHref : `https://www.amazon.com${linkHref}`)
      : `https://www.amazon.com/dp/${asin}`;

    // Rank change — scan all text in the node for "Up X%" / "Down X%"
    let rankChangePercent: number | undefined;
    let rankChangeText: string | undefined;
    const nodeText = node.textContent || '';
    const pct = parseRankChangePercent(nodeText);
    if (pct !== undefined) {
      rankChangePercent = pct;
      rankChangeText = pct > 0 ? `Up ${pct}%` : `Down ${Math.abs(pct)}%`;
    } else {
      // Try dedicated badge selectors
      for (const sel of RANK_CHANGE_SELECTORS) {
        try {
          const el = node.querySelector(sel);
          if (el?.textContent) {
            const p = parseRankChangePercent(el.textContent);
            if (p !== undefined) {
              rankChangePercent = p;
              rankChangeText = el.textContent.replace(/\s+/g, ' ').trim();
              break;
            }
          }
        } catch { /* ignore */ }
      }
    }

    items.push({
      rank,
      asin,
      title,
      price,
      rating,
      reviewCount,
      productUrl,
      rankChangePercent,
      rankChangeText,
    });
  }

  return { categoryName, items, isCaptcha: false };
}
