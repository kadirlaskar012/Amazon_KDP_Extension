import React, { useState, useEffect, useMemo } from 'react';
import type { Book, QueueProgressState, Settings, SearchSnapshot } from '../types';
import { Tabs } from './Tabs';
import type { TabId } from './Tabs';
import { OverviewTab } from './tabs/OverviewTab';
import { BooksTab } from './tabs/BooksTab';
import { KeywordsTab } from './tabs/KeywordsTab';
import { CategoriesTab } from './tabs/CategoriesTab';
import { SpecsTab } from './tabs/SpecsTab';
import { ReviewsTab } from './tabs/ReviewsTab';
import { WatchlistTab } from './tabs/WatchlistTab';
import { IdeasTab } from './tabs/IdeasTab';
import { ExportMenu } from './ExportMenu';
import { SearchProgress } from './SearchProgress';
import { CaptchaAlert } from './CaptchaAlert';
import { calculateNicheScore } from '../services/scoring';
import { getSettings } from '../storage/settings';
import { getSnapshots, saveSnapshot, getActiveSnapshot } from '../storage';
import { addToWatchlist, getWatchlist } from '../services/watchlist';
import { DEFAULT_SETTINGS } from '../config/defaults';
import type { KeywordItem, CategoryStat, SpecsSummary, ReviewGapAnalysis, BookIdea, WatchlistItem } from '../types';
import {
  BookMarked,
  Moon,
  Sun,
  ChevronRight,
  Sparkles,
  ChevronLeft,
  History,
  Activity,
  CheckCircle2,
  XCircle,
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
  const [currentSnapshot, setCurrentSnapshot] = useState<SearchSnapshot | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistSuccess, setWatchlistSuccess] = useState<string | null>(null);
  const [healthReport, setHealthReport] = useState<string | null>(null);

  // Load settings, active snapshot, recent snapshots, and watchlist
  useEffect(() => {
    async function init() {
      const s = await getSettings();
      setSettings(s);
      const snaps = await getSnapshots();
      setSnapshots(snaps);
      const active = await getActiveSnapshot();
      if (active) {
        setCurrentSnapshot(active);
      }
      const wl = await getWatchlist();
      setWatchlist(wl);
    }
    init();

    // Listen for storage changes (e.g. from Options page or other tabs)
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
      if (areaName === 'local' && changes['kdp_watchlist']) {
        getWatchlist().then(setWatchlist);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, []);

  // Keyboard shortcut: Esc closes the sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  // Maintain active search snapshot structure
  useEffect(() => {
    if (books.length > 0 || query) {
      setCurrentSnapshot((prev) => ({
        query: query || prev?.query || '',
        date: prev?.date || Date.now(),
        books,
        nicheScore: currentScore,
        keywords: prev?.keywords || [],
        categories: prev?.categories || [],
        specs: prev?.specs,
        reviewGap: prev?.reviewGap,
      }));
    }
  }, [books, query, currentScore]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleSelectSnapshot = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedIdx = parseInt(e.target.value, 10);
    if (!isNaN(selectedIdx) && snapshots[selectedIdx]) {
      const selected = snapshots[selectedIdx]!;
      setQuery(selected.query);
      setBooks(selected.books || []);
      setCurrentSnapshot({
        ...selected,
        keywords: selected.keywords || [],
        categories: selected.categories || [],
        specs: selected.specs,
        reviewGap: selected.reviewGap,
      });
    }
  };

  const handleUpdateSnapshotKeywords = async (keywords: KeywordItem[]) => {
    if (!currentSnapshot) return;
    const updated: SearchSnapshot = {
      ...currentSnapshot,
      keywords,
    };
    setCurrentSnapshot(updated);
    await saveSnapshot(updated);
  };

  const handleUpdateSnapshotCategories = async (categories: CategoryStat[]) => {
    if (!currentSnapshot) return;
    const updated: SearchSnapshot = {
      ...currentSnapshot,
      categories,
    };
    setCurrentSnapshot(updated);
    await saveSnapshot(updated);
  };

  const handleUpdateSnapshotSpecs = async (specs: SpecsSummary) => {
    if (!currentSnapshot) return;
    const updated: SearchSnapshot = {
      ...currentSnapshot,
      specs,
    };
    setCurrentSnapshot(updated);
    await saveSnapshot(updated);
  };

  const handleUpdateSnapshotReviewGap = async (
    reviewGap: ReviewGapAnalysis,
    updatedBooks: Book[]
  ) => {
    if (!currentSnapshot) return;
    const updated: SearchSnapshot = {
      ...currentSnapshot,
      books: updatedBooks,
      reviewGap,
    };
    setCurrentSnapshot(updated);
    setBooks(updatedBooks);
    await saveSnapshot(updated);
  };

  const handleUpdateSnapshotIdeas = async (ideas: BookIdea[]) => {
    if (!currentSnapshot) return;
    const updated: SearchSnapshot = {
      ...currentSnapshot,
      ideas,
    };
    setCurrentSnapshot(updated);
    await saveSnapshot(updated);
  };

  const handleAddToWatchlist = async (book: Book) => {
    try {
      const res = await addToWatchlist(book);
      if (res.success) {
        setWatchlistSuccess(res.message || `Added "${book.title.slice(0, 20)}..." to watchlist!`);
        setTimeout(() => setWatchlistSuccess(null), 3000);
      } else if (res.message) {
        alert(res.message);
      }
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
      <aside className="fixed top-0 right-0 bottom-0 w-[380px] max-w-[100vw] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-[999999] font-sans antialiased text-xs transition-colors select-text">
        {/* Header */}
        <header className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <BookMarked className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight flex items-center gap-1">
                KDP Niche Finder
                <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300">
                  Phase 5
                </span>
              </div>
              <div className="text-[10px] text-slate-400">Personal KDP Intelligence</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Export Menu Dropdown */}
            <ExportMenu
              snapshot={currentSnapshot}
              watchlist={watchlist}
              ideas={currentSnapshot?.ideas || []}
              onImportSnapshot={(imported) => {
                setCurrentSnapshot(imported);
                setBooks(imported.books || []);
                setQuery(imported.query || '');
              }}
            />
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

          {activeTab === 'keywords' && (
            <div className="p-3">
              <KeywordsTab
                snapshot={currentSnapshot}
                settings={settings}
                onUpdateSnapshotKeywords={handleUpdateSnapshotKeywords}
                onCaptchaEncountered={() => onPauseQueue()}
              />
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="p-3">
              <CategoriesTab
                snapshot={currentSnapshot}
                settings={settings}
                onUpdateSnapshotCategories={handleUpdateSnapshotCategories}
                onCaptchaEncountered={() => onPauseQueue()}
              />
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="p-3">
              <SpecsTab
                snapshot={currentSnapshot}
                onUpdateSnapshotSpecs={handleUpdateSnapshotSpecs}
              />
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="p-3">
              <ReviewsTab
                snapshot={currentSnapshot}
                onUpdateSnapshotReviewGap={handleUpdateSnapshotReviewGap}
                onCaptchaEncountered={() => onPauseQueue()}
              />
            </div>
          )}

          {activeTab === 'watchlist' && (
            <div className="p-3">
              <WatchlistTab
                onCaptchaEncountered={() => onPauseQueue()}
              />
            </div>
          )}

          {activeTab === 'ideas' && (
            <div className="p-3">
              <IdeasTab
                snapshot={currentSnapshot}
                onUpdateSnapshotIdeas={handleUpdateSnapshotIdeas}
              />
            </div>
          )}
        </div>

        {/* Health Check diagnostic banner */}
        {healthReport && (
          <div className="px-3 py-1.5 bg-slate-800 border-t border-slate-700 text-[10px] flex items-center justify-between text-slate-300">
            <span>{healthReport}</span>
            <button
              onClick={() => setHealthReport(null)}
              className="text-slate-400 hover:text-white ml-2 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Footer */}
        <footer className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 text-[10px] text-slate-400 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span>KDP Niche Finder · Phase 5</span>
            <button
              onClick={() => {
                // Selector health check on current page
                const searchCards = document.querySelectorAll('div[data-component-type="s-search-result"]').length;
                const bsrEl = document.querySelector('#detailBullets_feature_div, #productDetails_db_sections');
                const reviewsEl = document.querySelector('#cm-cr-dp-review-list, div[data-hook="review"]');
                const isSearch = searchCards > 0;
                const isProduct = Boolean(bsrEl || reviewsEl);

                if (isSearch) {
                  setHealthReport(`✅ Health Check: Search parser OK (${searchCards} cards found)`);
                } else if (isProduct) {
                  setHealthReport(`✅ Health Check: Product details parser OK (${bsrEl ? 'BSR table found' : 'Reviews found'})`);
                } else {
                  setHealthReport('ℹ️ Health Check: Currently on non-search page. Selectors ready.');
                }
              }}
              title="Test if Amazon selectors match current page"
              className="inline-flex items-center gap-0.5 text-indigo-400 hover:text-indigo-300 transition"
            >
              <Activity className="w-3 h-3" />
              <span>Health</span>
            </button>
          </div>
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
