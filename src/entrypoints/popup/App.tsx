// src/entrypoints/popup/App.tsx
// Plain utilitarian Extension Popup (400px width):
// 1. Amazon Niche Search & Shortcuts
// 2. Tracked Watchlist with BSR Trajectory Charts & CSV Export
// 3. Saved Research Snapshots History
// 4. Quick Tools & Diagnostics

import React, { useState, useEffect, useMemo } from 'react';
import type { WatchlistItem, SearchSnapshot, Settings } from '../../types';
import { getWatchlist, removeFromWatchlist, getTrend } from '../../services/watchlist';
import { refreshWatchlist } from '../../services/tracker';
import { getSnapshots, getSettings, saveSettings, clearCache } from '../../storage';
import { BsrChart } from '../../components/BsrChart';
import { TrendArrow } from '../../components/TrendArrow';

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
    showToast(`Removed ${asin}`);
  };

  const handleRefreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshWatchlist({ forceAll: true });
      await loadData();
      showToast('Refreshed tracked books');
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
    showToast('Exported CSV');
  };

  const handleClearCache = async () => {
    await clearCache();
    setCacheCleared(true);
    showToast('Cache cleared');
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
    { label: 'Coloring Books', q: 'coloring books for kids' },
    { label: 'Activity Books', q: 'activity books for toddlers' },
    { label: 'Gratitude Journal', q: 'gratitude journal for women' },
    { label: 'Log Books', q: 'log book record keeper' },
    { label: 'Word Search', q: 'word search puzzle book' },
    { label: 'Dot Markers', q: 'dot markers activity book' },
  ];

  return (
    <div
      className={`w-[400px] min-h-[500px] max-h-[580px] flex flex-col text-[13px] leading-[1.4] select-text no-horizontal-scroll ${
        isDarkMode ? 'dark' : ''
      }`}
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'system-ui, Arial, sans-serif',
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className="fixed top-2 right-2 z-50 px-2 py-1 text-xs border"
          style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--line)', borderRadius: '2px' }}
        >
          {toastMessage}
        </div>
      )}

      {/* Header: Single plain line */}
      <header
        className="px-2 py-1.5 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: 'var(--line)' }}
      >
        <div className="font-bold text-[14px]">KDP Niche Finder</div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="plain-btn text-xs"
            title="Toggle Light / Dark mode"
          >
            {isDarkMode ? 'Light' : 'Dark'}
          </button>

          <button
            onClick={openSettings}
            className="plain-btn text-xs"
            title="Open Extension Settings"
          >
            Settings
          </button>
        </div>
      </header>

      {/* Search Input and Shortcuts */}
      <div className="p-2 border-b space-y-1.5 shrink-0" style={{ borderColor: 'var(--line)' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearchAmazon(searchQuery);
          }}
          className="flex items-center gap-1"
        >
          <input
            type="text"
            placeholder="Search Amazon Books niche..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="plain-input flex-1"
          />
          <button type="submit" className="plain-btn font-medium">
            Search
          </button>
        </form>

        <div className="quick-chips-wrapper">
          <div className="quick-chips-container items-center text-xs">
            <span className="shrink-0" style={{ color: 'var(--muted)' }}>Quick:</span>
            {popularNiches.map((n) => (
              <button
                key={n.q}
                onClick={() => handleSearchAmazon(n.q)}
                className="plain-link text-xs shrink-0 whitespace-nowrap"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Tabs: text row separated by | */}
      <div
        className="px-2 py-1 border-b flex items-center gap-2 text-xs shrink-0"
        style={{ borderColor: 'var(--line)' }}
      >
        <button
          onClick={() => setActiveTab('watchlist')}
          className="cursor-pointer"
          style={{
            fontWeight: activeTab === 'watchlist' ? 'bold' : 'normal',
            borderBottom: activeTab === 'watchlist' ? '2px solid var(--text)' : '2px solid transparent',
            color: 'var(--text)',
            background: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderTop: 'none',
            padding: '2px 4px',
          }}
        >
          Watchlist ({watchlist.length})
        </button>
        <span style={{ color: 'var(--line)' }}>|</span>
        <button
          onClick={() => setActiveTab('snapshots')}
          className="cursor-pointer"
          style={{
            fontWeight: activeTab === 'snapshots' ? 'bold' : 'normal',
            borderBottom: activeTab === 'snapshots' ? '2px solid var(--text)' : '2px solid transparent',
            color: 'var(--text)',
            background: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderTop: 'none',
            padding: '2px 4px',
          }}
        >
          Snapshots ({snapshots.length})
        </button>
        <span style={{ color: 'var(--line)' }}>|</span>
        <button
          onClick={() => setActiveTab('tools')}
          className="cursor-pointer"
          style={{
            fontWeight: activeTab === 'tools' ? 'bold' : 'normal',
            borderBottom: activeTab === 'tools' ? '2px solid var(--text)' : '2px solid transparent',
            color: 'var(--text)',
            background: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderTop: 'none',
            padding: '2px 4px',
          }}
        >
          Tools
        </button>
      </div>

      {/* CAPTCHA Warning Banner */}
      {hasCaptcha && (
        <div
          className="m-2 p-1.5 text-xs border"
          style={{ borderColor: 'var(--warn)', color: 'var(--warn)', borderRadius: '2px' }}
        >
          <strong>Verification Required:</strong> Open Amazon in a tab, solve the puzzle, then click Refresh.
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 p-2 overflow-y-auto space-y-2">
        {loading ? (
          <div className="py-8 text-center text-xs" style={{ color: 'var(--muted)' }}>
            Loading extension data...
          </div>
        ) : activeTab === 'watchlist' ? (
          /* TAB 1: WATCHLIST */
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs pb-1 border-b" style={{ borderColor: 'var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Refreshed: {lastRefreshTime}</span>
              <div className="flex items-center gap-1">
                {watchlist.length > 0 && (
                  <button onClick={handleExportCsv} className="plain-btn" title="Export CSV">
                    Export CSV
                  </button>
                )}
                <button
                  onClick={handleRefreshNow}
                  disabled={isRefreshing || watchlist.length === 0}
                  className="plain-btn"
                  title="Refresh All"
                >
                  {isRefreshing ? 'Checking...' : 'Refresh All'}
                </button>
              </div>
            </div>

            {watchlist.length > 0 ? (
              <div className="border" style={{ borderColor: 'var(--line)', borderRadius: '2px' }}>
                <table className="plain-table">
                  <thead>
                    <tr>
                      <th style={{ width: '20px' }}></th>
                      <th>Title</th>
                      <th className="text-right">BSR</th>
                      <th className="text-center">Trend</th>
                      <th className="text-right">Price</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map((item) => {
                      const isExpanded = expandedAsin === item.asin;
                      const trend = getTrend(item);
                      const latestPoint = item.history[item.history.length - 1];
                      const currentBsr = latestPoint ? (latestPoint.bsrOverall ?? latestPoint.bsr) : undefined;
                      const amazonUrl = `https://www.amazon.com/dp/${item.asin}`;

                      return (
                        <React.Fragment key={item.asin}>
                          <tr
                            onClick={() => setExpandedAsin(isExpanded ? null : item.asin)}
                            className="cursor-pointer"
                          >
                            <td className="text-center text-xs" style={{ color: 'var(--muted)' }}>
                              {isExpanded ? '▼' : '►'}
                            </td>
                            <td className="max-w-[120px] truncate font-medium" title={item.title}>
                              {item.title}
                            </td>
                            <td className="text-right font-mono text-xs">
                              {currentBsr ? `#${currentBsr.toLocaleString()}` : 'N/A'}
                            </td>
                            <td className="text-center">
                              <TrendArrow trend={trend.trend} percentChange={trend.percentChange} />
                            </td>
                            <td className="text-right text-xs">
                              {latestPoint?.price !== undefined ? `$${latestPoint.price.toFixed(2)}` : '—'}
                            </td>
                            <td className="text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <a
                                href={amazonUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="plain-link mr-1.5"
                                title="Open on Amazon"
                              >
                                Link
                              </a>
                              <button
                                onClick={(e) => handleRemove(e, item.asin)}
                                className="plain-link"
                                style={{ color: 'var(--bad)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                title="Remove"
                              >
                                Del
                              </button>
                            </td>
                          </tr>

                          {/* Expanded detail row */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="p-2" style={{ background: 'var(--bg)' }}>
                                <div className="space-y-1.5">
                                  <table className="plain-table" style={{ width: '100%' }}>
                                    <tbody>
                                      <tr>
                                        <td className="font-medium">Best BSR:</td>
                                        <td className="font-mono" style={{ color: 'var(--good)' }}>
                                          {trend.bestBsr ? `#${trend.bestBsr.toLocaleString()}` : 'N/A'}
                                        </td>
                                        <td className="font-medium">Worst BSR:</td>
                                        <td className="font-mono" style={{ color: 'var(--bad)' }}>
                                          {trend.worstBsr ? `#${trend.worstBsr.toLocaleString()}` : 'N/A'}
                                        </td>
                                        <td className="font-medium">Tracked:</td>
                                        <td>{trend.daysTracked}d</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                  <BsrChart history={item.history} height={130} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center border" style={{ borderColor: 'var(--line)', borderRadius: '2px', color: 'var(--muted)' }}>
                Watchlist is empty. Search books on Amazon and click "Watch" to begin tracking.
              </div>
            )}
          </div>
        ) : activeTab === 'snapshots' ? (
          /* TAB 2: RESEARCH HISTORY */
          <div className="space-y-2">
            <div className="text-xs pb-1 border-b" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
              {snapshots.length} Saved Search Snapshots
            </div>

            {snapshots.length > 0 ? (
              <div className="border" style={{ borderColor: 'var(--line)', borderRadius: '2px' }}>
                <table className="plain-table">
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Date</th>
                      <th className="text-right">Books</th>
                      <th className="text-right">Score</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((snap, idx) => {
                      const scoreColor = snap.scores
                        ? snap.scores.label === 'green'
                          ? 'var(--good)'
                          : snap.scores.label === 'yellow'
                          ? 'var(--warn)'
                          : 'var(--bad)'
                        : 'var(--muted)';

                      return (
                        <tr key={idx}>
                          <td className="font-medium max-w-[120px] truncate" title={snap.query}>
                            {snap.query}
                          </td>
                          <td className="text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                            {new Date(snap.date).toLocaleDateString()}
                          </td>
                          <td className="text-right text-xs">
                            {snap.books?.length || 0}
                          </td>
                          <td className="text-right font-bold font-mono text-xs" style={{ color: scoreColor }}>
                            {snap.scores ? `${snap.scores.total}/100` : '—'}
                          </td>
                          <td className="text-center">
                            <button
                              onClick={() => handleSearchAmazon(snap.query)}
                              className="plain-link text-xs"
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center border" style={{ borderColor: 'var(--line)', borderRadius: '2px', color: 'var(--muted)' }}>
                No search history yet. Search on Amazon to save niche audits.
              </div>
            )}
          </div>
        ) : (
          /* TAB 3: TOOLS */
          <div className="space-y-2">
            <div className="border" style={{ borderColor: 'var(--line)', borderRadius: '2px' }}>
              <table className="plain-table">
                <tbody>
                  <tr>
                    <td className="font-medium">Amazon Book Store</td>
                    <td className="text-right">
                      <button
                        onClick={() => handleSearchAmazon('low content books')}
                        className="plain-btn"
                      >
                        Open Amazon Books
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="font-medium">Options & Settings</td>
                    <td className="text-right">
                      <button onClick={openSettings} className="plain-btn">
                        Open Settings
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="font-medium">Product Cache</div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>Stores listing details for speed</div>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={handleClearCache}
                        disabled={cacheCleared}
                        className="plain-btn"
                      >
                        {cacheCleared ? 'Cleared' : 'Clear Cache'}
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="font-medium">Gemini AI Status</div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>Niche idea generator</div>
                    </td>
                    <td className="text-right">
                      {(settings?.geminiApiKey || (settings?.geminiApiKeys && settings.geminiApiKeys.length > 0)) ? (
                        <span className="font-bold text-xs" style={{ color: 'var(--good)' }}>
                          Configured {settings?.geminiApiKeys && settings.geminiApiKeys.length > 1 ? `(${settings.geminiApiKeys.length} keys)` : ''}
                        </span>
                      ) : (
                        <button
                          onClick={openSettings}
                          className="plain-link text-xs"
                          style={{ color: 'var(--warn)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                        >
                          Add API Key
                        </button>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Footer: One plain line */}
      <footer
        className="px-2 py-1 border-t text-xs flex items-center justify-between shrink-0"
        style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
      >
        <span>KDP Niche Finder</span>
        <button
          onClick={() => handleSearchAmazon('low content books')}
          className="plain-link text-xs"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          Open Amazon Books
        </button>
      </footer>
    </div>
  );
};
