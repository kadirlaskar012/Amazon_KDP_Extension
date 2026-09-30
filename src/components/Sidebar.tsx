import React, { useState, useEffect, useMemo } from 'react';
import type { Book, QueueProgressState, Settings, SearchSnapshot } from '../types';
import { Tabs } from './Tabs';
import type { TabId } from './Tabs';
import { OverviewTab } from './tabs/OverviewTab';
import { BooksTab } from './tabs/BooksTab';
import { SearchProgress } from './SearchProgress';
import { CaptchaAlert } from './CaptchaAlert';
import { calculateNicheScore } from '../services/scoring';
import { getSettings } from '../storage/settings';
import { getSnapshots, saveWatchlistItem } from '../storage';
import { DEFAULT_SETTINGS } from '../config/defaults';
import {
  BookMarked,
  Moon,
  Sun,
  ChevronRight,
  Sparkles,
  ChevronLeft,
  History,
} from 'lucide-react';

interface SidebarProps {
  initialBooks: Book[];
  initialQuery: string;
  queueStatus: QueueProgressState;
  captchaUrl?: string;
  onPauseQueue: () => void;
  onResumeQueue: () => void;
  onRescanPage: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  initialBooks,
  initialQuery,
  queueStatus,
  captchaUrl,
  onPauseQueue,
  onResumeQueue,
  onRescanPage,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [query, setQuery] = useState<string>(initialQuery);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [snapshots, setSnapshots] = useState<SearchSnapshot[]>([]);
  const [watchlistSuccess, setWatchlistSuccess] = useState<string | null>(null);

  // Load settings and recent snapshots
  useEffect(() => {
    async function init() {
      const s = await getSettings();
      setSettings(s);
      const snaps = await getSnapshots();
      setSnapshots(snaps);
    }
    init();

    // Listen for storage changes (e.g. from Options page)
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes['kdp_settings']) {
        getSettings().then(setSettings);
      }
      if (areaName === 'local' && changes['kdp_snapshots']) {
        getSnapshots().then(setSnapshots);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, []);

  // Synchronize initial books if updated from props
  useEffect(() => {
    setBooks(initialBooks);
  }, [initialBooks]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Compute Niche Score reactively in a pure function
  const currentScore = useMemo(() => {
    return calculateNicheScore(books, settings);
  }, [books, settings]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleSelectSnapshot = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedIdx = parseInt(e.target.value, 10);
    if (!isNaN(selectedIdx) && snapshots[selectedIdx]) {
      const selected = snapshots[selectedIdx]!;
      setQuery(selected.query);
      setBooks(selected.books);
    }
  };

  const handleAddToWatchlist = async (book: Book) => {
    try {
      await saveWatchlistItem({
        asin: book.asin,
        title: book.title,
        author: book.author,
        price: book.price,
        addedAt: Date.now(),
        history: [
          {
            date: Date.now(),
            bsr: book.bsrOverall,
            price: book.price,
            reviewCount: book.reviewCount,
          },
        ],
      });
      setWatchlistSuccess(`Added "${book.title.slice(0, 20)}..." to watchlist!`);
      setTimeout(() => setWatchlistSuccess(null), 3000);
    } catch (err) {
      console.warn('Failed to add to watchlist:', err);
    }
  };

  // Render collapsed button if closed
  if (!isOpen) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-0 top-24 z-[999999] flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-l-xl shadow-2xl transition-all cursor-pointer font-sans text-xs font-semibold"
          title="Open KDP Niche Finder"
        >
          <ChevronLeft className="w-4 h-4" />
          <BookMarked className="w-4 h-4" />
          <span>KDP Niche</span>
          {books.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-800 text-[10px]">
              {books.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <aside className="fixed top-0 right-0 bottom-0 w-[380px] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-[999999] font-sans antialiased text-xs transition-colors select-text">
        {/* Header */}
        <header className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <BookMarked className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight flex items-center gap-1">
                KDP Niche Finder
                <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
                  Phase 2
                </span>
              </div>
              <div className="text-[10px] text-slate-400">Personal KDP Intelligence</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* History Dropdown */}
            {snapshots.length > 0 && (
              <div className="relative flex items-center">
                <select
                  onChange={handleSelectSnapshot}
                  defaultValue=""
                  title="Reload a past search snapshot"
                  className="text-[10px] py-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 max-w-[95px] truncate cursor-pointer focus:outline-none"
                >
                  <option value="" disabled>
                    History ({snapshots.length})
                  </option>
                  {snapshots.map((snap, i) => (
                    <option key={i} value={i}>
                      "{snap.query}" ({new Date(snap.date).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={toggleTheme}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsOpen(false)}
              title="Collapse Sidebar"
              className="p-1 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Captcha Alert if triggered */}
        {queueStatus.captchaDetected && (
          <CaptchaAlert url={captchaUrl} onResume={onResumeQueue} />
        )}

        {/* Progress Bar & Queue Status */}
        <SearchProgress
          status={queueStatus}
          onPause={onPauseQueue}
          onResume={onResumeQueue}
          onRefresh={onRescanPage}
        />

        {/* Watchlist success toast */}
        {watchlistSuccess && (
          <div className="mx-3 my-1 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs">
            {watchlistSuccess}
          </div>
        )}

        {/* Tab Navigation */}
        <Tabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          booksCount={books.length}
        />

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'overview' && (
            <OverviewTab
              query={query}
              books={books}
              score={currentScore}
              settings={settings}
              onGoToBooks={() => setActiveTab('books')}
            />
          )}

          {activeTab === 'books' && (
            <BooksTab
              books={books}
              settings={settings}
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {activeTab !== 'overview' && activeTab !== 'books' && (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <Sparkles className="w-8 h-8 text-blue-500 mx-auto opacity-70" />
              <div className="font-semibold text-slate-700 dark:text-slate-300 text-sm capitalize">
                {activeTab} Module
              </div>
              <p className="text-xs text-slate-400 max-w-[240px] mx-auto">
                Scheduled for upcoming phases (Keywords, Categories, Specs, Reviews, Ideas, Watchlist).
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 text-[10px] text-slate-400 flex items-center justify-between shrink-0">
          <span>KDP Niche Finder · Phase 2</span>
          <span>
            Score:{' '}
            <strong className="text-slate-700 dark:text-slate-200 font-mono">
              {currentScore.label === 'insufficient' ? 'N/A' : `${currentScore.total}/100`}
            </strong>
          </span>
        </footer>
      </aside>
    </div>
  );
};
