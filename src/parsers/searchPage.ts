import type { Book } from '../types';
import { SEARCH_SELECTORS, MAX_ORGANIC_RESULTS_TO_PARSE } from '../config';

/**
 * Helper to query first matching element from a list of fallback selectors
 */
export function queryFirst(root: Element | Document, selectors: string[]): Element | null {
  for (const selector of selectors) {
    try {
      const el = root.querySelector(selector);
      if (el) return el;
    } catch {
      // Ignore selector syntax error if unsupported pseudo-classes are used in fallback
    }
  }
  return null;
}

/**
 * Checks if a search result card is marked as Sponsored / Ad
 */
export function isSponsoredResult(element: Element): boolean {
  for (const selector of SEARCH_SELECTORS.sponsoredMarkers) {
    try {
      if (element.querySelector(selector)) return true;
    } catch {
      // Continue next fallback
    }
  }

  // Text-based fallback check
  const text = element.textContent || '';
  if (/\b(Sponsored|Patrocinado|Sponsorisé)\b/i.test(text)) {
    // Check if the word sponsored is specifically in a label rather than the title
    const header = queryFirst(element, SEARCH_SELECTORS.title);
    const headerText = header?.textContent || '';
    if (!headerText.includes('Sponsored')) {
      return true;
    }
  }

  return false;
}

/**
 * Clean and extract numeric price from string like "$14.99" or "14.99 €"
 */
export function parsePrice(text?: string | null): number | undefined {
  if (!text) return undefined;
  const match = text.replace(/,/g, '').match(/(\d+(?:\.\d{1,2})?)/);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    return isNaN(val) ? undefined : val;
  }
  return undefined;
}

/**
 * Clean and extract star rating from string like "4.7 out of 5 stars"
 */
export function parseRating(text?: string | null): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:out of|\/|de)\s*5/i) || text.match(/(\d+(?:\.\d+)?)/);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    return isNaN(val) || val > 5 ? undefined : val;
  }
  return undefined;
}

/**
 * Clean and extract review count integer from string like "1,245" or "1.245"
 */
export function parseReviewCount(text?: string | null): number | undefined {
  if (!text) return undefined;
  // Match digits with possible commas or dots as thousand separators
  const match = text.replace(/\s/g, '').match(/(\d{1,3}(?:[,\.]\d{3})+|\d+)/);
  if (match && match[1]) {
    const cleaned = match[1].replace(/[,\.]/g, '');
    const val = parseInt(cleaned, 10);
    return isNaN(val) ? undefined : val;
  }
  return undefined;
}

/**
 * Extract clean author from text like "by John Doe" or "John Doe (Author)"
 */
export function parseAuthor(text?: string | null): string {
  if (!text) return 'N/A';
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^by\s+/i, '').replace(/\s*\(Author\)$/i, '').trim();
  return cleaned || 'N/A';
}

/**
 * Robustly extract author name from a search card element
 */
export function extractAuthor(item: Element): string {
  // 1. Direct author profile link
  const authorLink = item.querySelector('a[href*="/e/"], a.a-link-normal[href*="field-author"]');
  if (authorLink && authorLink.textContent?.trim()) {
    return parseAuthor(authorLink.textContent);
  }

  // 2. Selectors from config
  for (const selector of SEARCH_SELECTORS.author) {
    try {
      const el = item.querySelector(selector);
      const text = el?.textContent?.trim();
      if (text && text.toLowerCase() !== 'by') {
        const parsed = parseAuthor(text);
        if (parsed !== 'N/A' && parsed.toLowerCase() !== 'by') {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
  }

  // 3. Fallback: scan rows containing 'by '
  const rows = item.querySelectorAll('.a-row.a-size-base, div.a-row');
  for (const row of Array.from(rows)) {
    const text = row.textContent?.trim() || '';
    if (/\bby\s+/i.test(text)) {
      const match = text.match(/\bby\s+([^|•·\n\r]+)/i);
      if (match) {
        return parseAuthor(match[1]);
      }
    }
  }

  return 'N/A';
}

/**
 * Parse organic book cards from an Amazon search page Document or container
 */
export function parseSearchResults(doc: Document | Element): Book[] {
  const books: Book[] = [];
  const processedAsins = new Set<string>();

  // Find result elements
  let itemElements: Element[] = [];
  for (const selector of SEARCH_SELECTORS.items) {
    try {
      const found = doc.querySelectorAll(selector);
      if (found.length > 0) {
        itemElements = Array.from(found);
        break;
      }
    } catch {
      // Continue
    }
  }

  for (const item of itemElements) {
    if (books.length >= MAX_ORGANIC_RESULTS_TO_PARSE) {
      break;
    }

    // 1. Skip sponsored items
    if (isSponsoredResult(item)) {
      continue;
    }

    // 2. Extract ASIN
    let asin = item.getAttribute('data-asin')?.trim();
    if (!asin) {
      // Fallback: search links for /dp/ASIN
      const linkEl = queryFirst(item, SEARCH_SELECTORS.productLink) as HTMLAnchorElement | null;
      const href = linkEl?.getAttribute('href') || '';
      const asinMatch = href.match(/\/dp\/([A-Z0-9]{10})/i) || href.match(/\/gp\/product\/([A-Z0-9]{10})/i);
      if (asinMatch && asinMatch[1]) {
        asin = asinMatch[1].toUpperCase();
      }
    }

    if (!asin || processedAsins.has(asin)) {
      continue;
    }

    // 3. Title
    const titleEl = queryFirst(item, SEARCH_SELECTORS.title);
    const titleText = titleEl?.textContent?.trim() || '';
    if (!titleText) {
      // Without title, this is not a valid product card
      continue;
    }

    // 4. Subtitle
    const subtitleEl = queryFirst(item, SEARCH_SELECTORS.subtitle);
    const subtitleText = subtitleEl?.textContent?.trim();

    // 5. Author
    const author = extractAuthor(item);

    // 6. Price
    const priceEl = queryFirst(item, SEARCH_SELECTORS.price);
    const price = parsePrice(priceEl?.textContent);

    // 7. Rating
    const ratingEl = queryFirst(item, SEARCH_SELECTORS.rating);
    const rating = parseRating(ratingEl?.getAttribute('aria-label') || ratingEl?.textContent);

    // 8. Review Count
    const reviewEl = queryFirst(item, SEARCH_SELECTORS.reviewCount);
    const reviewCount = parseReviewCount(reviewEl?.textContent);

    // 9. Product URL
    const linkEl = queryFirst(item, SEARCH_SELECTORS.productLink) as HTMLAnchorElement | null;
    const href = linkEl?.getAttribute('href') || `/dp/${asin}`;
    const productUrl = href.startsWith('http') ? href : `https://www.amazon.com${href.startsWith('/') ? '' : '/'}${href}`;

    processedAsins.add(asin);
    books.push({
      asin,
      title: titleText,
      subtitle: subtitleText || undefined,
      author,
      price,
      rating,
      reviewCount,
      categoryRanks: [],
      productUrl,
    });
  }

  return books;
}

/**
 * Extract active search query from the current page
 */
export function getSearchQuery(doc: Document = document): string {
  // Try search input box
  const searchInput = doc.querySelector('input#twotabsearchtextbox') as HTMLInputElement | null;
  if (searchInput && searchInput.value) {
    return searchInput.value.trim();
  }

  // Fallback to URL query parameter 'k'
  try {
    const url = new URL(window.location.href);
    const k = url.searchParams.get('k');
    if (k) return decodeURIComponent(k).trim();
  } catch {
    // Ignore URL parse error
  }

  return '';
}

/**
 * Determine if current page is an Amazon search page in the Books department
 */
export function isAmazonBookSearchPage(doc: Document = document): boolean {
  try {
    const url = new URL(window.location.href);
    if (!url.pathname.includes('/s')) return false;

    // Check query params: i=stripbooks or node=283155 (Books node)
    const iParam = url.searchParams.get('i');
    if (iParam === 'stripbooks' || iParam === 'books') return true;

    // Check dropdown selector value
    const searchDropdown = doc.querySelector('#searchDropdownBox') as HTMLSelectElement | null;
    if (searchDropdown) {
      const val = searchDropdown.value;
      if (val === 'search-alias=stripbooks' || val === 'stripbooks') return true;
    }

    // Check breadcrumbs or departmental pills
    const deptPill = doc.querySelector('#departments, #s-refinements');
    if (deptPill && /Books/i.test(deptPill.textContent || '')) {
      return true;
    }

    // Default to true if search results contain book-like metadata
    return Boolean(url.searchParams.get('k'));
  } catch {
    return false;
  }
}
