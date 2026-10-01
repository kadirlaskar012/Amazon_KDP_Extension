import React, { useState, useEffect, useMemo } from 'react';
import type { Book, QueueProgressState, Settings, SearchSnapshot } from '../types';
import { Tabs } from './Tabs';
import type { TabId } from './Tabs';
import { OverviewTab } from './tabs/OverviewTab';
import { BooksTab } from './tabs/BooksTab';
import { KeywordsTab } from './tabs/KeywordsTab';
import { CategoriesTab } from './tabs/CategoriesTab';
import { SpecsTab } from './tabs/SpecsTab';
import { SeasonalityTab } from './tabs/SeasonalityTab';
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
        if (!isNaN(parsed) && parsed >= 360 && parsed <= 900) return parsed;
      }
    }
    // Default from DEFAULT_SETTINGS.sidebarWidth (440) — localStorage takes priority
    return 440;
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

    // Listen for storage changes
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
          className={`plain-btn fixed top-24 z-[999999] px-2 py-1.5 text-xs font-bold ${
            isLeft ? 'left-0 border-l-0' : 'right-0 border-r-0'
          }`}
          title="Open KDP Niche Finder"
        >
          {isLeft ? '►' : '◄'} KDP Niche {books.length > 0 ? `(${books.length})` : ''}
        </button>
      </div>
    );
  }

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <aside
        style={{ width: `${sidebarWidth}px`, maxWidth: '100vw', '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
        className={`fixed top-0 bottom-0 bg-[var(--bg)] text-[var(--text)] flex flex-col z-[999999] select-text no-horizontal-scroll ${
          settings.textSize === 'large' ? 'text-size-large' : settings.textSize === 'extra-large' ? 'text-size-extra-large' : ''
        } ${
          isLeft ? 'left-0 border-r border-[var(--line)]' : 'right-0 border-l border-[var(--line)]'
        }`}
      >
        {/* Resize border drag handle */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          title="Drag border to resize sidebar"
          className={`absolute top-0 bottom-0 w-2 cursor-col-resize z-[1000] hover:bg-[var(--line)] ${
            isLeft ? 'right-0' : 'left-0'
          }`}
        />

        {/* Header: Single line - "KDP Niche Finder" (bold) on the left, then plain buttons: [Export] [History] [Dark] [Settings] [Close] */}
        <header className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--line)] bg-[var(--bg)] shrink-0 gap-1">
          <div className="font-bold text-[13px] text-[var(--text)] whitespace-nowrap">
            KDP Niche Finder
          </div>

          <div className="flex items-center gap-1 flex-wrap justify-end">
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

            {snapshots.length > 0 && (
              <select
                onChange={handleSelectSnapshot}
                defaultValue=""
                title="Past search history"
                className="plain-select"
                style={{ minWidth: '110px', maxWidth: '160px', fontSize: 'var(--font-small)' }}
              >
                <option value="" disabled>
                  History ({snapshots.length})
                </option>
                {snapshots.map((snap, i) => (
                  <option key={i} value={i}>
                    {snap.query} ({new Date(snap.date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={toggleTheme}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="plain-btn text-[11px] px-1.5 py-0.5"
            >
              {isDarkMode ? 'Light' : 'Dark'}
            </button>

            <button
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              title="Toggle settings drawer"
              className={`plain-btn text-[11px] px-1.5 py-0.5 ${isSettingsOpen ? 'font-bold underline' : ''}`}
            >
              Settings
            </button>

            <button
              onClick={() => setIsOpen(false)}
              title="Close sidebar"
              className="plain-btn text-[11px] px-1.5 py-0.5"
            >
              Close
            </button>
          </div>
        </header>

        {/* Captcha Alert if triggered */}
        {queueStatus.captchaDetected && (
          <CaptchaAlert url={captchaUrl} onResume={onResumeQueue} />
        )}

        {/* Fetch status: "Fetched 16/16 details", 6px progress bar, rate limit text, refresh button */}
        <SearchProgress
          status={queueStatus}
          onPause={onPauseQueue}
          onResume={onResumeQueue}
          onRefresh={onRescanPage}
        />

        {/* Watchlist success toast */}
        {watchlistSuccess && (
          <div className="mx-2 my-1 p-1 text-[11px] text-[var(--good)] border border-[var(--line)]">
            {watchlistSuccess}
          </div>
        )}

        {isSettingsOpen ? (
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[var(--line)]">
              <span className="font-bold text-[13px]">Settings</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleOpenFullSettings}
                  className="plain-btn text-[11px] px-2 py-0.5"
                  title="Open full options page in a browser tab"
                >
                  Full Page
                </button>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="plain-btn text-[11px] px-1.5 py-0.5"
                  title="Close Settings"
                >
                  ✕
                </button>
              </div>
            </div>

            {settingsSaveMsg && (
              <div className="p-1 text-[11px] text-[var(--good)] border border-[var(--line)]">
                {settingsSaveMsg}
              </div>
            )}

            {/* Section 1: Opportunity Thresholds */}
            <div className="border border-[var(--line)] p-2 space-y-2">
              <div className="font-bold text-[11px] text-[var(--muted)] uppercase">
                Opportunity Detection Rules
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-0.5">
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
                    className="plain-input w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-0.5">
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
                    className="plain-input w-full text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-0.5">
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
                    className="plain-input w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-0.5">
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
                    className="plain-select w-full text-xs"
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
            <div className="border border-[var(--line)] p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-[var(--muted)] uppercase">
                  Google Gemini API Keys
                </span>
                <button
                  type="button"
                  onClick={handleOpenFullSettings}
                  className="plain-link text-[11px]"
                >
                  Manage Keys
                </button>
              </div>
              <p className="text-[11px] text-[var(--muted)]">
                Enter 1 or multiple keys (comma or line-separated). Automatic failover on quota limit.
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
                className="plain-input w-full font-mono text-xs"
              />
              {tempSettings.geminiApiKeys && tempSettings.geminiApiKeys.length > 1 && (
                <div className="text-[10px] text-[var(--good)]">
                  {tempSettings.geminiApiKeys.length} API keys configured with automatic quota failover
                </div>
              )}
            </div>

            {/* Section 3: Scraping & Cache */}
            <div className="border border-[var(--line)] p-2 space-y-1.5">
              <div className="font-bold text-[11px] text-[var(--muted)] uppercase">
                Cache &amp; Storage
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--muted)]">Scraped product details cache</span>
                <button
                  onClick={handleClearScrapedCache}
                  className="plain-btn text-[11px] px-2 py-0.5"
                >
                  Clear Cache
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleResetDefaults}
                className="plain-btn text-[11px] px-2 py-1"
              >
                Reset Defaults
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="plain-btn text-[11px] px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="plain-btn text-[11px] font-bold px-3 py-1"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Navigation: A single row of text tabs separated by thin lines */}
            <Tabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              booksCount={books.length}
            />

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className={activeTab === 'overview' ? 'block' : 'hidden'}>
                <ErrorBoundary name="Overview Tab">
                  <OverviewTab
                    query={query}
                    books={books}
                    score={currentScore}
                    settings={settings}
                    keywords={currentSnapshot?.keywords}
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

              <div className={activeTab === 'keywords' ? 'block p-2' : 'hidden'}>
                <ErrorBoundary name="Keywords Tab">
                  <KeywordsTab
                    snapshot={currentSnapshot}
                    settings={settings}
                    onUpdateSnapshotKeywords={handleUpdateSnapshotKeywords}
                    onCaptchaEncountered={() => onPauseQueue()}
                  />
                </ErrorBoundary>
              </div>

              <div className={activeTab === 'categories' ? 'block p-2' : 'hidden'}>
                <ErrorBoundary name="Categories Tab">
                  <CategoriesTab
                    snapshot={currentSnapshot}
                    settings={settings}
                    onUpdateSnapshotCategories={handleUpdateSnapshotCategories}
                    onCaptchaEncountered={() => onPauseQueue()}
                  />
                </ErrorBoundary>
              </div>

              <div className={activeTab === 'specs' ? 'block p-2' : 'hidden'}>
                <ErrorBoundary name="Specs Tab">
                  <SpecsTab
                    snapshot={currentSnapshot}
                    onUpdateSnapshotSpecs={handleUpdateSnapshotSpecs}
                  />
                </ErrorBoundary>
              </div>

              <div className={activeTab === 'seasonality' ? 'block' : 'hidden'}>
                <ErrorBoundary name="Seasonality Tab">
                  {activeTab === 'seasonality' && (
                    <SeasonalityTab
                      initialQuery={query}
                      snapshot={currentSnapshot}
                      settings={settings}
                    />
                  )}
                </ErrorBoundary>
              </div>

              <div className={activeTab === 'reviews' ? 'block p-2' : 'hidden'}>
                <ErrorBoundary name="Reviews Tab">
                  <ReviewsTab
                    snapshot={currentSnapshot}
                    onUpdateSnapshotReviewGap={handleUpdateSnapshotReviewGap}
                    onCaptchaEncountered={() => onPauseQueue()}
                  />
                </ErrorBoundary>
              </div>

              <div className={activeTab === 'watchlist' ? 'block p-2' : 'hidden'}>
                <ErrorBoundary name="Watchlist Tab">
                  {activeTab === 'watchlist' && (
                    <WatchlistTab
                      onCaptchaEncountered={() => onPauseQueue()}
                    />
                  )}
                </ErrorBoundary>
              </div>

              <div className={activeTab === 'ideas' ? 'block p-2' : 'hidden'}>
                <ErrorBoundary name="AI Ideas Tab">
                  {activeTab === 'ideas' && (
                    <IdeasTab
                      snapshot={currentSnapshot}
                      onUpdateSnapshotIdeas={handleUpdateSnapshotIdeas}
                    />
                  )}
                </ErrorBoundary>
              </div>
            </div>
          </>
        )}

        {/* Health Check diagnostic banner */}
        {healthReport && (
          <div
            className="px-2 py-1 bg-[var(--table-head-bg)] border-t border-[var(--line)] flex items-center justify-between text-[var(--text)]"
            style={{ fontSize: 'var(--font-small)' }}
          >
            <span>{healthReport}</span>
            <button
              onClick={() => setHealthReport(null)}
              className="plain-btn plain-btn-sm ml-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Footer: One plain line: "KDP Niche Finder | [Health] | Score: 89/100" */}
        <footer
          className="px-2 py-1 border-t border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] flex items-center justify-between shrink-0"
          style={{ fontSize: 'var(--font-small)' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[var(--text)]">KDP Niche Finder</span>
            <span>|</span>
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
                    setHealthReport(`Health Check: Search parser OK (${searchCards} cards, title & price OK)`);
                  } else {
                    setHealthReport(`Health Check: Search cards found (${searchCards}) but: ${issues.join(', ')}`);
                  }
                } else if (bsrEl || reviewsEl) {
                  const titleFound = Boolean(document.querySelector(PRODUCT_PAGE_SELECTORS.title.join(', ')));
                  if (!titleFound) issues.push('Product title selector failed');
                  if (issues.length === 0) {
                    setHealthReport(`Health Check: Product details parser OK (${bsrEl ? 'BSR table found' : 'Reviews found'})`);
                  } else {
                    setHealthReport(`Health Check: Product page detected but: ${issues.join(', ')}`);
                  }
                } else if (bestSellerCards > 0) {
                  setHealthReport(`Health Check: Best Sellers parser OK (${bestSellerCards} items found)`);
                } else {
                  setHealthReport('Health Check: Selectors loaded. Navigate to Amazon search or product page to test.');
                }
              }}
              title="Test if Amazon selectors match current page"
              className="plain-btn plain-btn-sm"
            >
              Health
            </button>
          </div>
          <div>
            <span>Score: </span>
            <span
              className={`font-bold ${
                currentScore.label === 'green'
                  ? 'text-[var(--good)]'
                  : currentScore.label === 'yellow'
                  ? 'text-[var(--warn)]'
                  : currentScore.label === 'red'
                  ? 'text-[var(--bad)]'
                  : 'text-[var(--muted)]'
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
