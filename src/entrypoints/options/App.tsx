import type { Settings, ScoreWeights } from '../../types';
import { getSettings, saveSettings, clearCache, clearAllData } from '../../storage';
import { DEFAULT_SETTINGS } from '../../config/defaults';
import { Key, Sliders, Shield, Trash2, CheckCircle2, RotateCcw, Save } from 'lucide-react';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [savedSuccess, setSavedSuccess] = useState(false);
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
    setSavedSuccess(true);
    setStatusMessage('Settings successfully saved to local storage!');
    setTimeout(() => {
      setSavedSuccess(false);
      setStatusMessage(null);
    }, 3000);
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
      setStatusMessage('All extension data has been reset to defaults.');
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

  const totalWeights = Object.values(settings.weights).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 font-sans">
      <header className="mb-8 border-b border-slate-200 dark:border-slate-800 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            KDP Niche Finder Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure your personal AI keys, scoring formulas, and background fetch rates.
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
        {/* Claude AI API Key */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <Key className="w-5 h-5 text-blue-600" />
            <h2>Claude API Key (Anthropic)</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Used directly by your browser to generate high-yield book ideas and backend keywords in Module J. Your key is stored securely in your browser's <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">chrome.storage.local</code> and never sent to any external server.
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
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
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
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Default: <code className="font-mono">claude-sonnet-5-5</code>
              </span>
            </div>
          </div>
        </section>

        {/* Niche Score Weights */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
              <Sliders className="w-5 h-5 text-indigo-600" />
              <h2>Niche Score Weights (Sum: {totalWeights} pts)</h2>
            </div>
            {totalWeights !== 100 && (
              <span className="text-xs font-semibold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                Recommended sum is 100
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Customize how much each criteria influences the 0-100 Niche Score (Module B).
          </p>

          <div className="space-y-3.5">
            {[
              { key: 'demand' as const, label: 'Demand (BSR < 100,000 count)', desc: 'Measures search customer purchasing activity' },
              { key: 'competitionGap' as const, label: 'Competition Gap (Reviews < 50 count)', desc: 'Easier to break into rankings' },
              { key: 'weakCompetitors' as const, label: 'Weak Competitors (BSR < 100k & low rating/reviews)', desc: 'Vulnerable ranking books' },
              { key: 'profit' as const, label: 'Profit Potential (Price minus printing cost)', desc: 'Margin headroom' },
              { key: 'newEntrant' as const, label: 'New Entrant Friendly (Published < 12 months)', desc: 'Recent books gaining traction' },
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

        {/* Rate Limiting & Safety */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h2>Rate Limiting & Safety (Hard Rules)</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Background requests are automatically randomized between 2 to 3 seconds to preserve account safety. All fetched products are cached for 24 hours.
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
              onClick={handleClearCache}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear 24h Cache
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-medium transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset All Data
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
