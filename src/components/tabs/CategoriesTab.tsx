// src/components/tabs/CategoriesTab.tsx
// Category Finder + Difficulty tab: Aggregates competitor categories, checks Best Sellers difficulty, and provides rule-based recommendations

import React, { useState, useMemo } from 'react';
import type { SearchSnapshot, CategoryStat, Settings } from '../../types';
import { analyzeCategories, getRecommendedCategoryPicks, checkCategoryDifficultyLive } from '../../services/categoryAnalysis';
import { DifficultyBadge } from '../DifficultyBadge';

interface CategoriesTabProps {
  snapshot?: SearchSnapshot | null;
  settings: Settings;
  onUpdateSnapshotCategories?: (categories: CategoryStat[]) => void;
  onCaptchaEncountered?: (url?: string) => void;
}

export const CategoriesTab: React.FC<CategoriesTabProps> = ({
  snapshot,
  settings,
  onUpdateSnapshotCategories,
  onCaptchaEncountered,
}) => {
  // Initialize categories from snapshot if available, or analyze from top 10 books
  const initialCategories = useMemo(() => {
    if (snapshot?.categories && snapshot.categories.length > 0) {
      return snapshot.categories;
    }
    if (snapshot?.books && snapshot.books.length > 0) {
      return analyzeCategories(snapshot.books);
    }
    return [];
  }, [snapshot]);

  const [categories, setCategories] = useState<CategoryStat[]>(initialCategories);
  const [checkingUrl, setCheckingUrl] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Sync if snapshot changes
  React.useEffect(() => {
    if (snapshot?.categories && snapshot.categories.length > 0) {
      setCategories(snapshot.categories);
    } else if (snapshot?.books && snapshot.books.length > 0) {
      const computed = analyzeCategories(snapshot.books);
      setCategories(computed);
    }
  }, [snapshot]);

  // Recommended picks using deterministic rules
  const recommendedPicks = useMemo(() => {
    return getRecommendedCategoryPicks(categories, 3);
  }, [categories]);

  const showCopyToast = (msg: string) => {
    setCopyFeedback(msg);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  // Handle checking difficulty for a category
  const handleCheckDifficulty = async (cat: CategoryStat) => {
    if (!cat.url) {
      showCopyToast('No category link available to check.');
      return;
    }
    if (checkingUrl) return; // Only 1 check at a time

    setCheckingUrl(cat.url);

    try {
      const result = await checkCategoryDifficultyLive(cat.url, settings.categoryDifficulty);
      const updatedList = categories.map((c) =>
        c.url === cat.url
          ? {
              ...c,
              difficulty: result.difficulty,
              difficultyText: result.difficultyText,
              bsrAtTop1: result.bsrAtTop1,
              bsrAtTop10: result.bsrAtTop10,
              bsrAtTop20: result.bsrAtTop20,
            }
          : c
      );

      setCategories(updatedList);
      if (onUpdateSnapshotCategories) {
        onUpdateSnapshotCategories(updatedList);
      }
      showCopyToast(`Updated difficulty for ${cat.name}!`);
    } catch (err: any) {
      if (err.message === 'CAPTCHA_DETECTED') {
        if (onCaptchaEncountered) onCaptchaEncountered(cat.url);
      } else {
        console.warn('[CategoriesTab] Failed checking difficulty:', err);
        showCopyToast('Could not fetch category page.');
      }
    } finally {
      setCheckingUrl(null);
    }
  };

  const handleCopyTsv = () => {
    if (categories.length === 0) return;
    const headers = [
      'Category Name',
      'Books in Top 10',
      'Best Rank',
      'Average Rank',
      'Is Generic',
      'Difficulty',
      'BSR Needed Top 20',
      'Category URL',
    ];

    const rows = categories.map((c) => [
      c.name,
      c.bookCount,
      `#${c.bestRankAmongTopBooks}`,
      `#${c.avgRank}`,
      c.isGeneric ? 'Generic' : 'Specific',
      c.difficulty || 'Unchecked',
      c.bsrAtTop20 ? `#${c.bsrAtTop20.toLocaleString()}` : 'N/A',
      c.url,
    ]);

    const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsv);
    showCopyToast('Copied categories table as TSV!');
  };

  return (
    <div className="space-y-4 text-xs text-slate-300">
      {/* Toast Notification */}
      {copyFeedback && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-xl animate-fade-in">
          ✓ {copyFeedback}
        </div>
      )}

      {/* Recommended Picks Card */}
      {recommendedPicks.length > 0 && (
        <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-slate-900/90 p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🎯</span>
              <h4 className="font-semibold text-white text-xs">Recommended Category Picks</h4>
            </div>
            <span className="text-[10px] text-indigo-300/80 font-medium">Suggestion based on rules</span>
          </div>

          <div className="space-y-2">
            {recommendedPicks.map(({ category, reason }, idx) => (
              <div
                key={category.name}
                className="rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-[11px]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-bold text-indigo-400">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-white">{category.name}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400 pl-6">{reason}</p>
                  </div>
                  <DifficultyBadge difficulty={category.difficulty} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header & Export Row */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-white text-xs">
          Niche Categories ({categories.length})
        </h4>
        {categories.length > 0 && (
          <button
            onClick={handleCopyTsv}
            className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 transition"
          >
            Copy as TSV
          </button>
        )}
      </div>

      {/* Categories Table */}
      {categories.length > 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-lg">
          <div className="max-h-[380px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2 px-2.5">Category</th>
                  <th className="py-2 px-1 text-center" title="Number of top 10 books in this category">Books</th>
                  <th className="py-2 px-1 text-center" title="Best rank among top 10 books">Best</th>
                  <th className="py-2 px-1.5 text-center">Type</th>
                  <th className="py-2 px-2 text-center">Difficulty</th>
                  <th className="py-2 px-1 text-center">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {categories.map((c) => {
                  const isCheckingThis = checkingUrl === c.url;

                  return (
                    <tr key={c.name} className="hover:bg-slate-800/30 transition-colors">
                      {/* Name */}
                      <td className="py-2 px-2.5 font-medium text-white max-w-[130px] truncate" title={c.name}>
                        {c.name}
                        {c.difficultyText && (
                          <div className="text-[9px] text-slate-400 truncate max-w-[120px] font-normal" title={c.difficultyText}>
                            {c.bsrAtTop20 ? `Top 20: BSR #${c.bsrAtTop20.toLocaleString()}` : ''}
                          </div>
                        )}
                      </td>

                      {/* Books in Top 10 */}
                      <td className="py-2 px-1 text-center font-mono text-slate-300">
                        {c.bookCount}/10
                      </td>

                      {/* Best Rank */}
                      <td className="py-2 px-1 text-center font-mono text-slate-400">
                        #{c.bestRankAmongTopBooks}
                      </td>

                      {/* Generic vs Specific */}
                      <td className="py-2 px-1.5 text-center">
                        {c.isGeneric ? (
                          <span className="inline-block rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium text-amber-400 border border-amber-500/20">
                            Generic
                          </span>
                        ) : (
                          <span className="inline-block rounded bg-indigo-500/10 px-1 py-0.5 text-[9px] font-medium text-indigo-400 border border-indigo-500/20">
                            Specific
                          </span>
                        )}
                      </td>

                      {/* Difficulty or Check button */}
                      <td className="py-2 px-2 text-center">
                        {isCheckingThis ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400">
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            Wait
                          </span>
                        ) : c.difficulty ? (
                          <DifficultyBadge difficulty={c.difficulty} size="sm" />
                        ) : (
                          <button
                            onClick={() => handleCheckDifficulty(c)}
                            disabled={Boolean(checkingUrl) || !c.url}
                            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-indigo-600 hover:text-white transition disabled:opacity-40"
                            title="Check Top 20 BSR requirement"
                          >
                            Check
                          </button>
                        )}
                      </td>

                      {/* Open Link */}
                      <td className="py-2 px-1 text-center">
                        {c.url ? (
                          <a
                            href={c.url.startsWith('http') ? c.url : `https://www.amazon.com${c.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-indigo-400 transition p-1 inline-block"
                            title="Open Best Sellers page"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-slate-500">
          <p className="font-medium text-slate-400">No category ranks detected yet</p>
          <p className="text-[11px] mt-1">
            Category data is extracted as competitor product pages are fetched.
          </p>
        </div>
      )}

      {/* Guidance Note */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-[10px] text-slate-400">
        💡 <strong className="text-slate-300">Publishing Tip:</strong> KDP allows you to select up to 3 categories.
        Use a mix of one broader and one or two specific sub-categories. Verify active category paths in KDP dashboard during book setup.
      </div>
    </div>
  );
};
