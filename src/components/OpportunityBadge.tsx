import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

interface OpportunityBadgeProps {
  reasons: string[];
}

export const OpportunityBadge: React.FC<OpportunityBadgeProps> = ({ reasons }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        title={reasons.join(' • ')}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-amber-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] cursor-help transition-all hover:scale-105 hover:shadow-xs shadow-emerald-500/10 select-none"
      >
        <Sparkles className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
        Opportunity
      </span>

      {showTooltip && reasons.length > 0 && (
        <div className="absolute bottom-full right-0 mb-1.5 z-50 w-52 p-2.5 rounded-lg bg-slate-900 text-white text-[11px] leading-snug shadow-2xl border border-slate-700 pointer-events-none whitespace-normal text-left">
          <div className="font-semibold text-emerald-400 mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Opportunity Reasons:
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[10px]">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <div className="absolute top-full right-4 -mt-1 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
};
