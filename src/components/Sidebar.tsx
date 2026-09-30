import type { Book, QueueProgressState } from '../types';
import { Tabs } from './Tabs';
import type { TabId } from './Tabs';
import { BookTable } from './BookTable';
import { OverviewTab } from './OverviewTab';
import { SearchProgress } from './SearchProgress';
import { CaptchaAlert } from './CaptchaAlert';
import {
  BookMarked,
  Moon,
  Sun,
  ChevronRight,
  Sparkles,
  ChevronLeft,
} from 'lucide-react';
import { saveWatchlistItem } from '../storage';

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
  const [activeTab, setActiveTab] = useState<TabId>('books');
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [query, setQuery] = useState<string>(initialQuery);
  const [watchlistSuccess, setWatchlistSuccess] = useState<string | null>(null);

  // Synchronize initial books if updated from props
  useEffect(() => {
    setBooks(initialBooks);
  }, [initialBooks]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
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
        <header className="flex items-center justify-between px-3.5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <BookMarked className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight flex items-center gap-1">
                KDP Niche Finder
                <span className="text-[10px] font-normal px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
                  v1.0
                </span>
              </div>
              <div className="text-[10px] text-slate-400">Personal Amazon Research</div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              title="Collapse Sidebar"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
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
          <div className="mx-3 my-1.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs">
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
              queueStatus={queueStatus}
              onGoToBooks={() => setActiveTab('books')}
            />
          )}

          {activeTab === 'books' && (
            <BookTable
              books={books}
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
                Scheduled for activation in the upcoming phases (Keywords, Categories, Specs, Reviews, Ideas, Watchlist).
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-3.5 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 text-[10px] text-slate-400 flex items-center justify-between shrink-0">
          <span>KDP Niche Finder · Phase 1 Active</span>
          <span>{books.length} Books</span>
        </footer>
      </aside>
    </div>
  );
};
