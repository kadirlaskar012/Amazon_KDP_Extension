// src/components/tabs/OverviewTab.tsx
// Plain HTML utilitarian Overview tab
// NOTE: Seasonality block has been moved to the dedicated SeasonalityTab.
import React, { useMemo } from 'react';
import type { Book, Settings, NicheScore, KeywordItem } from '../../types';
import { ScoreGauge } from '../ScoreGauge';
import { FactorBars } from '../FactorBars';
import { isOpportunity } from '../../services/weakCompetitor';
import { estimateNicheRevenue } from '../../services/salesEstimator';

interface OverviewTabProps {
  query: string;
  books: Book[];
  score?: NicheScore;
  settings: Settings;
  date?: number;
  keywords?: KeywordItem[];
  onGoToBooks: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  query,
  books,
  score,
  settings,
  date,
  keywords = [],
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
    <div className="p-2 space-y-2.5" style={{ color: 'var(--text)' }}>
      {/* 1. Score Readout */}
      <div className="p-2 border border-[var(--line)] bg-[var(--bg)]">
        <ScoreGauge score={score} query={query} date={date} />
        <div
          className="mt-1 pt-1 border-t border-[var(--line)]"
          style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}
        >
          Score is a rule-based estimate from the data shown, not a guarantee of sales.
        </div>
      </div>

      {/* 2. Verdict */}
      {score?.verdict && (
        <div className="p-2 border border-[var(--line)] font-medium">
          {score.verdict}
        </div>
      )}

      {/* 3. Warnings box if data is weak */}
      {score?.warnings && score.warnings.length > 0 && (
        <div className="p-2 border border-[var(--line)] space-y-1">
          <div className="font-bold" style={{ color: 'var(--warn)' }}>
            Data Quality Notice
          </div>
          <ul className="list-disc list-inside space-y-0.5" style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
            {score.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 4. Key Metrics table */}
      <div className="space-y-1">
        <div className="section-subheading">Niche Key Metrics (Top 10)</div>
        <table className="plain-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th style={{ width: '140px', textAlign: 'right' }}>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Avg BSR (Top 10)</td>
              <td className="text-right font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
                {avgBsr !== null ? `#${avgBsr.toLocaleString()}` : 'N/A'}
              </td>
            </tr>
            <tr>
              <td>Median Reviews</td>
              <td className="text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                {medianReviews !== null ? medianReviews.toLocaleString() : 'N/A'}
              </td>
            </tr>
            <tr>
              <td>Avg Price</td>
              <td className="text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                {avgPrice !== null ? `$${avgPrice.toFixed(2)}` : 'N/A'}
              </td>
            </tr>
            <tr>
              <td>
                <button
                  onClick={onGoToBooks}
                  className="plain-link cursor-pointer text-left bg-transparent border-0 p-0"
                >
                  Opportunities (Top 10)
                </button>
              </td>
              <td className="text-right font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--good)' }}>
                {opportunityCount} / {top10.length}
              </td>
            </tr>
            <tr>
              <td>
                Estimated niche monthly revenue{' '}
                <span style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>(rough estimate)</span>
              </td>
              <td className="text-right font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--good)' }}>
                ~${nicheRev.totalMonthlyRoyalty.value.toLocaleString()}/mo
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 5. Factor Breakdown Table */}
      <FactorBars breakdown={score?.breakdown} />
    </div>
  );
};
