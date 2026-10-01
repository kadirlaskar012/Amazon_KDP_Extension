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
      <div className="section-subheading">
        Score Breakdown (5 Factors)
      </div>
      <table className="plain-table">
        <thead>
          <tr>
            <th>Factor</th>
            <th style={{ width: '60px', textAlign: 'right' }}>Points</th>
            <th style={{ width: '50px', textAlign: 'right' }}>Max</th>
            <th>Explanation</th>
          </tr>
        </thead>
        <tbody>
          {factors.map((f) => (
            <tr key={f.name}>
              <td className="font-bold">{f.name}</td>
              <td className="text-right font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>{f.points}</td>
              <td className="text-right" style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{f.maxPoints}</td>
              <td style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>{f.explanation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
