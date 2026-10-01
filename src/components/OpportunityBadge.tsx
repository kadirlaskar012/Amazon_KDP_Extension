// src/components/OpportunityBadge.tsx
// Plain text Opportunity indicator without background pill or icons
import React from 'react';

interface OpportunityBadgeProps {
  reasons: string[];
}

export const OpportunityBadge: React.FC<OpportunityBadgeProps> = ({ reasons }) => {
  return (
    <span
      title={reasons.length > 0 ? reasons.join(' • ') : 'Weak competitor opportunity'}
      className="text-[var(--good)] font-bold text-xs"
    >
      Opportunity
    </span>
  );
};
