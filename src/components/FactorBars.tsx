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
    <div className="space-y-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
        <span>Score Breakdown (5 Factors)</span>
        <span className="text-[10px] text-slate-400 font-normal">Sum: 100 pts max</span>
      </div>

      <div className="space-y-3 pt-1">
        {factors.map((factor) => {
          const percentage =
            factor.maxPoints > 0
              ? Math.min(100, Math.round((factor.points / factor.maxPoints) * 100))
              : 0;

          const barColor =
            percentage >= 75
              ? 'bg-emerald-500'
              : percentage >= 50
              ? 'bg-blue-500'
              : percentage >= 25
              ? 'bg-amber-500'
              : 'bg-rose-500';

          return (
            <div key={factor.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {factor.name}
                </span>
                <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                  {factor.points}{' '}
                  <span className="text-slate-400 font-normal">/ {factor.maxPoints} pts</span>
                </span>
              </div>

              {/* Progress track */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
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
