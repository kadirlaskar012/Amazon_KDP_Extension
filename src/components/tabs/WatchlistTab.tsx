// src/components/tabs/WatchlistTab.tsx
// Watchlist and BSR Tracker tab: Plain bordered table of saved books, trends, and trajectory charts

import React, { useState, useEffect } from 'react';
import type { WatchlistItem } from '../../types';
import { getWatchlist, removeFromWatchlist, getTrend } from '../../services/watchlist';
import { refreshWatchlist } from '../../services/tracker';
import { BsrChart } from '../BsrChart';
import { TrendArrow } from '../TrendArrow';

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
        showToast(`Refreshed ${result.updatedCount} books`);
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
    showToast('Exported watchlist CSV');
  };

  const hasCaptcha = watchlist.some((w) => w.lastStatus === 'captcha');

  return (
    <div className="space-y-2 text-[13px] leading-[1.4]" style={{ color: 'var(--text)' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className="fixed bottom-3 right-3 z-50 px-2 py-1 border"
          style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--line)', borderRadius: '2px', fontSize: 'var(--font-small)' }}
        >
          {toastMessage}
        </div>
      )}

      {/* Header and Controls */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b" style={{ borderColor: 'var(--line)' }}>
        <div>
          <span className="font-bold">Tracked Books ({watchlist.length}/50)</span>
          <span className="ml-2" style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
            Daily automated BSR, price, and review tracking
          </span>
        </div>

        <div className="flex items-center gap-1">
          {watchlist.length > 0 && (
            <button
              onClick={handleExportCsv}
              className="plain-btn"
              title="Export Watchlist CSV"
            >
              Export CSV
            </button>
          )}

          <button
            onClick={handleRefreshNow}
            disabled={isRefreshing || watchlist.length === 0}
            className="plain-btn"
            title="Refresh all tracked books now"
          >
            {isRefreshing ? 'Checking...' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* CAPTCHA Warning Banner */}
      {hasCaptcha && (
        <div
          className="p-1.5 text-xs border"
          style={{ borderColor: 'var(--warn)', color: 'var(--warn)', borderRadius: '2px' }}
        >
          <strong>Verification Required:</strong> Amazon asked for verification during tracking. Open an Amazon tab to solve the CAPTCHA, then click Refresh Now.
        </div>
      )}

      {/* Progress status */}
      {isRefreshing && refreshProgress && (
        <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
          Checking item {refreshProgress.current} of {refreshProgress.total}...
        </div>
      )}

      {/* Watchlist Items Table */}
      {watchlist.length > 0 ? (
        <div className="overflow-x-auto border" style={{ borderColor: 'var(--line)', borderRadius: '2px' }}>
          <table className="plain-table">
            <thead>
              <tr>
                <th style={{ width: '24px' }}></th>
                <th>Title</th>
                <th>ASIN</th>
                <th className="text-right">BSR</th>
                <th className="text-center">Trend</th>
                <th className="text-right">Price</th>
                <th className="text-right">Rev</th>
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
                      <td className="text-center" style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
                        {isExpanded ? '▼' : '►'}
                      </td>
                      <td className="max-w-[140px] truncate font-medium" title={item.title}>
                        {item.title}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
                        {item.asin}
                      </td>
                      <td className="text-right font-mono font-medium">
                        {currentBsr ? `#${currentBsr.toLocaleString()}` : 'N/A'}
                      </td>
                      <td className="text-center">
                        <TrendArrow trend={trend.trend} percentChange={trend.percentChange} />
                      </td>
                      <td className="text-right">
                        {item.price ? `$${item.price.toFixed(2)}` : '—'}
                      </td>
                      <td className="text-right">
                        {latestPoint?.reviewCount !== undefined ? latestPoint.reviewCount.toLocaleString() : '—'}
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
                          title="Remove from Watchlist"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="p-2" style={{ background: 'var(--bg)' }}>
                          <div className="space-y-2">
                            {/* Summary stat line */}
                            <table className="plain-table" style={{ width: '100%', marginBottom: '6px' }}>
                              <tbody>
                                <tr>
                                  <td className="font-medium" style={{ width: '25%' }}>Best BSR:</td>
                                  <td className="font-mono" style={{ color: 'var(--good)' }}>
                                    {trend.bestBsr ? `#${trend.bestBsr.toLocaleString()}` : 'N/A'}
                                  </td>
                                  <td className="font-medium" style={{ width: '25%' }}>Worst BSR:</td>
                                  <td className="font-mono" style={{ color: 'var(--bad)' }}>
                                    {trend.worstBsr ? `#${trend.worstBsr.toLocaleString()}` : 'N/A'}
                                  </td>
                                  <td className="font-medium" style={{ width: '25%' }}>Tracked Days:</td>
                                  <td>{trend.daysTracked} days</td>
                                </tr>
                              </tbody>
                            </table>

                            {/* Chart */}
                            <BsrChart history={item.history} height={140} />
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
          className="p-4 text-center border"
          style={{ borderColor: 'var(--line)', borderRadius: '2px', color: 'var(--muted)' }}
        >
          <div className="font-bold" style={{ color: 'var(--text)' }}>Watchlist is empty</div>
          <p className="mt-1" style={{ fontSize: 'var(--font-small)' }}>
            Click "Watch" on any book in the Books tab to track daily BSR and pricing history.
          </p>
        </div>
      )}
    </div>
  );
};
