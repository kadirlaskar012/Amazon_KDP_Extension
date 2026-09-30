import React from 'react';
import type { Book, Settings, NicheScore } from '../../types';
import { ScoreGauge } from '../ScoreGauge';
import { FactorBars } from '../FactorBars';
import { isOpportunity } from '../../services/weakCompetitor';
import { estimateNicheRevenue } from '../../services/salesEstimator';
import {
  TrendingUp,
  MessageSquare,
  DollarSign,
  Coins,
  Sparkles,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface OverviewTabProps {
  query: string;
  books: Book[];
  score?: NicheScore;
  settings: Settings;
  date?: number;
  onGoToBooks: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  query,
  books,
  score,
  settings,
  date,
  onGoToBooks,
}) => {
  const top10 = books.slice(0, 10);

  // 1. Avg BSR (top 10 with BSR)
  const bsrBooks = top10.filter((b) => b.bsrOverall !== undefined && b.bsrOverall > 0);
  const avgBsr =
    bsrBooks.length > 0
      ? Math.round(bsrBooks.reduce((sum, b) => sum + b.bsrOverall!, 0) / bsrBooks.length)
      : null;

  // 2. Median reviews (top 10)
  const reviewCounts = top10
    .filter((b) => b.reviewCount !== undefined)
    .map((b) => b.reviewCount!)
    .sort((a, b) => a - b);
  let medianReviews: number | null = null;
  if (reviewCounts.length > 0) {
    const mid = Math.floor(reviewCounts.length / 2);
    medianReviews =
      reviewCounts.length % 2 !== 0
        ? reviewCounts[mid]!
        : Math.round(((reviewCounts[mid - 1] ?? 0) + (reviewCounts[mid] ?? 0)) / 2);
  }

  // 3. Avg Price (top 10)
  const priceBooks = top10.filter((b) => b.price !== undefined && b.price > 0);
  const avgPrice =
    priceBooks.length > 0
      ? Number((priceBooks.reduce((sum, b) => sum + b.price!, 0) / priceBooks.length).toFixed(2))
      : null;

  // 4. Estimated Niche Monthly Revenue
  const nicheRev = estimateNicheRevenue(top10, settings);

  // 5. Opportunity books count
  const opportunityCount = top10.filter((b) => isOpportunity(b, settings.thresholds)).length;

  return (
    <div className="p-3.5 space-y-3.5 font-sans">
      {/* 1. Score Gauge Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <ScoreGauge score={score} query={query} date={date} />

        {/* Verdict Box */}
        {score?.verdict && (
          <div
            className={`mx-3 mb-3 p-2.5 rounded-xl text-xs font-medium border flex items-start gap-2 ${
              score.label === 'green'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                : score.label === 'yellow'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                : score.label === 'red'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
                : 'bg-slate-500/10 border-slate-500/30 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-snug">{score.verdict}</div>
          </div>
        )}
      </div>

      {/* 2. Warnings box if data is weak */}
      {score?.warnings && score.warnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1">
          <div className="font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            Data Quality Notice
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
            {score.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Stat Cards Row */}
      <div className="grid grid-cols-2 gap-2">
        {/* Avg BSR */}
        <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <TrendingUp className="w-3 h-3 text-blue-500" />
            <span>Avg. BSR (Top 10)</span>
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
            {avgBsr !== null ? `#${avgBsr.toLocaleString()}` : 'N/A'}
          </div>
        </div>

        {/* Median Reviews */}
        <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <MessageSquare className="w-3 h-3 text-indigo-500" />
            <span>Median Reviews</span>
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
            {medianReviews !== null ? medianReviews.toLocaleString() : 'N/A'}
          </div>
        </div>

        {/* Avg Price */}
        <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <DollarSign className="w-3 h-3 text-emerald-500" />
            <span>Avg. Price</span>
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
            {avgPrice !== null ? `$${avgPrice.toFixed(2)}` : 'N/A'}
          </div>
        </div>

        {/* Opportunity Books */}
        <div
          onClick={onGoToBooks}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs cursor-pointer hover:border-blue-400 transition"
        >
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Opportunities</span>
          </div>
          <div className="text-base font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
            {opportunityCount} <span className="text-[10px] text-slate-400 font-normal">/ {top10.length}</span>
          </div>
        </div>

        {/* Estimated Niche Monthly Royalty (Full width) */}
        <div className="col-span-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-blue-500/10 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <Coins className="w-3.5 h-3.5" />
              <span>Est. Top 10 Monthly Royalty</span>
            </div>
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
              Rough Estimate
            </span>
          </div>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            ~${nicheRev.totalMonthlyRoyalty.value.toLocaleString()}
            <span className="text-xs font-normal text-slate-500 ml-1">/month</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Avg ~${nicheRev.avgMonthlyRoyalty.value.toLocaleString()}/book · Median ~${nicheRev.medianMonthlyRoyalty.value.toLocaleString()}/book
          </div>
        </div>
      </div>

      {/* 4. 5-Factor Breakdown Bars */}
      <FactorBars breakdown={score?.breakdown} />
    </div>
  );
};
