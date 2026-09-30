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
  size = 'md',
  showLabel = false,
}) => {
  const resolvedLabel = label || (score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red');

  const colorStyles = {
    green: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    yellow: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    red: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
  }[resolvedLabel];

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1 font-semibold',
    lg: 'text-base px-3 py-1.5 font-bold',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${colorStyles} ${sizeStyles}`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          resolvedLabel === 'green'
            ? 'bg-emerald-500'
            : resolvedLabel === 'yellow'
            ? 'bg-amber-500'
            : 'bg-rose-500'
        }`}
      />
      <span>{score}/100</span>
      {showLabel && (
        <span className="uppercase text-[10px] tracking-wider opacity-80">
          ({resolvedLabel})
        </span>
      )}
    </span>
  );
};
