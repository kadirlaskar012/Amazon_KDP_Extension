// src/entrypoints/options/App.tsx
// Comprehensive Options Page with left navigation, 10 configuration sections,
// auto-save indicators, storage diagnostics, and testing controls.

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
  const handleMarketplaceChange = (val: string) => {
    updateSettings((s) => ({ ...s, marketplace: val }));
  };

  const handleThemeChange = (val: 'light' | 'dark' | 'system') => {
    updateSettings((s) => ({ ...s, theme: val }));
  };

  // 2. Fetching & Safety Handlers
  const handleDelayChange = (field: 'min' | 'max', val: number) => {
    updateSettings((s) => ({
      ...s,
      fetchDelayMs: { ...s.fetchDelayMs, [field]: Math.max(1000, val) },
    }));
  };

  // 3. Scoring Handlers
  const handleWeightChange = (key: keyof ScoreWeights, val: number) => {
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

  // 4. BSR Sales Tiers Handlers
  const handleAddBsrTier = () => {
    updateSettings((s) => ({
      ...s,
      bsrSalesTable: [...s.bsrSalesTable, { minBsr: 100000, maxBsr: 500000, monthlySales: 15 }],
    }));
  };

  const handleRemoveBsrTier = (idx: number) => {
    updateSettings((s) => ({
      ...s,
      bsrSalesTable: s.bsrSalesTable.filter((_, i) => i !== idx),
    }));
  };

  const handleUpdateBsrTier = (idx: number, field: keyof BsrSalesTier, val: number) => {
    updateSettings((s) => {
      const nextTable = [...s.bsrSalesTable];
      if (nextTable[idx]) {
        nextTable[idx] = { ...nextTable[idx]!, [field]: val };
      }
      return { ...s, bsrSalesTable: nextTable };
    });
  };

  // 7. Watchlist Simulation Handlers
  const handleSimulate24hLater = async () => {
    const list = await getWatchlist();
    if (list.length === 0) {
      alert('Watchlist is empty. Add a book first to simulate 24h refresh.');
      return;
    }
    const shifted = list.map((item) => ({
      ...item,
      lastCheckedAt: Date.now() - 25 * 3600 * 1000,
    }));
    await setStorageItem('kdp_watchlist', shifted);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'REFRESH_WATCHLIST_NOW' }, () => {
        alert('Simulated 24h later: lastCheckedAt shifted back 25h and background refresh triggered!');
      });
    }
  };

  const handleLoadSampleHistory = async () => {
    const baseDate = new Date();
    const historySample1 = [];
    const historySample2 = [];

    for (let i = 13; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0]!;

      // Sample 1: Improving BSR (120,000 -> 35,000)
      const bsr1 = Math.round(120000 - (120000 - 35000) * ((13 - i) / 13));
      historySample1.push({
        date: iso,
        bsrOverall: bsr1,
        bsr: bsr1,
        price: 6.99,
        reviewCount: 20 + (13 - i) * 2,
        rating: 4.6,
      });

      // Sample 2: Declining BSR (45,000 -> 140,000)
      const bsr2 = Math.round(45000 + (140000 - 45000) * ((13 - i) / 13));
      historySample2.push({
        date: iso,
        bsrOverall: bsr2,
        bsr: bsr2,
        price: 7.99,
        reviewCount: 15 + Math.floor((13 - i) * 0.5),
        rating: 3.8,
      });
    }

    const sampleBooks = [
      {
        asin: 'B09IMPROVE',
        title: 'Toddler Coloring Book: 50 Cute Animal Designs (Improving BSR)',
        author: 'Creative Kids Press',
        price: 6.99,
        addedAt: Date.now() - 14 * 86400000,
        lastCheckedAt: Date.now(),
        lastStatus: 'ok' as const,
        history: historySample1,
      },
      {
        asin: 'B09DECLINE',
        title: 'Tracing Letters and Numbers for Preschool (Declining BSR)',
        author: 'Early Learning Hub',
        price: 7.99,
        addedAt: Date.now() - 14 * 86400000,
        lastCheckedAt: Date.now(),
        lastStatus: 'ok' as const,
        history: historySample2,
      },
    ];

    const current = await getWatchlist();
    const withoutSamples = current.filter((w) => w.asin !== 'B09IMPROVE' && w.asin !== 'B09DECLINE');
    await setStorageItem('kdp_watchlist', [...sampleBooks, ...withoutSamples]);
    alert('Sample history loaded! 2 books with 14-day trajectories added to your Watchlist.');
  };

  // 9. Data Export / Import JSON
  const handleExportSettingsJson = () => {
    const exportData = { ...settings };
    if (!includeKeyInExport) {
      delete (exportData as any).claudeApiKey;
    }
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kdp-settings-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportSettingsJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = String(event.target?.result || '');
        const imported = JSON.parse(text);
        if (!imported || typeof imported !== 'object') {
          throw new Error('Not a valid JSON object');
        }
        await updateSettings((prev) => ({
          ...prev,
          ...imported,
          // Preserve existing API key if import omitted it
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
    { id: 'general', label: '1. General', icon: <SettingsIcon className="w-4 h-4" /> },
    { id: 'fetching', label: '2. Fetching & Safety', icon: <Shield className="w-4 h-4" /> },
    { id: 'scoring', label: '3. Niche Scoring', icon: <Scale className="w-4 h-4" /> },
    { id: 'sales', label: '4. Sales & Royalties', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'keywords', label: '5. Keywords & Cats', icon: <Search className="w-4 h-4" /> },
    { id: 'reviews', label: '6. Reviews Lexicon', icon: <MessageSquareWarning className="w-4 h-4" /> },
    { id: 'tracker', label: '7. Watchlist & Tracker', icon: <Bookmark className="w-4 h-4" /> },
    { id: 'ai', label: '8. AI Book Generator', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'data', label: '9. Storage & Backup', icon: <Database className="w-4 h-4" /> },
    { id: 'about', label: '10. About & Guide', icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex text-xs">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportSettingsJson}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Left Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-4">
          <div className="px-2">
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
              KDP Niche Finder
            </h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Control Center & System Settings</p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info in sidebar */}
        <div className="px-2 pt-4 border-t border-slate-800 text-[10px] text-slate-500 space-y-1">
          <div>Version 1.0.0 (Phase 5 Complete)</div>
          <div>Storage In Use: {(storageBytes / 1024).toFixed(1)} KB</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 max-w-4xl overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-white capitalize">
              {navItems.find((n) => n.id === activeSection)?.label}
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Preferences are automatically saved to local browser storage upon modification.
            </p>
          </div>

          {savedFeedback && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] animate-fade-in font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{savedFeedback}</span>
            </div>
          )}
        </div>

        {/* Section 1: General */}
        {activeSection === 'general' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div>
                <label className="block font-semibold text-white mb-1">Target Marketplace</label>
                <select
                  value={settings.marketplace}
                  onChange={(e) => handleMarketplaceChange(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200"
                >
                  <option value="amazon.com">amazon.com (US - Official Default)</option>
                  <option value="amazon.co.uk">amazon.co.uk (UK - Experimental)</option>
                  <option value="amazon.de">amazon.de (DE - Experimental)</option>
                  <option value="amazon.ca">amazon.ca (CA - Experimental)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  * Note: amazon.com is fully supported. Non-US regional domains are marked experimental.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Theme</label>
                <select
                  value={settings.theme || 'system'}
                  onChange={(e) => handleThemeChange(e.target.value as any)}
                  className="w-full max-w-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200"
                >
                  <option value="system">System Synchronized</option>
                  <option value="dark">Always Dark Mode</option>
                  <option value="light">Always Light Mode</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Sidebar Default Position</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="sidebarPos"
                      checked={settings.sidebarPosition !== 'left'}
                      onChange={() => updateSettings((s) => ({ ...s, sidebarPosition: 'right' }))}
                      className="accent-indigo-600"
                    />
                    <span>Right Side (Standard)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
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

        {/* Section 2: Fetching & Safety */}
        {activeSection === 'fetching' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">Min Fetch Delay (ms)</label>
                  <input
                    type="number"
                    min="1000"
                    max="10000"
                    step="500"
                    value={settings.fetchDelayMs.min}
                    onChange={(e) => handleDelayChange('min', parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Max Fetch Delay (ms)</label>
                  <input
                    type="number"
                    min="1000"
                    max="10000"
                    step="500"
                    value={settings.fetchDelayMs.max}
                    onChange={(e) => handleDelayChange('max', parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Max Fetches Per Search</label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={settings.maxFetchesPerSearch || 20}
                  onChange={(e) =>
                    updateSettings((s) => ({ ...s, maxFetchesPerSearch: parseInt(e.target.value, 10) || 20 }))
                  }
                  className="w-full max-w-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200 font-mono"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  Limits the background queue depth per organic search result scan.
                </span>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-200">
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

        {/* Section 3: Niche Scoring */}
        {activeSection === 'scoring' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">Score Criteria Weights (Sum: {totalWeights} pts)</h3>
                  <p className="text-[10px] text-slate-400">Total weight must equal 100 points.</p>
                </div>
                {totalWeights !== 100 && (
                  <button
                    onClick={handleAutoNormalize}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-semibold"
                  >
                    Auto-Normalize to 100
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {[
                  { key: 'demand' as const, label: 'Demand (BSR velocity)' },
                  { key: 'competitionGap' as const, label: 'Competition Gap (Low reviews)' },
                  { key: 'weakCompetitors' as const, label: 'Weak Competitors (BSR < 100k with low reviews/rating)' },
                  { key: 'profit' as const, label: 'Profit Potential (Price minus printing cost)' },
                  { key: 'newEntrant' as const, label: 'New Entrant Friendly (Recently published)' },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between font-medium">
                      <span>{label}</span>
                      <span className="font-mono text-indigo-400 font-bold">{settings.weights[key]} pts</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      value={settings.weights[key]}
                      onChange={(e) => handleWeightChange(key, parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Thresholds */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="font-bold text-white">Threshold Boundaries</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Demand Max BSR</label>
                  <input
                    type="number"
                    value={settings.thresholds.demandBsr}
                    onChange={(e) =>
                      updateSettings((s) => ({
                        ...s,
                        thresholds: { ...s.thresholds, demandBsr: parseInt(e.target.value, 10) || 100000 },
                      }))
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Low Review Cutoff</label>
                  <input
                    type="number"
                    value={settings.thresholds.lowReviewCount}
                    onChange={(e) =>
                      updateSettings((s) => ({
                        ...s,
                        thresholds: { ...s.thresholds, lowReviewCount: parseInt(e.target.value, 10) || 50 },
                      }))
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Sales & Royalties */}
        {activeSection === 'sales' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">BSR to Monthly Sales Mapping</h3>
                  <p className="text-[10px] text-slate-400">Maps BSR ranges to estimated monthly purchase orders.</p>
                </div>
                <button
                  onClick={handleAddBsrTier}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Tier</span>
                </button>
              </div>

              <div className="space-y-2">
                {settings.bsrSalesTable.map((tier, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="number"
                      value={tier.minBsr}
                      onChange={(e) => handleUpdateBsrTier(idx, 'minBsr', parseInt(e.target.value, 10))}
                      className="col-span-4 px-2 py-1 rounded border border-slate-700 bg-slate-950 font-mono text-[11px]"
                    />
                    <input
                      type="number"
                      value={tier.maxBsr}
                      onChange={(e) => handleUpdateBsrTier(idx, 'maxBsr', parseInt(e.target.value, 10))}
                      className="col-span-4 px-2 py-1 rounded border border-slate-700 bg-slate-950 font-mono text-[11px]"
                    />
                    <input
                      type="number"
                      value={tier.monthlySales}
                      onChange={(e) => handleUpdateBsrTier(idx, 'monthlySales', parseInt(e.target.value, 10))}
                      className="col-span-3 px-2 py-1 rounded border border-slate-700 bg-slate-950 font-mono text-[11px] text-emerald-400 font-bold"
                    />
                    <button
                      onClick={() => handleRemoveBsrTier(idx)}
                      className="col-span-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="font-bold text-white">Printing Production Costs</h3>
              <p className="text-[10px] text-slate-400 leading-normal">
                Formula: fixedCost + (perPageCost × pages). Note: Always verify with the official Amazon KDP royalty calculator for final proof copies.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Fixed Cost ($)</label>
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
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Per Page ($)</label>
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
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Royalty Rate</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={settings.royaltyRate}
                    onChange={(e) =>
                      updateSettings((s) => ({ ...s, royaltyRate: parseFloat(e.target.value) || 0.6 }))
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 5: Keywords & Categories */}
        {activeSection === 'keywords' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="font-bold text-white">Keyword Scoring Weights</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Autocomplete Position</label>
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
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Title Frequency</label>
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
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Top Result BSR</label>
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
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="font-bold text-white">Google Trends Geography</h3>
              <select
                value={settings.trends?.geo || 'US'}
                onChange={(e) =>
                  updateSettings((s) => ({
                    ...s,
                    trends: { geo: e.target.value, baseUrl: s.trends?.baseUrl || 'https://trends.google.com/trends/explore' },
                  }))
                }
                className="w-full max-w-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-950"
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
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="font-bold text-white">Review Analysis Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Books to Analyze</label>
                  <input
                    type="number"
                    value={5}
                    disabled
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 font-mono opacity-60"
                  />
                  <span className="text-[10px] text-slate-500">Top 5 books scanned for visible customer reviews.</span>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Max Stars Included</label>
                  <input
                    type="number"
                    value={3}
                    disabled
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 font-mono opacity-60"
                  />
                  <span className="text-[10px] text-slate-500">Captures 1, 2, and 3 star negative complaints.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 7: Watchlist & Tracker */}
        {activeSection === 'tracker' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="font-bold text-white">Watchlist Refresh & Alarm Schedule</h3>
              <p className="text-[10px] text-slate-400">
                Automated background chrome alarm triggers every 24 hours (1440 minutes) to check books not inspected within the past 20 hours.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSimulate24hLater}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-semibold flex items-center gap-1.5 hover:bg-indigo-600/30 transition cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Simulate 24h Later (Trigger Refresh)</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadSampleHistory}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 font-semibold flex items-center gap-1.5 hover:bg-emerald-600/30 transition cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Load Sample History (14-Day Trajectory)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section 8: AI Book Generator */}
        {activeSection === 'ai' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="font-bold text-white">Claude AI Credentials</h3>
              <ApiKeyField
                apiKey={settings.claudeApiKey || ''}
                onChange={(key) => updateSettings((s) => ({ ...s, claudeApiKey: key }))}
                model={settings.claudeModel || 'claude-sonnet-5-5'}
              />

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-slate-400 mb-1">Model Name</label>
                  <input
                    type="text"
                    value={settings.claudeModel || 'claude-sonnet-5-5'}
                    onChange={(e) => updateSettings((s) => ({ ...s, claudeModel: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Max Tokens</label>
                  <input
                    type="number"
                    value={settings.ai?.maxTokens || 4000}
                    onChange={(e) =>
                      updateSettings((s) => ({
                        ...s,
                        ai: { ...DEFAULT_AI_SETTINGS, ...s.ai, maxTokens: parseInt(e.target.value, 10) || 4000 },
                      }))
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Forbidden Words List (Comma-Separated)</label>
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 font-mono text-[11px]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-slate-400">System Prompt</label>
                  <button
                    onClick={() =>
                      updateSettings((s) => ({
                        ...s,
                        ai: { ...DEFAULT_AI_SETTINGS, ...s.ai, systemPrompt: DEFAULT_KDP_SYSTEM_PROMPT },
                      }))
                    }
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 font-mono text-[11px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 9: Storage & Backup */}
        {activeSection === 'data' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="font-bold text-white">Local Storage & Settings Backup</h3>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportSettingsJson}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-semibold flex items-center gap-1.5 hover:bg-indigo-600/30 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Settings JSON</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-semibold flex items-center gap-1.5 hover:bg-slate-700 transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import Settings JSON</span>
                </button>
              </div>

              <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeKeyInExport}
                  onChange={(e) => setIncludeKeyInExport(e.target.checked)}
                  className="accent-indigo-600"
                />
                <span>Include Anthropic API key in JSON backup (Warning: contains secret credentials)</span>
              </label>

              <div className="pt-3 border-t border-slate-800 flex gap-3">
                <button
                  onClick={async () => {
                    await clearCache();
                    updateStorageUsage();
                    alert('Product 24-hour cache cleared.');
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Clear 24h Cache
                </button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-3">
              <h3 className="font-bold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Reset & Purge All Storage
              </h3>
              <p className="text-[10px] text-slate-400">
                To prevent accidental data loss, type the word <strong>DELETE</strong> below to wipe all snapshots, watchlist items, and settings.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder='Type "DELETE" to confirm'
                  value={deleteConfirmationInput}
                  onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-rose-800 bg-slate-950 font-mono text-xs w-48 text-rose-300"
                />
                <button
                  onClick={handleClearAllConfirm}
                  disabled={deleteConfirmationInput.trim() !== 'DELETE'}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold disabled:opacity-40 transition cursor-pointer"
                >
                  Clear ALL Extension Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section 10: About & Guide */}
        {activeSection === 'about' && (
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-sm">About KDP Niche Finder</h3>
            <p className="text-slate-300 leading-relaxed">
              KDP Niche Finder is a personal Amazon KDP research intelligence tool designed to run entirely locally in your browser. It extracts organic search metrics, calculates multi-factor Niche Scores, tracks daily BSR trajectories, analyzes customer review complaints, and creates data-backed book blueprints via the Anthropic Claude API.
            </p>

            <div className="space-y-1.5 text-[11px] text-slate-400">
              <div className="font-semibold text-white">Key Architectural Guarantees:</div>
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
