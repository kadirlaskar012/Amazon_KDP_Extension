// src/components/ScoreBadge.tsx
// Plain text score with status color, no pill or background fill
import React from 'react';

interface ScoreBadgeProps {
  score?: number;
  label?: 'green' | 'yellow' | 'red';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  score = 0,
  label,
  showLabel = false,
}) => {
  const resolvedLabel = label || (score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red');
  const colorClass =
    resolvedLabel === 'green'
      ? 'text-[var(--good)] font-bold'
      : resolvedLabel === 'yellow'
      ? 'text-[var(--warn)] font-bold'
      : 'text-[var(--bad)] font-bold';

  const textLabel =
    resolvedLabel === 'green' ? 'High' : resolvedLabel === 'yellow' ? 'Med' : 'Low';

  return (
    <span className={colorClass}>
      {score}
      {showLabel ? ` (${textLabel})` : ''}
    </span>
  );
};
