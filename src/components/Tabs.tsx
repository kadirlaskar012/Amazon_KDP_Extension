// src/components/Tabs.tsx
// Plain HTML utilitarian tabs separated by thin lines
import React from 'react';

export type TabId =
  | 'overview'
  | 'books'
  | 'keywords'
  | 'categories'
  | 'specs'
  | 'seasonality'
  | 'reviews'
  | 'ideas'
  | 'watchlist'
  | 'discover';

interface TabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  booksCount: number;
}

export const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange, booksCount }) => {
  const tabs: { id: TabId; label: string }[] = [
    { id: 'discover', label: 'Top 10' },
    { id: 'overview', label: 'Overview' },
    { id: 'books', label: booksCount > 0 ? `Books (${booksCount})` : 'Books' },
    { id: 'keywords', label: 'Keywords' },
    { id: 'categories', label: 'Categories' },
    { id: 'specs', label: 'Specs' },
    { id: 'seasonality', label: 'Seasonality' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'ideas', label: 'Ideas' },
    { id: 'watchlist', label: 'Watchlist' },
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-x-1 gap-y-0.5 px-2 py-1 border-b border-[var(--line)] bg-[var(--bg)] select-none"
      role="tablist"
    >
      {tabs.map((tab, idx) => {
        const isActive = activeTab === tab.id;
        return (
          <React.Fragment key={tab.id}>
            {idx > 0 && (
              <span style={{ color: 'var(--line)', fontSize: 'var(--font-small)' }}>|</span>
            )}
            <button
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.id)}
              className={`tab-btn ${isActive ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};
