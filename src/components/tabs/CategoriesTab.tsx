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
    <div className="space-y-4 text-xs font-sans text-slate-700 dark:text-slate-200 no-horizontal-scroll">
      {/* Toast Notification */}
      {copyFeedback && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-xl animate-fade-in">
          ✓ {copyFeedback}
        </div>
      )}

      {/* Recommended Picks Card */}
      {recommendedPicks.length > 0 && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-50/60 dark:from-indigo-950/40 via-white dark:via-slate-900 to-white dark:to-slate-900 p-3.5 shadow-xs">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🎯</span>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">Recommended Category Picks</h4>
            </div>
            <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800">
              Rule-based suggestion
            </span>
          </div>

          <div className="space-y-2">
            {recommendedPicks.map(({ category, reason }, idx) => (
              <div
                key={category.name}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 p-2.5 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-xs">{category.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 pl-7">{reason}</p>
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
        <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
          Niche Categories ({categories.length})
        </h4>
        {categories.length > 0 && (
          <button
            onClick={handleCopyTsv}
            className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Copy TSV
          </button>
        )}
      </div>

      {/* Categories Table */}
      {categories.length > 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          <div className="max-h-[380px] overflow-y-auto no-horizontal-scroll">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[10px] select-none">
                <tr>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-1.5 text-center" title="Number of top 10 books in this category">Books</th>
                  <th className="py-2.5 px-1.5 text-center" title="Best rank among top 10 books">Best</th>
                  <th className="py-2.5 px-1.5 text-center">Type</th>
                  <th className="py-2.5 px-2 text-center">Difficulty</th>
                  <th className="py-2.5 px-1.5 text-center">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {categories.map((c) => {
                  const isCheckingThis = checkingUrl === c.url;

                  return (
                    <tr key={c.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Name */}
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100 max-w-[140px] truncate" title={c.name}>
                        {c.name}
                        {c.difficultyText && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[130px] font-normal" title={c.difficultyText}>
                            {c.bsrAtTop20 ? `Top 20: BSR #${c.bsrAtTop20.toLocaleString()}` : ''}
                          </div>
                        )}
                      </td>

                      {/* Books in Top 10 */}
                      <td className="py-2 px-1.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {c.bookCount}/10
                      </td>

                      {/* Best Rank */}
                      <td className="py-2 px-1.5 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        #{c.bestRankAmongTopBooks}
                      </td>

                      {/* Generic vs Specific */}
                      <td className="py-2 px-1.5 text-center">
                        {c.isGeneric ? (
                          <span className="inline-block rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Generic
                          </span>
                        ) : (
                          <span className="inline-block rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            Specific
                          </span>
                        )}
                      </td>

                      {/* Difficulty or Check button */}
                      <td className="py-2 px-2 text-center">
                        {isCheckingThis ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-indigo-500 font-medium">
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
                            className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-indigo-600 hover:text-white transition disabled:opacity-40 cursor-pointer"
                            title="Check Top 20 BSR requirement"
                          >
                            Check
                          </button>
                        )}
                      </td>

                      {/* Open Link */}
                      <td className="py-2 px-1.5 text-center">
                        {c.url ? (
                          <a
                            href={c.url.startsWith('http') ? c.url : `https://www.amazon.com${c.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition p-1 inline-block"
                            title="Open Best Sellers page"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
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
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-6 text-center text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
          <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No category ranks detected yet</p>
          <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
            Category data is automatically extracted from competitor product pages as they finish scanning.
          </p>
        </div>
      )}

      {/* Guidance Note */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed shadow-2xs">
        💡 <strong className="text-slate-900 dark:text-slate-200">Publishing Tip:</strong> KDP allows you to select up to 3 categories.
        Use a mix of one broader and one or two specific sub-categories. Verify active category paths in KDP dashboard during book setup.
      </div>
    </div>
  );
};
