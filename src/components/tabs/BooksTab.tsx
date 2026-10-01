import React, { useState, useMemo } from 'react';
import type { Book, Settings } from '../../types';
import { isOpportunity, getOpportunityReasons } from '../../services/weakCompetitor';
import { estimateMonthlySales, estimateMonthlyRoyalty } from '../../services/salesEstimator';
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
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
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

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <span style={{ color: 'var(--muted)' }} className="ml-0.5">↕</span>;
    }
    return <span className="ml-0.5">{sortAsc ? '▲' : '▼'}</span>;
  };

  return (
    <div className="flex flex-col h-full no-horizontal-scroll" style={{ color: 'var(--text)' }}>
      {/* 1. Toolbar */}
      <div className="p-2 border-b border-[var(--line)] bg-[var(--bg)] space-y-1.5 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Search text filter */}
          <input
            type="text"
            placeholder="Filter title, author or ASIN..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="plain-input flex-1 min-w-[140px]"
          />

          {/* View Toggle */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`plain-btn plain-btn-sm ${viewMode === 'table' ? 'font-bold underline' : ''}`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`plain-btn plain-btn-sm ${viewMode === 'cards' ? 'font-bold underline' : ''}`}
            >
              Cards
            </button>
          </div>

          {/* Copy TSV button */}
          <button
            onClick={handleCopyTsv}
            title="Copy table data as TSV (for Excel / Google Sheets)"
            className="plain-btn plain-btn-sm"
          >
            {copiedTsv ? 'Copied TSV' : 'Copy TSV'}
          </button>
        </div>

        {/* Opportunity filter toggle & Sort selector */}
        <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
          <label className="inline-flex items-center gap-1 cursor-pointer select-none" style={{ fontSize: 'var(--font-small)' }}>
            <input
              type="checkbox"
              checked={showOnlyOpportunities}
              onChange={(e) => setShowOnlyOpportunities(e.target.checked)}
              className="cursor-pointer"
            />
            <span>Opportunities only</span>
          </label>

          <div className="flex items-center gap-1.5">
            <select
              value={sortField}
              onChange={(e) => {
                setSortField(e.target.value as SortField);
                setSortAsc(e.target.value === 'bsr' || e.target.value === 'index');
              }}
              className="plain-select"
              style={{ fontSize: 'var(--font-small)' }}
            >
              <option value="bsr">Sort: BSR</option>
              <option value="sales">Sort: Est. Sales</option>
              <option value="royalty">Sort: Royalty</option>
              <option value="price">Sort: Price</option>
              <option value="reviews">Sort: Reviews</option>
              <option value="rating">Sort: Rating</option>
              <option value="index">Sort: Original #</option>
            </select>

            <span style={{ fontSize: 'var(--font-small)', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
              {sortedBooks.length}/{books.length}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Content: Table View (default) or Cards View */}
      <div className="flex-1 overflow-y-auto overflow-x-auto p-0">
        {viewMode === 'table' ? (
          /* Books table: horizontally scrollable, title column truncates with ellipsis + tooltip */
          <div className="table-scroll-x">
            <table className="plain-table table-sticky-first" style={{ minWidth: '480px' }}>
              <thead>
                <tr>
                  <th
                    onClick={() => handleHeaderSort('index')}
                    className="w-8 text-center cursor-pointer"
                    title="Original search rank"
                  >
                    #{renderSortIndicator('index')}
                  </th>
                  <th
                    onClick={() => handleHeaderSort('title')}
                    className="cursor-pointer"
                    style={{ minWidth: '140px', maxWidth: '220px' }}
                  >
                    Title / Author{renderSortIndicator('title')}
                  </th>
                  <th
                    onClick={() => handleHeaderSort('price')}
                    className="text-right cursor-pointer"
                    style={{ width: '56px' }}
                  >
                    Price{renderSortIndicator('price')}
                  </th>
                  <th
                    onClick={() => handleHeaderSort('bsr')}
                    className="text-right cursor-pointer"
                    style={{ width: '72px' }}
                  >
                    BSR{renderSortIndicator('bsr')}
                  </th>
                  <th
                    onClick={() => handleHeaderSort('reviews')}
                    className="text-right cursor-pointer"
                    style={{ width: '54px' }}
                  >
                    Rev{renderSortIndicator('reviews')}
                  </th>
                  <th className="text-center" style={{ width: '80px' }}>Status</th>
                  <th className="text-center" style={{ width: '48px' }}>Save</th>
                </tr>
              </thead>
              <tbody>
                {sortedBooks.map((book) => {
                  return (
                    <tr
                      key={book.asin}
                      className={book.isOpp ? 'bg-[var(--row-highlight)]' : undefined}
                    >
                      <td className="text-center" style={{ fontFamily: 'var(--font-mono)' }}>
                        {book.originalIndex}
                      </td>
                      <td style={{ maxWidth: '220px' }}>
                        <a
                          href={book.productUrl || `https://www.amazon.com/dp/${book.asin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="plain-link"
                          title={book.title}
                          style={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
                          }}
                        >
                          {book.title}
                        </a>
                        <div
                          style={{
                            fontSize: 'var(--font-small)',
                            color: 'var(--muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {book.author || book.asin}
                        </div>
                      </td>
                      <td className="text-right">
                        {book.price !== undefined ? `$${book.price.toFixed(2)}` : '-'}
                      </td>
                      <td className="text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                        {book.bsrOverall ? `#${book.bsrOverall.toLocaleString()}` : '-'}
                      </td>
                      <td className="text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                        {book.reviewCount ?? '-'}
                      </td>
                      <td className="text-center">
                        {book.isOpp ? (
                          <span className="font-bold" style={{ color: 'var(--good)', fontSize: 'var(--font-small)' }}>
                            Opp.
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>-</span>
                        )}
                      </td>
                      <td className="text-center">
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
        ) : (
          /* Cards View - plain 1px bordered boxes */
          <div className="space-y-2 p-2">
            {sortedBooks.map((book, sortedIndex) => {
              const hasBsr = book.bsrOverall !== undefined;
              const amazonUrl = book.productUrl || `https://www.amazon.com/dp/${book.asin}`;

              return (
                <div
                  key={book.asin}
                  className={`border border-[var(--line)] p-2 space-y-1.5 ${
                    book.isOpp ? 'bg-[var(--row-highlight)]' : 'bg-[var(--bg)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
                        #{book.originalIndex}
                      </span>
                      {sortedIndex < 3 && (
                        <span style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
                          [{sortedIndex + 1} Target]
                        </span>
                      )}
                      {book.isOpp && (
                        <span className="font-bold" style={{ fontSize: 'var(--font-small)', color: 'var(--good)' }}>
                          Opportunity
                        </span>
                      )}
                    </div>
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

                  <div>
                    <a
                      href={amazonUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="plain-link"
                      title={book.title}
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      } as React.CSSProperties}
                    >
                      {book.title}
                    </a>
                    <div className="mt-0.5" style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
                      {book.author || 'Author N/A'} | {book.asin} {book.publishDate ? `| ${book.publishDate}` : ''}
                    </div>
                  </div>

                  {/* 2-row plain metrics table */}
                  <table className="plain-table w-full">
                    <tbody>
                      <tr>
                        <td style={{ color: 'var(--muted)', width: '96px' }}>BSR Rank</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {hasBsr ? `#${book.bsrOverall?.toLocaleString()}` : 'Pending'}
                          {book.salesEst !== null ? ` (~${book.salesEst.toLocaleString()} sales/mo)` : ''}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--muted)' }}>Price &amp; Roy.</td>
                        <td>
                          {book.price !== undefined ? `$${book.price.toFixed(2)}` : 'N/A'}
                          {book.royaltyEst !== null ? ` (~$${Math.round(book.royaltyEst)}/mo royalty)` : ''}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--muted)' }}>Rating / Reviews</td>
                        <td>
                          {book.rating !== undefined ? `${book.rating.toFixed(1)} / 5` : 'N/A'}{' '}
                          ({book.reviewCount !== undefined ? book.reviewCount.toLocaleString() : 0} reviews)
                          {book.pageCount ? ` | ${book.pageCount}p` : ''}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {book.isOpp && book.reasons && book.reasons.length > 0 && (
                    <div style={{ fontSize: 'var(--font-small)', color: 'var(--good)' }}>
                      Reasons: {book.reasons.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Footer */}
      <div
        className="p-1.5 border-t border-[var(--line)] bg-[var(--bg)] text-center shrink-0"
        style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}
      >
        Estimates are rough. BSR to sales mapping is configurable in Settings.
      </div>
    </div>
  );
};
