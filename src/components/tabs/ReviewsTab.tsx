// src/components/tabs/ReviewsTab.tsx
// Review Gap Analyzer tab: Identifies customer complaints, category summaries, actionable suggestions, and positive signals

import React, { useState, useMemo } from 'react';
import type { SearchSnapshot, ReviewGapAnalysis, Book } from '../../types';
import { analyzeReviewGap } from '../../services/reviewGap';
import { parseProductReviews } from '../../parsers/reviewsParser';
import { getSuggestionForCategory } from '../../config/complaintLexicon';
import { ProductCache } from '../../services/cache';
import { getSettings } from '../../storage/settings';

interface ReviewsTabProps {
  snapshot?: SearchSnapshot | null;
  onUpdateSnapshotReviewGap?: (reviewGap: ReviewGapAnalysis, updatedBooks: Book[]) => void;
  onCaptchaEncountered?: (url?: string) => void;
}

export const ReviewsTab: React.FC<ReviewsTabProps> = ({
  snapshot,
  onUpdateSnapshotReviewGap,
  onCaptchaEncountered,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [expandedQuoteIdx, setExpandedQuoteIdx] = useState<number | null>(null);

  // Initialize review gap analysis from snapshot if available, or compute if books have reviews
  const reviewGap = useMemo<ReviewGapAnalysis | null>(() => {
    if (snapshot?.reviewGap) {
      return snapshot.reviewGap;
    }
    const booksWithReviews = (snapshot?.books || []).filter((b) => b.reviews && b.reviews.length > 0);
    if (booksWithReviews.length > 0) {
      return analyzeReviewGap(snapshot?.books || []);
    }
    return null;
  }, [snapshot]);

  const showCopyToast = (msg: string) => {
    setCopyFeedback(msg);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  const handleAnalyzeReviews = async () => {
    const settings = await getSettings();
    if (settings.pauseAllFetching) {
      alert('Background fetching is paused in Options/Settings.');
      return;
    }

    const books = snapshot?.books || [];
    if (books.length === 0) return;

    setIsAnalyzing(true);
    const targetBooks = books.slice(0, 5);
    const updatedBooks = [...books];
    let booksRequiringLogin = 0;

    try {
      for (let i = 0; i < targetBooks.length; i++) {
        const book = targetBooks[i]!;
        setProgressMsg(`Reading reviews ${i + 1}/${targetBooks.length} (${book.asin})...`);

        if (book.reviews && book.reviews.length > 0) {
          continue;
        }

        const cached = await ProductCache.get(book.asin);
        if (cached && (cached as any).reviews && (cached as any).reviews.length > 0) {
          const idx = updatedBooks.findIndex((b) => b.asin === book.asin);
          if (idx >= 0) {
            updatedBooks[idx] = {
              ...updatedBooks[idx]!,
              reviews: (cached as any).reviews,
            };
          }
          continue;
        }

        const delay = Math.floor(Math.random() * 1000) + 2000;
        await new Promise((r) => setTimeout(r, delay));

        const productUrl = `https://www.amazon.com/dp/${book.asin}`;
        try {
          const res = await fetch(productUrl, {
            headers: {
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });

          if (!res.ok) continue;
          const html = await res.text();

          const parsedResult = parseProductReviews(html, book.asin);
          if (parsedResult.reviewsRequireLogin) {
            booksRequiringLogin++;
          }

          const idx = updatedBooks.findIndex((b) => b.asin === book.asin);
          if (idx >= 0) {
            updatedBooks[idx] = {
              ...updatedBooks[idx]!,
              reviews: parsedResult.reviews,
            };
          }

          await ProductCache.set(book.asin, {
            ...book,
            reviews: parsedResult.reviews,
          } as any);
        } catch (fetchErr) {
          console.warn(`[ReviewsTab] Failed fetching reviews for ${book.asin}:`, fetchErr);
        }
      }

      const analysis = analyzeReviewGap(updatedBooks, { booksToAnalyze: 5 });
      if (booksRequiringLogin > 0) {
        analysis.reviewsRequireLogin = true;
        analysis.booksRequiringLogin = booksRequiringLogin;
      }

      if (onUpdateSnapshotReviewGap) {
        onUpdateSnapshotReviewGap(analysis, updatedBooks);
      }
      showCopyToast('Review analysis complete');
    } catch (err: any) {
      if (err.message === 'CAPTCHA_DETECTED') {
        if (onCaptchaEncountered) onCaptchaEncountered();
      } else {
        console.error('[ReviewsTab] Analysis error:', err);
      }
    } finally {
      setIsAnalyzing(false);
      setProgressMsg(null);
    }
  };

  const handleCopyTsv = () => {
    if (!reviewGap || reviewGap.complaints.length === 0) return;
    const headers = ['Complaint Phrase', 'Category', 'Count', 'Book Count', 'Sample Quote'];
    const rows = reviewGap.complaints.map((c) => [
      c.phrase,
      c.category,
      c.count,
      `${c.bookCount} books`,
      `"${(c.sampleQuotes[0] || '').replace(/"/g, '""')}"`,
    ]);

    const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsv);
    showCopyToast('Copied complaints as TSV');
  };

  return (
    <div className="space-y-3 text-[13px] leading-[1.4] no-horizontal-scroll">
      {/* Toast Notification */}
      {copyFeedback && (
        <div className="p-1 border border-[var(--line)] bg-[var(--bg)] text-[var(--good)] text-xs">
          {copyFeedback}
        </div>
      )}

      {/* Top Header Card: plain box */}
      <div className="border border-[var(--line)] p-2 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <span className="font-bold text-xs">Customer Review Gap Analysis</span>
          <div className="text-[11px] text-[var(--muted)]">
            {reviewGap
              ? `Based on ${reviewGap.totalNegativeReviews} negative reviews across ${reviewGap.totalBooksAnalyzed} books`
              : 'Scan top 5 competitor listings for customer complaints and design gaps'}
          </div>
        </div>

        <button
          onClick={handleAnalyzeReviews}
          disabled={isAnalyzing || (snapshot?.books || []).length === 0}
          className="plain-btn text-xs font-bold px-3 py-1"
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Reviews'}
        </button>
      </div>

      {/* Progress status */}
      {isAnalyzing && progressMsg && (
        <div className="border border-[var(--line)] p-1.5 text-xs text-[var(--muted)] font-mono">
          {progressMsg}
        </div>
      )}

      {/* Login Wall Warning */}
      {reviewGap?.reviewsRequireLogin && (
        <div className="border border-[var(--line)] p-1.5 text-xs text-[var(--warn)]">
          Reviews for {reviewGap.booksRequiringLogin} books were not visible without Amazon login.
        </div>
      )}

      {reviewGap && reviewGap.complaints.length > 0 ? (
        <>
          {/* Action Row */}
          <div className="flex justify-end">
            <button
              onClick={handleCopyTsv}
              className="plain-btn text-xs px-2 py-0.5"
            >
              Copy as TSV
            </button>
          </div>

          {/* Category Summary Table */}
          {reviewGap.categorySummary.length > 0 && (
            <div className="border border-[var(--line)] p-2 space-y-1">
              <span className="font-bold text-xs">Complaint Categories</span>
              <table className="plain-table w-full text-xs">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="w-16 text-right">Complaints</th>
                    <th>Recommended Fix</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewGap.categorySummary.map((cat) => (
                    <tr key={cat.category}>
                      <td className="font-medium">{cat.category}</td>
                      <td className="text-right font-mono text-[var(--bad)] font-bold">{cat.count}</td>
                      <td className="text-[var(--muted)]">{getSuggestionForCategory(cat.category)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Complaints Table */}
          <div className="border border-[var(--line)] p-2 space-y-1.5">
            <span className="font-bold text-xs">
              Extracted Complaints ({reviewGap.complaints.length})
            </span>

            <div className="max-h-[340px] overflow-y-auto no-horizontal-scroll">
              <table className="plain-table w-full text-xs">
                <thead>
                  <tr>
                    <th>Phrase</th>
                    <th className="w-24">Category</th>
                    <th className="w-12 text-center">Books</th>
                    <th className="w-12 text-right">Count</th>
                    <th>Sample Excerpt</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewGap.complaints.map((c, idx) => {
                    const isExpanded = expandedQuoteIdx === idx;
                    const sample = c.sampleQuotes[0] || 'No quote excerpt';

                    return (
                      <tr key={c.phrase}>
                        <td className="font-bold text-xs max-w-[120px] truncate" title={c.phrase}>
                          "{c.phrase}"
                        </td>
                        <td className="text-[11px] text-[var(--muted)]">{c.category}</td>
                        <td className="text-center font-mono">{c.bookCount}</td>
                        <td className="text-right font-mono text-[var(--bad)] font-bold">{c.count}</td>
                        <td className="text-[11px] text-[var(--muted)] max-w-[200px]">
                          <div
                            onClick={() => setExpandedQuoteIdx(isExpanded ? null : idx)}
                            className="cursor-pointer"
                            title="Click to toggle quote"
                          >
                            <span className="italic">"{isExpanded ? sample : sample.slice(0, 70) + (sample.length > 70 ? '...' : '')}"</span>
                            {c.sampleQuotes.length > 1 && !isExpanded && (
                              <span className="text-[10px] text-[var(--link)] underline block">
                                +{c.sampleQuotes.length - 1} more
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Positive Signals */}
          {reviewGap.positivePhrases.length > 0 && (
            <div className="border border-[var(--line)] p-2 space-y-1">
              <span className="font-bold text-xs">What Customers Like (Keep These)</span>
              <div className="flex flex-wrap gap-1">
                {reviewGap.positivePhrases.map((p) => (
                  <span
                    key={p.word}
                    className="border border-[var(--line)] px-1.5 py-0.5 text-xs text-[var(--good)]"
                  >
                    "{p.word}" ({p.count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="border border-dashed border-[var(--line)] p-4 text-center text-[var(--muted)]">
          No review analysis yet. Click "Analyze Reviews" above to inspect complaints across top competitor books.
        </div>
      )}
    </div>
  );
};
