import type { QueueProgressState } from '../types';
import { Pause, Play, RefreshCw, CheckCircle2 } from 'lucide-react';

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

  return (
    <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-xs">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
          {isComplete ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All {total} details fetched
            </span>
          ) : isRunning ? (
            <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Fetching {current}/{total}
            </span>
          ) : isPaused ? (
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              Paused ({current}/{total})
            </span>
          ) : (
            <span>Ready ({total} books)</span>
          )}

          {currentAsin && isRunning && (
            <span className="text-[10px] text-slate-400 font-mono">({currentAsin})</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isRunning && !isPaused && (
            <button
              onClick={onPause}
              title="Pause background fetch"
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          )}

          {isPaused && (
            <button
              onClick={onResume}
              title="Resume background fetch"
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 transition"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onRefresh}
            title="Re-scan and fetch page"
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress track */}
      <div className="w-full bg-slate-200 dark:bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isComplete
              ? 'bg-emerald-500'
              : isPaused
              ? 'bg-amber-500'
              : 'bg-blue-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
        <span>Rate-limit: 1 req / 2-3s (max 20)</span>
        <span>{percentage}%</span>
      </div>
    </div>
  );
};
