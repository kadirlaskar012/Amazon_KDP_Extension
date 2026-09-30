// src/services/exporter.ts
// Comprehensive CSV and JSON export engine for KDP niche research datasets

import type {
  SearchSnapshot,
  Book,
  KeywordItem,
  CategoryStat,
  SpecsSummary,
  ReviewGapAnalysis,
  WatchlistItem,
  BookIdea,
  ExportKind,
  ExportSettings,
} from '../types';
import { DEFAULT_EXPORT_SETTINGS } from '../config/defaults';

/**
 * Escapes a cell value for standard CSV compatibility (RFC 4180)
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  let str = String(value);

  // If array, join items
  if (Array.isArray(value)) {
    str = value.map((v) => String(v).trim()).join(' | ');
  }

  // If string contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Converts a 2D array of cells into a formatted CSV string with optional UTF-8 BOM
 */
export function toCsvString(
  rows: (unknown)[][],
  delimiter: string = DEFAULT_EXPORT_SETTINGS.csvDelimiter,
  includeBom: boolean = DEFAULT_EXPORT_SETTINGS.includeBom
): string {
  const csvBody = rows.map((row) => row.map(escapeCsvCell).join(delimiter)).join('\r\n');
  return includeBom ? `\uFEFF${csvBody}` : csvBody;
}

/**
 * Triggers browser download of text content using a temporary anchor and Blob URL
 */
export function downloadFile(
  content: string,
  fileName: string,
  mimeType: string = 'text/csv;charset=utf-8;'
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Formats a clean file name: kdp-<kind>-<query-slug>-<YYYYMMDD-HHmm>.csv
 */
export function buildExportFileName(kind: ExportKind, query?: string): string {
  const querySlug = (query || 'research')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'niche';

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const timestamp = `${yyyy}${mm}${dd}-${hh}${min}`;

  return `kdp-${kind.replace(/_/g, '-')}-${querySlug}-${timestamp}.csv`;
}

// 1. Search Results CSV Builder
export function buildSearchResultsCsv(
  books: Book[],
  query?: string,
  settings: ExportSettings = DEFAULT_EXPORT_SETTINGS
): string {
  const headers = [
    'ASIN',
    'Title',
    'Author',
    'Price ($)',
    'BSR Overall',
    'Rating',
    'Review Count',
    'Page Count',
    'Trim Size',
    'Publish Date',
    'Low Content',
    'Est Monthly Sales',
    'Est Monthly Royalty ($)',
    'Opportunity Flag',
    'Opportunity Reasons',
    'Product URL',
  ];

  const rows = books.map((b) => [
    b.asin,
    b.title,
    b.author || '',
    b.price !== undefined ? b.price.toFixed(2) : '',
    b.bsrOverall !== undefined ? b.bsrOverall : '',
    b.rating !== undefined ? b.rating.toFixed(1) : '',
    b.reviewCount !== undefined ? b.reviewCount : '',
    b.pageCount || '',
    b.trimSize || '',
    b.publishDate || '',
    b.isLowContent ? 'Yes' : 'No',
    b.monthlySalesEstimate !== undefined ? b.monthlySalesEstimate : '',
    b.monthlyRoyaltyEstimate !== undefined ? b.monthlyRoyaltyEstimate.toFixed(2) : '',
    b.isOpportunity ? 'YES' : 'NO',
    (b.opportunityReasons || []).join('; '),
    b.productUrl || `https://www.amazon.com/dp/${b.asin}`,
  ]);

  return toCsvString([headers, ...rows], settings.csvDelimiter, settings.includeBom);
}

// 2. Keywords CSV Builder
export function buildKeywordsCsv(
  keywords: KeywordItem[],
  settings: ExportSettings = DEFAULT_EXPORT_SETTINGS
): string {
  const headers = [
    'Keyword',
    'Position',
    'Title Frequency (in 10)',
    'Top Result BSR Score',
    'Total Score (0-100)',
    'Priority Label',
  ];

  const rows = keywords.map((k) => [
    k.keyword,
    k.bestPosition,
    k.inTitlesCount,
    k.bsrScore !== null && k.bsrScore !== undefined ? k.bsrScore : 'N/A',
    k.totalScore,
    k.scoreLabel.toUpperCase(),
  ]);

  return toCsvString([headers, ...rows], settings.csvDelimiter, settings.includeBom);
}

// 3. Categories CSV Builder
export function buildCategoriesCsv(
  categories: CategoryStat[],
  settings: ExportSettings = DEFAULT_EXPORT_SETTINGS
): string {
  const headers = [
    'Category Name',
    'Books in Category',
    'Best Rank in Top Books',
    'Average Rank',
    'Difficulty',
    'BSR at Top 1',
    'BSR at Top 10',
    'BSR at Top 20 (Target)',
    'URL',
  ];

  const rows = categories.map((c) => [
    c.name,
    c.bookCount,
    c.bestRankAmongTopBooks,
    Math.round(c.avgRank),
    c.difficulty ? c.difficulty.toUpperCase() : 'UNCHECKED',
    c.bsrAtTop1 !== null && c.bsrAtTop1 !== undefined ? c.bsrAtTop1 : '',
    c.bsrAtTop10 !== null && c.bsrAtTop10 !== undefined ? c.bsrAtTop10 : '',
    c.bsrAtTop20 !== null && c.bsrAtTop20 !== undefined ? c.bsrAtTop20 : '',
    c.url || '',
  ]);

  return toCsvString([headers, ...rows], settings.csvDelimiter, settings.includeBom);
}

// 4. Specs Summary CSV Builder
export function buildSpecsCsv(
  specs: SpecsSummary,
  settings: ExportSettings = DEFAULT_EXPORT_SETTINGS
): string {
  const headers = ['Specification Metric', 'Observed Value', 'Recommendation & Context'];
  const rows = [
    ['Median Page Count', `${specs.pageCount.median} pages`, `Range: ${specs.pageCount.min} - ${specs.pageCount.max} pages (Most common: ${specs.pageCount.mostCommonRange})`],
    ['Recommended Page Count', `${specs.recommended.pageCount} pages`, specs.recommended.pageCountReason],
    ['Trim Size', specs.trimSize.mostCommon, `${specs.trimSize.percentage}% of analyzed competitor books`],
    ['Recommended Trim Size', specs.recommended.trimSize, specs.recommended.trimSizeReason],
    ['Median Price', `$${specs.price.median.toFixed(2)}`, `Common price point: $${specs.price.mostCommonPoint.toFixed(2)}`],
    ['Recommended Price Range', specs.recommended.priceRange, specs.recommended.priceReason],
    ['Low-Content Share', `${specs.formatShare.percentage}%`, `${specs.formatShare.lowContentCount} of ${specs.formatShare.total} books are coloring/notebooks/planners`],
  ];

  return toCsvString([headers, ...rows], settings.csvDelimiter, settings.includeBom);
}

// 5. Reviews CSV Builder
export function buildReviewsCsv(
  reviewGap: ReviewGapAnalysis,
  settings: ExportSettings = DEFAULT_EXPORT_SETTINGS
): string {
  const headers = ['Type', 'Phrase / Keyword', 'Category', 'Mention Count', 'Books Count', 'Sample Excerpt'];
  const rows: (string | number)[][] = [];

  for (const c of reviewGap.complaints) {
    rows.push([
      'Negative Complaint',
      c.phrase,
      c.category,
      c.count,
      c.bookCount,
      c.sampleQuotes[0] || '',
    ]);
  }

  for (const p of reviewGap.positivePhrases) {
    rows.push([
      'Positive Signal (What Customers Like)',
      p.word,
      'Positive Customer Feedback',
      p.count,
      '',
      '',
    ]);
  }

  return toCsvString([headers, ...rows], settings.csvDelimiter, settings.includeBom);
}

// 6. Watchlist CSV Builder
export function buildWatchlistCsv(
  watchlist: WatchlistItem[],
  settings: ExportSettings = DEFAULT_EXPORT_SETTINGS
): string {
  const headers = [
    'ASIN',
    'Title',
    'Author',
    'Track Date',
    'BSR Overall',
    'Price ($)',
    'Review Count',
    'Rating',
    'Category Sub-Rank',
  ];

  const rows: (string | number)[][] = [];

  for (const item of watchlist) {
    if (item.history && item.history.length > 0) {
      for (const h of item.history) {
        rows.push([
          item.asin,
          item.title,
          item.author || '',
          h.date,
          h.bsrOverall !== undefined ? h.bsrOverall : (h.bsr ?? ''),
          h.price !== undefined ? h.price.toFixed(2) : (item.price ? item.price.toFixed(2) : ''),
          h.reviewCount !== undefined ? h.reviewCount : '',
          h.rating !== undefined ? h.rating.toFixed(1) : '',
          h.categoryRank ? `#${h.categoryRank.rank} in ${h.categoryRank.name}` : '',
        ]);
      }
    } else {
      rows.push([
        item.asin,
        item.title,
        item.author || '',
        'N/A',
        '',
        item.price !== undefined ? item.price.toFixed(2) : '',
        '',
        '',
        '',
      ]);
    }
  }

  return toCsvString([headers, ...rows], settings.csvDelimiter, settings.includeBom);
}

// 7. AI Ideas CSV Builder
export function buildAiIdeasCsv(
  ideas: BookIdea[],
  settings: ExportSettings = DEFAULT_EXPORT_SETTINGS
): string {
  const headers = [
    'Title',
    'Subtitle',
    'Sub-Niche',
    'Target Audience',
    '7 Backend Keywords',
    '3 Suggested Categories',
    'Page Count',
    'Trim Size',
    'Suggested Price ($)',
    'Estimated Difficulty (1-10)',
    'Differentiation Angle',
    'Content Plan',
    'Why It Could Work',
    'Risks',
    'Short Description',
    'Warnings',
  ];

  const rows = ideas.map((idea) => [
    idea.title,
    idea.subtitle,
    idea.subNiche,
    idea.targetAudience,
    (idea.sevenBackendKeywords || []).join(' | '),
    (idea.threeCategories || []).join(' | '),
    idea.pageCount,
    idea.trimSize,
    idea.priceSuggestion ? idea.priceSuggestion.toFixed(2) : '',
    idea.estimatedDifficulty,
    idea.differentiationAngle,
    idea.contentPlan,
    idea.whyItCouldWork,
    idea.risks,
    idea.shortDescription,
    (idea.warnings || []).join('; '),
  ]);

  return toCsvString([headers, ...rows], settings.csvDelimiter, settings.includeBom);
}

// 8. Full Research Pack (Combined Multi-Section CSV)
export function buildFullResearchPackCsv(
  snapshot: SearchSnapshot,
  watchlist: WatchlistItem[] = [],
  ideas: BookIdea[] = [],
  settings: ExportSettings = DEFAULT_EXPORT_SETTINGS
): string {
  const sections: string[] = [];

  // Metadata Header
  sections.push(`=== KDP NICHE RESEARCH PACK: "${snapshot.query.toUpperCase()}" ===`);
  sections.push(`Generated: ${new Date().toISOString()}`);
  sections.push(`Niche Score: ${snapshot.scores ? `${snapshot.scores.total}/100 (${snapshot.scores.label.toUpperCase()})` : 'N/A'}\r\n`);

  // Section 1: Books
  if (snapshot.books && snapshot.books.length > 0) {
    sections.push(`=== SECTION 1: COMPETITOR BOOKS (${snapshot.books.length}) ===`);
    sections.push(buildSearchResultsCsv(snapshot.books, snapshot.query, { ...settings, includeBom: false }));
    sections.push('\r\n');
  }

  // Section 2: Keywords
  if (snapshot.keywords && snapshot.keywords.length > 0) {
    sections.push(`=== SECTION 2: KEYWORDS & SEARCH DEMAND (${snapshot.keywords.length}) ===`);
    sections.push(buildKeywordsCsv(snapshot.keywords, { ...settings, includeBom: false }));
    sections.push('\r\n');
  }

  // Section 3: Categories
  if (snapshot.categories && snapshot.categories.length > 0) {
    sections.push(`=== SECTION 3: CATEGORY ANALYSIS (${snapshot.categories.length}) ===`);
    sections.push(buildCategoriesCsv(snapshot.categories, { ...settings, includeBom: false }));
    sections.push('\r\n');
  }

  // Section 4: Specs
  if (snapshot.specs) {
    sections.push(`=== SECTION 4: BOOK SPECIFICATIONS & BENCHMARKS ===`);
    sections.push(buildSpecsCsv(snapshot.specs, { ...settings, includeBom: false }));
    sections.push('\r\n');
  }

  // Section 5: Reviews Gap
  if (snapshot.reviewGap && snapshot.reviewGap.complaints.length > 0) {
    sections.push(`=== SECTION 5: CUSTOMER COMPLAINTS & REVIEWS GAP ===`);
    sections.push(buildReviewsCsv(snapshot.reviewGap, { ...settings, includeBom: false }));
    sections.push('\r\n');
  }

  // Section 6: AI Ideas
  if (ideas.length > 0) {
    sections.push(`=== SECTION 6: AI BOOK IDEAS (${ideas.length}) ===`);
    sections.push(buildAiIdeasCsv(ideas, { ...settings, includeBom: false }));
    sections.push('\r\n');
  }

  // Section 7: Watchlist
  if (watchlist.length > 0) {
    sections.push(`=== SECTION 7: WATCHLIST TRACKER HISTORY (${watchlist.length} books) ===`);
    sections.push(buildWatchlistCsv(watchlist, { ...settings, includeBom: false }));
    sections.push('\r\n');
  }

  const combined = sections.join('\r\n');
  return settings.includeBom ? `\uFEFF${combined}` : combined;
}

/**
 * Exports snapshot as JSON for backup
 */
export function exportSnapshotJson(snapshot: SearchSnapshot): void {
  const json = JSON.stringify(snapshot, null, 2);
  const fileName = `kdp-snapshot-${(snapshot.query || 'niche').replace(/[^a-z0-9]+/gi, '-')}-${Date.now()}.json`;
  downloadFile(json, fileName, 'application/json');
}

/**
 * Validates and imports a JSON snapshot
 * Strictly removes any sensitive credentials (such as API keys)
 */
export function parseImportSnapshotJson(jsonText: string): SearchSnapshot {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== 'object' || !parsed.query || !Array.isArray(parsed.books)) {
    throw new Error('Invalid KDP snapshot JSON: missing query or books array.');
  }

  // Purge sensitive keys if present
  delete (parsed as any).apiKey;
  delete (parsed as any).claudeApiKey;

  return parsed as SearchSnapshot;
}
