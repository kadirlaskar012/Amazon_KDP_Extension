import React, { useState, useMemo } from 'react';
import type { Book, Settings } from '../../types';
import { OpportunityBadge } from '../OpportunityBadge';
import { isOpportunity, getOpportunityReasons } from '../../services/weakCompetitor';
import { estimateMonthlySales, estimateMonthlyRoyalty } from '../../services/salesEstimator';
import {
  Search,
  Sparkles,
  Copy,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  List,
} from 'lucide-react';
import { WatchButton } from '../WatchButton';

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
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
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
      setSortAsc(field === 'bsr' || field === 'index');
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
    <div className="flex flex-col h-full font-sans text-xs no-horizontal-scroll">
      {/* 1. Toolbar */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          {/* Search text filter */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, author or ASIN..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800 shrink-0">
            <button
              onClick={() => setViewMode('cards')}
              title="Cards View"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Copy TSV button */}
          <button
            onClick={handleCopyTsv}
            title="Copy table data as TSV (for Excel / Google Sheets)"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-medium transition shrink-0 cursor-pointer"
          >
            {copiedTsv ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>TSV</span>
              </>
            )}
          </button>
        </div>

        {/* Opportunity filter toggle & Sort selector */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-700 dark:text-slate-300 font-medium select-none">
            <input
              type="checkbox"
              checked={showOnlyOpportunities}
              onChange={(e) => setShowOnlyOpportunities(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>Opportunities only</span>
            </span>
          </label>

          <div className="flex items-center gap-2">
            <select
              value={sortField}
              onChange={(e) => {
                setSortField(e.target.value as SortField);
                setSortAsc(e.target.value === 'bsr' || e.target.value === 'index');
              }}
              className="text-xs py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none"
            >
              <option value="bsr">Sort: BSR Rank</option>
              <option value="sales">Sort: Est. Sales</option>
              <option value="royalty">Sort: Royalty</option>
              <option value="price">Sort: Price</option>
              <option value="reviews">Sort: Reviews</option>
              <option value="rating">Sort: Rating</option>
              <option value="index">Sort: Original #</option>
            </select>

            <span className="text-[11px] text-slate-400 font-mono">
              {sortedBooks.length}/{books.length}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Content: Cards View or Compact Table View */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 space-y-2.5">
        {viewMode === 'cards' ? (
          /* Cards View */
          sortedBooks.map((book, sortedIndex) => {
            const hasBsr = book.bsrOverall !== undefined;
            const amazonUrl = book.productUrl || `https://www.amazon.com/dp/${book.asin}`;
            const isTop1 = sortedIndex === 0;
            const isTop2 = sortedIndex === 1;
            const isTop3 = sortedIndex === 2;

            return (
              <div
                key={book.asin}
                className={`rounded-2xl border p-3.5 transition-all relative ${
                  isTop1
                    ? 'border-amber-400/80 bg-gradient-to-br from-amber-50/80 via-yellow-50/30 to-white dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 shadow-md ring-2 ring-amber-400/40'
                    : isTop2
                    ? 'border-indigo-300/80 dark:border-indigo-800 bg-gradient-to-br from-indigo-50/70 via-slate-50/30 to-white dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900 shadow-sm ring-1 ring-indigo-400/40'
                    : isTop3
                    ? 'border-orange-300/80 dark:border-orange-900 bg-gradient-to-br from-orange-50/60 via-slate-50/30 to-white dark:from-orange-950/20 dark:via-slate-900 dark:to-slate-900 shadow-sm ring-1 ring-orange-400/30'
                    : book.isOpp
                    ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-50/70 via-teal-50/30 to-white dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 shadow-sm ring-1 ring-emerald-500/20'
                    : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-indigo-300 dark:hover:border-slate-700 hover:shadow-sm'
                }`}
              >
                {/* Header row: Target Badges + Rank badge + Opportunity badge + Watch Button */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Top 3 Target Podium Badges */}
                    {isTop1 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 text-slate-950 shadow-md shadow-amber-500/20 ring-1 ring-amber-300">
                        <span>🥇</span>
                        <span>1st Target</span>
                      </span>
                    ) : isTop2 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-slate-200 via-indigo-100 to-slate-200 dark:from-slate-700 dark:via-indigo-900/60 dark:to-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-indigo-400/40">
                        <span>🥈</span>
                        <span>2nd Target</span>
                      </span>
                    ) : isTop3 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-700 via-orange-600 to-amber-800 text-amber-100 shadow-sm ring-1 ring-orange-500/40">
                        <span>🥉</span>
                        <span>3rd Target</span>
                      </span>
                    ) : null}

                    <span className="flex items-center justify-center px-2 py-0.5 rounded-lg font-mono text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                      #{book.originalIndex}
                    </span>

                    {book.isOpp && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-amber-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-xs">
                        <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                        Opportunity
                      </span>
                    )}
                  </div>
                  <div className="shrink-0">
                    <WatchButton
                      book={book}
                      size="sm"
                      showLabel={true}
                      onWatchChange={(isWatched) => {
                        if (isWatched && onAddToWatchlist) {
                          onAddToWatchlist(book);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Title & Author */}
                <div className="mt-2">
                  <a
                    href={amazonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2 leading-snug"
                    title={book.title}
                  >
                    {book.title}
                  </a>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="truncate max-w-[200px]">{book.author || 'Author N/A'}</span>
                    <span>•</span>
                    <span className="font-mono text-slate-400">{book.asin}</span>
                    {book.publishDate && (
                      <>
                        <span>•</span>
                        <span className="truncate">{book.publishDate}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 3 Metrics Columns Grid */}
                <div className="mt-2.5 grid grid-cols-3 gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80">
                  {/* BSR & Sales */}
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">BSR Rank</div>
                    <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm mt-0.5">
                      {hasBsr ? `#${book.bsrOverall?.toLocaleString()}` : <span className="text-slate-400 font-normal">Pending</span>}
                    </div>
                    <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                      {book.salesEst !== null ? `~${book.salesEst.toLocaleString()} sales/mo` : ''}
                    </div>
                  </div>

                  {/* Price & Royalty */}
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Price & Roy.</div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm mt-0.5">
                      {book.price !== undefined ? `$${book.price.toFixed(2)}` : 'N/A'}
                    </div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                      {book.royaltyEst !== null ? `~$${Math.round(book.royaltyEst)}/mo roy` : ''}
                    </div>
                  </div>

                  {/* Rating & Reviews */}
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Rating / Reviews</div>
                    <div className="font-semibold text-amber-600 dark:text-amber-400 text-xs sm:text-sm mt-0.5">
                      {book.rating !== undefined ? `★ ${book.rating.toFixed(1)}` : '★ N/A'}{' '}
                      <span className="text-slate-600 dark:text-slate-400 font-normal font-mono text-xs">
                        ({book.reviewCount !== undefined ? book.reviewCount.toLocaleString() : 0})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {book.pageCount ? `${book.pageCount}p` : ''} {book.trimSize ? `• ${book.trimSize}` : ''}
                    </div>
                  </div>
                </div>

                {/* Opportunity reasons badges */}
                {book.isOpp && book.reasons && book.reasons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {book.reasons.map((r, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                      >
                        ✓ {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          /* Compact Table View - strictly auto-fitting with no horizontal scrollbar */
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border-b border-slate-200 dark:border-slate-700 select-none">
                <tr>
                  <th
                    onClick={() => handleHeaderSort('index')}
                    className="py-2 px-1.5 text-center w-8 cursor-pointer hover:bg-slate-200/50"
                  >
                    #
                  </th>
                  <th
                    onClick={() => handleHeaderSort('title')}
                    className="py-2 px-2 cursor-pointer hover:bg-slate-200/50"
                  >
                    Title / Author
                  </th>
                  <th
                    onClick={() => handleHeaderSort('price')}
                    className="py-2 px-1.5 text-right w-14 cursor-pointer hover:bg-slate-200/50"
                  >
                    Price
                  </th>
                  <th
                    onClick={() => handleHeaderSort('bsr')}
                    className="py-2 px-2 text-right w-20 cursor-pointer hover:bg-slate-200/50"
                  >
                    BSR
                  </th>
                  <th
                    onClick={() => handleHeaderSort('reviews')}
                    className="py-2 px-1.5 text-right w-16 cursor-pointer hover:bg-slate-200/50"
                  >
                    Rev.
                  </th>
                  <th className="py-2 px-1 text-center w-8">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {sortedBooks.map((book, sortedIndex) => {
                  const isTop1 = sortedIndex === 0;
                  const isTop2 = sortedIndex === 1;
                  const isTop3 = sortedIndex === 2;

                  return (
                    <tr
                      key={book.asin}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        isTop1
                          ? 'bg-amber-500/10 font-medium'
                          : isTop2
                          ? 'bg-indigo-500/10'
                          : isTop3
                          ? 'bg-orange-500/10'
                          : book.isOpp
                          ? 'bg-emerald-500/5 dark:bg-emerald-500/10'
                          : ''
                      }`}
                    >
                      <td className="py-2 px-1.5 text-center font-mono font-bold">
                        {isTop1 ? (
                          <span className="text-amber-600 dark:text-amber-400">🥇 1</span>
                        ) : isTop2 ? (
                          <span className="text-indigo-600 dark:text-indigo-400">🥈 2</span>
                        ) : isTop3 ? (
                          <span className="text-orange-600 dark:text-orange-400">🥉 3</span>
                        ) : (
                          <span className="text-slate-500">#{book.originalIndex}</span>
                        )}
                      </td>
                    <td className="py-2 px-2 max-w-[150px]">
                      <a
                        href={book.productUrl || `https://www.amazon.com/dp/${book.asin}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-1"
                        title={book.title}
                      >
                        {book.title}
                      </a>
                      <div className="text-[10px] text-slate-400 truncate">
                        {book.author || book.asin}
                      </div>
                    </td>
                    <td className="py-2 px-1.5 text-right font-medium text-slate-800 dark:text-slate-200">
                      {book.price !== undefined ? `$${book.price.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {book.bsrOverall ? `#${book.bsrOverall.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2 px-1.5 text-right font-mono text-slate-600 dark:text-slate-300">
                      {book.reviewCount ?? '-'}
                    </td>
                    <td className="py-2 px-1 text-center">
                      <WatchButton
                        book={book}
                        size="sm"
                        showLabel={false}
                        onWatchChange={(isWatched) => {
                          if (isWatched && onAddToWatchlist) {
                            onAddToWatchlist(book);
                          }
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Footer */}
      <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400 text-center shrink-0">
        Estimates are rough. BSR to sales mapping is configurable in Settings.
      </div>
    </div>
  );
};
