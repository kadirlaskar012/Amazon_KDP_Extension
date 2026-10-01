// src/components/TrendArrow.tsx
// Visual trend indicator displaying BSR performance trajectory

import React from 'react';
import type { TrendInfo } from '../types';

interface TrendArrowProps {
  trend: TrendInfo['trend'];
  percentChange?: number;
  showPercent?: boolean;
  className?: string;
}

export const TrendArrow: React.FC<TrendArrowProps> = ({
  trend,
  percentChange,
  showPercent = true,
  className = '',
}) => {
  const formattedPercent =
    percentChange !== undefined ? `${Math.abs(percentChange).toFixed(1)}%` : '';

  switch (trend) {
    case 'improving':
      return (
        <span
          className={`inline-flex items-center gap-0.5 font-bold ${className}`}
          style={{ color: 'var(--good)' }}
          title={`BSR Improving: rank dropped by ${formattedPercent} (Sales velocity up)`}
        >
          <span>▲</span>
          {showPercent && <span className="text-[10px]">{formattedPercent}</span>}
        </span>
      );

    case 'declining':
      return (
        <span
          className={`inline-flex items-center gap-0.5 font-bold ${className}`}
          style={{ color: 'var(--bad)' }}
          title={`BSR Declining: rank rose by ${formattedPercent} (Sales velocity down)`}
        >
          <span>▼</span>
          {showPercent && <span className="text-[10px]">{formattedPercent}</span>}
        </span>
      );

    case 'stable':
      return (
        <span
          className={`inline-flex items-center gap-0.5 ${className}`}
          style={{ color: 'var(--muted)' }}
          title={`BSR Stable: changed within ±5% (${formattedPercent})`}
        >
          <span>—</span>
          {showPercent && <span className="text-[10px]">{formattedPercent}</span>}
        </span>
      );

    case 'unknown':
    default:
      return (
        <span
          className={`inline-flex items-center ${className}`}
          style={{ color: 'var(--muted)' }}
          title="Trend unknown: requires at least 2 tracking days"
        >
          <span className="text-[10px]">?</span>
        </span>
      );
  }
};
