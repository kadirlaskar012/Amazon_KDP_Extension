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
    if (checkingUrl) return;

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
      showCopyToast(`Updated difficulty for ${cat.name}`);
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
    copyToClipboard(text, 'Copied Top 3 KDP Category Paths');
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
    copyToClipboard(tsv, 'Copied categories table as TSV');
  };

  return (
    <div className="space-y-3 text-[13px] leading-[1.4] no-horizontal-scroll">
      {/* Toast Notification */}
      {copyFeedback && (
        <div className="p-1 border border-[var(--line)] bg-[var(--bg)] text-[var(--good)] text-xs">
          {copyFeedback}
        </div>
      )}

      {/* Recommended Picks: Plain bordered box with table */}
      {recommendedPicks.length > 0 && (
        <div className="border border-[var(--line)] p-2 space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div>
              <div className="font-bold text-[13px]">
                Top 3 KDP Category Picks &amp; Beat-Seller Targets
              </div>
              <div className="text-[11px] text-[var(--muted)]">
                Target picks to maximize visibility and win the #1 Best Seller badge.
              </div>
            </div>
            <button
              onClick={handleCopyTop3KdpPaths}
              className="plain-btn text-xs px-2 py-0.5"
              title="Copy all 3 category paths formatted for KDP metadata"
            >
              Copy Top 3 Paths
            </button>
          </div>

          <div className="space-y-1.5">
            {recommendedPicks.map(({ category, reason, badgeLabel, strategy }, idx) => (
              <div
                key={category.name}
                className="border border-[var(--line)] p-1.5 space-y-1 bg-[var(--bg)]"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs">
                        [{badgeLabel || `#${idx + 1}`}] {category.name}
                      </span>
                      {category.salesOpportunityLevel === 'high' ? (
                        <span className="text-[11px] font-bold text-[var(--good)]">
                          (High Opportunity)
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--muted)]">
                          (Moderate)
                        </span>
                      )}
                      {category.bestSellerTargetBsr && (
                        <span className="text-[11px] font-mono text-[var(--warn)]">
                          #1 BSR Target: ~#{category.bestSellerTargetBsr.toLocaleString()}
                          {category.dailySalesForNo1 ? ` (~${category.dailySalesForNo1}/day)` : ''}
                        </span>
                      )}
                    </div>

                    {category.path && (
                      <div className="text-[11px] font-mono text-[var(--muted)] mt-0.5 flex items-center justify-between gap-1">
                        <span className="truncate" title={category.path}>
                          Path: {category.path}
                        </span>
                        <button
                          onClick={() => copyToClipboard(category.path || category.name, 'Copied KDP Category Path')}
                          className="plain-btn text-[10px] px-1 py-0 shrink-0"
                        >
                          Copy
                        </button>
                      </div>
                    )}

                    {strategy && (
                      <div className="text-[11px] text-[var(--good)]">
                        Target strategy: {strategy}
                      </div>
                    )}
                    <div className="text-[11px] text-[var(--muted)]">{reason}</div>
                  </div>
                  <div className="shrink-0">
                    <DifficultyBadge difficulty={category.difficulty} size="sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header & Export Row */}
      <div className="flex items-center justify-between flex-wrap gap-1">
        <span className="font-bold text-xs">
          Niche Categories ({categories.length})
        </span>
        {categories.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopyTop3KdpPaths}
              className="plain-btn text-xs px-2 py-0.5"
            >
              Copy Paths
            </button>
            <button
              onClick={handleCopyTsv}
              className="plain-btn text-xs px-2 py-0.5"
            >
              Copy TSV
            </button>
          </div>
        )}
      </div>

      {/* Categories Table */}
      {categories.length > 0 ? (
        <div className="border border-[var(--line)]">
          <div className="max-h-[380px] overflow-y-auto no-horizontal-scroll">
            <table className="plain-table w-full text-xs">
              <thead>
                <tr>
                  <th>Category &amp; KDP Path</th>
                  <th className="w-16 text-center" title="Target BSR to win #1 Best Seller badge">#1 Target</th>
                  <th className="w-10 text-center" title="Number of top 10 books in this category">Books</th>
                  <th className="w-10 text-center" title="Best rank among top 10 books">Best</th>
                  <th className="w-16 text-center">Difficulty</th>
                  <th className="w-14 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => {
                  const isCheckingThis = checkingUrl === c.url;

                  return (
                    <tr key={c.name}>
                      <td className="max-w-[160px]">
                        <div className="font-bold truncate" title={c.name}>
                          {c.name}
                        </div>
                        {c.path && (
                          <div className="text-[10px] text-[var(--muted)] font-mono truncate" title={c.path}>
                            {c.path}
                          </div>
                        )}
                        {c.difficultyText && (
                          <div className="text-[10px] text-[var(--muted)] truncate" title={c.difficultyText}>
                            {c.bsrAtTop20 ? `Top 20: BSR #${c.bsrAtTop20.toLocaleString()}` : ''}
                          </div>
                        )}
                      </td>

                      <td className="text-center font-mono">
                        {c.bestSellerTargetBsr ? (
                          <span className="text-[var(--warn)] font-bold">
                            #{c.bestSellerTargetBsr.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                      </td>

                      <td className="text-center font-mono font-bold">
                        {c.bookCount}/10
                      </td>

                      <td className="text-center font-mono">
                        #{c.bestRankAmongTopBooks}
                      </td>

                      <td className="text-center">
                        {isCheckingThis ? (
                          <span className="text-[10px] text-[var(--muted)]">Wait</span>
                        ) : c.difficulty ? (
                          <DifficultyBadge difficulty={c.difficulty} size="sm" />
                        ) : (
                          <button
                            onClick={() => handleCheckDifficulty(c)}
                            disabled={Boolean(checkingUrl) || !c.url}
                            className="plain-btn text-[10px] px-1 py-0"
                            title="Check Top 20 BSR requirement"
                          >
                            Check
                          </button>
                        )}
                      </td>

                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => copyToClipboard(c.path || c.name, 'Copied KDP Category Path')}
                            className="plain-btn text-[10px] px-1 py-0"
                            title="Copy KDP category path"
                          >
                            Copy
                          </button>
                          {c.url && (
                            <a
                              href={c.url.startsWith('http') ? c.url : `https://www.amazon.com${c.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="plain-link text-[10px]"
                              title="Open Best Sellers page"
                            >
                              Link
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
        <div className="border border-dashed border-[var(--line)] p-4 text-center text-[var(--muted)]">
          No category ranks detected yet. Category data is extracted from competitor pages as they scan.
        </div>
      )}

      {/* Guidance Note */}
      <div className="border border-[var(--line)] p-2 text-xs text-[var(--muted)]">
        <strong>Publishing Tip:</strong> KDP allows you to select up to 3 categories.
        Use a mix of one broader and one or two specific sub-categories.
      </div>
    </div>
  );
};
