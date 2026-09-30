import type { CategoryRank } from '../types';
import { CAPTCHA_DETECTION } from '../config';

export interface ParsedProductDetails {
  isCaptcha: boolean;
  bsrOverall?: number;
  categoryRanks: CategoryRank[];
  pageCount?: number;
  trimSize?: string;
  publishDate?: string;
  readingAge?: string;
  isLowContent?: boolean;
  topReviewsText?: string[];
}

/**
 * Checks whether the fetched HTML document indicates Amazon CAPTCHA or Robot Check
 */
export function isCaptchaPage(doc: Document | Element | string): boolean {
  if (typeof doc === 'string') {
    const lower = doc.toLowerCase();
    if (lower.includes(CAPTCHA_DETECTION.formAction)) return true;
    if (lower.includes(CAPTCHA_DETECTION.captchaInputId)) return true;
    for (const phrase of CAPTCHA_DETECTION.textPhrases) {
      if (lower.includes(phrase)) return true;
    }
    return false;
  }

  // DOM check
  if (doc.querySelector(`form[action*="${CAPTCHA_DETECTION.formAction}"]`)) return true;
  if (doc.querySelector(`#${CAPTCHA_DETECTION.captchaInputId}`)) return true;

  const title = (doc as Document).title?.toLowerCase() || '';
  for (const pageTitle of CAPTCHA_DETECTION.pageTitles) {
    if (title.includes(pageTitle)) return true;
  }

  const text = doc.textContent?.toLowerCase() || '';
  for (const phrase of CAPTCHA_DETECTION.textPhrases) {
    if (text.includes(phrase)) return true;
  }

  return false;
}

/**
 * Parse Best Sellers Rank from text (e.g. "#12,345 in Books" or "12,345 in Kindle Store")
 */
export function parseBsr(text?: string | null): number | undefined {
  if (!text) return undefined;
  // Match patterns like "#1,234 in Books" or "# 1,234 in Books" or "1,234 in Books"
  const match = text.match(/#?\s*([0-9,]+)\s+in\s+(?:Books|Kindle Store|paid in Kindle Store)/i) ||
                text.match(/Best Sellers Rank:\s*#?\s*([0-9,]+)/i) ||
                text.match(/#\s*([0-9,]+)\s*\(/i);
  if (match && match[1]) {
    const num = parseInt(match[1].replace(/,/g, ''), 10);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

/**
 * Parse page count from strings like "108 pages" or "Paperback: 200 pages"
 */
export function parsePageCount(text?: string | null): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d+)\s*(?:pages|p\.)/i);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

/**
 * Parse dimensions/trim size from strings like "8.5 x 0.28 x 11 inches" or "6 x 9 inches"
 */
export function parseTrimSize(text?: string | null): string | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?(?:\s*x\s*\d+(?:\.\d+)?)?\s*(?:inches|cm|mm))/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return undefined;
}

/**
 * Parse publication date from strings like "October 15, 2023" or "15 Oct 2023"
 */
export function parsePublishDate(text?: string | null): string | undefined {
  if (!text) return undefined;
  // Look for standard date patterns
  const match = text.match(/([A-Za-z]+ \d{1,2},? \d{4}|\d{1,2} [A-Za-z]+ \d{4}|\b\d{4}-\d{2}-\d{2}\b)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return undefined;
}

/**
 * Parse category sub-ranks from a product page
 */
export function parseCategoryRanks(doc: Document | Element): CategoryRank[] {
  const categoryRanks: CategoryRank[] = [];

  // Look for standard Amazon sub-category lists (.zg_hrsr or similar)
  const items = doc.querySelectorAll('.zg_hrsr li, .zg_hrsr_item, #detailBullets_feature_div ul.zg_hrsr li');
  for (const item of Array.from(items)) {
    const text = item.textContent?.trim() || '';
    const match = text.match(/#([0-9,]+)\s+in\s+([^(\n]+)/i);
    if (match && match[1] && match[2]) {
      const rank = parseInt(match[1].replace(/,/g, ''), 10);
      const name = match[2].trim();
      const link = item.querySelector('a')?.getAttribute('href') || undefined;
      if (!isNaN(rank) && name) {
        categoryRanks.push({
          rank,
          name,
          url: link ? (link.startsWith('http') ? link : `https://www.amazon.com${link}`) : undefined,
        });
      }
    }
  }

  // Fallback: If no .zg_hrsr list, search detail bullets for sub-rank lines
  if (categoryRanks.length === 0) {
    const bulletItems = doc.querySelectorAll('#detailBullets_feature_div li, #productDetails_db_sections tr');
    for (const b of Array.from(bulletItems)) {
      const text = b.textContent || '';
      if (text.includes('in ') && text.includes('#')) {
        const matches = text.matchAll(/#([0-9,]+)\s+in\s+([A-Za-z0-9\s&,–—/-]+?)(?=\s*\(|#|$)/gi);
        for (const m of matches) {
          if (m && m[1] && m[2]) {
            const rank = parseInt(m[1].replace(/,/g, ''), 10);
            const name = m[2].trim();
            if (!isNaN(rank) && name && !name.toLowerCase().includes('books') && !name.toLowerCase().includes('kindle store')) {
              categoryRanks.push({ rank, name });
            }
          }
        }
      }
    }
  }

  return categoryRanks.slice(0, 5);
}

/**
 * Parse top reviews (for Module H)
 */
export function parseTopReviewsText(doc: Document | Element): string[] {
  const reviews: string[] = [];
  const reviewCards = doc.querySelectorAll('div[data-hook="review"], div.review');
  for (const card of Array.from(reviewCards)) {
    // Check star rating
    const ratingEl = card.querySelector('i[data-hook*="star-rating"] span.a-icon-alt, span.a-icon-alt');
    const ratingText = ratingEl?.textContent || '';
    const rating = ratingText.match(/(\d+(?:\.\d+)?)/)?.[1];
    const numRating = rating ? parseFloat(rating) : 5;

    // Filter 1 to 3 star reviews for complaints gap analysis
    if (numRating <= 3) {
      const bodyEl = card.querySelector('span[data-hook="review-body"] span, div.review-text-content span, span[data-hook="review-body"]');
      const body = bodyEl?.textContent?.trim();
      if (body) {
        reviews.push(body);
      }
    }
  }
  return reviews;
}

/**
 * Parse complete product details from an HTML document or string
 */
export function parseProductPage(htmlOrDoc: Document | string): ParsedProductDetails {
  let doc: Document;
  if (typeof htmlOrDoc === 'string') {
    if (isCaptchaPage(htmlOrDoc)) {
      return { isCaptcha: true, categoryRanks: [] };
    }
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      doc = parser.parseFromString(htmlOrDoc, 'text/html');
    } else {
      return {
        isCaptcha: false,
        bsrOverall: parseBsr(htmlOrDoc),
        categoryRanks: [],
        pageCount: parsePageCount(htmlOrDoc),
        trimSize: parseTrimSize(htmlOrDoc),
        publishDate: parsePublishDate(htmlOrDoc),
        readingAge: undefined,
        isLowContent: /coloring book|journal|planner|log book|notebook|sketchbook|tracker/i.test(htmlOrDoc),
        topReviewsText: [],
      };
    }
  } else {
    doc = htmlOrDoc;
  }

  if (isCaptchaPage(doc)) {
    return { isCaptcha: true, categoryRanks: [] };
  }

  let bsrOverall: number | undefined;
  let pageCount: number | undefined;
  let trimSize: string | undefined;
  let publishDate: string | undefined;
  let readingAge: string | undefined;

  // 1. Check Bullet layout (#detailBullets_feature_div)
  const bulletItems = doc.querySelectorAll('#detailBullets_feature_div li, #detailBulletsWrapper_feature_div li');
  for (const item of Array.from(bulletItems)) {
    const text = item.textContent || '';
    if (/Best Sellers Rank/i.test(text) && !bsrOverall) {
      bsrOverall = parseBsr(text);
    }
    if (/Print length|Paperback|Hardcover/i.test(text) && !pageCount) {
      pageCount = parsePageCount(text);
    }
    if (/Dimensions/i.test(text) && !trimSize) {
      trimSize = parseTrimSize(text);
    }
    if (/Publication date|Publisher/i.test(text) && !publishDate) {
      publishDate = parsePublishDate(text);
    }
    if (/Reading age/i.test(text) && !readingAge) {
      const match = text.match(/Reading age\s*:\s*([^\n\r]+)/i);
      readingAge = match && match[1] ? match[1].trim() : undefined;
    }
  }

  // 2. Check Table layout (#productDetails_db_sections or #prodDetails)
  if (!bsrOverall || !pageCount || !trimSize || !publishDate) {
    const tableRows = doc.querySelectorAll('#productDetails_db_sections tr, #prodDetails tr, #SalesRank tr');
    for (const row of Array.from(tableRows)) {
      const header = row.querySelector('th')?.textContent || '';
      const cell = row.querySelector('td')?.textContent || '';

      if (/Best Sellers Rank/i.test(header) && !bsrOverall) {
        bsrOverall = parseBsr(cell);
      }
      if (/Print length|Paperback|Hardcover/i.test(header) && !pageCount) {
        pageCount = parsePageCount(cell);
      }
      if (/Dimensions/i.test(header) && !trimSize) {
        trimSize = parseTrimSize(cell);
      }
      if (/Publication date/i.test(header) && !publishDate) {
        publishDate = parsePublishDate(cell);
      }
      if (/Reading age/i.test(header) && !readingAge) {
        readingAge = cell.trim();
      }
    }
  }

  // 3. Check newer RPI carousel pill badges
  if (!pageCount) {
    const pageEl = doc.querySelector('#rpi-attribute-book_details-fiona_pages .rpi-attribute-value');
    if (pageEl) pageCount = parsePageCount(pageEl.textContent);
  }
  if (!trimSize) {
    const dimEl = doc.querySelector('#rpi-attribute-book_details-dimensions .rpi-attribute-value');
    if (dimEl) trimSize = parseTrimSize(dimEl.textContent);
  }
  if (!publishDate) {
    const dateEl = doc.querySelector('#rpi-attribute-book_details-publication_date .rpi-attribute-value');
    if (dateEl) publishDate = parsePublishDate(dateEl.textContent);
  }
  if (!readingAge) {
    const ageEl = doc.querySelector('#rpi-attribute-book_details-reading_age .rpi-attribute-value');
    if (ageEl) readingAge = ageEl.textContent?.trim();
  }

  // 4. Overall BSR fallback search in full page body if still not found
  if (!bsrOverall) {
    const bodyText = doc.body?.textContent || '';
    bsrOverall = parseBsr(bodyText);
  }

  // 5. Category sub-ranks
  const categoryRanks = parseCategoryRanks(doc);

  // 6. Top reviews for review gap
  const topReviewsText = parseTopReviewsText(doc);

  // 7. Low-content book heuristic:
  // Usually Coloring books, Journals, Planners, Log books, Notebooks, or books without ISBN
  const title = doc.querySelector('#productTitle')?.textContent || '';
  const isLowContent = /coloring book|journal|planner|log book|notebook|sketchbook|tracker/i.test(title);

  return {
    isCaptcha: false,
    bsrOverall,
    categoryRanks,
    pageCount,
    trimSize,
    publishDate,
    readingAge,
    isLowContent,
    topReviewsText,
  };
}
