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
import { ErrorBoundary } from './ErrorBoundary';
import { calculateNicheScore } from '../services/scoring';
import { getSettings, saveSettings } from '../storage/settings';
import { getSnapshots, saveSnapshot, getActiveSnapshot, clearCache } from '../storage';
import { addToWatchlist, getWatchlist } from '../services/watchlist';
import { DEFAULT_SETTINGS } from '../config/defaults';
import { extractAllGeminiKeys } from '../services/aiIdeas';
import { SEARCH_SELECTORS, PRODUCT_PAGE_SELECTORS, BEST_SELLERS_SELECTORS } from '../config/selectors';
import type { KeywordItem, CategoryStat, SpecsSummary, ReviewGapAnalysis, BookIdea, WatchlistItem } from '../types';
import { Logo } from './Logo';
import {
  BookMarked,
  Moon,
  Sun,
  ChevronRight,
  ChevronLeft,
  Activity,
  Settings as SettingsIcon,
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsSaveMsg, setSettingsSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  const handleOpenFullSettings = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' }, (res) => {
        if (chrome.runtime.lastError || !res?.success) {
          setIsSettingsOpen(true);
        }
      });
    } else {
      setIsSettingsOpen(true);
    }
  };

  const handleSaveSettings = async () => {
    const keys = extractAllGeminiKeys({
      geminiApiKey: tempSettings.geminiApiKey,
      geminiApiKeys: tempSettings.geminiApiKeys,
    });
    const updated: Settings = {
      ...tempSettings,
      geminiApiKey: keys[0] || tempSettings.geminiApiKey || '',
      geminiApiKeys: keys.length > 0 ? keys : (tempSettings.geminiApiKey ? [tempSettings.geminiApiKey] : []),
    };
    setSettings(updated);
    await saveSettings(updated);
    setSettingsSaveMsg('Settings saved successfully!');
    setTimeout(() => {
      setSettingsSaveMsg(null);
      setIsSettingsOpen(false);
    }, 1200);
  };

  const handleResetDefaults = async () => {
    setTempSettings(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
    await saveSettings(DEFAULT_SETTINGS);
    setSettingsSaveMsg('Reset to defaults!');
    setTimeout(() => setSettingsSaveMsg(null), 1500);
  };

  const handleClearScrapedCache = async () => {
    await clearCache();
    setSettingsSaveMsg('Product cache cleared!');
    setTimeout(() => setSettingsSaveMsg(null), 1500);
  };

  const [snapshots, setSnapshots] = useState<SearchSnapshot[]>([]);
  const [currentSnapshot, setCurrentSnapshot] = useState<SearchSnapshot | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistSuccess, setWatchlistSuccess] = useState<string | null>(null);
  const [healthReport, setHealthReport] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kdp_sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 380 && parsed <= 900) return parsed;
      }
    }
    return 480;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Resize drag listener
  useEffect(() => {
    if (!isResizing) return;
    const isLeft = settings.sidebarPosition === 'left';
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = isLeft ? e.clientX : window.innerWidth - e.clientX;
      const clamped = Math.max(380, Math.min(newWidth, Math.min(950, window.innerWidth - 40)));
      setSidebarWidth(clamped);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem('kdp_sidebar_width', String(sidebarWidth));
      } catch {}
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, settings.sidebarPosition, sidebarWidth]);

  // Load settings, active snapshot, recent snapshots, and watchlist
  useEffect(() => {
    async function init() {
      const s = await getSettings();
      setSettings(s);
      if (s.sidebarDefaultOpen !== undefined) {
        setIsOpen(s.sidebarDefaultOpen);
      }
      if (s.theme === 'dark') {
        setIsDarkMode(true);
      } else if (s.theme === 'light') {
        setIsDarkMode(false);
      } else if (s.theme === 'system' && typeof window !== 'undefined') {
        setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
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
        getSettings().then((s) => {
          setSettings(s);
          if (s.theme === 'dark') setIsDarkMode(true);
          else if (s.theme === 'light') setIsDarkMode(false);
          else if (s.theme === 'system' && typeof window !== 'undefined') {
            setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
          }
        });
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
        setIsOpen(false);
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
        ...prev,
        query: query || prev?.query || '',
        date: prev?.date || Date.now(),
        books,
        nicheScore: currentScore,
        keywords: prev?.keywords || [],
        categories: prev?.categories || [],
        specs: prev?.specs,
        reviewGap: prev?.reviewGap,
        ideas: prev?.ideas || [],
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
        ideas: selected.ideas || [],
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

  const isLeft = settings.sidebarPosition === 'left';

  // Render collapsed button if closed
  if (!isOpen) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed top-24 z-[999999] flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-2xl transition-all cursor-pointer font-sans text-xs font-semibold ${
            isLeft ? 'left-0 rounded-r-xl' : 'right-0 rounded-l-xl'
          }`}
          title="Open KDP Niche Finder"
        >
          {isLeft ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          <Logo size={18} />
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
      <aside
        style={{ width: `${sidebarWidth}px` }}
        className={`fixed top-0 bottom-0 max-w-[100vw] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xl flex flex-col z-[999999] font-sans antialiased text-xs transition-colors select-text no-horizontal-scroll ${
          isLeft ? 'left-0 border-r border-slate-200 dark:border-slate-800' : 'right-0 border-l border-slate-200 dark:border-slate-800'
        }`}
      >
        {/* Resize border drag handle */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          title="Drag border to resize sidebar"
          className={`absolute top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-[1000] flex items-center justify-center group ${
            isLeft ? 'right-0' : 'left-0'
          }`}
        >
          <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-700 rounded-full group-hover:bg-blue-500 transition-colors" />
        </div>

        {/* Header */}
        <header className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-r from-white via-indigo-50/20 to-white dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 backdrop-blur-md shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <div>
              <div className="font-extrabold text-slate-900 dark:text-white text-sm leading-tight flex items-center gap-1.5">
                <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                  KDP Niche Finder
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-xs tracking-wider">
                  PRO
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">Personal KDP Intelligence</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Export Menu Dropdown */}
            <ExportMenu
              snapshot={currentSnapshot}
              watchlist={watchlist}
              ideas={currentSnapshot?.ideas || []}
              exportSettings={settings.exportSettings}
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
              className="p-1 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                setIsSettingsOpen((prev) => !prev);
              }}
              title="Open Extension Settings"
              className={`p-1 rounded-lg transition cursor-pointer ${
                isSettingsOpen
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsOpen(false)}
              title="Collapse Sidebar"
              className="p-1 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              {isLeft ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
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

        {isSettingsOpen ? (
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚙️</span>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Settings</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Configure research rules, trends &amp; keys</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleOpenFullSettings}
                  className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-700/60 px-2 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition flex items-center gap-1 cursor-pointer"
                  title="Open full options page in a browser tab"
                >
                  Full Page ↗
                </button>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Close Settings"
                >
                  ✕
                </button>
              </div>
            </div>

            {settingsSaveMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium animate-fade-in flex items-center gap-2">
                <span>✓</span>
                <span>{settingsSaveMsg}</span>
              </div>
            )}

            {/* Section 1: Opportunity Thresholds */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Opportunity Detection Rules
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Demand BSR Threshold
                  </label>
                  <input
                    type="number"
                    value={tempSettings.thresholds.demandBsr}
                    onChange={(e) =>
                      setTempSettings((prev) => ({
                        ...prev,
                        thresholds: { ...prev.thresholds, demandBsr: parseInt(e.target.value, 10) || 100000 },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Max Reviews (Weak)
                  </label>
                  <input
                    type="number"
                    value={tempSettings.thresholds.weakReviewCount}
                    onChange={(e) =>
                      setTempSettings((prev) => ({
                        ...prev,
                        thresholds: { ...prev.thresholds, weakReviewCount: parseInt(e.target.value, 10) || 30 },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Min Rating (Weak)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tempSettings.thresholds.weakRating}
                    onChange={(e) =>
                      setTempSettings((prev) => ({
                        ...prev,
                        thresholds: { ...prev.thresholds, weakRating: parseFloat(e.target.value) || 4.0 },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Google Trends Geo
                  </label>
                  <select
                    value={tempSettings.trends?.geo || 'US'}
                    onChange={(e) =>
                      setTempSettings((prev) => ({
                        ...prev,
                        trends: {
                          baseUrl: prev.trends?.baseUrl || 'https://trends.google.com/trends/explore',
                          geo: e.target.value,
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="US">US (United States)</option>
                    <option value="GB">GB (United Kingdom)</option>
                    <option value="CA">CA (Canada)</option>
                    <option value="DE">DE (Germany)</option>
                    <option value="AU">AU (Australia)</option>
                    <option value="IN">IN (India)</option>
                    <option value="FR">FR (France)</option>
                    <option value="ES">ES (Spain)</option>
                    <option value="IT">IT (Italy)</option>
                    <option value="JP">JP (Japan)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: AI Gemini Key */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Google Gemini API Keys
                </h4>
                <button
                  type="button"
                  onClick={handleOpenFullSettings}
                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
                >
                  Manage Keys ↗
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Enter 1 or multiple keys (comma or line-separated). If an API key hits daily quota limit (429), it automatically fails over to the next key.
              </p>
              <textarea
                rows={2}
                placeholder="AIzaSy... (paste one or more keys)"
                value={
                  tempSettings.geminiApiKeys && tempSettings.geminiApiKeys.length > 0
                    ? tempSettings.geminiApiKeys.join('\n')
                    : tempSettings.geminiApiKey || ''
                }
                onChange={(e) => {
                  const val = e.target.value;
                  const extracted = extractAllGeminiKeys({ geminiApiKey: val });
                  setTempSettings((prev) => ({
                    ...prev,
                    geminiApiKey: extracted[0] || val,
                    geminiApiKeys: extracted,
                  }));
                }}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white resize-y"
              />
              {tempSettings.geminiApiKeys && tempSettings.geminiApiKeys.length > 1 && (
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <span>✓</span>
                  <span>{tempSettings.geminiApiKeys.length} API keys configured with automatic quota failover</span>
                </div>
              )}
            </div>

            {/* Section 3: Scraping & Cache */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cache &amp; Storage
              </h4>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Scraped product details cache</span>
                <button
                  onClick={handleClearScrapedCache}
                  className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                >
                  Clear Cache
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleResetDefaults}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Reset Defaults
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-1.5 text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Navigation (Responsive 4x2 Grid with zero horizontal scrollbar) */}
            <Tabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              booksCount={books.length}
            />

            {/* Content Area - All tabs stay mounted so background tasks/scans continue uninterrupted */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className={activeTab === 'overview' ? 'block' : 'hidden'}>
            <ErrorBoundary name="Overview Tab">
              <OverviewTab
                query={query}
                books={books}
                score={currentScore}
                settings={settings}
                onGoToBooks={() => setActiveTab('books')}
              />
            </ErrorBoundary>
          </div>

          <div className={activeTab === 'books' ? 'block h-full' : 'hidden'}>
            <ErrorBoundary name="Books Tab">
              <BooksTab
                books={books}
                settings={settings}
                onAddToWatchlist={handleAddToWatchlist}
              />
            </ErrorBoundary>
          </div>

          <div className={activeTab === 'keywords' ? 'block p-3' : 'hidden'}>
            <ErrorBoundary name="Keywords Tab">
              <KeywordsTab
                snapshot={currentSnapshot}
                settings={settings}
                onUpdateSnapshotKeywords={handleUpdateSnapshotKeywords}
                onCaptchaEncountered={() => onPauseQueue()}
              />
            </ErrorBoundary>
          </div>

          <div className={activeTab === 'categories' ? 'block p-3' : 'hidden'}>
            <ErrorBoundary name="Categories Tab">
              <CategoriesTab
                snapshot={currentSnapshot}
                settings={settings}
                onUpdateSnapshotCategories={handleUpdateSnapshotCategories}
                onCaptchaEncountered={() => onPauseQueue()}
              />
            </ErrorBoundary>
          </div>

          <div className={activeTab === 'specs' ? 'block p-3' : 'hidden'}>
            <ErrorBoundary name="Specs Tab">
              <SpecsTab
                snapshot={currentSnapshot}
                onUpdateSnapshotSpecs={handleUpdateSnapshotSpecs}
              />
            </ErrorBoundary>
          </div>

          <div className={activeTab === 'reviews' ? 'block p-3' : 'hidden'}>
            <ErrorBoundary name="Reviews Tab">
              <ReviewsTab
                snapshot={currentSnapshot}
                onUpdateSnapshotReviewGap={handleUpdateSnapshotReviewGap}
                onCaptchaEncountered={() => onPauseQueue()}
              />
            </ErrorBoundary>
          </div>

          <div className={activeTab === 'watchlist' ? 'block p-3' : 'hidden'}>
            <ErrorBoundary name="Watchlist Tab">
              <WatchlistTab
                onCaptchaEncountered={() => onPauseQueue()}
              />
            </ErrorBoundary>
          </div>

          <div className={activeTab === 'ideas' ? 'block p-3' : 'hidden'}>
            <ErrorBoundary name="AI Ideas Tab">
              <IdeasTab
                snapshot={currentSnapshot}
                onUpdateSnapshotIdeas={handleUpdateSnapshotIdeas}
              />
            </ErrorBoundary>
            </div>
          </div>
        </>
      )}

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
        <footer className="px-3.5 py-2 border-t border-slate-200/80 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-indigo-50/15 to-slate-50 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 text-[10px] text-slate-400 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600 dark:text-slate-300">KDP Niche Finder</span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <button
              onClick={() => {
                const issues: string[] = [];
                const searchCards = document.querySelectorAll(SEARCH_SELECTORS.items.join(', ')).length;
                const bsrEl = document.querySelector(
                  PRODUCT_PAGE_SELECTORS.detailBullets.concat(PRODUCT_PAGE_SELECTORS.detailTable).join(', ')
                );
                const reviewsEl = document.querySelector(PRODUCT_PAGE_SELECTORS.reviewSection.join(', '));
                const bestSellerCards = document.querySelectorAll(BEST_SELLERS_SELECTORS.items.join(', ')).length;

                if (searchCards > 0) {
                  const firstCard = document.querySelector(SEARCH_SELECTORS.items.join(', '));
                  const titleFound = firstCard ? Boolean(firstCard.querySelector(SEARCH_SELECTORS.title.join(', '))) : false;
                  const priceFound = firstCard ? Boolean(firstCard.querySelector(SEARCH_SELECTORS.price.join(', '))) : false;
                  if (!titleFound) issues.push('Title selector failed on card');
                  if (!priceFound) issues.push('Price selector failed on card');

                  if (issues.length === 0) {
                    setHealthReport(`✅ Health Check: Search parser OK (${searchCards} cards, title & price OK)`);
                  } else {
                    setHealthReport(`⚠️ Health Check: Search cards found (${searchCards}) but: ${issues.join(', ')}`);
                  }
                } else if (bsrEl || reviewsEl) {
                  const titleFound = Boolean(document.querySelector(PRODUCT_PAGE_SELECTORS.title.join(', ')));
                  if (!titleFound) issues.push('Product title selector failed');
                  if (issues.length === 0) {
                    setHealthReport(`✅ Health Check: Product details parser OK (${bsrEl ? 'BSR table found' : 'Reviews found'})`);
                  } else {
                    setHealthReport(`⚠️ Health Check: Product page detected but: ${issues.join(', ')}`);
                  }
                } else if (bestSellerCards > 0) {
                  setHealthReport(`✅ Health Check: Best Sellers parser OK (${bestSellerCards} items found)`);
                } else {
                  setHealthReport('ℹ️ Health Check: Selectors loaded & ready. Navigate to Amazon book search, product, or best sellers page to test live DOM matching.');
                }
              }}
              title="Test if Amazon selectors match current page"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition font-medium"
            >
              <Activity className="w-3 h-3 text-indigo-500" />
              <span>Health</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Score:</span>
            <span
              className={`font-mono font-bold px-2 py-0.5 rounded-full text-[10px] border ${
                currentScore.label === 'green'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                  : currentScore.label === 'yellow'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
                  : currentScore.label === 'red'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400'
                  : 'bg-slate-500/10 border-slate-500/30 text-slate-500'
              }`}
            >
              {currentScore.label === 'insufficient' ? 'N/A' : `${currentScore.total}/100`}
            </span>
          </div>
        </footer>
      </aside>
    </div>
  );
};
