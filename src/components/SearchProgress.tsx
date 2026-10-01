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
    <div className="px-3.5 py-2 border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-r from-slate-50/80 via-blue-50/20 to-slate-50/80 dark:from-slate-900/60 dark:via-blue-950/20 dark:to-slate-900/60 text-xs">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
          {isComplete ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All {total} details fetched
            </span>
          ) : isRunning ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold">
              <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
              Fetching {current}/{total}
            </span>
          ) : isPaused ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold">
              Paused ({current}/{total})
            </span>
          ) : (
            <span className="text-slate-600 dark:text-slate-300">Ready ({total} books)</span>
          )}

          {currentAsin && isRunning && (
            <span className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              {currentAsin}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isRunning && !isPaused && (
            <button
              onClick={onPause}
              title="Pause background fetch"
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            >
              <Pause className="w-3.5 h-3.5 text-amber-500" />
            </button>
          )}

          {isPaused && (
            <button
              onClick={onResume}
              title="Resume background fetch"
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 transition"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onRefresh}
            title="Re-scan and fetch page"
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
          </button>
        </div>
      </div>

      {/* Progress track */}
      <div className="w-full bg-slate-200/80 dark:bg-slate-800 rounded-full h-2 overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/50">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isComplete
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-xs shadow-emerald-500/30'
              : isPaused
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-xs shadow-amber-500/30'
              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-400 shadow-xs shadow-blue-500/30'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mt-1">
        <span>Safe rate-limit: 1 req / 2-3s</span>
        <span className="font-bold text-slate-600 dark:text-slate-300">{percentage}%</span>
      </div>
    </div>
  );
};
