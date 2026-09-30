// src/components/DifficultyBadge.tsx
// Visual badge displaying Category Difficulty (Easy, Medium, Hard)

import React from 'react';
import type { CategoryDifficulty } from '../types';

interface DifficultyBadgeProps {
  difficulty?: CategoryDifficulty | null;
  size?: 'sm' | 'md';
  className?: string;
}

export const DifficultyBadge: React.FC<DifficultyBadgeProps> = ({
  difficulty,
  size = 'sm',
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs font-semibold' : 'px-3 py-1 text-sm font-semibold';

  if (!difficulty) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60 ${sizeClasses} ${className}`}
      >
        Unchecked
      </span>
    );
  }

  switch (difficulty) {
    case 'easy':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium ${sizeClasses} ${className}`}
        >
          Easy
        </span>
      );
    case 'medium':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium ${sizeClasses} ${className}`}
        >
          Medium
        </span>
      );
    case 'hard':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 font-medium ${sizeClasses} ${className}`}
        >
          Hard
        </span>
      );
  }
};
