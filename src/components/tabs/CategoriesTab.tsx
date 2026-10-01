import React, { useState, useMemo } from 'react';
import type { SearchSnapshot, CategoryStat, Settings } from '../../types';
import { analyzeCategories, getRecommendedCategoryPicks, checkCategoryDifficultyLive } from '../../services/categoryAnalysis';
import { DifficultyBadge } from '../DifficultyBadge';
import { CopyButton } from '../CopyButton';
import { decodeHtmlEntities, formatCleanCategoryPath } from '../../utils/htmlEntities';

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Handle checking difficulty for a category
  const handleCheckDifficulty = async (cat: CategoryStat) => {
    if (!cat.url) {
      showToast('No category link available to check.');
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
      showToast(`Updated difficulty for ${cat.name}`);
    } catch (err: any) {
      if (err.message === 'CAPTCHA_DETECTED') {
        if (onCaptchaEncountered) onCaptchaEncountered(cat.url);
      } else {
        console.warn('[CategoriesTab] Failed checking difficulty:', err);
        showToast('Could not fetch category page.');
      }
    } finally {
      setCheckingUrl(null);
    }
  };

  return (
    <div className="space-y-3 no-horizontal-scroll" style={{ color: 'var(--text)' }}>
      {/* Floating Toast Notification (prevents layout shift) */}
      {toastMessage && (
        <div
          className="fixed top-2 right-2 z-50 px-2 py-1 border"
          style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--line)', borderRadius: '2px', fontSize: 'var(--font-small)' }}
        >
          {toastMessage}
        </div>
      )}

      {/* Recommended Picks: Plain bordered box with table */}
      {recommendedPicks.length > 0 && (
        <div className="border border-[var(--line)] p-2 space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div>
              <div className="section-subheading">
                Top 3 KDP Category Picks &amp; Beat-Seller Targets
              </div>
              <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
                Target picks to maximize visibility and win the #1 Best Seller badge.
              </div>
            </div>
            <CopyButton
              text={() =>
                recommendedPicks
                  .map((p, i) => `${i + 1}. ${formatCleanCategoryPath(p.category.path || p.category.name)}`)
                  .join('\n')
              }
              defaultLabel="Copy Top 3 Paths"
              copiedLabel="Copied Top 3!"
              className="plain-btn plain-btn-sm"
              title="Copy all 3 category paths formatted for KDP metadata"
            />
          </div>

          <div className="space-y-1.5">
            {recommendedPicks.map(({ category, reason, badgeLabel, strategy }, idx) => (
              <div
                key={category.url || category.name || `pick-${idx}`}
                className="border border-[var(--line)] p-2 space-y-1 bg-[var(--bg)]"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold" style={{ fontSize: 'var(--font-small)' }}>
                        [{badgeLabel || `#${idx + 1}`}] {decodeHtmlEntities(category.name)}
                      </span>
                      {category.salesOpportunityLevel === 'high' ? (
                        <span className="font-bold" style={{ fontSize: 'var(--font-small)', color: 'var(--good)' }}>
                          (High Opportunity)
                        </span>
                      ) : (
                        <span style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
                          (Moderate)
                        </span>
                      )}
                      {category.bestSellerTargetBsr && (
                        <span style={{ fontSize: 'var(--font-small)', fontFamily: 'var(--font-mono)', color: 'var(--warn)' }}>
                          #1 BSR Target: ~#{category.bestSellerTargetBsr.toLocaleString()}
                          {category.dailySalesForNo1 ? ` (~${category.dailySalesForNo1}/day)` : ''}
                        </span>
                      )}
                    </div>

                    {category.path && (
                      <div className="mt-1 flex items-start justify-between gap-1.5" style={{ fontSize: 'var(--font-small)', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
                        <span
                          className="whitespace-normal break-words flex-1 leading-snug"
                          title={formatCleanCategoryPath(category.path)}
                        >
                          Path: {formatCleanCategoryPath(category.path)}
                        </span>
                        <CopyButton
                          text={() => formatCleanCategoryPath(category.path || category.name)}
                          defaultLabel="Copy"
                          copiedLabel="Copied!"
                          className="plain-btn plain-btn-sm shrink-0"
                          title="Copy KDP category path"
                        />
                      </div>
                    )}

                    {strategy && (
                      <div className="mt-0.5" style={{ fontSize: 'var(--font-small)', color: 'var(--good)' }}>
                        Target strategy: {decodeHtmlEntities(strategy)}
                      </div>
                    )}
                    <div className="mt-0.5" style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
                      {decodeHtmlEntities(reason)}
                    </div>
                  </div>
                  {category.difficulty ? (
                    <div className="shrink-0">
                      <DifficultyBadge difficulty={category.difficulty} size="sm" />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header & Export Row */}
      <div className="flex items-center justify-between flex-wrap gap-1">
        <span className="section-subheading">
          Niche Categories ({categories.length})
        </span>
        {categories.length > 0 && (
          <div className="flex items-center gap-1">
            <CopyButton
              text={() =>
                categories
                  .map((c, i) => `${i + 1}. ${formatCleanCategoryPath(c.path || c.name)}`)
                  .join('\n')
              }
              defaultLabel="Copy Paths"
              copiedLabel="Copied All!"
              className="plain-btn plain-btn-sm"
              title="Copy all category paths"
            />
            <CopyButton
              text={() => {
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
                  decodeHtmlEntities(c.name),
                  formatCleanCategoryPath(c.path || c.name),
                  c.bookCount,
                  `#${c.bestRankAmongTopBooks}`,
                  `#${c.avgRank}`,
                  c.salesOpportunityLevel ? c.salesOpportunityLevel.toUpperCase() : 'N/A',
                  c.bestSellerTargetBsr ? `#${c.bestSellerTargetBsr.toLocaleString()}` : 'N/A',
                  c.difficulty || 'Unchecked',
                  c.url,
                ]);
                return [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
              }}
              defaultLabel="Copy TSV"
              copiedLabel="Copied TSV!"
              className="plain-btn plain-btn-sm"
              title="Copy categories table as TSV for spreadsheet pasting"
            />
          </div>
        )}
      </div>

      {/* Categories Table: Horizontally scrollable with clean text wrapping and generous column widths */}
      {categories.length > 0 ? (
        <div className="border border-[var(--line)]">
          <div className="max-h-[380px] overflow-y-auto overflow-x-auto w-full box-border">
            <table className="plain-table table-sticky-first" style={{ minWidth: '560px' }}>
              <thead>
                <tr>
                  <th className="text-left" style={{ minWidth: '220px' }}>Category &amp; KDP Path</th>
                  <th className="text-center" style={{ width: '80px', minWidth: '75px' }} title="Target BSR to win #1 Best Seller badge">#1 Target</th>
                  <th className="text-center" style={{ width: '56px', minWidth: '55px' }} title="Number of top 10 books in this category">Books</th>
                  <th className="text-center" style={{ width: '56px', minWidth: '50px' }} title="Best rank among top 10 books">Best</th>
                  <th className="text-center" style={{ width: '80px', minWidth: '70px' }}>Difficulty</th>
                  <th className="text-center" style={{ width: '80px', minWidth: '75px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c, idx) => {
                  const isCheckingThis = checkingUrl === c.url;

                  return (
                    <tr key={c.url || c.name || `cat-${idx}`}>
                      <td className="py-1.5 px-2" style={{ minWidth: '220px' }}>
                        <div
                          className="font-bold whitespace-normal leading-tight"
                          title={decodeHtmlEntities(c.name)}
                        >
                          {decodeHtmlEntities(c.name)}
                        </div>
                        {c.path && (
                          <div
                            className="whitespace-normal break-words mt-0.5 leading-snug"
                            style={{ fontSize: 'var(--font-small)', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}
                            title={formatCleanCategoryPath(c.path)}
                          >
                            {formatCleanCategoryPath(c.path)}
                          </div>
                        )}
                        {c.difficultyText && (
                          <div
                            className="whitespace-normal mt-0.5"
                            style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}
                            title={c.difficultyText}
                          >
                            {c.bsrAtTop20 ? `Top 20: BSR #${c.bsrAtTop20.toLocaleString()}` : ''}
                          </div>
                        )}
                      </td>

                      <td className="text-center whitespace-nowrap px-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
                        {c.bestSellerTargetBsr ? (
                          <span className="font-bold" style={{ color: 'var(--warn)' }}>
                            #{c.bestSellerTargetBsr.toLocaleString()}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>-</span>
                        )}
                      </td>

                      <td className="text-center font-bold whitespace-nowrap px-1" style={{ fontFamily: 'var(--font-mono)' }}>
                        {c.bookCount}/10
                      </td>

                      <td className="text-center whitespace-nowrap px-1" style={{ fontFamily: 'var(--font-mono)' }}>
                        #{c.bestRankAmongTopBooks}
                      </td>

                      <td className="text-center whitespace-nowrap px-1.5">
                        {isCheckingThis ? (
                          <span style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>Wait</span>
                        ) : c.difficulty ? (
                          <DifficultyBadge difficulty={c.difficulty} size="sm" />
                        ) : (
                          <button
                            onClick={() => handleCheckDifficulty(c)}
                            disabled={Boolean(checkingUrl) || !c.url}
                            className="plain-btn plain-btn-sm"
                            title="Check Top 20 BSR requirement"
                          >
                            Check
                          </button>
                        )}
                      </td>

                      <td className="text-center whitespace-nowrap px-1.5">
                        <div className="flex items-center justify-center gap-1">
                          <CopyButton
                            text={() => formatCleanCategoryPath(c.path || c.name)}
                            defaultLabel="Copy"
                            copiedLabel="Copied!"
                            className="plain-btn plain-btn-sm"
                            title="Copy KDP category path"
                          />
                          {c.url && (
                            <a
                              href={c.url.startsWith('http') ? c.url : `https://www.amazon.com${c.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="plain-link"
                              style={{ fontSize: 'var(--font-small)' }}
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
        <div className="border border-dashed border-[var(--line)] p-4 text-center" style={{ color: 'var(--muted)' }}>
          No category ranks detected yet. Category data is extracted from competitor pages as they scan.
        </div>
      )}

      {/* Guidance Note */}
      <div className="border border-[var(--line)] p-2" style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
        <strong>Publishing Tip:</strong> KDP allows you to select up to 3 categories.
        Use a mix of one broader and one or two specific sub-categories.
      </div>
    </div>
  );
};
