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

  const statusText = isComplete
    ? `Fetched ${total}/${total} details`
    : isRunning
    ? `Fetched ${current}/${total} details${currentAsin ? ` (${currentAsin})` : ''}`
    : isPaused
    ? `Paused (${current}/${total})`
    : `Ready (${total} books)`;

  return (
    <div className="px-2.5 py-1.5 border-b border-[var(--line)] bg-[var(--bg)] text-xs space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-[var(--text)]">
          {statusText}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {isRunning && !isPaused && (
            <button onClick={onPause} className="plain-btn" title="Pause fetch">
              Pause
            </button>
          )}
          {isPaused && (
            <button onClick={onResume} className="plain-btn" title="Resume fetch">
              Resume
            </button>
          )}
          <button onClick={onRefresh} className="plain-btn" title="Refresh/rescan search">
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

      <div className="text-[11px] text-[var(--muted)]">
        Rate limit: 1 req / 2-3s
      </div>
    </div>
  );
};
