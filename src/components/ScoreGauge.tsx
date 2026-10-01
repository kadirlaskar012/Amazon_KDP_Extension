// src/components/ScoreGauge.tsx
// Plain text representation of Niche Score (no circular gauge, status color text only)
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

  const labelText =
    label === 'green'
      ? 'Good'
      : label === 'yellow'
      ? 'Moderate'
      : label === 'red'
      ? 'Hard'
      : 'Insufficient Data';

  const colorStyle =
    label === 'green'
      ? 'text-[var(--good)]'
      : label === 'yellow'
      ? 'text-[var(--warn)]'
      : label === 'red'
      ? 'text-[var(--bad)]'
      : 'text-[var(--muted)]';

  return (
    <div className="space-y-0.5">
      <div
        className={`font-bold ${colorStyle}`}
        style={{ fontSize: 'var(--font-title)' }}
      >
        Niche Score: {label === 'insufficient' ? 'N/A' : `${total} / 100`} ({labelText})
      </div>
      <div style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
        Based on {booksAnalyzed} books | search: {query || 'Books'} | {formattedDate}
      </div>
    </div>
  );
};
