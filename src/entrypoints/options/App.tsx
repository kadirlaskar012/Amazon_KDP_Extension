import React, { useEffect, useState } from 'react';
import type { Settings, ScoreWeights, BsrSalesTier } from '../../types';
import { getSettings, saveSettings, clearCache, clearAllData } from '../../storage';
import { DEFAULT_SETTINGS } from '../../config/defaults';
import { normalizeWeights } from '../../services/scoring';
import {
  Key,
  Sliders,
  Shield,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Save,
  Scale,
  DollarSign,
  TrendingUp,
  Plus,
} from 'lucide-react';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const s = await getSettings();
      setSettings(s);
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings(settings);
    setStatusMessage('Settings successfully saved to local storage!');
    setTimeout(() => {
      setStatusMessage(null);
    }, 3000);
  };

  const handleResetToDefaults = async () => {
    if (confirm('Reset all settings to default values?')) {
      const reset = await saveSettings(DEFAULT_SETTINGS);
      setSettings(reset);
      setStatusMessage('Settings have been reset to defaults.');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleClearCache = async () => {
    await clearCache();
    setStatusMessage('Product cache (24h) has been cleared!');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to delete all settings, watchlist items, and caches?')) {
      await clearAllData();
      const reset = await getSettings();
      setSettings(reset);
      setStatusMessage('All extension data has been reset.');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleWeightChange = (key: keyof ScoreWeights, val: number) => {
    setSettings((prev) => ({
      ...prev,
      weights: {
        ...prev.weights,
        [key]: val,
      },
    }));
  };

  const handleAutoNormalizeWeights = () => {
    setSettings((prev) => ({
      ...prev,
      weights: normalizeWeights(prev.weights),
    }));
  };

  const handleAddBsrTier = () => {
    setSettings((prev) => ({
      ...prev,
      bsrSalesTable: [
        ...prev.bsrSalesTable,
        { minBsr: 100000, maxBsr: 500000, monthlySales: 15 },
      ],
    }));
  };

  const handleRemoveBsrTier = (idx: number) => {
    setSettings((prev) => ({
      ...prev,
      bsrSalesTable: prev.bsrSalesTable.filter((_, i) => i !== idx),
    }));
  };

  const handleUpdateBsrTier = (idx: number, field: keyof BsrSalesTier, val: number) => {
    setSettings((prev) => {
      const updated = [...prev.bsrSalesTable];
      if (updated[idx]) {
        updated[idx] = { ...updated[idx]!, [field]: val };
      }
      return { ...prev, bsrSalesTable: updated };
    });
  };

  const totalWeights = Object.values(settings.weights).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 font-sans text-slate-800 dark:text-slate-100">
      <header className="mb-6 border-b border-slate-200 dark:border-slate-800 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            KDP Niche Finder Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure scoring weights, threshold rules, BSR-sales mapping, and printing costs.
          </p>
        </div>
      </header>

      {statusMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Niche Score Weights */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
              <Sliders className="w-5 h-5 text-indigo-600" />
              <h2>Niche Score Weights (Sum: {totalWeights} pts)</h2>
            </div>
            <div className="flex items-center gap-2">
              {totalWeights !== 100 && (
                <button
                  type="button"
                  onClick={handleAutoNormalizeWeights}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/30 hover:bg-blue-500/20 transition cursor-pointer"
                >
                  Auto-Normalize to 100
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Customize the 5 criteria that determine the 0-100 Niche Score. Weights must sum to 100.
          </p>

          <div className="space-y-3.5">
            {[
              {
                key: 'demand' as const,
                label: `Demand (BSR < ${settings.thresholds.demandBsr.toLocaleString()})`,
                desc: 'Measures organic customer purchase volume in the search results',
              },
              {
                key: 'competitionGap' as const,
                label: `Competition Gap (Reviews < ${settings.thresholds.lowReviewCount})`,
                desc: 'Easier ranking opportunity when competitors have low review counts',
              },
              {
                key: 'weakCompetitors' as const,
                label: `Weak Competitors (BSR < 100k & low rating/reviews)`,
                desc: 'High demand books with vulnerable ratings (< 4.0) or low reviews (< 30)',
              },
              {
                key: 'profit' as const,
                label: 'Profit Potential (Price minus printing cost)',
                desc: 'Median estimated royalty per sale ($3.00+ awards full points)',
              },
              {
                key: 'newEntrant' as const,
                label: `New Entrant Friendly (Published < ${settings.thresholds.newEntrantMonths} mos)`,
                desc: 'Recent books gaining traction (30%+ recently published gives full points)',
              },
            ].map(({ key, label, desc }) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-800 dark:text-slate-200">{label}</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {settings.weights[key]} pts
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={settings.weights[key]}
                  onChange={(e) => handleWeightChange(key, parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 2. Thresholds Configuration */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <Scale className="w-5 h-5 text-blue-600" />
            <h2>Scoring Thresholds</h2>
          </div>
          <p className="text-xs text-slate-500">
            Define boundary values for demand, weak competitors, and score ratings.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Demand Max BSR
              </label>
              <input
                type="number"
                value={settings.thresholds.demandBsr}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    thresholds: {
                      ...settings.thresholds,
                      demandBsr: parseInt(e.target.value, 10) || 0,
                    },
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Low Review Count
              </label>
              <input
                type="number"
                value={settings.thresholds.lowReviewCount}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    thresholds: {
                      ...settings.thresholds,
                      lowReviewCount: parseInt(e.target.value, 10) || 0,
                    },
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Weak Review Count
              </label>
              <input
                type="number"
                value={settings.thresholds.weakReviewCount}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    thresholds: {
                      ...settings.thresholds,
                      weakReviewCount: parseInt(e.target.value, 10) || 0,
                    },
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Weak Rating Max
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.thresholds.weakRating}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    thresholds: {
                      ...settings.thresholds,
                      weakRating: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                New Entrant (Months)
              </label>
              <input
                type="number"
                value={settings.thresholds.newEntrantMonths}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    thresholds: {
                      ...settings.thresholds,
                      newEntrantMonths: parseInt(e.target.value, 10) || 0,
                    },
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Green Min Score
              </label>
              <input
                type="number"
                value={settings.thresholds.greenMin}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    thresholds: {
                      ...settings.thresholds,
                      greenMin: parseInt(e.target.value, 10) || 0,
                    },
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
          </div>
        </section>

        {/* 3. BSR to Sales Lookup Table */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h2>BSR to Monthly Sales Table</h2>
            </div>
            <button
              type="button"
              onClick={handleAddBsrTier}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Tier
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Maps Amazon Best Sellers Rank ranges to estimated monthly unit sales.
          </p>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-slate-500 px-1">
              <div className="col-span-4">Min BSR</div>
              <div className="col-span-4">Max BSR</div>
              <div className="col-span-3">Monthly Sales</div>
              <div className="col-span-1 text-center">X</div>
            </div>

            {settings.bsrSalesTable.map((tier, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <input
                    type="number"
                    value={tier.minBsr}
                    onChange={(e) =>
                      handleUpdateBsrTier(idx, 'minBsr', parseInt(e.target.value, 10) || 0)
                    }
                    className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
                <div className="col-span-4">
                  <input
                    type="number"
                    value={tier.maxBsr}
                    onChange={(e) =>
                      handleUpdateBsrTier(idx, 'maxBsr', parseInt(e.target.value, 10) || 0)
                    }
                    className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    value={tier.monthlySales}
                    onChange={(e) =>
                      handleUpdateBsrTier(idx, 'monthlySales', parseInt(e.target.value, 10) || 0)
                    }
                    className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-emerald-600"
                  />
                </div>
                <div className="col-span-1 text-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveBsrTier(idx)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Printing Cost & Royalty */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <DollarSign className="w-5 h-5 text-amber-600" />
            <h2>Printing Cost & Royalty (US Marketplace)</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Formula: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">printingCost = fixedCost + (perPageCost × pageCount)</code>. Note: verify with the official KDP royalty calculator for exact production costs.
          </p>

          <div className="grid grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Fixed Cost ($)
              </label>
              <input
                type="number"
                step="0.05"
                value={settings.printingCost.fixedCost}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    printingCost: {
                      ...settings.printingCost,
                      fixedCost: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Per Page Cost ($)
              </label>
              <input
                type="number"
                step="0.001"
                value={settings.printingCost.perPageCost}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    printingCost: {
                      ...settings.printingCost,
                      perPageCost: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                KDP Royalty Rate
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.royaltyRate}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    royaltyRate: parseFloat(e.target.value) || 0.6,
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
          </div>
        </section>

        {/* 5. Claude AI API Key */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <Key className="w-5 h-5 text-blue-600" />
            <h2>Claude API Key (Anthropic)</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Stored locally in <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">chrome.storage.local</code>. Never hardcoded or sent to third-party backends.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                API Key
              </label>
              <input
                type="password"
                placeholder="sk-ant-api03-..."
                value={settings.claudeApiKey}
                onChange={(e) => setSettings({ ...settings, claudeApiKey: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Claude Model
              </label>
              <input
                type="text"
                placeholder="claude-sonnet-5-5"
                value={settings.claudeModel}
                onChange={(e) => setSettings({ ...settings, claudeModel: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
          </div>
        </section>

        {/* 6. Rate Limiting & Safety */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h2>Rate Limiting & Safety</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Randomized delay between requests to protect your account and IP.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Min Fetch Delay (ms)
              </label>
              <input
                type="number"
                min="1000"
                max="10000"
                step="500"
                value={settings.fetchDelayMs.min}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    fetchDelayMs: { ...settings.fetchDelayMs, min: parseInt(e.target.value, 10) },
                  })
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Max Fetch Delay (ms)
              </label>
              <input
                type="number"
                min="1000"
                max="10000"
                step="500"
                value={settings.fetchDelayMs.max}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    fetchDelayMs: { ...settings.fetchDelayMs, max: parseInt(e.target.value, 10) },
                  })
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Defaults
            </button>
            <button
              type="button"
              onClick={handleClearCache}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              Clear 24h Cache
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-medium transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset All
            </button>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
};
