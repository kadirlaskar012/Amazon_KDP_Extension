// src/components/TrendsLink.tsx
// Small clickable shortcut to open Google Trends for a keyword

import React from 'react';
import { TrendingUp, ExternalLink } from 'lucide-react';
import { buildTrendsUrl } from '../services/trends';

interface TrendsLinkProps {
  keyword: string;
  geo?: string;
  showLabel?: boolean;
  className?: string;
}

export const TrendsLink: React.FC<TrendsLinkProps> = ({
  keyword,
  geo = 'US',
  showLabel = false,
  className = '',
}) => {
  const url = buildTrendsUrl(keyword, geo);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      title={`Check search interest for "${keyword}" on Google Trends (${geo})`}
      className={`inline-flex items-center gap-1 text-slate-400 hover:text-indigo-400 dark:hover:text-indigo-300 transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer ${className}`}
    >
      <TrendingUp className="w-3.5 h-3.5" />
      {showLabel && <span className="text-[11px] font-medium">Trends</span>}
    </button>
  );
};
