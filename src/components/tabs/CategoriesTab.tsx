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
  // Initialize categories from snapshot if available, or analyze from books/query
  const initialCategories = useMemo(() => {
    if (snapshot?.categories && snapshot.categories.length > 0) {
      return snapshot.categories;
    }
    if (snapshot?.books && snapshot.books.length > 0) {
      return analyzeCategories(snapshot.books, undefined, snapshot?.query);
    }
    if (snapshot?.query) {
      return analyzeCategories([], undefined, snapshot.query);
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
      const computed = analyzeCategories(snapshot.books, undefined, snapshot?.query);
      setCategories(computed);
    } else if (snapshot?.query) {
      const computed = analyzeCategories([], undefined, snapshot.query);
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showCopyToast(label);
  };

  const handleCopyTop3KdpPaths = () => {
    if (recommendedPicks.length === 0) return;
    const text = recommendedPicks
      .map((p, i) => `${i + 1}. ${p.category.path || p.category.name}`)
      .join('\n');
    copyToClipboard(text, 'Copied Top 3 KDP Category Paths!');
  };

  const handleCopyTsv = () => {
    if (categories.length === 0) return;
    const headers = [
      'Category Name',
      'KDP Category Path',
      'Books in Top 10',
      'Best Rank',
      'Average Rank',
      'Sales Opportunity',
      'Target #1 BSR',
      'Difficulty',
      'Category URL',
    ];

    const rows = categories.map((c) => [
      c.name,
      c.path || c.name,
      c.bookCount,
      `#${c.bestRankAmongTopBooks}`,
      `#${c.avgRank}`,
      c.salesOpportunityLevel ? c.salesOpportunityLevel.toUpperCase() : 'N/A',
      c.bestSellerTargetBsr ? `#${c.bestSellerTargetBsr.toLocaleString()}` : 'N/A',
      c.difficulty || 'Unchecked',
      c.url,
    ]);

    const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    copyToClipboard(tsv, 'Copied categories table as TSV!');
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🎯</span>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                  Top 3 KDP Category Picks &amp; Beat-Seller Targets
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Amazon KDP allows 3 categories. Strategically picked to maximize visibility and win the #1 Best Seller badge.
                </p>
              </div>
            </div>
            <button
              onClick={handleCopyTop3KdpPaths}
              className="rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 px-2.5 py-1 text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer self-start sm:self-auto"
              title="Copy all 3 category paths formatted for KDP metadata"
            >
              📋 Copy Top 3 Paths
            </button>
          </div>

          <div className="space-y-2.5">
            {recommendedPicks.map(({ category, reason, badgeLabel, strategy }, idx) => (
              <div
                key={category.name}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 p-3 shadow-2xs space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300">
                        {badgeLabel || `#${idx + 1}`}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                        {category.name}
                      </span>
                      {category.salesOpportunityLevel === 'high' ? (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          🔥 High Sales Opportunity
                        </span>
                      ) : (
                        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          ⚡ Moderate Competition
                        </span>
                      )}
                      {category.bestSellerTargetBsr && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          🏆 #1 BSR Target: ~#{category.bestSellerTargetBsr.toLocaleString()}
                          {category.dailySalesForNo1 ? ` (~${category.dailySalesForNo1}/day)` : ''}
                        </span>
                      )}
                    </div>

                    {/* KDP Breadcrumb Hierarchy Path */}
                    {category.path && (
                      <div className="mt-1.5 flex items-center justify-between gap-1.5 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className="text-slate-400 font-sans font-bold uppercase text-[9px] shrink-0">KDP Path:</span>
                          <span className="truncate font-semibold text-indigo-600 dark:text-indigo-400" title={category.path}>
                            {category.path}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(category.path || category.name, 'Copied KDP Category Path!')}
                          className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                          title="Copy full KDP category path for book setup"
                        >
                          📋 Copy Path
                        </button>
                      </div>
                    )}

                    {strategy && (
                      <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <span>🎯 Beat Sellers:</span> {strategy}
                      </div>
                    )}
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{reason}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <DifficultyBadge difficulty={category.difficulty} size="sm" />
                  </div>
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
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyTop3KdpPaths}
              className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-700/60 px-2 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition cursor-pointer"
            >
              📋 Copy Paths
            </button>
            <button
              onClick={handleCopyTsv}
              className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Copy TSV
            </button>
          </div>
        )}
      </div>

      {/* Categories Table */}
      {categories.length > 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          <div className="max-h-[380px] overflow-y-auto no-horizontal-scroll">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[10px] select-none">
                <tr>
                  <th className="py-2.5 px-3">Category &amp; KDP Path</th>
                  <th className="py-2.5 px-1.5 text-center" title="Target BSR to win #1 Best Seller badge">#1 Target</th>
                  <th className="py-2.5 px-1.5 text-center" title="Number of top 10 books in this category">Books</th>
                  <th className="py-2.5 px-1.5 text-center" title="Best rank among top 10 books">Best</th>
                  <th className="py-2.5 px-2 text-center">Difficulty</th>
                  <th className="py-2.5 px-1.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {categories.map((c) => {
                  const isCheckingThis = checkingUrl === c.url;

                  return (
                    <tr key={c.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Name & KDP Breadcrumb */}
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100 max-w-[170px]">
                        <div className="font-bold text-xs truncate" title={c.name}>
                          {c.name}
                        </div>
                        {c.path && (
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono truncate max-w-[160px] flex items-center gap-1 font-normal" title={c.path}>
                            <span>{c.path}</span>
                          </div>
                        )}
                        {c.difficultyText && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[150px] font-normal" title={c.difficultyText}>
                            {c.bsrAtTop20 ? `Top 20: BSR #${c.bsrAtTop20.toLocaleString()}` : ''}
                          </div>
                        )}
                      </td>

                      {/* #1 Best Seller Target */}
                      <td className="py-2 px-1.5 text-center">
                        {c.bestSellerTargetBsr ? (
                          <div className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400" title={`Estimated ~${c.dailySalesForNo1 || 2} sales/day to hit #1`}>
                            #{c.bestSellerTargetBsr.toLocaleString()}
                            <div className="text-[9px] font-normal text-slate-400">
                              ~{c.dailySalesForNo1 || 2}/day
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
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

                      {/* Actions: Copy Path & Open Link */}
                      <td className="py-2 px-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => copyToClipboard(c.path || c.name, 'Copied KDP Category Path!')}
                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition p-1 inline-block cursor-pointer"
                            title="Copy KDP category path"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          {c.url && (
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
