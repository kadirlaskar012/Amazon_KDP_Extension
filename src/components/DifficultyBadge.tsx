// src/components/DifficultyBadge.tsx
// Plain text difficulty indicator (status color only, no badge fill)
import React from 'react';
import type { CategoryDifficulty } from '../types';

interface DifficultyBadgeProps {
  difficulty?: CategoryDifficulty | null;
  size?: 'sm' | 'md';
  className?: string;
}

export const DifficultyBadge: React.FC<DifficultyBadgeProps> = ({
  difficulty,
  className = '',
}) => {
  if (!difficulty) {
    return <span className={`text-[var(--muted)] ${className}`}>Unchecked</span>;
  }

  switch (difficulty) {
    case 'easy':
      return <span className={`text-[var(--good)] font-bold ${className}`}>Easy</span>;
    case 'medium':
      return <span className={`text-[var(--warn)] font-bold ${className}`}>Medium</span>;
    case 'hard':
      return <span className={`text-[var(--bad)] font-bold ${className}`}>Hard</span>;
  }
};
