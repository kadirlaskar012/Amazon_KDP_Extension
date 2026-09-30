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
    <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-1.5 py-2 px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              isActive
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/20'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 font-semibold">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
