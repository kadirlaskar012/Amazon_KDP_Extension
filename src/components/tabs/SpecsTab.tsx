// src/components/tabs/SpecsTab.tsx
// Common Specs Analyzer tab: Page counts, trim sizes, pricing distributions, format share, and recommended specs

import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import type { SearchSnapshot, SpecsSummary } from '../../types';
import { analyzeSpecs } from '../../services/specsAnalysis';

interface SpecsTabProps {
  snapshot?: SearchSnapshot | null;
  onUpdateSnapshotSpecs?: (specs: SpecsSummary) => void;
}

export const SpecsTab: React.FC<SpecsTabProps> = ({ snapshot, onUpdateSnapshotSpecs }) => {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Compute specs from snapshot top 10 books or use existing saved specs
  const specs = useMemo<SpecsSummary>(() => {
    if (snapshot?.specs) {
      return snapshot.specs;
    }
    const computed = analyzeSpecs(snapshot?.books || []);
    return computed;
  }, [snapshot]);

  // Keep snapshot updated if not already saved
  React.useEffect(() => {
    if (!snapshot?.specs && snapshot?.books && snapshot.books.length > 0) {
      const computed = analyzeSpecs(snapshot.books);
      if (onUpdateSnapshotSpecs) {
        onUpdateSnapshotSpecs(computed);
      }
    }
  }, [snapshot, onUpdateSnapshotSpecs]);

  const showCopyToast = (msg: string) => {
    setCopyFeedback(msg);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  const handleCopyTsv = () => {
    const lines = [
      'SPECIFICATION METRIC\tVALUE\tDETAILS',
      `Page Count (Median)\t${specs.pageCount.median} pages\tMin: ${specs.pageCount.min}, Max: ${specs.pageCount.max}, Range: ${specs.pageCount.mostCommonRange}`,
      `Trim Size (Standard)\t${specs.trimSize.mostCommon}\t${specs.trimSize.count} books (${specs.trimSize.percentage}%)`,
      `Price (Median)\t$${specs.price.median.toFixed(2)}\tMin: $${specs.price.min.toFixed(2)}, Max: $${specs.price.max.toFixed(2)}, Common: $${specs.price.mostCommonPoint.toFixed(2)}`,
      `Reading Age\t${specs.readingAge.mostCommon}\t${specs.readingAge.count} occurrences`,
      `Format Share\t${specs.formatShare.percentage}% Low Content\t${specs.formatShare.lowContentCount} of ${specs.formatShare.total} books`,
      `Recommended Pages\t${specs.recommended.pageCount} pages\t${specs.recommended.pageCountReason}`,
      `Recommended Trim\t${specs.recommended.trimSize}\t${specs.recommended.trimSizeReason}`,
      `Recommended Price\t${specs.recommended.priceRange}\t${specs.recommended.priceReason}`,
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    showCopyToast('Copied specs summary as TSV!');
  };

  const hasBooks = (snapshot?.books || []).length > 0;

  return (
    <div className="space-y-4 text-xs font-sans text-slate-700 dark:text-slate-200 no-horizontal-scroll">
      {/* Toast Notification */}
      {copyFeedback && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-xl animate-fade-in">
          ✓ {copyFeedback}
        </div>
      )}

      {/* Header & Export */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">Competitor Book Specifications</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Synthesized across top 10 organic listings
          </p>
        </div>
        {hasBooks && (
          <button
            onClick={handleCopyTsv}
            className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Copy TSV
          </button>
        )}
      </div>

      {hasBooks ? (
        <>
          {/* Highlight Recommended Spec Card */}
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-50/60 dark:from-indigo-950/40 via-white dark:via-slate-900 to-white dark:to-slate-900 p-3.5 shadow-xs">
            <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-indigo-100 dark:border-indigo-500/20">
              <span className="text-base">✨</span>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">Recommended Niche Specification</h4>
            </div>

            <div className="space-y-2 text-xs">
              {/* Pages */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Page Count:</span>
                  <span className="ml-1.5 font-bold text-slate-900 dark:text-white">{specs.recommended.pageCount} pages</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{specs.recommended.pageCountReason}</p>
                </div>
              </div>

              {/* Trim */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Trim Size:</span>
                  <span className="ml-1.5 font-bold text-indigo-600 dark:text-indigo-300">{specs.recommended.trimSize}</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{specs.recommended.trimSizeReason}</p>
                </div>
              </div>

              {/* Price */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Price Target:</span>
                  <span className="ml-1.5 font-bold text-emerald-600 dark:text-emerald-400">{specs.recommended.priceRange}</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{specs.recommended.priceReason}</p>
                </div>
              </div>

              {/* Reading Age */}
              {specs.recommended.readingAge && (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Target Age:</span>
                    <span className="ml-1.5 font-bold text-amber-600 dark:text-amber-300">{specs.recommended.readingAge}</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{specs.recommended.readingAgeReason}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4 Quick Stat Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Page Count */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
              <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400">Page Count</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg font-bold text-slate-900 dark:text-white">{specs.pageCount.median || 'N/A'}</span>
                <span className="text-xs text-slate-400">med</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Range: {specs.pageCount.min} - {specs.pageCount.max} pages
              </p>
            </div>

            {/* Trim Size */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
              <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400">Trim Size</span>
              <div className="mt-1">
                <span className="text-base font-bold text-slate-900 dark:text-white truncate block" title={specs.trimSize.mostCommon}>
                  {specs.trimSize.mostCommon}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {specs.trimSize.percentage}% of competitors
              </p>
            </div>

            {/* Price Point */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
              <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400">Price Point</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {specs.price.median ? `$${specs.price.median.toFixed(2)}` : 'N/A'}
                </span>
                <span className="text-xs text-slate-400">med</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                ${specs.price.min.toFixed(2)} - ${specs.price.max.toFixed(2)}
              </p>
            </div>

            {/* Reading Age / Format */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
              <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400">Format & Age</span>
              <div className="mt-1">
                <span className="text-base font-bold text-slate-900 dark:text-white truncate block">
                  {specs.readingAge.mostCommon !== 'N/A' ? specs.readingAge.mostCommon : 'All Ages'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {specs.formatShare.percentage}% Low-content / Activity
              </p>
            </div>
          </div>

          {/* Bar Chart 1: Page Count Distribution */}
          {specs.pageCount.distribution.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
              <h5 className="font-bold text-slate-900 dark:text-white text-xs mb-2">Page Count Distribution</h5>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={specs.pageCount.distribution} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                      formatter={(val: any) => [`${val} books`, 'Count']}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Bar Chart 2: Price Distribution */}
          {specs.price.distribution.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
              <h5 className="font-bold text-slate-900 dark:text-white text-xs mb-2">Price Distribution</h5>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={specs.price.distribution} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                      formatter={(val: any) => [`${val} books`, 'Count']}
                    />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Royalty Calculator Reminder Note */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-3 text-xs text-slate-600 dark:text-slate-400 shadow-2xs leading-relaxed">
            ℹ️ <strong className="text-slate-900 dark:text-slate-200">Printing Cost Note:</strong> Check the official royalty calculator in KDP for exact printing costs based on your final page count and trim size.
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-6 text-center text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
          <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No book data available</p>
          <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
            Perform an Amazon search to analyze page counts, trim sizes, and competitor specs.
          </p>
        </div>
      )}
    </div>
  );
};
