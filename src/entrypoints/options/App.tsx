// src/entrypoints/options/App.tsx
// Comprehensive Options Page with responsive navigation, 10 configuration sections,
// auto-save indicators, storage diagnostics, and testing controls.
// Fully responsive across all display sizes with Light and Dark mode support.

import React, { useEffect, useState, useRef } from 'react';
import type {
  Settings,
  ScoreWeights,
  BsrSalesTier,
} from '../../types';
import {
  getSettings,
  saveSettings,
  clearCache,
  clearAllData,
  setStorageItem,
} from '../../storage';
import { getWatchlist } from '../../services/watchlist';
import { DEFAULT_SETTINGS, DEFAULT_AI_SETTINGS } from '../../config/defaults';
import { DEFAULT_FORBIDDEN_WORDS } from '../../config/forbiddenWords';
import { DEFAULT_KDP_SYSTEM_PROMPT } from '../../services/aiPrompt';
import { normalizeWeights } from '../../services/scoring';
import { ApiKeyField } from '../../components/ApiKeyField';
import {
  Settings as SettingsIcon,
  Shield,
  Scale,
  DollarSign,
  Search,
  MessageSquareWarning,
  Bookmark,
  Sparkles,
  Database,
  Info,
  CheckCircle2,
  Trash2,
  Plus,
  Clock,
  History,
  Download,
  Upload,
  AlertTriangle,
  Sun,
  Moon,
} from 'lucide-react';

type SectionId =
  | 'general'
  | 'fetching'
  | 'scoring'
  | 'sales'
  | 'keywords'
  | 'reviews'
  | 'tracker'
  | 'ai'
  | 'data'
  | 'about';

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
}

export const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [storageBytes, setStorageBytes] = useState<number>(0);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState<string>('');
  const [includeKeyInExport, setIncludeKeyInExport] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load settings & storage statistics on mount
  useEffect(() => {
    async function load() {
      const s = await getSettings();
      setSettings(s);
      updateStorageUsage();
    }
    load();
  }, []);

  const updateStorageUsage = () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local?.getBytesInUse) {
      chrome.storage.local.getBytesInUse(null, (bytes) => {
        setStorageBytes(bytes || 0);
      });
    }
  };

  const showSavedIndicator = () => {
    setSavedFeedback('Settings saved automatically');
    setTimeout(() => setSavedFeedback(null), 2500);
  };

  // Auto-save helper on settings update
  const updateSettings = async (updater: (prev: Settings) => Settings) => {
    setSettings((prev) => {
      const next = updater(prev);
      saveSettings(next).then(() => {
        showSavedIndicator();
        updateStorageUsage();
      });
      return next;
    });
  };

  // 1. General Handlers
  const handleMarketplaceChange = (marketplace: string) => {
    updateSettings((s) => ({ ...s, marketplace }));
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateSettings((s) => ({ ...s, theme }));
  };

  // 2. Fetching & Safety Handlers
  const handleDelayChange = (field: 'min' | 'max', value: number) => {
    const val = isNaN(value) ? 1000 : Math.max(1000, value);
    updateSettings((s) => {
      const delays = { ...s.fetchDelayMs, [field]: val };
      if (field === 'min' && delays.min > delays.max) delays.max = delays.min;
      if (field === 'max' && delays.max < delays.min) delays.min = delays.max;
      return { ...s, fetchDelayMs: delays };
    });
  };

  // 3. Niche Scoring Handlers
  const handleWeightChange = (key: keyof ScoreWeights, value: number) => {
    const val = isNaN(value) ? 0 : Math.max(0, Math.min(100, value));
    updateSettings((s) => ({
      ...s,
      weights: { ...s.weights, [key]: val },
    }));
  };

  const handleAutoNormalize = () => {
    updateSettings((s) => ({
      ...s,
      weights: normalizeWeights(s.weights),
    }));
  };

  // 4. Sales & Royalties Handlers
  const handleAddBsrTier = () => {
    const lastTier = settings.bsrSalesTable[settings.bsrSalesTable.length - 1];
    const newMin = lastTier ? lastTier.maxBsr + 1 : 1;
    const newTier: BsrSalesTier = {
      minBsr: newMin,
      maxBsr: newMin + 50000,
      monthlySales: 10,
    };
    updateSettings((s) => ({
      ...s,
      bsrSalesTable: [...s.bsrSalesTable, newTier],
    }));
  };

  const handleRemoveBsrTier = (idx: number) => {
    updateSettings((s) => ({
      ...s,
      bsrSalesTable: s.bsrSalesTable.filter((_, i) => i !== idx),
    }));
  };

  const handleUpdateBsrTier = (idx: number, field: keyof BsrSalesTier, value: number) => {
    const val = isNaN(value) ? 0 : value;
    updateSettings((s) => {
      const updated = [...s.bsrSalesTable];
      if (updated[idx]) {
        updated[idx] = { ...updated[idx]!, [field]: val };
      }
      return { ...s, bsrSalesTable: updated };
    });
  };

  // 7. Tracker & Watchlist Handlers
  const handleSimulate24hLater = async () => {
    const list = await getWatchlist();
    if (list.length === 0) {
      alert('Your watchlist is empty. Add a book from Amazon search first.');
      return;
    }
    const twentyFourHoursAgo = Date.now() - 25 * 3600 * 1000;
    const aged = list.map((item) => ({
      ...item,
      lastCheckedAt: twentyFourHoursAgo,
    }));
    await setStorageItem('kdp_watchlist', aged);
    alert('Simulated 24 hours passing. Background alarm will check these books on next tick.');
  };

  const handleLoadSampleHistory = async () => {
    const list = await getWatchlist();
    if (list.length === 0) {
      alert('Your watchlist is empty. Add a book from Amazon search first.');
      return;
    }
    const target = list[0]!;
    const dummyHistory = [];
    const now = Date.now();
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now - i * 24 * 3600 * 1000);
      dummyHistory.push({
        date: d.toISOString().split('T')[0]!,
        bsr: Math.floor(10000 + Math.random() * 25000),
        bsrOverall: Math.floor(10000 + Math.random() * 25000),
        price: 9.99,
        reviewCount: 45 + Math.floor((14 - i) * 1.5),
        rating: 4.6,
      });
    }
    target.history = dummyHistory;
    await setStorageItem('kdp_watchlist', list);
    alert(`Loaded 14 days of realistic sample trajectory into "${target.title}".`);
  };

  // 9. Storage & Backup Handlers
  const handleExportSettingsJson = () => {
    const exported = { ...settings };
    if (!includeKeyInExport) {
      delete exported.claudeApiKey;
    }
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exported, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', jsonStr);
    dlAnchor.setAttribute('download', `kdp_settings_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const handleImportSettingsJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const imported = JSON.parse(text);
        if (!imported || typeof imported !== 'object') throw new Error('Invalid JSON structure');
        await updateSettings((prev) => ({
          ...prev,
          ...imported,
          claudeApiKey: imported.claudeApiKey || prev.claudeApiKey,
        }));
        alert('Settings successfully imported!');
      } catch (err: any) {
        alert(`Failed to import settings: ${err?.message || 'Invalid format'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearAllConfirm = async () => {
    if (deleteConfirmationInput.trim() !== 'DELETE') {
      alert('Please type "DELETE" exactly to confirm complete reset.');
      return;
    }
    await clearAllData();
    const reset = await getSettings();
    setSettings(reset);
    setDeleteConfirmationInput('');
    updateStorageUsage();
    alert('All extension storage has been completely cleared and reset to defaults.');
  };

  const totalWeights = Object.values(settings.weights).reduce((a, b) => a + b, 0);

  const navItems: NavItem[] = [
    { id: 'general', label: '1. General', icon: <SettingsIcon className="w-4 h-4 shrink-0" /> },
    { id: 'fetching', label: '2. Fetching & Safety', icon: <Shield className="w-4 h-4 shrink-0" /> },
    { id: 'scoring', label: '3. Niche Scoring', icon: <Scale className="w-4 h-4 shrink-0" /> },
    { id: 'sales', label: '4. Sales & Royalties', icon: <DollarSign className="w-4 h-4 shrink-0" /> },
    { id: 'keywords', label: '5. Keywords & Cats', icon: <Search className="w-4 h-4 shrink-0" /> },
    { id: 'reviews', label: '6. Reviews Lexicon', icon: <MessageSquareWarning className="w-4 h-4 shrink-0" /> },
    { id: 'tracker', label: '7. Watchlist & Tracker', icon: <Bookmark className="w-4 h-4 shrink-0" /> },
    { id: 'ai', label: '8. AI Book Generator', icon: <Sparkles className="w-4 h-4 shrink-0" /> },
    { id: 'data', label: '9. Storage & Backup', icon: <Database className="w-4 h-4 shrink-0" /> },
    { id: 'about', label: '10. About & Guide', icon: <Info className="w-4 h-4 shrink-0" /> },
  ];

  return (
    <div className={`min-h-screen flex flex-col md:flex-row font-sans text-xs sm:text-sm no-horizontal-scroll ${settings.theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportSettingsJson}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Responsive Navigation: Compact top bar on mobile/narrow frames, full sidebar on desktop */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 flex flex-col justify-between shrink-0 shadow-xs">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                KDP Niche Finder
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Control Center & System Settings</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-800 md:hidden">
              v1.0.0
            </span>
          </div>

          {/* Navigation Items: 2-column or wrapping grid on narrow view, vertical list on md+ */}
          <nav className="grid grid-cols-2 sm:grid-cols-5 md:flex md:flex-col gap-1">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left font-medium transition cursor-pointer text-xs ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info in sidebar */}
        <div className="hidden md:block px-1 pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
          <div>Version 1.0.0 (Production)</div>
          <div>Storage In Use: {(storageBytes / 1024).toFixed(1)} KB</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-4xl overflow-y-auto w-full min-w-0">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 sm:pb-4 mb-4 sm:mb-6 flex-wrap gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white capitalize">
              {navItems.find((n) => n.id === activeSection)?.label}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Preferences are automatically saved to local browser storage upon modification.
            </p>
          </div>

          {savedFeedback && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs animate-fade-in font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{savedFeedback}</span>
            </div>
          )}
        </div>

        {/* Section 1: General */}
        {activeSection === 'general' && (
          <div className="space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div>
                <label className="block font-semibold text-slate-900 dark:text-white mb-1.5">Target Marketplace</label>
                <select
                  value={settings.marketplace}
                  onChange={(e) => handleMarketplaceChange(e.target.value)}
                  className="w-full sm:max-w-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="amazon.com">amazon.com (US - Official Default)</option>
                  <option value="amazon.co.uk">amazon.co.uk (UK - Experimental)</option>
                  <option value="amazon.de">amazon.de (DE - Experimental)</option>
                  <option value="amazon.ca">amazon.ca (CA - Experimental)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  * Note: amazon.com is fully supported. Non-US regional domains are marked experimental.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-900 dark:text-white mb-1.5">Theme</label>
                <select
                  value={settings.theme || 'system'}
                  onChange={(e) => handleThemeChange(e.target.value as any)}
                  className="w-full sm:max-w-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="system">System Synchronized</option>
                  <option value="dark">Always Dark Mode</option>
                  <option value="light">Always Light Mode</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-900 dark:text-white mb-1.5">Sidebar Default Position</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="sidebarPos"
                      checked={settings.sidebarPosition !== 'left'}
                      onChange={() => updateSettings((s) => ({ ...s, sidebarPosition: 'right' }))}
                      className="accent-indigo-600"
                    />
                    <span>Right Side (Standard)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="sidebarPos"
                      checked={settings.sidebarPosition === 'left'}
                      onChange={() => updateSettings((s) => ({ ...s, sidebarPosition: 'left' }))}
                      className="accent-indigo-600"
                    />
                    <span>Left Side</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Fetching & Safety (Responsive, zero squishing!) */}
        {activeSection === 'fetching' && (
          <div className="space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-900 dark:text-white mb-1.5">
                    Min Fetch Delay (ms)
                  </label>
                  <input
                    type="number"
                    min="1000"
                    max="10000"
                    step="500"
                    value={settings.fetchDelayMs.min}
                    onChange={(e) => handleDelayChange('min', parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs sm:text-sm"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Minimum delay between product requests (default: 2000ms).</span>
                </div>
                <div>
                  <label className="block font-semibold text-slate-900 dark:text-white mb-1.5">
                    Max Fetch Delay (ms)
                  </label>
                  <input
                    type="number"
                    min="1000"
                    max="10000"
                    step="500"
                    value={settings.fetchDelayMs.max}
                    onChange={(e) => handleDelayChange('max', parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs sm:text-sm"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Maximum delay to mimic human browsing (default: 3000ms).</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-900 dark:text-white mb-1.5">Max Fetches Per Search</label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={settings.maxFetchesPerSearch || 20}
                  onChange={(e) =>
                    updateSettings((s) => ({ ...s, maxFetchesPerSearch: parseInt(e.target.value, 10) || 20 }))
                  }
                  className="w-full sm:max-w-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs sm:text-sm"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  Limits the background queue depth per organic search result scan (default: 20).
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <label className="flex items-center gap-2.5 cursor-pointer font-medium text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={settings.pauseAllFetching || false}
                    onChange={(e) => updateSettings((s) => ({ ...s, pauseAllFetching: e.target.checked }))}
                    className="w-4 h-4 rounded text-rose-600 accent-rose-600"
                  />
                  <span>Pause All Background Queue Fetches (Emergency Master Switch)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Niche Scoring (Responsive, spacious, clear) */}
        {activeSection === 'scoring' && (
          <div className="space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                    Score Criteria Weights (Sum: {totalWeights} pts)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Total weight must equal 100 points for balanced scoring.</p>
                </div>
                {totalWeights !== 100 && (
                  <button
                    onClick={handleAutoNormalize}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-semibold cursor-pointer hover:bg-indigo-100 transition"
                  >
                    Auto-Normalize to 100
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {[
                  { key: 'demand' as const, label: 'Demand (BSR velocity)' },
                  { key: 'competitionGap' as const, label: 'Competition Gap (Low reviews)' },
                  { key: 'weakCompetitors' as const, label: 'Weak Competitors (BSR < 100k with low reviews/rating)' },
                  { key: 'profit' as const, label: 'Profit Potential (Price minus printing cost)' },
                  { key: 'newEntrant' as const, label: 'New Entrant Friendly (Recently published)' },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between font-semibold text-xs sm:text-sm gap-2">
                      <span className="text-slate-800 dark:text-slate-200">{label}</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold shrink-0 whitespace-nowrap">
                        {settings.weights[key]} pts
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      value={settings.weights[key]}
                      onChange={(e) => handleWeightChange(key, parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Thresholds */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Threshold Boundaries</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Demand Max BSR</label>
                  <input
                    type="number"
                    value={settings.thresholds.demandBsr}
                    onChange={(e) =>
                      updateSettings((s) => ({
                        ...s,
                        thresholds: { ...s.thresholds, demandBsr: parseInt(e.target.value, 10) || 100000 },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs sm:text-sm"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Books with BSR lower than this are counted as high-demand.</span>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Low Review Cutoff</label>
                  <input
                    type="number"
                    value={settings.thresholds.lowReviewCount}
                    onChange={(e) =>
                      updateSettings((s) => ({
                        ...s,
                        thresholds: { ...s.thresholds, lowReviewCount: parseInt(e.target.value, 10) || 50 },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs sm:text-sm"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Books with fewer reviews than this are considered beatable.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Sales & Royalties */}
        {activeSection === 'sales' && (
          <div className="space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">BSR to Monthly Sales Mapping</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Maps BSR ranges to estimated monthly purchase orders.</p>
                </div>
                <button
                  onClick={handleAddBsrTier}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer hover:bg-emerald-100 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Tier</span>
                </button>
              </div>

              <div className="space-y-2">
                {settings.bsrSalesTable.map((tier, idx) => (
                  <div key={idx} className="flex items-center gap-2 flex-wrap sm:flex-nowrap p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                    <div className="flex-1 min-w-[100px]">
                      <span className="text-[10px] text-slate-500 block mb-0.5">Min BSR</span>
                      <input
                        type="number"
                        value={tier.minBsr}
                        onChange={(e) => handleUpdateBsrTier(idx, 'minBsr', parseInt(e.target.value, 10))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs"
                      />
                    </div>
                    <div className="flex-1 min-w-[100px]">
                      <span className="text-[10px] text-slate-500 block mb-0.5">Max BSR</span>
                      <input
                        type="number"
                        value={tier.maxBsr}
                        onChange={(e) => handleUpdateBsrTier(idx, 'maxBsr', parseInt(e.target.value, 10))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs"
                      />
                    </div>
                    <div className="flex-1 min-w-[100px]">
                      <span className="text-[10px] text-slate-500 block mb-0.5">Monthly Sales</span>
                      <input
                        type="number"
                        value={tier.monthlySales}
                        onChange={(e) => handleUpdateBsrTier(idx, 'monthlySales', parseInt(e.target.value, 10))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveBsrTier(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 transition cursor-pointer self-end"
                      title="Delete Tier"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Printing Production Costs</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Formula: fixedCost + (perPageCost × pages). Note: Always verify with the official Amazon KDP royalty calculator for final proof copies.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Fixed Cost ($)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={settings.printingCost.fixedCost}
                    onChange={(e) =>
                      updateSettings((s) => ({
                        ...s,
                        printingCost: { ...s.printingCost, fixedCost: parseFloat(e.target.value) || 0 },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Per Page ($)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={settings.printingCost.perPageCost}
                    onChange={(e) =>
                      updateSettings((s) => ({
                        ...s,
                        printingCost: { ...s.printingCost, perPageCost: parseFloat(e.target.value) || 0 },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Royalty Rate</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={settings.royaltyRate}
                    onChange={(e) =>
                      updateSettings((s) => ({ ...s, royaltyRate: parseFloat(e.target.value) || 0.6 }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs sm:text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 5: Keywords & Categories */}
        {activeSection === 'keywords' && (
          <div className="space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Keyword Scoring Weights</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Autocomplete Position</label>
                  <input
                    type="number"
                    value={settings.keywordWeights.autocompletePosition}
                    onChange={(e) =>
                      updateSettings((s) => ({
                        ...s,
                        keywordWeights: {
                          ...s.keywordWeights,
                          autocompletePosition: parseInt(e.target.value, 10) || 0,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Title Frequency</label>
                  <input
                    type="number"
                    value={settings.keywordWeights.titleFrequency}
                    onChange={(e) =>
                      updateSettings((s) => ({
                        ...s,
                        keywordWeights: {
                          ...s.keywordWeights,
                          titleFrequency: parseInt(e.target.value, 10) || 0,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Top Result BSR</label>
                  <input
                    type="number"
                    value={settings.keywordWeights.topResultBsr}
                    onChange={(e) =>
                      updateSettings((s) => ({
                        ...s,
                        keywordWeights: {
                          ...s.keywordWeights,
                          topResultBsr: parseInt(e.target.value, 10) || 0,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs sm:text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Google Trends Geography</h3>
              <select
                value={settings.trends?.geo || 'US'}
                onChange={(e) =>
                  updateSettings((s) => ({
                    ...s,
                    trends: { geo: e.target.value, baseUrl: s.trends?.baseUrl || 'https://trends.google.com/trends/explore' },
                  }))
                }
                className="w-full sm:max-w-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="US">United States (US)</option>
                <option value="GB">United Kingdom (GB)</option>
                <option value="CA">Canada (CA)</option>
                <option value="AU">Australia (AU)</option>
                <option value="IN">India (IN)</option>
                <option value="WORLDWIDE">Worldwide (Global)</option>
              </select>
            </div>
          </div>
        )}

        {/* Section 6: Reviews Lexicon */}
        {activeSection === 'reviews' && (
          <div className="space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Review Analysis Settings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Books to Analyze</label>
                  <input
                    type="number"
                    value={5}
                    disabled
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 font-mono opacity-60"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Top 5 competitor books scanned for visible customer reviews.</span>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Max Stars Included</label>
                  <input
                    type="number"
                    value={3}
                    disabled
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 font-mono opacity-60"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Captures 1, 2, and 3 star negative complaints.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 7: Watchlist & Tracker */}
        {activeSection === 'tracker' && (
          <div className="space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Watchlist Refresh & Alarm Schedule</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automated background chrome alarm triggers every 24 hours (1440 minutes) to check books not inspected within the past 20 hours.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSimulate24hLater}
                  className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-semibold flex items-center gap-1.5 hover:bg-indigo-100 transition cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span>Simulate 24h Later (Trigger Refresh)</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadSampleHistory}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1.5 hover:bg-emerald-100 transition cursor-pointer"
                >
                  <History className="w-4 h-4" />
                  <span>Load Sample History (14-Day Trajectory)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section 8: AI Book Generator */}
        {activeSection === 'ai' && (
          <div className="space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Claude AI Credentials</h3>
              <ApiKeyField
                apiKey={settings.claudeApiKey || ''}
                onChange={(key) => updateSettings((s) => ({ ...s, claudeApiKey: key }))}
                model={settings.claudeModel || 'claude-sonnet-5-5'}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Model Name</label>
                  <input
                    type="text"
                    value={settings.claudeModel || 'claude-sonnet-5-5'}
                    onChange={(e) => updateSettings((s) => ({ ...s, claudeModel: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Max Tokens</label>
                  <input
                    type="number"
                    value={settings.ai?.maxTokens || 4000}
                    onChange={(e) =>
                      updateSettings((s) => ({
                        ...s,
                        ai: { ...DEFAULT_AI_SETTINGS, ...s.ai, maxTokens: parseInt(e.target.value, 10) || 4000 },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Forbidden Words List (Comma-Separated)</label>
                <textarea
                  rows={3}
                  value={(settings.ai?.forbiddenWords || DEFAULT_FORBIDDEN_WORDS).join(', ')}
                  onChange={(e) => {
                    const list = e.target.value.split(',').map((w) => w.trim()).filter(Boolean);
                    updateSettings((s) => ({
                      ...s,
                      ai: { ...DEFAULT_AI_SETTINGS, ...s.ai, forbiddenWords: list },
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-medium">System Prompt</label>
                  <button
                    onClick={() =>
                      updateSettings((s) => ({
                        ...s,
                        ai: { ...DEFAULT_AI_SETTINGS, ...s.ai, systemPrompt: DEFAULT_KDP_SYSTEM_PROMPT },
                      }))
                    }
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Reset to Default
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={settings.ai?.systemPrompt || DEFAULT_KDP_SYSTEM_PROMPT}
                  onChange={(e) =>
                    updateSettings((s) => ({
                      ...s,
                      ai: { ...DEFAULT_AI_SETTINGS, ...s.ai, systemPrompt: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 9: Storage & Backup */}
        {activeSection === 'data' && (
          <div className="space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Local Storage & Settings Backup</h3>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleExportSettingsJson}
                  className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-semibold flex items-center gap-1.5 hover:bg-indigo-100 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Settings JSON</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import Settings JSON</span>
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeKeyInExport}
                  onChange={(e) => setIncludeKeyInExport(e.target.checked)}
                  className="accent-indigo-600"
                />
                <span>Include Anthropic API key in JSON backup (Warning: contains secret credentials)</span>
              </label>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex gap-3">
                <button
                  onClick={async () => {
                    await clearCache();
                    updateStorageUsage();
                    alert('Product 24-hour cache cleared.');
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer"
                >
                  Clear 24h Cache
                </button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/30 space-y-3">
              <h3 className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5 text-sm sm:text-base">
                <AlertTriangle className="w-4 h-4" />
                Reset & Purge All Storage
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                To prevent accidental data loss, type the word <strong>DELETE</strong> below to wipe all snapshots, watchlist items, and settings.
              </p>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <input
                  type="text"
                  placeholder='Type "DELETE" to confirm'
                  value={deleteConfirmationInput}
                  onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-950 font-mono text-xs w-full sm:w-48 text-rose-700 dark:text-rose-300"
                />
                <button
                  onClick={handleClearAllConfirm}
                  disabled={deleteConfirmationInput.trim() !== 'DELETE'}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-40 transition cursor-pointer shrink-0"
                >
                  Clear ALL Extension Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section 10: About & Guide */}
        {activeSection === 'about' && (
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">About KDP Niche Finder</h3>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs sm:text-sm">
              KDP Niche Finder is a personal Amazon KDP research intelligence tool designed to run entirely locally in your browser. It extracts organic search metrics, calculates multi-factor Niche Scores, tracks daily BSR trajectories, analyzes customer review complaints, and creates data-backed book blueprints via the Anthropic Claude API.
            </p>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="font-bold text-slate-900 dark:text-white">Key Architectural Guarantees:</div>
              <div>• <strong>Privacy:</strong> All competitor and search data remains strictly in your local browser storage.</div>
              <div>• <strong>Security:</strong> Anthropic API requests are dispatched exclusively from background service workers; your key is never injected into web pages.</div>
              <div>• <strong>Resilience:</strong> Automated CAPTCHA detection halts queue processing to protect accounts.</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
