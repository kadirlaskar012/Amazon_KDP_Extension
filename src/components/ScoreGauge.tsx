import React from 'react';
import type { NicheScore } from '../types';

interface ScoreGaugeProps {
  score?: NicheScore;
  query: string;
  date?: number;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, query, date }) => {
  const total = score?.total ?? 0;
  const label = score?.label ?? 'insufficient';
  const booksAnalyzed = score?.booksAnalyzed ?? 0;
  const formattedDate = date ? new Date(date).toLocaleDateString() : new Date().toLocaleDateString();

  const labelConfig = {
    green: {
      text: 'Good Opportunity',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      strokeColor: '#10b981', // emerald-500
      badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    },
    yellow: {
      text: 'Moderate Competition',
      textColor: 'text-amber-600 dark:text-amber-400',
      strokeColor: '#f59e0b', // amber-500
      badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    },
    red: {
      text: 'Hard Niche',
      textColor: 'text-rose-600 dark:text-rose-400',
      strokeColor: '#f43f5e', // rose-500
      badgeBg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
    },
    insufficient: {
      text: 'Insufficient Data',
      textColor: 'text-slate-500 dark:text-slate-400',
      strokeColor: '#94a3b8', // slate-400
      badgeBg: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
    },
  }[label];

  // SVG Gauge calculations (circumference for r=42)
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    label === 'insufficient'
      ? circumference
      : circumference - (total / 100) * circumference;

  return (
    <div className="flex flex-col items-center text-center p-3">
      {/* Gauge SVG */}
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
          {/* Background circle track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="stroke-slate-200 dark:stroke-slate-800"
            strokeWidth="9"
            fill="transparent"
          />
          {/* Active score track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={labelConfig.strokeColor}
            strokeWidth="9"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center score readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {label === 'insufficient' ? (
            <span className="text-2xl font-black text-slate-400">N/A</span>
          ) : (
            <div className="flex items-baseline">
              <span className={`text-3xl font-black tracking-tight ${labelConfig.textColor}`}>
                {total}
              </span>
              <span className="text-xs text-slate-400 font-semibold ml-0.5">/100</span>
            </div>
          )}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Niche Score
          </span>
        </div>
      </div>

      {/* Label Badge */}
      <div className="mt-1">
        <span
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${labelConfig.badgeBg}`}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: labelConfig.strokeColor }}
          />
          {labelConfig.text}
        </span>
      </div>

      {/* Query, Books Count, Date subtitle line */}
      <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-normal max-w-xs break-words">
        Based on <strong className="text-slate-700 dark:text-slate-200">{booksAnalyzed} books</strong>
        {' · '}
        search: <span className="font-medium text-slate-700 dark:text-slate-200">"{query || 'Books'}"</span>
        {' · '}
        <span>{formattedDate}</span>
      </div>
    </div>
  );
};
