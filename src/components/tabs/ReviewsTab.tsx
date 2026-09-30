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
    <div className="space-y-4 text-xs text-slate-300">
      {/* Toast Notification */}
      {copyFeedback && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-xl animate-fade-in">
          ✓ {copyFeedback}
        </div>
      )}

      {/* Top Header Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 shadow-lg flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-white text-xs">Customer Review Gap Analysis</h4>
          <p className="text-[10px] text-slate-400">
            {reviewGap
              ? `Based on ${reviewGap.totalNegativeReviews} negative reviews across ${reviewGap.totalBooksAnalyzed} competitor books`
              : 'Scan top 5 competitor listings for customer complaints and design gaps'}
          </p>
        </div>

        <button
          onClick={handleAnalyzeReviews}
          disabled={isAnalyzing || (snapshot?.books || []).length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white shadow hover:bg-indigo-500 disabled:opacity-50 transition cursor-pointer"
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
        <div className="rounded-lg bg-indigo-950/40 border border-indigo-500/30 p-2 text-[11px] text-indigo-300 animate-pulse font-mono">
          ⏳ {progressMsg}
        </div>
      )}

      {/* Login Wall Warning */}
      {reviewGap?.reviewsRequireLogin && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-[10px] text-amber-300">
          ⚠️ Reviews for {reviewGap.booksRequiringLogin} books were not visible without Amazon login. Results are based on publicly visible reviews.
        </div>
      )}

      {reviewGap && reviewGap.complaints.length > 0 ? (
        <>
          {/* Action Row */}
          <div className="flex justify-end">
            <button
              onClick={handleCopyTsv}
              className="rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 transition"
            >
              Copy as TSV
            </button>
          </div>

          {/* Category Summary Horizontal Bar Chart */}
          {reviewGap.categorySummary.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 shadow-lg">
              <h5 className="font-semibold text-white text-[11px] mb-2">Complaint Categories</h5>
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={reviewGap.categorySummary}
                    margin={{ top: 5, right: 20, left: 45, bottom: 5 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} allowDecimals={false} />
                    <YAxis
                      dataKey="category"
                      type="category"
                      tick={{ fontSize: 9, fill: '#94a3b8' }}
                      width={75}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '8px', fontSize: '10px' }}
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
          <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-slate-900/90 to-slate-900/90 p-3.5 shadow-lg">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-emerald-500/20">
              <div className="flex items-center gap-1.5">
                <span className="text-base">💡</span>
                <h5 className="font-bold text-white text-xs">What to Do Better in Your Book</h5>
              </div>
              <span className="text-[9px] text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                Rule-based suggestion
              </span>
            </div>

            <div className="space-y-2">
              {reviewGap.categorySummary.slice(0, 5).map((cat) => (
                <div key={cat.category} className="text-[11px] leading-relaxed">
                  <span className="font-semibold text-emerald-300">{cat.category}:</span>{' '}
                  <span className="text-slate-300">{getSuggestionForCategory(cat.category)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Complaints Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-lg">
            <div className="max-h-[360px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2 px-2.5">Complaint Phrase</th>
                    <th className="py-2 px-1.5">Category</th>
                    <th className="py-2 px-1 text-center" title="Total times mentioned across negative reviews">Count</th>
                    <th className="py-2 px-1 text-center" title="Appears in how many separate books">Books</th>
                    <th className="py-2 px-2">Sample Quote</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {reviewGap.complaints.map((c, idx) => {
                    const isExpanded = expandedQuoteIdx === idx;
                    const sample = c.sampleQuotes[0] || 'No quote excerpt';

                    return (
                      <tr key={c.phrase} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 px-2.5 font-medium text-white max-w-[130px] truncate" title={c.phrase}>
                          "{c.phrase}"
                        </td>

                        <td className="py-2 px-1.5 whitespace-nowrap">
                          <span
                            className="inline-block rounded px-1.5 py-0.5 text-[9px] font-medium border"
                            style={{
                              backgroundColor: `${CATEGORY_COLORS[c.category] || '#6366f1'}15`,
                              borderColor: `${CATEGORY_COLORS[c.category] || '#6366f1'}40`,
                              color: CATEGORY_COLORS[c.category] || '#a5b4fc',
                            }}
                          >
                            {c.category}
                          </span>
                        </td>

                        <td className="py-2 px-1 text-center font-mono text-rose-400 font-bold">
                          {c.count}
                        </td>

                        <td className="py-2 px-1 text-center font-mono text-slate-300">
                          {c.bookCount}
                        </td>

                        <td className="py-2 px-2 max-w-[160px] text-slate-400">
                          <div
                            onClick={() => setExpandedQuoteIdx(isExpanded ? null : idx)}
                            className="cursor-pointer hover:text-slate-200 transition"
                            title="Click to toggle full quote"
                          >
                            <span className={isExpanded ? '' : 'truncate block'}>
                              "{sample}"
                            </span>
                            {c.sampleQuotes.length > 1 && !isExpanded && (
                              <span className="text-[9px] text-indigo-400 block">+1 more quote</span>
                            )}
                            {isExpanded && c.sampleQuotes.slice(1).map((q, qIdx) => (
                              <div key={qIdx} className="mt-1 pt-1 border-t border-slate-800 text-[10px] text-slate-300">
                                "{q}"
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Positive Signals Card ("What Customers Like") */}
          {reviewGap.positivePhrases.length > 0 && (
            <div className="rounded-xl border border-indigo-500/20 bg-slate-900/80 p-3 shadow-lg">
              <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-slate-800">
                <span className="text-emerald-400">★</span>
                <h5 className="font-semibold text-white text-xs">What Customers Like (Keep These)</h5>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {reviewGap.positivePhrases.map((p) => (
                  <span
                    key={p.word}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
                  >
                    <span>"{p.word}"</span>
                    <span className="font-mono text-[9px] text-emerald-500">×{p.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-500">
          <p className="font-medium text-slate-400">No review analysis yet</p>
          <p className="text-[11px] mt-1 max-w-[260px] mx-auto">
            Click "Analyze Reviews" above to inspect 1–3 star complaints across top competitor books.
          </p>
        </div>
      )}
    </div>
  );
};
