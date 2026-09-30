import type { SearchSnapshot, WatchlistItem } from '../../types';
import { getActiveSnapshot, getWatchlist } from '../../storage';
import { BookMarked, Search, Settings as SettingsIcon, ExternalLink, Bookmark } from 'lucide-react';

export const App: React.FC = () => {
  const [snapshot, setSnapshot] = useState<SearchSnapshot | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const snap = await getActiveSnapshot();
      const list = await getWatchlist();
      setSnapshot(snap);
      setWatchlist(list);
      setLoading(false);
    }
    loadData();
  }, []);

  const openSettings = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  };

  const openAmazonBooks = () => {
    chrome.tabs.create({ url: 'https://www.amazon.com/s?i=stripbooks&k=low+content+books' });
  };

  return (
    <div className="p-4 flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <BookMarked className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight text-slate-900 dark:text-white">
              KDP Niche Finder
            </div>
            <div className="text-[10px] text-slate-400">Personal Chrome Extension</div>
          </div>
        </div>
        <button
          onClick={openSettings}
          title="Settings"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Status / Recent Search */}
      {loading ? (
        <div className="py-6 text-center text-xs text-slate-400 animate-pulse">
          Loading status...
        </div>
      ) : snapshot ? (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Last Active Search
          </div>
          <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
            "{snapshot.query}"
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>{snapshot.books.length} organic results parsed</span>
            <span>{new Date(snapshot.date).toLocaleDateString()}</span>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <p className="text-xs text-slate-500">
            No searches analyzed yet. Navigate to an Amazon search page to begin.
          </p>
          <button
            onClick={openAmazonBooks}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs transition"
          >
            <Search className="w-3.5 h-3.5" />
            Open Amazon Books Search
          </button>
        </div>
      )}

      {/* Watchlist Counter */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
          <Bookmark className="w-4 h-4 text-amber-500" />
          <span>Tracked Books (Watchlist)</span>
        </div>
        <span className="font-bold text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
          {watchlist.length}
        </span>
      </div>

      {/* Instructions footer */}
      <div className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-200 dark:border-slate-800 pt-2.5">
        <p>
          💡 Open Amazon Books, search for any niche keyword, and the KDP Niche Finder sidebar will automatically parse organic results.
        </p>
      </div>
    </div>
  );
};
