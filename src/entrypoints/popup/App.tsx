// src/entrypoints/popup/App.tsx
// KDP Niche Finder Popup — 440px fixed width, 560-600px height.
// Tabs: Top 10 | Watchlist (n) | Snapshots (n) | Tools
// Default tab: Top 10 (read-only view of the latest snapshot's top 10 books)

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { WatchlistItem, SearchSnapshot, Settings } from '../../types';
import { getWatchlist, removeFromWatchlist, getTrend } from '../../services/watchlist';
import { refreshWatchlist } from '../../services/tracker';
import { getSnapshots, getSettings, saveSettings, clearCache } from '../../storage';
import { BsrChart } from '../../components/BsrChart';
import { TrendArrow } from '../../components/TrendArrow';

type PopupTab = 'top10' | 'watchlist' | 'snapshots' | 'tools';

// ─── Quick links — mirrored from the Options seed list ───────────────────────
const POPULAR_NICHES = [
  { label: 'Coloring Books',    q: 'coloring books for kids' },
  { label: 'Activity Books',    q: 'activity books for toddlers' },
  { label: 'Gratitude Journal', q: 'gratitude journal for women' },
  { label: 'Log Books',         q: 'log book record keeper' },
  { label: 'Word Search',       q: 'word search puzzle book' },
  { label: 'Sudoku',            q: 'sudoku puzzle book for adults' },
  { label: 'Maze Book',         q: 'maze book for kids' },
  { label: 'Handwriting',       q: 'handwriting practice book for kids' },
  { label: 'Dot Markers',       q: 'dot markers activity book' },
];

// ─── Helper: tab button style ─────────────────────────────────────────────────
const tabStyle = (active: boolean): React.CSSProperties => ({
  fontWeight: active ? 'bold' : 'normal',
  color: 'var(--text)',
  background: 'none',
  border: 'none',
  borderBottom: active ? '2px solid var(--text)' : '2px solid transparent',
  padding: '2px 4px',
  cursor: 'pointer',
  fontSize: 'var(--font-small)',
  whiteSpace: 'nowrap' as const,
  lineHeight: 'var(--line-height)',
});

// ─── Top 10 Tab ───────────────────────────────────────────────────────────────
interface Top10TabProps {
  snapshot: SearchSnapshot | null;
  onAnalyze: (query: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const Top10Tab: React.FC<Top10TabProps> = ({ snapshot, onAnalyze, onRefresh, isRefreshing }) => {
  const books = snapshot ? snapshot.books.slice(0, 10) : [];
  const score = snapshot?.scores;
  const dateStr = snapshot
    ? new Date(snapshot.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    : null;

  const statusLabel = (() => {
    if (!snapshot) return null;
    if (!score) return 'No Score';
    if (score.label === 'green') return 'Strong';
    if (score.label === 'yellow') return 'Moderate';
    if (score.label === 'red') return 'Weak';
    return 'Insufficient data';
  })();

  const scoreColor = (() => {
    if (!score) return 'var(--muted)';
    if (score.label === 'green') return 'var(--good)';
    if (score.label === 'yellow') return 'var(--warn)';
    return 'var(--bad)';
  })();

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div
        className="flex items-center justify-between pb-1 border-b"
        style={{ borderColor: 'var(--line)', fontSize: 'var(--font-small)' }}
      >
        {snapshot ? (
          <span style={{ color: 'var(--muted)' }}>
            &quot;{snapshot.query}&quot; &middot; {dateStr}
            {score && (
              <span style={{ marginLeft: 6, fontWeight: 'bold', color: scoreColor }}>
                {score.total}/100 · {statusLabel}
              </span>
            )}
          </span>
        ) : (
          <span style={{ color: 'var(--muted)' }}>No scan yet</span>
        )}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="plain-btn plain-btn-sm"
        >
          {isRefreshing ? 'Scanning…' : 'Refresh Now'}
        </button>
      </div>

      {books.length > 0 ? (
        <div className="border" style={{ borderColor: 'var(--line)' }}>
          <table className="plain-table" style={{ fontSize: 'var(--font-small)' }}>
            <thead>
              <tr>
                <th style={{ width: '24px' }}>#</th>
                <th>Title</th>
                <th className="text-right" style={{ width: '36px' }}>BSR</th>
                <th className="text-center" style={{ width: '28px' }}>Rev</th>
                <th className="text-center" style={{ width: '36px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book, idx) => (
                <tr key={book.asin}>
                  <td
                    className="text-center font-bold"
                    style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    {idx + 1}
                  </td>
                  <td
                    style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={book.title}
                  >
                    {book.title}
                  </td>
                  <td
                    className="text-right"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}
                  >
                    {book.bsrOverall ? `#${book.bsrOverall.toLocaleString()}` : '—'}
                  </td>
                  <td
                    className="text-center"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}
                  >
                    {book.reviewCount ?? '—'}
                  </td>
                  <td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onAnalyze(book.title)}
                      className="plain-link"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'var(--font-small)' }}
                      title={`Analyze: ${book.title}`}
                    >
                      Search
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="p-4 text-center border"
          style={{ borderColor: 'var(--line)', color: 'var(--muted)', borderRadius: '2px', fontSize: 'var(--font-small)' }}
        >
          No scan yet. Open an Amazon Books page to run the analyzer, or press <strong>Refresh Now</strong> above.
        </div>
      )}
    </div>
  );
};

// ─── Main Popup ───────────────────────────────────────────────────────────────
export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PopupTab>('top10');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [snapshots, setSnapshots] = useState<SearchSnapshot[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedAsin, setExpandedAsin] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isTop10Refreshing, setIsTop10Refreshing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cacheCleared, setCacheCleared] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Navigate to Amazon search — same as sidebar header input
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

  const handleRefreshWatchlist = async () => {
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

  // "Refresh now" for Top 10 — opens the Amazon Books page so the sidebar scanner runs
  const handleTop10Refresh = async () => {
    if (isTop10Refreshing) return;
    setIsTop10Refreshing(true);
    try {
      const url = 'https://www.amazon.com/s?i=stripbooks&k=low+content+books';
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url });
      } else {
        window.open(url, '_blank');
      }
    } finally {
      // Reset flag after brief delay
      setTimeout(() => setIsTop10Refreshing(false), 1500);
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

  // Last refresh time — only show when list has items
  const lastRefreshTime = useMemo(() => {
    let latest = 0;
    for (const w of watchlist) {
      if (w.lastCheckedAt && w.lastCheckedAt > latest) {
        latest = w.lastCheckedAt;
      }
    }
    return latest > 0
      ? new Date(latest).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;
  }, [watchlist]);

  const hasCaptcha = watchlist.some((w) => w.lastStatus === 'captcha');

  // Latest snapshot for Top 10 tab
  const latestSnapshot: SearchSnapshot | null = (snapshots[0] as SearchSnapshot | undefined) ?? null;

  // Root style vars must be applied regardless of which tab is active
  const rootStyle: React.CSSProperties = {
    width: '440px',
    minHeight: '560px',
    maxHeight: '600px',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'var(--font-base, system-ui, Arial, sans-serif)',
    fontSize: 'var(--font-base-size)',
    lineHeight: 'var(--line-height)',
    boxSizing: 'border-box',
    overflowX: 'hidden',
  };

  return (
    <div className={isDarkMode ? 'dark' : ''} style={rootStyle}>

      {/* Toast */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '8px',
            right: '8px',
            zIndex: 50,
            padding: '4px 8px',
            border: '1px solid var(--line)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 'var(--font-small)',
            borderRadius: '2px',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          padding: '6px 8px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          flexWrap: 'wrap',
          gap: '4px',
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: 'var(--font-heading)' }}>KDP Niche Finder</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button onClick={toggleTheme} className="plain-btn plain-btn-sm" title="Toggle theme">
            {isDarkMode ? 'Light' : 'Dark'}
          </button>
          <button onClick={openSettings} className="plain-btn plain-btn-sm" title="Open Settings">
            Settings
          </button>
        </div>
      </header>

      {/* ── SEARCH ROW + QUICK LINKS ────────────────────────────────────────── */}
      <div
        style={{
          padding: '8px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flexShrink: 0,
        }}
      >
        {/* Search form — input flex:1 min-width:0, button no-shrink */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearchAmazon(searchQuery);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search Amazon Books niche..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="plain-input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="submit" className="plain-btn" style={{ flexShrink: 0, fontWeight: 500 }}>
            Search
          </button>
        </form>

        {/* Quick links — flex-wrap so they always fit */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px 8px',
            fontSize: 'var(--font-small)',
            alignItems: 'center',
            overflowWrap: 'anywhere',
          }}
        >
          <span style={{ color: 'var(--muted)', flexShrink: 0 }}>Quick:</span>
          {POPULAR_NICHES.map((n) => (
            <button
              key={n.q}
              onClick={() => handleSearchAmazon(n.q)}
              className="plain-link"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'var(--font-small)' }}
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB BAR ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '0 8px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
          flexWrap: 'wrap',
          minHeight: '32px',
        }}
      >
        <button style={tabStyle(activeTab === 'top10')} onClick={() => setActiveTab('top10')}>
          Top 10
        </button>
        <span style={{ color: 'var(--line)' }}>|</span>
        <button style={tabStyle(activeTab === 'watchlist')} onClick={() => setActiveTab('watchlist')}>
          Watchlist ({watchlist.length})
        </button>
        <span style={{ color: 'var(--line)' }}>|</span>
        <button style={tabStyle(activeTab === 'snapshots')} onClick={() => setActiveTab('snapshots')}>
          Snapshots ({snapshots.length})
        </button>
        <span style={{ color: 'var(--line)' }}>|</span>
        <button style={tabStyle(activeTab === 'tools')} onClick={() => setActiveTab('tools')}>
          Tools
        </button>
      </div>

      {/* CAPTCHA banner — shown above content if needed */}
      {hasCaptcha && (
        <div
          style={{
            margin: '8px 8px 0',
            padding: '6px 8px',
            border: '1px solid var(--warn)',
            color: 'var(--warn)',
            fontSize: 'var(--font-small)',
            flexShrink: 0,
          }}
        >
          <strong>Verification Required:</strong> Open Amazon in a tab, solve the puzzle, then click Refresh.
        </div>
      )}

      {/* ── CONTENT AREA ────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '8px',
        }}
      >
        {loading ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--font-small)' }}>
            Loading extension data…
          </div>
        ) : activeTab === 'top10' ? (
          /* ── TAB: TOP 10 ── */
          <Top10Tab
            snapshot={latestSnapshot}
            onAnalyze={handleSearchAmazon}
            onRefresh={handleTop10Refresh}
            isRefreshing={isTop10Refreshing}
          />
        ) : activeTab === 'watchlist' ? (
          /* ── TAB: WATCHLIST ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Controls row — only when list has items */}
            {watchlist.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '4px',
                  borderBottom: '1px solid var(--line)',
                  fontSize: 'var(--font-small)',
                }}
              >
                <span style={{ color: 'var(--muted)' }}>
                  {lastRefreshTime ? `Refreshed: ${lastRefreshTime}` : 'Not refreshed yet'}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={handleExportCsv} className="plain-btn plain-btn-sm">
                    Export CSV
                  </button>
                  <button
                    onClick={handleRefreshWatchlist}
                    disabled={isRefreshing}
                    className="plain-btn plain-btn-sm"
                  >
                    {isRefreshing ? 'Checking…' : 'Refresh All'}
                  </button>
                </div>
              </div>
            )}

            {watchlist.length > 0 ? (
              <div style={{ border: '1px solid var(--line)' }}>
                <table className="plain-table" style={{ fontSize: 'var(--font-small)' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '20px' }}></th>
                      <th>Title</th>
                      <th className="text-right">BSR</th>
                      <th className="text-center">Trend</th>
                      <th className="text-right">Price</th>
                      <th className="text-center">Act.</th>
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
                            style={{ cursor: 'pointer' }}
                          >
                            <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--font-small)' }}>
                              {isExpanded ? '▼' : '►'}
                            </td>
                            <td
                              style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}
                              title={item.title}
                            >
                              {item.title}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                              {currentBsr ? `#${currentBsr.toLocaleString()}` : 'N/A'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <TrendArrow trend={trend.trend} percentChange={trend.percentChange} />
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {latestPoint?.price !== undefined ? `$${latestPoint.price.toFixed(2)}` : '—'}
                            </td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                              <a
                                href={amazonUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="plain-link"
                                style={{ marginRight: '6px' }}
                              >
                                Link
                              </a>
                              <button
                                onClick={(e) => handleRemove(e, item.asin)}
                                className="plain-link"
                                style={{ color: 'var(--bad)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                              >
                                Del
                              </button>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={6} style={{ padding: '8px', background: 'var(--bg)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <table className="plain-table" style={{ width: '100%', fontSize: 'var(--font-small)' }}>
                                    <tbody>
                                      <tr>
                                        <td style={{ fontWeight: 500 }}>Best BSR:</td>
                                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--good)' }}>
                                          {trend.bestBsr ? `#${trend.bestBsr.toLocaleString()}` : 'N/A'}
                                        </td>
                                        <td style={{ fontWeight: 500 }}>Worst:</td>
                                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--bad)' }}>
                                          {trend.worstBsr ? `#${trend.worstBsr.toLocaleString()}` : 'N/A'}
                                        </td>
                                        <td style={{ fontWeight: 500 }}>Days:</td>
                                        <td>{trend.daysTracked}</td>
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
              <div
                style={{
                  padding: '16px',
                  textAlign: 'center',
                  border: '1px solid var(--line)',
                  color: 'var(--muted)',
                  fontSize: 'var(--font-small)',
                }}
              >
                Watchlist is empty. Search books on Amazon and click &quot;Watch&quot; to begin tracking.
              </div>
            )}
          </div>
        ) : activeTab === 'snapshots' ? (
          /* ── TAB: SNAPSHOTS ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ paddingBottom: '4px', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: 'var(--font-small)' }}>
              {snapshots.length} saved search snapshots
            </div>

            {snapshots.length > 0 ? (
              <div style={{ border: '1px solid var(--line)' }}>
                <table className="plain-table" style={{ fontSize: 'var(--font-small)' }}>
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th style={{ width: '72px' }}>Date</th>
                      <th className="text-right" style={{ width: '32px' }}>Books</th>
                      <th className="text-right" style={{ width: '52px' }}>Score</th>
                      <th className="text-center" style={{ width: '36px' }}>Open</th>
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
                          <td
                            style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}
                            title={snap.query}
                          >
                            {snap.query}
                          </td>
                          <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                            {new Date(snap.date).toLocaleDateString()}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                            {snap.books?.length || 0}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: scoreColor }}>
                            {snap.scores ? `${snap.scores.total}/100` : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleSearchAmazon(snap.query)}
                              className="plain-link"
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
              <div
                style={{
                  padding: '16px',
                  textAlign: 'center',
                  border: '1px solid var(--line)',
                  color: 'var(--muted)',
                  fontSize: 'var(--font-small)',
                }}
              >
                No search history yet. Search on Amazon to save niche audits.
              </div>
            )}
          </div>
        ) : (
          /* ── TAB: TOOLS ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ border: '1px solid var(--line)' }}>
              <table className="plain-table" style={{ fontSize: 'var(--font-small)' }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 500 }}>Amazon Book Store</td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => handleSearchAmazon('low content books')} className="plain-btn plain-btn-sm">
                        Open Amazon Books
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500 }}>Options &amp; Settings</td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={openSettings} className="plain-btn plain-btn-sm">
                        Open Settings
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div style={{ fontWeight: 500 }}>Product Cache</div>
                      <div style={{ color: 'var(--muted)', fontSize: 'var(--font-small)' }}>Stores listing details for speed</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={handleClearCache} disabled={cacheCleared} className="plain-btn plain-btn-sm">
                        {cacheCleared ? 'Cleared' : 'Clear Cache'}
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div style={{ fontWeight: 500 }}>Gemini AI Status</div>
                      <div style={{ color: 'var(--muted)', fontSize: 'var(--font-small)' }}>Niche idea generator</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {(settings?.geminiApiKey || (settings?.geminiApiKeys && settings.geminiApiKeys.length > 0)) ? (
                        <span style={{ fontWeight: 'bold', color: 'var(--good)', fontSize: 'var(--font-small)' }}>
                          Configured{settings?.geminiApiKeys && settings.geminiApiKeys.length > 1 ? ` (${settings.geminiApiKeys.length} keys)` : ''}
                        </span>
                      ) : (
                        <button
                          onClick={openSettings}
                          className="plain-link"
                          style={{ color: 'var(--warn)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'var(--font-small)' }}
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

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer
        style={{
          padding: '4px 8px',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          fontSize: 'var(--font-small)',
          color: 'var(--muted)',
        }}
      >
        <span>KDP Niche Finder</span>
        <a
          href="https://www.amazon.com/s?i=stripbooks&k=low+content+books"
          target="_blank"
          rel="noopener noreferrer"
          className="plain-link"
        >
          Open Amazon Books
        </a>
      </footer>
    </div>
  );
};
