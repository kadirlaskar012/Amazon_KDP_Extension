// src/components/tabs/ReviewsTab.tsx
// Review Gap Analyzer tab: Identifies customer complaints, category summaries, actionable suggestions, and positive signals

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
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

        // Check if book already has parsed reviews
        if (book.reviews && book.reviews.length > 0) {
          continue;
        }

        // Check ProductCache first
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

        // Fetch product page HTML with 2-3s delay
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

          // Cache parsed reviews
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
      showCopyToast('Review analysis complete!');
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
    showCopyToast('Copied complaints as TSV!');
  };

  const CATEGORY_COLORS: Record<string, string> = {
    'Paper quality': '#f87171',
    'Design quality': '#fb923c',
    'Content amount': '#facc15',
    'Layout': '#a78bfa',
    'Size/format': '#38bdf8',
    'Age fit': '#4ade80',
    'Value': '#f472b6',
    'Mismatch': '#94a3b8',
    'General feedback': '#64748b',
  };

  return (
    <div className="space-y-4 text-xs font-sans text-slate-700 dark:text-slate-200 no-horizontal-scroll">
      {/* Toast Notification */}
      {copyFeedback && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xl animate-fade-in">
          ✓ {copyFeedback}
        </div>
      )}

      {/* Top Header Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">Customer Review Gap Analysis</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {reviewGap
              ? `Based on ${reviewGap.totalNegativeReviews} negative reviews across ${reviewGap.totalBooksAnalyzed} competitor books`
              : 'Scan top 5 competitor listings for customer complaints and design gaps'}
          </p>
        </div>

        <button
          onClick={handleAnalyzeReviews}
          disabled={isAnalyzing || (snapshot?.books || []).length === 0}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition cursor-pointer"
        >
          {isAnalyzing ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Analyzing...</span>
            </>
          ) : (
            <span>Analyze Reviews</span>
          )}
        </button>
      </div>

      {/* Progress status */}
      {isAnalyzing && progressMsg && (
        <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 p-2.5 text-xs text-indigo-700 dark:text-indigo-300 animate-pulse font-mono">
          ⏳ {progressMsg}
        </div>
      )}

      {/* Login Wall Warning */}
      {reviewGap?.reviewsRequireLogin && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 p-2.5 text-xs text-amber-800 dark:text-amber-300">
          ⚠️ Reviews for {reviewGap.booksRequiringLogin} books were not visible without Amazon login. Results are based on publicly visible reviews.
        </div>
      )}

      {reviewGap && reviewGap.complaints.length > 0 ? (
        <>
          {/* Action Row */}
          <div className="flex justify-end">
            <button
              onClick={handleCopyTsv}
              className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Copy as TSV
            </button>
          </div>

          {/* Category Summary Horizontal Bar Chart */}
          {reviewGap.categorySummary.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
              <h5 className="font-bold text-slate-900 dark:text-white text-xs mb-2.5">Complaint Categories</h5>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={reviewGap.categorySummary}
                    margin={{ top: 5, right: 20, left: 50, bottom: 5 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                    <YAxis
                      dataKey="category"
                      type="category"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                      formatter={(val: any) => [`${val} complaints`, 'Total']}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {reviewGap.categorySummary.map((entry) => (
                        <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] || '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* "What To Do Better" Rule-Based Suggestions Card */}
          <div className="rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-gradient-to-br dark:from-emerald-950/30 dark:via-slate-900/90 dark:to-slate-900/90 p-3.5 shadow-xs">
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-emerald-200 dark:border-emerald-500/20">
              <div className="flex items-center gap-1.5">
                <span className="text-base">💡</span>
                <h5 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">What to Do Better in Your Book</h5>
              </div>
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                Rule-based
              </span>
            </div>

            <div className="space-y-2">
              {reviewGap.categorySummary.slice(0, 5).map((cat) => (
                <div key={cat.category} className="text-xs leading-relaxed">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">{cat.category}:</span>{' '}
                  <span className="text-slate-700 dark:text-slate-300">{getSuggestionForCategory(cat.category)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Complaints List - Responsive Card-based (No horizontal scroll!) */}
          <div className="space-y-2.5">
            <h5 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
              Extracted Complaints ({reviewGap.complaints.length})
            </h5>

            <div className="space-y-2">
              {reviewGap.complaints.map((c, idx) => {
                const isExpanded = expandedQuoteIdx === idx;
                const sample = c.sampleQuotes[0] || 'No quote excerpt';

                return (
                  <div
                    key={c.phrase}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs space-y-2 transition hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                          "{c.phrase}"
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span
                            className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold border"
                            style={{
                              backgroundColor: `${CATEGORY_COLORS[c.category] || '#6366f1'}15`,
                              borderColor: `${CATEGORY_COLORS[c.category] || '#6366f1'}40`,
                              color: CATEGORY_COLORS[c.category] || '#4f46e5',
                            }}
                          >
                            {c.category}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Found across {c.bookCount} competitor {c.bookCount === 1 ? 'book' : 'books'}
                          </span>
                        </div>
                      </div>

                      <span className="shrink-0 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 px-2 py-0.5 font-bold font-mono text-rose-600 dark:text-rose-400 text-xs">
                        {c.count} mentions
                      </span>
                    </div>

                    {/* Sample Quote */}
                    <div
                      onClick={() => setExpandedQuoteIdx(isExpanded ? null : idx)}
                      className="cursor-pointer bg-slate-50 dark:bg-slate-950/60 rounded-lg p-2.5 border border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-950 transition text-xs text-slate-600 dark:text-slate-400"
                    >
                      <p className={`italic ${isExpanded ? '' : 'line-clamp-2'}`}>
                        "{sample}"
                      </p>

                      {c.sampleQuotes.length > 1 && !isExpanded && (
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium block mt-1">
                          +{c.sampleQuotes.length - 1} more quote{c.sampleQuotes.length > 2 ? 's' : ''} (click to expand)
                        </span>
                      )}

                      {isExpanded && c.sampleQuotes.slice(1).map((q, qIdx) => (
                        <div key={qIdx} className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 italic">
                          "{q}"
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Positive Signals Card ("What Customers Like") */}
          {reviewGap.positivePhrases.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-indigo-500/20 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
              <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-emerald-500 text-sm">★</span>
                <h5 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">What Customers Like (Keep These)</h5>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {reviewGap.positivePhrases.map((p) => (
                  <span
                    key={p.word}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300"
                  >
                    <span>"{p.word}"</span>
                    <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">×{p.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-8 text-center text-slate-500 dark:text-slate-400">
          <p className="font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">No review analysis yet</p>
          <p className="text-xs mt-1 max-w-[280px] mx-auto text-slate-500 dark:text-slate-400">
            Click "Analyze Reviews" above to inspect 1–3 star complaints across top competitor books.
          </p>
        </div>
      )}
    </div>
  );
};
