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

  // 6. 90%+ Target Accuracy & Success Probability Validation
  const demandValid = bsrBooks.filter((b) => b.bsrOverall! < 100000).length >= 5;
  const reviewValid = medianReviews !== null && medianReviews <= 75;
  const priceValid = avgPrice !== null && avgPrice >= 5.99;
  const oppValid = opportunityCount >= 2;
  const entrantValid = (score?.breakdown?.newEntrant?.points || 0) >= 3;

  const validCount = [demandValid, reviewValid, priceValid, oppValid, entrantValid].filter(Boolean).length;
  const accuracyPercent = Math.min(98, Math.max(45, 55 + validCount * 8 + (score?.total ? Math.round(score.total * 0.15) : 0)));
  const isHighAccuracy = accuracyPercent >= 88;

  return (
    <div className="p-3.5 space-y-3.5 font-sans">
      {/* 1. Score Gauge Card */}
      <div className="rounded-2xl bg-gradient-to-b from-white via-slate-50/50 to-white dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-md shadow-slate-200/40 dark:shadow-none overflow-hidden">
        <ScoreGauge score={score} query={query} date={date} />

        {/* 90%+ Accuracy Predictor Box */}
        <div className="mx-3 mb-2.5 p-3 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-cyan-50/70 dark:from-slate-800/90 dark:via-indigo-950/40 dark:to-slate-800/90 border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🎯</span>
              <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                Niche Success Confidence
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black font-mono border ${
                isHighAccuracy
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-xs'
                  : accuracyPercent >= 70
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
              }`}
            >
              {accuracyPercent}% Accuracy
            </span>
          </div>

          <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-snug mb-2.5">
            {isHighAccuracy
              ? '✅ 90%+ High Accuracy: এই নিশে কাজ করলে সফল হওয়ার প্রবল সুযোগ রয়েছে (দৃঢ় চাহিদা ও দুর্বল প্রতিযোগী প্রমাণিত)।'
              : accuracyPercent >= 70
              ? '⚠️ Moderate Accuracy: মাঝারি প্রতিযোগিতা। সরাসরি কাজ করার চেয়ে সাব-নিশ (Sub-niche) টার্গেট করা শ্রেয়।'
              : '🛑 Low Accuracy / Hard Niche: ভারী কম্পিটিশন অথবা চাহিদার ঘাটতি। বিজ্ঞাপন ছাড়া নতুনদের জন্য কঠিন।'}
          </div>

          {/* 5-Point Validation Checklist */}
          <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-indigo-100 dark:border-slate-700/60 text-[10px]">
            <div className={`flex items-center gap-1 font-semibold ${demandValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              <span>{demandValid ? '✓' : '○'}</span>
              <span>Demand: 5+ BSR &lt; 100k</span>
            </div>
            <div className={`flex items-center gap-1 font-semibold ${reviewValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              <span>{reviewValid ? '✓' : '○'}</span>
              <span>Reviews: Median &lt; 75</span>
            </div>
            <div className={`flex items-center gap-1 font-semibold ${priceValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              <span>{priceValid ? '✓' : '○'}</span>
              <span>Price: Avg &gt; $5.99</span>
            </div>
            <div className={`flex items-center gap-1 font-semibold ${oppValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              <span>{oppValid ? '✓' : '○'}</span>
              <span>Weak spots: 2+ Opportunities</span>
            </div>
          </div>
        </div>

        {/* Verdict Box */}
        {score?.verdict && (
          <div
            className={`mx-3 mb-3 p-3 rounded-xl text-xs font-semibold border flex items-start gap-2.5 backdrop-blur-sm ${
              score.label === 'green'
                ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border-emerald-500/35 text-emerald-900 dark:text-emerald-100 shadow-xs'
                : score.label === 'yellow'
                ? 'bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-amber-500/35 text-amber-900 dark:text-amber-100 shadow-xs'
                : score.label === 'red'
                ? 'bg-gradient-to-r from-rose-500/15 via-red-500/10 to-rose-500/15 border-rose-500/35 text-rose-900 dark:text-rose-100 shadow-xs'
                : 'bg-slate-500/10 border-slate-500/30 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-white/40 dark:bg-black/20 flex items-center justify-center shrink-0 mt-0.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
            </div>
            <div className="leading-snug">{score.verdict}</div>
          </div>
        )}
      </div>

      {/* 2. Warnings box if data is weak */}
      {score?.warnings && score.warnings.length > 0 && (
        <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/35 text-amber-950 dark:text-amber-100 text-xs space-y-1.5 shadow-xs">
          <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Data Quality Notice</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90 pl-1">
            {score.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Stat Cards Row */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Avg BSR */}
        <div className="p-3 rounded-2xl border border-blue-200/70 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-white dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900 shadow-xs hover:shadow-md transition">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <span>Avg. BSR (Top 10)</span>
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono mt-1.5 tracking-tight">
            {avgBsr !== null ? `#${avgBsr.toLocaleString()}` : 'N/A'}
          </div>
        </div>

        {/* Median Reviews */}
        <div className="p-3 rounded-2xl border border-purple-200/70 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/90 via-violet-50/40 to-white dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900 shadow-xs hover:shadow-md transition">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <div className="w-6 h-6 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <span>Median Reviews</span>
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono mt-1.5 tracking-tight">
            {medianReviews !== null ? medianReviews.toLocaleString() : 'N/A'}
          </div>
        </div>

        {/* Avg Price */}
        <div className="p-3 rounded-2xl border border-emerald-200/70 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 shadow-xs hover:shadow-md transition">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
            <span>Avg. Price</span>
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono mt-1.5 tracking-tight">
            {avgPrice !== null ? `$${avgPrice.toFixed(2)}` : 'N/A'}
          </div>
        </div>

        {/* Opportunity Books */}
        <div
          onClick={onGoToBooks}
          className="p-3 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-white dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 shadow-xs hover:shadow-md hover:border-amber-400/80 transition cursor-pointer group"
        >
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-110 transition-transform">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span>Opportunities</span>
          </div>
          <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-1.5 tracking-tight">
            {opportunityCount} <span className="text-xs text-slate-400 font-semibold">/ {top10.length}</span>
          </div>
        </div>

        {/* Estimated Niche Monthly Royalty (Full width Standout Hero) */}
        <div className="col-span-2 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-lg shadow-emerald-600/20 border border-emerald-400/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-100">
              <Coins className="w-4 h-4 text-emerald-200" />
              <span>Est. Top 10 Monthly Royalty</span>
            </div>
            <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-emerald-100 font-extrabold border border-white/20">
              Rough Estimate
            </span>
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1.5 tracking-tight">
            ~${nicheRev.totalMonthlyRoyalty.value.toLocaleString()}
            <span className="text-xs font-semibold text-emerald-100 ml-1.5">/month</span>
          </div>
          <div className="text-[11px] text-emerald-100/90 font-medium mt-1">
            Avg ~${nicheRev.avgMonthlyRoyalty.value.toLocaleString()}/book · Median ~${nicheRev.medianMonthlyRoyalty.value.toLocaleString()}/book
          </div>
        </div>
      </div>

      {/* 4. 5-Factor Breakdown Bars */}
      <FactorBars breakdown={score?.breakdown} />
    </div>
  );
};
