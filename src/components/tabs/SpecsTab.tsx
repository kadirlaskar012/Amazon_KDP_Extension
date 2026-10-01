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
    <div className="space-y-3 no-horizontal-scroll" style={{ color: 'var(--text)' }}>
      {/* Toast Notification */}
      {copyFeedback && (
        <div className="p-1 border border-[var(--line)] bg-[var(--bg)]" style={{ color: 'var(--good)', fontSize: 'var(--font-small)' }}>
          {copyFeedback}
        </div>
      )}

      {/* Header & Export */}
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div>
          <span className="section-subheading">Competitor Book Specifications</span>
          <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
            Synthesized across top 10 organic listings
          </div>
        </div>
        {hasBooks && (
          <button onClick={handleCopyTsv} className="plain-btn plain-btn-sm">Copy TSV</button>
        )}
      </div>

      {hasBooks ? (
        <>
          {/* Highlight Recommended Spec: Plain 2-column table */}
          <div className="border border-[var(--line)] p-2 space-y-1.5">
            <span className="section-subheading">Recommended Niche Specification</span>
            <table className="plain-table w-full">
              <thead>
                <tr>
                  <th style={{ width: '112px' }}>Spec</th>
                  <th style={{ width: '128px' }}>Target</th>
                  <th>Reasoning</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">Page Count</td>
                  <td className="font-bold">{specs.recommended.pageCount} pages</td>
                  <td style={{ color: 'var(--muted)' }}>{specs.recommended.pageCountReason}</td>
                </tr>
                <tr>
                  <td className="font-medium">Trim Size</td>
                  <td className="font-bold">{specs.recommended.trimSize}</td>
                  <td style={{ color: 'var(--muted)' }}>{specs.recommended.trimSizeReason}</td>
                </tr>
                <tr>
                  <td className="font-medium">Price Target</td>
                  <td className="font-bold">{specs.recommended.priceRange}</td>
                  <td style={{ color: 'var(--muted)' }}>{specs.recommended.priceReason}</td>
                </tr>
                {specs.recommended.readingAge && (
                  <tr>
                    <td className="font-medium">Target Age</td>
                    <td className="font-bold">{specs.recommended.readingAge}</td>
                    <td style={{ color: 'var(--muted)' }}>{specs.recommended.readingAgeReason}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Metrics: Simple 2-column key metrics table */}
          <div className="border border-[var(--line)] p-2 space-y-1.5">
            <span className="section-subheading">Competitor Summary Metrics</span>
            <table className="plain-table w-full">
              <thead>
                <tr>
                  <th style={{ width: '144px' }}>Metric</th>
                  <th>Competitor Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ color: 'var(--muted)' }}>Page Count (Median)</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {specs.pageCount.median || 'N/A'} pages (Range: {specs.pageCount.min} - {specs.pageCount.max})
                  </td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--muted)' }}>Standard Trim Size</td>
                  <td>
                    {specs.trimSize.mostCommon} ({specs.trimSize.percentage}% of competitors)
                  </td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--muted)' }}>Price Point (Median)</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {specs.price.median ? `$${specs.price.median.toFixed(2)}` : 'N/A'} (Range: ${specs.price.min.toFixed(2)} - ${specs.price.max.toFixed(2)})
                  </td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--muted)' }}>Format &amp; Age</td>
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
                <span className="font-bold" style={{ fontSize: 'var(--font-small)' }}>Page Count Dist.</span>
                <table className="plain-table w-full" style={{ fontSize: 'var(--font-small)' }}>
                  <thead>
                    <tr>
                      <th>Range</th>
                      <th className="text-right" style={{ width: '48px' }}>Books</th>
                    </tr>
                  </thead>
                  <tbody>
                    {specs.pageCount.distribution.map((d) => (
                      <tr key={d.range}>
                        <td>{d.range}</td>
                        <td className="text-right" style={{ fontFamily: 'var(--font-mono)' }}>{d.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {specs.price.distribution.length > 0 && (
              <div className="border border-[var(--line)] p-1.5 space-y-1">
                <span className="font-bold" style={{ fontSize: 'var(--font-small)' }}>Price Dist.</span>
                <table className="plain-table w-full" style={{ fontSize: 'var(--font-small)' }}>
                  <thead>
                    <tr>
                      <th>Range</th>
                      <th className="text-right" style={{ width: '48px' }}>Books</th>
                    </tr>
                  </thead>
                  <tbody>
                    {specs.price.distribution.map((d) => (
                      <tr key={d.range}>
                        <td>{d.range}</td>
                        <td className="text-right" style={{ fontFamily: 'var(--font-mono)' }}>{d.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Royalty Calculator Reminder Note */}
          <div className="border border-[var(--line)] p-2" style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
            <strong>Printing Cost Note:</strong> Check the official royalty calculator in KDP for exact printing costs based on final page count and trim size.
          </div>
        </>
      ) : (
        <div className="border border-dashed border-[var(--line)] p-4 text-center" style={{ color: 'var(--muted)' }}>
          No book data available. Perform an Amazon search to analyze page counts, trim sizes, and competitor specs.
        </div>
      )}
    </div>
  );
};
