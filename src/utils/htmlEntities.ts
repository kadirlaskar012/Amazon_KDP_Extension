// src/utils/htmlEntities.ts
// Robust HTML entity decoder and category path standardizer.

const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&apos;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&bull;': '•',
};

function decodePass(str: string): string {
  // If in browser DOM context, try using textarea for standard browser decoding
  if (typeof document !== 'undefined') {
    try {
      const txt = document.createElement('textarea');
      txt.innerHTML = str;
      if (txt.value && txt.value !== str) {
        return txt.value;
      }
    } catch {
      // Fallback to regex
    }
  }

  // Regex replacement for decimal entities &#123;
  let res = str.replace(/&#(\d+);/g, (_, dec) => {
    const code = parseInt(dec, 10);
    return !isNaN(code) && code > 0 ? String.fromCharCode(code) : _;
  });

  // Regex replacement for hex entities &#x27; / &#X27;
  res = res.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const code = parseInt(hex, 16);
    return !isNaN(code) && code > 0 ? String.fromCharCode(code) : _;
  });

  // Regex replacement for named entities
  for (const [entity, char] of Object.entries(NAMED_ENTITIES)) {
    if (res.includes(entity)) {
      res = res.replaceAll(entity, char);
    }
  }

  return res;
}

/**
 * Decodes all HTML entities (decimal, hex, named) back to plain Unicode characters.
 * Runs multiple passes to handle double-encoded entities (e.g. &amp;#x27; -> &#x27; -> ').
 */
export function decodeHtmlEntities(str: string): string {
  if (!str || !str.includes('&')) return str || '';

  let current = str;
  let prev = '';
  let passes = 0;

  while (current !== prev && current.includes('&') && passes < 3) {
    prev = current;
    current = decodePass(current);
    passes++;
  }

  return current;
}

/**
 * Standardizes category path formatting:
 * 1. Decodes all HTML entities.
 * 2. Normalizes path separators (>, &gt;, etc.) to a clean " > " with single spaces on both sides.
 * 3. Cleans whitespace.
 *
 * Example:
 * "Books > Children&#x27;s Books  >  Arts, Music &amp; Photography"
 * -> "Books > Children's Books > Arts, Music & Photography"
 */
export function formatCleanCategoryPath(path: string): string {
  if (!path) return '';
  const decoded = decodeHtmlEntities(path);
  // Split on any separator (>, ›, », &gt;) with any surrounding whitespace
  const parts = decoded
    .split(/\s*(?:>|&gt;|›|»)\s*/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (parts.length === 0) return '';
  return parts.join(' > ');
}
