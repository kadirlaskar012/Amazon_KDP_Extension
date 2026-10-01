// src/components/FactorBars.tsx
// Plain utilitarian table for score factor breakdown
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
    <div className="space-y-1">
      <div className="font-bold text-xs text-[var(--text)]">
        Score Breakdown (5 Factors)
      </div>
      <table className="plain-table">
        <thead>
          <tr>
            <th>Factor</th>
            <th style={{ width: '50px', textAlign: 'right' }}>Points</th>
            <th style={{ width: '45px', textAlign: 'right' }}>Max</th>
            <th>Explanation</th>
          </tr>
        </thead>
        <tbody>
          {factors.map((f) => (
            <tr key={f.name}>
              <td className="font-bold">{f.name}</td>
              <td className="text-right font-mono font-semibold">{f.points}</td>
              <td className="text-right font-mono text-[var(--muted)]">{f.maxPoints}</td>
              <td className="text-[11px] text-[var(--muted)]">{f.explanation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
