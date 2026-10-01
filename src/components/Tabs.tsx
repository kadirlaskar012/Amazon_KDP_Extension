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

interface TabTheme {
  activeGrad: string;
  activeShadow: string;
  inactiveIconColor: string;
  hoverBorder: string;
}

const TAB_THEMES: Record<TabId, TabTheme> = {
  overview: {
    activeGrad: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white',
    activeShadow: 'shadow-md shadow-blue-500/25',
    inactiveIconColor: 'text-blue-500',
    hoverBorder: 'hover:border-blue-300 dark:hover:border-blue-700/60',
  },
  books: {
    activeGrad: 'bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white',
    activeShadow: 'shadow-md shadow-purple-500/25',
    inactiveIconColor: 'text-purple-500',
    hoverBorder: 'hover:border-purple-300 dark:hover:border-purple-700/60',
  },
  keywords: {
    activeGrad: 'bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-600 text-white',
    activeShadow: 'shadow-md shadow-cyan-500/25',
    inactiveIconColor: 'text-teal-500',
    hoverBorder: 'hover:border-teal-300 dark:hover:border-teal-700/60',
  },
  categories: {
    activeGrad: 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white',
    activeShadow: 'shadow-md shadow-amber-500/25',
    inactiveIconColor: 'text-amber-500',
    hoverBorder: 'hover:border-amber-300 dark:hover:border-amber-700/60',
  },
  specs: {
    activeGrad: 'bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-600 text-white',
    activeShadow: 'shadow-md shadow-pink-500/25',
    inactiveIconColor: 'text-fuchsia-500',
    hoverBorder: 'hover:border-pink-300 dark:hover:border-pink-700/60',
  },
  reviews: {
    activeGrad: 'bg-gradient-to-r from-rose-500 via-red-500 to-pink-600 text-white',
    activeShadow: 'shadow-md shadow-rose-500/25',
    inactiveIconColor: 'text-rose-500',
    hoverBorder: 'hover:border-rose-300 dark:hover:border-rose-700/60',
  },
  ideas: {
    activeGrad: 'bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 text-slate-950 font-bold',
    activeShadow: 'shadow-md shadow-yellow-500/25',
    inactiveIconColor: 'text-amber-500',
    hoverBorder: 'hover:border-amber-300 dark:hover:border-amber-700/60',
  },
  watchlist: {
    activeGrad: 'bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 text-white',
    activeShadow: 'shadow-md shadow-emerald-500/25',
    inactiveIconColor: 'text-emerald-500',
    hoverBorder: 'hover:border-emerald-300 dark:hover:border-emerald-700/60',
  },
};

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
    <div className="grid grid-cols-4 gap-1.5 p-2 bg-gradient-to-b from-slate-100/90 to-slate-200/50 dark:from-slate-950 dark:to-slate-900/90 border-b border-slate-200/80 dark:border-slate-800">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const theme = TAB_THEMES[tab.id];

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer select-none truncate ${
              isActive
                ? `${theme.activeGrad} ${theme.activeShadow} scale-[1.02]`
                : `bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80 ${theme.hoverBorder}`
            }`}
            title={tab.label}
          >
            <span className={`shrink-0 transition-colors ${isActive ? 'text-inherit' : theme.inactiveIconColor}`}>
              {tab.icon}
            </span>
            <span className="truncate">{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold shrink-0 ${
                  isActive
                    ? 'bg-white/30 text-white'
                    : 'bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50'
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
