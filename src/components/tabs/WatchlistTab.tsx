// src/components/tabs/WatchlistTab.tsx
// Watchlist and BSR Tracker tab: Lists saved books, shows daily trends, BSR trajectory charts, and refresh controls

import React, { useState, useEffect } from 'react';
import type { WatchlistItem } from '../../types';
import { getWatchlist, removeFromWatchlist, getTrend } from '../../services/watchlist';
import { refreshWatchlist } from '../../services/tracker';
import { BsrChart } from '../BsrChart';
import { TrendArrow } from '../TrendArrow';
import { ExternalLink, Trash2, RefreshCw, Download, AlertTriangle } from 'lucide-react';

interface WatchlistTabProps {
  onCaptchaEncountered?: (url?: string) => void;
}

export const WatchlistTab: React.FC<WatchlistTabProps> = ({ onCaptchaEncountered }) => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [expandedAsin, setExpandedAsin] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    const list = await getWatchlist();
    setWatchlist(list);
  };

  useEffect(() => {
    loadData();

    // Listen for storage updates
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes['kdp_watchlist']) {
        loadData();
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleRemove = async (e: React.MouseEvent, asin: string) => {
    e.stopPropagation();
    await removeFromWatchlist(asin);
    await loadData();
    showToast('Removed from watchlist');
  };

  const handleRefreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshProgress({ current: 0, total: watchlist.length });

    try {
      const result = await refreshWatchlist({
        forceAll: true,
        onProgress: (current, total) => setRefreshProgress({ current, total }),
      });

      await loadData();

      if (result.reason === 'CAPTCHA_DETECTED') {
        if (onCaptchaEncountered) onCaptchaEncountered(result.captchaUrl);
      } else {
        showToast(`Refreshed ${result.updatedCount} books!`);
      }
    } catch (err) {
      console.warn('[WatchlistTab] Refresh error:', err);
    } finally {
      setIsRefreshing(false);
      setRefreshProgress(null);
    }
  };

  const handleExportCsv = () => {
    if (watchlist.length === 0) return;

    const headers = ['ASIN', 'Title', 'Current BSR', 'Trend', 'Change %', 'Price', 'Reviews', 'Days Tracked', 'Last Checked'];
    const rows = watchlist.map((item) => {
      const trend = getTrend(item);
      const latestPoint = item.history[item.history.length - 1];
      const currentBsr = latestPoint ? (latestPoint.bsrOverall ?? latestPoint.bsr) : 'N/A';
      const lastChecked = item.lastCheckedAt ? new Date(item.lastCheckedAt).toLocaleDateString() : 'N/A';

      return [
        item.asin,
        `"${item.title.replace(/"/g, '""')}"`,
        currentBsr ?? 'N/A',
        trend.trend,
        `${trend.percentChange}%`,
        item.price ? `$${item.price.toFixed(2)}` : 'N/A',
        latestPoint?.reviewCount ?? 'N/A',
        trend.daysTracked,
        lastChecked,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kdp_watchlist_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported watchlist CSV!');
  };

  // Check if any item hit CAPTCHA
  const hasCaptcha = watchlist.some((w) => w.lastStatus === 'captcha');

  return (
    <div className="space-y-4 text-xs font-sans text-slate-700 dark:text-slate-200 no-horizontal-scroll">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-xl animate-fade-in">
          ✓ {toastMessage}
        </div>
      )}

      {/* Header and Global Controls */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs flex items-center justify-between">
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">Tracked Books ({watchlist.length}/50)</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Daily automated BSR, pricing, and review velocity tracking
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {watchlist.length > 0 && (
            <button
              onClick={handleExportCsv}
              className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              title="Export Watchlist CSV"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleRefreshNow}
            disabled={isRefreshing || watchlist.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition cursor-pointer"
            title="Refresh all tracked books now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Checking...' : 'Refresh Now'}</span>
          </button>
        </div>
      </div>

      {/* CAPTCHA Warning Banner */}
      {hasCaptcha && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2.5 text-amber-700 dark:text-amber-300 animate-pulse">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong>Verification Required:</strong> Amazon asked for verification during tracking. Open an Amazon tab to solve the CAPTCHA, then click <strong>Refresh Now</strong>.
          </div>
        </div>
      )}

      {/* Progress status */}
      {isRefreshing && refreshProgress && (
        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 p-2 text-xs text-indigo-700 dark:text-indigo-300 font-mono">
          ⏳ Checking item {refreshProgress.current} of {refreshProgress.total}...
        </div>
      )}

      {/* Watchlist Items */}
      {watchlist.length > 0 ? (
        <div className="space-y-2.5">
          {watchlist.map((item) => {
            const isExpanded = expandedAsin === item.asin;
            const trend = getTrend(item);
            const latestPoint = item.history[item.history.length - 1];
            const currentBsr = latestPoint ? (latestPoint.bsrOverall ?? latestPoint.bsr) : undefined;
            const amazonUrl = `https://www.amazon.com/dp/${item.asin}`;

            return (
              <div
                key={item.asin}
                className={`rounded-xl border transition-all ${
                  isExpanded
                    ? 'border-indigo-300 dark:border-indigo-500/50 bg-white dark:bg-slate-900 shadow-md ring-1 ring-indigo-200 dark:ring-indigo-900/50'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                }`}
              >
                {/* Item Row Header */}
                <div
                  onClick={() => setExpandedAsin(isExpanded ? null : item.asin)}
                  className="p-3 cursor-pointer flex items-center justify-between gap-2 select-none"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate" title={item.title}>
                        {item.title}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono text-slate-500">{item.asin}</span>
                      <span>•</span>
                      {currentBsr ? (
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          BSR #{currentBsr.toLocaleString()}
                        </span>
                      ) : (
                        <span>BSR N/A</span>
                      )}
                      <span>•</span>
                      <TrendArrow trend={trend.trend} percentChange={trend.percentChange} />
                      {latestPoint?.reviewCount !== undefined && (
                        <>
                          <span>•</span>
                          <span>{latestPoint.reviewCount.toLocaleString()} rev</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={amazonUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Open listing on Amazon"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={(e) => handleRemove(e, item.asin)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Remove from Watchlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Chart and Stats */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    {/* Performance Stat Pills */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-2 border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 text-[11px] block">Best BSR</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                          {trend.bestBsr ? `#${trend.bestBsr.toLocaleString()}` : 'N/A'}
                        </span>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-2 border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 text-[11px] block">Worst BSR</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400 font-mono text-xs">
                          {trend.worstBsr ? `#${trend.worstBsr.toLocaleString()}` : 'N/A'}
                        </span>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-2 border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 text-[11px] block">Tracked Days</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono text-xs">
                          {trend.daysTracked} days
                        </span>
                      </div>
                    </div>

                    {/* Chart Component */}
                    <BsrChart history={item.history} height={160} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
          <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Your Watchlist is empty</p>
          <p className="text-xs mt-1 max-w-[260px] mx-auto text-slate-500 dark:text-slate-400">
            Click the "Watch" button on any book in the Books tab or on Amazon product pages to start tracking daily BSR velocity.
          </p>
        </div>
      )}
    </div>
  );
};
