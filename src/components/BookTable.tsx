import type { Book } from '../types';
import { ExternalLink, BookmarkPlus, Sparkles, Layers } from 'lucide-react';

interface BookTableProps {
  books: Book[];
  onAddToWatchlist?: (book: Book) => void;
  showOnlyOpportunities?: boolean;
}

export const BookTable: React.FC<BookTableProps> = ({
  books,
  onAddToWatchlist,
  showOnlyOpportunities = false,
}) => {
  const displayedBooks = showOnlyOpportunities
    ? books.filter((b) => b.isOpportunity)
    : books;

  if (books.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p className="text-sm">No organic book results parsed yet.</p>
        <p className="text-xs mt-1 opacity-70">
          Ensure you are on an Amazon search results page.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="sticky top-0 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold z-10">
          <tr>
            <th className="py-2 px-2.5 w-7 text-center">#</th>
            <th className="py-2 px-2">Book Title & Details</th>
            <th className="py-2 px-2 text-right">Price</th>
            <th className="py-2 px-2 text-right">BSR</th>
            <th className="py-2 px-2 text-center w-8">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {displayedBooks.map((book, idx) => {
            const hasBsr = book.bsrOverall !== undefined;
            const isWeak =
              hasBsr &&
              book.bsrOverall! < 100000 &&
              ((book.reviewCount !== undefined && book.reviewCount < 30) ||
                (book.rating !== undefined && book.rating < 4.0));

            return (
              <tr
                key={book.asin}
                className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                  isWeak ? 'bg-amber-500/5' : ''
                }`}
              >
                {/* Index / Rank */}
                <td className="py-2.5 px-2.5 text-center text-slate-400 font-mono text-[11px] align-top">
                  {idx + 1}
                </td>

                {/* Title & Metadata */}
                <td className="py-2.5 px-2 align-top max-w-[210px]">
                  <div className="flex items-start gap-1">
                    <a
                      href={book.productUrl || `https://www.amazon.com/dp/${book.asin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2 leading-tight"
                      title={book.title}
                    >
                      {book.title}
                    </a>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0 text-slate-400 mt-0.5" />
                  </div>

                  {/* Subtitle if available */}
                  {book.subtitle && (
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {book.subtitle}
                    </p>
                  )}

                  {/* Author, rating, specs pills */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                    <span className="truncate max-w-[110px]" title={book.author}>
                      {book.author || 'N/A'}
                    </span>

                    {book.rating !== undefined && (
                      <span className="inline-flex items-center text-amber-500 font-medium">
                        ★ {book.rating.toFixed(1)}
                        {book.reviewCount !== undefined && (
                          <span className="text-slate-400 font-normal ml-0.5">
                            ({book.reviewCount.toLocaleString()})
                          </span>
                        )}
                      </span>
                    )}

                    {/* Page count pill */}
                    {book.pageCount !== undefined && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300">
                        <Layers className="w-2.5 h-2.5" />
                        {book.pageCount}p
                      </span>
                    )}

                    {/* Trim size */}
                    {book.trimSize && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300">
                        {book.trimSize}
                      </span>
                    )}

                    {/* Opportunity Badge */}
                    {isWeak && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                        <Sparkles className="w-2.5 h-2.5" />
                        Opportunity
                      </span>
                    )}
                  </div>

                  {/* Category sub-ranks preview */}
                  {book.categoryRanks && book.categoryRanks.length > 0 && book.categoryRanks[0] && (
                    <div className="mt-1 text-[10px] text-blue-600 dark:text-blue-400 truncate">
                      #{book.categoryRanks[0].rank} in {book.categoryRanks[0].name}
                    </div>
                  )}
                </td>

                {/* Price */}
                <td className="py-2.5 px-2 text-right align-top whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                  {book.price !== undefined ? `$${book.price.toFixed(2)}` : 'N/A'}
                </td>

                {/* BSR */}
                <td className="py-2.5 px-2 text-right align-top whitespace-nowrap">
                  {hasBsr ? (
                    <div className="font-mono text-slate-900 dark:text-slate-100 font-medium">
                      #{book.bsrOverall?.toLocaleString()}
                    </div>
                  ) : (
                    <div className="inline-block w-12 h-3.5 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
                  )}
                </td>

                {/* Action button */}
                <td className="py-2.5 px-2 text-center align-top">
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
  );
};
