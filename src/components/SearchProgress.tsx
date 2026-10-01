// src/components/SearchProgress.tsx
// Plain utilitarian fetch status: thin progress bar, plain status text, plain button
import React from 'react';
import type { QueueProgressState } from '../types';

interface SearchProgressProps {
  status: QueueProgressState;
  onPause: () => void;
  onResume: () => void;
  onRefresh: () => void;
}

/**
 * Formats `currentAsin` for display in the fetch status line.
 * Accepts a raw ASIN (10 alpha-numeric chars) and returns a short display like "(B0XY123456)".
 * Guards against accidentally printing raw epoch timestamps or any value that is purely numeric
 * (which would look like "1577156145" and confuse users).
 *
 * @param currentAsin - The ASIN currently being fetched, or undefined
 */
export function formatFetchHint(currentAsin: string | undefined): string {
  if (!currentAsin) return '';
  // A valid ASIN is 10 chars, starts with a letter (B or similar). Reject pure numbers.
  const isRawTimestamp = /^\d{8,}$/.test(currentAsin.trim());
  if (isRawTimestamp) return ''; // swallow: never print raw timestamps
  return ` (${currentAsin.toUpperCase().slice(0, 10)})`;
}

export const SearchProgress: React.FC<SearchProgressProps> = ({
  status,
  onPause,
  onResume,
  onRefresh,
}) => {
  const { isRunning, isPaused, current, total, currentAsin } = status;
  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const isComplete = total > 0 && current >= total;

  if (total === 0 && !isRunning) {
    return null;
  }

  const fetchHint = formatFetchHint(currentAsin);

  const statusText = isComplete
    ? `Fetched ${total}/${total} details`
    : isRunning
    ? `Fetched ${current}/${total} details${fetchHint}`
    : isPaused
    ? `Paused (${current}/${total})`
    : `Ready (${total} books)`;

  return (
    <div className="px-2.5 py-1.5 border-b border-[var(--line)] bg-[var(--bg)] space-y-1"
      style={{ fontSize: 'var(--font-small)' }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-medium text-[var(--text)]">
          {statusText}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {isRunning && !isPaused && (
            <button onClick={onPause} className="plain-btn plain-btn-sm" title="Pause fetch">
              Pause
            </button>
          )}
          {isPaused && (
            <button onClick={onResume} className="plain-btn plain-btn-sm" title="Resume fetch">
              Resume
            </button>
          )}
          <button onClick={onRefresh} className="plain-btn plain-btn-sm" title="Refresh/rescan search">
            Refresh
          </button>
        </div>
      </div>

      {/* Thin native-looking progress bar: 6px high, gray track, dark fill */}
      <div className="w-full bg-[#e0e0e0] dark:bg-[#333333] h-[6px] overflow-hidden">
        <div
          className="h-full bg-[var(--text)] transition-all duration-200"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
        Rate limit: 1 req / 2-3s
      </div>
    </div>
  );
};
