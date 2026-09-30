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
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] cursor-help transition-colors hover:bg-emerald-500/25">
        <Sparkles className="w-2.5 h-2.5" />
        Opportunity
      </span>

      {showTooltip && reasons.length > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-48 p-2 rounded-lg bg-slate-900 text-white text-[11px] leading-snug shadow-xl border border-slate-700 pointer-events-none">
          <div className="font-semibold text-emerald-400 mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Opportunity Reasons:
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[10px]">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
};
