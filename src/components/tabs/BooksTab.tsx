import React, { useState, useMemo } from 'react';
import type { Book, Settings } from '../../types';
import { OpportunityBadge } from '../OpportunityBadge';
import { isOpportunity, getOpportunityReasons } from '../../services/weakCompetitor';
import { estimateMonthlySales, estimateMonthlyRoyalty } from '../../services/salesEstimator';
import {
  ExternalLink,
  Search,
  Sparkles,
  Copy,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BookmarkPlus,
} from 'lucide-react';

interface BooksTabProps {
  books: Book[];
  settings: Settings;
  onAddToWatchlist?: (book: Book) => void;
}

type SortField =
  | 'index'
  | 'title'
  | 'price'
  | 'bsr'
  | 'reviews'
  | 'rating'
  | 'pages'
  | 'sales'
  | 'royalty';

export const BooksTab: React.FC<BooksTabProps> = ({
  books,
  settings,
  onAddToWatchlist,
}) => {
  const [showOnlyOpportunities, setShowOnlyOpportunities] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('bsr');
  const [sortAsc, setSortAsc] = useState(true);
  const [copiedTsv, setCopiedTsv] = useState(false);

  // Compute metrics and opportunity status for each book
  const enrichedBooks = useMemo(() => {
    return books.map((book, originalIdx) => {
      const isOpp = isOpportunity(book, settings.thresholds);
      const reasons = getOpportunityReasons(book, settings.thresholds);
      const salesEst = estimateMonthlySales(book.bsrOverall, settings.bsrSalesTable).value;
      const royaltyEst = estimateMonthlyRoyalty(book, settings).value;

      return {
        ...book,
        originalIndex: originalIdx + 1,
        isOpp,
        reasons,
        salesEst,
        royaltyEst,
      };
    });
  }, [books, settings]);

  // Filter books
  const filteredBooks = useMemo(() => {
    return enrichedBooks.filter((book) => {
      if (showOnlyOpportunities && !book.isOpp) {
        return false;
      }
      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase();
        const titleMatch = book.title.toLowerCase().includes(query);
        const authorMatch = book.author?.toLowerCase().includes(query);
        const asinMatch = book.asin.toLowerCase().includes(query);
        if (!titleMatch && !authorMatch && !asinMatch) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedBooks, showOnlyOpportunities, searchFilter]);

  // Sort books (default BSR ascending; nulls go to the bottom)
  const sortedBooks = useMemo(() => {
    return [...filteredBooks].sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortField) {
        case 'index':
          valA = a.originalIndex;
          valB = b.originalIndex;
          break;
        case 'title':
          valA = a.title.toLowerCase();
          valB = b.title.toLowerCase();
          break;
        case 'price':
          valA = a.price ?? null;
          valB = b.price ?? null;
          break;
        case 'bsr':
          valA = a.bsrOverall ?? null;
          valB = b.bsrOverall ?? null;
          break;
        case 'reviews':
          valA = a.reviewCount ?? null;
          valB = b.reviewCount ?? null;
          break;
        case 'rating':
          valA = a.rating ?? null;
          valB = b.rating ?? null;
          break;
        case 'pages':
          valA = a.pageCount ?? null;
          valB = b.pageCount ?? null;
          break;
        case 'sales':
          valA = a.salesEst ?? null;
          valB = b.salesEst ?? null;
          break;
        case 'royalty':
          valA = a.royaltyEst ?? null;
          valB = b.royaltyEst ?? null;
          break;
        default:
          valA = a.bsrOverall ?? null;
          valB = b.bsrOverall ?? null;
      }

      // Handle nulls always at the bottom
      if (valA === null && valB === null) return 0;
      if (valA === null) return 1;
      if (valB === null) return -1;

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredBooks, sortField, sortAsc]);

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'bsr' || field === 'index'); // default asc for BSR & index
    }
  };

  const handleCopyTsv = async () => {
    const headers = [
      'Rank',
      'Title',
      'ASIN',
      'Author',
      'Price',
      'BSR',
      'Reviews',
      'Rating',
      'Pages',
      'Published',
      'Est. Sales/mo',
      'Est. Royalty/mo',
      'Opportunity',
    ];

    const rows = sortedBooks.map((b) => [
      b.originalIndex,
      `"${b.title.replace(/"/g, '""')}"`,
      b.asin,
      `"${(b.author || 'N/A').replace(/"/g, '""')}"`,
      b.price !== undefined ? b.price.toFixed(2) : 'N/A',
      b.bsrOverall !== undefined ? b.bsrOverall : 'N/A',
      b.reviewCount !== undefined ? b.reviewCount : 'N/A',
      b.rating !== undefined ? b.rating.toFixed(1) : 'N/A',
      b.pageCount !== undefined ? b.pageCount : 'N/A',
      b.publishDate || 'N/A',
      b.salesEst !== null ? b.salesEst : 'N/A',
      b.royaltyEst !== null ? `$${b.royaltyEst.toFixed(2)}` : 'N/A',
      b.isOpp ? 'Yes' : 'No',
    ]);

    const tsvContent = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');

    try {
      await navigator.clipboard.writeText(tsvContent);
      setCopiedTsv(true);
      setTimeout(() => setCopiedTsv(false), 2500);
    } catch (err) {
      console.warn('Failed to copy TSV:', err);
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-2.5 h-2.5 opacity-40 ml-0.5" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400 ml-0.5" />
    ) : (
      <ArrowDown className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400 ml-0.5" />
    );
  };

  return (
    <div className="flex flex-col h-full font-sans text-xs">
      {/* 1. Toolbar */}
      <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 shrink-0">
        <div className="flex items-center gap-1.5">
          {/* Search text filter */}
          <div className="relative flex-1">
            <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by title or author..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-6 pr-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Copy TSV button */}
          <button
            onClick={handleCopyTsv}
            title="Copy table data as TSV (for Excel / Google Sheets)"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 font-medium transition shrink-0"
          >
            {copiedTsv ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>TSV</span>
              </>
            )}
          </button>
        </div>

        {/* Opportunity filter toggle */}
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-700 dark:text-slate-300 font-medium select-none">
            <input
              type="checkbox"
              checked={showOnlyOpportunities}
              onChange={(e) => setShowOnlyOpportunities(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-500" />
              Show only opportunities
            </span>
          </label>

          <span className="text-[10px] text-slate-400 font-mono">
            Showing {sortedBooks.length} of {books.length}
          </span>
        </div>
      </div>

      {/* 2. Sortable Table Container */}
      <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold z-10 select-none">
            <tr>
              <th
                onClick={() => handleHeaderSort('index')}
                className="py-2 px-2 text-center w-7 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 sticky left-0 bg-slate-100 dark:bg-slate-800 z-20"
              >
                <div className="flex items-center justify-center">
                  # {renderSortIcon('index')}
                </div>
              </th>

              <th
                onClick={() => handleHeaderSort('title')}
                className="py-2 px-2.5 min-w-[140px] max-w-[160px] cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
              >
                <div className="flex items-center">
                  Title {renderSortIcon('title')}
                </div>
              </th>

              <th
                onClick={() => handleHeaderSort('price')}
                className="py-2 px-2 text-right cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 whitespace-nowrap"
              >
                <div className="flex items-center justify-end">
                  Price {renderSortIcon('price')}
                </div>
              </th>

              <th
                onClick={() => handleHeaderSort('bsr')}
                className="py-2 px-2 text-right cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 whitespace-nowrap"
              >
                <div className="flex items-center justify-end">
                  BSR {renderSortIcon('bsr')}
                </div>
              </th>

              <th
                onClick={() => handleHeaderSort('reviews')}
                className="py-2 px-2 text-right cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 whitespace-nowrap"
              >
                <div className="flex items-center justify-end">
                  Reviews {renderSortIcon('reviews')}
                </div>
              </th>

              <th
                onClick={() => handleHeaderSort('rating')}
                className="py-2 px-2 text-right cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 whitespace-nowrap"
              >
                <div className="flex items-center justify-end">
                  Rating {renderSortIcon('rating')}
                </div>
              </th>

              <th
                onClick={() => handleHeaderSort('pages')}
                className="py-2 px-2 text-right cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 whitespace-nowrap"
              >
                <div className="flex items-center justify-end">
                  Pages {renderSortIcon('pages')}
                </div>
              </th>

              <th className="py-2 px-2 text-left whitespace-nowrap">Published</th>

              <th
                onClick={() => handleHeaderSort('sales')}
                className="py-2 px-2 text-right cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 whitespace-nowrap"
              >
                <div className="flex items-center justify-end">
                  Est. Sales {renderSortIcon('sales')}
                </div>
              </th>

              <th
                onClick={() => handleHeaderSort('royalty')}
                className="py-2 px-2 text-right cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 whitespace-nowrap"
              >
                <div className="flex items-center justify-end">
                  Est. Royalty {renderSortIcon('royalty')}
                </div>
              </th>

              <th className="py-2 px-2 text-center whitespace-nowrap">Flag</th>

              <th className="py-2 px-1.5 text-center w-6">Save</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedBooks.map((book) => {
              const hasBsr = book.bsrOverall !== undefined;

              return (
                <tr
                  key={book.asin}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                    book.isOpp ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : ''
                  }`}
                >
                  {/* Sticky Rank */}
                  <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px] align-top sticky left-0 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 z-10">
                    {book.originalIndex}
                  </td>

                  {/* Title & Author */}
                  <td className="py-2 px-2.5 align-top min-w-[140px] max-w-[160px]">
                    <a
                      href={book.productUrl || `https://www.amazon.com/dp/${book.asin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2 leading-tight"
                      title={book.title}
                    >
                      {book.title}
                    </a>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5" title={book.author}>
                      {book.author || 'N/A'}
                    </div>
                  </td>

                  {/* Price */}
                  <td className="py-2 px-2 text-right align-top whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                    {book.price !== undefined ? `$${book.price.toFixed(2)}` : 'N/A'}
                  </td>

                  {/* BSR */}
                  <td className="py-2 px-2 text-right align-top whitespace-nowrap font-mono text-slate-900 dark:text-slate-100">
                    {hasBsr ? (
                      `#${book.bsrOverall?.toLocaleString()}`
                    ) : (
                      <div className="inline-block w-10 h-3 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
                    )}
                  </td>

                  {/* Reviews */}
                  <td className="py-2 px-2 text-right align-top whitespace-nowrap font-mono text-slate-600 dark:text-slate-300">
                    {book.reviewCount !== undefined ? book.reviewCount.toLocaleString() : 'N/A'}
                  </td>

                  {/* Rating */}
                  <td className="py-2 px-2 text-right align-top whitespace-nowrap text-amber-500 font-medium">
                    {book.rating !== undefined ? `★ ${book.rating.toFixed(1)}` : 'N/A'}
                  </td>

                  {/* Pages */}
                  <td className="py-2 px-2 text-right align-top whitespace-nowrap text-slate-600 dark:text-slate-400">
                    {book.pageCount !== undefined ? `${book.pageCount}p` : 'N/A'}
                  </td>

                  {/* Published */}
                  <td className="py-2 px-2 text-left align-top whitespace-nowrap text-[10px] text-slate-500">
                    {book.publishDate || 'N/A'}
                  </td>

                  {/* Est. Sales/mo */}
                  <td className="py-2 px-2 text-right align-top whitespace-nowrap font-mono text-blue-600 dark:text-blue-400 font-medium">
                    {book.salesEst !== null ? `~${book.salesEst.toLocaleString()}` : 'N/A'}
                  </td>

                  {/* Est. Royalty/mo */}
                  <td
                    className="py-2 px-2 text-right align-top whitespace-nowrap font-mono text-emerald-600 dark:text-emerald-400 font-bold"
                    title={book.royaltyEst !== null ? `$${book.royaltyEst.toFixed(2)}/mo net royalty` : undefined}
                  >
                    {book.royaltyEst !== null ? `~$${Math.round(book.royaltyEst).toLocaleString()}` : 'N/A'}
                  </td>

                  {/* Opportunity Flag */}
                  <td className="py-2 px-2 text-center align-top whitespace-nowrap">
                    {book.isOpp ? (
                      <OpportunityBadge reasons={book.reasons} />
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">-</span>
                    )}
                  </td>

                  {/* Save to watchlist */}
                  <td className="py-2 px-1 text-center align-top">
                    <button
                      onClick={() => onAddToWatchlist?.(book)}
                      title="Add to Watchlist"
                      className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. Footer */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-[10px] text-slate-400 text-center shrink-0">
        Estimates are rough. BSR to sales mapping is configurable in Settings.
      </div>
    </div>
  );
};
