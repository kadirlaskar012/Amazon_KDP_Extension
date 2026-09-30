import type { Book, QueueProgressState } from '../types';
import { BookOpen, Sparkles, TrendingUp, DollarSign } from 'lucide-react';

interface OverviewTabProps {
  query: string;
  books: Book[];
  queueStatus: QueueProgressState;
  onGoToBooks: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  query,
  books,
  queueStatus,
  onGoToBooks,
}) => {
  const booksWithBsr = books.filter((b) => b.bsrOverall !== undefined);
  const opportunities = books.filter((b) => {
    return (
      b.bsrOverall !== undefined &&
      b.bsrOverall < 100000 &&
      ((b.reviewCount !== undefined && b.reviewCount < 30) ||
        (b.rating !== undefined && b.rating < 4.0))
    );
  });

  const avgPrice =
    books.length > 0
      ? books.reduce((acc, b) => acc + (b.price || 0), 0) / (books.filter((b) => b.price).length || 1)
      : 0;

  return (
    <div className="p-4 space-y-4">
      {/* Search Header Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 border border-blue-500/20">
        <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
          Current Search Query
        </div>
        <div className="text-base font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
          {query || 'Amazon Books Search'}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {books.length} organic results parsed · {booksWithBsr.length} detailed
        </div>
      </div>

      {/* Quick Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <BookOpen className="w-3.5 h-3.5 text-blue-500" />
            <span>Organic Books</span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {books.length}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Opportunities</span>
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {opportunities.length}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span>Avg. Price</span>
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            ${avgPrice.toFixed(2)}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
            <span>Details Fetched</span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {booksWithBsr.length}/{books.length}
          </div>
        </div>
      </div>

      {/* Phase 1 Overview Prompt */}
      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-xs space-y-2">
        <div className="font-semibold text-slate-800 dark:text-slate-200">
          Phase 1: Search Reader & Fetch Queue Active
        </div>
        <p className="text-slate-500 leading-relaxed">
          The extension parses top organic book results on this page and queues background requests to enrich BSR, category ranks, page counts, and trim sizes.
        </p>
        <button
          onClick={onGoToBooks}
          className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition"
        >
          View Organic Results Table ({books.length})
        </button>
      </div>
    </div>
  );
};
