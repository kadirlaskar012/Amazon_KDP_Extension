// src/entrypoints/options/App.tsx
// Plain utilitarian Options Page:
// - Left nav as a simple text list with links
// - Sections separated by <hr> 1px lines
// - Normal native form controls
// - No decorative cards, gradients, or shadows

import React, { useEffect, useState, useRef } from 'react';
import type { Settings, ScoreWeights, BsrSalesTier } from '../../types';
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
}

export const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [storageBytes, setStorageBytes] = useState<number>(0);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState<string>('');
  const [includeKeyInExport, setIncludeKeyInExport] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setSavedFeedback('Saved');
    setTimeout(() => setSavedFeedback(null), 2000);
  };

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

  const handleMarketplaceChange = (marketplace: string) => {
    updateSettings((s) => ({ ...s, marketplace }));
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateSettings((s) => ({ ...s, theme }));
  };

  const handleDelayChange = (field: 'min' | 'max', value: number) => {
    const val = isNaN(value) ? 1000 : Math.max(1000, value);
    updateSettings((s) => {
      const delays = { ...s.fetchDelayMs, [field]: val };
      if (field === 'min' && delays.min > delays.max) delays.max = delays.min;
      if (field === 'max' && delays.max < delays.min) delays.min = delays.max;
      return { ...s, fetchDelayMs: delays };
    });
  };

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
    alert(`Loaded 14 days of sample trajectory into "${target.title}".`);
  };

  const handleExportSettingsJson = () => {
    const exported = { ...settings };
    if (!includeKeyInExport) {
      delete (exported as any).geminiApiKey;
      delete (exported as any).geminiApiKeys;
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
          geminiApiKey: imported.geminiApiKey || prev.geminiApiKey,
          geminiApiKeys: imported.geminiApiKeys || prev.geminiApiKeys,
          geminiModel: imported.geminiModel || prev.geminiModel || 'gemini-flash-latest',
        }));
        alert('Settings successfully imported.');
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
    alert('All extension storage has been cleared.');
  };

  const totalWeights = Object.values(settings.weights).reduce((a, b) => a + b, 0);

  const navItems: NavItem[] = [
    { id: 'general', label: '1. General' },
    { id: 'fetching', label: '2. Fetching & Safety' },
    { id: 'scoring', label: '3. Niche Scoring' },
    { id: 'sales', label: '4. Sales & Royalties' },
    { id: 'keywords', label: '5. Keywords & Cats' },
    { id: 'reviews', label: '6. Reviews Lexicon' },
    { id: 'tracker', label: '7. Watchlist & Tracker' },
    { id: 'ai', label: '8. AI Book Generator' },
    { id: 'data', label: '9. Storage & Backup' },
    { id: 'about', label: '10. About & Guide' },
  ];

  return (
    <div
      className={`min-h-screen leading-[1.5] ${
        settings.textSize === 'large' ? 'text-size-large' : settings.textSize === 'extra-large' ? 'text-size-extra-large' : ''
      } ${settings.theme === 'dark' ? 'dark' : ''}`}
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 'var(--font-base-size)',
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportSettingsJson}
        accept=".json,application/json"
        className="hidden"
      />

      <div className="flex flex-col md:flex-row min-h-screen">
        {/* Left Nav: Simple text list with links */}
        <aside
          className="w-full md:w-56 p-4 border-b md:border-b-0 md:border-r shrink-0"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="mb-4">
            <h1 className="font-bold text-[15px]">KDP Niche Finder</h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Settings
            </p>
          </div>

          <nav className="flex flex-wrap md:flex-col gap-1">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className="text-left py-1 px-1.5 cursor-pointer"
                  style={{
                    background: 'none',
                    border: 'none',
                    fontWeight: isActive ? 'bold' : 'normal',
                    textDecoration: isActive ? 'underline' : 'none',
                    color: isActive ? 'var(--text)' : 'var(--link)',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="hidden md:block mt-6 pt-3 border-t text-xs space-y-1" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
            <div>v1.0.0</div>
            <div>Storage: {(storageBytes / 1024).toFixed(1)} KB</div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 max-w-3xl overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-4 border-b" style={{ borderColor: 'var(--line)' }}>
            <div>
              <h2 className="font-bold text-[15px]">
                {navItems.find((n) => n.id === activeSection)?.label}
              </h2>
            </div>
            {savedFeedback && (
              <span className="text-xs font-bold" style={{ color: 'var(--good)' }}>
                {savedFeedback}
              </span>
            )}
          </div>

          {/* Section 1: General */}
          {activeSection === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-1">Target Marketplace</label>
                <select
                  value={settings.marketplace}
                  onChange={(e) => handleMarketplaceChange(e.target.value)}
                  className="plain-select w-64"
                >
                  <option value="amazon.com">amazon.com (US - Default)</option>
                  <option value="amazon.co.uk">amazon.co.uk (UK)</option>
                  <option value="amazon.de">amazon.de (DE)</option>
                  <option value="amazon.ca">amazon.ca (CA)</option>
                </select>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  amazon.com is fully supported. Non-US regional domains are experimental.
                </div>
              </div>

              <hr style={{ borderColor: 'var(--line)', margin: '12px 0' }} />

              <div>
                <label className="block font-medium mb-1">Theme</label>
                <select
                  value={settings.theme || 'system'}
                  onChange={(e) => handleThemeChange(e.target.value as any)}
                  className="plain-select w-64"
                >
                  <option value="system">System Synchronized</option>
                  <option value="dark">Dark Mode</option>
                  <option value="light">Light Mode</option>
                </select>
              </div>

              <hr style={{ borderColor: 'var(--line)', margin: '12px 0' }} />

              <div>
                <label className="block font-medium mb-1">Sidebar Default Position</label>
                <div className="flex gap-4" style={{ fontSize: 'var(--font-small)' }}>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="sidebarPos"
                      checked={settings.sidebarPosition !== 'left'}
                      onChange={() => updateSettings((s) => ({ ...s, sidebarPosition: 'right' }))}
                    />
                    <span>Right Side</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="sidebarPos"
                      checked={settings.sidebarPosition === 'left'}
                      onChange={() => updateSettings((s) => ({ ...s, sidebarPosition: 'left' }))}
                    />
                    <span>Left Side</span>
                  </label>
                </div>
              </div>

              <hr style={{ borderColor: 'var(--line)', margin: '12px 0' }} />

              <div>
                <label className="block font-medium mb-1">Text Size</label>
                <select
                  value={settings.textSize || 'normal'}
                  onChange={(e) => updateSettings((s) => ({ ...s, textSize: e.target.value as any }))}
                  className="plain-select w-64"
                >
                  <option value="normal">Normal (16px base)</option>
                  <option value="large">Large (18px base)</option>
                  <option value="extra-large">Extra-large (20px base)</option>
                </select>
                <div className="mt-0.5" style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
                  Controls the base font size in the sidebar and popup. Minimum size is always 14px.
                </div>
              </div>

              <hr style={{ borderColor: 'var(--line)', margin: '12px 0' }} />

              <div>
                <label className="block font-medium mb-1">Sidebar Default Width</label>
                <select
                  value={settings.sidebarWidth || 440}
                  onChange={(e) => updateSettings((s) => ({ ...s, sidebarWidth: Number(e.target.value) }))}
                  className="plain-select w-64"
                >
                  <option value={360}>Narrow (360px)</option>
                  <option value={440}>Medium (440px) — Default</option>
                  <option value={520}>Wide (520px)</option>
                  <option value={600}>Extra-wide (600px)</option>
                </select>
                <div className="mt-0.5" style={{ fontSize: 'var(--font-small)', color: 'var(--muted)' }}>
                  You can also drag the sidebar's edge to resize it at any time. The dragged width is remembered per session.
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Fetching & Safety */}
          {activeSection === 'fetching' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-1">Min Fetch Delay (ms)</label>
                  <input
                    type="number"
                    min="1000"
                    max="10000"
                    step="500"
                    value={settings.fetchDelayMs.min}
                    onChange={(e) => handleDelayChange('min', parseInt(e.target.value, 10))}
                    className="plain-input w-48 font-mono"
                  />
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Minimum delay between requests (default: 2000ms).
                  </div>
                </div>

                <div>
                  <label className="block font-medium mb-1">Max Fetch Delay (ms)</label>
                  <input
                    type="number"
                    min="1000"
                    max="10000"
                    step="500"
                    value={settings.fetchDelayMs.max}
                    onChange={(e) => handleDelayChange('max', parseInt(e.target.value, 10))}
                    className="plain-input w-48 font-mono"
                  />
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Maximum delay to mimic browsing (default: 3000ms).
                  </div>
                </div>
              </div>

              <hr style={{ borderColor: 'var(--line)', margin: '12px 0' }} />

              <div>
                <label className="block font-medium mb-1">Max Fetches Per Search</label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={settings.maxFetchesPerSearch || 20}
                  onChange={(e) =>
                    updateSettings((s) => ({ ...s, maxFetchesPerSearch: parseInt(e.target.value, 10) || 20 }))
                  }
                  className="plain-input w-48 font-mono"
                />
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  Limits background queue depth per search result scan (default: 20).
                </div>
              </div>

              <hr style={{ borderColor: 'var(--line)', margin: '12px 0' }} />

              <div>
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={settings.pauseAllFetching || false}
                    onChange={(e) => updateSettings((s) => ({ ...s, pauseAllFetching: e.target.checked }))}
                  />
                  <span>Pause All Background Queue Fetches (Emergency Switch)</span>
                </label>
              </div>
            </div>
          )}

          {/* Section 3: Niche Scoring */}
          {activeSection === 'scoring' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b" style={{ borderColor: 'var(--line)' }}>
                <div>
                  <span className="font-bold">Score Criteria Weights</span> (Sum: {totalWeights} pts)
                </div>
                {totalWeights !== 100 && (
                  <button onClick={handleAutoNormalize} className="plain-btn text-xs">
                    Normalize to 100
                  </button>
                )}
              </div>

              <table className="plain-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Factor</th>
                    <th style={{ width: '140px' }}>Slider</th>
                    <th className="text-right" style={{ width: '60px' }}>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'demand' as const, label: 'Demand (BSR velocity)' },
                    { key: 'competitionGap' as const, label: 'Competition Gap (Low reviews)' },
                    { key: 'weakCompetitors' as const, label: 'Weak Competitors (BSR < 100k, low reviews)' },
                    { key: 'profit' as const, label: 'Profit Potential (Price minus printing)' },
                    { key: 'newEntrant' as const, label: 'New Entrant Friendly (Recently published)' },
                  ].map(({ key, label }) => (
                    <tr key={key}>
                      <td className="font-medium">{label}</td>
                      <td>
                        <input
                          type="range"
                          min="0"
                          max="60"
                          value={settings.weights[key]}
                          onChange={(e) => handleWeightChange(key, parseInt(e.target.value, 10))}
                          className="w-full cursor-pointer"
                        />
                      </td>
                      <td className="text-right font-mono font-bold">
                        {settings.weights[key]} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <hr style={{ borderColor: 'var(--line)', margin: '12px 0' }} />

              <div className="font-bold mb-2">Threshold Boundaries</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-1">Demand Max BSR</label>
                  <input
                    type="number"
                    value={settings.thresholds.demandBsr}
                    onChange={(e) =>
                      updateSettings((s) => ({
                        ...s,
                        thresholds: { ...s.thresholds, demandBsr: parseInt(e.target.value, 10) || 100000 },
                      }))
                    }
                    className="plain-input w-48 font-mono"
                  />
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    BSR lower than this counts as high-demand.
                  </div>
                </div>

                <div>
                  <label className="block font-medium mb-1">Low Review Cutoff</label>
                  <input
                    type="number"
                    value={settings.thresholds.lowReviewCount}
                    onChange={(e) =>
                      updateSettings((s) => ({
                        ...s,
                        thresholds: { ...s.thresholds, lowReviewCount: parseInt(e.target.value, 10) || 50 },
                      }))
                    }
                    className="plain-input w-48 font-mono"
                  />
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Fewer reviews than this considered beatable.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Sales & Royalties */}
          {activeSection === 'sales' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b" style={{ borderColor: 'var(--line)' }}>
                <span className="font-bold">BSR to Monthly Sales Mapping</span>
                <button onClick={handleAddBsrTier} className="plain-btn text-xs">
                  + Add Tier
                </button>
              </div>

              <table className="plain-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Min BSR</th>
                    <th>Max BSR</th>
                    <th>Est. Monthly Sales</th>
                    <th className="text-center" style={{ width: '50px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.bsrSalesTable.map((tier, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          type="number"
                          value={tier.minBsr}
                          onChange={(e) => handleUpdateBsrTier(idx, 'minBsr', parseInt(e.target.value, 10))}
                          className="plain-input w-28 font-mono text-xs"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={tier.maxBsr}
                          onChange={(e) => handleUpdateBsrTier(idx, 'maxBsr', parseInt(e.target.value, 10))}
                          className="plain-input w-28 font-mono text-xs"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={tier.monthlySales}
                          onChange={(e) => handleUpdateBsrTier(idx, 'monthlySales', parseInt(e.target.value, 10))}
                          className="plain-input w-24 font-mono text-xs font-bold"
                          style={{ color: 'var(--good)' }}
                        />
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => handleRemoveBsrTier(idx)}
                          className="plain-link text-xs"
                          style={{ color: 'var(--bad)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <hr style={{ borderColor: 'var(--line)', margin: '12px 0' }} />

              <div className="font-bold mb-1">Printing Production Costs</div>
              <div className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                Formula: fixedCost + (perPageCost × pages). Verified against standard Amazon KDP rates.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium mb-1">Fixed Cost ($)</label>
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
                    className="plain-input w-32 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Per Page ($)</label>
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
                    className="plain-input w-32 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Royalty Rate</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={settings.royaltyRate}
                    onChange={(e) =>
                      updateSettings((s) => ({ ...s, royaltyRate: parseFloat(e.target.value) || 0.6 }))
                    }
                    className="plain-input w-32 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Keywords & Categories */}
          {activeSection === 'keywords' && (
            <div className="space-y-4">
              <div className="font-bold mb-2">Keyword Scoring Weights</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium mb-1">Autocomplete Position</label>
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
                    className="plain-input w-32 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Title Frequency</label>
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
                    className="plain-input w-32 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Top Result BSR</label>
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
                    className="plain-input w-32 font-mono"
                  />
                </div>
              </div>

              <hr style={{ borderColor: 'var(--line)', margin: '12px 0' }} />

              <div>
                <label className="block font-medium mb-1">Google Trends Geography</label>
                <select
                  value={settings.trends?.geo || 'US'}
                  onChange={(e) =>
                    updateSettings((s) => ({
                      ...s,
                      trends: { geo: e.target.value, baseUrl: s.trends?.baseUrl || 'https://trends.google.com/trends/explore' },
                    }))
                  }
                  className="plain-select w-64"
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
              <div className="font-bold mb-2">Review Analysis Settings</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-1">Books to Analyze</label>
                  <input
                    type="number"
                    value={5}
                    disabled
                    className="plain-input w-32 font-mono opacity-60"
                  />
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Top 5 competitor books scanned for visible customer reviews.
                  </div>
                </div>
                <div>
                  <label className="block font-medium mb-1">Max Stars Included</label>
                  <input
                    type="number"
                    value={3}
                    disabled
                    className="plain-input w-32 font-mono opacity-60"
                  />
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Captures 1, 2, and 3 star negative complaints.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 7: Watchlist & Tracker */}
          {activeSection === 'tracker' && (
            <div className="space-y-4">
              <div className="font-bold mb-1">Watchlist Refresh & Alarm Schedule</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Automated background alarm triggers every 24 hours to check books not inspected within the past 20 hours.
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSimulate24hLater}
                  className="plain-btn"
                >
                  Simulate 24h Later
                </button>

                <button
                  type="button"
                  onClick={handleLoadSampleHistory}
                  className="plain-btn"
                >
                  Load 14-Day Sample History
                </button>
              </div>
            </div>
          )}

          {/* Section 8: AI Book Generator */}
          {activeSection === 'ai' && (
            <div className="space-y-4">
              <ApiKeyField
                apiKey={settings.geminiApiKey || ''}
                apiKeys={settings.geminiApiKeys || []}
                onChange={(primaryKey, allKeys) =>
                  updateSettings((s) => ({
                    ...s,
                    geminiApiKey: primaryKey,
                    geminiApiKeys: allKeys || [primaryKey],
                  }))
                }
                model={settings.geminiModel || 'gemini-flash-latest'}
              />

              <hr style={{ borderColor: 'var(--line)', margin: '12px 0' }} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium">Gemini Model</label>
                    <span className="text-[11px] text-[var(--muted)]">
                      (Recommended: Latest, Auto-Updates)
                    </span>
                  </div>
                  <select
                    value={settings.geminiModel || 'gemini-flash-latest'}
                    onChange={(e) => updateSettings((s) => ({ ...s, geminiModel: e.target.value }))}
                    className="plain-select w-full font-mono text-xs"
                  >
                    <option value="gemini-flash-latest">gemini-flash-latest (Recommended, auto-updates)</option>
                    <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash (shuts down Oct 16, 2026 — avoid)</option>
                  </select>
                  <p className="text-[11px] text-[var(--muted)] mt-1">
                    Gemini model names change periodically — if you see a 404 error, switch to gemini-flash-latest.
                  </p>
                </div>
                <div>
                  <label className="block font-medium mb-1">Max Tokens</label>
                  <input
                    type="number"
                    value={settings.ai?.maxTokens || 8192}
                    onChange={(e) =>
                      updateSettings((s) => ({
                        ...s,
                        ai: { ...DEFAULT_AI_SETTINGS, ...s.ai, maxTokens: parseInt(e.target.value, 10) || 8192 },
                      }))
                    }
                    className="plain-input w-48 font-mono text-xs"
                  />
                </div>
              </div>

              <hr style={{ borderColor: 'var(--line)', margin: '12px 0' }} />

              <div>
                <label className="block font-medium mb-1">Forbidden Words List (Comma-Separated)</label>
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
                  className="plain-input w-full font-mono text-xs"
                />
              </div>

              <hr style={{ borderColor: 'var(--line)', margin: '12px 0' }} />

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-medium">System Prompt</label>
                  <button
                    onClick={() =>
                      updateSettings((s) => ({
                        ...s,
                        ai: { ...DEFAULT_AI_SETTINGS, ...s.ai, systemPrompt: DEFAULT_KDP_SYSTEM_PROMPT },
                      }))
                    }
                    className="plain-link text-xs"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
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
                  className="plain-input w-full font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* Section 9: Storage & Backup */}
          {activeSection === 'data' && (
            <div className="space-y-4">
              <div className="font-bold mb-2">Local Storage & Settings Backup</div>

              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={handleExportSettingsJson} className="plain-btn">
                  Export Settings JSON
                </button>

                <button onClick={() => fileInputRef.current?.click()} className="plain-btn">
                  Import Settings JSON
                </button>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeKeyInExport}
                    onChange={(e) => setIncludeKeyInExport(e.target.checked)}
                  />
                  <span>Include Gemini API keys in JSON backup (Warning: contains credentials)</span>
                </label>
              </div>

              <hr style={{ borderColor: 'var(--line)', margin: '12px 0' }} />

              <div>
                <button
                  onClick={async () => {
                    await clearCache();
                    updateStorageUsage();
                    alert('Product 24-hour cache cleared.');
                  }}
                  className="plain-btn"
                >
                  Clear 24h Cache
                </button>
              </div>

              <hr style={{ borderColor: 'var(--line)', margin: '12px 0' }} />

              <div className="space-y-2">
                <div className="font-bold" style={{ color: 'var(--bad)' }}>
                  Reset & Purge All Storage
                </div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>
                  Type the word DELETE below to clear all research snapshots, watchlist items, and settings.
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder='Type "DELETE"'
                    value={deleteConfirmationInput}
                    onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                    className="plain-input w-48 font-mono text-xs"
                  />
                  <button
                    onClick={handleClearAllConfirm}
                    disabled={deleteConfirmationInput.trim() !== 'DELETE'}
                    className="plain-btn font-bold"
                    style={{ color: 'var(--bad)' }}
                  >
                    Clear All Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 10: About & Guide */}
          {activeSection === 'about' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-[15px]">KDP Niche Finder</h3>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>
                  v1.0.0
                </div>
              </div>
              <p className="text-xs leading-relaxed">
                KDP Niche Finder is a personal Amazon KDP research intelligence tool designed to run locally in your browser. It extracts organic search metrics, calculates multi-factor Niche Scores, tracks daily BSR trajectories, analyzes customer review complaints, and creates data-backed book blueprints via the Google Gemini API.
              </p>

              <hr style={{ borderColor: 'var(--line)', margin: '12px 0' }} />

              <div className="space-y-1.5 text-xs">
                <div className="font-bold">Architectural Specifications:</div>
                <div>• <strong>Privacy:</strong> All competitor and search data remains strictly in your local browser storage.</div>
                <div>• <strong>Security:</strong> Google Gemini API requests are dispatched exclusively from background service workers; your key is never injected into web pages.</div>
                <div>• <strong>Resilience:</strong> Automated CAPTCHA detection halts queue processing to protect accounts.</div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
