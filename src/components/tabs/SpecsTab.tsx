// src/components/tabs/SpecsTab.tsx
// Common Specs Analyzer tab: Page counts, trim sizes, pricing distributions, format share, and recommended specs

import React, { useMemo, useState } from 'react';
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
    showCopyToast('Copied specs summary as TSV');
  };

  const hasBooks = (snapshot?.books || []).length > 0;

  return (
    <div className="space-y-3 text-[13px] leading-[1.4] no-horizontal-scroll">
      {/* Toast Notification */}
      {copyFeedback && (
        <div className="p-1 border border-[var(--line)] bg-[var(--bg)] text-[var(--good)] text-xs">
          {copyFeedback}
        </div>
      )}

      {/* Header & Export */}
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div>
          <span className="font-bold text-xs">Competitor Book Specifications</span>
          <div className="text-[11px] text-[var(--muted)]">
            Synthesized across top 10 organic listings
          </div>
        </div>
        {hasBooks && (
          <button
            onClick={handleCopyTsv}
            className="plain-btn text-xs px-2 py-0.5"
          >
            Copy TSV
          </button>
        )}
      </div>

      {hasBooks ? (
        <>
          {/* Highlight Recommended Spec: Plain 2-column table */}
          <div className="border border-[var(--line)] p-2 space-y-1.5">
            <span className="font-bold text-xs">Recommended Niche Specification</span>
            <table className="plain-table w-full text-xs">
              <thead>
                <tr>
                  <th className="w-28">Spec</th>
                  <th className="w-32">Target</th>
                  <th>Reasoning</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">Page Count</td>
                  <td className="font-bold">{specs.recommended.pageCount} pages</td>
                  <td className="text-[var(--muted)]">{specs.recommended.pageCountReason}</td>
                </tr>
                <tr>
                  <td className="font-medium">Trim Size</td>
                  <td className="font-bold">{specs.recommended.trimSize}</td>
                  <td className="text-[var(--muted)]">{specs.recommended.trimSizeReason}</td>
                </tr>
                <tr>
                  <td className="font-medium">Price Target</td>
                  <td className="font-bold">{specs.recommended.priceRange}</td>
                  <td className="text-[var(--muted)]">{specs.recommended.priceReason}</td>
                </tr>
                {specs.recommended.readingAge && (
                  <tr>
                    <td className="font-medium">Target Age</td>
                    <td className="font-bold">{specs.recommended.readingAge}</td>
                    <td className="text-[var(--muted)]">{specs.recommended.readingAgeReason}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Metrics: Simple 2-column key metrics table */}
          <div className="border border-[var(--line)] p-2 space-y-1.5">
            <span className="font-bold text-xs">Competitor Summary Metrics</span>
            <table className="plain-table w-full text-xs">
              <thead>
                <tr>
                  <th className="w-36">Metric</th>
                  <th>Competitor Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-[var(--muted)]">Page Count (Median)</td>
                  <td className="font-mono">
                    {specs.pageCount.median || 'N/A'} pages (Range: {specs.pageCount.min} - {specs.pageCount.max})
                  </td>
                </tr>
                <tr>
                  <td className="text-[var(--muted)]">Standard Trim Size</td>
                  <td>
                    {specs.trimSize.mostCommon} ({specs.trimSize.percentage}% of competitors)
                  </td>
                </tr>
                <tr>
                  <td className="text-[var(--muted)]">Price Point (Median)</td>
                  <td className="font-mono">
                    {specs.price.median ? `$${specs.price.median.toFixed(2)}` : 'N/A'} (Range: ${specs.price.min.toFixed(2)} - ${specs.price.max.toFixed(2)})
                  </td>
                </tr>
                <tr>
                  <td className="text-[var(--muted)]">Format &amp; Age</td>
                  <td>
                    {specs.readingAge.mostCommon !== 'N/A' ? specs.readingAge.mostCommon : 'All Ages'} | {specs.formatShare.percentage}% Low-content/Activity
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Distributions in plain tables */}
          <div className="grid grid-cols-2 gap-2">
            {specs.pageCount.distribution.length > 0 && (
              <div className="border border-[var(--line)] p-1.5 space-y-1">
                <span className="font-bold text-xs">Page Count Dist.</span>
                <table className="plain-table w-full text-xs">
                  <thead>
                    <tr>
                      <th>Range</th>
                      <th className="w-12 text-right">Books</th>
                    </tr>
                  </thead>
                  <tbody>
                    {specs.pageCount.distribution.map((d) => (
                      <tr key={d.range}>
                        <td>{d.range}</td>
                        <td className="text-right font-mono">{d.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {specs.price.distribution.length > 0 && (
              <div className="border border-[var(--line)] p-1.5 space-y-1">
                <span className="font-bold text-xs">Price Dist.</span>
                <table className="plain-table w-full text-xs">
                  <thead>
                    <tr>
                      <th>Range</th>
                      <th className="w-12 text-right">Books</th>
                    </tr>
                  </thead>
                  <tbody>
                    {specs.price.distribution.map((d) => (
                      <tr key={d.range}>
                        <td>{d.range}</td>
                        <td className="text-right font-mono">{d.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Royalty Calculator Reminder Note */}
          <div className="border border-[var(--line)] p-2 text-xs text-[var(--muted)]">
            <strong>Printing Cost Note:</strong> Check the official royalty calculator in KDP for exact printing costs based on final page count and trim size.
          </div>
        </>
      ) : (
        <div className="border border-dashed border-[var(--line)] p-4 text-center text-[var(--muted)]">
          No book data available. Perform an Amazon search to analyze page counts, trim sizes, and competitor specs.
        </div>
      )}
    </div>
  );
};
