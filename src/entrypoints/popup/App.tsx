// src/entrypoints/popup/App.tsx
// Extension Popup: Watchlist manager, daily trend tracker, BSR charts, and refresh controls

import React, { useState, useEffect, useMemo } from 'react';
import type { WatchlistItem } from '../../types';
import { getWatchlist, removeFromWatchlist, getTrend } from '../../services/watchlist';
import { refreshWatchlist } from '../../services/tracker';
import { BsrChart } from '../../components/BsrChart';
import { TrendArrow } from '../../components/TrendArrow';
import {
  BookMarked,
  Settings as SettingsIcon,
  RefreshCw,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Bookmark,
} from 'lucide-react';

export const App: React.FC = () => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [expandedAsin, setExpandedAsin] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    const list = await getWatchlist();
    setWatchlist(list);
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    // Listen for storage changes
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

  const openSettings = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  };

  const handleRemove = async (e: React.MouseEvent, asin: string) => {
    e.stopPropagation();
    await removeFromWatchlist(asin);
    await loadData();
  };

  const handleRefreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshWatchlist({ forceAll: true });
      await loadData();
    } catch (err) {
      console.warn('[Popup] Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Find most recent check time
  const lastRefreshTime = useMemo(() => {
    let latest = 0;
    for (const w of watchlist) {
      if (w.lastCheckedAt && w.lastCheckedAt > latest) {
        latest = w.lastCheckedAt;
      }
    }
    return latest > 0 ? new Date(latest).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never';
  }, [watchlist]);

  const hasCaptcha = watchlist.some((w) => w.lastStatus === 'captcha');

  return (
    <div className="w-[400px] min-h-[480px] bg-slate-900 text-slate-100 flex flex-col font-sans text-xs select-text">
      {/* Header */}
      <header className="px-3.5 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <BookMarked className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white text-xs leading-tight">
              KDP Niche Finder
            </div>
            <div className="text-[10px] text-slate-400">
              {watchlist.length} watched · Refreshed {lastRefreshTime}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRefreshNow}
            disabled={isRefreshing || watchlist.length === 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Refresh All Tracked Books"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          <button
            onClick={openSettings}
            title="Settings"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* CAPTCHA Warning Banner */}
      {hasCaptcha && (
        <div className="m-3 p-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 text-[11px] flex items-start gap-2 animate-pulse shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <strong>Amazon verification required:</strong> Open Amazon in a tab, solve the puzzle, then click <strong>Refresh</strong>.
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2">
        {loading ? (
          <div className="py-12 text-center text-slate-500 animate-pulse text-xs">
            Loading watchlist...
          </div>
        ) : watchlist.length > 0 ? (
          watchlist.map((item) => {
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
                    ? 'border-indigo-500/50 bg-slate-950 shadow-lg'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                {/* Row Header */}
                <div
                  onClick={() => setExpandedAsin(isExpanded ? null : item.asin)}
                  className="p-2.5 cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-white text-xs truncate block" title={item.title}>
                      {item.title}
                    </span>

                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className="font-mono text-slate-500">{item.asin}</span>
                      <span>•</span>
                      {currentBsr ? (
                        <span className="font-mono font-bold text-indigo-400">
                          #{currentBsr.toLocaleString()}
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

                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={amazonUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition"
                      title="Open on Amazon"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={(e) => handleRemove(e, item.asin)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Chart */}
                {isExpanded && (
                  <div className="px-2.5 pb-2.5 pt-1 border-t border-slate-800/80 space-y-2">
                    <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                      <div className="rounded bg-slate-900 p-1 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">Best BSR</span>
                        <span className="font-bold text-emerald-400 font-mono">
                          {trend.bestBsr ? `#${trend.bestBsr.toLocaleString()}` : 'N/A'}
                        </span>
                      </div>
                      <div className="rounded bg-slate-900 p-1 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">Worst BSR</span>
                        <span className="font-bold text-rose-400 font-mono">
                          {trend.worstBsr ? `#${trend.worstBsr.toLocaleString()}` : 'N/A'}
                        </span>
                      </div>
                      <div className="rounded bg-slate-900 p-1 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">Tracked</span>
                        <span className="font-bold text-indigo-400 font-mono">
                          {trend.daysTracked}d
                        </span>
                      </div>
                    </div>

                    <BsrChart history={item.history} height={140} />
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center text-slate-500 space-y-2">
            <Bookmark className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="font-medium text-slate-400 text-xs">Watchlist is empty</p>
            <p className="text-[11px] text-slate-500 max-w-[240px] mx-auto">
              Search on Amazon to find books and click "Watch" to monitor daily BSR performance.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="px-3.5 py-2 border-t border-slate-800 bg-slate-950/80 text-[10px] text-slate-500 flex items-center justify-between shrink-0">
        <span>KDP Niche Finder · Phase 4</span>
        <button
          onClick={() => chrome.tabs.create({ url: 'https://www.amazon.com/s?i=stripbooks&k=low+content+books' })}
          className="text-indigo-400 hover:text-indigo-300 font-medium"
        >
          Open Amazon Books →
        </button>
      </footer>
    </div>
  );
};
