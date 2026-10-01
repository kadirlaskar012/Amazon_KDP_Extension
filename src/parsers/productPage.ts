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
 * Parse reading age from text or HTML
 */
export function parseReadingAge(text?: string | null): string | undefined {
  if (!text) return undefined;
  const match = text.match(/Reading age\s*[:\-]\s*([^\n\r<]+)/i) ||
                text.match(/rpi-attribute-book_details-reading_age[\s\S]*?<span[^>]*class="[^"]*rpi-attribute-value[^"]*"[^>]*>([^<]+)<\/span>/i);
  if (match && match[1]) {
    const clean = match[1].replace(/<[^>]+>/g, '').trim();
    return clean || undefined;
  }
  return undefined;
}

/**
 * Parse category sub-ranks directly from HTML string using regex
 * Essential for Chrome Manifest V3 Service Worker where DOMParser is undefined!
 */
export function parseCategoryRanksFromString(html: string): CategoryRank[] {
  const categoryRanks: CategoryRank[] = [];
  const seen = new Set<string>();

  const addCategory = (rank: number, rawName: string, url?: string) => {
    let clean = rawName
      .replace(/^in\s+/i, '')
      .replace(/\(see top 100.*\)/i, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/[\n\r\t]+/g, ' ')
      .trim();
    clean = clean.replace(/\s*in\s+books\s*$/i, '').trim();
    if (!clean || isNaN(rank) || rank <= 0) return;
    const lower = clean.toLowerCase();
    if (lower === 'books' || lower === 'kindle store' || lower === 'paid in kindle store') return;
    if (seen.has(lower)) return;
    seen.add(lower);

    let fullUrl = url;
    if (fullUrl && !fullUrl.startsWith('http')) {
      fullUrl = `https://www.amazon.com${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
    }

    categoryRanks.push({
      rank,
      name: clean,
      url: fullUrl,
    });
  };

  // 1. zg_hrsr list items (Standard Amazon bestseller list in bullets)
  // e.g. <li class="zg_hrsr_item"><span class="zg_hrsr_rank">#14</span><span class="zg_hrsr_ladder">in <a href="...">Category</a></span></li>
  const zgRegex = /<li[^>]*class="[^"]*zg_hrsr[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let zgMatch: RegExpExecArray | null;
  while ((zgMatch = zgRegex.exec(html)) !== null) {
    const itemContent = zgMatch[1] || '';
    const rankMatch = itemContent.match(/#\s*([0-9,]+)/i);
    const linkMatch = itemContent.match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
    if (rankMatch && rankMatch[1]) {
      const rank = parseInt(rankMatch[1].replace(/,/g, ''), 10);
      if (linkMatch && linkMatch[2]) {
        addCategory(rank, linkMatch[2], linkMatch[1]);
      } else {
        const textMatch = itemContent.match(/in\s+([^<(\n]+)/i);
        if (textMatch && textMatch[1]) {
          addCategory(rank, textMatch[1]);
        }
      }
    }
  }

  // 2. Direct BestSellers links in product details or table rows:
  // e.g. #3 in <a href="/gp/bestsellers/books/...">Children's Activity Books</a>
  const linkRegex = /#\s*([0-9,]+)\s*(?:in|\s)\s*<a[^>]*href="([^"]*(?:bestsellers|Best-Sellers|zgbs)[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    if (linkMatch[1] && linkMatch[3]) {
      const rank = parseInt(linkMatch[1].replace(/,/g, ''), 10);
      addCategory(rank, linkMatch[3], linkMatch[2]);
    }
  }

  // 3. Reversed or adjacent best seller links:
  // <a href="...bestsellers...">Category</a> (#12 in ...)
  const revRegex = /<a[^>]*href="([^"]*(?:bestsellers|Best-Sellers|zgbs)[^"]*)"[^>]*>([^<]+)<\/a>[^<#]*#\s*([0-9,]+)/gi;
  let revMatch: RegExpExecArray | null;
  while ((revMatch = revRegex.exec(html)) !== null) {
    if (revMatch[3] && revMatch[2]) {
      const rank = parseInt(revMatch[3].replace(/,/g, ''), 10);
      addCategory(rank, revMatch[2], revMatch[1]);
    }
  }

  // 4. Bullet text / Table cell text:
  // e.g. #14 in Self-Help Calendars or #5 in Activity Books
  const plainRegex = /#\s*([0-9,]+)\s+in\s+([A-Za-z0-9&',–—/ -]{3,60}?)(?=\s*\(|#|<|\n|$)/gi;
  let plainMatch: RegExpExecArray | null;
  while ((plainMatch = plainRegex.exec(html)) !== null) {
    if (plainMatch[1] && plainMatch[2]) {
      const rank = parseInt(plainMatch[1].replace(/,/g, ''), 10);
      const catName = plainMatch[2].trim();
      if (catName && !/books|kindle store/i.test(catName)) {
        addCategory(rank, catName);
      }
    }
  }

  // 5. Wayfinding breadcrumb trail
  // <div id="wayfinding-breadcrumbs_feature_div"> ...
  const breadcrumbMatch = html.match(/id="wayfinding-breadcrumbs_feature_div"[\s\S]*?<\/div>/i);
  if (breadcrumbMatch) {
    const breadcrumbHtml = breadcrumbMatch[0];
    const crumbs: string[] = [];
    const crumbRegex = /<a[^>]*class="[^"]*a-link-normal[^"]*"[^>]*>([^<]+)<\/a>/gi;
    let cm: RegExpExecArray | null;
    while ((cm = crumbRegex.exec(breadcrumbHtml)) !== null) {
      if (cm[1]) {
        const crumb = cm[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
        if (crumb && !crumb.toLowerCase().includes('back to results')) {
          crumbs.push(crumb);
        }
      }
    }
    if (crumbs.length > 1) {
      const leaf = crumbs[crumbs.length - 1];
      const fullPath = crumbs.join(' > ');
      if (leaf && !seen.has(leaf.toLowerCase()) && !/books|kindle/i.test(leaf)) {
        categoryRanks.push({
          rank: 20, // default top ranking placeholder if breadcrumb only
          name: leaf,
          category: fullPath,
        });
      }
    }
  }

  return categoryRanks.slice(0, 5);
}

/**
 * Parse top negative / critical reviews directly from HTML string
 */
export function parseTopReviewsFromString(html: string): string[] {
  const reviews: string[] = [];
  const reviewBlocks = html.split(/data-hook="review"/i);
  for (let i = 1; i < reviewBlocks.length; i++) {
    const block = reviewBlocks[i];
    if (!block) continue;
    // Check star rating (1-3 stars)
    const starMatch = block.match(/([1-3](?:\.0)?)\s*out of 5 stars/i) || block.match(/a-star-([1-3])/i);
    if (starMatch) {
      const bodyMatch = block.match(/data-hook="review-body"[\s\S]*?<span>([\s\S]*?)<\/span>/i);
      if (bodyMatch && bodyMatch[1]) {
        const body = bodyMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
        if (body) reviews.push(body);
      }
    }
  }
  return reviews;
}

/**
 * Parse category sub-ranks from a product page DOM element or Document
 */
export function parseCategoryRanks(doc: Document | Element): CategoryRank[] {
  const categoryRanks: CategoryRank[] = [];
  const seen = new Set<string>();

  const addCategory = (rank: number, name: string, url?: string) => {
    let clean = name.replace(/^in\s+/i, '').replace(/\(see top 100.*\)/i, '').replace(/[\n\r\t]+/g, ' ').trim();
    clean = clean.replace(/\s*in\s+books\s*$/i, '').trim();
    if (!clean || isNaN(rank) || rank <= 0) return;
    const lower = clean.toLowerCase();
    if (lower === 'books' || lower === 'kindle store' || lower === 'paid in kindle store') return;
    if (seen.has(lower)) return;
    seen.add(lower);

    let fullUrl = url;
    if (fullUrl && !fullUrl.startsWith('http')) {
      fullUrl = `https://www.amazon.com${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
    }

    categoryRanks.push({
      rank,
      name: clean,
      url: fullUrl,
    });
  };

  // 1. Direct Category/BestSeller links (most accurate on modern Amazon)
  const catLinks = doc.querySelectorAll('a[href*="/bestsellers/"], a[href*="/Best-Sellers-"], a[href*="/zgbs/"]');
  for (const link of Array.from(catLinks)) {
    const linkText = link.textContent?.trim() || '';
    if (!linkText || /see top 100/i.test(linkText) || (linkText.toLowerCase() === 'books')) continue;
    const parentText = link.parentElement?.textContent || '';
    const match = parentText.match(/#\s*([0-9,]+)\s*(?:in|\s)/i);
    if (match && match[1]) {
      const rank = parseInt(match[1].replace(/,/g, ''), 10);
      addCategory(rank, linkText, link.getAttribute('href') || undefined);
    }
  }

  // 2. Standard Amazon sub-category lists (.zg_hrsr or detail bullets)
  const items = doc.querySelectorAll(
    '.zg_hrsr li, .zg_hrsr_item, #detailBulletsWrapper_feature_div ul.zg_hrsr li, #detailBullets_feature_div ul.zg_hrsr li'
  );
  for (const item of Array.from(items)) {
    const text = item.textContent?.trim() || '';
    const match = text.match(/#([0-9,]+)\s+in\s+([^(\n]+)/i);
    if (match && match[1] && match[2]) {
      const rank = parseInt(match[1].replace(/,/g, ''), 10);
      const name = match[2].trim();
      const link = item.querySelector('a')?.getAttribute('href') || undefined;
      addCategory(rank, name, link);
    }
  }

  // 3. Fallback: Search all bullet items and table rows
  if (categoryRanks.length === 0) {
    const bulletItems = doc.querySelectorAll(
      '#detailBulletsWrapper_feature_div li, #detailBullets_feature_div li, #productDetails_db_sections tr, #prodDetails tr, #SalesRank tr, #SalesRank td'
    );
    for (const b of Array.from(bulletItems)) {
      const text = b.textContent || '';
      if (text.includes('in ') && text.includes('#')) {
        const matches = text.matchAll(/#([0-9,]+)\s+in\s+([A-Za-z0-9\s&,–—/-]+?)(?=\s*\(|#|$)/gi);
        for (const m of matches) {
          if (m && m[1] && m[2]) {
            const rank = parseInt(m[1].replace(/,/g, ''), 10);
            const name = m[2].trim();
            const link = b.querySelector('a')?.getAttribute('href') || undefined;
            addCategory(rank, name, link);
          }
        }
      }
    }
  }

  // 4. Fallback to raw HTML regex if DOM queries found nothing
  if (categoryRanks.length === 0) {
    const rawHtml = (doc as Document).documentElement?.outerHTML || (doc as HTMLElement).innerHTML || '';
    if (rawHtml) {
      return parseCategoryRanksFromString(rawHtml);
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
    const ratingEl = card.querySelector('i[data-hook*="star-rating"] span.a-icon-alt, span.a-icon-alt');
    const ratingText = ratingEl?.textContent || '';
    const rating = ratingText.match(/(\d+(?:\.\d+)?)/)?.[1];
    const numRating = rating ? parseFloat(rating) : 5;

    if (numRating <= 3) {
      const bodyEl = card.querySelector('span[data-hook="review-body"] span, div.review-text-content span, span[data-hook="review-body"]');
      const body = bodyEl?.textContent?.trim();
      if (body) {
        reviews.push(body);
      }
    }
  }

  if (reviews.length === 0) {
    const rawHtml = (doc as Document).documentElement?.outerHTML || (doc as HTMLElement).innerHTML || '';
    if (rawHtml) {
      return parseTopReviewsFromString(rawHtml);
    }
  }

  return reviews;
}

/**
 * Parse complete product details from an HTML document or string
 */
export function parseProductPage(htmlOrDoc: Document | string): ParsedProductDetails {
  let doc: Document | undefined;
  if (typeof htmlOrDoc === 'string') {
    if (isCaptchaPage(htmlOrDoc)) {
      return { isCaptcha: true, categoryRanks: [] };
    }
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        doc = parser.parseFromString(htmlOrDoc, 'text/html');
      } catch {
        doc = undefined;
      }
    }
    
    // If DOMParser is undefined (Service Worker) or failed to parse doc
    if (!doc) {
      const bsrOverall = parseBsr(htmlOrDoc);
      const categoryRanks = parseCategoryRanksFromString(htmlOrDoc);
      const pageCount = parsePageCount(htmlOrDoc);
      const trimSize = parseTrimSize(htmlOrDoc);
      const publishDate = parsePublishDate(htmlOrDoc);
      const readingAge = parseReadingAge(htmlOrDoc);
      const topReviewsText = parseTopReviewsFromString(htmlOrDoc);
      const isLowContent = /coloring book|journal|planner|log book|notebook|sketchbook|tracker/i.test(htmlOrDoc);

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
