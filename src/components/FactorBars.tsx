import React from 'react';
import type { ScoreBreakdown, FactorBreakdown } from '../types';

interface FactorBarsProps {
  breakdown?: ScoreBreakdown;
}

export const FactorBars: React.FC<FactorBarsProps> = ({ breakdown }) => {
  if (!breakdown) return null;

  const factors: FactorBreakdown[] = [
    breakdown.demand,
    breakdown.competitionGap,
    breakdown.weakCompetitors,
    breakdown.profit,
    breakdown.newEntrant,
  ];

  return (
    <div className="space-y-3.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
          <span>Score Breakdown (5 Factors)</span>
        </span>
        <span className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
          Max: 100 pts
        </span>
      </div>

      <div className="space-y-3 pt-1">
        {factors.map((factor, idx) => {
          const percentage =
            factor.maxPoints > 0
              ? Math.min(100, Math.round((factor.points / factor.maxPoints) * 100))
              : 0;

          // Unique gradient per factor for a colorful, lively dashboard
          const factorGradients = [
            'bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 shadow-xs shadow-blue-500/20',
            'bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 shadow-xs shadow-purple-500/20',
            'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 shadow-xs shadow-amber-500/20',
            'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 shadow-xs shadow-emerald-500/20',
            'bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500 shadow-xs shadow-pink-500/20',
          ];

          const grad = factorGradients[idx % factorGradients.length];

          return (
            <div key={factor.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {factor.name}
                </span>
                <span className="font-mono text-[11px] font-extrabold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                  {factor.points}{' '}
                  <span className="text-slate-400 font-normal">/ {factor.maxPoints}</span>
                </span>
              </div>

              {/* Progress track */}
              <div className="w-full bg-slate-100 dark:bg-slate-800/80 rounded-full h-2 overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/40">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${grad}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {/* Human explanation sentence */}
              <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                {factor.explanation}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
