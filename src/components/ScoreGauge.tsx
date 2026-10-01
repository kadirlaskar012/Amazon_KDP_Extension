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
      textColor: 'from-emerald-500 via-teal-500 to-cyan-500',
      gradStart: '#10b981',
      gradEnd: '#06b6d4',
      glowColor: 'rgba(16, 185, 129, 0.4)',
      badgeBg: 'bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-xs shadow-emerald-500/10',
      dotColor: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
    },
    yellow: {
      text: 'Moderate Competition',
      textColor: 'from-amber-500 via-orange-500 to-amber-600',
      gradStart: '#f59e0b',
      gradEnd: '#f97316',
      glowColor: 'rgba(245, 158, 11, 0.4)',
      badgeBg: 'bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 shadow-xs shadow-amber-500/10',
      dotColor: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
    },
    red: {
      text: 'Hard Niche',
      textColor: 'from-rose-500 via-red-500 to-pink-600',
      gradStart: '#f43f5e',
      gradEnd: '#e11d48',
      glowColor: 'rgba(244, 63, 94, 0.4)',
      badgeBg: 'bg-gradient-to-r from-rose-500/15 via-red-500/15 to-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 shadow-xs shadow-rose-500/10',
      dotColor: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]',
    },
    insufficient: {
      text: 'Insufficient Data',
      textColor: 'from-slate-400 to-slate-500',
      gradStart: '#94a3b8',
      gradEnd: '#64748b',
      glowColor: 'rgba(148, 163, 184, 0.2)',
      badgeBg: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
      dotColor: 'bg-slate-400',
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
    <div className="relative flex flex-col items-center text-center p-3.5 overflow-hidden">
      {/* Glow Aura */}
      <div
        className="absolute w-32 h-32 rounded-full blur-3xl opacity-30 pointer-events-none transition-all duration-700"
        style={{ backgroundColor: labelConfig.glowColor }}
      />

      {/* Gauge SVG */}
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90 transform drop-shadow-sm" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={labelConfig.gradStart} />
              <stop offset="100%" stopColor={labelConfig.gradEnd} />
            </linearGradient>
          </defs>
          {/* Background circle track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="stroke-slate-100 dark:stroke-slate-800"
            strokeWidth="9"
            fill="transparent"
          />
          {/* Active score track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="url(#gaugeGrad)"
            strokeWidth="9"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center score readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {label === 'insufficient' ? (
            <span className="text-3xl font-black text-slate-400">N/A</span>
          ) : (
            <div className="flex items-baseline">
              <span className={`text-4xl font-black tracking-tight bg-gradient-to-br ${labelConfig.textColor} bg-clip-text text-transparent`}>
                {total}
              </span>
              <span className="text-xs text-slate-400 font-bold ml-0.5">/100</span>
            </div>
          )}
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400/90 mt-0.5">
            Niche Score
          </span>
        </div>
      </div>

      {/* Label Badge */}
      <div className="mt-1">
        <span
          className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-extrabold border ${labelConfig.badgeBg}`}
        >
          <span className={`w-2 h-2 rounded-full ${labelConfig.dotColor} animate-pulse`} />
          {labelConfig.text}
        </span>
      </div>

      {/* Query, Books Count, Date subtitle line */}
      <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 leading-normal max-w-xs break-words">
        Based on <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{booksAnalyzed} books</strong>
        {' · '}
        search: <span className="font-semibold text-slate-800 dark:text-slate-100">"{query || 'Books'}"</span>
        {' · '}
        <span className="text-slate-400">{formattedDate}</span>
      </div>
    </div>
  );
};
