// src/components/Tabs.tsx
// Plain HTML utilitarian tabs separated by thin lines
import React from 'react';

export type TabId =
  | 'overview'
  | 'books'
  | 'keywords'
  | 'categories'
  | 'specs'
  | 'reviews'
  | 'ideas'
  | 'watchlist';

interface TabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  booksCount: number;
}

export const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange, booksCount }) => {
  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'books', label: booksCount > 0 ? `Books (${booksCount})` : 'Books' },
    { id: 'keywords', label: 'Keywords' },
    { id: 'categories', label: 'Categories' },
    { id: 'specs', label: 'Specs' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'ideas', label: 'Ideas' },
    { id: 'watchlist', label: 'Watchlist' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-1.5 border-b border-[var(--line)] bg-[var(--bg)] text-xs select-none">
      {tabs.map((tab, idx) => {
        const isActive = activeTab === tab.id;
        return (
          <React.Fragment key={tab.id}>
            {idx > 0 && <span className="text-[var(--line)]">|</span>}
            <button
              onClick={() => onTabChange(tab.id)}
              className={`py-0.5 cursor-pointer text-xs ${
                isActive
                  ? 'font-bold text-[var(--text)] border-b-2 border-[var(--text)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {tab.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};
