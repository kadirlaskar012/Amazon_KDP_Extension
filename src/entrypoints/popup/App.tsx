// src/entrypoints/popup/App.tsx
// Comprehensive KDP Niche Finder Extension Popup:
// 1. Instant Amazon Niche Launcher & Popular Tag Shortcuts
// 2. Tracked Watchlist with BSR Trajectory Charts & CSV Export
// 3. Saved Research Snapshots History
// 4. Quick Tools, Cache Controls, and System Diagnostics

import React, { useState, useEffect, useMemo } from 'react';
import type { WatchlistItem, SearchSnapshot, Settings } from '../../types';
import { getWatchlist, removeFromWatchlist, getTrend } from '../../services/watchlist';
import { refreshWatchlist } from '../../services/tracker';
import { getSnapshots, getSettings, saveSettings, clearCache } from '../../storage';
import { BsrChart } from '../../components/BsrChart';
import { TrendArrow } from '../../components/TrendArrow';
import { Logo } from '../../components/Logo';
import {
  BookMarked,
  Settings as SettingsIcon,
  RefreshCw,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Bookmark,
  Search,
  History,
  Activity,
  Download,
  Moon,
  Sun,
  Database,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

type PopupTab = 'watchlist' | 'snapshots' | 'tools';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PopupTab>('watchlist');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [snapshots, setSnapshots] = useState<SearchSnapshot[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedAsin, setExpandedAsin] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cacheCleared, setCacheCleared] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const loadData = async () => {
    try {
      const [wl, snaps, s] = await Promise.all([
        getWatchlist(),
        getSnapshots(),
        getSettings(),
      ]);
      setWatchlist(wl);
      setSnapshots(snaps);
      setSettings(s);

      if (s.theme === 'dark') {
        setIsDarkMode(true);
      } else if (s.theme === 'light') {
        setIsDarkMode(false);
      } else if (typeof window !== 'undefined') {
        setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    } catch (err) {
      console.warn('[Popup] Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for storage changes
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local') {
        if (changes['kdp_watchlist']) getWatchlist().then(setWatchlist);
        if (changes['kdp_snapshots']) getSnapshots().then(setSnapshots);
        if (changes['kdp_settings']) {
          getSettings().then((s) => {
            setSettings(s);
            if (s.theme === 'dark') setIsDarkMode(true);
            else if (s.theme === 'light') setIsDarkMode(false);
          });
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, []);

  const toggleTheme = async () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (settings) {
      const updated: Settings = { ...settings, theme: nextDark ? 'dark' : 'light' };
      setSettings(updated);
      await saveSettings(updated);
    }
  };

  const openSettings = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  };

  const handleSearchAmazon = (queryToSearch: string) => {
    const q = queryToSearch.trim();
    if (!q) return;
    const url = `https://www.amazon.com/s?i=stripbooks&k=${encodeURIComponent(q)}`;
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  };

  const handleRemove = async (e: React.MouseEvent, asin: string) => {
    e.stopPropagation();
    await removeFromWatchlist(asin);
    await loadData();
    showToast(`Removed ${asin} from watchlist`);
  };

  const handleRefreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshWatchlist({ forceAll: true });
      await loadData();
      showToast('Refreshed all tracked books!');
    } catch (err) {
      console.warn('[Popup] Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportCsv = () => {
    if (watchlist.length === 0) return;
    const headers = ['ASIN', 'Title', 'Current_BSR', 'Reviews', 'Price', 'Trend', 'Days_Tracked', 'Last_Checked'];
    const rows = watchlist.map((w) => {
      const trend = getTrend(w);
      const latest = w.history[w.history.length - 1];
      const bsr = latest ? (latest.bsrOverall ?? latest.bsr) : 'N/A';
      return [
        w.asin,
        `"${w.title.replace(/"/g, '""')}"`,
        bsr,
        latest?.reviewCount ?? 'N/A',
        latest?.price ? `$${latest.price.toFixed(2)}` : 'N/A',
        trend.trend,
        trend.daysTracked,
        w.lastCheckedAt ? new Date(w.lastCheckedAt).toLocaleDateString() : 'N/A',
      ];
    });

    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kdp_watchlist_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported watchlist CSV!');
  };

  const handleClearCache = async () => {
    await clearCache();
    setCacheCleared(true);
    showToast('Product page cache cleared!');
    setTimeout(() => setCacheCleared(false), 3000);
  };

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

  const popularNiches = [
    { label: '🎨 Coloring Books', q: 'coloring books for kids' },
    { label: '🧩 Activity Books', q: 'activity books for toddlers' },
    { label: '📓 Gratitude Journal', q: 'gratitude journal for women' },
    { label: '📊 Log Books', q: 'log book record keeper' },
    { label: '🔍 Word Search', q: 'word search puzzle book' },
    { label: '✨ Dot Markers', q: 'dot markers activity book' },
  ];

  return (
    <div className={`w-[450px] min-h-[560px] max-h-[600px] flex flex-col font-sans text-xs select-text no-horizontal-scroll ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 right-4 z-50 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xl animate-fade-in">
          ✓ {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <div>
            <div className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm leading-tight flex items-center gap-1.5">
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                KDP Niche Finder
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs tracking-wider">
                PRO
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              Personal Amazon Publishing Intelligence
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={openSettings}
            title="Open Extension Settings"
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Quick Search & Launch Bar */}
      <div className="px-3.5 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearchAmazon(searchQuery);
          }}
          className="flex items-center gap-1.5"
        >
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Amazon Books niche (e.g. coloring book)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 flex items-center gap-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:from-blue-700 hover:to-indigo-700 transition cursor-pointer"
          >
            <span>Search</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </form>

        {/* Popular Niche Shortcuts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-horizontal-scroll">
          <span className="text-[10px] text-slate-400 font-semibold shrink-0 uppercase tracking-wider">Quick:</span>
          {popularNiches.map((n) => (
            <button
              key={n.q}
              onClick={() => handleSearchAmazon(n.q)}
              className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-3.5 pt-2 bg-slate-100 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
        <button
          onClick={() => setActiveTab('watchlist')}
          className={`pb-2 px-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'watchlist'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Watchlist</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {watchlist.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('snapshots')}
          className={`pb-2 px-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'snapshots'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Research History</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {snapshots.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('tools')}
          className={`pb-2 px-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'tools'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Quick Tools</span>
        </button>
      </div>

      {/* CAPTCHA Warning Banner */}
      {hasCaptcha && (
        <div className="m-3 p-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2 animate-pulse shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
          <div>
            <strong>Amazon verification required:</strong> Open Amazon in a tab, solve the puzzle, then click <strong>Refresh</strong>.
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
        {loading ? (
          <div className="py-16 text-center text-slate-500 animate-pulse text-xs">
            Loading extension data...
          </div>
        ) : activeTab === 'watchlist' ? (
          /* TAB 1: WATCHLIST & TRACKER */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Refreshed {lastRefreshTime}
              </span>

              <div className="flex items-center gap-1.5">
                {watchlist.length > 0 && (
                  <button
                    onClick={handleExportCsv}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                    title="Export Watchlist CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={handleRefreshNow}
                  disabled={isRefreshing || watchlist.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-semibold text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 transition cursor-pointer"
                  title="Refresh All Tracked Books"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Refreshing...' : 'Refresh All'}</span>
                </button>
              </div>
            </div>

            {watchlist.length > 0 ? (
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
                        ? 'border-indigo-400 dark:border-indigo-500/50 bg-white dark:bg-slate-900 shadow-md'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Row Header */}
                    <div
                      onClick={() => setExpandedAsin(isExpanded ? null : item.asin)}
                      className="p-3 cursor-pointer flex items-center justify-between gap-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white text-xs truncate block" title={item.title}>
                          {item.title}
                        </span>

                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          <span className="font-mono text-slate-400">{item.asin}</span>
                          <span>•</span>
                          {currentBsr ? (
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              #{currentBsr.toLocaleString()}
                            </span>
                          ) : (
                            <span>BSR N/A</span>
                          )}
                          <span>•</span>
                          <TrendArrow trend={trend.trend} percentChange={trend.percentChange} />
                          {latestPoint?.price !== undefined && (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                ${latestPoint.price.toFixed(2)}
                              </span>
                            </>
                          )}
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
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Open on Amazon"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <button
                          onClick={(e) => handleRemove(e, item.asin)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Remove from Watchlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Chart */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                        <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-1.5 border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-400 block text-[10px]">Best BSR</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                              {trend.bestBsr ? `#${trend.bestBsr.toLocaleString()}` : 'N/A'}
                            </span>
                          </div>
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-1.5 border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-400 block text-[10px]">Worst BSR</span>
                            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                              {trend.worstBsr ? `#${trend.worstBsr.toLocaleString()}` : 'N/A'}
                            </span>
                          </div>
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-1.5 border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-400 block text-[10px]">Days Tracked</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
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
              <div className="py-12 text-center text-slate-400 space-y-2 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-6">
                <Bookmark className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
                <p className="font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">Your watchlist is empty</p>
                <p className="text-xs text-slate-500 max-w-[260px] mx-auto">
                  Search for books on Amazon, then click "Watch" inside the KDP sidebar to track BSR and prices daily.
                </p>
              </div>
            )}
          </div>
        ) : activeTab === 'snapshots' ? (
          /* TAB 2: RESEARCH SNAPSHOTS HISTORY */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {snapshots.length} Saved Search Snapshots
              </span>
            </div>

            {snapshots.length > 0 ? (
              snapshots.map((snap, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs space-y-2 transition hover:border-slate-300 dark:hover:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h5 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                        "{snap.query}"
                      </h5>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {new Date(snap.date).toLocaleString()} • {snap.books?.length || 0} books analyzed
                      </span>
                    </div>

                    {snap.scores && (
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold font-mono text-xs border ${
                          snap.scores.label === 'green'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                            : snap.scores.label === 'yellow'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30'
                        }`}
                      >
                        Score: {snap.scores.total}/100
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-500">
                      Opportunities: <strong className="text-slate-800 dark:text-slate-200">{snap.books?.filter((b) => (b.opportunityReasons?.length || 0) > 0).length || 0}</strong>
                    </span>

                    <button
                      onClick={() => handleSearchAmazon(snap.query)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      <span>Re-open on Amazon</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 space-y-2 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-6">
                <History className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
                <p className="font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">No research history yet</p>
                <p className="text-xs text-slate-500 max-w-[260px] mx-auto">
                  Perform a book search on Amazon to automatically save niche snapshots and score audits here.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* TAB 3: QUICK TOOLS & DIAGNOSTICS */
          <div className="space-y-3">
            {/* Quick Actions Card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs space-y-3">
              <h5 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Extension Quick Controls
              </h5>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSearchAmazon('low content books')}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-left hover:border-indigo-400 transition cursor-pointer"
                >
                  <span className="font-bold text-slate-900 dark:text-white block text-xs">Amazon Books</span>
                  <span className="text-[10px] text-slate-500">Open main book store</span>
                </button>

                <button
                  onClick={openSettings}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-left hover:border-indigo-400 transition cursor-pointer"
                >
                  <span className="font-bold text-slate-900 dark:text-white block text-xs">Options & Settings</span>
                  <span className="text-[10px] text-slate-500">Full configuration panel</span>
                </button>
              </div>

              {/* Cache Controls */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block text-xs">Product Cache</span>
                  <span className="text-[10px] text-slate-500">Stores fetched listings for speed</span>
                </div>
                <button
                  onClick={handleClearCache}
                  disabled={cacheCleared}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs transition cursor-pointer flex items-center gap-1"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>{cacheCleared ? 'Cleared ✓' : 'Clear Cache'}</span>
                </button>
              </div>

              {/* AI Status */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block text-xs">Google Gemini AI</span>
                  <span className="text-[10px] text-slate-500">Book idea generation module</span>
                </div>
                {(settings?.geminiApiKey || (settings?.geminiApiKeys && settings.geminiApiKeys.length > 0)) ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Configured {settings?.geminiApiKeys && settings.geminiApiKeys.length > 1 ? `(${settings.geminiApiKeys.length} Keys)` : ''}
                  </span>
                ) : (
                  <button
                    onClick={openSettings}
                    className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-xs hover:underline cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Add API Key
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="px-3.5 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 text-xs text-slate-500 flex items-center justify-between shrink-0 shadow-xs">
        <span className="font-medium text-slate-400">KDP Niche Finder • Production Ready</span>
        <button
          onClick={() => handleSearchAmazon('low content books')}
          className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
        >
          <span>Open Amazon Books</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </footer>
    </div>
  );
};
