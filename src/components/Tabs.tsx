import React from 'react';
import {
  BarChart3,
  BookOpen,
  KeyRound,
  FolderTree,
  Sliders,
  MessageSquareWarning,
  Lightbulb,
  Bookmark,
} from 'lucide-react';

export type TabId =
  | 'overview'
  | 'books'
  | 'keywords'
  | 'categories'
  | 'specs'
  | 'reviews'
  | 'ideas'
  | 'watchlist';

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
}

interface TabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  booksCount: number;
}

export const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange, booksCount }) => {
  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    {
      id: 'books',
      label: 'Books',
      icon: <BookOpen className="w-3.5 h-3.5" />,
      badge: booksCount > 0 ? booksCount : undefined,
    },
    { id: 'keywords', label: 'Keywords', icon: <KeyRound className="w-3.5 h-3.5" /> },
    { id: 'categories', label: 'Categories', icon: <FolderTree className="w-3.5 h-3.5" /> },
    { id: 'specs', label: 'Specs', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'reviews', label: 'Reviews', icon: <MessageSquareWarning className="w-3.5 h-3.5" /> },
    { id: 'ideas', label: 'Ideas', icon: <Lightbulb className="w-3.5 h-3.5" /> },
    { id: 'watchlist', label: 'Watchlist', icon: <Bookmark className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="grid grid-cols-4 gap-1 p-1.5 bg-slate-100/90 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 overflow-hidden">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none truncate ${
              isActive
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm ring-1 ring-blue-500/50'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200/70 dark:border-slate-700/60'
            }`}
            title={tab.label}
          >
            <span className="shrink-0">{tab.icon}</span>
            <span className="truncate">{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold shrink-0 ${
                  isActive
                    ? 'bg-white/25 text-white'
                    : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
