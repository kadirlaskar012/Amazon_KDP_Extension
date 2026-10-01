// src/components/tabs/DiscoverTab.tsx
// Discover Top 10 Opportunities tab — read-only view with trend, streak, dismiss

import React, { useEffect, useState, useCallback } from 'react';
import type { DiscoverIdea, DiscoverIdeasStorage, DiscoverHistoryEntry } from '../../types/discover';
import {
  getDiscoverIdeas,
  getDiscoverHistory,
  getDiscoverDismissed,
  dismissPhrase,
  restoreDismissedPhrase,
} from '../../storage/discover';
import { enrichWithTrendAndStreak } from '../../services/discoverScanner';
import { DISCOVER_STABLE_STREAK, DISCOVER_DROPPED_OUT_MAX } from '../../config/discoverDefaults';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DroppedEntry {
  phrase: string;
  reason: string;
}

interface DiscoverTabProps {
  /** Called when user clicks [Analyze] on an idea */
  onAnalyzeIdea?: (phrase: string) => void;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatDateTime(ts: number | undefined): string {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function nextRefreshTime(generatedAt: number | undefined): string {
  if (!generatedAt) return 'unknown';
  const next = generatedAt + 20 * 60 * 60 * 1000;
  const now = Date.now();
  if (next <= now) return 'soon';
  const hoursLeft = Math.round((next - now) / (1000 * 60 * 60));
  if (hoursLeft < 1) return 'less than 1 hour';
  return `~${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}`;
}

function completenessLabel(idea: DiscoverIdea): string {
  if (idea.bsrTotal === 0) return 'No data';
  return `BSR ${idea.bsrChecked}/${idea.bsrTotal}`;
}

function statusLabel(idea: DiscoverIdea): string {
  switch (idea.status) {
    case 'verified': return 'Verified';
    case 'checked': return 'Checked';
    default: return 'Quick';
  }
}

function trendText(idea: DiscoverIdea): string {
  return idea.trend ?? (idea.isNewToday ? 'New today' : '');
}

function streakLabel(idea: DiscoverIdea): string {
  if (!idea.streak || idea.streak < 2) return '';
  if (idea.streak >= DISCOVER_STABLE_STREAK) return `${idea.streak}d · Stable`;
  return `${idea.streak}d`;
}

// ── Sub-views ─────────────────────────────────────────────────────────────────
type SubView = 'keyword' | 'book';

// ── Main Component ────────────────────────────────────────────────────────────
export const DiscoverTab: React.FC<DiscoverTabProps> = ({ onAnalyzeIdea }) => {
  const [data, setData] = useState<DiscoverIdeasStorage | null>(null);
  const [history, setHistory] = useState<DiscoverHistoryEntry[]>([]);
  const [droppedOut, setDroppedOut] = useState<DroppedEntry[]>([]);
  const [dismissed, setDismissed] = useState<{ phrase: string; until: number }[]>([]);
  const [subView, setSubView] = useState<SubView>('keyword');
  const [newTodayOnly, setNewTodayOnly] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [ideas, hist, disc] = await Promise.all([
      getDiscoverIdeas(),
      getDiscoverHistory(),
      getDiscoverDismissed(),
    ]);

    // Enrich with trend/streak from history
    if (ideas && ideas.top10.length > 0) {
      const { enriched, droppedOut: dropped } = enrichWithTrendAndStreak(ideas.top10, hist);
      setData({ ...ideas, top10: enriched });
      setDroppedOut(dropped.slice(0, DISCOVER_DROPPED_OUT_MAX));
    } else {
      setData(ideas);
      setDroppedOut([]);
    }
    setHistory(hist);
    setDismissed(disc);
  }, []);

  useEffect(() => {
    loadData();

    // Reload whenever discover data changes in storage
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('kdp_discover_ideas' in changes) loadData();
    };
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, [loadData]);

  const handleRefreshNow = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setStatusMessage('Starting scan...');
    chrome.runtime.sendMessage(
      { type: 'DISCOVER_SCAN_START', forceRefresh: true },
      () => {
        setIsRefreshing(false);
        setStatusMessage('Scan complete. Reloading...');
        setTimeout(() => {
          loadData();
          setStatusMessage(null);
        }, 1000);
      }
    );
  };

  const handleDismiss = async (phrase: string) => {
    await dismissPhrase(phrase, 30);
    await loadData();
  };

  const handleRestoreDismissed = async (phrase: string) => {
    await restoreDismissedPhrase(phrase);
    await loadData();
  };

  // Render status header line
  const renderStatusHeader = () => {
    if (!data) return <p style={{ fontSize: 'var(--font-small)', color: 'var(--text-muted)' }}>No scan data yet. Press Refresh now.</p>;

    const statusMap: Record<string, string> = {
      complete: 'Complete',
      partial: 'Partial scan',
      captcha: 'Stopped — CAPTCHA',
      running: `Running (${data.requestsUsed}/120)`,
      idle: 'Idle',
    };

    return (
      <div style={{ fontSize: 'var(--font-small)', color: 'var(--text-muted)', marginBottom: 8 }}>
        <span>Data as of: <strong style={{ color: 'var(--text)' }}>{formatDateTime(data.generatedAt)}</strong></span>
        {' | '}
        <span>Next auto-refresh: <strong style={{ color: 'var(--text)' }}>{nextRefreshTime(data.generatedAt)}</strong></span>
        {' | '}
        <span>Status: <strong style={{ color: 'var(--text)' }}>{statusMap[data.scanStatus] ?? data.scanStatus}</strong></span>
        {data.scanStatus === 'captcha' && (
          <span style={{ color: '#ef4444', marginLeft: 8 }}>
            Amazon asked for verification. Solve it on Amazon, then press Refresh now.
          </span>
        )}
      </div>
    );
  };

  // Filter ideas by sub-view
  const ideas10 = data?.top10 ?? [];
  const filteredIdeas = ideas10.filter((idea) => {
    if (newTodayOnly && !idea.isNewToday) return false;
    // "Book ideas" = source is Weak competitor or Rising today (ASIN-backed)
    // "Keyword ideas" = everything else
    if (subView === 'book') return idea.asin && (idea.source === 'Weak competitor' || idea.source === 'Rising today' || idea.source === 'New release');
    return true;
  });

  const activeDismissedCount = dismissed.filter((d) => d.until > Date.now()).length;

  return (
    <div style={{ padding: '8px 12px', fontSize: 'var(--font-base)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ fontSize: 'var(--font-heading)', fontWeight: 700, margin: 0 }}>
          Top 10 Opportunities
        </h2>
        <button
          className="plain-btn"
          onClick={handleRefreshNow}
          disabled={isRefreshing}
          style={{ fontSize: 'var(--font-small)' }}
        >
          {isRefreshing ? 'Scanning...' : 'Refresh now'}
        </button>
      </div>

      {statusMessage && (
        <p style={{ fontSize: 'var(--font-small)', color: 'var(--text-muted)', marginBottom: 6 }}>{statusMessage}</p>
      )}

      {renderStatusHeader()}

      {/* Sub-view + filter toggles */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <button
          className={`plain-btn-sm ${subView === 'keyword' ? 'active' : ''}`}
          onClick={() => setSubView('keyword')}
        >
          Keyword ideas (10)
        </button>
        <span style={{ color: 'var(--line)' }}>|</span>
        <button
          className={`plain-btn-sm ${subView === 'book' ? 'active' : ''}`}
          onClick={() => setSubView('book')}
        >
          Book ideas (10)
        </button>
        <span style={{ color: 'var(--line)' }}>|</span>
        <label style={{ fontSize: 'var(--font-small)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={newTodayOnly}
            onChange={(e) => setNewTodayOnly(e.target.checked)}
          />
          New today only
        </label>
      </div>

      {/* Main table */}
      {filteredIdeas.length === 0 ? (
        <p style={{ fontSize: 'var(--font-small)', color: 'var(--text-muted)' }}>
          {ideas10.length === 0
            ? 'No ideas yet. Press Refresh now to scan Amazon for opportunities.'
            : 'No ideas match the current filter.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-small)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                <th style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>#</th>
                <th style={{ padding: '4px 6px' }}>Idea</th>
                <th style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>Score</th>
                <th style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>Data</th>
                <th style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>Source</th>
                <th style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>Trend</th>
                <th style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>Streak</th>
                <th style={{ padding: '4px 6px' }}>Why</th>
                <th style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIdeas.map((idea, idx) => (
                <tr
                  key={idea.phrase}
                  style={{
                    borderBottom: '1px solid var(--line)',
                    background: idx % 2 === 0 ? 'transparent' : 'var(--bg-alt, rgba(0,0,0,0.03))',
                  }}
                >
                  <td style={{ padding: '4px 6px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td style={{ padding: '4px 6px', fontWeight: 600 }}>{idea.phrase}</td>
                  <td style={{ padding: '4px 6px' }}>{idea.score > 0 ? idea.score : '—'}</td>
                  <td style={{ padding: '4px 6px' }}>{statusLabel(idea)}</td>
                  <td style={{ padding: '4px 6px' }}>{completenessLabel(idea)}</td>
                  <td style={{ padding: '4px 6px', color: 'var(--text-muted)' }}>{idea.source}</td>
                  <td style={{ padding: '4px 6px' }}>
                    {trendText(idea)}
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    {streakLabel(idea)}
                  </td>
                  <td style={{ padding: '4px 6px', fontSize: 'var(--font-small)', color: 'var(--text-muted)', maxWidth: 180 }}>
                    {idea.whyText}
                  </td>
                  <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>
                    <button
                      className="plain-btn-sm"
                      onClick={() => onAnalyzeIdea?.(idea.phrase)}
                      style={{ marginRight: 4 }}
                    >
                      Analyze
                    </button>
                    <button
                      className="plain-btn-sm"
                      onClick={() => handleDismiss(idea.phrase)}
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Dismiss
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer note */}
      <p style={{ fontSize: 'var(--font-small)', color: 'var(--text-muted)', marginTop: 10 }}>
        Scores are estimates from Amazon page data as of the last scan. Click Analyze for the full check.
      </p>

      {/* Dropped out section */}
      {droppedOut.length > 0 && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, marginBottom: 6 }}>
            Dropped out since yesterday
          </h3>
          <ul style={{ paddingLeft: 16, margin: 0, fontSize: 'var(--font-small)', color: 'var(--text-muted)' }}>
            {droppedOut.map((d) => (
              <li key={d.phrase} style={{ marginBottom: 4 }}>
                <strong style={{ color: 'var(--text)' }}>{d.phrase}</strong> — {d.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dismissed list */}
      <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
        <button
          className="plain-btn-sm"
          onClick={() => setShowDismissed((v) => !v)}
          style={{ fontSize: 'var(--font-small)' }}
        >
          Dismissed ({activeDismissedCount}){showDismissed ? ' ▲' : ' ▼'}
        </button>
        {showDismissed && (
          <div style={{ marginTop: 8 }}>
            {dismissed.filter((d) => d.until > Date.now()).length === 0 ? (
              <p style={{ fontSize: 'var(--font-small)', color: 'var(--text-muted)' }}>No dismissed ideas.</p>
            ) : (
              <ul style={{ paddingLeft: 0, margin: 0, listStyle: 'none', fontSize: 'var(--font-small)' }}>
                {dismissed.filter((d) => d.until > Date.now()).map((d) => (
                  <li key={d.phrase} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{d.phrase}</span>
                    <button
                      className="plain-btn-sm"
                      onClick={() => handleRestoreDismissed(d.phrase)}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* History summary (last 5 days) */}
      {history.length > 0 && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, marginBottom: 4 }}>
            History ({history.length} days kept)
          </h3>
          <p style={{ fontSize: 'var(--font-small)', color: 'var(--text-muted)', margin: 0 }}>
            Last scan dates: {history.slice(0, 5).map((h) => h.date).join(', ')}
            {history.length > 5 ? ` + ${history.length - 5} more` : ''}
          </p>
        </div>
      )}
    </div>
  );
};
